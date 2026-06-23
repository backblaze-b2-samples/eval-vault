<!-- last_verified: 2026-06-23 -->
# App Workflows

User journeys inside Eval Vault.

## Run an Eval

- User navigates to `/evals`
- Each shipped eval definition (loaded from the repo-root `evals/` YAMLs) is listed with its targets and cases
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
