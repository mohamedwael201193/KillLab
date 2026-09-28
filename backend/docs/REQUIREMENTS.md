# KillLab requirements checklist

Status: frozen for implementation on 2026-09-28. Each line cites a source. None of these lines rebuild SecondBook, OpenBridge, or RegimeDesk.

| # | Requirement | Source | Status |
|---|---|---|---|
| 1 | Product is KillLab, AI Trading Desk, Review & Self-Evolution | `04-FINAL-CONCEPT.md` header; `00-HACKATHON-DOCS.md` Track 3; live GitBook confirmed in `docs/evidence/phase0_docs.json` | open |
| 2 | Flow is natural language → draft spec → human freeze → data → engine → traps → KILLED/ALIVE/UNTESTABLE → ledger | `04-FINAL-CONCEPT.md` Core mechanism; `KillLab/IMPLEMENTATION_PLAN.md` §12–14 | open |
| 3 | The LLM never owns Sharpe, DSR, PBO, bps, sample size, or the verdict | `04-FINAL-CONCEPT.md` mechanism §2; plan §9 | open |
| 4 | Nine traps are separate detectors | `04-FINAL-CONCEPT.md` thesis table; plan §11 | open |
| 5 | Short samples return UNTESTABLE, not a fabricated number | `04-FINAL-CONCEPT.md` failure behaviour; plan §7.5 | open |
| 6 | No order placement | `04-FINAL-CONCEPT.md` explicit failure; plan §3 | open |
| 7 | Public Bitget REST is the service data path. Cursor MCP `user-bitget-agentic` is the phase-start check. Cloud MCP 503 is not fatal | plan Bitget MCP section; `docs/evidence/phase0_bitget_mcp.json`; `01-FORENSICS.md` ROUND 3-4 | open |
| 8 | History floors are measured, not assumed from 7 Feb 2026 | `01-FORENSICS.md` ROUND 3-4 | open |
| 9 | DSR is the Bailey & López de Prado formula in `_forensics/round4/dsr/dsr_run.py`, non-annualized | plan §10.6 | open |
| 10 | psycopg strips `pgbouncer` and sets `prepare_threshold=None`. Stored URI is unchanged | plan §20; `docs/evidence/phase0_env_status.json` | open |
| 11 | Frozen specs are immutable in the database | plan §8 and §12 | open |
| 12 | Dead ledger decisions stay dead unless a new run contradicts the original trap | plan §14 | open |
| 13 | Production must not import test fixtures or read `_forensics` | plan §7.6 and phase 16 | open |
| 14 | Frontend is out of scope until `KillLab/FRONTEND/` exists | plan phase 17 | open |
| 15 | Spot fee schedule is versioned and re-checked, not treated as permanent | `01-FORENSICS.md` ROUND 3-4; plan §10.3 | open |

Phase 1 MCP: `get_auth_status` authorized true. `market instruments` `RNVDAUSDT` SPOT status online, `isReality=yes`. No order tool was called.
