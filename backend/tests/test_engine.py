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
    assert card["label"] == "UNTESTABLE"
    assert card["mechanism"] == "ny_open_hour_vs_other_cash_hours"
    assert card["n_events"] == 0
    assert card["label"] != "ALIVE"
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


def test_session_units_are_cash_hours_not_every_bar():
    from datetime import datetime, timedelta
    from killlab.runner import execute
    start = datetime(2026, 6, 1, 9, 0, tzinfo=ET)
    rows = []
    price = 100.0
    day = start
    built = 0
    while built < 70:
        if day.weekday() < 5:
            for hour in range(9, 17):
                stamp = int(day.replace(hour=hour).timestamp() * 1000)
                price *= 1.0001
                rows.append([stamp, price, price, price, price])
            built += 1
        day += timedelta(days=1)
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
        "seed": 1,
        "risk": {},
    }
    card = execute(spec, {"rows": rows, "actual_first": "2026-06-01T13:00:00Z", "payload_sha256": "abc"})
    assert card["mechanism"] == "ny_open_hour_vs_other_cash_hours"
    assert card["n_events"] == 70
    assert card["n_events"] < len(rows)
    assert card["label"] == "KILLED"
    crowded = execute({**spec, "variants": [{"code": f"v{i}"} for i in range(10)]}, {"rows": rows, "payload_sha256": "abc"})
    assert crowded["selected_variant"] in {"continuation", "reversal"}
    assert crowded["label"] == "KILLED"
    missing = execute({**spec, "family": "carry_basis"}, {"rows": rows, "funding": []})
    assert missing["label"] == "UNTESTABLE"
    assert missing["n_events"] == 0
    prints = [{"fundingTime": str(1_700_000_000_000 + i * 8 * 60 * 60 * 1000), "fundingRate": "0.0001"} for i in range(30)]
    held = execute({**spec, "family": "carry_basis"}, {"funding": prints})
    assert held["mechanism"] == "funding_hold_versus_cash"
    assert held["n_events"] == 1
    assert held["label"] == "UNTESTABLE"
    no_cost = execute({**spec, "costs": {}}, {"rows": rows})
    assert no_cost["mechanism"] == "missing_cost"
    assert no_cost["label"] == "UNTESTABLE"
    killed_floor = decide(
        {
            "family": "carry_basis",
            "baselines": ["buy_and_hold"],
            "costs": {"perp_taker_bps": 6},
            "variants": [{}],
            "selection": {"split": "IS"},
            "claims_alpha": False,
            "event_kind": "none",
            "transforms": [],
            "risk": {},
        },
        {"n_units": 80, "dsr": 0.99, "alpha": 1, "t_stat": 3, "grain_seconds": 3600, "bar_open_delta_s": 0, "beats_baseline": True},
    )
    assert killed_floor["label"] == "UNTESTABLE"
    assert killed_floor["primary_trap"] == "WRONG_COST_BASELINE"


def test_mirror_variants_do_not_invent_pbo_and_a_real_edge_can_live():
    import numpy as np
    from killlab.engine.pbo import cscv_pbo
    from killlab.runner import execute
    mirror = np.column_stack([np.linspace(-1, 1, 32), np.linspace(1, -1, 32)])
    assert cscv_pbo(mirror, splits=8)["reason"] == "degenerate_mirror"
    from datetime import datetime, timedelta
    import random
    rng = random.Random(3)
    start = datetime(2026, 6, 1, 9, 0, tzinfo=ET)
    rows = []
    price = 100.0
    day = start
    built = 0
    while built < 80:
        if day.weekday() < 5:
            for hour in range(9, 17):
                price *= 1.004 if hour == 10 else 1 + rng.uniform(-0.00005, 0.00005)
                rows.append([int(day.replace(hour=hour).timestamp() * 1000), price, price, price, price])
            built += 1
        day += timedelta(days=1)
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
        "seed": 1,
        "risk": {},
    }
    planted = execute(spec, {"rows": rows, "payload_sha256": "plant"})
    assert planted["label"] == "ALIVE"
    assert planted["bar_straddle"] is True
    assert planted["pbo"] is None
    assert planted["pbo_reason"] == "degenerate_mirror"


def test_noise_and_a_short_weekend_sample_cannot_be_alive():
    import random
    from datetime import datetime, timedelta
    from killlab.runner import execute
    rng = random.Random(7)
    start = datetime(2026, 6, 1, 9, 0, tzinfo=ET)
    rows = []
    price = 100.0
    day = start
    built = 0
    while built < 80:
        if day.weekday() < 5:
            for hour in range(9, 17):
                price *= 1 + rng.uniform(-0.002, 0.002)
                rows.append([int(day.replace(hour=hour).timestamp() * 1000), price, price, price, price])
            built += 1
        day += timedelta(days=1)
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
        "seed": 7,
        "risk": {},
    }
    noisy = execute(spec, {"rows": rows, "payload_sha256": "noise"})
    assert noisy["label"] == "KILLED"
    weekend_rows = []
    cursor = datetime(2026, 7, 3, 20, 0, tzinfo=ET)
    px = 100.0
    for _ in range(3):
        for step in range(49):
            stamp = cursor + timedelta(hours=step)
            if step < 40:
                px *= 1.001
            weekend_rows.append([int(stamp.timestamp() * 1000), px, px, px, px])
        cursor += timedelta(days=7)
    short = execute(
        {**spec, "family": "execution_venue_time", "risk": {"sigma_span": "until_sunday_switch", "horizon_span": "until_sunday_switch", "alternatives": ["NOW", "WAIT"], "lambda_grid": [0.5]}},
        {"rows": weekend_rows, "payload_sha256": "wk"},
    )
    assert short["mechanism"] == "weekend_choice_same_exit"
    assert short["n_events"] == 3
    assert short["label"] == "UNTESTABLE"


def test_selection_cannot_see_the_future_and_overlapping_events_collapse():
    from killlab.engine.mechanisms import earnings_panel, walk_forward_selected
    panel = {
        "unit_ids": [str(i) for i in range(20)],
        "variants": {
            "quiet_then_spike": [1.0] * 10 + [100.0] * 10,
            "better_past": [5.0] * 10 + [-100.0] * 10,
        },
        "baseline": [0.0] * 20,
    }
    chosen = walk_forward_selected(panel, min_train=10)
    assert chosen["oos"][0] == -100.0
    assert chosen["test_ids"][0] not in chosen["train_ids"]
    events = [
        {"id": "a", "ts": 1_000, "impulse_bps": 10, "hold_bps": 5},
        {"id": "b", "ts": 1_000 + 60 * 60 * 1000, "impulse_bps": -10, "hold_bps": 8},
    ]
    collapsed = earnings_panel(events, {"venue": "bitget_perp", "costs": {"perp_taker_bps": 6}})
    assert collapsed["unit_ids"] == ["a"]


def test_compiler_drops_a_model_that_injects_a_metric():
    from killlab.ai.compile import LLMUnavailable, _extract_json, compile_text, normalize_draft
    injected = _extract_json('note {"family":"session_timing","sharpe":2}')
    with pytest.raises(ValueError):
        normalize_draft("Trade NVDA", injected)
    partial = _extract_json('{"family":"session_timing","costs":{"perp_taker_bps":0.01},"baseline":"buy_and_hold"}')
    owned = normalize_draft("Trade NVDA perp in the first hour", partial)
    assert owned["costs"]["perp_taker_bps"] == 6
    assert owned["instruments"] == ["NVDAUSDT"]
    assert owned["selection"]["split"] == "IS"
    os_environ = __import__("os").environ
    saved = {name: os_environ.pop(name, None) for name in ("LLM_API_KEY", "GROQ_API_KEY", "CEREBRAS_API_KEY", "SAMBANOVA_API_KEY", "TOGETHER_API_KEY", "OPENROUTER_API_KEY", "KIMI_API_KEY")}
    try:
        with pytest.raises(LLMUnavailable):
            compile_text("trade the open")
    finally:
        for name, value in saved.items():
            if value is not None:
                os_environ[name] = value


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
