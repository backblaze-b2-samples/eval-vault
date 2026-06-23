<!-- last_verified: 2026-06-23 -->
# Feature: Run Comparison / Regression Hunting

## Purpose
Diff two archived runs cell-by-cell so you can catch regressions after changing a model or tweaking a prompt.

## Used By
- UI: `/compare` page
- API: `GET /evals/compare?base=<run_id>&head=<run_id>`

## Core Functions
- `services/api/app/service/comparison.py` — `compare_runs()`, `ComparisonResult`, `CellDelta`
- `services/api/app/service/eval_store.py` — `get_manifest()`, `get_run_grid()` (reused)
- `apps/web/src/components/evals/compare-view.tsx` — run pickers + diff table
- `apps/web/src/lib/queries.ts` — `useComparison()`

## Canonical Files
- Comparison logic: `services/api/app/service/comparison.py`
- Compare UI: `apps/web/src/components/evals/compare-view.tsx`

## Inputs
- `base`: base run id
- `head`: head run id

## Outputs
- `GET /evals/compare` → `ComparisonResult` with per-cell `base_score`, `head_score`, `delta`, `regression`, plus aggregate `avg_delta`, `regressions`, `improvements`, and `same_eval`

## Flow
- Load both manifests and grids from B2
- Union the (case, target) keys; for each, compute `head - base`
- Flag a cell as a regression when the delta is negative
- Summarize avg-score delta and the regression/improvement counts

## Edge Cases
- Either run id unknown → 404
- Comparing runs of different evals → `same_eval: false` (still computed; cell keys may not overlap)
- Cell present in only one run → the missing side scores 0

## Verification
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: comparing two archived runs returns deltas and a regression count

## Related Docs
- [Eval Library](eval-library.md)
- [Run an Eval](run-eval.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
