"""Verdict order from the plan: unsupported, invalidate, short n, kill rules, else ALIVE."""

from __future__ import annotations

from killlab.engine.traps import FAMILY_MIN_UNITS, scan


def decide(spec: dict, measured: dict) -> dict:
    family = spec.get("family")
    findings = scan(spec, measured)
    n_units = int(measured.get("n_units") or 0)
    minimum = FAMILY_MIN_UNITS.get(family, 60)
    if family == "unsupported":
        return _card("UNTESTABLE", "family_unsupported", findings, measured)
    invalid = [f for f in findings if f["severity"] == "invalidate"]
    if invalid:
        return _card("UNTESTABLE", invalid[0]["code"], findings, measured)
    if n_units < minimum:
        return _card("UNTESTABLE", "insufficient_units", findings, measured)
    kills = [f for f in findings if f["severity"] == "kill"]
    if kills:
        return _card("KILLED", kills[0]["code"], findings, measured)
    if "beats_baseline" not in measured:
        return _card("UNTESTABLE", "baseline_not_computed", findings, measured)
    if not measured.get("beats_baseline"):
        return _card("KILLED", "baseline", findings, measured)
    return _card("ALIVE", None, findings, measured)


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
