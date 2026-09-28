"""Percentile bootstrap over independent units."""

from __future__ import annotations

import numpy as np


def percentile_ci(values: list[float], seed: int = 20260928, resamples: int = 2000) -> dict:
    data = np.asarray(values, float)
    data = data[np.isfinite(data)]
    if len(data) < 2:
        return {"point": None, "ci_low": None, "ci_high": None, "n": int(len(data))}
    rng = np.random.default_rng(seed)
    means = np.array([rng.choice(data, size=len(data), replace=True).mean() for _ in range(resamples)])
    return {
        "point": float(data.mean()),
        "ci_low": float(np.quantile(means, 0.05)),
        "ci_high": float(np.quantile(means, 0.95)),
        "n": int(len(data)),
        "resamples": resamples,
    }
