# Changelog

All notable changes to ContribIQ are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### In Progress
- Wire `score_issues` task into the analysis pipeline so issue difficulty and match scores reach the UI automatically
- Expose a `/issues/matches` endpoint for ranked issue recommendations
- Display readiness score on the issue detail page

---

## [0.3.0] — 2026-11-25

### Added
- Per-user repository history (up to 10 entries) stored in `localStorage` keyed by user ID
- Post-login redirect to the most recent analysis
- Test-file count and coverage percentage tile on the repository overview page
- `WorkflowLayout` repository switcher and remove-from-history modal
- `DashboardPage` "analysis already exists" prompt before re-analyzing

### Fixed
- `maxStep` navigation counter now updates on every step change regardless of result state

---

## [0.2.0] — 2026-11-24

### Added
- End-to-end codebase Q&A (RAG pipeline): `POST /qa/ask` backed by pgvector cosine similarity + `qwen2.5-coder:1.5b` via LiteLLM
- `QAPanel` React component on the overview page
- `embed_repository` background task (fastembed `BAAI/bge-small-en-v1.5`, 384 dims, batch size 20)
- `code_chunks` table with `vector(384)` column (migration `0008`)
- Architecture diagram hardening: explicit failure on invalid/unsupported model output instead of generic fallback
- User profile page (`/profile`) with language/interest chips, experience selector, and avatar

### Changed
- Switched embedding model from `jina-embeddings-v2-base-code` (768 dims, 275 MB) to `bge-small-en-v1.5` (384 dims, 33 MB) — eliminates OOM on 16 GB machines
- `embed_repo.py` now fetches and embeds files in batches of 20 to bound memory usage

### Fixed
- `score_issues` test dependency shared correctly between local and CI environments
- Diagram generation no longer returns a generic technology-stack diagram when source analysis fails

---

## [0.1.0] — 2026-11-20

### Added
- FastAPI backend with async SQLAlchemy, Alembic migrations, and JWT auth (access + refresh tokens)
- GitHub OAuth login with CSRF state stored in Valkey
- Contributor profile model and `GET`/`PUT /users/me/profile` endpoints
- Repository analysis pipeline: file tree → tech stack detection → directory map, run as a TaskIQ background task
- SSE progress endpoint (`GET /analysis/stream/{task_id}`)
- AI-generated Mermaid architecture diagram via `generate_diagram` worker task (LiteLLM + Ollama `qwen2.5-coder:7b`)
- Onboarding plan generation (`GET /analysis/result/{task_id}/onboarding`) with shell-command sanitisation and fallback
- Issue difficulty scoring service (1–5 scale across five dimensions) and `score_issues` worker task
- Issue matching service (`match_issue`) — ranks issues against contributor skill profile
- Issue deep-dive backend: AI explanation, impact chain, similar PRs via GitHub API (`GET /issues/{issue_number}/detail`)
- Readiness score service (`GET /analysis/result/{task_id}/readiness/{issue_number}`) — five weighted dimensions
- React 18 + TypeScript frontend: login/signup, dashboard, overview, onboarding, profile, issues, and issue-detail pages
- Full test suite: 20+ backend `pytest` files and 15+ frontend Vitest files
- GitHub Actions CI: backend tests, frontend lint/build, CodeQL analysis, PR labeler, and job summary
- Docker Compose stack with health checks for all six services
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, issue templates, and PR template

[Unreleased]: https://github.com/nooriegarg/ContribIQ/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/nooriegarg/ContribIQ/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/nooriegarg/ContribIQ/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/nooriegarg/ContribIQ/releases/tag/v0.1.0
