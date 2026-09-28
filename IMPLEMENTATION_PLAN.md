# KillLab — implementation plan

Status: blueprint only. Phase 0 preflight has been executed (2026-09-28). Do not treat this file as a running system. Implementation starts at Phase 1, and only while the Phase 0 evidence files still match this plan.
Track: AI Trading Desk. Sub-theme: Review & Self-Evolution.
Concept status in the forensic pack: READY FOR IMPLEMENTATION (`04-FINAL-CONCEPT.md`, `06-JUDGMENT.md` §12).

This is the only execution plan. `05-BUILD-HANDOFF.md` is the killed SecondBook direction. Do not import its router, hedge, or desk architecture.

The parenthetical copies named in the build request (`04-FINAL-CONCEPT(5).md` and the other `(n)` files) are not in this workspace. The unsuffixed files at the repo root are the source pack used here.

---

## 1. Executive architecture

```text
Browser (later: KillLab/FRONTEND on Vercel)
        │  HTTPS JSON, bearer token via a server proxy (browser never holds DB or LLM secrets)
        ▼
Render web service  FastAPI  (killlab-api)
        │
        ├─ AI boundary     NL idea → candidate TestSpec JSON. No numbers.
        │                  Schema-validated. Cannot weaken the kill-rule floor.
        │
        ├─ Freeze          Human confirm → immutable preregistration + sha256
        │                  Data clients refuse to run until status = frozen
        │
        ├─ Research engine Pure Python. Owns every number.
        │
        ├─ Trap scanner    Nine detectors. Runs inside the engine, not the LLM.
        │
        ├─ Verdict         KILLED | ALIVE | UNTESTABLE from frozen rules only
        │
        └─ Ledger          Append-only. Dead ideas stay dead.
                │
                ▼
        Supabase Postgres (server-side only)
                │
                ▼
        Bitget public REST (primary)  ·  yfinance (event clock / pre-venue cash only)
        bitget-agentic MCP is a required live check in every phase
        REST remains the fallback if MCP is down. The engine still owns the numbers.
```

## Bitget MCP and skill, required in every phase

Every phase starts with the same check. It is not optional and it is not a substitute for the deterministic engine.

| Item | Exact location |
|---|---|
| Skill | `C:\Users\LOQ\.cursor\skills\bitget-agentic\SKILL.md` (`@bitget-ai/bitget-agent-mcp`, version 1.3.0) |
| MCP namespace | `user-bitget-agentic` |
| First call | `get_auth_status` |
| Public data call | `market` with an `action` from the phase block |
| Cloud MCP | `user-bitget-mcp-server` / `cloud_mcp_status`. On 2026-09-28 this returned HTTP 503 `Too many open sessions`. Record it and continue. |
| Forbidden tools | `order`, `transfer_funds`, `withdraw`, `deposit`, `repayment`. The skill's trading section does not apply. KillLab does not place orders. |

Phase 0 already ran this check. Evidence: `KillLab/docs/evidence/phase0_bitget_mcp.json`. `get_auth_status` was authorized. `market` `candlesHistory` for `NVDAUSDT` `USDT-FUTURES` `1H` returned `GET /api/v3/market/history-candles`. `market` `instruments` showed `RNVDAUSDT` online, `symbolType=stock`, `isReality=yes`.

If `get_auth_status` is unauthorized, public `market` still works. Do not start OAuth during a research phase unless the user asked to connect. If `market` fails and REST also fails, the phase stops with `bitget_unavailable`.

One web service owns the API and a DB-backed job loop. A second Render worker is added only if a run exceeds the web timeout (phase 15 gate). No Redis. No Supabase Data API in the browser. No automatic orders.

---

## 2. Product scope

KillLab turns a natural-language US-stock idea on Bitget into a pre-registered kill test, runs it on venue data, scans for the nine traps the forensic pack already caught, and writes a research ledger.

In scope for v1:

- Four hypothesis families only: `session_timing`, `event_earnings`, `carry_basis`, `execution_venue_time`.
- Instruments: Bitget USDT-M stock perps (`NVDAUSDT`, `productType=USDT-FUTURES`) and rToken spot (`RNVDAUSDT`). The overlap set is discovered live, not hardcoded as “300”.
- Public research with no Bitget key.
- Human-confirmed paper fills and pasted fills.
- Demo path: earnings idea → frozen spec → KILLED card with trap and avoided-loss computed by the engine. Second path: “always wait for Sunday 20:00 ET” → not a blanket ALIVE; UNTESTABLE when independent weekends are below the floor.

Out of scope until a later product: order placement, Agent Hub execution, Playbook publishing, analog kNN stress testing, long-tail liquidity guards, RegimeDesk scheduling as a product.

---

## 3. Non-goals

- Do not build SecondBook, OpenBridge, or RegimeDesk.
- Do not place, cancel, or preview live orders. Human confirmation stays outside KillLab. KillLab never calls `order`, `transfer_funds`, `withdraw`, or `deposit`.
- Do not let the LLM emit Sharpe, DSR, PBO, bps, sample size, or verdict labels as facts. It may quote numbers only by copying fields already returned by the engine.
- Do not use `backtesting.py` (AGPL-3.0) or `mlfinlab` (commercial). DSR and CSCV PBO are the local implementation already proven in `_forensics/round4/dsr/dsr_run.py`.
- Do not treat yfinance close-to-open as a Bitget fill. K-A showed that cash prints are not executable on the rToken within the overnight edge (`01-FORENSICS.md` ROUND 3-4; R1).
- Do not claim history from 7 Feb 2026. Perp 1h candles start about 9 Sep 2026. Funding history from the public endpoint starts about 30 Jun 2026. rToken weekend hours that pass the usable-weekend rule start mid-June 2026.
- Do not hardcode the demo’s 0.47 / −12 bps into the UI or the API. Those figures are golden-test expectations. Production recomputes them.

---

## 4. Source of truth

| Decision | Source | Requirement | Design | Test |
|---|---|---|---|---|
| Product is KillLab, Desk, Review & Self-Evolution | `04-FINAL-CONCEPT.md`, `06-JUDGMENT.md` §12, `00-HACKATHON-DOCS.md` L257–269 | NL idea → frozen spec → deterministic test → ledger. Human decides. | Sections 9–14 | Phase 1 checklist |
| LLM never owns numbers | `04` mechanism §2; `06` AI materiality gate | Engine is the only writer of metrics | `metrics` package; AI schema has no numeric result fields | Property test: AI payload rejected if it contains `sharpe`/`dsr` |
| Nine traps | `04` thesis table | Each trap is a detector with a rule | Section 11 | Unit test per trap using the forensic fixture |
| UNTESTABLE when n is short | `04` failure behaviour; T6 had 7 weekends | Do not invent a verdict | Section 13 | Weekend fixture with 7 keys → UNTESTABLE |
| No orders | `04` L77; hackathon safety rule | Public data + pasted/paper fills | No order client | Grep gate: backend has no order endpoint |
| Public Bitget REST is enough for the core | `06` technical feasibility; `01` ROUND 3-4 | MCP must not be a single point of failure | `bitget_rest.py` | Live smoke without MCP |
| DSR formula | `_forensics/round4/dsr/dsr_run.py` header | Bailey & López de Prado 2014; SR̂ not annualized | Section 10.6 | Golden: tercile DSR ≈ 0.47 at N=12 |
| Fees | Forensic runs: spot 5 bps promo, perp taker 6 / maker 2 | Versioned schedule, plus 10 bps spot sensitivity | `cost_schedule.json` with `effective_from` | Carry test uses the schedule, not a literal in strategy code |
| Earn 2.00% and BTC/ETH carry | ROUND 4 CARRY | Yield claims must beat a fetched baseline snapshot | Baseline row stored with `as_of` | Missing snapshot → UNTESTABLE, not “beat 2%” |
| Playbook is not the engine | ROUND 4 R2 | Sandbox is perp 1h, no rToken, no import | Do not call Playbook to produce verdicts | No playbook client in `engine/` |
| Competitors do not already ship this | `02-WINNERS-COMPETITORS.md` ROUND 3-4 | TradePilot has no executable test; Argus DSR is on its own factors | Spec is the user’s, kill floor is ours | N/A (do not re-audit those repos) |
| Contaminated naive-agent run | `03-IDEA-KILLING.md`; `06` §12 residual | Do not cite that run as a clean baseline | Phase 1 task, isolated directory | Not a blocker for the engine |

Old assumptions that must not survive:

- “Since 7 Feb” as available perp history.
- Per-bar σ as the risk of waiting until Sunday 20:00 ET.
- T1’s per-regime median rescale (verdict VOID).
- “Always wait” as a winning rule at $20k.
- A 24–30 bps rToken-versus-cash gap at the cash open (1h bar-timing artifact; 1m RTH p50 is 0).
- Stock-perp funding carry as a product.
- Private Agentic reads as required for the demo.

---

## 5. System boundaries

| Layer | May | Must not |
|---|---|---|
| Frontend | Render forms, show engine JSON, loading / error / UNTESTABLE | Compute metrics, cache fake results, call Bitget or Postgres |
| API | Authn, validate schemas, enqueue jobs, serve stored engine output | Recompute Sharpe in the route handler |
| AI | Draft `TestSpec`, explain a finished verdict by citing engine fields, propose the next hypothesis text | See OOS results before freeze; write ledger numbers; weaken kill floor |
| Engine | Load data, costs, walk-forward, bootstrap, DSR, PBO, traps, verdict | Call an LLM |
| Bitget layer | Public REST; optional private fills behind a flag | Place orders |
| Ledger DB | Append-only facts and immutable specs | Update a frozen spec |

Data does not start until `preregistrations.status = frozen`. The Bitget client checks a `RunContext.frozen_hash` and raises `NotFrozen` otherwise. Tests monkeypatch the client and assert the raise.

---

## 6. Technology choices

| Choice | Why | Rejected |
|---|---|---|
| Python 3.12, FastAPI, Pydantic v2 | The forensic engine is Python (`dsr_run.py`, `t6.py`). NumPy/SciPy stay in-process. | A Node rewrite of DSR |
| SQLAlchemy 2 + Alembic | Migrations on `DIRECT_URL`, runtime on `DATABASE_URL` | Supabase JS in the API |
| psycopg 3, `prepare_threshold=None` | Transaction pooler (port 6543, `pgbouncer=true`) breaks server-side prepared statements | Direct IPv6 DB host |
| Postgres | Freeze, ledger, and dataset hashes must survive restarts | SQLite on Render disk; a JSON file |
| One Render web service + DB job table | Runs are minutes long. A row in `test_runs` is the queue. | Redis, Celery |
| Background worker only if the web process is killed mid-run | Add a second Render service from the same image with `ROLE=worker` | Premature split |
| Vercel for the external UI only, after the API is frozen | User constraint | Building the UI in this plan |
| Bitget public REST via httpx | MCP cloud has returned `503 Too many open sessions`. REST worked for every Round 3–4 measurement. | MCP as the only data path |
| yfinance | Earnings timestamps and pre-venue cash. Labeled `cash_proxy`. Cannot by itself produce ALIVE on a Bitget instrument. | Polygon/paid vendors (no key supplied) |
| Server-side SQL as the only DB client | No anon key was supplied. The browser must not hold the pooler password. | supabase-js + RLS-as-the-API |

Region: Render Frankfurt, close to the Supabase pooler `aws-1-eu-west-1`.

---

## 7. Data architecture

### 7.1 Sources, in priority order

| Need | Source | If missing |
|---|---|---|
| rToken candles | First: MCP `market` `candlesHistory` `category=SPOT`. Fallback: `GET https://api.bitget.com/api/v2/spot/market/history-candles` | UNTESTABLE for that symbol/window |
| Stock perp candles | First: MCP `market` `candlesHistory` `category=USDT-FUTURES` (verified 2026-09-28 as `GET /api/v3/market/history-candles`). Fallback: `GET /api/v2/mix/market/history-candles?productType=USDT-FUTURES` | Same |
| Funding | `GET /api/v2/mix/market/history-fund-rate?productType=USDT-FUTURES` | Carry family UNTESTABLE |
| L2 | `GET /api/v2/spot/market/orderbook` (and mix equivalent) | Execution-family walk UNTESTABLE; do not substitute a spread guess |
| Public trades | `GET /api/v2/spot/market/fills-history` | Tape review UNTESTABLE |
| Earnings clock | yfinance `get_earnings_dates` | `event_earnings` UNTESTABLE. Do not infer AMC from a date-only stamp (518 BMO were dropped in Test B for this reason). |
| Cash 1m / 1h | yfinance, `prepost=True` | Allowed only as `cash_proxy`, never as the fill price of a Bitget ALIVE |
| Earn USDT APR | Public savings page or API at run time, stored with `as_of` | Carry baseline missing → UNTESTABLE |
| BTC/ETH carry | Same funding method on `BTCUSDT` / `ETHUSDT` over the same window | Same |

Header on every Bitget call: `User-Agent: curl/8.0`. Paginate candles backward with `endTime`. The first bar returned is the history floor. Persist that floor. Never replace it with the requested start.

### 7.2 Time

- Store timestamps as `timestamptz` UTC.
- Session boundaries are `America/New_York` (DST-aware). Sunday 20:00 ET is the StockRoute switch. Weekend internal MM is Friday 20:00 ET through Sunday 20:00 ET.
- Weekend unfilled limits cancel when US markets open on Monday. The support articles do not print an HH:MM. The engine uses `US_CASH_OPEN` as a named event, default 09:30 ET, and records `clock_source=inferred_from_regular_hours` on the spec. A verdict must not claim a minute that the spec marks inferred.
- Bars are indexed by their open time. A 1h bar at 16:00 ET is not the 16:00 cash print. Open/close comparisons require 1m bars (trap `BAR_TIMING`).

### 7.3 Freshness

| Dataset | Max age at run start | If staler |
|---|---|---|
| Candles ending “now” | 2 hours behind the last expected bar | Stamp `stale=true`. If the spec’s `test_end` is inside the gap, UNTESTABLE |
| Funding | 16 hours (two 8h prints) | Carry UNTESTABLE |
| L2 | 30 seconds, live walk only | Do not reuse a snapshot from another session for a live cost |
| Earn APR | 7 days | Re-fetch; if fetch fails, UNTESTABLE for yield comparisons |

Historical windows are immutable once snapshotted. “Stale” applies only to a run that claims to include the present.

### 7.4 Snapshots

Each pull writes `dataset_snapshots`:

- `payload_sha256` of the canonical JSON (sorted keys, UTC millis).
- `first_ts`, `last_ts`, `n_bars`, `symbol`, `granularity`, `source`.
- `requested_start` vs `actual_first_ts`.

A rerun with the same snapshot hash must reproduce metrics within the golden tolerance (section 23). The engine reads the snapshot, not a fresh pull, when `test_runs.snapshot_ids` is set. Live pulls happen once, before the first fold, and are never extended after the first metric is written.

### 7.5 Insufficient data

Return `UNTESTABLE` with `reason_code`. Do not fill gaps by interpolation. Do not drop symbols silently. The symbol list in the result must equal the frozen list, each marked `used` or `dropped` with a reason.

Minimum independent units (also the kill floor):

| Family | Unit | Minimum to emit KILLED/ALIVE |
|---|---|---|
| `session_timing` weekend | weekend (Monday key) | 8 |
| `session_timing` overnight | US session-day | 60 total, 30 OOS |
| `event_earnings` | earnings event | 100 OOS events |
| `carry_basis` | calendar day of the book | 60 total, 30 OOS |
| `execution_venue_time` | weekend | 8, and a real L2 walk for NOW and for StockRoute. One weekend of L2 is not enough for a stable size rule (T4: 44% stable). |

Below the minimum the status is UNTESTABLE even if a point estimate looks good. T6’s 7 weekends would be UNTESTABLE, not a soft pass.

### 7.6 Demo data rule

Golden fixtures live in `backend/tests/fixtures/` and are loaded only by pytest. The API process sets `KILLAB_ENV=production` and refuses fixture loaders. A startup check fails if `FIXTURE_DIR` is on `sys.path` importers used by routes.

---

## 8. Domain model

All primary keys are UUID. Money notionals are `numeric(20,4)` USD. Rates in bps are `double precision`. Hashes are `char(64)` hex sha256.

Immutable means no UPDATE and no DELETE except workspace-level purge in development. Enforce with a trigger.

### 8.1 `workspaces`

| Field | Type | Req | Notes |
|---|---|---|---|
| id | uuid | yes | pk |
| name | text | yes | |
| created_at | timestamptz | yes | default now() |

Index: none beyond pk. One demo workspace is seeded.

### 8.2 `hypotheses`

| Field | Type | Req | Notes |
|---|---|---|---|
| id | uuid | yes | pk |
| workspace_id | uuid | yes | fk |
| raw_text | text | yes | the user’s words, immutable |
| family | text | yes | enum of four, or `unsupported` |
| created_at | timestamptz | yes | |

Unique: none. Index `(workspace_id, created_at desc)`.
Immutable: `raw_text`, `family`, `created_at`. Status lives on the spec, not here, so a rejected parse cannot rewrite the idea.

### 8.3 `test_specs`

The canonical document is `canonical_json`. Child rows are a projection written in the same transaction.

| Field | Type | Req | Notes |
|---|---|---|---|
| id | uuid | yes | pk |
| hypothesis_id | uuid | yes | fk |
| version | int | yes | starts at 1; a new draft is a new row |
| status | text | yes | `draft` \| `frozen` \| `rejected` |
| canonical_json | jsonb | yes | full spec |
| content_sha256 | char(64) | yes | of canonical bytes |
| created_at | timestamptz | yes | |

Unique `(hypothesis_id, version)`. Partial unique: one `draft` per hypothesis.
Immutable once `status=frozen`: the whole row. Trigger `test_specs_freeze`.

### 8.4 `preregistrations`

| Field | Type | Req | Notes |
|---|---|---|---|
| id | uuid | yes | pk |
| test_spec_id | uuid | yes | unique fk |
| frozen_at | timestamptz | yes | |
| frozen_by | text | yes | `human` |
| confirm_phrase | text | yes | must equal `FREEZE` |
| spec_sha256 | char(64) | yes | copy of the spec hash at freeze |

No updates. This row is the proof the test was registered before data access. `dataset_snapshots.created_at` must be `>= frozen_at` for snapshots linked to the run. A snapshot older than the freeze is allowed only if it was not created for this spec (shared cache) and its `last_ts` is `<= frozen_at` when the spec forbids look-ahead into post-registration prints. Default: snapshots are pulled after freeze, and any bar with `open_ts > frozen_at` is excluded unless the spec’s `test_end` is in the past and `allow_post_freeze_history=false`.

### 8.5 `baselines` and `variants`

Rows inserted only at freeze.

`baselines`: `id`, `test_spec_id`, `code` (`buy_and_hold`, `always_now`, `always_wait`, `always_ladder`, `naive_unfiltered`, `earn_usdt`, `btc_eth_carry`, `trailing_vol`), `params jsonb`, `required boolean`.

`variants`: `id`, `test_spec_id`, `code`, `params jsonb`, `ordinal int`.

Unique `(test_spec_id, code)`. Immutable.

The kill floor (section 12) forces a minimum baseline set per family. The LLM cannot delete them.

### 8.6 `datasets` and `dataset_snapshots`

`datasets`: `id`, `source` (`bitget_spot`, `bitget_mix`, `bitget_funding`, `yfinance_cash`, `yfinance_earnings`, `earn_apr`), `symbol`, `granularity`, `kind`.

`dataset_snapshots`: `id`, `dataset_id`, `pulled_at`, `requested_start`, `actual_first_ts`, `actual_last_ts`, `n`, `payload_sha256`, `uri` (object key or inline if small), `stale boolean`.

Unique `(dataset_id, payload_sha256)`. Payloads over 2 MB go to disk on the service (`/var/data/snapshots`) and the DB stores the path plus hash. Render disk is ephemeral: also store gzip bytes in `snapshot_blobs bytea` for payloads the demo must reproduce. Do not use Supabase Storage (no storage key workflow in v1).

### 8.7 `test_runs`

| Field | Type | Req | Notes |
|---|---|---|---|
| id | uuid | yes | |
| preregistration_id | uuid | yes | fk |
| status | text | yes | `queued` `running` `succeeded` `failed` `untestable` |
| started_at / finished_at | timestamptz | no | |
| error_code | text | no | |
| engine_version | text | yes | git sha |
| spec_sha256 | char(64) | yes | must match preregistration |

Index `(status, started_at)` for the job claim. Claim with `UPDATE … WHERE status='queued' AND id=(SELECT … FOR UPDATE SKIP LOCKED)`.

Immutable: `preregistration_id`, `spec_sha256`, `engine_version`. Status may move only forward.

### 8.8 Result tables (insert-only)

`walk_forward_runs`: `id`, `test_run_id`, `fold_index`, `train_end`, `test_start`, `test_end`, `unit_id`, `metrics jsonb`.

`bootstrap_runs`: `id`, `test_run_id`, `metric`, `n_resamples`, `point`, `ci_low`, `ci_high`, `unit` (`weekend`|`event`|`day`).

`dsr_results`: `id`, `test_run_id`, `variant_code`, `sr_hat`, `sr0`, `n`, `n_trials`, `skew`, `kurt`, `dsr`, `sr_annualized_display`.

`pbo_results`: `id`, `test_run_id`, `s_splits`, `pbo`, `n_cols`.

`trap_findings`: `id`, `test_run_id`, `code`, `severity` (`info`|`kill`|`invalidate`), `detail jsonb`, `evidence_ids uuid[]`.

`verdicts`: `id`, `test_run_id` unique, `label` (`KILLED`|`ALIVE`|`UNTESTABLE`), `primary_trap`, `rule_trace jsonb`, `avoided_loss_bps`, `avoided_loss_usd`, `notional_usd`.

`evidence`: `id`, `test_run_id`, `snapshot_id`, `kind`, `summary jsonb`.

None of these rows are updated. A rerun is a new `test_run`.

### 8.9 `research_ledger_entries`

| Field | Type | Req |
|---|---|---|
| id | uuid | yes |
| workspace_id | uuid | yes |
| hypothesis_id | uuid | yes |
| test_run_id | uuid | no |
| stage | text | yes: `KNOWN` `UNKNOWN` `TEST` `RESULT` `DECISION` |
| body | jsonb | yes |
| prior_entry_id | uuid | no |
| created_at | timestamptz | yes |

Append-only. A DECISION of KILLED may be followed by a new TEST only if `body.contradicts_kill_reason` references a new run whose trap set does not include the original `primary_trap`. The API enforces that. The LLM cannot insert ledger rows; the engine does, and the AI “proposal” is stored as `stage=UNKNOWN` with `author=llm` and no metrics.

### 8.10 Paper path

`forecasts`: written at freeze from the spec’s predicted distribution (the engine fills the numbers after the run, as a child of the run, not as an edit of the spec). Fields: `test_run_id`, `metric`, `predicted_mean_bps`, `predicted_ci_low`, `predicted_ci_high`.

`paper_trades` / `fills`: `id`, `hypothesis_id`, `source` (`pasted`|`paper_log`|`bitget_private`), `symbol`, `side`, `px`, `qty`, `fee_bps`, `ts`, `raw jsonb`. Immutable.

`realized_outcomes`: `id`, `forecast_id`, `fill_set_hash`, `realized_bps`, `inside_ci boolean`, `review jsonb`. Insert-only.

Private Bitget fills are optional and off unless `BITGET_API_*` are set. The demo does not need them.

---

## 9. AI boundary

### Allowed calls

| Call | Input | Output schema |
|---|---|---|
| `compile_spec` | `raw_text`, instrument catalog (symbols only), family descriptions | `TestSpecDraft` |
| `explain_verdict` | engine verdict JSON | `{summary, cited_fields[]}` |
| `propose_next` | ledger tail with metrics removed | `{raw_text, why}` |
| `review_fills` | forecast JSON + realized JSON | `{summary, cited_fields[]}` |

`cited_fields` must be JSON pointers into the engine document. The API drops any sentence that contains a number not present in the referenced field.

### Forbidden

The model is not given: fill prices, candle bodies, or prior verdicts at compile time. Compile-time context is the family list, the fee schedule codes (not applied numbers), and the kill floor text.

`TestSpecDraft` has no fields named `sharpe`, `dsr`, `pbo`, `pnl`, `bps`, `n`, or `verdict`. Pydantic rejects extra keys (`extra=forbid`).

### Kill floor the model cannot relax

Stored in code as `KILL_FLOOR`, copied into `canonical_json.kill_floor` at draft time. On freeze, the server overwrites any LLM-supplied floor with `KILL_FLOOR` if the draft is weaker. Weaker means: a lower Sharpe bar, a smaller n, a dropped required baseline, or `select_on=oos`.

```text
KILL_FLOOR:
  oos_mean_bps > 0
  AND oos_sharpe >= 1
  AND oos_sharpe >= 0.5 * is_sharpe
  AND n_oos_units >= family minimum
  AND dsr >= 0.95
  AND ci_low of (strategy − best required baseline) > 0
  AND selection uses IS or pre-registered rule, never OOS
```

### Provider

OpenAI-compatible HTTP. `LLM_BASE_URL` + `LLM_API_KEY` + `LLM_MODEL`. No key was supplied. If any of the three is empty, `compile_spec` returns `503 llm_unavailable` and the client may `POST /test-specs` with a hand-written spec that still passes the schema and the floor. The demo script includes that manual spec so the judge path runs with the LLM off.

Timeout 30s. One retry. No tool-calling into the engine.

### Bitget skills

`bitget-signal` and GetAgent Playbook are not on the verdict path. They do not see the frozen spec. Optional later: a read-only `bitget-agentic` `market` call as a second source check in the smoke test. Production numbers come from REST.

---

## 10. Research engine

Package: `backend/killlab/engine/`. No network imports except through `data/`. Deterministic given a snapshot hash and `engine_version`.

### 10.1 Dataset loading — `data/bitget_rest.py`

- httpx, timeout 20s, 3 retries on 429/5xx with jitter.
- Record `actual_first_ts` from the oldest bar, not the query.
- Known floors to assert in tests (they are observations, re-checked live in phase 4): perp 1h ≈ 2026-09-09; funding ≈ 2026-06-30; rToken weekends usable from mid-June 2026.
- User-Agent `curl/8.0`.

### 10.2 Sessions — `engine/sessions.py`

Functions, all DST-aware via `zoneinfo.ZoneInfo("America/New_York")`:

- `is_weekend_mm(ts) -> bool` Friday 20:00 ET ≤ ts < Sunday 20:00 ET
- `is_stockroute(ts) -> bool` the complement of weekend MM for the equity week (Sunday 20:00 ET through Friday 20:00 ET)
- `us_cash_open(d) -> datetime` 09:30 ET
- `us_cash_close(d) -> datetime` 16:00 ET
- `switch_sunday(week) -> datetime` Sunday 20:00 ET

Do not encode these as fixed UTC hours.

### 10.3 Costs — `engine/costs.py`

`cost_schedule.json`:

```json
{
  "spot_taker_bps": 5,
  "spot_taker_bps_sensitivity": 10,
  "perp_taker_bps": 6,
  "perp_maker_bps": 2,
  "source": "forensic pack; promo spot 5 bps. Re-verify in phase 4 against the fee article before demo."
}
```

Funding cost for a held side: `sign * rate_bps * (hold_hours / interval_hours)` using the name’s own history, not the cross-sectional mean, except when the spec explicitly says `pooled_mean`. The Round 4 pooled mean was about +0.22 bps/8h and is a fixture, not a default for new names.

A spec that omits costs fails freeze (`cost_model_required`).

### 10.4 Walk-forward — `engine/walkforward.py`

- Unit = weekend, event, or day, as declared.
- Expanding window. First test unit index = `min_train_units` (default 8 for weekends, else 60% chronological cut matching Test B only when the spec says `cut=0.6` and that cut was frozen).
- Features and σ are fit on units `< test_unit` only.
- Output one row per test unit per variant per baseline.

### 10.5 Bootstrap — `engine/bootstrap.py`

- Resample the independent unit with replacement, 2000 times, seed stored in the run (`seed` is part of `canonical_json`, default 20260928).
- 90% percentile CI.
- A comparison “beats baseline” requires `ci_low > 0` on the paired difference. This is the T5/T6 rule.

### 10.6 Deflated Sharpe — `engine/dsr.py`

Port `dsr_run.py` without changing the formula. Cite Bailey & López de Prado, Journal of Portfolio Management, 2014.

Non-annualized Sharpe `SR̂` of the per-unit returns.

```text
SR_0 = sqrt(V[{SR_n}]) * [(1-γ) Φ^{-1}(1-1/N) + γ Φ^{-1}(1-1/(N*e))]
DSR  = Φ[ (SR̂ - SR_0) * sqrt(n-1) / sqrt(1 - γ3*SR̂ + ((γ4-1)/4)*SR̂^2) ]
```

- `N` = number of frozen variants. Not a number the model picks after the fact.
- `V` = variance of the variant Sharpes. If only one variant, use the Lo variance approximation already in `lo_sr_var`.
- `γ3`, `γ4` = skew and kurtosis of the return series.
- `n` = number of units, not the annualized horizon.
- Display Sharpe (`* sqrt(252)`) is a separate field and is never passed back into DSR.
- PSR against a benchmark sets `SR_0` to the benchmark’s non-annualized Sharpe (buy-and-hold case).

Golden: Test B best slice, N=12, DSR about 0.47. Tolerance ±0.02. If the port disagrees, the port is wrong.

### 10.7 PBO — `engine/pbo.py`

CSCV as in `cscv_pbo`: matrix of variant returns, `S` splits, `PBO = P(ω < 0.5)`, ω = OOS rank of the IS-best column. Bailey, Borwein, López de Prado, Zhu. Report `S=16` and `S=8` when `n` allows. If `n` is too small for CSCV, PBO is null and the verdict says `pbo=unavailable`. Unavailable PBO does not grant ALIVE. DSR still applies.

### 10.8 Beta — `engine/beta.py`

OLS of strategy unit-returns on the frozen benchmark (same-book buy-and-hold, or SPY perp when the spec says so). Report α annualized, β, t-stat, R². `ALPHA_CLAIM` is false unless `|t| ≥ 2` and α > 0 after costs. A high Sharpe with t < 2 is trap `BETA_AS_ALPHA` (K-A: t=1.63).

### 10.9 Horizon σ — `engine/horizon.py`

σ is the standard deviation of `P(t1)/P(t0)-1` over the actual decision horizon (for weekend wait: t0 → Sunday 20:00 ET), bucketed 0–6h, 6–24h, 24–48h. Per-bar σ is computed only to feed trap `WRONG_HORIZON` when a spec asks for it. It is never the risk term.

### 10.10 Bar alignment — `engine/bars.py`

Event price = last 1m close at or before the event timestamp, within 60s. If the available grain is coarser than 1m and the event is an open, close, or 19:00 ET print, raise `BAR_TIMING` and do not fall back to the hourly bar.

### 10.11 Normalization guard — `engine/normalize.py`

Allowed: returns, log returns. Forbidden inside a contrast: dividing by a center estimated on the same partition as the treatment (the T1 median spot/perp rescale). The spec lists transforms as an enum. Unknown transforms fail freeze.

### 10.12 Verdict — `engine/verdict.py`

Order:

1. Family `unsupported` → UNTESTABLE `family_unsupported`.
2. Any trap with `severity=invalidate` → UNTESTABLE.
3. `n` below the family minimum → UNTESTABLE `insufficient_units`.
4. Frozen kill rule fails, or DSR < 0.95, or CI of excess over the best required baseline includes 0 or is negative → KILLED. `primary_trap` = the first failing check.
5. Else ALIVE.

`avoided_loss_bps` = (naive selected-slice mean) − (pre-registered pooled mean), only when both were computed by this run. USD = bps × frozen notional. If the naive slice was not in the frozen variant list, do not invent it.

Numerical tolerance for goldens: DSR ±0.02, mean bps ±1.0, CI endpoints ±2.0. Prices compared at 1e-8 relative.

---

## 11. Trap scanner

Each detector returns zero or more `TrapFinding`. The scanner does not change returns. The verdict reads the findings.

### T1 `MULTIPLE_TESTING`

- Input: frozen variant count N, per-variant IS and OOS series, `selection` block.
- Logic: N < 1 fails freeze. If `selection.split != "IS"` → severity kill. DSR uses this N. If the maximum OOS Sharpe variant differs from the IS-selected variant, record `info` (selection did not match the winner) but the reported result stays the IS-selected one.
- Data: the run’s own series.
- Rule: DSR < 0.95 → severity kill.
- Test: 12 Test B variants, best OOS slice, expect DSR < 0.95 and kill.

### T2 `BETA_AS_ALPHA`

- Input: strategy and benchmark unit returns, spec flag `claims_alpha` (default true for `session_timing` and `event_earnings`).
- Logic: OLS. If `claims_alpha` and (α ≤ 0 or t < 2) against the same-book benchmark → kill.
- Data: both series from the same snapshot.
- Test: overnight maker vs EW close-to-close, expect t < 2 and kill. Do not use yfinance as the Bitget series in this test; use the cached unit returns labeled `fixture`.

### T3 `BAR_TIMING`

- Input: spec event timestamps, bar grain, bar open times.
- Logic: if grain > 60s and the event is in `{cash_open, cash_close, ah_1900}` → invalidate. If the matched bar’s open differs from the event by > 60s → invalidate.
- Data: candle snapshot metadata.
- Test: 16:00 ET compared to the 16:00 1h bar → finding. Same comparison on 1m with a bar at 15:59 → no finding.

### T4 `WRONG_HORIZON`

- Input: spec `risk.sigma` and `risk.horizon`.
- Logic: if `sigma.span != horizon.span` → kill. In particular `span=bar` while `horizon=until_sunday_switch` is the Y3 bug.
- Data: none beyond the spec; the engine also computes both numbers and attaches them as evidence.
- Test: fixture with per-bar σ 4 bps and horizon σ 40 bps → finding, and the decision uses 40.

### T5 `LEAKAGE`

- Input: train unit ids, test unit ids, feature code.
- Logic: set intersection non-empty → invalidate. Rolling windows must be right-aligned and end at t−1. A feature file that references `center=True` is rejected at freeze (enum, not free code).
- Data: fold manifests.
- Test: E1-style σ estimated on a sample that includes the test weekend → finding.

### T6 `VENUE_HISTORY`

- Input: `requested_start`, `actual_first_ts`, prose claim `claimed_start` if the compiler extracted one.
- Logic: if `claimed_start < actual_first_ts` → kill (the claim is false). Metrics use only bars inside `[actual_first_ts, actual_last_ts]`. If that truncates n below the minimum → the verdict becomes UNTESTABLE and this finding stays attached.
- Data: snapshot header.
- Test: request 2026-02-07 on perp 1h, actual first ≈ 2026-09-09 → finding.

### T7 `EFFECT_ERASE`

- Input: transform enum and the partition it is estimated on.
- Logic: a location statistic (median, mean) estimated inside each treatment bucket and then used to rescale that bucket → invalidate. This is the T1 median spot/perp rescale.
- Data: spec transforms.
- Test: spec with `rescale=median_ratio_within_regime` → freeze rejected.

### T8 `WRONG_COST_BASELINE`

- Input: family, cost model, baseline codes, for carry also Earn and BTC/ETH results.
- Logic: missing cost model → freeze error. `carry_basis` without `earn_usdt` and `btc_eth_carry` → freeze error. After the run, net APR ≤ max(those baselines) → kill. Maker fees on a taker-only idea → kill (`maker_unrealistic`) unless the spec freezes `execution=maker` and the data has a fill assumption marked `unverified`.
- Data: fee file + funding snapshot + Earn snapshot.
- Test: carry book at the forensic OOS APR below Earn → kill.

### T9 `WAITING_RISK`

- Input: execution spec alternatives `NOW`, `WAIT`, `LADDER`, lambda grid, horizon σ.
- Logic: a verdict that WAIT beats NOW at λ=0 only, with no λ in the frozen grid, → kill. WAIT’s score is `cost_wait + lambda * sigma_h`. Missing `sigma_h` → invalidate. “Always wait” as the only variant is rejected at freeze; the grid must include NOW.
- Data: L2 walk snapshots for both regimes, horizon returns.
- Test: weekend $20k case where NOW wins once horizon σ is used → not ALIVE for “always wait”.

---

## 12. Pre-registration

```text
POST /hypotheses          raw text stored
POST /hypotheses/{id}/compile
                          LLM draft OR 503
PUT  /test-specs/{id}     human edits while status=draft
POST /test-specs/{id}/freeze   body.confirm = "FREEZE"
                          server recomputes hash, writes preregistration,
                          inserts baselines/variants, flips status
POST /runs                rejected unless frozen
```

Enforcement, all of them:

1. DB trigger rejects UPDATE/DELETE on frozen spec columns and on preregistration.
2. `content_sha256` checked on every run insert.
3. Bitget client requires `RunContext`.
4. Kill floor replaced server-side if weaker.
5. `select_on=oos` rejected.
6. Freeze response includes the hash. The UI shows it before confirm. A mismatch on confirm is `409`.

What cannot change after freeze: hypothesis raw text, family, baselines, variants, kill rule, dataset cutoff, test window, target metric, cost model, lambda grid, notional, seed, transform list.

Edits after freeze create a new hypothesis. They do not version the frozen spec in place.

---

## 13. Verdict system

Labels: `KILLED`, `ALIVE`, `UNTESTABLE`.

The card payload:

```json
{
  "label": "KILLED",
  "primary_trap": "MULTIPLE_TESTING",
  "rule_trace": [{"rule": "dsr", "value": 0.47, "bar": 0.95, "pass": false}],
  "avoided_loss_bps": 112.7,
  "avoided_loss_usd": 11.27,
  "notional_usd": 1000,
  "n_units": {"is": 204, "oos": 136, "selected_slice": 45},
  "spec_sha256": "<hex>",
  "engine_version": "<git>"
}
```

Numbers in this example are the forensic result shape. The live card must be the engine’s output for that run, not this document.

No-action: UNTESTABLE renders as “not enough Bitget history” plus `actual_first_ts` and the count obtained. It does not render a Sharpe.

---

## 14. Research ledger

Stages in order: `KNOWN` (the raw idea), `UNKNOWN` (what would kill it, written at freeze from the kill floor), `TEST` (run id), `RESULT` (verdict id), `DECISION` (same label as the verdict).

A killed hypothesis returns `409 already_killed` on a new compile unless `body.contradicts` names a new observation that the original trap did not use (for example a longer perp history that moves `actual_first_ts`). The engine, not the LLM, checks that claim against the new snapshot.

Next hypothesis: the LLM proposes text. It is a new `hypotheses` row only after the human posts it. Nothing is auto-enqueued.

---

## 15. API contract

Base: `/v1`. Auth: `Authorization: Bearer <KILLAB_API_TOKEN>` on every route except `GET /health` and `GET /v1/openapi.json`. Missing token: `401`. Wrong token: `403`.

Errors:

```json
{"error": {"code": "not_frozen", "message": "…", "detail": {}}}
```

Codes: `validation` 422, `not_frozen` 409, `already_killed` 409, `hash_mismatch` 409, `llm_unavailable` 503, `bitget_unavailable` 503, `insufficient` 200 with verdict UNTESTABLE (not an HTTP error), `db_unavailable` 503, `rate_limited` 429.

Idempotency: `Idempotency-Key` header required on POST freeze, POST runs, POST fills. Replays return the original response for 24h.

Rate limit: 30 compiles/hour/token, 10 runs/hour/token. Public Bitget calls are additionally capped at 8 concurrent.

### `GET /health`

200 `{"status":"ok","db":"ok","engine_version":"<sha>"}`. DB down: 503 `"db":"down"`. No Bitget call.

### `POST /v1/hypotheses`

```json
{"raw_text": "Trade NVDA and TSLA perps in the direction of the after-hours earnings move."}
```

201 `{"id": "…", "family": null, "status": "stored"}`. Family is null until compile.

### `POST /v1/hypotheses/{id}/compile`

202 `{"test_spec_id": "…", "status": "draft", "spec": {…}, "warnings": []}`.

503 if the LLM is down, body includes `manual_spec_accepted: true`.

### `PUT /v1/test-specs/{id}`

Draft only. 409 if frozen. Body is a `TestSpec` (section 15.1).

### `POST /v1/test-specs/{id}/freeze`

```json
{"confirm": "FREEZE", "expected_sha256": "<hex>"}
```

201 `{"preregistration_id": "…", "frozen_at": "…", "spec_sha256": "…"}`.

### `POST /v1/runs`

```json
{"preregistration_id": "…"}
```

202 `{"test_run_id": "…", "status": "queued"}`.

### `GET /v1/runs/{id}`

200 `{"status": "succeeded|running|queued|failed|untestable", "error_code": null}`.

### `GET /v1/runs/{id}/results`

200 walk-forward summary, bootstrap CIs, DSR rows, PBO. 409 if not finished.

### `GET /v1/runs/{id}/traps`

200 `{"findings": […]}`.

### `GET /v1/runs/{id}/verdict`

200 the card in section 13.

### `GET /v1/runs/{id}/evidence`

200 snapshot ids, hashes, `actual_first_ts`, fee schedule hash, Earn `as_of`.

### `GET /v1/ledger?hypothesis_id=`

200 entries in `created_at` order.

### `POST /v1/hypotheses/{id}/fills`

```json
{"source": "pasted", "fills": [{"symbol": "NVDAUSDT", "side": "buy", "px": 1, "qty": 1, "fee_bps": 6, "ts": "2026-09-28T23:00:00Z"}]}
```

201. `source=bitget_private` without API keys: 422 `private_fills_not_configured`.

### `POST /v1/forecasts/{id}/reconcile`

Body: `{"fill_ids": ["…"]}`. 200 realized outcome. Requires a succeeded run.

### `POST /v1/ledger/{decision_id}/next`

Body empty. 200 `{"proposed_raw_text": "…", "stored": false}`. Human must POST a new hypothesis to store it.

### 15.1 `TestSpec` (draft and frozen)

Required keys: `family`, `instruments[]`, `venue` (`bitget_perp`|`bitget_rtoken`), `test_start`, `test_end`, `grain`, `costs`, `baselines[]`, `variants[]`, `kill_floor`, `selection`, `target_metric`, `notional_usd`, `seed`, `transforms[]`, `risk` (horizon, lambda grid if execution family).

`extra=forbid`. Unknown family → the compiler sets `family=unsupported` and freeze is allowed only to record UNTESTABLE, or the human deletes the draft. Freeze of `unsupported` creates a run that immediately finishes `untestable` without calling Bitget.

---

## 16. Authentication and Bitget account modes

| Mode | Credentials | What works |
|---|---|---|
| Public research | None for Bitget. `KILLAB_API_TOKEN` for our API. | Compile, freeze, run, verdict, ledger. This is the demo. |
| Pasted fills | None | Reconcile against the forecast |
| Paper log | User pastes the GetAgent Studio / paper export | Same. KillLab does not log into Studio. |
| Private reads | `BITGET_API_KEY/SECRET/PASSPHRASE` on the server only | `GET` fills for symbols in the hypothesis. Off by default. |
| Agentic OAuth | Browser flow the user already did for forensics; not required | Do not block v1 on it. Private mode may later call `bitget-agentic` `account` read. If it returns “requires API credentials”, fall back to pasted fills. |
| Browser inspection | Chrome, logged-out | Fee pages and Earn APR when the API parse fails. No secrets in the browser profile used for that. |

The core product does not connect an account.

App auth for v1 is a single bearer token, not Supabase Auth. No anon key was supplied, and a hackathon demo does not need user accounts. The token is generated in phase 2 (`python -c "import secrets; print(secrets.token_urlsafe(32))"`) and stored in `.env` and Render. It is not invented by this plan.

The Vercel app must not ship that token to the browser. Phase 18 adds a same-origin proxy (Vercel serverless or the framework’s server routes) that attaches the bearer. If the external frontend is a pure static SPA with no server, stop and add the proxy before any screen calls the API. Do not prefix the token with `NEXT_PUBLIC_` or `VITE_`.

---

## 17. Supabase

Persistence is required: frozen specs, ledger, and snapshot hashes.

Project ref is the pooler user suffix already in `.env` (`iytrzoxdczmpzcfiebgb`). Region `eu-west-1`.

- Runtime: `DATABASE_URL`, port 6543, transaction pooler, IPv4. SQLAlchemy `NullPool`, psycopg `prepare_threshold=None`.
- Migrations: `DIRECT_URL`, port 5432, session pooler. Alembic only.
- The password in the supplied URI contained an `@`. `.env` percent-encodes it. Phase 2 proves the connection. If auth fails, stop and ask the user to re-copy the password. Do not rotate or reset the database password from here.
- No `SUPABASE_SERVICE_ROLE_KEY` and no `anon` key. Do not create them unless a later phase has a written reason.
- Schema `killlab` (not `public`). Revoke `anon` and `authenticated` on `killlab`. Enable RLS on every table with no policies, so a future Data API exposure returns nothing. The server connects as the postgres role through the pooler and bypasses RLS. That is acceptable only because the API process is the sole client. Document it in the migration header.
- Do not expose `killlab` in the Data API settings.
- Backups: rely on the Supabase project’s automatic backups. Do not build a second backup job in v1. Record in the phase 2 evidence note that point-in-time recovery was not tested.
- Local dev: the same remote database is acceptable for this hackathon if `KILLAB_ENV=development`. Tests use a transaction rollback or a `pytest` schema, not the frozen demo rows.

---

## 18. Render

| Item | Value |
|---|---|
| Type | Web service |
| Name | `killlab-api` |
| Region | Frankfurt |
| Runtime | Docker, Python 3.12 |
| Build | `docker build` (see Dockerfile in phase 3) |
| Start | `uvicorn killlab.api:app --host 0.0.0.0 --port $PORT` |
| Health | `GET /health` |
| Plan | A plan that does not spin down. Sleep breaks queued runs. |
| Env | Every key in section 20 marked runtime. Never the GitHub token in the app env. |
| Migrate | Release command: `alembic upgrade head` using `DIRECT_URL` |
| Logs | stdout JSON, no payloads of fills at info level |
| CORS | `FRONTEND_ORIGIN` only, plus the Vercel production host after phase 18. No `*`. |
| Disk | Snapshot blobs in Postgres, not local disk |

`RENDER_API_KEY` is for the CLI/API that creates the service in phase 15. The running app does not read it.

Failure: failed health → Render restarts. In-flight `running` rows older than 15 minutes are reset to `queued` on startup (at most 2 attempts, then `failed` `interrupted`).

Do not deploy the frontend to Render.

---

## 19. Vercel

Not used until phase 18.

| Item | Value |
|---|---|
| Project | Linked to `mohamedwael201193/KillLab`, root `FRONTEND` once that folder exists |
| Build | Whatever the external app declares (`npm run build` or equivalent). Do not change it until integration. |
| Output | Framework default |
| Env | `BACKEND_PUBLIC_URL`, `KILLAB_API_TOKEN` as a server env only |
| SPA | Fallback to `index.html` if it is a client router. API calls go to the proxy, not directly to Render, until the proxy is proven. |
| Preview | Preview deployments get no production token. They point at a staging backend or stay disconnected. |

`VERCEL_TOKEN` is for the CLI in phase 18 only.

The GitHub repo URL supplied as `hhttps://…` is stored corrected as `https://github.com/mohamedwael201193/KillLab`. The repo currently contains a README only. Application code is not pushed by this plan.

---

## 20. Environment variables

Values are not in this file. They live in `KillLab/.env` (gitignored). The classification and the 2026-09-28 validation results are in `KillLab/docs/evidence/phase0_env_status.json`.

Phase 0 is done. Both database URLs returned `select 1` on Postgres 17.6. `KILLAB_API_TOKEN` was generated locally. GitHub, Render, and Vercel tokens authenticated. No application was deployed.

psycopg 3.3.4 rejects a `pgbouncer` query parameter (`invalid URI query parameter`). The stored runtime URI may still contain it. The application must strip that parameter and connect with `prepare_threshold=None`. `DIRECT_URL` needs no strip. Do not print either URI.

| Name | Class | Required | Status on 2026-09-28 | Secret | Render runtime | Vercel | Browser |
|---|---|---|---|---|---|---|---|
| `RENDER_API_KEY` | CLI only | Phase 15 | present, API 200 | yes | never | never | no |
| `VERCEL_TOKEN` | CLI only | Phase 18 | present, API 200 | yes | never | never | no |
| `GITHUB_TOKEN` | CLI only | until a requested push | present, admin on the repo | yes | never | never | no |
| `GITHUB_REPO` | config | yes | `mohamedwael201193/KillLab`, branch `main` | no | never | never | no |
| `DATABASE_URL` | runtime | yes | `select 1` ok after param strip | yes | yes | never | no |
| `DIRECT_URL` | migrations | yes | `select 1` ok | yes | yes, release command only | never | no |
| `KILLAB_API_TOKEN` | generated | yes | present | yes | yes | server env only | no |
| `KILLAB_ENV` | config | yes | `development` | no | `production` in prod | no | no |
| `LLM_API_KEY` | optional | no | absent | yes | only if set | never | no |
| `LLM_BASE_URL` | public default | when key set | handbook host set | no | yes | never | no |
| `LLM_MODEL` | public default | when key set | `qwen3.8-max` (live GitBook) | no | yes | never | no |
| `LLM_TIMEOUT_S` | config | yes | 30 | no | yes | no | no |
| `BITGET_API_KEY` | optional | no | absent | yes | only if set | never | no |
| `BITGET_API_SECRET` | optional | no | absent | yes | only if set | never | no |
| `BITGET_API_PASSPHRASE` | optional | no | absent | yes | only if set | never | no |
| `BITGET_HTTP_TIMEOUT_S` | config | yes | 20 | no | yes | no | no |
| `BITGET_REST_BASE` | config | yes | `https://api.bitget.com` | no | yes | no | no |
| `SUPABASE_URL` | unused in v1 | no | derived, not used by SQL | no | no | no | no |
| `SUPABASE_ANON_KEY` | deliberately unused | no | absent | yes | never | never | no |
| `SUPABASE_SERVICE_ROLE_KEY` | deliberately unused | no | absent | yes | never | never | no |
| `BACKEND_PUBLIC_URL` | derived at deploy | Phase 15 | empty | no | no | server env | no |
| `FRONTEND_ORIGIN` | derived at deploy | Phase 18 | empty | no | yes | no | the origin is public; the variable is not a secret |
| `SESSION_SECRET` | deliberately unused | no | absent | yes | never | never | no |
| `LOG_LEVEL` | config | yes | `INFO` | no | yes | no | no |
| `RUN_STALE_MINUTES` | config | yes | 15 | no | yes | no | no |

Nothing is missing that blocks Phase 1. The LLM key is optional. Private Bitget keys are optional. Anon and service-role keys must stay absent.

---

## 21. Security

- `KillLab/.gitignore` ignores `.env` and `.env.*`, then un-ignores `.env.example`.
- A workspace `.gitignore` does the same from the parent tree. `git check-ignore -v KillLab/.env` matches `KillLab/.gitignore` line 1. `git ls-files` shows no `.env`. Evidence: `phase0_repo_status.txt`.
- No secret in this plan, in evidence, or in source.
- Pooler URIs stay on the server. CORS does not expose the database.
- Bearer compare is constant time.
- `KILLAB_API_TOKEN` is never prefixed `NEXT_PUBLIC_` or `VITE_`. Phase 18 greps the frontend bundle for the token and fails the phase if it appears.
- CLI tokens (`RENDER_API_KEY`, `VERCEL_TOKEN`, `GITHUB_TOKEN`) are not in the Render service env.
- The skill forbids withdraw and main-account transfer. The engine never imports an order client.
- Rotate the tokens that were pasted into chat if that transcript is shared. This file does not repeat them.

---

## 22. Observability

JSON logs: `ts`, `level`, `request_id`, `run_id`, `event`, `mcp_ok`. Do not log candle bodies, fills, URIs, or the bearer token.

Events: `mcp_check`, `spec_frozen`, `run_started`, `run_finished`, `verdict`, `bitget_error`, `llm_error`.

`GET /health` is the only probe. It checks the database and does not call Bitget. The phase-start MCP check is separate and is recorded in the phase evidence file.

---

## 23. Testing strategy

| Level | Where | Must cover |
|---|---|---|
| Unit | `tests/unit` | DSR, PBO, sessions DST, costs, horizon σ, each trap |
| Property | `tests/property` | Frozen hash stable under key reorder; DSR rejects an LLM-shaped dict; snapshot timestamps monotonic; verdict is one of three labels |
| Golden | `tests/golden` | DSR about 0.47 on the Test B fixture; buy-and-hold DSR about 0.51. Header `FIXTURE NOT FOR API` |
| Integration | `tests/integration` | Freeze then run on a recorded payload. Live MCP `market` plus REST fallback |
| Contract | `tests/contract` | Every route in section 15, idempotency, 409 after freeze |
| Failure | `tests/failure` | MCP down, REST 503, LLM timeout, DB down, short history, malformed text |
| Regression | `tests/regression` | T1 rescale rejected; hourly bar is not 09:30; per-bar σ is not horizon σ; `pgbouncer` query param is stripped |
| Security | `tests/security` | No order symbol; bundle grep has no token; production cannot import fixtures |
| Data integrity | `tests/data` | `actual_first_ts` kept; no interpolation; n below minimum is UNTESTABLE |
| Freeze integrity | `tests/freeze` | UPDATE of a frozen spec fails; snapshot before freeze is rejected |
| Live smoke | phases 4 and 16 | Real MCP `market` and real REST. No order |
| Browser | phase 18+ | Only after `FRONTEND/` exists |
| Env | `tests/env` | Required keys present as names; test does not print values |

`pytest -q` is the gate. A bug found during a phase becomes a regression test in that phase.

---

## 24. Phase-by-phase execution

Phase 0 has already been executed. Phases 1 through 20 have not. A phase does not start until the previous phase's evidence artifact exists and its exit criteria are true.

Shared rule for every phase below: the first task is the MCP check in the "Bitget MCP and skill" section. Record `authorized` as a boolean and `market.ok` as a boolean in that phase's evidence file. Do not record the key.

Future code, not created by this plan:

```text
KillLab/backend/   # phases 2–16
KillLab/FRONTEND/  # external, phase 17+
```

### Phase 0 — Environment, credentials, and repository preflight

### Entry Preconditions

The concept files exist. `.env` contains the user-supplied infrastructure values. No application code is required.

### RESOURCES / MCP / SKILLS / DOCS

1. MCP: `user-bitget-agentic` `get_auth_status`, then `market` `candlesHistory` `NVDAUSDT` `USDT-FUTURES` `1H` limit 2, then `market` `instruments` `RNVDAUSDT` `SPOT`. Also `user-bitget-mcp-server` `cloud_mcp_status`.
2. Skill: `C:\Users\LOQ\.cursor\skills\bitget-agentic\SKILL.md`. Read sections 1 and 3. Do not run section 4 (trading).
3. Local files: `04-FINAL-CONCEPT.md` (known limitations, no private key required), `00-HACKATHON-DOCS.md` (Agent Hub, MCP, Qwen), `01-FORENSICS.md` (MCP 503 history, Qwen base URL).
4. Official URLs: the list in `phase0_docs.json`. All returned HTTP 200 on 2026-09-28.
5. Repos: `https://github.com/mohamedwael201193/KillLab`, `https://github.com/Bitget-AI/agent_hub`.
6. APIs: GitHub REST, Render `GET /v1/services`, Vercel `GET /v2/user`, Postgres `select 1`. No order API.
7. Chrome: GitBook Track 3 anchor, hackathon hub, the KillLab GitHub page. Confirmed Review & Self-Evolution and `qwen3.8-max`.
8. Env: every name in section 20.
9. Evidence: `KillLab/docs/evidence/phase0_*.json` and `phase0_repo_status.txt`.

### Objective

Discover, validate, and classify every variable. Prove the database. Prove ignore rules. Do not deploy.

### Exact Tasks

Done on 2026-09-28. See evidence. Do not repeat the secret-bearing steps in logs.

### Files Created

`KillLab/.env`, `KillLab/.env.example`, `KillLab/.gitignore`, workspace `.gitignore`, `KillLab/docs/evidence/phase0_env_status.json`, `phase0_repo_status.txt`, `phase0_bitget_mcp.json`, `phase0_docs.json`, `phase0_connect.json`.

### Files Modified

This plan.

### Implementation Details

None. No application code.

### Environment Variables

Section 20.

### Database Changes

None. `select 1` only.

### API / External Dependencies

GitHub, Render, Vercel, Supabase pooler, Bitget MCP. No writes except generating `KILLAB_API_TOKEN` into `.env`.

### Browser / Live Verification

Chrome snapshot of the live handbook. MCP `market` returned two perp candles and the rToken instrument.

### Tests

`git check-ignore -v KillLab/.env` matches. `git ls-files` has no `.env`.

### Failure Conditions

A failed `select 1` on `DIRECT_URL` would have stopped the plan. It succeeded. Runtime failed only on the `pgbouncer` query parameter and succeeded after the documented strip.

### Recovery Procedure

If a later machine fails `select 1` with an auth error, stop and ask the user to confirm the password. Do not reset the database.

### Exit Criteria

The checklist in the Phase 0 gate is true. It is true as of this file.

### Evidence Artifact

`KillLab/docs/evidence/phase0_env_status.json`

### Phase 1 — Source and requirements freeze

### Entry Preconditions

Phase 0 evidence exists. Database `select 1` is still true if the operator re-checks. No Phase 2 files exist yet.

### RESOURCES / MCP / SKILLS / DOCS

1. MCP: `get_auth_status`, then `market` `instruments` `category=SPOT` `symbol=RNVDAUSDT`. Confirms the instrument catalog the requirements will name.
2. Skill: same skill file, auth section only.
3. Local files:
   - `04-FINAL-CONCEPT.md` — thesis, mechanism, demo, failure behaviour, limitations
   - `06-JUDGMENT.md` — §12 gates only. Sections 1–11 are the killed RegimeDesk record and are not requirements
   - `01-FORENSICS.md` — ROUND 3-4 table (history floors, fees, empty books)
   - `03-IDEA-KILLING.md` — kill rows, so those products are not rebuilt
   - `00-HACKATHON-DOCS.md` — § IV Track 3 and § V toolkit
   - `docsbitget.md` — same handbook text if a line in `00` is disputed
4. URLs: `https://bitget-ai.gitbook.io/bitgetai_hackathons2#track-3-ai-trading-desk-ai-research-workbench`
5. Repos: none to clone.
6. APIs: MCP `market` only.
7. Chrome: re-open the Track 3 anchor if the handbook hash in `phase0_docs.json` is older than 7 days.
8. Env: none new.
9. Fixtures: none.

### Objective

Write `KillLab/backend/docs/REQUIREMENTS.md` as a checklist. Each line cites a source file and a section. No line cites `05-BUILD-HANDOFF.md`.

### Exact Tasks

Copy the decision table in section 4 of this plan into that checklist with status `open`. Add one line that MCP `market` is a phase-start check and REST is the fallback.

### Files Created

`KillLab/backend/docs/REQUIREMENTS.md`

### Files Modified

None in the forensic pack.

### Implementation Details

Not code.

### Environment Variables

Read-only.

### Database Changes

None.

### API / External Dependencies

MCP `market` instruments.

### Browser / Live Verification

Track 3 core question still matches `04-FINAL-CONCEPT.md`.

### Tests

A text check: `REQUIREMENTS.md` does not contain `SecondBook`, `OpenBridge`, or `RegimeDesk` as a product to build.

### Failure Conditions

The live handbook renames Review & Self-Evolution. Stop and update the concept citation before Phase 2.

### Recovery Procedure

Re-read the GitBook page. Do not guess a new sub-theme.

### Exit Criteria

Checklist exists, every item has a source path, MCP evidence line is attached.

### Evidence Artifact

`KillLab/backend/docs/evidence/phase1_requirements.txt` with the MCP boolean and the line count.

### Phase 2 — Database foundation

### Entry Preconditions

Phase 1 checklist exists. Phase 0 `select 1` succeeded.

### RESOURCES / MCP / SKILLS / DOCS

1. MCP: `get_auth_status` and `market` `discountRate` (collateral reference, no order). Record ok/fail. This phase does not use the payload for schema design.
2. Skill: same file. No trading.
3. Local files: `04-FINAL-CONCEPT.md` known limitations (ledger must survive restarts); this plan sections 8 and 17.
4. URLs: `https://supabase.com/docs/guides/database/connecting-to-postgres`, `https://www.psycopg.org/psycopg3/docs/api/connections.html`, `https://alembic.sqlalchemy.org/en/latest/tutorial.html`, `https://docs.sqlalchemy.org/en/20/dialects/postgresql.html`
5. Repos: none.
6. APIs: Postgres only.
7. Chrome: Supabase dashboard only if `select 1` fails. Do not copy a new password into the plan.
8. Env: `DATABASE_URL`, `DIRECT_URL`, `KILLAB_ENV`.
9. Evidence: `phase2_connect.txt` contains `ok` and `server_version` only.

### Objective

Prove the connection from the future app config loader. Apply no product schema yet beyond Alembic's version table if the loader's smoke migration is empty.

### Exact Tasks

Connect with psycopg, strip `pgbouncer`, `prepare_threshold=None`, `select 1`, `select current_setting('server_version')`. Write `ok` and the version. Do not create product tables in this phase if Phase 3 owns the first migration. An empty Alembic env is allowed.

### Files Created

`KillLab/backend/docs/evidence/phase2_connect.txt`

### Files Modified

None.

### Implementation Details

The loader reads `.env` and never logs the URI.

### Environment Variables

`DATABASE_URL`, `DIRECT_URL`.

### Database Changes

None required. `select 1` is not a migration.

### API / External Dependencies

Supabase pooler, eu-west-1, IPv4.

### Browser / Live Verification

Not required when `select 1` works.

### Tests

The connect script exits 0 and its output file has no `@` and no `postgres`.

### Failure Conditions

Auth error. Stop.

### Recovery Procedure

Ask the user to confirm the password. Do not reset it.

### Exit Criteria

`phase2_connect.txt` says ok and a version. MCP check recorded.

### Evidence Artifact

`KillLab/backend/docs/evidence/phase2_connect.txt`

### Phase 3 — Backend foundation

### Entry Preconditions

Phase 2 evidence exists.

### RESOURCES / MCP / SKILLS / DOCS

1. MCP: `get_auth_status`, `market` `tickers` `category=USDT-FUTURES` `symbol=NVDAUSDT`. Health must not depend on this call.
2. Skill: same file.
3. Local files: this plan sections 15, 18, 21.
4. URLs: `https://fastapi.tiangolo.com/tutorial/cors/`, `https://fastapi.tiangolo.com/advanced/events/`, `https://render.com/docs/docker`
5. Repos: none.
6. APIs: local `/health` only.
7. Chrome: none.
8. Env: `KILLAB_API_TOKEN`, `KILLAB_ENV`, `LOG_LEVEL`, `DATABASE_URL`.
9. Evidence: pytest output.

### Objective

FastAPI app, `/health`, config loader, Dockerfile, bearer auth, OpenAPI. No research routes yet.

### Exact Tasks

Implement only the foundation listed in the earlier Phase 3 note: health checks the DB, 401 without the bearer, 503 when the DB is blocked.

### Files Created

`KillLab/backend/**` foundation files. Not part of this planning task.

### Files Modified

None outside `KillLab/backend`.

### Implementation Details

Sections 15 and 18. Startup does not pull Bitget.

### Environment Variables

Runtime set in section 20. Not the CLI tokens.

### Database Changes

Alembic version table only if the release command needs it. Product tables start in Phase 7.

### API / External Dependencies

None external except the DB.

### Browser / Live Verification

None.

### Tests

Health 200, health 503, auth 401.

### Failure Conditions

`/health` reports ok when the DB is down.

### Recovery Procedure

Fix the probe before Phase 4.

### Exit Criteria

`docker build` succeeds and the three tests pass. MCP check recorded.

### Evidence Artifact

`KillLab/backend/docs/evidence/phase3_pytest.txt`

### Phase 4 — Bitget data layer

### Entry Preconditions

Phase 3 health tests pass.

### RESOURCES / MCP / SKILLS / DOCS

1. MCP: `get_auth_status`; `market` actions `candlesHistory`, `fundingRateHistory`, `orderbook`, `recentFills` for `NVDAUSDT` and `RNVDAUSDT` as the action allows. This is the primary read.
2. Skill: same file. Public `market` does not need a private key.
3. Local files: `01-FORENSICS.md` ROUND 3-4 floors; this plan section 7.
4. URLs: `https://www.bitget.com/docs/uta/agent-hub`, `https://github.com/Bitget-AI/agent_hub`, `https://api.bitget.com` candle docs linked from that hub.
5. Repos: `Bitget-AI/agent_hub` only to confirm the verb names if `market` schema drifts.
6. APIs: MCP v3 path already observed, plus v2 REST fallback.
7. Chrome: fee article only if `cost_schedule.json` is being versioned. Do not hardcode a new fee without the page.
8. Env: `BITGET_REST_BASE`, `BITGET_HTTP_TIMEOUT_S`. Not the private triple.
9. Evidence: `phase4_floors.json` with `actual_first_ts` and a hash of the first page. No candle dump of the full history.

### Objective

A data client that records the real history floor and refuses to invent bars.

### Exact Tasks

Paginate. Persist `actual_first_ts`. Compare with the forensic floors (perp 1h about 2026-09-09, funding about 2026-06-30). If the live floor moved by more than 7 days, update section 7.5 before any later phase uses the old date.

### Files Created

`backend/killlab/data/bitget_rest.py` and the MCP adapter, in a later implementation pass.

### Files Modified

This plan section 7.5 only if floors moved.

### Implementation Details

Section 7. User-Agent `curl/8.0` on REST. MCP client does not log credentials.

### Environment Variables

`BITGET_REST_BASE`, `BITGET_HTTP_TIMEOUT_S`.

### Database Changes

`dataset_snapshots` table may be created here or in Phase 7. If created here, it is insert-only.

### API / External Dependencies

Bitget public market only.

### Browser / Live Verification

MCP and one REST call for the same symbol. Both must return a first timestamp or the REST fallback must be marked used.

### Tests

Pagination fixture; unknown symbol is an error, not an empty success; MCP failure falls through to REST.

### Failure Conditions

Both MCP and REST fail.

### Recovery Procedure

Stop. Do not substitute yfinance for a Bitget candle.

### Exit Criteria

`phase4_floors.json` written. Three symbols attempted. Hashes present.

### Evidence Artifact

`KillLab/backend/docs/evidence/phase4_floors.json`

### Phase 5 — Research engine

### Entry Preconditions

Phase 4 floors file exists.

### RESOURCES / MCP / SKILLS / DOCS

1. MCP: `get_auth_status`, `market` `candlesHistory` for the symbol used in the golden comparison, so the engine's bar clock is checked against a live candle open time.
2. Skill: same file.
3. Local files: `_forensics/round4/dsr/dsr_run.py` (formula only), `04-FINAL-CONCEPT.md` mechanism step 2.
4. URLs: Bailey & López de Prado 2014 is the citation inside `dsr_run.py`. Do not add a new formula.
5. Repos: none.
6. APIs: MCP read only. Engine code itself has no HTTP.
7. Chrome: none.
8. Env: none beyond Phase 4.
9. Fixtures: copy the DSR inputs once into `tests/fixtures` with the fixture banner.

### Objective

Port sessions, costs, walk-forward, bootstrap, DSR, PBO, beta, horizon σ. No network inside `engine/`.

### Exact Tasks

Golden DSR within ±0.02 of 0.47. DST tests for a January Friday and a July Friday.

### Files Created

`backend/killlab/engine/*` during implementation.

### Files Modified

None in forensics.

### Implementation Details

Section 10.

### Environment Variables

None new.

### Database Changes

None.

### API / External Dependencies

MCP check only. Math is local.

### Browser / Live Verification

The live candle open time is not used as a golden number. It only checks the parser.

### Tests

Golden, DST, seed-stable bootstrap.

### Failure Conditions

Golden delta greater than 0.02.

### Recovery Procedure

The port is wrong. Do not change the fixture to match the port.

### Exit Criteria

Golden test green. MCP check recorded.

### Evidence Artifact

`KillLab/backend/docs/evidence/phase5_golden.txt`

### Phase 6 — Nine-trap scanner

### Entry Preconditions

Phase 5 golden passes.

### RESOURCES / MCP / SKILLS / DOCS

1. MCP: `get_auth_status`, `market` `candles` `interval=1H` and, if the action allows, a 1m candle. Used only as the live example for `BAR_TIMING` (a 1h bar is not the cash print).
2. Skill: same file.
3. Local files: `04-FINAL-CONCEPT.md` thesis table; `03-IDEA-KILLING.md` for the T1 void note; this plan section 11.
4. URLs: none new.
5. Repos: none.
6. APIs: MCP `market`.
7. Chrome: none.
8. Env: none new.
9. Fixtures: one positive and one negative per trap.

### Objective

Nine detectors with positive, negative, and failure cases.

### Exact Tasks

Implement section 11 exactly. Do not add a tenth trap without a forensic source.

### Files Created

`backend/killlab/engine/traps.py` during implementation.

### Files Modified

None.

### Implementation Details

Section 11.

### Environment Variables

None.

### Database Changes

None.

### API / External Dependencies

MCP for the bar-timing live illustration only.

### Browser / Live Verification

None beyond MCP.

### Tests

9 positive, 9 negative, plus the short-history failure path.

### Failure Conditions

Any detector missing a negative case.

### Recovery Procedure

Add the missing case before Phase 7.

### Exit Criteria

18 trap tests plus failure cases green.

### Evidence Artifact

`KillLab/backend/docs/evidence/phase6_traps.txt`

### Phase 7 — Pre-registration and freeze integrity

### Entry Preconditions

Phase 6 tests green.

### RESOURCES / MCP / SKILLS / DOCS

1. MCP: `get_auth_status`. `market` must not be called by the freeze route. The phase-start check may call `market` `tickers` once, outside the freeze transaction.
2. Skill: same file. Confirms no write tool is wired.
3. Local files: `04-FINAL-CONCEPT.md` "written before data is touched"; this plan section 12.
4. URLs: `https://www.postgresql.org/docs/current/sql-createtrigger.html`, Alembic tutorial already listed.
5. Repos: none.
6. APIs: none besides the MCP check.
7. Chrome: none.
8. Env: `DATABASE_URL`, `DIRECT_URL`.
9. Evidence: migration SQL and the 409 test log.

### Objective

Immutable spec after `FREEZE`. Data clients raise `NotFrozen`.

### Exact Tasks

Tables from section 8. Trigger rejects UPDATE of a frozen spec. Kill floor overwritten if the draft is weaker.

### Files Created

Alembic migration and freeze routes during implementation.

### Files Modified

None.

### Implementation Details

Section 12.

### Environment Variables

Database URLs. Migrations use `DIRECT_URL`.

### Database Changes

Schema `killlab`, RLS enabled with no policies, privileges revoked from `anon` and `authenticated`.

### API / External Dependencies

MCP check is outside the transaction.

### Browser / Live Verification

None.

### Tests

UPDATE frozen row fails. Run without freeze fails. Hash mismatch returns 409.

### Failure Conditions

An UPDATE succeeds.

### Recovery Procedure

Fix the trigger. Do not weaken the test.

### Exit Criteria

Trigger present and tests green.

### Evidence Artifact

`KillLab/backend/docs/evidence/phase7_freeze.txt`

### Phase 8 — Verdict engine

### Entry Preconditions

Phase 7 freeze tests pass.

### RESOURCES / MCP / SKILLS / DOCS

1. MCP: `get_auth_status`, `market` `candlesHistory` limit 1 to stamp `engine_clock_ok` in evidence. The verdict function does not call MCP.
2. Skill: same file.
3. Local files: `04-FINAL-CONCEPT.md` failure behaviour; this plan section 10.12 and 13.
4. URLs: none new.
5. Repos: none.
6. APIs: MCP check only.
7. Chrome: none.
8. Env: none new.
9. Fixtures: short-n, DSR-fail, and a synthetic series that clears the floor. The synthetic file is labeled and is not served.

### Objective

`KILLED`, `ALIVE`, `UNTESTABLE` from frozen rules only.

### Exact Tasks

Implement the order in section 10.12. Avoided loss only from frozen variants.

### Files Created

`engine/verdict.py` during implementation.

### Files Modified

None.

### Implementation Details

Section 13.

### Environment Variables

None.

### Database Changes

Insert-only `verdicts`.

### API / External Dependencies

None inside the function.

### Browser / Live Verification

None.

### Tests

Three labels. ALIVE is unreachable when DSR is omitted.

### Failure Conditions

A short sample returns ALIVE.

### Recovery Procedure

Return UNTESTABLE and add a regression test.

### Exit Criteria

Three tests green.

### Evidence Artifact

`KillLab/backend/docs/evidence/phase8_verdict.txt`

### Phase 9 — Research ledger

### Entry Preconditions

Phase 8 tests pass.

### RESOURCES / MCP / SKILLS / DOCS

1. MCP: `get_auth_status`. No market data is required to append a ledger row. Still call `market` `tickers` once so the phase log shows the dependency is alive.
2. Skill: same file.
3. Local files: `04-FINAL-CONCEPT.md` ledger sentence (KNOWN → UNKNOWN → TEST → RESULT → DECISION).
4. URLs: none new.
5. Repos: none.
6. APIs: MCP check only.
7. Chrome: none.
8. Env: none new.
9. Evidence: ledger test names.

### Objective

Append-only ledger. A killed hypothesis cannot be recompiled unless a new run contradicts the original trap.

### Exact Tasks

Section 14. The LLM cannot insert `DECISION`.

### Files Created

Ledger repository during implementation.

### Files Modified

None.

### Implementation Details

Section 14.

### Environment Variables

None.

### Database Changes

`research_ledger_entries`, insert-only.

### API / External Dependencies

None inside the insert path.

### Browser / Live Verification

None.

### Tests

Second DECISION for the same run fails. Killed hypothesis returns 409.

### Failure Conditions

An update of a ledger row succeeds.

### Recovery Procedure

Remove the update path.

### Exit Criteria

Tests green.

### Evidence Artifact

`KillLab/backend/docs/evidence/phase9_ledger.txt`

### Phase 10 — AI boundary

### Entry Preconditions

Phase 9 tests pass.

### RESOURCES / MCP / SKILLS / DOCS

1. MCP: `get_auth_status`. The compiler must not call `market`. The phase-start check may. If someone wires `market` into the compiler, the test fails.
2. Skill: same file, to confirm the compiler is not the trading skill.
3. Local files: `04-FINAL-CONCEPT.md` AI role; `00-HACKATHON-DOCS.md` Qwen subsidy; `01-FORENSICS.md` model id line.
4. URLs: `https://bitget-ai.gitbook.io/bitgetai_hackathons2#qwen-token-subsidy-during-the-hackathon`. Model id `qwen3.8-max` was visible in Chrome.
5. Repos: none.
6. APIs: LLM only if `LLM_API_KEY` is set. Otherwise skip the live compile.
7. Chrome: none unless the key is missing and the operator wants to confirm the model id again.
8. Env: `LLM_API_KEY` (optional), `LLM_BASE_URL`, `LLM_MODEL`, `LLM_TIMEOUT_S`.
9. Evidence: `llm=on` or `llm=off`.

### Objective

Schema-bound compiler and an explainer that can only cite engine fields.

### Exact Tasks

Pydantic `extra=forbid`. Reject drafts that contain `sharpe`, `dsr`, `pbo`, `bps`, `n`, or `verdict`. Manual spec path when the key is empty.

### Files Created

`backend/killlab/ai/` during implementation.

### Files Modified

None.

### Implementation Details

Section 9.

### Environment Variables

LLM trio. Key may be empty.

### Database Changes

None.

### API / External Dependencies

Optional LLM HTTP. Timeout from `LLM_TIMEOUT_S`.

### Browser / Live Verification

If the key is set, compile the earnings sentence and show the draft has no metric fields. If unset, the manual-spec test is enough.

### Tests

Schema rejection. Explainer drops a number that is not in the engine JSON.

### Failure Conditions

The compiler writes a number into `canonical_json`.

### Recovery Procedure

Delete that field server-side and fail the test until the client stops sending it.

### Exit Criteria

`llm=on` or `llm=off` recorded. Tests green.

### Evidence Artifact

`KillLab/backend/docs/evidence/phase10_llm.txt`

### Phase 11 — Post-trade review

### Entry Preconditions

Phase 10 evidence exists.

### RESOURCES / MCP / SKILLS / DOCS

1. MCP: `get_auth_status`. Do not call `order`. If private fills are implemented later, the only extra MCP read is an account/fills read, and only when the optional Bitget key or a working OAuth read exists. On 2026-09-28 private reads are not configured. The phase uses pasted fills.
2. Skill: sections 1 and 3. Explicitly do not execute section 4.
3. Local files: `04-FINAL-CONCEPT.md` review loop and "no orders".
4. URLs: `https://www.bitget.com/docs/uta/agent-hub` for the statement that writes need confirmation. KillLab still does not call them.
5. Repos: none.
6. APIs: none for orders.
7. Chrome: none.
8. Env: optional `BITGET_API_*` absent, so the private route returns 422.
9. Evidence: grep test output.

### Objective

Pasted fills compared with the forecast interval. No order client in the package.

### Exact Tasks

Section 11 of the product (post-trade), API `POST /fills` and `POST /reconcile`.

### Files Created

Fill routes during implementation.

### Files Modified

None.

### Implementation Details

Section 14 of this plan (paper path) and API section 15.

### Environment Variables

Optional private keys. Default off.

### Database Changes

`fills`, `forecasts`, `realized_outcomes`, insert-only.

### API / External Dependencies

None required.

### Browser / Live Verification

None.

### Tests

Inside CI and outside CI. `tests/test_no_order_client.py` greps the package.

### Failure Conditions

Any order symbol in `killlab/`.

### Recovery Procedure

Delete the client. Do not hide it behind a flag.

### Exit Criteria

Grep test green.

### Evidence Artifact

`KillLab/backend/docs/evidence/phase11_no_order.txt`

### Phase 12 — API contract stabilization

### Entry Preconditions

Phase 11 grep is green.

### RESOURCES / MCP / SKILLS / DOCS

1. MCP: `get_auth_status`, `market` `tickers` once. Routes under test must not call MCP except the data layer's own tests.
2. Skill: same file.
3. Local files: this plan section 15.
4. URLs: `https://fastapi.tiangolo.com/tutorial/schema/` if the installed docs path differs, use the CORS page's site nav. Do not invent a path. The verified page is `https://fastapi.tiangolo.com/tutorial/cors/`.
5. Repos: none.
6. APIs: the local OpenAPI document.
7. Chrome: none.
8. Env: `KILLAB_API_TOKEN` for contract tests. The test reads it and does not print it.
9. Evidence: OpenAPI file.

### Objective

Every route in section 15, with idempotency and rate limits.

### Exact Tasks

Contract tests for status codes. Examples in OpenAPI are marked `example` and are not production results.

### Files Created

`openapi.json` export during implementation.

### Files Modified

None.

### Implementation Details

Section 15.

### Environment Variables

Bearer token.

### Database Changes

Idempotency table, insert-only for 24h.

### API / External Dependencies

Local only.

### Browser / Live Verification

None.

### Tests

Contract suite.

### Failure Conditions

A section 15 route is missing.

### Recovery Procedure

Add the route and its test together.

### Exit Criteria

Contract tests green.

### Evidence Artifact

`KillLab/backend/docs/evidence/phase12_openapi.json`

### Phase 13 — Security and reliability

### Entry Preconditions

Phase 12 contract tests pass.

### RESOURCES / MCP / SKILLS / DOCS

1. MCP: `get_auth_status`. Failure injection must include "MCP unavailable" without taking down `/health`.
2. Skill: same file.
3. Local files: this plan sections 21 and 7.5.
4. URLs: `https://fastapi.tiangolo.com/tutorial/cors/`, `https://supabase.com/docs/guides/database/connecting-to-postgres`
5. Repos: none.
6. APIs: fault injection only.
7. Chrome: none.
8. Env: `KILLAB_ENV=production` in the fixture-guard test. `FRONTEND_ORIGIN` may be empty; CORS is then an empty allowlist.
9. Evidence: failure-suite summary.

### Objective

Stuck-run reset, fixture import guard, log redaction, constant-time token compare.

### Exact Tasks

Section 21. A production process that imports `tests/fixtures` fails startup.

### Files Created

Guard module during implementation.

### Files Modified

None.

### Implementation Details

Sections 7.6 and 21.

### Environment Variables

`KILLAB_ENV`, `RUN_STALE_MINUTES`.

### Database Changes

None new. Startup updates only `running` rows older than `RUN_STALE_MINUTES`, and only toward `queued` or `failed`.

### API / External Dependencies

Simulated MCP and REST failures.

### Browser / Live Verification

None.

### Tests

Failure suite and the fixture guard.

### Failure Conditions

Production env loads a fixture.

### Recovery Procedure

Fail startup.

### Exit Criteria

Failure suite green.

### Evidence Artifact

`KillLab/backend/docs/evidence/phase13_failure.txt`

### Phase 14 — Full backend test suite

### Entry Preconditions

Phase 13 green.

### RESOURCES / MCP / SKILLS / DOCS

1. MCP: `get_auth_status` and one `market` `candlesHistory` live smoke included in the suite, marked live and skipped only when both MCP and REST fail. A skip is not a pass if the rest of the suite needed that data.
2. Skill: same file.
3. Local files: this plan section 23.
4. URLs: none new.
5. Repos: none.
6. APIs: MCP plus local app.
7. Chrome: none.
8. Env: the runtime set. Tests must not print it.
9. Evidence: pytest summary.

### Objective

`pytest -q` on the whole backend. No new features.

### Exact Tasks

Run the suite. Fix failures. Add a regression test for any fix.

### Files Created

The summary file.

### Files Modified

Tests and fixes only.

### Implementation Details

Section 23.

### Environment Variables

Runtime set.

### Database Changes

Tests roll back.

### API / External Dependencies

Live smoke as above.

### Browser / Live Verification

None.

### Tests

The full suite.

### Failure Conditions

Any failed test, or a skip that hides a failure.

### Recovery Procedure

Fix and re-run. Do not start Phase 15.

### Exit Criteria

Zero failures.

### Evidence Artifact

`KillLab/backend/docs/evidence/phase14_pytest.txt`

### Phase 15 — Render deployment

### Entry Preconditions

Phase 14 summary shows zero failures.

### RESOURCES / MCP / SKILLS / DOCS

1. MCP: `get_auth_status` and `market` `tickers` `NVDAUSDT` immediately before creating the service. If `market` fails and REST also fails, do not deploy.
2. Skill: same file.
3. Local files: this plan section 18 and 20.
4. URLs: `https://render.com/docs/web-services`, `https://render.com/docs/docker`, `https://render.com/docs/environment-variables`
5. Repos: the Docker build context is `KillLab/backend`, not the forensic workspace.
6. APIs: Render API with `RENDER_API_KEY` from the local shell only.
7. Chrome: Render dashboard to confirm the service region and that the CLI tokens are absent from the service env list. Do not screenshot values.
8. Env: runtime rows from section 20. Never `RENDER_API_KEY`, `VERCEL_TOKEN`, or `GITHUB_TOKEN`.
9. Evidence: the public health URL only.

### Objective

Web service `killlab-api` in Frankfurt. Release command `alembic upgrade head` using `DIRECT_URL`. Health check `GET /health`.

### Exact Tasks

Create the service. Set env. Confirm it does not spin down. Hit `/health`.

### Files Created

`phase15_url.txt`

### Files Modified

`.env` gains `BACKEND_PUBLIC_URL` after the host exists. Do not commit `.env`.

### Implementation Details

Section 18.

### Environment Variables

Runtime column in section 20.

### Database Changes

Migrations via the release command.

### API / External Dependencies

Render API. Bitget is not called by the release command.

### Browser / Live Verification

Dashboard env names, not values. `/health` in the browser.

### Tests

`/health` returns db ok. A wrong bearer returns 401 on `/v1`.

### Failure Conditions

The service sleeps, migrate did not run, or a CLI token is in the service env.

### Recovery Procedure

Change the plan or remove the variable before Phase 16.

### Exit Criteria

URL written to `BACKEND_PUBLIC_URL` and `phase15_url.txt`.

### Evidence Artifact

`KillLab/backend/docs/evidence/phase15_url.txt`

### Phase 16 — Production backend verification

### Entry Preconditions

Phase 15 health is green.

### RESOURCES / MCP / SKILLS / DOCS

1. MCP: `get_auth_status`, `market` `candlesHistory` for `NVDAUSDT`. The production run must use the deployed data client, not this agent's MCP cache. The phase-start check only proves the venue is up.
2. Skill: same file. No orders.
3. Local files: `04-FINAL-CONCEPT.md` demo steps 1–3; `_forensics/round4/dsr/dsr_run.py` is not mounted in the container.
4. URLs: the Render URL from phase 15. Bitget hub URL as in Phase 4.
5. Repos: none.
6. APIs: production `/v1` with the bearer. Live Bitget through the service.
7. Chrome: call `/health` and confirm the verdict JSON. Do not paste the bearer into a shared browser profile.
8. Env: `KILLAB_API_TOKEN`, `BACKEND_PUBLIC_URL`.
9. Evidence: redacted verdict JSON.

### Objective

One production earnings run. The label must be `KILLED` or `UNTESTABLE`. `ALIVE` fails the phase.

### Exact Tasks

Manual spec, freeze, run, poll, save the verdict. The service must not read `_forensics`.

### Files Created

`phase16_verdict.json` with secrets removed.

### Files Modified

None.

### Implementation Details

Section 28 steps 1–5, against the API.

### Environment Variables

Bearer and base URL.

### Database Changes

The run's own rows.

### API / External Dependencies

Production API and Bitget.

### Browser / Live Verification

Health and verdict document.

### Tests

Label is not ALIVE. `spec_sha256` matches the freeze response. Snapshot hash is present.

### Failure Conditions

ALIVE, or numbers copied from a fixture file.

### Recovery Procedure

Mark the run failed. Do not edit the verdict row.

### Exit Criteria

Verdict file saved.

### Evidence Artifact

`KillLab/backend/docs/evidence/phase16_verdict.json`

### Phase 17 — External frontend integration

### Entry Preconditions

`phase16_verdict.json` exists and `KillLab/FRONTEND/` has been delivered by the other agent.

### RESOURCES / MCP / SKILLS / DOCS

1. MCP: `get_auth_status`, `market` `tickers`. The UI must not call MCP. It calls the backend.
2. Skill: same file, so the integrator does not add an order button that talks to MCP.
3. Local files: `04-FINAL-CONCEPT.md` demo; this plan section 15.
4. URLs: `https://vercel.com/docs/environment-variables` (read now, deploy in Phase 18).
5. Repos: the frontend folder only.
6. APIs: production backend.
7. Chrome: click through the screens after they point at the proxy.
8. Env: no new secrets in the frontend source.
9. Evidence: screen-to-endpoint checklist and an `rg` report.

### Objective

Remove mock numbers. Every metric on screen comes from `/v1`.

### Exact Tasks

Search for `0.47`, `112.7`, `3.22`, and fixture names. Remove hits from components. Add loading, error, and UNTESTABLE states.

### Files Created

`phase17_screens.md`

### Files Modified

Files under `KillLab/FRONTEND/` only as required to point at the API.

### Implementation Details

Do not redesign the layout except where a state was missing.

### Environment Variables

The proxy holds `KILLAB_API_TOKEN`. The browser bundle must not.

### Database Changes

None.

### API / External Dependencies

Production API.

### Browser / Live Verification

Each screen's network call hits the proxy.

### Tests

`rg` report is empty of hardcoded forensic metrics.

### Failure Conditions

A screen still imports mock metrics, or the token is in client code.

### Recovery Procedure

Remove the constant. Do not deploy to Vercel yet.

### Exit Criteria

Checklist and `rg` report exist.

### Evidence Artifact

`KillLab/backend/docs/evidence/phase17_rg.txt`

### Phase 18 — Vercel deployment

### Entry Preconditions

Phase 17 checklist is clean.

### RESOURCES / MCP / SKILLS / DOCS

1. MCP: `get_auth_status` and `market` `tickers` before promoting production. The Vercel app does not receive MCP credentials.
2. Skill: same file.
3. Local files: this plan section 19.
4. URLs: `https://vercel.com/docs/environment-variables`, `https://vercel.com/docs/project-configuration`
5. Repos: `mohamedwael201193/KillLab` with root directory `FRONTEND` once that folder is in the repo. Do not push the forensic tree.
6. APIs: Vercel API with `VERCEL_TOKEN` from the local shell only.
7. Chrome: the production URL. View page source and the JS bundle names. Search the bundle for the database scheme, a personal-access-token prefix, a Render key prefix, and the bearer. A hit fails the phase.
8. Env: server-only `KILLAB_API_TOKEN` and `BACKEND_PUBLIC_URL`. Then set Render `FRONTEND_ORIGIN` and redeploy the API.
9. Evidence: the Vercel URL and the bundle-search result `clean`.

### Objective

Production frontend behind the same-origin proxy. Preview deployments have no production token.

### Exact Tasks

Import, set env, deploy, set CORS, redeploy API.

### Files Created

`phase18_url.txt`

### Files Modified

Render env gains `FRONTEND_ORIGIN` only.

### Implementation Details

Section 19.

### Environment Variables

Server env on Vercel. No `VITE_` or `NEXT_PUBLIC_` secret.

### Database Changes

None.

### API / External Dependencies

Vercel and the existing API.

### Browser / Live Verification

Bundle search. Network calls stay on the site origin.

### Tests

401 if the proxy is bypassed. CORS rejects a random origin.

### Failure Conditions

Token visible in the bundle, or preview has the production token.

### Recovery Procedure

Remove the env from the preview scope and redeploy.

### Exit Criteria

URL loads and the bundle search is clean.

### Evidence Artifact

`KillLab/backend/docs/evidence/phase18_url.txt`

### Phase 19 — Full production end-to-end

### Entry Preconditions

Phase 18 URL is live and CORS is set.

### RESOURCES / MCP / SKILLS / DOCS

1. MCP: `get_auth_status`, `market` `candlesHistory` to confirm the venue is up while the browser runs the product path. The browser does not call MCP.
2. Skill: same file. Confirm the UI has no control that maps to `order`.
3. Local files: `04-FINAL-CONCEPT.md` demo and failure behaviour.
4. URLs: the two production URLs.
5. Repos: none.
6. APIs: production `/v1` through the proxy.
7. Chrome: full click path. Compare on-screen numbers to the API JSON.
8. Env: none new.
9. Evidence: run id.

### Objective

Earnings idea through freeze to verdict on production. A second idea with too few weekends shows UNTESTABLE. Refresh does not change the frozen hash.

### Exact Tasks

Section 28, in the browser.

### Files Created

`phase19.txt`

### Files Modified

None.

### Implementation Details

Numbers on screen equal the API fields for that run id.

### Environment Variables

None new.

### Database Changes

The demo run's rows.

### API / External Dependencies

Production stack and Bitget.

### Browser / Live Verification

The whole path.

### Tests

On-screen DSR equals the API DSR. No order request in the network log.

### Failure Conditions

A mismatch, an ALIVE on the earnings idea, or an order call.

### Recovery Procedure

Stop the demo. Do not edit the database row to match the screen.

### Exit Criteria

`phase19.txt` has the run id and `match=true`.

### Evidence Artifact

`KillLab/backend/docs/evidence/phase19.txt`

### Phase 20 — Hackathon demo verification

### Entry Preconditions

Phase 19 `match=true`.

### RESOURCES / MCP / SKILLS / DOCS

1. MCP: `get_auth_status` and `market` `tickers` immediately before the timed run. If `market` is down and the backend REST path is also down, do not present the demo as live.
2. Skill: same file. The spoken demo says no order is sent.
3. Local files: `00-HACKATHON-DOCS.md` Desk materials (accessible demo, one research task, about 3 minutes); `04-FINAL-CONCEPT.md` demo list.
4. URLs: `https://bitget-ai.gitbook.io/bitgetai_hackathons2#track-3-ai-trading-desk-ai-research-workbench`, `https://www.bitget.com/activity-hub/hackathon`
5. Repos: none.
6. APIs: production only.
7. Chrome: one timed pass, recorded as a path not as a secret.
8. Env: none new. If `LLM_API_KEY` is empty, step 1 uses the manual spec and the narration says so.
9. Evidence: timing note.

### Objective

One complete research task, under about 3 minutes, on production.

### Exact Tasks

Section 28, timed once.

### Files Created

`phase20_demo.txt`

### Files Modified

None.

### Implementation Details

Section 28.

### Environment Variables

None new.

### Database Changes

None beyond the demo run already stored.

### API / External Dependencies

Production stack.

### Browser / Live Verification

The timed pass.

### Tests

The checklist in section 28 is ticked in the evidence file.

### Failure Conditions

A step needs an unprepared secret or a manual SQL edit.

### Recovery Procedure

Fix the product path. Do not narrate a number that is not on screen.

### Exit Criteria

Checklist complete and the elapsed time is recorded.

### Evidence Artifact

`KillLab/backend/docs/evidence/phase20_demo.txt`

---

## 25. Phase gates

| Phase | Required inputs | Required resources | Required tests | Live check | Evidence | Exit | Hard blocker |
|---|---|---|---|---|---|---|---|
| 0 | user-supplied env | MCP, skill, GitBook, pooler | `select 1`, gitignore | done 2026-09-28 | `phase0_env_status.json` | checklist true | auth failure on `DIRECT_URL` |
| 1 | phase 0 | concept pack, MCP instruments | no killed-product names as requirements | Track 3 page | `phase1_requirements.txt` | every line sourced | handbook renames the sub-theme |
| 2 | phase 1 | psycopg docs, pooler | `select 1` both URIs | DB | `phase2_connect.txt` | ok + version | auth error |
| 3 | phase 2 | FastAPI, Docker docs | health and auth | MCP tickers, not used by health | `phase3_pytest.txt` | image builds | health ignores DB |
| 4 | phase 3 | MCP `market`, REST fallback | pagination, unknown symbol | floors | `phase4_floors.json` | hashes present | both paths down |
| 5 | phase 4 | `dsr_run.py` | golden ±0.02 | candle parse | `phase5_golden.txt` | golden green | port changed to match a wish |
| 6 | phase 5 | section 11 | 9 positive, 9 negative | 1h vs print | `phase6_traps.txt` | all green | a detector without a negative case |
| 7 | phase 6 | Alembic, triggers | 409 and UPDATE fail | MCP outside the transaction | `phase7_freeze.txt` | trigger holds | frozen row can change |
| 8 | phase 7 | section 10.12 | three labels | MCP not inside verdict | `phase8_verdict.txt` | short n is UNTESTABLE | ALIVE without DSR |
| 9 | phase 8 | section 14 | append-only | MCP tickers | `phase9_ledger.txt` | LLM cannot write DECISION | ledger update |
| 10 | phase 9 | Qwen handbook section | schema reject | compile only if key set | `phase10_llm.txt` | on or off recorded | compiler emits a metric |
| 11 | phase 10 | skill no-trade section | grep, CI in/out | no order tool | `phase11_no_order.txt` | grep clean | any order client |
| 12 | phase 11 | section 15 | contract suite | MCP once, not per route | `phase12_openapi.json` | routes complete | missing route |
| 13 | phase 12 | CORS, pooler docs | failure suite | MCP down does not fail health | `phase13_failure.txt` | guard holds | fixtures load in production |
| 14 | phase 13 | section 23 | `pytest -q` | one live candle | `phase14_pytest.txt` | zero failures | any failure |
| 15 | phase 14 | Render docs | `/health`, 401 | MCP before deploy | `phase15_url.txt` | URL live | sleep plan or CLI token in runtime |
| 16 | phase 15 | demo spec | label not ALIVE | production Bitget pull | `phase16_verdict.json` | file saved | ALIVE or fixture numbers |
| 17 | phase 16 and `FRONTEND/` | section 15 | `rg` clean | screens hit proxy | `phase17_rg.txt` | no mock metrics | token in client code |
| 18 | phase 17 | Vercel env docs | bundle search | Chrome production | `phase18_url.txt` | bundle clean | secret in JS |
| 19 | phase 18 | demo script | numbers match API | full Chrome path | `phase19.txt` | `match=true` | order call or mismatch |
| 20 | phase 19 | handbook demo rule | checklist | timed Chrome pass | `phase20_demo.txt` | time recorded | manual SQL |

A phase is not complete because files exist.

---

## 26. Failure and recovery

| Failure | Detection | Behavior | Recovery |
|---|---|---|---|
| Bitget MCP and REST both down | phase-start check | phase stops | retry later; do not fabricate candles |
| Cloud MCP 503 | `cloud_mcp_status` | record and use agentic `market` | not fatal |
| `pgbouncer` query param | psycopg ProgrammingError | strip and reconnect | already verified |
| DB auth error | `select 1` | stop | ask the user; do not reset the password |
| LLM timeout or missing key | 30s or empty key | manual spec | do not invent a key |
| Short history | n below the family minimum | UNTESTABLE HTTP 200 | not a retry |
| Freeze then mutate | trigger | database error surfaced as 409 | do not drop the trigger |
| Run killed by restart | `running` older than `RUN_STALE_MINUTES` | requeue twice, then `failed` | new run, same preregistration |
| Token in the JS bundle | phase 18 search | deploy rejected | remove the public env |
| Frontend mock number | `rg` | phase 17 stays open | delete the constant |

---

## 27. Production checklist

- [ ] `KILLAB_ENV=production`
- [ ] Fixture guard passed in the image
- [ ] `alembic upgrade head` on `DIRECT_URL`
- [ ] Runtime pooler uses port 6543 with the `pgbouncer` parameter stripped
- [ ] No service-role key, anon key, GitHub token, Render key, or Vercel token in the service env
- [ ] CORS is only `FRONTEND_ORIGIN`
- [ ] Bearer required on `/v1`
- [ ] `/health` green
- [ ] One production earnings run is not ALIVE
- [ ] Logs have no URI and no token
- [ ] Phase-start MCP check recorded for the deploy

---

## 28. Hackathon demo checklist

Desk requirement from the live handbook and `00-HACKATHON-DOCS.md`: one research task from question to insight, accessible demo, about 3 minutes.

1. MCP `market` is up, or REST is up. Say which.
2. Type the earnings sentence, or load the manual spec if `LLM_API_KEY` is empty.
3. Show the draft: variants, kill floor, costs, data not loaded.
4. Freeze. Show the hash.
5. Run. Poll real status.
6. Card: KILLED or UNTESTABLE, trap, DSR, pooled result, avoided loss, snapshot hash. All from the API.
7. Ledger DECISION.
8. Second sentence: always wait until Sunday 20:00 ET. Not a blanket ALIVE. UNTESTABLE if weekend count is below 8.
9. No order request in the network log.

---

## 29. Final evidence checklist

| Claim | Evidence |
|---|---|
| Pre-registration before data | `frozen_at` ≤ snapshot `pulled_at` |
| DSR formula | golden vs `dsr_run.py` |
| Nine traps | phase 6 |
| History floors measured | `phase4_floors.json` |
| LLM did not author the verdict | `engine_version` on the row |
| Demo numbers match the API | phase 19 |
| No fixture in production | phase 13 guard and phase 17 `rg` |
| No order | phase 11 grep and phase 19 network log |
| MCP used | each `phaseN` evidence file has `mcp_ok` |
| Secrets not in git | `phase0_repo_status.txt` |

---

## 30. Remaining unknowns

These do not block Phase 1.

1. `LLM_API_KEY` is not set. The manual spec is the supported path until the user adds a Qwen credit key. Base URL and model id are set from the public handbook.
2. Private Bitget keys are not set. Pasted fills cover the review loop.
3. `BACKEND_PUBLIC_URL` and `FRONTEND_ORIGIN` do not exist until phases 15 and 18.
4. The clean isolated naive-agent replicate was not run. It does not change the engine.
5. Spot 5 bps is the forensic promo rate. Phase 4 re-reads the fee page before the demo claims it.
6. Monday cancel time has no printed HH:MM. Specs mark 09:30 ET as inferred (`01-FORENSICS.md`).
7. Whether StockRoute prints are exchange prints is still UNKNOWN. Do not claim "exchange print".
8. The local git root is the workspace, with no remote and no commit. The GitHub repo `mohamedwael201193/KillLab` must not receive `_forensics`.
9. Anon key, service-role key, and `SESSION_SECRET` stay unused on purpose.

No blocking question. Database authentication succeeded.

---

## 31. Source and documentation matrix

| Requirement | Local source | Section | Official URL | Phase | Why |
|---|---|---|---|---|---|
| Track and sub-theme | `00-HACKATHON-DOCS.md`, `04-FINAL-CONCEPT.md` | IV Track 3; concept header | `https://bitget-ai.gitbook.io/bitgetai_hackathons2#track-3-ai-trading-desk-ai-research-workbench` | 1, 20 | Live page still shows Review & Self-Evolution |
| Demo shape | `04-FINAL-CONCEPT.md` | Demo, failure behaviour | same | 16, 19, 20 | One research task |
| Judging | `00-HACKATHON-DOCS.md` | Desk judging quotes | same | 20 | Subjective; thesis weighted in the form notes |
| History floors | `01-FORENSICS.md` | ROUND 3-4 | MCP `market` plus REST | 4 | Do not assume February history |
| Kill list | `03-IDEA-KILLING.md` | ROUND 3-4 rows | none | 1 | Do not rebuild killed products |
| Competitors | `02-WINNERS-COMPETITORS.md` | TradePilot, Argus | none | 1 | Separation is already evidenced; do not re-audit |
| Final gates | `06-JUDGMENT.md` | §12 | none | 1 | Sections 1–11 are not the product |
| Agent Hub | `00-HACKATHON-DOCS.md` | Bitget Agent Hub | `https://www.bitget.com/docs/uta/agent-hub` | 0, 4 | Verb surface |
| MCP package | skill file | header | `https://github.com/Bitget-AI/agent_hub` | all | `get_auth_status` then `market` |
| Cloud MCP | `01-FORENSICS.md` | probe 503 | `https://agent.bitget.com/mcp` | 0 | Still 503; not the data path |
| Qwen model | `01-FORENSICS.md` | credits line | GitBook Qwen section | 10 | `qwen3.8-max` confirmed in Chrome |
| Fees | forensic runs, re-check in phase 4 | `01` ROUND 3-4 | fee support article at phase 4 | 4, 5 | Versioned schedule |
| DSR | `_forensics/round4/dsr/dsr_run.py` | module docstring | Bailey & López de Prado 2014 | 5 | Do not change the formula |
| PBO | same file | `cscv_pbo` | Bailey, Borwein, López de Prado, Zhu | 5 | Same |
| Pooler | this plan section 17 | phase 0 evidence | `https://supabase.com/docs/guides/database/connecting-to-postgres` | 0, 2 | `prepare_threshold=None` |
| psycopg | phase 0 error string | section 20 | `https://www.psycopg.org/psycopg3/docs/api/connections.html` | 2 | strip `pgbouncer` |
| Alembic | section 18 | release command | `https://alembic.sqlalchemy.org/en/latest/tutorial.html` | 7, 15 | `DIRECT_URL` |
| SQLAlchemy | section 6 | pooler | `https://docs.sqlalchemy.org/en/20/dialects/postgresql.html` | 3, 7 | NullPool |
| FastAPI | section 15 | CORS, lifespan | `https://fastapi.tiangolo.com/tutorial/cors/` | 3, 13 | allowlist |
| Render | section 18 | Docker web | `https://render.com/docs/web-services` | 15 | no spin-down |
| Vercel env | section 19 | server vs public | `https://vercel.com/docs/environment-variables` | 18 | no `NEXT_PUBLIC_` secret |
| Playbook | `01` ROUND 4 R2 | not the engine | `https://www.bitget.com/activity/ai-get-agent/playbook` | 1 | Do not call it for verdicts |
| Handbook form | `00-HACKATHON-DOCS.md` | Live form | the Google Form is submission, not a runtime API | 20 | Out of scope until asked |

`bitgethack.md` is the long original brief. It is not a requirements source for KillLab. `docsbitget.md` is the handbook paste; prefer `00-HACKATHON-DOCS.md` and the live GitBook when they differ. `05-BUILD-HANDOFF.md` is SecondBook and is not a KillLab source.

---

## 32. External dependency matrix

| Dependency | Purpose | Source | Verified | Required | If it fails | Fallback | Blocks |
|---|---|---|---|---|---|---|---|
| `user-bitget-agentic` MCP | Phase-start check and public market | skill 1.3.0, live call 2026-09-28 | yes, candles and instruments | yes as a check | record `mcp_ok=false` | REST | a phase only if REST also fails |
| Cloud MCP | US-stock read-only server | `agent.bitget.com/mcp` | 503 on 2026-09-28 | no | continue | agentic `market` | nothing |
| Bitget REST v2 | Candle fallback | `api.bitget.com` | used in rounds 3–4 | yes as fallback | UNTESTABLE | none | phase 4 |
| Postgres 17.6 pooler | Freeze and ledger | Supabase eu-west-1 | `select 1` both URIs | yes | stop | none | phase 2 |
| psycopg 3.3.4 | Client | installed locally | yes | yes | do not switch drivers silently | none | phase 2 |
| GitHub repo | Later push, not this task | `mohamedwael201193/KillLab` | HTTP 200, admin | no until a push is requested | do not push the workspace | none | nothing now |
| Render API | Phase 15 | token present, HTTP 200 | yes | phase 15 | stop that phase | none | 15 |
| Vercel API | Phase 18 | token present, HTTP 200 | yes | phase 18 | stop that phase | none | 18 |
| Qwen `qwen3.8-max` | Compiler | GitBook | model name only | no | manual spec | manual spec | nothing |
| yfinance | Earnings clock and cash proxy | PyPI at implementation time | not imported yet | only for `event_earnings` | UNTESTABLE | none | that family only |
| NumPy / SciPy | DSR | implementation time | formula pinned to `dsr_run.py` | yes | do not re-derive | none | phase 5 |

---

## 33. Configuration ownership

| Configuration | Defined by | Stored in | Used by | After freeze | Secret | Production | Browser |
|---|---|---|---|---|---|---|---|
| Hypothesis text | user | DB, immutable | compiler, ledger | no | no | DB | shows the user's own text |
| Test spec | human + floor | DB `canonical_json` | engine | no | no | DB | shows the frozen spec |
| Kill floor | code `KILL_FLOOR` | copied into the spec at freeze | verdict | no | no | image + DB | visible, it is a rule not a secret |
| Fee schedule | phase 4 file | `cost_schedule.json` hash on the run | costs | the run keeps the hash it started with | no | image | no raw file required |
| Snapshot | data layer | DB hash + bytes | engine | no | no | DB | hash only |
| `KILLAB_API_TOKEN` | generated | `.env`, Render, Vercel server | API and proxy | n/a | yes | server | no |
| Database URIs | user | `.env`, Render | API, Alembic | n/a | yes | server | no |
| CLI tokens | user | local `.env` only | CLI | n/a | yes | never | no |
| LLM key | user, later | `.env`, Render | compiler | n/a | yes | server | no |
| `LLM_MODEL` | handbook | `.env` | compiler | n/a | no | server | no |
| Bitget private triple | user, later | Render | fills route | n/a | yes | server | no |
| `FRONTEND_ORIGIN` | Vercel host | Render | CORS | n/a | no | server | the site is public |
| `BACKEND_PUBLIC_URL` | Render host | Vercel server | proxy | n/a | no | server | no |
| Fixtures | tests | `tests/fixtures` | pytest | n/a | no | not loaded | no |

---

## 34. Hostile review

- SecondBook, OpenBridge, and RegimeDesk are not in the build path.
- Phase 0 was executed. Secrets are not in this file.
- Every phase names the MCP tool, the skill path, the local files, and the URLs it actually needs.
- The LLM cannot emit metrics or weaken the floor. Freeze is a trigger plus a client guard.
- Short samples are UNTESTABLE. Missing data is UNTESTABLE.
- Production cannot load fixtures. No order client is allowed.
- Render does not receive CLI tokens. Vercel does not receive the database URI.
- The frontend is still phase 17, after a production verdict.
- Implementation starts at Phase 1.
