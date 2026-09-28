import type { ScenarioFixture } from "../types";

/**
 * Scenario: range rotation — the honest refusal.
 * Testability gates fail before statistics run; the verdict is UNTESTABLE.
 * All values are fictional fixture data for the frontend simulation.
 */

export const rangeRotation: ScenarioFixture = {
  spec: {
    id: "SPEC-2025-0402",
    scenarioKey: "range-rotation",
    hypothesisText: "When BTC breaks its 20-day range, rotate into majors' alts perps within 48 hours.",
    family: "Cross-asset rotation",
    familyDetail:
      "Range-break propagation: when BTC resolves a multi-week range, test whether alt perps inherit the move within a bounded rotation window.",
    instruments: [
      { symbol: "BTCUSDT", kind: "perp", venue: "Bitget" },
      { symbol: "SOLUSDT", kind: "perp", venue: "Bitget" },
      { symbol: "AVAXUSDT", kind: "perp", venue: "Bitget" },
      { symbol: "LINKUSDT", kind: "perp", venue: "Bitget" },
      { symbol: "DOGEUSDT", kind: "perp", venue: "Bitget" },
      { symbol: "ADAUSDT", kind: "perp", venue: "Bitget" },
      { symbol: "TONUSDT", kind: "perp", venue: "Bitget" },
    ],
    testingWindow: { from: "2023-06-01", to: "2025-06-30", label: "24 months" },
    variants: [
      { id: "V1", label: "V1 · ≥1.5σ break / 24h rotation", entry: "BTC closes ≥1.5σ outside its 20-day range", exit: "Mechanical rotation close 24h after entry", sizing: "equal-weight 6 alts · 1.0x" },
      { id: "V2", label: "V2 · ≥1.5σ break / 48h rotation", entry: "BTC closes ≥1.5σ outside its 20-day range", exit: "Mechanical rotation close 48h after entry", sizing: "equal-weight 6 alts · 1.0x" },
      { id: "V3", label: "V3 · ≥2.5σ break / 24h rotation", entry: "BTC closes ≥2.5σ outside its 20-day range", exit: "Mechanical rotation close 24h after entry", sizing: "equal-weight 6 alts · 1.0x" },
      { id: "V4", label: "V4 · ≥2.5σ break / 48h rotation", entry: "BTC closes ≥2.5σ outside its 20-day range", exit: "Mechanical rotation close 48h after entry", sizing: "equal-weight 6 alts · 1.0x" },
    ],
    baselines: [
      { id: "B1", label: "Passive equal-weight alt basket", description: "Buy-and-hold the six alt perps, equal weight, identical window and costs." },
      { id: "B2", label: "BTC-only momentum", description: "The same break signal traded on BTC alone — no rotation leg." },
    ],
    killFloor: [
      { id: "KF1", label: "DSR", rule: "Deflated Sharpe Ratio > 0" },
      { id: "KF2", label: "PBO", rule: "Probability of backtest overfitting < 40%" },
      { id: "KF3", label: "Bootstrap floor", rule: "90% bootstrap CI lower bound > 0" },
      { id: "KF4", label: "Walk-forward Sharpe", rule: "Net walk-forward Sharpe ≥ 0.50" },
      { id: "KF5", label: "Data coverage", rule: "Venue data coverage ≥ 95%" },
    ],
    dataRequirements: [
      { id: "DR1", label: "Perp OHLCV", detail: "Bitget 1-minute candles for all seven symbols, full window." },
      { id: "DR2", label: "Range definitions", detail: "20-day range and σ bands precomputed at freeze, immutable." },
      { id: "DR3", label: "Depth snapshots", detail: "Order-book depth for the rotation slippage model." },
      { id: "DR4", label: "Listing calendar", detail: "Venue listing dates for every alt perp in the universe." },
    ],
    aiNote:
      "Drafted by the assistant from your hypothesis. Review every field — after freeze, nothing changes.",
    draftedAt: "2025-07-01T14:02:00Z",
  },
  frozen: {
    id: "SPEC-2025-0402",
    scenarioKey: "range-rotation",
    hypothesisText: "When BTC breaks its 20-day range, rotate into majors' alts perps within 48 hours.",
    family: "Cross-asset rotation",
    familyDetail:
      "Range-break propagation: when BTC resolves a multi-week range, test whether alt perps inherit the move within a bounded rotation window.",
    instruments: [
      { symbol: "BTCUSDT", kind: "perp", venue: "Bitget" },
      { symbol: "SOLUSDT", kind: "perp", venue: "Bitget" },
      { symbol: "AVAXUSDT", kind: "perp", venue: "Bitget" },
      { symbol: "LINKUSDT", kind: "perp", venue: "Bitget" },
      { symbol: "DOGEUSDT", kind: "perp", venue: "Bitget" },
      { symbol: "ADAUSDT", kind: "perp", venue: "Bitget" },
      { symbol: "TONUSDT", kind: "perp", venue: "Bitget" },
    ],
    testingWindow: { from: "2023-06-01", to: "2025-06-30", label: "24 months" },
    variants: [
      { id: "V1", label: "V1 · ≥1.5σ break / 24h rotation", entry: "BTC closes ≥1.5σ outside its 20-day range", exit: "Mechanical rotation close 24h after entry", sizing: "equal-weight 6 alts · 1.0x" },
      { id: "V2", label: "V2 · ≥1.5σ break / 48h rotation", entry: "BTC closes ≥1.5σ outside its 20-day range", exit: "Mechanical rotation close 48h after entry", sizing: "equal-weight 6 alts · 1.0x" },
      { id: "V3", label: "V3 · ≥2.5σ break / 24h rotation", entry: "BTC closes ≥2.5σ outside its 20-day range", exit: "Mechanical rotation close 24h after entry", sizing: "equal-weight 6 alts · 1.0x" },
      { id: "V4", label: "V4 · ≥2.5σ break / 48h rotation", entry: "BTC closes ≥2.5σ outside its 20-day range", exit: "Mechanical rotation close 48h after entry", sizing: "equal-weight 6 alts · 1.0x" },
    ],
    baselines: [
      { id: "B1", label: "Passive equal-weight alt basket", description: "Buy-and-hold the six alt perps, equal weight, identical window and costs." },
      { id: "B2", label: "BTC-only momentum", description: "The same break signal traded on BTC alone — no rotation leg." },
    ],
    killFloor: [
      { id: "KF1", label: "DSR", rule: "Deflated Sharpe Ratio > 0" },
      { id: "KF2", label: "PBO", rule: "Probability of backtest overfitting < 40%" },
      { id: "KF3", label: "Bootstrap floor", rule: "90% bootstrap CI lower bound > 0" },
      { id: "KF4", label: "Walk-forward Sharpe", rule: "Net walk-forward Sharpe ≥ 0.50" },
      { id: "KF5", label: "Data coverage", rule: "Venue data coverage ≥ 95%" },
    ],
    dataRequirements: [
      { id: "DR1", label: "Perp OHLCV", detail: "Bitget 1-minute candles for all seven symbols, full window." },
      { id: "DR2", label: "Range definitions", detail: "20-day range and σ bands precomputed at freeze, immutable." },
      { id: "DR3", label: "Depth snapshots", detail: "Order-book depth for the rotation slippage model." },
      { id: "DR4", label: "Listing calendar", detail: "Venue listing dates for every alt perp in the universe." },
    ],
    aiNote:
      "Drafted by the assistant from your hypothesis. Review every field — after freeze, nothing changes.",
    draftedAt: "2025-07-01T14:02:00Z",
    freezeHash: "kl1_51b7e0a4d2f8c3967a1b5e8d0f4c2a77",
    frozenAt: "2025-07-01T14:09:31Z",
    engineVersion: "killLab-engine v4.2.1",
    datasetVersion: "bitget-perps-1m · rev 2025-06-30",
  },
  runStages: [
    { key: "dataset", label: "Preparing dataset", detail: "Pulling frozen requirements against the Bitget perp archive.", durationMs: 2100, logLines: ["bitget perps · 7 symbols · 1m", "684,201 bars assembled · partial window", "listing calendar attached"] },
    { key: "validate", label: "Validating history", detail: "Coverage, gaps and listing integrity.", durationMs: 1800, logLines: ["9 qualifying break events", "alt coverage 71.2% < 95% floor", "TONUSDT listed 2024-02-21 · window truncated"] },
    { key: "walkforward", label: "Running walk-forward", detail: "Out-of-sample folds under the frozen cost model.", durationMs: 1400, logLines: ["4 folds computable · 12 required", "fold construction halted", "insufficient independent segments"] },
    { key: "bootstrap", label: "Computing bootstrap", detail: "Stationary-block resampling of the out-of-sample series.", durationMs: 1200, logLines: ["resampling skipped — no out-of-sample series", "statistics never started"] },
    { key: "dsr", label: "Calculating DSR", detail: "Deflated Sharpe Ratio for every variant.", durationMs: 1200, logLines: ["DSR not computed", "requires a defensible sample first"] },
    { key: "pbo", label: "Checking overfitting", detail: "Combinatorially symmetric cross-validation.", durationMs: 1200, logLines: ["CSCV not computed", "requires ≥ 12 folds"] },
    { key: "traps", label: "Scanning nine traps", detail: "The nine known ways a backtest lies.", durationMs: 1600, logLines: ["9 traps · 2 triggered before statistics", "small-sample · survivorship", "remaining traps: not evaluated"] },
    { key: "verdict", label: "Building verdict", detail: "Testability gates evaluated. Verdict assembled.", durationMs: 1500, logLines: ["testability gates 0/3 passed", "statistics skipped — testability gates failed", "verdict: UNTESTABLE"] },
  ],
  report: {
    scenarioKey: "range-rotation",
    verdict: "UNTESTABLE",
    verdictSummary: "The engine never reached a verdict — the sample cannot support one.",
    testabilityGates: [
      { label: "Independent events", value: "9 qualifying breaks", required: "≥ 30 events", status: "fail" },
      { label: "Data coverage", value: "71.2% of window", required: "≥ 95%", status: "fail" },
      { label: "Independent folds", value: "4 computable folds", required: "≥ 12 folds", status: "fail" },
    ],
    killFloorResults: [],
    killFloorNote: "Not evaluated — testability gates failed before statistics ran.",
    evidence: [
      { label: "Qualifying break events", value: "9", threshold: "≥ 30 required", status: "fail" },
      { label: "Alt-pair coverage", value: "71.2%", threshold: "≥ 95% required", status: "fail" },
      { label: "Independent folds", value: "4 of 12 minimum", threshold: "≥ 12 required", status: "fail" },
      { label: "Deflated Sharpe Ratio", value: "—", threshold: "not computed", status: "info" },
      { label: "Probability of backtest overfitting", value: "—", threshold: "not computed", status: "info" },
    ],
    traps: [
      { id: "small-sample", name: "Small Sample", category: "statistical", triggered: true, severity: "high", summary: "Nine events cannot support any statistical claim.", finding: "With 9 qualifying breaks, any Sharpe ratio is indistinguishable from noise. This trap alone forces UNTESTABLE." },
      { id: "survivorship", name: "Survivorship Bias", category: "data", triggered: true, severity: "medium", summary: "Six listings at six different dates — selection bias is structural.", finding: "TON listed 2024-02-21 and others mid-window; today's universe is a survivor of the period being tested." },
      { id: "multiple-testing", name: "Multiple Testing", category: "statistical", triggered: false, severity: "low", summary: "Not evaluated.", finding: "No statistics ran; variant count (4) is recorded for the next attempt." },
      { id: "overfitting", name: "Backtest Overfitting", category: "statistical", triggered: false, severity: "low", summary: "Not evaluated.", finding: "CSCV requires ≥ 12 folds; only 4 are computable on this window." },
      { id: "look-ahead", name: "Look-Ahead Bias", category: "data", triggered: false, severity: "low", summary: "Range definitions were frozen.", finding: "20-day range and σ bands were committed at freeze and replayed on lagged data." },
      { id: "cost-blindness", name: "Cost Blindness", category: "execution", triggered: false, severity: "low", summary: "Not evaluated.", finding: "Cost model attached at freeze but never exercised — no statistics ran." },
      { id: "liquidity", name: "Liquidity Illusion", category: "execution", triggered: false, severity: "low", summary: "Not evaluated.", finding: "Depth snapshots present for all seven symbols; participation caps recorded." },
      { id: "regime", name: "Regime Dependence", category: "statistical", triggered: false, severity: "low", summary: "Not evaluated.", finding: "Fold decomposition impossible with 9 events." },
      { id: "outlier", name: "Outlier Dependence", category: "statistical", triggered: false, severity: "low", summary: "Not evaluated.", finding: "PnL concentration cannot be measured without a PnL series." },
    ],
    baselineComparison: [
      { label: "Passive equal-weight alt basket", sharpe: 0.66, netReturnPct: 18.2, maxDrawdownPct: 22.4 },
      { label: "BTC-only momentum", sharpe: 0.58, netReturnPct: 9.7, maxDrawdownPct: 10.1 },
    ],
    dataCoverage: {
      overallPct: 71.2,
      bars: "684,201 · 1m OHLCV (partial)",
      gaps: [
        { period: "TONUSDT · listed 2024-02-21", reason: "62% of window missing" },
        { period: "AVAXUSDT · listed 2023-08-09", reason: "38% of window missing" },
        { period: "SOLUSDT · listed 2023-06-15", reason: "6% of window missing" },
      ],
      notes: [
        "Missing history is structural — these perps did not exist for parts of the window.",
        "Baselines were computed over the intersection of available data; the strategy was not.",
      ],
    },
    aiInterpretation: {
      paragraphs: [
        "UNTESTABLE is a verdict, not an error. The engine refused to run statistics because the sample cannot carry them: nine qualifying break events, four computable folds, and a universe whose members listed at six different dates. Any Sharpe ratio produced from this would be noise wearing a number's clothing.",
        "Notice what this protects you from. The alt universe you would trade today is precisely the set that survived the window — structural survivorship. A naive backtest would have silently interpolated, imputed, or started every alt at its listing and called it a result.",
        "Nothing here failed. The idea was simply never measured. The honest continuation is a new frozen test — a pre-registered universe, a longer window, or a relaxed break definition — and until then, the ledger should remember this idea as UNKNOWN, not dead.",
      ],
      disclaimer: "Advisory interpretation only. Every number and the verdict are produced by the deterministic engine.",
    },
    nextSteps: [
      { title: "Reformulate the universe", detail: "Pre-register the full listing calendar — not today's survivors — as the declared universe." },
      { title: "Extend the window", detail: "An earlier start date admits more breaks and more folds; new freeze required." },
      { title: "Hold as UNKNOWN", detail: "This idea is unmeasured, not failed. Keep it in the ledger as an open question." },
    ],
    ledgerSuggestion: { stage: "RESULT", note: "UNTESTABLE — awaiting decision review" },
  },
};
