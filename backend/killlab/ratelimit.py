"""In-memory rate limit. The bucket key is a hash, never the raw token."""

from __future__ import annotations

import hashlib


def client_key(path: str, authorization: str | None) -> str:
    material = authorization or "anonymous"
    digest = hashlib.sha256(material.encode("utf-8")).hexdigest()[:16]
    return f"{path}:{digest}"


def allow(bucket: list[float], now: float, window_s: float, cap: int) -> bool:
    bucket[:] = [stamp for stamp in bucket if now - stamp < window_s]
    if len(bucket) >= cap:
        return False
    bucket.append(now)
    return True
