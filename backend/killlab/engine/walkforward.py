"""Expanding walk-forward split. Train ids and test ids must not overlap."""

from __future__ import annotations


def expanding_folds(unit_ids: list[str], min_train: int) -> list[dict]:
    folds = []
    for index in range(min_train, len(unit_ids)):
        train = unit_ids[:index]
        test = unit_ids[index]
        if test in train:
            raise ValueError("leakage")
        folds.append({"train": train, "test": test})
    return folds
