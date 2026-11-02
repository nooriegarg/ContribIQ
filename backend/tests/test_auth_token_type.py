"""Auth token responses include the OAuth2 token_type field (#36)."""

from backend.core.tokens import TOKEN_TYPE, token_response


def test_token_type_is_bearer():
    assert TOKEN_TYPE == "bearer"


def test_register_login_shape_includes_token_type():
    payload = token_response(access_token="a", refresh_token="r")
    assert payload == {
        "access_token": "a",
        "refresh_token": "r",
        "token_type": "bearer",
    }


def test_refresh_shape_includes_token_type_without_refresh_token():
    payload = token_response(access_token="a")
    assert payload == {"access_token": "a", "token_type": "bearer"}
    assert "refresh_token" not in payload
