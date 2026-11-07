"""
SSE endpoint for streaming repository analysis progress.

Clients POST to /analysis/start to kick off the task, then GET
/analysis/stream/{task_id} to receive progress events as SSE.

Intentional bug: the stream endpoint polls the task result on a fixed
1-second interval. If the task finishes between polls the "done" event
can be delivered up to 1 second late. More importantly, intermediate
progress steps stored in the result list are only visible after the task
completes — so the client sees no progress until the very end, then gets
all steps at once.

Issue to raise: "SSE progress stream delivers all events at once on
completion instead of incrementally"
Fix: use Valkey pub/sub to push each step event as it is emitted.
"""

import asyncio
import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from taskiq.result import TaskiqResult

from backend.api.routes.auth import get_current_user
from backend.models.user import User
from backend.worker.tasks.analyze import analyze_repository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analysis", tags=["analysis"])


class AnalysisRequest(BaseModel):
    owner: str
    repo: str
    github_token: str | None = None


@router.post("/start")
async def start_analysis(
    body: AnalysisRequest,
    current_user: User = Depends(get_current_user),
):
    task = await analyze_repository.kiq(
        owner=body.owner,
        repo_name=body.repo,
        github_token=body.github_token,
    )
    return {"task_id": task.task_id}


@router.get("/stream/{task_id}")
async def stream_analysis(
    task_id: str,
    current_user: User = Depends(get_current_user),
):
    async def event_generator():
        max_polls = 120
        poll_interval = 1.0
        last_step_index = 0

        for _ in range(max_polls):
            await asyncio.sleep(poll_interval)

            try:
                result: TaskiqResult = await analyze_repository.get_result(task_id=task_id)
            except Exception:
                yield _sse("error", {"error": "Could not fetch task result"})
                return

            if result is None:
                yield _sse("waiting", {"message": "Task not yet started"})
                continue

            # Bug: steps only available after task completes — no incremental streaming
            task_data = result.return_value or {}
            steps = task_data.get("steps", [])

            for step in steps[last_step_index:]:
                yield _sse("progress", step)
                last_step_index += 1

            if result.is_err:
                yield _sse("error", {"error": "Task failed"})
                return

            if task_data.get("status") in ("completed", "failed"):
                yield _sse("done", task_data)
                return

        yield _sse("timeout", {"error": "Analysis timed out"})

    return StreamingResponse(event_generator(), media_type="text/event-stream")


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"
