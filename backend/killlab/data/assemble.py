"""Build one frozen snapshot from public Bitget pulls. No order methods."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from killlab.data.bitget import BitgetError, BitgetRest
from killlab.data.earnings import align_events, classify_event_times, earnings_timestamps_ms, symbol_for, tag_events

_FAMILIES = {"event_earnings", "execution_venue_time", "carry_basis", "basis_convergence", "session_timing", "lead_lag"}


def assemble_snapshot(client: BitgetRest, canonical: dict) -> dict:
    venue = canonical.get("venue")
    product = "USDT-FUTURES" if venue == "bitget_perp" else "SPOT"
    pages = 16 if canonical.get("family") in _FAMILIES else 3
    not_before = _window_ms(canonical.get("test_start"), end=False)
    not_after = _window_ms(canonical.get("test_end"), end=True)
    snapshot = None
    events = []
    failures = 0
    for instrument in canonical["instruments"]:
        symbol = symbol_for(instrument, venue or "")
        leg_product = product
        if canonical.get("family") == "basis_convergence" and symbol.upper().startswith("R"):
            leg_product = "SPOT"
        try:
            pulled = client.history_candles(
                frozen=True,
                product=leg_product,
                symbol=symbol,
                pages=pages,
                not_before_ms=not_before,
                not_after_ms=not_after,
            )
        except BitgetError:
            failures += 1
            continue
        if snapshot is None:
            snapshot = pulled
        else:
            if pulled.get("actual_first") and (
                snapshot.get("actual_first") is None or pulled["actual_first"] < snapshot["actual_first"]
            ):
                snapshot["actual_first"] = pulled["actual_first"]
            if pulled.get("actual_last") and (
                snapshot.get("actual_last") is None or pulled["actual_last"] > snapshot["actual_last"]
            ):
                snapshot["actual_last"] = pulled["actual_last"]
            rank = {"short_page": 0, "empty_page": 1, "page_cap": 2}
            if rank.get(pulled.get("pagination_stop"), 0) > rank.get(snapshot.get("pagination_stop"), 0):
                snapshot["pagination_stop"] = pulled["pagination_stop"]
                snapshot["pages_requested"] = pulled.get("pages_requested")
                snapshot["pages_fetched"] = pulled.get("pages_fetched")
        if canonical.get("family") == "event_earnings":
            stamps = earnings_timestamps_ms(symbol)
            classified = classify_event_times(pulled.get("rows") or [], stamps)
            snapshot["events_outside_tape"] = int(snapshot.get("events_outside_tape") or 0) + classified["outside"]
            snapshot["events_short_horizon"] = int(snapshot.get("events_short_horizon") or 0) + classified["short_horizon"]
            snapshot["events_aligned"] = int(snapshot.get("events_aligned") or 0) + classified["aligned"]
            events.extend(tag_events(align_events(pulled.get("rows") or [], stamps), symbol))
        if canonical.get("family") == "basis_convergence" and leg_product == "SPOT":
            snapshot["spot_rows"] = list(pulled.get("rows") or [])
            if snapshot.get("rows") is pulled.get("rows"):
                snapshot["rows"] = []
        elif canonical.get("family") == "basis_convergence":
            snapshot["rows"] = list(pulled.get("rows") or [])
        if canonical.get("family") == "carry_basis":
            try:
                funding = client.history_funding(frozen=True, symbol=symbol)
            except BitgetError:
                funding = {"rows": []}
            snapshot.setdefault("funding", [])
            snapshot["funding"].extend(funding.get("rows") or [])
    if snapshot is None:
        raise BitgetError(f"no symbol ({failures} failed)")
    leader = canonical.get("leader")
    if canonical.get("family") == "lead_lag" and isinstance(leader, str) and leader.strip():
        try:
            pulled = client.history_candles(
                frozen=True,
                product=product,
                symbol=symbol_for(leader, venue or ""),
                pages=pages,
                not_before_ms=not_before,
                not_after_ms=not_after,
            )
            snapshot["leader_rows"] = list(pulled.get("rows") or [])
        except BitgetError:
            snapshot["leader_rows"] = []
    first = symbol_for(canonical["instruments"][0], venue or "")
    try:
        book = client.ticker(frozen=True, symbol=first)
    except (BitgetError, IndexError):
        book = None
    if book:
        snapshot["book_observation"] = book
    try:
        capture = client.forward_book(
            frozen=True,
            symbol=first,
            notional_usd=float(canonical.get("notional_usd") or 10000),
        )
    except (BitgetError, IndexError):
        capture = None
    if capture:
        snapshot["book_capture"] = capture
    if canonical.get("family") == "event_earnings":
        snapshot["events"] = events
    snapshot["requested_start"] = canonical.get("test_start")
    return snapshot


def _window_ms(value: object, *, end: bool) -> int | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        day = datetime.fromisoformat(value).replace(tzinfo=timezone.utc)
    except ValueError:
        return None
    if end:
        day = day + timedelta(days=1)
        return int(day.timestamp() * 1000) - 1
    return int(day.timestamp() * 1000)
