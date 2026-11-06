"""
Async GitHub API client for ContribIQ.

Wraps gidgethub for REST and GraphQL calls. All methods share one httpx.AsyncClient
per instance so connections are reused across calls in the same request lifecycle.

Intentional bug: rate limit headers are read and logged after every response, but
the remaining count is never checked. When quota reaches 0, GitHub returns HTTP 403
and this client raises an unhandled httpx.HTTPStatusError.
Issue to raise: "GitHub API client ignores rate limit headers — quota exhaustion causes unhandled 403s"
Fix: raise RateLimitError(reset_at=...) when remaining < 10 so the task queue can reschedule.
"""

import logging
from typing import Any

import httpx
from gidgethub.httpx import GitHubAPI

from backend.core.config import get_settings

logger = logging.getLogger(__name__)


class GitHubClient:
    def __init__(self, token: str | None = None) -> None:
        settings = get_settings()
        self._token = token
        self._http = httpx.AsyncClient(
            headers={
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            timeout=30.0,
        )
        self._gh = GitHubAPI(self._http, "ContribIQ", oauth_token=self._token)

    async def _log_rate_limit(self, response: httpx.Response) -> None:
        remaining = response.headers.get("X-RateLimit-Remaining")
        reset_at = response.headers.get("X-RateLimit-Reset")
        if remaining is not None:
            # Bug: only logs — never raises when remaining == 0
            logger.debug("GitHub rate limit: %s remaining, resets at %s", remaining, reset_at)

    async def get_repo(self, owner: str, name: str) -> dict[str, Any]:
        response = await self._http.get(
            f"https://api.github.com/repos/{owner}/{name}",
            headers=self._auth_headers(),
        )
        response.raise_for_status()
        await self._log_rate_limit(response)
        return response.json()

    async def get_file_tree(self, owner: str, name: str, sha: str) -> list[dict[str, Any]]:
        response = await self._http.get(
            f"https://api.github.com/repos/{owner}/{name}/git/trees/{sha}",
            params={"recursive": "1"},
            headers=self._auth_headers(),
        )
        response.raise_for_status()
        await self._log_rate_limit(response)
        return response.json().get("tree", [])

    async def get_issues(
        self, owner: str, name: str, state: str = "open"
    ) -> list[dict[str, Any]]:
        response = await self._http.get(
            f"https://api.github.com/repos/{owner}/{name}/issues",
            params={"state": state, "per_page": 100},
            headers=self._auth_headers(),
        )
        response.raise_for_status()
        await self._log_rate_limit(response)
        return response.json()

    async def get_pull_requests(
        self, owner: str, name: str, state: str = "closed"
    ) -> list[dict[str, Any]]:
        response = await self._http.get(
            f"https://api.github.com/repos/{owner}/{name}/pulls",
            params={"state": state, "per_page": 100},
            headers=self._auth_headers(),
        )
        response.raise_for_status()
        await self._log_rate_limit(response)
        return response.json()

    async def graphql(self, query: str, variables: dict[str, Any] | None = None) -> dict[str, Any]:
        payload: dict[str, Any] = {"query": query}
        if variables:
            payload["variables"] = variables

        response = await self._http.post(
            "https://api.github.com/graphql",
            json=payload,
            headers={**self._auth_headers(), "Content-Type": "application/json"},
        )
        response.raise_for_status()
        await self._log_rate_limit(response)

        data = response.json()
        if "errors" in data:
            raise ValueError(f"GraphQL errors: {data['errors']}")
        return data.get("data", {})

    def _auth_headers(self) -> dict[str, str]:
        if self._token:
            return {"Authorization": f"Bearer {self._token}"}
        return {}

    async def aclose(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> "GitHubClient":
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.aclose()


REPO_ANALYSIS_QUERY = """
query RepoAnalysis($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    description
    stargazerCount
    forkCount
    issues(first: 50, states: OPEN) {
      nodes {
        number
        title
        body
        labels {
          nodes { name }
        }
      }
    }
    defaultBranchRef {
      target {
        ... on Commit {
          oid
          tree {
            entries { name type }
          }
        }
      }
    }
  }
}
"""
