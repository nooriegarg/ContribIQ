"""
Async GitHub API client for ContribIQ.

Wraps gidgethub for REST and GraphQL calls. All methods share one httpx.AsyncClient
per instance so connections are reused across calls in the same request lifecycle.
"""

import logging
from typing import Any
from urllib.parse import quote

import httpx
from gidgethub.httpx import GitHubAPI

logger = logging.getLogger(__name__)


class GitHubRateLimitError(httpx.HTTPStatusError):
    """Expose GitHub's retry metadata without hiding the failed response."""

    def __init__(self, response: httpx.Response) -> None:
        self.reset_at = response.headers.get("X-RateLimit-Reset")
        self.retry_after = response.headers.get("Retry-After")
        super().__init__(
            "GitHub API rate limit exceeded",
            request=response.request,
            response=response,
        )


class GitHubClient:
    def __init__(self, token: str | None = None) -> None:
        self._token = token
        self._http = httpx.AsyncClient(
            headers={
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            timeout=30.0,
        )
        self._gh = GitHubAPI(self._http, "ContribIQ", oauth_token=self._token)

    async def _check_response(self, response: httpx.Response) -> None:
        remaining = response.headers.get("X-RateLimit-Remaining")
        reset_at = response.headers.get("X-RateLimit-Reset")
        if remaining is not None:
            logger.debug("GitHub rate limit: %s remaining, resets at %s", remaining, reset_at)
        if response.status_code == 429 or (
            response.status_code == 403
            and (remaining == "0" or "Retry-After" in response.headers)
        ):
            logger.warning("GitHub API rate limited; resets at %s", reset_at)
            raise GitHubRateLimitError(response)
        response.raise_for_status()

    async def _get_with_retry(self, url: str, **kwargs) -> httpx.Response:
        for attempt in range(3):
            try:
                return await self._http.get(url, **kwargs)
            except httpx.RemoteProtocolError:
                if attempt == 2:
                    raise
        raise RuntimeError("unreachable")

    async def get_repo(self, owner: str, name: str) -> dict[str, Any]:
        response = await self._get_with_retry(
            f"https://api.github.com/repos/{owner}/{name}",
            headers=self._auth_headers(),
        )
        await self._check_response(response)
        return response.json()

    async def get_file_tree(self, owner: str, name: str, sha: str) -> list[dict[str, Any]]:
        response = await self._get_with_retry(
            f"https://api.github.com/repos/{owner}/{name}/git/trees/{sha}",
            params={"recursive": "1"},
            headers=self._auth_headers(),
        )
        await self._check_response(response)
        return response.json().get("tree", [])

    async def get_issues(
        self, owner: str, name: str, state: str = "open"
    ) -> list[dict[str, Any]]:
        issues: list[dict[str, Any]] = []
        page = 1
        while True:
            response = await self._http.get(
                f"https://api.github.com/repos/{owner}/{name}/issues",
                params={"state": state, "per_page": 100, "page": page},
                headers=self._auth_headers(),
            )
            await self._check_response(response)
            issues.extend(response.json())
            if "next" not in response.links:
                return issues
            page += 1

    async def get_file_content(
        self, owner: str, name: str, path: str, ref: str | None = None
    ) -> str | None:
        response = await self._http.get(
            f"https://api.github.com/repos/{owner}/{name}/contents/{quote(path, safe='/')}",
            params={"ref": ref} if ref else None,
            headers={**self._auth_headers(), "Accept": "application/vnd.github.raw+json"},
        )
        if response.status_code == 404:
            return None
        await self._check_response(response)
        return response.text

    async def get_pull_requests(
        self, owner: str, name: str, state: str = "closed"
    ) -> list[dict[str, Any]]:
        response = await self._http.get(
            f"https://api.github.com/repos/{owner}/{name}/pulls",
            params={"state": state, "per_page": 100},
            headers=self._auth_headers(),
        )
        await self._check_response(response)
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
        await self._check_response(response)

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
