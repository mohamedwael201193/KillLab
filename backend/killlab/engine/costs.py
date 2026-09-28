"""Versioned cost schedule. Promo spot 5 bps is not treated as permanent."""

from __future__ import annotations

COST_SCHEDULE = {
    "spot_taker_bps": 5.0,
    "spot_taker_bps_sensitivity": 10.0,
    "perp_taker_bps": 6.0,
    "perp_maker_bps": 2.0,
    "source": "01-FORENSICS.md ROUND 3-4 promo. Re-verify before claiming the rate is current.",
    "effective_from": "2026-09-01",
}


def round_trip_bps(venue: str, role: str = "taker", sensitivity: bool = False) -> float:
    if venue == "bitget_rtoken":
        one = COST_SCHEDULE["spot_taker_bps_sensitivity"] if sensitivity else COST_SCHEDULE["spot_taker_bps"]
        return one * 2
    if venue == "bitget_perp":
        one = COST_SCHEDULE["perp_maker_bps"] if role == "maker" else COST_SCHEDULE["perp_taker_bps"]
        return one * 2
    raise ValueError(f"unknown venue {venue}")
