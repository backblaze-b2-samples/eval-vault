"""Anthropic (Claude) provider adapter.

This is the ONLY module that imports the `anthropic` SDK — mirroring the
boto3-only-in-repo rule and enforced by `tests/test_structure.py`. Every
other layer talks to Claude through the small `Provider` protocol below,
so a different chat provider could be slotted in as an additional
model-under-test without touching the eval engine.
"""

import time
from typing import Protocol

import anthropic

from app.config import settings
from app.types import ThinkingMode, Trace, Usage


class ProviderResult:
    """A single completion: text plus the full archival trace."""

    def __init__(self, text: str, trace: Trace):
        self.text = text
        self.trace = trace


class Provider(Protocol):
    """Minimal chat-completion contract the eval engine depends on."""

    def complete(
        self,
        *,
        model: str,
        prompt: str,
        system: str | None = None,
        max_tokens: int = 1024,
        thinking: ThinkingMode = "disabled",
    ) -> ProviderResult: ...


class AnthropicProvider:
    """Calls the Claude Messages API and returns text + an archivable trace."""

    def __init__(self, api_key: str | None = None):
        key = api_key or settings.anthropic_api_key
        if not key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY is not set — add it to .env to run an eval."
            )
        self._client = anthropic.Anthropic(api_key=key)

    def complete(
        self,
        *,
        model: str,
        prompt: str,
        system: str | None = None,
        max_tokens: int = 1024,
        thinking: ThinkingMode = "disabled",
    ) -> ProviderResult:
        request: dict = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system:
            request["system"] = system
        if thinking == "adaptive":
            # Adaptive thinking is the on-mode for current Claude models (no
            # budget_tokens — there is no budget in adaptive mode). It consumes
            # output tokens, so give max_tokens headroom.
            request["thinking"] = {"type": "adaptive"}
            request["max_tokens"] = max(max_tokens, 4096)
        else:
            request["thinking"] = {"type": "disabled"}

        start = time.monotonic()
        message = self._client.messages.create(**request)
        latency_ms = int((time.monotonic() - start) * 1000)

        text = "".join(
            block.text for block in message.content if block.type == "text"
        )
        usage = Usage(
            input_tokens=message.usage.input_tokens,
            output_tokens=message.usage.output_tokens,
        )
        trace = Trace(
            model=model,
            request=request,
            response_text=text,
            stop_reason=message.stop_reason,
            usage=usage,
            latency_ms=latency_ms,
        )
        return ProviderResult(text=text, trace=trace)
