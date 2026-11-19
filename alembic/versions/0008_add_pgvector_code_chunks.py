"""enable pgvector extension and create code_chunks table

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-19
"""

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.execute("""
        CREATE TABLE code_chunks (
            id          UUID         PRIMARY KEY,
            repo_id     UUID         NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
            file_path   VARCHAR(1024) NOT NULL,
            chunk_index INTEGER      NOT NULL,
            content     TEXT         NOT NULL,
            embedding   vector(768)  NOT NULL
        )
    """)

    op.execute("CREATE INDEX ix_code_chunks_repo_id ON code_chunks (repo_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_code_chunks_repo_id")
    op.execute("DROP TABLE IF EXISTS code_chunks")
