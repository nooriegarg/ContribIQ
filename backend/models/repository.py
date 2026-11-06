import uuid

from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.sql import func

from backend.db.base import Base


class Repository(Base):
    __tablename__ = "repositories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    full_name = Column(String(511), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    stars = Column(Integer, nullable=False, default=0)
    forks = Column(Integer, nullable=False, default=0)
    open_issues = Column(Integer, nullable=False, default=0)
    language = Column(String(100), nullable=True)
    topics = Column(ARRAY(String), nullable=True, default=list)
    default_branch = Column(String(255), nullable=False, default="main")
    latest_sha = Column(String(40), nullable=True)
    last_analyzed = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
