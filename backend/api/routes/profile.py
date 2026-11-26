from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.routes.auth import get_current_user
from backend.db.session import get_db
from backend.models.profile import ContributorProfile
from backend.models.user import User
from backend.schemas.profile import ProfileRead, ProfileUpdate
from backend.services.valkey_client import get_valkey

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
