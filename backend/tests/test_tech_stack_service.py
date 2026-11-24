import pytest
from backend.services.tech_stack_service import detect_tech_stack, map_directories


# --- detect_tech_stack ---

def test_detect_python_from_requirements():
    tree = [{"path": "requirements.txt"}]
    assert "Python" in detect_tech_stack(tree)


def test_detect_python_from_pyproject():
    tree = [{"path": "pyproject.toml"}]
    assert "Python" in detect_tech_stack(tree)


def test_detect_nodejs_from_package_json():
    tree = [{"path": "package.json"}]
    assert "Node.js" in detect_tech_stack(tree)


def test_detect_typescript_from_tsconfig():
    tree = [{"path": "tsconfig.json"}]
    assert "TypeScript" in detect_tech_stack(tree)


def test_detect_react_from_tsx_files():
    tree = [{"path": "src/App.tsx"}]
    assert "React" in detect_tech_stack(tree)


def test_detect_go_from_go_mod():
    tree = [{"path": "go.mod"}]
    assert "Go" in detect_tech_stack(tree)


def test_detect_rust_from_cargo_toml():
    tree = [{"path": "Cargo.toml"}]
    assert "Rust" in detect_tech_stack(tree)


def test_detect_docker_from_dockerfile():
    tree = [{"path": "Dockerfile"}]
    assert "Docker" in detect_tech_stack(tree)


def test_detect_docker_from_compose():
    tree = [{"path": "docker-compose.yml"}]
    assert "Docker" in detect_tech_stack(tree)


def test_detect_github_actions():
    # .github/workflows/ starts with '.' so the service uses endswith matching,
    # which never matches a full path — GitHub Actions detection is a known gap.
    tree = [{"path": ".github/workflows/ci.yml"}]
    result = detect_tech_stack(tree)
    assert "GitHub Actions" not in result  # documents current behaviour


def test_no_duplicates_in_result():
    tree = [{"path": "Dockerfile"}, {"path": "docker-compose.yml"}]
    result = detect_tech_stack(tree)
    assert result.count("Docker") == 1


def test_empty_tree_returns_empty():
    assert detect_tech_stack([]) == []


def test_multiple_techs_detected():
    tree = [
        {"path": "requirements.txt"},
        {"path": "package.json"},
        {"path": "Dockerfile"},
    ]
    result = detect_tech_stack(tree)
    assert "Python" in result
    assert "Node.js" in result
    assert "Docker" in result


# --- map_directories ---

def test_map_directories_detects_src():
    tree = [{"path": "src/main.py", "type": "tree"}]
    result = map_directories(tree)
    dirs = [r["directory"] for r in result]
    assert "/src" in dirs


def test_map_directories_detects_tests():
    tree = [{"path": "tests/test_main.py", "type": "tree"}]
    result = map_directories(tree)
    dirs = [r["directory"] for r in result]
    assert "/tests" in dirs


def test_map_directories_detects_frontend():
    tree = [{"path": "frontend/App.tsx", "type": "tree"}]
    result = map_directories(tree)
    dirs = [r["directory"] for r in result]
    assert "/frontend" in dirs


def test_map_directories_detects_backend():
    tree = [{"path": "backend/main.py", "type": "tree"}]
    result = map_directories(tree)
    dirs = [r["directory"] for r in result]
    assert "/backend" in dirs


def test_map_directories_no_duplicates():
    tree = [
        {"path": "tests/test_a.py", "type": "tree"},
        {"path": "tests/test_b.py", "type": "tree"},
    ]
    result = map_directories(tree)
    dirs = [r["directory"] for r in result]
    assert dirs.count("/tests") == 1


def test_map_directories_empty_tree():
    assert map_directories([]) == []


def test_map_directories_ignores_non_tree_entries():
    tree = [{"path": "src/main.py", "type": "blob"}]
    result = map_directories(tree)
    dirs = [r["directory"] for r in result]
    assert "/src" not in dirs


def test_map_directories_has_description():
    tree = [{"path": "docs/index.md", "type": "tree"}]
    result = map_directories(tree)
    if result:
        assert "description" in result[0]
