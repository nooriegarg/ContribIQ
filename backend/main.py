from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core.config import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: DB engine and cache connections will be initialised here in later commits
    yield
    # Shutdown: clean up connections here in later commits


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="ContribIQ API",
        description="AI-powered open-source contributor onboarding assistant",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.FRONTEND_URL],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    from backend.api.routes import router
    app.include_router(router)

    return app


app = create_app()


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok"}
