import asyncio
import copy
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from backend.services.architecture_service import collect_architecture_context
from backend.services import ai_service


def _client(contents):
    return SimpleNamespace(
        get_repo=AsyncMock(return_value={"default_branch": "develop"}),
        get_file_tree=AsyncMock(return_value=[
            {"path": path, "type": "blob", "size": len(content)}
            for path, content in contents.items()
        ]),
        get_file_content=AsyncMock(side_effect=lambda _owner, _repo, path, **_kwargs: contents[path]),
    )


def test_context_reads_application_wiring_and_excludes_irrelevant_or_oversized_files():
    client = _client({
        "README.md": "An order processing application.",
        "backend/main.py": "from orders import router\napp.include_router(router)",
        "frontend/src/App.tsx": "export default function App() { return <OrderBrowser /> }",
        "tests/test_main.py": "test fixture",
        "mock-ui/demo.tsx": "mock application",
        ".env.example": "not source evidence",
        "generated.py": "x" * 100_001,
    })
    sources, paths = asyncio.run(collect_architecture_context(client, "owner", "repo"))
    assert set(sources) == {"README.md", "backend/main.py", "frontend/src/App.tsx"}
    assert "app.include_router(router)" in sources["backend/main.py"]
    assert set(paths) == set(sources)
    assert sum(map(len, sources.values())) <= 5000
    for call in client.get_file_content.await_args_list:
        assert call.kwargs == {"ref": "develop"}


def test_documentation_without_application_source_does_not_produce_a_stack_fallback():
    with pytest.raises(ValueError, match="application source"):
        asyncio.run(collect_architecture_context(_client({"README.md": "Uses Python and React."}), "owner", "repo"))


def test_source_fetch_failure_propagates():
    client = _client({"main.py": "app.run()"})
    client.get_file_content.side_effect = PermissionError("Repository source unavailable")
    with pytest.raises(PermissionError, match="unavailable"):
        asyncio.run(collect_architecture_context(client, "owner", "repo"))


@pytest.fixture
def architecture_model(monkeypatch):
    graph = {
        "components": [
            {"id": "api", "label": "Order API", "source_file": "main.py"},
            {"id": "worker", "label": "Order Fulfillment Worker", "source_file": "worker.py"},
        ],
        "connections": [
            {"source": "api", "target": "worker", "label": "Dispatches orders", "source_file": "main.py"},
        ],
    }
    completion = AsyncMock()
    monkeypatch.setattr(ai_service, "acompletion", completion)
    monkeypatch.setattr(ai_service, "get_settings", lambda: SimpleNamespace(OLLAMA_URL="http://localhost:11434"))

    def generate(value):
        completion.return_value = SimpleNamespace(choices=[
            SimpleNamespace(message=SimpleNamespace(content=json.dumps(value))),
        ])
        return asyncio.run(ai_service.generate_mermaid_diagram(
            "owner/orders", "Process orders", ["Python", "FastAPI"],
            source_files={"main.py": "from worker import fulfill\nfulfill.kiq(order)", "worker.py": "async def fulfill(order): ..."},
            file_paths=["main.py", "worker.py"],
        ))

    return graph, generate, completion


def test_application_diagram_uses_source_backed_roles_and_relationships(architecture_model):
    graph, generate, completion = architecture_model
    diagram = generate(graph)
    assert 'N0["Order API"]' in diagram
    assert 'N1["Order Fulfillment Worker"]' in diagram
    assert "N0 -->|Dispatches orders| N1" in diagram
    assert "Python" not in diagram and "FastAPI" not in diagram
    prompt = completion.call_args.kwargs["messages"][1]["content"]
    assert "fulfill.kiq(order)" in prompt and "worker.py" in prompt


@pytest.mark.parametrize("invalid", ["component_source", "connection_source", "unknown_component", "technology_node", "disconnected_node"])
def test_application_diagram_rejects_ungrounded_or_stack_only_output(architecture_model, invalid):
    original, generate, _ = architecture_model
    graph = copy.deepcopy(original)
    if invalid == "component_source":
        graph["components"][0]["source_file"] = "unread.py"
    elif invalid == "connection_source":
        graph["connections"][0]["source_file"] = "unread.py"
    elif invalid == "unknown_component":
        graph["connections"][0]["target"] = "invented-database"
    elif invalid == "technology_node":
        graph["components"][0]["label"] = "Python"
    else:
        graph["components"].append({"id": "unused", "label": "Unused Service", "source_file": "main.py"})
    with pytest.raises(ValueError):
        generate(graph)
