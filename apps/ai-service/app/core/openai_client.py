from functools import lru_cache
from typing import Optional

from openai import AsyncOpenAI

from .config import settings


@lru_cache(maxsize=1)
def _get_default_openai_client() -> AsyncOpenAI:
    if not settings.openai_api_key:
        raise ValueError(
            "System OPENAI_API_KEY is not configured and no user BYOK key was provided."
        )
    return AsyncOpenAI(
        api_key=settings.openai_api_key,
        timeout=settings.openai_request_timeout_seconds,
    )


def get_openai_client(api_key: Optional[str] = None) -> AsyncOpenAI:
    """
    Returns an AsyncOpenAI client.
    If a user-provided BYOK api_key is passed, returns an async client with that key.
    Otherwise falls back to the default server-configured client.
    """
    if api_key and api_key.strip():
        return AsyncOpenAI(
            api_key=api_key.strip(),
            timeout=settings.openai_request_timeout_seconds,
        )
    return _get_default_openai_client()

