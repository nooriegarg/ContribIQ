import asyncio
import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from taskiq.result import TaskiqResult

from backend.api.routes.auth import get_current_user
from backend.models.user import User
from backend.services.onboarding_service import generate_onboarding_plan
from backend.worker.broker import broker
from backend.worker.tasks.analyze import analyze_repository
from backend.worker.tasks.generate_diagram import generate_diagram

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analysis", tags=["analysis"])


class AnalysisRequest(BaseModel):
    owner: str
    repo: str
    github_token: str | None = None


async def _get_task_result(task_id: str) -> TaskiqResult | None:
    if not await broker.result_backend.is_result_ready(task_id):
        return None
    return await broker.result_backend.get_result(task_id)


@router.post("/start")
async def start_analysis(
    body: AnalysisRequest,
    current_user: User = Depends(get_current_user),
):
    try:
        task = await asyncio.wait_for(
            analyze_repository.kiq(
                owner=body.owner,
                repo_name=body.repo,
                github_token=body.github_token,
            ),
            timeout=10,
        )
    except Exception as exc:
        logger.exception("Could not enqueue repository analysis")
        raise HTTPException(status_code=503, detail="Analysis queue is unavailable. Please try again.") from exc
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
                result = await _get_task_result(task_id)
            except Exception:
                logger.exception("Could not fetch analysis result for %s", task_id)
                yield _sse("error", {"error": "Could not fetch task result"})
                return

            if result is None:
                yield _sse("waiting", {"message": "Task not yet started"})
                continue

            task_data = result.return_value or {}
            steps = task_data.get("steps", [])

            for step in steps[last_step_index:]:
                yield _sse("progress", step)
                last_step_index += 1

            if result.is_err:
                yield _sse("error", {"error": "Task failed"})
                return

            if task_data.get("status") == "failed":
                errors = [step.get("data", {}).get("error") for step in steps if step.get("status") == "error"]
                yield _sse("error", {"error": next((error for error in errors if error), "Repository analysis failed")})
                return

            if task_data.get("status") == "completed":
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
        result = await _get_task_result(task_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Task not found or result expired")

    if result is None:
        raise HTTPException(status_code=202, detail="Analysis still in progress")

    if result.is_err:
        raise HTTPException(status_code=500, detail="Analysis task failed")

    if (result.return_value or {}).get("status") != "completed":
        raise HTTPException(status_code=500, detail="Repository analysis failed")

    return result.return_value


@router.post("/{task_id}/diagram")
async def start_diagram(
    task_id: str,
    current_user: User = Depends(get_current_user),
):
    try:
        result = await _get_task_result(task_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Analysis task not found")

    if result is None or result.is_err or (result.return_value or {}).get("status") != "completed":
        raise HTTPException(status_code=400, detail="Analysis not complete")

    data = result.return_value or {}
    if not data.get("owner") or not data.get("repo"):
        raise HTTPException(status_code=400, detail="Repository identity is missing. Run a new analysis.")
    task = await generate_diagram.kiq(
        owner=data["owner"],
        repo_name=data["repo"],
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
        result = await _get_task_result(diagram_task_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Diagram task not found")

    if result is None:
        return {"status": "pending", "mermaid_syntax": None}

    if result.is_err:
        raise HTTPException(status_code=500, detail="Diagram generation failed")

    return result.return_value


@router.get("/result/{task_id}/onboarding")
async def get_onboarding_plan(
    task_id: str,
    current_user: User = Depends(get_current_user),
):
    try:
        result = await _get_task_result(task_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Analysis task not found")

    if result is None:
        raise HTTPException(status_code=202, detail="Analysis still in progress")

    if result.is_err:
        raise HTTPException(status_code=500, detail="Analysis task failed")

    if (result.return_value or {}).get("status") != "completed":
        raise HTTPException(status_code=500, detail="Repository analysis failed")

    plan = await generate_onboarding_plan(result.return_value or {})
    return plan


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"
