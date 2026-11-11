import logging
from typing import Any

from taskiq_redis import ListQueueBroker

from backend.core.config import get_settings
from backend.services.cache_service import get_cached_analysis, set_cached_analysis
from backend.services.github_client import GitHubClient
from backend.services.tech_stack_service import detect_tech_stack, map_directories

logger = logging.getLogger(__name__)

_settings = get_settings()
broker = ListQueueBroker(url=_settings.VALKEY_URL)


@broker.task
async def analyze_repository(owner: str, repo_name: str, github_token: str | None = None) -> dict[str, Any]:
    steps: list[dict[str, Any]] = []

    def _emit(step: str, status: str, data: Any = None) -> None:
        event = {"step": step, "status": status, "data": data}
        steps.append(event)
        logger.info("Analysis [%s/%s] %s: %s", owner, repo_name, step, status)

    async with GitHubClient(token=github_token) as client:
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
            _emit("tech_stack", "done", {"detected": tech_stack})
        except Exception as exc:
            _emit("tech_stack", "error", {"error": str(exc)})
            tech_stack = []
            directory_map = []

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
        "issues": issues,
        "steps": steps,
    }

    await set_cached_analysis(owner, repo_name, latest_sha, result)
    return result
