"""
Embedding service — chunks source files and stores vectors in PostgreSQL via pgvector.

fastembed model: BAAI/bge-small-en-v1.5 (384 dimensions, lightweight, CPU-friendly)
"""

import uuid
from typing import Any

from fastembed import TextEmbedding
from sqlalchemy.dialects.postgresql import insert

from backend.db.session import AsyncSessionLocal
from backend.models.code_chunk import CodeChunk

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

    rows = [
        {
            "id": uuid.uuid4(),
            "repo_id": repo_id,
            "file_path": path,
            "chunk_index": 0,
            "content": content,
            "embedding": vector,
        }
        for path, content, vector in zip(paths, contents, vectors)
    ]

    async with AsyncSessionLocal() as session:
        stmt = (
            insert(CodeChunk)
            .values(rows)
            .on_conflict_do_nothing()
        )
        await session.execute(stmt)
        await session.commit()

    return {"repo_id": str(repo_id), "chunks_stored": len(rows)}
