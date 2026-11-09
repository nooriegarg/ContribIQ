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
from backend.worker.tasks.generate_diagram import generate_diagram

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


@router.get("/result/{task_id}")
async def get_analysis_result(
    task_id: str,
    current_user: User = Depends(get_current_user),
):
    try:
        result: TaskiqResult = await analyze_repository.get_result(task_id=task_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Task not found or result expired")

    if result is None:
        raise HTTPException(status_code=202, detail="Analysis still in progress")

    if result.is_err:
        raise HTTPException(status_code=500, detail="Analysis task failed")

    return result.return_value


@router.post("/{task_id}/diagram")
async def start_diagram(
    task_id: str,
    current_user: User = Depends(get_current_user),
):
    try:
        result: TaskiqResult = await analyze_repository.get_result(task_id=task_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Analysis task not found")

    if result is None or result.is_err:
        raise HTTPException(status_code=400, detail="Analysis not complete")

    data = result.return_value or {}
    task = await generate_diagram.kiq(
        repo_name=data.get("repo", ""),
        description=data.get("metadata", {}).get("description"),
        tech_stack=data.get("tech_stack", []),
    )
    return {"diagram_task_id": task.task_id}


@router.get("/diagram/{diagram_task_id}")
async def get_diagram(
    diagram_task_id: str,
    current_user: User = Depends(get_current_user),
):
    try:
        result: TaskiqResult = await generate_diagram.get_result(task_id=diagram_task_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Diagram task not found")

    if result is None:
        return {"status": "pending", "mermaid_syntax": None}

    if result.is_err:
        raise HTTPException(status_code=500, detail="Diagram generation failed")

    return result.return_value


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"
