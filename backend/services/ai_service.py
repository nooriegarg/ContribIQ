import re
import json
from typing import Annotated

from litellm import acompletion
from pydantic import BaseModel, Field, StringConstraints

from backend.core.config import get_settings

_MERMAID_UNSAFE = re.compile(r'[^a-zA-Z0-9 _./:-]')
_TEXT = Annotated[str, StringConstraints(strict=True, strip_whitespace=True, min_length=1, max_length=160)]

_CONFIG_PATTERNS = re.compile(
    r'(config|\.config\.|tailwind|postcss|tsconfig|\.json$|layout\.|page\.'
    r'|wrapper|shell|provider|context|theme|style|css|scss|\.md$)',
    re.IGNORECASE,
)


class _Component(BaseModel):
    id: _TEXT
    label: _TEXT
    source_file: _TEXT


class _Connection(BaseModel):
    source: _TEXT = Field(alias=None)
    target: _TEXT = Field(alias=None)
    label: _TEXT
    source_file: _TEXT

    model_config = {"populate_by_name": True}

    @classmethod
    def model_validate(cls, obj, **kwargs):
        if isinstance(obj, dict):
            obj = dict(obj)
            if "source" not in obj and "from" in obj:
                obj["source"] = obj.pop("from")
            if "target" not in obj and "to" in obj:
                obj["target"] = obj.pop("to")
        return super().model_validate(obj, **kwargs)


class _Architecture(BaseModel):
    components: list[_Component] = Field(min_length=2, max_length=8)
    connections: list[_Connection] = Field(min_length=0, max_length=15)


def _sanitize_for_mermaid(text: str) -> str:
    return _MERMAID_UNSAFE.sub('', text).strip()


DIAGRAM_PROMPT = """\
Draw a DEPLOYMENT-BOUNDARY architecture diagram for this repository.

Repository: {repo_name}
Description: {description}
Technology metadata (not diagram nodes): {tech_stack}
Selected repository paths: {file_paths}

A deployment boundary is a separately running process or external service. Ask yourself:
"Would this be a separate box in a cloud architecture diagram?"

VALID node types (each is a separate process or service):
  - Frontend app (one node: the browser/client app)
  - Backend server / API (one node per server process)
  - Database (Postgres, MySQL, MongoDB, SQLite)
  - Cache / message queue (Redis, Valkey, RabbitMQ, Kafka)
  - Background worker / job queue (a separate process consuming tasks)
  - External third-party API (GitHub API, OpenAI, Stripe, RapidAPI, gTTS, etc.)
  - CLI tool invoked as subprocess (yt-dlp, ffmpeg — only if exec/spawn is in the code)

NEVER draw as nodes — these are code inside a process, not separate deployments:
  - Functions, classes, modules, helper files
  - Config files, build files, tsconfig, tailwind, postcss
  - UI components, pages, layouts, CSS files
  - Import statements, libraries, packages

ARROWS represent network calls or process boundaries:
  - HTTP/REST, WebSocket, database query, queue message, subprocess exec
  - Label = what is sent (e.g. "YouTube URL", "SQL query", "task payload", "audio file path")
  - Never label an arrow "calls" or "uses"

Rules:
- Max 8 nodes. If the whole app is one process + one DB, draw just those 2.
- Only include nodes evidenced by the source excerpts below.
- source_file must exactly match one of the provided excerpt paths.
- Output ONLY valid JSON:
{{"components":[{{"id":"frontend","label":"Next.js Frontend","source_file":"Frontend/app/page.tsx"}},{{"id":"api","label":"Express API Server","source_file":"Backend/server.js"}}],
"connections":[{{"source":"frontend","target":"api","label":"YouTube URL + language","source_file":"Backend/server.js"}},{{"source":"api","target":"translator","label":"transcript text","source_file":"Backend/server.js"}}]}}

Repository source excerpts:
{source_context}
"""


async def generate_mermaid_diagram(
    repo_name: str,
    description: str | None,
    tech_stack: list[str],
    *,
    source_files: dict[str, str],
    file_paths: list[str],
) -> str:
    settings = get_settings()
    if not source_files:
        raise ValueError("Application source context is required for an architecture diagram.")

    prompt = DIAGRAM_PROMPT.format(
        repo_name=repo_name,
        description=description or "No description",
        tech_stack=", ".join(tech_stack),
        file_paths="\n".join(file_paths)[:1000],
        source_context=json.dumps(source_files),
    )

    response = await acompletion(
        model="ollama/qwen2.5-coder:7b",
        api_base=settings.OLLAMA_URL,
        messages=[
            {"role": "system", "content": "You draw deployment-boundary architecture diagrams. Each node must be a separately running process or external service — never a function, module, or config file. Return JSON only."},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        max_tokens=2000,
        temperature=0.2,
    )

    raw: str = response.choices[0].message.content or ""

    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if match is None:
        raise ValueError("Architecture response contained no JSON object.")

    raw_json = json.loads(match.group(0))
    valid_connections = []
    for conn in raw_json.get("connections", []):
        if isinstance(conn, dict):
            conn = dict(conn)
            if "source" not in conn and "from" in conn:
                conn["source"] = conn.pop("from")
            if "target" not in conn and "to" in conn:
                conn["target"] = conn.pop("to")
            try:
                valid_connections.append(_Connection.model_validate(conn))
            except Exception:
                continue
    raw_json["connections"] = [c.model_dump() for c in valid_connections] if valid_connections else []
    architecture = _Architecture.model_validate(raw_json)
    technology_names = {technology.casefold() for technology in tech_stack}
    valid_components = []
    for component in architecture.components:
        if component.source_file not in source_files:
            continue
        label = _sanitize_for_mermaid(component.label)
        if not label or label.casefold() in technology_names:
            continue
        if _CONFIG_PATTERNS.search(component.source_file) and _CONFIG_PATTERNS.search(label):
            continue
        valid_components.append(component)
    if len(valid_components) < 2:
        raise ValueError("Not enough valid architecture components to render a diagram.")
    identifiers = {component.id: f"N{index}" for index, component in enumerate(valid_components)}
    lines = ["graph TD"]
    for component in valid_components:
        lines.append(f'    {identifiers[component.id]}["{_sanitize_for_mermaid(component.label)}"]')
    for connection in architecture.connections:
        if connection.source not in identifiers or connection.target not in identifiers:
            continue
        label = _sanitize_for_mermaid(connection.label)
        if not label:
            continue
        lines.append(f'    {identifiers[connection.source]} -->|{label}| {identifiers[connection.target]}')
    return "\n".join(lines)
