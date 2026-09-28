"""JSON logs. Secret-looking values are dropped, not printed."""

from __future__ import annotations

import json
import logging

log = logging.getLogger("killlab")
_BLOCKED = ("postgres://", "postgresql://", "bearer ", "ghp_", "rnd_", "vcp_")


def log_event(event: str, **fields) -> str:
    payload = {"event": event}
    for key, value in fields.items():
        text = str(value)
        if any(token in text.lower() for token in _BLOCKED):
            payload[key] = "[redacted]"
        else:
            payload[key] = value
    line = json.dumps(payload, default=str)
    log.info(line)
    return line
