from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str

    # Security
    SECRET_KEY: str

    # GitHub OAuth
    GITHUB_CLIENT_ID: str
    GITHUB_CLIENT_SECRET: str

    # Application URLs
    FRONTEND_URL: str
    BACKEND_URL: str = "http://localhost:8000"

    # Valkey (Redis-compatible cache + task queue)
    VALKEY_URL: str = "redis://localhost:6379/0"

    # Ollama LLM server
    OLLAMA_URL: str = "http://localhost:11434"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
