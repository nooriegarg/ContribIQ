from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.routes.auth import get_current_user
from backend.db.session import get_db
from backend.models.repository import Repository
from backend.models.user import User
from backend.services.qa_service import ask
from backend.worker.broker import broker

router = APIRouter(prefix="/qa", tags=["qa"])


class AskRequest(BaseModel):
    task_id: str
    question: str


@router.post("/ask")
async def ask_question(
    body: AskRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await broker.result_backend.is_result_ready(body.task_id):
        raise HTTPException(status_code=400, detail="Analysis not complete")

    result = await broker.result_backend.get_result(body.task_id)
    if result.is_err or (result.return_value or {}).get("status") != "completed":
        raise HTTPException(status_code=400, detail="Analysis not complete")

    data = result.return_value or {}
    full_name = f"{data.get('owner', '')}/{data.get('repo', '')}"
    if not data.get("owner") or not data.get("repo"):
        raise HTTPException(status_code=400, detail="Repository identity missing from analysis result")

    row = await db.execute(select(Repository).where(Repository.full_name == full_name))
    repo = row.scalar_one_or_none()
    if repo is None:
        raise HTTPException(
            status_code=404,
            detail="Repository has not been indexed yet. Run the embedding task first.",
        )

    return await ask(db=db, repo_id=str(repo.id), question=body.question)
