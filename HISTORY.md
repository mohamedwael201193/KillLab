# KillLab history

This file is append-only.

## 2026-09-28 Phase 0 (already completed before implementation)

- Database `select 1` succeeded on both poolers after stripping the `pgbouncer` query parameter for psycopg. Postgres 17.6.
- `KILLAB_API_TOKEN` generated locally. Value not recorded here.
- GitHub, Render, and Vercel tokens authenticated. Nothing deployed.
- Bitget Agentic MCP `market` returned NVDA perp candles via `/api/v3/market/history-candles` and `RNVDAUSDT` as an online reality spot instrument.
- Cloud MCP returned HTTP 503. Not a blocker.
- Evidence: `KillLab/docs/evidence/phase0_*.json` and `phase0_repo_status.txt`.

## 2026-09-28 Phase 1 — requirements freeze

- Objective: checklist traced to local sources, no SecondBook build target.
- Resources: `IMPLEMENTATION_PLAN.md` phase 1, `04-FINAL-CONCEPT.md`, `00-HACKATHON-DOCS.md` Track 3, `01-FORENSICS.md` ROUND 3-4, `06-JUDGMENT.md` §12, skill `bitget-agentic`.
- MCP: `get_auth_status` authorized. `market instruments` RNVDAUSDT online.
- Files: `KillLab/backend/docs/REQUIREMENTS.md`, `phase1_requirements.txt`, this history.
- Exit: checklist written. Status: pass.

## 2026-09-28 Phases 2–14 — backend, engine, database, tests

- Migration `0001_killlab` applied to Supabase Postgres 17.6. Schema `killlab`. Frozen-spec trigger rejects updates.
- psycopg 3 dialect prefix is added in process. The stored URI is unchanged. Regression test covers stripping `pgbouncer`.
- Public REST client refuses pulls before freeze. No order functions.
- DSR golden matches the forensic fixture within 0.02 (0.470). PBO CSCV runs on a labeled random fixture.
- Nine traps have positive and negative cases.
- API: hypotheses, manual specs, freeze, idempotent replay, runs, verdict, traps, evidence, ledger, pasted fills, explanation filter. Compile returns 503 when no LLM key.
- A real NVDA perp pull is part of the API test. The verdict is computed. `beats_baseline` is not forced false. Earnings ideas without an event panel return UNTESTABLE.
- Live pagination of NVDAUSDT 1h reached 8000 bars and `actual_first` 2025-10-28T19:00:00Z, then hit the 40-page cap. That is earlier than the September 2026 floor recorded in round 3. The listing date is not claimed. Evidence: `backend/docs/evidence/phase4_floors.json`.
- Tests: `python -m pytest -q` → 16 passed.
- Frontend not created. Render not deployed in this history entry yet.

### Decision

- Decision: an earnings spec does not treat hourly candles as earnings events.
- Reason: using bar count as event count would clear the sample-size gate without an earnings panel.
- Source: `IMPLEMENTATION_PLAN.md` §7.5 and §10.12.
- Date: 2026-09-28.
- Impact: those runs are UNTESTABLE until an event panel is supplied. That is not a hardcoded verdict.

### BUG-001

- Symptom: Alembic selected the psycopg2 dialect for a `postgresql://` URI.
- Reproduction: `alembic upgrade head` raised `ModuleNotFoundError: psycopg2`.
- Root cause: SQLAlchemy maps `postgresql://` to psycopg2.
- Fix: `psycopg_url()` rewrites the in-memory scheme to `postgresql+psycopg://` after stripping `pgbouncer`.
- Files: `backend/killlab/config.py`.
- Test: `test_pgbouncer_query_param_is_stripped_regression`.
- Retest: migration applied; pytest 16 passed.
- Status: fixed.

## 2026-09-28 Phase 15 — Render

- Service `killlab-api` created in Frankfurt. Public host `https://killlab-api.onrender.com`.
- First deploys failed in Alembic: SQLAlchemy could not parse the pooler URI when the password contains `@`.
- Fix: `to_sqlalchemy_url()` splits on the last `@` and passes the password as a field. Local `select 1` succeeded after the fix.
- Code pushed to `mohamedwael201193/KillLab` `main` (`b880c9a`, then the URL-parser commit).
- Frontend phases 17–20 are not started. `KillLab/FRONTEND/` does not exist.

## 2026-09-28 Phase 15–16 result

- Render env vars were missing on the first service create (zero keys). They were set with a PUT. A new deploy went live.
- `GET /health` returned 200, `db=ok`, engine `killlab-0.1.0`.
- Unauthenticated `POST /v1/hypotheses` returned 401.
- Production earnings run `cc676d08-d6c5-45cf-9c45-b49b9f88dd51` returned `UNTESTABLE` / `insufficient_units` with `actual_first` `2026-09-03T16:00:00Z` from a live Bitget pull. Not ALIVE. Not a copied forensic number.
- Evidence: `backend/docs/evidence/phase16_verdict.json`.




### Decision

- Decision: the Render service calls Bitget public REST, not the Cursor MCP session.
- Reason: Cursor MCP is local to this agent. Render cannot see it. The plan allows REST as the fallback and says MCP must not be a single point of failure.
- Source: `IMPLEMENTATION_PLAN.md` Bitget MCP section and §7.1.
- Date: 2026-09-28.
- Impact: phase-start MCP checks stay in the build log. Production numbers come from REST snapshots.
