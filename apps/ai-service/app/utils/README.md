# app/utils/

- `token_estimate.py` — approximate (~4 chars/token) token counting, deliberately avoiding a
  network-dependent tokenizer (`tiktoken`'s vocab files are fetched from OpenAI's CDN on first
  use unless bundled — this keeps the Docker image self-contained, ADR-008)
- `diff_capping.py` — `cap_diff()`, the actual input-size guardrail applied in `review_agent.py`
