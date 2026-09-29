"""Route one official research skill and call its data tool.

The skill package is an agent instruction set. KillLab keeps that routing and
issues the tool call the skill names. It does not invent the tool's answer.
"""

from __future__ import annotations

from datetime import datetime, timezone

from killlab.data.bitget import NotFrozen
from killlab.integrations.evidence import evidence_object
from killlab.integrations.mcp_http import McpError, call_tool

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
    ("macro-analyst", ("macro", "fed", "cpi", "inflation", "dxy", "yield", "recession", "fomc", "rates")),
    ("sentiment-analyst", ("fear", "greed", "funding", "long/short", "long short", "positioning", "sentiment", "crowd")),
    ("market-intel", ("etf", "whale", "institutional", "on-chain", "onchain", "tvl", "flow")),
    ("technical-analysis", ("rsi", "technical", "overbought", "support", "trend", "indicator", "session", "hour")),
)

_FAMILY = {
    "event_earnings": "news-briefing",
    "carry_basis": "sentiment-analyst",
    "basis_convergence": "technical-analysis",
    "session_timing": "technical-analysis",
}


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


def _call_for(skill: str, symbol: str | None) -> tuple[str, dict]:
    pair = symbol or "BTCUSDT"
    if skill == "macro-analyst":
        return "rates_yields", {"action": "rates_snapshot"}
    if skill == "market-intel":
        return "news_feed", {"action": "latest", "feeds": "cointelegraph", "keyword": "ETF", "limit": 5}
    if skill == "sentiment-analyst":
        return "sentiment_index", {"action": "current"}
    if skill == "news-briefing":
        return "news_feed", {"action": "latest", "feeds": "cointelegraph,coindesk", "limit": 5}
    return "technical_analysis", {"action": "rsi", "symbol": pair}


def skill_evidence(
    *,
    frozen: bool,
    text: str,
    family: str | None,
    symbol: str | None,
    thesis: str | None = None,
    timeout: float = 18.0,
    send=None,
) -> list[dict]:
    if not frozen:
        raise NotFrozen("research context is refused before freeze")
    items = []
    for decision in route_skills(text, family, thesis):
        items.append(_one_skill(decision, symbol=symbol, timeout=timeout, send=send))
    return items


def _one_skill(decision: dict, *, symbol: str | None, timeout: float, send) -> dict:
    skill = decision["skill"]
    tool, arguments = _call_for(skill, symbol)
    requested = datetime.now(timezone.utc).replace(microsecond=0)
    started = requested.timestamp()
    try:
        result = call_tool(SIGNAL_URL, tool, arguments, timeout=timeout, send=send)
        payload = result["data"]
        error = None
    except McpError as exc:
        payload = {}
        error = exc.reason
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
    )
    item["skill"] = skill
    if tool == "news_feed" and not error and _no_articles(payload):
        item["summary"] = "The official news tool answered with no articles."
        item["textual_summary"] = item["summary"]
        item["current_or_historical"] = "unknown"
        item["structured_data"] = {}
    return item


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
