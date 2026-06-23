"""Built-in scorers. Deterministic scorers run locally; `llm_judge` uses
Claude-as-judge (adaptive thinking) to score 0..1 against a rubric."""

import json
import re

from app.repo import Provider
from app.types import Score, ScorerConfig

_JUDGE_SYSTEM = (
    "You are a strict evaluation judge. Given a rubric and a candidate "
    "answer, respond with ONLY a single number from 0.0 to 1.0 (one decimal "
    "place is fine) representing how well the answer satisfies the rubric. "
    "Do not explain. Output just the number."
)

_SCORE_RE = re.compile(r"(\d+(?:\.\d+)?)")


def _normalize(text: str) -> str:
    return text.strip().lower()


def score_deterministic(output_text: str, config: ScorerConfig) -> Score:
    """Run a non-LLM scorer. Raises ValueError for unknown / misconfigured types."""
    scorer = config.type
    if scorer == "exact_match":
        passed = _normalize(output_text) == _normalize(config.expected or "")
        return Score(
            scorer=scorer,
            score=1.0 if passed else 0.0,
            passed=passed,
            detail=f"exact_match against expected={config.expected!r}",
        )
    if scorer == "contains":
        passed = _normalize(config.expected or "") in _normalize(output_text)
        return Score(
            scorer=scorer,
            score=1.0 if passed else 0.0,
            passed=passed,
            detail=f"contains expected={config.expected!r}",
        )
    if scorer == "regex":
        pattern = config.expected or ""
        passed = bool(re.search(pattern, output_text))
        return Score(
            scorer=scorer,
            score=1.0 if passed else 0.0,
            passed=passed,
            detail=f"regex /{pattern}/",
        )
    if scorer == "json_valid":
        try:
            json.loads(output_text)
            passed = True
            detail = "output parses as JSON"
        except (json.JSONDecodeError, ValueError):
            passed = False
            detail = "output is not valid JSON"
        return Score(scorer=scorer, score=1.0 if passed else 0.0, passed=passed, detail=detail)
    raise ValueError(f"Unknown deterministic scorer: {scorer}")


def score_llm_judge(
    *,
    provider: Provider,
    judge_model: str,
    prompt: str,
    output_text: str,
    config: ScorerConfig,
) -> Score:
    """Claude-as-judge: scores the candidate answer 0..1 against the rubric."""
    rubric = config.rubric or "The answer should be correct, relevant, and complete."
    judge_prompt = (
        f"RUBRIC:\n{rubric}\n\n"
        f"ORIGINAL PROMPT:\n{prompt}\n\n"
        f"CANDIDATE ANSWER:\n{output_text}\n\n"
        "Score from 0.0 to 1.0:"
    )
    result = provider.complete(
        model=judge_model,
        prompt=judge_prompt,
        system=_JUDGE_SYSTEM,
        max_tokens=512,
        thinking="adaptive",
    )
    match = _SCORE_RE.search(result.text)
    value = float(match.group(1)) if match else 0.0
    value = max(0.0, min(1.0, value))
    return Score(
        scorer="llm_judge",
        score=value,
        passed=value >= config.pass_threshold,
        detail=f"judge={judge_model} raw={result.text.strip()!r}",
    )


def score_case(
    *,
    output_text: str,
    config: ScorerConfig,
    prompt: str,
    provider: Provider,
    judge_model: str,
) -> Score:
    """Dispatch to the right scorer for a case's configured scorer type."""
    if config.type == "llm_judge":
        return score_llm_judge(
            provider=provider,
            judge_model=judge_model,
            prompt=prompt,
            output_text=output_text,
            config=config,
        )
    return score_deterministic(output_text, config)
