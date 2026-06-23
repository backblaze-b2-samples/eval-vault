"""Diff two archived runs cell-by-cell to hunt regressions."""

from pydantic import BaseModel

from app.service.eval_store import get_manifest, get_run_grid


class CellDelta(BaseModel):
    case_id: str
    target_id: str
    base_score: float
    head_score: float
    delta: float
    regression: bool


class ComparisonResult(BaseModel):
    base_run_id: str
    head_run_id: str
    base_eval: str
    head_eval: str
    same_eval: bool
    base_avg: float
    head_avg: float
    avg_delta: float
    regressions: int
    improvements: int
    cells: list[CellDelta]


def _grid_index(grid: dict) -> dict[tuple[str, str], float]:
    return {
        (c["case_id"], c["target_id"]): float(c["score"])
        for c in grid.get("cells", [])
    }


def compare_runs(base_run_id: str, head_run_id: str) -> ComparisonResult:
    """Compare two runs; flag cells where head scores lower than base."""
    base_manifest = get_manifest(base_run_id)
    head_manifest = get_manifest(head_run_id)
    base_index = _grid_index(get_run_grid(base_run_id))
    head_index = _grid_index(get_run_grid(head_run_id))

    keys = sorted(set(base_index) | set(head_index))
    cells: list[CellDelta] = []
    regressions = improvements = 0
    for case_id, target_id in keys:
        base_score = base_index.get((case_id, target_id), 0.0)
        head_score = head_index.get((case_id, target_id), 0.0)
        delta = round(head_score - base_score, 4)
        is_regression = delta < 0
        if is_regression:
            regressions += 1
        elif delta > 0:
            improvements += 1
        cells.append(
            CellDelta(
                case_id=case_id,
                target_id=target_id,
                base_score=base_score,
                head_score=head_score,
                delta=delta,
                regression=is_regression,
            )
        )

    return ComparisonResult(
        base_run_id=base_run_id,
        head_run_id=head_run_id,
        base_eval=base_manifest.eval_name,
        head_eval=head_manifest.eval_name,
        same_eval=base_manifest.eval_name == head_manifest.eval_name,
        base_avg=base_manifest.summary.avg_score,
        head_avg=head_manifest.summary.avg_score,
        avg_delta=round(head_manifest.summary.avg_score - base_manifest.summary.avg_score, 4),
        regressions=regressions,
        improvements=improvements,
        cells=cells,
    )
