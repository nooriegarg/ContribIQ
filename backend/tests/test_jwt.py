import pytest
from fastapi import HTTPException
from uuid import uuid4


@pytest.fixture(autouse=True)
def set_env(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
    monkeypatch.setenv("SECRET_KEY", "super-secret-test-key-32-chars!!")
    monkeypatch.setenv("GITHUB_CLIENT_ID", "test-client-id")
    monkeypatch.setenv("GITHUB_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setenv("FRONTEND_URL", "http://localhost:3000")


def test_create_access_token_returns_string():
    from backend.core.jwt import create_access_token
    token = create_access_token(uuid4())
    assert isinstance(token, str)
    assert len(token) > 0


def test_create_refresh_token_returns_string():
    from backend.core.jwt import create_refresh_token
    token = create_refresh_token(uuid4())
    assert isinstance(token, str)


def test_decode_access_token_contains_sub():
    from backend.core.jwt import create_access_token, decode_token
    user_id = uuid4()
    token = create_access_token(user_id)
    payload = decode_token(token)
    assert payload["sub"] == str(user_id)


def test_decode_access_token_has_correct_type():
    from backend.core.jwt import create_access_token, decode_token
    token = create_access_token(uuid4())
    payload = decode_token(token)
    assert payload["type"] == "access"


def test_decode_refresh_token_has_correct_type():
    from backend.core.jwt import create_refresh_token, decode_token
    token = create_refresh_token(uuid4())
    payload = decode_token(token)
    assert payload["type"] == "refresh"


def test_decode_invalid_token_raises_401():
    from backend.core.jwt import decode_token
    with pytest.raises(HTTPException) as exc:
        decode_token("not.a.valid.token")
    assert exc.value.status_code == 401


def test_access_and_refresh_tokens_are_different():
    from backend.core.jwt import create_access_token, create_refresh_token
    user_id = uuid4()
    access = create_access_token(user_id)
    refresh = create_refresh_token(user_id)
    assert access != refresh
