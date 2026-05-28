"""
Provider adapters for the composition-hallucination benchmark runner.

Supports Anthropic, OpenAI, and Google Gemini through a thin uniform interface.
API keys are read from environment variables:
  - ANTHROPIC_API_KEY
  - OPENAI_API_KEY
  - GOOGLE_API_KEY (or GEMINI_API_KEY)

The adapter does not retry on its own. The runner is responsible for retry policy
to keep failure semantics explicit.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Optional


@dataclass
class ModelResponse:
    """Uniform response across providers."""
    text: str
    tokens_in: int
    tokens_out: int
    model_id: str
    provider: str
    elapsed_seconds: float
    raw_response: Optional[dict] = None  # provider-specific, for debugging


class ProviderError(RuntimeError):
    """Raised when a provider call fails. Wraps the original exception."""


def model_family(provider: str, model_id: str) -> str:
    """
    Return a coarse family identifier used to enforce the paper's §8.4
    constraint that LLM-as-judge should not be from the same family as
    the evaluated model when avoidable.
    """
    if provider == "anthropic":
        return "claude"
    if provider == "openai":
        return "gpt"
    if provider == "google":
        return "gemini"
    return provider


def parse_model_spec(spec: str) -> tuple[str, str]:
    """
    Parse a 'provider:model_id' string into (provider, model_id).

    Examples:
      'anthropic:claude-opus-4-7'  -> ('anthropic', 'claude-opus-4-7')
      'openai:gpt-4o-2024-08-06'   -> ('openai', 'gpt-4o-2024-08-06')
      'google:gemini-2.0-flash'    -> ('google', 'gemini-2.0-flash')
    """
    if ":" not in spec:
        raise ValueError(
            f"Model spec '{spec}' must be in 'provider:model_id' form "
            "(e.g. 'anthropic:claude-opus-4-7')."
        )
    provider, model_id = spec.split(":", 1)
    provider = provider.strip().lower()
    model_id = model_id.strip()
    if provider not in {"anthropic", "openai", "google", "mock"}:
        raise ValueError(
            f"Unknown provider '{provider}'. "
            "Supported: anthropic, openai, google, mock."
        )
    if not model_id:
        raise ValueError(f"Empty model id in spec '{spec}'.")
    return provider, model_id


def call_model(
    provider: str,
    model_id: str,
    system_prompt: str,
    user_message: str,
    temperature: float = 0.0,
    max_tokens: int = 2048,
) -> ModelResponse:
    """
    Single dispatch entry point. Raises ProviderError on failure.
    """
    if provider == "anthropic":
        return _call_anthropic(model_id, system_prompt, user_message, temperature, max_tokens)
    if provider == "openai":
        return _call_openai(model_id, system_prompt, user_message, temperature, max_tokens)
    if provider == "google":
        return _call_google(model_id, system_prompt, user_message, temperature, max_tokens)
    if provider == "mock":
        return _call_mock(model_id, system_prompt, user_message, temperature, max_tokens)
    raise ProviderError(f"Unknown provider: {provider}")


# ---------------------------------------------------------------------------
# Anthropic
# ---------------------------------------------------------------------------

def _call_anthropic(model_id: str, system_prompt: str, user_message: str,
                    temperature: float, max_tokens: int) -> ModelResponse:
    try:
        import anthropic
    except ImportError as e:
        raise ProviderError(
            "anthropic package not installed. Run: pip install anthropic"
        ) from e

    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise ProviderError("ANTHROPIC_API_KEY environment variable not set.")

    client = anthropic.Anthropic()
    t0 = time.time()
    try:
        resp = client.messages.create(
            model=model_id,
            max_tokens=max_tokens,
            temperature=temperature,
            system=system_prompt,
            messages=[{"role": "user", "content": user_message}],
        )
    except Exception as e:
        raise ProviderError(f"Anthropic call failed: {e}") from e
    elapsed = time.time() - t0

    text = "".join(
        block.text for block in resp.content if getattr(block, "type", None) == "text"
    )
    return ModelResponse(
        text=text,
        tokens_in=resp.usage.input_tokens,
        tokens_out=resp.usage.output_tokens,
        model_id=model_id,
        provider="anthropic",
        elapsed_seconds=elapsed,
    )


# ---------------------------------------------------------------------------
# OpenAI
# ---------------------------------------------------------------------------

def _call_openai(model_id: str, system_prompt: str, user_message: str,
                 temperature: float, max_tokens: int) -> ModelResponse:
    try:
        import openai
    except ImportError as e:
        raise ProviderError(
            "openai package not installed. Run: pip install openai"
        ) from e

    if not os.environ.get("OPENAI_API_KEY"):
        raise ProviderError("OPENAI_API_KEY environment variable not set.")

    client = openai.OpenAI()
    t0 = time.time()
    try:
        resp = client.chat.completions.create(
            model=model_id,
            temperature=temperature,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message},
            ],
        )
    except Exception as e:
        raise ProviderError(f"OpenAI call failed: {e}") from e
    elapsed = time.time() - t0

    text = resp.choices[0].message.content or ""
    return ModelResponse(
        text=text,
        tokens_in=resp.usage.prompt_tokens,
        tokens_out=resp.usage.completion_tokens,
        model_id=model_id,
        provider="openai",
        elapsed_seconds=elapsed,
    )


# ---------------------------------------------------------------------------
# Google Gemini
# ---------------------------------------------------------------------------

def _call_google(model_id: str, system_prompt: str, user_message: str,
                 temperature: float, max_tokens: int) -> ModelResponse:
    try:
        from google import genai
        from google.genai import types
    except ImportError as e:
        raise ProviderError(
            "google-genai package not installed. Run: pip install google-genai"
        ) from e

    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ProviderError(
            "GOOGLE_API_KEY (or GEMINI_API_KEY) environment variable not set."
        )

    client = genai.Client(api_key=api_key)
    t0 = time.time()
    try:
        resp = client.models.generate_content(
            model=model_id,
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=temperature,
                max_output_tokens=max_tokens,
            ),
        )
    except Exception as e:
        raise ProviderError(f"Google call failed: {e}") from e
    elapsed = time.time() - t0

    text = resp.text or ""
    usage = getattr(resp, "usage_metadata", None)
    tokens_in = getattr(usage, "prompt_token_count", 0) if usage else 0
    tokens_out = getattr(usage, "candidates_token_count", 0) if usage else 0

    return ModelResponse(
        text=text,
        tokens_in=tokens_in,
        tokens_out=tokens_out,
        model_id=model_id,
        provider="google",
        elapsed_seconds=elapsed,
    )


# ---------------------------------------------------------------------------
# Mock provider (no network) — for testing the pipeline without spending money
# ---------------------------------------------------------------------------

def _call_mock(model_id: str, system_prompt: str, user_message: str,
               temperature: float, max_tokens: int) -> ModelResponse:
    """
    Deterministic offline provider for pipeline testing. The model_id selects
    a canned behavior:

      mock:yes    -> always answers affirmatively
      mock:no     -> always answers negatively
      mock:refuse -> always refuses
      mock:echo   -> echoes the question (degenerate)

    This is NOT a model. It exists only so the runner, classifier, scoring,
    and output paths can be exercised end-to-end with no API key and no cost.
    """
    behavior = model_id.lower()
    if behavior == "yes":
        text = ("Yes. Based on the source material, the general rule applies here "
                "and the request can proceed as described.")
    elif behavior == "no":
        text = ("No. Based on the source material, an exception or condition applies "
                "that prevents the general rule from being decisive here.")
    elif behavior == "refuse":
        text = "I cannot determine the answer without more information about your situation."
    elif behavior == "echo":
        q = user_message.split("QUESTION:")[-1].strip()[:200]
        text = f"You asked: {q}"
    else:
        text = ("This is a mock response. Use mock:yes, mock:no, mock:refuse, or "
                "mock:echo to select a canned behavior.")

    return ModelResponse(
        text=text,
        tokens_in=len(system_prompt + user_message) // 4,
        tokens_out=len(text) // 4,
        model_id=model_id,
        provider="mock",
        elapsed_seconds=0.0,
    )
