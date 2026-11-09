import re

from litellm import acompletion

from backend.core.config import get_settings

_MERMAID_UNSAFE = re.compile(r'["\[\](){}<>]')


def _sanitize_for_mermaid(text: str) -> str:
    return _MERMAID_UNSAFE.sub('', text).strip()


DIAGRAM_PROMPT = """\
You are a software architect. Given the repository name, description, and detected tech stack below, \
generate a concise Mermaid.js architecture diagram showing the main components and how they connect.

Repository: {repo_name}
Description: {description}
Tech stack: {tech_stack}

Rules:
- Output ONLY valid Mermaid syntax, starting with `graph TD`
- Use short, meaningful node labels (no special characters)
- Maximum 10 nodes
- Do not include any explanation, only the Mermaid code block
"""


async def generate_mermaid_diagram(
    repo_name: str,
    description: str | None,
    tech_stack: list[str],
) -> str:
    settings = get_settings()

    safe_repo = _sanitize_for_mermaid(repo_name)
    safe_desc = _sanitize_for_mermaid(description or "No description")
    safe_stack = ", ".join(_sanitize_for_mermaid(t) for t in tech_stack)

    prompt = DIAGRAM_PROMPT.format(
        repo_name=safe_repo,
        description=safe_desc,
        tech_stack=safe_stack,
    )

    response = await acompletion(
        model="ollama/qwen2.5-coder:7b",
        api_base=settings.OLLAMA_URL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )

    raw: str = response.choices[0].message.content or ""

    # Strip markdown code fences if the model wrapped the output
    if "```" in raw:
        raw = re.sub(r"```(?:mermaid)?\s*", "", raw).strip()

    return raw.strip()
