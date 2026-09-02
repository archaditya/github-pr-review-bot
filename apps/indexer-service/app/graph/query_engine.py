"""
Graph query engine for chat retrieval.
Provides targeted Cypher queries to extract subgraphs, search symbols,
and build context for the LLM answer generation pipeline.

All queries are read-only and scoped to a single repo_id (multi-tenant safe).
"""

import logging
from typing import Optional

from .neo4j_client import get_session

logger = logging.getLogger(__name__)


async def get_schema_summary(repo_id: str) -> dict:
    """
    Return a compact schema summary for a repository.
    Used by the LLM intent classifier to understand what's queryable.
    """
    query = """
    MATCH (n {repo_id: $repo_id})
    WITH labels(n)[0] AS label, count(n) AS count
    RETURN label, count
    ORDER BY count DESC
    """
    async with get_session() as session:
        result = await session.run(query, repo_id=repo_id)
        records = await result.data()

    node_counts = {r["label"]: r["count"] for r in records}

    # Get top-level directory structure
    dir_query = """
    MATCH (f:File {repo_id: $repo_id})
    WITH split(f.path, '/')[0] AS top_dir, count(f) AS file_count
    RETURN top_dir, file_count
    ORDER BY file_count DESC
    LIMIT 20
    """
    async with get_session() as session:
        result = await session.run(dir_query, repo_id=repo_id)
        dir_records = await result.data()

    # Get relationship type counts
    rel_query = """
    MATCH (a {repo_id: $repo_id})-[r]->(b {repo_id: $repo_id})
    WITH type(r) AS rel_type, count(r) AS count
    RETURN rel_type, count
    ORDER BY count DESC
    """
    async with get_session() as session:
        result = await session.run(rel_query, repo_id=repo_id)
        rel_records = await result.data()

    return {
        "node_counts": node_counts,
        "total_nodes": sum(node_counts.values()),
        "directories": [{"name": r["top_dir"], "file_count": r["file_count"]} for r in dir_records],
        "relationship_types": {r["rel_type"]: r["count"] for r in rel_records},
    }


async def search_symbols(repo_id: str, terms: list[str], limit: int = 20) -> list[dict]:
    """
    Full-text symbol search by name/fqn across all node types.
    Returns matching symbols with metadata.
    """
    if not terms:
        return []

    # Build CONTAINS conditions for each term
    conditions = " OR ".join(
        f"toLower(n.name) CONTAINS toLower('{t}') OR toLower(n.fqn) CONTAINS toLower('{t}')"
        for t in terms[:5]  # cap to prevent query explosion
    )

    query = f"""
    MATCH (n {{repo_id: $repo_id}})
    WHERE ({conditions})
      AND NOT n:File
    OPTIONAL MATCH (n)-[:DEFINED_IN]->(f:File)
    RETURN n.name AS name,
           n.fqn AS fqn,
           labels(n)[0] AS label,
           n.start_line AS start_line,
           n.end_line AS end_line,
           f.path AS file_path
    ORDER BY
      CASE WHEN toLower(n.name) IN [t IN $terms | toLower(t)] THEN 0 ELSE 1 END,
      n.name
    LIMIT $limit
    """
    async with get_session() as session:
        result = await session.run(query, repo_id=repo_id, terms=terms, limit=limit)
        return await result.data()


async def get_subgraph(
    repo_id: str,
    symbol_fqns: list[str],
    depth: int = 1,
    include_callers: bool = True,
    include_callees: bool = True,
) -> dict:
    """
    Extract a targeted subgraph around the given symbols.
    Returns the symbols, their callers, callees, and containing files.
    """
    if not symbol_fqns:
        return {"symbols": [], "callers": [], "callees": [], "files": []}

    # Get the symbols themselves
    sym_query = """
    MATCH (n {repo_id: $repo_id})
    WHERE n.fqn IN $fqns
    OPTIONAL MATCH (n)-[:DEFINED_IN]->(f:File)
    RETURN n.name AS name, n.fqn AS fqn, labels(n)[0] AS label,
           n.start_line AS start_line, n.end_line AS end_line,
           f.path AS file_path
    """
    async with get_session() as session:
        result = await session.run(sym_query, repo_id=repo_id, fqns=symbol_fqns)
        symbols = await result.data()

    callers = []
    callees = []

    if include_callers:
        caller_query = """
        MATCH (caller)-[:CALLS]->(callee {repo_id: $repo_id})
        WHERE callee.fqn IN $fqns AND NOT caller.fqn IN $fqns
        OPTIONAL MATCH (caller)-[:DEFINED_IN]->(f:File)
        RETURN DISTINCT caller.name AS name, caller.fqn AS fqn,
               labels(caller)[0] AS label, f.path AS file_path
        LIMIT 30
        """
        async with get_session() as session:
            result = await session.run(caller_query, repo_id=repo_id, fqns=symbol_fqns)
            callers = await result.data()

    if include_callees:
        callee_query = """
        MATCH (caller {repo_id: $repo_id})-[:CALLS]->(callee)
        WHERE caller.fqn IN $fqns AND NOT callee.fqn IN $fqns
        OPTIONAL MATCH (callee)-[:DEFINED_IN]->(f:File)
        RETURN DISTINCT callee.name AS name, callee.fqn AS fqn,
               labels(callee)[0] AS label, f.path AS file_path
        LIMIT 30
        """
        async with get_session() as session:
            result = await session.run(callee_query, repo_id=repo_id, fqns=symbol_fqns)
            callees = await result.data()

    # Collect all unique file paths
    file_paths = set()
    for item in symbols + callers + callees:
        if item.get("file_path"):
            file_paths.add(item["file_path"])

    return {
        "symbols": symbols,
        "callers": callers,
        "callees": callees,
        "files": list(file_paths),
    }


async def get_endpoints(repo_id: str) -> list[dict]:
    """List all API endpoints in the repository."""
    query = """
    MATCH (ep:APIEndpoint {repo_id: $repo_id})
    OPTIONAL MATCH (ep)-[:DEFINED_IN]->(f:File)
    RETURN ep.name AS name, ep.fqn AS fqn,
           ep.method AS method, ep.path_pattern AS path_pattern,
           f.path AS file_path
    ORDER BY ep.path_pattern
    """
    async with get_session() as session:
        result = await session.run(query, repo_id=repo_id)
        return await result.data()


async def get_file_symbols(repo_id: str, file_paths: list[str]) -> list[dict]:
    """Get all symbols defined in specific files."""
    if not file_paths:
        return []

    query = """
    MATCH (sym)-[:DEFINED_IN]->(f:File {repo_id: $repo_id})
    WHERE f.path IN $paths
    RETURN sym.name AS name, sym.fqn AS fqn, labels(sym)[0] AS label,
           sym.start_line AS start_line, sym.end_line AS end_line,
           f.path AS file_path
    ORDER BY f.path, sym.start_line
    """
    async with get_session() as session:
        result = await session.run(query, repo_id=repo_id, paths=file_paths)
        return await result.data()


async def get_imports_graph(repo_id: str, file_path: str) -> dict:
    """Get import/dependency graph for a specific file."""
    query = """
    MATCH (f:File {repo_id: $repo_id, path: $path})
    OPTIONAL MATCH (f)-[:IMPORTS]->(imported:File)
    OPTIONAL MATCH (importer:File)-[:IMPORTS]->(f)
    RETURN collect(DISTINCT imported.path) AS imports,
           collect(DISTINCT importer.path) AS imported_by
    """
    async with get_session() as session:
        result = await session.run(query, repo_id=repo_id, path=file_path)
        records = await result.data()

    if records:
        return {"imports": records[0]["imports"], "imported_by": records[0]["imported_by"]}
    return {"imports": [], "imported_by": []}


async def get_repo_overview(repo_id: str) -> dict:
    """
    Comprehensive repo overview for broad questions like
    "What does this project do?" or "Give me an overview."
    """
    schema = await get_schema_summary(repo_id)
    endpoints = await get_endpoints(repo_id)

    # Get top classes/modules
    class_query = """
    MATCH (c:Class {repo_id: $repo_id})
    OPTIONAL MATCH (c)-[:DEFINED_IN]->(f:File)
    RETURN c.name AS name, c.fqn AS fqn, f.path AS file_path
    ORDER BY c.name
    LIMIT 20
    """
    async with get_session() as session:
        result = await session.run(class_query, repo_id=repo_id)
        classes = await result.data()

    # Get top-level functions (not in classes)
    fn_query = """
    MATCH (fn:Function {repo_id: $repo_id})
    WHERE NOT (fn)<-[:CONTAINS]-(:Class)
    OPTIONAL MATCH (fn)-[:DEFINED_IN]->(f:File)
    RETURN fn.name AS name, fn.fqn AS fqn, f.path AS file_path
    ORDER BY fn.name
    LIMIT 30
    """
    async with get_session() as session:
        result = await session.run(fn_query, repo_id=repo_id)
        functions = await result.data()

    return {
        "schema": schema,
        "endpoints": endpoints,
        "classes": classes,
        "top_functions": functions,
    }
