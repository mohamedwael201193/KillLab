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


def _session_target(spec: dict) -> tuple[int, set[int], str]:
    """Hour 9 is the open. Hour 15 is the close. Any other value stays the open."""
    raw = spec.get("session_hour", 9)
    try:
        hour = int(raw)
    except (TypeError, ValueError):
        hour = 9
    if hour == 15:
        return 15, set(range(9, 15)), "cash_close_hour_vs_other_cash_hours"
    return 9, set(range(10, 16)), "ny_open_hour_vs_other_cash_hours"


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
    target, peer_hours, mechanism = _session_target(spec)
    for _day, items in sorted(by_day.items()):
        items.sort(key=lambda item: item[0])
        open_at = next((i for i, item in enumerate(items) if item[0].hour == target), None)
        if open_at is None:
            continue
        gross = _one_hour_return_bps(items, open_at)
        peers = [
            value
            for i, item in enumerate(items)
            if item[0].hour in peer_hours and (value := _one_hour_return_bps(items, i)) is not None
        ]
        if gross is None or not peers:
            continue
        edge = gross - (sum(peers) / len(peers))
        ids.append(str(items[open_at][2]))
        continuation.append(edge - cost)
        reversal.append(-edge - cost)
        baseline.append(0.0)
    return _panel(ids, {"continuation": continuation, "reversal": reversal}, baseline, mechanism)


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
    return _panel(ids, {"NOW": now_rets, "WAIT": wait_rets}, [0.0] * len(ids), "weekend_choice_same_exit")


def basis_panel(perp_rows: list, spot_rows: list, spec: dict) -> dict:
    """One calendar day, one fade of the perp-spot basis, marked to the next day's first aligned bar.

    Hourly prints inside the day are not trials. A gap over 26 hours is dropped as stale.
    The cost is a perp round trip plus a non-promo r-token round trip.
    """
    if not spec.get("costs"):
        raise ValueError("missing cost model")
    cost = round_trip_bps("bitget_perp") + round_trip_bps("bitget_rtoken", sensitivity=True)
    perp = dict(_bars(perp_rows))
    spot = dict(_bars(spot_rows))
    by_day: dict = {}
    for stamp in sorted(set(perp) & set(spot)):
        if not perp[stamp] or not spot[stamp]:
            continue
        day = datetime.fromtimestamp(stamp / 1000, tz=timezone.utc).date()
        by_day.setdefault(day, stamp)
    days = sorted(by_day)
    ids: list[str] = []
    fade: list[float] = []
    for index, day in enumerate(days[:-1]):
        start = by_day[day]
        end = by_day[days[index + 1]]
        if end - start > 26 * 60 * 60 * 1000:
            continue
        basis = perp[start] / spot[start] - 1.0
        if basis == 0:
            continue
        perp_ret = perp[end] / perp[start] - 1.0
        spot_ret = spot[end] / spot[start] - 1.0
        gross = ((-perp_ret + spot_ret) if basis > 0 else (perp_ret - spot_ret)) * 1e4
        ids.append(str(start))
        fade.append(gross - cost)
    return _panel(ids, {"fade": fade}, [0.0] * len(ids), "daily_basis_fade_versus_cash")


def lead_panel(traded_rows: list, leader_rows: list, spec: dict) -> dict:
    """The hour before the cash open signs the open hour. One weekday is one decision.

    The leader is not traded. A missing bar, a weekend, or a flat leader hour is not a unit.
    """
    cost = trade_cost_bps(spec)
    traded: dict = {}
    leader: dict = {}
    for stamp, close in _bars(traded_rows):
        local = _local(stamp)
        traded[(local.date(), local.hour)] = (stamp, close)
    for stamp, close in _bars(leader_rows):
        local = _local(stamp)
        leader[(local.date(), local.hour)] = close
    ids: list[str] = []
    follow: list[float] = []
    fade: list[float] = []
    for day, hour in sorted(traded):
        if hour != 9 or day.weekday() >= 5:
            continue
        opened = traded.get((day, 9))
        nxt = traded.get((day, 10))
        before = leader.get((day, 8))
        at_open = leader.get((day, 9))
        if opened is None or nxt is None or not before or not at_open or not opened[1] or not nxt[1]:
            continue
        signal = at_open / before - 1.0
        if signal == 0:
            continue
        gross = (nxt[1] / opened[1] - 1.0) * 1e4
        sign = 1.0 if signal > 0 else -1.0
        ids.append(str(opened[0]))
        follow.append(sign * gross - cost)
        fade.append(-sign * gross - cost)
    return _panel(ids, {"follow": follow, "fade": fade}, [0.0] * len(ids), "prior_hour_leads_cash_open")


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
    if family == "basis_convergence":
        return basis_panel(snapshot.get("rows") or [], snapshot.get("spot_rows") or [], spec)
    if family == "lead_lag":
        return lead_panel(snapshot.get("rows") or [], snapshot.get("leader_rows") or [], spec)
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
