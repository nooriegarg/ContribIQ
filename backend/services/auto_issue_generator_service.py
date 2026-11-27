"""
Scans a repository's source files for code quality gaps and synthesizes
beginner-friendly issue suggestions using the LLM.

Gap types detected:
  - TODO / FIXME / HACK / XXX comments in source code
  - Source files with no matching test file (untested modules)
  - Functions/classes missing docstrings (Python only, via AST)
"""

from __future__ import annotations

import ast
import json
import logging
import re
from dataclasses import dataclass, field
from statistics import mean
from typing import Any

from litellm import acompletion

from backend.core.config import get_settings

logger = logging.getLogger(__name__)

_TODO_RE = re.compile(
    r'#\s*(TODO|FIXME|HACK|XXX)\b[:\s]*(.*)',
    re.IGNORECASE,
)

_SKILLS_FOR_EXT = {
    '.py': 'Python',
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript, React',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript, React',
    '.go': 'Go',
    '.java': 'Java',
    '.rb': 'Ruby',
    '.rs': 'Rust',
}

MAX_TODOS_PER_FILE = 3
MAX_UNTESTED_FILES = 10
MAX_GENERATED = 8


@dataclass
class _Gap:
    kind: str           # "todo" | "untested" | "missing_docstring"
    path: str
    detail: str
    line: int | None = None


@dataclass
class GeneratedIssue:
    title: str
    description: str
    files_affected: list[str]
    skills: list[str]
    difficulty: float          # 1–5
    estimated_hours: float
    why_beginner_friendly: str
    gap_kind: str              # source category for display
    source: str = "ai_generated"


# ---------------------------------------------------------------------------
# Step 1 — scan file contents for gaps
# ---------------------------------------------------------------------------

def _scan_todos(path: str, content: str) -> list[_Gap]:
    gaps: list[_Gap] = []
    for i, line in enumerate(content.splitlines(), start=1):
        m = _TODO_RE.search(line)
        if m:
            tag, comment = m.group(1).upper(), m.group(2).strip()
            detail = comment or f"{tag} comment"
            gaps.append(_Gap(kind="todo", path=path, detail=detail, line=i))
            if len(gaps) >= MAX_TODOS_PER_FILE:
                break
    return gaps


def _missing_docstrings(path: str, content: str) -> list[_Gap]:
    if not path.endswith('.py'):
        return []
    gaps: list[_Gap] = []
    try:
        tree = ast.parse(content)
    except SyntaxError:
        return []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            if not (node.body and isinstance(node.body[0], ast.Expr)
                    and isinstance(node.body[0].value, ast.Constant)
                    and isinstance(node.body[0].value.value, str)):
                name = node.name
                kind_label = "class" if isinstance(node, ast.ClassDef) else "function"
                gaps.append(_Gap(
                    kind="missing_docstring",
                    path=path,
                    detail=f"{kind_label} `{name}` has no docstring",
                    line=node.lineno,
                ))
                if len(gaps) >= 3:
                    break
    return gaps


def _find_untested(source_files: list[str], test_files: list[str]) -> list[_Gap]:
    import os
    test_stems = {
        os.path.splitext(os.path.basename(t))[0].lower()
        .removeprefix("test_").removesuffix("_test")
        .removesuffix(".test").removesuffix(".spec")
        for t in test_files
    }
    gaps: list[_Gap] = []
    for path in source_files:
        stem = os.path.splitext(os.path.basename(path))[0].lower()
        if stem not in test_stems:
            gaps.append(_Gap(
                kind="untested",
                path=path,
                detail=f"No test file found for `{os.path.basename(path)}`",
            ))
            if len(gaps) >= MAX_UNTESTED_FILES:
                break
    return gaps


def _collect_gaps(
    file_contents: dict[str, str],
    source_files: list[str],
    test_files: list[str],
) -> list[_Gap]:
    gaps: list[_Gap] = []
    for path, content in file_contents.items():
        gaps.extend(_scan_todos(path, content))
        gaps.extend(_missing_docstrings(path, content))
    gaps.extend(_find_untested(source_files, test_files))
    return gaps


# ---------------------------------------------------------------------------
# Step 2 — LLM synthesis: gaps → structured issues
# ---------------------------------------------------------------------------

_SYNTHESIS_PROMPT = """\
You are a senior open-source maintainer. Given a list of code gaps found in the \
repository "{repo_name}", generate up to {max_issues} beginner-friendly GitHub issues.

For each gap, produce ONE structured issue. Return ONLY a valid JSON array — no prose, \
no markdown fences.

Each element must have:
  "title"               — short imperative sentence (max 10 words)
  "description"         — 2-3 sentences: what to do, why it matters, what a beginner learns
  "files_affected"      — list of file paths from the gaps
  "skills"              — list of skills needed (e.g. ["Python", "unit testing"])
  "difficulty"          — float 1.0–5.0 (beginner gaps should be 1–2)
  "estimated_hours"     — float, realistic effort in hours
  "why_beginner_friendly" — one sentence explaining why this suits a newcomer
  "gap_kind"            — one of: "todo", "untested", "missing_docstring"

Gaps:
{gaps_text}
"""


async def _synthesize(repo_name: str, gaps: list[_Gap]) -> list[dict[str, Any]]:
    if not gaps:
        return []

    gaps_text = '\n'.join(
        f"- [{g.kind.upper()}] {g.path}"
        + (f":{g.line}" if g.line else "")
        + f" — {g.detail}"
        for g in gaps[:20]
    )

    prompt = _SYNTHESIS_PROMPT.format(
        repo_name=repo_name,
        max_issues=min(MAX_GENERATED, len(gaps)),
        gaps_text=gaps_text,
    )

    settings = get_settings()
    api_key = getattr(settings, 'ANTHROPIC_AUTH_TOKEN', None) or getattr(settings, 'ANTHROPIC_API_KEY', None)
    try:
        if api_key:
            call_kwargs: dict = dict(
                model='anthropic/claude-haiku-4-5-20251001',
                api_key=api_key,
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=2000,
                temperature=0.3,
            )
            base_url = getattr(settings, 'ANTHROPIC_BASE_URL', None)
            if base_url:
                call_kwargs['api_base'] = base_url
            response = await acompletion(**call_kwargs)
        else:
            response = await acompletion(
                model='ollama/qwen2.5-coder:7b',
                api_base=settings.OLLAMA_URL,
                messages=[{'role': 'user', 'content': prompt}],
                max_tokens=2000,
                temperature=0.3,
            )
        raw = response.choices[0].message.content or ''
    except Exception as exc:
        logger.warning("LLM synthesis failed: %s", exc)
        return []

    # Extract JSON array
    match = re.search(r'\[.*\]', raw, re.DOTALL)
    if not match:
        logger.warning("No JSON array in LLM response for generated issues")
        return []
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        logger.warning("Could not parse generated issues JSON: %s", exc)
        return []


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def generate_suggested_issues(
    repo_name: str,
    file_contents: dict[str, str],
    source_files: list[str],
    test_files: list[str],
) -> list[dict[str, Any]]:
    """
    Scan source files for code gaps, then ask the LLM to turn them into
    structured beginner-friendly issue suggestions.

    Returns a list of serializable dicts (GeneratedIssue fields + source="ai_generated").
    """
    gaps = _collect_gaps(file_contents, source_files, test_files)
    if not gaps:
        logger.info("No code gaps found for %s — skipping issue generation", repo_name)
        return []

    logger.info("Found %d gaps in %s — synthesizing issues", len(gaps), repo_name)
    raw_issues = await _synthesize(repo_name, gaps)

    results: list[dict[str, Any]] = []
    for item in raw_issues:
        if not isinstance(item, dict) or not item.get('title'):
            continue
        results.append({
            'title': str(item.get('title', ''))[:120],
            'description': str(item.get('description', '')),
            'files_affected': [str(f) for f in item.get('files_affected', [])],
            'skills': [str(s) for s in item.get('skills', [])],
            'difficulty': float(item.get('difficulty', 2.0)),
            'estimated_hours': float(item.get('estimated_hours', 1.0)),
            'why_beginner_friendly': str(item.get('why_beginner_friendly', '')),
            'gap_kind': str(item.get('gap_kind', 'todo')),
            'source': 'ai_generated',
        })

    return results
