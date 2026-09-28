"""Canonical JSON hashing. Key order does not change the digest."""

from __future__ import annotations

import hashlib
import json
from typing import Any


def canonical_bytes(document: Any) -> bytes:
    return json.dumps(document, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def sha256_canonical(document: Any) -> str:
    return hashlib.sha256(canonical_bytes(document)).hexdigest()
