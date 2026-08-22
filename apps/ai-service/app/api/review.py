import logging

from fastapi import APIRouter, HTTPException

from ..agents.review_agent import ReviewGenerationError, generate_review
from ..schemas.review_request import ReviewRequest
from ..schemas.review_response import ReviewResponse
from ..services.review_service import postprocess_findings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/generate", response_model=ReviewResponse)
async def generate_review_endpoint(payload: ReviewRequest) -> ReviewResponse:
    """
    ReviewContext -> structured findings (docs/architecture/data-model.md). Stateless —
    every piece of context needed is in `payload`, nothing is looked up server-side
    (ADR-003). FastAPI + Pydantic already reject a malformed request body with a 422
    before this function runs.
    """
    try:
        raw_response = await generate_review(
            diff=payload.diff,
            usage_context=payload.usage_context,
            pull_request=payload.pull_request,
        )
    except ReviewGenerationError as exc:
        # Mapped to a 502 so apps/api's circuit breaker (ADR-006) counts this as a
        # failure — never a 200 with a made-up/empty result on a real generation failure.
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return postprocess_findings(raw_response)
