"""
Batch upsert parsed symbols and relationships into Neo4j.
Uses MERGE (idempotent upsert) so re-indexing is safe.
All writes for a single file are batched into one transaction.
"""

import logging
from dataclasses import dataclass, field

from .neo4j_client import get_session
from .schema import NodeLabel, EdgeType, Confidence

logger = logging.getLogger(__name__)


@dataclass
class SymbolNode:
    """A symbol extracted from source code by a parser."""
    label: NodeLabel
    repo_id: str
    file_path: str
    name: str
    fqn: str  # fully qualified name: file_path::ClassName.method_name
    start_line: int = 0
    end_line: int = 0
    content_hash: str = ""
    language: str = ""
    # Extra properties (varies by node type)
    props: dict = field(default_factory=dict)


@dataclass
class SymbolEdge:
    """A relationship between two symbols."""
    edge_type: EdgeType
    source_fqn: str
    target_fqn: str
    source_label: NodeLabel = NodeLabel.FUNCTION
    target_label: NodeLabel = NodeLabel.FUNCTION
    confidence: Confidence = Confidence.EXTRACTED
    repo_id: str = ""
    props: dict = field(default_factory=dict)


async def upsert_file_node(
    repo_id: str,
    file_path: str,
    language: str,
    content_hash: str,
    commit_sha: str,
    size_bytes: int = 0,
) -> None:
    """Create or update a File node."""
    query = """
    MERGE (f:File {repo_id: $repo_id, path: $path})
    SET f.language = $language,
        f.content_hash = $content_hash,
        f.commit_sha = $commit_sha,
        f.size_bytes = $size_bytes,
        f.updated_at = datetime()
    """
    async with get_session() as session:
        await session.run(
            query,
            repo_id=repo_id,
            path=file_path,
            language=language,
            content_hash=content_hash,
            commit_sha=commit_sha,
            size_bytes=size_bytes,
        )


async def upsert_symbols(repo_id: str, symbols: list[SymbolNode]) -> int:
    """
    Batch upsert symbol nodes. Returns count of nodes written.
    Uses UNWIND for efficient batching — one round-trip per label type.
    """
    if not symbols:
        return 0

    # Group symbols by label for efficient batch queries
    by_label: dict[NodeLabel, list[dict]] = {}
    for sym in symbols:
        props = {
            "repo_id": repo_id,
            "fqn": sym.fqn,
            "name": sym.name,
            "file_path": sym.file_path,
            "start_line": sym.start_line,
            "end_line": sym.end_line,
            "content_hash": sym.content_hash,
            "language": sym.language,
            **sym.props,
        }
        by_label.setdefault(sym.label, []).append(props)

    total = 0
    async with get_session() as session:
        for label, batch in by_label.items():
            query = f"""
            UNWIND $batch AS props
            MERGE (n:{label.value} {{repo_id: props.repo_id, fqn: props.fqn}})
            SET n += props, n.updated_at = datetime()
            """
            await session.run(query, batch=batch)
            total += len(batch)

    return total


async def upsert_edges(repo_id: str, edges: list[SymbolEdge]) -> int:
    """
    Batch upsert relationships. Returns count of edges written.
    Groups by (source_label, target_label, edge_type) for efficient batching.
    """
    if not edges:
        return 0

    # Group edges by their type signature
    groups: dict[tuple, list[dict]] = {}
    for edge in edges:
        key = (edge.source_label, edge.target_label, edge.edge_type)
        props = {
            "source_fqn": edge.source_fqn,
            "target_fqn": edge.target_fqn,
            "confidence": edge.confidence.value,
            "repo_id": repo_id,
            **edge.props,
        }
        groups.setdefault(key, []).append(props)

    total = 0
    async with get_session() as session:
        for (src_label, tgt_label, edge_type), batch in groups.items():
            query = f"""
            UNWIND $batch AS props
            MATCH (a:{src_label.value} {{repo_id: props.repo_id, fqn: props.source_fqn}})
            MATCH (b:{tgt_label.value} {{repo_id: props.repo_id, fqn: props.target_fqn}})
            MERGE (a)-[r:{edge_type.value}]->(b)
            SET r.confidence = props.confidence, r.updated_at = datetime()
            """
            await session.run(query, batch=batch)
            total += len(batch)

    return total


async def upsert_defined_in_edges(repo_id: str, symbols: list[SymbolNode]) -> int:
    """
    Create DEFINED_IN edges from every symbol to its containing File node.
    Called automatically after symbol upsert.
    """
    if not symbols:
        return 0

    # Group by label
    by_label: dict[NodeLabel, list[dict]] = {}
    for sym in symbols:
        if sym.label == NodeLabel.FILE:
            continue  # files don't have DEFINED_IN to themselves
        entry = {"fqn": sym.fqn, "file_path": sym.file_path, "repo_id": repo_id}
        by_label.setdefault(sym.label, []).append(entry)

    total = 0
    async with get_session() as session:
        for label, batch in by_label.items():
            query = f"""
            UNWIND $batch AS props
            MATCH (sym:{label.value} {{repo_id: props.repo_id, fqn: props.fqn}})
            MATCH (f:File {{repo_id: props.repo_id, path: props.file_path}})
            MERGE (sym)-[r:DEFINED_IN]->(f)
            SET r.confidence = 'EXTRACTED', r.updated_at = datetime()
            """
            await session.run(query, batch=batch)
            total += len(batch)

    return total


async def delete_file_subgraph(repo_id: str, file_path: str) -> None:
    """
    Remove a file and all symbols defined in it from the graph.
    Used during incremental indexing when a file is deleted or fully re-indexed.
    """
    query = """
    MATCH (f:File {repo_id: $repo_id, path: $file_path})
    OPTIONAL MATCH (sym)-[:DEFINED_IN]->(f)
    DETACH DELETE sym, f
    """
    async with get_session() as session:
        await session.run(query, repo_id=repo_id, file_path=file_path)


async def delete_repo_graph(repo_id: str) -> None:
    """Remove the entire graph for a repository. Used before full re-index."""
    query = """
    MATCH (n {repo_id: $repo_id})
    DETACH DELETE n
    """
    async with get_session() as session:
        await session.run(query, repo_id=repo_id)
    logger.info("deleted graph for repo %s", repo_id)


async def get_repo_stats(repo_id: str) -> dict:
    """Return basic stats about the graph for a repository."""
    query = """
    MATCH (n {repo_id: $repo_id})
    RETURN labels(n)[0] AS label, count(n) AS count
    ORDER BY count DESC
    """
    async with get_session() as session:
        result = await session.run(query, repo_id=repo_id)
        records = await result.data()

    stats = {r["label"]: r["count"] for r in records}
    stats["total_nodes"] = sum(stats.values())
    return stats
