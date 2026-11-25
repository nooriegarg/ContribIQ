# Contributing to ContribIQ

First off — thanks for taking the time to contribute! This project exists because of people like you.

This document explains how to get started, what the workflow looks like, and what we expect from contributors. Please read it before opening a PR.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Setting Up the Project](#setting-up-the-project)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Reporting Bugs](#reporting-bugs)

---

## Code of Conduct

This project follows a [Code of Conduct](CODE_OF_CONDUCT.md). By participating you agree to abide by it. Please report any unacceptable behavior to the maintainers.

---

## How Can I Contribute?

There are many ways to contribute and code is just one of them:

- **Fix a bug** — check the [issues](https://github.com/nooriegarg/ContribIQ/issues) tab
- **Add a feature** — check the status table under [Feature Areas](README.md#feature-areas) in the README (rows marked *Not started*, *not dispatched*, *not mounted* or *not shown in UI* are open) and open an issue first to discuss
- **Improve documentation** — even small fixes like typos help a lot
- **Write tests** — we always need better test coverage
- **Review PRs** — feedback on open PRs is very welcome

If you're new to open source, look for issues tagged `good first issue` — these are intentionally kept small and well-scoped.

---

## Setting Up the Project

### Prerequisites

- Python 3.12+
- Node.js 20+
- PostgreSQL 16 with the [pgvector](https://github.com/pgvector/pgvector) extension
- [Valkey](https://valkey.io) 8+ (or any Redis-compatible server)
- [Ollama](https://ollama.com) with `qwen2.5-coder:7b` pulled (needed for onboarding and architecture generation)
- Git
- A GitHub OAuth app (client ID and secret) for GitHub login, and optionally a GitHub personal access token for higher API rate limits

### Steps

```bash
# 1. Fork the repo on GitHub first, then clone your fork
git clone https://github.com/YOUR-USERNAME/ContribIQ.git
cd ContribIQ

# 2. Backend: virtual environment and dependencies
python -m venv .venv
source .venv/bin/activate  # on Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 3. Configure environment variables (copy the example and fill in your values)
cp .env.example .env

# 4. Apply database migrations and start the API
alembic upgrade head
uvicorn backend.main:app --reload
# → http://localhost:8000/health should return {"status":"ok"}

# 5. In a second terminal (venv active): start the background worker
taskiq worker backend.worker.broker:broker backend.worker.tasks

# 6. In a third terminal: start the frontend
cd frontend
npm install
cp .env.example .env.local  # set VITE_API_URL=http://localhost:8000
npm run dev
# → http://localhost:5173
```

The full setup, including the local Ollama model, is described in the README's [Local Setup](README.md#local-setup) section. `docker-compose.yml` currently defines the `db` and `valkey` services only in a usable form (the `api`, `worker` and `frontend` images need Dockerfiles that don't exist yet), so run the application services directly as shown above.

If you run into any issues setting up, please open an issue and we'll help you out.

---

## Making Changes

### Branch naming

Please create a new branch for every change. Don't work directly on `main`.

```bash
git checkout -b fix/issue-42-health-score-bug
git checkout -b feature/add-gitlab-support
git checkout -b docs/update-setup-guide
```

Branch naming convention:
- `fix/` — bug fixes
- `feature/` — new features
- `docs/` — documentation only
- `test/` — adding or fixing tests
- `refactor/` — code cleanup, no behavior change

### Commit messages

Keep commit messages clear and human-readable. No need to be overly formal.

```
fix: handle rate limit error from GitHub API
feat: add license compatibility checker
docs: fix typo in setup guide
test: add unit tests for health scorer
```

---

## Pull Request Process

1. Make sure your branch is up to date with `main` before opening a PR
2. Fill in the PR template — describe what you changed and why
3. Link the issue your PR addresses (use `Closes #42` in the description)
4. PRs require at least **1 review approval** before merging
5. Make sure the checks below pass before requesting review
6. Be patient — maintainers will try to respond within a few days

### Checks to run before opening a PR

```bash
# Backend tests (from the repository root, in the virtual environment)
python -m pip install -r requirements-dev.txt
python -m pytest backend/tests -q

# Frontend lint and type-check/build (the same steps CI runs in frontend-lint.yml)
cd frontend
npm run lint
npm run build
```

If you change a database model, add an Alembic migration and run `alembic upgrade head`. Keep each PR focused on one feature area.

We follow a **squash and merge** strategy to keep the commit history clean.

---

## Code Style

**Python (`backend/`)** — we use [PEP 8](https://peps.python.org/pep-0008/) as the baseline.

A few things we care about:
- Meaningful variable names — `repo_health_score` not `rhs`
- Docstrings on public functions
- No commented-out code in PRs
- Keep functions small and focused

You can run a quick style check with:
```bash
pip install flake8
flake8 backend/
```

**TypeScript/React (`frontend/`)** — ESLint is enforced in CI. Run `npm run lint` and `npm run build` (which type-checks with `tsc`) before pushing.

We don't enforce auto-formatting strictly right now but try to keep things consistent with the existing code.

---

## Reporting Bugs

If you find a bug, please open an issue and include:

- What you were trying to do
- What you expected to happen
- What actually happened (paste the error if there is one)
- Your Python and Node.js versions, and your OS
- Whether you ran the API and the worker (analysis and diagram generation need both), and whether Ollama is running

The more detail the better — vague bug reports are hard to reproduce and fix.

---

## Questions?

If something isn't clear, just open an issue and ask. There are no stupid questions here.
