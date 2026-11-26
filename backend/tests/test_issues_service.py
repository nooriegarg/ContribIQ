"""
Tests for issues_service — extract_file_paths, normalize_issue, fetch_open_issues.

The core happy-path fetch and basic extract_file_paths are already covered in
test_issues_matching.py. These tests add:
  - extract_file_paths: wider extension coverage, URL stripping, deduplication order
  - normalize_issue: string labels, None body, missing html_url, no files in text
  - fetch_open_issues: empty list, all PRs filtered, closed issues excluded,
    correct client call arguments
"""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

from backend.services.issues_service import (
    extract_file_paths,
    fetch_open_issues,
    normalize_issue,
)


# ── extract_file_paths ────────────────────────────────────────────────────────

def test_extract_file_paths_empty_text_returns_empty():
    assert extract_file_paths("") == []


def test_extract_file_paths_none_returns_empty():
    assert extract_file_paths(None) == []


def test_extract_file_paths_only_url_returns_empty():
    assert extract_file_paths("See https://github.com/owner/repo/blob/main/app.py") == []


def test_extract_file_paths_detects_typescript():
    result = extract_file_paths("Update frontend/src/App.tsx and src/api/client.ts")
    assert "frontend/src/App.tsx" in result
    assert "src/api/client.ts" in result


def test_extract_file_paths_detects_rust_and_go():
    result = extract_file_paths("Fix src/main.rs and cmd/server.go")
    assert "src/main.rs" in result
    assert "cmd/server.go" in result


def test_extract_file_paths_detects_yaml_and_toml():
    result = extract_file_paths("Update docker-compose.yml and pyproject.toml")
    assert "docker-compose.yml" in result
    assert "pyproject.toml" in result


def test_extract_file_paths_preserves_order_of_first_appearance():
    result = extract_file_paths("See b.py then a.py then b.py again")
    assert result == ["b.py", "a.py"]


def test_extract_file_paths_deduplicates_same_path():
    result = extract_file_paths("fix auth.py and auth.py again")
    assert result.count("auth.py") == 1


def test_extract_file_paths_no_files_returns_empty():
    assert extract_file_paths("Just some plain text without file references") == []


# ── normalize_issue ───────────────────────────────────────────────────────────

def test_normalize_issue_basic_shape():
    result = normalize_issue({
        "number": 42,
        "title": "Fix login",
        "body": "Auth is broken",
        "html_url": "https://github.com/owner/repo/issues/42",
        "labels": [{"name": "bug"}],
    })
    assert result["number"] == 42
    assert result["title"] == "Fix login"
    assert result["url"] == "https://github.com/owner/repo/issues/42"
    assert result["labels"] == ["bug"]


def test_normalize_issue_none_body_becomes_empty_string():
    result = normalize_issue({"number": 1, "title": "x", "body": None, "labels": []})
    assert result["body"] == ""


def test_normalize_issue_missing_html_url_is_none():
    result = normalize_issue({"number": 1, "title": "x", "body": "", "labels": []})
    assert result["url"] is None


def test_normalize_issue_string_labels_handled():
    result = normalize_issue({"number": 1, "title": "x", "body": "", "labels": ["bug", "help wanted"]})
    assert result["labels"] == ["bug", "help wanted"]


def test_normalize_issue_mixed_label_types():
    result = normalize_issue({
        "number": 1, "title": "x", "body": "",
        "labels": [{"name": "bug"}, "enhancement"],
    })
    assert result["labels"] == ["bug", "enhancement"]


def test_normalize_issue_no_files_in_text_gives_empty_list():
    result = normalize_issue({"number": 1, "title": "Update readme", "body": "No files here", "labels": []})
    assert result["files_affected"] == []


def test_normalize_issue_extracts_files_from_title_and_body():
    result = normalize_issue({
        "number": 1,
        "title": "Fix backend/auth.py",
        "body": "Also update tests/test_auth.py",
        "labels": [],
    })
    assert "backend/auth.py" in result["files_affected"]
    assert "tests/test_auth.py" in result["files_affected"]


# ── fetch_open_issues ─────────────────────────────────────────────────────────

def _mock_client(issues: list) -> SimpleNamespace:
    return SimpleNamespace(get_issues=AsyncMock(return_value=issues))


def test_fetch_open_issues_empty_repo_returns_empty():
    client = _mock_client([])
    result = asyncio.run(fetch_open_issues(client, "owner", "repo"))
    assert result == []


def test_fetch_open_issues_all_prs_returns_empty():
    client = _mock_client([
        {"number": 1, "state": "open", "title": "PR 1", "labels": [], "pull_request": {"url": "x"}},
        {"number": 2, "state": "open", "title": "PR 2", "labels": [], "pull_request": {"url": "y"}},
    ])
    result = asyncio.run(fetch_open_issues(client, "owner", "repo"))
    assert result == []


def test_fetch_open_issues_excludes_closed():
    client = _mock_client([
        {"number": 1, "state": "open", "title": "Open issue", "labels": []},
        {"number": 2, "state": "closed", "title": "Closed issue", "labels": []},
    ])
    result = asyncio.run(fetch_open_issues(client, "owner", "repo"))
    assert len(result) == 1
    assert result[0]["number"] == 1


def test_fetch_open_issues_calls_client_with_open_state():
    client = _mock_client([])
    asyncio.run(fetch_open_issues(client, "myorg", "myrepo"))
    client.get_issues.assert_awaited_once_with("myorg", "myrepo", state="open")


def test_fetch_open_issues_normalises_each_issue():
    client = _mock_client([
        {"number": 5, "state": "open", "title": "Bug in auth.py", "body": None, "labels": [{"name": "bug"}]},
    ])
    result = asyncio.run(fetch_open_issues(client, "owner", "repo"))
    assert result[0]["labels"] == ["bug"]
    assert result[0]["body"] == ""
    assert "auth.py" in result[0]["files_affected"]


def test_fetch_open_issues_keeps_all_valid_open_issues():
    client = _mock_client([
        {"number": i, "state": "open", "title": f"Issue {i}", "labels": []}
        for i in range(1, 6)
    ])
    result = asyncio.run(fetch_open_issues(client, "owner", "repo"))
    assert len(result) == 5
    assert [r["number"] for r in result] == [1, 2, 3, 4, 5]
