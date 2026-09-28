from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from killlab.ai.boundary import enforce_kill_floor, filter_explanation, reject_forbidden
from killlab.config import strip_pgbouncer
from killlab.data.bitget import NotFrozen, require_frozen
from killlab.engine.dsr import dsr_prob, expected_max_sr
from killlab.engine.sessions import is_weekend_mm
from killlab.engine.traps import (
    trap_bar_timing,
    trap_beta_as_alpha,
    trap_effect_erase,
    trap_leakage,
    trap_multiple_testing,
    trap_venue_history,
    trap_waiting_risk,
    trap_wrong_cost_baseline,
    trap_wrong_horizon,
)
from killlab.engine.verdict import decide
from killlab.hashutil import sha256_canonical
from tests.fixtures.golden_dsr import GOLDEN_DSR

ET = ZoneInfo("America/New_York")


def test_percent_encoded_password_still_parses():
    from killlab.config import strip_pgbouncer, to_sqlalchemy_url
    encoded = to_sqlalchemy_url("postgresql://user:secret%40word@host:5432/db?pgbouncer=true")
    raw_at = to_sqlalchemy_url("postgresql://user:secret@word@host:6543/postgres?pgbouncer=true")
    assert encoded.password == "secret@word"
    assert raw_at.password == "secret@word"
    assert raw_at.host == "host"
    assert "pgbouncer" not in strip_pgbouncer("postgresql://user:secret@host:6543/postgres?pgbouncer=true")


def test_walkforward_does_not_leak_and_bootstrap_is_seeded():
    from killlab.engine.bootstrap import percentile_ci
    from killlab.engine.walkforward import expanding_folds
    folds = expanding_folds(["a", "b", "c", "d"], min_train=2)
    assert folds[0]["test"] not in folds[0]["train"]
    assert len(folds) == 2
    first = percentile_ci([1, 2, 3, 4], seed=1, resamples=200)
    second = percentile_ci([1, 2, 3, 4], seed=1, resamples=200)
    assert first["ci_low"] == second["ci_low"]
    assert first["ci_low"] < first["point"] < first["ci_high"]
    a = sha256_canonical({"b": 1, "a": 2})
    b = sha256_canonical({"a": 2, "b": 1})
    assert a == b
    assert sha256_canonical({"a": 3, "b": 1}) != a


def test_golden_dsr_matches_forensic_fixture():
    sr0 = expected_max_sr(GOLDEN_DSR["n_trials"], GOLDEN_DSR["var_sr"])
    assert abs(sr0 - GOLDEN_DSR["sr0"]) < 1e-9
    out = dsr_prob(GOLDEN_DSR["sr_hat"], sr0, GOLDEN_DSR["n"], GOLDEN_DSR["skew"], GOLDEN_DSR["kurt_pearson"])
    assert abs(out["dsr"] - GOLDEN_DSR["dsr"]) < 0.02
    assert out["dsr"] < 0.95


def test_dst_weekend_window():
    winter = datetime(2026, 1, 16, 20, 0, tzinfo=ET)
    summer = datetime(2026, 7, 17, 20, 0, tzinfo=ET)
    assert is_weekend_mm(winter) is True
    assert is_weekend_mm(summer) is True
    assert is_weekend_mm(datetime(2026, 7, 16, 15, 0, tzinfo=ET)) is False


def test_traps_positive_and_negative():
    assert trap_multiple_testing({"selection": {"split": "oos"}, "variants": [{}]}, 0.99)
    assert trap_multiple_testing({"selection": {"split": "IS"}, "variants": [{}]}, 0.4)
    assert not trap_multiple_testing({"selection": {"split": "IS"}, "variants": [{}]}, 0.99)
    assert trap_beta_as_alpha(True, 0.01, 1.63)
    assert not trap_beta_as_alpha(True, 0.2, 2.5)
    assert trap_bar_timing(3600, "cash_close", 0)
    assert not trap_bar_timing(60, "cash_close", 10)
    assert trap_wrong_horizon("bar", "until_sunday_switch")
    assert not trap_wrong_horizon("until_sunday_switch", "until_sunday_switch")
    assert trap_leakage({"a"}, {"a", "b"})
    assert not trap_leakage({"a"}, {"b"})
    assert trap_venue_history("2026-02-07", "2026-09-09", "2026-02-07")
    assert not trap_venue_history("2026-09-10", "2026-09-09", "2026-09-10")
    assert trap_effect_erase(["median_ratio_within_regime"])
    assert not trap_effect_erase(["log_return"])
    assert trap_wrong_cost_baseline("carry_basis", ["buy_and_hold"], True, 0.01, 0.02)
    assert not trap_wrong_cost_baseline("session_timing", ["buy_and_hold"], True, None, None)
    assert trap_waiting_risk("execution_venue_time", ["WAIT"], False, [])
    assert not trap_waiting_risk("event_earnings", [], False, [])


def test_execute_uses_walkforward_dsr_not_a_hardcoded_verdict():
    from killlab.runner import execute
    import random
    rng = random.Random(1)
    price = 100.0
    rows = []
    for i in range(80):
        price *= 1 + rng.uniform(-0.01, 0.01)
        rows.append([i, price, price, price, price])
    spec = {
        "family": "session_timing",
        "variants": [{"code": "a"}, {"code": "b"}],
        "selection": {"split": "IS"},
        "costs": {"perp_taker_bps": 6},
        "baseline_codes": ["buy_and_hold"],
        "transforms": [],
        "claims_alpha": True,
        "event_kind": "none",
        "grain": "1H",
        "seed": 1,
        "risk": {},
    }
    card = execute(spec, {"rows": rows, "actual_first": "2026-09-01T00:00:00Z", "payload_sha256": "abc"})
    assert card["engine_computed"] is True
    assert card["label"] in {"KILLED", "UNTESTABLE"}
    assert card["label"] != "ALIVE"
    assert "pbo" in card
    empty = execute({**spec, "family": "event_earnings"}, {"rows": rows, "events": []})
    assert empty["label"] == "UNTESTABLE"
    assert empty["n_units"]["n"] < 100
    spec = {
        "family": "event_earnings",
        "variants": [{"code": "a"}],
        "selection": {"split": "IS"},
        "costs": {"perp_taker_bps": 6},
        "baseline_codes": ["buy_and_hold"],
        "transforms": [],
        "claims_alpha": False,
        "event_kind": "none",
        "grain": "1H",
    }
    card = decide(spec, {"n_units": 7, "dsr": 0.99, "alpha": 1, "t_stat": 5, "grain_seconds": 60, "bar_open_delta_s": 0, "beats_baseline": True})
    assert card["label"] == "UNTESTABLE"
    assert card["engine_computed"] is True


def test_llm_schema_rejects_metrics_and_oos():
    draft = _draft()
    draft["sharpe"] = 3
    with pytest.raises(ValueError):
        reject_forbidden(draft)
    bad = _draft()
    bad["selection"] = {"split": "oos"}
    with pytest.raises(ValueError):
        enforce_kill_floor(bad)


def test_next_hypothesis_is_not_stored_and_has_no_metric():
    from killlab.engine.review import next_hypothesis
    proposal = next_hypothesis("insufficient_units")
    assert proposal["stored"] is False
    assert "bps" not in proposal["proposed_raw_text"].lower()
    assert "sharpe" not in proposal["proposed_raw_text"].lower()
    from killlab.recover import interrupted_if_stale
    assert interrupted_if_stale(15, 15) is True
    assert interrupted_if_stale(14.9, 15) is False
    from killlab.ratelimit import allow, client_key
    assert client_key("/v1/runs", "Bearer a") != client_key("/v1/runs", "Bearer b")
    bucket: list[float] = []
    assert allow(bucket, 100, 3600, 2) is True
    assert allow(bucket, 101, 3600, 2) is True
    assert allow(bucket, 102, 3600, 2) is False
    assert allow(bucket, 100 + 3601, 3600, 2) is True
    from killlab.guard import fixtures_loaded
    assert fixtures_loaded(["tests.fixtures.golden_dsr"]) is True
    assert fixtures_loaded(["killlab.api", "killlab.runner"]) is False
    from killlab.logjson import log_event
    line = log_event("request", path="/health", note="postgresql://user:secret@host/db")
    assert "postgresql://" not in line
    assert "[redacted]" in line
    cleaned = filter_explanation("the dsr was 9.99 and n was 7", {"n_units": {"n": 7}})
    assert "9.99" not in cleaned
    assert "7" in cleaned


def test_each_listed_symbol_gets_its_own_events():
    from killlab.data.earnings import symbol_for, tag_events
    assert symbol_for("NVDA", "bitget_perp") == "NVDAUSDT"
    assert symbol_for("NVDA", "bitget_rtoken") == "RNVDAUSDT"
    assert symbol_for("RNVDAUSDT", "bitget_rtoken") == "RNVDAUSDT"
    tagged = tag_events([{"id": "1", "return_bps": 5}], "NVDAUSDT")
    other = tag_events([{"id": "1", "return_bps": 7}], "TSLAUSDT")
    assert tagged[0]["id"] != other[0]["id"]
    from killlab.data.earnings import align_events
    rows = [[1_000 * i, 1, 1, 1, 100 + i] for i in range(20)]
    events = align_events(rows, [5_000], horizon_bars=2)
    assert len(events) == 1
    assert events[0]["return_bps"] != 0
    assert align_events(rows, [10_000_000]) == []
    from killlab.engine.review import killed_decision, reconcile_point
    entries = [{"stage": "DECISION", "body": {"label": "KILLED"}}]
    assert killed_decision(entries) is True
    assert killed_decision([{"stage": "DECISION", "body": {"label": "UNTESTABLE"}}]) is False
    inside = reconcile_point(1.0, -2.0, 2.0)
    outside = reconcile_point(5.0, -2.0, 2.0)
    assert inside["inside_ci"] is True
    assert outside["inside_ci"] is False
    assert reconcile_point(1.0, None, None)["status"] == "no_forecast"
    from killlab.engine.review import realized_from_fills
    got = realized_from_fills([{"side": "buy", "px": 100}, {"side": "sell", "px": 110}])
    assert got is not None and abs(got - 1000) < 1e-6
    assert realized_from_fills([{"side": "buy", "px": 100}]) is None
    with pytest.raises(NotFrozen):
        require_frozen(False)


def test_pbo_on_a_labeled_fixture_matrix():
    from killlab.engine.pbo import cscv_pbo
    import numpy as np
    rng = np.random.default_rng(1)
    matrix = rng.normal(size=(32, 3))
    out = cscv_pbo(matrix, splits=8)
    assert out["pbo"] is not None
    assert 0 <= out["pbo"] <= 1
    from pathlib import Path
    root = Path(__file__).resolve().parents[1] / "killlab"
    text = "\n".join(p.read_text(encoding="utf-8") for p in root.rglob("*.py"))
    for banned in ("def place_order", "transfer_funds", "withdraw", "def cancel_order"):
        assert banned not in text


def _draft():
    return {
        "family": "event_earnings",
        "instruments": ["NVDAUSDT"],
        "venue": "bitget_perp",
        "test_start": "2026-09-01",
        "test_end": "2026-09-28",
        "grain": "1H",
        "costs": {"perp_taker_bps": 6},
        "baselines": ["buy_and_hold"],
        "variants": [{"code": "continuation"}],
        "selection": {"split": "IS"},
        "target_metric": "oos_mean_bps",
        "notional_usd": 10000,
        "seed": 20260928,
        "transforms": [],
        "risk": {},
        "claims_alpha": False,
    }
