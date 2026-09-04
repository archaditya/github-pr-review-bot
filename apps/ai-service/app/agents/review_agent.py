import json
import logging

from openai import APIError, APITimeoutError, RateLimitError
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from ..core.config import settings
from ..core.openai_client import get_openai_client
from ..schemas.review_request import ChangedFileContext, PullRequestMeta, ImpactContext
from ..schemas.review_response import ReviewResponse
from ..schemas.finding import Finding
from ..utils.diff_capping import cap_diff
from .prompts import load_prompt
from .schema_defs import REVIEW_FINDINGS_SCHEMA

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = load_prompt("review_system.md")


class ReviewGenerationError(Exception):
    """Raised when the model call fails or its output can't be trusted, after retries.
    Caught at the API layer (app/api/review.py) and mapped to a 502 — the circuit breaker
    on the Node side (ADR-006) treats any non-2xx as a breaker-tracked failure."""


def _build_user_message(
    diff: str,
    usage_context: list[ChangedFileContext],
    pr: PullRequestMeta,
    impact_context: ImpactContext | None = None,
) -> str:
    usage_block = (
        "\n\n".join(
            f"### {item.file} ({item.status or 'modified'})\n```diff\n{item.patch or ''}\n```"
            for item in usage_context
        )
        or "(no per-file context available)"
    )

    parts = [
        f"Pull request: {pr.owner}/{pr.repo} #{pr.number}\n\n",
        f"## Full diff\n```diff\n{diff or ''}\n```\n\n",
        f"## Per-file context\n{usage_block}",
    ]

    # Append structural impact context when available (from code knowledge graph)
    if impact_context and impact_context.changed_symbols:
        impact_parts = ["\n\n## Structural Impact Analysis (from code knowledge graph)"]

        if impact_context.changed_symbols:
            impact_parts.append(f"\n### Changed Symbols\n" + "\n".join(f"- `{s}`" for s in impact_context.changed_symbols))

        if impact_context.callers:
            impact_parts.append(f"\n### Callers of Changed Code")
            for caller in impact_context.callers[:20]:  # cap to avoid bloating context
                if hasattr(caller, "name") and hasattr(caller, "file_path"):
                    name = caller.name or getattr(caller, "fqn", "unknown")
                    fpath = caller.file_path or "unknown"
                elif isinstance(caller, dict):
                    name = caller.get("name") or caller.get("fqn", "unknown")
                    fpath = caller.get("file_path", "unknown")
                else:
                    name = str(caller)
                    fpath = "unknown"
                impact_parts.append(f"- `{name}` in `{fpath}`")

        if impact_context.callees:
            impact_parts.append(f"\n### Functions Called by Changed Code\n" + "\n".join(f"- `{c}`" for c in impact_context.callees[:20]))

        if impact_context.affected_endpoints:
            impact_parts.append(f"\n### Affected API Endpoints\n" + "\n".join(f"- `{ep}`" for ep in impact_context.affected_endpoints))

        if impact_context.related_tests:
            impact_parts.append(f"\n### Related Test Files\n" + "\n".join(f"- `{t}`" for t in impact_context.related_tests))

        impact_parts.append(f"\n### Impact Summary: {impact_context.affected_files_count} files potentially affected")
        parts.extend(impact_parts)

    return "".join(parts)


@retry(
    reraise=True,
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=1, min=1, max=4),
    retry=retry_if_exception_type((APITimeoutError, RateLimitError)),
)
async def _call_model(user_message: str) -> dict:
    client = get_openai_client()

    completion = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        response_format={"type": "json_schema", "json_schema": REVIEW_FINDINGS_SCHEMA},
        temperature=0,
    )

    raw_content = completion.choices[0].message.content
    return json.loads(raw_content)


async def generate_review(
    diff: str,
    usage_context: list[ChangedFileContext],
    pull_request: PullRequestMeta,
    impact_context: ImpactContext | None = None,
) -> ReviewResponse:
    """
    ReviewContext -> structured findings. Guardrails applied, in order:
    1. Input capping (cap_diff) — bounds cost/latency/context-window risk
    2. Prompt-injection resistance — system prompt instructs the model to treat diff
       content strictly as data (defense is prompt-level; there's no code-level filter
       that could catch this reliably, so this is a known best-effort mitigation)
    3. Structured outputs (JSON schema, strict mode) — constrains shape at decode time
    4. Pydantic validation — a second, independent check that output matches the contract
       before it's ever returned to apps/api
    5. Retry (openai timeouts / rate limits only, 2 attempts, exponential backoff) — never
       retries on a schema-validation failure, since that's not a transient error
    """
    capped_diff, truncated = cap_diff(diff or "", settings.max_diff_tokens)
    pr_owner = getattr(pull_request, "owner", "") or "unknown"
    pr_repo = getattr(pull_request, "repo", "") or "unknown"
    pr_num = getattr(pull_request, "number", 0) or 0
    pr_label = f"{pr_owner}/{pr_repo}#{pr_num}"

    if truncated:
        logger.warning("diff truncated to fit max_diff_tokens", extra={"pr": pr_label})

    user_message = _build_user_message(capped_diff, usage_context or [], pull_request, impact_context)

    try:
        raw = await _call_model(user_message)
    except (APIError, APITimeoutError, RateLimitError) as exc:
        logger.error("openai call failed for %s: %s", pr_label, exc)
        raise ReviewGenerationError("OpenAI call failed") from exc
    except json.JSONDecodeError as exc:
        logger.error("model returned non-JSON output for %s", pr_label)
        raise ReviewGenerationError("Model output was not valid JSON") from exc

    try:
        findings = [Finding(**item) for item in raw.get("findings", [])]
    except Exception as exc:  # pydantic.ValidationError or a malformed dict shape
        logger.error("model output failed schema validation for %s: %s", pr_label, exc)
        raise ReviewGenerationError("Model output failed schema validation") from exc

    logger.info("generated %d findings for %s", len(findings), pr_label)
    return ReviewResponse(findings=findings, truncated=truncated)
