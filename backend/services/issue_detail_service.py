"""
Issue deep-dive service.

Fetches a scored issue from the DB and builds a full deep-dive response:
plain-language AI explanation, files affected, prerequisites, impact chain,
similar PRs, and a contribution checklist.
"""

import asyncio
import json
import logging
import re
from typing import Any

from litellm import acompletion
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import get_settings
from backend.models.issue import Issue
from backend.services.github_client import GitHubClient

logger = logging.getLogger(__name__)

_EXPLANATION_PROMPT = """\
Write a plain-language explanation of this GitHub issue for a contributor \
who is new to the codebase. 2-3 sentences only. Focus on what the problem \
is and why it matters. Do not speculate beyond the description.

Issue #{number}: {title}

Description:
{body}

Labels: {labels}
"""

_IMPACT_PROMPT = """\
List the main application components likely involved in fixing this issue \
(e.g. API, UserService, Database, Frontend).

Issue: {title}
Files affected: {files}

Return a JSON array of 3-5 short component names. \
Example: ["API", "AuthService", "User Model"]
Only return the JSON array.
"""

_WORKFLOW_PROMPT = """\
You are helping a first-time contributor understand how to fix a specific GitHub issue.

Write a concrete, actionable implementation workflow — 4 to 6 steps — tailored to THIS issue.
Each step should describe a real action the contributor needs to take for this specific problem,
not generic advice. Reference the files, components, or behavior mentioned in the issue where possible.

Issue #{number}: {title}

Description:
{body}

Labels: {labels}
Files likely affected: {files}

Return ONLY a JSON array of short step strings (each under 15 words). No explanation outside the array.
Example: ["Reproduce the bug by calling X with Y input", "Trace the failure to the Z function in api/routes.py"]
"""

_JSON_ARRAY = re.compile(r"\[.*?\]", re.DOTALL)

_CHECKLIST = [
    {"step": "Read the issue description and any linked discussion"},
    {"step": "Read the repository README and contribution guidelines"},
    {"step": "Confirm the issue is unassigned and available to work on"},
    {"step": "Set up the project locally and reproduce the reported behavior"},
    {"step": "Create a branch and make a small, focused change"},
    {"step": "Add or update relevant tests and run the project checks"},
    {"step": "Open a pull request linked to the issue"},
]


async def _llm(prompt: str) -> str:
    settings = get_settings()
    api_key = getattr(settings, 'ANTHROPIC_AUTH_TOKEN', None) or getattr(settings, 'ANTHROPIC_API_KEY', None)
    if api_key:
        kwargs: dict = dict(
            model='claude-haiku-4-5',
            api_key=api_key,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1024,
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
            max_tokens=1024,
            temperature=0.2,
        )
    return response.choices[0].message.content or ""


async def _generate_explanation(issue: Issue) -> str:
    prompt = _EXPLANATION_PROMPT.format(
        number=issue.number,
        title=issue.title,
        body=(issue.body or "No description provided.")[:1500],
        labels=", ".join(issue.labels) if issue.labels else "none",
    )
    try:
        return (await _llm(prompt)).strip()
    except Exception as exc:
        logger.warning("Explanation generation failed: %s", exc)
        return issue.body or "No explanation available."


async def _generate_impact_chain(issue: Issue) -> list[str]:
    prompt = _IMPACT_PROMPT.format(
        title=issue.title,
        files=", ".join((issue.files_affected or [])[:10]) or "unknown",
    )
    try:
        raw = await _llm(prompt)
        match = _JSON_ARRAY.search(raw)
        if match:
            chain = json.loads(match.group(0))
            if isinstance(chain, list):
                return [str(c) for c in chain[:5]]
    except Exception as exc:
        logger.warning("Impact chain generation failed: %s", exc)
    return ["Repository", "Source Code"]


async def _generate_implementation_workflow(issue: Issue) -> list[str]:
    prompt = _WORKFLOW_PROMPT.format(
        number=issue.number,
        title=issue.title,
        body=(issue.body or "No description provided.")[:1500],
        labels=", ".join(issue.labels) if issue.labels else "none",
        files=", ".join((issue.files_affected or [])[:8]) or "unknown",
    )
    try:
        raw = await _llm(prompt)
        match = _JSON_ARRAY.search(raw)
        if match:
            steps = json.loads(match.group(0))
            if isinstance(steps, list) and steps:
                return [str(s) for s in steps[:6]]
    except Exception as exc:
        logger.warning("Workflow generation failed: %s", exc)
    return [
        "Reproduce the reported behavior locally.",
        "Read the relevant code and existing tests before editing.",
        "Make a small, focused change that follows the project conventions.",
        "Run the documented checks and explain your changes in the pull request.",
    ]


def _keyword_score(pr_title: str, issue_title: str, issue_labels: list[str]) -> int:
    stop = {"the", "a", "an", "in", "on", "at", "to", "for", "of", "and", "or", "is",
            "are", "was", "with", "from", "by", "not", "this", "that", "be", "it"}
    pr_words = {w.lower().strip(".,:#()-") for w in pr_title.split()} - stop
    issue_words = {w.lower().strip(".,:#()-") for w in issue_title.split()} - stop
    label_words = {w.lower().strip(".,:#()-") for label in issue_labels for w in label.split("-")}
    return len(pr_words & (issue_words | label_words))


async def find_similar_prs(
    owner: str,
    repo: str,
    issue_title: str,
    issue_labels: list[str] | None = None,
    github_token: str | None = None,
) -> list[dict[str, Any]]:
    try:
        async with GitHubClient(token=github_token) as client:
            prs = await client.get_pull_requests(owner, repo, state="closed")
    except Exception as exc:
        logger.warning("Could not fetch PRs for %s/%s: %s", owner, repo, exc)
        return []

    merged = [pr for pr in prs if pr.get("merged_at")]

    labels = issue_labels or []
    scored = sorted(
        merged,
        key=lambda pr: _keyword_score(pr["title"], issue_title, labels),
        reverse=True,
    )

    # If no keyword overlap at all, fall back to the 5 most-recently merged PRs
    if not scored or _keyword_score(scored[0]["title"], issue_title, labels) == 0:
        scored = merged

    return [
        {
            "number": pr["number"],
            "title": pr["title"],
            "url": pr.get("html_url"),
        }
        for pr in scored[:5]
    ]


async def get_issue_detail(
    db: AsyncSession,
    repo_full_name: str,
    issue_number: int,
    github_token: str | None = None,
) -> dict[str, Any] | None:
    row = await db.execute(
        select(Issue).where(
            Issue.repo_full_name == repo_full_name,
            Issue.number == issue_number,
        )
    )
    issue = row.scalar_one_or_none()
    if issue is None:
        return None

    owner, repo = repo_full_name.split("/", 1)

    explanation, impact_chain, similar_prs, implementation_steps = await asyncio.gather(
        _generate_explanation(issue),
        _generate_impact_chain(issue),
        find_similar_prs(owner, repo, issue.title, issue.labels or [], github_token),
        _generate_implementation_workflow(issue),
    )

    return {
        "number": issue.number,
        "title": issue.title,
        "body": issue.body,
        "url": issue.url,
        "labels": issue.labels,
        "difficulty": issue.difficulty,
        "difficulty_factors": issue.difficulty_factors or {},
        "explanation": explanation,
        "files_affected": [
            {"path": f, "role": "likely affected"}
            for f in (issue.files_affected or [])
        ],
        "prerequisites": [
            {
                "title": "Read the project documentation",
                "description": "Review the README and contribution guidelines before writing any code.",
            },
            {
                "title": "Set up the project locally",
                "description": "Build and run the project to reproduce the reported behavior.",
            },
            {
                "title": "Confirm issue availability",
                "description": "Check the discussion thread and verify the issue is unassigned.",
            },
        ],
        "impact_chain": impact_chain,
        "implementation_steps": implementation_steps,
        "similar_prs": similar_prs,
        "checklist": _CHECKLIST,
    }
