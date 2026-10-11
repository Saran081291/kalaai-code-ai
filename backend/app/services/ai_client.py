"""Thin wrapper around the AI SDKs - the ONLY module that imports ``anthropic`` / ``openai``.

``settings.AI_PROVIDER`` selects the backend: ``anthropic`` (default) or ``openai``.

Callers use :func:`generate_structured` to get a JSON object that matches a JSON schema.
Tests monkeypatch ``app.services.ai_client.generate_structured`` so the real API is never hit.

Implementation notes:
- Claude Opus 5.5 (the default ``CLAUDE_MODEL``) rejects forced ``tool_choice`` with a 400,
  so structured output is obtained with ``output_config.format`` (JSON-schema structured
  outputs) instead of a forced tool call. The ``tool_name``/``tool_description`` arguments
  keep the "named structured call" interface and are surfaced to the model in the system
  prompt.
- Requests are streamed (``get_final_message``) so long reviews never hit HTTP timeouts;
  the 120 s timeout applies per network read. The SDK retries 429/5xx/connection errors
  twice by itself.
- On models that support it, server-side refusal fallback (``fallbacks="default"``) is
  enabled so a safety-classifier decline is re-run on a fallback model in the same call.
"""

from __future__ import annotations

import json
import logging
import threading
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Literal

from app.config import settings

if TYPE_CHECKING:
    import anthropic
    import openai

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT_SECONDS = 120.0
SDK_MAX_RETRIES = 2
FALLBACK_BETA = "server-side-fallback-2026-07-01"
# Models that accept the server-side ``fallbacks="default"`` refusal fallback.
FALLBACK_CAPABLE_MODELS = frozenset(
    {"claude-opus-5-5", "claude-opus-5", "claude-fable-5-1", "claude-sonnet-5-5"}
)

Effort = Literal["low", "medium", "high", "xhigh", "max"]


class AIError(Exception):
    """Base class for AI client failures."""

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class AIConfigError(AIError):
    """The AI client is not configured (e.g. the provider's API key is empty)."""


class AIServiceError(AIError):
    """The AI API call failed (network, HTTP error, refusal)."""


class AIOutputError(AIServiceError):
    """The model answered but the output was not usable JSON (truncated, malformed)."""


@dataclass(frozen=True)
class AIResult:
    """Structured model output plus usage accounting."""

    data: dict[str, object]
    model: str
    input_tokens: int
    output_tokens: int


_client: anthropic.Anthropic | None = None
_client_lock = threading.Lock()


def get_client() -> anthropic.Anthropic:
    """Return the lazily constructed, process-wide Anthropic client.

    Raises:
        AIConfigError: If ``ANTHROPIC_API_KEY`` is not set.
    """
    global _client
    if _client is not None:
        return _client
    if not settings.ANTHROPIC_API_KEY:
        raise AIConfigError("ANTHROPIC_API_KEY is not configured")
    import anthropic

    with _client_lock:
        if _client is None:
            _client = anthropic.Anthropic(
                api_key=settings.ANTHROPIC_API_KEY,
                timeout=REQUEST_TIMEOUT_SECONDS,
                max_retries=SDK_MAX_RETRIES,
            )
    return _client


def _with_additional_properties_false(schema: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of ``schema`` with ``additionalProperties: false`` on every object."""
    result: dict[str, Any] = {}
    for key, value in schema.items():
        if isinstance(value, dict):
            if key == "properties":
                result[key] = {
                    prop: _with_additional_properties_false(sub) if isinstance(sub, dict) else sub
                    for prop, sub in value.items()
                }
            else:
                result[key] = _with_additional_properties_false(value)
        elif isinstance(value, list):
            result[key] = [
                _with_additional_properties_false(item) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            result[key] = value
    if result.get("type") == "object":
        result.setdefault("additionalProperties", False)
    return result


def generate_structured(
    *,
    system: str,
    user_content: str,
    tool_name: str,
    tool_description: str,
    input_schema: dict[str, object],
    max_tokens: int | None = None,
    effort: Effort | None = None,
) -> AIResult:
    """Ask the configured provider for a JSON object matching ``input_schema``.

    Dispatches on ``settings.AI_PROVIDER``; see :func:`_generate_anthropic` for the
    argument and error contract, which both providers share.
    """
    generate = _generate_openai if settings.AI_PROVIDER == "openai" else _generate_anthropic
    return generate(
        system=system,
        user_content=user_content,
        tool_name=tool_name,
        tool_description=tool_description,
        input_schema=input_schema,
        max_tokens=max_tokens,
        effort=effort,
    )


def _generate_anthropic(
    *,
    system: str,
    user_content: str,
    tool_name: str,
    tool_description: str,
    input_schema: dict[str, object],
    max_tokens: int | None = None,
    effort: Effort | None = None,
) -> AIResult:
    """Ask Claude for a JSON object matching ``input_schema``.

    Args:
        system: System prompt.
        user_content: The user turn (may contain delimited untrusted data).
        tool_name: Name of the structured result (e.g. ``submit_review``).
        tool_description: What the structured result represents.
        input_schema: JSON schema of the expected object.
        max_tokens: Output token cap; defaults to ``settings.CLAUDE_MAX_TOKENS``.
        effort: Optional ``output_config.effort`` level.

    Returns:
        The parsed JSON object with model id and token usage.

    Raises:
        AIConfigError: Missing API key.
        AIServiceError: API/network failure or a refusal.
        AIOutputError: Output truncated or not a JSON object.
    """
    import anthropic

    client = get_client()
    model = settings.CLAUDE_MODEL
    full_system = (
        f"{system.rstrip()}\n\n"
        f"Return your answer as the `{tool_name}` JSON object only: {tool_description}"
    )
    output_config: dict[str, Any] = {
        "format": {
            "type": "json_schema",
            "schema": _with_additional_properties_false(dict(input_schema)),
        }
    }
    if effort is not None:
        output_config["effort"] = effort
    extra: dict[str, Any] = {}
    if model in FALLBACK_CAPABLE_MODELS:
        extra["betas"] = [FALLBACK_BETA]
        extra["fallbacks"] = "default"

    try:
        with client.beta.messages.stream(
            model=model,
            max_tokens=max_tokens or settings.CLAUDE_MAX_TOKENS,
            system=full_system,
            messages=[{"role": "user", "content": user_content}],
            output_config=output_config,  # type: ignore[arg-type]
            **extra,
        ) as stream:
            message = stream.get_final_message()
    except anthropic.AuthenticationError as exc:
        logger.error("Anthropic authentication failed: %s", exc)
        raise AIServiceError("AI service authentication failed") from exc
    except anthropic.RateLimitError as exc:
        logger.warning("Anthropic rate limit hit after retries: %s", exc)
        raise AIServiceError("AI service is rate limited") from exc
    except anthropic.BadRequestError as exc:
        logger.error("Anthropic rejected the request: %s", exc)
        raise AIServiceError("AI service rejected the request") from exc
    except anthropic.APIStatusError as exc:
        logger.error("Anthropic API error %s: %s", exc.status_code, exc)
        raise AIServiceError(f"AI service error ({exc.status_code})") from exc
    except anthropic.APIConnectionError as exc:
        logger.error("Anthropic connection error: %s", exc)
        raise AIServiceError("Could not reach the AI service") from exc

    stop_reason = message.stop_reason
    if stop_reason == "refusal":
        raise AIServiceError("The AI declined to answer this request")
    if stop_reason == "max_tokens":
        raise AIOutputError("AI output was truncated (max_tokens reached)")

    text = "".join(block.text for block in message.content if block.type == "text")
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise AIOutputError("AI output was not valid JSON") from exc
    if not isinstance(data, dict):
        raise AIOutputError("AI output was not a JSON object")

    usage = message.usage
    logger.info(
        "AI call %s ok model=%s in=%s out=%s",
        tool_name,
        message.model,
        usage.input_tokens,
        usage.output_tokens,
    )
    return AIResult(
        data=data,
        model=str(message.model),
        input_tokens=int(usage.input_tokens or 0),
        output_tokens=int(usage.output_tokens or 0),
    )


_openai_client: openai.OpenAI | None = None


def get_openai_client() -> openai.OpenAI:
    """Return the lazily constructed, process-wide OpenAI client.

    Raises:
        AIConfigError: If ``OPENAI_API_KEY`` is not set.
    """
    global _openai_client
    if _openai_client is not None:
        return _openai_client
    if not settings.OPENAI_API_KEY:
        raise AIConfigError("OPENAI_API_KEY is not configured")
    import openai

    with _client_lock:
        if _openai_client is None:
            _openai_client = openai.OpenAI(
                api_key=settings.OPENAI_API_KEY,
                timeout=REQUEST_TIMEOUT_SECONDS,
                max_retries=SDK_MAX_RETRIES,
            )
    return _openai_client


def _generate_openai(
    *,
    system: str,
    user_content: str,
    tool_name: str,
    tool_description: str,
    input_schema: dict[str, object],
    max_tokens: int | None = None,
    effort: Effort | None = None,  # noqa: ARG001 - Anthropic-only knob, accepted for parity
) -> AIResult:
    """OpenAI implementation of :func:`generate_structured` (JSON-schema response format).

    Raises:
        AIConfigError: Missing API key.
        AIServiceError: API/network failure or a refusal.
        AIOutputError: Output truncated or not a JSON object.
    """
    import openai

    client = get_openai_client()
    model = settings.OPENAI_MODEL
    full_system = (
        f"{system.rstrip()}\n\n"
        f"Return your answer as the `{tool_name}` JSON object only: {tool_description}"
    )
    try:
        completion = client.chat.completions.create(
            model=model,
            max_completion_tokens=max_tokens or settings.CLAUDE_MAX_TOKENS,
            messages=[
                {"role": "system", "content": full_system},
                {"role": "user", "content": user_content},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": tool_name,
                    "schema": _with_additional_properties_false(dict(input_schema)),
                    "strict": False,
                },
            },
        )
    except openai.AuthenticationError as exc:
        logger.error("OpenAI authentication failed: %s", exc)
        raise AIServiceError("AI service authentication failed") from exc
    except openai.RateLimitError as exc:
        logger.warning("OpenAI rate limit hit after retries: %s", exc)
        raise AIServiceError("AI service is rate limited") from exc
    except openai.BadRequestError as exc:
        logger.error("OpenAI rejected the request: %s", exc)
        raise AIServiceError("AI service rejected the request") from exc
    except openai.APIStatusError as exc:
        logger.error("OpenAI API error %s: %s", exc.status_code, exc)
        raise AIServiceError(f"AI service error ({exc.status_code})") from exc
    except openai.APIConnectionError as exc:
        logger.error("OpenAI connection error: %s", exc)
        raise AIServiceError("Could not reach the AI service") from exc

    choice = completion.choices[0]
    if choice.finish_reason == "content_filter" or choice.message.refusal:
        raise AIServiceError("The AI declined to answer this request")
    if choice.finish_reason == "length":
        raise AIOutputError("AI output was truncated (max tokens reached)")
    try:
        data = json.loads(choice.message.content or "")
    except json.JSONDecodeError as exc:
        raise AIOutputError("AI output was not valid JSON") from exc
    if not isinstance(data, dict):
        raise AIOutputError("AI output was not a JSON object")

    usage = completion.usage
    input_tokens = int(usage.prompt_tokens) if usage else 0
    output_tokens = int(usage.completion_tokens) if usage else 0
    logger.info(
        "AI call %s ok model=%s in=%s out=%s",
        tool_name,
        completion.model,
        input_tokens,
        output_tokens,
    )
    return AIResult(
        data=data,
        model=str(completion.model),
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )


__all__ = [
    "AIConfigError",
    "AIError",
    "AIOutputError",
    "AIResult",
    "AIServiceError",
    "Effort",
    "generate_structured",
    "get_client",
    "get_openai_client",
]
