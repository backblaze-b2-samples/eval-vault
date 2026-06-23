from datetime import datetime

from pydantic import BaseModel

from app.types.eval import ScorerType


class Usage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0


class Trace(BaseModel):
    """Full request/response trace for one model call, archived verbatim."""

    model: str
    request: dict
    response_text: str
    stop_reason: str | None = None
    usage: Usage = Usage()
    latency_ms: int = 0
    error: str | None = None


class Score(BaseModel):
    scorer: ScorerType
    score: float  # 0..1
    passed: bool
    detail: str = ""


class CaseResult(BaseModel):
    """The outcome of one case run against one target."""

    case_id: str
    target_id: str
    model: str
    prompt: str
    output_text: str
    score: Score
    usage: Usage = Usage()
    latency_ms: int = 0
    error: str | None = None


class RunSummary(BaseModel):
    """Aggregate scores for a run — the manifest's headline numbers."""

    total_cases: int
    total_calls: int
    passed: int
    avg_score: float
    # Per-target average score, keyed by target id.
    per_target_avg: dict[str, float] = {}


class RunManifest(BaseModel):
    """Top-level record for an archived eval run (manifest.json on B2)."""

    run_id: str
    eval_name: str
    eval_description: str = ""
    target_ids: list[str]
    models: dict[str, str]  # target_id -> model
    created_at: datetime
    summary: RunSummary


class RunListItem(BaseModel):
    """Lightweight run descriptor for the Library list view."""

    run_id: str
    eval_name: str
    created_at: datetime
    avg_score: float
    passed: int
    total_calls: int
