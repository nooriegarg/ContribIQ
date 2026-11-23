from typing import Any

from backend.services.architecture_service import collect_repo_structure
from backend.services.smart_diagram_generator import analyze_code_structure, generate_mermaid_from_analysis
from backend.services.github_client import GitHubClient
from backend.core.config import get_settings
from backend.worker.broker import broker


@broker.task
async def generate_diagram(
    owner: str,
    repo_name: str,
    description: str | None,
    tech_stack: list[str],
    github_token: str | None = None,
) -> dict[str, Any]:
    settings = get_settings()
    token = github_token or settings.GITHUB_TOKEN
    async with GitHubClient(token=token) as client:
        source_files, file_paths = await collect_repo_structure(client, owner, repo_name)
    
    # Analyze code structure to infer components and connections
    analysis = analyze_code_structure(source_files, [{"path": f, "type": "blob"} for f in file_paths])
    
    # Generate Mermaid diagram based on code analysis
    mermaid_syntax = generate_mermaid_from_analysis(
        repo_name=f"{owner}/{repo_name}",
        analysis=analysis,
    )
    
    return {"mermaid_syntax": mermaid_syntax, "source_files": list(source_files)[:8], "status": "completed"}
