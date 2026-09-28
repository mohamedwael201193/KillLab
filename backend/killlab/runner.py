"""Deterministic run. Numbers come only from the mechanism panel of the snapshot."""

from __future__ import annotations

from killlab.engine.beta import mean_tstat
from killlab.engine.bootstrap import percentile_ci
from killlab.engine.dsr import dsr_from_series
from killlab.engine.mechanisms import build_panel, walk_forward_selected
from killlab.engine.pbo import cscv_pbo
from killlab.engine.verdict import decide


def execute(spec: dict, snapshot: dict) -> dict:
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
    if len(oos) >= 3 and variants:
        dsr_doc = dsr_from_series(oos, n_trials=max(1, len(variants)))
        dsr = dsr_doc.get("dsr")
        ci = percentile_ci(selected["excess"] or oos, seed=int(spec.get("seed") or 1), resamples=400)
        if ci["ci_low"] is not None:
            beats = ci["ci_low"] > 0
    pbo = None
    if len(oos) >= 16 and len(variants) >= 2:
        import numpy as np

        width = len(panel["unit_ids"])
        columns = [panel["variants"][name][:width] for name in variants]
        if all(len(column) == width and width >= 16 for column in columns):
            pbo = cscv_pbo(np.column_stack(columns), splits=8).get("pbo")
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
    card["n_events"] = n_events
    card["mechanism"] = panel["mechanism"]
    card["selected_variant"] = selected["selected"]
    return card
