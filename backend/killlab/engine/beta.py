"""OLS alpha and t-stat. Same-series benchmark is the unit return itself only when a separate benchmark is passed."""

from __future__ import annotations

import math


def mean_tstat(values: list[float]) -> tuple[float, float]:
    clean = [float(v) for v in values if v == v]
    n = len(clean)
    if n < 3:
        return float("nan"), float("nan")
    mean = sum(clean) / n
    var = sum((v - mean) ** 2 for v in clean) / (n - 1)
    std = math.sqrt(var)
    if std == 0:
        return mean, float("inf") if mean > 0 else float("nan")
    return mean, mean / (std / math.sqrt(n))
