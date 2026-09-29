"""Attach research context after the engine has already decided."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

from killlab.data.bitget import NotFrozen
from killlab.integrations.bitget_mcp import equity_ticker, quote_evidence
from killlab.integrations.bitget_signal import route_skill, skill_evidence

_LOCKED = ("label", "dsr", "pbo", "ci_low", "ci_high", "n_units", "n_trials", "mechanism")


def enrich_context(
    *,
    frozen: bool,
    family: str | None,
    instruments: list,
    text: str,
    thesis: str | None = None,
    review: dict | None = None,
    fingerprint: str | None = None,
    timeout: float = 18.0,
    send=None,
) -> dict:
    if not frozen:
        raise NotFrozen("research context is refused before freeze")
    symbol = str(instruments[0]) if instruments else None
    routing = route_skill(text, family, thesis)
    outside = isinstance(review, dict) and review.get("object") == "unit" and review.get("inside_predictive") is False
    personalization = {
        "thesis_used": bool(thesis),
        "prior_fingerprint": fingerprint,
        "review_outside_range": outside,
        "changes": ["context", "next_question"],
        "changes_verdict": False,
    }

    def _quote():
        return quote_evidence(frozen=True, symbol=symbol, timeout=min(timeout, 12.0), send=send)

    def _skill():
        return skill_evidence(
            frozen=True,
            text=text,
            family=family,
            symbol=symbol,
            thesis=thesis,
            timeout=timeout,
            send=send,
        )

    items = []
    with ThreadPoolExecutor(max_workers=2) as pool:
        quote_job = pool.submit(_quote) if equity_ticker(symbol) else None
        skill_job = pool.submit(_skill)
        if quote_job is not None:
            try:
                quote = quote_job.result(timeout=timeout + 2)
            except Exception as exc:
                quote = None
                items.append({"source_type": "MCP_CONTEXT", "usable_for_verdict": False, "summary": type(exc).__name__})
            if quote:
                items.append(quote)
        try:
            skill = skill_job.result(timeout=timeout + 2)
        except Exception as exc:
            skill = None
            items.append({"source_type": "SKILL_CONTEXT", "usable_for_verdict": False, "summary": type(exc).__name__})
        if skill:
            items.append(skill)
    return {
        "status": "ok" if any(not item.get("provenance", {}).get("error") and item.get("summary") for item in items) else "unavailable",
        "routing": routing,
        "items": items,
        "personalization": personalization,
        "usable_for_verdict": False,
        "equity_ticker": equity_ticker(symbol),
    }


def attach_context(card: dict, context: dict) -> dict:
    """Copy context onto a finished card. Measured fields stay put."""
    frozen = {key: card.get(key) for key in _LOCKED}
    card["research_context"] = context
    for key, value in frozen.items():
        card[key] = value
    return card
