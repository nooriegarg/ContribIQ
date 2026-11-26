## [1.1.4](https://github.com/nooriegarg/ContribIQ/compare/v1.1.3...v1.1.4) (2026-11-26)


### Bug Fixes

* pin release.yml actions to commit SHAs ([#199](https://github.com/nooriegarg/ContribIQ/issues/199)) ([62b9934](https://github.com/nooriegarg/ContribIQ/commit/62b9934269fd8d49d00b343285a2fe266eb58858))

# Changelog

All notable changes to ContribIQ are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- `_resolve_github_token(user_id, body_token)` helper in `backend/api/routes/analysis.py` — probes the cached OAuth token against `GET /user` before use, evicts it from Valkey on 401, then falls back to the request-body token or `settings.GITHUB_TOKEN`; used by `start_analysis`, `start_diagram`, and `get_my_prs` to self-heal after a token is revoked without manual cache intervention
- Issue deep-dive UI fully wired: AI explanation, files affected, impact chain, prerequisites, similar PRs, and readiness score all connected to backend endpoints
- `GET /analysis/result/{task_id}/readiness/{issue_number}` integrated into Issue Detail page (lazy-loaded on Readiness tab)
- `getIssueDetail()` and `getReadinessScore()` API client functions in `frontend/src/api/analyze.ts`
- Onboarding plan cache versioning (`v2` key) to bust stale Ollama-generated plans after model upgrade
- "Regenerate plan" button on Onboarding page to force a fresh LLM call
- `WorkflowLayout` reset-on-taskId-change: switching repos via the sidebar now immediately clears stale result, loading, error, maxStep, and analysisReady state

### Fixed
- Stale GitHub OAuth tokens (revoked or expired) are now automatically evicted from Valkey and replaced with the `.env` `GITHUB_TOKEN` fallback, fixing 401 errors on diagram generation and PR fetching without requiring manual `valkey-cli del` intervention
- Profile back button on `/profile` (UserProfilePage) replaced hardcoded repo path link with `navigate(-1)` so it returns to the page that opened it
- Profile back button on workflow step 3 (ProfilePage) also replaced with `navigate(-1)`
- Issues page and Issue Detail tab bar now render full-width in the 2-column `.page-body` grid (`grid-column: 1 / -1`)
- Long match-reason bullets on the Issues page truncated to a single line

### Tests
- `frontend/src/test/api/analyze.test.ts` — `getIssueDetail`, `getReadinessScore` endpoint and error tests
- `frontend/src/test/pages/OnboardingPage-cache.test.tsx` — cache versioning and regenerate-button behaviour
- `frontend/src/test/components/WorkflowLayout-taskid-reset.test.tsx` — taskId change resets all stale state
- `frontend/src/test/pages/ProfileBack-navigate.test.tsx` — back button uses `navigate(-1)`, not a hardcoded link
- `backend/tests/test_pytest_cov_and_coverage.py` — broker patches added so tests run without a live Valkey instance
- `backend/tests/test_qa_service.py` — fixed `_build_context` model arg and mock lambda signature
- `backend/tests/test_issues_matching.py` — `get_settings` mock updated with all `ai_kwargs()` required fields

---

# 1.0.0 (2026-11-25)


### Bug Fixes

* **alembic:** register the User model before comparing metadata ([#30](https://github.com/manviisaxena/ContribIQ/issues/30)) ([d3d9050](https://github.com/manviisaxena/ContribIQ/commit/d3d905041534a09eae9a7b9e2eabb6e8d5cb024a))
* align users table migrations with the User model ([#46](https://github.com/manviisaxena/ContribIQ/issues/46)) ([a215dcd](https://github.com/manviisaxena/ContribIQ/commit/a215dcd588ff23cb65c35689451c6bf343fb72e9)), closes [#25](https://github.com/manviisaxena/ContribIQ/issues/25)
* architecture diagram — deployment-boundary model, caching, and GitHub auth ([#110](https://github.com/manviisaxena/ContribIQ/issues/110)) ([61849e4](https://github.com/manviisaxena/ContribIQ/commit/61849e475392646a9c1a47650bb73029a853da29))
* **auth:** include token_type bearer on auth responses ([#40](https://github.com/manviisaxena/ContribIQ/issues/40)) ([a385206](https://github.com/manviisaxena/ContribIQ/commit/a3852060afb6ca2c82e8549cffffe24c2bead4ea))
* **deps:** add email-validator for Pydantic EmailStr ([#27](https://github.com/manviisaxena/ContribIQ/issues/27)) ([f167ce1](https://github.com/manviisaxena/ContribIQ/commit/f167ce19582fbd656cf76d6fb1e5ae0592f0aed7)), closes [#22](https://github.com/manviisaxena/ContribIQ/issues/22)
* enforce minimum password length during registration ([#45](https://github.com/manviisaxena/ContribIQ/issues/45)) ([836199b](https://github.com/manviisaxena/ContribIQ/commit/836199bd9b38dc040da38ac1527fa6d2711631f5))
* estimate test coverage from test-to-source file ratio ([#130](https://github.com/manviisaxena/ContribIQ/issues/130)) ([ea41b68](https://github.com/manviisaxena/ContribIQ/commit/ea41b6887e20dd6ace9b97085a36a6baff2051e7))
* fix column width on Onboarding and Profile pages ([#113](https://github.com/manviisaxena/ContribIQ/issues/113)) ([7db3573](https://github.com/manviisaxena/ContribIQ/commit/7db357392be05ffe59307d74c7a03f0fd9b4b73b))
* **frontend:** drop unused onSwitchToLogin prop from SignupForm ([#28](https://github.com/manviisaxena/ContribIQ/issues/28)) ([83cb70e](https://github.com/manviisaxena/ContribIQ/commit/83cb70ecf6585639c5344c17ca6785758d388df0))
* handle inaccessible GitHub repositories gracefully ([#81](https://github.com/manviisaxena/ContribIQ/issues/81)) ([19225a2](https://github.com/manviisaxena/ContribIQ/commit/19225a224129bed0085a122e9d07ad42e73ec2c5))
* harden diagram generation and add repo history management ([#120](https://github.com/manviisaxena/ContribIQ/issues/120)) ([6078d76](https://github.com/manviisaxena/ContribIQ/commit/6078d760efd3a7e29dda06986103c6b64325c4fe))
* maxStep always updates on navigation regardless of result state ([#121](https://github.com/manviisaxena/ContribIQ/issues/121)) ([e3c58fa](https://github.com/manviisaxena/ContribIQ/commit/e3c58faa4f810384456ccbf568334d797048bc32))
* refresh expired access tokens ([#82](https://github.com/manviisaxena/ContribIQ/issues/82)) ([169f694](https://github.com/manviisaxena/ContribIQ/commit/169f6944fba2010574f8609ec4c711f4cc77c33d))
* register /dashboard route and add DashboardPage ([#43](https://github.com/manviisaxena/ContribIQ/issues/43)) ([625d0f8](https://github.com/manviisaxena/ContribIQ/commit/625d0f8f742ef7529abffe4ad805c9d79178bea8)), closes [#34](https://github.com/manviisaxena/ContribIQ/issues/34)
* register the GitHub OAuth router on the main API router ([#56](https://github.com/manviisaxena/ContribIQ/issues/56)) ([8f670fb](https://github.com/manviisaxena/ContribIQ/commit/8f670fba3ca919049af6258b95d8ac72b2dbe582))
* repair 5 broken backend tests ([#117](https://github.com/manviisaxena/ContribIQ/issues/117)) ([1bbd297](https://github.com/manviisaxena/ContribIQ/commit/1bbd2974893f8106a585153737f2f44aae74ab15))
* report password reset as unavailable ([#59](https://github.com/manviisaxena/ContribIQ/issues/59)) ([be53491](https://github.com/manviisaxena/ContribIQ/commit/be534914510b96e2de46cca79897c07f03a9780d))
* **security issue:** Incomplete URL substring sanitization ([#15](https://github.com/manviisaxena/ContribIQ/issues/15)) ([9076ddf](https://github.com/manviisaxena/ContribIQ/commit/9076ddf436add6901440631f0bc50d1174ad2f90))
* **security:** rate-limit login attempts per client IP ([#61](https://github.com/manviisaxena/ContribIQ/issues/61)) ([2095987](https://github.com/manviisaxena/ContribIQ/commit/209598799bdf2478b910b42c8398577ffccc3e17))
* share backend test dependencies between contributors and CI ([#119](https://github.com/manviisaxena/ContribIQ/issues/119)) ([56aef71](https://github.com/manviisaxena/ContribIQ/commit/56aef719d291bde2e1279d83648606e57f4fb1c3))
* show skeleton while onboarding plan loads ([#80](https://github.com/manviisaxena/ContribIQ/issues/80)) ([40a5778](https://github.com/manviisaxena/ContribIQ/commit/40a57787cc7a847bca078f68ed11eb21ec3a0b9d))
* **SuccessState:** align redirect timer with the displayed 3s countdown ([#12](https://github.com/manviisaxena/ContribIQ/issues/12)) ([745ace0](https://github.com/manviisaxena/ContribIQ/commit/745ace0fd881fe25a020182be67142387a4e5839)), closes [#6](https://github.com/manviisaxena/ContribIQ/issues/6)


### Features

* add async SQLAlchemy engine, session factory, and Alembic scaffold ([#17](https://github.com/manviisaxena/ContribIQ/issues/17)) ([8d20548](https://github.com/manviisaxena/ContribIQ/commit/8d205489ea74bac9d62cc36616cdc03ec69ea79e))
* add auth endpoints — register, login, refresh, and get current user ([#31](https://github.com/manviisaxena/ContribIQ/issues/31)) ([d960b99](https://github.com/manviisaxena/ContribIQ/commit/d960b993a65c85eda8a64877b8f4386f1655839f))
* add CI workflow with test coverage enforcement ([#116](https://github.com/manviisaxena/ContribIQ/issues/116)) ([db0d15a](https://github.com/manviisaxena/ContribIQ/commit/db0d15a92672ad1ce737161d82ce08d26fe4fdc0))
* add comprehensive frontend and backend unit tests  ([#108](https://github.com/manviisaxena/ContribIQ/issues/108)) ([4d5007a](https://github.com/manviisaxena/ContribIQ/commit/4d5007a8a93dbefd6bc1bce92a2084e11ffb72a7))
* add issue difficulty scoring and AI contributor matching ([#75](https://github.com/manviisaxena/ContribIQ/issues/75)) ([43d1e8d](https://github.com/manviisaxena/ContribIQ/commit/43d1e8d40554f2c8175b55868c833113ec9bbb01))
* add Repository model, schema, and service for GitHub repository metadata and added eslint workflow ([#57](https://github.com/manviisaxena/ContribIQ/issues/57)) ([0314eb0](https://github.com/manviisaxena/ContribIQ/commit/0314eb0b4faf4b4c4bc3b1b9fb07a6d50430e3e3))
* add repository switcher to workflow sidebar ([#111](https://github.com/manviisaxena/ContribIQ/issues/111)) ([dce020c](https://github.com/manviisaxena/ContribIQ/commit/dce020c0f298aa4faf03b739ec65759f2de4b52a)), closes [#110](https://github.com/manviisaxena/ContribIQ/issues/110)
* add user profile page and post-signup onboarding setup ([#118](https://github.com/manviisaxena/ContribIQ/issues/118)) ([26700e2](https://github.com/manviisaxena/ContribIQ/commit/26700e2176f396272034b9ba35f1fe4c50a7d934))
* analysis pipeline task and SSE progress endpoint ([#60](https://github.com/manviisaxena/ContribIQ/issues/60)) ([c20fe24](https://github.com/manviisaxena/ContribIQ/commit/c20fe243c1d3106fe1436d55ea92b5abf4ed68a6))
* authenticate diagram generation, add retries, and improve onboarding UX ([#109](https://github.com/manviisaxena/ContribIQ/issues/109)) ([35c8bf0](https://github.com/manviisaxena/ContribIQ/commit/35c8bf050d2276c84c981014c085b7868ad43915))
* **auth:** implement password hashing and JWT token utilities ([#20](https://github.com/manviisaxena/ContribIQ/issues/20)) ([9858ce2](https://github.com/manviisaxena/ContribIQ/commit/9858ce221538dcadc76d8142a7b43424e5377070))
* cache workflow step data in sessionStorage to avoid re-fetching on navigation ([#115](https://github.com/manviisaxena/ContribIQ/issues/115)) ([5f351fb](https://github.com/manviisaxena/ContribIQ/commit/5f351fbc0329071d16158ec17b91ad12fed10c3a))
* contributor readiness score — GET /analysis/result/{task_id}/readiness/{issue_number} ([#79](https://github.com/manviisaxena/ContribIQ/issues/79)) ([d6aa59c](https://github.com/manviisaxena/ContribIQ/commit/d6aa59cbac769bafadff0d8fae844132bc3d50fa))
* **frontend:** add onboarding and contributor profile screens ([#69](https://github.com/manviisaxena/ContribIQ/issues/69)) ([e39ed5f](https://github.com/manviisaxena/ContribIQ/commit/e39ed5fd969e79dba5111017b06ab9dcd982942f))
* GitHub OAuth2 flow — login redirect and callback ([#41](https://github.com/manviisaxena/ContribIQ/issues/41)) ([6de3f08](https://github.com/manviisaxena/ContribIQ/commit/6de3f0833ee093360cfc650288a7b666d7132904))
* handle GitHub OAuth callback and redirect to dashboard ([#85](https://github.com/manviisaxena/ContribIQ/issues/85)) ([e1bd19e](https://github.com/manviisaxena/ContribIQ/commit/e1bd19eb2ebd697adcc8ff84ff2cdabc91168bac))
* issue deep-dive, readiness score, UI fixes, and repo-switch correctness. ([#129](https://github.com/manviisaxena/ContribIQ/issues/129)) ([e9bc246](https://github.com/manviisaxena/ContribIQ/commit/e9bc246691ed75106cc6047018ef3ad51fa61549))
* issue recommendations screen and pgvector embedding pipeline ([#76](https://github.com/manviisaxena/ContribIQ/issues/76)) ([692d4d2](https://github.com/manviisaxena/ContribIQ/commit/692d4d24cc65d160ec71f9f80c2770c771032ecc))
* per-user repo history, login redirect, and test stats on overview ([#123](https://github.com/manviisaxena/ContribIQ/issues/123)) ([b03a76b](https://github.com/manviisaxena/ContribIQ/commit/b03a76b70f6b6e00d23fc387702f4819ca2eafce))
* pgvector embedding pipeline, issue deep-dive backend and screen ([#78](https://github.com/manviisaxena/ContribIQ/issues/78)) ([23477bd](https://github.com/manviisaxena/ContribIQ/commit/23477bd903d07fc0068858386413d0c3213538f4))
* progressive step unlock with localStorage persistence and test coverage ([#114](https://github.com/manviisaxena/ContribIQ/issues/114)) ([71603c2](https://github.com/manviisaxena/ContribIQ/commit/71603c26dfca6d23363aa67bdfe12cd1eea3014e))
* upgrade architecture diagram to gitdiagram-style 2-stage pipeline ([#124](https://github.com/manviisaxena/ContribIQ/issues/124)) ([9a95043](https://github.com/manviisaxena/ContribIQ/commit/9a95043755bb506982abf79ad1a2644a0919ffe6))
* use settings token in worker tasks; profile page 2x2 grid ([#112](https://github.com/manviisaxena/ContribIQ/issues/112)) ([60c0aba](https://github.com/manviisaxena/ContribIQ/commit/60c0aba7b5e93bc5f7dbd33ad84275492dd72039))
* wire frontend auth to real backend API ([#42](https://github.com/manviisaxena/ContribIQ/issues/42)) ([edd4bd9](https://github.com/manviisaxena/ContribIQ/commit/edd4bd930f80a4ef06b71554a463192fc9702a84))
* wire up codebase Q&A end to end ([#122](https://github.com/manviisaxena/ContribIQ/issues/122)) ([9c55a92](https://github.com/manviisaxena/ContribIQ/commit/9c55a929f08fd5567181462c1436421e584aa2c0))

# 1.0.0 (2026-11-25)


### Bug Fixes

* **alembic:** register the User model before comparing metadata ([#30](https://github.com/manviisaxena/ContribIQ/issues/30)) ([d3d9050](https://github.com/manviisaxena/ContribIQ/commit/d3d905041534a09eae9a7b9e2eabb6e8d5cb024a))
* align users table migrations with the User model ([#46](https://github.com/manviisaxena/ContribIQ/issues/46)) ([a215dcd](https://github.com/manviisaxena/ContribIQ/commit/a215dcd588ff23cb65c35689451c6bf343fb72e9)), closes [#25](https://github.com/manviisaxena/ContribIQ/issues/25)
* architecture diagram — deployment-boundary model, caching, and GitHub auth ([#110](https://github.com/manviisaxena/ContribIQ/issues/110)) ([61849e4](https://github.com/manviisaxena/ContribIQ/commit/61849e475392646a9c1a47650bb73029a853da29))
* **auth:** include token_type bearer on auth responses ([#40](https://github.com/manviisaxena/ContribIQ/issues/40)) ([a385206](https://github.com/manviisaxena/ContribIQ/commit/a3852060afb6ca2c82e8549cffffe24c2bead4ea))
* **deps:** add email-validator for Pydantic EmailStr ([#27](https://github.com/manviisaxena/ContribIQ/issues/27)) ([f167ce1](https://github.com/manviisaxena/ContribIQ/commit/f167ce19582fbd656cf76d6fb1e5ae0592f0aed7)), closes [#22](https://github.com/manviisaxena/ContribIQ/issues/22)
* enforce minimum password length during registration ([#45](https://github.com/manviisaxena/ContribIQ/issues/45)) ([836199b](https://github.com/manviisaxena/ContribIQ/commit/836199bd9b38dc040da38ac1527fa6d2711631f5))
* estimate test coverage from test-to-source file ratio ([#130](https://github.com/manviisaxena/ContribIQ/issues/130)) ([ea41b68](https://github.com/manviisaxena/ContribIQ/commit/ea41b6887e20dd6ace9b97085a36a6baff2051e7))
* fix column width on Onboarding and Profile pages ([#113](https://github.com/manviisaxena/ContribIQ/issues/113)) ([7db3573](https://github.com/manviisaxena/ContribIQ/commit/7db357392be05ffe59307d74c7a03f0fd9b4b73b))
* **frontend:** drop unused onSwitchToLogin prop from SignupForm ([#28](https://github.com/manviisaxena/ContribIQ/issues/28)) ([83cb70e](https://github.com/manviisaxena/ContribIQ/commit/83cb70ecf6585639c5344c17ca6785758d388df0))
* handle inaccessible GitHub repositories gracefully ([#81](https://github.com/manviisaxena/ContribIQ/issues/81)) ([19225a2](https://github.com/manviisaxena/ContribIQ/commit/19225a224129bed0085a122e9d07ad42e73ec2c5))
* harden diagram generation and add repo history management ([#120](https://github.com/manviisaxena/ContribIQ/issues/120)) ([6078d76](https://github.com/manviisaxena/ContribIQ/commit/6078d760efd3a7e29dda06986103c6b64325c4fe))
* maxStep always updates on navigation regardless of result state ([#121](https://github.com/manviisaxena/ContribIQ/issues/121)) ([e3c58fa](https://github.com/manviisaxena/ContribIQ/commit/e3c58faa4f810384456ccbf568334d797048bc32))
* refresh expired access tokens ([#82](https://github.com/manviisaxena/ContribIQ/issues/82)) ([169f694](https://github.com/manviisaxena/ContribIQ/commit/169f6944fba2010574f8609ec4c711f4cc77c33d))
* register /dashboard route and add DashboardPage ([#43](https://github.com/manviisaxena/ContribIQ/issues/43)) ([625d0f8](https://github.com/manviisaxena/ContribIQ/commit/625d0f8f742ef7529abffe4ad805c9d79178bea8)), closes [#34](https://github.com/manviisaxena/ContribIQ/issues/34)
* register the GitHub OAuth router on the main API router ([#56](https://github.com/manviisaxena/ContribIQ/issues/56)) ([8f670fb](https://github.com/manviisaxena/ContribIQ/commit/8f670fba3ca919049af6258b95d8ac72b2dbe582))
* repair 5 broken backend tests ([#117](https://github.com/manviisaxena/ContribIQ/issues/117)) ([1bbd297](https://github.com/manviisaxena/ContribIQ/commit/1bbd2974893f8106a585153737f2f44aae74ab15))
* report password reset as unavailable ([#59](https://github.com/manviisaxena/ContribIQ/issues/59)) ([be53491](https://github.com/manviisaxena/ContribIQ/commit/be534914510b96e2de46cca79897c07f03a9780d))
* **security issue:** Incomplete URL substring sanitization ([#15](https://github.com/manviisaxena/ContribIQ/issues/15)) ([9076ddf](https://github.com/manviisaxena/ContribIQ/commit/9076ddf436add6901440631f0bc50d1174ad2f90))
* **security:** rate-limit login attempts per client IP ([#61](https://github.com/manviisaxena/ContribIQ/issues/61)) ([2095987](https://github.com/manviisaxena/ContribIQ/commit/209598799bdf2478b910b42c8398577ffccc3e17))
* share backend test dependencies between contributors and CI ([#119](https://github.com/manviisaxena/ContribIQ/issues/119)) ([56aef71](https://github.com/manviisaxena/ContribIQ/commit/56aef719d291bde2e1279d83648606e57f4fb1c3))
* show skeleton while onboarding plan loads ([#80](https://github.com/manviisaxena/ContribIQ/issues/80)) ([40a5778](https://github.com/manviisaxena/ContribIQ/commit/40a57787cc7a847bca078f68ed11eb21ec3a0b9d))
* **SuccessState:** align redirect timer with the displayed 3s countdown ([#12](https://github.com/manviisaxena/ContribIQ/issues/12)) ([745ace0](https://github.com/manviisaxena/ContribIQ/commit/745ace0fd881fe25a020182be67142387a4e5839)), closes [#6](https://github.com/manviisaxena/ContribIQ/issues/6)


### Features

* add async SQLAlchemy engine, session factory, and Alembic scaffold ([#17](https://github.com/manviisaxena/ContribIQ/issues/17)) ([8d20548](https://github.com/manviisaxena/ContribIQ/commit/8d205489ea74bac9d62cc36616cdc03ec69ea79e))
* add auth endpoints — register, login, refresh, and get current user ([#31](https://github.com/manviisaxena/ContribIQ/issues/31)) ([d960b99](https://github.com/manviisaxena/ContribIQ/commit/d960b993a65c85eda8a64877b8f4386f1655839f))
* add CI workflow with test coverage enforcement ([#116](https://github.com/manviisaxena/ContribIQ/issues/116)) ([db0d15a](https://github.com/manviisaxena/ContribIQ/commit/db0d15a92672ad1ce737161d82ce08d26fe4fdc0))
* add comprehensive frontend and backend unit tests  ([#108](https://github.com/manviisaxena/ContribIQ/issues/108)) ([4d5007a](https://github.com/manviisaxena/ContribIQ/commit/4d5007a8a93dbefd6bc1bce92a2084e11ffb72a7))
* add issue difficulty scoring and AI contributor matching ([#75](https://github.com/manviisaxena/ContribIQ/issues/75)) ([43d1e8d](https://github.com/manviisaxena/ContribIQ/commit/43d1e8d40554f2c8175b55868c833113ec9bbb01))
* add Repository model, schema, and service for GitHub repository metadata and added eslint workflow ([#57](https://github.com/manviisaxena/ContribIQ/issues/57)) ([0314eb0](https://github.com/manviisaxena/ContribIQ/commit/0314eb0b4faf4b4c4bc3b1b9fb07a6d50430e3e3))
* add repository switcher to workflow sidebar ([#111](https://github.com/manviisaxena/ContribIQ/issues/111)) ([dce020c](https://github.com/manviisaxena/ContribIQ/commit/dce020c0f298aa4faf03b739ec65759f2de4b52a)), closes [#110](https://github.com/manviisaxena/ContribIQ/issues/110)
* add user profile page and post-signup onboarding setup ([#118](https://github.com/manviisaxena/ContribIQ/issues/118)) ([26700e2](https://github.com/manviisaxena/ContribIQ/commit/26700e2176f396272034b9ba35f1fe4c50a7d934))
* analysis pipeline task and SSE progress endpoint ([#60](https://github.com/manviisaxena/ContribIQ/issues/60)) ([c20fe24](https://github.com/manviisaxena/ContribIQ/commit/c20fe243c1d3106fe1436d55ea92b5abf4ed68a6))
* authenticate diagram generation, add retries, and improve onboarding UX ([#109](https://github.com/manviisaxena/ContribIQ/issues/109)) ([35c8bf0](https://github.com/manviisaxena/ContribIQ/commit/35c8bf050d2276c84c981014c085b7868ad43915))
* **auth:** implement password hashing and JWT token utilities ([#20](https://github.com/manviisaxena/ContribIQ/issues/20)) ([9858ce2](https://github.com/manviisaxena/ContribIQ/commit/9858ce221538dcadc76d8142a7b43424e5377070))
* cache workflow step data in sessionStorage to avoid re-fetching on navigation ([#115](https://github.com/manviisaxena/ContribIQ/issues/115)) ([5f351fb](https://github.com/manviisaxena/ContribIQ/commit/5f351fbc0329071d16158ec17b91ad12fed10c3a))
* contributor readiness score — GET /analysis/result/{task_id}/readiness/{issue_number} ([#79](https://github.com/manviisaxena/ContribIQ/issues/79)) ([d6aa59c](https://github.com/manviisaxena/ContribIQ/commit/d6aa59cbac769bafadff0d8fae844132bc3d50fa))
* **frontend:** add onboarding and contributor profile screens ([#69](https://github.com/manviisaxena/ContribIQ/issues/69)) ([e39ed5f](https://github.com/manviisaxena/ContribIQ/commit/e39ed5fd969e79dba5111017b06ab9dcd982942f))
* GitHub OAuth2 flow — login redirect and callback ([#41](https://github.com/manviisaxena/ContribIQ/issues/41)) ([6de3f08](https://github.com/manviisaxena/ContribIQ/commit/6de3f0833ee093360cfc650288a7b666d7132904))
* handle GitHub OAuth callback and redirect to dashboard ([#85](https://github.com/manviisaxena/ContribIQ/issues/85)) ([e1bd19e](https://github.com/manviisaxena/ContribIQ/commit/e1bd19eb2ebd697adcc8ff84ff2cdabc91168bac))
* issue deep-dive, readiness score, UI fixes, and repo-switch correctness. ([#129](https://github.com/manviisaxena/ContribIQ/issues/129)) ([e9bc246](https://github.com/manviisaxena/ContribIQ/commit/e9bc246691ed75106cc6047018ef3ad51fa61549))
* issue recommendations screen and pgvector embedding pipeline ([#76](https://github.com/manviisaxena/ContribIQ/issues/76)) ([692d4d2](https://github.com/manviisaxena/ContribIQ/commit/692d4d24cc65d160ec71f9f80c2770c771032ecc))
* per-user repo history, login redirect, and test stats on overview ([#123](https://github.com/manviisaxena/ContribIQ/issues/123)) ([b03a76b](https://github.com/manviisaxena/ContribIQ/commit/b03a76b70f6b6e00d23fc387702f4819ca2eafce))
* pgvector embedding pipeline, issue deep-dive backend and screen ([#78](https://github.com/manviisaxena/ContribIQ/issues/78)) ([23477bd](https://github.com/manviisaxena/ContribIQ/commit/23477bd903d07fc0068858386413d0c3213538f4))
* progressive step unlock with localStorage persistence and test coverage ([#114](https://github.com/manviisaxena/ContribIQ/issues/114)) ([71603c2](https://github.com/manviisaxena/ContribIQ/commit/71603c26dfca6d23363aa67bdfe12cd1eea3014e))
* upgrade architecture diagram to gitdiagram-style 2-stage pipeline ([#124](https://github.com/manviisaxena/ContribIQ/issues/124)) ([9a95043](https://github.com/manviisaxena/ContribIQ/commit/9a95043755bb506982abf79ad1a2644a0919ffe6))
* use settings token in worker tasks; profile page 2x2 grid ([#112](https://github.com/manviisaxena/ContribIQ/issues/112)) ([60c0aba](https://github.com/manviisaxena/ContribIQ/commit/60c0aba7b5e93bc5f7dbd33ad84275492dd72039))
* wire frontend auth to real backend API ([#42](https://github.com/manviisaxena/ContribIQ/issues/42)) ([edd4bd9](https://github.com/manviisaxena/ContribIQ/commit/edd4bd930f80a4ef06b71554a463192fc9702a84))
* wire up codebase Q&A end to end ([#122](https://github.com/manviisaxena/ContribIQ/issues/122)) ([9c55a92](https://github.com/manviisaxena/ContribIQ/commit/9c55a929f08fd5567181462c1436421e584aa2c0))

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
