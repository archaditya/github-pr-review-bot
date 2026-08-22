import logging

from openai import APIError, APITimeoutError, RateLimitError
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from ..core.config import settings
from ..core.openai_client import get_openai_client
from ..schemas.conversation_request import ConversationTurn
from ..schemas.finding import Finding
from .prompts import load_prompt

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = load_prompt("conversation_system.md")


class ConversationGenerationError(Exception):
    """Raised when the model call fails after retries. See review_agent.py's equivalent
    for the same reasoning — mapped to a 502 at the API layer."""


def _build_user_message(findings: list[Finding], history: list[ConversationTurn]) -> str:
    findings_block = (
        "\n".join(
            f"- [{f.severity.value}] {f.file}:{f.line or '?'} — {f.rationale}"
            for f in findings
        )
        or "(no findings were reported)"
    )

    history_block = (
        "\n".join(f"{turn.author.upper()}: {turn.body}" for turn in history)
        or "(no prior conversation)"
    )

    return (
        f"## Original review findings\n{findings_block}\n\n"
        f"## Conversation so far\n{history_block}\n\n"
        "Respond to the most recent message above."
    )


@retry(
    reraise=True,
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=1, min=1, max=4),
    retry=retry_if_exception_type((APITimeoutError, RateLimitError)),
)
async def _call_model(user_message: str) -> str:
    client = get_openai_client()

    completion = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=0.3,
    )

    return completion.choices[0].message.content or ""


async def generate_reply(findings: list[Finding], history: list[ConversationTurn]) -> str:
    """
    ConversationContext -> a reply string. Guardrails applied, in order:
    1. History capping (services/conversation_service.py, before this is called) — bounds
       how much prior conversation is sent to the model
    2. Prompt-injection resistance — same approach as review_agent.py
    3. Retry (transient OpenAI errors only, 2 attempts)
    4. Reply-length capping — bounds the output regardless of what the model returns,
       since there's no structured-output schema constraining free-text replies
    """
    user_message = _build_user_message(findings, history)

    try:
        reply = await _call_model(user_message)
    except (APIError, APITimeoutError, RateLimitError) as exc:
        logger.error("openai call failed for conversation reply: %s", exc)
        raise ConversationGenerationError("OpenAI call failed") from exc

    reply = reply.strip()

    if len(reply) > settings.max_reply_chars:
        reply = reply[: settings.max_reply_chars].rstrip() + "…"

    if not reply:
        reply = "I wasn't able to generate a response — could you rephrase your question?"

    return reply
