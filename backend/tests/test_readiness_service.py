import pytest
from backend.services.readiness_service import (
    calculate_readiness,
    _score_repository_understanding,
    _score_environment_setup,
    _score_code_understanding,
    _score_testing_knowledge,
    _score_issue_understanding,
)


# --- _score_repository_understanding ---

def test_repo_understanding_no_plan():
    assert _score_repository_understanding(None) == 0


def test_repo_understanding_empty_steps():
    assert _score_repository_understanding({"steps": []}) == 0


def test_repo_understanding_all_viewed():
    plan = {"steps": [{}, {}, {}], "steps_viewed": 3}
    assert _score_repository_understanding(plan) == 100


def test_repo_understanding_partial():
    plan = {"steps": [{}, {}, {}, {}], "steps_viewed": 2}
    assert _score_repository_understanding(plan) == 50


def test_repo_understanding_defaults_to_full_when_no_steps_viewed_key():
    plan = {"steps": [{}, {}]}
    assert _score_repository_understanding(plan) == 100


# --- _score_environment_setup ---

def test_env_setup_no_plan():
    assert _score_environment_setup(None) == 50


def test_env_setup_no_commands():
    plan = {"steps": [{"commands": []}, {"commands": []}]}
    assert _score_environment_setup(plan) == 50


def test_env_setup_has_commands():
    plan = {"steps": [{"commands": ["npm install"]}]}
    assert _score_environment_setup(plan) == 100


def test_env_setup_empty_steps():
    assert _score_environment_setup({"steps": []}) == 50


# --- _score_code_understanding ---

def test_code_understanding_no_issue():
    assert _score_code_understanding(None, None) == 0


def test_code_understanding_no_files():
    assert _score_code_understanding({"files_affected": []}, None) == 50


def test_code_understanding_with_files():
    assert _score_code_understanding({"files_affected": ["src/main.py"]}, None) == 70


def test_code_understanding_with_languages():
    profile = {"languages": ["Python", "TypeScript"]}
    assert _score_code_understanding({"files_affected": ["src/main.py"]}, profile) == 70


# --- _score_testing_knowledge ---

def test_testing_knowledge_no_issue():
    assert _score_testing_knowledge(None) == 60


def test_testing_knowledge_no_test_files():
    assert _score_testing_knowledge({"files_affected": ["src/main.py"]}) == 60


def test_testing_knowledge_with_test_file():
    assert _score_testing_knowledge({"files_affected": ["tests/test_main.py"]}) == 100


def test_testing_knowledge_with_spec_file():
    assert _score_testing_knowledge({"files_affected": ["src/component.spec.ts"]}) == 100


def test_testing_knowledge_empty_files():
    assert _score_testing_knowledge({"files_affected": []}) == 60


# --- _score_issue_understanding ---

def test_issue_understanding_viewed():
    assert _score_issue_understanding(True) == 100


def test_issue_understanding_not_viewed():
    assert _score_issue_understanding(False) == 30


# --- calculate_readiness ---

def test_calculate_readiness_returns_overall_and_dimensions():
    result = calculate_readiness(onboarding_plan=None, issue=None)
    assert "overall" in result
    assert "dimensions" in result
    assert len(result["dimensions"]) == 5


def test_calculate_readiness_dimension_keys():
    result = calculate_readiness(onboarding_plan=None, issue=None)
    keys = {d["key"] for d in result["dimensions"]}
    assert keys == {
        "repository_understanding",
        "environment_setup",
        "code_understanding",
        "testing_knowledge",
        "issue_understanding",
    }


def test_calculate_readiness_overall_range():
    result = calculate_readiness(onboarding_plan=None, issue=None)
    assert 0 <= result["overall"] <= 100


def test_calculate_readiness_full_scenario():
    plan = {"steps": [{"commands": ["git clone repo"]}], "steps_viewed": 1}
    issue = {"files_affected": ["tests/test_auth.py"], "labels": ["bug"]}
    profile = {"languages": ["Python"], "experience": "intermediate"}
    result = calculate_readiness(onboarding_plan=plan, issue=issue, profile=profile, issue_viewed=True)
    assert result["overall"] > 50


def test_calculate_readiness_weights_sum_to_one():
    result = calculate_readiness(onboarding_plan=None, issue=None)
    total_weight = sum(d["weight"] for d in result["dimensions"])
    assert abs(total_weight - 1.0) < 1e-9
