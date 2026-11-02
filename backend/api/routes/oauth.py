"""
GitHub OAuth2 flow.

GET  /auth/github/login    → redirect to GitHub authorization page
GET  /auth/github/callback → exchange code for token, upsert user, return JWTs

Intentional bug: state is generated on login but never stored or checked
on callback — any state value is accepted. This is a CSRF vulnerability.
Issue: GitHub OAuth callback doesn't validate state param — CSRF vulnerability
Fix: store state in Valkey on login (SET oauth:state:{state} 1 EX 300),
     verify it exists on callback, then delete it.
"""

import secrets

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_settings
from backend.core.jwt import create_access_token, create_refresh_token
from backend.core.tokens import token_response
from backend.db.session import get_db
from backend.models.user import User

router = APIRouter(prefix="/auth", tags=["oauth"])

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"
GITHUB_EMAILS_URL = "https://api.github.com/user/emails"


@router.get("/github/login")
async def github_login():
    """Redirect the user to GitHub to authorize the app."""
    settings = get_settings()
    state = secrets.token_urlsafe(32)

    # BUG: state is generated but never stored — callback accepts any state value
    # Fix would be: await set_key(f"oauth:state:{state}", "1", ttl=300)

    params = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": f"{settings.BACKEND_URL}/auth/github/callback",
        "scope": "read:user user:email",
        "state": state,
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(url=f"{GITHUB_AUTHORIZE_URL}?{query}")


@router.get("/github/callback")
async def github_callback(
    code: str,
    state: str,
    db: AsyncSession = Depends(get_db),
):
    """
    GitHub redirects here after user authorizes.
    Exchange the code for a GitHub access token, fetch user info,
    upsert into our DB, return JWTs.
    """
    settings = get_settings()

    # BUG: state is never validated here — should check Valkey for oauth:state:{state}
    # and raise 400 if not found, then delete the key after validating

    # step 1 — exchange code for GitHub access token
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            GITHUB_TOKEN_URL,
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": f"{settings.BACKEND_URL}/auth/github/callback",
            },
        )

    token_data = token_resp.json()
    github_token = token_data.get("access_token")
    if not github_token:
        raise HTTPException(status_code=400, detail="GitHub did not return an access token")

    # step 2 — fetch GitHub user profile and emails
    gh_headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github+json",
    }
    async with httpx.AsyncClient() as client:
        user_resp = await client.get(GITHUB_USER_URL, headers=gh_headers)
        emails_resp = await client.get(GITHUB_EMAILS_URL, headers=gh_headers)

    if user_resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to fetch GitHub user profile")

    gh_user = user_resp.json()
    gh_emails = emails_resp.json() if emails_resp.status_code == 200 else []

    # pick primary verified email, fall back to public email on profile
    primary_email = gh_user.get("email")
    for entry in gh_emails:
        if entry.get("primary") and entry.get("verified"):
            primary_email = entry["email"]
            break

    if not primary_email:
        raise HTTPException(
            status_code=400,
            detail="No verified email on your GitHub account. Please add one and try again.",
        )

    github_id = str(gh_user["id"])

    # step 3 — upsert user
    result = await db.execute(select(User).where(User.github_id == github_id))
    user = result.scalar_one_or_none()

    if user is None:
        # check if a password-based account already exists with this email
        result = await db.execute(select(User).where(User.email == primary_email))
        user = result.scalar_one_or_none()

    if user is None:
        # brand new user
        user = User(
            email=primary_email,
            github_id=github_id,
            github_username=gh_user.get("login"),
            avatar_url=gh_user.get("avatar_url"),
            name=gh_user.get("name"),
        )
        db.add(user)
    else:
        # returning user — update GitHub fields
        user.github_id = github_id
        user.github_username = gh_user.get("login")
        user.avatar_url = gh_user.get("avatar_url")
        if not user.name and gh_user.get("name"):
            user.name = gh_user.get("name")

    await db.commit()
    await db.refresh(user)

    # step 4 — return JWTs
    # in a real app we'd redirect to frontend with tokens in query params or a cookie
    return token_response(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )
