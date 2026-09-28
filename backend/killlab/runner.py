"""Deterministic run. Numbers come only from the snapshot passed in."""

from __future__ import annotations

from killlab.engine.beta import mean_tstat
from killlab.engine.bootstrap import percentile_ci
from killlab.engine.dsr import dsr_from_series
from killlab.engine.verdict import decide
from killlab.engine.walkforward import expanding_folds


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


def _event_returns(snapshot: dict) -> list[float]:
    """Events are an explicit panel. Candles are never counted as earnings."""
    out = []
    for event in snapshot.get("events") or []:
        value = event.get("return_bps")
        if value is None:
            continue
        out.append(float(value))
    return out


def execute(spec: dict, snapshot: dict) -> dict:
    family = spec.get("family")
    if family == "event_earnings":
        series = _event_returns(snapshot)
    else:
        series = _returns_bps(snapshot.get("rows") or [])
    ids = [str(i) for i in range(len(series))]
    min_train = min(8, max(len(ids) // 5, 1)) if len(ids) > 3 else len(ids)
    folds = expanding_folds(ids, min_train) if len(ids) > min_train else []
    oos = [series[int(fold["test"])] for fold in folds]
    n_units = len(oos) if folds else len(series)
    last_train = folds[-1]["train"] if folds else []
    last_test = [folds[-1]["test"]] if folds else []
    dsr = None
    beats = None
    alpha, t_stat = mean_tstat(oos or series)
    if len(oos) >= 3 and spec.get("variants"):
        dsr_doc = dsr_from_series(oos, n_trials=max(2, len(spec["variants"])))
        dsr = dsr_doc.get("dsr")
        ci = percentile_ci(oos, seed=int(spec.get("seed") or 1), resamples=400)
        if ci["ci_low"] is not None:
            beats = ci["ci_low"] > 0
    measured = {
        "n_units": n_units,
        "dsr": dsr,
        "actual_first": snapshot.get("actual_first"),
        "alpha": alpha,
        "t_stat": t_stat,
        "grain_seconds": 3600 if spec.get("grain") in {"1H", "1h"} else 60,
        "bar_open_delta_s": 0.0,
        "train_ids": last_train,
        "test_ids": last_test,
        "sigma_h_present": bool((spec.get("risk") or {}).get("sigma_span")),
        "snapshot_sha256": snapshot.get("payload_sha256"),
        "avoided_loss_bps": None,
    }
    if beats is not None:
        measured["beats_baseline"] = beats
    if family == "event_earnings" and spec.get("event_kind") in {None, ""}:
        spec = {**spec, "event_kind": "none"}
    card = decide(spec, measured)
    card["snapshot_sha256"] = snapshot.get("payload_sha256")
    card["spec_sha256"] = spec.get("content_sha256")
    card["dsr"] = dsr
    return card
