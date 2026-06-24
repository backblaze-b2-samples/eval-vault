<!-- last_verified: 2026-06-24 -->
# Feature: Eval Definitions

## Purpose
Define an eval declaratively: a name, description, a set of model targets, and a set of test cases with scorers. Definitions come from two sources, merged at read time:
1. **Shipped YAML examples** — read-only files in `evals/*.yaml` (repo root).
2. **User-created definitions** — authored from the `/evals` → **Create eval** form and persisted as JSON on B2 under `evals/definitions/<name>.json`. These survive redeploys (the disk `evals/` dir is read-only/ephemeral in production). **Only these are editable/deletable from the UI** — shipped YAML examples are read-only.

## Used By
- Files: `evals/*.yaml` (repo root, shipped) + `evals/definitions/*.json` (B2, user-created)
- API: `GET /evals` (list, merged, with an `editable` flag), `POST /evals` (create), `PUT /evals/{name}` (edit), `DELETE /evals/{name}` (delete)
- UI: `/evals` page (list + run + per-card edit/delete on editable evals), `/evals/new` (create form), `/evals/[name]/edit` (edit form)

## Core Functions
- `services/api/app/types/eval.py` — `EvalDefinition`, `EvalTarget`, `EvalCase`, `ScorerConfig`; `EvalDefinitionSummary` (definition + transport-only `editable` flag for the list view)
- `services/api/app/service/eval_store.py` — `list_definitions()` (merge), `list_definition_summaries()` (merge + `editable`), `get_definition()`, `create_definition()`, `update_definition()`, `delete_definition()`, `_user_definition_names()` (which names are user-created), `_name_ok()` (slug rule), `DefinitionExistsError`, `InvalidDefinitionNameError`, `DefinitionNotFoundError`
- `services/api/app/runtime/evals.py` — `POST /evals`, `PUT /evals/{name}`, `DELETE /evals/{name}` routes
- `apps/web/src/components/evals/eval-form.tsx` (shared create/edit form, `mode` prop) + `eval-create-schema.ts` (`toDefinition`/`fromDefinition`), `eval-target-fields.tsx`, `eval-case-fields.tsx`, `scorer-fields.tsx`; `eval-edit-view.tsx` (loads + guards the edit page); `eval-list.tsx` (per-card edit/delete)
- `apps/web/src/lib/api-client.ts` `createEval()` / `updateEval()` / `deleteEval()`; `apps/web/src/lib/queries.ts` `useCreateEval()` / `useUpdateEval()` / `useDeleteEval()`
- `packages/shared/src/types.ts` — TypeScript mirrors (`EvalDefinition`, `EvalDefinitionSummary`)

## Canonical Files
- Definition models: `services/api/app/types/eval.py`
- Example definitions: `evals/factual-qa.yaml`, `evals/summarization-quality.yaml`
- Definitions B2 prefix setting: `settings.definitions_prefix` (`evals/definitions/`)

## YAML schema
```yaml
name: my-eval                 # unique id
description: what it measures
judge_model: claude-sonnet-4-6  # used by llm_judge scorers (default)
targets:
  - id: opus                  # the "N models" axis
    model: claude-opus-4-8
    thinking: disabled        # disabled (default) | adaptive
    max_tokens: 256
    system: "optional system prompt"
cases:
  - id: case-1
    prompt: "the user prompt"
    system: "optional per-case system override"
    scorer:
      type: contains          # exact_match | contains | regex | json_valid | llm_judge
      expected: "Paris"       # for exact_match / contains / regex
      rubric: "..."           # for llm_judge
      pass_threshold: 0.5     # 0..1, score at/above counts as passed
```

## Inputs
- A YAML file in `evals/` (shipped), **or**
- The `/evals/new` form → `POST /evals` with an `EvalDefinition` body (persisted to B2)
- The `/evals/[name]/edit` form → `PUT /evals/{name}` (edit), or the per-card **Delete** → `DELETE /evals/{name}` — both for user-created definitions only

## Outputs
- `GET /evals` → `EvalDefinitionSummary[]` (shipped YAML + B2 JSON, merged; each carries an `editable` flag)
- `POST /evals` → `201` with the created `EvalDefinition`
- `PUT /evals/{name}` → `200` with the updated `EvalDefinition`
- `DELETE /evals/{name}` → `200` with `{ "deleted": true, "name": <name> }`

## Flow
- **List:** `list_definitions()` globs `evals/*.y*ml` into a `name → definition` map, then overlays user-created JSON from `list_prefix(definitions_prefix)`. Same-name B2 definitions win. Result is sorted by name. A B2 outage degrades to the shipped set — listing never fails. `list_definition_summaries()` wraps each merged definition with `editable = name ∈ _user_definition_names()` (the names of B2 JSON objects) for the `GET /evals` response.
- **Create:** `POST /evals` validates the body against `EvalDefinition` (Pydantic, at the boundary), then `create_definition()` enforces the business rules — a valid slug name (`_NAME_RE` = `^[a-z0-9][a-z0-9-]{1,63}$`) and uniqueness across **both** shipped and B2 definitions — and `put_json`s it to `evals/definitions/<name>.json`.
- **Edit:** `PUT /evals/{name}` requires `body.name == name` (the name is immutable — it's the identifier and B2 key, so there is no rename), then `update_definition()` requires the name to already exist as a user-created (B2) definition and overwrites its JSON. Shipped-only names are read-only → `404`.
- **Delete:** `DELETE /evals/{name}` → `delete_definition()` requires a user-created definition and `delete_file`s its JSON. If a B2 definition overlays a shipped one of the same name, deleting it reveals the shipped example again.
- `get_definition()` / running an eval are unchanged; user-created definitions run identically to shipped ones. `editable` is transport-only — it is never persisted to B2 (`EvalDefinitionSummary` wraps `EvalDefinition`; only the base shape is stored).

## Edge Cases
- Invalid YAML / schema mismatch → file skipped, logged
- Missing targets or cases → rejected by `min_length=1` (Pydantic 422 on create/edit; shipped file skipped)
- Invalid name (not a slug, path traversal, empty) → `422`
- Duplicate name on create (shipped or already-created) → `409`
- Edit/delete of a shipped-only or unknown name → `404` (UI hides the actions for non-editable evals and the `/edit` page shows a read-only/not-found message)
- Edit with `body.name` ≠ URL name → `400` (rename is not supported)
- B2 write/delete failure → `502`; B2 read/list failure → falls back to shipped definitions (and treats nothing as editable)
- Name uniqueness is a read-then-write check (best-effort under concurrent creates) — see `docs/exec-plans/tech-debt-tracker.md`

## Verification
- Quick verify command: `pnpm test:api` (see `services/api/tests/test_eval_definitions.py`)
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure && pnpm build`
- Pass criteria: definitions load and validate; create returns 201 and the new eval appears in `GET /evals` with `editable: true`; duplicate/invalid names rejected; edit (`PUT`) overwrites in place and is reflected in the list; delete (`DELETE`) removes the definition; edit/delete of a shipped eval 404s

## Related Docs
- [Run an Eval](run-eval.md)
- [Scorers](scorers.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
