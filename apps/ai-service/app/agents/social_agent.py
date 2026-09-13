import asyncio
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
You generate social media posts announcing completed engineering features, architectural milestones, and major product updates.

PROJECT CONTEXT:
- Project: {repo_name}
- Voice/Tone: {repo_voice}

CRITICAL RULES FOR POST CONTENT:
1. FOCUS ON THE FEATURE / WHAT WAS BUILT:
   - Announce the major features, architectures, modules, and user-facing capabilities introduced in this PR.
   - Highlight the tech stack, key architectural decisions, and why this update matters to users/developers.
   - Celebrate shipping the milestone (e.g. "Just shipped Module 1 of Verkin!", "Implemented...", "Built...").
2. DO NOT WRITE ABOUT CODE REVIEW FINDINGS OR LINTER ISSUES:
   - NEVER write a post about internal bot findings, review comments, or minor typo/linter fixes. People post on LinkedIn/X about product milestones and engineering accomplishments, not code review nitpicks!

PLATFORM RULES:

**X (Twitter):**
- MUST be under 280 characters total (this is a hard platform limit)
- Punchy, exciting, highlight the main accomplishment/feature with relevant emojis
- Use 1-2 relevant hashtags
- First-person ("Just shipped...", "Built...", "Shipped...")

**LinkedIn:**
- Professional, insightful, storytelling style
- 2-4 clean, scannable paragraphs
- Structure:
  1. Catchy hook: what major milestone or feature was just built/shipped
  2. The technical breakdown: architecture, libraries, challenges solved, frontend/backend integration
  3. Key takeaway or what's next
- Include 3-5 relevant tech hashtags

RULES:
- Write as Aditya (first person: "I", "my", "we")
- Focus on the value and engineering accomplishments
- Make it sound like genuine developer progress, not corporate marketing
- Both posts should be ready to publish as-is (no placeholders)"""


def _build_user_message(request: SocialDraftRequest) -> str:
    parts = []

    if request.standalone_input:
        parts.append(f"## Topic/Update to post about\n{request.standalone_input}\n")
    else:
        parts.append(f"## Pull Request: {request.pr_title} (#{request.pr_number})\n")

    if request.changed_files:
        files_text = "\n".join(f"- {f}" for f in request.changed_files[:25])
        parts.append(f"## Key Changed Files\n{files_text}\n")

    if request.diff:
        parts.append(f"## Implementation Diff (what was built)\n```diff\n{request.diff[:15000]}\n```\n")

    parts.append(
        "\nIMPORTANT: Write an engaging post celebrating the major features, architecture, and engineering milestone accomplished in this PR. Do NOT focus on code review findings or linter notes."
    )
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


async def _generate_dalle_image(repo_name: str, repo_voice: str, topic: str) -> str | None:
    """
    Generate a modern, minimal, tech-forward social media banner using OpenAI Image API.
    Tries gpt-image-2.5-flare (OpenAI 2026 flagship image model), falling back to gpt-image-1 or dall-e-2.
    Resilient: logs any errors and returns None so draft text generation is never blocked.
    """
    prompt = (
        f"Create a modern, minimal, professional social media post banner for a software engineering update. "
        f"Project: '{repo_name or 'Software'}'. "
        f"Context: {repo_voice or 'Software Development'}. "
        f"Topic: '{topic}'. "
        f"Style: Clean gradient background, sleek abstract geometric architecture suggesting modern code and technology. "
        f"No text, words, or letters inside the image — pure visual design. "
        f"Colors: Rich, vibrant, tech-forward palette with smooth lighting. Professional and premium quality. "
        f"Aspect ratio: Landscape."
    )
    client = get_openai_client()
    candidate_models = ["gpt-image-2.5-flare", "gpt-image-1", "dall-e-2"]

    for model_name in candidate_models:
        try:
            logger.info("Attempting image generation with model: %s", model_name)
            kwargs = {"model": model_name, "prompt": prompt, "n": 1}
            if model_name == "dall-e-2":
                kwargs["size"] = "1024x1024"

            response = await client.images.generate(**kwargs)
            if response.data and len(response.data) > 0:
                item = response.data[0]
                url = getattr(item, "url", None)
                if url:
                    logger.info("Image successfully generated with model %s (URL)", model_name)
                    return url
                b64 = getattr(item, "b64_json", None)
                if b64:
                    logger.info("Image successfully generated with model %s (base64)", model_name)
                    return f"data:image/png;base64,{b64}"
        except Exception as exc:
            logger.warning("Image generation with model %s failed: %s", model_name, exc)
            continue

    logger.warning("All image generation model attempts failed — continuing without image")
    return None


async def generate_social_drafts(request: SocialDraftRequest) -> SocialDraftResponse:
    """Generate X and LinkedIn post drafts and a DALL-E banner from PR context or standalone input."""

    system_prompt = _build_system_prompt(request.repo_name, request.repo_voice)
    user_message = _build_user_message(request)
    topic = request.standalone_input or request.pr_title or "Feature Update"

    # Concurrently generate both the text copy and the DALL-E banner
    text_task = _call_model(system_prompt, user_message)
    image_task = _generate_dalle_image(request.repo_name, request.repo_voice, topic)

    try:
        raw, image_url = await asyncio.gather(text_task, image_task)
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
        "generated social drafts (X: %d chars, LinkedIn: %d chars, image: %s)",
        len(x_draft),
        len(linkedin_draft),
        "yes" if image_url else "no",
    )

    return SocialDraftResponse(x_draft=x_draft, linkedin_draft=linkedin_draft, image_url=image_url)
