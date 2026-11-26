"""
Tests for matching_service — build_match_prompt, parse_match_response,
clamp_score edge cases, and the Anthropic LLM path in match_issue.

Core paths (clamp, parse, match via Ollama, build_match_prompt basics) are
already covered in test_issues_matching.py. These tests add:
  - build_match_prompt: None/missing profile fields, unknown hours, quote escaping
  - parse_match_response: no JSON block, score boundary values (0 and 100)
  - clamp_score: exact boundary values
  - match_issue: Anthropic path (ANTHROPIC_AUTH_TOKEN set), bad LLM response raises
"""

import asyncio
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from backend.services.matching_service import (
    build_match_prompt,
    clamp_score,
    parse_match_response,
    match_issue,
)


# ── build_match_prompt edge cases ────────────────────────────────────────────

def _base_issue(**kwargs) -> dict:
    defaults = {
        "id": uuid.uuid4(),
        "number": 1,
        "title": "Fix bug",
        "difficulty": 2.0,
        "labels": [],
        "files_affected": [],
        "estimated_hours": 1.0,
    }
    return {**defaults, **kwargs}


def _base_profile(**kwargs) -> dict:
    defaults = {"languages": ["Python"], "experience": "beginner", "interests": ["backend"]}
    return {**defaults, **kwargs}


def test_build_prompt_none_languages_shows_none():
    prompt = build_match_prompt(_base_profile(languages=None), _base_issue())
    assert "Languages: None" in prompt


def test_build_prompt_empty_interests_shows_none():
    prompt = build_match_prompt(_base_profile(interests=[]), _base_issue())
    assert "Interests: None" in prompt


def test_build_prompt_unknown_hours_when_none():
    prompt = build_match_prompt(_base_profile(), _base_issue(estimated_hours=None))
    assert "unknown" in prompt


def test_build_prompt_escapes_double_quotes_in_title():
    prompt = build_match_prompt(_base_profile(), _base_issue(title='Fix "broken" auth'))
    assert '"broken"' not in prompt
    assert "'broken'" in prompt


def test_build_prompt_experience_is_capitalised():
    prompt = build_match_prompt(_base_profile(experience="intermediate"), _base_issue())
    assert "Experience: Intermediate" in prompt


def test_build_prompt_includes_difficulty_rounded():
    prompt = build_match_prompt(_base_profile(), _base_issue(difficulty=3.7))
    assert "Difficulty: 4/5" in prompt


def test_build_prompt_multiple_languages_joined():
    prompt = build_match_prompt(
        _base_profile(languages=["Python", "TypeScript"]), _base_issue()
    )
    assert "Python, TypeScript" in prompt


# ── clamp_score boundary values ───────────────────────────────────────────────

def test_clamp_score_zero_is_valid():
    assert clamp_score(0) == 0


def test_clamp_score_one_hundred_is_valid():
    assert clamp_score(100) == 100


def test_clamp_score_above_hundred_clamps_to_hundred():
    assert clamp_score(101) == 100


def test_clamp_score_below_zero_clamps_to_zero():
    assert clamp_score(-1) == 0


def test_clamp_score_float_string_is_accepted():
    assert clamp_score("72.9") == 73


# ── parse_match_response edge cases ──────────────────────────────────────────

def test_parse_match_response_score_zero():
    score, reasons = parse_match_response('{"score": 0, "reasons": ["a", "b", "c"]}')
    assert score == 0


def test_parse_match_response_score_one_hundred():
    score, reasons = parse_match_response('{"score": 100, "reasons": ["a", "b", "c"]}')
    assert score == 100


def test_parse_match_response_raises_when_no_json():
    with pytest.raises(ValueError, match="no JSON object"):
        parse_match_response("Sorry, I cannot help with that.")


def test_parse_match_response_raises_when_missing_score_key():
    with pytest.raises(ValueError):
        parse_match_response('{"reasons": ["a", "b", "c"]}')


def test_parse_match_response_ignores_prose_around_json():
    score, reasons = parse_match_response(
        'Here is my answer:\n{"score": 55, "reasons": ["x", "y", "z"]}\nDone.'
    )
    assert score == 55
    assert reasons == ["x", "y", "z"]


def test_parse_match_response_strips_whitespace_from_reasons():
    _, reasons = parse_match_response('{"score": 50, "reasons": ["  hello  ", " world ", " !"]}')
    assert reasons == ["hello", "world", "!"]


# ── match_issue: Anthropic path ───────────────────────────────────────────────

def test_match_issue_uses_anthropic_when_auth_token_set(monkeypatch):
    from backend.services import matching_service

    issue = _base_issue(id=uuid.uuid4(), number=10)
    completion = AsyncMock(return_value=SimpleNamespace(choices=[
        SimpleNamespace(message=SimpleNamespace(
            content='{"score": 75, "reasons": ["Good match", "Relevant skill", "Right level"]}'
        ))
    ]))
    monkeypatch.setattr(matching_service, "acompletion", completion)
    monkeypatch.setattr(
        matching_service, "get_settings", lambda: SimpleNamespace(
            AI_MODEL="anthropic/claude-haiku-4-5",
            OLLAMA_URL="http://localhost:11434",
            ANTHROPIC_API_KEY=None,
            ANTHROPIC_AUTH_TOKEN="test-token",
            ANTHROPIC_BASE_URL="http://proxy:6655/anthropic/",
        )
    )

    result = asyncio.run(match_issue(_base_profile(), issue))

    call_kwargs = completion.call_args.kwargs
    assert call_kwargs["api_key"] == "test-token"
    assert call_kwargs["api_base"] == "http://proxy:6655/anthropic/"
    assert result.match_pct == 75


def test_match_issue_raises_on_bad_llm_json(monkeypatch):
    from backend.services import matching_service

    completion = AsyncMock(return_value=SimpleNamespace(choices=[
        SimpleNamespace(message=SimpleNamespace(content="I cannot process this."))
    ]))
    monkeypatch.setattr(matching_service, "acompletion", completion)
    monkeypatch.setattr(
        matching_service, "get_settings", lambda: SimpleNamespace(
            AI_MODEL="ollama/qwen2.5-coder:7b",
            OLLAMA_URL="http://localhost:11434",
            ANTHROPIC_API_KEY=None,
            ANTHROPIC_AUTH_TOKEN=None,
            ANTHROPIC_BASE_URL=None,
        )
    )

    with pytest.raises(ValueError, match="no JSON object"):
        asyncio.run(match_issue(_base_profile(), _base_issue()))


def test_match_issue_result_has_correct_issue_id(monkeypatch):
    from backend.services import matching_service

    issue_id = uuid.uuid4()
    completion = AsyncMock(return_value=SimpleNamespace(choices=[
        SimpleNamespace(message=SimpleNamespace(
            content='{"score": 60, "reasons": ["reason a", "reason b", "reason c"]}'
        ))
    ]))
    monkeypatch.setattr(matching_service, "acompletion", completion)
    monkeypatch.setattr(
        matching_service, "get_settings", lambda: SimpleNamespace(
            AI_MODEL="ollama/qwen2.5-coder:7b",
            OLLAMA_URL="http://localhost:11434",
            ANTHROPIC_API_KEY=None,
            ANTHROPIC_AUTH_TOKEN=None,
            ANTHROPIC_BASE_URL=None,
        )
    )

    result = asyncio.run(match_issue(_base_profile(), _base_issue(id=issue_id)))
    assert result.issue_id == issue_id
