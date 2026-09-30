"""Route one official research skill and call its data tool.

The skill package is an agent instruction set. KillLab keeps that routing and
issues the tool call the skill names. It does not invent the tool's answer.
"""

from __future__ import annotations

from datetime import datetime, timezone

from killlab.data.bitget import NotFrozen
from killlab.integrations.evidence import evidence_object
from killlab.integrations.mcp_http import McpError, call_tool
from killlab.integrations import fallbacks

SIGNAL_URL = "https://datahub.noxiaohao.com/mcp"

SKILLS = (
    "macro-analyst",
    "market-intel",
    "sentiment-analyst",
    "technical-analysis",
    "news-briefing",
)

_RULES = (
    ("news-briefing", ("news", "headline", "breaking", "earnings", "catalyst", "what happened")),
    ("macro-analyst", ("macro", "fed", "cpi", "inflation", "dxy", "yield", "recession", "fomc", "rates", "invert", "treasury")),
    ("sentiment-analyst", ("fear", "greed", "funding", "long/short", "long short", "positioning", "sentiment", "crowd")),
    ("market-intel", ("etf", "whale", "institutional", "on-chain", "onchain", "tvl", "flow")),
    ("technical-analysis", ("rsi", "technical", "overbought", "support", "trend", "indicator", "session", "hour")),
)

_FAMILY = {
    "event_earnings": "news-briefing",
    "carry_basis": "sentiment-analyst",
    "basis_convergence": "technical-analysis",
    "session_timing": "technical-analysis",
    "lead_lag": "technical-analysis",
    "macro_regime": "macro-analyst",
}

_TECHNICAL_ACTIONS = ("rsi", "macd", "atr", "ema", "bollinger", "ma")


def route_skills(text: str, family: str | None, thesis: str | None = None) -> list[dict]:
    """At most two skills. The second is kept only when the wording names a different question."""
    blob = f"{text or ''} {thesis or ''}".lower()
    chosen: list[dict] = []
    seen: set[str] = set()
    for skill, words in _RULES:
        if skill in seen or not any(word in blob for word in words):
            continue
        chosen.append({
            "skill": skill,
            "role": "primary" if not chosen else "secondary",
            "reason": f"The frozen wording matches {skill}.",
        })
        seen.add(skill)
        if len(chosen) == 2:
            break
    if chosen:
        return chosen
    fallback = _FAMILY.get(family or "")
    if fallback:
        return [{"skill": fallback, "role": "primary", "reason": f"The frozen family {family} uses {fallback}."}]
    return []


def route_skill(text: str, family: str | None, thesis: str | None = None) -> dict:
    chosen = route_skills(text, family, thesis)
    if not chosen:
        return {"skill": None, "reason": "No research skill matches this frozen question."}
    return chosen[0]


def _calls_for(skill: str, symbol: str | None, text: str = "") -> list[tuple[str, dict]]:
    pair = symbol or "BTCUSDT"
    blob = (text or "").lower()
    if skill == "macro-analyst":
        return [("rates_yields", {"action": "rates_snapshot"})]
    if skill == "market-intel":
        return [("derivatives_sentiment", {"action": "top_ls", "symbol": pair, "period": "4h"})]
    if skill == "sentiment-analyst":
        return [("sentiment_index", {"action": "current"})]
    if skill == "news-briefing":
        if any(word in blob for word in ("fed", "fomc", "cpi", "macro", "rate")):
            return [("news_feed", {"action": "latest", "feeds": "cnbc,fed", "keyword": "Fed", "limit": 5})]
        return [("news_feed", {"action": "latest", "feeds": "cointelegraph,coindesk", "limit": 5})]
    return [("technical_analysis", {"action": action, "symbol": pair}) for action in _TECHNICAL_ACTIONS]


def skill_evidence(
    *,
    frozen: bool,
    text: str,
    family: str | None,
    symbol: str | None,
    thesis: str | None = None,
    timeout: float = 18.0,
    send=None,
    fallback=None,
) -> list[dict]:
    if not frozen:
        raise NotFrozen("research context is refused before freeze")
    items = []
    for decision in route_skills(text, family, thesis):
        for tool, arguments in _calls_for(decision["skill"], symbol, f"{text or ''} {thesis or ''}"):
            items.append(_one_skill(decision, tool, arguments, symbol=symbol, timeout=timeout, send=send))
        if _needs_fallback(decision["skill"], items):
            extras = _fallback_rows(decision["skill"], symbol=symbol, text=text or "", timeout=timeout, send=send, fallback=fallback)
            items.extend(extras)
    return items


def _one_skill(decision: dict, tool: str, arguments: dict, *, symbol: str | None, timeout: float, send) -> dict:
    skill = decision["skill"]
    requested = datetime.now(timezone.utc).replace(microsecond=0)
    started = requested.timestamp()
    reply_sha = None
    try:
        result = call_tool(SIGNAL_URL, tool, arguments, timeout=timeout, send=send)
        payload = result["data"]
        reply_sha = result.get("reply_sha256") if isinstance(result.get("reply_sha256"), str) else None
        error = None
        kind = classify_skill_result(None, payload, tool)
    except McpError as exc:
        payload = {}
        error = exc.reason
        kind = exc.kind
    item = evidence_object(
        source_type="SKILL_CONTEXT",
        provider="bitget-signal",
        tool_name=tool,
        symbol=symbol,
        query={"skill": skill, "role": decision["role"], "reason": decision["reason"], **arguments},
        payload=payload,
        error=error,
        source_url=SIGNAL_URL,
        requested_at=requested.isoformat(),
        latency_ms=int((datetime.now(timezone.utc).timestamp() - started) * 1000),
        failure_class=kind,
        source_class="official_signal_mcp",
    )
    item["skill"] = skill
    item["source_class"] = "official_signal_mcp"
    item["failure_class"] = kind
    if reply_sha:
        item["content_hash"] = reply_sha
        item["payload_hash"] = reply_sha
    item.pop("excerpt", None)
    item.pop("raw", None)
    if tool == "rates_yields" and not error and _rates_without_tenors(payload):
        item["summary"] = "The official rates tool returned no tenor levels."
        item["textual_summary"] = item["summary"]
        item["structured_data"] = {}
        item["current_or_historical"] = "unknown"
    if tool == "news_feed" and not error and _feeds_all_errored(payload):
        item["summary"] = "Every named feed returned an error."
        item["textual_summary"] = item["summary"]
        item["failure_class"] = "feed_error_all"
        item["current_or_historical"] = "unknown"
        item["structured_data"] = {}
    elif tool == "news_feed" and not error and _no_articles(payload):
        item["summary"] = "No major developments reported by the source."
        item["textual_summary"] = item["summary"]
        item["current_or_historical"] = "unknown"
        item["structured_data"] = {}
    if tool == "technical_analysis" and not error and _indicator_without_reading(payload):
        item["summary"] = "The official indicator tool returned no reading."
        item["textual_summary"] = item["summary"]
        item["structured_data"] = {}
        item["current_or_historical"] = "unknown"
    return item


def _rates_without_tenors(payload: object) -> bool:
    if not isinstance(payload, dict):
        return False
    curve = payload.get("yield_curve")
    if not isinstance(curve, dict) or not curve:
        return "yield_curve_inverted" in payload and not any(
            isinstance(value, (int, float)) and not isinstance(value, bool) for value in payload.values()
        )
    for value in curve.values():
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return False
        if isinstance(value, dict) and any(isinstance(item, (int, float)) and not isinstance(item, bool) for item in value.values()):
            return False
    return True


def _indicator_without_reading(payload: object) -> bool:
    if not isinstance(payload, dict):
        return True
    if payload.get("error") and not any(
        isinstance(value, (int, float)) and not isinstance(value, bool) for value in payload.values()
    ):
        return True
    return not any(isinstance(value, (int, float)) and not isinstance(value, bool) for value in payload.values())


def _feeds_all_errored(payload: object) -> bool:
    rows = payload.get("feeds") if isinstance(payload, dict) else payload
    if not isinstance(rows, list) or not rows:
        return False
    for row in rows:
        if not isinstance(row, dict) or not row.get("error"):
            return False
        if row.get("items") or row.get("articles") or row.get("title"):
            return False
    return True


def _no_articles(payload: object) -> bool:
    rows = payload if isinstance(payload, list) else [payload]
    if not rows:
        return True
    for row in rows:
        if isinstance(row, dict) and (row.get("items") or row.get("articles")):
            return False
        if isinstance(row, dict) and row.get("title"):
            return False
    return True


def classify_skill_result(error: str | None, payload: object, tool: str) -> str:
    if error:
        if error == "timeout":
            return "timeout"
        if error == "empty result":
            return "empty_result"
        if "session" in error:
            return "session_error"
        if "malformed" in error:
            return "malformed_response"
        return "transport_error"
    if tool == "rates_yields" and _rates_without_tenors(payload):
        return "empty_result"
    if tool == "news_feed" and _feeds_all_errored(payload):
        return "feed_error_all"
    if tool == "news_feed" and _no_articles(payload):
        return "empty_result"
    if isinstance(payload, dict):
        message = str(payload.get("error") or "")
        if "Unknown action" in message:
            return "unsupported_action"
        if message and _indicator_without_reading(payload):
            return "empty_result"
    if tool in {"technical_analysis", "sentiment_index", "derivatives_sentiment"} and _indicator_without_reading(
        payload if isinstance(payload, dict) else {}
    ):
        return "empty_result"
    if _has_numeric_fields(payload):
        return "valid_data"
    return "empty_result"


def _has_numeric_fields(payload: object) -> bool:
    if isinstance(payload, dict):
        return any(isinstance(value, (int, float)) and not isinstance(value, bool) for value in payload.values()) or any(
            isinstance(value, dict) and _has_numeric_fields(value) for value in payload.values()
        )
    if isinstance(payload, list):
        return any(_has_numeric_fields(item) for item in payload[:4])
    return False


def _needs_fallback(skill: str, items: list[dict]) -> bool:
    if skill == "technical-analysis":
        return False
    owned = [item for item in items if item.get("skill") == skill]
    if not owned:
        return True
    return all(item.get("failure_class") != "valid_data" for item in owned)


def _fallback_rows(skill: str, *, symbol: str | None, text: str, timeout: float, send, fallback) -> list[dict]:
    if fallback is False:
        return []
    if callable(fallback):
        return list(fallback(skill, symbol, text) or [])
    if send is not None:
        return []
    return fallbacks.for_skill(skill, frozen=True, symbol=symbol, text=text, timeout=min(timeout, 12.0))
