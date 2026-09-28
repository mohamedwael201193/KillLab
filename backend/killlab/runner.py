"""Deterministic run. Numbers come only from the candle snapshot passed in."""

from __future__ import annotations

from killlab.engine.dsr import dsr_from_series
from killlab.engine.verdict import decide


def _returns_bps(rows: list) -> list[float]:
    closes = []
    for row in rows:
        if isinstance(row, list) and len(row) >= 5:
            closes.append(float(row[4]))
    out = []
    for prev, nxt in zip(closes, closes[1:]):
        if prev:
            out.append((nxt / prev - 1.0) * 1e4)
    return out


def execute(spec: dict, snapshot: dict) -> dict:
    returns = _returns_bps(snapshot.get("rows") or [])
    family = spec.get("family")
    # Hourly candles are not earnings events. Event tests stay UNTESTABLE until an event panel is attached.
    n_units = 0 if family == "event_earnings" else len(returns)
    dsr = None
    if len(returns) >= 3 and spec.get("variants") and family != "event_earnings":
        dsr_doc = dsr_from_series(returns, n_trials=max(1, len(spec["variants"])))
        dsr = dsr_doc.get("dsr")
    measured = {
        "n_units": n_units,
        "dsr": dsr,
        "actual_first": snapshot.get("actual_first"),
        "alpha": 0.0,
        "t_stat": 0.0,
        "grain_seconds": 3600 if spec.get("grain") in {"1H", "1h"} else 60,
        "bar_open_delta_s": 0.0,
        "train_ids": [],
        "test_ids": [],
        "sigma_h_present": bool((spec.get("risk") or {}).get("sigma_span")),
        "snapshot_sha256": snapshot.get("payload_sha256"),
        "avoided_loss_bps": None,
    }
    if spec.get("family") == "event_earnings":
        measured["grain_seconds"] = 3600
        spec = {**spec, "event_kind": spec.get("event_kind") or "ah_1900"}
    card = decide(spec, measured)
    card["snapshot_sha256"] = snapshot.get("payload_sha256")
    card["spec_sha256"] = spec.get("content_sha256")
    return card
