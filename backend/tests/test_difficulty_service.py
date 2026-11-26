"""
Tests for difficulty_service — pure Python scoring functions.
No LLM calls, no DB, no external dependencies.
"""

import pytest
from backend.services.difficulty_service import (
    NEUTRAL,
    estimate_hours,
    estimate_lines,
    score_dependencies,
    score_domain_knowledge,
    score_estimated_lines,
    score_files_affected,
    score_issue,
)


# ── score_files_affected ──────────────────────────────────────────────────────

def test_files_affected_empty_returns_neutral():
    assert score_files_affected([]) == NEUTRAL


def test_files_affected_single_file_is_easiest():
    assert score_files_affected(["main.py"]) == 1


def test_files_affected_two_files():
    assert score_files_affected(["a.py", "b.py"]) == 2


def test_files_affected_three_to_four_files():
    assert score_files_affected(["a.py", "b.py", "c.py"]) == 3
    assert score_files_affected(["a.py", "b.py", "c.py", "d.py"]) == 3


def test_files_affected_five_to_seven_files():
    assert score_files_affected(["f"] * 5) == 4
    assert score_files_affected(["f"] * 7) == 4


def test_files_affected_eight_or_more_is_hardest():
    assert score_files_affected(["f"] * 8) == 5
    assert score_files_affected(["f"] * 20) == 5


# ── score_domain_knowledge ────────────────────────────────────────────────────

def test_domain_knowledge_no_keywords_scores_two():
    assert score_domain_knowledge("Add a button", "Click the button", []) == 2


def test_domain_knowledge_hard_keyword_in_title_raises_score():
    score = score_domain_knowledge("Fix auth flow", "", [])
    assert score >= 3


def test_domain_knowledge_easy_keyword_lowers_score():
    score = score_domain_knowledge("Fix typo in readme", "Small docs fix", [])
    assert score <= 2


def test_domain_knowledge_multiple_hard_keywords_caps_at_five():
    score = score_domain_knowledge(
        "concurrency deadlock async", "race condition crypto", []
    )
    assert score == 5


def test_domain_knowledge_minimum_is_one():
    score = score_domain_knowledge(
        "typo docs readme spelling comment", "", []
    )
    assert score == 1


def test_domain_knowledge_label_text_is_included():
    score = score_domain_knowledge("", "", ["security"])
    assert score >= 3


# ── estimate_lines ────────────────────────────────────────────────────────────

def test_estimate_lines_extracts_explicit_number_from_body():
    assert estimate_lines("", "This change affects about 50 lines") == 50


def test_estimate_lines_extracts_from_title():
    assert estimate_lines("Refactor 120 lines of code", "") == 120


def test_estimate_lines_uses_largest_explicit_number():
    assert estimate_lines("", "10 lines here and 80 lines there") == 80


def test_estimate_lines_falls_back_to_body_length_heuristic():
    body = "x" * 100
    assert estimate_lines("", body) == max(5, 100 // 4)


def test_estimate_lines_minimum_is_five():
    assert estimate_lines("", "") == 5
    assert estimate_lines("", "hi") == 5


# ── score_estimated_lines ─────────────────────────────────────────────────────

def test_score_estimated_lines_ten_or_fewer_is_easiest():
    assert score_estimated_lines(5) == 1
    assert score_estimated_lines(10) == 1


def test_score_estimated_lines_eleven_to_forty():
    assert score_estimated_lines(11) == 2
    assert score_estimated_lines(40) == 2


def test_score_estimated_lines_forty_one_to_one_fifty():
    assert score_estimated_lines(41) == 3
    assert score_estimated_lines(150) == 3


def test_score_estimated_lines_one_fifty_one_to_four_hundred():
    assert score_estimated_lines(151) == 4
    assert score_estimated_lines(400) == 4


def test_score_estimated_lines_over_four_hundred_is_hardest():
    assert score_estimated_lines(401) == 5
    assert score_estimated_lines(1000) == 5


# ── estimate_hours ────────────────────────────────────────────────────────────

def test_estimate_hours_minimum_is_half():
    assert estimate_hours(0, 0) == 0.5


def test_estimate_hours_scales_with_lines_and_files():
    result = estimate_hours(25, 1)
    assert result == 1.5


def test_estimate_hours_zero_files_counts_as_one():
    assert estimate_hours(25, 0) == estimate_hours(25, 1)


def test_estimate_hours_large_change_gives_large_estimate():
    result = estimate_hours(500, 10)
    assert result > 10


def test_estimate_hours_result_is_rounded_to_one_decimal():
    result = estimate_hours(33, 3)
    assert result == round(result, 1)


# ── score_complexity & score_dependencies ────────────────────────────────────

def test_score_complexity_no_sources_returns_neutral():
    from backend.services.difficulty_service import score_complexity
    assert score_complexity({}) == NEUTRAL


def test_score_complexity_non_python_sources_returns_neutral():
    from backend.services.difficulty_service import score_complexity
    assert score_complexity({"app.ts": "const x = 1"}) == NEUTRAL


def test_score_dependencies_empty_returns_neutral():
    from backend.services.difficulty_service import score_dependencies
    assert score_dependencies({}) == NEUTRAL


def test_score_dependencies_no_py_files_returns_neutral():
    from backend.services.difficulty_service import score_dependencies
    assert score_dependencies({"app.ts": "import React from 'react'"}) == NEUTRAL


def test_score_dependencies_minimal_imports_scores_low():
    from backend.services.difficulty_service import score_dependencies
    code = "import os\nimport sys\n"
    result = score_dependencies({"app.py": code})
    assert result <= 2


# ── score_issue (integration) ─────────────────────────────────────────────────

def test_score_issue_returns_required_keys():
    result = score_issue({"title": "Fix bug", "body": "", "files_affected": []}, {})
    assert "difficulty" in result
    assert "difficulty_factors" in result
    assert "estimated_hours" in result


def test_score_issue_difficulty_is_mean_of_five_factors():
    result = score_issue({"title": "Fix bug", "body": "", "files_affected": []}, {})
    factors = result["difficulty_factors"]
    expected = round(sum(factors.values()) / len(factors), 2)
    assert result["difficulty"] == expected


def test_score_issue_all_five_factor_keys_present():
    result = score_issue({"title": "x", "body": "", "files_affected": []}, {})
    assert set(result["difficulty_factors"].keys()) == {
        "files_affected",
        "complexity",
        "dependencies",
        "domain_knowledge",
        "estimated_lines",
    }


def test_score_issue_difficulty_in_valid_range():
    result = score_issue(
        {"title": "auth security migration", "body": "100 lines", "files_affected": ["a.py"] * 5},
        {},
    )
    assert 1 <= result["difficulty"] <= 5


def test_score_issue_easy_issue_scores_lower_than_hard():
    easy = score_issue({"title": "fix typo in docs", "body": "", "files_affected": []}, {})
    hard = score_issue(
        {"title": "auth security concurrency deadlock", "body": "500 lines", "files_affected": ["f"] * 10},
        {},
    )
    assert easy["difficulty"] < hard["difficulty"]
