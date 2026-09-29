"""Receipt, thesis isolation, review isolation, forward book gate, four-state copy."""

from pathlib import Path

from killlab.ai.boundary import filter_explanation
from killlab.engine.review import evolution_state, research_fingerprint
from killlab.runner import execute


def _usable_book():
    return {
        "provenance": "forward_recorded",
        "historical": False,
        "bid_depth": 2.0,
        "ask_depth": 3.0,
        "spread_bps": 4.0,
        "payload_sha256": "abc",
    }


def _execution_spec():
    return {
        "family": "execution_venue_time",
        "venue": "bitget_perp",
        "variants": [{"code": "NOW"}, {"code": "WAIT"}],
        "selection": {"split": "IS"},
        "costs": {"perp_taker_bps": 6},
        "baselines": ["buy_and_hold"],
        "transforms": [],
        "claims_alpha": False,
        "event_kind": "none",
        "grain": "1H",
        "risk": {
            "sigma_span": "until_sunday_switch",
            "horizon_span": "until_sunday_switch",
            "alternatives": ["NOW", "WAIT"],
            "lambda_grid": [0.5],
            "book_max_spread_bps": 50,
        },
    }


def test_landing_names_four_verdicts_and_not_three():
    root = Path(__file__).resolve().parents[2] / "FRONTEND" / "src" / "components" / "landing"
    text = "\n".join((root / name).read_text(encoding="utf-8") for name in ("verdicts.tsx", "protocol.tsx", "evidence.tsx"))
    for label in ("KILLED", "ALIVE", "INCONCLUSIVE", "UNTESTABLE"):
        assert label in text
    assert "exactly one of three" not in text
    assert "which of three worlds" not in text


def test_a_thesis_sentence_does_not_change_the_measured_result():
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
        "instruments": ["NVDAUSDT"],
        "risk": {},
    }
    left = execute(spec, {"rows": []})
    right = execute({**spec, "thesis": "I think the open is special"}, {"rows": []})
    assert left["label"] == right["label"]
    assert left["n_trials"] == right["n_trials"]
    assert left["dsr"] == right["dsr"]
    assert left["pbo"] == right["pbo"]
    assert "thesis" not in left
    assert research_fingerprint(spec) == research_fingerprint({**spec, "thesis": "different words"})


def test_a_review_changes_the_next_question_and_not_the_card():
    card = {"fingerprint": "abc", "prior_trials": 1, "label": "INCONCLUSIVE", "result_json": {"label": "INCONCLUSIVE"}}
    frozen = dict(card)
    proposal = evolution_state(card, "underpowered", {"object": "unit", "inside_predictive": False})
    assert card == frozen
    assert proposal["inside_predictive"] is False
    assert "outside the one-trade range" in proposal["proposed_raw_text"]
    assert "sharpe" not in proposal["proposed_raw_text"].lower()


def test_forward_book_can_stop_an_execution_claim_and_cannot_pretend_to_be_history():
    spec = _execution_spec()
    missing = execute(spec, {"rows": []})
    assert missing["label"] == "UNTESTABLE"
    assert missing["primary_trap"] == "book_unusable"
    empty = execute(spec, {"rows": [], "book_capture": {**_usable_book(), "bid_depth": 0}})
    assert empty["primary_trap"] == "book_unusable"
    wide = execute(spec, {"rows": [], "book_capture": {**_usable_book(), "spread_bps": 80}})
    assert wide["primary_trap"] == "book_unusable"
    claimed = execute(spec, {"rows": [], "book_capture": {**_usable_book(), "historical": True}})
    assert claimed["primary_trap"] == "book_unusable"
    held = execute(spec, {"rows": [], "book_capture": _usable_book()})
    assert held["primary_trap"] != "book_unusable"
    assert held["book_capture"]["historical"] is False


def test_qwen_text_cannot_invent_a_book_a_sample_or_a_verdict_number():
    facts = {"label": "UNTESTABLE", "n_units": {"n": 8}, "historical": False}
    text = filter_explanation(
        "Verdict ALIVE with sharpe 3.2, n=600, and a historical book from 2024.",
        facts,
    )
    assert "3.2" not in text
    assert "600" not in text
    assert "2024" not in text
    assert "ALIVE" not in text
    assert "[redacted]" in text
