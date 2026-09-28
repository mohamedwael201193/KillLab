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


def test_short_sample_is_untestable_not_alive():
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


def test_explanation_drops_hallucinated_number():
    cleaned = filter_explanation("the dsr was 9.99 and n was 7", {"n_units": {"n": 7}})
    assert "9.99" not in cleaned
    assert "7" in cleaned


def test_data_client_refuses_unfrozen_pull():
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
