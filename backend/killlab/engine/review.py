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


def reconcile_point(realized_bps: float, ci_low: float | None, ci_high: float | None) -> dict:
    if ci_low is None or ci_high is None:
        return {"status": "no_forecast"}
    inside = ci_low <= realized_bps <= ci_high
    return {"realized_bps": realized_bps, "ci_low": ci_low, "ci_high": ci_high, "inside_ci": inside}
