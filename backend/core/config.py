from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

    # Security
    SECRET_KEY: str
    LOGIN_RATE_LIMIT: str = "5/minute"

    # GitHub OAuth
    GITHUB_CLIENT_ID: str
    GITHUB_CLIENT_SECRET: str

    # GitHub PAT — fallback for unauthenticated API calls (5000 req/hr vs 60)
    GITHUB_TOKEN: str | None = None

    # Application URLs
    FRONTEND_URL: str
    BACKEND_URL: str = "http://localhost:8000"

    # Valkey (Redis-compatible cache + task queue)
    VALKEY_URL: str = "redis://localhost:6379/0"

    # Ollama LLM server
    OLLAMA_URL: str = "http://localhost:11434"

    # Anthropic (Claude) — used for diagram generation when set
    ANTHROPIC_API_KEY: str | None = None
    # LiteLLM-compatible base URL override (e.g. a local proxy)
    ANTHROPIC_BASE_URL: str | None = None
    ANTHROPIC_AUTH_TOKEN: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
