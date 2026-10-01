"""Family packs and research constitution. Context does not edit a verdict."""

import json

from pathlib import Path

from killlab.engine.review import apply_next, personalized_question, research_fingerprint, review_narrative
from killlab.integrations.context import enrich_context
from killlab.integrations.source_packs import FAMILY_PACKS, provenance_lanes


def _sse(document):
    body = {"jsonrpc": "2.0", "id": 2, "result": {"content": [{"type": "text", "text": json.dumps(document)}]}}
    return 200, {"mcp-session-id": "session"}, "event: message\ndata: " + json.dumps(body) + "\n"


def _transport(handler):
    def send(url, payload, session, timeout):
        method = payload.get("method")
        if method == "initialize":
            return 200, {"mcp-session-id": "session"}, "{}"
        if method == "notifications/initialized":
            return 202, {}, ""
        name = payload["params"]["name"]
        arguments = payload["params"]["arguments"]
        return handler(name, arguments)

    return send


def _ok(name, arguments):
    if name == "technical_analysis":
        return _sse({"symbol": arguments.get("symbol"), "rsi": 42.2, "period": 14, "signal": "neutral"})
    return _sse({"ok": True})


class _Response:
    def __init__(self, body):
        self.status_code = 200
        self.text = "ok"
        self._body = body

    def json(self):
        return self._body


def _get(url, params=None, timeout=None, **_kwargs):
    if "open-interest" in url:
        return _Response({"code": "00000", "data": {"ts": "1710000000000", "openInterestList": [{"size": "12.5"}]}})
    return _Response({
        "code": "00000",
        "data": [{
            "ts": "1710000000000",
            "longShortAccountRatio": "1.2",
            "longAccountRatio": "0.55",
            "buyVolume": "3",
            "sellVolume": "1",
        }],
    })


def test_packs_cover_existing_families_only():
    assert set(FAMILY_PACKS) == {
        "session_timing",
        "basis_convergence",
        "event_earnings",
        "macro_regime",
        "lead_lag",
        "execution_venue_time",
        "carry_basis",
    }


def test_a_basis_pack_has_four_useful_lanes_and_keeps_classes_distinct():
    context = enrich_context(
        frozen=True,
        family="basis_convergence",
        instruments=["BTCUSDT"],
        text="daily basis fade versus cash",
        snapshot={
            "rows": [[1, 1, 1, 1, 1, 1]],
            "spot_rows": [[1, 1, 1, 1, 1, 1]],
            "actual_first": "2026-01-01T00:00:00Z",
            "book_capture": {"spread_bps": 1.5, "symbol": "BTCUSDT", "ts": "2026-09-30T00:00:00Z"},
        },
        fetch_pack=True,
        get=_get,
        send=_transport(_ok),
    )
    lanes = provenance_lanes(context["items"])
    useful = [lane for lane in lanes if lane["useful"]]
    assert len(useful) >= 4
    classes = {lane["source_class"] for lane in lanes}
    assert "bitget_public_rest" in classes
    assert "official_signal_mcp" in classes
    assert "official Bitget data MCP" not in {item.get("source_class") for item in context["items"] if (item.get("query") or {}).get("fallback")}
    tape = next(item for item in context["items"] if item.get("lane") == "bitget_tape")
    assert tape["source_class"] == "bitget_public_rest"
    assert tape["usable_for_verdict"] is False
    book = next(item for item in context["items"] if item.get("lane") == "bitget_book")
    assert book["query"]["historical"] is False
    assert all(item["usable_for_verdict"] is False for item in context["items"])


def test_constitution_changes_the_next_test_and_not_the_verdict():
    spec = {
        "family": "basis_convergence",
        "instruments": ["NVDAUSDT"],
        "grain": "1D",
        "variants": [{"code": "fade"}],
    }
    fingerprint = research_fingerprint(spec)
    assert research_fingerprint({**spec, "posture": "exploratory"}) == fingerprint
    card = {
        "label": "KILLED",
        "primary_trap": "contradicted",
        "dsr": 0.1,
        "pbo": None,
        "ci_low": -1.0,
        "ci_high": -0.2,
        "n_units": 117,
        "n_trials": 2,
        "mechanism": "daily_basis_fade_versus_cash",
        "prior_trials": 1,
        "related_trials": 0,
    }
    held = dict(card)
    conservative = personalized_question(card, {"posture": "conservative", "universe": "NVDA", "avoid": "earnings"})
    exploratory = personalized_question(card, {"posture": "exploratory", "universe": "NVDA", "horizon": "swing"})
    assert card == held
    assert conservative["proposed_raw_text"] != exploratory["proposed_raw_text"]
    assert len(conservative["reasons"]) >= 2
    assert "conservative" in conservative["reasons"][2]
    assert "exploratory" in exploratory["reasons"][2]
    apply_next(card, {"posture": "exploratory", "universe": "NVDA", "horizon": "swing"})
    assert card["label"] == "KILLED"
    assert card["dsr"] == 0.1
    assert card["ci_low"] == -1.0
    assert card["ci_high"] == -0.2
    assert card["n_units"] == 117
    first = card["next_question"]
    apply_next(card, {"posture": "conservative", "universe": "NVDA", "avoid": "earnings"})
    assert card["next_question"] != first
    assert card["label"] == "KILLED"
    assert card["dsr"] == 0.1
    assert card["pbo"] is None
    assert card["constitution_snapshot"]["preferences"]["posture"] == "conservative"
    assert card["constitution_snapshot"]["sha256"] != fingerprint


def test_next_and_reconcile_do_not_wait_on_a_model():
    source = Path(__file__).resolve().parents[1].joinpath("killlab", "api.py").read_text(encoding="utf-8")
    nxt = source.split("def propose_next", 1)[1].split("def fills", 1)[0]
    rec = source.split("def reconcile", 1)[1].split("def explain", 1)[0]
    assert "narrate(" not in nxt
    assert "narrate(" not in rec
    assert review_narrative({"inside_predictive": False}) == "The pasted fill sat outside the one-trade range."
    assert review_narrative({"status": "no_forecast"}) == "This run has no one-trade range, so reconciliation stays unavailable."
    assert "bps" not in review_narrative({"inside_predictive": True})
