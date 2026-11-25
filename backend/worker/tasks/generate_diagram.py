from typing import Any

from backend.core.config import get_settings
from backend.services.ai_service import generate_mermaid_diagram
from backend.services.architecture_service import collect_architecture_context
from backend.services.github_client import GitHubClient
from backend.worker.broker import broker


@broker.task
async def generate_diagram(
    owner: str,
    repo_name: str,
    description: str | None,
    tech_stack: list[str],
) -> dict[str, Any]:
    async with GitHubClient(token=get_settings().GITHUB_TOKEN) as client:
        source_files, file_paths = await collect_architecture_context(client, owner, repo_name)
    mermaid_syntax = await generate_mermaid_diagram(
        repo_name=f"{owner}/{repo_name}",
        description=description,
        tech_stack=tech_stack,
        source_files=source_files,
        file_paths=file_paths,
    )
    return {"mermaid_syntax": mermaid_syntax, "source_files": list(source_files), "status": "completed"}
