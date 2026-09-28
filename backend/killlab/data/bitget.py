"""Public Bitget REST. No order methods exist in this module."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

import httpx

from killlab.config import Settings


class BitgetError(RuntimeError):
    pass


class NotFrozen(RuntimeError):
    pass


def require_frozen(frozen: bool) -> None:
    if not frozen:
        raise NotFrozen("data access requires a frozen preregistration")


def _rows_first_ts(rows: list) -> str | None:
    if not rows:
        return None
    stamps = []
    for row in rows:
        raw = row[0] if isinstance(row, list) else row.get("ts") or row.get("timestamp")
        stamps.append(int(raw))
    return datetime.fromtimestamp(min(stamps) / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


class BitgetRest:
    def __init__(self, settings: Settings):
        self.settings = settings

    def history_candles(self, *, frozen: bool, product: str, symbol: str, granularity: str = "1H", pages: int = 3) -> dict:
        require_frozen(frozen)
        if product == "USDT-FUTURES":
            path = "/api/v2/mix/market/history-candles"
            params_base = {"symbol": symbol, "productType": "USDT-FUTURES", "granularity": granularity, "limit": "200"}
        elif product == "SPOT":
            path = "/api/v2/spot/market/history-candles"
            params_base = {"symbol": symbol, "granularity": granularity.lower(), "limit": "200"}
        else:
            raise BitgetError(f"unsupported product {product}")
        rows: list = []
        end = None
        with httpx.Client(timeout=self.settings.bitget_timeout_s, headers={"User-Agent": "curl/8.0"}) as client:
            for _ in range(pages):
                params = dict(params_base)
                if end is not None:
                    params["endTime"] = str(end)
                response = client.get(self.settings.bitget_rest_base + path, params=params)
                if response.status_code >= 400:
                    raise BitgetError(f"http {response.status_code}")
                payload = response.json()
                batch = payload.get("data") or []
                if not batch:
                    break
                rows.extend(batch)
                oldest = min(int(row[0]) for row in batch)
                end = oldest - 1
                if len(batch) < 200:
                    break
        blob = json.dumps(rows, separators=(",", ":")).encode()
        return {
            "symbol": symbol,
            "product": product,
            "granularity": granularity,
            "n": len(rows),
            "actual_first": _rows_first_ts(rows),
            "payload_sha256": hashlib.sha256(blob).hexdigest(),
            "rows": rows,
        }

    def history_funding(self, *, frozen: bool, symbol: str, pages: int = 3) -> dict:
        require_frozen(frozen)
        path = "/api/v2/mix/market/history-fund-rate"
        rows: list = []
        with httpx.Client(timeout=self.settings.bitget_timeout_s, headers={"User-Agent": "curl/8.0"}) as client:
            for page in range(1, pages + 1):
                response = client.get(
                    self.settings.bitget_rest_base + path,
                    params={"symbol": symbol, "productType": "usdt-futures", "pageSize": "100", "pageNo": str(page)},
                )
                if response.status_code >= 400:
                    raise BitgetError(f"http {response.status_code}")
                payload = response.json()
                if payload.get("code") not in {None, "00000"}:
                    raise BitgetError(str(payload.get("code")))
                batch = payload.get("data") or []
                if not batch:
                    break
                rows.extend(batch)
                if len(batch) < 100:
                    break
        return {"symbol": symbol, "n": len(rows), "rows": rows}
