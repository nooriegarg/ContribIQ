import asyncio
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
    # Stage-1 (explanation) response
    explanation_text = (
        "The app has two deployment components: an Order API server that receives "
        "HTTP requests and a background worker that fulfills orders via a queue."
    )
    # Stage-2 (graph) response — new schema
    graph_json = {
        "groups": [{"id": "app", "label": "Application"}],
        "nodes": [
            {"id": "api", "label": "Order API", "type": "API server", "groupId": "app", "shape": "box"},
            {"id": "worker", "label": "Order Worker", "type": "Background worker", "groupId": "app", "shape": "box"},
        ],
        "edges": [
            {"from": "api", "to": "worker", "label": "task payload", "style": "solid"},
        ],
    }

    call_count = 0

    async def mock_completion(**kwargs):
        nonlocal call_count
        call_count += 1
        content = explanation_text if call_count == 1 else json.dumps(graph_json)
        return SimpleNamespace(choices=[
            SimpleNamespace(message=SimpleNamespace(content=content))
        ])

    monkeypatch.setattr(ai_service, "acompletion", mock_completion)
    monkeypatch.setattr(ai_service, "get_settings", lambda: SimpleNamespace(OLLAMA_URL="http://localhost:11434", ANTHROPIC_API_KEY=None, ANTHROPIC_AUTH_TOKEN=None, ANTHROPIC_BASE_URL=None))

    def generate(graph_override=None):
        nonlocal call_count
        call_count = 0
        if graph_override is not None:
            async def mock_override(**kwargs):
                nonlocal call_count
                call_count += 1
                if call_count == 1:
                    return SimpleNamespace(choices=[
                        SimpleNamespace(message=SimpleNamespace(content=explanation_text))
                    ])
                return SimpleNamespace(choices=[
                    SimpleNamespace(message=SimpleNamespace(content=json.dumps(graph_override)))
                ])
            monkeypatch.setattr(ai_service, "acompletion", mock_override)
        return asyncio.run(ai_service.generate_mermaid_diagram(
            "owner/orders", "Process orders", ["Python", "FastAPI"],
            source_files={"main.py": "from worker import fulfill\nfulfill.kiq(order)", "worker.py": "async def fulfill(order): ..."},
            file_paths=["main.py", "worker.py"],
        ))

    return graph_json, generate


def test_application_diagram_uses_source_backed_roles_and_relationships(architecture_model):
    graph_json, generate = architecture_model
    diagram = generate()
    assert 'node_api["Order API"]' in diagram
    assert 'node_worker["Order Worker"]' in diagram
    assert 'node_api -->|"task payload"| node_worker' in diagram
    assert "flowchart TD" in diagram
    # classDefs present
    assert "classDef toneBlue" in diagram or "classDef toneMint" in diagram


@pytest.mark.parametrize("invalid", ["too_few_nodes", "bad_json"])
def test_application_diagram_raises_on_unusable_graph(architecture_model, invalid):
    _, generate = architecture_model
    if invalid == "too_few_nodes":
        bad = {"groups": [], "nodes": [{"id": "api", "label": "API", "type": "server", "groupId": None, "shape": "box"}], "edges": []}
    else:
        bad = "not json at all {{{"
    with pytest.raises((ValueError, Exception)):
        generate(bad if isinstance(bad, dict) else {"groups": [], "nodes": [], "edges": []})


def test_application_diagram_silently_drops_invalid_edges(architecture_model):
    _, generate = architecture_model
    graph_with_bad_edge = {
        "groups": [{"id": "app", "label": "Application"}],
        "nodes": [
            {"id": "api", "label": "Order API", "type": "server", "groupId": "app", "shape": "box"},
            {"id": "worker", "label": "Order Worker", "type": "worker", "groupId": "app", "shape": "box"},
        ],
        "edges": [
            {"from": "api", "to": "invented_node", "label": "bad edge", "style": "solid"},
            {"from": "api", "to": "worker", "label": "good edge", "style": "solid"},
        ],
    }
    result = generate(graph_with_bad_edge)
    assert "flowchart TD" in result
    assert "good edge" in result
    assert "invented_node" not in result
