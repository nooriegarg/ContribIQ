# Changelog

All notable changes to ContribIQ are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] — 2026-11-25

First public release of ContribIQ — an AI-powered open-source contributor assistant.

### Features

- **GitHub OAuth** — sign in with GitHub; access tokens stored securely per user (#85, #82)
- **Repository analysis pipeline** — async TaskIQ worker fetches metadata, file tree, tech stack, issues, and PRs; SSE progress endpoint streams step-by-step status to the frontend (#60)
- **Architecture diagram** — generates a Mermaid flowchart from repository source files via a local LLM; retries on failure; diagram cached in Valkey (#67, #109, #110, #120)
- **Issue scoring & AI contributor matching** — scores open issues by difficulty and matches them to contributor profiles using embeddings (#75)
- **pgvector embedding pipeline** — embeds repository files into PostgreSQL with the pgvector extension for semantic search (#76, #78, #23477bd)
- **Issue deep-dive screen** — per-issue readiness score and contributor match breakdown (#78, #79)
- **Codebase Q&A** — ask natural-language questions about any indexed repository; answers grounded in embedded source files (#122)
- **Contributor readiness score** — `GET /analysis/result/{task_id}/readiness/{issue_number}` endpoint (#79)
- **Onboarding plan** — AI-generated step-by-step onboarding guide for new contributors; cached per repository (#68, #118)
- **Repository switcher** — switch between previously analysed repos from the workflow sidebar (#111)
- **User profile page** — post-signup onboarding and contributor profile setup (#118)
- **Per-user repo history** — dashboard shows each user's previously analysed repositories (#123)

### Infrastructure

- **CI workflow** — GitHub Actions runs backend tests with coverage enforcement on every PR (#116)
- **ESLint workflow** — frontend linting enforced in CI (#57)
- **PR labeler** — auto-labels PRs by changed paths (#107)
- **Rate limiting** — login attempts rate-limited per client IP via SlowAPI (#61)
- **Valkey caching** — analysis results and onboarding plans cached with 24 h TTL
- **SessionStorage persistence** — workflow step data cached in the browser to avoid re-fetching on navigation (#115)
- **Progressive step unlock** — workflow steps unlock as analysis progresses, with localStorage persistence (#114)

### Bug Fixes

- Fix expired GitHub access token refresh (#82)
- Gracefully handle inaccessible or private repositories (#81)
- Show skeleton while onboarding plan loads (#80)
- Fix GitHub OAuth router registration (#56)
- Fix ESLint CI failure (#65)
- Fix column width on Onboarding and Profile pages (#113)
- Fix `maxStep` always updating on navigation regardless of result state (#121)
- Repair 5 broken backend tests after refactor (#117)
- Share backend test dependencies between contributors and CI (#119)

---

## [Unreleased]

- Upgraded architecture diagram to gitdiagram-style 2-stage Claude pipeline with subgraphs, color classes, and deterministic Mermaid compiler
- gitdiagram file scoring logic for better source file selection
- Claude / SAP Hyperspace proxy support for faster diagram generation
