"""Read-side of eval-vault: load shipped eval definitions from disk, and
list / inspect archived runs on B2, scoped to the `evals/runs/` prefix."""

import logging
import re
from pathlib import Path

import yaml

from app.config import settings
from app.repo import delete_file, get_json, list_prefix, put_json
from app.types import (
    EvalDefinition,
    EvalDefinitionSummary,
    RunListItem,
    RunManifest,
)

logger = logging.getLogger(__name__)

# Shipped example evals live at repo-root /evals. From this file
# (services/api/app/service/eval_store.py): parents[0]=service,
# parents[1]=app, parents[2]=services/api (the api service root),
# parents[3]=services, parents[4]=repo root.
_EVALS_DIR = Path(__file__).resolve().parents[4] / "evals"

# A definition name doubles as an identifier in `POST /evals/{name}/run` and as
# a B2 object key segment (`evals/definitions/<name>.json`). Restrict it to a
# safe lowercase slug so it can't traverse paths or break URLs. The frontend
# mirrors this exact pattern so users see the error before the round-trip.
_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,63}$")


class RunNotFoundError(Exception):
    """Raised when a run_id has no manifest on B2."""


class DefinitionExistsError(Exception):
    """Raised when a definition name already exists (shipped or user-created)."""


class InvalidDefinitionNameError(Exception):
    """Raised when a definition name is not a valid slug / B2 key segment."""


class DefinitionNotFoundError(Exception):
    """Raised when an edit/delete targets a name with no user-created (B2)
    definition. Shipped YAML examples are read-only and report as not-found here
    because the UI never exposes edit/delete for them."""


def _run_id_re_ok(run_id: str) -> bool:
    # Run ids are slug-like; reject anything with path separators / traversal.
    return bool(run_id) and "/" not in run_id and ".." not in run_id


def _name_ok(name: str) -> bool:
    return bool(_NAME_RE.match(name))


def _definition_key(name: str) -> str:
    """B2 object key for a user-created definition."""
    return f"{settings.definitions_prefix}{name}.json"


def _user_definition_names() -> set[str]:
    """Names of user-created (B2 JSON) definitions — the ones the UI may edit or
    delete. Derived from object keys, not bodies: `create_definition` always keys
    a definition as `<name>.json`, so the filename stem is the name. A B2 outage
    yields an empty set (treated as "nothing editable") rather than failing."""
    names: set[str] = set()
    try:
        for key in list_prefix(settings.definitions_prefix):
            if key.endswith(".json"):
                names.add(key.rsplit("/", 1)[-1].removesuffix(".json"))
    except RuntimeError:
        logger.warning("Could not list user definitions from B2")
    return names


def list_definitions() -> list[EvalDefinition]:
    """List eval definitions, merging shipped YAML examples (repo-root /evals)
    with user-created JSON definitions persisted on B2. B2 entries overlay
    shipped ones of the same name. A B2 outage degrades to the shipped set —
    this read must never fail (the /evals page and dashboard depend on it)."""
    by_name: dict[str, EvalDefinition] = {}
    if _EVALS_DIR.exists():
        for path in sorted(_EVALS_DIR.glob("*.y*ml")):
            try:
                data = yaml.safe_load(path.read_text())
                defn = EvalDefinition.model_validate(data)
                by_name[defn.name] = defn
            except Exception:  # skip malformed files, log and continue
                logger.warning("Failed to parse eval definition: %s", path.name)
    try:
        for key in list_prefix(settings.definitions_prefix):
            if not key.endswith(".json"):
                continue
            try:
                defn = EvalDefinition.model_validate(get_json(key))
                by_name[defn.name] = defn
            except Exception:  # skip unreadable / malformed B2 definitions
                logger.warning("Skipping unreadable definition: %s", key)
    except RuntimeError:  # B2 unreachable — fall back to shipped definitions
        logger.warning("Could not list user definitions from B2")
    return sorted(by_name.values(), key=lambda d: d.name)


def create_definition(defn: EvalDefinition) -> EvalDefinition:
    """Persist a user-created eval definition to B2 as JSON.

    `defn` is already structurally validated by Pydantic at the route boundary;
    here we own only the business rules: a safe slug name, unique across both
    shipped YAML and existing B2 definitions. Raises RuntimeError on B2 failure.
    """
    if not _name_ok(defn.name):
        raise InvalidDefinitionNameError(defn.name)
    if get_definition(defn.name) is not None:
        raise DefinitionExistsError(defn.name)
    put_json(_definition_key(defn.name), defn.model_dump(mode="json"))
    return defn


def list_definition_summaries() -> list[EvalDefinitionSummary]:
    """List view of definitions: each merged definition plus an `editable` flag
    that's True for user-created (B2) definitions and False for shipped YAML."""
    editable = _user_definition_names()
    return [
        EvalDefinitionSummary(**d.model_dump(), editable=d.name in editable)
        for d in list_definitions()
    ]


def update_definition(defn: EvalDefinition) -> EvalDefinition:
    """Overwrite an existing user-created eval definition on B2.

    `defn` is structurally validated by Pydantic at the route boundary. Here we
    own the business rules: a safe slug name and that a user-created definition
    with this name already exists — shipped-only names are read-only and raise
    DefinitionNotFoundError. The name is the identifier, so this never renames.
    """
    if not _name_ok(defn.name):
        raise InvalidDefinitionNameError(defn.name)
    if defn.name not in _user_definition_names():
        raise DefinitionNotFoundError(defn.name)
    put_json(_definition_key(defn.name), defn.model_dump(mode="json"))
    return defn


def delete_definition(name: str) -> None:
    """Delete a user-created eval definition from B2. Shipped-only names are
    read-only and raise DefinitionNotFoundError. If a B2 definition overlays a
    shipped one of the same name, deleting it reveals the shipped example again.
    """
    if not _name_ok(name):
        raise InvalidDefinitionNameError(name)
    if name not in _user_definition_names():
        raise DefinitionNotFoundError(name)
    delete_file(_definition_key(name))


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
