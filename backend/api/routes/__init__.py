from fastapi import APIRouter

from backend.api.routes.auth import router as auth_router
from backend.api.routes.profile import router as profile_router
from backend.api.routes.oauth import router as oauth_router

router = APIRouter()

router.include_router(auth_router)
router.include_router(profile_router)
router.include_router(oauth_router)
