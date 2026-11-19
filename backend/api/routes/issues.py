from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.routes.auth import get_current_user
from backend.db.session import get_db
from backend.models.user import User
from backend.services.issue_detail_service import get_issue_detail

router = APIRouter(prefix="/issues", tags=["issues"])


@router.get("/{issue_number}/detail")
async def issue_detail(
    issue_number: int,
    owner: str = Query(..., description="Repository owner"),
    repo: str = Query(..., description="Repository name"),
    github_token: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo_full_name = f"{owner}/{repo}"
    detail = await get_issue_detail(
        db=db,
        repo_full_name=repo_full_name,
        issue_number=issue_number,
        github_token=github_token,
    )
    if detail is None:
        raise HTTPException(
            status_code=404,
            detail=f"Issue #{issue_number} not found in {repo_full_name}. "
                   "Run an analysis first to score issues.",
        )
    return detail
