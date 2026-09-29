"""Normalize an upstream payload into one evidence object."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone


def content_hash(payload: object) -> str:
    raw = json.dumps(payload, sort_keys=True, default=str, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()


def _timestamp(payload: object) -> str | None:
    if isinstance(payload, list):
        for item in payload:
            found = _timestamp(item)
            if found:
                return found
        return None
    if not isinstance(payload, dict):
        return None
    for key in ("data_timestamp", "timestamp", "as_of", "updated_at", "published_at", "time"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
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


def classify(tool_name: str, arguments: dict, payload: object) -> str:
    action = str((arguments or {}).get("action") or "")
    if "history" in action or "history" in tool_name:
        return "historical" if _timestamp(payload) or _scalars(payload) else "unknown"
    if _scalars(payload):
        return "current"
    return "unknown"


def evidence_object(
    *,
    source_type: str,
    provider: str,
    tool_name: str,
    symbol: str | None,
    query: dict,
    payload: object,
    error: str | None = None,
) -> dict:
    retrieved = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    body: object = {"error": error} if error else payload
    stamp = None if error else _timestamp(payload)
    kind = "unknown" if error else classify(tool_name, query, payload)
    summary = error or summarize(payload)
    return {
        "source_type": source_type,
        "provider": provider,
        "tool_name": tool_name,
        "retrieved_at": retrieved,
        "data_timestamp": stamp,
        "symbol": symbol,
        "query": query,
        "content_hash": content_hash(body),
        "provenance": {
            "endpoint": provider,
            "data_timestamp": stamp,
            "error": error,
        },
        "current_or_historical": kind,
        "usable_for_verdict": False,
        "summary": summary,
        "category": "MCP CONTEXT" if source_type == "MCP_CONTEXT" else "SKILL CONTEXT",
    }
