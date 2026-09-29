"""Authoritative fallbacks when the official skill host returns no reading.

These are not the Signal MCP. Each row keeps its own URL and source class.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

import httpx

from killlab.data.bitget import require_frozen
from killlab.integrations.evidence import evidence_object

NYFED_SOFR = "https://markets.newyorkfed.org/api/rates/secured/sofr/last/1.json"
NYFED_SOFR_90 = "https://markets.newyorkfed.org/api/rates/secured/sofr/last/90.json"
NYFED_ALL = "https://markets.newyorkfed.org/api/rates/all/latest.json"
FED_RSS = "https://www.federalreserve.gov/feeds/press_monetary.xml"
COINDESK_RSS = "https://www.coindesk.com/arc/outboundfeeds/rss/"
TREASURY_XML = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value={year}"
BITGET_REST = "https://api.bitget.com"
_HEADERS = {"User-Agent": "killlab-research/1"}
_ATOM = "{http://www.w3.org/2005/Atom}"
_DS = "{http://schemas.microsoft.com/ado/2007/08/dataservices}"
_DSM = "{http://schemas.microsoft.com/ado/2007/08/dataservices/metadata}"


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _get(url: str, *, timeout: float, params: dict | None = None, get=None):
    getter = get or httpx.get
    return getter(url, params=params, headers=_HEADERS, timeout=timeout, follow_redirects=True)


def macro_rates(*, frozen: bool, timeout: float = 12.0, get=None) -> dict | None:
    """NY Fed reference rates. Not a Signal MCP payload."""
    require_frozen(frozen)
    requested = _now()
    started = datetime.now(timezone.utc).timestamp()
    payload: dict = {}
    stamp = None
    source = NYFED_SOFR
    try:
        all_rates = _get(NYFED_ALL, timeout=timeout, get=get)
        if getattr(all_rates, "status_code", 0) == 200 and (all_rates.text or "").strip():
            source = NYFED_ALL
            payload, stamp = _nyfed_rows(all_rates.json())
        if not payload:
            sofr = _get(NYFED_SOFR, timeout=timeout, get=get)
            if getattr(sofr, "status_code", 0) != 200:
                return None
            payload, stamp = _nyfed_rows(sofr.json())
            source = NYFED_SOFR
    except (httpx.HTTPError, ValueError, TypeError):
        return None
    if not payload:
        return None
    item = evidence_object(
        source_type="SKILL_CONTEXT",
        provider="authoritative_fallback",
        tool_name="nyfed_rates",
        symbol=None,
        query={"skill": "macro-analyst", "recipe": "rates_snapshot", "fallback": True},
        payload=payload,
        source_url=source,
        requested_at=requested,
        latency_ms=int((datetime.now(timezone.utc).timestamp() - started) * 1000),
    )
    item["skill"] = "macro-analyst"
    item["source_class"] = "authoritative_fallback"
    item["failure_class"] = "valid_data"
    if stamp:
        item["data_timestamp"] = stamp
        item["current_or_historical"] = "current" if _fresh(stamp) else "stale"
        item["provenance"]["data_timestamp"] = stamp
    return item


def treasury_curve_series(*, frozen: bool, year: str = "2026", timeout: float = 20.0, get=None) -> dict:
    """Dated 2s10s from the Treasury par-yield XML. Empty inverted_dates if the curve is not inverted."""
    require_frozen(frozen)
    url = TREASURY_XML.format(year=year)
    requested = _now()
    empty = {
        "source": "us_treasury_par_yield_curve",
        "url": url,
        "rule": {"spread": "t10y_minus_t2y", "op": "lt", "threshold": 0, "align": "session_date"},
        "rows": [],
        "inverted_dates": [],
        "n_days": 0,
        "n_inverted": 0,
        "retrieved_at": requested,
        "year": year,
    }
    try:
        response = _get(url, timeout=timeout, get=get)
        if getattr(response, "status_code", 0) != 200 or not getattr(response, "content", b""):
            empty["failure_class"] = "empty_result"
            return empty
        root = ET.fromstring(response.content)
    except (httpx.HTTPError, ET.ParseError, TypeError, ValueError):
        empty["failure_class"] = "transport_error"
        return empty
    rows = []
    inverted = []
    spreads = []
    for entry in root.findall(f"{_ATOM}entry"):
        props = entry.find(f".//{_DSM}properties")
        if props is None:
            continue
        date_text = _ds(props, "NEW_DATE")
        t2 = _num(_ds(props, "BC_2YEAR"))
        t10 = _num(_ds(props, "BC_10YEAR"))
        if not date_text or t2 is None or t10 is None:
            continue
        day = date_text[:10]
        spread = t10 - t2
        flag = spread < 0
        rows.append({"date": day, "t2y": t2, "t10y": t10, "spread": round(spread, 4), "inverted": flag})
        spreads.append(spread)
        if flag:
            inverted.append(day)
    empty.update(
        {
            "rows": rows,
            "inverted_dates": inverted,
            "n_days": len(rows),
            "n_inverted": len(inverted),
            "spread_min": min(spreads) if spreads else None,
            "spread_max": max(spreads) if spreads else None,
            "first_date": rows[0]["date"] if rows else None,
            "last_date": rows[-1]["date"] if rows else None,
            "failure_class": "valid_data" if rows else "empty_result",
        }
    )
    return empty


def treasury_curve_evidence(*, frozen: bool, year: str = "2026", timeout: float = 20.0, get=None) -> dict | None:
    require_frozen(frozen)
    started = datetime.now(timezone.utc).timestamp()
    series = treasury_curve_series(frozen=True, year=year, timeout=timeout, get=get)
    if not series.get("n_days"):
        return None
    payload = {
        "n_days": series["n_days"],
        "n_inverted": series["n_inverted"],
        "spread_min": series.get("spread_min"),
        "spread_max": series.get("spread_max"),
        "first_date": series.get("first_date"),
        "last_date": series.get("last_date"),
        "rule": series.get("rule"),
    }
    item = evidence_object(
        source_type="SKILL_CONTEXT",
        provider="authoritative_fallback",
        tool_name="treasury_par_yield",
        symbol=None,
        query={"skill": "macro-analyst", "recipe": "t10y_minus_t2y_history", "fallback": True},
        payload=payload,
        source_url=series.get("url"),
        requested_at=series.get("retrieved_at"),
        latency_ms=int((datetime.now(timezone.utc).timestamp() - started) * 1000),
    )
    item["skill"] = "macro-analyst"
    item["source_class"] = "authoritative_fallback"
    item["failure_class"] = series.get("failure_class") or "valid_data"
    stamp = f"{series.get('last_date')}T00:00:00+00:00" if series.get("last_date") else None
    if stamp:
        item["data_timestamp"] = stamp
        item["provenance"]["data_timestamp"] = stamp
        item["current_or_historical"] = "historical"
    return item


def sofr_history(*, frozen: bool, timeout: float = 12.0, get=None) -> dict | None:
    """NY Fed SOFR last-90. Dated history for context. Not a 60-unit scored family by itself."""
    require_frozen(frozen)
    requested = _now()
    started = datetime.now(timezone.utc).timestamp()
    try:
        response = _get(NYFED_SOFR_90, timeout=timeout, get=get)
        if getattr(response, "status_code", 0) != 200:
            return None
        rows = (response.json() or {}).get("refRates")
    except (httpx.HTTPError, ValueError, TypeError):
        return None
    if not isinstance(rows, list) or not rows:
        return None
    points = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        rate = row.get("percentRate")
        day = row.get("effectiveDate")
        if not isinstance(day, str) or not isinstance(rate, (int, float)) or isinstance(rate, bool):
            continue
        points.append({"effective_date": day, "sofr": rate})
    if not points:
        return None
    payload = {
        "n": len(points),
        "first_date": points[-1]["effective_date"],
        "last_date": points[0]["effective_date"],
        "min": min(item["sofr"] for item in points),
        "max": max(item["sofr"] for item in points),
    }
    item = evidence_object(
        source_type="SKILL_CONTEXT",
        provider="authoritative_fallback",
        tool_name="nyfed_sofr_history",
        symbol=None,
        query={"skill": "macro-analyst", "recipe": "sofr_last_90", "fallback": True},
        payload=payload,
        source_url=NYFED_SOFR_90,
        requested_at=requested,
        latency_ms=int((datetime.now(timezone.utc).timestamp() - started) * 1000),
    )
    item["skill"] = "macro-analyst"
    item["source_class"] = "authoritative_fallback"
    item["failure_class"] = "valid_data"
    stamp = f"{payload['last_date']}T00:00:00+00:00"
    item["data_timestamp"] = stamp
    item["provenance"]["data_timestamp"] = stamp
    item["current_or_historical"] = "historical"
    return item


def fed_releases(*, frozen: bool, timeout: float = 12.0, get=None) -> dict | None:
    require_frozen(frozen)
    return _rss(
        FED_RSS,
        skill="news-briefing",
        recipe="feeds=cnbc,fed",
        timeout=timeout,
        get=get,
    )


def crypto_headlines(*, frozen: bool, timeout: float = 12.0, get=None) -> dict | None:
    require_frozen(frozen)
    return _rss(
        COINDESK_RSS,
        skill="news-briefing",
        recipe="feeds=cointelegraph,coindesk",
        timeout=timeout,
        get=get,
        limit=3,
    )


def bitget_positioning(*, frozen: bool, symbol: str | None, timeout: float = 12.0, get=None) -> dict | None:
    """Public Bitget long/short and taker prints. Current observation only."""
    require_frozen(frozen)
    pair = symbol or "BTCUSDT"
    requested = _now()
    started = datetime.now(timezone.utc).timestamp()
    ls = _bitget_rows("/api/v2/mix/market/account-long-short", pair, timeout, get)
    taker = _bitget_rows("/api/v2/mix/market/taker-buy-sell", pair, timeout, get)
    if not ls and not taker:
        return None
    latest_ls = _latest(ls)
    latest_tk = _latest(taker)
    stamp = _ms_stamp((latest_ls or {}).get("ts") or (latest_tk or {}).get("ts"))
    payload = {
        "symbol": pair,
        "long_short_account_ratio": _num((latest_ls or {}).get("longShortAccountRatio")),
        "long_account_ratio": _num((latest_ls or {}).get("longAccountRatio")),
        "taker_buy_volume": _num((latest_tk or {}).get("buyVolume")),
        "taker_sell_volume": _num((latest_tk or {}).get("sellVolume")),
        "n_prints": min(len(ls), 30) if ls else 0,
    }
    if not any(value is not None for key, value in payload.items() if key not in {"symbol", "n_prints"}):
        return None
    item = evidence_object(
        source_type="SKILL_CONTEXT",
        provider="bitget_public_rest",
        tool_name="account_long_short",
        symbol=pair,
        query={"skill": "sentiment-analyst", "recipe": "long_short+taker_ratio", "fallback": True},
        payload=payload,
        source_url=BITGET_REST + "/api/v2/mix/market/account-long-short",
        requested_at=requested,
        latency_ms=int((datetime.now(timezone.utc).timestamp() - started) * 1000),
    )
    item["skill"] = "sentiment-analyst"
    item["source_class"] = "bitget_public_rest"
    item["failure_class"] = "valid_data"
    if stamp:
        item["data_timestamp"] = stamp
        item["provenance"]["data_timestamp"] = stamp
        item["current_or_historical"] = "current" if _fresh(stamp) else "stale"
    return item


def bitget_open_interest(*, frozen: bool, symbol: str | None, timeout: float = 12.0, get=None) -> dict | None:
    """One current open-interest print. Not a history. Whale/ETF proxy per the skill notes."""
    require_frozen(frozen)
    pair = symbol or "BTCUSDT"
    requested = _now()
    started = datetime.now(timezone.utc).timestamp()
    try:
        response = _get(
            BITGET_REST + "/api/v2/mix/market/open-interest",
            timeout=timeout,
            params={"symbol": pair, "productType": "USDT-FUTURES"},
            get=get,
        )
        body = response.json()
    except (httpx.HTTPError, ValueError, TypeError):
        return None
    if getattr(response, "status_code", 0) >= 400 or body.get("code") not in {None, "00000"}:
        return None
    data = body.get("data") or {}
    rows = data.get("openInterestList") if isinstance(data, dict) else None
    row = rows[0] if isinstance(rows, list) and rows else None
    size = _num((row or {}).get("size"))
    if size is None:
        return None
    stamp = _ms_stamp(data.get("ts") if isinstance(data, dict) else None)
    payload = {"symbol": pair, "open_interest": size}
    item = evidence_object(
        source_type="SKILL_CONTEXT",
        provider="bitget_public_rest",
        tool_name="open_interest",
        symbol=pair,
        query={"skill": "market-intel", "recipe": "positioning_proxy", "fallback": True},
        payload=payload,
        source_url=BITGET_REST + "/api/v2/mix/market/open-interest",
        requested_at=requested,
        latency_ms=int((datetime.now(timezone.utc).timestamp() - started) * 1000),
    )
    item["skill"] = "market-intel"
    item["source_class"] = "bitget_public_rest"
    item["failure_class"] = "valid_data"
    if stamp:
        item["data_timestamp"] = stamp
        item["provenance"]["data_timestamp"] = stamp
        item["current_or_historical"] = "current" if _fresh(stamp) else "stale"
    return item


def for_skill(skill: str, *, frozen: bool, symbol: str | None, text: str = "", timeout: float = 12.0, get=None) -> list[dict]:
    require_frozen(frozen)
    items = []
    blob = (text or "").lower()
    if skill == "macro-analyst":
        row = macro_rates(frozen=True, timeout=timeout, get=get)
        if row:
            items.append(row)
        history = sofr_history(frozen=True, timeout=timeout, get=get)
        if history:
            items.append(history)
        curve = treasury_curve_evidence(frozen=True, timeout=timeout, get=get)
        if curve:
            items.append(curve)
    elif skill == "sentiment-analyst":
        row = bitget_positioning(frozen=True, symbol=symbol, timeout=timeout, get=get)
        if row:
            items.append(row)
    elif skill == "news-briefing":
        if any(word in blob for word in ("fed", "fomc", "rate", "macro", "cpi")):
            row = fed_releases(frozen=True, timeout=timeout, get=get)
        else:
            row = crypto_headlines(frozen=True, timeout=timeout, get=get)
        if row:
            items.append(row)
    elif skill == "market-intel":
        row = bitget_open_interest(frozen=True, symbol=symbol, timeout=timeout, get=get)
        if row:
            items.append(row)
        headlines = crypto_headlines(frozen=True, timeout=timeout, get=get)
        if headlines:
            headlines["skill"] = "market-intel"
            headlines["query"] = {**(headlines.get("query") or {}), "skill": "market-intel", "recipe": "etf_news_proxy"}
            items.append(headlines)
    return items


def _ds(props, name: str) -> str | None:
    el = props.find(f"{_DS}{name}")
    text = None if el is None else el.text
    return text.strip() if isinstance(text, str) and text.strip() else None


def _nyfed_rows(body: object) -> tuple[dict, str | None]:
    rows = (body or {}).get("refRates") if isinstance(body, dict) else None
    if not isinstance(rows, list):
        return {}, None
    out: dict = {}
    stamp = None
    for row in rows:
        if not isinstance(row, dict):
            continue
        name = str(row.get("type") or "").strip()
        rate = row.get("percentRate")
        if not name or not isinstance(rate, (int, float)) or isinstance(rate, bool):
            continue
        key = name.lower().replace(" ", "_")
        out[key] = rate
        stamp = row.get("effectiveDate") or stamp
        out["effective_date"] = stamp
    return out, f"{stamp}T00:00:00+00:00" if isinstance(stamp, str) and stamp else None


def _rss(url: str, *, skill: str, recipe: str, timeout: float, get=None, limit: int = 5) -> dict | None:
    requested = _now()
    started = datetime.now(timezone.utc).timestamp()
    try:
        response = _get(url, timeout=timeout, get=get)
        if getattr(response, "status_code", 0) >= 400:
            return None
        root = ET.fromstring(response.content)
    except (httpx.HTTPError, ET.ParseError, TypeError, ValueError):
        return None
    articles = []
    for item in root.findall(".//item")[:limit]:
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        published = (item.findtext("pubDate") or item.findtext("published") or "").strip()
        guid = (item.findtext("guid") or link).strip()
        if not title:
            continue
        articles.append({"title": title[:240], "url": link[:300], "published": published[:80], "guid": guid[:180]})
    if not articles:
        return None
    payload = {"articles": articles, "n": len(articles)}
    item = evidence_object(
        source_type="SKILL_CONTEXT",
        provider="authoritative_fallback",
        tool_name="rss",
        symbol=None,
        query={"skill": skill, "recipe": recipe, "fallback": True},
        payload=payload,
        source_url=url,
        requested_at=requested,
        latency_ms=int((datetime.now(timezone.utc).timestamp() - started) * 1000),
    )
    item["skill"] = skill
    item["source_class"] = "authoritative_fallback"
    item["failure_class"] = "valid_data"
    published = articles[0].get("published")
    stamp = _rss_stamp(published)
    if stamp:
        item["data_timestamp"] = stamp
        item["provenance"]["data_timestamp"] = stamp
        item["current_or_historical"] = "current" if _fresh(stamp) else "stale"
    elif published:
        item["data_timestamp"] = published
        item["provenance"]["data_timestamp"] = published
        item["current_or_historical"] = "undated"
    return item


def _rss_stamp(value: str | None) -> str | None:
    text = (value or "").strip()
    if not text:
        return None
    try:
        parsed = parsedate_to_datetime(text)
    except (TypeError, ValueError, IndexError):
        parsed = None
    if parsed is None:
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc).replace(microsecond=0).isoformat()


def _bitget_rows(path: str, symbol: str, timeout: float, get) -> list:
    try:
        response = _get(
            BITGET_REST + path,
            timeout=timeout,
            params={"symbol": symbol, "period": "1H", "productType": "USDT-FUTURES"},
            get=get,
        )
        body = response.json()
    except (httpx.HTTPError, ValueError, TypeError):
        return []
    if getattr(response, "status_code", 0) >= 400 or body.get("code") not in {None, "00000"}:
        return []
    data = body.get("data")
    return data if isinstance(data, list) else []


def _latest(rows: list) -> dict | None:
    best = None
    best_ts = -1
    for row in rows:
        if not isinstance(row, dict):
            continue
        try:
            ts = int(row.get("ts") or 0)
        except (TypeError, ValueError):
            ts = 0
        if ts >= best_ts:
            best_ts = ts
            best = row
    return best


def _num(value: object) -> float | None:
    try:
        if value is None or isinstance(value, bool):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _ms_stamp(value: object) -> str | None:
    try:
        ms = int(value)
    except (TypeError, ValueError):
        return None
    if ms <= 0:
        return None
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).replace(microsecond=0).isoformat()


def _fresh(stamp: str) -> bool:
    text = stamp.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return True
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - parsed).total_seconds() <= 2 * 24 * 3600
