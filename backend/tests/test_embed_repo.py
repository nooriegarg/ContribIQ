import asyncio
import importlib
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest


@pytest.fixture
def embed(monkeypatch):
    from backend.core import config

    monkeypatch.setattr(config, "get_settings", lambda: SimpleNamespace(
        DATABASE_URL="postgresql+asyncpg://test:test@localhost/test",
        VALKEY_URL="redis://localhost:6379/0",
        GITHUB_TOKEN="settings-gh-token",
    ))
    return importlib.import_module("backend.worker.tasks.embed_repo")


def _repo_id():
    return str(uuid.uuid4())


def test_embed_repository_falls_back_to_settings_token(embed, monkeypatch):
    captured = {}

    class MockClient:
        def __init__(self, token=None): captured["token"] = token
        async def __aenter__(self): return self
        async def __aexit__(self, *a): pass
        async def get_file_content(self, *a): return None

    monkeypatch.setattr(embed, "GitHubClient", MockClient)
    monkeypatch.setattr(embed, "embed_files", AsyncMock(return_value={}))

    asyncio.run(embed.embed_repository(_repo_id(), "owner", "repo", [], github_token=None))

    assert captured["token"] == "settings-gh-token"


def test_embed_repository_prefers_explicit_token_over_settings(embed, monkeypatch):
    captured = {}

    class MockClient:
        def __init__(self, token=None): captured["token"] = token
        async def __aenter__(self): return self
        async def __aexit__(self, *a): pass
        async def get_file_content(self, *a): return None

    monkeypatch.setattr(embed, "GitHubClient", MockClient)
    monkeypatch.setattr(embed, "embed_files", AsyncMock(return_value={}))

    asyncio.run(embed.embed_repository(_repo_id(), "owner", "repo", [], github_token="user-token"))

    assert captured["token"] == "user-token"


def test_embed_repository_skips_non_text_extensions(embed, monkeypatch):
    file_tree = [
        {"type": "blob", "path": "image.png"},
        {"type": "blob", "path": "binary.exe"},
        {"type": "blob", "path": "main.py"},
        {"type": "blob", "path": "app.ts"},
    ]
    client = AsyncMock()
    client.__aenter__.return_value = client
    client.get_file_content.return_value = "content"

    monkeypatch.setattr(embed, "GitHubClient", lambda **kw: client)
    monkeypatch.setattr(embed, "embed_files", AsyncMock(return_value={}))

    asyncio.run(embed.embed_repository(_repo_id(), "owner", "repo", file_tree))

    fetched = [c.args[2] for c in client.get_file_content.await_args_list]
    assert "image.png" not in fetched
    assert "binary.exe" not in fetched
    assert "main.py" in fetched
    assert "app.ts" in fetched


def test_embed_repository_skips_files_over_size_limit(embed, monkeypatch):
    file_tree = [{"type": "blob", "path": "big.py"}]
    client = AsyncMock()
    client.__aenter__.return_value = client
    client.get_file_content.return_value = "x" * 100_001

    captured: dict = {}
    async def fake_embed(repo_id, files): captured.update(files); return {}

    monkeypatch.setattr(embed, "GitHubClient", lambda **kw: client)
    monkeypatch.setattr(embed, "embed_files", fake_embed)

    asyncio.run(embed.embed_repository(_repo_id(), "owner", "repo", file_tree))

    assert "big.py" not in captured


def test_embed_repository_skips_non_blob_tree_entries(embed, monkeypatch):
    file_tree = [
        {"type": "tree", "path": "src"},
        {"type": "blob", "path": "README.md"},
    ]
    client = AsyncMock()
    client.__aenter__.return_value = client
    client.get_file_content.return_value = "# Hello"

    monkeypatch.setattr(embed, "GitHubClient", lambda **kw: client)
    monkeypatch.setattr(embed, "embed_files", AsyncMock(return_value={}))

    asyncio.run(embed.embed_repository(_repo_id(), "owner", "repo", file_tree))

    fetched = [c.args[2] for c in client.get_file_content.await_args_list]
    assert "src" not in fetched
    assert "README.md" in fetched


def test_embed_repository_continues_after_fetch_error(embed, monkeypatch):
    file_tree = [
        {"type": "blob", "path": "broken.py"},
        {"type": "blob", "path": "good.py"},
    ]
    client = AsyncMock()
    client.__aenter__.return_value = client
    client.get_file_content.side_effect = [Exception("404"), "def foo(): pass"]

    captured: dict = {}
    async def fake_embed(repo_id, files): captured.update(files); return {}

    monkeypatch.setattr(embed, "GitHubClient", lambda **kw: client)
    monkeypatch.setattr(embed, "embed_files", fake_embed)

    asyncio.run(embed.embed_repository(_repo_id(), "owner", "repo", file_tree))

    assert "broken.py" not in captured
    assert "good.py" in captured
