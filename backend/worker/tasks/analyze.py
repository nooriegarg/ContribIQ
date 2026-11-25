import logging
import uuid
import json
from typing import Any

from sqlalchemy.dialects.postgresql import insert

from backend.core.config import get_settings
from backend.db.session import AsyncSessionLocal
from backend.models.repository import Repository
from backend.services.cache_service import get_cached_analysis, set_cached_analysis
from backend.services.github_client import GitHubClient
from backend.services.tech_stack_service import detect_tech_stack, map_directories
from backend.worker.broker import broker

logger = logging.getLogger(__name__)

def _estimate_test_coverage(test_file_count: int, total_source: int) -> int | None:
    """Estimate test coverage as a ratio of test files to source files (capped at 100)."""
    if total_source == 0:
        return None
    return min(100, round((test_file_count / total_source) * 100))

@broker.task
async def analyze_repository(owner: str, repo_name: str, github_token: str | None = None) -> dict[str, Any]:
    steps: list[dict[str, Any]] = []

    def _emit(step: str, status: str, data: Any = None) -> None:
        event = {"step": step, "status": status, "data": data}
        steps.append(event)
        logger.info("Analysis [%s/%s] %s: %s", owner, repo_name, step, status)

    async with GitHubClient(token=github_token or get_settings().GITHUB_TOKEN) as client:
        _emit("metadata", "started")
        try:
            repo_data = await client.get_repo(owner, repo_name)
            _emit("metadata", "done", {"stars": repo_data.get("stargazers_count"), "forks": repo_data.get("forks_count")})
        except Exception as exc:
            _emit("metadata", "error", {"error": str(exc)})
            return {"owner": owner, "repo": repo_name, "status": "failed", "steps": steps}

        latest_sha = repo_data.get("pushed_at", "")[:10].replace("-", "")

        cached = await get_cached_analysis(owner, repo_name, latest_sha)
        if cached is not None:
            logger.info("Cache hit for %s/%s@%s", owner, repo_name, latest_sha)
            # Still ensure the repository row + embedding exist even on cache hits
            try:
                from backend.worker.tasks.embed_repo import embed_repository
                async with AsyncSessionLocal() as session:
                    from sqlalchemy import select as sa_select
                    row = await session.execute(
                        sa_select(Repository).where(Repository.full_name == f"{owner}/{repo_name}")
                    )
                    existing = row.scalar_one_or_none()
                    if existing is None:
                        stmt = (
                            insert(Repository)
                            .values(
                                id=uuid.uuid4(),
                                owner=owner,
                                name=repo_name,
                                full_name=f"{owner}/{repo_name}",
                                description=repo_data.get("description"),
                                stars=repo_data.get("stargazers_count", 0),
                                forks=repo_data.get("forks_count", 0),
                                open_issues=repo_data.get("open_issues_count", 0),
                                language=repo_data.get("language"),
                                topics=repo_data.get("topics", []),
                                default_branch=repo_data.get("default_branch", "main"),
                                latest_sha=latest_sha,
                            )
                            .returning(Repository.id)
                        )
                        result_row = await session.execute(stmt)
                        actual_repo_id = result_row.scalar_one()
                        await session.commit()
                        await embed_repository.kiq(
                            repo_id=str(actual_repo_id),
                            owner=owner,
                            repo_name=repo_name,
                            file_tree=cached.get("file_tree", []),
                        )
            except Exception:
                logger.exception("Could not ensure embedding for cached %s/%s", owner, repo_name)
            return cached

        _emit("file_tree", "started")
        try:
            default_branch = repo_data.get("default_branch", "main")
            tree = await client.get_file_tree(owner, repo_name, default_branch)
            _emit("file_tree", "done", {"file_count": len(tree)})
        except Exception as exc:
            _emit("file_tree", "error", {"error": str(exc)})
            tree = []

        _emit("tech_stack", "started")
        try:
            tech_stack = detect_tech_stack(tree)
            directory_map = map_directories(tree)
            source_extensions = {".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".java", ".rb", ".rs"}
            source_files = [
                item for item in tree
                if item.get("type") == "blob"
                and any(item.get("path", "").endswith(ext) for ext in source_extensions)
            ]
            test_files = [
                item for item in source_files
                if "/test" in item.get("path", "").lower()
                or item.get("path", "").lower().startswith("test")
                or ".test." in item.get("path", "").lower()
                or ".spec." in item.get("path", "").lower()
                or "/__tests__/" in item.get("path", "").lower()
            ]
            test_file_count = len(test_files)
            non_test_source = len(source_files) - test_file_count
            test_coverage_pct = _estimate_test_coverage(test_file_count, non_test_source)
            _emit("tech_stack", "done", {"detected": tech_stack})
        except Exception as exc:
            _emit("tech_stack", "error", {"error": str(exc)})
            tech_stack = []
            directory_map = []
            test_file_count = 0
            test_coverage_pct = None

        _emit("issues", "started")
        try:
            issues = await client.get_issues(owner, repo_name, state="open")
            _emit("issues", "done", {"count": len(issues)})
        except Exception as exc:
            _emit("issues", "error", {"error": str(exc)})
            issues = []

        _emit("pull_requests", "started")
        try:
            prs = await client.get_pull_requests(owner, repo_name, state="closed")
            _emit("pull_requests", "done", {"count": len(prs)})
        except Exception as exc:
            _emit("pull_requests", "error", {"error": str(exc)})

    _emit("analysis", "done")

    result = {
        "owner": owner,
        "repo": repo_name,
        "status": "completed",
        "sha": latest_sha,
        "metadata": {
            "stars": repo_data.get("stargazers_count", 0),
            "forks": repo_data.get("forks_count", 0),
            "open_issues": repo_data.get("open_issues_count", 0),
            "language": repo_data.get("language"),
            "topics": repo_data.get("topics", []),
            "description": repo_data.get("description"),
            "full_name": repo_data.get("full_name"),
        },
        "tech_stack": tech_stack,
        "directory_map": directory_map,
        "test_file_count": test_file_count,
        "test_coverage_pct": test_coverage_pct,
        "issues": issues,
        "steps": steps,
    }

    await set_cached_analysis(owner, repo_name, latest_sha, result)

    # Upsert repository row and kick off embedding so Q&A works
    try:
        from backend.worker.tasks.embed_repo import embed_repository  # local import avoids circular
        repo_id = uuid.uuid4()
        async with AsyncSessionLocal() as session:
            stmt = (
                insert(Repository)
                .values(
                    id=repo_id,
                    owner=owner,
                    name=repo_name,
                    full_name=f"{owner}/{repo_name}",
                    description=repo_data.get("description"),
                    stars=repo_data.get("stargazers_count", 0),
                    forks=repo_data.get("forks_count", 0),
                    open_issues=repo_data.get("open_issues_count", 0),
                    language=repo_data.get("language"),
                    topics=repo_data.get("topics", []),
                    default_branch=repo_data.get("default_branch", "main"),
                    latest_sha=latest_sha,
                )
                .on_conflict_do_update(
                    index_elements=["full_name"],
                    set_={
                        "stars": repo_data.get("stargazers_count", 0),
                        "forks": repo_data.get("forks_count", 0),
                        "open_issues": repo_data.get("open_issues_count", 0),
                        "language": repo_data.get("language"),
                        "topics": repo_data.get("topics", []),
                        "latest_sha": latest_sha,
                    },
                )
                .returning(Repository.id)
            )
            row = await session.execute(stmt)
            actual_repo_id = row.scalar_one()
            await session.commit()
        await embed_repository.kiq(
            repo_id=str(actual_repo_id),
            owner=owner,
            repo_name=repo_name,
            file_tree=tree,
        )
    except Exception:
        logger.exception("Could not trigger embedding for %s/%s", owner, repo_name)

    # Kick off issue scoring in the background so matches are ready for the issues page
    from backend.worker.tasks.score_issues import score_issues
    await score_issues.kiq(owner=owner, repo_name=repo_name, github_token=github_token)

    return result
