"""Qwen stays outside the numbers. The forward sweep is idempotent. The book is not historical."""

from datetime import datetime, timezone

import httpx

from killlab.ai.boundary import filter_explanation
from killlab.ai.compile import LLMUnavailable, compile_text, narrate
from killlab.data.bitget import BitgetRest
from killlab.forward import accrual_window, sweep_forward
from killlab.config import Settings


def _settings() -> Settings:
    return Settings(
        database_url="",
        direct_url="",
        api_token="",
        env="test",
        log_level="INFO",
        bitget_rest_base="https://api.bitget.com",
        bitget_timeout_s=5,
        llm_api_key="",
        llm_base_url="",
        llm_model="",
        llm_timeout_s=5,
        run_stale_minutes=15,
        frontend_origin="",
    )


def test_qwen_cannot_insert_a_number_the_engine_did_not_return(monkeypatch):
    def fake_post(url, headers=None, json=None, timeout=None):
        request = httpx.Request("POST", url)
        return httpx.Response(200, json={"choices": [{"message": {"content": "The deflated sharpe is 9.99."}}]}, request=request)

    monkeypatch.setenv("LLM_API_KEY", "test-key")
    monkeypatch.setenv("LLM_MODEL", "qwen3.8-max")
    monkeypatch.setattr(httpx, "post", fake_post)
    words = narrate("Explain.", {"label": "UNTESTABLE", "dsr": None})
    assert "9.99" not in words["text"]
    assert "[redacted]" in words["text"]
    assert words["numbers_locked"] is True


def test_timeout_auth_failure_and_invalid_json_fall_through(monkeypatch):
    calls = {"n": 0}

    def fake_post(url, headers=None, json=None, timeout=None):
        calls["n"] += 1
        request = httpx.Request("POST", url)
        if calls["n"] == 1:
            raise httpx.TimeoutException("slow")
        if calls["n"] == 2:
            return httpx.Response(401, json={"error": "no"}, request=request)
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": '{"family":"session_timing","sharpe":1.2}'}}]},
            request=request,
        )

    monkeypatch.setenv("LLM_API_KEY", "test-key")
    monkeypatch.setenv("LLM_MODEL", "qwen3.8-max")
    monkeypatch.setenv("AI_PRIMARY_PROVIDER", "groq")
    monkeypatch.setenv("AI_FALLBACK_PROVIDERS", "together")
    monkeypatch.setenv("GROQ_API_KEY", "fallback")
    monkeypatch.setenv("GROQ_MODEL", "openai/gpt-oss-120b")
    monkeypatch.setenv("TOGETHER_API_KEY", "fallback-2")
    monkeypatch.setenv("TOGETHER_MODEL", "meta-llama/Llama-3-70b")
    monkeypatch.setattr(httpx, "post", fake_post)
    try:
        compile_text("Trade NVDA in the first hour of the cash session")
    except LLMUnavailable as exc:
        assert "schema" in str(exc) or exc.args
    else:
        raise AssertionError("a sharpe field must not become a spec")
    assert calls["n"] >= 3


def test_forward_sweep_is_idempotent_and_refuses_a_changed_freeze():
    now = datetime(2026, 9, 29, tzinfo=timezone.utc)
    seen = set()
    pulls = {"n": 0}

    def pull(_canonical):
        pulls["n"] += 1
        return {"rows": [1]}

    def execute_fn(_canonical, _snapshot, _prior, _related):
        return {"label": "UNTESTABLE", "primary_trap": "insufficient_units", "n_units": {"n": 3}}

    item = {
        "preregistration_id": "pre-1",
        "spec_sha256": "abc",
        "frozen_sha256": "abc",
        "canonical": {"family": "session_timing"},
        "prior_trials": 0,
        "related_trials": 0,
    }
    first = sweep_forward(items=[item], seen=seen, now=now, pull=pull, execute_fn=execute_fn)
    second = sweep_forward(items=[item], seen=seen, now=now, pull=pull, execute_fn=execute_fn)
    assert first[0]["action"] == "below_floor"
    assert second[0]["action"] == "duplicate"
    assert pulls["n"] == 1
    ready = sweep_forward(
        items=[{**item, "preregistration_id": "pre-2"}],
        seen=set(),
        now=now,
        pull=pull,
        execute_fn=lambda *_args: {"label": "INCONCLUSIVE", "primary_trap": "underpowered"},
    )
    assert ready[0]["action"] == "ran"
    changed = sweep_forward(
        items=[{**item, "preregistration_id": "pre-3", "spec_sha256": "edited"}],
        seen=set(),
        now=now,
        pull=pull,
        execute_fn=execute_fn,
    )
    assert changed[0]["action"] == "hash_mismatch"
    failed = sweep_forward(
        items=[{**item, "preregistration_id": "pre-4"}],
        seen=set(),
        now=now,
        pull=lambda _canonical: (_ for _ in ()).throw(RuntimeError("bitget down")),
        execute_fn=execute_fn,
    )
    assert failed[0]["action"] == "provider_failure"
    again = sweep_forward(
        items=[{**item, "preregistration_id": "pre-4"}],
        seen=set(),
        now=now,
        pull=pull,
        execute_fn=execute_fn,
    )
    assert again[0]["action"] == "below_floor"
    assert accrual_window(now) == "2026-09-29"


def test_forward_book_is_labeled_forward_and_not_historical():
    client = BitgetRest(_settings())
    captured = {}

    class Dummy:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def get(self, url, params=None):
            captured["url"] = url
            request = httpx.Request("GET", url)
            return httpx.Response(
                200,
                json={"code": "00000", "data": {"asks": [["10", "2"]], "bids": [["9", "3"]], "ts": "1"}},
                request=request,
            )

    import killlab.data.bitget as bitget_module
    original = bitget_module.httpx.Client
    bitget_module.httpx.Client = lambda *args, **kwargs: Dummy()
    try:
        book = client.forward_book(frozen=True, symbol="NVDAUSDT")
    finally:
        bitget_module.httpx.Client = original
    assert book["provenance"] == "forward_recorded"
    assert book["historical"] is False
    assert "history" not in book["endpoint"]
    assert book["spread_bps"] > 0
    assert filter_explanation("spread 1.5", book)
