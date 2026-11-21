import asyncio
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import HTTPException

from backend.services import repo_service
from backend.services.github_client import GitHubRateLimitError


class FailingGitHubClient:
    def __init__(self, error):
        self.error = error

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return None

    async def get_repo(self, owner, repo_name):
        raise self.error


def _http_error(status_code, headers=None):
    request = httpx.Request("GET", "https://api.github.com/repos/owner/repo")
    response = httpx.Response(status_code, headers=headers, request=request)
    return httpx.HTTPStatusError("GitHub request failed", request=request, response=response)


@pytest.mark.parametrize("status_code", [403, 404])
def test_inaccessible_or_missing_repository_returns_non_disclosing_404(monkeypatch, status_code):
    error = _http_error(status_code)
    monkeypatch.setattr(
        repo_service,
        "GitHubClient",
        lambda **kwargs: FailingGitHubClient(error),
    )
    db = AsyncMock()

    with pytest.raises(HTTPException) as exc:
        asyncio.run(repo_service.fetch_and_store_metadata("owner", "repo", db))

    assert exc.value.status_code == 404
    assert "not found or you do not have permission" in exc.value.detail.lower()
    db.execute.assert_not_awaited()
    db.commit.assert_not_awaited()


def test_unauthorized_github_request_returns_401(monkeypatch):
    error = _http_error(401)
    monkeypatch.setattr(
        repo_service,
        "GitHubClient",
        lambda **kwargs: FailingGitHubClient(error),
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(repo_service.fetch_and_store_metadata("owner", "repo", AsyncMock()))

    assert exc.value.status_code == 401
    assert "authentication failed" in exc.value.detail.lower()


def test_unexpected_github_status_returns_sanitized_502(monkeypatch):
    error = _http_error(500)
    monkeypatch.setattr(
        repo_service,
        "GitHubClient",
        lambda **kwargs: FailingGitHubClient(error),
    )

    with pytest.raises(HTTPException) as exc:
        asyncio.run(repo_service.fetch_and_store_metadata("owner", "repo", AsyncMock()))

    assert exc.value.status_code == 502
    assert exc.value.detail == "GitHub could not retrieve repository metadata. Please try again."
    assert "GitHub request failed" not in exc.value.detail


def test_rate_limit_error_is_preserved_for_retry_handling(monkeypatch):
    response_error = _http_error(403, {"X-RateLimit-Remaining": "0", "X-RateLimit-Reset": "123"})
    error = GitHubRateLimitError(response_error.response)
    monkeypatch.setattr(
        repo_service,
        "GitHubClient",
        lambda **kwargs: FailingGitHubClient(error),
    )

    with pytest.raises(GitHubRateLimitError) as exc:
        asyncio.run(repo_service.fetch_and_store_metadata("owner", "repo", AsyncMock()))

    assert exc.value.reset_at == "123"
