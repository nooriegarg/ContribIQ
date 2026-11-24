import pytest


@pytest.fixture(autouse=True)
def set_env(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")
    monkeypatch.setenv("SECRET_KEY", "super-secret-test-key-32-chars!!")
    monkeypatch.setenv("GITHUB_CLIENT_ID", "test-client-id")
    monkeypatch.setenv("GITHUB_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setenv("FRONTEND_URL", "http://localhost:3000")


# passlib bcrypt requires the bcrypt C extension which is incompatible with
# Python 3.14 locally; these tests are designed to run in CI with Python 3.12.
pytestmark = pytest.mark.skipif(
    __import__("sys").version_info >= (3, 14),
    reason="passlib bcrypt not compatible with Python 3.14",
)


def test_hash_password_returns_hashed_string():
    from backend.core.security import hash_password
    hashed = hash_password("mysecretpassword")
    assert hashed != "mysecretpassword"
    assert hashed.startswith("$2")


def test_verify_password_correct():
    from backend.core.security import hash_password, verify_password
    hashed = hash_password("correct-password")
    assert verify_password("correct-password", hashed) is True


def test_verify_password_wrong():
    from backend.core.security import hash_password, verify_password
    hashed = hash_password("correct-password")
    assert verify_password("wrong-password", hashed) is False


def test_hash_password_different_hashes_for_same_input():
    from backend.core.security import hash_password
    h1 = hash_password("same")
    h2 = hash_password("same")
    assert h1 != h2
