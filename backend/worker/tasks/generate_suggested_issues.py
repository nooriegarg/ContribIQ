"""
Worker task: scan source files for code gaps and produce AI-generated
beginner-friendly issue suggestions. Results are stored in Valkey with a
24-hour TTL so the API can serve them without re-running the LLM each time.
"""

import logging
from typing import Any

from backend.core.config import get_settings
from backend.services.auto_issue_generator_service import generate_suggested_issues
from backend.services.github_client import GitHubClient
from backend.services.valkey_client import set_key
from backend.worker.broker import broker

logger = logging.getLogger(__name__)

MAX_FILES_TO_FETCH = 20
MAX_FILE_BYTES = 50_000

_SOURCE_EXTS = {'.py', '.ts', '.tsx', '.js', '.jsx', '.go', '.java', '.rb', '.rs'}
_TEST_PATTERNS = ('/test', '/tests', '/spec', '/__tests__/', '.test.', '.spec.', 'test_', '_test.')


def _is_source(path: str) -> bool:
    return any(path.endswith(ext) for ext in _SOURCE_EXTS)


def _is_test(path: str) -> bool:
    low = path.lower()
    return any(pat in low for pat in _TEST_PATTERNS)


@broker.task
async def generate_suggested_issues_task(
    owner: str,
    repo_name: str,
    file_tree: list[dict[str, Any]],
    github_token: str | None = None,
) -> dict[str, Any]:
    """
    Fetch source file contents, scan for gaps, synthesize issues, and
    cache the result under generated_issues:{owner}/{repo_name}.

    If file_tree is empty (e.g. cache-hit path), fetches the tree from GitHub.
    """
    cache_key = f"generated_issues:{owner}/{repo_name}"
    settings = get_settings()
    token = github_token or settings.GITHUB_TOKEN

    async with GitHubClient(token=token) as client:
        # Cache hit path passes an empty file_tree — fetch it ourselves
        if not file_tree:
            try:
                repo_data = await client.get_repo(owner, repo_name)
                default_branch = repo_data.get("default_branch", "main")
                file_tree = await client.get_file_tree(owner, repo_name, default_branch)
                logger.info("Fetched file tree (%d entries) for %s/%s", len(file_tree), owner, repo_name)
            except Exception as exc:
                logger.warning("Could not fetch file tree for %s/%s: %s", owner, repo_name, exc)
                await set_key(cache_key, '[]', ttl=86400)
                return {"status": "no_tree", "generated": 0}

        all_paths = [
            item['path'] for item in file_tree
            if item.get('type') == 'blob' and _is_source(item.get('path', ''))
        ]
        source_paths = [p for p in all_paths if not _is_test(p)]
        test_paths = [p for p in all_paths if _is_test(p)]
        source_paths = source_paths[:MAX_FILES_TO_FETCH]

        file_contents: dict[str, str] = {}
        for path in source_paths:
            try:
                content = await client.get_file_content(owner, repo_name, path)
                if content and len(content.encode()) <= MAX_FILE_BYTES:
                    file_contents[path] = content
            except Exception as exc:
                logger.debug("Could not fetch %s: %s", path, exc)

    if not file_contents:
        logger.info("No fetchable source files for %s/%s — skipping gap scan", owner, repo_name)
        await set_key(cache_key, '[]', ttl=86400)
        return {"status": "no_files", "generated": 0}

    issues = await generate_suggested_issues(
        repo_name=f"{owner}/{repo_name}",
        file_contents=file_contents,
        source_files=source_paths,
        test_files=test_paths,
    )

    import json
    await set_key(cache_key, json.dumps(issues), ttl=86400)
    logger.info("Generated %d suggested issues for %s/%s", len(issues), owner, repo_name)
    return {"status": "completed", "generated": len(issues)}
