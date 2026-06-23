<!-- last_verified: 2026-06-23 -->
# Feature: Run an Eval

## Purpose
Execute every case × target of an eval against Claude, score each answer, and archive the full bundle to B2. Real Anthropic API calls, real artifacts — nothing simulated.

## Used By
- UI: `/evals` page (Run button)
- API: `POST /evals/{name}/run`

## Core Functions
- `services/api/app/service/eval_runner.py` — `run_eval()`, `make_run_id()`
- `services/api/app/repo/provider_anthropic.py` — `AnthropicProvider.complete()` (the only `anthropic` import)
- `services/api/app/service/scoring.py` — `score_case()`
- `services/api/app/repo/b2_client.py` — `put_json()` archives each artifact
- `apps/web/src/components/evals/eval-list.tsx` — Run button + mutation
- `apps/web/src/lib/queries.ts` — `useRunEval()`

## Canonical Files
- Eval engine: `services/api/app/service/eval_runner.py`
- Provider adapter: `services/api/app/repo/provider_anthropic.py`

## Inputs
- `name`: the eval definition's name (path param)
- Requires `ANTHROPIC_API_KEY` in the environment

## Outputs
- `POST /evals/{name}/run` → `RunManifest`
- Side effects: writes `evals/runs/<run_id>/manifest.json` plus `cases/<case_id>/<target_id>/{input,output,score,trace}.json` to B2

## Flow
- Load the named definition (404 if missing)
- Construct `AnthropicProvider` (400 if `ANTHROPIC_API_KEY` is unset)
- For each case × target: call the target (thinking per the target config, default disabled), score the answer (deterministic or `llm_judge` with adaptive thinking), archive the four JSON artifacts
- Aggregate per-target and overall averages into the manifest, write `manifest.json`
- Return the manifest; the UI routes to the run's Library page

## Edge Cases
- `ANTHROPIC_API_KEY` missing → 400 with a readable message (bucket explorer / health still work)
- A single target call fails → the failure is archived (output with `error`, score 0) and the run continues
- B2 write failure → 502, logged

## Cost
- The two shipped evals total ~12 target calls + ~6 judge calls, a few hundred tokens each → roughly $0.10–0.30 per full run on blended Claude rates.

## Verification
- Test files: `services/api/tests/test_provider_anthropic.py` (no-network signature guard + scorer registry)
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: provider + scorer tests green; a live run archives a manifest + bundles to B2

## Related Docs
- [Eval Definitions](eval-definitions.md)
- [Scorers](scorers.md)
- [Eval Library](eval-library.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
