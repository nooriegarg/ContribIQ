"""The GitHub OAuth routes are reachable through the main API router (#47)."""

from backend.api.routes import router


def test_oauth_routes_are_registered():
    paths = {r.path for r in router.routes}
    assert "/auth/github/login" in paths
    assert "/auth/github/callback" in paths
