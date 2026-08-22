from functools import lru_cache

from openai import AsyncOpenAI

from .config import settings


@lru_cache(maxsize=1)
def get_openai_client() -> AsyncOpenAI:
    """
    One shared async client for the process lifetime. Cached rather than built at
    import-time so a missing OPENAI_API_KEY fails when the client is first actually used,
    not at module import (keeps e.g. the health endpoint importable/testable without it).
    """
    return AsyncOpenAI(
        api_key=settings.openai_api_key,
        timeout=settings.openai_request_timeout_seconds,
    )
