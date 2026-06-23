<!-- last_verified: 2026-06-23 -->
# Architecture

## Components

- **apps/web/** — Next.js 16 frontend (App Router, Tailwind v4, shadcn/ui)
  - Eval Scoreboard dashboard (evals defined, runs archived, artifacts stored, avg score, score-trend chart, recent runs)
  - Evals page — list eval definitions, run an eval against the configured targets
  - Library — scoped explorer over archived runs (`evals/runs/`), with a cases × targets score grid and an input/output/score/trace viewer
  - Compare — diff two runs to hunt regressions
  - Full bucket explorer (`/files`) and upload page (eval YAMLs / artifacts)
  - Dark mode via `next-themes`
- **services/api/** — FastAPI backend (layered architecture)
  - REST API for evals, runs, artifacts, comparison, plus file upload/list/delete
  - B2 S3 integration via boto3 (`repo/b2_client.py`)
  - Anthropic (Claude) integration via the SDK (`repo/provider_anthropic.py`) — the only place `anthropic` is imported
  - Eval engine: load definition → run each case × target → score → archive bundle to B2
  - Health check endpoint with B2 connectivity verification
  - Structured JSON logging with request tracing
  - Prometheus-format metrics endpoint
- **packages/shared/** — TypeScript type definitions mirroring the Pydantic models
- **evals/** — repo-root, shipped: example eval definition YAMLs

## Backend Layering

The API follows a strict layered architecture:

```
types/     Pydantic models — no logic, no imports from other layers
  |
config/    Settings (pydantic-settings) — depends only on types
  |
repo/      Data access — boto3 B2 client + Anthropic provider adapter
  |
service/   Business logic — eval runner, scoring, eval store, comparison
  |
runtime/   FastAPI routes — calls service, never repo directly
```

### Layering Rules

1. Dependencies flow downward only: `types` -> `config` -> `repo` -> `service` -> `runtime`
2. No backward imports (e.g., service must not import from runtime)
3. `boto3` only allowed in `repo/` — verified by `test_boto3_only_in_repo`
4. `anthropic` only allowed in `repo/` — verified by `test_anthropic_only_in_repo`
5. All boundary data uses Pydantic models (no raw dicts across layers)
6. Each file stays under 300 lines

### Directory Structure

```
services/api/
  main.py                  App entrypoint, middleware, router registration
  app/
    types/                 Pydantic models (eval.py, run.py, files.py, stats.py, upload.py)
    config/                Settings loaded from environment
    repo/                  B2 S3 client + Anthropic provider adapter
    service/               eval_runner, scoring, eval_store, comparison, upload, files
    runtime/               FastAPI route handlers (evals.py, files.py, upload.py, health.py, metrics.py)
  tests/                   pytest tests (structural + integration + provider guard)
evals/                     Shipped example eval YAMLs
```

## Data Stores

- **Backblaze B2** — object storage (S3-compatible API), the sole data store. No application database.
- Eval run bundles are written under `evals/runs/<run_id>/` as immutable JSON.

### B2 artifact layout

`run_id = <eval_name>-<UTC-timestamp>-<6-char-hash>`

```
evals/runs/<run_id>/
  manifest.json                                  # eval name, targets, timestamps, aggregate scores
  cases/<case_id>/<target_id>/input.json         # prompt, system, model, params
  cases/<case_id>/<target_id>/output.json        # text, usage, latency_ms, stop_reason, error
  cases/<case_id>/<target_id>/score.json         # scorer type, score 0..1, passed, detail
  cases/<case_id>/<target_id>/trace.json         # full request + response trace + timing
```

All B2 access goes through the single boto3 S3 client in `repo/b2_client.py`
(`signature_version=s3v4`, custom `user_agent_extra=b2ai-eval-vault`). The
endpoint is derived from `B2_REGION` — no hardcoded region.

## External Services

- **Backblaze B2 S3 API** — artifact storage, listing, retrieval, presigned URLs
- **Anthropic Claude (Messages API)** — the models under test and the LLM judge. Wrapped behind a small `Provider` protocol in `repo/`. Target calls use `thinking={"type":"disabled"}`; judge calls use adaptive thinking.

## Trust Boundaries

See [docs/SECURITY.md](docs/SECURITY.md) for full security documentation.

- **Frontend -> API** — CORS-restricted to configured origins
- **API -> B2** — authenticated via application keys, signature v4
- **API -> Anthropic** — authenticated via `ANTHROPIC_API_KEY` (env only, never committed)
- **Client -> B2** — presigned URLs for download (10-min expiry, forced attachment)

## Data Flows

- **Run an eval**: Browser -> `POST /evals/{name}/run` -> service loads the YAML definition -> for each case × target, calls the Anthropic provider, scores the answer, and archives input/output/score/trace bundles -> writes `manifest.json` -> returns the manifest
- **List runs**: Browser -> `GET /evals/runs` -> service lists `evals/runs/` manifests on B2
- **Inspect a run**: Browser -> `GET /evals/runs/{run_id}/grid` (+ `.../cases/{case}/{target}/{kind}` for a cell) -> service reads the archived bundles
- **Compare**: Browser -> `GET /evals/compare?base=&head=` -> service diffs the two runs' grids and flags regressions
- **Upload / List / Download / Delete** (full bucket explorer): same as the starter — multipart upload, `list_objects_v2`, presigned URLs, `delete_object`

## Observability

- Structured JSON logging on all requests with `request_id`
- Request timing middleware
- `/metrics` endpoint (Prometheus format)
- `/health` endpoint (B2 connectivity check)

## Canonical Files

- Anthropic provider adapter (repo layer): `services/api/app/repo/provider_anthropic.py`
- B2 data access (repo layer): `services/api/app/repo/b2_client.py`
- Eval engine: `services/api/app/service/eval_runner.py`
- Scorer registry: `services/api/app/service/scoring.py`
- Read-side store: `services/api/app/service/eval_store.py`
- Comparison: `services/api/app/service/comparison.py`
- Eval routes: `services/api/app/runtime/evals.py`
- Pydantic models: `services/api/app/types/` (`eval.py`, `run.py`, ...)
- Structural tests: `services/api/tests/test_structure.py`
- Frontend API client: `apps/web/src/lib/api-client.ts`
- Shared TypeScript types: `packages/shared/src/types.ts`

## Core Features

- [Eval Definitions](docs/features/eval-definitions.md)
- [Run an Eval](docs/features/run-eval.md)
- [Eval Library](docs/features/eval-library.md)
- [Run Comparison](docs/features/run-comparison.md)
- [Scorers](docs/features/scorers.md)
- [Dashboard](docs/features/dashboard.md)
- [File Upload](docs/features/file-upload.md)
- [File Browser](docs/features/file-browser.md)

## References

- [docs/SECURITY.md](docs/SECURITY.md) — security principles and implementation
- [docs/RELIABILITY.md](docs/RELIABILITY.md) — reliability expectations
- [AGENTS.md](AGENTS.md) — architectural invariants and agent instructions
