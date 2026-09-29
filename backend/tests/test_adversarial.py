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
