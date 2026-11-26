"""
Q&A service — RAG pipeline for the "Explain This Codebase" feature.

Pipeline:
  1. Embed the question with fastembed (same model used for code chunks)
  2. Retrieve top-20 most similar code chunks from pgvector, then deduplicate
     so at most one chunk per file reaches the context window (diversity)
  3. For structural/listing questions, prepend a full file-path manifest
  4. Assemble context greedily — stop when the 5,000-token budget is reached
  5. Answer via LiteLLM (Ollama)
  6. Return { answer, sources }
"""

import re
import uuid
from typing import Any

from litellm import acompletion, token_counter
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_settings, ai_kwargs
from backend.services.embedding_service import _embed

_MODEL = "ollama/qwen2.5-coder:7b"
_FETCH_K = 20       # candidates fetched from pgvector
_MAX_CHUNKS = 12    # max distinct-file chunks used in context
_TOKEN_BUDGET = 5_000

# Keywords that signal the user wants a listing / structural answer
_LISTING_RE = re.compile(
    r"\b(list|what|which|all|show|tell me|files?|components?|pages?|routes?|"
    r"directories|folders?|structure|involved|exist|are there)\b",
    re.IGNORECASE,
)

_QA_PROMPT = """\
You are an expert software engineer answering questions about a codebase.
You have been given relevant source code snippets and, where relevant, \
a full file manifest from the repository.

Rules:
- Answer based on the provided snippets and file paths shown.
- When asked about files, components, or structure, list the specific file \
paths from the manifest or snippets.
- Be concise and direct. Use bullet points or lists when naming multiple \
files or items.
- If the answer is not evident from the provided material, say so clearly.

--- REPOSITORY FILES ---
{manifest}
--- SOURCE CODE SNIPPETS ---
{context}
--- END ---

Question: {question}
"""

_QA_PROMPT_NO_MANIFEST = """\
You are an expert software engineer answering questions about a codebase.
You have been given relevant source code snippets from the repository.

Rules:
- Answer based on the provided snippets and the file paths shown.
- Be concise and direct. Use bullet points or lists when naming multiple \
files or items.
- If the answer is not evident from the provided code, say so clearly.

--- SOURCE CODE SNIPPETS ---
{context}
--- END ---

Question: {question}
"""


async def _get_all_file_paths(db: AsyncSession, repo_id: uuid.UUID) -> list[str]:
    result = await db.execute(
        text("SELECT DISTINCT file_path FROM code_chunks WHERE repo_id = :r ORDER BY file_path"),
        {"r": str(repo_id)},
    )
    return [row[0] for row in result]


async def _retrieve_chunks(
    db: AsyncSession,
    repo_id: uuid.UUID,
    question_vector: list[float],
) -> list[dict[str, str]]:
    # Register pgvector codec so asyncpg can serialize the vector parameter
    raw = await db.connection()
    await raw.run_sync(lambda c: c.connection.run_async(
        __import__('pgvector.asyncpg', fromlist=['register_vector']).register_vector
    ))
    result = await db.execute(
        text("""
            SELECT file_path, content
            FROM code_chunks
            WHERE repo_id = :repo_id
            ORDER BY embedding <=> :vec
            LIMIT :k
        """),
        {"repo_id": str(repo_id), "vec": question_vector, "k": _FETCH_K},
    )
    rows = [{"file_path": row.file_path, "content": row.content} for row in result]

    # Deduplicate: keep only the best-scoring chunk per file path
    seen: set[str] = set()
    unique: list[dict[str, str]] = []
    for row in rows:
        if row["file_path"] not in seen:
            seen.add(row["file_path"])
            unique.append(row)
        if len(unique) >= _MAX_CHUNKS:
            break
    return unique


def _build_context(chunks: list[dict[str, str]], model: str) -> tuple[str, list[str]]:
    parts: list[str] = []
    sources: list[str] = []
    total_tokens = 0

    for chunk in chunks:
        snippet = f"# {chunk['file_path']}\n{chunk['content']}\n"
        snippet_tokens = token_counter(model=model, text=snippet)
        if total_tokens + snippet_tokens > _TOKEN_BUDGET:
            break
        parts.append(snippet)
        sources.append(chunk["file_path"])
        total_tokens += snippet_tokens

    return "\n".join(parts), sources


def _is_structural_question(question: str) -> bool:
    return bool(_LISTING_RE.search(question))


async def ask(
    db: AsyncSession,
    repo_id: str,
    question: str,
) -> dict[str, Any]:
    import logging as _logging
    _log = _logging.getLogger(__name__)
    settings = get_settings()
    repo_uuid = uuid.UUID(repo_id)

    question_vector = _embed([question])[0]
    try:
        chunks = await _retrieve_chunks(db, repo_uuid, question_vector)
    except Exception as exc:
        _log.exception("_retrieve_chunks failed for repo %s: %s", repo_id, exc)
        chunks = []
    _log.info("_retrieve_chunks returned %d chunks for repo %s", len(chunks), repo_id)

    if not chunks:
        return {
            "answer": "No code has been embedded for this repository yet. "
                      "Run the embedding task first.",
            "sources": [],
        }

    context, sources = _build_context(chunks, settings.AI_MODEL)

    if _is_structural_question(question):
        all_paths = await _get_all_file_paths(db, repo_uuid)
        manifest = "\n".join(all_paths)
        prompt = _QA_PROMPT.format(manifest=manifest, context=context, question=question)
    else:
        prompt = _QA_PROMPT_NO_MANIFEST.format(context=context, question=question)

    response = await acompletion(
        **ai_kwargs(settings),
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
    )

    return {
        "answer": (response.choices[0].message.content or "").strip(),
        "sources": sources,
    }
