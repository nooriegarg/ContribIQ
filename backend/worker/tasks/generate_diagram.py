from typing import Any

from backend.services.ai_service import generate_mermaid_diagram
from backend.services.tech_stack_service import detect_tech_stack
from backend.worker.broker import broker


@broker.task
async def generate_diagram(
    repo_name: str,
    description: str | None,
    tech_stack: list[str],
) -> dict[str, Any]:
    mermaid_syntax = await generate_mermaid_diagram(
        repo_name=repo_name,
        description=description,
        tech_stack=tech_stack,
    )
    return {"mermaid_syntax": mermaid_syntax, "status": "completed"}
