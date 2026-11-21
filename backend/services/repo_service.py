import logging
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.repository import Repository
from backend.services.github_client import GitHubClient, GitHubRateLimitError

logger = logging.getLogger(__name__)


async def fetch_and_store_metadata(
    owner: str,
    repo_name: str,
    db: AsyncSession,
    github_token: str | None = None,
) -> Repository:
    try:
        async with GitHubClient(token=github_token) as client:
            data = await client.get_repo(owner, repo_name)
    except GitHubRateLimitError:
        # Keep rate-limit metadata available to callers that handle retries.
        raise
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code
        if status_code in (403, 404):
            # GitHub intentionally returns 404 for private repositories that
            # the authenticated user is not allowed to access.
            raise HTTPException(
                status_code=404,
                detail="Repository not found or you do not have permission to access it.",
            ) from exc
        if status_code == 401:
            raise HTTPException(
                status_code=401,
                detail="GitHub authentication failed. Reconnect your GitHub account and try again.",
            ) from exc

        logger.warning(
            "GitHub returned HTTP %s while fetching metadata for %s/%s",
            status_code,
            owner,
            repo_name,
            exc_info=True,
        )
        raise HTTPException(
            status_code=502,
            detail="GitHub could not retrieve repository metadata. Please try again.",
        ) from exc

    full_name = data["full_name"]

    result = await db.execute(
        select(Repository).where(Repository.full_name == full_name)
    )
    repo = result.scalar_one_or_none()

    if repo is None:
        repo = Repository()
        db.add(repo)

    repo.owner = data["owner"]["login"]
    repo.name = data["name"]
    repo.full_name = full_name
    repo.description = data.get("description")
    repo.stars = data.get("stargazers_count", 0)
    repo.forks = data.get("forks_count", 0)
    repo.open_issues = data.get("open_issues_count", 0)
    repo.language = data.get("language")
    repo.topics = data.get("topics", [])
    repo.default_branch = data.get("default_branch", "main")

    default_branch = repo.default_branch
    branch_data = await _fetch_branch_sha(owner, repo_name, default_branch, github_token)
    repo.latest_sha = branch_data

    repo.last_analyzed = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(repo)
    return repo


async def _fetch_branch_sha(
    owner: str,
    repo_name: str,
    branch: str,
    github_token: str | None,
) -> str | None:
    headers: dict[str, str] = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if github_token:
        headers["Authorization"] = f"Bearer {github_token}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as http:
            response = await http.get(
                f"https://api.github.com/repos/{owner}/{repo_name}/branches/{branch}",
                headers=headers,
            )
            response.raise_for_status()
            return response.json()["commit"]["sha"]
    except Exception:
        logger.warning("Could not fetch branch SHA for %s/%s", owner, repo_name, exc_info=True)
        return None
