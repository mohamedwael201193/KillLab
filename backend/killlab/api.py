"""KillLab HTTP API. No order routes."""

from __future__ import annotations

import hmac
import logging
import sys
import uuid
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from killlab.ai.boundary import enforce_kill_floor, filter_explanation, reject_forbidden
from killlab.ai.compile import LLMUnavailable, compile_text
from killlab.config import Settings, settings_from_environ
from killlab.data.bitget import BitgetError, BitgetRest, NotFrozen
from killlab.data.earnings import align_events, classify_event_times, earnings_timestamps_ms, symbol_for, tag_events
from killlab.db import session_factory
from killlab.engine.review import evolution_state, is_related_research, killed_decision, reconcile_unit, research_fingerprint, realized_from_fills
from killlab.guard import fixtures_loaded
from killlab.hashutil import sha256_canonical
from killlab.logjson import log_event
from killlab.ratelimit import allow, client_key
from killlab.recover import interrupted_if_stale
from killlab.models import (
    ENGINE_VERSION,
    Fill,
    Hypothesis,
    IdempotencyKey,
    LedgerEntry,
    Preregistration,
    TestRun,
    TestSpec,
)
from killlab.runner import execute

log = logging.getLogger("killlab")
_HITS: dict[str, list[float]] = defaultdict(list)


class HypothesisIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    raw_text: str = Field(min_length=1, max_length=4000)


class FreezeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirm: str
    expected_sha256: str


class RunIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    preregistration_id: str


class FillsIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source: str
    fills: list[dict]


def _fail_stale_runs(factory, stale_minutes: int) -> int:
    session = factory()
    try:
        rows = session.scalars(select(TestRun).where(TestRun.status == "running")).all()
        changed = 0
        now = datetime.now(timezone.utc)
        for row in rows:
            created = row.created_at
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            age = (now - created).total_seconds() / 60
            if interrupted_if_stale(age, stale_minutes):
                row.status = "failed"
                row.error_code = "interrupted"
                changed += 1
        if changed:
            session.commit()
        return changed
    finally:
        session.close()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or settings_from_environ()
    if settings.production and fixtures_loaded(tuple(sys.modules)):
        raise RuntimeError("production process cannot import test fixtures")
    factory, _engine = session_factory(settings)
    _fail_stale_runs(factory, settings.run_stale_minutes)
    app = FastAPI(title="KillLab", version=ENGINE_VERSION, openapi_url="/v1/openapi.json")

    @app.middleware("http")
    async def access_log(request: Request, call_next):
        response = await call_next(request)
        log_event("request", path=request.url.path, status=response.status_code, engine_version=ENGINE_VERSION)
        return response

    @app.exception_handler(APIError)
    def _api_error(_request: Request, exc: APIError):
        return JSONResponse({"error": {"code": exc.code, "message": exc.message}}, status_code=exc.status)

    if settings.frontend_origin:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[settings.frontend_origin],
            allow_methods=["GET", "POST", "PUT"],
            allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
        )

    def db() -> Session:
        session = factory()
        try:
            yield session
        finally:
            session.close()

    def auth(authorization: str | None = Header(default=None)) -> None:
        if not authorization or not authorization.startswith("Bearer "):
            raise _error(401, "unauthorized")
        token = authorization.removeprefix("Bearer ").strip()
        if not settings.api_token or not hmac.compare_digest(token, settings.api_token):
            raise _error(403, "forbidden")

    def limit(request: Request, authorization: str | None = Header(default=None)) -> None:
        now = datetime.now(timezone.utc).timestamp()
        key = client_key(request.url.path, authorization)
        bucket = _HITS.setdefault(key, [])
        cap = 10 if request.url.path.endswith("/runs") else 30
        if not allow(bucket, now, 3600, cap):
            raise _error(429, "rate_limited")

    @app.get("/health")
    def health():
        session = factory()
        try:
            session.execute(text("select 1"))
            return {"status": "ok", "db": "ok", "engine_version": ENGINE_VERSION}
        except Exception:
            return JSONResponse({"status": "down", "db": "down", "engine_version": ENGINE_VERSION}, status_code=503)
        finally:
            session.close()

    @app.post("/v1/hypotheses", status_code=201)
    def create_hypothesis(body: HypothesisIn, session: Session = Depends(db), _: None = Depends(auth)):
        hid = uuid.uuid4()
        row = Hypothesis(id=hid, raw_text=body.raw_text, family=None)
        session.add(row)
        session.add(LedgerEntry(hypothesis_id=hid, stage="KNOWN", body={"raw_text": body.raw_text}))
        session.commit()
        return {"id": str(row.id), "family": None, "status": "stored"}

    @app.post("/v1/hypotheses/{hypothesis_id}/compile")
    def compile_spec(hypothesis_id: str, session: Session = Depends(db), _: None = Depends(auth)):
        row = session.get(Hypothesis, uuid.UUID(hypothesis_id))
        if row is None:
            raise _error(404, "not_found")
        try:
            draft = compile_text(row.raw_text, timeout_s=settings.llm_timeout_s)
        except LLMUnavailable:
            return JSONResponse({"error": {"code": "llm_unavailable", "message": "manual spec accepted"}, "manual_spec_accepted": True}, status_code=503)
        return {"manual_spec_accepted": False, "draft": draft}

    @app.put("/v1/test-specs/{spec_id}")
    def update_spec(spec_id: str, body: dict, session: Session = Depends(db), _: None = Depends(auth)):
        row = session.get(TestSpec, uuid.UUID(spec_id))
        if row is None:
            raise _error(404, "not_found")
        if row.status == "frozen":
            raise _error(409, "not_frozen" if False else "frozen")
        try:
            reject_forbidden(body)
            cleaned = enforce_kill_floor(body)
        except ValueError as exc:
            raise _error(422, "validation", str(exc)) from exc
        row.canonical_json = cleaned
        row.content_sha256 = sha256_canonical(cleaned)
        session.commit()
        return {"id": spec_id, "status": row.status, "content_sha256": row.content_sha256}

    @app.post("/v1/hypotheses/{hypothesis_id}/specs", status_code=201)
    def create_spec(hypothesis_id: str, body: dict, session: Session = Depends(db), _: None = Depends(auth)):
        prior = session.scalars(select(LedgerEntry).where(LedgerEntry.hypothesis_id == uuid.UUID(hypothesis_id)).order_by(LedgerEntry.created_at)).all()
        entries = [{"stage": row.stage, "body": row.body} for row in prior]
        contradicts = body.pop("contradicts", None) if isinstance(body, dict) else None
        if killed_decision(entries) and not contradicts:
            raise _error(409, "already_killed")
        try:
            reject_forbidden(body)
            cleaned = enforce_kill_floor(body)
        except ValueError as exc:
            raise _error(422, "validation", str(exc)) from exc
        row = TestSpec(
            hypothesis_id=uuid.UUID(hypothesis_id),
            status="draft",
            canonical_json=cleaned,
            content_sha256=sha256_canonical(cleaned),
        )
        session.add(row)
        session.commit()
        return {"test_spec_id": str(row.id), "status": "draft", "content_sha256": row.content_sha256}

    @app.post("/v1/test-specs/{spec_id}/freeze", status_code=201)
    def freeze(spec_id: str, body: FreezeIn, session: Session = Depends(db), _: None = Depends(auth), key: str | None = Header(default=None, alias="Idempotency-Key")):
        cached = _idempotent(session, key)
        if cached:
            return JSONResponse(cached[0], status_code=cached[1])
        row = session.get(TestSpec, uuid.UUID(spec_id))
        if row is None:
            raise _error(404, "not_found")
        if body.confirm != "FREEZE":
            raise _error(422, "validation")
        if body.expected_sha256 != row.content_sha256:
            raise _error(409, "hash_mismatch")
        if row.status == "frozen":
            raise _error(409, "frozen")
        row.status = "frozen"
        pre = Preregistration(
            test_spec_id=row.id,
            frozen_at=datetime.now(timezone.utc),
            spec_sha256=row.content_sha256,
            confirm_phrase="FREEZE",
        )
        session.add(pre)
        session.add(LedgerEntry(hypothesis_id=row.hypothesis_id, stage="UNKNOWN", body={"kill_floor": row.canonical_json.get("kill_floor")}))
        session.commit()
        payload = {"preregistration_id": str(pre.id), "frozen_at": pre.frozen_at.isoformat(), "spec_sha256": pre.spec_sha256}
        _store_idempotent(session, key, payload, 201)
        return payload

    @app.post("/v1/runs", status_code=202)
    def start_run(body: RunIn, session: Session = Depends(db), _: None = Depends(auth), __: None = Depends(limit), key: str | None = Header(default=None, alias="Idempotency-Key")):
        cached = _idempotent(session, key)
        if cached:
            return JSONResponse(cached[0], status_code=cached[1])
        pre = session.get(Preregistration, uuid.UUID(body.preregistration_id))
        if pre is None:
            raise _error(409, "not_frozen")
        spec = session.get(TestSpec, pre.test_spec_id)
        if spec is None or spec.status != "frozen" or spec.content_sha256 != pre.spec_sha256:
            raise _error(409, "hash_mismatch")
        run = TestRun(
            preregistration_id=pre.id,
            status="running",
            spec_sha256=spec.content_sha256,
            engine_version=ENGINE_VERSION,
        )
        session.add(run)
        session.commit()
        try:
            client = BitgetRest(settings)
            venue = spec.canonical_json.get("venue")
            product = "USDT-FUTURES" if venue == "bitget_perp" else "SPOT"
            pages = 8 if spec.canonical_json.get("family") in {"event_earnings", "execution_venue_time", "carry_basis", "basis_convergence", "session_timing"} else 3
            snapshot = None
            events = []
            failures = 0
            for instrument in spec.canonical_json["instruments"]:
                symbol = symbol_for(instrument, venue or "")
                leg_product = product
                if spec.canonical_json.get("family") == "basis_convergence" and symbol.upper().startswith("R"):
                    leg_product = "SPOT"
                try:
                    pulled = client.history_candles(frozen=True, product=leg_product, symbol=symbol, pages=pages)
                except BitgetError:
                    failures += 1
                    continue
                if snapshot is None:
                    snapshot = pulled
                else:
                    if pulled.get("actual_first") and (
                        snapshot.get("actual_first") is None or pulled["actual_first"] < snapshot["actual_first"]
                    ):
                        snapshot["actual_first"] = pulled["actual_first"]
                    if pulled.get("actual_last") and (
                        snapshot.get("actual_last") is None or pulled["actual_last"] > snapshot["actual_last"]
                    ):
                        snapshot["actual_last"] = pulled["actual_last"]
                    rank = {"short_page": 0, "empty_page": 1, "page_cap": 2}
                    if rank.get(pulled.get("pagination_stop"), 0) > rank.get(snapshot.get("pagination_stop"), 0):
                        snapshot["pagination_stop"] = pulled["pagination_stop"]
                        snapshot["pages_requested"] = pulled.get("pages_requested")
                        snapshot["pages_fetched"] = pulled.get("pages_fetched")
                if spec.canonical_json.get("family") == "event_earnings":
                    stamps = earnings_timestamps_ms(symbol)
                    classified = classify_event_times(pulled.get("rows") or [], stamps)
                    snapshot["events_outside_tape"] = int(snapshot.get("events_outside_tape") or 0) + classified["outside"]
                    snapshot["events_short_horizon"] = int(snapshot.get("events_short_horizon") or 0) + classified["short_horizon"]
                    snapshot["events_aligned"] = int(snapshot.get("events_aligned") or 0) + classified["aligned"]
                    events.extend(tag_events(align_events(pulled.get("rows") or [], stamps), symbol))
                if spec.canonical_json.get("family") == "basis_convergence" and leg_product == "SPOT":
                    snapshot["spot_rows"] = list(pulled.get("rows") or [])
                    if snapshot.get("rows") is pulled.get("rows"):
                        snapshot["rows"] = []
                elif spec.canonical_json.get("family") == "basis_convergence":
                    snapshot["rows"] = list(pulled.get("rows") or [])
                if spec.canonical_json.get("family") == "carry_basis":
                    try:
                        funding = client.history_funding(frozen=True, symbol=symbol)
                    except BitgetError:
                        funding = {"rows": []}
                    snapshot.setdefault("funding", [])
                    snapshot["funding"].extend(funding.get("rows") or [])
            if snapshot is None:
                raise BitgetError(f"no symbol ({failures} failed)")
            try:
                book = client.ticker(frozen=True, symbol=symbol_for(spec.canonical_json["instruments"][0], venue or ""))
            except (BitgetError, IndexError):
                book = None
            if book:
                snapshot["book_observation"] = book
            if spec.canonical_json.get("family") == "event_earnings":
                snapshot["events"] = events
            fingerprint = research_fingerprint(spec.canonical_json)
            prior = 0
            related = 0
            specs_by_hash: dict = {}
            for previous in session.scalars(select(TestRun).where(TestRun.result_json.is_not(None))):
                if (previous.result_json or {}).get("fingerprint") == fingerprint:
                    prior += 1
                    continue
                prev_spec = specs_by_hash.get(previous.spec_sha256)
                if prev_spec is None and previous.spec_sha256:
                    prev_spec = session.scalar(select(TestSpec).where(TestSpec.content_sha256 == previous.spec_sha256))
                    specs_by_hash[previous.spec_sha256] = prev_spec
                if prev_spec is not None and is_related_research(spec.canonical_json, prev_spec.canonical_json):
                    related += 1
            snapshot["requested_start"] = spec.canonical_json.get("test_start")
            card = execute(
                {**spec.canonical_json, "content_sha256": spec.content_sha256},
                snapshot,
                prior_trials=prior,
                related_trials=related,
            )
            card["fingerprint"] = fingerprint
            log_event("verdict", label=card.get("label"), primary_trap=card.get("primary_trap"), run_id=str(run.id))
            run.status = "untestable" if card["label"] == "UNTESTABLE" else "succeeded"
            run.result_json = card
            session.add(LedgerEntry(hypothesis_id=spec.hypothesis_id, test_run_id=run.id, stage="RESULT", body={"label": card["label"]}))
            session.add(LedgerEntry(hypothesis_id=spec.hypothesis_id, test_run_id=run.id, stage="DECISION", body={"label": card["label"], "primary_trap": card["primary_trap"]}))
        except (BitgetError, NotFrozen) as exc:
            run.status = "failed"
            run.error_code = "bitget_unavailable" if isinstance(exc, BitgetError) else "not_frozen"
        session.commit()
        payload = {"test_run_id": str(run.id), "status": run.status}
        _store_idempotent(session, key, payload, 202)
        return payload

    @app.get("/v1/runs/{run_id}")
    def run_status(run_id: str, session: Session = Depends(db), _: None = Depends(auth)):
        row = session.get(TestRun, uuid.UUID(run_id))
        if row is None:
            raise _error(404, "not_found")
        return {"status": row.status, "error_code": row.error_code, "engine_version": row.engine_version}

    @app.get("/v1/runs/{run_id}/results")
    def results(run_id: str, session: Session = Depends(db), _: None = Depends(auth)):
        row = session.get(TestRun, uuid.UUID(run_id))
        if row is None or row.result_json is None:
            raise _error(409, "not_ready")
        card = row.result_json
        return {
            "label": card.get("label"),
            "dsr": card.get("dsr"),
            "pbo": card.get("pbo"),
            "n_units": card.get("n_units"),
            "n_events": card.get("n_events"),
            "ci_low": card.get("ci_low"),
            "ci_high": card.get("ci_high"),
            "actual_first": card.get("actual_first"),
            "engine_version": row.engine_version,
        }

    @app.get("/v1/runs/{run_id}/verdict")
    def verdict(run_id: str, session: Session = Depends(db), _: None = Depends(auth)):
        row = session.get(TestRun, uuid.UUID(run_id))
        if row is None or row.result_json is None:
            raise _error(409, "not_ready")
        return row.result_json

    @app.get("/v1/runs/{run_id}/traps")
    def traps(run_id: str, session: Session = Depends(db), _: None = Depends(auth)):
        row = session.get(TestRun, uuid.UUID(run_id))
        if row is None or row.result_json is None:
            raise _error(409, "not_ready")
        return {"findings": row.result_json.get("findings") or []}

    @app.get("/v1/runs/{run_id}/evidence")
    def evidence(run_id: str, session: Session = Depends(db), _: None = Depends(auth)):
        row = session.get(TestRun, uuid.UUID(run_id))
        if row is None or row.result_json is None:
            raise _error(409, "not_ready")
        return {"snapshot_sha256": row.result_json.get("snapshot_sha256"), "actual_first": row.result_json.get("actual_first"), "engine_version": row.engine_version}

    @app.get("/v1/ledger")
    def ledger(hypothesis_id: str, session: Session = Depends(db), _: None = Depends(auth)):
        rows = session.scalars(select(LedgerEntry).where(LedgerEntry.hypothesis_id == uuid.UUID(hypothesis_id)).order_by(LedgerEntry.created_at)).all()
        return {"entries": [{"id": str(r.id), "stage": r.stage, "body": r.body, "test_run_id": str(r.test_run_id) if r.test_run_id else None} for r in rows]}

    @app.post("/v1/ledger/{entry_id}/next")
    def propose_next(entry_id: str, session: Session = Depends(db), _: None = Depends(auth)):
        row = session.get(LedgerEntry, uuid.UUID(entry_id))
        if row is None or row.stage != "DECISION":
            raise _error(404, "not_found")
        trap = (row.body or {}).get("primary_trap") or (row.body or {}).get("label")
        card = {}
        if row.test_run_id:
            run = session.get(TestRun, row.test_run_id)
            card = dict(run.result_json or {}) if run else {}
        proposal = evolution_state(card, trap)
        return proposal

    @app.post("/v1/hypotheses/{hypothesis_id}/fills", status_code=201)
    def fills(hypothesis_id: str, body: FillsIn, session: Session = Depends(db), _: None = Depends(auth)):
        if body.source == "bitget_private":
            raise _error(422, "private_fills_not_configured")
        if body.source not in {"pasted", "paper_log"}:
            raise _error(422, "validation")
        row = Fill(hypothesis_id=uuid.UUID(hypothesis_id), source=body.source, body={"fills": body.fills})
        session.add(row)
        session.commit()
        return {"id": str(row.id)}

    @app.post("/v1/runs/{run_id}/reconcile")
    def reconcile(run_id: str, body: dict, session: Session = Depends(db), _: None = Depends(auth)):
        run = session.get(TestRun, uuid.UUID(run_id))
        if run is None or not run.result_json:
            raise _error(409, "not_ready")
        fill_ids = body.get("fill_ids") or []
        realized = body.get("realized_bps")
        if realized is None:
            pasted = []
            for fill_id in fill_ids:
                row = session.get(Fill, uuid.UUID(fill_id))
                if row and row.body:
                    pasted.extend(row.body.get("fills") or [])
            if len(pasted) < 2:
                raise _error(422, "validation")
            realized = realized_from_fills(pasted)
            if realized is None:
                raise _error(422, "validation")
        before = dict(run.result_json)
        review = reconcile_unit(float(realized), run.result_json.get("unit_p05"), run.result_json.get("unit_p95"))
        if review.get("status") == "no_forecast":
            raise _error(409, "no_forecast")
        if run.result_json != before:
            raise _error(500, "frozen_mutated")
        pre = session.get(Preregistration, run.preregistration_id)
        spec_row = session.get(TestSpec, pre.test_spec_id) if pre else None
        if spec_row is not None:
            session.add(LedgerEntry(hypothesis_id=spec_row.hypothesis_id, test_run_id=run.id, stage="REVIEW", body={"fingerprint": before.get("fingerprint"), "object": "unit", "inside_predictive": review.get("inside_predictive")}))
            session.commit()
        return review

    @app.post("/v1/runs/{run_id}/explain")
    def explain(run_id: str, body: dict, session: Session = Depends(db), _: None = Depends(auth)):
        row = session.get(TestRun, uuid.UUID(run_id))
        if row is None or not row.result_json:
            raise _error(409, "not_ready")
        text_in = str(body.get("text") or "")
        return {"summary": filter_explanation(text_in, row.result_json)}

    return app


class APIError(Exception):
    def __init__(self, status: int, code: str, message: str = ""):
        self.status = status
        self.code = code
        self.message = message or code


def _error(status: int, code: str, message: str = "") -> None:
    raise APIError(status, code, message)


def _idempotent(session: Session, key: str | None):
    if not key:
        return None
    row = session.get(IdempotencyKey, key)
    if row is None:
        return None
    return row.response_json, row.status_code


def _store_idempotent(session: Session, key: str | None, payload: dict, status: int) -> None:
    if not key:
        return
    session.add(IdempotencyKey(key=key, response_json=payload, status_code=status))
    session.commit()


app = create_app()
