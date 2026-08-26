"""
Incremental repository indexer.
Only re-processes files that changed between the previously indexed commit
and the new HEAD. Uses SHA256 content hashing to further avoid redundant work.
Called after PR merges / pushes to default branch.
"""

import logging
from pathlib import Path

from ..core.config import settings
from ..git.clone_service import clone_repository, get_head_sha, cleanup_clone
from ..graph.graph_writer import (
    upsert_file_node, upsert_symbols, upsert_edges,
    upsert_defined_in_edges, delete_file_subgraph, get_repo_stats,
)
from ..graph.neo4j_client import get_session
from ..indexing.hasher import compute_content_hash
from ..parsers.language_registry import get_parser_for_file, get_language_for_file

logger = logging.getLogger(__name__)


async def _get_existing_file_hashes(repo_id: str) -> dict[str, str]:
    """Fetch content_hash for all File nodes in the graph for this repo."""
    query = """
    MATCH (f:File {repo_id: $repo_id})
    RETURN f.path AS path, f.content_hash AS content_hash
    """
    async with get_session() as session:
        result = await session.run(query, repo_id=repo_id)
        records = await result.data()

    return {r["path"]: r["content_hash"] for r in records}


async def run_incremental_index(
    owner: str,
    repo: str,
    token: str,
    repo_id: str,
    branch: str = "main",
    changed_files: list[str] | None = None,
) -> dict:
    """
    Execute an incremental index update.

    If changed_files is provided (from webhook payload), only those files are re-processed.
    Otherwise, we clone HEAD and compare content hashes with the existing graph
    to determine what changed.

    Steps:
    1. Clone HEAD (shallow)
    2. Determine changed/added/deleted files
    3. For deleted files: remove their subgraph
    4. For changed/added files: re-parse and upsert
    5. Clean up clone

    Returns:
        Dict with update stats
    """
    logger.info("starting incremental index for %s/%s (repo_id: %s)", owner, repo, repo_id)

    clone_dir = clone_repository(owner, repo, token, repo_id, branch)
    commit_sha = get_head_sha(clone_dir)

    try:
        # Get existing file hashes from the graph
        existing_hashes = await _get_existing_file_hashes(repo_id)

        # Discover current files on disk
        from .full_indexer import _discover_files
        current_files = _discover_files(clone_dir)
        current_paths: dict[str, Path] = {}
        for fpath in current_files:
            rel = str(fpath.relative_to(clone_dir)).replace("\\", "/")
            current_paths[rel] = fpath

        # Determine what changed
        added: list[str] = []
        modified: list[str] = []
        deleted: list[str] = []

        if changed_files is not None:
            # Trust the webhook payload — only process listed files
            for f in changed_files:
                if f in current_paths:
                    if f in existing_hashes:
                        modified.append(f)
                    else:
                        added.append(f)
                elif f in existing_hashes:
                    deleted.append(f)
        else:
            # Full diff: compare hashes
            current_file_set = set(current_paths.keys())
            existing_file_set = set(existing_hashes.keys())

            deleted = list(existing_file_set - current_file_set)
            added = list(current_file_set - existing_file_set)

            # Check modified: same path, different hash
            for path in current_file_set & existing_file_set:
                fpath = current_paths[path]
                try:
                    source = fpath.read_text(encoding="utf-8", errors="replace")
                    new_hash = compute_content_hash(source)
                    if new_hash != existing_hashes.get(path):
                        modified.append(path)
                except Exception:
                    modified.append(path)  # Re-process on read error

        logger.info(
            "incremental diff: %d added, %d modified, %d deleted",
            len(added), len(modified), len(deleted),
        )

        # Process deletions
        for path in deleted:
            await delete_file_subgraph(repo_id, path)

        # Process additions and modifications
        total_symbols = 0
        total_edges = 0
        total_errors = 0
        files_to_process = added + modified

        for rel_path in files_to_process:
            fpath = current_paths.get(rel_path)
            if not fpath:
                continue

            # For modifications, delete old subgraph first
            if rel_path in modified:
                await delete_file_subgraph(repo_id, rel_path)

            try:
                source = fpath.read_text(encoding="utf-8", errors="replace")
            except Exception as exc:
                logger.warning("failed to read %s: %s", rel_path, exc)
                total_errors += 1
                continue

            content_hash = compute_content_hash(source)
            language = get_language_for_file(fpath.name) or "unknown"

            await upsert_file_node(
                repo_id=repo_id,
                file_path=rel_path,
                language=language,
                content_hash=content_hash,
                commit_sha=commit_sha,
                size_bytes=len(source.encode("utf-8")),
            )

            parser = get_parser_for_file(fpath.name)
            if not parser:
                continue

            parse_result = parser.parse(source, rel_path, repo_id)

            if parse_result.errors:
                for err in parse_result.errors:
                    logger.warning("parse error in %s: %s", rel_path, err)
                total_errors += len(parse_result.errors)

            sym_count = await upsert_symbols(repo_id, parse_result.symbols)
            total_symbols += sym_count

            await upsert_defined_in_edges(repo_id, parse_result.symbols)

            edge_count = await upsert_edges(repo_id, parse_result.edges)
            total_edges += edge_count

        stats = await get_repo_stats(repo_id)

        result = {
            "repo_id": repo_id,
            "commit_sha": commit_sha,
            "files_added": len(added),
            "files_modified": len(modified),
            "files_deleted": len(deleted),
            "symbol_count": total_symbols,
            "edge_count": total_edges,
            "error_count": total_errors,
            "graph_stats": stats,
        }

        logger.info(
            "incremental index complete: +%d ~%d -%d files, %d symbols, %d edges",
            len(added), len(modified), len(deleted), total_symbols, total_edges,
        )
        return result

    finally:
        cleanup_clone(repo_id)
