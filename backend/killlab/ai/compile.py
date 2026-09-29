"""Provider-independent hypothesis compiler.

The model may return a spec. It may not return a metric, a verdict, or an OOS split.
Qwen remains the intended provider when LLM_API_KEY is set. Other providers are temporary.
Gemini is never called.
"""

from __future__ import annotations

import json
import os
import re

import httpx

from killlab.ai.boundary import FORBIDDEN_KEYS, enforce_kill_floor, reject_forbidden

SYSTEM = (
    "You compile a trading hypothesis into one JSON object and nothing else. "
    "Allowed families: session_timing, event_earnings, carry_basis, execution_venue_time. "
    "If the idea is none of those, use family unsupported. "
    "Do not include sharpe, dsr, pbo, bps, pnl, n, verdict, or avoided_loss_bps. "
    "selection.split must be IS. claims_alpha must be false unless the text explicitly claims alpha. "
    "costs must include perp_taker_bps. "
    "carry_basis baselines must be earn_usdt and btc_eth_carry. "
    "Other families use baseline buy_and_hold. "
    "variants are a list of objects with a code. Do not invent a performance number."
)


class LLMUnavailable(RuntimeError):
    pass


def _providers() -> list[tuple[str, str, str]]:
    """(base_url, api_key, model) in call order. Gemini is excluded."""
    ordered: list[tuple[str, str, str]] = []
    qwen_key = os.environ.get("LLM_API_KEY", "").strip()
    if qwen_key:
        ordered.append(
            (
                os.environ.get("LLM_BASE_URL", "https://hackathon.bitgetops.com/v1").rstrip("/"),
                qwen_key,
                os.environ.get("LLM_MODEL", "qwen3.8-max"),
            )
        )
    catalog = {
        "groq": ("GROQ_BASE_URL", "GROQ_API_KEY", "GROQ_MODEL", "https://api.groq.com/openai/v1"),
        "cerebras": ("CEREBRAS_BASE_URL", "CEREBRAS_API_KEY", "CEREBRAS_MODEL", "https://api.cerebras.ai/v1"),
        "sambanova": ("SAMBANOVA_BASE_URL", "SAMBANOVA_API_KEY", "SAMBANOVA_MODEL", "https://api.sambanova.ai/v1"),
        "together": ("TOGETHER_BASE_URL", "TOGETHER_API_KEY", "TOGETHER_MODEL", "https://api.together.xyz/v1"),
        "openrouter": ("OPENROUTER_BASE_URL", "OPENROUTER_API_KEY", "OPENROUTER_MODEL", "https://openrouter.ai/api/v1"),
        "kimi": ("KIMI_BASE_URL", "KIMI_API_KEY", "KIMI_MODEL", "https://api.moonshot.ai/v1"),
    }
    names = [os.environ.get("AI_PRIMARY_PROVIDER", "groq").strip().lower()]
    names += [part.strip().lower() for part in os.environ.get("AI_FALLBACK_PROVIDERS", "").split(",") if part.strip()]
    seen = set()
    for name in names:
        if name in {"", "gemini", "qwen"} or name in seen or name not in catalog:
            continue
        seen.add(name)
        base_var, key_var, model_var, default_base = catalog[name]
        key = os.environ.get(key_var, "").strip()
        if not key:
            continue
        ordered.append((os.environ.get(base_var, default_base).rstrip("/"), key, os.environ.get(model_var, "")))
    return [item for item in ordered if item[2]]


def _extract_json(text: str) -> dict:
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("no_json")
    parsed = json.loads(text[start : end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("not_object")
    return parsed


_NAMES = ("NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "COIN", "MSTR", "SPY", "QQQ", "BTC", "ETH")
_FAMILIES = {"session_timing", "event_earnings", "carry_basis", "execution_venue_time", "unsupported"}


def family_from_text(raw_text: str, proposed_family: str | None) -> str:
    """Unambiguous mechanism words outrank a model guess."""
    if re.search(r"weekend|stockroute", raw_text, re.I):
        return "execution_venue_time"
    if re.search(r"earn|after[- ]hours", raw_text, re.I):
        return "event_earnings"
    if re.search(r"fund|carry|basis", raw_text, re.I):
        return "carry_basis"
    if re.search(r"session|first hour|cash open", raw_text, re.I):
        return "session_timing"
    if proposed_family in _FAMILIES:
        return proposed_family
    return "unsupported"


def normalize_draft(raw_text: str, proposed: dict) -> dict:
    """The model may name the family. The server owns costs, the split, and the floor."""
    if FORBIDDEN_KEYS.intersection(proposed):
        raise ValueError("forbidden metric fields")
    family = family_from_text(raw_text, proposed.get("family") if isinstance(proposed.get("family"), str) else None)
    upper = raw_text.upper()
    named = [f"{name}USDT" for name in _NAMES if name in upper]
    instruments = proposed.get("instruments") if isinstance(proposed.get("instruments"), list) else []
    instruments = [str(item) for item in instruments if isinstance(item, str) and item.strip()]
    if not instruments:
        instruments = named or ["NVDAUSDT"]
    variants = {
        "session_timing": [{"code": "continuation"}, {"code": "reversal"}],
        "event_earnings": [{"code": "continuation"}, {"code": "reversal"}],
        "carry_basis": [{"code": "receive"}],
        "execution_venue_time": [{"code": "NOW"}, {"code": "WAIT"}],
    }.get(family, [{"code": "none"}])
    from killlab.engine.costs import COST_SCHEDULE
    draft = {
        "family": family,
        "instruments": instruments,
        "venue": "bitget_perp",
        "test_start": "2026-07-01",
        "test_end": "2026-09-28",
        "grain": "1H",
        "costs": {"perp_taker_bps": COST_SCHEDULE["perp_taker_bps"]},
        "baselines": ["earn_usdt", "btc_eth_carry"] if family == "carry_basis" else ["buy_and_hold"],
        "variants": variants,
        "selection": {"split": "IS"},
        "target_metric": "oos_mean_bps",
        "notional_usd": 10000,
        "seed": 1,
        "transforms": [],
        "risk": {"sigma_span": "until_sunday_switch", "horizon_span": "until_sunday_switch", "alternatives": ["NOW", "WAIT"], "lambda_grid": [0.5]} if family == "execution_venue_time" else {},
        "claims_alpha": False,
        "event_kind": "none",
    }
    reject_forbidden(draft)
    return enforce_kill_floor(draft)


def compile_text(raw_text: str, timeout_s: float = 30) -> dict:
    providers = _providers()
    if not providers:
        raise LLMUnavailable("no_provider")
    last_error = "llm_unavailable"
    for base, key, model in providers:
        try:
            response = httpx.post(
                base + "/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "temperature": 0,
                    "messages": [
                        {"role": "system", "content": SYSTEM},
                        {"role": "user", "content": raw_text[:4000]},
                    ],
                },
                timeout=timeout_s,
            )
            if response.status_code >= 400:
                last_error = f"http_{response.status_code}"
                continue
            content = response.json()["choices"][0]["message"]["content"]
            draft = normalize_draft(raw_text, _extract_json(content))
            draft.pop("kill_floor", None)
            return draft
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
            last_error = type(exc).__name__
            continue
    raise LLMUnavailable(last_error)
