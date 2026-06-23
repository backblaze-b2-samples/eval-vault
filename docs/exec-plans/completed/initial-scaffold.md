# eval-vault — initial scaffold plan

Source of truth (cloned fresh in Phase 0):
`.claude/scratch/vcsk-740ee004-bcc7-4bc3-81d5-6e4d3e44118d/`
Build target: `./eval-vault` (under `sampleapps/.local/`).

---

## 1. Purpose

**eval-vault** turns an LLM eval into a permanent, auditable artifact trail on
Backblaze B2. You define an eval (a YAML file of test cases — prompt + expected
behavior + scorer), run it against **N Claude models/configurations**, and every
single **input, output, score, and trace** is archived to B2 as a per-run JSON
bundle, forever. Later you re-run the same eval against a new model or a tweaked
prompt and diff the two runs to hunt regressions.

It is for AI engineers and teams who treat eval results the way ops teams treat
logs: **keep everything, query rarely, audit constantly.** That access pattern —
huge volume of small immutable JSON objects, written once, read on demand months
later — is the textbook B2 workload, which is exactly why this is a strong B2
demo (and a natural cross-promo with experiment-tracking work: W&B #61, the
existing MLflow sample).

---

## 2. Architecture delta from vibe-coding-starter-kit

The starter kit is the ceiling. Keep the full-stack scaffold, UI kit, layered
FastAPI backend, B2 S3 repo, TanStack data layer, structural tests, and docs
system. Strip the upload-metadata-extraction demo. Add the eval engine + four
new screens.

### KEEP as-is
- **UI kit / design system** — `apps/web/src/components/ui/*`, `globals.css`
  tokens, `/design` page. Build new screens only from these primitives.
- **Full bucket explorer** — `/files` route, `app/files/`, `components/files/*`,
  the Files sidebar entry. **NON-NEGOTIABLE KEEP** (full-bucket browse).
- **Upload** — `/upload`, `app/upload/`, `components/upload/*`, sidebar entry.
  Repurposed copy: upload eval-definition YAMLs / artifacts; mechanics unchanged.
- **Settings**, **/design**, sidebar shell, theme provider, command palette,
  health banner, error/empty/loading states.
- **Backend skeleton + layering** — `types → config → repo → service → runtime`,
  `main.py` middleware + JSON logging + `/health` + `/metrics`, the S3 repo
  (`repo/b2_client.py`) and its `get_s3_client()` (S3 API + custom UA).
- **Structural tests** (`tests/test_structure.py`), TanStack Query data layer
  (`lib/queries.ts`, `lib/api-client.ts`), `packages/shared` type mirror.
- **`docs/` system of record**, AGENTS.md contract, doctor/dev scripts.

### TRIM (remove from starter)
- **Metadata-extraction feature** — `service/metadata.py`, `types/`’s
  `FileMetadataDetail`, image/PDF extraction, `docs/features/metadata-extraction.md`,
  and the deps it pulls in: **`Pillow`, `PyPDF2`, `python-magic`** (drop from
  `requirements.txt`). eval-vault stores JSON bundles, not media; no extraction.
  - Keep the upload *path* itself (raw bytes → B2); just remove the
    metadata-extraction step from `service/upload.py` and the metadata fields
    from the upload response.
- **Dashboard demo content** — `components/dashboard/{stats-cards,upload-chart,
  recent-uploads-table}.tsx` are rewritten (see ADD), not kept verbatim.
- The download-counter feature can stay (harmless) but is not surfaced in
  eval-vault’s UI; leave `service/files.py` counter intact to avoid churn.

### ADD (new for eval-vault)
Backend (all respecting the layering + SDK-containment rules):
- `types/eval.py` — `EvalDefinition`, `EvalCase`, `EvalTarget`, `ScorerConfig`.
- `types/run.py` — `RunManifest`, `CaseResult`, `Score`, `Trace`, `RunSummary`.
- `repo/provider_anthropic.py` — **Anthropic SDK adapter** (the only place
  `anthropic` is imported). One model call → text + usage + latency + stop_reason
  + raw trace. See §3/§4.
- `repo/b2_client.py` — extend with `put_json(key, obj)`, `list_prefix(prefix)`,
  `get_json(key)` for artifact bundles (reuses the same UA-compliant client).
- `service/scoring.py` — scorer registry: `exact_match`, `contains`, `regex`,
  `json_valid`, `llm_judge` (Claude-as-judge, 0..1 against a rubric).
- `service/eval_runner.py` — load eval def → for each case × target: call
  provider, score, assemble bundle, archive to B2 under `evals/runs/<run_id>/`.
- `service/eval_store.py` — list runs, read a run manifest + case artifacts
  (powers the Library + dashboard), scoped to the `evals/runs/` prefix.
- `service/comparison.py` — diff two runs of the same eval → per-case/target
  score deltas + regression flags.
- `runtime/evals.py` — router (see §3 for endpoints).
- `evals/` (repo-root, shipped) — 2 example eval YAMLs (see §4).

Frontend (only shadcn primitives + TanStack hooks; no bare `useEffect+fetch`):
- **Dashboard (`/`) rewritten** — Eval Scoreboard: stat cards (evals defined,
  runs archived, artifacts stored, avg score), a score-trend / runs-over-time
  chart (reuse Recharts `UploadChart` shell), and a Recent Runs table.
- **`/evals` (NEW)** — list eval definitions; pick eval + target set → Run.
- **`/library` (NEW)** — *sample-specific scoped asset explorer* (the required
  add): browse archived runs **scoped to `evals/runs/`**, drill into a run →
  cases × targets score grid → click a cell → input/output/score/trace viewer.
  This is the eval-vault analogue of a TTS sample’s “Library” view, sitting
  alongside (not replacing) the full bucket explorer at `/files`.
- **`/compare` (NEW)** — pick two runs → regression diff table.
- Sidebar: add **Evals**, **Library**, **Compare**; keep Dashboard, Upload,
  Files, Settings, + Design System utility link.
- `lib/api-client.ts` + `lib/queries.ts`: eval endpoints + query/mutation hooks.
- `packages/shared/src/types.ts`: mirror the new Pydantic models.

---

## 3. B2 surface (S3-only; no b2-native)

All B2 access goes through the **single existing boto3 S3 client** in
`repo/b2_client.py` (S3 API, `signature_version=s3v4`, custom `user_agent_extra`
— Standard #2). No b2-native API anywhere.

| Op | S3 call | Used by |
|----|---------|---------|
| Archive a run bundle | `put_object` (JSON bodies) | `eval_runner` |
| List runs / artifacts | `list_objects_v2` (prefix `evals/runs/`) | Library, dashboard, compare |
| Read an artifact | `get_object` / `generate_presigned_url` | Library viewer, compare |
| Health | `head_bucket` | `/health` |
| Existing explorer/upload | `list_objects_v2` / `put_object` / presign | `/files`, `/upload` |

**Artifact layout** (B2 keys under `evals/runs/<run_id>/`):
```
manifest.json                                  # eval name, targets, timestamps, aggregate scores
cases/<case_id>/<target_id>/input.json         # prompt, system, model, params
cases/<case_id>/<target_id>/output.json        # text, usage, latency_ms, stop_reason
cases/<case_id>/<target_id>/score.json         # scorer type, score 0..1, passed, detail
cases/<case_id>/<target_id>/trace.json         # full request + response trace + timing
```
`run_id = <eval_name>-<UTC-timestamp>-<6-char-hash>`.

No b2-native deviation. (The starter’s versioned-bucket behavior is fine; we
write new keys per run, immutable by construction.)

---

## 4. Key features + provider selection

Feature list (seeds README + `docs/features/<f>.md` stubs):
1. **Eval definitions (YAML)** — `eval-definitions.md`. A YAML file: `name`,
   `description`, `targets[]` (id + model + optional thinking mode), `cases[]`
   (id, prompt, optional system, `scorer`), optional `judge_model`.
2. **Run an eval** — `run-eval.md`. Execute every case × target against Claude,
   score each, archive the bundle to B2. Real calls, real artifacts.
3. **Eval Library (scoped explorer)** — `eval-library.md`. Browse/inspect
   archived runs scoped to `evals/runs/`; the input/output/score/trace viewer.
4. **Run comparison / regression hunting** — `run-comparison.md`. Diff two runs.
5. **Built-in scorers** — `scorers.md`. `exact_match`, `contains`, `regex`,
   `json_valid`, `llm_judge`. (User-provided scorers = future; v1 ships the
   registry + YAML refs.)
6. **Eval Scoreboard dashboard** — rewritten `dashboard.md`.

### External API provider (per `api-provider-selection.md`)
- **Classification: CORE.** The model under test *is* the thing the app exists to
  show. Real calls required.
- **Provider / models:** **Anthropic (Claude)** — default target set
  `claude-opus-4-8`, `claude-sonnet-4-6`, `claude-haiku-4-5` (the “N models”
  axis; the latest + most capable per global standards). Default **judge model:
  `claude-sonnet-4-6`** (cheaper than Opus for scoring; configurable).
- **Thinking:** target calls default to `thinking={"type":"disabled"}` (measure
  direct answers, comparable + cheap; accepted on Opus 4.8/Sonnet 4.6/Haiku 4.5).
  `llm_judge` calls use `thinking={"type":"adaptive"}`. Per-target override allowed.
- **Env var:** `ANTHROPIC_API_KEY` (provider-conventional; placeholder in
  `.env.example`; never committed). Validated at eval-run time (not at startup —
  the bucket explorer/health work without it).
- **Cost for one full demo run:** the 2 shipped evals total ≈ 12 target calls +
  ≈ 6 judge calls, each a few hundred tokens → **≈ $0.10–0.30** end-to-end
  (blended Claude rates: Opus $5/$25, Sonnet $3/$15, Haiku $1/$5 per MTok).
  **Well under $1 → no approval flag needed.**

### Provider orchestration via Genblaze — deliberate, documented deviation
The concept’s “Suggested stack” names Genblaze / `genblaze-*`. The skill’s
default is to route AI-provider calls through the Genblaze SDK. **We deviate, for
two hard reasons:**
1. **Genblaze has no Anthropic provider.** `genblaze-core` + the provider
   packages (`genblaze-openai/google/nvidia/gmicloud/runway/luma`) target
   generative *media* (video/image/audio) and expose LLM chat only through those
   media providers — **there is no `genblaze-anthropic`**. eval-vault’s subject
   must be the latest Claude models (global standard: default to Claude). The AI
   calls therefore *cannot* route through Genblaze without abandoning Claude.
2. **Single B2 client keeps b2-doctor green.** Adding `genblaze-s3` as a second
   archival sink would introduce a second S3 client whose custom-UA support is
   unverified, risking a Standard #2 (custom user agent) defect. The starter’s
   boto3 repo already satisfies all three B2 standards as one UA-compliant client.

**What we keep from the Genblaze ethos:** the provider is abstracted behind a
small `Provider` protocol in `repo/` (so a Genblaze chat provider could be slotted
in as an additional model-under-test later), and the run/artifact/manifest
archival model mirrors Genblaze’s run-scoped object layout. The `anthropic` import
is contained to `repo/provider_anthropic.py`, enforced by a new structural test
(see §7).

---

## 5. Doc transforms

- **README.md** — rewrite: eval-vault story, the “keep everything / audit
  constantly” B2 framing, quickstart with `ANTHROPIC_API_KEY` + Standard `B2_*`
  vars, the new feature list, new commands. Strip all
  “Vibe Coding Starter Kit” branding and the metadata-extraction bullets.
- **ARCHITECTURE.md** — update components (add provider adapter), external
  services (Anthropic Claude), data stores (B2 artifact bundles + layout),
  data flows (run → score → archive; compare).
- **AGENTS.md** — keep the contract; note `repo/` now also holds the Anthropic
  adapter and that `anthropic` is repo-only (mirrors the boto3 rule).
- `docs/features/file-upload.md` — **keep**, reframed (upload eval YAMLs/artifacts).
- `docs/features/file-browser.md` — **keep** (full bucket explorer).
- `docs/features/dashboard.md` — **rewrite** → Eval Scoreboard.
- `docs/features/metadata-extraction.md` — **delete**.
- **New stubs:** `eval-definitions.md`, `run-eval.md`, `eval-library.md`,
  `run-comparison.md`, `scorers.md`.
- `docs/app-workflows.md` / `dev-workflows.md` — update journeys + commands.
- Move this plan to `docs/exec-plans/completed/initial-scaffold.md` at finalize.

---

## 6. Rename table (`vibe-coding-starter-kit` → `eval-vault`)

| Identifier / location | From | To |
|---|---|---|
| Repo / root pkg name | `vibe-coding-starter-kit` | `eval-vault` |
| Web workspace pkg | `@vibe-coding-starter-kit/web` | `@eval-vault/web` |
| Shared workspace pkg | `@vibe-coding-starter-kit/shared` | `@eval-vault/shared` |
| All `pnpm --filter @vibe-coding-starter-kit/web …` | old slug | `@eval-vault/web` (root `package.json`, README, e2e cmd) |
| `lib/app-config.ts` `APP_NAME` | `OSS Starter Kit` | `Eval Vault` |
| `lib/app-config.ts` `APP_DESCRIPTION` | file-mgmt blurb | `Run LLM evals against N models and archive every input, output, score, and trace on Backblaze B2.` |
| FastAPI `title` (`main.py`) | `OSS Starter Kit API` | `Eval Vault API` |
| `user_agent_extra` (`b2_client.py`) | `b2ai-oss-start` | `b2ai-eval-vault` (use the board sub-issue’s `user_agent_extra` if present; else this) |
| UTM `utm_content=` in links (README, sidebar) | `b2ai-oss-start` | `b2ai-eval-vault` |
| Header branding (`components/layout/header.tsx`) | hardcoded `oss-starter-kit` + `Page` fallback | derive title from `APP_NAME` + pathname (root-fix the known leak) |
| `infra/railway/README.md` | starter name / image tags | `eval-vault` |
| Imports of `@vibe-coding-starter-kit/shared` (api-client, queries) | old slug | `@eval-vault/shared` |

---

## 7. Standards + known-trap checklist (must satisfy before commit)

- **B2 env vars → Standard #3** (rename from starter): `B2_KEY_ID →
  B2_APPLICATION_KEY_ID`; keep `B2_APPLICATION_KEY`, `B2_BUCKET_NAME`; replace
  `B2_ENDPOINT` with **`B2_REGION`** (derive endpoint
  `https://s3.{B2_REGION}.backblazeb2.com` in `get_s3_client()`); add
  **`B2_PUBLIC_URL_BASE`** (was `b2_public_url`). Add **`ANTHROPIC_API_KEY`**.
  Update `.env.example`, `settings.py`, and `main.py`’s `REQUIRED_B2_SETTINGS` +
  `PLACEHOLDER_VALUES`.
- **S3 API only**, **custom UA on the (single) S3 client**, **Standard `B2_*`
  names** — the three b2-doctor standards. No b2-native.
- **SDK containment:** `boto3` only in `repo/`; **`anthropic` only in `repo/`** —
  add a structural test `test_anthropic_only_in_repo` mirroring
  `test_boto3_only_in_repo`.
- **No-network signature guard:** add a unit test that imports
  `repo/provider_anthropic.py` and asserts the call signature / scorer registry
  without hitting the network (monkeypatch the Anthropic client).
- **Header branding leak:** fix `header.tsx` (single `APP_NAME` const +
  pathname-derived title) so no `oss-starter-kit` / `Page` text leaks.
- **Finish the LAST phases:** doc theming + full frontend wiring (routes reachable
  from the sidebar, no 404s, no unused-import lint errors). `pnpm lint`,
  `pnpm build`, `pnpm lint:api`, `pnpm test:api`, `pnpm check:structure` must pass.
- Files stay < 300 lines; all boundary data is Pydantic; no `print()`; docs
  updated in the same change.
