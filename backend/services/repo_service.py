"""
Repository metadata fetching and persistence service.

Intentional bug: gidgethub.BadRequest (raised when GitHub returns 404 for a private
or non-existent repo) is not caught here. The exception propagates through the route
handler and FastAPI returns 500 Internal Server Error to the caller.
Issue to raise: "Private/missing repo causes unhandled 500 — should return friendly 404 message"
Fix: Catch gidgethub.BadRequest and raise HTTPException(404, "Repository not found or is private").
"""

import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.repository import Repository
from backend.services.github_client import GitHubClient

logger = logging.getLogger(__name__)


async def fetch_and_store_metadata(
    owner: str,
    repo_name: str,
    db: AsyncSession,
    github_token: str | None = None,
) -> Repository:
    async with GitHubClient(token=github_token) as client:
        # Bug: gidgethub.BadRequest from a private/missing repo is not caught here
        data = await client.get_repo(owner, repo_name)

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
