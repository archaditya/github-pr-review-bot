# app/core/

- `config.py` — pydantic-settings config object (OpenAI key/model/timeout, all guardrail
  thresholds), the only place env vars are read
- `logging.py` — structured logging setup; deliberately never logs full diffs or full model
  responses, only sizes/counts/truncation flags (PR diffs can contain sensitive source code)
- `openai_client.py` — lazily-constructed, cached OpenAI SDK client shared across `agents/`
- `middleware.py` — `BodySizeLimitMiddleware` (request-size guardrail, ahead of parsing) and
  `RequestLoggingMiddleware` (one structured line per request, no body content)
