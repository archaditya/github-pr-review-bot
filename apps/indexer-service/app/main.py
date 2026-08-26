"""
Indexer service — FastAPI application entry point.
Responsible for:
- AST-based code parsing (tree-sitter)
- Code knowledge graph construction (Neo4j)
- Full and incremental repository indexing
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .api import health, index
from .core.logging import configure_logging
from .graph.neo4j_client import ensure_indexes, close_driver

configure_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle. Ensures Neo4j indexes exist on boot."""
    try:
        await ensure_indexes()
        logger.info("indexer-service started")
    except Exception as exc:
        logger.error("failed to connect to neo4j on startup: %s", exc)
        # Don't crash — Neo4j might come up later in Docker compose
    yield
    await close_driver()
    logger.info("indexer-service shut down")


app = FastAPI(
    title="archadi-pr-review indexer-service",
    description=(
        "Code knowledge graph builder. Parses repositories with tree-sitter, "
        "stores symbols and relationships in Neo4j. Called by the Node.js API "
        "via Inngest jobs for full and incremental indexing."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(health.router)
app.include_router(index.router, prefix="/index", tags=["index"])


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Last-resort handler — never leak internals in the response."""
    logger.error(
        "unhandled exception on %s %s", request.method, request.url.path,
        exc_info=exc,
    )
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
