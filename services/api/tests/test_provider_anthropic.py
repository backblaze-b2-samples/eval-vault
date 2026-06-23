"""No-network signature guard for the Anthropic provider adapter.

These tests never hit the network: the SDK client is monkeypatched with a
fake that records the request and returns a canned message. They lock the
call signature (thinking modes, system, max_tokens) and the trace shape so
a refactor that breaks the contract fails fast.
"""

from types import SimpleNamespace

import pytest

from app.repo import provider_anthropic
from app.service import scoring
from app.types import ScorerConfig


class _FakeMessages:
    def __init__(self, store):
        self._store = store

    def create(self, **kwargs):
        self._store["request"] = kwargs
        return SimpleNamespace(
            content=[SimpleNamespace(type="text", text="Paris")],
            stop_reason="end_turn",
            usage=SimpleNamespace(input_tokens=11, output_tokens=3),
        )


class _FakeClient:
    def __init__(self, store):
        self.messages = _FakeMessages(store)


@pytest.fixture
def fake_provider(monkeypatch):
    store: dict = {}
    monkeypatch.setattr(
        provider_anthropic.anthropic,
        "Anthropic",
        lambda api_key=None: _FakeClient(store),
    )
    provider = provider_anthropic.AnthropicProvider(api_key="sk-ant-test")
    return provider, store


def test_target_call_disables_thinking(fake_provider):
    provider, store = fake_provider
    result = provider.complete(
        model="claude-opus-4-8",
        prompt="What is the capital of France?",
        system="Be terse.",
        max_tokens=256,
        thinking="disabled",
    )
    req = store["request"]
    assert req["model"] == "claude-opus-4-8"
    assert req["max_tokens"] == 256
    assert req["system"] == "Be terse."
    assert req["thinking"] == {"type": "disabled"}
    assert result.text == "Paris"
    assert result.trace.usage.input_tokens == 11
    assert result.trace.usage.output_tokens == 3
    assert result.trace.stop_reason == "end_turn"


def test_adaptive_thinking_uses_adaptive_type(fake_provider):
    provider, store = fake_provider
    provider.complete(
        model="claude-sonnet-4-6",
        prompt="Score this.",
        max_tokens=256,
        thinking="adaptive",
    )
    req = store["request"]
    # Adaptive is the on-mode for current models — no budget_tokens.
    assert req["thinking"] == {"type": "adaptive"}
    assert "budget_tokens" not in req["thinking"]
    # Adaptive consumes output tokens, so max_tokens gets headroom.
    assert req["max_tokens"] >= 4096


def test_missing_key_raises(monkeypatch):
    monkeypatch.setattr(provider_anthropic.settings, "anthropic_api_key", "")
    with pytest.raises(RuntimeError):
        provider_anthropic.AnthropicProvider()


def test_deterministic_scorers():
    s = scoring.score_deterministic("Paris", ScorerConfig(type="contains", expected="Paris"))
    assert s.passed and s.score == 1.0
    s = scoring.score_deterministic("yes", ScorerConfig(type="exact_match", expected="yes"))
    assert s.passed
    s = scoring.score_deterministic('{"a": 1}', ScorerConfig(type="json_valid"))
    assert s.passed
    s = scoring.score_deterministic("not json", ScorerConfig(type="json_valid"))
    assert not s.passed
    s = scoring.score_deterministic("299792458", ScorerConfig(type="regex", expected=r"299792458"))
    assert s.passed


def test_llm_judge_parses_score():
    # Fake provider returns a numeric score; no network.
    class _JudgeProvider:
        def complete(self, **kwargs):
            return provider_anthropic.ProviderResult(
                text="0.8",
                trace=provider_anthropic.Trace(
                    model=kwargs["model"], request={}, response_text="0.8"
                ),
            )

    s = scoring.score_llm_judge(
        provider=_JudgeProvider(),
        judge_model="claude-sonnet-4-6",
        prompt="explain",
        output_text="a good answer",
        config=ScorerConfig(type="llm_judge", rubric="be good", pass_threshold=0.7),
    )
    assert s.score == 0.8
    assert s.passed
