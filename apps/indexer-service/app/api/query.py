"""
Query API endpoints for the chat retrieval pipeline.
Called by the Node.js API to fetch graph context before LLM generation.
All operations are read-only.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..graph.query_engine import (
    get_schema_summary,
    search_symbols,
    get_subgraph,
    get_endpoints,
    get_file_symbols,
    get_imports_graph,
    get_repo_overview,
)

logger = logging.getLogger(__name__)
router = APIRouter()


class SchemaRequest(BaseModel):
    repo_id: str


class SymbolSearchRequest(BaseModel):
    repo_id: str
    terms: list[str]
    limit: int = Field(default=20, le=50)


class SubgraphRequest(BaseModel):
    repo_id: str
    symbol_fqns: list[str]
    depth: int = Field(default=1, le=3)
    include_callers: bool = True
    include_callees: bool = True


class FileSymbolsRequest(BaseModel):
    repo_id: str
    file_paths: list[str]


class ImportsRequest(BaseModel):
    repo_id: str
    file_path: str


@router.post("/schema-summary")
async def schema_summary(request: SchemaRequest) -> dict:
    """Return a compact schema summary for LLM intent classification."""
    try:
        return await get_schema_summary(request.repo_id)
    except Exception as exc:
        logger.error("schema summary failed for %s: %s", request.repo_id, exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/search-symbols")
async def symbol_search(request: SymbolSearchRequest) -> list[dict]:
    """Full-text symbol search by name/fqn."""
    try:
        return await search_symbols(request.repo_id, request.terms, request.limit)
    except Exception as exc:
        logger.error("symbol search failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/subgraph")
async def extract_subgraph(request: SubgraphRequest) -> dict:
    """Extract a targeted subgraph around given symbols."""
    try:
        return await get_subgraph(
            request.repo_id,
            request.symbol_fqns,
            request.depth,
            request.include_callers,
            request.include_callees,
        )
    except Exception as exc:
        logger.error("subgraph extraction failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/file-symbols")
async def file_symbols(request: FileSymbolsRequest) -> list[dict]:
    """Get all symbols defined in specific files."""
    try:
        return await get_file_symbols(request.repo_id, request.file_paths)
    except Exception as exc:
        logger.error("file symbols failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/imports")
async def imports_graph(request: ImportsRequest) -> dict:
    """Get import/dependency graph for a file."""
    try:
        return await get_imports_graph(request.repo_id, request.file_path)
    except Exception as exc:
        logger.error("imports graph failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/overview")
async def repo_overview(request: SchemaRequest) -> dict:
    """Comprehensive repository overview for broad questions."""
    try:
        return await get_repo_overview(request.repo_id)
    except Exception as exc:
        logger.error("repo overview failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/endpoints")
async def list_endpoints(request: SchemaRequest) -> list[dict]:
    """List all API endpoints in the repository."""
    try:
        return await get_endpoints(request.repo_id)
    except Exception as exc:
        logger.error("endpoints listing failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
