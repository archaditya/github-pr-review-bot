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
            "x_draft": {
                "type": "string",
                "description": "Short, punchy post for X (Twitter). Must be under 280 characters.",
            },
            "linkedin_draft": {
                "type": "string",
                "description": "Professional, detailed post for LinkedIn. Can be longer and more explanatory.",
            },
            "image_prompt": {
                "type": "string",
                "description": (
                    "A detailed prompt for generating an Excalidraw-style technical whiteboard diagram. "
                    "Must visually illustrate the exact workflow, pipeline, or architecture of THIS PR based strictly on the diff. "
                    "Do NOT invent generic database cylinders, message queues, or AI services unless they exist in the diff."
                ),
            },
        },
        "required": ["x_draft", "linkedin_draft", "image_prompt"],
        "additionalProperties": False,
    },
}


def _build_system_prompt(repo_name: str, repo_voice: str) -> str:
    return f"""You are a senior developer advocate and content creator for a software engineer named Aditya.
You generate social media posts and technical whiteboard diagrams announcing completed engineering features, architectural milestones, and major product updates.

PROJECT CONTEXT:
- Project: {repo_name}
- Voice/Tone: {repo_voice}

CRITICAL RULES FOR POST CONTENT:
1. STRICT GROUNDING IN THE PR DIFF:
   - ONLY describe technologies, modules, and workflows that are actually present in the changed files and unified diff.
   - NEVER assume or hallucinate external services (e.g. do NOT mention 'AI services', 'LLMs', 'Kafka', 'Redis', or 'PostgreSQL' unless they are explicitly in the diff!).
   - If the PR is about image decoding, Go routines, CLI tools, UI components, or bug fixes, describe EXACTLY that domain.
2. FOCUS ON THE FEATURE / ENGINEERING VALUE:
   - Announce what capability was built or improved.
   - Highlight the tech stack, key architectural decisions, and why this update matters.
   - Celebrate shipping the milestone (e.g. "Just shipped...", "Implemented...", "Built...").
3. DO NOT WRITE ABOUT CODE REVIEW FINDINGS OR LINTER ISSUES:
   - NEVER mention bot reviews, code review comments, or nitpicks. People post about product milestones and engineering accomplishments!

PLATFORM RULES:

**X (Twitter):**
- MUST be under 280 characters total (hard platform limit)
- Punchy, exciting, highlight the main accomplishment with 1-2 relevant emojis and hashtags
- First-person ("Just shipped...", "Implemented...", "Built...")

**LinkedIn:**
- Professional, storytelling style
- 2-4 clean, scannable paragraphs (Hook -> Technical breakdown of the diff -> Key takeaway)
- Include 3-5 relevant tech hashtags

**IMAGE DIAGRAM PROMPT (image_prompt):**
You must write a rich, tailored prompt for OpenAI's Image API to generate an authentic developer whiteboard sketch.
Requirements for image_prompt:
- Style: Hand-drawn Excalidraw / napkin sketch aesthetic on a subtle off-white grid paper background. Dark ink marker outlines with gentle pastel color highlights (soft blue, mint green, pale yellow, coral).
- Content: An architecture, data pipeline, or workflow diagram representing THE EXACT WORK in this PR.
  * Clearly define the specific nodes/boxes and the step-by-step arrows connecting them based on the diff.
  * Example for image processing: "Raw Image -> Byte Marker Check -> Format Normalizer -> Detection Engine -> Result Classification".
  * DO NOT include generic database cylinders, queues, or AI services unless they are genuinely part of this PR's diff.
  * Make the diagram educational, technically precise to this PR, and visually engaging.

RULES:
- Write as Aditya (first person: "I", "my", "we")
- Both posts and image prompt must be fully formed and ready to use without placeholders."""


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
        "\nIMPORTANT: Strictly ground your post and image_prompt in the diff above. Do NOT hallucinate components or services not present in the code."
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
        temperature=0.7,
    )

    raw_content = completion.choices[0].message.content
    return json.loads(raw_content)


async def _generate_dalle_image(image_prompt: str) -> str | None:
    """
    Generate a technical Excalidraw/whiteboard system design diagram using OpenAI Image API.
    Tries gpt-image-2.5-flare (OpenAI 2026 flagship image model), falling back to gpt-image-1 or dall-e-2.
    Resilient: logs any errors and returns None so draft text generation is never blocked.
    """
    if not image_prompt:
        return None

    client = get_openai_client()
    candidate_models = ["gpt-image-2.5-flare", "gpt-image-1", "dall-e-2"]

    for model_name in candidate_models:
        try:
            logger.info("Attempting image generation with model: %s", model_name)
            kwargs = {"model": model_name, "prompt": image_prompt, "n": 1}
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
    """Generate X and LinkedIn post drafts and a tailored whiteboard diagram from PR context or standalone input."""

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
    image_prompt = raw.get("image_prompt", "")

    if len(x_draft) > 280:
        logger.warning("X draft exceeded 280 chars (%d) — truncating", len(x_draft))
        x_draft = x_draft[:277] + "..."

    # Generate custom tailored diagram matching the specific PR's components and flow
    image_url = None
    if image_prompt:
        try:
            image_url = await _generate_dalle_image(image_prompt)
        except Exception as exc:
            logger.warning("image generation step encountered error: %s", exc)

    logger.info(
        "generated social drafts (X: %d chars, LinkedIn: %d chars, image: %s)",
        len(x_draft),
        len(linkedin_draft),
        "yes" if image_url else "no",
    )

    return SocialDraftResponse(x_draft=x_draft, linkedin_draft=linkedin_draft, image_url=image_url)

