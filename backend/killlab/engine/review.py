"""Post-trade review helpers. No order placement."""

from __future__ import annotations


def killed_decision(entries: list[dict]) -> bool:
    for entry in reversed(entries):
        if entry.get("stage") == "DECISION":
            return (entry.get("body") or {}).get("label") == "KILLED"
    return False


def realized_from_fills(fills: list[dict]) -> float | None:
    buy = next((item for item in fills if item.get("side") == "buy" and item.get("px")), None)
    sell = next((item for item in fills if item.get("side") == "sell" and item.get("px")), None)
    if buy is None or sell is None:
        return None
    buy_px = float(buy["px"])
    if buy_px == 0:
        return None
    return (float(sell["px"]) / buy_px - 1.0) * 1e4


def next_hypothesis(primary_trap: str | None) -> dict:
    """A next question. It does not store a hypothesis and it does not invent a metric."""
    prompts = {
        "insufficient_units": "Repeat this test after more independent events are on the Bitget tape.",
        "MULTIPLE_TESTING": "Pre-register fewer variants and run the same test again.",
        "BETA_AS_ALPHA": "Compare the strategy with buy-and-hold of the same names before calling it alpha.",
        "BAR_TIMING": "Rebuild the test with one-minute bars at the cash open and close.",
        "WRONG_HORIZON": "Measure risk over the full wait until the session switch, not one bar.",
        "LEAKAGE": "Refit every feature using only data from before the test window.",
        "VENUE_HISTORY": "Start the test at the first Bitget bar the API actually returns.",
        "EFFECT_ERASE": "Remove within-regime rescaling and rerun the contrast.",
        "WRONG_COST_BASELINE": "Include fees, funding, and the Earn USDT baseline.",
        "WAITING_RISK": "Score waiting with horizon volatility, not only the spread.",
        "baseline": "Show the excess over the frozen baseline with a confidence interval above zero.",
        "family_unsupported": "Rewrite the idea into session timing, earnings, carry, execution venue, or a dated regime with enough units.",
        "baseline_not_computed": "Wait until the sample can support a baseline comparison.",
    }
    return {
        "proposed_raw_text": prompts.get(primary_trap or "", "State the next kill rule before touching more data."),
        "stored": False,
    }


def evolution_state(card: dict, primary_trap: str | None, review: dict | None = None) -> dict:
    """The next test inherits the stored fingerprint. The frozen card is not edited."""
    proposal = next_hypothesis(primary_trap)
    proposal["fingerprint"] = card.get("fingerprint")
    proposal["prior_trials"] = card.get("prior_trials")
    proposal["related_trials"] = card.get("related_trials")
    proposal["next_prior_trials"] = int(card.get("prior_trials") or 0) + 1
    proposal["units_short"] = card.get("units_short")
    proposal["forward_armed"] = bool(card.get("forward_armed"))
    proposal["pagination_stop"] = card.get("pagination_stop")
    if card.get("forward_armed") and card.get("units_short"):
        proposal["proposed_raw_text"] = (
            f"Keep this frozen spec. It still needs {int(card['units_short'])} more independent units on the Bitget tape. Do not rewrite the claim."
        )
    if isinstance(review, dict) and review.get("object") == "unit" and "inside_predictive" in review:
        proposal["inside_predictive"] = bool(review.get("inside_predictive"))
        if review.get("inside_predictive") is False:
            proposal["proposed_raw_text"] = (
                "The pasted fill sat outside the one-trade range. Keep the frozen result. Ask whether the live trade is the same decision this test scored."
            )
    return proposal


def is_related_research(left: dict, right: dict) -> bool:
    """Same family and grain, and at least half the instrument set overlaps. Exact fingerprints are counted separately."""
    if research_fingerprint(left) == research_fingerprint(right):
        return False
    if left.get("family") != right.get("family") or left.get("grain") != right.get("grain"):
        return False
    a = {str(item) for item in (left.get("instruments") or [])}
    b = {str(item) for item in (right.get("instruments") or [])}
    if not a or not b:
        return False
    return len(a & b) / len(a | b) >= 0.5


def reconcile_point(realized_bps: float, ci_low: float | None, ci_high: float | None) -> dict:
    """Mean-interval helper kept for tests. A single fill must not use this as the forecast."""
    if ci_low is None or ci_high is None:
        return {"status": "no_forecast"}
    inside = ci_low <= realized_bps <= ci_high
    return {"realized_bps": realized_bps, "ci_low": ci_low, "ci_high": ci_high, "inside_ci": inside, "object": "mean"}


def reconcile_unit(realized_bps: float, low: float | None, high: float | None) -> dict:
    """Compare one fill with the predictive range of one decision unit, not the CI of the mean."""
    if low is None or high is None:
        return {"status": "no_forecast", "object": "unit"}
    return {
        "realized_bps": realized_bps,
        "unit_low": low,
        "unit_high": high,
        "inside_predictive": low <= realized_bps <= high,
        "object": "unit",
    }


def research_fingerprint(spec: dict) -> str:
    """Identity of the research, not the wording. Rewording does not reset it."""
    from killlab.hashutil import sha256_canonical

    codes = sorted(
        str(item.get("code"))
        for item in (spec.get("variants") or [])
        if isinstance(item, dict) and item.get("code")
    )
    body = {
        "family": spec.get("family"),
        "instruments": sorted(str(item) for item in (spec.get("instruments") or [])),
        "grain": spec.get("grain"),
        "variants": codes,
    }
    if spec.get("session_hour") in (15, "15"):
        body["session_hour"] = 15
    if spec.get("leader"):
        body["leader"] = str(spec["leader"])
    return sha256_canonical(body)


_POSTURES = {"conservative", "exploratory"}
_HORIZONS = {"session", "swing", "event"}
_VERDICT_FIELDS = ("label", "dsr", "pbo", "ci_low", "ci_high", "n_units", "n_trials", "mechanism")


def normalize_constitution(raw: dict | None) -> dict | None:
    """A research preference. It is not part of the research fingerprint."""
    if not isinstance(raw, dict):
        return None
    posture = raw.get("posture") if raw.get("posture") in _POSTURES else "conservative"
    horizon = raw.get("horizon") if raw.get("horizon") in _HORIZONS else "session"
    universe = str(raw.get("universe") or "the same instruments").strip()[:80] or "the same instruments"
    avoid = str(raw.get("avoid") or "a new family").strip()[:80] or "a new family"
    return {"posture": posture, "horizon": horizon, "universe": universe, "avoid": avoid}


def personalized_question(card: dict, constitution: dict | None) -> dict:
    """Next wording from the stored card and an optional constitution. The card is not edited."""
    from killlab.hashutil import sha256_canonical

    base = evolution_state(card, card.get("primary_trap")).get("proposed_raw_text")
    prefs = normalize_constitution(constitution)
    if prefs is None:
        text = base
    elif prefs["posture"] == "exploratory":
        text = (
            f"Keep the frozen result. The next test can look at a {prefs['horizon']} question on {prefs['universe']}. "
            "This result is not reopened."
        )
    else:
        text = (
            f"Keep the frozen result. The next test stays on {prefs['universe']} and does not add {prefs['avoid']}."
        )
    label = card.get("label") or "unset"
    trap = card.get("primary_trap") or "none"
    reasons = [
        f"This run is {label} with primary trap {trap}.",
        f"Recorded prior trials on this fingerprint: {int(card.get('prior_trials') or 0)}. Related trials: {int(card.get('related_trials') or 0)}.",
    ]
    if prefs is not None:
        reasons.append(f"Constitution posture is {prefs['posture']}; universe {prefs['universe']}.")
    elif card.get("units_short"):
        reasons.append(f"The frozen spec is still short by {int(card['units_short'])} units.")
    snapshot = None if prefs is None else {"preferences": prefs, "sha256": sha256_canonical(prefs)}
    return {"proposed_raw_text": text, "reasons": reasons[:3], "snapshot": snapshot, "stored": False}


def apply_next(card: dict, constitution: dict | None) -> dict:
    """Record the next question. Measured verdict fields stay on their previous values."""
    before = {key: card.get(key) for key in _VERDICT_FIELDS}
    proposal = personalized_question(card, constitution)
    card["next_question"] = proposal["proposed_raw_text"]
    card["next_reasons"] = proposal["reasons"]
    if proposal.get("snapshot"):
        card["constitution_snapshot"] = proposal["snapshot"]
    for key, value in before.items():
        card[key] = value
    return proposal
