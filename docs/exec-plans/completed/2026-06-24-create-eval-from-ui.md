# Plan: Create an Eval from the UI

## Scope
- Let users define an eval from a structured UI form (no hand-writing YAML), persist it, and have it appear in the list and be runnable.
- Persist user-created definitions as JSON on B2 under `evals/definitions/<name>.json` (shipped YAML stays read-only). Disk is ephemeral on Railway.
- Create-only for v1. Edit/delete is out of scope (future follow-up).

## Steps
1. **Config** — add `definitions_prefix = "evals/definitions/"` to `config/settings.py`.
2. **Service** (`service/eval_store.py`) — add `_NAME_RE`/`_name_ok` (slug rule), `DefinitionExistsError`, `InvalidDefinitionNameError`, `create_definition()` (validate slug + uniqueness across shipped + B2, then `put_json`), and extend `list_definitions()` to merge shipped YAML + B2 JSON with graceful B2-down degradation.
3. **Types** — add `min_length=1` to `EvalDefinition.targets`/`cases` so empty evals 422 at the boundary.
4. **Route** (`runtime/evals.py`) — `POST /evals` → 201/409/422/502.
5. **Backend tests** — `tests/test_eval_definitions.py` (happy path, dup name shipped+B2, invalid name/body, merge, graceful degradation, `_name_ok` table). In-memory B2 store via monkeypatch.
6. **Frontend wiring** — `createEval()` in `lib/api-client.ts`, `useCreateEval()` in `lib/queries.ts` (invalidate `qk.evals` + `qk.evalStats`).
7. **Frontend form** — `eval-create-schema.ts` (zod mirror + `toDefinition`), `eval-create-form.tsx`, `eval-target-fields.tsx`, `eval-case-fields.tsx`, `scorer-fields.tsx`; mount `/evals/new`; add "Create eval" CTA on `/evals` header + empty state (and fix stale empty-state copy).
8. **e2e + docs** — `e2e/eval-create.spec.ts` smoke; update `docs/features/eval-definitions.md`, `app-workflows.md`, `run-eval.md`; record TOCTOU in `tech-debt-tracker.md`.

## Verification
- `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure && pnpm build` — all clean.
- Manual: `/evals` → Create eval → fill name + a target + a case → submit → redirected, eval appears, dashboard count ticks up → Run archives a run. Re-submitting same name → inline 409.

## Status
Done. Verification gate green: `pnpm lint`, `pnpm lint:api`, `pnpm test:api` (40 passed, incl. `test_eval_definitions.py`), `pnpm check:structure` (5/5), `pnpm build` (`/evals/new` generated). e2e smoke `eval-create.spec.ts` added (run with the dev servers up). Manual end-to-end against real B2/Anthropic still recommended before deploy.
