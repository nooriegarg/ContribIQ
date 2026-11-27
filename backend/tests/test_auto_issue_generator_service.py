"""
Tests for auto_issue_generator_service — pure gap-detection logic.
No LLM calls, no DB, no network access.

Covers:
  - _scan_todos: detects TODO/FIXME/HACK/XXX, respects per-file cap
  - _missing_docstrings: Python AST detection, skips non-.py, handles bad syntax
  - _find_untested: matches by stem, respects cap, handles no test files
  - _collect_gaps: combines all three scanners
  - generate_suggested_issues: returns [] when no gaps found
"""

import pytest
from backend.services.auto_issue_generator_service import (
    MAX_TODOS_PER_FILE,
    MAX_UNTESTED_FILES,
    _collect_gaps,
    _find_untested,
    _missing_docstrings,
    _scan_todos,
)


# ── _scan_todos ───────────────────────────────────────────────────────────────

def test_scan_todos_detects_todo():
    gaps = _scan_todos("app.py", "x = 1\n# TODO: add validation\ny = 2\n")
    assert len(gaps) == 1
    assert gaps[0].kind == "todo"
    assert gaps[0].path == "app.py"
    assert "add validation" in gaps[0].detail
    assert gaps[0].line == 2


def test_scan_todos_detects_fixme_and_hack():
    code = "# FIXME: broken logic\n# HACK: workaround\n"
    gaps = _scan_todos("utils.py", code)
    assert len(gaps) == 2
    assert {g.detail for g in gaps} == {"broken logic", "workaround"}


def test_scan_todos_detects_xxx():
    gaps = _scan_todos("x.py", "# XXX: needs cleanup\n")
    assert len(gaps) == 1
    assert gaps[0].kind == "todo"


def test_scan_todos_case_insensitive():
    gaps = _scan_todos("x.py", "# todo: lowercase\n# Todo: mixed\n")
    assert len(gaps) == 2


def test_scan_todos_respects_per_file_cap():
    lines = "\n".join(f"# TODO: item {i}" for i in range(MAX_TODOS_PER_FILE + 5))
    gaps = _scan_todos("big.py", lines)
    assert len(gaps) == MAX_TODOS_PER_FILE


def test_scan_todos_no_match_returns_empty():
    gaps = _scan_todos("clean.py", "def foo():\n    return 42\n")
    assert gaps == []


def test_scan_todos_comment_without_text_uses_tag():
    gaps = _scan_todos("x.py", "# TODO\n")
    assert gaps[0].detail == "TODO comment"


# ── _missing_docstrings ───────────────────────────────────────────────────────

_DOCUMENTED = '''\
def good():
    """Does something."""
    pass

class MyClass:
    """A class."""
    pass
'''

_UNDOCUMENTED = '''\
def bad():
    pass

class NoDoc:
    pass
'''

_ASYNC_UNDOCUMENTED = '''\
async def fetch():
    return []
'''


def test_missing_docstrings_skips_documented():
    assert _missing_docstrings("mod.py", _DOCUMENTED) == []


def test_missing_docstrings_finds_function():
    gaps = _missing_docstrings("mod.py", _UNDOCUMENTED)
    kinds = [g.detail for g in gaps]
    assert any("function" in d and "bad" in d for d in kinds)


def test_missing_docstrings_finds_class():
    gaps = _missing_docstrings("mod.py", _UNDOCUMENTED)
    kinds = [g.detail for g in gaps]
    assert any("class" in d and "NoDoc" in d for d in kinds)


def test_missing_docstrings_finds_async_function():
    gaps = _missing_docstrings("mod.py", _ASYNC_UNDOCUMENTED)
    assert len(gaps) == 1
    assert "fetch" in gaps[0].detail


def test_missing_docstrings_skips_non_py():
    assert _missing_docstrings("app.ts", _UNDOCUMENTED) == []


def test_missing_docstrings_handles_syntax_error():
    assert _missing_docstrings("bad.py", "def (:\n") == []


def test_missing_docstrings_caps_at_three():
    code = "\n".join(f"def fn_{i}(): pass" for i in range(10))
    gaps = _missing_docstrings("many.py", code)
    assert len(gaps) == 3


# ── _find_untested ────────────────────────────────────────────────────────────

def test_find_untested_matches_by_stem():
    sources = ["backend/services/user_service.py"]
    tests = ["backend/tests/test_user_service.py"]
    gaps = _find_untested(sources, tests)
    assert gaps == []


def test_find_untested_flags_missing_test():
    sources = ["backend/services/payment.py"]
    gaps = _find_untested(sources, [])
    assert len(gaps) == 1
    assert gaps[0].kind == "untested"
    assert gaps[0].path == "backend/services/payment.py"


def test_find_untested_matches_spec_suffix():
    sources = ["src/auth.ts"]
    tests = ["src/auth.spec.ts"]
    gaps = _find_untested(sources, tests)
    assert gaps == []


def test_find_untested_matches_test_dot_suffix():
    sources = ["src/utils.js"]
    tests = ["src/utils.test.js"]
    gaps = _find_untested(sources, tests)
    assert gaps == []


def test_find_untested_respects_cap():
    sources = [f"mod_{i}.py" for i in range(MAX_UNTESTED_FILES + 5)]
    gaps = _find_untested(sources, [])
    assert len(gaps) == MAX_UNTESTED_FILES


def test_find_untested_all_tested_returns_empty():
    sources = ["a.py", "b.py"]
    tests = ["test_a.py", "test_b.py"]
    assert _find_untested(sources, tests) == []


# ── _collect_gaps ─────────────────────────────────────────────────────────────

def test_collect_gaps_combines_all_scanners():
    file_contents = {
        "app.py": "# TODO: fix this\ndef undoc(): pass\n",
    }
    source_files = ["app.py", "untested_module.py"]
    test_files = ["test_app.py"]

    gaps = _collect_gaps(file_contents, source_files, test_files)

    kinds = {g.kind for g in gaps}
    assert "todo" in kinds
    assert "missing_docstring" in kinds
    assert "untested" in kinds


def test_collect_gaps_empty_inputs_returns_empty():
    assert _collect_gaps({}, [], []) == []


def test_collect_gaps_clean_file_returns_only_untested():
    file_contents = {
        "clean.py": 'def documented():\n    """Has docs."""\n    pass\n',
    }
    gaps = _collect_gaps(file_contents, ["clean.py", "other.py"], ["test_clean.py"])
    # clean.py has docs and is tested; other.py has no test
    assert all(g.kind == "untested" for g in gaps)
    assert any("other.py" in g.path for g in gaps)


# ── generate_suggested_issues (no-gap fast path) ─────────────────────────────

@pytest.mark.asyncio
async def test_generate_suggested_issues_returns_empty_when_no_gaps():
    from backend.services.auto_issue_generator_service import generate_suggested_issues

    # Fully clean file with docs and a matching test
    file_contents = {
        "mod.py": 'def fn():\n    """Documented."""\n    pass\n',
    }
    result = await generate_suggested_issues(
        repo_name="owner/repo",
        file_contents=file_contents,
        source_files=["mod.py"],
        test_files=["test_mod.py"],
    )
    assert result == []
