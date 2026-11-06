"""SQLAlchemy models.

Importing this package registers every model on ``Base.metadata``. Alembic's
environment imports it so autogenerate sees the full schema; without that
import the metadata is empty and a diff against an existing database proposes
dropping every table.
"""

from backend.models.user import User
from backend.models.profile import ContributorProfile

__all__ = ["User", "ContributorProfile"]
