<!-- last_verified: 2026-06-23 -->
# Feature: Built-in Scorers

## Purpose
Score a model's answer for a case. v1 ships a registry of five scorers referenced by name in the eval YAML; user-provided scorers are future work.

## Used By
- API: invoked by the eval runner during `POST /evals/{name}/run`
- Config: `scorer.type` in eval YAML cases

## Core Functions
- `services/api/app/service/scoring.py` — `score_case()`, `score_deterministic()`, `score_llm_judge()`
- `services/api/app/types/eval.py` — `ScorerConfig`, `ScorerType`

## Canonical Files
- Scorer registry: `services/api/app/service/scoring.py`

## The scorers
| Type | Behavior | Config used |
|------|----------|-------------|
| `exact_match` | normalized exact string match | `expected` |
| `contains` | normalized substring match | `expected` |
| `regex` | `re.search(pattern, output)` | `expected` (the pattern) |
| `json_valid` | output parses as JSON | — |
| `llm_judge` | Claude-as-judge scores 0..1 against a rubric, adaptive thinking | `rubric`, `pass_threshold` |

Deterministic scorers return 0.0 or 1.0. `llm_judge` returns a continuous 0..1 score; `passed` is `score >= pass_threshold`.

## Inputs
- `output_text`: the model's answer
- `config`: the case's `ScorerConfig`
- For `llm_judge`: the provider + judge model

## Outputs
- `Score`: `{ scorer, score (0..1), passed, detail }`

## Flow
- `score_case()` dispatches: `llm_judge` → `score_llm_judge()` (one judge call); everything else → `score_deterministic()` (local, no network)
- The judge prompt embeds the rubric, original prompt, and candidate answer, and asks for a single number; the response is parsed to a float and clamped to 0..1

## Edge Cases
- Unknown scorer type → `ValueError`
- Judge returns no parseable number → score 0.0
- `expected`/`rubric` omitted → sensible defaults (empty expected, generic rubric)

## Verification
- Test files: `services/api/tests/test_provider_anthropic.py` (deterministic scorers + judge parsing, no network)
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all scorer tests green

## Related Docs
- [Eval Definitions](eval-definitions.md)
- [Run an Eval](run-eval.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
