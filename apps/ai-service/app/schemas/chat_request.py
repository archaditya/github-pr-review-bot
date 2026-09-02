from typing import Optional
from pydantic import BaseModel, Field


class ChatClassifierRequest(BaseModel):
    question: str
    schema_summary: Optional[dict] = None


class ChatClassificationResult(BaseModel):
    intent: str = Field(description="structural | semantic | overview | greeting")
    query_type: str = Field(default="general", description="callers | callees | endpoints | file_content | imports | class_info | general")
    entities: list[str] = Field(default_factory=list)
    file_hints: list[str] = Field(default_factory=list)
    confidence: str = Field(default="medium")


class ChatTurn(BaseModel):
    role: str  # 'user' | 'assistant'
    content: str


class ChatGenerateRequest(BaseModel):
    question: str
    graph_context: str
    history: list[ChatTurn] = Field(default_factory=list)
    repo_name: Optional[str] = None
