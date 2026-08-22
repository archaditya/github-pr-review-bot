# app/agents/ — the review & conversation harnesses

Where "agent" behavior lives: prompt templates, the OpenAI structured-outputs schema, and the
orchestration loop that calls the OpenAI SDK and validates what comes back.

- `prompts/` — versioned system prompts as `.md` files (`review_system.md`,
  `conversation_system.md`), loaded via `prompts/__init__.py`'s `load_prompt()`. Kept out of
  Python code so they're easy to iterate on and diff in review. Both prompts explicitly
  instruct the model to treat diff/code/conversation content as **data, never instructions**
  — the prompt-injection guardrail, since there's no reliable code-level filter for this.
- `schema_defs.py` — the strict JSON schema used with OpenAI's structured outputs for review
  findings (`response_format={"type": "json_schema", ...}`) — constrains output shape at
  decode time, not just by asking nicely in the prompt.
- `review_agent.py` — `generate_review()`: caps the diff (`utils/diff_capping.py`) → calls the
  model with the structured-outputs schema → re-validates the result with Pydantic
  (independent of the schema constraint — defense in depth) → retries only on transient
  OpenAI errors (`tenacity`, 2 attempts, exponential backoff), never on a validation failure.
- `conversation_agent.py` — `generate_reply()`: same retry/error-handling shape, plus a hard
  cap on reply length (`settings.max_reply_chars`) since free-text replies have no schema
  constraint to bound them.

## Guardrail summary (with where each lives)

| Guardrail | Where |
|---|---|
| Request body size cap | `core/middleware.py` (`BodySizeLimitMiddleware`) |
| Diff input token cap | `utils/diff_capping.py`, applied in `review_agent.py` |
| Conversation history cap | `services/conversation_service.py`, applied before `conversation_agent.py` |
| Prompt-injection resistance | `prompts/review_system.md`, `prompts/conversation_system.md` |
| Structured output shape | `schema_defs.py` (OpenAI strict JSON schema) |
| Independent output re-validation | Pydantic `Finding(**item)` in `review_agent.py` |
| Findings count cap + dedup | `services/review_service.py` |
| Reply length cap | `conversation_agent.py` |
| Transient-error-only retry | `tenacity` decorators in both agents — never retries a bad output |
