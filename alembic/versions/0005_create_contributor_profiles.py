"""create contributor_profiles table

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-06
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "contributor_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("languages", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("experience", sa.String(), nullable=True, server_default="beginner"),
        sa.Column("interests", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_contributor_profiles_user_id", "contributor_profiles", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_contributor_profiles_user_id", table_name="contributor_profiles")
    op.drop_table("contributor_profiles")
