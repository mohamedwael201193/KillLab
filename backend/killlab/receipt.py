"""Read-only research receipt and memory rows. No secrets, no thesis text."""

from __future__ import annotations

from killlab.hashutil import sha256_canonical

_CONTEXT_KEYS = ("source_class", "failure_class", "tool_name", "content_hash")


def build_receipt(card: dict, ledger: list[dict], engine_version: str | None = None) -> dict:
    context = card.get("research_context") if isinstance(card.get("research_context"), dict) else {}
    items = []
    for item in (context.get("items") or [])[:12]:
        if not isinstance(item, dict):
            continue
        items.append({key: item.get(key) for key in _CONTEXT_KEYS})
    body = {
        "spec_sha256": card.get("spec_sha256"),
        "snapshot_sha256": card.get("snapshot_sha256"),
        "engine_version": engine_version if engine_version is not None else card.get("engine_version"),
        "label": card.get("label"),
        "primary_trap": card.get("primary_trap"),
        "fingerprint": card.get("fingerprint"),
        "mechanism": card.get("mechanism"),
        "n_units": card.get("n_units"),
        "context_items": items,
        "ledger": [{"id": row.get("id"), "stage": row.get("stage")} for row in ledger if isinstance(row, dict)],
    }
    body["receipt_sha256"] = sha256_canonical(body)
    return body


def tried_row(run_id: str, created_at: str | None, card: dict, spec_sha256: str, relation: str) -> dict:
    units = card.get("n_units") if isinstance(card.get("n_units"), dict) else {}
    return {
        "run_id": run_id,
        "created_at": created_at,
        "label": card.get("label"),
        "primary_trap": card.get("primary_trap"),
        "n_units": units.get("n"),
        "spec_sha256": spec_sha256,
        "relation": relation,
    }


def forward_public(stage: str, created_at: str | None, body: dict) -> dict:
    safe = body if isinstance(body, dict) else {}
    digest = str(safe.get("spec_sha256") or "")
    return {
        "stage": stage,
        "created_at": created_at,
        "window": safe.get("window"),
        "n_units": safe.get("n_units"),
        "units_short": safe.get("units_short"),
        "label": safe.get("label"),
        "automatic": True if stage in {"AUTO_RUN", "FORWARD_CHECK"} else bool(safe.get("automatic")),
        "spec_sha256": digest[:16],
    }
