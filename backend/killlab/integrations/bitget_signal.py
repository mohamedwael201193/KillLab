"""Route one official research skill and call its data tool.

The skill package is an agent instruction set. KillLab keeps that routing and
issues the tool call the skill names. It does not invent the tool's answer.
"""

from __future__ import annotations

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


def route_skill(text: str, family: str | None, thesis: str | None = None) -> dict:
    blob = f"{text or ''} {thesis or ''}".lower()
    for skill, words in _RULES:
        if any(word in blob for word in words):
            return {"skill": skill, "reason": f"The frozen wording matches {skill}."}
    fallback = _FAMILY.get(family or "")
    if fallback:
        return {"skill": fallback, "reason": f"The frozen family {family} uses {fallback}."}
    return {"skill": None, "reason": "No research skill matches this frozen question."}


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
) -> dict | None:
    if not frozen:
        raise NotFrozen("research context is refused before freeze")
    decision = route_skill(text, family, thesis)
    skill = decision["skill"]
    if not skill:
        return None
    tool, arguments = _call_for(skill, symbol)
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
        query={"skill": skill, "reason": decision["reason"], **arguments},
        payload=payload,
        error=error,
    )
    item["skill"] = skill
    return item
