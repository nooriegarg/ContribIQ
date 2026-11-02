"""Shared OAuth2 token response shape for auth routes."""

TOKEN_TYPE = "bearer"


def token_response(*, access_token: str, refresh_token: str | None = None) -> dict:
    payload = {"access_token": access_token, "token_type": TOKEN_TYPE}
    if refresh_token is not None:
        payload["refresh_token"] = refresh_token
    return payload
