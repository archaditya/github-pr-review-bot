import json
import logging

from openai import APIError, APITimeoutError, RateLimitError
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from ..core.config import settings
from ..core.openai_client import get_openai_client
from ..schemas.social_draft import SocialDraftRequest, SocialDraftResponse

logger = logging.getLogger(__name__)


class SocialDraftGenerationError(Exception):
    """Raised when social draft generation fails after retries."""


SOCIAL_DRAFT_SCHEMA = {
    "name": "social_drafts",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "x_draft": {"type": "string", "description": "Short, punchy post for X (Twitter). Must be under 280 characters."},
            "linkedin_draft": {"type": "string", "description": "Professional, detailed post for LinkedIn. Can be longer and more explanatory."},
        },
        "required": ["x_draft", "linkedin_draft"],
        "additionalProperties": False,
    },
}


def _build_system_prompt(repo_name: str, repo_voice: str) -> str:
    return f"""You are a social media content creator for a software developer named Aditya.
You generate social media posts about engineering work, features, and updates.

PROJECT CONTEXT:
- Project: {repo_name}
- Voice/Tone: {repo_voice}

PLATFORM RULES:

**X (Twitter):**
- MUST be under 280 characters total (this is a hard platform limit)
- Punchy, engaging, with relevant emojis
- Use hashtags sparingly (1-2 max)
- Hook the reader in the first line
- Tech-savvy audience, be authentic not corporate

**LinkedIn:**
- Professional and explanatory
- 1-3 paragraphs, detailed but scannable
- Explain the "what" and "why" of the work
- Can include technical depth
- Professional tone but not stuffy — Aditya's personal voice
- Include relevant hashtags at the end (3-5)

RULES:
- Write as Aditya (first person: "I", "my", "we")
- Focus on the value/impact of the changes, not just what was done
- Make it sound like genuine developer progress, not marketing
- If the context is about a bug fix, frame it as improving reliability
- If it's a new feature, highlight the user benefit
- Never fabricate details — only reference what's in the provided context
- Both posts should be ready to publish as-is (no placeholders)"""


def _build_user_message(request: SocialDraftRequest) -> str:
    parts = []

    if request.standalone_input:
        parts.append(f"## My idea/thought to post about\n{request.standalone_input}\n")
    else:
        parts.append(f"## PR: {request.pr_title} (#{request.pr_number})\n")

    if request.review_summary:
        parts.append(f"## AI Review Summary\n{request.review_summary[:2000]}\n")

    if request.findings:
        findings_text = "\n".join(
            f"- [{f.get('severity', 'info')}] {f.get('file', '')}:{f.get('line', '')} — {f.get('rationale', '')}"
            for f in request.findings[:5]
        )
        parts.append(f"## Key Findings\n{findings_text}\n")

    if request.changed_files:
        files_text = "\n".join(f"- {f}" for f in request.changed_files[:10])
        parts.append(f"## Changed Files\n{files_text}\n")

    if request.diff:
        parts.append(f"## Diff (excerpt)\n```diff\n{request.diff[:3000]}\n```\n")

    parts.append("\nGenerate an X post and a LinkedIn post about this work.")
    return "\n".join(parts)


@retry(
    reraise=True,
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=1, min=1, max=4),
    retry=retry_if_exception_type((APITimeoutError, RateLimitError)),
)
async def _call_model(system_prompt: str, user_message: str) -> dict:
    client = get_openai_client()

    completion = await client.chat.completions.create(
        model=settings.openai_model,  # gpt-4o-mini — fast and cheap for social drafts
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        response_format={"type": "json_schema", "json_schema": SOCIAL_DRAFT_SCHEMA},
        temperature=0.7,  # higher creativity for social posts
    )

    raw_content = completion.choices[0].message.content
    return json.loads(raw_content)


async def generate_social_drafts(request: SocialDraftRequest) -> SocialDraftResponse:
    """Generate X and LinkedIn post drafts from PR context or standalone input."""

    system_prompt = _build_system_prompt(request.repo_name, request.repo_voice)
    user_message = _build_user_message(request)

    try:
        raw = await _call_model(system_prompt, user_message)
    except (APIError, APITimeoutError, RateLimitError) as exc:
        logger.error("openai call failed for social draft: %s", exc)
        raise SocialDraftGenerationError("OpenAI call failed") from exc
    except json.JSONDecodeError as exc:
        logger.error("model returned non-JSON output for social draft")
        raise SocialDraftGenerationError("Model output was not valid JSON") from exc

    # Validate and enforce X character limit
    x_draft = raw.get("x_draft", "")
    linkedin_draft = raw.get("linkedin_draft", "")

    if len(x_draft) > 280:
        logger.warning("X draft exceeded 280 chars (%d) — truncating", len(x_draft))
        x_draft = x_draft[:277] + "..."

    logger.info(
        "generated social drafts (X: %d chars, LinkedIn: %d chars)",
        len(x_draft),
        len(linkedin_draft),
    )

    return SocialDraftResponse(x_draft=x_draft, linkedin_draft=linkedin_draft)
