"""
GitHub OAuth2 flow.

GET  /auth/github/login    → redirect to GitHub authorization page
GET  /auth/github/link     → (authenticated) start GitHub linking for email-only users
GET  /auth/github/callback → exchange code for token, upsert/link user, redirect to frontend
"""

import asyncio
import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.routes.auth import get_current_user
from backend.core.config import get_settings
from backend.core.jwt import create_access_token, create_refresh_token
from backend.db.session import get_db
from backend.models.user import User
from backend.services.valkey_client import delete_key, get_key, key_exists, set_key

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
    await set_key(f"oauth:state:{state}", "login", ttl=300)

    params = urlencode({
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": f"{settings.BACKEND_URL}/auth/github/callback",
        "scope": "read:user user:email",
        "state": state,
    })
    return RedirectResponse(url=f"{GITHUB_AUTHORIZE_URL}?{params}")


@router.get("/github/link")
async def github_link(
    token: str,
    redirect: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Start the GitHub linking flow for an already-authenticated email-only user.
    The access token is passed as a query param so it can be embedded in the redirect URL
    without requiring the user to be in a session that persists through the OAuth round-trip.
    Optional `redirect` param: frontend path to return to after linking (e.g. /overview/abc/prs).
    """
    settings = get_settings()

    # Validate the token inline (we can't use the dependency here since there's no Bearer header)
    from backend.core.jwt import decode_token
    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user = await db.get(User, __import__("uuid").UUID(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")

    if user.github_id:
        raise HTTPException(status_code=409, detail="GitHub account already linked")

    state = secrets.token_urlsafe(32)
    # Store "link:<user_id>:<redirect_path>" so the callback knows this is a link
    state_value = f"link:{user.id}:{redirect}" if redirect else f"link:{user.id}:"
    await set_key(f"oauth:state:{state}", state_value, ttl=300)

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
    Validate CSRF state, exchange code, upsert/link user, redirect to frontend with JWTs.
    """
    settings = get_settings()

    state_value = await get_key(f"oauth:state:{state}")
    if state_value is None:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")
    await delete_key(f"oauth:state:{state}")

    # Determine mode: "login" (or old "1") = normal login, "link:<user_id>:<redirect>" = account linking
    link_user_id: str | None = None
    link_redirect: str | None = None
    if isinstance(state_value, (bytes, str)):
        sv = state_value.decode() if isinstance(state_value, bytes) else state_value
        if sv.startswith("link:"):
            # format: "link:<user_id>:<redirect_path>" (redirect_path may be empty)
            parts = sv[len("link:"):].split(":", 1)
            link_user_id = parts[0]
            link_redirect = parts[1] if len(parts) > 1 and parts[1] else None

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

    # ── Link-mode: attach GitHub to an existing user ──────────────────────────
    if link_user_id:
        import uuid as uuid_module
        try:
            user = await db.get(User, uuid_module.UUID(link_user_id))
        except Exception:
            user = None

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Make sure this GitHub account isn't already claimed by someone else
        result = await db.execute(select(User).where(User.github_id == github_id))
        existing_gh = result.scalar_one_or_none()
        if existing_gh and str(existing_gh.id) != link_user_id:
            raise HTTPException(
                status_code=409,
                detail="This GitHub account is already linked to a different user.",
            )

        user.github_id = github_id
        user.github_username = gh_user.get("login")
        if not user.avatar_url:
            user.avatar_url = gh_user.get("avatar_url")
        if not user.name and gh_user.get("name"):
            user.name = gh_user.get("name")

        await db.commit()
        await db.refresh(user)

        await set_key(f"gh-token:{user.id}", github_token, ttl=86400)

        qs_data: dict[str, str] = {"linked": "true", "github_token": github_token}
        if link_redirect:
            qs_data["redirect"] = link_redirect
        qs = urlencode(qs_data)
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/auth/callback?{qs}")

    # ── Normal login/signup mode ───────────────────────────────────────────────
    result = await db.execute(select(User).where(User.github_id == github_id))
    user = result.scalar_one_or_none()

    if user is None:
        result = await db.execute(select(User).where(User.email == primary_email))
        existing = result.scalar_one_or_none()

        if existing is not None:
            if existing.github_id is not None:
                raise HTTPException(
                    status_code=409,
                    detail="This email is already linked to a different GitHub account.",
                )
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

    user.github_id = github_id
    user.github_username = gh_user.get("login")
    user.avatar_url = gh_user.get("avatar_url")
    if not user.name and gh_user.get("name"):
        user.name = gh_user.get("name")

    await db.commit()
    await db.refresh(user)

    await set_key(f"gh-token:{user.id}", github_token, ttl=86400)

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    qs = urlencode({"access_token": access_token, "refresh_token": refresh_token, "github_token": github_token})
    return RedirectResponse(url=f"{settings.FRONTEND_URL}/auth/callback?{qs}")
