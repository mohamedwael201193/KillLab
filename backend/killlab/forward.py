"""Re-run a frozen underpowered spec at most once per UTC day.

The freeze hash is not edited. A check that is still short of the family floor
does not create another scored run, so it does not inflate the trial count.
"""

from __future__ import annotations

from datetime import datetime, timezone


def accrual_window(now: datetime) -> str:
    return now.astimezone(timezone.utc).strftime("%Y-%m-%d")


def decide_forward(*, spec_sha256: str, frozen_sha256: str, window: str, seen: set[tuple[str, str]], preregistration_id: str, snapshot, card: dict | None) -> dict:
    if spec_sha256 != frozen_sha256:
        return {"action": "hash_mismatch", "preregistration_id": preregistration_id}
    key = (preregistration_id, window)
    if key in seen:
        return {"action": "duplicate", "preregistration_id": preregistration_id, "window": window}
    if snapshot is None or card is None:
        return {"action": "provider_failure", "preregistration_id": preregistration_id}
    if card.get("label") == "UNTESTABLE" and card.get("primary_trap") == "insufficient_units":
        return {"action": "below_floor", "stage": "FORWARD_CHECK", "preregistration_id": preregistration_id, "window": window}
    return {"action": "ran", "stage": "AUTO_RUN", "preregistration_id": preregistration_id, "window": window}


def sweep_forward(*, items: list[dict], seen: set[tuple[str, str]], now: datetime, pull, execute_fn) -> list[dict]:
    """items carry the frozen spec. pull and execute_fn are injected so tests do not touch Bitget."""
    window = accrual_window(now)
    actions = []
    for item in items:
        pre_id = str(item["preregistration_id"])
        if item["spec_sha256"] != item["frozen_sha256"] or (pre_id, window) in seen:
            actions.append(decide_forward(
                spec_sha256=item["spec_sha256"],
                frozen_sha256=item["frozen_sha256"],
                window=window,
                seen=seen,
                preregistration_id=pre_id,
                snapshot={},
                card={},
            ))
            continue
        snapshot = None
        card = None
        try:
            snapshot = pull(item["canonical"])
            card = execute_fn(item["canonical"], snapshot, item.get("prior_trials", 0), item.get("related_trials", 0))
        except Exception:
            snapshot = None
            card = None
        decision = decide_forward(
            spec_sha256=item["spec_sha256"],
            frozen_sha256=item["frozen_sha256"],
            window=window,
            seen=seen,
            preregistration_id=pre_id,
            snapshot=snapshot,
            card=card,
        )
        if decision["action"] in {"below_floor", "ran"}:
            seen.add((pre_id, window))
            decision["card"] = card
            decision["snapshot"] = snapshot
        actions.append(decision)
    return actions
