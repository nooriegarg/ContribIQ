"""Login requests are throttled per client before database authentication (#33)."""

from fastapi.testclient import TestClient


def test_login_enforces_configurable_per_client_rate_limit(monkeypatch):
    # Application startup is not exercised: requests use a dependency-injected
    # empty session so invalid credentials never touch a live database.
    for name, value in {
        "DATABASE_URL": "postgresql+asyncpg://test:test@localhost/test",
        "SECRET_KEY": "test-secret",
        "GITHUB_CLIENT_ID": "test-client",
        "GITHUB_CLIENT_SECRET": "test-secret",
        "FRONTEND_URL": "http://localhost:3000",
        "LOGIN_RATE_LIMIT": "2/minute",
    }.items():
        monkeypatch.setenv(name, value)

    from backend.core.config import get_settings
    from backend.db.session import get_db
    from backend.main import create_app

    get_settings.cache_clear()

    class EmptySession:
        async def execute(self, _statement):
            class EmptyResult:
                def scalar_one_or_none(self):
                    return None

            return EmptyResult()

    async def fake_get_db():
        yield EmptySession()

    app = create_app()
    app.dependency_overrides[get_db] = fake_get_db
    credentials = {"email": "someone@example.com", "password": "incorrect"}

    try:
        client = TestClient(app, client=("198.51.100.10", 50000))
        assert client.post("/auth/login", json=credentials).status_code == 401
        assert client.post("/auth/login", json=credentials).status_code == 401
        assert client.post("/auth/login", json=credentials).status_code == 429

        # The limit is scoped to the requester's IP, not all clients globally.
        other = TestClient(app, client=("198.51.100.11", 50001))
        assert other.post("/auth/login", json=credentials).status_code == 401
    finally:
        get_settings.cache_clear()
