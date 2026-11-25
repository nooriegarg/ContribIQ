"""
Embedding service — chunks source files and stores vectors in PostgreSQL via pgvector.

fastembed model: BAAI/bge-small-en-v1.5 (384 dimensions, lightweight, CPU-friendly)
"""

import uuid
from typing import Any

from fastembed import TextEmbedding
from sqlalchemy import text

from backend.db.session import AsyncSessionLocal

_MODEL_NAME = "BAAI/bge-small-en-v1.5"
_DIMS = 384

_embedder: TextEmbedding | None = None


def _get_embedder() -> TextEmbedding:
    global _embedder
    if _embedder is None:
        _embedder = TextEmbedding(model_name=_MODEL_NAME)
    return _embedder


def _embed(texts: list[str]) -> list[list[float]]:
    embedder = _get_embedder()
    return [vec.tolist() for vec in embedder.embed(texts)]


async def embed_files(
    repo_id: uuid.UUID,
    files: dict[str, str],
) -> dict[str, Any]:
    if not files:
        return {"repo_id": str(repo_id), "chunks_stored": 0}

    paths = list(files.keys())
    contents = [files[p] for p in paths]

    vectors = _embed(contents)

    async with AsyncSessionLocal() as session:
        # Register vector codec on the raw asyncpg connection before inserting
        raw_conn = await session.connection()
        await raw_conn.run_sync(
            lambda sync_conn: sync_conn.connection.run_async(
                __import__('pgvector.asyncpg', fromlist=['register_vector']).register_vector
            )
        )
        for path, content, vector in zip(paths, contents, vectors):
            await session.execute(
                text(
                    "INSERT INTO code_chunks (id, repo_id, file_path, chunk_index, content, embedding) "
                    "VALUES (:id, :repo_id, :file_path, :chunk_index, :content, :embedding) "
                    "ON CONFLICT DO NOTHING"
                ),
                {
                    "id": str(uuid.uuid4()),
                    "repo_id": str(repo_id),
                    "file_path": path,
                    "chunk_index": 0,
                    "content": content,
                    "embedding": vector,
                },
            )
        await session.commit()

    return {"repo_id": str(repo_id), "chunks_stored": len(paths)}
