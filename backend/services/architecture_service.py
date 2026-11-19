import asyncio
import re
from pathlib import PurePosixPath

from backend.services.github_client import GitHubClient

_SOURCE_SUFFIXES = {".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".kt", ".go", ".rs", ".cs", ".rb", ".php", ".vue", ".svelte"}
_EXCLUDED_DIRS = {"node_modules", "vendor", "dist", "build", "target", "venv", ".venv", "tests", "test", "__tests__", "fixtures", "mock-ui"}
_ENTRY_POINTS = {"main", "app", "server", "index", "program", "startup"}
_WIRING_FILES = {"router", "routes", "routing", "applications", "broker", "database", "session", "client"}
_COMPOSE_FILES = {"docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"}
_CONNECTION_LINES = re.compile(r"include_router|register_blueprint|app\.|router\.|\.kiq\(|apiCall|fetch\(|axios|create_engine|create_async_engine|Redis|Broker|api_base|https?://|depends_on:|services:|command:|environment:")


def _file_priority(path: str) -> int | None:
    file = PurePosixPath(path)
    if any(part.startswith(".") or part in _EXCLUDED_DIRS for part in file.parts):
        return None
    if file.name.lower() in {"architecture.md", "architecture.rst"}:
        return 0
    if path.lower() in {"readme.md", "readme.rst"}:
        return 1
    if file.name in _COMPOSE_FILES:
        return 2
    if file.suffix not in _SOURCE_SUFFIXES:
        return None
    if file.stem.lower() in _ENTRY_POINTS or file.name.endswith("Application.java"):
        return 3
    if file.stem.lower() in _WIRING_FILES:
        return 4
    return 5


def _excerpt(path: str, content: str, limit: int) -> str:
    if PurePosixPath(path).suffix in {".md", ".rst"}:
        return content[:limit]
    lines = content.splitlines()
    selected = set(range(min(5, len(lines))))
    for index, line in enumerate(lines):
        if _CONNECTION_LINES.search(line):
            selected.update(range(max(0, index - 1), min(len(lines), index + 2)))
    excerpt = "\n".join(f"{index + 1}: {lines[index]}" for index in sorted(selected))
    return (excerpt if len(selected) > 5 else content)[:limit]


async def collect_architecture_context(
    client: GitHubClient, owner: str, repo_name: str,
) -> tuple[dict[str, str], list[str]]:
    metadata = await client.get_repo(owner, repo_name)
    branch = metadata.get("default_branch", "main")
    tree = await client.get_file_tree(owner, repo_name, branch)
    candidates = []
    for entry in tree:
        path = entry["path"]
        priority = _file_priority(path)
        if (
            priority is not None and entry.get("type") == "blob"
            and entry.get("mode") != "120000" and 0 < entry.get("size", 0) <= 100_000
        ):
            candidates.append((priority, path))
    candidates.sort(key=lambda item: (item[0], item[1].count("/"), item[1]))
    selected = [path for _, path in candidates[:8]]
    contents = await asyncio.gather(*(
        client.get_file_content(owner, repo_name, path, ref=branch) for path in selected
    ))
    sources: dict[str, str] = {}
    remaining = 5000
    for path, content in zip(selected, contents):
        if content and content.strip() and remaining > 0:
            excerpt = _excerpt(path, content, min(800, remaining))
            sources[path] = excerpt
            remaining -= len(excerpt)
    if not any(PurePosixPath(path).suffix in _SOURCE_SUFFIXES for path in sources):
        raise ValueError("No readable application source files were found for an architecture diagram.")
    return sources, [path for _, path in candidates[:60]]
