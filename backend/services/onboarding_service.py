import json
import logging
import re
from typing import Any

from litellm import acompletion

from backend.core.config import get_settings

logger = logging.getLogger(__name__)

_SAFE_COMMAND_PREFIXES = (
    "git ", "npm ", "pip ", "python ", "python3 ", "yarn ", "pnpm ",
    "cargo ", "go ", "make ", "docker ", "cd ", "export ", "source ",
)

_ONBOARDING_PROMPT = """\
You are an expert developer onboarding guide. Given the repository details below, \
generate a personalised "first 30 minutes" onboarding plan as JSON.

Repository: {full_name}
Description: {description}
Tech stack: {tech_stack}
Key directories: {directories}

Return a JSON object with this exact shape:
{{
  "steps": [
    {{
      "step": 1,
      "title": "short title",
      "description": "1-2 sentence explanation",
      "commands": ["shell command 1", "shell command 2"],
      "files_to_read": [
        {{"path": "relative/path", "purpose": "why to read this file"}}
      ]
    }}
  ],
  "estimated_minutes": 30,
  "issue_preview": {{
    "number": 0,
    "title": "good first issue title",
    "difficulty": "beginner"
  }}
}}

Rules:
- 4 to 6 steps total
- commands must be real shell commands for this tech stack
- Output ONLY valid JSON, no markdown fences, no explanation
"""


def _is_safe_command(cmd: str) -> bool:
    stripped = cmd.strip()
    return any(stripped.startswith(prefix) for prefix in _SAFE_COMMAND_PREFIXES)


def _sanitize_steps(steps: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for step in steps:
        step["commands"] = [c for c in step.get("commands", []) if _is_safe_command(c)]
    return steps


async def generate_onboarding_plan(analysis_result: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()

    metadata = analysis_result.get("metadata", {})
    full_name = metadata.get("full_name") or analysis_result.get("repo", "unknown")
    description = metadata.get("description") or "No description available"
    tech_stack = ", ".join(analysis_result.get("tech_stack", [])) or "unknown"
    directories = ", ".join(
        d.get("directory", "") for d in analysis_result.get("directory_map", [])[:8]
    )

    prompt = _ONBOARDING_PROMPT.format(
        full_name=full_name,
        description=description,
        tech_stack=tech_stack,
        directories=directories or "not available",
    )

    response = await acompletion(
        model="ollama/qwen2.5-coder:7b",
        api_base=settings.OLLAMA_URL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )

    raw: str = response.choices[0].message.content or ""

    if "```" in raw:
        raw = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()

    try:
        plan = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("LLM returned invalid JSON for onboarding plan, using fallback")
        plan = _fallback_plan(full_name, tech_stack)

    plan["steps"] = _sanitize_steps(plan.get("steps", []))
    return plan


def _fallback_plan(full_name: str, tech_stack: str) -> dict[str, Any]:
    return {
        "steps": [
            {
                "step": 1,
                "title": "Clone the repository",
                "description": "Get the code on your machine.",
                "commands": [f"git clone https://github.com/{full_name}.git", f"cd {full_name.split('/')[-1]}"],
                "files_to_read": [{"path": "README.md", "purpose": "Project overview and setup instructions"}],
            },
            {
                "step": 2,
                "title": "Install dependencies",
                "description": f"Set up the {tech_stack} environment.",
                "commands": [],
                "files_to_read": [],
            },
        ],
        "estimated_minutes": 30,
        "issue_preview": {"number": 0, "title": "Check the issues tab for good first issues", "difficulty": "beginner"},
    }
