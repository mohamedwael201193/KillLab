"""Normalize an upstream payload into one evidence object.

Retrieval time and the upstream data time stay in different fields.
A number with no upstream time is undated. It is not labeled historical.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

_TIME_KEYS = {
    "data_timestamp",
    "timestamp",
    "as_of",
    "updated_at",
    "published_at",
    "time",
    "quote_time",
    "regularmarkettime",
    "last_updated",
}


def content_hash(payload: object) -> str:
    raw = json.dumps(payload, sort_keys=True, default=str, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()


def _timestamp(payload: object, depth: int = 0) -> str | None:
    if depth > 5:
        return None
    if isinstance(payload, list):
        for item in payload[:8]:
            found = _timestamp(item, depth + 1)
            if found:
                return found
        return None
    if not isinstance(payload, dict):
        return None
    for key, value in payload.items():
        if str(key).lower() in _TIME_KEYS and isinstance(value, str) and value.strip():
            return value.strip()
    for value in payload.values():
        if isinstance(value, (dict, list)):
            found = _timestamp(value, depth + 1)
            if found:
                return found
    return None


def _scalars(payload: object, limit: int = 6) -> list[tuple[str, object]]:
    found: list[tuple[str, object]] = []

    def walk(node: object, prefix: str) -> None:
        if len(found) >= limit:
            return
        if isinstance(node, dict):
            for key, value in node.items():
                if "error" in str(key).lower():
                    continue
                walk(value, str(key))
        elif isinstance(node, list):
            for value in node[:3]:
                walk(value, prefix)
        elif isinstance(node, (int, float, bool)) or (isinstance(node, str) and node.strip()):
            found.append((prefix or "value", node))

    walk(payload, "")
    return found


def summarize(payload: object) -> str:
    fields = _scalars(payload)
    if not fields:
        return "The official tool answered and supplied no numeric fields."
    parts = []
    for key, value in fields:
        if isinstance(value, float):
            text = f"{value:.4g}"
        else:
            text = str(value)
        parts.append(f"{key} {text[:80]}")
    return "; ".join(parts)[:280]


def _parse_time(value: str) -> datetime | None:
    text = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def classify(tool_name: str, arguments: dict, payload: object, *, now: datetime | None = None) -> str:
    """A history action with a source time is historical. A quote without one is undated."""
    action = str((arguments or {}).get("action") or "")
    stamp = _timestamp(payload)
    if not stamp and not _scalars(payload):
        return "unknown"
    if not stamp:
        return "undated"
    parsed = _parse_time(stamp)
    history = "history" in action or "history" in tool_name
    if history:
        return "historical"
    if parsed is not None:
        moment = now or datetime.now(timezone.utc)
        if (moment - parsed).total_seconds() > 2 * 24 * 3600:
            return "stale"
    return "current"


def evidence_object(
    *,
    source_type: str,
    provider: str,
    tool_name: str,
    symbol: str | None,
    query: dict,
    payload: object,
    error: str | None = None,
    source_url: str | None = None,
    requested_at: str | None = None,
    latency_ms: int | None = None,
) -> dict:
    retrieved = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    body: object = {"error": error} if error else payload
    stamp = None if error else _timestamp(payload)
    kind = "unavailable" if error else classify(tool_name, query, payload)
    summary = error or summarize(payload)
    fields = [] if error else _scalars(payload, limit=8)
    return {
        "source_type": source_type,
        "source": provider,
        "source_url": source_url,
        "provider": provider,
        "tool_name": tool_name,
        "tool": tool_name,
        "requested_at": requested_at or retrieved,
        "retrieved_at": retrieved,
        "data_timestamp": stamp,
        "symbol": symbol,
        "instrument": symbol,
        "query": query,
        "content_hash": content_hash(body),
        "payload_hash": content_hash(body),
        "structured_data": {key: value for key, value in fields},
        "provenance": {
            "source_url": source_url,
            "endpoint": provider,
            "requested_at": requested_at or retrieved,
            "retrieved_at": retrieved,
            "data_timestamp": stamp,
            "error": error,
            "latency_ms": latency_ms,
        },
        "current_or_historical": kind,
        "usable_for_verdict": False,
        "failure_reason": error,
        "summary": summary,
        "textual_summary": summary,
        "category": "MCP CONTEXT" if source_type == "MCP_CONTEXT" else "SKILL CONTEXT",
    }
