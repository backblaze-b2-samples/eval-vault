<!-- last_verified: 2026-06-23 -->
# Feature: Dashboard (Eval Scoreboard)

## Purpose
Provide an at-a-glance scoreboard of eval activity: how many evals are defined, how many runs are archived, how many artifacts are stored, and the average score across runs.

## Used By
- UI: `/` page (Eval Scoreboard)
- API: `GET /evals/stats`, `GET /evals/runs`

## Core Functions
- `apps/web/src/components/dashboard/stats-cards.tsx` — 4 stat cards
- `apps/web/src/components/dashboard/upload-chart.tsx` — `ScoreTrendChart`, avg score per recent run
- `apps/web/src/components/dashboard/recent-uploads-table.tsx` — `RecentRunsTable`, last 10 runs
- `apps/web/src/lib/queries.ts` — `useEvalStats()`, `useEvalRuns()`
- `services/api/app/runtime/evals.py` — `GET /evals/stats` handler
- `services/api/app/service/eval_store.py` — `list_runs()`, `list_definitions()`

## Canonical Files
- Scoreboard cards: `apps/web/src/components/dashboard/stats-cards.tsx`
- Stats handler: `services/api/app/runtime/evals.py`

## Inputs
- None (dashboard loads data automatically)

## Outputs
- `GET /evals/stats` → `{ evals_defined, runs_archived, artifacts_stored, avg_score }`
- `GET /evals/runs` → `RunListItem[]` (drives the trend chart + recent-runs table)

## Flow
- Page loads → parallel API calls (eval stats, run list)
- Stat cards display evals defined, runs archived, artifacts stored, avg score
- Score-trend chart plots avg score (%) across the most recent runs, oldest → newest
- Recent-runs table shows the last 10 runs with eval name, date, passed/total, avg score; each row links to the run's Library page

## Edge Cases
- API unavailable → cards show inline error with retry
- No runs archived → empty chart + empty table messages, avg score shows "—"

## UX States
- Loading: skeleton placeholders for cards, chart, table
- Empty: "No runs archived yet" / "No runs yet"
- Loaded: populated cards, chart, table

## Verification
- Test files: `services/api/tests/` (eval store + provider tests)
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all pytest tests green, no ruff violations

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
