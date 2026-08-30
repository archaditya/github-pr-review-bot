from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Single source of truth for ai-service config. Nowhere else should read os.environ
    directly (mirrors the convention in apps/api/src/config/).
    """

    port: int = 8000
    environment: str = "development"
    log_level: str = "info"

    # OpenAI (ADR-003)
    openai_api_key: str
    openai_model: str = "gpt-4o-mini"
    openai_request_timeout_seconds: int = 30

    # Guardrails — see docs/architecture/ADR-003-python-ai-service-boundary.md and
    # app/agents/README.md for how these are applied.
    max_diff_tokens: int = 6000
    max_findings: int = 50
    max_conversation_history_messages: int = 20
    max_reply_chars: int = 4000
    max_request_body_bytes: int = 2 * 1024 * 1024  # 2MB

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
