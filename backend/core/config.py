from functools import lru_cache
from typing import Any

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

    # AI model — override to switch providers, e.g. "anthropic/claude-haiku-4-5-20251001"
    # For Hyperspace: set ANTHROPIC_BASE_URL=http://localhost:6655/anthropic/ and ANTHROPIC_AUTH_TOKEN=<token>
    # For direct Anthropic: set ANTHROPIC_API_KEY=sk-ant-...
    AI_MODEL: str = "ollama/qwen2.5-coder:7b"
    ANTHROPIC_API_KEY: str | None = None
    ANTHROPIC_AUTH_TOKEN: str | None = None
    ANTHROPIC_BASE_URL: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


def ai_kwargs(settings: Settings) -> dict[str, Any]:
    """Return litellm acompletion kwargs for the configured AI model."""
    kwargs: dict[str, Any] = {"model": settings.AI_MODEL}
    if settings.AI_MODEL.startswith("ollama/"):
        kwargs["api_base"] = settings.OLLAMA_URL
    elif settings.AI_MODEL.startswith("anthropic/"):
        if settings.ANTHROPIC_BASE_URL:
            kwargs["api_base"] = settings.ANTHROPIC_BASE_URL
        if settings.ANTHROPIC_AUTH_TOKEN:
            kwargs["api_key"] = settings.ANTHROPIC_AUTH_TOKEN
    return kwargs
