from typing import Tuple

from .token_estimate import CHARS_PER_TOKEN_ESTIMATE

TRUNCATION_NOTE = "\n\n...[diff truncated — exceeded MAX_DIFF_TOKENS]...\n"


def cap_diff(diff: str, max_tokens: int) -> Tuple[str, bool]:
    """
    Input-size guardrail (docs/architecture/ADR-003 + app/agents/README.md): bounds how
    much diff text reaches the model, regardless of what apps/api sends. Protects against
    both cost blowups and exceeding the model's context window on an unexpectedly huge PR.

    Returns (possibly-truncated diff, was_truncated). Truncation is a hard character cut,
    not "smartest possible summarization" — for MVP, an honest partial review of the first
    N tokens is preferable to adding more complexity here (ADR-003 keeps this service simple).
    """
    max_chars = max_tokens * CHARS_PER_TOKEN_ESTIMATE

    if len(diff) <= max_chars:
        return diff, False

    return diff[: max_chars - len(TRUNCATION_NOTE)] + TRUNCATION_NOTE, True
