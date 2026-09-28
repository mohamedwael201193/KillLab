"""CSCV probability of backtest overfitting. Bailey, Borwein, Lopez de Prado, Zhu."""

from __future__ import annotations

import itertools

import numpy as np


def cscv_pbo(matrix: np.ndarray, splits: int = 8) -> dict:
    values = np.asarray(matrix, float)
    rows, cols = values.shape
    if splits % 2 or splits < 2 or rows < splits or cols < 2:
        return {"pbo": None, "reason": "insufficient_shape"}
    usable = np.isfinite(values).any(axis=1)
    values = np.where(np.isfinite(values), values, 0.0)[usable]
    rows = int(values.shape[0])
    block = rows // splits
    if block < 1:
        return {"pbo": None, "reason": "insufficient_rows"}
    values = values[: block * splits]
    blocks = [values[i * block : (i + 1) * block] for i in range(splits)]
    half = splits // 2
    fails = 0
    total = 0

    def column_sharpe(frame: np.ndarray) -> np.ndarray:
        scores = []
        for j in range(frame.shape[1]):
            series = frame[:, j]
            std = series.std(ddof=1)
            scores.append(series.mean() / std if std > 0 else -np.inf)
        return np.asarray(scores)

    for combo in itertools.combinations(range(splits), half):
        chosen = set(combo)
        ins = np.concatenate([blocks[i] for i in range(splits) if i in chosen])
        oos = np.concatenate([blocks[i] for i in range(splits) if i not in chosen])
        best = int(np.argmax(column_sharpe(ins)))
        order = np.argsort(column_sharpe(oos))
        rank = int(np.where(order == best)[0][0]) + 1
        omega = rank / (cols + 1.0)
        fails += int(omega < 0.5)
        total += 1
    return {"pbo": fails / total if total else None, "splits": splits, "columns": cols}
