from __future__ import annotations

import json
import math
import re
from typing import Any

from litellm import acompletion

from backend.core.config import get_settings
from backend.schemas.match import MatchResult

REASON_COUNT = 3

MATCH_PROMPT = """\
Contributor profile:
  Languages: {languages}
  Experience: {experience}
  Interests: {interests}

Issue #{number}: "{title}"
  Difficulty: {difficulty}/5
  Labels: {labels}
  Files likely affected: {files}
  Estimated effort: {hours} hours

Score this match 0–100 and provide exactly 3 reasons why.
Return JSON: {{"score": int, "reasons": [str, str, str]}}
"""

_JSON_OBJECT = re.compile(r"\{.*\}", re.DOTALL)


def build_match_prompt(profile: dict[str, Any], issue: dict[str, Any]) -> str:
    def join(values: list[str] | None) -> str:
        return ", ".join(values) if values else "None"

    hours = issue.get("estimated_hours")
    return MATCH_PROMPT.format(
        languages=join(profile.get("languages")),
        experience=(profile.get("experience") or "beginner").capitalize(),
        interests=join(profile.get("interests")),
        number=issue["number"],
        title=issue["title"].replace('"', "'"),
        difficulty=round(issue["difficulty"]),
        labels=join(issue.get("labels")),
        files=join(issue.get("files_affected")),
        hours=hours if hours is not None else "unknown",
    )


def clamp_score(raw_score: Any) -> int:
    if isinstance(raw_score, bool) or not isinstance(raw_score, (int, float, str)):
        raise ValueError("score must be a number")
    try:
        value = float(raw_score)
    except (ValueError, OverflowError) as exc:
        raise ValueError("score must be a finite number") from exc
    if not math.isfinite(value):
        raise ValueError("score is not finite")
    return max(0, min(100, round(value)))


def parse_match_response(raw: str) -> tuple[int, list[str]]:
    match = _JSON_OBJECT.search(raw or "")
    if match is None:
        raise ValueError("LLM response contained no JSON object")
    data = json.loads(match.group(0))

    if not isinstance(data, dict) or "score" not in data:
        raise ValueError("LLM response must contain a score")
    score = clamp_score(data["score"])
    reasons = data.get("reasons")
    if (
        not isinstance(reasons, list)
        or len(reasons) != REASON_COUNT
        or any(not isinstance(reason, str) or not reason.strip() for reason in reasons)
    ):
        raise ValueError(f"expected exactly {REASON_COUNT} non-empty string reasons")
    return score, [reason.strip() for reason in reasons]


async def match_issue(profile: dict[str, Any], issue: dict[str, Any]) -> MatchResult:
    settings = get_settings()
    prompt = build_match_prompt(profile, issue)
    api_key = getattr(settings, 'ANTHROPIC_AUTH_TOKEN', None) or getattr(settings, 'ANTHROPIC_API_KEY', None)
    if api_key:
        kwargs: dict = dict(
            model='claude-haiku-4-5',
            api_key=api_key,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=512,
            temperature=0.2,
        )
        base_url = getattr(settings, 'ANTHROPIC_BASE_URL', None)
        if base_url:
            kwargs['api_base'] = base_url
        response = await acompletion(**kwargs)
    else:
        response = await acompletion(
            model='ollama/qwen2.5-coder:7b',
            api_base=settings.OLLAMA_URL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=512,
            temperature=0.2,
        )
    score, reasons = parse_match_response(response.choices[0].message.content or "")
    return MatchResult(issue_id=issue["id"], match_pct=score, reasons=reasons)
