"""Read-side of eval-vault: load shipped eval definitions from disk, and
list / inspect archived runs on B2, scoped to the `evals/runs/` prefix."""

import logging
from pathlib import Path

import yaml

from app.config import settings
from app.repo import get_json, list_prefix
from app.types import EvalDefinition, RunListItem, RunManifest

logger = logging.getLogger(__name__)

# Shipped example evals live at repo-root /evals (three levels up from
# this file: services/api/app/service -> services/api -> repo root... the
# api service root is parents[2]; the repo root is parents[3]).
_EVALS_DIR = Path(__file__).resolve().parents[3] / "evals"


class RunNotFoundError(Exception):
    """Raised when a run_id has no manifest on B2."""


def _run_id_re_ok(run_id: str) -> bool:
    # Run ids are slug-like; reject anything with path separators / traversal.
    return bool(run_id) and "/" not in run_id and ".." not in run_id


def list_definitions() -> list[EvalDefinition]:
    """Load every shipped eval YAML from the repo-root /evals directory."""
    definitions: list[EvalDefinition] = []
    if not _EVALS_DIR.exists():
        return definitions
    for path in sorted(_EVALS_DIR.glob("*.y*ml")):
        try:
            data = yaml.safe_load(path.read_text())
            definitions.append(EvalDefinition.model_validate(data))
        except Exception:  # skip malformed files, log and continue
            logger.warning("Failed to parse eval definition: %s", path.name)
    return definitions


def get_definition(name: str) -> EvalDefinition | None:
    for d in list_definitions():
        if d.name == name:
            return d
    return None


def list_runs() -> list[RunListItem]:
    """List archived runs (newest first) by reading each run's manifest."""
    manifest_suffix = "/manifest.json"
    keys = [k for k in list_prefix(settings.evals_prefix) if k.endswith(manifest_suffix)]
    items: list[RunListItem] = []
    for key in keys:
        try:
            manifest = RunManifest.model_validate(get_json(key))
        except Exception:  # skip unreadable manifests
            logger.warning("Skipping unreadable manifest: %s", key)
            continue
        items.append(
            RunListItem(
                run_id=manifest.run_id,
                eval_name=manifest.eval_name,
                created_at=manifest.created_at,
                avg_score=manifest.summary.avg_score,
                passed=manifest.summary.passed,
                total_calls=manifest.summary.total_calls,
            )
        )
    items.sort(key=lambda i: i.created_at, reverse=True)
    return items


def get_manifest(run_id: str) -> RunManifest:
    if not _run_id_re_ok(run_id):
        raise RunNotFoundError(run_id)
    key = f"{settings.evals_prefix}{run_id}/manifest.json"
    try:
        return RunManifest.model_validate(get_json(key))
    except RuntimeError as exc:
        raise RunNotFoundError(run_id) from exc


def get_run_grid(run_id: str) -> dict:
    """Build the cases x targets score grid for a run from its bundles."""
    if not _run_id_re_ok(run_id):
        raise RunNotFoundError(run_id)
    prefix = f"{settings.evals_prefix}{run_id}/cases/"
    score_keys = [k for k in list_prefix(prefix) if k.endswith("/score.json")]
    cells: list[dict] = []
    for key in score_keys:
        # .../cases/<case_id>/<target_id>/score.json
        parts = key.rsplit("/", 4)
        case_id, target_id = parts[-3], parts[-2]
        score = get_json(key)
        cells.append(
            {
                "case_id": case_id,
                "target_id": target_id,
                "score": score.get("score", 0.0),
                "passed": score.get("passed", False),
                "scorer": score.get("scorer", ""),
            }
        )
    return {"run_id": run_id, "cells": cells}


def get_artifact(run_id: str, case_id: str, target_id: str, kind: str) -> dict:
    """Read one input/output/score/trace artifact for a case x target cell."""
    if not all(_run_id_re_ok(p) for p in (run_id, case_id, target_id)):
        raise RunNotFoundError(run_id)
    if kind not in ("input", "output", "score", "trace"):
        raise ValueError(f"Unknown artifact kind: {kind}")
    key = f"{settings.evals_prefix}{run_id}/cases/{case_id}/{target_id}/{kind}.json"
    try:
        return get_json(key)
    except RuntimeError as exc:
        raise RunNotFoundError(run_id) from exc
