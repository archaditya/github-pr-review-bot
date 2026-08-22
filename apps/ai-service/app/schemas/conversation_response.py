from pydantic import BaseModel


class ConversationResponse(BaseModel):
    reply: str
