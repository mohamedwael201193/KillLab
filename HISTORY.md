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

## 2026-09-28 Engine wiring

- `execute` now runs expanding walk-forward, a seeded bootstrap interval, and Deflated Sharpe on out-of-sample returns for candle families.
- Earnings runs still require an explicit event panel. Candle rows are not counted as earnings. A panel-less earnings spec stays UNTESTABLE.
- Alpha t-stat is the t-stat of the out-of-sample mean, not a hardcoded zero.
- Tests: 16 passed.

## 2026-09-28 Ledger lock and fill review

- A hypothesis whose latest decision is KILLED cannot get a new spec unless the request includes `contradicts`.
- `POST /v1/runs/{id}/reconcile` compares a pasted buy/sell, or a supplied realized bps, with the run's bootstrap interval. Missing interval returns `no_forecast`.
- Private Bitget fills still return 422. No order route was added.

## 2026-09-28 Earnings panel

- Earnings timestamps are aligned to Bitget bars. A candle with no earnings time is not an event.
- If yfinance is missing or the call fails, the event list is empty and the run stays UNTESTABLE.
- Tests: 16 passed, including the alignment fixture.

## 2026-09-28 Production re-check on f24221b

- Deploy status live, commit `f24221b`. Health 200.
- New production run `63e085d6-48fa-4f9a-8d6a-4c60394889c4`: label UNTESTABLE, trap `insufficient_units`, `n` 20, `actual_first` 2026-07-23T20:00:00Z. Events were aligned. Twenty is below the 100-event gate, so the verdict stays UNTESTABLE.
- Probability of overfitting is now attached when an out-of-sample series is long enough for two variants.

## 2026-09-28 Request logs and results route

- Each HTTP response writes a JSON log line with path, status, and engine version. A database URI in a field is replaced with `[redacted]`.
- `GET /v1/runs/{id}/results` returns the computed label, DSR, PBO, sample size, and interval from the stored run.
- Docker is installed but the daemon is not running, so the image was not built on this machine. Render is still the deploy path.
- Engine tests: 10 passed.

## 2026-09-28 Fixture guard

- Production startup refuses to run if the `tests` package is already imported.
- Engine and API tests: 15 passed.

## 2026-09-28 API contract on a live Bitget run

- The freeze-and-run test now also checks `/results` matches the verdict label, `/traps`, the ledger `DECISION`, and that private fills return 422.
- A verdict log line records the label and trap only, not candle rows.
- That test passed against Bitget.

## 2026-09-28 Fill reconciliation

- A pasted fill set without both a buy and a sell returns validation failure instead of an uncaught exception.
- A 100 to 110 round trip is 1000 bps. Engine tests: 10 passed.

## 2026-09-28 Production verdict on 23cb1e8

- Live service health was already 200 on this commit.
- Run `4d590635-8a0f-4454-8733-710568ed6902`: UNTESTABLE, `insufficient_units`, n=20, `actual_first` 2026-07-23T20:00:00Z, `engine_computed` true. Unauthenticated create returned 401.
- `KillLab/FRONTEND/` is still absent, so phases 17–20 are not started.

## 2026-09-28 Rate limit

- Run limits are counted per caller. The bucket key is a hash of the authorization header, not the raw token.
- A second caller does not consume the first caller's cap. The window is one hour.
- Engine tests: 10 passed. Docker Desktop was started. Image build is `killlab-api`.

## 2026-09-28 Docker image

- `docker build -t killlab-api` finished with exit code 0 in about 105 seconds.
- A later rebuild of commit `143d8f5` also finished with exit code 0. The full suite before that rebuild was 16 passed.
- Image tag `killlab-api:latest`. Evidence: `backend/docs/evidence/phase_docker.txt`.

## 2026-09-28 OpenAPI

- The machine-readable schema is public at `/v1/openapi.json`. It does not require the bearer token.
- The test also confirms `/health` still reports the database up.

## 2026-09-28 Stale runs

- On startup, a run left in `running` for at least `RUN_STALE_MINUTES` is marked `failed` with `interrupted`.
- Inline execution cannot resume a dead request, so those rows are not put back on a queue.
- Startup against the live database succeeded in the OpenAPI test.

## 2026-09-28 Next hypothesis

- `POST /v1/ledger/{id}/next` returns a follow-up question from the decision trap.
- It does not store a hypothesis and the text does not contain a metric.
- The unit test passed.

## 2026-09-29 Multi-symbol runs

- An earnings spec now pulls every listed instrument, not only the first.
- Events are tagged by symbol so the same timestamp on NVDA and TSLA stays two events.
- A missing symbol is skipped. If every symbol fails, the run fails as `bitget_unavailable`.

## 2026-09-29 Two-symbol production check

- Live run `7792d8a0-595f-4990-993a-0fd177e4fe9d` on NVDAUSDT and TSLAUSDT.
- Result: UNTESTABLE, `insufficient_units`, n=40, `actual_first` 2026-07-23T23:00:00Z, `engine_computed` true.
- One name previously produced 20 events. Two names produced 40, so both tapes were used. Forty is still below the 100-event gate.

## 2026-09-29 Sample counts

- A verdict now includes `n_events`, the raw panel or candle-return count, as well as `n_units`, the out-of-sample folds actually scored.
- The walk-forward test checks that 80 prices produce 79 returns.
- `GET /v1/runs/{id}/results` includes `n_events`. A live Bitget run confirmed the field is present.






### Decision

- Decision: the Render service calls Bitget public REST, not the Cursor MCP session.
- Reason: Cursor MCP is local to this agent. Render cannot see it. The plan allows REST as the fallback and says MCP must not be a single point of failure.
- Source: `IMPLEMENTATION_PLAN.md` Bitget MCP section and §7.1.
- Date: 2026-09-28.
- Impact: phase-start MCP checks stay in the build log. Production numbers come from REST snapshots.

## 2026-09-29 Frontend connected to the live API

- The desk in `FRONTEND/` calls `/api/killlab`, a same-origin server route. The browser request has no bearer token. `KILLAB_API_TOKEN` stays on the server.
- Fixture reports are not imported by the desk or the landing page. An UNTESTABLE verdict shows the sample, the first Bitget bar, the spec hash, and the engine version, and withholds Deflated Sharpe, PBO, and the interval.
- Local Chrome run `78d2cbb1-d9e2-423f-afbc-5102379df166`: KILLED, MULTIPLE_TESTING, n_units 591, n_events 599, DSR 0.2590896278907918, first bar 2026-09-03T20:00:00Z, spec `77adc1a2bc1d272c7db967d728b7e14fdf2a618e419e42c20666ca69124540d3`, engine `killlab-0.1.0`. The screen matched the results JSON.
- Local earnings run, spec `8089b2fe00d96c81cc30edc1470a2b47c1f31cadbc4331d9e5d21593f7603219`: UNTESTABLE, n_units 40, n_events 48, first bar 2026-07-24T00:00:00Z. The ledger next question was the insufficient-units prompt, with no metric.
- Production site `https://killlab.vercel.app`. Run `c2544e34-82ae-4ad5-a9f3-13fb20653d88`: KILLED, n_units 591, n_events 599, DSR 0.25542728815162685, PBO 0.8857142857142857, first bar 2026-09-03T21:00:00Z, spec `5ee49af183708761c4b3383d7ae63cbc16fb54188d488c23c04d872129650f1b`, snapshot `f0c0d4be46c716fe56404fb7e45b4425b2932c1a0f760acd14b8b4aa60e967c1`, engine `killlab-0.1.0`. Browser, API JSON, and the displayed fields agree.
- Backend pytest: 16 passed. Frontend typecheck and `next build` passed. Git `0231428` pushed to `mohamedwael201193/KillLab` main.

