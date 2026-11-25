"""
Unit tests for qa_service — retrieval deduplication, structural-question
detection, and prompt selection.
"""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.services import qa_service
from backend.services.qa_service import _is_structural_question, _build_context


# ---------------------------------------------------------------------------
# _is_structural_question
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("question,expected", [
    ("what are the frontend files involved", True),
    ("which components exist in the codebase", True),
    ("list all pages", True),
    ("show me the directory structure", True),
    ("what files are in the frontend", True),
    ("how does authentication work", False),
    ("explain the database schema", False),
    ("why does the login fail", False),
])
def test_is_structural_question(question, expected):
    assert _is_structural_question(question) is expected


# ---------------------------------------------------------------------------
# _retrieve_chunks — deduplication
# ---------------------------------------------------------------------------

def _make_row(file_path, content="x"):
    row = MagicMock()
    row.file_path = file_path
    row.content = content
    return row


@pytest.mark.asyncio
async def test_retrieve_chunks_deduplicates_same_file():
    """Multiple chunks from the same file should collapse to one."""
    rows = [
        _make_row("frontend/src/App.tsx", "chunk 1"),
        _make_row("frontend/src/App.tsx", "chunk 2"),  # duplicate
        _make_row("frontend/src/main.tsx", "chunk 3"),
    ]
    result_mock = MagicMock()
    result_mock.__iter__ = MagicMock(return_value=iter(rows))
    db = MagicMock()
    db.execute = AsyncMock(return_value=result_mock)

    import uuid
    chunks = await qa_service._retrieve_chunks(db, uuid.uuid4(), [0.1] * 384)

    file_paths = [c["file_path"] for c in chunks]
    assert file_paths.count("frontend/src/App.tsx") == 1
    assert "frontend/src/main.tsx" in file_paths
    assert len(chunks) == 2


@pytest.mark.asyncio
async def test_retrieve_chunks_respects_max_chunks_limit():
    """Should return at most _MAX_CHUNKS distinct files."""
    rows = [_make_row(f"file_{i}.py") for i in range(qa_service._MAX_CHUNKS + 5)]
    result_mock = MagicMock()
    result_mock.__iter__ = MagicMock(return_value=iter(rows))
    db = MagicMock()
    db.execute = AsyncMock(return_value=result_mock)

    import uuid
    chunks = await qa_service._retrieve_chunks(db, uuid.uuid4(), [0.0] * 384)
    assert len(chunks) == qa_service._MAX_CHUNKS


# ---------------------------------------------------------------------------
# _build_context — token budget
# ---------------------------------------------------------------------------

def test_build_context_respects_token_budget(monkeypatch):
    """Chunks that would exceed the budget are dropped."""
    # Make every chunk cost 2000 tokens so the third one exceeds 5000
    monkeypatch.setattr(qa_service, "_TOKEN_BUDGET", 4_500)

    with patch("backend.services.qa_service.token_counter", return_value=2_000):
        chunks = [
            {"file_path": "a.py", "content": "aaa"},
            {"file_path": "b.py", "content": "bbb"},
            {"file_path": "c.py", "content": "ccc"},  # would push total to 6000
        ]
        context, sources = _build_context(chunks, "ollama/qwen2.5-coder:7b")

    assert "a.py" in context
    assert "b.py" in context
    assert "c.py" not in context
    assert sources == ["a.py", "b.py"]


# ---------------------------------------------------------------------------
# ask() — manifest injected only for structural questions
# ---------------------------------------------------------------------------

def _make_ask_mocks(monkeypatch, question: str, is_structural: bool):
    """Patch all external calls in qa_service.ask() and return the acompletion mock."""
    monkeypatch.setattr(qa_service, "_embed", lambda texts: [[0.1] * 384])

    # _retrieve_chunks → one chunk
    chunks = [{"file_path": "frontend/src/App.tsx", "content": "const App = () => null"}]
    monkeypatch.setattr(qa_service, "_retrieve_chunks", AsyncMock(return_value=chunks))

    # _get_all_file_paths → short manifest
    all_paths = ["frontend/src/App.tsx", "frontend/src/main.tsx"]
    monkeypatch.setattr(qa_service, "_get_all_file_paths", AsyncMock(return_value=all_paths))

    # _build_context → returns a context string and sources list
    monkeypatch.setattr(qa_service, "_build_context",
                        lambda c, model: ("# frontend/src/App.tsx\nconst App = () => null\n", ["frontend/src/App.tsx"]))

    completion = MagicMock()
    completion.choices = [MagicMock()]
    completion.choices[0].message.content = "test answer"
    acompletion_mock = AsyncMock(return_value=completion)
    monkeypatch.setattr(qa_service, "acompletion", acompletion_mock)

    return acompletion_mock


@pytest.mark.asyncio
async def test_ask_includes_manifest_for_structural_question(monkeypatch):
    acompletion_mock = _make_ask_mocks(monkeypatch, "what files are in the frontend", True)
    db = MagicMock()

    result = await qa_service.ask(db, "00000000-0000-0000-0000-000000000001", "what files are in the frontend")

    prompt_sent = acompletion_mock.call_args.kwargs["messages"][0]["content"]
    assert "REPOSITORY FILES" in prompt_sent
    assert "frontend/src/main.tsx" in prompt_sent  # from manifest


@pytest.mark.asyncio
async def test_ask_omits_manifest_for_factual_question(monkeypatch):
    acompletion_mock = _make_ask_mocks(monkeypatch, "how does authentication work", False)
    db = MagicMock()

    result = await qa_service.ask(db, "00000000-0000-0000-0000-000000000001", "how does authentication work")

    prompt_sent = acompletion_mock.call_args.kwargs["messages"][0]["content"]
    assert "REPOSITORY FILES" not in prompt_sent


@pytest.mark.asyncio
async def test_ask_returns_no_embedding_message_when_no_chunks(monkeypatch):
    monkeypatch.setattr(qa_service, "_embed", lambda texts: [[0.1] * 384])
    monkeypatch.setattr(qa_service, "_retrieve_chunks", AsyncMock(return_value=[]))
    db = MagicMock()

    result = await qa_service.ask(db, "00000000-0000-0000-0000-000000000001", "anything")

    assert result["sources"] == []
    assert "embedded" in result["answer"].lower()
