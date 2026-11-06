import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class ProfileRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    languages: List[str]
    experience: str
    interests: List[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    languages: Optional[List[str]] = None
    experience: Optional[str] = None
    interests: Optional[List[str]] = None
