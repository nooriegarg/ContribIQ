"""Tests for _estimate_test_coverage() helper and test_coverage_pct in analyze task result."""
import asyncio
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# _estimate_test_coverage unit tests
# ---------------------------------------------------------------------------

@pytest.fixture
def estimate_coverage():
    for key, value in {
        "DATABASE_URL": "postgresql+asyncpg://test:test@localhost/test",
        "SECRET_KEY": "test-secret",
        "GITHUB_CLIENT_ID": "test-client",
        "GITHUB_CLIENT_SECRET": "test-secret",
        "FRONTEND_URL": "http://localhost:5173",
    }.items():
        os.environ.setdefault(key, value)
    from backend.worker.tasks.analyze import _estimate_test_coverage
    return _estimate_test_coverage


def test_estimate_returns_ratio_as_percent(estimate_coverage):
    # 2 test files matching 2 of 10 source files = 2/10 = 20%
    assert estimate_coverage(["test_a.py", "test_b.py"], ["a.py", "b.py", "c.py", "d.py", "e.py", "f.py", "g.py", "h.py", "i.py", "j.py"]) == 20


def test_estimate_rounds_result(estimate_coverage):
    # 1 matched + 1 unmatched*2 = 3 covered out of 7 = 43%
    assert estimate_coverage(["test_a.py", "test_unrelated.py"], ["a.py", "b.py", "c.py", "d.py", "e.py", "f.py", "g.py"]) == 43


def test_estimate_caps_at_100(estimate_coverage):
    # Many test files covering few source files shouldn't exceed 100%
    assert estimate_coverage(["test_a.py", "test_b.py", "test_c.py", "test_x.py", "test_y.py",
                               "test_z.py", "test_m.py", "test_n.py", "test_o.py", "test_p.py"],
                              ["a.py", "b.py", "c.py", "d.py", "e.py"]) == 100


def test_estimate_returns_none_when_no_source_files(estimate_coverage):
    assert estimate_coverage([], []) is None


def test_estimate_returns_zero_when_no_test_files(estimate_coverage):
    assert estimate_coverage([], ["a.py", "b.py"]) == 0


# ---------------------------------------------------------------------------
# test_file_count and test_coverage_pct in the analyze_repository result dict
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_analysis_env(monkeypatch):
    for key, value in {
        "DATABASE_URL": "postgresql+asyncpg://test:test@localhost/test",
        "SECRET_KEY": "test-secret",
        "GITHUB_CLIENT_ID": "test-client",
        "GITHUB_CLIENT_SECRET": "test-secret",
        "FRONTEND_URL": "http://localhost:5173",
    }.items():
        monkeypatch.setenv(key, value)
    from backend.core.config import get_settings
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _make_github_client(tree, repo_data, issues=None, prs=None):
    client = MagicMock()
    client.get_repo = AsyncMock(return_value=repo_data)
    client.get_file_tree = AsyncMock(return_value=tree)
    client.get_issues = AsyncMock(return_value=issues or [])
    client.get_pull_requests = AsyncMock(return_value=prs or [])
    ctx = MagicMock()
    ctx.__aenter__ = AsyncMock(return_value=client)
    ctx.__aexit__ = AsyncMock(return_value=False)
    return ctx


def _repo_data(**kwargs):
    base = {
        "stargazers_count": 100,
        "forks_count": 10,
        "open_issues_count": 5,
        "language": "Python",
        "topics": [],
        "description": "Test repo",
        "full_name": "test/repo",
        "pushed_at": "2024-01-01T00:00:00Z",
        "default_branch": "main",
    }
    base.update(kwargs)
    return base


def test_result_includes_test_file_count_and_coverage_pct(mock_analysis_env):
    """analyze_repository result must include test_file_count and test_coverage_pct."""
    from backend.worker.tasks.analyze import analyze_repository

    tree = [
        {"type": "blob", "path": "backend/app.py"},
        {"type": "blob", "path": "backend/tests/test_app.py"},
        {"type": "blob", "path": "backend/tests/test_service.py"},
    ]
    repo = _repo_data()
    ctx = _make_github_client(tree, repo)

    with (
        patch("backend.worker.tasks.analyze.GitHubClient", return_value=ctx),
        patch("backend.worker.tasks.analyze.get_cached_analysis", AsyncMock(return_value=None)),
        patch("backend.worker.tasks.analyze.set_cached_analysis", AsyncMock()),
        patch("backend.worker.tasks.analyze.AsyncSessionLocal", MagicMock()),
        patch("backend.worker.tasks.analyze.detect_tech_stack", return_value=["Python"]),
        patch("backend.worker.tasks.analyze.map_directories", return_value=[]),
        patch("sqlalchemy.dialects.postgresql.insert", MagicMock()),
        patch("backend.worker.tasks.embed_repo.embed_repository.kiq", AsyncMock()),
        patch("backend.worker.tasks.score_issues.score_issues.kiq", AsyncMock()),
    ):
        result = asyncio.run(analyze_repository("test", "repo"))

    assert "test_file_count" in result
    assert result["test_file_count"] == 2
    assert "test_coverage_pct" in result
    # 2 test files / 1 non-test source file = 200% → capped at 100%
    assert result["test_coverage_pct"] == 100


def test_result_has_none_coverage_when_no_source_files(mock_analysis_env):
    """test_coverage_pct should be None when there are no source files."""
    from backend.worker.tasks.analyze import analyze_repository

    tree = [{"type": "tree", "path": "docs"}]  # no blobs with source extensions
    repo = _repo_data()
    ctx = _make_github_client(tree, repo)

    with (
        patch("backend.worker.tasks.analyze.GitHubClient", return_value=ctx),
        patch("backend.worker.tasks.analyze.get_cached_analysis", AsyncMock(return_value=None)),
        patch("backend.worker.tasks.analyze.set_cached_analysis", AsyncMock()),
        patch("backend.worker.tasks.analyze.AsyncSessionLocal", MagicMock()),
        patch("backend.worker.tasks.analyze.detect_tech_stack", return_value=[]),
        patch("backend.worker.tasks.analyze.map_directories", return_value=[]),
        patch("sqlalchemy.dialects.postgresql.insert", MagicMock()),
        patch("backend.worker.tasks.embed_repo.embed_repository.kiq", AsyncMock()),
        patch("backend.worker.tasks.score_issues.score_issues.kiq", AsyncMock()),
    ):
        result = asyncio.run(analyze_repository("test", "repo"))

    assert result["test_coverage_pct"] is None


def test_test_file_count_zero_when_no_test_files(mock_analysis_env):
    from backend.worker.tasks.analyze import analyze_repository

    tree = [
        {"type": "blob", "path": "src/main.py"},
        {"type": "blob", "path": "src/utils.py"},
    ]
    repo = _repo_data()
    ctx = _make_github_client(tree, repo)

    with (
        patch("backend.worker.tasks.analyze.GitHubClient", return_value=ctx),
        patch("backend.worker.tasks.analyze.get_cached_analysis", AsyncMock(return_value=None)),
        patch("backend.worker.tasks.analyze.set_cached_analysis", AsyncMock()),
        patch("backend.worker.tasks.analyze.AsyncSessionLocal", MagicMock()),
        patch("backend.worker.tasks.analyze.detect_tech_stack", return_value=["Python"]),
        patch("backend.worker.tasks.analyze.map_directories", return_value=[]),
        patch("sqlalchemy.dialects.postgresql.insert", MagicMock()),
        patch("backend.worker.tasks.embed_repo.embed_repository.kiq", AsyncMock()),
        patch("backend.worker.tasks.score_issues.score_issues.kiq", AsyncMock()),
    ):
        result = asyncio.run(analyze_repository("test", "repo"))

    assert result["test_file_count"] == 0
    assert result["test_coverage_pct"] == 0


def test_test_file_count_detects_various_patterns(mock_analysis_env):
    """test_file_count should count files matching /test, .test., .spec., __tests__."""
    from backend.worker.tasks.analyze import analyze_repository

    tree = [
        {"type": "blob", "path": "tests/test_foo.py"},
        {"type": "blob", "path": "src/button.test.ts"},
        {"type": "blob", "path": "src/util.spec.ts"},
        {"type": "blob", "path": "src/__tests__/helper.ts"},
        {"type": "blob", "path": "test_root.py"},
        {"type": "blob", "path": "src/app.py"},
    ]
    repo = _repo_data()
    ctx = _make_github_client(tree, repo)

    with (
        patch("backend.worker.tasks.analyze.GitHubClient", return_value=ctx),
        patch("backend.worker.tasks.analyze.get_cached_analysis", AsyncMock(return_value=None)),
        patch("backend.worker.tasks.analyze.set_cached_analysis", AsyncMock()),
        patch("backend.worker.tasks.analyze.AsyncSessionLocal", MagicMock()),
        patch("backend.worker.tasks.analyze.detect_tech_stack", return_value=["Python"]),
        patch("backend.worker.tasks.analyze.map_directories", return_value=[]),
        patch("sqlalchemy.dialects.postgresql.insert", MagicMock()),
        patch("backend.worker.tasks.embed_repo.embed_repository.kiq", AsyncMock()),
        patch("backend.worker.tasks.score_issues.score_issues.kiq", AsyncMock()),
    ):
        result = asyncio.run(analyze_repository("test", "repo"))

    assert result["test_file_count"] == 5
