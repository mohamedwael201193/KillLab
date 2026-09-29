"""Four verdicts. A straddling interval is not a kill, and a short sample is not a kill."""

from __future__ import annotations

from killlab.engine.traps import FAMILY_MIN_UNITS, KILL_FLOOR, scan


def decide(spec: dict, measured: dict) -> dict:
    family = spec.get("family")
    findings = scan(spec, measured)
    n_units = int(measured.get("n_units") or 0)
    minimum = FAMILY_MIN_UNITS.get(family, 60)
    if family not in FAMILY_MIN_UNITS or family == "unsupported":
        return _card("UNTESTABLE", "family_unsupported", findings, measured)
    invalid = [f for f in findings if f["severity"] == "invalidate"]
    if invalid:
        return _card("UNTESTABLE", invalid[0]["code"], findings, measured)
    if n_units < minimum:
        return _card("UNTESTABLE", "insufficient_units", findings, measured)
    kills = [f for f in findings if f["severity"] == "kill"]
    if kills:
        return _card("KILLED", kills[0]["code"], findings, measured)
    low = measured.get("ci_low")
    high = measured.get("ci_high")
    if low is None or high is None:
        return _card("INCONCLUSIVE", "baseline_not_computed", findings, measured)
    if high < 0:
        return _card("KILLED", "contradicted", findings, measured)
    held = any(item["severity"] == "hold" for item in findings)
    dsr = measured.get("dsr")
    dsr_ok = dsr is not None and dsr == dsr and dsr >= KILL_FLOOR["dsr_gte"]
    if low > 0 and dsr_ok and not held:
        return _card("ALIVE", None, findings, measured)
    return _card("INCONCLUSIVE", "underpowered", findings, measured)


def _card(label: str, primary: str | None, findings: list, measured: dict) -> dict:
    return {
        "label": label,
        "primary_trap": primary,
        "findings": findings,
        "n_units": n_units_view(measured),
        "dsr": measured.get("dsr"),
        "actual_first": measured.get("actual_first"),
        "avoided_loss_bps": measured.get("avoided_loss_bps"),
        "engine_computed": True,
    }


def n_units_view(measured: dict) -> dict:
    return {"n": int(measured.get("n_units") or 0)}
