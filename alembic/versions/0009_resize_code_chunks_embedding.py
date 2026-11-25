"""resize code_chunks embedding from vector(768) to vector(384)

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-25
"""

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE code_chunks ALTER COLUMN embedding TYPE vector(384)")


def downgrade() -> None:
    op.execute("ALTER TABLE code_chunks ALTER COLUMN embedding TYPE vector(768)")
