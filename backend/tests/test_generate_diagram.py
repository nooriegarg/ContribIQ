import asyncio
import importlib
import inspect
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest


@pytest.fixture
def diagram(monkeypatch):
    mod = importlib.import_module("backend.worker.tasks.generate_diagram")
    monkeypatch.setattr(mod, "get_settings", lambda: SimpleNamespace(
        GITHUB_TOKEN="settings-gh-token",
    ))
    return mod


def test_generate_diagram_has_no_github_token_parameter(diagram):
    task = diagram.generate_diagram
    fn = getattr(task, "original_func", getattr(task, "__wrapped__", task))
    sig = inspect.signature(fn)
    assert "github_token" not in sig.parameters


def test_generate_diagram_passes_settings_token_to_github_client(diagram, monkeypatch):
    captured = {}

    class MockClient:
        def __init__(self, token=None):
            captured["token"] = token
        async def __aenter__(self): return self
        async def __aexit__(self, *a): pass

    monkeypatch.setattr(diagram, "GitHubClient", MockClient)
    monkeypatch.setattr(diagram, "collect_architecture_context",
                        AsyncMock(return_value=({"main.py": "x"}, ["main.py"])))
    monkeypatch.setattr(diagram, "generate_mermaid_diagram",
                        AsyncMock(return_value="graph TD; A-->B"))

    asyncio.run(diagram.generate_diagram("owner", "repo", None, []))

    assert captured["token"] == "settings-gh-token"


def test_generate_diagram_returns_expected_shape(diagram, monkeypatch):
    monkeypatch.setattr(diagram, "GitHubClient", _noop_client())
    monkeypatch.setattr(diagram, "collect_architecture_context",
                        AsyncMock(return_value=({"a.py": "pass"}, ["a.py"])))
    monkeypatch.setattr(diagram, "generate_mermaid_diagram",
                        AsyncMock(return_value="graph LR; X-->Y"))

    result = asyncio.run(diagram.generate_diagram("org", "app", "desc", ["Python"]))

    assert result["mermaid_syntax"] == "graph LR; X-->Y"
    assert result["status"] == "completed"
    assert "a.py" in result["source_files"]


def test_generate_diagram_forwards_description_and_tech_stack(diagram, monkeypatch):
    gen = AsyncMock(return_value="graph TD;")
    monkeypatch.setattr(diagram, "GitHubClient", _noop_client())
    monkeypatch.setattr(diagram, "collect_architecture_context",
                        AsyncMock(return_value=({}, [])))
    monkeypatch.setattr(diagram, "generate_mermaid_diagram", gen)

    asyncio.run(diagram.generate_diagram("owner", "repo", "A REST API", ["Go", "Postgres"]))

    _, kwargs = gen.call_args
    assert kwargs["description"] == "A REST API"
    assert kwargs["tech_stack"] == ["Go", "Postgres"]
    assert kwargs["repo_name"] == "owner/repo"


def _noop_client():
    class _Client:
        def __init__(self, token=None): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): pass
    return _Client
