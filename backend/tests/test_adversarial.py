"""Cases that must not be approved, plus one effect that must be allowed to live."""

from killlab.engine.review import evolution_state
from killlab.engine.verdict import decide
from killlab.runner import execute


def _measured(**extra):
    base = {
        "n_units": 80,
        "dsr": 0.99,
        "alpha": 1.0,
        "t_stat": 4.0,
        "grain_seconds": 3600,
        "bar_open_delta_s": 0.0,
        "ci_low": 1.0,
        "ci_high": 2.0,
        "actual_first": "2026-07-01T00:00:00Z",
    }
    base.update(extra)
    return base


def _spec(**extra):
    base = {
        "family": "session_timing",
        "variants": [{"code": "continuation"}, {"code": "reversal"}],
        "selection": {"split": "IS"},
        "costs": {"perp_taker_bps": 6},
        "baselines": ["buy_and_hold"],
        "transforms": [],
        "claims_alpha": False,
        "event_kind": "none",
        "grain": "1H",
        "instruments": ["NVDAUSDT"],
        "venue": "bitget_perp",
        "risk": {},
    }
    base.update(extra)
    return base


def test_weekend_baseline_is_cash_not_the_selected_action_itself():
    from datetime import datetime, timedelta
    from zoneinfo import ZoneInfo
    from killlab.engine.mechanisms import execution_panel
    et = ZoneInfo("America/New_York")
    start = datetime(2026, 7, 3, 20, 0, tzinfo=et)
    price = 100.0
    rows = []
    for step in range(49):
        price *= 1.01 if step < 20 else 1.0
        stamp = start + timedelta(hours=step)
        rows.append([int(stamp.timestamp() * 1000), price, price, price, price])
    panel = execution_panel(rows, {"venue": "bitget_perp", "costs": {"perp_taker_bps": 6}})
    assert panel["unit_ids"]
    assert panel["baseline"] == [0.0] * len(panel["unit_ids"])
    assert panel["variants"]["NOW"][0] != 0.0


def test_bad_evidence_cannot_be_approved_and_a_repeat_changes_the_next_trial_count():
    assert decide(_spec(claims_alpha=True), _measured(alpha=-1, t_stat=0.2))["label"] == "KILLED"
    assert decide(_spec(), _measured(n_units=3))["label"] == "UNTESTABLE"
    assert decide(_spec(family="carry_basis", baselines=["buy_and_hold"]), _measured())["label"] == "UNTESTABLE"
    assert decide(_spec(claimed_start="2020-01-01"), _measured())["label"] == "KILLED"
    assert execute(_spec(costs={}), {"rows": []})["label"] == "UNTESTABLE"
    first = execute(_spec(), {"rows": [], "events": []}, prior_trials=0)
    second = execute(_spec(), {"rows": [], "events": []}, prior_trials=1)
    assert first["n_trials"] == 2
    assert second["n_trials"] == 3
    card = {"fingerprint": "abc", "prior_trials": 1, "label": "KILLED"}
    frozen = dict(card)
    proposal = evolution_state(card, "insufficient_units")
    assert card == frozen
    assert proposal["fingerprint"] == "abc"
    assert proposal["next_prior_trials"] == 2
    assert proposal["stored"] is False


def test_related_research_counts_and_a_page_cap_is_not_a_venue_floor():
    from killlab.engine.review import is_related_research
    left = _spec()
    right = _spec(instruments=["NVDAUSDT", "AAPLUSDT"])
    assert is_related_research(left, right) is True
    assert is_related_research(left, _spec()) is False
    capped = execute(left, {"rows": [], "pagination_stop": "page_cap", "pages_requested": 8, "actual_first": "2026-07-24T02:00:00Z"}, related_trials=1)
    assert capped["related_trials"] == 1
    assert capped["n_trials"] == 3
    assert capped["venue_floor"] is False
    assert capped["requested_start"] is None
    floored = execute(left, {"rows": [], "pagination_stop": "short_page"})
    assert floored["venue_floor"] is True


def test_forward_armed_changes_the_next_question_without_editing_the_card():
    card = {"fingerprint": "abc", "prior_trials": 0, "label": "UNTESTABLE", "units_short": 22, "forward_armed": True}
    frozen = dict(card)
    proposal = evolution_state(card, "insufficient_units")
    assert card == frozen
    assert proposal["stored"] is False
    assert "22" in proposal["proposed_raw_text"]
    assert "Do not rewrite" in proposal["proposed_raw_text"]


def test_basis_fade_is_one_day_and_a_stale_gap_is_not_a_trial():
    from datetime import datetime, timedelta, timezone
    from killlab.ai.compile import normalize_draft
    from killlab.engine.mechanisms import basis_panel
    start = datetime(2026, 7, 1, tzinfo=timezone.utc)
    perp_rows = []
    spot_rows = []
    price = 100.0
    for hour in range(24 * 70):
        stamp = start + timedelta(hours=hour)
        if hour > 0 and hour % 24 == 0:
            price *= 0.99
        perp_rows.append([int(stamp.timestamp() * 1000), price * 1.02, price * 1.02, price * 1.02, price * 1.02])
        spot_rows.append([int(stamp.timestamp() * 1000), price, price, price, price])
    spec = {"venue": "bitget_perp", "costs": {"perp_taker_bps": 6}, "family": "basis_convergence"}
    panel = basis_panel(perp_rows, spot_rows, spec)
    assert panel["mechanism"] == "daily_basis_fade_versus_cash"
    assert len(panel["unit_ids"]) == 69
    assert len(panel["unit_ids"]) < len(perp_rows)
    assert panel["baseline"] == [0.0] * len(panel["unit_ids"])
    stale = basis_panel(perp_rows[:24], spot_rows[48:72], spec)
    assert stale["unit_ids"] == []
    draft = normalize_draft("NVDA perp versus rNVDA basis converges", {"family": "carry_basis"})
    assert draft["family"] == "basis_convergence"
    assert draft["variants"] == [{"code": "fade"}]
    funding = normalize_draft("receive NVDA funding carry", {"family": "basis_convergence"})
    assert funding["family"] == "carry_basis"


def test_event_stamps_outside_the_tape_are_not_trials():
    from killlab.data.earnings import classify_event_times
    rows = [[1_000, 1, 1, 1, 1], [2_000, 1, 1, 1, 1], [3_000, 1, 1, 1, 1]]
    counted = classify_event_times(rows, [100, 1_000, 9_000], horizon_bars=1)
    assert counted["outside"] == 2
    assert counted["aligned"] == 1
    assert counted["short_horizon"] == 0
