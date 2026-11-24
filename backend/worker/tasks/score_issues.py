import logging
from typing import Any

from sqlalchemy import delete, func
from sqlalchemy.dialects.postgresql import insert

from backend.core.config import get_settings
from backend.db.session import AsyncSessionLocal
from backend.models.issue import Issue
from backend.services.difficulty_service import score_issue
from backend.services.github_client import GitHubClient
from backend.services.issues_service import fetch_open_issues
from backend.worker.broker import broker

logger = logging.getLogger(__name__)

MAX_SOURCE_FILES = 5
MAX_SOURCE_BYTES = 200_000


async def _load_sources(
    client: GitHubClient, owner: str, repo_name: str, paths: list[str], known_paths: set[str]
) -> dict[str, str]:
    sources: dict[str, str] = {}
    candidates = [
        p for p in paths if p.endswith(".py") and (not known_paths or p in known_paths)
    ]
    for path in candidates[:MAX_SOURCE_FILES]:
        content = await client.get_file_content(owner, repo_name, path)
        if content is None:
            logger.warning("Source file not found: %s/%s:%s", owner, repo_name, path)
            continue
        if len(content.encode("utf-8")) > MAX_SOURCE_BYTES:
            logger.warning("Source file exceeds scoring size limit: %s/%s:%s", owner, repo_name, path)
            continue
        sources[path] = content
    return sources


@broker.task
async def score_issues(
    owner: str,
    repo_name: str,
    github_token: str | None = None,
    file_paths: list[str] | None = None,
) -> dict[str, Any]:
    full_name = f"{owner}/{repo_name}"
    known_paths = set(file_paths or [])

    async with GitHubClient(token=github_token or get_settings().GITHUB_TOKEN) as client:
        issues = await fetch_open_issues(client, owner, repo_name)
        rows: list[dict[str, Any]] = []
        for issue in issues:
            sources = await _load_sources(
                client, owner, repo_name, issue["files_affected"], known_paths
            )
            scored = score_issue(issue, sources)
            rows.append({"repo_full_name": full_name, **issue, **scored})

    async with AsyncSessionLocal() as session:
        if rows:
            stmt = insert(Issue).values(rows)
            updates = {
                col: stmt.excluded[col]
                for col in (
                    "title", "body", "url", "labels", "files_affected",
                    "difficulty", "difficulty_factors", "estimated_hours",
                )
            }
            updates["scored_at"] = func.now()
            stmt = stmt.on_conflict_do_update(
                constraint="uq_issues_repo_number", set_=updates
            )
            await session.execute(stmt)
        await session.execute(
            delete(Issue).where(
                Issue.repo_full_name == full_name,
                Issue.number.not_in([issue["number"] for issue in issues]),
            )
        )
        await session.commit()

    return {"repo": full_name, "status": "completed", "scored": len(rows)}
