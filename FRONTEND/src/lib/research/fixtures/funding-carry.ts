import type { ScenarioFixture } from "../types";

/**
 * Scenario: funding carry — a survivor.
 * A thin but persistent financing edge that passes the floor.
 * All values are fictional fixture data for the frontend simulation.
 */

const N = 61;

function buildEquity(riseTo: number, peakAt: number, endAt: number, vol: number): number[] {
  const pts: number[] = [0];
  for (let i = 1; i < N; i++) {
    const t = i / (N - 1);
    let v: number;
    if (t <= peakAt) {
      v = riseTo * (t / peakAt) ** 0.95;
    } else {
      const k = (t - peakAt) / (1 - peakAt);
      v = riseTo + (endAt - riseTo) * k ** 1.15;
    }
    const wobble = Math.sin(i * 2.399 + 0.7) * Math.abs(riseTo) * vol;
    pts.push(Math.round((v + wobble) * 10) / 10);
  }
  return pts;
}

function buildBins(): { x0: number; x1: number; count: number }[] {
  const shape = [0.0, 0.02, 0.06, 0.14, 0.32, 0.7, 1.4, 2.6, 4.3, 6.5, 8.9, 11.0, 12.4, 12.6, 11.4, 9.6, 7.5, 5.5, 3.8, 2.5, 1.6, 1.0, 0.6, 0.36, 0.2, 0.1, 0.05, 0.02, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
  return shape.map((count, i) => ({ x0: -0.4 + i * 0.045, x1: -0.4 + (i + 1) * 0.045, count }));
}

const foldSharpes = [0.62, 0.71, 0.88, 1.04, 0.96, 1.12, 1.21, 1.08, 0.95, 0.83, 0.76, 0.91, 1.05, 0.98, 0.87, 0.79, 0.68, 0.74, 0.61, 0.55];
const foldQuarters = ["2022 Q1", "2022 Q2", "2022 Q3", "2022 Q4", "2023 Q1", "2023 Q2", "2023 Q3", "2023 Q4", "2024 Q1", "2024 Q2", "2024 Q3", "2024 Q4", "2024 Q4", "2025 Q1", "2025 Q1", "2025 Q2", "2025 Q2", "2025 Q2", "2025 Q2", "2025 Q2"];

export const fundingCarry: ScenarioFixture = {
  spec: {
    id: "SPEC-2025-0326",
    scenarioKey: "funding-carry",
    hypothesisText: "Short BTC and ETH perps when funding exceeds +0.10% and hold for 48 hours.",
    family: "Financing-rate carry",
    familyDetail:
      "Harvest persistently positive funding by holding shorts through the accrual window, hedged only by mechanical entry and exit rules.",
    instruments: [
      { symbol: "BTCUSDT", kind: "perp", venue: "Bitget" },
      { symbol: "ETHUSDT", kind: "perp", venue: "Bitget" },
    ],
    testingWindow: { from: "2022-01-03", to: "2025-06-30", label: "3.5 years" },
    variants: [
      { id: "V1", label: "V1 · +0.08% / 24h", entry: "8h funding print ≥ +0.08%", exit: "Mechanical close 24h after entry", sizing: "notional 1.0x" },
      { id: "V2", label: "V2 · +0.10% / 24h", entry: "8h funding print ≥ +0.10%", exit: "Mechanical close 24h after entry", sizing: "notional 1.0x" },
      { id: "V3", label: "V3 · +0.15% / 24h", entry: "8h funding print ≥ +0.15%", exit: "Mechanical close 24h after entry", sizing: "notional 1.0x" },
      { id: "V4", label: "V4 · +0.08% / 48h", entry: "8h funding print ≥ +0.08%", exit: "Mechanical close 48h after entry", sizing: "notional 1.0x" },
      { id: "V5", label: "V5 · +0.10% / 48h", entry: "8h funding print ≥ +0.10%", exit: "Mechanical close 48h after entry", sizing: "notional 1.0x" },
    ],
    baselines: [
      { id: "B1", label: "Passive long", description: "Buy-and-hold BTC and ETH perps over the identical window and costs." },
      { id: "B2", label: "Random short entries", description: "Random shorts matched on exposure and holding periods — luck under the same cost model." },
      { id: "B3", label: "Naive sub-0.05% short", description: "Short whenever funding is merely positive — the undisciplined version of the idea." },
    ],
    killFloor: [
      { id: "KF1", label: "DSR", rule: "Deflated Sharpe Ratio > 0" },
      { id: "KF2", label: "PBO", rule: "Probability of backtest overfitting < 40%" },
      { id: "KF3", label: "Bootstrap floor", rule: "90% bootstrap CI lower bound > 0" },
      { id: "KF4", label: "Walk-forward Sharpe", rule: "Net walk-forward Sharpe ≥ 0.50" },
      { id: "KF5", label: "Data coverage", rule: "Venue data coverage ≥ 95%" },
    ],
    dataRequirements: [
      { id: "DR1", label: "Funding history", detail: "Complete 8h funding-rate history for both perps, full window." },
      { id: "DR2", label: "Perp OHLCV", detail: "Bitget 1-minute candles for mark and last-price replay." },
      { id: "DR3", label: "Borrow / volume caps", detail: "Venue borrow constraints and participation caps for sizing realism." },
      { id: "DR4", label: "Depth snapshots", detail: "Order-book depth for the slippage model on entries and exits." },
    ],
    aiNote:
      "Drafted by the assistant from your hypothesis. Review every field — after freeze, nothing changes.",
    draftedAt: "2025-06-30T11:12:00Z",
  },
  frozen: {
    id: "SPEC-2025-0326",
    scenarioKey: "funding-carry",
    hypothesisText: "Short BTC and ETH perps when funding exceeds +0.10% and hold for 48 hours.",
    family: "Financing-rate carry",
    familyDetail:
      "Harvest persistently positive funding by holding shorts through the accrual window, hedged only by mechanical entry and exit rules.",
    instruments: [
      { symbol: "BTCUSDT", kind: "perp", venue: "Bitget" },
      { symbol: "ETHUSDT", kind: "perp", venue: "Bitget" },
    ],
    testingWindow: { from: "2022-01-03", to: "2025-06-30", label: "3.5 years" },
    variants: [
      { id: "V1", label: "V1 · +0.08% / 24h", entry: "8h funding print ≥ +0.08%", exit: "Mechanical close 24h after entry", sizing: "notional 1.0x" },
      { id: "V2", label: "V2 · +0.10% / 24h", entry: "8h funding print ≥ +0.10%", exit: "Mechanical close 24h after entry", sizing: "notional 1.0x" },
      { id: "V3", label: "V3 · +0.15% / 24h", entry: "8h funding print ≥ +0.15%", exit: "Mechanical close 24h after entry", sizing: "notional 1.0x" },
      { id: "V4", label: "V4 · +0.08% / 48h", entry: "8h funding print ≥ +0.08%", exit: "Mechanical close 48h after entry", sizing: "notional 1.0x" },
      { id: "V5", label: "V5 · +0.10% / 48h", entry: "8h funding print ≥ +0.10%", exit: "Mechanical close 48h after entry", sizing: "notional 1.0x" },
    ],
    baselines: [
      { id: "B1", label: "Passive long", description: "Buy-and-hold BTC and ETH perps over the identical window and costs." },
      { id: "B2", label: "Random short entries", description: "Random shorts matched on exposure and holding periods — luck under the same cost model." },
      { id: "B3", label: "Naive sub-0.05% short", description: "Short whenever funding is merely positive — the undisciplined version of the idea." },
    ],
    killFloor: [
      { id: "KF1", label: "DSR", rule: "Deflated Sharpe Ratio > 0" },
      { id: "KF2", label: "PBO", rule: "Probability of backtest overfitting < 40%" },
      { id: "KF3", label: "Bootstrap floor", rule: "90% bootstrap CI lower bound > 0" },
      { id: "KF4", label: "Walk-forward Sharpe", rule: "Net walk-forward Sharpe ≥ 0.50" },
      { id: "KF5", label: "Data coverage", rule: "Venue data coverage ≥ 95%" },
    ],
    dataRequirements: [
      { id: "DR1", label: "Funding history", detail: "Complete 8h funding-rate history for both perps, full window." },
      { id: "DR2", label: "Perp OHLCV", detail: "Bitget 1-minute candles for mark and last-price replay." },
      { id: "DR3", label: "Borrow / volume caps", detail: "Venue borrow constraints and participation caps for sizing realism." },
      { id: "DR4", label: "Depth snapshots", detail: "Order-book depth for the slippage model on entries and exits." },
    ],
    aiNote:
      "Drafted by the assistant from your hypothesis. Review every field — after freeze, nothing changes.",
    draftedAt: "2025-06-30T11:12:00Z",
    freezeHash: "kl1_8c2d41f0b9e3775a2d6c8f1e4a0b5d92",
    frozenAt: "2025-06-30T11:19:44Z",
    engineVersion: "killLab-engine v4.2.1",
    datasetVersion: "bitget-perps-1m · rev 2025-06-30",
  },
  runStages: [
    { key: "dataset", label: "Preparing dataset", detail: "Pulling frozen requirements against the Bitget perp archive.", durationMs: 2000, logLines: ["bitget perps · BTCUSDT ETHUSDT · 1m", "2,046,410 bars · 2022-01-03 → 2025-06-30", "funding history attached · depth snapshots attached"] },
    { key: "validate", label: "Validating history", detail: "Coverage, gaps and funding-print integrity.", durationMs: 1600, logLines: ["coverage 99.9% · no gaps", "214 funding events aligned", "8h print sequence verified · 0 corrections"] },
    { key: "walkforward", label: "Running walk-forward", detail: "Out-of-sample folds under the frozen cost model.", durationMs: 2500, logLines: ["20 anchored folds · embargo 24h", "entry/exit replayed on lagged data only", "fold 14/20 · 2024 Q4 · sharpe 0.98"] },
    { key: "bootstrap", label: "Computing bootstrap", detail: "Stationary-block resampling of the out-of-sample series.", durationMs: 1900, logLines: ["10,000 stationary-block resamples", "block length 48h · circular", "90% CI +0.11 … +0.79"] },
    { key: "dsr", label: "Calculating DSR", detail: "Deflated Sharpe Ratio penalized by the full comparison count.", durationMs: 1750, logLines: ["5 variants deflated · trials counted at freeze", "DSR 0.38", "in-sample 1.21 → deflated 0.38"] },
    { key: "pbo", label: "Checking overfitting", detail: "Combinatorially symmetric cross-validation.", durationMs: 1650, logLines: ["CSCV 16 blocks · 24 splits", "PBO 18% · rank correlation positive", "variant ranking stable across splits"] },
    { key: "traps", label: "Scanning nine traps", detail: "The nine known ways a backtest lies.", durationMs: 1950, logLines: ["9 traps · 3 low-severity notes", "cost · regime · outlier — all minor", "no high-severity traps triggered"] },
    { key: "verdict", label: "Building verdict", detail: "Kill floor evaluated. Verdict assembled from evidence only.", durationMs: 1500, logLines: ["kill floor 5/5 passed", "verdict: ALIVE", "report sealed · ledger entry staged"] },
  ],
  report: {
    scenarioKey: "funding-carry",
    verdict: "ALIVE",
    verdictSummary: "Survived the floor — with room to spare, not with room to boast.",
    testabilityGates: [
      { label: "Independent events", value: "214 funding events", required: "≥ 30 events", status: "pass" },
      { label: "Data coverage", value: "99.9% of window", required: "≥ 95%", status: "pass" },
      { label: "Independent folds", value: "20 anchored folds", required: "≥ 12 folds", status: "pass" },
    ],
    killFloorResults: [
      { label: "DSR", rule: "Deflated Sharpe Ratio > 0", value: "0.38", status: "pass" },
      { label: "PBO", rule: "Probability of backtest overfitting < 40%", value: "18%", status: "pass" },
      { label: "Bootstrap floor", rule: "90% CI lower bound > 0", value: "+0.11", status: "pass" },
      { label: "Walk-forward Sharpe", rule: "Net walk-forward Sharpe ≥ 0.50", value: "0.94", status: "pass" },
      { label: "Data coverage", rule: "Venue coverage ≥ 95%", value: "99.9%", status: "pass" },
    ],
    killFloorNote: "Five of five floor criteria passed. ALIVE is permission to continue carefully — not proof of an edge.",
    evidence: [
      { label: "In-sample Sharpe", value: "1.21", threshold: "— what the story looked like", status: "info" },
      { label: "Walk-forward Sharpe (net)", value: "0.94", threshold: "floor ≥ 0.50", status: "pass" },
      { label: "Deflated Sharpe Ratio", value: "0.38", threshold: "floor > 0", status: "pass" },
      { label: "Probability of backtest overfitting", value: "18%", threshold: "floor < 40%", status: "pass" },
      { label: "Bootstrap 90% CI (Sharpe)", value: "+0.11 … +0.79", threshold: "lower bound > 0", status: "pass" },
      { label: "Mean edge per event (post-cost)", value: "+9.1 bps", threshold: "> 0", status: "pass" },
      { label: "Events / fills", value: "214 / 428", threshold: "≥ 30 events", status: "pass" },
      { label: "Data coverage", value: "99.9%", threshold: "≥ 95%", status: "pass" },
    ],
    traps: [
      { id: "multiple-testing", name: "Multiple Testing", category: "statistical", triggered: false, severity: "low", summary: "Five variants, deflated for all of them.", finding: "DSR remains positive after penalizing the full set of five comparisons." },
      { id: "overfitting", name: "Backtest Overfitting", category: "statistical", triggered: false, severity: "low", summary: "PBO 18% — rankings hold out-of-sample.", finding: "Variant ranking is stable across CSCV splits; the selected variant is not a noise artifact." },
      { id: "survivorship", name: "Survivorship Bias", category: "data", triggered: false, severity: "low", summary: "Universe declared ex-ante.", finding: "BTC and ETH perps are the two longest-listed perps on the venue; no selection occurred." },
      { id: "look-ahead", name: "Look-Ahead Bias", category: "data", triggered: false, severity: "low", summary: "Entries replay on lagged prints only.", finding: "Funding prints and prices are replayed with a one-bar lag on every entry." },
      { id: "cost-blindness", name: "Cost Blindness", category: "execution", triggered: true, severity: "low", summary: "Costs are charged — the margin is simply thin.", finding: "Average round-trip cost 21 bps against +30 bps gross carry per event. The edge survives, but by a margin, not a mile." },
      { id: "liquidity", name: "Liquidity Illusion", category: "execution", triggered: false, severity: "low", summary: "Size fits comfortably within depth.", finding: "Average slippage 3 bps at 0.5% participation caps — no stress observed at tested size." },
      { id: "regime", name: "Regime Dependence", category: "statistical", triggered: true, severity: "low", summary: "Thinner, but present, in 2024 H2.", finding: "Fold Sharpe decays from ~1.1 (2023) to ~0.6 (2024 H2) yet remains positive across every fold." },
      { id: "small-sample", name: "Small Sample", category: "statistical", triggered: false, severity: "low", summary: "214 independent events is a strong sample.", finding: "Event count clears the gate with a wide margin; bootstrap width reflects genuine dispersion." },
      { id: "outlier", name: "Outlier Dependence", category: "statistical", triggered: true, severity: "low", summary: "Three weeks carry 28% of PnL.", finding: "Removing the top 3 accrual weeks and re-scoring keeps walk-forward Sharpe at 0.71 — thinner, not hollow." },
    ],
    folds: foldSharpes.map((sharpe, i) => ({
      fold: i + 1,
      period: foldQuarters[i],
      sharpe,
      netReturnPct: Math.round(sharpe * 1.6 * 10) / 10,
    })),
    equityCurves: [
      { key: "insample", label: "In-sample", tone: "insample", points: buildEquity(18.4, 0.9, 18.4, 0.008) },
      { key: "walkforward", label: "Walk-forward (net)", tone: "walkforward", points: buildEquity(14.9, 0.92, 14.9, 0.006) },
      { key: "baseline", label: "Passive long", tone: "baseline", points: buildEquity(52.6, 0.85, 52.6, 0.02) },
    ],
    bootstrap: {
      meanSharpe: 0.71,
      ciLow: 0.11,
      ciHigh: 0.79,
      confidence: "90% stationary-block",
      bins: buildBins(),
    },
    baselineComparison: [
      { label: "This test (walk-forward, net)", sharpe: 0.94, netReturnPct: 14.9, maxDrawdownPct: 4.8, isStrategy: true },
      { label: "Passive long", sharpe: 1.11, netReturnPct: 52.6, maxDrawdownPct: 34.2 },
      { label: "Random short entries", sharpe: 0.09, netReturnPct: 0.4, maxDrawdownPct: 6.1 },
      { label: "Naive sub-0.05% short", sharpe: 0.42, netReturnPct: 3.7, maxDrawdownPct: 5.5 },
    ],
    dataCoverage: {
      overallPct: 99.9,
      bars: "2,046,410 · 8h funding + 1m OHLCV",
      gaps: [],
      notes: [
        "Funding accrual timing replayed at print, not at settlement.",
        "No coverage gaps over the full 3.5-year window.",
      ],
    },
    aiInterpretation: {
      paragraphs: [
        "The carry is real but thin: +9.1 bps per event after costs, walk-forward Sharpe 0.94, and — most importantly — the 90% bootstrap interval never crosses zero. All five floor criteria passed, and the deflation for five variants did not erase the effect.",
        "Notice what ALIVE does not mean. Passive long beat it on raw return. The edge is capacity-limited, regime-aware (2024 H2 was thinner), and 28% of PnL sits in three unusually generous weeks. The floor rewards survival, not glory.",
        "The engine's verdict is ALIVE, and the reasoning is reproducible from the frozen spec. The honest continuation is small size, a hard 72h cap, and weekly fill review — because at this margin, execution quality owns the residual.",
      ],
      disclaimer: "Advisory interpretation only. Every number and the verdict are produced by the deterministic engine.",
    },
    nextSteps: [
      { title: "Paper execution", detail: "30 days of paper fills against the frozen spec before capital." },
      { title: "Fill-quality review", detail: "Compare realized slippage against the modeled 3 bps, weekly." },
      { title: "Decide in the ledger", detail: "Suggested decision: trade small, hard 72h cap, weekly fill review." },
    ],
    ledgerSuggestion: { stage: "RESULT", note: "ALIVE — awaiting decision review" },
  },
};
