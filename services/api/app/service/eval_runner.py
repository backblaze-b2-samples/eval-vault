"""Execute an eval: for each case x target, call Claude, score the answer,
and archive the full bundle (input/output/score/trace) to B2 under
`evals/runs/<run_id>/`. Real calls, real artifacts — nothing simulated."""

import hashlib
import logging
from datetime import UTC, datetime

from app.config import settings
from app.repo import Provider, put_json
from app.service.scoring import score_case
from app.types import (
    CaseResult,
    EvalCase,
    EvalDefinition,
    EvalTarget,
    RunManifest,
    RunSummary,
    Score,
    Trace,
    Usage,
)

logger = logging.getLogger(__name__)


def make_run_id(eval_name: str) -> str:
    """run_id = <eval_name>-<UTC-timestamp>-<6-char-hash>."""
    ts = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    seed = f"{eval_name}-{ts}-{datetime.now(UTC).microsecond}"
    digest = hashlib.sha256(seed.encode()).hexdigest()[:6]
    safe_name = "".join(c if c.isalnum() or c in "-_" else "-" for c in eval_name)
    return f"{safe_name}-{ts}-{digest}"


def _case_prefix(run_id: str, case_id: str, target_id: str) -> str:
    return f"{settings.evals_prefix}{run_id}/cases/{case_id}/{target_id}"


def _run_one(
    *,
    run_id: str,
    target: EvalTarget,
    case: EvalCase,
    provider: Provider,
    judge_model: str,
) -> CaseResult:
    """Call the model, score it, archive input/output/score/trace bundles."""
    system = case.system or target.system
    prefix = _case_prefix(run_id, case.id, target.id)

    try:
        result = provider.complete(
            model=target.model,
            prompt=case.prompt,
            system=system,
            max_tokens=target.max_tokens,
            thinking=target.thinking,
        )
        output_text = result.text
        trace = result.trace
        err: str | None = None
    except Exception as exc:  # archive the failure, keep the run going
        logger.warning("Target call failed: case=%s target=%s", case.id, target.id)
        output_text = ""
        err = str(exc)
        trace = Trace(model=target.model, request={}, response_text="", error=err)

    if err is None:
        score = score_case(
            output_text=output_text,
            config=case.scorer,
            prompt=case.prompt,
            provider=provider,
            judge_model=judge_model,
        )
    else:
        score = Score(scorer=case.scorer.type, score=0.0, passed=False, detail=err)

    put_json(
        f"{prefix}/input.json",
        {"model": target.model, "prompt": case.prompt, "system": system,
         "thinking": target.thinking, "max_tokens": target.max_tokens},
    )
    put_json(
        f"{prefix}/output.json",
        {"text": output_text, "stop_reason": trace.stop_reason,
         "usage": trace.usage.model_dump(), "latency_ms": trace.latency_ms,
         "error": err},
    )
    put_json(f"{prefix}/score.json", score.model_dump())
    put_json(f"{prefix}/trace.json", trace.model_dump())

    return CaseResult(
        case_id=case.id,
        target_id=target.id,
        model=target.model,
        prompt=case.prompt,
        output_text=output_text,
        score=score,
        usage=trace.usage,
        latency_ms=trace.latency_ms,
        error=err,
    )


def _summarize(results: list[CaseResult], targets: list[EvalTarget]) -> RunSummary:
    total_calls = len(results)
    passed = sum(1 for r in results if r.score.passed)
    avg = sum(r.score.score for r in results) / total_calls if total_calls else 0.0
    per_target: dict[str, float] = {}
    for t in targets:
        scores = [r.score.score for r in results if r.target_id == t.id]
        per_target[t.id] = sum(scores) / len(scores) if scores else 0.0
    return RunSummary(
        total_cases=len({r.case_id for r in results}),
        total_calls=total_calls,
        passed=passed,
        avg_score=round(avg, 4),
        per_target_avg={k: round(v, 4) for k, v in per_target.items()},
    )


def run_eval(definition: EvalDefinition, provider: Provider) -> RunManifest:
    """Run every case x target, archive bundles, and write the manifest."""
    run_id = make_run_id(definition.name)
    results: list[CaseResult] = []
    for case in definition.cases:
        for target in definition.targets:
            results.append(
                _run_one(
                    run_id=run_id,
                    target=target,
                    case=case,
                    provider=provider,
                    judge_model=definition.judge_model,
                )
            )

    summary = _summarize(results, definition.targets)
    manifest = RunManifest(
        run_id=run_id,
        eval_name=definition.name,
        eval_description=definition.description,
        target_ids=[t.id for t in definition.targets],
        models={t.id: t.model for t in definition.targets},
        created_at=datetime.now(UTC),
        summary=summary,
    )
    put_json(f"{settings.evals_prefix}{run_id}/manifest.json", manifest.model_dump())
    # Usage rollup is informational; not part of the manifest contract.
    total = Usage(
        input_tokens=sum(r.usage.input_tokens for r in results),
        output_tokens=sum(r.usage.output_tokens for r in results),
    )
    logger.info(
        "Eval run archived: run_id=%s calls=%d in_tok=%d out_tok=%d",
        run_id, summary.total_calls, total.input_tokens, total.output_tokens,
    )
    return manifest
