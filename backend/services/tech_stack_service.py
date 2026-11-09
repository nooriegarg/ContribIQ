from typing import Any


_FILE_RULES: list[tuple[str, str]] = [
    ("requirements.txt", "Python"),
    ("pyproject.toml", "Python"),
    ("setup.py", "Python"),
    ("package.json", "Node.js"),
    ("tsconfig.json", "TypeScript"),
    (".tsx", "React"),
    (".ts", "TypeScript"),
    ("go.mod", "Go"),
    ("Cargo.toml", "Rust"),
    ("pom.xml", "Java"),
    ("build.gradle", "Java"),
    ("Gemfile", "Ruby"),
    ("composer.json", "PHP"),
    ("docker-compose.yml", "Docker"),
    ("Dockerfile", "Docker"),
    (".github/workflows/", "GitHub Actions"),
]

_DIR_RULES: list[tuple[list[str], str]] = [
    (["src", "lib", "pkg"], "Application source code"),
    (["tests", "test", "spec", "__tests__"], "Test suite"),
    (["docs", "doc", "documentation"], "Documentation source"),
    (["cmd", "bin"], "Application entry points"),
    (["scripts", ".github/workflows"], "CI/CD and tooling scripts"),
    (["migrations", "alembic", "db/migrations"], "Database migrations"),
    (["frontend", "client", "web", "ui"], "Frontend application"),
    (["backend", "server", "api"], "Backend application"),
]


def detect_tech_stack(file_tree: list[dict[str, Any]]) -> list[str]:
    names = {entry.get("path", "") for entry in file_tree}

    detected: list[str] = []
    seen: set[str] = set()

    for pattern, tech in _FILE_RULES:
        if tech in seen:
            continue
        if pattern.startswith("."):
            if any(n.endswith(pattern) for n in names):
                detected.append(tech)
                seen.add(tech)
        else:
            if any(pattern in n for n in names):
                detected.append(tech)
                seen.add(tech)

    return detected


def map_directories(file_tree: list[dict[str, Any]]) -> list[dict[str, str]]:
    top_dirs = {
        entry["path"].split("/")[0]
        for entry in file_tree
        if "/" in entry.get("path", "") and entry.get("type") == "tree"
    }

    result: list[dict[str, str]] = []
    matched: set[str] = set()

    for patterns, description in _DIR_RULES:
        for pattern in patterns:
            if pattern in top_dirs and pattern not in matched:
                result.append({"directory": f"/{pattern}", "description": description})
                matched.add(pattern)
                break

    return result
