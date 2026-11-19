"""
Q&A service — RAG pipeline for the "Explain This Codebase" feature.

Pipeline:
  1. Embed the question with fastembed (same model used for code chunks)
  2. Retrieve top-10 most similar code chunks from pgvector for this repo
  3. Assemble context greedily — stop when the 6,000-token budget is reached
  4. Answer via LiteLLM (Ollama)
  5. Return { answer, sources }
"""

import uuid
from typing import Any

from litellm import acompletion, token_counter
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_settings
from backend.services.embedding_service import _embed

_MODEL = "ollama/qwen2.5-coder:7b"
_TOP_K = 10
_TOKEN_BUDGET = 6_000

_QA_PROMPT = """\
You are a helpful assistant that answers questions about a software codebase.
Answer based only on the source code snippets provided below.
If the answer is not evident from the code, say so clearly.

{context}

Question: {question}
"""


async def _retrieve_chunks(
    db: AsyncSession,
    repo_id: uuid.UUID,
    question_vector: list[float],
) -> list[dict[str, str]]:
    vec_str = f"[{','.join(str(x) for x in question_vector)}]"
    result = await db.execute(
        text("""
            SELECT file_path, content
            FROM code_chunks
            WHERE repo_id = :repo_id
            ORDER BY embedding <=> CAST(:vec AS vector)
            LIMIT :k
        """),
        {"repo_id": str(repo_id), "vec": vec_str, "k": _TOP_K},
    )
    return [{"file_path": row.file_path, "content": row.content} for row in result]


def _build_context(chunks: list[dict[str, str]]) -> tuple[str, list[str]]:
    parts: list[str] = []
    sources: list[str] = []
    total_tokens = 0

    for chunk in chunks:
        snippet = f"# {chunk['file_path']}\n{chunk['content']}\n"
        snippet_tokens = token_counter(model=_MODEL, text=snippet)
        if total_tokens + snippet_tokens > _TOKEN_BUDGET:
            break
        parts.append(snippet)
        sources.append(chunk["file_path"])
        total_tokens += snippet_tokens

    return "\n".join(parts), sources


async def ask(
    db: AsyncSession,
    repo_id: str,
    question: str,
) -> dict[str, Any]:
    settings = get_settings()

    question_vector = _embed([question])[0]
    chunks = await _retrieve_chunks(db, uuid.UUID(repo_id), question_vector)

    if not chunks:
        return {
            "answer": "No code has been embedded for this repository yet. "
                      "Run the embedding task first.",
            "sources": [],
        }

    context, sources = _build_context(chunks)

    response = await acompletion(
        model=_MODEL,
        api_base=settings.OLLAMA_URL,
        messages=[{"role": "user", "content": _QA_PROMPT.format(
            context=context,
            question=question,
        )}],
        temperature=0.1,
    )

    return {
        "answer": (response.choices[0].message.content or "").strip(),
        "sources": sources,
    }
