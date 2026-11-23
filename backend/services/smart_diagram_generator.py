"""
Repository-derived architecture diagram.

Nothing here assumes a particular layout: components are the repo's own directories,
edges come from resolved imports between them, infrastructure comes from compose files,
and external systems come from a keyword table matched against real file contents.
"""
import posixpath
import re
from collections import Counter, defaultdict
from typing import Any

_SOURCE_SUFFIXES = (".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".kt", ".go", ".rs", ".cs", ".rb", ".php", ".vue", ".svelte")
_NOISE_PARTS = {"src", "main", "java", "kotlin", "scala", "python", "lib", "app"}
_COMPOSE_NAMES = {"docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"}
_MAX_COMPONENTS = 22
_MAX_EDGES = 45

_EXTERNAL = {
    "GitHub API": ("api.github.com", "githubclient", "octokit", "pygithub"),
    "Ollama": ("ollama",),
    "OpenAI": ("openai",),
    "Anthropic": ("anthropic",),
    "Stripe": ("stripe",),
    "PostgreSQL": ("postgres", "psycopg", "asyncpg", "pgvector"),
    "MySQL": ("mysql",),
    "MongoDB": ("mongodb", "pymongo", "mongoose"),
    "SQLite": ("sqlite",),
    "Redis/Valkey": ("redis", "valkey"),
    "Kafka": ("kafka",),
    "RabbitMQ": ("rabbitmq", "amqp"),
    "AWS": ("boto3", "aws-sdk", "amazonaws"),
    "Elasticsearch": ("elasticsearch", "opensearch"),
}

_ROLE_HINTS = (
    ("api", ("route", "router", "controller", "endpoint", "handler", "api", "view")),
    ("async", ("worker", "task", "job", "queue", "consumer")),
    ("data", ("model", "schema", "entity", "db", "database", "migration", "repositor", "store")),
    ("ui", ("component", "page", "screen", "ui", "hook", "template")),
    ("logic", ("service", "core", "domain", "usecase", "manager", "engine")),
)


def _node_id(prefix: str, name: str) -> str:
    return f"{prefix}_{re.sub(r'[^0-9A-Za-z]', '_', name)}"


def _label(text: str) -> str:
    return text.replace('"', "'")


def _dir_parts(path: str) -> list[str]:
    return [p for p in path.split("/")[:-1] if p.lower() not in _NOISE_PARTS]


def _choose_depth(paths: list[str]) -> int:
    for depth in range(1, 5):
        if len({tuple(_dir_parts(p)[:depth]) for p in paths}) >= 6:
            return depth
    return 4


def _component(path: str, depth: int) -> str:
    parts = _dir_parts(path)[:depth]
    return "/".join(parts) if parts else "(root)"


def _role(name: str) -> str:
    lowered = name.lower()
    for role, hints in _ROLE_HINTS:
        if any(h in lowered for h in hints):
            return role
    return "other"


def _build_resolver(paths: list[str]):
    keys: dict[str, str] = {}
    for path in paths:
        stem = path.rsplit(".", 1)[0]
        keys[stem] = path
        base = posixpath.basename(stem)
        if base in {"__init__", "index", "mod"}:
            keys.setdefault(posixpath.dirname(stem), path)
    suffix_keys = sorted(keys, key=len)

    def dotted(module: str) -> str | None:
        parts = module.split(".")
        while parts:
            key = "/".join(parts)
            if key in keys:
                return keys[key]
            hit = next((k for k in suffix_keys if k.endswith("/" + key)), None)
            if hit:
                return keys[hit]
            parts.pop()
        return None

    def relative(source: str, target: str) -> str | None:
        return keys.get(posixpath.normpath(posixpath.join(posixpath.dirname(source), target)))

    return dotted, relative


_EVIDENCE_LINE = re.compile(r"^.*(?:^\s*(?:from|import)\s|require\(|from\s+['\"]|https?://|image:).*$", re.MULTILINE)
_PY_IMPORT = re.compile(r"^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))", re.MULTILINE)
_JS_IMPORT = re.compile(r"""(?:from\s+|import\s*\(\s*|require\(\s*)['"](\.{1,2}/[^'"]+)['"]""")
_JVM_IMPORT = re.compile(r"^\s*import\s+(?:static\s+)?([\w.]+?)(?:\.\*)?;?\s*$", re.MULTILINE)


def _imports(path: str, content: str, dotted, relative) -> set[str]:
    found: set[str] = set()
    if path.endswith(".py"):
        for a, b in _PY_IMPORT.findall(content):
            target = dotted(a or b)
            if target:
                found.add(target)
    elif path.endswith((".ts", ".tsx", ".js", ".jsx", ".vue", ".svelte")):
        for rel in _JS_IMPORT.findall(content):
            target = relative(path, rel)
            if target:
                found.add(target)
    elif path.endswith((".java", ".kt", ".scala")):
        for mod in _JVM_IMPORT.findall(content):
            target = dotted(mod)
            if target:
                found.add(target)
    return found


def _parse_compose(sources: dict[str, str]) -> tuple[dict[str, dict[str, str]], list[tuple[str, str]]]:
    services: dict[str, dict[str, str]] = {}
    deps: list[tuple[str, str]] = []
    for path, content in sources.items():
        if posixpath.basename(path) not in _COMPOSE_NAMES:
            continue
        current = None
        in_services = False
        in_depends = False
        in_build = False
        for line in content.splitlines():
            if re.match(r"^services:\s*$", line):
                in_services = True
                continue
            if in_services and re.match(r"^\S", line):
                in_services = False
            if not in_services:
                continue
            match = re.match(r"^  ([\w.-]+):\s*$", line)
            if match:
                current, in_depends, in_build = match.group(1), False, False
                services[current] = {"image": "", "build": "", "command": ""}
                continue
            if current is None:
                continue
            entry = services[current]
            image = re.match(r"^    image:\s*(\S+)", line)
            if image:
                entry["image"] = image.group(1).split("/")[-1].split(":")[0]
            build = re.match(r"^    build:\s*(\S*)", line)
            if build:
                entry["build"] = build.group(1) or "."
                in_build = not build.group(1)
                continue
            if in_build:
                ctx = re.match(r"^      context:\s*(\S+)", line)
                if ctx:
                    entry["build"] = ctx.group(1)
                if re.match(r"^    \S", line):
                    in_build = False
            command = re.match(r"^    command:\s*(.+)", line)
            if command:
                entry["command"] = command.group(1).strip("[]\"' ")
            if re.match(r"^    depends_on:", line):
                in_depends = True
                deps.extend((current, d) for d in re.findall(r"[\w.-]+", line.split(":", 1)[1]))
                continue
            if in_depends:
                item = re.match(r"^      (?:- )?([\w.-]+)\s*:?\s*$", line)
                if item:
                    deps.append((current, item.group(1)))
                elif re.match(r"^    \S", line):
                    in_depends = False
    return services, [(a, b) for a, b in deps if b in services]


_SEG_NOISE = {"api", "v1", "v2", "v3"}
_PY_PREFIX = re.compile(r"prefix\s*=\s*[\"']([^\"']*)")
_PY_ROUTE = re.compile(r"@\w+\.(?:get|post|put|delete|patch|route|api_route)\(\s*[\"']([^\"']*)")
_JS_ROUTE = re.compile(r"\b(?:router|app)\.(?:get|post|put|delete|patch|use)\(\s*['\"`](/[^'\"`]*)")
_JVM_ROUTE = re.compile(r"@(?:Get|Post|Put|Delete|Patch|Request)Mapping\(\s*(?:value\s*=\s*)?[\"']([^\"']*)")
_CLIENT_CALL = re.compile(
    r"(?:fetch|axios(?:\.\w+)?|apiCall|\$http\.\w+|http\.\w+|api\.\w+|request)\s*(?:<[^>()]*>)?\(\s*([`'\"])([^`'\"]+)\1"
)


def _segments(path: str) -> list[str]:
    path = re.sub(r"\$\{[^}]*\}", "{}", path).split("?")[0]
    segs = [s for s in path.split("/") if s]
    while segs and (segs[0] == "{}" or segs[0].lower() in _SEG_NOISE):
        segs.pop(0)
    return segs


def _first_static(segs: list[str]) -> str | None:
    return next((s for s in segs if not s.startswith(("{", ":", "<"))), None)


def _route_index(source_files: dict[str, str], comp_of: dict[str, str]) -> dict[str, set[str]]:
    index: dict[str, set[str]] = defaultdict(set)
    for path, content in source_files.items():
        comp = comp_of.get(path)
        if not comp:
            continue
        routes: list[str] = []
        if path.endswith(".py"):
            prefix = (_PY_PREFIX.search(content) or [None, ""])[1]
            routes = [prefix + r for r in _PY_ROUTE.findall(content)]
        elif path.endswith((".js", ".ts")):
            routes = _JS_ROUTE.findall(content)
        elif path.endswith((".java", ".kt")):
            routes = _JVM_ROUTE.findall(content)
        for route in routes:
            first = _first_static(_segments(route))
            if first:
                index[first].add(comp)
    return index


def _http_edges(source_files: dict[str, str], comp_of: dict[str, str], routes: dict[str, set[str]]) -> Counter:
    edges: Counter = Counter()
    if not routes:
        return edges
    for path, content in source_files.items():
        comp = comp_of.get(path)
        if not comp or not path.endswith((".ts", ".tsx", ".js", ".jsx", ".vue", ".svelte")):
            continue
        for _, literal in _CLIENT_CALL.findall(content):
            if literal.startswith("http") or not literal.startswith(("/", "${")):
                continue
            first = _first_static(_segments(literal))
            for target in routes.get(first or "", ()):
                if target != comp:
                    edges[(comp, target)] += 1
    return edges


def _map_compose(services, dotted, comp_of, components) -> dict[str, str]:
    runs: dict[str, str] = {}
    for name, info in services.items():
        comp = None
        for token in re.findall(r"[\w./-]+", info["command"]):
            target = dotted(token.split(":")[0].rsplit(".py", 1)[0].replace("/", "."))
            if target and target in comp_of:
                comp = comp_of[target]
                break
        if not comp and info["build"] and info["build"] not in {".", "./"}:
            ctx = posixpath.normpath(info["build"])
            matches = [c for c in components if c == ctx or c.startswith(ctx + "/")]
            comp = ctx if ctx in matches else max(matches, key=lambda c: len(components[c]), default=None)
        if comp:
            runs[name] = comp
    return runs


def analyze_architecture(source_files: dict[str, str], all_paths: list[str]) -> dict[str, Any]:
    paths = sorted({p for p in all_paths if p.endswith(_SOURCE_SUFFIXES)} | {p for p in source_files if p.endswith(_SOURCE_SUFFIXES)})
    depth = _choose_depth(paths)
    comp_of = {p: _component(p, depth) for p in paths}

    files_by_comp: dict[str, list[str]] = defaultdict(list)
    for path, comp in comp_of.items():
        files_by_comp[comp].append(path)
    ranked = [c for c, _ in sorted(files_by_comp.items(), key=lambda kv: -len(kv[1]))]
    kept = set(ranked[:_MAX_COMPONENTS])
    for path, comp in list(comp_of.items()):
        if comp not in kept:
            comp_of[path] = "(other)"
            files_by_comp["(other)"].append(path)
    components = {c: files_by_comp[c] for c in kept | ({"(other)"} if "(other)" in set(comp_of.values()) else set())}

    dotted, relative = _build_resolver(paths)
    edges: Counter = Counter()
    for path, content in source_files.items():
        if path not in comp_of:
            continue
        for target in _imports(path, content, dotted, relative):
            src_c, dst_c = comp_of[path], comp_of.get(target)
            if dst_c and src_c != dst_c:
                edges[(src_c, dst_c)] += 1

    external: dict[str, Counter] = defaultdict(Counter)
    for path, content in source_files.items():
        # Only imports, URLs and compose entries count as evidence of an external system
        lowered = "\n".join(_EVIDENCE_LINE.findall(content)).lower()
        comp = comp_of.get(path)
        for label, keywords in _EXTERNAL.items():
            hits = sum(lowered.count(k) for k in keywords)
            if hits and comp:
                external[label][comp] += hits

    compose_services, compose_deps = _parse_compose(source_files)
    runs = _map_compose(compose_services, dotted, comp_of, components)
    http = _http_edges(source_files, comp_of, _route_index(source_files, comp_of))

    # Each external system hangs off the single component that uses it most; compose images stand in for it when present
    ext_targets: dict[str, tuple[str, str]] = {}
    for label, counts in external.items():
        keywords = _EXTERNAL[label]
        service = next((n for n, i in compose_services.items() if any(k in (i["image"] + n).lower() for k in keywords)), None)
        ext_targets[label] = (counts.most_common(1)[0][0], service or "")

    referenced = {c for pair in edges for c in pair} | {c for pair in http for c in pair} | set(runs.values()) | {c for c, _ in ext_targets.values()}
    components = {c: f for c, f in components.items() if len(f) > 2 or c in referenced}
    return {
        "components": components,
        "edges": [(e, w) for e, w in edges.most_common(_MAX_EDGES) if e[0] in components and e[1] in components],
        "http_edges": list({e[1]: (e, w) for e, w in reversed(http.most_common()) if e[0] in components and e[1] in components}.values()),
        "ext_targets": {k: v for k, v in ext_targets.items() if v[0] in components},
        "compose_services": compose_services,
        "compose_deps": compose_deps,
        "compose_runs": {k: v for k, v in runs.items() if v in components},
    }


_ROLE_TEXT = {
    "api": "HTTP routes / API", "async": "background jobs", "data": "models & persistence",
    "ui": "user interface", "logic": "business logic", "other": "",
}


def generate_mermaid_diagram(repo_name: str, analysis: dict[str, Any]) -> str:
    components: dict[str, list[str]] = analysis["components"]
    compose = analysis["compose_services"]
    runs = analysis["compose_runs"]
    lines = ["flowchart LR"]

    groups: dict[str, list[str]] = defaultdict(list)
    for comp in sorted(components):
        groups[comp.split("/")[0]].append(comp)

    role_by_node: dict[str, str] = {}
    for top, comps in groups.items():
        multi = len(comps) > 1
        if multi:
            lines.append(f'    subgraph {_node_id("g", top)}["{_label(top)}"]')
            lines.append("        direction TB")
        for comp in comps:
            files = components[comp]
            stems = sorted({posixpath.basename(f).rsplit(".", 1)[0] for f in files} - {"__init__", "index"})
            shown = ", ".join(stems[:3]) + (" …" if len(stems) > 3 else "")
            title = "root files" if multi and comp == top else comp.split("/", 1)[1] if multi else comp
            role = _role(comp)
            parts = [f"<b>{_label(title)}</b>"]
            if _ROLE_TEXT[role]:
                parts.append(f"<i>{_ROLE_TEXT[role]}</i>")
            parts.append(f"{len(files)} files" + (f": {_label(shown)}" if shown else ""))
            node = _node_id("n", comp)
            lines.append(f'        {node}["{"<br/>".join(parts)}"]')
            role_by_node[node] = role
        if multi:
            lines.append("    end")

    for (src, dst), weight in analysis["edges"]:
        label = f"|{weight}|" if weight > 1 else ""
        lines.append(f'    {_node_id("n", src)} -->{label} {_node_id("n", dst)}')
    for (src, dst), _ in analysis["http_edges"]:
        lines.append(f'    {_node_id("n", src)} ==>|HTTP| {_node_id("n", dst)}')

    if compose:
        lines.append('    subgraph infra["Runtime services (compose)"]')
        lines.append("        direction TB")
        for name, info in compose.items():
            if info["build"] or info["command"] and not info["image"]:
                lines.append(f'        {_node_id("s", name)}(["{_label(name)}<br/>container"])')
            else:
                lines.append(f'        {_node_id("s", name)}[("{_label(name)}<br/>{_label(info["image"])}")]')
        lines.append("    end")
        for a, b in analysis["compose_deps"]:
            lines.append(f'    {_node_id("s", a)} -.->|depends on| {_node_id("s", b)}')
        for name, comp in runs.items():
            lines.append(f'    {_node_id("s", name)} -.->|runs| {_node_id("n", comp)}')

    standalone = {k: v for k, v in analysis["ext_targets"].items() if not v[1]}
    if standalone:
        lines.append('    subgraph ext["External systems"]')
        lines.append("        direction TB")
        for label in standalone:
            lines.append(f'        {_node_id("x", label)}{{{{"{_label(label)}"}}}}')
        lines.append("    end")
    for label, (comp, service) in analysis["ext_targets"].items():
        target = _node_id("s", service) if service else _node_id("x", label)
        lines.append(f'    {_node_id("n", comp)} -.->|uses| {target}')

    lines.extend([
        "    classDef api fill:#e3f2fd,stroke:#1565c0,color:#000",
        "    classDef logic fill:#f3e5f5,stroke:#6a1b9a,color:#000",
        "    classDef data fill:#e8f5e9,stroke:#2e7d32,color:#000",
        "    classDef async fill:#fff3e0,stroke:#ef6c00,color:#000",
        "    classDef ui fill:#e0f7fa,stroke:#00838f,color:#000",
        "    classDef other fill:#f5f5f5,stroke:#757575,color:#000",
    ])
    for role in ("api", "logic", "data", "async", "ui", "other"):
        nodes = [n for n, r in role_by_node.items() if r == role]
        if nodes:
            lines.append(f"    class {','.join(nodes)} {role}")
    return "\n".join(lines)


def analyze_code_structure(source_files: dict[str, str], file_tree: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    return analyze_architecture(source_files, [e["path"] for e in file_tree or []])


def generate_mermaid_from_analysis(repo_name: str, analysis: dict[str, Any]) -> str:
    return generate_mermaid_diagram(repo_name, analysis)
