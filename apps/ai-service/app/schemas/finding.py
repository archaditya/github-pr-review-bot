from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Severity(str, Enum):
    critical = "critical"
    high = "high"
    medium = "medium"
    low = "low"
    info = "info"


class Finding(BaseModel):
    file: str
    line: Optional[int] = None
    severity: Severity
    rationale: str = Field(..., max_length=1000)
    evidence: Optional[str] = Field(None, max_length=500, description="Graph-backed structural evidence")
    confidence: Optional[str] = Field(None, description="high/medium/low — model's self-assessed confidence")
    affected_symbols: list[str] = Field(default_factory=list, description="FQNs of impacted symbols")

