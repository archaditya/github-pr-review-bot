import json
import logging
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from ..agents.chat_agent import classify_chat_intent, stream_chat_reply
from ..schemas.chat_request import (
    ChatClassifierRequest,
    ChatClassificationResult,
    ChatGenerateRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/classify", response_model=ChatClassificationResult)
async def classify(request: ChatClassifierRequest) -> ChatClassificationResult:
    """Fast classification endpoint using gpt-4o-mini."""
    return await classify_chat_intent(request.question, request.schema_summary)


@router.post("/generate")
async def generate(request: ChatGenerateRequest) -> StreamingResponse:
    """
    Streaming chat generation endpoint using gpt-4o.
    Yields Server-Sent Events (SSE) formatted as:
    data: {"token": "..."}\n\n
    data: {"done": true}\n\n
    """
    async def event_generator():
        try:
            async for token in stream_chat_reply(
                question=request.question,
                graph_context=request.graph_context,
                history=request.history,
                repo_name=request.repo_name,
            ):
                payload = json.dumps({"token": token})
                yield f"data: {payload}\n\n"

            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as exc:
            logger.error("SSE stream encountered error: %s", exc)
            err_payload = json.dumps({"error": str(exc), "done": True})
            yield f"data: {err_payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
