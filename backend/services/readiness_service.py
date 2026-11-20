from __future__ import annotations

from typing import Any

_WEIGHTS = {
    "repository_understanding": 0.25,
    "environment_setup": 0.20,
    "code_understanding": 0.25,
    "testing_knowledge": 0.15,
    "issue_understanding": 0.15,
}

_DIMENSION_LABELS = {
    "repository_understanding": "Repository Understanding",
    "environment_setup": "Environment Setup",
    "code_understanding": "Code Understanding",
    "testing_knowledge": "Testing Knowledge",
    "issue_understanding": "Issue Understanding",
}


def _score_repository_understanding(onboarding_plan: dict[str, Any] | None) -> int:
    if onboarding_plan is None:
        return 0
    steps = onboarding_plan.get("steps", [])
    total = len(steps)
    if total == 0:
        return 0
    viewed = onboarding_plan.get("steps_viewed", total)
    return round((viewed / total) * 100)


def _score_environment_setup(onboarding_plan: dict[str, Any] | None) -> int:
    if onboarding_plan is None:
        return 50
    for step in onboarding_plan.get("steps", []):
        if step.get("commands"):
            return 100
    return 50


def _score_code_understanding(issue: dict[str, Any] | None, profile: dict[str, Any] | None) -> int:
    if issue is None:
        return 0
    languages = (profile or {}).get("languages") or []
    denominator = len(languages) or 1
    files = issue.get("files_affected", [])
    if not files:
        return round(50 / denominator * denominator)
    return round(70 / denominator * denominator)


def _score_testing_knowledge(issue: dict[str, Any] | None) -> int:
    if issue is None:
        return 60
    files = issue.get("files_affected", [])
    has_tests = any("test" in f.lower() or "spec" in f.lower() for f in files)
    return 100 if has_tests else 60


def _score_issue_understanding(issue_viewed: bool) -> int:
    return 100 if issue_viewed else 30


def calculate_readiness(
    onboarding_plan: dict[str, Any] | None,
    issue: dict[str, Any] | None,
    profile: dict[str, Any] | None = None,
    issue_viewed: bool = True,
) -> dict[str, Any]:
    raw_scores = {
        "repository_understanding": _score_repository_understanding(onboarding_plan),
        "environment_setup": _score_environment_setup(onboarding_plan),
        "code_understanding": _score_code_understanding(issue, profile),
        "testing_knowledge": _score_testing_knowledge(issue),
        "issue_understanding": _score_issue_understanding(issue_viewed),
    }

    overall = round(
        sum(raw_scores[key] * weight for key, weight in _WEIGHTS.items())
    )

    dimensions = [
        {
            "key": key,
            "label": _DIMENSION_LABELS[key],
            "score": score,
            "weight": _WEIGHTS[key],
        }
        for key, score in raw_scores.items()
    ]

    return {
        "overall": overall,
        "dimensions": dimensions,
    }
