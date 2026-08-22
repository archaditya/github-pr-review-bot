from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    """Liveness only — this service is stateless (ADR-003), so there's no downstream
    dependency (DB, etc.) to check readiness against. Used by Docker's HEALTHCHECK."""
    return {"status": "ok"}
