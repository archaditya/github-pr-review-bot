import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .api import chat, conversation, health, review
from .core.logging import configure_logging
from .core.middleware import BodySizeLimitMiddleware, RequestLoggingMiddleware

configure_logging()
logger = logging.getLogger(__name__)

app = FastAPI(
    title="archadi-pr-review ai-service",
    description="Stateless AI compute for PR review generation and conversational follow-ups. See apps/ai-service/README.md.",
    version="0.1.0",
)

app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(BodySizeLimitMiddleware)

app.include_router(health.router)
app.include_router(review.router, prefix="/review", tags=["review"])
app.include_router(conversation.router, prefix="/conversation", tags=["conversation"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])


from fastapi.exceptions import RequestValidationError

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    logger.error("validation error on %s %s: %s", request.method, request.url.path, exc.errors())
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Last-resort handler — never leak internals (stack traces, exception messages) in
    the response for an error we didn't anticipate. Mirrors apps/api's error-handler."""
    logger.error("unhandled exception on %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
