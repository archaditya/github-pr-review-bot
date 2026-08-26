"""Pydantic request/response models for the indexer service API."""

from typing import Optional
from pydantic import BaseModel, Field


class FullIndexRequest(BaseModel):
    """Request to perform a full repository index."""
    repo_id: str
    owner: str
    repo: str
    token: str = Field(..., description="GitHub App installation access token")
    branch: str = "main"


class IncrementalIndexRequest(BaseModel):
    """Request to perform an incremental index update."""
    repo_id: str
    owner: str
    repo: str
    token: str = Field(..., description="GitHub App installation access token")
    branch: str = "main"
    changed_files: Optional[list[str]] = Field(
        default=None,
        description="List of changed file paths from webhook. If None, full diff is computed.",
    )


class IndexResponse(BaseModel):
    """Response from an indexing operation."""
    repo_id: str
    commit_sha: str
    file_count: int = 0
    symbol_count: int = 0
    edge_count: int = 0
    error_count: int = 0
    files_added: int = 0
    files_modified: int = 0
    files_deleted: int = 0
    graph_stats: dict = Field(default_factory=dict)


class IndexStatusResponse(BaseModel):
    """Graph stats for a repository."""
    repo_id: str
    graph_stats: dict = Field(default_factory=dict)
