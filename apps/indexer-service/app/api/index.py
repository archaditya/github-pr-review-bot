"""
Indexing API endpoints. Called by the Node.js API via Inngest jobs.
All operations are async — the caller (Inngest step) waits for completion.
"""

import logging

from fastapi import APIRouter, HTTPException

from ..indexing.full_indexer import run_full_index
from ..indexing.incremental_indexer import run_incremental_index
from ..graph.graph_writer import get_repo_stats, delete_repo_graph
from ..schemas.index_request import (
    FullIndexRequest,
    IncrementalIndexRequest,
    IndexResponse,
    IndexStatusResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/full", response_model=IndexResponse)
async def full_index(request: FullIndexRequest) -> IndexResponse:
    """
    Perform a full repository index.
    Clones the repo, parses all files, and builds the complete knowledge graph.
    This is idempotent — calling it again rebuilds the graph from scratch.
    """
    try:
        result = await run_full_index(
            owner=request.owner,
            repo=request.repo,
            token=request.token,
            repo_id=request.repo_id,
            branch=request.branch,
        )
        return IndexResponse(**result)
    except Exception as exc:
        logger.error("full index failed for %s: %s", request.repo_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Indexing failed: {exc}") from exc


@router.post("/incremental", response_model=IndexResponse)
async def incremental_index(request: IncrementalIndexRequest) -> IndexResponse:
    """
    Perform an incremental index update.
    Only re-processes files that changed since the last indexed commit.
    """
    try:
        result = await run_incremental_index(
            owner=request.owner,
            repo=request.repo,
            token=request.token,
            repo_id=request.repo_id,
            branch=request.branch,
            changed_files=request.changed_files,
        )
        return IndexResponse(**result)
    except Exception as exc:
        logger.error("incremental index failed for %s: %s", request.repo_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Indexing failed: {exc}") from exc


@router.get("/status/{repo_id}", response_model=IndexStatusResponse)
async def index_status(repo_id: str) -> IndexStatusResponse:
    """Return graph stats for a repository."""
    try:
        stats = await get_repo_stats(repo_id)
        return IndexStatusResponse(repo_id=repo_id, graph_stats=stats)
    except Exception as exc:
        logger.error("status check failed for %s: %s", repo_id, exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete("/{repo_id}")
async def delete_index(repo_id: str) -> dict:
    """Delete the entire graph for a repository."""
    try:
        await delete_repo_graph(repo_id)
        return {"status": "deleted", "repo_id": repo_id}
    except Exception as exc:
        logger.error("delete failed for %s: %s", repo_id, exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
