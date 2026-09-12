import logging

from fastapi import APIRouter, HTTPException

from ..agents.social_agent import SocialDraftGenerationError, generate_social_drafts
from ..schemas.social_draft import SocialDraftRequest, SocialDraftResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/generate-drafts", response_model=SocialDraftResponse)
async def generate_drafts_endpoint(payload: SocialDraftRequest) -> SocialDraftResponse:
    """
    Generate X and LinkedIn post drafts from PR context or standalone input.
    Stateless — all context is in the request payload.
    """
    try:
        return await generate_social_drafts(payload)
    except SocialDraftGenerationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
