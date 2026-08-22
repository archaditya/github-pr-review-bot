from typing import List, Literal

from pydantic import BaseModel, Field

from .finding import Finding


class ConversationTurn(BaseModel):
    author: Literal["bot", "user"]
    body: str


class ConversationRequest(BaseModel):
    findings: List[Finding] = Field(default_factory=list)
    message_history: List[ConversationTurn] = Field(default_factory=list)
