"""
Neo4j driver singleton. All graph reads and writes go through this module.
Connection is lazily initialized and reused across the service lifetime.
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from neo4j import AsyncGraphDatabase, AsyncDriver, AsyncSession

from ..core.config import settings

logger = logging.getLogger(__name__)

_driver: AsyncDriver | None = None


async def get_driver() -> AsyncDriver:
    """Return the shared async Neo4j driver, creating it on first call."""
    global _driver
    if _driver is None:
        _driver = AsyncGraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_user, settings.neo4j_password),
        )
        # Verify connectivity on first use
        await _driver.verify_connectivity()
        logger.info("neo4j connection established: %s", settings.neo4j_uri)
    return _driver


@asynccontextmanager
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Convenience context manager for a Neo4j session."""
    driver = await get_driver()
    session = driver.session()
    try:
        yield session
    finally:
        await session.close()


async def close_driver() -> None:
    """Cleanly shut down the driver on app shutdown."""
    global _driver
    if _driver is not None:
        await _driver.close()
        _driver = None
        logger.info("neo4j driver closed")


async def ensure_indexes() -> None:
    """
    Create Neo4j indexes and constraints for graph query performance.
    Idempotent — safe to call on every startup.
    """
    cleanup_statements = [
        # Drop old constraint if created with old signature
        "DROP CONSTRAINT endpoint_fqn IF EXISTS",
    ]

    index_statements = [
        # Uniqueness constraints (also create indexes automatically)
        "CREATE CONSTRAINT file_fqn IF NOT EXISTS FOR (f:File) REQUIRE (f.repo_id, f.path) IS UNIQUE",
        "CREATE CONSTRAINT class_fqn IF NOT EXISTS FOR (c:Class) REQUIRE (c.repo_id, c.fqn) IS UNIQUE",
        "CREATE CONSTRAINT function_fqn IF NOT EXISTS FOR (f:Function) REQUIRE (f.repo_id, f.fqn) IS UNIQUE",
        "CREATE CONSTRAINT interface_fqn IF NOT EXISTS FOR (i:Interface) REQUIRE (i.repo_id, i.fqn) IS UNIQUE",
        "CREATE CONSTRAINT variable_fqn IF NOT EXISTS FOR (v:Variable) REQUIRE (v.repo_id, v.fqn) IS UNIQUE",
        "CREATE CONSTRAINT endpoint_fqn IF NOT EXISTS FOR (e:APIEndpoint) REQUIRE (e.repo_id, e.fqn) IS UNIQUE",
        # Lookup indexes for common queries
        "CREATE INDEX file_repo IF NOT EXISTS FOR (f:File) ON (f.repo_id)",
        "CREATE INDEX function_repo IF NOT EXISTS FOR (f:Function) ON (f.repo_id)",
        "CREATE INDEX class_repo IF NOT EXISTS FOR (c:Class) ON (c.repo_id)",
        "CREATE INDEX endpoint_lookup IF NOT EXISTS FOR (e:APIEndpoint) ON (e.repo_id, e.path_pattern, e.method)",
    ]

    async with get_session() as session:
        for stmt in cleanup_statements:
            try:
                await session.run(stmt)
            except Exception:
                pass

        for stmt in index_statements:
            try:
                await session.run(stmt)
            except Exception as exc:
                # Log but don't fail — some constraint syntax varies by Neo4j version
                logger.warning("index/constraint creation skipped: %s — %s", stmt[:60], exc)

    logger.info("neo4j indexes ensured")
