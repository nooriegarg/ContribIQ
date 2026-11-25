"""Issue difficulty scoring and match-score parsing."""

import asyncio
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from backend.services.difficulty_service import (
    count_imports,
    score_complexity,
    score_files_affected,
    score_issue,
)
from backend.services.issues_service import extract_file_paths, fetch_open_issues, normalize_issue
from backend.schemas.match import MatchResult
from backend.services.matching_service import (
    build_match_prompt,
    clamp_score,
    match_issue,
    parse_match_response,
)


def test_extract_file_paths_ignores_urls_and_duplicates():
    text = "Fix fastapi/security/oauth2.py and tests/test_security.py (see https://x.io/a/b.py) oauth2.py"
    assert extract_file_paths(text) == [
        "fastapi/security/oauth2.py",
        "tests/test_security.py",
        "oauth2.py",
    ]


def test_normalize_issue_extracts_labels_and_files():
    issue = normalize_issue(
        {"number": 1, "title": "t", "body": "see a/b.py", "labels": [{"name": "bug"}]}
    )
    assert issue["labels"] == ["bug"]
    assert issue["files_affected"] == ["a/b.py"]


def test_count_imports():
    assert count_imports("import os\nfrom a import b\n\ndef f():\n    import sys\n") == 3


def test_files_affected_buckets():
    assert [score_files_affected(["a"] * n) for n in (1, 2, 3, 6, 9)] == [1, 2, 3, 4, 5]


def test_score_issue_easy_vs_hard():
    easy = score_issue(
        {"title": "Fix typo in README", "body": "", "labels": [], "files_affected": ["README.md"]}, {}
    )
    hard = score_issue(
        {
            "title": "Race condition in auth crypto",
            "body": "Needs about 500 lines of changes",
            "labels": [],
            "files_affected": ["a.py"] * 8,
        },
        {"a.py": "\n".join(f"import m{i}" for i in range(30)) + "\ndef f(x):\n" + "    if x:\n        pass\n" * 25},
    )
    assert 1 <= easy["difficulty"] < hard["difficulty"] <= 5


@pytest.mark.parametrize("raw,expected", [(102, 100), (97.5, 98), (-4, 0), ("88", 88), (50, 50)])
def test_clamp_score(raw, expected):
    assert clamp_score(raw) == expected


def test_parse_match_response_clamps_and_strips_reasons():
    score, reasons = parse_match_response(
        'Sure:\n```json\n{"score": 102, "reasons": [" a ", "b", "c"]}\n```'
    )
    assert score == 100
    assert reasons == ["a", "b", "c"]


def test_parse_match_response_rejects_missing_reasons():
    with pytest.raises(ValueError):
        parse_match_response('{"score": 80, "reasons": ["a"]}')


@pytest.mark.parametrize("reasons", ['"abc"', '["a", "b", "c", "d"]', '[1, null, {}]', '["a", " ", "c"]'])
def test_parse_match_response_rejects_malformed_reasons(reasons):
    with pytest.raises(ValueError):
        parse_match_response('{"score": 80, "reasons": ' + reasons + '}')


@pytest.mark.parametrize("score", [True, None, float("inf"), float("nan"), {}, "invalid"])
def test_clamp_score_rejects_invalid_values(score):
    with pytest.raises(ValueError):
        clamp_score(score)


def test_match_schema_requires_exactly_three_nonempty_reasons():
    for reasons in (["a"], ["a", "b", "c", "d"], ["a", " ", "c"]):
        with pytest.raises(ValueError):
            MatchResult(issue_id=uuid.uuid4(), match_pct=80, reasons=reasons)


def test_straight_line_python_is_low_complexity():
    assert score_complexity({"config.py": "ENABLED = True\n"}) == 1


def test_fetch_only_open_issues_and_exclude_pull_requests():
    client = SimpleNamespace(get_issues=AsyncMock(return_value=[
        {"number": 1, "state": "open", "title": "Fix docs", "labels": []},
        {"number": 2, "state": "closed"},
        {"number": 3, "state": "open", "pull_request": {}},
    ]))
    result = asyncio.run(fetch_open_issues(client, "owner", "repo"))
    assert [issue["number"] for issue in result] == [1]
    client.get_issues.assert_awaited_once_with("owner", "repo", state="open")


def test_match_issue_calls_llm_and_preserves_issue_identity(monkeypatch):
    from backend.services import matching_service

    issue = {
        "id": uuid.uuid4(), "number": 7, "title": "Fix documentation",
        "difficulty": 1.5, "labels": [], "files_affected": [], "estimated_hours": 1,
    }
    completion = AsyncMock(return_value=SimpleNamespace(choices=[
        SimpleNamespace(message=SimpleNamespace(
            content='{"score": 97.5, "reasons": ["Languages align", "Beginner task", "Relevant interest"]}'
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
    result = asyncio.run(match_issue({"languages": ["Python"]}, issue))
    assert result.issue_id == issue["id"]
    assert result.match_pct == 98
    assert len(result.reasons) == 3
    assert "Issue #7" in completion.call_args.kwargs["messages"][0]["content"]


def test_build_match_prompt_includes_profile_and_issue():
    prompt = build_match_prompt(
        {"languages": ["Python"], "experience": "beginner", "interests": []},
        {"id": uuid.uuid4(), "number": 142, "title": "Add validation", "difficulty": 2.2,
         "labels": ["good first issue"], "files_affected": ["a.py"], "estimated_hours": 2.0},
    )
    assert "Languages: Python" in prompt
    assert "Experience: Beginner" in prompt
    assert 'Issue #142: "Add validation"' in prompt
    assert "Difficulty: 2/5" in prompt
