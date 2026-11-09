"""The GitHub OAuth routes are reachable through the main API router (#47)."""

from backend.api.routes import router


def test_oauth_routes_are_registered():
    assert str(router.url_path_for("github_login")) == "/auth/github/login"
    assert str(router.url_path_for("github_callback")) == "/auth/github/callback"
