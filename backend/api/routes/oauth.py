"""
GitHub OAuth2 flow.

GET  /auth/github/login    → redirect to GitHub authorization page
GET  /auth/github/callback → exchange code for token, upsert user, redirect to frontend
"""

import asyncio
import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_settings
from backend.core.jwt import create_access_token, create_refresh_token
from backend.db.session import get_db
from backend.models.user import User
from backend.services.valkey_client import delete_key, key_exists, set_key

router = APIRouter(prefix="/auth", tags=["oauth"])

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"
GITHUB_EMAILS_URL = "https://api.github.com/user/emails"

_TIMEOUT = httpx.Timeout(10.0, connect=5.0)


@router.get("/github/login")
async def github_login():
    """Redirect the user to GitHub to authorize the app."""
    settings = get_settings()
    state = secrets.token_urlsafe(32)
    await set_key(f"oauth:state:{state}", "1", ttl=300)

    params = urlencode({
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": f"{settings.BACKEND_URL}/auth/github/callback",
        "scope": "read:user user:email",
        "state": state,
    })
    return RedirectResponse(url=f"{GITHUB_AUTHORIZE_URL}?{params}")


@router.get("/github/callback")
async def github_callback(
    code: str,
    state: str,
    db: AsyncSession = Depends(get_db),
):
    """
    GitHub redirects here after user authorizes.
    Validate CSRF state, exchange code, upsert user, redirect to frontend with JWTs.
    """
    settings = get_settings()

    if not await key_exists(f"oauth:state:{state}"):
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")
    await delete_key(f"oauth:state:{state}")

    # exchange code for GitHub access token
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
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
            token_resp.raise_for_status()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="GitHub token exchange timed out")
    except httpx.HTTPStatusError:
        raise HTTPException(status_code=502, detail="GitHub token exchange returned an error")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="GitHub token exchange failed")

    token_data = token_resp.json()
    github_token = token_data.get("access_token")
    if not github_token:
        raise HTTPException(status_code=400, detail="GitHub did not return an access token")

    # fetch GitHub user profile and emails in parallel
    gh_headers = {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github+json",
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            user_task = client.get(GITHUB_USER_URL, headers=gh_headers)
            emails_task = client.get(GITHUB_EMAILS_URL, headers=gh_headers)
            user_resp, emails_resp = await asyncio.gather(user_task, emails_task)
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="GitHub API request timed out")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Failed to reach GitHub API")

    if user_resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to fetch GitHub user profile")
    if emails_resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to fetch GitHub user emails")

    gh_user = user_resp.json()
    gh_emails = emails_resp.json()

    # only accept an email GitHub explicitly marks as primary AND verified
    primary_email: str | None = None
    for entry in gh_emails:
        if entry.get("primary") and entry.get("verified"):
            primary_email = entry["email"]
            break

    if not primary_email:
        raise HTTPException(
            status_code=400,
            detail="No verified primary email on your GitHub account. Please verify an email and try again.",
        )

    github_id = str(gh_user["id"])

    # upsert: look up by GitHub ID first, then by email
    result = await db.execute(select(User).where(User.github_id == github_id))
    user = result.scalar_one_or_none()

    if user is None:
        result = await db.execute(select(User).where(User.email == primary_email))
        existing = result.scalar_one_or_none()

        if existing is not None:
            if existing.github_id is not None:
                # email is already claimed by a different GitHub account
                raise HTTPException(
                    status_code=409,
                    detail="This email is already linked to a different GitHub account.",
                )
            # password-based account with matching email — link GitHub to it
            user = existing
        else:
            user = User(
                email=primary_email,
                github_id=github_id,
                github_username=gh_user.get("login"),
                avatar_url=gh_user.get("avatar_url"),
                name=gh_user.get("name"),
            )
            db.add(user)

    # refresh GitHub fields on every login
    user.github_id = github_id
    user.github_username = gh_user.get("login")
    user.avatar_url = gh_user.get("avatar_url")
    if not user.name and gh_user.get("name"):
        user.name = gh_user.get("name")

    await db.commit()
    await db.refresh(user)

    # redirect to frontend SPA — tokens in query params, frontend stores them
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    qs = urlencode({"access_token": access_token, "refresh_token": refresh_token})
    return RedirectResponse(url=f"{settings.FRONTEND_URL}/auth/callback?{qs}")
