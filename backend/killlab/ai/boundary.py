"""LLM boundary. The compiler cannot emit metrics. Explanation may only cite engine fields."""

from __future__ import annotations

import re

from pydantic import BaseModel, ConfigDict, Field, ValidationError

FORBIDDEN_KEYS = {"sharpe", "dsr", "pbo", "bps", "pnl", "n", "verdict", "avoided_loss_bps"}


class TestSpecDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")
    family: str
    instruments: list[str] = Field(min_length=1)
    venue: str
    test_start: str
    test_end: str
    grain: str
    costs: dict
    baselines: list[str]
    variants: list[dict]
    selection: dict
    target_metric: str
    notional_usd: float
    seed: int
    transforms: list[str] = []
    risk: dict = {}
    event_kind: str = "none"
    claims_alpha: bool = True
    session_hour: int | None = None
    claimed_start: str | None = None


def reject_forbidden(document: dict) -> None:
    found = FORBIDDEN_KEYS.intersection(document.keys())
    if found:
        raise ValueError(f"forbidden metric fields: {sorted(found)}")
    try:
        TestSpecDraft.model_validate(document)
    except ValidationError as exc:
        raise ValueError(str(exc)) from exc


SKILL_NAMES = (
    "macro-analyst",
    "market-intel",
    "sentiment-analyst",
    "technical-analysis",
    "news-briefing",
)
SOURCE_NAMES = ("Bloomberg", "Reuters", "CoinDesk", "Cointelegraph")


def filter_explanation(text: str, engine_doc: dict) -> str:
    """Drop numbers, dates, skills, and sources that are not in the stored document."""
    allowed = set(re.findall(r"-?\d+(?:\.\d+)?", json_numbers(engine_doc)))
    def repl(match: re.Match) -> str:
        token = match.group(0)
        if token in allowed:
            return token
        return "[redacted]"
    cleaned = re.sub(r"-?\d+(?:\.\d+)?", repl, text)
    blob = json_numbers(engine_doc)
    for name in SKILL_NAMES:
        if name not in blob:
            cleaned = cleaned.replace(name, "[redacted]")
    for name in SOURCE_NAMES:
        if name not in blob:
            cleaned = cleaned.replace(name, "[redacted]")
    for label in ("ALIVE", "KILLED", "INCONCLUSIVE", "UNTESTABLE"):
        if label not in blob:
            cleaned = cleaned.replace(label, "[redacted]")
    book = engine_doc.get("book_capture") if isinstance(engine_doc.get("book_capture"), dict) else {}
    historical = book.get("historical", engine_doc.get("historical"))
    if historical is False:
        for phrase in ("historical order book", "historical l2", "historical depth"):
            cleaned = cleaned.replace(phrase, "[redacted]")
    return cleaned


def json_numbers(document: dict) -> str:
    import json
    return json.dumps(document)


def enforce_kill_floor(spec: dict) -> dict:
    """Server overwrites a weaker floor. Selection on OOS is rejected."""
    spec = dict(spec)
    selection = dict(spec.get("selection") or {})
    if selection.get("split") == "oos":
        raise ValueError("select_on_oos")
    selection["split"] = "IS"
    spec["selection"] = selection
    floor = dict(spec.get("kill_floor") or {})
    floor["dsr_gte"] = max(float(floor.get("dsr_gte", 0.95)), 0.95)
    floor["oos_sharpe_gte"] = max(float(floor.get("oos_sharpe_gte", 1.0)), 1.0)
    spec["kill_floor"] = floor
    if "median_ratio_within_regime" in (spec.get("transforms") or []):
        raise ValueError("effect_erase_transform")
    return spec
