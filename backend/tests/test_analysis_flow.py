import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture
def analysis_client(monkeypatch):
    for key, value in {
        "DATABASE_URL": "postgresql+asyncpg://test:test@localhost/test",
        "SECRET_KEY": "test-secret",
        "GITHUB_CLIENT_ID": "test-client",
        "GITHUB_CLIENT_SECRET": "test-secret",
        "FRONTEND_URL": "http://localhost:5173",
    }.items():
        monkeypatch.setenv(key, value)
    from backend.core.config import get_settings
    get_settings.cache_clear()
    from backend.api.routes import analysis

    app = FastAPI()
    app.include_router(analysis.router)
    app.dependency_overrides[analysis.get_current_user] = lambda: SimpleNamespace(id="test-user")
    try:
        yield TestClient(app), analysis
    finally:
        get_settings.cache_clear()


def test_start_analysis_enqueues_repository(analysis_client, monkeypatch):
    client, routes = analysis_client
    enqueue = AsyncMock(return_value=SimpleNamespace(task_id="test-task"))
    monkeypatch.setattr(routes.analyze_repository, "kiq", enqueue)
    response = client.post("/analysis/start", json={"owner": "psf", "repo": "requests"})
    assert response.status_code == 200
    assert response.json() == {"task_id": "test-task"}
    enqueue.assert_awaited_once_with(owner="psf", repo_name="requests", github_token=None)


@pytest.mark.parametrize("error", [ConnectionError(), TimeoutError()])
def test_unavailable_queue_returns_actionable_error(analysis_client, monkeypatch, error):
    client, routes = analysis_client
    monkeypatch.setattr(routes.analyze_repository, "kiq", AsyncMock(side_effect=error))
    response = client.post("/analysis/start", json={"owner": "psf", "repo": "requests"})
    assert response.status_code == 503
    assert "queue is unavailable" in response.json()["detail"]


def test_task_result_checks_readiness_before_fetching(analysis_client, monkeypatch):
    _, routes = analysis_client
    backend = SimpleNamespace(is_result_ready=AsyncMock(return_value=False), get_result=AsyncMock())
    monkeypatch.setattr(routes.broker, "result_backend", backend)
    assert asyncio.run(routes._get_task_result("task")) is None
    backend.get_result.assert_not_awaited()
    backend.is_result_ready.return_value = True
    result = SimpleNamespace(return_value={"status": "completed"}, is_err=False)
    backend.get_result.return_value = result
    assert asyncio.run(routes._get_task_result("task")) is result


def test_stream_waits_for_result_then_reports_success(analysis_client, monkeypatch):
    client, routes = analysis_client
    data = {"status": "completed", "steps": [{"step": "metadata", "status": "done"}]}
    monkeypatch.setattr(routes, "_get_task_result", AsyncMock(side_effect=[
        None, SimpleNamespace(is_err=False, return_value=data),
    ]))
    monkeypatch.setattr(routes.asyncio, "sleep", AsyncMock())
    response = client.get("/analysis/stream/task")
    assert response.status_code == 200
    assert "event: waiting" in response.text
    assert "event: progress" in response.text
    assert "event: done" in response.text


@pytest.mark.parametrize("task_error", [False, True])
def test_failed_task_never_emits_success(analysis_client, monkeypatch, task_error):
    client, routes = analysis_client
    result = SimpleNamespace(is_err=task_error, return_value={
        "status": "failed",
        "steps": [{"step": "metadata", "status": "error", "data": {"error": "Repository unavailable"}}],
    })
    monkeypatch.setattr(routes, "_get_task_result", AsyncMock(return_value=result))
    monkeypatch.setattr(routes.asyncio, "sleep", AsyncMock())
    response = client.get("/analysis/stream/task")
    assert "event: error" in response.text
    assert "event: done" not in response.text
    assert client.get("/analysis/result/task").status_code == 500


def test_stream_requires_authentication(analysis_client):
    client, _ = analysis_client
    client.app.dependency_overrides.clear()
    assert client.get("/analysis/stream/task").status_code == 401


def test_worker_discovers_all_tasks_on_shared_broker(analysis_client):
    from backend.worker.broker import broker
    from backend.worker.tasks import analyze_repository, generate_diagram, score_issues
    from taskiq_redis import RedisAsyncResultBackend

    assert isinstance(broker.result_backend, RedisAsyncResultBackend)
    assert all(task.broker is broker for task in (analyze_repository, generate_diagram, score_issues))


def test_diagram_job_receives_repository_identity_for_source_collection(analysis_client, monkeypatch):
    client, routes = analysis_client
    monkeypatch.setattr(routes, "_get_task_result", AsyncMock(return_value=SimpleNamespace(
        is_err=False, return_value={
            "status": "completed", "owner": "example", "repo": "orders",
            "metadata": {"description": "Order processing"}, "tech_stack": ["Python"],
        },
    )))
    monkeypatch.setattr(routes, "get_key", AsyncMock(return_value=None))
    monkeypatch.setattr(routes, "set_key", AsyncMock())
    enqueue = AsyncMock(return_value=SimpleNamespace(task_id="diagram-task"))
    monkeypatch.setattr(routes.generate_diagram, "kiq", enqueue)
    response = client.post("/analysis/analysis-task/diagram")
    assert response.status_code == 200
    enqueue.assert_awaited_once_with(
        owner="example", repo_name="orders", description="Order processing", tech_stack=["Python"], github_token=None,
    )


def test_diagram_rejects_analysis_without_repository_identity(analysis_client, monkeypatch):
    client, routes = analysis_client
    monkeypatch.setattr(routes, "_get_task_result", AsyncMock(return_value=SimpleNamespace(
        is_err=False, return_value={"status": "completed", "tech_stack": ["Python"]},
    )))
    enqueue = AsyncMock()
    monkeypatch.setattr(routes.generate_diagram, "kiq", enqueue)
    assert client.post("/analysis/analysis-task/diagram").status_code == 400
    enqueue.assert_not_awaited()
