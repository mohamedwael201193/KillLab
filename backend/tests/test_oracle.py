"""Independent checks and a planted-edge curve. Not a second copy of the engine tests."""

from __future__ import annotations

import json
import random
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
from zoneinfo import ZoneInfo

from killlab.engine.bootstrap import percentile_ci
from killlab.engine.dsr import dsr_prob
from killlab.models import ENGINE_VERSION
from killlab.runner import execute
from tests.fixtures.golden_dsr import GOLDEN_DSR
from tests.oracle_reference import reference_dsr

ET = ZoneInfo("America/New_York")
REPORT = Path(__file__).resolve().parents[2] / "docs" / "calibration" / "verdict_curve.json"


def _session_rows(edge_bps: float, seed: int, days: int = 80) -> list:
    rng = random.Random(seed)
    price = 100.0
    rows = []
    day = datetime(2026, 6, 1, 9, 0, tzinfo=ET)
    built = 0
    while built < days:
        if day.weekday() < 5:
            for hour in range(9, 17):
                shock = edge_bps / 1e4 if hour == 10 else rng.uniform(-0.00005, 0.00005)
                price *= 1.0 + shock
                rows.append([int(day.replace(hour=hour).timestamp() * 1000), price, price, price, price])
            built += 1
        day += timedelta(days=1)
    return rows


def _run(edge_bps: float, seed: int) -> str:
    spec = {
        "family": "session_timing",
        "venue": "bitget_perp",
        "variants": [{"code": "continuation"}, {"code": "reversal"}],
        "selection": {"split": "IS"},
        "costs": {"perp_taker_bps": 6},
        "baselines": ["buy_and_hold"],
        "transforms": [],
        "claims_alpha": False,
        "event_kind": "none",
        "grain": "1H",
        "seed": seed,
        "risk": {},
    }
    return execute(spec, {"rows": _session_rows(edge_bps, seed), "payload_sha256": "cal"})["label"]


def test_reference_dsr_matches_the_engine_on_the_forensic_golden():
    got = reference_dsr(
        GOLDEN_DSR["sr_hat"],
        GOLDEN_DSR["sr0"],
        GOLDEN_DSR["n"],
        GOLDEN_DSR["skew"],
        GOLDEN_DSR["kurt_pearson"],
    )
    engine = dsr_prob(
        GOLDEN_DSR["sr_hat"],
        GOLDEN_DSR["sr0"],
        GOLDEN_DSR["n"],
        GOLDEN_DSR["skew"],
        GOLDEN_DSR["kurt_pearson"],
    )["dsr"]
    assert abs(got - GOLDEN_DSR["dsr"]) < 1e-9
    assert abs(got - engine) < 1e-12


def test_bootstrap_interval_covers_a_known_normal_mean():
    covers = 0
    trials = 80
    for seed in range(trials):
        sample = np.random.default_rng(seed).normal(0.5, 1.0, size=40)
        interval = percentile_ci(sample.tolist(), seed=seed, resamples=200)
        if interval["ci_low"] <= 0.5 <= interval["ci_high"]:
            covers += 1
    assert 0.75 <= covers / trials <= 0.99


def test_calibration_curve_rejects_a_null_and_accepts_a_large_planted_edge():
    curve = {str(edge): _run(edge, 11) for edge in (0, 5, 20, 40)}
    nulls = [_run(0, seed) for seed in range(11, 16)]
    strong = [_run(40, seed) for seed in range(11, 16)]
    assert curve["0"] != "ALIVE"
    assert curve["5"] != "ALIVE"
    assert curve["40"] == "ALIVE"
    assert all(label != "ALIVE" for label in nulls)
    assert all(label == "ALIVE" for label in strong)
    report = {
        "engine_version": ENGINE_VERSION,
        "protocol": "session_timing",
        "seed": 11,
        "seeds_for_rates": [11, 12, 13, 14, 15],
        "days": 80,
        "round_trip_bps": 12,
        "labels_by_open_hour_edge_bps": curve,
        "false_alive_on_zero_edge": any(label == "ALIVE" for label in nulls),
        "false_kill_on_40bps": any(label == "KILLED" for label in strong),
        "null_labels": nulls,
        "strong_labels": strong,
        "note": "Gross open-hour edge. A 12 bps round trip is charged on the excess over other cash hours.",
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    saved = json.loads(REPORT.read_text(encoding="utf-8"))
    assert saved["labels_by_open_hour_edge_bps"]["40"] == "ALIVE"
    assert saved["false_alive_on_zero_edge"] is False
