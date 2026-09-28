"""Runs left in `running` after a dead process cannot be resumed inline."""

from __future__ import annotations


def interrupted_if_stale(age_minutes: float, stale_minutes: int) -> bool:
    return age_minutes >= stale_minutes
