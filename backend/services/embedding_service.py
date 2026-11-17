"""
Embedding service — chunks source files and stores vectors in PostgreSQL via pgvector.

fastembed model: nomic-embed-code (768 dimensions, code-optimised, CPU-only)

Intentional bug: each file is embedded as a single chunk. Large files silently
exceed fastembed's 512-token limit — only the first ~100 lines are actually embedded.

Issue to raise: "Files embedded without chunking — large files silently truncated"
Fix: 50-line sliding window chunks with 10-line overlap, each chunk = separate CodeChunk row
"""

import uuid
from typing import Any

from fastembed import TextEmbedding
from sqlalchemy.dialects.postgresql import insert

from backend.db.session import AsyncSessionLocal
from backend.models.code_chunk import CodeChunk

_MODEL_NAME = "nomic-ai/nomic-embed-code"
_DIMS = 768

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
    # BUG: each file embedded as one chunk — large files exceed 512-token limit
    # Fix: split each file into 50-line windows with 10-line overlap
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
