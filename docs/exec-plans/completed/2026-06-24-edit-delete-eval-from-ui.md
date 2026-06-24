# Plan: Edit / Delete an Eval from the UI

## Scope
- Follow-up to "Create an Eval from the UI". Let users edit and delete the evals
  they created from the UI, persisted under `evals/definitions/<name>.json` on B2.
- **Only user-created (B2) definitions are editable/deletable.** Shipped YAML
  examples (repo-root `/evals`) stay read-only — the UI must hide the actions for
  them and the backend must reject them.
- Name is immutable on edit (it is the identifier and the B2 object key). Rename
  is out of scope — delete + create instead.

## Design
- The `/evals` list must know which definitions are editable. Add a transport-only
  `EvalDefinitionSummary(EvalDefinition)` with a derived `editable` flag, returned
  by `GET /evals`. The core `EvalDefinition` stays pure (still used for create,
  update, run, and persistence — `editable` is never written to B2).
- A name is `editable` iff a B2 object `evals/definitions/<name>.json` exists.

## Steps
1. **Types** — `EvalDefinitionSummary` in `types/eval.py`; export it; mirror in
   `packages/shared/src/types.ts`.
2. **Service** (`service/eval_store.py`) — `DefinitionNotFoundError`,
   `_definition_key()`, `_user_definition_names()`, `list_definition_summaries()`,
   `update_definition()` (overwrite existing B2 def), `delete_definition()`.
3. **Routes** (`runtime/evals.py`) — `GET /evals` → summaries; `PUT /evals/{name}`
   → 200/400/404/422/502; `DELETE /evals/{name}` → 200/404/422/502.
4. **Frontend wiring** — `updateEval`/`deleteEval` in `lib/api-client.ts`;
   `useUpdateEval`/`useDeleteEval` in `lib/queries.ts`; `getEvals` typed as summaries.
5. **Frontend form** — generalize the create form into `eval-form.tsx`
   (`mode: create | edit`, prefill, locked name on edit); add `fromDefinition()`
   to `eval-create-schema.ts`; new route `/evals/[name]/edit`.
6. **Frontend list** — edit link + delete (confirm dialog) on each card, gated on
   `definition.editable`, mirroring the file-browser delete pattern.
7. **Tests + docs** — backend tests for update/delete; e2e smoke; update
   `docs/features/eval-definitions.md`, `app-workflows.md`.

## Verification
- `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure && pnpm build` — all clean.
- Manual: create an eval → Edit → change a case → Save → list reflects it → Run still works → Delete → it disappears and the dashboard count drops. Shipped evals show no edit/delete.

## Status
Done. Verification gate green: `pnpm lint`, `pnpm lint:api`, `pnpm test:api`
(50 passed — `test_eval_definitions.py` now covers the `editable` flag + update/delete
happy paths, 404 for shipped/unknown, 400 name-mismatch, 422 invalid body),
`pnpm check:structure` (5/5), `pnpm build` (`/evals/[name]/edit` generated).
e2e smoke `eval-edit-delete.spec.ts` added (run with dev servers up). Manual
end-to-end against real B2 still recommended before deploy.
