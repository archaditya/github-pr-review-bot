from typing import List, Optional, Union, Any

from pydantic import BaseModel, Field


class ChangedFileContext(BaseModel):
    """One entry per changed file — diff hunk plus best-effort usage info, resolved in
    Node (apps/api/src/services/review.service.js) and passed in here as-is (ADR-003)."""

    file: str
    status: Optional[str] = None
    patch: Optional[str] = ""


class PullRequestMeta(BaseModel):
    owner: str
    repo: str
    number: int


class CallerInfo(BaseModel):
    """A function/method that calls a changed symbol."""
    fqn: str
    file_path: Optional[str] = ""
    name: Optional[str] = ""


class ImpactContext(BaseModel):
    """Structural impact analysis from the code knowledge graph (Neo4j).
    Populated by the API's graph-impact-analysis step when the repo is indexed."""
    changed_symbols: list[str] = Field(default_factory=list)
    callers: list[Any] = Field(default_factory=list)
    callees: list[str] = Field(default_factory=list)
    affected_endpoints: list[str] = Field(default_factory=list)
    related_tests: list[str] = Field(default_factory=list)
    affected_files_count: Optional[int] = 0


class ReviewRequest(BaseModel):
    diff: Optional[str] = ""
    usage_context: List[ChangedFileContext] = Field(default_factory=list)
    impact_context: Optional[ImpactContext] = None
    pull_request: PullRequestMeta

