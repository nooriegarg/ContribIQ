# ContribIQ — Architecture and Design Decisions

This document records the key architectural choices made during ContribIQ's development, the alternatives considered, and the reasoning behind each decision. It is intended as a reference for contributors and evaluators.

---

## 1. Overall Architecture

ContribIQ is a three-tier application:

```
Browser (React + Vite)
    ↕ HTTP/JSON + SSE
FastAPI backend (Python)
    ↕ task queue (Valkey)
TaskIQ worker (Python)
    ↕ GitHub REST API, Ollama (local LLM), PostgreSQL + pgvector
```

The core design constraint is **local-first AI**: all LLM inference runs on the developer's machine via Ollama. This eliminates data-privacy concerns for contributors analysing proprietary or sensitive repositories, and removes recurring API costs during development.

---

## 2. Decision Records

---

### ADR-01 — Async task queue for repository analysis

**Context:** Repository analysis involves multiple sequential GitHub API calls, LLM inference, and database writes. Running this inside an HTTP request would hold the connection open for 30–90 seconds.

**Decision:** Use a background task queue (TaskIQ + Valkey). The API enqueues a task and returns a `task_id` immediately. The browser polls progress via a server-sent-events (SSE) endpoint.

**Alternatives considered:**
- **Celery + Redis:** Mature, but heavier; Celery is not async-native and adds serialisation complexity.
- **FastAPI `BackgroundTasks`:** Runs in the same process; a slow task starves HTTP workers and there is no durability across restarts.
- **Polling the GitHub API from the frontend directly:** Exposes GitHub tokens to the browser and bypasses caching.

**Consequence:** Contributors must run a separate worker process (`taskiq worker …`) alongside the API. This is documented in the README and CONTRIBUTING.md.

---

### ADR-02 — Valkey as both task broker and cache

**Context:** The project needs a task queue broker and a short-lived result/cache store. Redis is the standard choice but its recent licence change (SSPL) makes it unsuitable for an OSS project.

**Decision:** Use [Valkey](https://valkey.io) — the Linux Foundation BSD-3-Clause fork of Redis, wire-protocol compatible. `taskiq-redis` connects to it over the Redis protocol without modification.

**Alternatives considered:**
- **Redis:** SSPL licence is incompatible with Apache 2.0.
- **RabbitMQ:** Message broker only; would require a separate cache layer.
- **PostgreSQL as a task queue (pg-boss pattern):** Avoids a second service but adds polling overhead and complicates the data model.

**Consequence:** Operators installing from source must install Valkey (or any Redis-protocol-compatible server). Docker Compose handles this transparently.

---

### ADR-03 — pgvector for embedding storage instead of a dedicated vector database

**Context:** The codebase Q&A feature needs a vector similarity search over ~hundreds to low-thousands of code chunks per repository.

**Decision:** Use the [pgvector](https://github.com/pgvector/pgvector) PostgreSQL extension. Code chunks are stored in the same `contribiq` database alongside users, profiles, and repositories.

**Alternatives considered:**
- **Chroma:** Lightweight but adds a third stateful service; at this scale the overhead is not justified.
- **Qdrant / Weaviate / Milvus:** Production-grade but operationally heavy for a local developer tool.
- **In-memory FAISS index:** Fast but not persistent across restarts; requires re-embedding on every startup.

**Consequence:** pgvector must be built from source for the exact PostgreSQL version in use (Homebrew ships binaries for pg18+ only). The setup section in the README documents the build steps.

---

### ADR-04 — Embedding model: BAAI/bge-small-en-v1.5 (384 dims)

**Context:** The original design used `jina-embeddings-v2-base-code` (768 dims, 275 MB ONNX). During development this model consistently OOM-killed the TaskIQ worker on a 16 GB Mac (only ~922 MB free RAM was available during analysis).

**Decision:** Switch to `BAAI/bge-small-en-v1.5` — a 384-dim, 33 MB ONNX model that runs in seconds per batch on CPU.

**Trade-off:** `bge-small` is a general-purpose English model, not code-specific. For codebase Q&A the quality loss is acceptable because the retrieved chunks are still the most relevant source files; the LLM does the semantic reasoning.

**Consequence:** Existing databases created with the 768-dim column must run a migration (`ALTER TABLE code_chunks ALTER COLUMN embedding TYPE vector(384)`) and re-embed their repositories.

---

### ADR-05 — LiteLLM as the LLM abstraction layer

**Context:** The project uses Ollama for local inference today. During development it is useful to swap in cloud models (Anthropic, OpenAI) for faster iteration without changing call sites.

**Decision:** Route all LLM calls through [LiteLLM](https://github.com/BerriAI/litellm). The model name is a single environment variable (`AI_MODEL`). Switching to a cloud model (Anthropic via direct API or via the SAP Hyperspace proxy) is a one-line config change. The `ai_kwargs()` helper in `backend/core/config.py` centralises the routing logic and injects the correct base URL and auth headers depending on which model is configured.

**Alternatives considered:**
- **Call Ollama directly:** Simpler but locks every call site to Ollama's API; makes future cloud option harder.
- **LangChain:** Much heavier abstraction; ContribIQ does not need chains, agents, or memory management.

---

### ADR-06 — TaskIQ worker task registration

**Context:** TaskIQ requires tasks to be importable at worker startup. Early versions registered only `analyze_repository` and `generate_diagram`. `score_issues` was added later but not dispatched from the API (the issues table migration and matching service were not yet complete).

**Decision:** Register all tasks in `backend/worker/tasks/__init__.py` even if not all are dispatched yet. This avoids `TaskNotFound` errors if a task is enqueued before the dispatch wiring is finished, and documents the full intended pipeline.

**Consequence:** `score_issues` appears in the worker log at startup but is never enqueued by the current API. Wiring it in is documented as a suggested first contribution in the README.

---

### ADR-07 — Synchronous onboarding generation (no worker task)

**Context:** Onboarding plan generation is fast (single LLM call, < 5 s on the 7B model) and is only triggered when the user navigates to the onboarding page — not on every analysis.

**Decision:** Run onboarding generation synchronously inside the FastAPI request (`onboarding_service.py` called directly from `analysis.py`), not as a worker task.

**Trade-off:** A slow Ollama response blocks the HTTP connection for the duration. The timeout is set to 30 s; a fallback plan is returned if the model does not respond in time.

**Consequence:** Onboarding generation requires Ollama to be running but does not require the TaskIQ worker. This distinction is documented in the README.

---

### ADR-08 — JWT authentication with refresh tokens

**Context:** The project needs stateless, scalable authentication that works with both email/password and GitHub OAuth.

**Decision:** Issue short-lived JWT access tokens (15-minute expiry) alongside 7-day refresh tokens. Both are stored in `localStorage`/`sessionStorage` by the React client. GitHub OAuth state is a random token stored in Valkey with a 10-minute TTL to prevent CSRF.

**Alternatives considered:**
- **Session cookies:** Require server-side session storage; complicates horizontal scaling.
- **Opaque tokens stored in a database:** Adds a database round-trip on every authenticated request.

---

## 3. Data Model Summary

```
users           — id, email, password_hash, github_id, avatar_url, created_at
profiles        — id, user_id (FK), languages[], interests[], experience_level
repositories    — id, owner, name, full_name, description, language, stars, …
code_chunks     — id, repository_id (FK), file_path, content, embedding vector(384)
issues          — id, repository_id (FK), number, title, body, labels[], difficulty, …
```

Migrations are in `alembic/versions/` and must be applied with `alembic upgrade head` before starting the API.

---

## 4. Security Considerations

- Suggested shell commands from the LLM are sanitised against a whitelist (`onboarding_service.py`) before being shown to the user, mitigating prompt-injection attempts that could produce harmful setup instructions.
- GitHub OAuth CSRF state is a cryptographically random token stored server-side in Valkey; the callback handler rejects any state not found in the store.
- Passwords are hashed with bcrypt (passlib, 12 rounds).
- The `.env` file is in `.gitignore`; `.env.example` contains only placeholder values.
- CodeQL analysis runs on every push via `.github/workflows/codeql.yml`.
