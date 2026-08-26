"""
Full repository indexer.
Clone → discover files → parse each → write symbols + edges to Neo4j.
Called when a repository is first connected via GitHub App installation.
"""

import logging
import os
from pathlib import Path

from ..core.config import settings
from ..git.clone_service import clone_repository, get_head_sha, cleanup_clone
from ..graph.graph_writer import (
    upsert_file_node, upsert_symbols, upsert_edges,
    upsert_defined_in_edges, delete_repo_graph, get_repo_stats,
)
from ..graph.schema import IGNORED_DIRS, IGNORED_EXTENSIONS
from ..indexing.hasher import compute_content_hash
from ..parsers.language_registry import get_parser_for_file, get_language_for_file

logger = logging.getLogger(__name__)


def _should_ignore(path: Path, rel_path: str) -> bool:
    """Check if a file/directory should be skipped during indexing."""
    parts = Path(rel_path).parts
    for part in parts:
        if part in IGNORED_DIRS:
            return True
    if path.suffix.lower() in IGNORED_EXTENSIONS:
        return True
    if path.stat().st_size > settings.max_file_size_bytes:
        return True
    return False


def _discover_files(clone_dir: Path) -> list[Path]:
    """Walk the cloned repository and collect indexable files."""
    files: list[Path] = []
    for root, dirs, filenames in os.walk(clone_dir):
        # Prune ignored directories in-place for efficiency
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]

        for fname in filenames:
            fpath = Path(root) / fname
            rel_path = str(fpath.relative_to(clone_dir))
            if not _should_ignore(fpath, rel_path):
                lang = get_language_for_file(fname)
                if lang:
                    files.append(fpath)

    return files[:settings.max_files_per_repo]


async def run_full_index(
    owner: str,
    repo: str,
    token: str,
    repo_id: str,
    branch: str = "main",
) -> dict:
    """
    Execute a full repository index.

    1. Clone the repository (shallow, HEAD only)
    2. Discover all parseable files
    3. Parse each file with the appropriate tree-sitter parser
    4. Write File nodes, symbol nodes, and relationship edges to Neo4j
    5. Clean up the clone

    Returns:
        Dict with indexing stats (file_count, symbol_count, edge_count, commit_sha)
    """
    logger.info("starting full index for %s/%s (repo_id: %s)", owner, repo, repo_id)

    # Step 1: Clone
    clone_dir = clone_repository(owner, repo, token, repo_id, branch)
    commit_sha = get_head_sha(clone_dir)

    try:
        # Step 2: Clear existing graph for this repo (full re-index)
        await delete_repo_graph(repo_id)

        # Step 3: Discover files
        files = _discover_files(clone_dir)
        logger.info("discovered %d indexable files", len(files))

        total_symbols = 0
        total_edges = 0
        total_errors = 0

        # Step 4: Parse and index each file
        for fpath in files:
            rel_path = str(fpath.relative_to(clone_dir)).replace("\\", "/")

            try:
                source = fpath.read_text(encoding="utf-8", errors="replace")
            except Exception as exc:
                logger.warning("failed to read %s: %s", rel_path, exc)
                total_errors += 1
                continue

            content_hash = compute_content_hash(source)
            language = get_language_for_file(fpath.name) or "unknown"

            # Write File node
            await upsert_file_node(
                repo_id=repo_id,
                file_path=rel_path,
                language=language,
                content_hash=content_hash,
                commit_sha=commit_sha,
                size_bytes=len(source.encode("utf-8")),
            )

            # Parse with language-specific parser
            parser = get_parser_for_file(fpath.name)
            if not parser:
                continue

            parse_result = parser.parse(source, rel_path, repo_id)

            if parse_result.errors:
                for err in parse_result.errors:
                    logger.warning("parse error in %s: %s", rel_path, err)
                total_errors += len(parse_result.errors)

            # Write symbols
            sym_count = await upsert_symbols(repo_id, parse_result.symbols)
            total_symbols += sym_count

            # Write DEFINED_IN edges (symbol → file)
            await upsert_defined_in_edges(repo_id, parse_result.symbols)

            # Write relationship edges
            edge_count = await upsert_edges(repo_id, parse_result.edges)
            total_edges += edge_count

        # Step 5: Get final stats
        stats = await get_repo_stats(repo_id)

        result = {
            "repo_id": repo_id,
            "commit_sha": commit_sha,
            "file_count": len(files),
            "symbol_count": total_symbols,
            "edge_count": total_edges,
            "error_count": total_errors,
            "graph_stats": stats,
        }

        logger.info(
            "full index complete for %s/%s: %d files, %d symbols, %d edges, %d errors",
            owner, repo, len(files), total_symbols, total_edges, total_errors,
        )
        return result

    finally:
        # Always clean up the clone
        cleanup_clone(repo_id)
