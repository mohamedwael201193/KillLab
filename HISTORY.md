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

## 2026-09-29 BUG-002 — families were scored as raw bar returns

- Symptom: a session-timing hypothesis was scored on every hourly close-to-close return. Continuation and reversal only flipped that same series for PBO. Costs in `costs.py` were never subtracted. Carry read `baseline_codes`, so a spec that used `baselines` skipped the earn-USDT requirement.
- Reproduction: `execute()` on 80 synthetic prices with `family=session_timing` reported `n_events=79`.
- Root cause: `runner.execute` did not build a decision unit per family.
- Fix: `killlab/engine/mechanisms.py`. Session units are the 09:00 ET hour versus the rest of the cash day, net of one round trip. Earnings follow or fade the first post-event bar. Carry uses Bitget funding prints and is empty without them. Execution compares weekend-MM with waiting for StockRoute. Variant choice uses only past units. Engine version is `killlab-0.2.0`.
- Regression: `test_session_units_are_cash_hours_not_every_bar`. Suite: `python -m pytest -q` → 17 passed.
- Production result: not redeployed in this note. The previous live KILLED run remains `killlab-0.1.0` and must not be reread as a session test.

## 2026-09-29 BUG-003 — open-hour baseline used the wrong horizon

- Old behavior: the 09:00 ET hour was compared with the cumulative move from 10:00 to 16:00. Carry counted every 8-hour funding print inside one hold as its own trial. A model cost, if accepted, could replace the versioned fee.
- Why it was wrong: a one-hour return against a six-hour return is not a timing test. Overlapping funding prints are not independent decisions. The compiler must not own the fee.
- Evidence: `session_panel` subtracted the rest-of-day return. `carry_panel` appended one row per print and divided the round trip by 9.
- Correct behavior: the open hour is compared with the other one-hour cash bars that same day, then one round trip is charged on that difference. A day without a peer hour is not a unit. One continuous funding hold is one unit. Overlapping earnings inside six hours collapse to the first event. Walk-forward selection of a variant uses only the past; a future spike cannot win the first out-of-sample step. Engine version `killlab-0.3.0`.
- Fix: `mechanisms.py`, `ai/compile.py`. The temporary compiler is Groq `openai/gpt-oss-120b` because `llama-3.3-70b-versatile` now returns 404. Gemini is not called. Qwen remains first when `LLM_API_KEY` is set. The server overwrites costs to the versioned 6 bps taker schedule and forces `selection.split=IS`.
- Test: `python -m pytest -q` → 19 passed. A live compile of an NVDA open-hour sentence returned `session_timing`, instrument `NVDAUSDT`, cost 6, split `IS`, and no verdict field.
- Production verification: `GET /health` returned `killlab-0.3.0`. `POST /v1/hypotheses/{id}/compile` on that deploy returned `session_timing` for an NVDA open-hour sentence, cost 6, split `IS`, and `manual_spec_accepted` false. Runs from `killlab-0.1.0` and `killlab-0.2.0` stay in history and are not session-timing verdicts under this baseline.

## 2026-09-29 BUG-004 — weekend actions did not share an exit

- Old behavior: NOW was the move until the end of weekend market-making, and WAIT was the move of the next bar after that. A flat drift across cash hours was only asserted not to be ALIVE.
- Why it was wrong: the two execution actions covered different clocks, so the longer weekend move dominated for mechanical reasons. A market-wide drift must not look like an open-hour edge, and a three-weekend sample must not clear the family floor.
- Correct behavior: both actions are marked to the first StockRoute bar. NOW includes the weekend; WAIT is flat until the switch. Engine `killlab-0.4.0`. Extra variant codes in the spec do not create extra trials; the family scores only its own pre-registered pair.
- Test: `python -m pytest -q` → 20 passed. Equal hourly drift is KILLED. Eighty days of noise are KILLED. Three weekends are UNTESTABLE with `n_events` 3.
- Production verification: `GET /health` returned `killlab-0.4.0` after deploy `b198e3a`. `killlab-0.3.0` execution results, if any, used the old clocks and stay obsolete for that comparison.

## 2026-09-29 BUG-005 — a straddling interval was labeled KILLED

- Audit claim checked against code: a short sample was already `UNTESTABLE`, not `KILLED`. That part of the external note is not a current bug.
- Old behavior that was real: `DSR < 0.95` was a kill, and `ci_low <= 0` was a kill, even when `ci_high` was still above zero. Failure to prove the edge was reported as a contradiction.
- Correct behavior: `ci_high < 0` is `KILLED`. `ci_low > 0` with DSR at least 0.95 is `ALIVE`. An interval that covers both sides is `INCONCLUSIVE`. Missing units stay `UNTESTABLE`. Mirror variants `X` and `-X` do not receive a PBO number. One-hour session bars are flagged `bar_straddle` because they contain 09:30 rather than being a 09:30–10:30 print. Engine `killlab-0.5.0`.
- Test: `python -m pytest -q` → 21 passed. A planted open-hour edge is `ALIVE`. Equal drift and noise are `KILLED`. Three weekends stay `UNTESTABLE`.
- Production verification: `GET /health` returned `killlab-0.5.0`. `killlab-0.4.0` verdicts that used the old kill rule are superseded for that semantic.

## 2026-09-29 Research decision — independent oracle and planted-edge curve

- Decision: check Deflated Sharpe against a second implementation that does not import the engine, and publish a seeded session-timing curve.
- Source: `tests/oracle_reference.py`, forensic golden `dsr` 0.47025601811110446, `docs/calibration/verdict_curve.json`.
- Reason: the combined audit asked for a check that is not the engine calling itself. A zero open-hour edge and a 5 bps edge are `KILLED` after the 12 bps round trip. 20 bps and 40 bps are `ALIVE` on this seed. The 90% bootstrap interval covered a known normal mean on 80 seeded samples inside 0.75–0.99.
- Impact: engine semantics are unchanged. The curve is regenerated by `tests/test_oracle.py`.

## 2026-09-29 BUG-006 — one fill was judged against the mean interval

- Old behavior: a pasted buy and sell were compared with the confidence interval of the mean. The same research idea, reworded, did not add to the trial count.
- Why it was wrong: one trade is one draw from the unit distribution, not a new estimate of the mean. KillLab-observed repeats of the same family, instruments, grain, and variants are additional trials.
- Correct behavior: the fill is compared with the 5th–95th percentile of the out-of-sample units. The research fingerprint ignores the sentence. Prior matching runs increase `n_trials`. `n_eff` is the decision-unit count. Engine `killlab-0.6.0`.
- Test: a 40 bps fill sits inside a wide unit range and outside a tight mean interval. Reordered instruments and variant codes share a fingerprint. `python -m pytest -q` → 24 passed.
- Production verification: `GET /health` returned `killlab-0.6.0` after deploy `7d80f71`.
- Fresh runs on that engine, real Bitget candles, recorded in `docs/evidence/engine_0_6_0_runs.json`: session timing `6d4a61a2-5ca4-4365-b378-db65e63cd733` is `UNTESTABLE` at 38 units (floor 60) even though the interval is negative; earnings `a51d529b-a0ab-417b-8178-bb381aebf271` is `UNTESTABLE` at 20 events and counted 1 prior trial; weekend choice `04f0e240-e17f-4b63-82f6-f7fd50754a32` is `INCONCLUSIVE` at 8 weekends.
- The production desk, in a clean Chrome context, called only `https://killlab.vercel.app/api/killlab/...` and compiled the open-hour sentence to `session_timing`. A model-supplied variant code is no longer frozen; the server writes the family's canonical variant pair.
- Chrome freeze returned 422 because the compiler echoed `kill_floor`, which the spec schema forbids. The client now keeps only spec fields, and the compiler response drops `kill_floor` so the server can apply it on save.
- After that fix, a clean Chrome session froze the NVDA open-hour idea and showed `UNTESTABLE`, 38 units, 46 events, first bar `2026-07-24T02:00:00Z`, engine `killlab-0.6.0`, spec `5ee49af183708761`, snapshot `10dbb1b098dbfce4`. The ledger next question was the insufficient-history sentence. A pasted round trip was compared with the one-trade range, not the mean interval. The browser made 14 calls, all to `/api/killlab`, and none to Supabase, Bitget, or the model host.
- A repeated fingerprint increases the next trial count. Beta claimed without a positive alpha, a three-unit sample, a carry spec without the earn baseline, a claimed start before the tape, and a missing cost model cannot be approved. `python -m pytest -q` → 25 passed.
- Weekend and StockRoute wording selects `execution_venue_time` even if the model guesses another family. The next-question response carries the stored fingerprint and the next prior-trial count, and it does not edit the frozen result. A fill review writes a REVIEW ledger row and leaves `result_json` unchanged.
- Chrome on the current site, run `d975959f-ec20-47f9-8123-b1e37bcdbd3d`: `INCONCLUSIVE`, 8 units, 10 events, DSR 0.1340203495482135, interval 0 to 0, engine `killlab-0.6.0`, spec `2d636b72e6b90c3d319bb346cf2b2a91228e45a8747821ac9807a2eeb8d5c6e2`, snapshot `10dbb1b098dbfce44080d17b879526bfb1c00f7f8f5edec2b9a7dd5f1db0ce5d`, mechanism `weekend_choice_same_exit`, `prior_trials` 1, `n_trials` 3. The screen matched the results JSON. The same spec and snapshot previously scored DSR 0.220 with `prior_trials` 0, so the repeat changed the trial count and the Deflated Sharpe.


## 2026-09-29 Frontend connected to the live API

- The desk in `FRONTEND/` calls `/api/killlab`, a same-origin server route. The browser request has no bearer token. `KILLAB_API_TOKEN` stays on the server.
- Fixture reports are not imported by the desk or the landing page. An UNTESTABLE verdict shows the sample, the first Bitget bar, the spec hash, and the engine version, and withholds Deflated Sharpe, PBO, and the interval.
- Local Chrome run `78d2cbb1-d9e2-423f-afbc-5102379df166`: KILLED, MULTIPLE_TESTING, n_units 591, n_events 599, DSR 0.2590896278907918, first bar 2026-09-03T20:00:00Z, spec `77adc1a2bc1d272c7db967d728b7e14fdf2a618e419e42c20666ca69124540d3`, engine `killlab-0.1.0`. The screen matched the results JSON.
- Local earnings run, spec `8089b2fe00d96c81cc30edc1470a2b47c1f31cadbc4331d9e5d21593f7603219`: UNTESTABLE, n_units 40, n_events 48, first bar 2026-07-24T00:00:00Z. The ledger next question was the insufficient-units prompt, with no metric.
- Production site `https://killlab.vercel.app`. Run `c2544e34-82ae-4ad5-a9f3-13fb20653d88`: KILLED, n_units 591, n_events 599, DSR 0.25542728815162685, PBO 0.8857142857142857, first bar 2026-09-03T21:00:00Z, spec `5ee49af183708761c4b3383d7ae63cbc16fb54188d488c23c04d872129650f1b`, snapshot `f0c0d4be46c716fe56404fb7e45b4425b2932c1a0f760acd14b8b4aa60e967c1`, engine `killlab-0.1.0`. Browser, API JSON, and the displayed fields agree.
- Backend pytest: 16 passed. Frontend typecheck and `next build` passed. Git `0231428` pushed to `mohamedwael201193/KillLab` main.
- Unused simulated report files were removed from `FRONTEND/src/lib/research/fixtures`. Trap explanations and example prompts remain. They are not run results.

## 2026-09-29 BUG-007 — weekend interval collapsed to zero because the baseline was the selected action

- Old behavior: `execution_panel` used NOW returns as the baseline. Walk-forward that selected NOW produced an excess of exactly zero on every weekend. Production run `d975959f-ec20-47f9-8123-b1e37bcdbd3d` showed interval 0 to 0 and `INCONCLUSIVE` on engine `killlab-0.6.0`. That interval is obsolete for the weekend comparison.
- Why it was wrong: scoring an action against itself cannot be a gain, a loss, or a contradiction. The shared StockRoute exit was already correct. The baseline was not.
- Correct behavior: both actions stay marked to the same exit, and the baseline is cash (zero). Selecting NOW can show a real net return after the 12 bps round trip. Engine `killlab-0.7.0`.
- Provenance: a candle pull records `pages_requested`, `pages_fetched`, `pagination_stop` (`short_page`, `empty_page`, or `page_cap`), and `actual_last`. `actual_first` is the oldest fetched bar. A page cap is a fetch limit, not the start of venue history. Earnings stamps outside the first and last bar are `events_outside_tape` and are not trials. An underpowered family sets `units_short` and `forward_armed` without changing the freeze or the label.
- Test: `tests/test_adversarial.py::test_weekend_baseline_is_cash_not_the_selected_action_itself`. `python -m pytest -q` → 26 passed. Frontend `tsc --noEmit` passed.

## 2026-09-29 Research decision — provenance, related trials, and basis fade

- Decision: keep the family floor. Record whether the oldest bar is a venue floor or a page cap. Count a prior test when the family, grain, and at least half the instrument set overlap, even if the fingerprint differs. Add `basis_convergence` only after a live Bitget pull showed aligned NVDA perp and RNVDA spot hours.
- Source: public `/api/v2/mix/market/history-candles` and `/api/v2/spot/market/history-candles`. Eight pages produced 1597 aligned hours from 2026-07-24T03:00:00Z through 2026-09-29T01:00:00Z, 68 calendar days, basis from -135.94 bps to 291.75 bps. Spot history requires `endTime`; the first request now sends it.
- Reason: a page cap must not be described as the listing date. Earnings stamps outside the tape are not trials. Exact wording was already ignored; overlapping names were not. The basis tape can support one daily fade. Hourly prints inside that day are not trials. A gap over 26 hours is dropped. The cost is the perp round trip plus the non-promo r-token round trip, 32 bps, from `COST_SCHEDULE`, not from the model.
- Impact: engine `killlab-0.7.0`. Seeded session curve in `docs/calibration/verdict_curve.json`: zero-edge labels on seeds 11–15 are all `KILLED` (`false_alive_on_zero_edge` false). 40 bps labels are all `ALIVE` (`false_kill_on_40bps` false). A forward-armed card changes the next question to name `units_short` and does not edit `result_json`. Re-running `POST /v1/runs` on the same preregistration pulls a new snapshot and leaves the freeze hash unchanged. Unattended firing when the floor is later reached has no scheduler on the web service; that wait is external. A public ticker bid/ask is stored as `book_observation` and is not an input to the verdict. Historical order-book depth is not reconstructed. Qwen is still absent: `LLM_API_KEY` is empty, and the official credit path needs a KYC UID and Telegram handle that were not supplied.
- Test: `python -m pytest -q` → 30 passed. Frontend `tsc` and `next build` passed.
- Production: Render `GET /health` returned `killlab-0.7.0` after `e688921`. Vercel production for the verdict screen is `603b2d1`. Chrome on `https://killlab.vercel.app`, isolated context, called only that host. Weekend run `d3803ebf-4361-478e-b177-ff8288b3c7aa`: `INCONCLUSIVE`, 8 units, 10 events, DSR 0.09530824598828663, interval -62.344394147377294 to 30.412330779604567, mechanism `weekend_choice_same_exit`, selected `NOW`, `prior_trials` 2, `n_trials` 4, `pagination_stop` `page_cap`, `venue_floor` false, oldest bar `2026-07-24T03:00:00Z`, requested start `2026-07-01`, spec `2d636b72e6b90c3d319bb346cf2b2a91228e45a8747821ac9807a2eeb8d5c6e2`, snapshot `30514c08269eeb1b8750dce4fdc33b3005f24cd88486a79d4be7393307fda097`, engine `killlab-0.7.0`. The evidence rows matched those fields. The interval is no longer 0 to 0. The line under the verdict still said `assigned at run` because that string was written at freeze; the evidence row already showed `killlab-0.7.0`. That line now takes the engine version from the results response. A public bid/ask was stored and was not part of the verdict.
- Basis run `6ddbe0c8-43fa-4067-bbd4-2bf53c4c818e` on the same engine: `UNTESTABLE`, 59 of 60 out-of-sample units, 67 raw events, `units_short` 1, `forward_armed` true, mechanism `daily_basis_fade_versus_cash`, `pagination_stop` `page_cap`, `venue_floor` false, oldest bar `2026-07-24T02:00:00Z`, requested start `2026-07-01`, spec `8802daebefe207d6b87469b5d68a2c5e7230115c229540235bde9b9b58af6717`, snapshot `30514c08269eeb1b8750dce4fdc33b3005f24cd88486a79d4be7393307fda097`. Deflated Sharpe and the interval stayed off the verdict screen. The ledger next question, verbatim, was: "Keep this frozen spec. It still needs 1 more independent units on the Bitget tape. Do not rewrite the claim." The frozen result stayed `UNTESTABLE`. The review chip had labeled RNVDAUSDT as a perp; the pull is spot for an R-prefixed symbol, and the chip now says spot.

## 2026-09-29 Qwen, forward sweep, and forward book capture

- Decision: put Qwen 3.8 Max first on the documented hackathon chat endpoint, sweep a frozen underpowered spec at most once per UTC day, and store only a forward order-book capture.
- Source: `Base_Camp_Hackathon_S2_EN___BitgetAI_HackathonS2.md` base URL `https://hackathon.bitgetops.com/v1`, model `qwen3.8-max`. A live `POST /chat/completions` returned HTTP 200. Bitget `GET /api/v2/mix/market/merge-depth` and `GET /api/v2/mix/market/orderbook` return the current book. `GET /api/v2/mix/market/history-orderbook` returns `40404`. Render cron jobs are a separate service; this web service runs one daemon thread plus `POST /v1/internal/forward-sweep`, with the lock stored in the ledger so a restart cannot double-run the same day.
- Reason: the model may phrase a spec, an explanation, the next question, and a fill review. `normalize_draft` still owns the family, the cost, and the split. `filter_explanation` removes any number that is not already in the engine document. A sweep below the family floor writes `FORWARD_CHECK` and does not add a scored run. Reaching the floor writes `AUTO_RUN` on the same freeze hash. A changed hash is refused. A venue failure does not consume the day.
- Impact: engine `killlab-0.8.0`. Migration `0002_book_captures` adds `killlab.book_captures` with provenance `forward_recorded` and `historical` false. The key lives in the gitignored env and the Render runtime. It is not in git, the browser, or this file.
- Test: `python -m pytest -q` → 34 passed. Frontend `tsc --noEmit` and `next build` passed. A tracked-file scan found the key in 0 files. A live compile of an NVDA open-hour sentence returned `session_timing`, cost 6, and no verdict field. A narrated sentence that invented 9.99 was locked.
- The first production sweep could write more than one `FORWARD_CHECK` for the same spec when two processes started together. The sweep now inserts an idempotency key for `preregistration + UTC day` before it pulls data. A losing process records a duplicate and does not pull. A venue failure deletes that key so a later pass can retry.

## 2026-09-29 Qwen timeout on the production narration path

- The first production next-question call fell through to the temporary Groq model because Qwen did not answer inside 30 seconds. Narration and explanation now use `LLM_TIMEOUT_S`, set to 60 on the runtime. A local narration with that budget returned model `qwen3.8-max` and `numbers_locked` true.
- Production after `72bf477`: `GET /health` returned `killlab-0.8.0`. Chrome on `https://killlab.vercel.app` compiled “Trade NVDA perp in the first hour of the cash session.” to `session_timing` with variants continuation and reversal. The browser called only that host. `POST /v1/runs/6ddbe0c8-43fa-4067-bbd4-2bf53c4c818e/explain` returned `numbers_locked` true. `POST /v1/ledger/{decision}/next` returned model `qwen3.8-max`, `stored` false, `units_short` 80, `forward_armed` true, and the key was not in the narrative. The scheduler wrote `FORWARD_CHECK` rows with `automatic` true, including spec `8802daebefe207d6` at 59 units, 1 still needed. A second sweep the same UTC day returned four `duplicate` actions and the `FORWARD_CHECK` count stayed 4. `killlab.book_captures` has one row, provenance `forward_recorded`, and `historical` is false. No `AUTO_RUN` was created, because no armed spec had reached its family floor.

## 2026-09-29 Four-state receipt, thesis isolation, review link, forward-book gate

- Decision: the public pages name four verdicts. The receipt shows the fields the engine already returns. A thesis sentence can be stored and is stripped before `execute`. A fill outside the one-trade range changes only the next question. An execution run with a missing, empty, wide, or historically labeled book is `UNTESTABLE` / `book_unusable`. A usable forward book does not rewrite past returns.
- Reason: the landing page said three outcomes while the engine already returned `INCONCLUSIVE`. A stored book that never affected a claim was incomplete. Personal notes and reviews must not become a new Sharpe.
- Source: engine `decide` in `verdict.py`; public merge-depth is current only (`history-orderbook` remains `40404`). Family floors and the daily sweep were not changed. The basis spec stays one unit short if the tape is still short.
- Files: landing verdict, protocol, and evidence copy; `map-verdict.ts`; write and review views; `traps.py`; `runner.py`; `review.py`; `compile.py`; hypothesis `thesis` column `0003_hypothesis_thesis`.
- Test: `python -m pytest -q` → 39 passed before the version string moved to `killlab-0.9.0`. `tests/test_overmatch.py` covers four-state copy, thesis isolation, review isolation, book cases, and invented numbers. Frontend `tsc --noEmit` and `next build` passed.
- Production after `d78f2a6`: `GET /health` returned `killlab-0.9.0`. Chrome on `https://killlab.vercel.app` showed KILLED, ALIVE, INCONCLUSIVE, and UNTESTABLE, and the phrase “exactly one of four.” A desk compile showed the thesis sentence beside `session_timing` before any candle pull. An execution run returned `INCONCLUSIVE` / `underpowered`, book provenance `forward_recorded`, `historical` false, the thesis on the card, and a next question. The thesis was not in the compiler draft and the draft had no verdict field. The basis floor was not lowered.

## 2026-09-29 Post-freeze Bitget information layer

- Decision: after a freeze, attach one official research-skill reading and, when the instrument is a US equity ticker, one read from the official US-stock MCP. Neither value is an input to `execute`. A failed context call still stores the engine card.
- Reason: the desk needed market evidence next to a frozen question without letting that evidence become the Sharpe, the sample, or the verdict. The official skill package is an instruction set plus a public MCP. KillLab calls the tool the skill names. It does not ship a stand-in answer.
- Source: `https://datahub.noxiaohao.com/mcp` tool `technical_analysis` action `rsi` on `NVDAUSDT` returned rsi 60.4, timeframe 4h, period 14, signal neutral, with no data timestamp, classified current. `https://agent.bitget.com/mcp` returned upstream unavailable (`Too many open sessions` on an earlier probe). That item is stored as MCP context with no price. The compiler module does not reference either host.
- Files: `backend/killlab/integrations/`, `api.py` run and explain paths, `ai/boundary.py`, `FRONTEND/src/lib/research/map-verdict.ts`, `tests/test_information.py`, `tests/conftest.py`. Engine string `killlab-0.10.0`. The forward sweep does not call this layer. No order route was added.
- Test: `python -m pytest -q` → 52 passed. Frontend `tsc --noEmit` passed. A local frozen NVDA session sentence routed `technical-analysis` and did not change label, DSR, PBO, unit count, or trial count. Context before freeze raises and performs no HTTP call.
- Limitation: the US-stock MCP did not open a session from this network, so that evidence row is an availability record, not a quote. Skill tools other than `technical_analysis` can answer with empty numeric fields; those rows say so. Production verification of the deployed card is not in this entry.

## 2026-09-29 Production check of the information layer

- Render `GET /health` returned `killlab-0.10.0` on commit `caaf96c`. Vercel production for that commit was READY. Chrome on `https://killlab.vercel.app/?v=caaf96c`, isolated context, called only `https://killlab.vercel.app/api/killlab`. The run request had an idempotency key and no `Authorization` header.
- First frozen sentence, “I think the first cash-session hour of NVDA behaves differently from the other hours.” Compile returned `session_timing` and `NVDAUSDT` before any candle request. The page still said data had not been loaded. After freeze, run `52680de5-831d-4ce4-bef5-fafd25249d56` was `UNTESTABLE`, 39 of 60 units, mechanism `ny_open_hour_vs_other_cash_hours`, engine shown as `killlab-0.10.0`, book `forward_recorded` and `historical` false. Research skill `technical-analysis`. Context changes the verdict: no. MCP context: `do_query` for NVDA, `last_price` 228.5, `open` 229.3, classified current, no source timestamp in the payload. Skill context: `technical_analysis` on NVDAUSDT, rsi 60.96, timeframe 4h, period 14, signal neutral. `usable_for_verdict` false on both.
- A pasted buy at 100 and sell at 101 reconciled to 100 bps, outside the one-trade range -130.309 to 99.299. The stored verdict stayed `UNTESTABLE` with the same DSR `0.0011870453425856242` and the same rsi line. Ledger stage `REVIEW` recorded `inside_predictive` false. The next question, model `qwen3.8-max`, `stored` false, was the outside-range sentence and did not contain the API token.
- A second sentence, “Short BTC perp when funding is positive and the crowd is fearful.” compiled to `carry_basis` with data still unloaded. Run `ce668203-cb20-4ccc-b449-0c76f47d712c` was `UNTESTABLE`, 1 of 60, mechanism `funding_hold_versus_cash`. The routed skill was `sentiment-analyst`. That call timed out and the receipt says `TimeoutError`. The verdict was still returned. No US-stock row was added, because BTC is not an equity ticker.
- One explanation call for the first run returned model `openai/gpt-oss-120b` with `numbers_locked` true. The next-question call in the same session returned `qwen3.8-max`.
- Test command already recorded above: `python -m pytest -q` → 52 passed.

## 2026-09-29 Provenance split between the US-stock MCP and the research skills

- Decision: engine `killlab-0.11.0`. An evidence row now keeps `source_url`, `requested_at`, `retrieved_at`, and `data_timestamp` as separate fields. A payload with numbers and no upstream time is `undated`. A quote time older than two days is `stale`. A history action with a source time is `historical`. A session refusal is `too many open sessions` and is not replaced with another provider's price. A hypothesis can select one primary skill and one secondary skill when the wording names two different questions. An empty news tool is stored as no articles. A manual run is labeled `manual`. A scored forward run is labeled `automatic`.
- Why: the receipt had called an undated RSI current, and it did not show which host produced the row. The US-stock host and the research-skill host are different services.
- Files: `backend/killlab/integrations/`, `ai/boundary.py`, `api.py`, `models.py`, `FRONTEND/src/lib/research/map-verdict.ts`, `tests/test_information.py`, `tests/test_overmatch.py`, `docs/calibration/verdict_curve.json`.
- Local calls on 2026-09-29, after freeze in the probe only: `technical_analysis` on NVDAUSDT returned rsi 59.59, undated. `rates_yields` returned `yield_curve_inverted` false, undated. `sentiment_index` returned no numeric fields. `news_feed` for news-briefing and market-intel returned feed names and no articles, recorded as no articles after this change. `https://agent.bitget.com/mcp` `do_query` for NVDA returned `too many open sessions` from this network. No price was invented.
- Test: `python -m pytest -q` → 57 passed. Frontend `tsc --noEmit` and `next build` passed.
- Not done in this entry: a new production run on `killlab-0.11.0`, and a natural `AUTO_RUN`. Family floors were not changed. No new research family was added. Historical order-book depth was not reconstructed.

## 2026-09-29 Production check of killlab-0.11.0

- Render `GET /health` returned `killlab-0.11.0` on commit `8d16359`. Vercel production for that commit was READY. Chrome on `https://killlab.vercel.app/?v=8d16359` called only `https://killlab.vercel.app/api/killlab`.
- Run `e24f3258-1aca-4e1a-bbde-a2c1434a842b`: `UNTESTABLE`, 39 of 60, mechanism `ny_open_hour_vs_other_cash_hours`, run origin `manual`, engine `killlab-0.11.0`. Book row: forward-recorded, spread 0.437 bps, retrieved `1790661355233`, not a past book. Context changes the verdict: no.
- Official US-stock row: host `agent.bitget.com/mcp`, tool `do_query`, freshness `unavailable`, retrieved `2026-09-29T05:55:56+00:00`, no source time, failure `too many open sessions`. No price was shown.
- Research-skill row: host `datahub.noxiaohao.com/mcp`, tool `technical_analysis`, freshness `undated`, retrieved the same clock second, rsi 60.63, timeframe 4h, period 14, signal neutral. The two hosts are labeled apart.
- `POST /v1/internal/forward-sweep` for UTC day `2026-09-29` returned 11 `duplicate` actions and no `AUTO_RUN`. The day had already been checked. Floors were not changed.
- An earlier production run on `killlab-0.10.0`, `52680de5-831d-4ce4-bef5-fafd25249d56`, did receive NVDA `last_price` 228.5 from `do_query`. That success is not repeated on this deploy. The current official-endpoint state from production is the session refusal above.

## 2026-09-29 Official US-stock quote, skill answers, and the same-day forward retry

- Decision: engine `killlab-0.12.1`. Each official MCP call now sends HTTP DELETE for its session after the tool returns. The receipt keeps the source clock, the request time, and the retrieval time apart. A forward book stores depth imbalance from the live bid and ask sizes. That ratio is not a return. A short forward check no longer blocks a later check on the same UTC day. A scored automatic run still does. An official rates payload with no tenor level is stored as no tenor levels. `perp versus spot` routes to the existing basis family.
- Why: the US-stock host was refusing new sessions because the previous ones were left open. A 20-second wait was also abandoning skill calls that were still in flight.
- Files: `backend/killlab/integrations/mcp_http.py`, `context.py`, `evidence.py`, `bitget_signal.py`, `api.py`, `runner.py`, `ai/compile.py`, `models.py`, `FRONTEND/src/lib/research/map-verdict.ts`, `tests/test_information.py`.
- Test: `python -m pytest -q` → 65 passed.
- Production `GET /health` returned `killlab-0.12.1`. Chrome on `https://killlab.vercel.app/?v=661a5e3` wrote “Trade NVDA in the first hour of the cash session”, froze hash `5ee49af183708761c4b3383d7ae63cbc16fb54188d488c23c04d872129650f1b`, and the browser called only `https://killlab.vercel.app/api/killlab`. The run request had no Authorization header.
- Chrome run `008686f7-a051-4786-b3f1-8b6b3c3672fc`: `UNTESTABLE`, 38 of 60, engine `killlab-0.12.1`, mechanism `ny_open_hour_vs_other_cash_hours`, origin `manual`. Book: forward-recorded, spread 0.436 bps, depth imbalance 0.084, retrieved `1790702747845`, not a past book. Context changes the verdict: no.
- Official US-stock row on that run: host `agent.bitget.com/mcp`, tool `do_query`, freshness `current`, requested and retrieved `2026-09-29T17:25:50+00:00`, source clock `2026-09-30T01:25:49.970279`, summary `last_price 229.09`. `usable_for_verdict` false. The source clock is the upstream stamp, about eight hours ahead of the retrieval time, and it was not rewritten.
- Same host on earlier `killlab-0.12.0` run `51227361-a5a9-476d-ae51-f5962aa45ca3`: `last_price 229.3645`, source clock `2026-09-30T01:04:32.450959`, retrieved `2026-09-29T17:04:32+00:00`. Later `0.12.1` quotes on the same tool were 229.32, 229.075, 229.1, and 228.9501. The price moved. It was not a stored fixture.
- Skill rows from production, each on its own frozen hypothesis, host `datahub.noxiaohao.com/mcp`, `usable_for_verdict` false:
  - `technical-analysis` / `technical_analysis` on run `008686f7-a051-4786-b3f1-8b6b3c3672fc`: undated, rsi 58.84, timeframe 4h, period 14, signal neutral. No source time.
  - `macro-analyst` / `rates_yields` on run `b0f986af-274c-4eb3-b1c6-f4efb20b9360`: undated, the only stored field was `yield_curve_inverted` false. No tenor level and no source time.
  - `sentiment-analyst` / `sentiment_index` on run `9e804988-3b96-489d-a6e7-bfa11f455b1a`: the official tool answered and supplied no numeric fields.
  - `news-briefing` / `news_feed` on run `bf72c65a-beca-41ae-977f-74a79e7fe27a`: the official news tool answered with no articles.
  - `market-intel` / `news_feed` on run `da31fc71-364c-4612-b6e1-ed00a7ebeeac`: the official news tool answered with no articles. Engine on that run row is `killlab-0.12.1`.
- `POST /v1/internal/forward-sweep` for UTC day `2026-09-29` returned 20 `below_floor` actions and no `AUTO_RUN`. The short checks were retried. None of the armed specs had reached its family minimum. Floors were not changed. No historical order book was reconstructed. No new research family was added.


