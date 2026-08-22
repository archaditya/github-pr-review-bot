"""
Approximate token counting without a real tokenizer.

`tiktoken` would be more accurate, but its BPE vocab files are fetched from OpenAI's CDN
on first use unless pre-bundled into the image — which would make this service's Docker
build (and cold start) depend on outbound network access at build/run time, breaking the
"builds and boots the same everywhere, offline-friendly" property we want (ADR-008).

~4 characters per token is a standard rough heuristic for English/code text. This is a
*soft input-shaping guardrail*, not a billing-accurate count — good enough to decide
whether a diff needs truncating before it's sent to the model.
"""

CHARS_PER_TOKEN_ESTIMATE = 4


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // CHARS_PER_TOKEN_ESTIMATE)
