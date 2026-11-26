import re
import json
from typing import Annotated

from litellm import acompletion
from pydantic import BaseModel, Field, StringConstraints

from backend.core.config import get_settings, ai_kwargs

_MERMAID_UNSAFE = re.compile(r'[&<>"`\'\\|{}\[\]()]')
_TEXT = Annotated[str, StringConstraints(strict=True, strip_whitespace=True, min_length=1, max_length=160)]

_DB_EVIDENCE = re.compile(
    r'\b(pg|postgres|mysql|mongodb|mongoose|sqlite|prisma|sequelize|typeorm'
    r'|sqlalchemy|create_engine|drizzle|knex|kysely)\b',
    re.IGNORECASE,
)


def _has_db_evidence(source_files: dict[str, str]) -> bool:
    return any(_DB_EVIDENCE.search(content) for content in source_files.values())


def _sanitize_label(text: str) -> str:
    return _MERMAID_UNSAFE.sub('', text).strip() or 'Node'


# ---------------------------------------------------------------------------
# Graph schema (gitdiagram-style)
# ---------------------------------------------------------------------------

class _Group(BaseModel):
    id: str = Field(pattern=r'^[a-z][a-z0-9_]*$')
    label: str = Field(min_length=1, max_length=72)


class _Node(BaseModel):
    id: str = Field(pattern=r'^[a-z][a-z0-9_]*$')
    label: str = Field(min_length=1, max_length=72)
    type: str = Field(default='')
    group_id: str | None = Field(default=None, alias='groupId')
    shape: str | None = Field(default=None)  # box|database|queue|circle

    model_config = {'populate_by_name': True}


class _Edge(BaseModel):
    from_id: str = Field(alias='from')
    to_id: str = Field(alias='to')
    label: str | None = None
    style: str | None = None  # solid|dashed

    model_config = {'populate_by_name': True}

    @classmethod
    def model_validate(cls, obj, **kwargs):
        if isinstance(obj, dict):
            obj = dict(obj)
            if 'from_id' in obj and 'from' not in obj:
                obj['from'] = obj.pop('from_id')
            if 'to_id' in obj and 'to' not in obj:
                obj['to'] = obj.pop('to_id')
            # fallback: source/target keys
            if 'from' not in obj and 'source' in obj:
                obj['from'] = obj.pop('source')
            if 'to' not in obj and 'target' in obj:
                obj['to'] = obj.pop('target')
        return super().model_validate(obj, **kwargs)


class _Graph(BaseModel):
    groups: list[_Group] = Field(default_factory=list, max_length=8)
    nodes: list[_Node] = Field(min_length=1, max_length=24)
    edges: list[_Edge] = Field(default_factory=list, max_length=36)


# ---------------------------------------------------------------------------
# Mermaid compiler (deterministic — no LLM)
# ---------------------------------------------------------------------------

# Color tones matching gitdiagram's classDef palette
_TONE_DEFS = {
    'toneBlue':   'fill:#dbeafe,stroke:#2563eb,stroke-width:1.5px,color:#172554',
    'toneAmber':  'fill:#fef3c7,stroke:#d97706,stroke-width:1.5px,color:#78350f',
    'toneMint':   'fill:#dcfce7,stroke:#16a34a,stroke-width:1.5px,color:#14532d',
    'toneRose':   'fill:#ffe4e6,stroke:#e11d48,stroke-width:1.5px,color:#881337',
    'toneIndigo': 'fill:#e0e7ff,stroke:#4f46e5,stroke-width:1.5px,color:#312e81',
    'toneTeal':   'fill:#ccfbf1,stroke:#0f766e,stroke-width:1.5px,color:#134e4a',
}
_GROUP_TONES = ['toneBlue', 'toneAmber', 'toneMint', 'toneRose', 'toneIndigo', 'toneTeal']


def _tone_for_node(node: _Node, group_order: dict[str, int]) -> str:
    if node.group_id and node.group_id in group_order:
        return _GROUP_TONES[group_order[node.group_id] % len(_GROUP_TONES)]
    words = f'{node.label} {node.type}'.lower()
    if node.shape == 'database' or any(w in words for w in ('database', 'storage', 'cache', 'postgres', 'sqlite', 'redis', 'valkey')):
        return 'toneAmber'
    if any(w in words for w in ('queue', 'worker', 'background', 'scheduler', 'task', 'broker')):
        return 'toneRose'
    if any(w in words for w in ('client', 'browser', 'user', 'frontend', 'ui')):
        return 'toneBlue'
    if any(w in words for w in ('api', 'server', 'route', 'request', 'handler', 'webhook')):
        return 'toneMint'
    if not node.group_id or any(w in words for w in ('model', 'inference', 'provider', 'integration', 'external')):
        return 'toneIndigo'
    return 'toneTeal'


def _render_node(node: _Node, indent: str = '') -> str:
    label = _sanitize_label(node.label)
    nid = f'node_{node.id}'
    shape = node.shape or 'box'
    if shape == 'database':
        return f'{indent}{nid}[("{label}")]'
    if shape == 'circle':
        return f'{indent}{nid}(("{label}"))'
    if shape in ('queue', 'hexagon'):
        return f'{indent}{nid}{{{{"{label}"}}}}'
    return f'{indent}{nid}["{label}"]'


def _compile_graph(graph: _Graph) -> str:
    lines = ['flowchart TD']
    group_order = {g.id: i for i, g in enumerate(graph.groups)}
    grouped_ids: set[str] = set()

    for group in graph.groups:
        members = [n for n in graph.nodes if n.group_id == group.id]
        if not members:
            continue
        lines.append('')
        lines.append(f'subgraph group_{group.id}["{_sanitize_label(group.label)}"]')
        for node in members:
            lines.append(_render_node(node, '  '))
            grouped_ids.add(node.id)
        lines.append('end')

    ungrouped = [n for n in graph.nodes if n.id not in grouped_ids]
    if ungrouped:
        lines.append('')
        for node in ungrouped:
            lines.append(_render_node(node))

    if graph.edges:
        lines.append('')
        node_ids = {n.id for n in graph.nodes}
        for edge in graph.edges:
            if edge.from_id not in node_ids or edge.to_id not in node_ids:
                continue
            connector = '-.->' if edge.style == 'dashed' else '-->'
            frm, to = f'node_{edge.from_id}', f'node_{edge.to_id}'
            lbl = _sanitize_label(edge.label) if edge.label else ''
            lines.append(f'{frm} {connector}|"{lbl}"| {to}' if lbl else f'{frm} {connector} {to}')

    # classDefs
    lines.append('')
    for tone, style in _TONE_DEFS.items():
        lines.append(f'classDef {tone} {style}')

    # class assignments
    tone_map: dict[str, list[str]] = {}
    for node in graph.nodes:
        tone = _tone_for_node(node, group_order)
        tone_map.setdefault(tone, []).append(f'node_{node.id}')
    for tone, ids in tone_map.items():
        lines.append(f'class {",".join(ids)} {tone}')

    return '\n'.join(lines).strip()


# ---------------------------------------------------------------------------
# Stage-1 prompt: free-text explanation
# ---------------------------------------------------------------------------

_EXPLAIN_PROMPT = """\
You are a principal engineer. Study the repository below and write a concise \
architecture explanation (200-400 words).

Cover in order:
1. What the application does and its main user workflow.
2. Each distinct deployment component (separately running process or external service): \
name, role, and what it connects to.
3. Key data flows between components (HTTP calls, queue messages, database reads/writes).

Do NOT mention config files, helper modules, UI components, or build tools. \
Only separately deployable pieces.

Repository: {repo_name}
Description: {description}
Tech stack: {tech_stack}

<SOURCE_FILES>
{source_context}
</SOURCE_FILES>
"""

# ---------------------------------------------------------------------------
# Stage-2 prompt: explanation → graph JSON
# ---------------------------------------------------------------------------

_GRAPH_PROMPT = """\
Convert the architecture explanation below into a JSON graph. \
Return ONLY a valid JSON object — no prose, no markdown, no code fences.

Schema:
{{
  "groups": [{{"id": "snake_id", "label": "Group Name"}}],
  "nodes": [{{
    "id": "snake_id",
    "label": "Short Name",
    "type": "one descriptive phrase",
    "groupId": "parent_group_id or null",
    "shape": "box|database|queue|circle"
  }}],
  "edges": [{{
    "from": "node_id",
    "to": "node_id",
    "label": "action verb / payload",
    "style": "solid|dashed"
  }}]
}}

Rules:
- 3-6 groups for a substantial app; no groups for a tiny utility.
- Each group gets 2-6 nodes.
- Max 20 nodes, 30 edges.
- shape=database for real data stores; shape=queue for message queues/brokers; \
shape=circle for external actors (users, external APIs); shape=box for everything else.
- edge label = what crosses the boundary (e.g. "task payload", "SQL query", "HTTP request").
- Use dashed style for optional or inferred connections.
- id values must be lowercase snake_case, unique.
- Do not include config files, helper modules, or build artefacts as nodes.

Explanation:
{explanation}
"""


async def _llm(system: str, user: str, settings) -> str:
    # Use Claude when an API key or proxy token is available
    api_key = getattr(settings, 'ANTHROPIC_AUTH_TOKEN', None) or getattr(settings, 'ANTHROPIC_API_KEY', None)
    if api_key:
        kwargs: dict = dict(
            model='anthropic/claude-haiku-4-5',
            api_key=api_key,
            messages=[{'role': 'user', 'content': f'{system}\n\n{user}'}],
            max_tokens=4000,
            temperature=0.2,
        )
        base_url = getattr(settings, 'ANTHROPIC_BASE_URL', None)
        if base_url:
            kwargs['api_base'] = base_url
        response = await acompletion(**kwargs)
    else:
        response = await acompletion(
            model='ollama/qwen2.5-coder:7b',
            api_base=settings.OLLAMA_URL,
            messages=[
                {'role': 'system', 'content': system},
                {'role': 'user', 'content': user},
            ],
            max_tokens=4000,
            temperature=0.2,
        )
    return response.choices[0].message.content or ''


def _extract_json(raw: str) -> dict:
    """Pull the first {...} block from raw text and parse it."""
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if not match:
        raise ValueError('No JSON object found in LLM response.')
    text = match.group(0)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Attempt to close truncated JSON
        last = text.rfind('}')
        if last > 0:
            text = text[:last + 1]
            text += ']' * max(0, text.count('[') - text.count(']'))
            text += '}' * max(0, text.count('{') - text.count('}'))
        return json.loads(text)  # raises if still broken


_LIBRARY_ERROR = ValueError(
    'Architecture diagram not available: this appears to be a library or framework '
    'rather than a runnable application with distinct deployment components.'
)


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
        raise ValueError('Application source context is required for an architecture diagram.')

    source_context = '\n\n'.join(
        f'=== {path} ===\n{content[:600]}' for path, content in source_files.items()
    )

    # --- Stage 1: explanation ---
    explain_prompt = _EXPLAIN_PROMPT.format(
        repo_name=repo_name,
        description=description or 'No description provided.',
        tech_stack=', '.join(tech_stack) or 'unknown',
        source_context=source_context,
    )
    explanation = await _llm(
        'You explain software architecture in plain English. Be concise and precise.',
        explain_prompt,
        settings,
    )
    if not explanation or len(explanation.strip()) < 50:
        raise _LIBRARY_ERROR

    # --- Stage 2: graph JSON ---
    graph_prompt = _GRAPH_PROMPT.format(explanation=explanation.strip())
    last_error: Exception = _LIBRARY_ERROR
    for _attempt in range(3):
        raw = await _llm(
            'You are an architecture graph planner. Return only valid JSON.',
            graph_prompt,
            settings,
        )
        try:
            raw_json = _extract_json(raw)
        except (ValueError, json.JSONDecodeError) as exc:
            last_error = exc
            continue

        # Normalize edge keys (some models use source/target)
        nodes_raw = raw_json.get('nodes', [])
        edges_raw = []
        for e in raw_json.get('edges', []):
            if isinstance(e, dict):
                e = dict(e)
                if 'from' not in e and 'source' in e:
                    e['from'] = e.pop('source')
                if 'to' not in e and 'target' in e:
                    e['to'] = e.pop('target')
                edges_raw.append(e)

        try:
            graph = _Graph.model_validate({
                'groups': raw_json.get('groups', []),
                'nodes': nodes_raw,
                'edges': edges_raw,
            })
        except Exception as exc:
            last_error = exc
            continue

        if len(graph.nodes) < 2:
            last_error = _LIBRARY_ERROR
            continue

        return _compile_graph(graph)

    raise last_error
