"""Bailey & Lopez de Prado 2014 Deflated Sharpe, ported from the forensic dsr_run.py.

SR hat is non-annualized. Annualized Sharpe is display-only and is never fed back in.
"""

from __future__ import annotations

import math

import numpy as np

GAMMA_EULER = 0.5772156649015328606
E_CONST = math.e


def norm_cdf(x: float) -> float:
    if x != x:
        return float("nan")
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def norm_ppf(p: float) -> float:
    if p <= 0:
        return -8.0
    if p >= 1:
        return 8.0
    a = [-3.969683028665376e01, 2.209460984213625e02, -2.759285104469687e02, 1.383577518672690e02, -3.066479806614716e01, 2.506628277459239e00]
    b = [-5.447609879822406e01, 1.615858368580409e02, -1.556989798598866e02, 6.680131188771972e01, -1.328068155288572e01]
    c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e00, -2.549732386606647e00, 4.374664141464968e00, 2.938163982698783e00]
    d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e00, 3.754408661907416e00]
    plow, phigh = 0.02425, 1 - 0.02425
    if p < plow:
        q = math.sqrt(-2 * math.log(p))
        return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / (
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
        )
    if p > phigh:
        q = math.sqrt(-2 * math.log(1 - p))
        return -(
            (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
            / (((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1))
        )
    q = p - 0.5
    r = q * q
    return (
        (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
        / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    )


def moments(xs: np.ndarray) -> dict:
    a = np.asarray(xs, float)
    a = a[np.isfinite(a)]
    n = int(len(a))
    if n < 3:
        return {"n": n, "mean": float("nan"), "std": float("nan"), "sr": float("nan"), "skew": float("nan"), "kurt_pearson": float("nan")}
    mu = float(a.mean())
    sd = float(a.std(ddof=1))
    sr = mu / sd if sd > 0 else float("nan")
    if sd <= 0:
        return {"n": n, "mean": mu, "std": sd, "sr": sr, "skew": 0.0, "kurt_pearson": 3.0}
    z = (a - mu) / sd
    return {"n": n, "mean": mu, "std": sd, "sr": sr, "skew": float(np.mean(z ** 3)), "kurt_pearson": float(np.mean(z ** 4))}


def expected_max_sr(n_trials: int, var_sr: float) -> float:
    if n_trials < 2 or not (var_sr == var_sr) or var_sr <= 0:
        return 0.0
    z1 = norm_ppf(1.0 - 1.0 / n_trials)
    z2 = norm_ppf(1.0 - 1.0 / (n_trials * E_CONST))
    return math.sqrt(var_sr) * ((1.0 - GAMMA_EULER) * z1 + GAMMA_EULER * z2)


def lo_sr_var(sr: float, n: int) -> float:
    if n < 3 or sr != sr:
        return float("nan")
    return (1.0 + 0.5 * sr * sr) / n


def dsr_prob(sr_hat: float, sr0: float, n: int, skew: float, kurt: float) -> dict:
    if n < 3 or sr_hat != sr_hat or sr0 != sr0:
        return {"dsr": float("nan"), "z": float("nan"), "sr_hat": sr_hat, "sr0": sr0, "n": n}
    skew = 0.0 if skew != skew else skew
    kurt = 3.0 if kurt != kurt else kurt
    den_in = 1.0 - skew * sr_hat + ((kurt - 1.0) / 4.0) * sr_hat * sr_hat
    if den_in <= 0:
        return {"dsr": float("nan"), "z": float("nan"), "sr_hat": sr_hat, "sr0": sr0, "n": n}
    z = (sr_hat - sr0) * math.sqrt(n - 1) / math.sqrt(den_in)
    return {
        "dsr": float(norm_cdf(z)),
        "z": float(z),
        "sr_hat": float(sr_hat),
        "sr0": float(sr0),
        "n": int(n),
        "skew": float(skew),
        "kurt_pearson": float(kurt),
        "sr_hat_ann252": float(sr_hat * math.sqrt(252)),
    }


def dsr_from_series(xs, n_trials: int, trial_srs=None, sr0_override=None) -> dict:
    m = moments(np.asarray(xs, float))
    if trial_srs is not None:
        srs = np.asarray(trial_srs, float)
        srs = srs[np.isfinite(srs)]
        var_sr = float(np.var(srs, ddof=1)) if len(srs) >= 2 else 0.0
    else:
        var_sr = lo_sr_var(m["sr"], m["n"])
    sr0 = float(sr0_override) if sr0_override is not None else expected_max_sr(n_trials, var_sr)
    out = dsr_prob(m["sr"], sr0, m["n"], m["skew"], m["kurt_pearson"])
    out["n_trials"] = n_trials
    out["var_sr"] = var_sr
    out["mean"] = m["mean"]
    return out
