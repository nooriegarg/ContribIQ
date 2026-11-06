import uuid

from sqlalchemy import Column, DateTime, String
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.schema import ForeignKey
from sqlalchemy.sql import func

from backend.db.base import Base


class ContributorProfile(Base):
    __tablename__ = "contributor_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, index=True, nullable=False)

    languages = Column(ARRAY(String), nullable=True, default=[])   # e.g. ["python", "typescript"]
    experience = Column(String, nullable=True, default="beginner")  # "beginner"|"some"|"experienced"
    interests = Column(ARRAY(String), nullable=True, default=[])   # e.g. ["backend", "testing"]

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="profile")
