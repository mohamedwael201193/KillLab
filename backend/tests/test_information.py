"""Post-freeze information layer. Context is not a verdict."""

import json
from pathlib import Path

import pytest

from killlab.ai.boundary import filter_explanation
from killlab.data.bitget import NotFrozen
from killlab.engine.review import evolution_state, reconcile_unit
from killlab.integrations.bitget_mcp import equity_ticker
from killlab.integrations.bitget_signal import route_skill
from killlab.integrations.context import attach_context, enrich_context
from killlab.integrations.evidence import content_hash, evidence_object
from killlab.integrations.mcp_http import McpError, call_tool
from killlab.runner import execute


def _sse(document: dict) -> tuple[int, dict, str]:
    body = {"jsonrpc": "2.0", "id": 2, "result": {"content": [{"type": "text", "text": json.dumps(document)}]}}
    return 200, {"mcp-session-id": "session"}, "event: message\ndata: " + json.dumps(body) + "\n"


def _transport(handler):
    calls = []

    def send(url, payload, session, timeout):
        method = payload.get("method")
        if method == "initialize":
            return 200, {"mcp-session-id": "session"}, "{}"
        if method == "notifications/initialized":
            return 202, {}, ""
        name = payload["params"]["name"]
        arguments = payload["params"]["arguments"]
        calls.append((url, name, arguments))
        return handler(name, arguments)

    send.calls = calls
    return send


def _ok(name, arguments):
    if name == "technical_analysis":
        return _sse({"symbol": arguments.get("symbol"), "rsi": 42.21, "period": 14, "signal": "neutral"})
    if name == "sentiment_index":
        return _sse({"value": 28, "value_classification": "Fear"})
    if name == "do_query":
        return _sse({"symbol": "NVDA", "price": 120.5, "as_of": "2026-09-29T14:30:00Z"})
    if name == "rates_yields":
        return _sse({"yield_curve_inverted": False})
    if name == "news_feed":
        return _sse([{"feed": "cointelegraph", "items": [{"title": "ETF flow note"}]}])
    return _sse({"ok": True})


def _spec():
    return {
        "family": "session_timing",
        "venue": "bitget_perp",
        "variants": [{"code": "continuation"}, {"code": "reversal"}],
        "selection": {"split": "IS"},
        "costs": {"perp_taker_bps": 6},
        "baselines": ["buy_and_hold"],
        "transforms": [],
        "claims_alpha": False,
        "event_kind": "none",
        "grain": "1H",
        "instruments": ["NVDAUSDT"],
        "risk": {},
    }


def _execution_spec():
    return {
        "family": "execution_venue_time",
        "venue": "bitget_perp",
        "variants": [{"code": "NOW"}, {"code": "WAIT"}],
        "selection": {"split": "IS"},
        "costs": {"perp_taker_bps": 6},
        "baselines": ["buy_and_hold"],
        "transforms": [],
        "claims_alpha": False,
        "event_kind": "none",
        "grain": "1H",
        "instruments": ["NVDAUSDT"],
        "risk": {
            "sigma_span": "until_sunday_switch",
            "horizon_span": "until_sunday_switch",
            "alternatives": ["NOW", "WAIT"],
            "lambda_grid": [0.5],
            "book_max_spread_bps": 50,
        },
    }


def _book():
    return {
        "provenance": "forward_recorded",
        "historical": False,
        "bid_depth": 2.0,
        "ask_depth": 3.0,
        "spread_bps": 4.0,
        "payload_sha256": "abc",
    }


def test_mcp_call_parses_a_session_and_a_tool_body():
    send = _transport(_ok)
    result = call_tool("https://agent.bitget.com/mcp", "do_query", {"entry_id": "equity_price_quote"}, send=send)
    assert result["data"]["symbol"] == "NVDA"
    assert result["data"]["as_of"] == "2026-09-29T14:30:00Z"
    assert send.calls[0][1] == "do_query"


def test_mcp_timeout_and_unavailable_and_malformed():
    def boom(name, arguments):
        raise McpError("timeout")

    send = _transport(boom)
    with pytest.raises(McpError) as timeout:
        call_tool("https://datahub.noxiaohao.com/mcp", "sentiment_index", {"action": "current"}, retries=1, send=send)
    assert timeout.value.reason == "timeout"

    def down(name, arguments):
        return 503, {"mcp-session-id": "session"}, "busy"

    with pytest.raises(McpError) as unavailable:
        call_tool("https://agent.bitget.com/mcp", "do_query", {}, retries=1, send=_transport(down))
    assert unavailable.value.reason == "upstream unavailable"

    def bad(name, arguments):
        return 200, {"mcp-session-id": "session"}, "this is not json"

    with pytest.raises(McpError) as malformed:
        call_tool("https://agent.bitget.com/mcp", "do_query", {}, retries=1, send=_transport(bad))
    assert malformed.value.reason == "malformed response"


def test_evidence_keeps_provenance_hash_and_time_class():
    payload = {"price": 10, "as_of": "2026-09-29T14:30:00Z"}
    current = evidence_object(
        source_type="MCP_CONTEXT",
        provider="bitget-mcp-server",
        tool_name="do_query",
        symbol="NVDA",
        query={"action": "quote"},
        payload=payload,
    )
    again = evidence_object(
        source_type="MCP_CONTEXT",
        provider="bitget-mcp-server",
        tool_name="do_query",
        symbol="NVDA",
        query={"action": "quote"},
        payload=payload,
    )
    historical = evidence_object(
        source_type="SKILL_CONTEXT",
        provider="bitget-signal",
        tool_name="rates_yields",
        symbol=None,
        query={"action": "history"},
        payload={"as_of": "2020-01-01", "value": 1},
    )
    live_only = evidence_object(
        source_type="SKILL_CONTEXT",
        provider="bitget-signal",
        tool_name="technical_analysis",
        symbol="BTCUSDT",
        query={"action": "rsi"},
        payload={"rsi": 42.21},
    )
    assert current["data_timestamp"] == "2026-09-29T14:30:00Z"
    assert current["provenance"]["data_timestamp"] == current["data_timestamp"]
    assert current["content_hash"] == again["content_hash"] == content_hash(payload)
    assert current["current_or_historical"] == "current"
    assert historical["current_or_historical"] == "historical"
    assert live_only["current_or_historical"] == "current"
    assert live_only["data_timestamp"] is None
    assert current["usable_for_verdict"] is False


def test_client_source_has_no_secret_and_no_authorization_header():
    root = Path(__file__).resolve().parents[1] / "killlab" / "integrations"
    text = "\n".join(path.read_text(encoding="utf-8") for path in root.glob("*.py"))
    assert "Authorization" not in text
    assert "ghp_" not in text
    assert "LLM_API_KEY" not in text
    assert "BITGET_SECRET" not in text
    assert "sk-" not in text


def test_skill_routing_picks_one_official_tool():
    send = _transport(_ok)
    context = enrich_context(
        frozen=True,
        family="session_timing",
        instruments=["BTCUSDT"],
        text="Is the fear and greed index extreme?",
        send=send,
    )
    names = [item[1] for item in send.calls]
    assert names == ["sentiment_index"]
    assert context["routing"]["skill"] == "sentiment-analyst"
    assert "technical_analysis" not in names
    assert "news_feed" not in names
    assert "rates_yields" not in names
    assert context["items"][0]["tool_name"] == "sentiment_index"
    assert context["items"][0]["usable_for_verdict"] is False


def test_a_dead_skill_does_not_block_the_engine():
    def down(name, arguments):
        return 503, {}, "busy"

    card = execute(_spec(), {"rows": []})
    before = (card["label"], card["dsr"], card["pbo"], card["n_units"], card["n_trials"])
    context = enrich_context(
        frozen=True,
        family="session_timing",
        instruments=["BTCUSDT"],
        text="session hour",
        send=_transport(down),
    )
    attach_context(card, context)
    assert (card["label"], card["dsr"], card["pbo"], card["n_units"], card["n_trials"]) == before
    assert context["usable_for_verdict"] is False
    assert context["status"] == "unavailable"


def test_context_is_refused_before_freeze():
    send = _transport(_ok)
    with pytest.raises(NotFrozen):
        enrich_context(frozen=False, family="session_timing", instruments=["BTCUSDT"], text="fear", send=send)
    assert send.calls == []


def test_context_does_not_change_measured_fields():
    send = _transport(_ok)
    card = execute(_spec(), {"rows": []})
    before = (card["label"], card["dsr"], card["pbo"], card["n_units"], card["n_trials"], card.get("mechanism"))
    context = enrich_context(
        frozen=True,
        family="session_timing",
        instruments=["NVDAUSDT"],
        text="the first cash session hour",
        fingerprint="abc",
        send=send,
    )
    attach_context(card, context)
    assert (card["label"], card["dsr"], card["pbo"], card["n_units"], card["n_trials"], card.get("mechanism")) == before
    assert equity_ticker("NVDAUSDT") == "NVDA"
    assert {item["source_type"] for item in context["items"]} == {"MCP_CONTEXT", "SKILL_CONTEXT"}
    assert all(item["usable_for_verdict"] is False for item in context["items"])
    quote = next(item for item in context["items"] if item["source_type"] == "MCP_CONTEXT")
    assert quote["data_timestamp"] == "2026-09-29T14:30:00Z"
    assert quote["current_or_historical"] == "current"


def test_qwen_cannot_invent_a_number_a_date_a_source_a_book_or_a_skill():
    facts = {
        "label": "KILLED",
        "book_capture": {"historical": False, "provenance": "forward_recorded"},
        "research_context": {"skill": "technical-analysis", "items": [{"summary": "rsi 42.21"}]},
    }
    text = filter_explanation(
        "technical-analysis stored rsi 42.21. sentiment-analyst via Bloomberg on 1999-01-01 saw a historical order book and rsi 99.5.",
        facts,
    )
    assert "sentiment-analyst" not in text
    assert "Bloomberg" not in text
    assert "1999" not in text
    assert "99.5" not in text
    assert "historical order book" not in text
    assert "42.21" in text
    assert "technical-analysis" in text


def test_personalization_changes_the_skill_and_not_the_verdict():
    plain = route_skill("the first cash session hour", "session_timing", None)
    personal = route_skill("the first cash session hour", "session_timing", "I keep thinking about the fear and greed index")
    assert plain["skill"] == "technical-analysis"
    assert personal["skill"] == "sentiment-analyst"
    left = execute(_spec(), {"rows": []})
    right = execute({**_spec(), "thesis": "I keep thinking about the fear and greed index"}, {"rows": []})
    assert left["label"] == right["label"]
    assert left["dsr"] == right["dsr"]
    assert left["pbo"] == right["pbo"]
    assert left["n_units"] == right["n_units"]


def test_review_does_not_rewrite_the_stored_result():
    card = execute(_spec(), {"rows": []})
    stored = json.dumps(card, sort_keys=True, default=str)
    proposal = evolution_state(card, card.get("primary_trap"), {"object": "unit", "inside_predictive": False})
    reconcile_unit(12.0, card.get("unit_p05"), card.get("unit_p95"))
    assert json.dumps(card, sort_keys=True, default=str) == stored
    assert "outside the one-trade range" in proposal["proposed_raw_text"]


def test_forward_book_cases_stay_forward_only():
    spec = _execution_spec()
    assert execute(spec, {"rows": [], "book_capture": _book()})["primary_trap"] != "book_unusable"
    assert execute(spec, {"rows": []})["primary_trap"] == "book_unusable"
    assert execute(spec, {"rows": [], "book_capture": {**_book(), "bid_depth": 0}})["primary_trap"] == "book_unusable"
    assert execute(spec, {"rows": [], "book_capture": {**_book(), "ask_depth": 0}})["primary_trap"] == "book_unusable"
    assert execute(spec, {"rows": [], "book_capture": {**_book(), "spread_bps": 80}})["primary_trap"] == "book_unusable"
    claimed = execute(spec, {"rows": [], "book_capture": {**_book(), "historical": True}})
    assert claimed["primary_trap"] == "book_unusable"
    assert claimed["book_capture"]["historical"] is False or claimed["primary_trap"] == "book_unusable"
    other = execute(spec, {"rows": [], "book_capture": {**_book(), "provenance": "rest"}})
    assert other["primary_trap"] == "book_unusable"


def test_compiler_module_does_not_call_the_information_layer():
    source = (Path(__file__).resolve().parents[1] / "killlab" / "ai" / "compile.py").read_text(encoding="utf-8")
    assert "enrich_context" not in source
    assert "call_tool" not in source
    assert "datahub.noxiaohao.com" not in source
    assert "agent.bitget.com" not in source
