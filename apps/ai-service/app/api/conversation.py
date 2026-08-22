import logging

from fastapi import APIRouter, HTTPException

from ..agents.conversation_agent import ConversationGenerationError, generate_reply
from ..schemas.conversation_request import ConversationRequest
from ..schemas.conversation_response import ConversationResponse
from ..services.conversation_service import cap_history

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/reply", response_model=ConversationResponse)
async def generate_reply_endpoint(payload: ConversationRequest) -> ConversationResponse:
    """
    ConversationContext -> a reply (ADR-009). Still fully stateless — the original
    findings and message history are passed in per-call, nothing is looked up here.
    """
    capped_history = cap_history(payload.message_history)

    try:
        reply = await generate_reply(findings=payload.findings, history=capped_history)
    except ConversationGenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return ConversationResponse(reply=reply)
