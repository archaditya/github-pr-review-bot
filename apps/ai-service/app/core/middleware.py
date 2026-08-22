import logging
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from .config import settings

access_logger = logging.getLogger("ai-service.access")


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """
    Rejects oversized requests before they're parsed — a coarse guardrail sitting in
    front of the token-based diff cap in app/utils/diff_capping.py (that one shapes what
    gets sent to OpenAI; this one protects the service itself from being handed an
    enormous payload in the first place).
    """

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > settings.max_request_body_bytes:
            return JSONResponse(
                status_code=413,
                content={"detail": "Request body exceeds the maximum allowed size"},
            )
        return await call_next(request)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """One structured line per request — method, path, status, duration. No body content."""

    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        access_logger.info(
            "%s %s -> %s (%.1fms)",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        return response
