import logging

from .config import settings


def configure_logging() -> None:
    """
    Called once at startup (app/main.py). Deliberately does NOT log full diffs or full
    model responses anywhere in this service — only sizes/counts/truncation flags — since
    PR diffs can contain sensitive source code and shouldn't end up in log aggregation by
    default. See app/agents/review_agent.py for what actually gets logged per call.
    """
    logging.basicConfig(
        level=settings.log_level.upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
