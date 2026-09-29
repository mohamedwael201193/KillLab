"""Official read-only US stock and ETF MCP.

https://agent.bitget.com/mcp needs no account. A failed session is context,
not a missing verdict.
"""

from __future__ import annotations

from datetime import datetime, timezone

from killlab.data.bitget import NotFrozen
from killlab.integrations.evidence import evidence_object
from killlab.integrations.mcp_http import McpError, call_tool

MCP_URL = "https://agent.bitget.com/mcp"

_CRYPTO = {
    "BTC", "ETH", "SOL", "XRP", "DOGE", "BNB", "ADA", "AVAX", "LINK", "DOT",
    "LTC", "BCH", "UNI", "AAVE", "PEPE", "SUI", "TON", "TRX", "SHIB",
}


def equity_ticker(symbol: str | None) -> str | None:
    if not symbol:
        return None
    base = symbol.upper().replace("PERP", "").replace("-", "")
    if base.endswith("USDT"):
        base = base[: -4]
    if base.startswith("R") and base[1:].isalpha() and 1 <= len(base[1:]) <= 5:
        base = base[1:]
    if not base.isalpha() or not 1 <= len(base) <= 5 or base in _CRYPTO:
        return None
    return base


def quote_evidence(*, frozen: bool, symbol: str | None, timeout: float = 12.0, send=None) -> dict | None:
    if not frozen:
        raise NotFrozen("market context is refused before freeze")
    ticker = equity_ticker(symbol)
    if ticker is None:
        return None
    query = {"entry_id": "equity_price_quote", "params": {"symbol": ticker}}
    requested = datetime.now(timezone.utc).replace(microsecond=0)
    started = requested.timestamp()
    try:
        result = call_tool(MCP_URL, "do_query", query, timeout=timeout, retries=2, send=send)
        payload = result["data"]
        error = None
    except McpError as exc:
        payload = {}
        error = exc.reason
    return evidence_object(
        source_type="MCP_CONTEXT",
        provider="bitget-mcp-server",
        tool_name="do_query",
        symbol=ticker,
        query=query,
        payload=payload,
        error=error,
        source_url=MCP_URL,
        requested_at=requested.isoformat(),
        latency_ms=int((datetime.now(timezone.utc).timestamp() - started) * 1000),
    )
