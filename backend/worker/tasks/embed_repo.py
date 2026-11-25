import uuid
from typing import Any

from backend.core.config import get_settings
from backend.services.embedding_service import embed_files
from backend.services.github_client import GitHubClient
from backend.worker.broker import broker

_TEXT_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs", ".java",
    ".rb", ".php", ".c", ".cpp", ".h", ".cs", ".swift", ".kt",
    ".md", ".txt", ".yaml", ".yml", ".toml", ".json",
}
_MAX_FILE_BYTES = 100_000
_BATCH_SIZE = 20


@broker.task
async def embed_repository(
    repo_id: str,
    owner: str,
    repo_name: str,
    file_tree: list[dict[str, Any]],
    github_token: str | None = None,
) -> dict[str, Any]:
    text_entries = [
        entry for entry in file_tree
        if entry.get("type") == "blob"
        and ("." + entry.get("path", "").rsplit(".", 1)[-1]).lower() in _TEXT_EXTENSIONS
    ]

    total_chunks = 0
    repo_uuid = uuid.UUID(repo_id)

    async with GitHubClient(token=github_token or get_settings().GITHUB_TOKEN) as client:
        for i in range(0, len(text_entries), _BATCH_SIZE):
            batch = text_entries[i : i + _BATCH_SIZE]
            files: dict[str, str] = {}
            for entry in batch:
                path = entry.get("path", "")
                try:
                    content = await client.get_file_content(owner, repo_name, path)
                    if content and len(content.encode()) <= _MAX_FILE_BYTES:
                        files[path] = content
                except Exception:
                    continue

            if files:
                result = await embed_files(repo_uuid, files)
                total_chunks += result.get("chunks_stored", 0)

    return {"repo_id": repo_id, "chunks_stored": total_chunks}
