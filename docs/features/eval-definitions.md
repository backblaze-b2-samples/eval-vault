<!-- last_verified: 2026-06-23 -->
# Feature: Eval Definitions (YAML)

## Purpose
Define an eval declaratively: a name, description, a set of model targets, and a set of test cases with scorers.

## Used By
- Files: `evals/*.yaml` (repo root), loaded by the API
- API: `GET /evals`
- UI: `/evals` page

## Core Functions
- `services/api/app/types/eval.py` — `EvalDefinition`, `EvalTarget`, `EvalCase`, `ScorerConfig`
- `services/api/app/service/eval_store.py` — `list_definitions()`, `get_definition()`
- `packages/shared/src/types.ts` — TypeScript mirrors

## Canonical Files
- Definition models: `services/api/app/types/eval.py`
- Example definitions: `evals/factual-qa.yaml`, `evals/summarization-quality.yaml`

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
- A YAML file in `evals/`

## Outputs
- `GET /evals` → `EvalDefinition[]`

## Flow
- On request, the API globs `evals/*.y*ml`, parses each, and validates it against `EvalDefinition`
- Malformed files are skipped with a warning, not a crash

## Edge Cases
- Invalid YAML / schema mismatch → file skipped, logged
- Missing targets or cases → Pydantic validation error at parse time (file skipped)

## Verification
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: definitions load and validate

## Related Docs
- [Run an Eval](run-eval.md)
- [Scorers](scorers.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
