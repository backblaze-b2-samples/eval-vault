<!-- last_verified: 2026-06-24 -->
# App Workflows

User journeys inside Eval Vault.

## Create an Eval (from the UI)

- User navigates to `/evals` and clicks **Create eval** (header button, or the empty-state CTA)
- On `/evals/new`, the user fills a structured form: name (lowercase slug), description, judge model, one or more **targets** (id, model, thinking, max tokens, optional system) and one or more **cases** (id, prompt, optional system, and a scorer whose fields adapt to its type — `expected` for match scorers, `rubric` for `llm_judge`)
- On **Create eval**, the definition is `POST`ed to the API, validated, and persisted as JSON to B2 under `evals/definitions/<name>.json`
- On success: toast, and the user is routed back to `/evals` where the new eval now appears (and the dashboard's "evals defined" count ticks up), ready to run
- A duplicate name (shipped or already-created) surfaces a 409 inline on the name field
- See: [Eval Definitions](features/eval-definitions.md)

## Edit / Delete an Eval (from the UI)

- Only **user-created** evals (the ones authored from the UI, persisted on B2) can be edited or deleted. Shipped YAML examples are read-only, so each list card shows the **⋯** actions menu only for editable evals.
- **Edit:** ⋯ → **Edit** opens `/evals/<name>/edit` with the form pre-filled. The name is locked (it's the identifier and B2 key); everything else is editable. **Save changes** `PUT`s the definition back to `evals/definitions/<name>.json`, toasts, and returns to `/evals` with the card updated.
- **Delete:** ⋯ → **Delete** opens a confirm dialog; confirming `DELETE`s the B2 definition, toasts, and the card disappears (the dashboard's "evals defined" count drops). Archived runs are untouched.
- Editing/deleting a shipped or unknown eval — e.g. via a hand-typed URL — shows a clear "can't be edited" / "not found" message, and the API independently 404s.
- See: [Eval Definitions](features/eval-definitions.md)

## Run an Eval

- User navigates to `/evals`
- Each eval definition — shipped (repo-root `evals/` YAMLs) or user-created (B2) — is listed with its targets and cases
- User clicks **Run** on an eval
- The API calls each Claude target for every case, scores the answer, and archives the input/output/score/trace bundle to B2 under `evals/runs/<run_id>/`
- On success: toast with the run id, and the user is routed to the run's Library page
- On missing `ANTHROPIC_API_KEY`: the API returns 400 with a readable message
- See: [Run an Eval](features/run-eval.md)

## Inspect a Run (Library)

- User navigates to `/library`
- Archived runs are listed (newest first), scoped to the `evals/runs/` prefix
- User clicks a run id → run detail page
- A cases × targets grid shows the score for every cell
- User clicks a cell → a dialog opens with tabs for **input**, **output**, **score**, and **trace** — each read straight from the archived JSON on B2
- See: [Eval Library](features/eval-library.md)

## Compare Two Runs

- User navigates to `/compare`
- User picks a **base** run and a **head** run from the dropdowns
- A diff table shows per-cell base score, head score, and Δ; regressions (head < base) are highlighted
- A header summary shows the avg-score delta and the regression count
- See: [Run Comparison](features/run-comparison.md)

## View the Eval Scoreboard

- User navigates to `/` (home)
- Stat cards show: evals defined, runs archived, artifacts stored, average score
- A score-trend chart plots avg score across the most recent runs
- A recent-runs table links into each run's Library page
- Empty state when no runs exist yet
- See: [Dashboard](features/dashboard.md)

## Upload eval YAMLs / artifacts

- User navigates to `/upload`
- Drops or selects YAML / JSON / text files in the dropzone
- Client validates file size (max 100MB)
- Progress bar shows per-file upload status; success/failure toast
- See: [File Upload](features/file-upload.md)

## Browse the full bucket

- User navigates to `/files`
- The full bucket explorer lists every object as a tree, including the archived runs under `evals/runs/`
- Hover a file row → preview / download / delete actions
- See: [File Browser](features/file-browser.md)
