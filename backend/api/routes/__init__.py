from fastapi import APIRouter

router = APIRouter()

# Route modules will be included here as they are built in subsequent commits
# e.g. from backend.api.routes.auth import router as auth_router
#      router.include_router(auth_router, prefix="/auth", tags=["auth"])
