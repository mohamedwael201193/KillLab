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
        action = arguments.get("action")
        symbol = arguments.get("symbol")
        if action == "macd":
            return _sse({"symbol": symbol, "macd": 1.126084, "signal": 0.094051, "histogram": 1.032033, "cross": "golden_cross"})
        if action == "atr":
            return _sse({"symbol": symbol, "atr": 1.9804, "atr_pct": 0.87, "period": 14})
        if action == "ema":
            return _sse({"symbol": symbol, "price": 227.67, "ema9": 228.5925, "ema21": 227.5227, "ema55": 225.6719})
        if action == "bollinger":
            return _sse({"symbol": symbol, "upper": 222.8465, "middle": 227.9493, "lower": 233.0521, "pct_b": 0.5068})
        if action == "ma":
            return _sse({"symbol": symbol, "price": 227.88, "ma7": 229.39, "ma25": 226.5776, "ma99": 222.2181, "trend": "mixed"})
        return _sse({"symbol": symbol, "rsi": 42.21, "period": 14, "signal": "neutral"})
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
    assert live_only["current_or_historical"] == "undated"
    assert live_only["data_timestamp"] is None
    stale = evidence_object(
        source_type="MCP_CONTEXT",
        provider="bitget-mcp-server",
        tool_name="do_query",
        symbol="NVDA",
        query={"action": "quote"},
        payload={"price": 10, "as_of": "2020-01-01T00:00:00Z"},
    )
    assert stale["current_or_historical"] == "stale"
    assert stale["data_timestamp"] == "2020-01-01T00:00:00Z"


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


def test_each_official_skill_has_one_route_and_a_second_skill_is_optional():
    assert route_skill("How does the Fed and CPI change the tape?", None)["skill"] == "macro-analyst"
    assert route_skill("Are ETF and whale flows arriving?", None)["skill"] == "market-intel"
    assert route_skill("Is the crowd in fear while funding is positive?", None)["skill"] == "sentiment-analyst"
    assert route_skill("Is the session hour overbought?", None)["skill"] == "technical-analysis"
    assert route_skill("What breaking news moved the name?", None)["skill"] == "news-briefing"
    send = _transport(_ok)
    context = enrich_context(
        frozen=True,
        family="session_timing",
        instruments=["BTCUSDT"],
        text="Fed rates and ETF institutional flow",
        send=send,
    )
    names = [item[1] for item in send.calls]
    assert set(names) == {"rates_yields", "derivatives_sentiment"}
    assert context["routing"]["skill"] == "macro-analyst"
    assert context["routing"]["secondary"] == "market-intel"
    assert "technical_analysis" not in names
    assert "sentiment_index" not in names
    urls = {item["source_url"] for item in context["items"]}
    assert urls == {"https://datahub.noxiaohao.com/mcp"}
    assert all(item["usable_for_verdict"] is False for item in context["items"])


def test_a_crypto_name_does_not_call_the_us_stock_mcp_and_an_undated_quote_stays_undated():
    send = _transport(_ok)
    crypto = enrich_context(frozen=True, family="carry_basis", instruments=["BTCUSDT"], text="funding", send=send)
    assert all(item["source_url"] != "https://agent.bitget.com/mcp" for item in crypto["items"])
    equity = enrich_context(
        frozen=True,
        family="session_timing",
        instruments=["NVDAUSDT"],
        text="the first cash session hour",
        send=_transport(lambda name, arguments: _sse({"symbol": "NVDA", "last_price": 10}) if name == "do_query" else _ok(name, arguments)),
    )
    quote = next(item for item in equity["items"] if item["source_type"] == "MCP_CONTEXT")
    skill = next(item for item in equity["items"] if item["source_type"] == "SKILL_CONTEXT")
    assert quote["source_url"] == "https://agent.bitget.com/mcp"
    assert skill["source_url"] == "https://datahub.noxiaohao.com/mcp"
    assert quote["current_or_historical"] == "undated"
    assert quote["data_timestamp"] is None
    assert quote["retrieved_at"] != quote["data_timestamp"]


def test_a_session_limit_is_labeled_and_not_replaced_with_a_skill_price():
    def limited(name, arguments):
        return 503, {"mcp-session-id": "session"}, "Too many open sessions"

    send = _transport(limited)
    with pytest.raises(McpError) as exc:
        call_tool("https://agent.bitget.com/mcp", "do_query", {"entry_id": "equity_price_quote"}, retries=1, send=send)
    assert exc.value.reason == "too many open sessions"
    context = enrich_context(frozen=True, family="session_timing", instruments=["NVDAUSDT"], text="session hour", send=send)
    quote = next(item for item in context["items"] if item["source_type"] == "MCP_CONTEXT")
    assert quote["failure_reason"] == "too many open sessions"
    assert "228" not in quote["summary"]
    assert quote["source_url"] == "https://agent.bitget.com/mcp"


def test_an_empty_news_tool_is_not_described_as_an_article():
    def empty(name, arguments):
        return _sse([{"feed": "cointelegraph", "items": []}])

    context = enrich_context(
        frozen=True,
        family=None,
        instruments=["BTCUSDT"],
        text="What breaking news moved the name?",
        send=_transport(empty),
    )
    item = context["items"][0]
    assert item["skill"] == "news-briefing"
    assert item["summary"] == "The official news tool answered with no articles."
    assert item["current_or_historical"] == "unknown"
    assert item["source_url"] == "https://datahub.noxiaohao.com/mcp"


def test_execution_wording_without_a_skill_trigger_does_not_invent_one():
    assert route_skill("Compare waiting with trading now on the same exit.", "execution_venue_time")["skill"] is None


def test_a_real_session_is_closed_after_the_tool_call():
    from killlab.integrations.mcp_http import _once

    closed = []

    def send(url, payload, session, timeout):
        if payload.get("method") == "initialize":
            return 200, {"mcp-session-id": "sess-1"}, "{}"
        if payload.get("method") == "notifications/initialized":
            return 202, {}, ""
        return _sse({"symbol": "NVDA", "last_price": 229.76})

    result = _once("https://agent.bitget.com/mcp", "do_query", {}, 5, send, close=lambda url, session: closed.append((url, session)))
    assert result["data"]["last_price"] == 229.76
    assert closed == [("https://agent.bitget.com/mcp", "sess-1")]


def test_a_failed_call_still_closes_the_session():
    from killlab.integrations.mcp_http import _once

    closed = []

    def send(url, payload, session, timeout):
        if payload.get("method") == "initialize":
            return 200, {"mcp-session-id": "sess-2"}, "{}"
        return 503, {}, "Too many open sessions"

    with pytest.raises(McpError):
        _once("https://agent.bitget.com/mcp", "do_query", {}, 5, send, close=lambda url, session: closed.append(session))
    assert closed == ["sess-2"]


def test_quote_time_stays_separate_from_retrieval_time():
    item = evidence_object(
        source_type="MCP_CONTEXT",
        provider="bitget-mcp",
        tool_name="do_query",
        symbol="NVDA",
        query={"entry_id": "equity_price_quote"},
        payload={
            "success": True,
            "data": {
                "results": [{"symbol": "NVDA", "last_price": 229.76, "open": 229.3}],
                "extra": {"metadata": {"timestamp": "2026-09-29T16:49:33"}},
                "warnings": [{"message": "deprecated"}],
            },
        },
        source_url="https://agent.bitget.com/mcp",
        requested_at="2026-09-29T16:49:30+00:00",
    )
    assert item["data_timestamp"] == "2026-09-29T16:49:33"
    assert item["requested_at"] == "2026-09-29T16:49:30+00:00"
    assert item["retrieved_at"] != item["data_timestamp"]
    assert item["current_or_historical"] == "current"
    assert item["usable_for_verdict"] is False
    assert "last_price 229.76" in item["summary"]
    assert "deprecated" not in item["summary"]


def test_rates_without_tenor_levels_are_not_called_a_curve():
    from killlab.integrations.bitget_signal import skill_evidence

    def empty_curve(name, arguments):
        return _sse({"yield_curve": {"t2y": {"error": ""}, "t10y": {"error": ""}}, "spread_10y2y": 0.0, "inverted": False})

    items = skill_evidence(frozen=True, text="What does the yield curve say?", family=None, symbol=None, send=_transport(empty_curve))
    assert items[0]["skill"] == "macro-analyst"
    assert items[0]["summary"] == "The official rates tool returned no tenor levels."
    assert items[0]["structured_data"] == {}
    assert items[0]["usable_for_verdict"] is False


def test_an_inversion_flag_without_tenors_is_not_a_curve():
    from killlab.integrations.bitget_signal import skill_evidence

    def flag_only(name, arguments):
        return _sse({"yield_curve_inverted": False})

    items = skill_evidence(frozen=True, text="What does the yield curve say?", family=None, symbol=None, send=_transport(flag_only))
    assert items[0]["summary"] == "The official rates tool returned no tenor levels."
    assert items[0]["structured_data"] == {}


def test_paging_stops_at_the_frozen_start_and_drops_older_bars(monkeypatch):
    import httpx
    from datetime import datetime, timezone

    from killlab.config import Settings
    from killlab.data.bitget import BitgetRest

    class Dummy:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def get(self, url, params=None):
            end = int(params["endTime"])
            rows = [[end - index * 3_600_000, 1, 1, 1, 1] for index in range(200)]
            request = httpx.Request("GET", url)
            return httpx.Response(200, json={"data": rows}, request=request)

    monkeypatch.setattr(httpx, "Client", lambda *args, **kwargs: Dummy())
    not_before = int(datetime(2026, 7, 1, tzinfo=timezone.utc).timestamp() * 1000)
    result = BitgetRest(Settings(
        database_url="", direct_url="", api_token="", env="test", log_level="INFO",
        bitget_rest_base="https://api.bitget.com", bitget_timeout_s=5,
        llm_api_key="", llm_base_url="", llm_model="", llm_timeout_s=5,
        run_stale_minutes=15, frontend_origin="",
    )).history_candles(
        frozen=True, product="USDT-FUTURES", symbol="NVDAUSDT", pages=16, not_before_ms=not_before,
    )
    assert result["pagination_stop"] == "window_start"
    assert result["pages_fetched"] < 16
    assert result["rows"]
    assert all(int(row[0]) >= not_before for row in result["rows"])


def test_the_cash_close_is_a_session_question_and_the_open_stays_the_open():
    from killlab.ai.compile import normalize_draft
    from killlab.engine.review import research_fingerprint

    close = normalize_draft("Does the NVDA last cash hour beat the other cash hours?", {"family": "unsupported"})
    assert close["family"] == "session_timing"
    assert close["session_hour"] == 15
    assert close["test_start"] == "2026-05-18"
    assert close["test_end"] == "2026-09-28"
    opened = normalize_draft("Trade NVDA in the first hour of the cash session", {"family": "unsupported"})
    assert opened["family"] == "session_timing"
    assert "session_hour" not in opened
    assert research_fingerprint(opened) != research_fingerprint(close)
    assert research_fingerprint(opened) == research_fingerprint({key: value for key, value in opened.items() if key != "session_hour"})


def test_perp_versus_spot_is_the_basis_family():
    from killlab.ai.compile import family_from_text

    assert family_from_text("Does the NVDA perp versus spot premium fade?", "carry_basis") == "basis_convergence"


def test_a_missing_leader_tape_is_not_stored_as_zero_units():
    from killlab.config import Settings
    from killlab.data.assemble import assemble_snapshot
    from killlab.data.bitget import BitgetError, BitgetRest

    def candles(self, **kwargs):
        if kwargs["symbol"] == "BTCUSDT":
            raise BitgetError("http 429")
        return {"rows": [[1, 1, 1, 1, 1]], "actual_first": "2026-05-18T00:00:00Z", "pagination_stop": "page_cap", "pages_requested": 16}

    original_candles = BitgetRest.history_candles
    original_ticker = BitgetRest.ticker
    original_book = BitgetRest.forward_book
    BitgetRest.history_candles = candles
    BitgetRest.ticker = lambda *args, **kwargs: None
    BitgetRest.forward_book = lambda *args, **kwargs: None
    client = BitgetRest(Settings(
        database_url="", direct_url="", api_token="", env="test", log_level="INFO",
        bitget_rest_base="https://api.bitget.com", bitget_timeout_s=5,
        llm_api_key="", llm_base_url="", llm_model="", llm_timeout_s=5,
        run_stale_minutes=15, frontend_origin="",
    ))
    try:
        try:
            assemble_snapshot(client, {
                "family": "lead_lag",
                "leader": "BTCUSDT",
                "instruments": ["NVDAUSDT"],
                "venue": "bitget_perp",
                "test_start": "2026-05-18",
                "test_end": "2026-09-28",
                "notional_usd": 10000,
            })
            raised = False
        except BitgetError:
            raised = True
        assert raised
    finally:
        BitgetRest.history_candles = original_candles
        BitgetRest.ticker = original_ticker
        BitgetRest.forward_book = original_book


def test_the_lead_question_uses_the_same_page_cap_as_the_other_scored_families():
    from killlab.data.assemble import _FAMILIES

    assert "lead_lag" in _FAMILIES


def test_a_named_lead_is_not_a_session_question():
    from killlab.ai.compile import normalize_draft
    from killlab.engine.review import research_fingerprint

    lead = normalize_draft("The BTC hour before the open leads NVDA's first cash hour.", {"family": "session_timing"})
    assert lead["family"] == "lead_lag"
    assert lead["leader"] == "BTCUSDT"
    assert lead["instruments"] == ["NVDAUSDT"]
    assert [item["code"] for item in lead["variants"]] == ["follow", "fade"]
    opened = normalize_draft("Trade NVDA in the first hour of the cash session", {"family": "unsupported"})
    assert research_fingerprint(lead) != research_fingerprint(opened)


def test_an_incomplete_book_walk_stops_an_execution_claim():
    from killlab.runner import execute

    spec = {
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
        "risk": {"sigma_span": "until_sunday_switch", "horizon_span": "until_sunday_switch", "alternatives": ["NOW", "WAIT"], "lambda_grid": [0.5], "book_max_spread_bps": 50},
    }
    book = {"historical": False, "provenance": "forward_recorded", "spread_bps": 1, "bid_depth": 10, "ask_depth": 10, "walk_complete": False, "walk_notional_usd": 10000}
    assert execute(spec, {"rows": [], "book_capture": book})["primary_trap"] == "book_unusable"


def test_forward_depth_imbalance_is_not_a_return():
    from killlab.runner import _depth_imbalance

    assert _depth_imbalance(3, 1) == 0.5
    assert _depth_imbalance(0, 0) is None
    assert _depth_imbalance(None, 1) is None


def test_a_skill_that_does_not_finish_keeps_its_name():
    import time

    def slow(name, arguments):
        time.sleep(3)
        return _sse({"rsi": 1})

    context = enrich_context(
        frozen=True,
        family="session_timing",
        instruments=["BTCUSDT"],
        text="session",
        timeout=0.2,
        send=_transport(slow),
    )
    failed = context["items"][-1]
    assert failed["skill"] == "technical-analysis"
    assert failed["failure_reason"] == "TimeoutError"
    assert failed["usable_for_verdict"] is False
    assert context["routing"]["skill"] == "technical-analysis"


def test_technical_analysis_calls_the_indicators_that_return_numbers():
    from killlab.integrations.bitget_signal import skill_evidence

    send = _transport(_ok)
    items = skill_evidence(
        frozen=True,
        text="Is the session hour overbought?",
        family="session_timing",
        symbol="NVDAUSDT",
        send=send,
    )
    actions = [call[2].get("action") for call in send.calls if call[1] == "technical_analysis"]
    assert actions == ["rsi", "macd", "atr", "ema", "bollinger", "ma"]
    blob = " ".join(item["summary"] for item in items)
    assert "rsi 42.21" in blob
    assert "macd 1.126084" in blob
    assert "atr 1.9804" in blob
    assert "ema9 228.5925" in blob
    assert "upper 222.8465" in blob
    assert "ma7 229.39" in blob
    assert all(item["usable_for_verdict"] is False for item in items)


def test_an_unknown_indicator_action_is_not_stored_as_a_reading():
    from killlab.integrations.bitget_signal import skill_evidence

    def handler(name, arguments):
        if name == "technical_analysis" and arguments.get("action") == "macd":
            return _sse({"error": "Unknown action: macd"})
        return _ok(name, arguments)

    items = skill_evidence(
        frozen=True,
        text="Is the session hour overbought?",
        family="session_timing",
        symbol="NVDAUSDT",
        send=_transport(handler),
    )
    macd = next(item for item in items if (item.get("query") or {}).get("action") == "macd")
    assert macd["summary"] == "The official indicator tool returned no reading."
    assert macd["structured_data"] == {}
    assert macd["usable_for_verdict"] is False


def test_an_empty_signal_row_is_not_replaced_by_a_hidden_source():
    from killlab.integrations.bitget_signal import skill_evidence

    def empty_rates(name, arguments):
        return _sse({"yield_curve_inverted": False, "t10y": {"error": ""}})

    def fallback(skill, symbol, text):
        return [{
            "skill": skill,
            "source_class": "authoritative_fallback",
            "failure_class": "valid_data",
            "usable_for_verdict": False,
            "summary": "sofr 3.9",
            "source_url": "https://markets.newyorkfed.org/api/rates/secured/sofr/last/1.json",
            "provider": "authoritative_fallback",
        }]

    items = skill_evidence(
        frozen=True,
        text="What does the Fed funds rate say?",
        family=None,
        symbol=None,
        send=_transport(empty_rates),
        fallback=fallback,
    )
    classes = [item.get("source_class") for item in items]
    assert "official_signal_mcp" in classes
    assert "authoritative_fallback" in classes
    signal = next(item for item in items if item.get("source_class") == "official_signal_mcp")
    fallback_row = next(item for item in items if item.get("source_class") == "authoritative_fallback")
    assert signal["failure_class"] == "empty_result"
    assert "noxiaohao.com" in (signal.get("source_url") or "")
    assert fallback_row["provider"] != "bitget-signal"
    assert fallback_row["usable_for_verdict"] is False


def test_fallback_refuses_to_run_before_freeze():
    from killlab.integrations import fallbacks

    with pytest.raises(NotFrozen):
        fallbacks.macro_rates(frozen=False)


def test_mcp_timeout_is_classified():
    from killlab.integrations.bitget_signal import classify_skill_result

    assert classify_skill_result("timeout", {}, "rates_yields") == "timeout"
    assert classify_skill_result("too many open sessions", {}, "do_query") == "session_error"
    assert classify_skill_result("malformed response", {}, "news_feed") == "malformed_response"


def test_ny_fed_rates_are_not_labeled_as_the_skill_host():
    from killlab.integrations import fallbacks

    class _Resp:
        status_code = 200
        text = '{"refRates":[{"effectiveDate":"2026-09-28","type":"SOFR","percentRate":3.9}]}'
        content = text.encode()

        def json(self):
            return {"refRates": [{"effectiveDate": "2026-09-28", "type": "SOFR", "percentRate": 3.9}]}

    item = fallbacks.macro_rates(frozen=True, get=lambda *args, **kwargs: _Resp())
    assert item is not None
    assert item["source_class"] == "authoritative_fallback"
    assert item["provider"] == "authoritative_fallback"
    assert "noxiaohao" not in (item.get("source_url") or "")
    assert item["usable_for_verdict"] is False
    assert "3.9" in item["summary"]


def test_compiler_module_does_not_call_the_information_layer():
    source = (Path(__file__).resolve().parents[1] / "killlab" / "ai" / "compile.py").read_text(encoding="utf-8")
    assert "enrich_context" not in source
    assert "call_tool" not in source
    assert "datahub.noxiaohao.com" not in source
    assert "agent.bitget.com" not in source


def test_canonical_skill_recipes_match_the_official_documents():
    from killlab.integrations.bitget_signal import _calls_for

    assert _calls_for("macro-analyst", None, "Fed funds") == [("rates_yields", {"action": "rates_snapshot"})]
    assert _calls_for("sentiment-analyst", "BTCUSDT", "crowd positioning") == [("sentiment_index", {"action": "current"})]
    assert _calls_for("news-briefing", None, "Fed FOMC") == [
        ("news_feed", {"action": "latest", "feeds": "cnbc,fed", "keyword": "Fed", "limit": 5})
    ]
    assert _calls_for("news-briefing", None, "crypto headlines") == [
        ("news_feed", {"action": "latest", "feeds": "cointelegraph,coindesk", "limit": 5})
    ]
    assert _calls_for("market-intel", "BTCUSDT", "ETF flow") == [
        ("derivatives_sentiment", {"action": "top_ls", "symbol": "BTCUSDT", "period": "4h"})
    ]
    assert [item[1]["action"] for item in _calls_for("technical-analysis", "NVDAUSDT", "rsi")] == [
        "rsi",
        "macd",
        "atr",
        "ema",
        "bollinger",
        "ma",
    ]


def test_mcp_retries_timeouts_and_keeps_the_kind():
    hits = {"n": 0}

    def flaky(name, arguments):
        hits["n"] += 1
        if hits["n"] < 2:
            return 408, {}, "slow"
        return _sse({"price": 1})

    result = call_tool("https://agent.bitget.com/mcp", "do_query", {}, retries=2, send=_transport(flaky))
    assert result["data"]["price"] == 1
    assert hits["n"] == 2

    def always_timeout(name, arguments):
        return 408, {}, "slow"

    with pytest.raises(McpError) as failed:
        call_tool("https://agent.bitget.com/mcp", "do_query", {}, retries=2, send=_transport(always_timeout))
    assert failed.value.reason == "timeout"
    assert failed.value.kind == "timeout"


def test_mcp_empty_output_is_empty_result_not_a_reading():
    def empty(name, arguments):
        body = {"jsonrpc": "2.0", "id": 2, "result": {"content": []}}
        return 200, {"mcp-session-id": "session"}, "event: message\ndata: " + json.dumps(body) + "\n"

    with pytest.raises(McpError) as failed:
        call_tool("https://datahub.noxiaohao.com/mcp", "news_feed", {}, retries=1, send=_transport(empty))
    assert failed.value.kind == "empty_result"


def test_mcp_tool_error_is_not_retried():
    hits = {"n": 0}

    def boom(name, arguments):
        hits["n"] += 1
        body = {"jsonrpc": "2.0", "id": 2, "error": {"message": "unknown action"}}
        return 200, {"mcp-session-id": "session"}, "event: message\ndata: " + json.dumps(body) + "\n"

    with pytest.raises(McpError) as failed:
        call_tool("https://datahub.noxiaohao.com/mcp", "rates_yields", {}, retries=3, send=_transport(boom))
    assert failed.value.kind == "tool_error"
    assert hits["n"] == 1


def test_mcp_sessions_do_not_overlap():
    import threading

    current = {"n": 0, "peak": 0}
    lock = threading.Lock()

    def send(url, payload, session, timeout):
        method = payload.get("method")
        if method == "initialize":
            with lock:
                current["n"] += 1
                current["peak"] = max(current["peak"], current["n"])
            return 200, {"mcp-session-id": "session"}, "{}"
        if method == "notifications/initialized":
            return 202, {}, ""
        with lock:
            current["n"] -= 1
        return _sse({"ok": 1})

    def worker():
        call_tool("https://agent.bitget.com/mcp", "do_query", {}, retries=1, send=send)

    threads = [threading.Thread(target=worker) for _ in range(4)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert current["peak"] == 1


def test_lui_context_questions_keep_existing_families():
    from killlab.ai.compile import family_from_text, normalize_draft
    from killlab.integrations.bitget_signal import route_skills

    fed = normalize_draft("Does the Fed funds backdrop change NVDA's first cash hour?", {})
    assert family_from_text("Does the Fed funds backdrop change NVDA's first cash hour?", None) == "session_timing"
    assert fed["family"] == "session_timing"
    assert "session_hour" not in fed
    assert route_skills(fed.get("raw_text") or "Does the Fed funds backdrop change NVDA's first cash hour?", fed["family"])[0]["skill"] == "macro-analyst"

    crowd = normalize_draft("Is BTC crowd positioning one-sided while funding is harvested against cash?", {})
    assert crowd["family"] == "carry_basis"
    assert route_skills("Is BTC crowd positioning one-sided while funding is harvested against cash?", crowd["family"])[0]["skill"] == "sentiment-analyst"

    news = normalize_draft("Did a Fed release coincide with NVDA after earnings?", {})
    assert news["family"] == "event_earnings"
    skills = {item["skill"] for item in route_skills("Did a Fed release coincide with NVDA after earnings?", news["family"])}
    assert "news-briefing" in skills

    proxy = normalize_draft("Is NVDA basis fading while ETF headlines mention flows?", {})
    assert proxy["family"] == "basis_convergence"
    skills = {item["skill"] for item in route_skills("Is NVDA basis fading while ETF headlines mention flows?", proxy["family"])}
    assert "market-intel" in skills or "news-briefing" in skills


def test_coincide_does_not_invent_a_coin_ticker():
    from killlab.ai.compile import normalize_draft

    draft = normalize_draft("Did a Fed release coincide with NVDA after earnings?", {"instruments": ["NVDAUSDT", "COINUSDT"]})
    assert draft["instruments"] == ["NVDAUSDT"]
    assert "COINUSDT" not in draft["instruments"]


def test_sentiment_and_news_and_intel_fallbacks_keep_their_own_urls():
    from killlab.integrations import fallbacks

    class _Json:
        def __init__(self, status, payload):
            self.status_code = status
            self._payload = payload
            self.text = json.dumps(payload)
            self.content = self.text.encode()

        def json(self):
            return self._payload

    class _Xml:
        status_code = 200
        content = (
            b"<rss><channel><item><title>FOMC statement</title><link>https://www.federalreserve.gov/a</link>"
            b"<pubDate>Mon, 28 Sep 2026 14:00:00 GMT</pubDate><guid>fed-1</guid></item></channel></rss>"
        )
        text = content.decode()

    def get(url, *args, **kwargs):
        if "account-long-short" in url:
            return _Json(200, {"code": "00000", "data": [{"ts": "1790700000000", "longShortAccountRatio": "1.72", "longAccountRatio": "0.63"}]})
        if "taker-buy-sell" in url:
            return _Json(200, {"code": "00000", "data": [{"ts": "1790700000000", "buyVolume": "12", "sellVolume": "8"}]})
        if "open-interest" in url:
            return _Json(200, {"code": "00000", "data": {"ts": "1790700000000", "openInterestList": [{"size": "32536"}]}})
        if "federalreserve.gov" in url or "coindesk.com" in url:
            return _Xml()
        return _Json(404, {})

    sentiment = fallbacks.bitget_positioning(frozen=True, symbol="BTCUSDT", get=get)
    assert sentiment["source_class"] == "bitget_public_rest"
    assert sentiment["failure_class"] == "valid_data"
    assert "api.bitget.com" in sentiment["source_url"]
    assert "noxiaohao" not in sentiment["source_url"]
    assert sentiment["usable_for_verdict"] is False

    news = fallbacks.fed_releases(frozen=True, get=get)
    assert news["source_class"] == "authoritative_fallback"
    assert news["structured_data"] or "FOMC" in news["summary"]
    assert "federalreserve.gov" in news["source_url"]

    intel = fallbacks.bitget_open_interest(frozen=True, symbol="BTCUSDT", get=get)
    assert intel["source_class"] == "bitget_public_rest"
    assert intel["structured_data"]["open_interest"] == 32536.0
    assert intel["usable_for_verdict"] is False


def test_stale_fallback_rates_are_not_called_current():
    from killlab.integrations import fallbacks

    class _Resp:
        status_code = 200
        text = '{"refRates":[{"effectiveDate":"2020-01-02","type":"SOFR","percentRate":1.5}]}'
        content = text.encode()

        def json(self):
            return {"refRates": [{"effectiveDate": "2020-01-02", "type": "SOFR", "percentRate": 1.5}]}

    item = fallbacks.macro_rates(frozen=True, get=lambda *args, **kwargs: _Resp())
    assert item["current_or_historical"] == "stale"
    assert item["data_timestamp"].startswith("2020-01-02")
    assert item["failure_class"] == "valid_data"
    assert item["usable_for_verdict"] is False


def test_a_missing_history_family_stays_untestable():
    card = execute({**_spec(), "family": "unsupported"}, {"rows": []})
    assert card["label"] == "UNTESTABLE"


def test_inversion_wording_is_not_silent_session_timing():
    from killlab.ai.compile import family_from_text, normalize_draft
    from killlab.integrations.bitget_signal import route_skills

    text = "Does NVDA's first cash hour differ when the Treasury 10-year minus 2-year is inverted?"
    draft = normalize_draft(text, {})
    assert family_from_text(text, None) == "macro_regime"
    assert draft["family"] == "macro_regime"
    assert draft["regime"]["spread"] == "t10y_minus_t2y"
    assert draft["regime"]["threshold"] == 0
    assert route_skills(text, draft["family"])[0]["skill"] == "macro-analyst"
    fed = normalize_draft("Does the Fed funds backdrop change NVDA's first cash hour?", {})
    assert fed["family"] == "session_timing"
    assert "regime" not in fed


def test_treasury_curve_and_sofr_history_refuse_before_freeze():
    from killlab.integrations import fallbacks

    with pytest.raises(NotFrozen):
        fallbacks.treasury_curve_series(frozen=False)
    with pytest.raises(NotFrozen):
        fallbacks.sofr_history(frozen=False)


def test_treasury_curve_series_keeps_zero_inverted_days():
    from killlab.integrations import fallbacks

    xml = """<?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom" xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata">
      <entry><content><m:properties>
        <d:NEW_DATE>2026-06-02T00:00:00</d:NEW_DATE>
        <d:BC_2YEAR>3.50</d:BC_2YEAR>
        <d:BC_10YEAR>4.20</d:BC_10YEAR>
      </m:properties></content></entry>
      <entry><content><m:properties>
        <d:NEW_DATE>2026-06-03T00:00:00</d:NEW_DATE>
        <d:BC_2YEAR>4.10</d:BC_2YEAR>
        <d:BC_10YEAR>3.90</d:BC_10YEAR>
      </m:properties></content></entry>
    </feed>"""

    class _Resp:
        status_code = 200
        content = xml.encode()
        text = xml

    series = fallbacks.treasury_curve_series(frozen=True, get=lambda *args, **kwargs: _Resp())
    assert series["n_days"] == 2
    assert series["n_inverted"] == 1
    assert series["inverted_dates"] == ["2026-06-03"]
    assert series["url"].startswith("https://home.treasury.gov/")
    evidence = fallbacks.treasury_curve_evidence(frozen=True, get=lambda *args, **kwargs: _Resp())
    assert evidence["usable_for_verdict"] is False
    assert evidence["source_class"] == "authoritative_fallback"
    assert evidence["current_or_historical"] == "historical"
    assert "noxiaohao" not in (evidence.get("source_url") or "")


def test_sofr_history_is_labeled_historical_and_unused_for_verdict():
    from killlab.integrations import fallbacks

    class _Resp:
        status_code = 200
        text = '{"refRates":[{"effectiveDate":"2026-09-28","type":"SOFR","percentRate":3.9},{"effectiveDate":"2026-05-20","type":"SOFR","percentRate":3.5}]}'
        content = text.encode()

        def json(self):
            return {
                "refRates": [
                    {"effectiveDate": "2026-09-28", "type": "SOFR", "percentRate": 3.9},
                    {"effectiveDate": "2026-05-20", "type": "SOFR", "percentRate": 3.5},
                ]
            }

    item = fallbacks.sofr_history(frozen=True, get=lambda *args, **kwargs: _Resp())
    assert item["usable_for_verdict"] is False
    assert item["current_or_historical"] == "historical"
    assert item["source_class"] == "authoritative_fallback"
    assert "last/90" in (item.get("source_url") or "")
    assert item["structured_data"]["n"] == 2


def test_empty_inverted_days_are_untestable_not_unfiltered_session():
    from datetime import datetime, timedelta
    from zoneinfo import ZoneInfo

    et = ZoneInfo("America/New_York")
    start = datetime(2026, 6, 1, 9, 0, tzinfo=et)
    rows = []
    price = 100.0
    day = start
    built = 0
    while built < 70:
        if day.weekday() < 5:
            for hour in range(9, 17):
                stamp = int(day.replace(hour=hour).timestamp() * 1000)
                price *= 1.0001
                rows.append([stamp, price, price, price, price])
            built += 1
        day += timedelta(days=1)
    spec = {**_spec(), "family": "macro_regime", "grain": "1H", "session_hour": 9}
    empty = execute(spec, {"rows": rows, "regime": {"inverted_dates": []}, "payload_sha256": "abc"})
    assert empty["label"] == "UNTESTABLE"
    assert empty["n_units"]["n"] == 0
    assert empty["mechanism"] == "cash_open_when_treasury_2s10s_inverted"
    session = execute({**spec, "family": "session_timing"}, {"rows": rows, "payload_sha256": "abc"})
    assert session["n_units"]["n"] >= 60
    assert session["n_units"]["n"] != empty["n_units"]["n"]

