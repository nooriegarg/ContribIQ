import asyncio
import math
import re
from pathlib import PurePosixPath

from backend.services.github_client import GitHubClient

# ---------------------------------------------------------------------------
# File-type filters (adapted from gitdiagram's repository-context.ts)
# ---------------------------------------------------------------------------

_EXCLUDED = re.compile(
    r'(^|/)(?:\.[^/]+|tests?|__tests__|__mocks__|mock[^/]*|testdata|fixtures?'
    r'|e2e|cypress|examples?|samples?|demos?|stories|storybook'
    r'|docs?|tutorials?|documentation|bench|benchmarks?|vendor|third_party'
    r'|node_modules|dist|build|generated|migrations?|alembic|assets'
    r'|locales?|translations?)(/|$)'
    r'|\.(?:test|spec|generated|min|stories)\.'
    r'|(?:_pb2(?:_grpc)?\.py|\.pb(?:\.gw)?\.go)$'
    r'|(?:^|/)(?:test\.[^/]+|[^/]+_test\.[^/]+)$',
    re.IGNORECASE,
)
_SOURCE = re.compile(
    r'\.(?:py|[cm]?[jt]sx?|go|rs|java|kt|swift|cs|cpp|cc|rb|php|ex|exs'
    r'|scala|vue|svelte|graphql)$',
    re.IGNORECASE,
)
_MANIFEST = re.compile(
    r'(?:^|/)(?:package\.json|Cargo\.toml|go\.mod|pyproject\.toml'
    r'|requirements\.txt|build\.gradle|compose\.ya?ml|docker-compose\.ya?ml'
    r'|Gemfile|CMakeLists\.txt)$',
    re.IGNORECASE,
)
_README = re.compile(r'(?:^|/)README\.(?:md|txt|rst)$', re.IGNORECASE)
_BARREL = re.compile(r'(?:^|/)(?:index|mod|__init__)\.[^/]+$', re.IGNORECASE)
_CONNECTION_LINES = re.compile(
    r'include_router|register_blueprint|app\.|router\.'
    r'|\.kiq\(|apiCall|fetch\(|axios|create_engine|create_async_engine'
    r'|Redis|Broker|api_base|https?://|depends_on:|services:|command:|environment:',
)

MAX_SOURCE_FILES = 12
MAX_SOURCE_CHARACTERS = 6000
MAX_FILE_CHARACTERS = 600


def _is_architecture_source(path: str) -> bool:
    return (
        not _EXCLUDED.search(path)
        and (_SOURCE.search(path) or _MANIFEST.search(path) or _README.search(path))
    )


def _score(path: str) -> float:
    name = PurePosixPath(path).name
    depth = path.count('/')
    value: float = 20 - depth

    if _MANIFEST.search(path):
        value += 5 if '/' in path else 45
    if re.match(r'^(?:main|apps?|server|applications?|program)\.', name, re.IGNORECASE):
        value += 28
    if re.match(r'^(?:route|\+server|\+page\.server)\.[cm]?[jt]sx?$', name, re.IGNORECASE):
        value += 32
    if re.match(r'^page\.[jt]sx$', name, re.IGNORECASE):
        value += 16
    if re.match(r'^use[A-Z].*\.[cm]?[jt]sx?$', name):
        value += 22
    if re.match(r'^(?:index|lib|mod)\.', name, re.IGNORECASE):
        value += 22 if depth <= 2 else 2
    if re.search(r'(?:controller|manager|routes|query|ingest|search|auth|parser|context|session)', name, re.IGNORECASE):
        value += 10
    if re.search(r'(?:webhook|router|routes|routing|handler|controller|tasks|worker'
                 r'|pipeline|engine|manager|repository|storage|database|client|service)', name, re.IGNORECASE):
        value += 22
    if re.search(r'(?:pipeline|engine|orchestrat|review|retriev|embedding|inference|llm|rag|query|ingest)', name, re.IGNORECASE):
        value += 18
    if re.search(r'(?:config|types|constants|utils|helpers|schema|models)', name, re.IGNORECASE):
        value -= 6
    if re.search(r'(?:analytics|telemetry|instrumentation|logger|logging)', name, re.IGNORECASE):
        value -= 25
    if re.search(r'(?:^|/)scripts?/', path, re.IGNORECASE):
        value -= 35
    if re.match(r'^(?:testclient|conftest)\.', name, re.IGNORECASE):
        value -= 35

    return value


def _excerpt(path: str, content: str, limit: int) -> str:
    """Smart excerpt: keep import lines + lines with connection patterns."""
    if len(content) <= limit:
        return content
    if PurePosixPath(path).suffix in {'.md', '.rst', '.txt', '.toml', '.yml', '.yaml'}:
        return content[:limit]
    lines = content.splitlines()
    selected: set[int] = set(range(min(8, len(lines))))
    for index, line in enumerate(lines):
        if _CONNECTION_LINES.search(line):
            selected.update(range(max(0, index - 1), min(len(lines), index + 3)))
        elif re.search(r'\b(?:import|from|require|include)\b', line):
            selected.add(index)
    result = '\n'.join(lines[i] for i in sorted(selected))
    return (result if len(selected) > 8 else content)[:limit]


def _rank_source_paths(entries: list[dict], size_map: dict[str, int]) -> list[str]:
    """Rank files using gitdiagram-style scoring with diversity penalty."""
    candidates = []
    for entry in entries:
        path = entry.get('path', '')
        if entry.get('type') != 'blob':
            continue
        if not _is_architecture_source(path):
            continue
        size = size_map.get(path, entry.get('size', 0))
        if size > 100_000:
            continue
        base = _score(path)
        # Size adjustments
        if size < 250:
            base -= 15
        if size < 2000 and _BARREL.search(path):
            base -= 18
        base += min(10, math.log2(1 + size / 1000))
        directory = str(PurePosixPath(path).parent) if '/' in path else ''
        area = '/'.join(directory.split('/')[:2])
        candidates.append({
            'path': path,
            'directory': directory,
            'area': area,
            'score': base,
            'manifest': bool(_MANIFEST.search(path)),
        })

    selected: list[str] = []
    directory_counts: dict[str, int] = {}
    area_counts: dict[str, int] = {}
    priorities = {c['path']: c['score'] for c in candidates}
    manifests = 0

    while len(selected) < MAX_SOURCE_FILES + 20:
        best = None
        best_priority = float('-inf')
        for c in candidates:
            if c['path'] in selected:
                continue
            if c['manifest'] and manifests >= 1:
                continue
            p = priorities[c['path']]
            if p > best_priority:
                best = c
                best_priority = p
        if best is None:
            break
        selected.append(best['path'])
        if best['manifest']:
            manifests += 1
        d, a = best['directory'], best['area']
        directory_counts[d] = directory_counts.get(d, 0) + 1
        area_counts[a] = area_counts.get(a, 0) + 1
        # Apply diversity penalty to siblings
        for c in candidates:
            if c['path'] in selected:
                continue
            penalty = (
                5 * directory_counts.get(c['directory'], 0)
                + 3 * area_counts.get(c['area'], 0)
            )
            priorities[c['path']] = c['score'] - penalty

    return selected


async def collect_architecture_context(
    client: GitHubClient, owner: str, repo_name: str,
) -> tuple[dict[str, str], list[str]]:
    metadata = await client.get_repo(owner, repo_name)
    branch = metadata.get('default_branch', 'main')
    tree = await client.get_file_tree(owner, repo_name, branch)

    size_map = {e['path']: e.get('size', 0) for e in tree if e.get('type') == 'blob'}
    ranked = _rank_source_paths(tree, size_map)

    # Top MAX_SOURCE_FILES get excerpted; rest just listed as file paths
    to_read = ranked[:MAX_SOURCE_FILES]
    file_paths = ranked  # full ranked list for the prompt

    contents = await asyncio.gather(*(
        client.get_file_content(owner, repo_name, path, ref=branch)
        for path in to_read
    ))

    sources: dict[str, str] = {}
    remaining = MAX_SOURCE_CHARACTERS
    for path, content in zip(to_read, contents):
        if content and content.strip() and remaining > 0:
            excerpt = _excerpt(path, content, min(MAX_FILE_CHARACTERS, remaining))
            sources[path] = excerpt
            remaining -= len(excerpt)

    if not any(_SOURCE.search(p) for p in sources):
        raise ValueError('No readable application source files were found for an architecture diagram.')

    return sources, file_paths
