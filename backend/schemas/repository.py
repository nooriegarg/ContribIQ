import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class RepositoryRead(BaseModel):
    id: uuid.UUID
    owner: str
    name: str
    full_name: str
    description: Optional[str]
    stars: int
    forks: int
    open_issues: int
    language: Optional[str]
    topics: Optional[List[str]] = []
    default_branch: str
    latest_sha: Optional[str]
    last_analyzed: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}
