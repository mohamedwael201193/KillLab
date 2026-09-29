"""Family mechanisms. Each unit is one economic decision, net of one round trip.

Bar-to-bar closes are not a strategy. A family with no observable units
returns an empty panel, and the verdict stays UNTESTABLE.
"""

from __future__ import annotations

from datetime import datetime, timezone

from killlab.engine.costs import round_trip_bps
from killlab.engine.sessions import ET, is_weekend_mm


def _bars(rows: list) -> list[tuple[int, float]]:
    bars = []
    for row in rows or []:
        if isinstance(row, list) and len(row) >= 5:
            bars.append((int(row[0]), float(row[4])))
    bars.sort(key=lambda item: item[0])
    deduped = []
    for stamp, close in bars:
        if deduped and deduped[-1][0] == stamp:
            continue
        if close:
            deduped.append((stamp, close))
    return deduped


def _local(stamp_ms: int) -> datetime:
    return datetime.fromtimestamp(stamp_ms / 1000, tz=timezone.utc).astimezone(ET)


def trade_cost_bps(spec: dict) -> float:
    costs = spec.get("costs") or {}
    if not costs:
        raise ValueError("missing cost model")
    venue = str(spec.get("venue") or "bitget_perp")
    role = "maker" if costs.get("role") == "maker" else "taker"
    return round_trip_bps(venue, role=role)


def _panel(unit_ids: list[str], variants: dict[str, list[float]], baseline: list[float], name: str) -> dict:
    return {"mechanism": name, "unit_ids": unit_ids, "variants": variants, "baseline": baseline}


def _one_hour_return_bps(items: list, index: int) -> float | None:
    """Return to the next bar only when that bar is actually about one hour later."""
    if index + 1 >= len(items):
        return None
    delta = (items[index + 1][0] - items[index][0]).total_seconds()
    if not (45 * 60 <= delta <= 75 * 60):
        return None
    start = items[index][1]
    if not start:
        return None
    return (items[index + 1][1] / start - 1.0) * 1e4


def session_panel(rows: list, spec: dict) -> dict:
    """Open hour versus the other one-hour cash bars that same day.

    The rest-of-day cumulative move is a different horizon and is not the baseline.
    A day with no other one-hour bars is not a unit.
    """
    cost = trade_cost_bps(spec)
    by_day: dict = {}
    for stamp, close in _bars(rows):
        local = _local(stamp)
        if local.weekday() >= 5:
            continue
        by_day.setdefault(local.date(), []).append((local, close, stamp))
    ids: list[str] = []
    continuation: list[float] = []
    reversal: list[float] = []
    baseline: list[float] = []
    for _day, items in sorted(by_day.items()):
        items.sort(key=lambda item: item[0])
        open_at = next((i for i, item in enumerate(items) if item[0].hour == 9), None)
        if open_at is None:
            continue
        gross = _one_hour_return_bps(items, open_at)
        peers = [
            value
            for i, item in enumerate(items)
            if 10 <= item[0].hour <= 15 and (value := _one_hour_return_bps(items, i)) is not None
        ]
        if gross is None or not peers:
            continue
        edge = gross - (sum(peers) / len(peers))
        ids.append(str(items[open_at][2]))
        continuation.append(edge - cost)
        reversal.append(-edge - cost)
        baseline.append(0.0)
    return _panel(ids, {"continuation": continuation, "reversal": reversal}, baseline, "ny_open_hour_vs_other_cash_hours")


def earnings_panel(events: list, spec: dict) -> dict:
    """Follow or fade the first post-event bar, then hold the remaining horizon."""
    cost = trade_cost_bps(spec)
    ids: list[str] = []
    continuation: list[float] = []
    reversal: list[float] = []
    baseline: list[float] = []
    ordered = sorted(events or [], key=lambda item: int(item.get("ts") or 0))
    previous_ts = None
    for event in ordered:
        stamp = int(event.get("ts") or 0)
        if previous_ts is not None and stamp - previous_ts < 6 * 60 * 60 * 1000:
            continue
        previous_ts = stamp
        impulse = event.get("impulse_bps")
        hold = event.get("hold_bps")
        if impulse is None or hold is None or float(impulse) == 0.0:
            continue
        sign = 1.0 if float(impulse) > 0 else -1.0
        ids.append(str(event.get("id")))
        continuation.append(sign * float(hold) - cost)
        reversal.append(-sign * float(hold) - cost)
        baseline.append(float(hold) - cost)
    return _panel(ids, {"continuation": continuation, "reversal": reversal}, baseline, "earnings_impulse_then_hold")


def carry_panel(funding: list, spec: dict) -> dict:
    """One continuous hold is one decision. Eight-hour prints inside it are not independent trials."""
    if not funding:
        return _panel([], {}, [], "funding_receive")
    cost = trade_cost_bps(spec)
    prints = []
    for item in sorted(funding, key=lambda row: int(row.get("fundingTime") or row.get("ts") or 0)):
        rate = item.get("fundingRate")
        if rate is None:
            continue
        prints.append((int(item.get("fundingTime") or item.get("ts")), abs(float(rate)) * 1e4))
    episodes: list[list[tuple[int, float]]] = []
    current: list[tuple[int, float]] = []
    for stamp, bps in prints:
        if current and stamp - current[-1][0] > 12 * 60 * 60 * 1000:
            episodes.append(current)
            current = []
        current.append((stamp, bps))
    if current:
        episodes.append(current)
    ids = [str(episode[0][0]) for episode in episodes]
    received = [sum(bps for _stamp, bps in episode) - cost for episode in episodes]
    return _panel(ids, {"receive": received}, [0.0] * len(ids), "funding_hold_versus_cash")


def execution_panel(rows: list, spec: dict) -> dict:
    """One weekend, two actions, one shared exit: the first StockRoute bar.

    NOW is in the market from Friday 20:00 ET through that exit.
    WAIT is flat until the weekend ends, then marked to the same exit.
    """
    cost = trade_cost_bps(spec)
    bars = [(_local(stamp), close, stamp) for stamp, close in _bars(rows)]
    episodes: list[list] = []
    current: list = []
    previous = False
    for local, close, stamp in bars:
        inside = is_weekend_mm(local)
        if inside:
            current.append((local, close, stamp))
        elif previous and current:
            episodes.append(current)
            current = []
        previous = inside
    if current:
        episodes.append(current)
    ids: list[str] = []
    now_rets: list[float] = []
    wait_rets: list[float] = []
    for episode in episodes:
        start = episode[0]
        switch = episode[-1]
        exit_bar = next((bar for bar in bars if bar[2] > switch[2] and not is_weekend_mm(bar[0])), None)
        if start[1] == 0 or switch[1] == 0 or exit_bar is None:
            continue
        ids.append(str(start[2]))
        now_rets.append((exit_bar[1] / start[1] - 1.0) * 1e4 - cost)
        wait_rets.append((exit_bar[1] / switch[1] - 1.0) * 1e4 - cost)
    return _panel(ids, {"NOW": now_rets, "WAIT": wait_rets}, now_rets, "weekend_choice_same_exit")


def build_panel(spec: dict, snapshot: dict) -> dict:
    if not spec.get("costs"):
        return _panel([], {}, [], "missing_cost")
    family = spec.get("family")
    if family == "event_earnings":
        return earnings_panel(snapshot.get("events") or [], spec)
    if family == "carry_basis":
        return carry_panel(snapshot.get("funding") or [], spec)
    if family == "execution_venue_time":
        return execution_panel(snapshot.get("rows") or [], spec)
    if family == "session_timing":
        return session_panel(snapshot.get("rows") or [], spec)
    return _panel([], {}, [], "unsupported")


def walk_forward_selected(panel: dict, min_train: int) -> dict:
    """Pick the variant on the past only, then record its next unit."""
    variants = panel["variants"]
    ids = panel["unit_ids"]
    baseline = panel["baseline"]
    if not variants or len(ids) <= min_train:
        return {"oos": [], "excess": [], "train_ids": [], "test_ids": [], "selected": None}
    names = list(variants)
    oos: list[float] = []
    excess: list[float] = []
    test_ids: list[str] = []
    for index in range(min_train, len(ids)):
        scores = []
        for name in names:
            window = variants[name][:index]
            scores.append((sum(window) / len(window), name))
        _mean, chosen = max(scores)
        oos.append(variants[chosen][index])
        excess.append(variants[chosen][index] - baseline[index])
        test_ids.append(ids[index])
    return {
        "oos": oos,
        "excess": excess,
        "train_ids": ids[: index] if test_ids else [],
        "test_ids": [ids[index]] if test_ids else [],
        "selected": chosen if test_ids else None,
    }
