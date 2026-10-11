"""Unit tests for ``app.services.ai_client`` with a fake Anthropic client (no network)."""

import json
from contextlib import contextmanager
from types import SimpleNamespace
from typing import Any

import anthropic
import httpx
import pytest

from app.config import settings
from app.services import ai_client

SCHEMA: dict[str, object] = {
    "type": "object",
    "properties": {"a": {"type": "object", "properties": {"b": {"type": "integer"}}}},
}


def _message(text: str, stop_reason: str = "end_turn") -> SimpleNamespace:
    return SimpleNamespace(
        stop_reason=stop_reason,
        content=[SimpleNamespace(type="text", text=text)],
        model="claude-test",
        usage=SimpleNamespace(input_tokens=11, output_tokens=7),
    )


class FakeClient:
    def __init__(self, message: SimpleNamespace | None = None, error: Exception | None = None):
        self.message = message
        self.error = error
        self.kwargs: dict[str, Any] = {}
        self.beta = SimpleNamespace(messages=SimpleNamespace(stream=self._stream))

    @contextmanager
    def _stream(self, **kwargs: Any) -> Any:
        self.kwargs = kwargs
        if self.error is not None:
            raise self.error
        yield SimpleNamespace(get_final_message=lambda: self.message)


def _call(client: FakeClient, monkeypatch: pytest.MonkeyPatch, **extra: Any) -> ai_client.AIResult:
    monkeypatch.setattr(ai_client, "get_client", lambda: client)
    return ai_client.generate_structured(
        system="sys",
        user_content="user",
        tool_name="submit_review",
        tool_description="desc",
        input_schema=SCHEMA,
        **extra,
    )


def _status_error(cls: type[anthropic.APIStatusError], code: int) -> anthropic.APIStatusError:
    request = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    return cls("boom", response=httpx.Response(code, request=request), body=None)


def test_success_parses_json_and_usage(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "CLAUDE_MODEL", "claude-opus-5-5")
    client = FakeClient(_message(json.dumps({"ok": 1})))
    result = _call(client, monkeypatch, effort="high", max_tokens=123)
    assert result.data == {"ok": 1}
    assert (result.model, result.input_tokens, result.output_tokens) == ("claude-test", 11, 7)
    assert client.kwargs["max_tokens"] == 123
    assert client.kwargs["output_config"]["effort"] == "high"
    assert client.kwargs["fallbacks"] == "default"
    # additionalProperties=false is applied recursively to object schemas.
    schema = client.kwargs["output_config"]["format"]["schema"]
    assert schema["additionalProperties"] is False
    assert schema["properties"]["a"]["additionalProperties"] is False


def test_unknown_model_gets_no_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "CLAUDE_MODEL", "some-other-model")
    client = FakeClient(_message("{}"))
    _call(client, monkeypatch)
    assert "fallbacks" not in client.kwargs
    assert client.kwargs["max_tokens"] == settings.CLAUDE_MAX_TOKENS


@pytest.mark.parametrize(
    ("message", "error_type"),
    [
        (_message("{}", "refusal"), ai_client.AIServiceError),
        (_message("{}", "max_tokens"), ai_client.AIOutputError),
        (_message("not json"), ai_client.AIOutputError),
        (_message("[1, 2]"), ai_client.AIOutputError),
    ],
)
def test_bad_outputs_raise(
    monkeypatch: pytest.MonkeyPatch, message: SimpleNamespace, error_type: type[Exception]
) -> None:
    with pytest.raises(error_type):
        _call(FakeClient(message), monkeypatch)


@pytest.mark.parametrize(
    ("error", "fragment"),
    [
        (_status_error(anthropic.AuthenticationError, 401), "authentication"),
        (_status_error(anthropic.RateLimitError, 429), "rate limited"),
        (_status_error(anthropic.BadRequestError, 400), "rejected"),
        (_status_error(anthropic.InternalServerError, 500), "(500)"),
        (
            anthropic.APIConnectionError(
                request=httpx.Request("POST", "https://api.anthropic.com")
            ),
            "reach",
        ),
    ],
)
def test_api_errors_are_wrapped(
    monkeypatch: pytest.MonkeyPatch, error: Exception, fragment: str
) -> None:
    with pytest.raises(ai_client.AIServiceError) as excinfo:
        _call(FakeClient(error=error), monkeypatch)
    assert fragment in excinfo.value.message
    assert "boom" not in excinfo.value.message  # no upstream detail leaked to callers


def test_get_client_requires_key(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ai_client, "_client", None)
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "")
    with pytest.raises(ai_client.AIConfigError):
        ai_client.get_client()


def test_get_client_builds_once(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ai_client, "_client", None)
    monkeypatch.setattr(settings, "ANTHROPIC_API_KEY", "sk-test-not-real")
    first = ai_client.get_client()
    assert ai_client.get_client() is first
    monkeypatch.setattr(ai_client, "_client", None)


# --- OpenAI provider --------------------------------------------------------------------


def _openai_completion(
    content: str | None,
    finish_reason: str = "stop",
    refusal: str | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        model="gpt-test",
        choices=[
            SimpleNamespace(
                finish_reason=finish_reason,
                message=SimpleNamespace(content=content, refusal=refusal),
            )
        ],
        usage=SimpleNamespace(prompt_tokens=13, completion_tokens=5),
    )


class FakeOpenAI:
    def __init__(self, completion: SimpleNamespace | None = None, error: Exception | None = None):
        self.completion = completion
        self.error = error
        self.kwargs: dict[str, Any] = {}
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, **kwargs: Any) -> SimpleNamespace:
        self.kwargs = kwargs
        if self.error is not None:
            raise self.error
        assert self.completion is not None
        return self.completion


def _call_openai(client: FakeOpenAI, monkeypatch: pytest.MonkeyPatch) -> ai_client.AIResult:
    monkeypatch.setattr(settings, "AI_PROVIDER", "openai")
    monkeypatch.setattr(ai_client, "get_openai_client", lambda: client)
    return ai_client.generate_structured(
        system="sys",
        user_content="user",
        tool_name="submit_review",
        tool_description="desc",
        input_schema=SCHEMA,
    )


def test_openai_success_returns_data_and_usage(monkeypatch: pytest.MonkeyPatch) -> None:
    client = FakeOpenAI(_openai_completion(json.dumps({"a": {"b": 1}})))
    result = _call_openai(client, monkeypatch)
    assert result.data == {"a": {"b": 1}}
    assert (result.model, result.input_tokens, result.output_tokens) == ("gpt-test", 13, 5)
    assert client.kwargs["model"] == settings.OPENAI_MODEL
    schema = client.kwargs["response_format"]["json_schema"]["schema"]
    assert schema["additionalProperties"] is False


def test_openai_missing_key_raises_config_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AI_PROVIDER", "openai")
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "")
    monkeypatch.setattr(ai_client, "_openai_client", None)
    with pytest.raises(ai_client.AIConfigError):
        ai_client.generate_structured(
            system="s", user_content="u", tool_name="t", tool_description="d", input_schema=SCHEMA
        )


@pytest.mark.parametrize(
    ("completion", "error_type"),
    [
        (_openai_completion("{}", finish_reason="length"), ai_client.AIOutputError),
        (_openai_completion("not json"), ai_client.AIOutputError),
        (_openai_completion("[1]"), ai_client.AIOutputError),
        (_openai_completion(None, refusal="no"), ai_client.AIServiceError),
        (_openai_completion("{}", finish_reason="content_filter"), ai_client.AIServiceError),
    ],
)
def test_openai_bad_output_maps_to_errors(
    completion: SimpleNamespace,
    error_type: type[Exception],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with pytest.raises(error_type):
        _call_openai(FakeOpenAI(completion), monkeypatch)


def test_openai_api_errors_map_to_service_error(monkeypatch: pytest.MonkeyPatch) -> None:
    import openai

    request = httpx.Request("POST", "https://api.openai.com/v1/chat/completions")
    errors: list[Exception] = [
        openai.AuthenticationError("x", response=httpx.Response(401, request=request), body=None),
        openai.RateLimitError("x", response=httpx.Response(429, request=request), body=None),
        openai.BadRequestError("x", response=httpx.Response(400, request=request), body=None),
        openai.InternalServerError("x", response=httpx.Response(500, request=request), body=None),
        openai.APIConnectionError(request=request),
    ]
    for err in errors:
        with pytest.raises(ai_client.AIServiceError):
            _call_openai(FakeOpenAI(error=err), monkeypatch)
