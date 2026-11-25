"""
Tests for POST /qa/ask — the route now accepts task_id and resolves the
repository UUID server-side rather than requiring callers to know the DB UUID.
"""
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture
def qa_client(monkeypatch):
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
    from backend.api.routes import qa

    app = FastAPI()
    app.include_router(qa.router)
    app.dependency_overrides[qa.get_current_user] = lambda: SimpleNamespace(id="test-user")
    try:
        yield TestClient(app), qa
    finally:
        get_settings.cache_clear()


def _make_completed_result(owner: str = "psf", repo: str = "requests"):
    return SimpleNamespace(
        is_err=False,
        return_value={"status": "completed", "owner": owner, "repo": repo},
    )


def _stub_broker(monkeypatch, routes, result):
    backend = SimpleNamespace(
        is_result_ready=AsyncMock(return_value=True),
        get_result=AsyncMock(return_value=result),
    )
    monkeypatch.setattr(routes.broker, "result_backend", backend)
    return backend


def _stub_db(monkeypatch, routes, repo_id: str | None = "00000000-0000-0000-0000-000000000001"):
    repo = SimpleNamespace(id=repo_id) if repo_id else None
    scalar_result = MagicMock()
    scalar_result.scalar_one_or_none.return_value = repo
    db_session = MagicMock()
    db_session.execute = AsyncMock(return_value=scalar_result)
    app_ref = routes.router
    return db_session


def test_qa_ask_resolves_task_id_to_repo_and_calls_qa_service(qa_client, monkeypatch):
    client, routes = qa_client
    _stub_broker(monkeypatch, routes, _make_completed_result())
    repo = SimpleNamespace(id="00000000-0000-0000-0000-000000000001")
    scalar_result = MagicMock()
    scalar_result.scalar_one_or_none.return_value = repo
    db_session = MagicMock()
    db_session.execute = AsyncMock(return_value=scalar_result)
    qa_mock = AsyncMock(return_value={"answer": "It uses OAuth.", "sources": ["auth.py"]})
    monkeypatch.setattr(routes, "ask", qa_mock)
    client.app.dependency_overrides[routes.get_db] = lambda: db_session
    response = client.post("/qa/ask", json={"task_id": "some-task-id", "question": "How does auth work?"})
    assert response.status_code == 200
    qa_mock.assert_awaited_once_with(
        db=db_session,
        repo_id="00000000-0000-0000-0000-000000000001",
        question="How does auth work?",
    )


def test_qa_ask_returns_404_when_task_result_not_ready(qa_client, monkeypatch):
    client, routes = qa_client
    backend = SimpleNamespace(
        is_result_ready=AsyncMock(return_value=False),
        get_result=AsyncMock(),
    )
    monkeypatch.setattr(routes.broker, "result_backend", backend)
    response = client.post("/qa/ask", json={"task_id": "not-ready", "question": "What?"})
    assert response.status_code == 400
    assert "not complete" in response.json()["detail"].lower()


def test_qa_ask_returns_400_when_analysis_failed(qa_client, monkeypatch):
    client, routes = qa_client
    failed_result = SimpleNamespace(is_err=True, return_value={"status": "failed"})
    _stub_broker(monkeypatch, routes, failed_result)
    response = client.post("/qa/ask", json={"task_id": "failed-task", "question": "What?"})
    assert response.status_code == 400


def test_qa_ask_returns_404_when_repo_not_in_database(qa_client, monkeypatch):
    client, routes = qa_client
    _stub_broker(monkeypatch, routes, _make_completed_result())
    scalar_result = MagicMock()
    scalar_result.scalar_one_or_none.return_value = None
    db_session = MagicMock()
    db_session.execute = AsyncMock(return_value=scalar_result)
    client.app.dependency_overrides[routes.get_db] = lambda: db_session
    response = client.post("/qa/ask", json={"task_id": "some-task-id", "question": "What?"})
    assert response.status_code == 404
    assert "not been indexed" in response.json()["detail"]
