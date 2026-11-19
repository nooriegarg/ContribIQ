from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.routes.auth import get_current_user
from backend.db.session import get_db
from backend.models.user import User
from backend.services.qa_service import ask

router = APIRouter(prefix="/qa", tags=["qa"])


class AskRequest(BaseModel):
    repo_id: str
    question: str


@router.post("/ask")
async def ask_question(
    body: AskRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ask(db=db, repo_id=body.repo_id, question=body.question)
