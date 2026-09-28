import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from killlab.api import create_app
from killlab.config import settings_from_environ


def _spec():
    return {
        "family": "event_earnings",
        "instruments": ["NVDAUSDT"],
        "venue": "bitget_perp",
        "test_start": "2026-09-01",
        "test_end": "2026-09-28",
        "grain": "1H",
        "costs": {"perp_taker_bps": 6},
        "baselines": ["buy_and_hold"],
        "variants": [{"code": "continuation"}, {"code": "reversal"}],
        "selection": {"split": "IS"},
        "target_metric": "oos_mean_bps",
        "notional_usd": 10000,
        "seed": 1,
        "transforms": [],
        "risk": {},
        "claims_alpha": False,
        "event_kind": "none",
    }


@pytest.fixture(scope="module")
def client():
    app = create_app(settings_from_environ())
    return TestClient(app)


@pytest.fixture
def auth_header():
    settings = settings_from_environ()
    return {"Authorization": f"Bearer {settings.api_token}"}


def test_openapi_is_public(client):
    response = client.get("/v1/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/v1/runs" in paths
    assert "/health" in paths
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["db"] == "ok"


def test_missing_auth(client):
    response = client.post("/v1/hypotheses", json={"raw_text": "idea"})
    assert response.status_code == 401


def test_freeze_then_run_is_not_alive(client, auth_header):
    created = client.post("/v1/hypotheses", json={"raw_text": "Trade NVDA perps after earnings."}, headers=auth_header)
    assert created.status_code == 201
    hid = created.json()["id"]
    spec = client.post(f"/v1/hypotheses/{hid}/specs", json=_spec(), headers=auth_header)
    assert spec.status_code == 201, spec.text
    sha = spec.json()["content_sha256"]
    sid = spec.json()["test_spec_id"]
    frozen = client.post(
        f"/v1/test-specs/{sid}/freeze",
        json={"confirm": "FREEZE", "expected_sha256": sha},
        headers={**auth_header, "Idempotency-Key": str(uuid.uuid4())},
    )
    assert frozen.status_code == 201, frozen.text
    replay = client.post(
        f"/v1/test-specs/{sid}/freeze",
        json={"confirm": "FREEZE", "expected_sha256": sha},
        headers={**auth_header, "Idempotency-Key": frozen.request.headers.get("idempotency-key", "")},
    )
    # A second freeze without the same key must fail because the row is frozen.
    again = client.post(
        f"/v1/test-specs/{sid}/freeze",
        json={"confirm": "FREEZE", "expected_sha256": sha},
        headers={**auth_header, "Idempotency-Key": str(uuid.uuid4())},
    )
    assert again.status_code == 409
    run = client.post(
        "/v1/runs",
        json={"preregistration_id": frozen.json()["preregistration_id"]},
        headers={**auth_header, "Idempotency-Key": str(uuid.uuid4())},
    )
    assert run.status_code == 202, run.text
    verdict = client.get(f"/v1/runs/{run.json()['test_run_id']}/verdict", headers=auth_header)
    assert verdict.status_code == 200, verdict.text
    assert verdict.json()["label"] in {"KILLED", "UNTESTABLE"}
    assert verdict.json()["label"] != "ALIVE"
    assert "engine_computed" in verdict.json()
    rid = run.json()["test_run_id"]
    results = client.get(f"/v1/runs/{rid}/results", headers=auth_header)
    assert results.status_code == 200
    assert results.json()["label"] == verdict.json()["label"]
    assert "n_events" in results.json()
    traps = client.get(f"/v1/runs/{rid}/traps", headers=auth_header)
    assert traps.status_code == 200
    ledger = client.get(f"/v1/ledger?hypothesis_id={hid}", headers=auth_header)
    assert any(entry["stage"] == "DECISION" for entry in ledger.json()["entries"])
    private = client.post(
        f"/v1/hypotheses/{hid}/fills",
        json={"source": "bitget_private", "fills": []},
        headers=auth_header,
    )
    assert private.status_code == 422
    _ = replay


def test_bad_hash_rejected(client, auth_header):
    created = client.post("/v1/hypotheses", json={"raw_text": "another idea"}, headers=auth_header)
    hid = created.json()["id"]
    spec = client.post(f"/v1/hypotheses/{hid}/specs", json=_spec(), headers=auth_header)
    sid = spec.json()["test_spec_id"]
    frozen = client.post(
        f"/v1/test-specs/{sid}/freeze",
        json={"confirm": "FREEZE", "expected_sha256": "0" * 64},
        headers=auth_header,
    )
    assert frozen.status_code == 409


def test_database_blocks_frozen_update(client):
    settings = settings_from_environ()
    from killlab.db import make_engine
    engine = make_engine(settings.direct_url)
    with engine.connect() as conn:
        with pytest.raises(Exception):
            conn.execute(text("UPDATE killlab.test_specs SET status = 'draft' WHERE status = 'frozen'"))
            conn.commit()
        conn.rollback()
