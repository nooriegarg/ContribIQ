import uuid
from typing import Any

from backend.services.embedding_service import embed_files
from backend.services.github_client import GitHubClient
from backend.worker.broker import broker

_TEXT_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs", ".java",
    ".rb", ".php", ".c", ".cpp", ".h", ".cs", ".swift", ".kt",
    ".md", ".txt", ".yaml", ".yml", ".toml", ".json",
}
_MAX_FILE_BYTES = 100_000


@broker.task
async def embed_repository(
    repo_id: str,
    owner: str,
    repo_name: str,
    file_tree: list[dict[str, Any]],
    github_token: str | None = None,
) -> dict[str, Any]:
    async with GitHubClient(token=github_token) as client:
        files: dict[str, str] = {}

        for entry in file_tree:
            if entry.get("type") != "blob":
                continue
            path = entry.get("path", "")
            ext = ("." + path.rsplit(".", 1)[-1]).lower() if "." in path else ""
            if ext not in _TEXT_EXTENSIONS:
                continue
            try:
                content = await client.get_file_content(owner, repo_name, path)
                if content and len(content.encode()) <= _MAX_FILE_BYTES:
                    files[path] = content
            except Exception:
                continue

    return await embed_files(uuid.UUID(repo_id), files)
