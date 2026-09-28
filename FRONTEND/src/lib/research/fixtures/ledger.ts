import type { LedgerEntry } from "../types";

/**
 * The research ledger — the desk's long memory.
 * KNOWN → UNKNOWN → TEST → RESULT → DECISION.
 * The earnings run performed in the lab is added at runtime, on top of these.
 */
export const LEDGER_ENTRIES: LedgerEntry[] = [
  {
    id: "KL-003",
    scenarioKey: "range-rotation",
    stage: "TEST",
    hypothesisText: "When BTC breaks its 20-day range, rotate into majors' alts perps within 48 hours.",
    family: "Cross-asset rotation",
    instruments: ["BTCUSDT", "SOLUSDT", "AVAXUSDT", "LINKUSDT", "DOGEUSDT", "ADAUSDT", "TONUSDT"],
    marks: [
      { stage: "KNOWN", at: "2025-06-24T10:05:00Z", note: "Rotation lore is desk folklore — nothing verified." },
      { stage: "UNKNOWN", at: "2025-06-28T16:40:00Z", note: "Do alt perps inherit BTC range-breaks within 48h?" },
      { stage: "TEST", at: "2025-07-01T14:09:31Z", note: "Frozen kl1_51b7e0a4… · queued for the engine." },
    ],
    keyNumbers: [
      { label: "Frozen", value: "kl1_51b7e0a4" },
      { label: "Status", value: "queued" },
    ],
  },
  {
    id: "KL-002",
    scenarioKey: "funding-carry",
    stage: "UNKNOWN",
    hypothesisText: "Weekend liquidity thinning reverses Friday momentum on BTC and ETH perps.",
    family: "Microstructure",
    instruments: ["BTCUSDT", "ETHUSDT"],
    marks: [
      { stage: "KNOWN", at: "2024-12-02T09:15:00Z", note: "Desk note: funding spikes mean-revert within days on BTC perps." },
      { stage: "UNKNOWN", at: "2025-07-06T08:22:00Z", note: "Triggered by KL-001 fill review — weekend slippage ran 2.3× weekday." },
    ],
    keyNumbers: [
      { label: "Stage", value: "idea · not yet frozen" },
    ],
  },
  {
    id: "KL-001",
    scenarioKey: "funding-carry",
    stage: "DECISION",
    hypothesisText: "Short BTC and ETH perps when funding exceeds +0.10% and hold for 48 hours.",
    family: "Financing-rate carry",
    instruments: ["BTCUSDT", "ETHUSDT"],
    marks: [
      { stage: "KNOWN", at: "2024-11-18T13:00:00Z", note: "Desk note 2024-11: positive funding spikes mean-revert within days." },
      { stage: "UNKNOWN", at: "2024-11-25T10:30:00Z", note: "Does funding ≥ +0.10% persist long enough to harvest a 48h carry?" },
      { stage: "TEST", at: "2024-12-02T11:19:44Z", note: "Frozen kl1_8c2d41f0… · 5 variants · 3 baselines." },
      { stage: "RESULT", at: "2024-12-05T09:02:00Z", note: "ALIVE · WF Sharpe 0.94 · DSR 0.38 · PBO 18%." },
      { stage: "DECISION", at: "2024-12-06T15:45:00Z", note: "Trade small, hard 72h cap, weekly fill review." },
    ],
    verdict: "ALIVE",
    keyNumbers: [
      { label: "WF Sharpe", value: "0.94" },
      { label: "DSR", value: "0.38" },
      { label: "PBO", value: "18%" },
    ],
    decision: {
      summary: "Trade small. Hard 72h cap. Review fills weekly.",
      rationale: "Floor passed 5/5, but carry is thin and capacity-limited — execution quality owns the residual.",
      nextTest: "Weekend liquidity thinning: do Friday fills degrade the carry?",
    },
  },
];
