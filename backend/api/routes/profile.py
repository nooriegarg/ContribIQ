import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.routes.auth import get_current_user
from backend.db.session import get_db
from backend.models.profile import ContributorProfile
from backend.models.user import User
from backend.schemas.profile import ProfileRead, ProfileUpdate
from backend.services.valkey_client import get_valkey
from backend.services.github_client import GitHubClient

router = APIRouter(prefix="/users/me", tags=["profile"])


@router.get("/profile", response_model=ProfileRead)
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ContributorProfile).where(ContributorProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()

    if profile is None:
        profile = ContributorProfile(user_id=current_user.id, languages=[], interests=[])
        db.add(profile)
        await db.commit()
        await db.refresh(profile)

    return profile


async def _bust_matches_cache(user_id: str) -> None:
    """Delete all cached match results for this user so the next visit re-scores with the new profile."""
    client = get_valkey()
    pattern = f"matches:*:{user_id}"
    cursor = 0
    while True:
        cursor, keys = await client.scan(cursor, match=pattern, count=100)
        if keys:
            await client.delete(*keys)
        if cursor == 0:
            break


@router.put("/profile", response_model=ProfileRead)
async def update_profile(
    body: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ContributorProfile).where(ContributorProfile.user_id == current_user.id)
    )
    profile = result.scalar_one_or_none()

    if profile is None:
        profile = ContributorProfile(user_id=current_user.id)
        db.add(profile)

    if body.languages is not None:
        profile.languages = body.languages
    if body.experience is not None:
        if body.experience not in ("beginner", "some", "experienced"):
            raise HTTPException(status_code=422, detail="experience must be 'beginner', 'some', or 'experienced'")
        profile.experience = body.experience
    if body.interests is not None:
        profile.interests = body.interests

    await db.commit()
    await db.refresh(profile)

    await _bust_matches_cache(str(current_user.id))

    return profile


@router.get("/prs")
async def get_my_prs(
    github_token: str | None = Query(None),
    state: str = Query("open"),
    current_user: User = Depends(get_current_user),
):
    username = current_user.github_username
    if not username:
        return []

    allowed_states = {"open", "closed", "all"}
    pr_state = state if state in allowed_states else "open"

    async with GitHubClient(token=github_token) as client:
        try:
            prs = await client.get_user_prs(username, state=pr_state)
        except Exception:
            return []

    async def _enrich(pr: dict) -> dict:
        repo_url = pr.get("repository_url", "")
        parts = repo_url.rstrip("/").split("/")
        owner, repo = (parts[-2], parts[-1]) if len(parts) >= 2 else ("", "")

        # GitHub Search API already includes pull_request.merged_at — use it directly
        merged_at: str | None = (pr.get("pull_request") or {}).get("merged_at")

        checks: list[dict] = []
        if owner and repo:
            try:
                async with GitHubClient(token=github_token) as c:
                    pr_detail = await c._http.get(
                        f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr['number']}",
                        headers=c._auth_headers(),
                    )
                    if pr_detail.status_code == 200:
                        detail_json = pr_detail.json()
                        # Only override merged_at if the detail call succeeds and has a value
                        if detail_json.get("merged_at"):
                            merged_at = detail_json["merged_at"]
                        head_sha = detail_json.get("head", {}).get("sha")
                        if head_sha:
                            checks = await c.get_check_runs(owner, repo, head_sha)
            except Exception:
                pass

        overall = _summarise_checks(checks)
        return {
            "number": pr["number"],
            "title": pr["title"],
            "url": pr.get("html_url"),
            "repo": f"{owner}/{repo}" if owner else "",
            "state": pr.get("state", "open"),
            "merged_at": merged_at,
            "draft": pr.get("draft", False),
            "created_at": pr.get("created_at"),
            "updated_at": pr.get("updated_at"),
            "ci_status": overall,
            "checks": [
                {
                    "name": c["name"],
                    "status": c["status"],
                    "conclusion": c.get("conclusion"),
                    "url": c.get("html_url"),
                }
                for c in checks[:10]
            ],
        }

    enriched = await asyncio.gather(*[_enrich(pr) for pr in prs])
    return list(enriched)


def _summarise_checks(checks: list[dict]) -> str:
    if not checks:
        return "pending"
    conclusions = [c.get("conclusion") for c in checks if c.get("status") == "completed"]
    statuses = [c.get("status") for c in checks]
    if any(s in ("in_progress", "queued") for s in statuses):
        return "running"
    if any(c in ("failure", "timed_out", "action_required") for c in conclusions):
        return "failure"
    if all(c == "success" for c in conclusions) and conclusions:
        return "success"
    return "pending"
