from typing import List, Optional

from pydantic import BaseModel, Field


class ChangedFileContext(BaseModel):
    """One entry per changed file — diff hunk plus best-effort usage info, resolved in
    Node (apps/api/src/services/review.service.js) and passed in here as-is (ADR-003)."""

    file: str
    status: Optional[str] = None
    patch: str = ""


class PullRequestMeta(BaseModel):
    owner: str
    repo: str
    number: int


class ReviewRequest(BaseModel):
    diff: str
    usage_context: List[ChangedFileContext] = Field(default_factory=list)
    pull_request: PullRequestMeta
