"""Tests for _run_pytest_cov() helper and test_coverage_pct in analyze task result."""
import asyncio
import json
import os
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch, mock_open

import pytest


# ---------------------------------------------------------------------------
# _run_pytest_cov unit tests
# ---------------------------------------------------------------------------

@pytest.fixture
def cov_function():
    """Import the private helper after environment is set up."""
    import importlib
    # Ensure the module has the right env for imports
    for key, value in {
        "DATABASE_URL": "postgresql+asyncpg://test:test@localhost/test",
        "SECRET_KEY": "test-secret",
        "GITHUB_CLIENT_ID": "test-client",
        "GITHUB_CLIENT_SECRET": "test-secret",
        "FRONTEND_URL": "http://localhost:5173",
    }.items():
        os.environ.setdefault(key, value)
    from backend.worker.tasks.analyze import _run_pytest_cov
    return _run_pytest_cov


def _make_proc(returncode: int = 0):
    proc = MagicMock()
    proc.wait = AsyncMock(return_value=returncode)
    return proc


def test_run_pytest_cov_returns_rounded_coverage(cov_function):
    """Happy path: subprocess exits 0 and coverage.json has a valid percentage."""
    cov_data = json.dumps({"totals": {"percent_covered": 83.7}})
    mock_proc = _make_proc(0)

    with (
        patch("backend.worker.tasks.analyze.asyncio.create_subprocess_exec", AsyncMock(return_value=mock_proc)),
        patch("backend.worker.tasks.analyze.asyncio.wait_for", AsyncMock(return_value=0)),
        patch("builtins.open", mock_open(read_data=cov_data)),
    ):
        result = asyncio.run(cov_function())

    assert result == 84  # round(83.7)


def test_run_pytest_cov_returns_zero_for_zero_coverage(cov_function):
    cov_data = json.dumps({"totals": {"percent_covered": 0.0}})
    mock_proc = _make_proc(0)

    with (
        patch("backend.worker.tasks.analyze.asyncio.create_subprocess_exec", AsyncMock(return_value=mock_proc)),
        patch("backend.worker.tasks.analyze.asyncio.wait_for", AsyncMock(return_value=0)),
        patch("builtins.open", mock_open(read_data=cov_data)),
    ):
        result = asyncio.run(cov_function())

    assert result == 0


def test_run_pytest_cov_returns_none_when_subprocess_raises(cov_function):
    """If subprocess creation fails, return None (don't crash the analysis)."""
    with patch(
        "backend.worker.tasks.analyze.asyncio.create_subprocess_exec",
        AsyncMock(side_effect=OSError("pytest not found")),
    ):
        result = asyncio.run(cov_function())

    assert result is None


def test_run_pytest_cov_returns_none_on_timeout(cov_function):
    """If pytest takes too long (TimeoutError), return None."""
    mock_proc = _make_proc(0)
    with (
        patch("backend.worker.tasks.analyze.asyncio.create_subprocess_exec", AsyncMock(return_value=mock_proc)),
        patch("backend.worker.tasks.analyze.asyncio.wait_for", AsyncMock(side_effect=asyncio.TimeoutError())),
    ):
        result = asyncio.run(cov_function())

    assert result is None


def test_run_pytest_cov_returns_none_when_coverage_json_missing(cov_function):
    """If coverage.json doesn't exist after the run, return None."""
    mock_proc = _make_proc(0)
    with (
        patch("backend.worker.tasks.analyze.asyncio.create_subprocess_exec", AsyncMock(return_value=mock_proc)),
        patch("backend.worker.tasks.analyze.asyncio.wait_for", AsyncMock(return_value=0)),
        patch("builtins.open", side_effect=FileNotFoundError("coverage.json not found")),
    ):
        result = asyncio.run(cov_function())

    assert result is None


def test_run_pytest_cov_returns_none_on_malformed_json(cov_function):
    """If coverage.json has invalid content, return None."""
    mock_proc = _make_proc(0)
    with (
        patch("backend.worker.tasks.analyze.asyncio.create_subprocess_exec", AsyncMock(return_value=mock_proc)),
        patch("backend.worker.tasks.analyze.asyncio.wait_for", AsyncMock(return_value=0)),
        patch("builtins.open", mock_open(read_data="{{{not json")),
    ):
        result = asyncio.run(cov_function())

    assert result is None


# ---------------------------------------------------------------------------
# test_file_count and test_coverage_pct in the analyze_repository result dict
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_analysis_env(monkeypatch):
    """Set up env vars needed to import backend.worker.tasks.analyze."""
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


def _make_github_client(tree: list, repo_data: dict, issues: list | None = None, prs: list | None = None):
    """Return a mock async context-manager that acts as GitHubClient."""
    client = MagicMock()
    client.get_repo = AsyncMock(return_value=repo_data)
    client.get_file_tree = AsyncMock(return_value=tree)
    client.get_issues = AsyncMock(return_value=issues or [])
    client.get_pull_requests = AsyncMock(return_value=prs or [])

    ctx = MagicMock()
    ctx.__aenter__ = AsyncMock(return_value=client)
    ctx.__aexit__ = AsyncMock(return_value=False)
    return ctx


def _repo_data(**kwargs) -> dict:
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
    """analyze_repository result dict must include test_file_count and test_coverage_pct."""
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
        patch("backend.worker.tasks.analyze._run_pytest_cov", AsyncMock(return_value=84)),
        patch("backend.worker.tasks.analyze.AsyncSessionLocal", MagicMock()),
        patch("backend.worker.tasks.analyze.detect_tech_stack", return_value=["Python"]),
        patch("backend.worker.tasks.analyze.map_directories", return_value=[]),
        patch("sqlalchemy.dialects.postgresql.insert", MagicMock()),
        patch("backend.worker.tasks.embed_repo.embed_repository.kiq", AsyncMock()),
        patch("backend.worker.tasks.score_issues.score_issues.kiq", AsyncMock()),
    ):
        result = asyncio.run(analyze_repository("test", "repo"))

    assert "test_file_count" in result
    assert result["test_file_count"] == 2  # 2 test files in tree
    assert "test_coverage_pct" in result
    assert result["test_coverage_pct"] == 84


def test_result_has_none_coverage_when_pytest_cov_fails(mock_analysis_env):
    """When _run_pytest_cov returns None, test_coverage_pct should be None in result."""
    from backend.worker.tasks.analyze import analyze_repository

    tree = [{"type": "blob", "path": "app.py"}]
    repo = _repo_data()
    ctx = _make_github_client(tree, repo)

    with (
        patch("backend.worker.tasks.analyze.GitHubClient", return_value=ctx),
        patch("backend.worker.tasks.analyze.get_cached_analysis", AsyncMock(return_value=None)),
        patch("backend.worker.tasks.analyze.set_cached_analysis", AsyncMock()),
        patch("backend.worker.tasks.analyze._run_pytest_cov", AsyncMock(return_value=None)),
        patch("backend.worker.tasks.analyze.AsyncSessionLocal", MagicMock()),
        patch("backend.worker.tasks.analyze.detect_tech_stack", return_value=["Python"]),
        patch("backend.worker.tasks.analyze.map_directories", return_value=[]),
        patch("sqlalchemy.dialects.postgresql.insert", MagicMock()),
        patch("backend.worker.tasks.embed_repo.embed_repository.kiq", AsyncMock()),
        patch("backend.worker.tasks.score_issues.score_issues.kiq", AsyncMock()),
    ):
        result = asyncio.run(analyze_repository("test", "repo"))

    assert result["test_coverage_pct"] is None


def test_test_file_count_zero_when_no_test_files(mock_analysis_env):
    """test_file_count should be 0 when the repo has no test files."""
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
        patch("backend.worker.tasks.analyze._run_pytest_cov", AsyncMock(return_value=None)),
        patch("backend.worker.tasks.analyze.AsyncSessionLocal", MagicMock()),
        patch("backend.worker.tasks.analyze.detect_tech_stack", return_value=["Python"]),
        patch("backend.worker.tasks.analyze.map_directories", return_value=[]),
        patch("sqlalchemy.dialects.postgresql.insert", MagicMock()),
        patch("backend.worker.tasks.embed_repo.embed_repository.kiq", AsyncMock()),
        patch("backend.worker.tasks.score_issues.score_issues.kiq", AsyncMock()),
    ):
        result = asyncio.run(analyze_repository("test", "repo"))

    assert result["test_file_count"] == 0


def test_test_file_count_detects_various_patterns(mock_analysis_env):
    """test_file_count should count files matching /test, .test., .spec., __tests__."""
    from backend.worker.tasks.analyze import analyze_repository

    tree = [
        {"type": "blob", "path": "tests/test_foo.py"},            # /test prefix
        {"type": "blob", "path": "src/button.test.ts"},           # .test.
        {"type": "blob", "path": "src/util.spec.ts"},             # .spec.
        {"type": "blob", "path": "src/__tests__/helper.ts"},      # __tests__
        {"type": "blob", "path": "test_root.py"},                 # startswith test
        {"type": "blob", "path": "src/app.py"},                   # not a test file
    ]
    repo = _repo_data()
    ctx = _make_github_client(tree, repo)

    with (
        patch("backend.worker.tasks.analyze.GitHubClient", return_value=ctx),
        patch("backend.worker.tasks.analyze.get_cached_analysis", AsyncMock(return_value=None)),
        patch("backend.worker.tasks.analyze.set_cached_analysis", AsyncMock()),
        patch("backend.worker.tasks.analyze._run_pytest_cov", AsyncMock(return_value=None)),
        patch("backend.worker.tasks.analyze.AsyncSessionLocal", MagicMock()),
        patch("backend.worker.tasks.analyze.detect_tech_stack", return_value=["Python"]),
        patch("backend.worker.tasks.analyze.map_directories", return_value=[]),
        patch("sqlalchemy.dialects.postgresql.insert", MagicMock()),
        patch("backend.worker.tasks.embed_repo.embed_repository.kiq", AsyncMock()),
        patch("backend.worker.tasks.score_issues.score_issues.kiq", AsyncMock()),
    ):
        result = asyncio.run(analyze_repository("test", "repo"))

    assert result["test_file_count"] == 5
