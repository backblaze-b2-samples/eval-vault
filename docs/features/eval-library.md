<!-- last_verified: 2026-06-23 -->
# Feature: Eval Library (scoped explorer)

## Purpose
Browse and inspect archived eval runs, scoped to the `evals/runs/` prefix in the bucket. Drill into a run to see the cases × targets score grid, then open any cell to read its input, output, score, and trace. This is the eval-vault analogue of a scoped asset explorer; it sits alongside (not replacing) the full bucket explorer at `/files`.

## Used By
- UI: `/library` (run list), `/library/[runId]` (run detail)
- API: `GET /evals/runs`, `GET /evals/runs/{run_id}`, `GET /evals/runs/{run_id}/grid`, `GET /evals/runs/{run_id}/cases/{case_id}/{target_id}/{kind}`

## Core Functions
- `services/api/app/service/eval_store.py` — `list_runs()`, `get_manifest()`, `get_run_grid()`, `get_artifact()`
- `apps/web/src/components/evals/run-list.tsx` — archived runs table
- `apps/web/src/components/evals/run-detail.tsx` — score grid
- `apps/web/src/components/evals/artifact-viewer.tsx` — input/output/score/trace tabs
- `apps/web/src/lib/queries.ts` — `useEvalRuns()`, `useRunManifest()`, `useRunGrid()`, `useArtifact()`

## Canonical Files
- Read-side store: `services/api/app/service/eval_store.py`
- Run detail UI: `apps/web/src/components/evals/run-detail.tsx`

## Inputs
- `run_id`, `case_id`, `target_id`, `kind` (one of input/output/score/trace) — all validated against path-traversal patterns

## Outputs
- `GET /evals/runs` → `RunListItem[]` (newest first)
- `GET /evals/runs/{run_id}` → `RunManifest`
- `GET /evals/runs/{run_id}/grid` → `{ run_id, cells: ScoreCell[] }`
- `GET .../cases/{case_id}/{target_id}/{kind}` → the archived JSON artifact

## Flow
- Library lists runs by reading every `evals/runs/*/manifest.json` on B2
- Run detail loads the manifest + grid; the grid is built from each cell's `score.json`
- Clicking a cell lazily fetches the requested artifact and renders it as formatted JSON

## Edge Cases
- Unknown / malformed run id → 404
- Unreadable manifest → skipped in the list, logged
- Empty prefix → empty state with a prompt to run an eval

## Verification
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: run list + grid + artifact fetch resolve against an archived run

## Related Docs
- [Run an Eval](run-eval.md)
- [Run Comparison](run-comparison.md)
- [File Browser](file-browser.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
