import type { ScenarioFixture } from "../types";

/**
 * Scenario: earnings momentum — the canonical KillLab walkthrough.
 * A convincing in-sample story that dies under deterministic review.
 * All values are fictional fixture data for the frontend simulation.
 */

const N = 61;

/** Deterministic cumulative-return curve: smooth early growth, decay, then flat/dip. */
function buildEquity(riseTo: number, peakAt: number, endAt: number): number[] {
  const pts: number[] = [0];
  for (let i = 1; i < N; i++) {
    const t = i / (N - 1);
    let v: number;
    if (t <= peakAt) {
      v = riseTo * (t / peakAt) ** 0.9;
    } else {
      const k = (t - peakAt) / (1 - peakAt);
      v = riseTo + (endAt - riseTo) * (k ** 1.25);
    }
    // Deterministic micro-noise so the line reads as a market, not a formula.
    const wobble = Math.sin(i * 2.399) * Math.abs(riseTo) * 0.012;
    pts.push(Math.round((v + wobble) * 10) / 10);
  }
  return pts;
}

function buildBins(): { x0: number; x1: number; count: number }[] {
  const shape = [0.4, 0.9, 1.6, 2.7, 4.4, 6.6, 9.0, 11.4, 13.1, 13.9, 13.2, 11.8, 10.0, 8.1, 6.3, 4.8, 3.6, 2.7, 2.0, 1.5, 1.1, 0.8, 0.6, 0.5, 0.4, 0.3, 0.24, 0.2, 0.16, 0.12, 0.09, 0.06, 0.04, 0.02, 0.01, 0.0];
  return shape.map((count, i) => ({ x0: -1.0 + i * 0.07, x1: -1.0 + (i + 1) * 0.07, count }));
}

const foldSharpes = [1.12, 0.96, 1.04, 0.81, 0.72, 0.58, 0.63, 0.41, 0.35, 0.28, 0.19, 0.24, 0.05, -0.08, -0.12, -0.05, -0.22, -0.31, -0.24, -0.38, -0.41, -0.35, -0.44, -0.39];
const foldQuarters = ["2023 Q1", "2023 Q1", "2023 Q1", "2023 Q2", "2023 Q2", "2023 Q2", "2023 Q3", "2023 Q3", "2023 Q3", "2023 Q4", "2023 Q4", "2023 Q4", "2024 Q1", "2024 Q1", "2024 Q1", "2024 Q2", "2024 Q2", "2024 Q2", "2024 Q3", "2024 Q3", "2024 Q3", "2024 Q4", "2024 Q4", "2024 Q4"];

export const earningsMomentum: ScenarioFixture = {
  spec: {
    id: "SPEC-2025-0418",
    scenarioKey: "earnings-momentum",
    hypothesisText: "Trade NVDA and TSLA perps after earnings in the direction of the after-hours move.",
    family: "Event-driven momentum",
    familyDetail:
      "Post-earnings-announcement drift applied to perpetual futures: enter in the direction of the after-hours gap, hold a fixed window, exit mechanically.",
    instruments: [
      { symbol: "NVDAUSDT", kind: "perp", venue: "Bitget" },
      { symbol: "TSLAUSDT", kind: "perp", venue: "Bitget" },
    ],
    testingWindow: { from: "2023-01-01", to: "2025-06-30", label: "30 months" },
    variants: [
      { id: "V1", label: "V1 · ±2% gap / 24h", entry: "After-hours move ≥ ±2% within 4h of release", exit: "Mechanical close 24h after entry", sizing: "notional 1.0x" },
      { id: "V2", label: "V2 · ±3% gap / 24h", entry: "After-hours move ≥ ±3% within 4h of release", exit: "Mechanical close 24h after entry", sizing: "notional 1.0x" },
      { id: "V3", label: "V3 · ±5% gap / 24h", entry: "After-hours move ≥ ±5% within 4h of release", exit: "Mechanical close 24h after entry", sizing: "notional 1.0x" },
      { id: "V4", label: "V4 · ±3% gap / 48h", entry: "After-hours move ≥ ±3% within 4h of release", exit: "Mechanical close 48h after entry", sizing: "notional 1.0x" },
      { id: "V5", label: "V5 · ±5% gap / 48h", entry: "After-hours move ≥ ±5% within 4h of release", exit: "Mechanical close 48h after entry", sizing: "notional 1.0x" },
      { id: "V6", label: "V6 · ±3% gap / 72h", entry: "After-hours move ≥ ±3% within 4h of release", exit: "Mechanical close 72h after entry", sizing: "notional 1.0x" },
      { id: "V7", label: "V7 · ±3% gap / 48h · vol-scaled", entry: "After-hours move ≥ ±3% within 4h of release", exit: "Mechanical close 48h after entry", sizing: "notional 0.5x vol-scaled" },
    ],
    baselines: [
      { id: "B1", label: "Passive long basket", description: "Equal-weight passive long of both perps over the identical window." },
      { id: "B2", label: "Random entry / same holds", description: "Random entries with identical holding periods and exposure — luck under an identical cost model." },
      { id: "B3", label: "20-day trend following", description: "Classic 20-day breakout trend system on the same instruments and costs." },
    ],
    killFloor: [
      { id: "KF1", label: "DSR", rule: "Deflated Sharpe Ratio > 0" },
      { id: "KF2", label: "PBO", rule: "Probability of backtest overfitting < 40%" },
      { id: "KF3", label: "Bootstrap floor", rule: "90% bootstrap CI lower bound > 0" },
      { id: "KF4", label: "Walk-forward Sharpe", rule: "Net walk-forward Sharpe ≥ 0.50" },
      { id: "KF5", label: "Data coverage", rule: "Venue data coverage ≥ 95%" },
    ],
    dataRequirements: [
      { id: "DR1", label: "Perp OHLCV", detail: "Bitget 1-minute candles for NVDAUSDT and TSLAUSDT, full window." },
      { id: "DR2", label: "Earnings timestamps", detail: "Verified earnings-release times, cross-checked against issuer press releases." },
      { id: "DR3", label: "Funding history", detail: "Funding-rate accruals for every holding period." },
      { id: "DR4", label: "Depth snapshots", detail: "Order-book depth for the slippage and participation model." },
    ],
    aiNote:
      "Drafted by the assistant from your hypothesis. Review every field — after freeze, nothing changes.",
    draftedAt: "2025-07-08T09:41:00Z",
  },
  frozen: {
    id: "SPEC-2025-0418",
    scenarioKey: "earnings-momentum",
    hypothesisText: "Trade NVDA and TSLA perps after earnings in the direction of the after-hours move.",
    family: "Event-driven momentum",
    familyDetail:
      "Post-earnings-announcement drift applied to perpetual futures: enter in the direction of the after-hours gap, hold a fixed window, exit mechanically.",
    instruments: [
      { symbol: "NVDAUSDT", kind: "perp", venue: "Bitget" },
      { symbol: "TSLAUSDT", kind: "perp", venue: "Bitget" },
    ],
    testingWindow: { from: "2023-01-01", to: "2025-06-30", label: "30 months" },
    variants: [
      { id: "V1", label: "V1 · ±2% gap / 24h", entry: "After-hours move ≥ ±2% within 4h of release", exit: "Mechanical close 24h after entry", sizing: "notional 1.0x" },
      { id: "V2", label: "V2 · ±3% gap / 24h", entry: "After-hours move ≥ ±3% within 4h of release", exit: "Mechanical close 24h after entry", sizing: "notional 1.0x" },
      { id: "V3", label: "V3 · ±5% gap / 24h", entry: "After-hours move ≥ ±5% within 4h of release", exit: "Mechanical close 24h after entry", sizing: "notional 1.0x" },
      { id: "V4", label: "V4 · ±3% gap / 48h", entry: "After-hours move ≥ ±3% within 4h of release", exit: "Mechanical close 48h after entry", sizing: "notional 1.0x" },
      { id: "V5", label: "V5 · ±5% gap / 48h", entry: "After-hours move ≥ ±5% within 4h of release", exit: "Mechanical close 48h after entry", sizing: "notional 1.0x" },
      { id: "V6", label: "V6 · ±3% gap / 72h", entry: "After-hours move ≥ ±3% within 4h of release", exit: "Mechanical close 72h after entry", sizing: "notional 1.0x" },
      { id: "V7", label: "V7 · ±3% gap / 48h · vol-scaled", entry: "After-hours move ≥ ±3% within 4h of release", exit: "Mechanical close 48h after entry", sizing: "notional 0.5x vol-scaled" },
    ],
    baselines: [
      { id: "B1", label: "Passive long basket", description: "Equal-weight passive long of both perps over the identical window." },
      { id: "B2", label: "Random entry / same holds", description: "Random entries with identical holding periods and exposure — luck under an identical cost model." },
      { id: "B3", label: "20-day trend following", description: "Classic 20-day breakout trend system on the same instruments and costs." },
    ],
    killFloor: [
      { id: "KF1", label: "DSR", rule: "Deflated Sharpe Ratio > 0" },
      { id: "KF2", label: "PBO", rule: "Probability of backtest overfitting < 40%" },
      { id: "KF3", label: "Bootstrap floor", rule: "90% bootstrap CI lower bound > 0" },
      { id: "KF4", label: "Walk-forward Sharpe", rule: "Net walk-forward Sharpe ≥ 0.50" },
      { id: "KF5", label: "Data coverage", rule: "Venue data coverage ≥ 95%" },
    ],
    dataRequirements: [
      { id: "DR1", label: "Perp OHLCV", detail: "Bitget 1-minute candles for NVDAUSDT and TSLAUSDT, full window." },
      { id: "DR2", label: "Earnings timestamps", detail: "Verified earnings-release times, cross-checked against issuer press releases." },
      { id: "DR3", label: "Funding history", detail: "Funding-rate accruals for every holding period." },
      { id: "DR4", label: "Depth snapshots", detail: "Order-book depth for the slippage and participation model." },
    ],
    aiNote:
      "Drafted by the assistant from your hypothesis. Review every field — after freeze, nothing changes.",
    draftedAt: "2025-07-08T09:41:00Z",
    freezeHash: "kl1_f3a9c2e84d1b7a90c6f2e5d8a1b4c7e0",
    frozenAt: "2025-07-08T09:47:12Z",
    engineVersion: "killLab-engine v4.2.1",
    datasetVersion: "bitget-perps-1m · rev 2025-06-30",
  },
  runStages: [
    {
      key: "dataset",
      label: "Preparing dataset",
      detail: "Pulling frozen requirements against the Bitget perp archive.",
      durationMs: 2100,
      logLines: ["bitget perps · NVDAUSDT TSLAUSDT · 1m", "1,284,822 bars · 2023-01-01 → 2025-06-30", "funding history attached · depth snapshots attached"],
    },
    {
      key: "validate",
      label: "Validating history",
      detail: "Coverage, gaps and event-timestamp integrity.",
      durationMs: 1700,
      logLines: ["coverage 99.7% · 2 gaps embargoed", "148 earnings events aligned", "timestamps cross-checked vs issuer releases"],
    },
    {
      key: "walkforward",
      label: "Running walk-forward",
      detail: "Out-of-sample folds under the frozen cost model.",
      durationMs: 2600,
      logLines: ["24 anchored folds · embargo 48h", "entry/exit replayed on lagged data only", "fold 12/24 · 2024 Q2 · sharpe 0.41"],
    },
    {
      key: "bootstrap",
      label: "Computing bootstrap",
      detail: "Stationary-block resampling of the out-of-sample series.",
      durationMs: 1900,
      logLines: ["10,000 stationary-block resamples", "block length 48h · circular", "90% CI −0.24 … +0.71"],
    },
    {
      key: "dsr",
      label: "Calculating DSR",
      detail: "Deflated Sharpe Ratio for every variant, penalized by the full comparison count.",
      durationMs: 1800,
      logLines: ["7 variants deflated · trials counted at freeze", "DSR −0.41", "in-sample 1.82 → deflated −0.41"],
    },
    {
      key: "pbo",
      label: "Checking overfitting",
      detail: "Combinatorially symmetric cross-validation.",
      durationMs: 1700,
      logLines: ["CSCV 16 blocks · 24 splits", "PBO 62% · rank correlation negative", "variant ranking unstable across splits"],
    },
    {
      key: "traps",
      label: "Scanning nine traps",
      detail: "The nine known ways a backtest lies.",
      durationMs: 2000,
      logLines: ["9 traps · 5 triggered", "multiple-testing · overfitting · cost-blindness · regime · outlier", "survivorship · look-ahead · liquidity · small-sample clear"],
    },
    {
      key: "verdict",
      label: "Building verdict",
      detail: "Kill floor evaluated. Verdict assembled from evidence only.",
      durationMs: 1500,
      logLines: ["kill floor 4/5 failed", "verdict: KILLED", "report sealed · ledger entry staged"],
    },
  ],
  report: {
    scenarioKey: "earnings-momentum",
    verdict: "KILLED",
    verdictSummary: "The edge does not survive costs, multiple testing, or time.",
    testabilityGates: [
      { label: "Independent events", value: "148 earnings events", required: "≥ 30 events", status: "pass" },
      { label: "Data coverage", value: "99.7% of window", required: "≥ 95%", status: "pass" },
      { label: "Independent folds", value: "24 anchored folds", required: "≥ 12 folds", status: "pass" },
    ],
    killFloorResults: [
      { label: "DSR", rule: "Deflated Sharpe Ratio > 0", value: "−0.41", status: "fail" },
      { label: "PBO", rule: "Probability of backtest overfitting < 40%", value: "62%", status: "fail" },
      { label: "Bootstrap floor", rule: "90% CI lower bound > 0", value: "−0.24", status: "fail" },
      { label: "Walk-forward Sharpe", rule: "Net walk-forward Sharpe ≥ 0.50", value: "0.31", status: "fail" },
      { label: "Data coverage", rule: "Venue coverage ≥ 95%", value: "99.7%", status: "pass" },
    ],
    killFloorNote: "Four of five floor criteria failed. The engine does not negotiate.",
    evidence: [
      { label: "In-sample Sharpe", value: "1.82", threshold: "— what the story looked like", status: "info" },
      { label: "Walk-forward Sharpe (net)", value: "0.31", threshold: "floor ≥ 0.50", status: "fail" },
      { label: "Deflated Sharpe Ratio", value: "−0.41", threshold: "floor > 0", status: "fail" },
      { label: "Probability of backtest overfitting", value: "62%", threshold: "floor < 40%", status: "fail" },
      { label: "Bootstrap 90% CI (Sharpe)", value: "−0.24 … +0.71", threshold: "lower bound > 0", status: "fail" },
      { label: "Mean edge per event (post-cost)", value: "−0.11%", threshold: "> 0", status: "fail" },
      { label: "Events / fills", value: "148 / 296", threshold: "≥ 30 events", status: "pass" },
      { label: "Data coverage", value: "99.7%", threshold: "≥ 95%", status: "pass" },
      { label: "Cost per event", value: "53 bps avg (taker + funding)", threshold: "modeled on every fill", status: "info" },
    ],
    traps: [
      { id: "multiple-testing", name: "Multiple Testing", category: "statistical", triggered: true, severity: "high", summary: "Seven variants were tested; the best one was always going to shine.", finding: "V5 was selected after the fact from 7 frozen variants — the deflated Sharpe ratio erases the entire selection premium." },
      { id: "overfitting", name: "Backtest Overfitting", category: "statistical", triggered: true, severity: "high", summary: "PBO 62% — the ranking of variants is mostly noise.", finding: "In 62% of CSCV splits, the in-sample-best variant fell below median out-of-sample." },
      { id: "cost-blindness", name: "Cost Blindness", category: "execution", triggered: true, severity: "medium", summary: "A +42 bps raw edge meets a 53 bps round-trip cost.", finding: "With taker fees, funding and modeled slippage charged on every fill, mean edge per event flips from +42 bps to −11 bps." },
      { id: "regime", name: "Regime Dependence", category: "statistical", triggered: true, severity: "high", summary: "The edge lives in 2023 and quietly dies afterwards.", finding: "Folds 1–8 (2023) contribute +9.8% of walk-forward return; folds 9–24 (2024–2025) contribute −12.6%." },
      { id: "outlier", name: "Outlier Dependence", category: "statistical", triggered: true, severity: "medium", summary: "Three events carry 41% of gross PnL.", finding: "Removing the top 3 events and re-scoring drops in-sample Sharpe from 1.82 to 0.94 — the story is thinner than it looks." },
      { id: "survivorship", name: "Survivorship Bias", category: "data", triggered: false, severity: "low", summary: "Universe declared ex-ante.", finding: "NVDA and TSLA perps were the declared universe at freeze; no selection occurred inside the engine." },
      { id: "look-ahead", name: "Look-Ahead Bias", category: "data", triggered: false, severity: "low", summary: "Decisions replay on lagged data only.", finding: "All entries replayed against next-bar prints; earnings timestamps verified against issuer releases." },
      { id: "liquidity", name: "Liquidity Illusion", category: "execution", triggered: false, severity: "low", summary: "Modeled size fits within observed depth.", finding: "Notional capped at 0.5% participation; average slippage 6 bps — near, but under, the limit." },
      { id: "small-sample", name: "Small Sample", category: "statistical", triggered: false, severity: "low", summary: "148 independent events is an adequate sample.", finding: "Event count clears the gate with room; conclusions are not sample-starved." },
    ],
    folds: foldSharpes.map((sharpe, i) => ({
      fold: i + 1,
      period: foldQuarters[i],
      sharpe,
      netReturnPct: Math.round(sharpe * 3.1 * 10) / 10,
    })),
    equityCurves: [
      { key: "insample", label: "In-sample (what you were shown)", tone: "insample", points: buildEquity(34.2, 0.82, 34.2) },
      { key: "walkforward", label: "Walk-forward (net)", tone: "walkforward", points: buildEquity(11.4, 0.34, -2.8) },
      { key: "baseline", label: "Passive long basket", tone: "baseline", points: buildEquity(41.3, 0.95, 41.3) },
    ],
    bootstrap: {
      meanSharpe: 0.24,
      ciLow: -0.24,
      ciHigh: 0.71,
      confidence: "90% stationary-block",
      bins: buildBins(),
    },
    baselineComparison: [
      { label: "This test (walk-forward, net)", sharpe: 0.31, netReturnPct: -2.8, maxDrawdownPct: 14.6, isStrategy: true },
      { label: "Passive long basket", sharpe: 1.02, netReturnPct: 41.3, maxDrawdownPct: 18.9 },
      { label: "Random entry / same holds", sharpe: 0.18, netReturnPct: 1.9, maxDrawdownPct: 12.4 },
      { label: "20-day trend following", sharpe: 0.87, netReturnPct: 22.6, maxDrawdownPct: 11.2 },
    ],
    dataCoverage: {
      overallPct: 99.7,
      bars: "1,284,822 · 1m OHLCV",
      gaps: [
        { period: "2023-08-14 02:10–02:51 UTC", reason: "venue maintenance" },
        { period: "2024-03-02 11:03–11:20 UTC", reason: "API outage" },
      ],
      notes: [
        "±48h embargo applied around every earnings event.",
        "Earnings timestamps cross-checked against issuer press releases.",
      ],
    },
    aiInterpretation: {
      paragraphs: [
        "The original backtest showed a 1.82 Sharpe — a compelling equity curve that ends at +34%. That is the story you were shown. It was built by selecting the best of seven variants after seeing all of their results, without charging full costs.",
        "Deflated for those seven trials, the Sharpe falls below zero. Walk-forward folds show the edge decaying quarter by quarter — nearly all of it lives in 2023. After charging the modeled 53 bps per event, the average trade is slightly negative. The bootstrap interval straddles zero. Five traps fired, three of them severe.",
        "The engine's verdict is KILLED, and the reasoning is reproducible: the same frozen inputs will always produce this report. The honest move is not to tune the thresholds — it is to log the result, retire this variant family, and formulate the next question with the knowledge that momentum here was regime-bound.",
      ],
      disclaimer: "Advisory interpretation only. Every number and the verdict are produced by the deterministic engine.",
    },
    nextSteps: [
      { title: "Log the result", detail: "Advance the ledger from RESULT to DECISION — the memory of this test should outlive the idea." },
      { title: "Retire V1–V7", detail: "The variant family is closed for this window. Re-testing requires a new frozen spec." },
      { title: "Reformulate", detail: "New UNKNOWN: does continuation require an earnings surprise greater than +8%?" },
    ],
    ledgerSuggestion: { stage: "RESULT", note: "KILLED — awaiting decision review" },
  },
};
