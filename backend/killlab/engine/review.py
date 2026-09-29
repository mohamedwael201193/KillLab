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
        "family_unsupported": "Rewrite the idea into session timing, earnings, carry, or execution venue.",
        "baseline_not_computed": "Wait until the sample can support a baseline comparison.",
    }
    return {
        "proposed_raw_text": prompts.get(primary_trap or "", "State the next kill rule before touching more data."),
        "stored": False,
    }


def evolution_state(card: dict, primary_trap: str | None) -> dict:
    """The next test inherits the stored fingerprint. The frozen card is not edited."""
    proposal = next_hypothesis(primary_trap)
    proposal["fingerprint"] = card.get("fingerprint")
    proposal["prior_trials"] = card.get("prior_trials")
    proposal["next_prior_trials"] = int(card.get("prior_trials") or 0) + 1
    return proposal


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
    return sha256_canonical(
        {
            "family": spec.get("family"),
            "instruments": sorted(str(item) for item in (spec.get("instruments") or [])),
            "grain": spec.get("grain"),
            "variants": codes,
        }
    )
