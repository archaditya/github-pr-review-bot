from typing import List, Optional, Union, Any

from pydantic import BaseModel, Field, field_validator


class ChangedFileContext(BaseModel):
    """One entry per changed file — diff hunk plus best-effort usage info, resolved in
    Node (apps/api/src/services/review.service.js) and passed in here as-is (ADR-003)."""

    model_config = {"extra": "ignore"}

    file: str = ""
    status: Optional[str] = "modified"
    patch: Optional[str] = ""

    @field_validator("file", mode="before")
    @classmethod
    def sanitize_file(cls, v: Any) -> str:
        return str(v) if v is not None else ""

    @field_validator("patch", mode="before")
    @classmethod
    def sanitize_patch(cls, v: Any) -> str:
        return str(v) if v is not None else ""


class PullRequestMeta(BaseModel):
    model_config = {"extra": "ignore"}

    owner: str = ""
    repo: str = ""
    number: int = 0

    @field_validator("number", mode="before")
    @classmethod
    def sanitize_number(cls, v: Any) -> int:
        try:
            return int(v)
        except (TypeError, ValueError):
            return 0


class CallerInfo(BaseModel):
    """A function/method that calls a changed symbol."""
    model_config = {"extra": "ignore"}

    fqn: str = ""
    file_path: Optional[str] = ""
    name: Optional[str] = ""


class ImpactContext(BaseModel):
    """Structural impact analysis from the code knowledge graph (Neo4j).
    Populated by the API's graph-impact-analysis step when the repo is indexed."""
    model_config = {"extra": "ignore"}

    changed_symbols: List[str] = Field(default_factory=list)
    callers: List[Any] = Field(default_factory=list)
    callees: List[str] = Field(default_factory=list)
    affected_endpoints: List[str] = Field(default_factory=list)
    related_tests: List[str] = Field(default_factory=list)
    affected_files_count: Optional[Union[int, float]] = 0

    @field_validator("changed_symbols", "callees", "affected_endpoints", "related_tests", mode="before")
    @classmethod
    def sanitize_str_list(cls, v: Any) -> List[str]:
        if not v:
            return []
        if isinstance(v, list):
            return [str(x) for x in v if x is not None and str(x).strip()]
        return []

    @field_validator("callers", mode="before")
    @classmethod
    def sanitize_callers(cls, v: Any) -> List[Any]:
        if not v:
            return []
        if isinstance(v, list):
            return [c for c in v if c is not None]
        return []

    @field_validator("affected_files_count", mode="before")
    @classmethod
    def sanitize_count(cls, v: Any) -> int:
        try:
            return int(v) if v is not None else 0
        except (TypeError, ValueError):
            return 0


class ReviewRequest(BaseModel):
    model_config = {"extra": "ignore"}

    diff: Optional[str] = ""
    usage_context: List[ChangedFileContext] = Field(default_factory=list)
    impact_context: Optional[ImpactContext] = None
    pull_request: Optional[PullRequestMeta] = None

    @field_validator("diff", mode="before")
    @classmethod
    def sanitize_diff(cls, v: Any) -> str:
        if v is None:
            return ""
        if not isinstance(v, str):
            return str(v)
        return v

    @field_validator("usage_context", mode="before")
    @classmethod
    def sanitize_usage_context(cls, v: Any) -> List[Any]:
        if not v or not isinstance(v, list):
            return []
        return v

