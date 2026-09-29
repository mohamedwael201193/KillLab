"""Deterministic run. Numbers come only from the mechanism panel of the snapshot."""

from __future__ import annotations

import math

from killlab.engine.beta import mean_tstat
from killlab.engine.bootstrap import percentile_ci
from killlab.engine.dsr import dsr_from_series
from killlab.engine.mechanisms import build_panel, walk_forward_selected
from killlab.engine.pbo import cscv_pbo
from killlab.engine.traps import FAMILY_MIN_UNITS
from killlab.engine.verdict import decide


def _json_safe(value):
    """Postgres JSON rejects NaN. A missing number stays null and cannot pass a floor."""
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    return value


def _mde(low, high) -> float | None:
    """Approximate 80% power minimum detectable mean from a 90% interval."""
    if low is None or high is None or high <= low:
        return None
    standard_error = (high - low) / (2 * 1.64485)
    return (1.64485 + 0.84162) * standard_error


def _depth_imbalance(bid, ask) -> float | None:
    """Forward book only. This ratio is not a return and does not enter the verdict."""
    if not isinstance(bid, (int, float)) or not isinstance(ask, (int, float)):
        return None
    total = float(bid) + float(ask)
    if total <= 0 or not (bid == bid and ask == ask):
        return None
    return (float(bid) - float(ask)) / total


def _predictive(values: list[float]) -> tuple[float | None, float | None]:
    import numpy as np

    clean = np.asarray(values, float)
    clean = clean[np.isfinite(clean)]
    if len(clean) < 8:
        return None, None
    return float(np.quantile(clean, 0.05)), float(np.quantile(clean, 0.95))


def execute(spec: dict, snapshot: dict, prior_trials: int = 0, related_trials: int = 0) -> dict:
    spec = {key: value for key, value in spec.items() if key != "thesis"}
    panel = build_panel(spec, snapshot)
    series_ids = panel["unit_ids"]
    n_events = len(series_ids)
    min_train = min(8, max(n_events // 5, 1)) if n_events > 3 else n_events
    selected = walk_forward_selected(panel, min_train)
    oos = selected["oos"]
    n_units = len(oos) if oos else n_events
    dsr = None
    beats = None
    ci = {"ci_low": None, "ci_high": None}
    alpha, t_stat = mean_tstat(oos or [])
    variants = list(panel["variants"])
    n_trials = max(1, len(variants)) + max(0, int(prior_trials)) + max(0, int(related_trials))
    if len(oos) >= 3 and variants:
        dsr_doc = dsr_from_series(oos, n_trials=n_trials)
        dsr = dsr_doc.get("dsr")
        ci = percentile_ci(selected["excess"] or oos, seed=int(spec.get("seed") or 1), resamples=400)
        if ci["ci_low"] is not None:
            beats = ci["ci_low"] > 0
    pbo = None
    pbo_reason = None
    if len(oos) >= 16 and len(variants) >= 2:
        import numpy as np

        width = len(panel["unit_ids"])
        columns = [panel["variants"][name][:width] for name in variants]
        if all(len(column) == width and width >= 16 for column in columns):
            pbo_doc = cscv_pbo(np.column_stack(columns), splits=8)
            pbo = pbo_doc.get("pbo")
            pbo_reason = pbo_doc.get("reason")
    measured = {
        "n_units": n_units,
        "dsr": dsr,
        "actual_first": snapshot.get("actual_first"),
        "alpha": alpha,
        "t_stat": t_stat,
        "grain_seconds": 3600 if spec.get("grain") in {"1H", "1h"} else 60,
        "bar_open_delta_s": 0.0,
        "train_ids": selected["train_ids"],
        "test_ids": selected["test_ids"],
        "sigma_h_present": bool((spec.get("risk") or {}).get("sigma_span")),
        "snapshot_sha256": snapshot.get("payload_sha256"),
        "avoided_loss_bps": None,
        "ci_low": ci.get("ci_low"),
        "ci_high": ci.get("ci_high"),
        "n_trials": n_trials,
        "book_capture": snapshot.get("book_capture"),
        "bar_straddle": spec.get("family") in {"session_timing", "macro_regime"} and spec.get("grain") in {"1H", "1h"},
    }
    if beats is not None:
        measured["beats_baseline"] = beats
    if spec.get("family") == "event_earnings" and spec.get("event_kind") in {None, ""}:
        spec = {**spec, "event_kind": "none"}
    card = decide(spec, measured)
    card["snapshot_sha256"] = snapshot.get("payload_sha256")
    card["spec_sha256"] = spec.get("content_sha256")
    card["dsr"] = dsr
    card["ci_low"] = ci.get("ci_low")
    card["ci_high"] = ci.get("ci_high")
    card["pbo"] = pbo
    card["pbo_reason"] = pbo_reason
    card["bar_straddle"] = measured["bar_straddle"]
    card["mde_bps"] = _mde(ci.get("ci_low"), ci.get("ci_high"))
    unit_low, unit_high = _predictive(oos)
    card["unit_p05"] = unit_low
    card["unit_p95"] = unit_high
    card["n_eff"] = n_units
    card["prior_trials"] = max(0, int(prior_trials))
    card["related_trials"] = max(0, int(related_trials))
    card["n_trials"] = n_trials
    card["requested_start"] = spec.get("test_start")
    card["required_units"] = FAMILY_MIN_UNITS.get(spec.get("family"))
    card["pages_requested"] = snapshot.get("pages_requested")
    card["pagination_stop"] = snapshot.get("pagination_stop")
    card["actual_last"] = snapshot.get("actual_last")
    card["venue_floor"] = snapshot.get("pagination_stop") in {"short_page", "empty_page"}
    card["events_outside_tape"] = snapshot.get("events_outside_tape")
    card["events_short_horizon"] = snapshot.get("events_short_horizon")
    card["events_in_tape"] = snapshot.get("events_aligned")
    if snapshot.get("book_observation"):
        card["book_observation"] = snapshot.get("book_observation")
    capture = snapshot.get("book_capture")
    if isinstance(capture, dict):
        card["book_capture"] = {
            "provenance": "forward_recorded",
            "historical": False,
            "symbol": capture.get("symbol"),
            "ts": capture.get("ts"),
            "spread_bps": capture.get("spread_bps"),
            "bid_depth": capture.get("bid_depth"),
            "ask_depth": capture.get("ask_depth"),
            "depth_imbalance": _depth_imbalance(capture.get("bid_depth"), capture.get("ask_depth")),
            "walk_notional_usd": capture.get("walk_notional_usd"),
            "walk_complete": capture.get("walk_complete"),
            "walk_buy_bps": capture.get("walk_buy_bps"),
            "walk_sell_bps": capture.get("walk_sell_bps"),
            "walk_round_trip_bps": capture.get("walk_round_trip_bps"),
            "payload_sha256": capture.get("payload_sha256"),
            "endpoint": capture.get("endpoint"),
        }
    short = FAMILY_MIN_UNITS.get(spec.get("family"), 60) - n_units
    if card["label"] == "UNTESTABLE" and card.get("primary_trap") == "insufficient_units" and short > 0:
        card["units_short"] = short
        card["forward_armed"] = True
    card["n_events"] = n_events
    card["mechanism"] = panel["mechanism"]
    card["selected_variant"] = selected["selected"]
    from killlab.engine.review import evolution_state

    card["next_question"] = evolution_state(card, card.get("primary_trap")).get("proposed_raw_text")
    return _json_safe(card)
