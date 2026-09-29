"""Independent DSR reference. This file must not import killlab.engine.dsr."""

from __future__ import annotations

import math


def reference_dsr(sr_hat: float, sr0: float, n: int, skew: float, kurt: float) -> float:
    """Bailey and Lopez de Prado 2014, written here from the published z-score."""
    denominator = 1.0 - skew * sr_hat + ((kurt - 1.0) / 4.0) * sr_hat * sr_hat
    if n < 3 or denominator <= 0 or sr_hat != sr_hat or sr0 != sr0:
        return float("nan")
    z = (sr_hat - sr0) * math.sqrt(n - 1) / math.sqrt(denominator)
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))
