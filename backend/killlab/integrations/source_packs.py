"""Family source packs. Context only. No new scored family."""

from __future__ import annotations

from killlab.integrations.evidence import evidence_object
from killlab.integrations.fallbacks import bitget_open_interest, bitget_positioning, crypto_headlines, macro_rates

ALLOWED_CLASSES = (
    "official_signal_mcp",
    "official Bitget data MCP",
    "bitget_public_rest",
    "authoritative_fallback",
)

# Existing families only. A pack names lanes. It does not add a kill-floor family.
FAMILY_PACKS = {
    "session_timing": ("bitget_tape", "technical", "macro"),
    "basis_convergence": ("bitget_tape", "bitget_book", "open_interest", "positioning", "news"),
    "event_earnings": ("bitget_tape", "news"),
    "macro_regime": ("bitget_tape", "macro", "technical"),
    "lead_lag": ("bitget_tape", "macro"),
    "execution_venue_time": ("bitget_tape", "bitget_book", "instrument"),
    "carry_basis": ("bitget_tape", "funding", "open_interest", "positioning"),
}

_EXTRAS = {
    "basis_convergence": ("open_interest", "positioning"),
    "carry_basis": ("open_interest", "positioning"),
    "session_timing": ("macro",),
    "macro_regime": ("macro",),
    "lead_lag": ("macro",),
    "event_earnings": ("news",),
}


def observation_items(snapshot: dict | None) -> list[dict]:
    if not isinstance(snapshot, dict):
        return []
    items = []
    tape = _tape(snapshot)
    if tape:
        items.append(tape)
    book = _book(snapshot.get("book_capture"))
    if book:
        items.append(book)
    funding = _funding(snapshot.get("funding"))
    if funding:
        items.append(funding)
    return items


def extra_items(*, family: str | None, items: list[dict], symbol: str | None, text: str, timeout: float, get=None) -> list[dict]:
    have = {item.get("tool_name") for item in items}
    found = []
    for name in _EXTRAS.get(family or "", ()):
        if name == "open_interest" and "open_interest" not in have:
            row = bitget_open_interest(frozen=True, symbol=symbol, timeout=timeout, get=get)
        elif name == "positioning" and "account_long_short" not in have:
            row = bitget_positioning(frozen=True, symbol=symbol, timeout=timeout, get=get)
        elif name == "macro" and "sofr" not in have and "rates_yields" not in have:
            row = macro_rates(frozen=True, timeout=timeout, get=get)
        elif name == "news" and "news_feed" not in have:
            row = crypto_headlines(frozen=True, timeout=timeout, get=get)
        else:
            row = None
        if row:
            row["lane"] = row.get("tool_name") or name
            found.append(row)
            have.add(row.get("tool_name"))
    return found


def provenance_lanes(items: list[dict]) -> list[dict]:
    lanes = []
    seen = set()
    for item in items:
        source_class = item.get("source_class")
        if source_class not in ALLOWED_CLASSES:
            continue
        if item.get("query", {}).get("fallback") and source_class != "authoritative_fallback" and source_class != "bitget_public_rest":
            continue
        lane_id = str(item.get("lane") or item.get("tool_name") or source_class)
        key = (source_class, lane_id)
        if key in seen:
            continue
        seen.add(key)
        useful = item.get("failure_class") == "valid_data"
        lanes.append({
            "id": lane_id,
            "source_class": source_class,
            "tool_name": item.get("tool_name"),
            "failure_class": item.get("failure_class"),
            "useful": useful,
            "provider": item.get("provider") or item.get("source"),
            "retrieved_at": item.get("retrieved_at"),
            "data_timestamp": item.get("data_timestamp"),
        })
    return lanes


def _tape(snapshot: dict) -> dict | None:
    n = 0
    for key in ("rows", "spot_rows", "leader_rows"):
        rows = snapshot.get(key)
        if isinstance(rows, list):
            n += len(rows)
    if n == 0 and not snapshot.get("actual_first"):
        return None
    payload = {
        "n_bars": n,
        "actual_first": snapshot.get("actual_first"),
        "actual_last": snapshot.get("actual_last"),
        "pagination_stop": snapshot.get("pagination_stop"),
    }
    item = evidence_object(
        source_type="SKILL_CONTEXT",
        provider="bitget_public_rest",
        tool_name="mix_candles",
        symbol=None,
        query={"lane": "bitget_tape"},
        payload=payload,
        source_url="https://api.bitget.com/api/v2/mix/market/candles",
        source_class="bitget_public_rest",
        failure_class="valid_data",
    )
    item["lane"] = "bitget_tape"
    item["summary"] = f"Frozen Bitget candle pull, {n} bars, first {snapshot.get('actual_first') or 'unknown'}."
    return item


def _book(capture: object) -> dict | None:
    if not isinstance(capture, dict) or capture.get("spread_bps") is None:
        return None
    payload = {
        "spread_bps": capture.get("spread_bps"),
        "symbol": capture.get("symbol"),
        "historical": False,
        "provenance": "forward_recorded",
    }
    item = evidence_object(
        source_type="SKILL_CONTEXT",
        provider="bitget_public_rest",
        tool_name="forward_book",
        symbol=capture.get("symbol"),
        query={"lane": "bitget_book", "historical": False},
        payload=payload,
        source_url=capture.get("endpoint") or "https://api.bitget.com/api/v2/mix/market/merge-depth",
        source_class="bitget_public_rest",
        failure_class="valid_data",
    )
    item["lane"] = "bitget_book"
    item["current_or_historical"] = "current"
    item["summary"] = "Forward-recorded Bitget book. Not a historical book."
    return item


def _funding(rows: object) -> dict | None:
    if not isinstance(rows, list) or not rows:
        return None
    item = evidence_object(
        source_type="SKILL_CONTEXT",
        provider="bitget_public_rest",
        tool_name="history_funding",
        symbol=None,
        query={"lane": "funding"},
        payload={"n": len(rows)},
        source_url="https://api.bitget.com/api/v2/mix/market/history-fund-rate",
        source_class="bitget_public_rest",
        failure_class="valid_data",
    )
    item["lane"] = "funding"
    item["summary"] = f"Bitget funding history already pulled for this freeze, {len(rows)} prints."
    return item
