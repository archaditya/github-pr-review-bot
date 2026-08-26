from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Single source of truth for indexer-service config.
    Mirrors the convention in apps/ai-service/app/core/config.py.
    """

    port: int = 8001
    environment: str = "development"
    log_level: str = "info"

    # Neo4j
    neo4j_uri: str = "bolt://neo4j:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "changeme"

    # Git clone workspace (temporary, cleaned after indexing)
    clone_workspace: str = "/tmp/repos"

    # GitHub API rate limit awareness
    github_api_rate_limit_buffer: int = 100  # stop when remaining < this

    # Indexing limits
    max_file_size_bytes: int = 512 * 1024  # 512KB — skip files larger than this
    max_files_per_repo: int = 10000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
