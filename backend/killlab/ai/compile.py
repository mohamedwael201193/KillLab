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
    "Allowed families: session_timing, event_earnings, carry_basis, basis_convergence, execution_venue_time, lead_lag. "
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
_FAMILIES = {"session_timing", "event_earnings", "carry_basis", "basis_convergence", "execution_venue_time", "lead_lag", "unsupported"}


def family_from_text(raw_text: str, proposed_family: str | None) -> str:
    """Unambiguous mechanism words outrank a model guess."""
    if re.search(r"\bleads?\b|\blags?\b", raw_text, re.I):
        return "lead_lag"
    if re.search(r"weekend|stockroute", raw_text, re.I):
        return "execution_venue_time"
    if re.search(r"earn|after[- ]hours", raw_text, re.I):
        return "event_earnings"
    if re.search(r"fund|carry", raw_text, re.I):
        return "carry_basis"
    if re.search(r"basis|converge|perp versus spot|perp vs spot", raw_text, re.I):
        return "basis_convergence"
    if re.search(r"cash close|closing hour|last cash hour|session|first hour|cash open|ny open|new york open", raw_text, re.I):
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
        "basis_convergence": [{"code": "fade"}],
        "execution_venue_time": [{"code": "NOW"}, {"code": "WAIT"}],
        "lead_lag": [{"code": "follow"}, {"code": "fade"}],
    }.get(family, [{"code": "none"}])
    from killlab.engine.costs import COST_SCHEDULE
    draft = {
        "family": family,
        "instruments": ["NVDAUSDT", "RNVDAUSDT"] if family == "basis_convergence" else instruments,
        "venue": "bitget_perp",
        "test_start": "2026-05-18",
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
        "risk": {"sigma_span": "until_sunday_switch", "horizon_span": "until_sunday_switch", "alternatives": ["NOW", "WAIT"], "lambda_grid": [0.5], "book_max_spread_bps": 50} if family == "execution_venue_time" else {},
        "claims_alpha": False,
        "event_kind": "none",
    }
    if family == "session_timing" and _cash_close(raw_text) and not _cash_open(raw_text):
        draft["session_hour"] = 15
    if family == "lead_lag":
        upper = raw_text.upper()
        coins = [name for name in ("BTC", "ETH") if name in upper]
        equities = [name for name in _NAMES if name not in {"BTC", "ETH"} and name in upper]
        draft["leader"] = f"{(coins or ['BTC'])[0]}USDT"
        draft["instruments"] = [f"{(equities or ['NVDA'])[0]}USDT"]
    reject_forbidden(draft)
    return enforce_kill_floor(draft)


def _cash_close(raw_text: str) -> bool:
    return re.search(r"cash close|closing hour|last cash hour", raw_text, re.I) is not None


def _cash_open(raw_text: str) -> bool:
    return re.search(r"first hour|cash open|ny open|new york open", raw_text, re.I) is not None


def _each_completion(messages: list[dict], timeout_s: float, accept):
    """Call providers in order. accept(content, model) may raise ValueError to try the next one."""
    providers = _providers()
    if not providers:
        raise LLMUnavailable("no_provider")
    last_error = "llm_unavailable"
    for base, key, model in providers:
        try:
            response = httpx.post(
                base + "/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": model, "temperature": 0, "messages": messages},
                timeout=timeout_s,
            )
            if response.status_code >= 400:
                last_error = f"http_{response.status_code}"
                continue
            content = response.json()["choices"][0]["message"]["content"]
            if not isinstance(content, str) or not content.strip():
                last_error = "invalid_response"
                continue
            return accept(content, model)
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
            last_error = type(exc).__name__ if not str(exc).startswith("http_") else str(exc)
            if isinstance(exc, ValueError) and str(exc).startswith("forbidden"):
                last_error = "schema_rejected"
            continue
    raise LLMUnavailable(last_error)


def complete_messages(messages: list[dict], timeout_s: float = 30) -> tuple[str, str]:
    """Return (assistant text, model name). The key stays in the process environment."""
    return _each_completion(messages, timeout_s, lambda content, model: (content, model))


def narrate(instruction: str, facts: dict, timeout_s: float = 30) -> dict:
    """Words from the model. Every number that is not already in facts is removed."""
    from killlab.ai.boundary import filter_explanation

    try:
        raw, model = complete_messages(
            [
                {
                    "role": "system",
                    "content": (
                        "Use only the JSON facts. Do not calculate Sharpe, DSR, PBO, a confidence interval, "
                        "PnL, costs, sample counts, or a verdict. If you mention a number, copy it from the JSON."
                    ),
                },
                {"role": "user", "content": instruction[:1000] + "\n" + json.dumps(facts, default=str)[:6000]},
            ],
            timeout_s=timeout_s,
        )
    except LLMUnavailable:
        raw, model = instruction, None
    return {"text": filter_explanation(raw, facts), "model": model, "numbers_locked": True}


def compile_text(raw_text: str, timeout_s: float = 30) -> dict:
    def accept(content: str, _model: str) -> dict:
        draft = normalize_draft(raw_text, _extract_json(content))
        draft.pop("kill_floor", None)
        return draft

    return _each_completion(
        [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": raw_text[:4000]},
        ],
        timeout_s,
        accept,
    )
