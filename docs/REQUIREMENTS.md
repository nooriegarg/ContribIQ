# ContribIQ — Problem Statement and Requirements

## 1. Problem Statement

Finding the right open-source issue to work on is surprisingly hard for new contributors. A developer arrives at an unfamiliar repository, reads the README, and is confronted with hundreds of issues with no signal about which ones match their skills, which files they touch, or how to even set up the environment. Most give up before making their first contribution.

Maintainers face the mirror problem: they want contributors, but onboarding them is expensive. There is no tooling that bridges a contributor's skill profile with the actual complexity and context of open issues.

**ContribIQ solves this** by acting as an AI-powered contributor onboarding assistant. Given any public GitHub repository, it analyses the codebase, generates a personalised setup guide, scores open issues for difficulty, ranks them against the contributor's self-reported skills, and answers plain-language questions about the code — all running locally via Ollama so no source code or personal data leaves the developer's machine.

---

## 2. Target Users

| User | Need |
|---|---|
| New open-source contributors | Understand an unfamiliar codebase quickly; find an issue that matches their skills |
| Returning contributors | Resume work on a repository after a gap; get a refresher on architecture |
| Maintainers | Reduce first-time-contributor onboarding burden; surface good-first-issues automatically |

---

## 3. Functional Requirements

### 3.1 Repository Analysis

| ID | Requirement |
|---|---|
| FR-01 | The system shall accept a public GitHub repository URL or `owner/repo` slug as input |
| FR-02 | Analysis shall run as a background task so the HTTP request returns immediately |
| FR-03 | The frontend shall stream analysis progress to the user in real time (SSE) |
| FR-04 | The result shall include: repository metadata, tech stack, directory map, file tree, open issues, and pull request activity |
| FR-05 | Analysis results shall be cached for 24 hours keyed by `owner/repo/commit-sha` to avoid redundant GitHub API calls |

### 3.2 AI Architecture Diagram

| ID | Requirement |
|---|---|
| FR-06 | The system shall generate a Mermaid architecture diagram by sampling key source files from the repository |
| FR-07 | Each node and edge in the diagram shall cite the source file that justifies it |
| FR-08 | Diagram generation shall fail explicitly if model output is invalid rather than returning a generic fallback |

### 3.3 Onboarding Plan

| ID | Requirement |
|---|---|
| FR-09 | The system shall generate a personalised "first 30 minutes" setup guide from the repository's README, file tree, and tech stack |
| FR-10 | The guide shall include: environment setup commands, key files to read, and a preview of a suitable first issue |
| FR-11 | Shell commands suggested by the LLM shall be sanitised against a whitelist before being shown to the user |
| FR-12 | A static fallback plan shall be returned if the LLM output is unusable |

### 3.4 Contributor Profile

| ID | Requirement |
|---|---|
| FR-13 | Authenticated users shall be able to store a contributor profile: programming languages, areas of interest, and experience level |
| FR-14 | The profile shall persist across sessions and be updatable at any time |

### 3.5 Issue Recommendations

| ID | Requirement |
|---|---|
| FR-15 | The system shall score each open issue on a 1–5 difficulty scale across five dimensions: files affected, cyclomatic complexity, dependency count, domain keywords, and estimated line changes |
| FR-16 | Issues shall be ranked against the contributor's skill profile using an LLM match score (0–100) with three plain-language reasons per issue |
| FR-17 | The issue list shall exclude pull requests and support search and label filtering |

### 3.6 Issue Deep-Dive

| ID | Requirement |
|---|---|
| FR-18 | Selecting an issue shall provide: AI explanation, affected files, prerequisites, impact chain, similar merged PRs (vector similarity), and a contribution checklist — all wired to `GET /issues/{issue_number}/detail` |
| FR-19 | A readiness score (0–100 %) shall indicate how prepared the contributor is to attempt a specific issue, based on five weighted dimensions — displayed in the Readiness tab via `GET /analysis/result/{task_id}/readiness/{issue_number}` |

### 3.7 Codebase Q&A

| ID | Requirement |
|---|---|
| FR-20 | The system shall embed repository source files using `BAAI/bge-small-en-v1.5` (384-dim) and store them in PostgreSQL via pgvector |
| FR-21 | A contributor shall be able to ask plain-language questions about the codebase and receive answers grounded in actual source chunks |
| FR-22 | The RAG pipeline shall retrieve the top-20 most similar chunks (one per file, max 12), build a context up to 5 000 tokens, and pass it to the LLM |

### 3.8 Authentication

| ID | Requirement |
|---|---|
| FR-23 | Users shall be able to register and log in with email and password |
| FR-24 | GitHub OAuth login shall be supported with CSRF state validation |
| FR-25 | Sessions shall use short-lived JWT access tokens (15 min) and long-lived refresh tokens (7 days) |

---

## 4. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | All LLM inference shall run locally via Ollama; no source code or user data shall be sent to external AI services |
| NFR-02 | The system shall operate on a developer laptop with 16 GB RAM without exceeding available memory |
| NFR-03 | Analysis of a typical repository (< 500 files) shall complete within 2 minutes |
| NFR-04 | The embedding batch size shall be bounded (default 20 files) to prevent OOM during large repository indexing |
| NFR-05 | The backend API shall be stateless (all session state in Valkey or the database) to allow horizontal scaling |
| NFR-06 | All components shall be deployable with a single `docker compose up` command |
| NFR-07 | The project shall be licensed under Apache 2.0 |

---

## 5. Out of Scope (v0.x)

- GitLab / Bitbucket repository support
- Private repository access (requires a GitHub personal access token and additional auth scoping)
- Real-time collaborative contribution sessions
- Cloud-hosted LLM inference (the system is intentionally local-first)
- Mobile-native client
