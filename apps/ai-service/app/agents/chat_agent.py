import json
import logging
from typing import AsyncGenerator

from openai import APIError, APITimeoutError, RateLimitError
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from ..core.config import settings
from ..core.openai_client import get_openai_client
from ..schemas.chat_request import (
    ChatClassificationResult,
    ChatTurn,
)
from .prompts import load_prompt

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = load_prompt("chat_system.md")
CLASSIFIER_PROMPT = load_prompt("chat_classifier.md")


class ChatAgentError(Exception):
    """Raised when model calls in chat_agent fail."""


@retry(
    reraise=True,
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=1, min=1, max=4),
    retry=retry_if_exception_type((APITimeoutError, RateLimitError)),
)
async def classify_chat_intent(question: str, schema_summary: dict | None = None) -> ChatClassificationResult:
    """
    Fast, cheap classification using gpt-4o-mini.
    Extracts intent (structural, semantic, overview, greeting), query_type, entities, and file hints.
    """
    client = get_openai_client()

    schema_block = json.dumps(schema_summary, indent=2) if schema_summary else "None available"
    user_content = f"## Repository Schema Summary:\n{schema_block}\n\n## User Question:\n{question}"

    try:
        completion = await client.chat.completions.create(
            model=settings.openai_fast_model,
            messages=[
                {"role": "system", "content": CLASSIFIER_PROMPT},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
            temperature=0.0,
        )

        raw = completion.choices[0].message.content or "{}"
        data = json.loads(raw)
        return ChatClassificationResult(
            intent=data.get("intent", "semantic"),
            query_type=data.get("query_type", "general"),
            entities=data.get("entities", []),
            file_hints=data.get("file_hints", []),
            confidence=data.get("confidence", "medium"),
        )
    except Exception as exc:
        logger.warning("intent classification failed or timed out: %s — defaulting to semantic", exc)
        return ChatClassificationResult(
            intent="semantic",
            query_type="general",
            entities=[],
            file_hints=[],
            confidence="low",
        )


def _build_generation_messages(
    question: str,
    graph_context: str,
    history: list[ChatTurn],
    repo_name: str | None = None,
) -> list[dict]:
    repo_label = f" for repository `{repo_name}`" if repo_name else ""
    system_msg = f"{SYSTEM_PROMPT}\n\nYou are answering questions{repo_label}."

    messages = [{"role": "system", "content": system_msg}]

    # Bound short-term memory history to configured limit
    capped_history = history[-settings.max_chat_history_messages:] if history else []
    for turn in capped_history:
        messages.append({
            "role": "user" if turn.role == "user" else "assistant",
            "content": turn.content,
        })

    user_prompt = (
        f"## Code Knowledge Graph Context:\n"
        f"{graph_context or '(No specific graph context found)'}\n\n"
        f"## User Question:\n{question}"
    )
    messages.append({"role": "user", "content": user_prompt})
    return messages


async def stream_chat_reply(
    question: str,
    graph_context: str,
    history: list[ChatTurn],
    repo_name: str | None = None,
) -> AsyncGenerator[str, None]:
    """
    Streams tokens using gpt-4o for accurate, deeply grounded repository answers.
    """
    client = get_openai_client()
    messages = _build_generation_messages(question, graph_context, history, repo_name)

    try:
        response = await client.chat.completions.create(
            model=settings.openai_deep_model,
            messages=messages,
            temperature=0.2,
            stream=True,
        )

        async for chunk in response:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    except (APIError, APITimeoutError, RateLimitError) as exc:
        logger.error("stream_chat_reply openai call failed: %s", exc)
        yield f"\n\n*(Error generating full response: {str(exc)})*"
