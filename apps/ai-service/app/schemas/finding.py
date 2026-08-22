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
