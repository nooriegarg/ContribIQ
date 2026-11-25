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

# Labels that suggest a module/helper masquerading as a deployment node
_MODULE_LABEL = re.compile(
    r'\b(fetcher|helper|util|handler|service|manager|controller|middleware'
    r'|parser|formatter|validator|processor|builder|factory|adapter|hook'
    r'|component|module|class)\b',
    re.IGNORECASE,
)

# Labels that are always legitimate external services / infra (never filtered)
_INFRA_LABEL = re.compile(
    r'\b(database|db|postgres|mysql|mongodb|sqlite|redis|valkey|kafka|rabbitmq'
    r'|queue|cache|storage|s3|openai|anthropic|stripe|sendgrid|twilio'
    r'|rapidapi|github api|youtube api|google|translate|gTTS|ffmpeg|yt.?dlp'
    r'|worker|frontend|backend|server|api)\b',
    re.IGNORECASE,
)

# File stems that are entry points of a process
_ENTRY_STEMS = {'server', 'main', 'app', 'index', 'worker', 'broker', 'startup', 'program', 'run'}

def _is_entry_point(source_file: str) -> bool:
    from pathlib import PurePosixPath
    return PurePosixPath(source_file).stem.lower() in _ENTRY_STEMS

_DB_EVIDENCE = re.compile(
    r'\b(pg|postgres|mysql|mongodb|mongoose|sqlite|prisma|sequelize|typeorm'
    r'|sqlalchemy|create_engine|drizzle|knex|kysely)\b',
    re.IGNORECASE,
)

def _has_db_evidence(source_files: dict[str, str]) -> bool:
    return any(_DB_EVIDENCE.search(content) for content in source_files.values())


def _is_valid_deployment_node(label: str, source_file: str) -> bool:
    """Return True if this component looks like a real deployment boundary."""
    if _INFRA_LABEL.search(label):
        return True
    if _is_entry_point(source_file):
        return True
    if _MODULE_LABEL.search(label):
        return False
    return True


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
    components: list[_Component] = Field(min_length=1, max_length=20)
    connections: list[_Connection] = Field(min_length=0, max_length=30)


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

Your response MUST be a single JSON object with exactly these two keys:
  "components": array of objects, each with "id", "label", "source_file"
  "connections": array of objects, each with "source", "target", "label", "source_file"

Example output (do not copy the labels — derive from the actual repo):
{{"components":[{{"id":"frontend","label":"Next.js Frontend","source_file":"Frontend/app/page.tsx"}},{{"id":"api","label":"Express API Server","source_file":"Backend/server.js"}}],
"connections":[{{"source":"frontend","target":"api","label":"YouTube URL","source_file":"Backend/server.js"}}]}}

Do NOT output anything except that JSON object. Do not explain. Do not repeat the source excerpts.

<SOURCE_EXCERPTS>
{source_context}
</SOURCE_EXCERPTS>
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

    source_context_parts = [f"=== {path} ===\n{content[:800]}" for path, content in source_files.items()]
    source_context = "\n\n".join(source_context_parts)

    prompt = DIAGRAM_PROMPT.format(
        repo_name=repo_name,
        description=description or "No description",
        tech_stack=", ".join(tech_stack),
        file_paths="\n".join(file_paths)[:1000],
        source_context=source_context,
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
    if "components" not in raw_json:
        raise ValueError(
            f"Model returned malformed response — 'components' key missing. "
            f"Top-level keys were: {list(raw_json.keys())[:10]}"
        )
    architecture = _Architecture.model_validate(raw_json)
    technology_names = {technology.casefold() for technology in tech_stack}
    db_allowed = _has_db_evidence(source_files)
    valid_components = []
    for component in architecture.components:
        if component.source_file not in source_files:
            continue
        label = _sanitize_for_mermaid(component.label)
        if not label or label.casefold() in technology_names:
            continue
        if _CONFIG_PATTERNS.search(component.source_file) and _CONFIG_PATTERNS.search(label):
            continue
        if not _is_valid_deployment_node(label, component.source_file):
            continue
        if re.search(r'\b(database|db|postgres|mysql|mongodb|sqlite)\b', label, re.IGNORECASE) and not db_allowed:
            continue
        valid_components.append(component)
    valid_components = valid_components[:8]
    if len(valid_components) < 2:
        raise ValueError("Not enough deployable components found. This may be a library or framework repo rather than a runnable application.")
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
