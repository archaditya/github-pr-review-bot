# app/core/

- `config.py` — pydantic-settings config object (OpenAI API key, model name, timeouts), the
  only place env vars are read
- `logging.py` — structured logging setup
- `openai_client.py` — constructs the OpenAI SDK client instance, shared across `agents/`
