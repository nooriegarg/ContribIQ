"""
Tests for ai_kwargs() in core/config.py.

ai_kwargs() builds the litellm keyword dict based on the AI_MODEL prefix:
  - "ollama/*"     → adds api_base from OLLAMA_URL
  - "anthropic/*"  → adds api_key / api_base from Anthropic credentials
  - anything else  → returns only the model key
"""

from types import SimpleNamespace
from backend.core.config import ai_kwargs


def _settings(**kwargs) -> SimpleNamespace:
    defaults = {
        "AI_MODEL": "ollama/qwen2.5-coder:7b",
        "OLLAMA_URL": "http://localhost:11434",
        "ANTHROPIC_API_KEY": None,
        "ANTHROPIC_AUTH_TOKEN": None,
        "ANTHROPIC_BASE_URL": None,
    }
    return SimpleNamespace(**{**defaults, **kwargs})


# ── Ollama model ──────────────────────────────────────────────────────────────

def test_ollama_model_includes_api_base():
    result = ai_kwargs(_settings(AI_MODEL="ollama/qwen2.5-coder:7b"))
    assert result["api_base"] == "http://localhost:11434"


def test_ollama_model_includes_correct_model_name():
    result = ai_kwargs(_settings(AI_MODEL="ollama/qwen2.5-coder:7b"))
    assert result["model"] == "ollama/qwen2.5-coder:7b"


def test_ollama_model_does_not_include_api_key():
    result = ai_kwargs(_settings(AI_MODEL="ollama/qwen2.5-coder:7b"))
    assert "api_key" not in result


# ── Anthropic model — credentials present ────────────────────────────────────

def test_anthropic_model_with_auth_token_sets_api_key():
    result = ai_kwargs(_settings(
        AI_MODEL="anthropic/claude-haiku-4-5",
        ANTHROPIC_AUTH_TOKEN="my-token",
    ))
    assert result["api_key"] == "my-token"


def test_anthropic_model_with_base_url_sets_api_base():
    result = ai_kwargs(_settings(
        AI_MODEL="anthropic/claude-haiku-4-5",
        ANTHROPIC_BASE_URL="http://proxy:6655/anthropic/",
    ))
    assert result["api_base"] == "http://proxy:6655/anthropic/"


def test_anthropic_model_with_both_credentials_sets_both():
    result = ai_kwargs(_settings(
        AI_MODEL="anthropic/claude-haiku-4-5",
        ANTHROPIC_AUTH_TOKEN="tok",
        ANTHROPIC_BASE_URL="http://proxy/",
    ))
    assert result["api_key"] == "tok"
    assert result["api_base"] == "http://proxy/"


def test_anthropic_model_no_credentials_returns_only_model():
    result = ai_kwargs(_settings(AI_MODEL="anthropic/claude-haiku-4-5"))
    assert set(result.keys()) == {"model"}


def test_anthropic_model_does_not_include_ollama_api_base():
    result = ai_kwargs(_settings(AI_MODEL="anthropic/claude-haiku-4-5"))
    assert result.get("api_base") != "http://localhost:11434"


# ── Unknown / custom model prefix ────────────────────────────────────────────

def test_unknown_model_prefix_returns_only_model():
    result = ai_kwargs(_settings(AI_MODEL="openai/gpt-4o"))
    assert result == {"model": "openai/gpt-4o"}


def test_model_key_always_matches_ai_model_setting():
    for model in ["ollama/qwen2.5-coder:7b", "anthropic/claude-haiku-4-5", "openai/gpt-4o"]:
        result = ai_kwargs(_settings(AI_MODEL=model))
        assert result["model"] == model
