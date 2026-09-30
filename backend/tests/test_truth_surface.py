import inspect
import json
import re
from pathlib import Path

import pytest

from killlab.ai.compile import family_from_text
from killlab.engine.traps import REGISTERED_DETECTORS, scan
from killlab.integrations.bitget_signal import classify_skill_result
from killlab.integrations.mcp_http import McpError, call_tool
from killlab.receipt import build_receipt, forward_public


def test_family_phrases_match_the_shared_file():
    rows = json.loads((Path(__file__).resolve().parents[2] / "shared" / "routing_phrases.json").read_text(encoding="utf-8"))
    assert rows
    for row in rows:
        assert family_from_text(row["text"], None) == row["family"]


def test_scan_calls_exactly_the_registered_detectors():
    called = set(re.findall(r"trap_[a-z_]+", inspect.getsource(scan)))
    assert called == set(REGISTERED_DETECTORS)


def test_receipt_is_stable_and_drops_unlisted_fields():
    card = {
        "spec_sha256": "abc",
        "snapshot_sha256": "def",
        "engine_version": "killlab-0.13.1",
        "label": "KILLED",
        "primary_trap": "contradicted",
        "thesis": "do not copy",
        "KILLAB_API_TOKEN": "do not copy",
        "research_context": {
            "items": [
                {
                    "source_class": "official_signal_mcp",
                    "failure_class": "empty_result",
                    "tool_name": "news_feed",
                    "content_hash": "aa",
                    "excerpt": "raw reply",
                }
            ]
        },
    }
    ledger = [{"id": "1", "stage": "DECISION"}]
    first = build_receipt(card, ledger)
    second = build_receipt(card, ledger)
    assert first == second
    assert len(first["receipt_sha256"]) == 64
    blob = json.dumps(first)
    assert "do not copy" not in blob
    assert "raw reply" not in blob
    assert first["context_items"][0]["source_class"] == "official_signal_mcp"


def test_forward_row_is_automatic_and_short():
    row = forward_public("AUTO_RUN", "2026-09-29T00:00:00+00:00", {"label": "KILLED", "spec_sha256": "e" * 64, "window": "2026-09-29"})
    assert row["automatic"] is True
    assert row["label"] == "KILLED"
    assert len(row["spec_sha256"]) == 16


def _framed(document: dict, *, is_error: bool = False) -> tuple[int, dict, str]:
    body = {"jsonrpc": "2.0", "id": 2, "result": {"isError": is_error, "content": [{"type": "text", "text": json.dumps(document)}]}}
    return 200, {}, json.dumps(body)


def test_missing_session_still_returns_the_tool_body():
    def send(url, payload, session, timeout):
        if payload.get("method") == "initialize":
            return 200, {}, "{}"
        return _framed({"ok": True})

    result = call_tool("https://agent.bitget.com/mcp", "do_query", {}, retries=1, send=send)
    assert result["data"]["ok"] is True
    assert "excerpt" not in result
    assert len(result["reply_sha256"]) == 64


def test_tool_is_error_is_not_parsed_as_data():
    def send(url, payload, session, timeout):
        if payload.get("method") == "initialize":
            return 200, {"mcp-session-id": "s"}, "{}"
        if payload.get("method") == "notifications/initialized":
            return 202, {}, ""
        return _framed({"error": "upstream"}, is_error=True)

    with pytest.raises(McpError) as caught:
        call_tool("https://agent.bitget.com/mcp", "do_query", {}, retries=1, send=send)
    assert caught.value.kind == "tool_error"


def test_all_feed_errors_are_not_an_empty_article_list():
    payload = [{"feed": "cnbc", "error": "down"}, {"feed": "fed", "error": "down"}]
    assert classify_skill_result(None, payload, "news_feed") == "feed_error_all"
