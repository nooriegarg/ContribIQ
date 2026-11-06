from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.routes.auth import get_current_user
from backend.db.session import get_db
from backend.models.profile import ContributorProfile
from backend.models.user import User
from backend.schemas.profile import ProfileRead, ProfileUpdate

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
    return profile
