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
- **Add a feature** — check the roadmap in README or open an issue first to discuss
- **Improve documentation** — even small fixes like typos help a lot
- **Write tests** — we always need better test coverage
- **Review PRs** — feedback on open PRs is very welcome

If you're new to open source, look for issues tagged `good first issue` — these are intentionally kept small and well-scoped.

---

## Setting Up the Project

### Prerequisites
- Python 3.8 or above
- A GitHub personal access token (for API calls)
- Git

### Steps

```bash
# 1. Fork the repo on GitHub first, then clone your fork
git clone https://github.com/YOUR-USERNAME/ContribIQ.git
cd ContribIQ

# 2. Create a virtual environment
python -m venv venv
source venv/bin/activate  # on Windows: venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set your GitHub token
export GITHUB_TOKEN=your_token_here

# 5. Run the tool to verify setup
python -m contribiq analyze https://github.com/psf/requests
```

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
5. Make sure existing tests pass before requesting review
6. Be patient — maintainers will try to respond within a few days

We follow a **squash and merge** strategy to keep the commit history clean.

---

## Code Style

We use [PEP 8](https://peps.python.org/pep-0008/) as the baseline.

A few things we care about:
- Meaningful variable names — `repo_health_score` not `rhs`
- Docstrings on all public functions
- No commented-out code in PRs
- Keep functions small and focused

You can run a quick style check with:
```bash
pip install flake8
flake8 contribiq/
```

We don't enforce auto-formatting strictly right now but try to keep things consistent with the existing code.

---

## Reporting Bugs

If you find a bug, please open an issue and include:

- What you were trying to do
- What you expected to happen
- What actually happened (paste the error if there is one)
- Your Python version and OS

The more detail the better — vague bug reports are hard to reproduce and fix.

---

## Questions?

If something isn't clear, just open an issue and ask. There are no stupid questions here.
