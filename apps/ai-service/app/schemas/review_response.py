from typing import List

from pydantic import BaseModel, Field

from .finding import Finding


class ReviewResponse(BaseModel):
    findings: List[Finding] = Field(default_factory=list)
    truncated: bool = False  # true if the input diff had to be cut to fit max_diff_tokens
