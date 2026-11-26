"""
Tests for token_response() in core/tokens.py.

token_response() builds the OAuth2 token payload returned by auth routes.
"""

from backend.core.tokens import TOKEN_TYPE, token_response


def test_token_response_contains_access_token():
    result = token_response(access_token="abc123")
    assert result["access_token"] == "abc123"


def test_token_response_token_type_is_bearer():
    result = token_response(access_token="abc123")
    assert result["token_type"] == "bearer"


def test_token_type_constant_is_bearer():
    assert TOKEN_TYPE == "bearer"


def test_token_response_includes_refresh_token_when_provided():
    result = token_response(access_token="abc", refresh_token="xyz")
    assert result["refresh_token"] == "xyz"


def test_token_response_excludes_refresh_token_when_not_provided():
    result = token_response(access_token="abc")
    assert "refresh_token" not in result


def test_token_response_exact_keys_without_refresh():
    result = token_response(access_token="abc")
    assert set(result.keys()) == {"access_token", "token_type"}


def test_token_response_exact_keys_with_refresh():
    result = token_response(access_token="abc", refresh_token="xyz")
    assert set(result.keys()) == {"access_token", "token_type", "refresh_token"}


def test_token_response_refresh_token_none_excluded():
    result = token_response(access_token="abc", refresh_token=None)
    assert "refresh_token" not in result
