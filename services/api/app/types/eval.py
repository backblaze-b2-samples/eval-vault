from typing import Literal

from pydantic import BaseModel, Field

# Built-in scorer identifiers. `llm_judge` scores 0..1 against a rubric
# using Claude-as-judge; the others are deterministic.
ScorerType = Literal["exact_match", "contains", "regex", "json_valid", "llm_judge"]

# Anthropic extended-thinking modes we expose on a target/judge call.
ThinkingMode = Literal["disabled", "adaptive"]


class ScorerConfig(BaseModel):
    """How a single eval case is scored."""

    type: ScorerType = "contains"
    # Expected value for exact_match / contains / regex scorers.
    expected: str | None = None
    # Rubric prompt for the llm_judge scorer.
    rubric: str | None = None
    # Threshold at/above which a 0..1 score counts as "passed".
    pass_threshold: float = Field(default=0.5, ge=0.0, le=1.0)


class EvalTarget(BaseModel):
    """One model-under-test configuration (the "N models" axis)."""

    id: str
    model: str
    # Target calls default to disabled thinking for comparable, cheap answers.
    thinking: ThinkingMode = "disabled"
    max_tokens: int = Field(default=1024, ge=1, le=8192)
    system: str | None = None


class EvalCase(BaseModel):
    """A single test case: a prompt plus how to score the answer."""

    id: str
    prompt: str
    system: str | None = None
    scorer: ScorerConfig = Field(default_factory=ScorerConfig)


class EvalDefinition(BaseModel):
    """A full eval: a named set of cases run against a set of targets."""

    name: str
    description: str = ""
    targets: list[EvalTarget] = Field(min_length=1)
    cases: list[EvalCase] = Field(min_length=1)
    # Judge model for llm_judge scorers (cheaper than the targets by default).
    judge_model: str = "claude-sonnet-4-6"


class EvalDefinitionSummary(EvalDefinition):
    """An `EvalDefinition` plus a derived `editable` flag for the list view.

    `editable` is True for user-created definitions (persisted on B2, so they can
    be edited/deleted from the UI) and False for read-only shipped YAML examples.
    Transport-only — this is never persisted; B2 JSON holds a plain EvalDefinition.
    """

    editable: bool = False
