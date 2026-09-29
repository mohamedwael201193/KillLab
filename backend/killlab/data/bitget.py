"""Public Bitget REST. No order methods exist in this module."""

from __future__ import annotations

import hashlib
import json
import time
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
        end = str(int(time.time() * 1000))
        pages_fetched = 0
        stopped = "page_cap"
        with httpx.Client(timeout=self.settings.bitget_timeout_s, headers={"User-Agent": "curl/8.0"}) as client:
            for _ in range(pages):
                params = dict(params_base)
                params["endTime"] = str(end)
                response = client.get(self.settings.bitget_rest_base + path, params=params)
                if response.status_code >= 400:
                    raise BitgetError(f"http {response.status_code}")
                payload = response.json()
                batch = payload.get("data") or []
                pages_fetched += 1
                if not batch:
                    stopped = "empty_page"
                    break
                rows.extend(batch)
                oldest = min(int(row[0]) for row in batch)
                end = oldest - 1
                if len(batch) < 200:
                    stopped = "short_page"
                    break
        blob = json.dumps(rows, separators=(",", ":")).encode()
        last = None
        if rows:
            last = datetime.fromtimestamp(max(int(row[0]) for row in rows) / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        return {
            "symbol": symbol,
            "product": product,
            "granularity": granularity,
            "n": len(rows),
            "pages_requested": pages,
            "pages_fetched": pages_fetched,
            "pagination_stop": stopped,
            "actual_first": _rows_first_ts(rows),
            "actual_last": last,
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

    def ticker(self, *, frozen: bool, symbol: str) -> dict | None:
        """One public book snapshot. It is an observation, not an input to the verdict."""
        require_frozen(frozen)
        path = "/api/v2/mix/market/ticker"
        with httpx.Client(timeout=self.settings.bitget_timeout_s, headers={"User-Agent": "curl/8.0"}) as client:
            response = client.get(
                self.settings.bitget_rest_base + path,
                params={"symbol": symbol, "productType": "USDT-FUTURES"},
            )
        if response.status_code >= 400:
            return None
        payload = response.json()
        data = payload.get("data") or []
        row = data[0] if isinstance(data, list) and data else None
        if not isinstance(row, dict) or row.get("bidPr") is None or row.get("askPr") is None:
            return None
        return {
            "symbol": symbol,
            "bid": row.get("bidPr"),
            "ask": row.get("askPr"),
            "ts": row.get("ts"),
        }

    def forward_book(self, *, frozen: bool, symbol: str, limit: int = 15) -> dict | None:
        """Current public depth. Bitget has no historical order-book REST path.

        The returned record is a forward capture. It is not a reconstruction of the past book.
        """
        require_frozen(frozen)
        path = "/api/v2/mix/market/merge-depth"
        with httpx.Client(timeout=self.settings.bitget_timeout_s, headers={"User-Agent": "curl/8.0"}) as client:
            response = client.get(
                self.settings.bitget_rest_base + path,
                params={"symbol": symbol, "productType": "USDT-FUTURES", "limit": str(limit)},
            )
        if response.status_code >= 400:
            return None
        payload = response.json()
        if payload.get("code") not in {None, "00000"}:
            return None
        data = payload.get("data") or {}
        asks = data.get("asks") or []
        bids = data.get("bids") or []
        if not asks or not bids:
            return None
        best_ask = float(asks[0][0])
        best_bid = float(bids[0][0])
        mid = (best_ask + best_bid) / 2 if best_ask and best_bid else 0.0
        spread_bps = ((best_ask - best_bid) / mid * 1e4) if mid else None
        blob = json.dumps({"asks": asks, "bids": bids, "ts": data.get("ts")}, separators=(",", ":")).encode()
        return {
            "provenance": "forward_recorded",
            "historical": False,
            "symbol": symbol,
            "endpoint": path,
            "ts": data.get("ts"),
            "spread_bps": spread_bps,
            "bid_depth": sum(float(level[1]) for level in bids if len(level) > 1),
            "ask_depth": sum(float(level[1]) for level in asks if len(level) > 1),
            "payload_sha256": hashlib.sha256(blob).hexdigest(),
        }
