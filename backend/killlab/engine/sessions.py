"""DST-aware Bitget equity session clock. America/New_York, not fixed UTC."""

from __future__ import annotations

from datetime import datetime, time
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")


def _as_et(ts: datetime) -> datetime:
    if ts.tzinfo is None:
        raise ValueError("timestamp must be timezone-aware")
    return ts.astimezone(ET)


def is_weekend_mm(ts: datetime) -> bool:
    """Friday 20:00 ET inclusive through Sunday 20:00 ET exclusive."""
    local = _as_et(ts)
    weekday = local.weekday()
    minutes = local.hour * 60 + local.minute
    if weekday == 4 and minutes >= 20 * 60:
        return True
    if weekday == 5:
        return True
    if weekday == 6 and minutes < 20 * 60:
        return True
    return False


def is_stockroute(ts: datetime) -> bool:
    return not is_weekend_mm(ts)


def us_cash_open(day) -> datetime:
    return datetime.combine(day, time(9, 30), tzinfo=ET)


def us_cash_close(day) -> datetime:
    return datetime.combine(day, time(16, 0), tzinfo=ET)
