import pytest
from unittest.mock import AsyncMock, patch


@pytest.fixture(autouse=True)
def set_env(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
    monkeypatch.setenv("SECRET_KEY", "super-secret-test-key-32-chars!!")
    monkeypatch.setenv("GITHUB_CLIENT_ID", "test-client-id")
    monkeypatch.setenv("GITHUB_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setenv("FRONTEND_URL", "http://localhost:3000")
    monkeypatch.setenv("VALKEY_URL", "redis://localhost:6379/0")


@pytest.fixture(autouse=True)
def reset_client():
    import backend.services.valkey_client as vc
    vc._client = None
    yield
    vc._client = None


def _mock_valkey():
    mock = AsyncMock()
    mock.set = AsyncMock()
    mock.get = AsyncMock()
    mock.delete = AsyncMock()
    mock.exists = AsyncMock()
    return mock


@pytest.mark.asyncio
async def test_set_key_stores_value_with_ttl():
    mock = _mock_valkey()
    with patch("backend.services.valkey_client.get_valkey", return_value=mock):
        from backend.services.valkey_client import set_key
        await set_key("mykey", "myvalue", ttl=120)
    mock.set.assert_called_once_with("mykey", "myvalue", ex=120)


@pytest.mark.asyncio
async def test_set_key_uses_default_ttl():
    mock = _mock_valkey()
    with patch("backend.services.valkey_client.get_valkey", return_value=mock):
        from backend.services.valkey_client import set_key
        await set_key("k", "v")
    _, kwargs = mock.set.call_args
    assert kwargs.get("ex") == 300


@pytest.mark.asyncio
async def test_get_key_returns_value():
    mock = _mock_valkey()
    mock.get = AsyncMock(return_value="stored-value")
    with patch("backend.services.valkey_client.get_valkey", return_value=mock):
        from backend.services.valkey_client import get_key
        result = await get_key("mykey")
    assert result == "stored-value"
    mock.get.assert_called_once_with("mykey")


@pytest.mark.asyncio
async def test_get_key_returns_none_on_miss():
    mock = _mock_valkey()
    mock.get = AsyncMock(return_value=None)
    with patch("backend.services.valkey_client.get_valkey", return_value=mock):
        from backend.services.valkey_client import get_key
        result = await get_key("missing")
    assert result is None


@pytest.mark.asyncio
async def test_delete_key_calls_delete():
    mock = _mock_valkey()
    with patch("backend.services.valkey_client.get_valkey", return_value=mock):
        from backend.services.valkey_client import delete_key
        await delete_key("mykey")
    mock.delete.assert_called_once_with("mykey")


@pytest.mark.asyncio
async def test_key_exists_returns_true():
    mock = _mock_valkey()
    mock.exists = AsyncMock(return_value=1)
    with patch("backend.services.valkey_client.get_valkey", return_value=mock):
        from backend.services.valkey_client import key_exists
        result = await key_exists("mykey")
    assert result is True


@pytest.mark.asyncio
async def test_key_exists_returns_false():
    mock = _mock_valkey()
    mock.exists = AsyncMock(return_value=0)
    with patch("backend.services.valkey_client.get_valkey", return_value=mock):
        from backend.services.valkey_client import key_exists
        result = await key_exists("missing")
    assert result is False
