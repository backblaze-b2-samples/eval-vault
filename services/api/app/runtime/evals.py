import logging

from fastapi import APIRouter, HTTPException

from app.repo import AnthropicProvider
from app.service.comparison import ComparisonResult, compare_runs
from app.service.eval_runner import run_eval
from app.service.eval_store import (
    RunNotFoundError,
    get_artifact,
    get_definition,
    get_manifest,
    get_run_grid,
    list_definitions,
    list_runs,
)
from app.types import EvalDefinition, RunListItem, RunManifest

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/evals", response_model=list[EvalDefinition])
async def list_evals_endpoint():
    return list_definitions()


@router.get("/evals/runs", response_model=list[RunListItem])
async def list_runs_endpoint():
    return list_runs()


@router.get("/evals/stats")
async def eval_stats_endpoint():
    """Scoreboard metrics for the dashboard, scoped to archived runs."""
    definitions = list_definitions()
    runs = list_runs()
    artifacts = sum(r.total_calls * 4 for r in runs)  # input/output/score/trace each
    avg = sum(r.avg_score for r in runs) / len(runs) if runs else 0.0
    return {
        "evals_defined": len(definitions),
        "runs_archived": len(runs),
        "artifacts_stored": artifacts,
        "avg_score": round(avg, 4),
    }


@router.post("/evals/{name}/run", response_model=RunManifest)
async def run_eval_endpoint(name: str):
    definition = get_definition(name)
    if not definition:
        raise HTTPException(status_code=404, detail=f"Eval '{name}' not found")
    try:
        provider = AnthropicProvider()
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None
    try:
        manifest = run_eval(definition, provider)
    except RuntimeError as exc:
        logger.error("Eval run failed: %s", exc)
        raise HTTPException(status_code=502, detail="Eval run failed") from None
    return manifest


@router.get("/evals/runs/{run_id}", response_model=RunManifest)
async def get_run_endpoint(run_id: str):
    try:
        return get_manifest(run_id)
    except RunNotFoundError:
        raise HTTPException(status_code=404, detail="Run not found") from None


@router.get("/evals/runs/{run_id}/grid")
async def get_run_grid_endpoint(run_id: str):
    try:
        get_manifest(run_id)  # 404 fast if the run doesn't exist
    except RunNotFoundError:
        raise HTTPException(status_code=404, detail="Run not found") from None
    return get_run_grid(run_id)


@router.get("/evals/runs/{run_id}/cases/{case_id}/{target_id}/{kind}")
async def get_artifact_endpoint(run_id: str, case_id: str, target_id: str, kind: str):
    try:
        return get_artifact(run_id, case_id, target_id, kind)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None
    except RunNotFoundError:
        raise HTTPException(status_code=404, detail="Artifact not found") from None


@router.get("/evals/compare", response_model=ComparisonResult)
async def compare_endpoint(base: str, head: str):
    try:
        return compare_runs(base, head)
    except RunNotFoundError:
        raise HTTPException(status_code=404, detail="Run not found") from None
