"""Nine independent trap detectors. Each returns zero or more findings."""

from __future__ import annotations

FAMILY_MIN_UNITS = {
    "session_timing": 60,
    "event_earnings": 100,
    "carry_basis": 60,
    "execution_venue_time": 8,
    "unsupported": 10**9,
}

KILL_FLOOR = {
    "oos_mean_bps_gt": 0.0,
    "oos_sharpe_gte": 1.0,
    "oos_over_is_gte": 0.5,
    "dsr_gte": 0.95,
    "selection_split": "IS",
}


def _finding(code: str, severity: str, detail: dict) -> dict:
    return {"code": code, "severity": severity, "detail": detail}


def trap_multiple_testing(spec: dict, dsr: float | None) -> list[dict]:
    out = []
    selection = spec.get("selection") or {}
    if selection.get("split") != "IS":
        out.append(_finding("MULTIPLE_TESTING", "kill", {"reason": "selection_not_is"}))
    n = len(spec.get("variants") or [])
    if n < 1:
        out.append(_finding("MULTIPLE_TESTING", "invalidate", {"reason": "no_variants"}))
    if dsr is not None and dsr == dsr and dsr < KILL_FLOOR["dsr_gte"]:
        out.append(_finding("MULTIPLE_TESTING", "hold", {"dsr": dsr, "bar": KILL_FLOOR["dsr_gte"], "n_trials": n}))
    return out


def trap_beta_as_alpha(claims_alpha: bool, alpha: float, t_stat: float) -> list[dict]:
    if claims_alpha and (alpha <= 0 or t_stat < 2):
        return [_finding("BETA_AS_ALPHA", "kill", {"alpha": alpha, "t": t_stat})]
    return []


def trap_bar_timing(grain_seconds: int, event_kind: str, bar_open_delta_s: float) -> list[dict]:
    clock_events = {"cash_open", "cash_close", "ah_1900"}
    if event_kind in clock_events and grain_seconds > 60:
        return [_finding("BAR_TIMING", "invalidate", {"grain_seconds": grain_seconds, "event": event_kind})]
    if event_kind in clock_events and abs(bar_open_delta_s) > 60:
        return [_finding("BAR_TIMING", "invalidate", {"delta_s": bar_open_delta_s})]
    return []


def trap_wrong_horizon(sigma_span: str, horizon_span: str) -> list[dict]:
    if sigma_span != horizon_span:
        return [_finding("WRONG_HORIZON", "kill", {"sigma_span": sigma_span, "horizon_span": horizon_span})]
    return []


def trap_leakage(train_ids: set, test_ids: set) -> list[dict]:
    overlap = train_ids & test_ids
    if overlap:
        return [_finding("LEAKAGE", "invalidate", {"n_overlap": len(overlap)})]
    return []


def trap_venue_history(requested_start: str, actual_first: str, claimed_start: str | None) -> list[dict]:
    if claimed_start and actual_first and claimed_start < actual_first:
        return [_finding("VENUE_HISTORY", "kill", {"claimed_start": claimed_start, "actual_first": actual_first, "requested_start": requested_start})]
    return []


def trap_effect_erase(transforms: list) -> list[dict]:
    banned = {"median_ratio_within_regime", "rescale_by_partition_median"}
    hit = [t for t in transforms if t in banned]
    if hit:
        return [_finding("EFFECT_ERASE", "invalidate", {"transforms": hit})]
    return []


def trap_wrong_cost_baseline(family: str, baselines: list[str], has_cost_model: bool, net_apr: float | None, baseline_apr: float | None) -> list[dict]:
    out = []
    if not has_cost_model:
        out.append(_finding("WRONG_COST_BASELINE", "invalidate", {"reason": "missing_cost_model"}))
    if family == "carry_basis":
        needed = {"earn_usdt", "btc_eth_carry"}
        if not needed.issubset(set(baselines)):
            out.append(_finding("WRONG_COST_BASELINE", "invalidate", {"missing": sorted(needed - set(baselines))}))
        if net_apr is not None and baseline_apr is not None and net_apr <= baseline_apr:
            out.append(_finding("WRONG_COST_BASELINE", "kill", {"net_apr": net_apr, "baseline_apr": baseline_apr}))
    return out


def trap_waiting_risk(family: str, alternatives: list[str], sigma_h_present: bool, lambda_grid: list) -> list[dict]:
    if family != "execution_venue_time":
        return []
    out = []
    if "NOW" not in alternatives:
        out.append(_finding("WAITING_RISK", "invalidate", {"reason": "missing_now"}))
    if not sigma_h_present:
        out.append(_finding("WAITING_RISK", "invalidate", {"reason": "missing_horizon_sigma"}))
    if not lambda_grid:
        out.append(_finding("WAITING_RISK", "kill", {"reason": "lambda_missing"}))
    return out


def scan(spec: dict, measured: dict) -> list[dict]:
    findings: list[dict] = []
    findings += trap_multiple_testing(spec, measured.get("dsr"))
    findings += trap_beta_as_alpha(bool(spec.get("claims_alpha", True)), float(measured.get("alpha", 0.0)), float(measured.get("t_stat", 0.0)))
    findings += trap_bar_timing(int(measured.get("grain_seconds", 3600)), str(spec.get("event_kind", "none")), float(measured.get("bar_open_delta_s", 0.0)))
    risk = spec.get("risk") or {}
    if risk:
        findings += trap_wrong_horizon(str(risk.get("sigma_span", "")), str(risk.get("horizon_span", "")))
    findings += trap_leakage(set(measured.get("train_ids") or []), set(measured.get("test_ids") or []))
    findings += trap_venue_history(
        str(spec.get("test_start", "")),
        str(measured.get("actual_first") or ""),
        spec.get("claimed_start"),
    )
    findings += trap_effect_erase(list(spec.get("transforms") or []))
    findings += trap_wrong_cost_baseline(
        str(spec.get("family")),
        list(spec.get("baseline_codes") or spec.get("baselines") or []),
        bool(spec.get("costs")),
        measured.get("net_apr"),
        measured.get("baseline_apr"),
    )
    findings += trap_waiting_risk(
        str(spec.get("family")),
        list((spec.get("risk") or {}).get("alternatives") or []),
        bool(measured.get("sigma_h_present")),
        list((spec.get("risk") or {}).get("lambda_grid") or []),
    )
    return findings
