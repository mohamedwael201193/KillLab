/**
 * KillLab research domain types.
 *
 * These contracts are the seam between the product UI and any data provider.
 * The current simulation ships a fixture-backed data source
 * (`src/lib/research/data-source.ts`); a production KillLab API can implement
 * the same interfaces without touching the UI layer.
 */

export type Verdict = "KILLED" | "ALIVE" | "INCONCLUSIVE" | "UNTESTABLE";

export type LedgerStage = "KNOWN" | "UNKNOWN" | "TEST" | "RESULT" | "DECISION";

export type EvidenceStatus = "pass" | "fail" | "warn" | "info";

export type TrapSeverity = "low" | "medium" | "high";

export type TrapCategory = "statistical" | "execution" | "data";

/** Identifiers for the fully-specified research scenarios shipped with the simulation. */
export type ScenarioKey =
  | "earnings-momentum"
  | "funding-carry"
  | "range-rotation"
  | "session-open"
  | "cash-close"
  | "weekend-choice"
  | "basis-fade"
  | "prior-hour-lead";

/* ------------------------------------------------------------------ */
/* Specification (pre-freeze)                                          */
/* ------------------------------------------------------------------ */

export interface InstrumentRef {
  symbol: string;
  kind: "perp" | "spot";
  venue: string;
}

export interface SpecVariant {
  id: string;
  label: string;
  entry: string;
  exit: string;
  sizing: string;
}

export interface BaselineRef {
  id: string;
  label: string;
  description: string;
}

export interface KillFloorCriterion {
  id: string;
  label: string;
  rule: string;
}

export interface DataRequirement {
  id: string;
  label: string;
  detail: string;
}

export interface ResearchSpec {
  id: string;
  scenarioKey: ScenarioKey;
  hypothesisText: string;
  family: string;
  familyDetail: string;
  instruments: InstrumentRef[];
  testingWindow: { from: string; to: string; label: string };
  variants: SpecVariant[];
  baselines: BaselineRef[];
  killFloor: KillFloorCriterion[];
  dataRequirements: DataRequirement[];
  aiNote: string;
  draftedAt: string;
}

export interface FrozenResearchSpec extends ResearchSpec {
  freezeHash: string;
  frozenAt: string;
  engineVersion: string;
  datasetVersion: string;
}

/* ------------------------------------------------------------------ */
/* Deterministic run                                                   */
/* ------------------------------------------------------------------ */

export interface RunStageDef {
  key: string;
  label: string;
  detail: string;
  /** Simulated wall-clock duration of the stage in the frontend experience. */
  durationMs: number;
  /** Restrained, engine-style log lines emitted while the stage is active. */
  logLines: string[];
}

/* ------------------------------------------------------------------ */
/* Verdict report                                                      */
/* ------------------------------------------------------------------ */

export interface EvidenceRow {
  label: string;
  value: string;
  threshold?: string;
  status: EvidenceStatus;
}

export interface TestabilityGate {
  label: string;
  value: string;
  required: string;
  status: EvidenceStatus;
}

export interface KillFloorResult {
  label: string;
  rule: string;
  value: string;
  status: EvidenceStatus;
}

export interface TrapCheckResult {
  id: string;
  name: string;
  category: TrapCategory;
  triggered: boolean;
  severity: TrapSeverity;
  summary: string;
  finding: string;
}

export interface FoldResult {
  fold: number;
  period: string;
  sharpe: number;
  netReturnPct: number;
}

export interface EquityCurve {
  key: string;
  label: string;
  tone: "insample" | "walkforward" | "baseline";
  /** Cumulative return percentage series (index 0 = 0). */
  points: number[];
}

export interface BootstrapDistribution {
  meanSharpe: number;
  ciLow: number;
  ciHigh: number;
  confidence: string;
  /** Histogram bins over Sharpe space. */
  bins: { x0: number; x1: number; count: number }[];
}

export interface BaselineComparisonRow {
  label: string;
  sharpe: number;
  netReturnPct: number;
  maxDrawdownPct: number;
  isStrategy?: boolean;
}

export interface DataCoverageReport {
  overallPct: number;
  bars: string;
  gaps: { period: string; reason: string }[];
  notes: string[];
}

export interface VerdictReport {
  scenarioKey: ScenarioKey;
  verdict: Verdict;
  /** One-line verdict statement owned by the engine. */
  verdictSummary: string;
  /** Testability gates evaluated before any statistics run. */
  testabilityGates: TestabilityGate[];
  /** Kill-floor evaluation. Empty when testability gates failed. */
  killFloorResults: KillFloorResult[];
  killFloorNote?: string;
  evidence: EvidenceRow[];
  traps: TrapCheckResult[];
  /** Per-fold walk-forward results. Omitted when untestable. */
  folds?: FoldResult[];
  /** Cumulative equity series. Omitted when untestable. */
  equityCurves?: EquityCurve[];
  /** Bootstrap distribution of Sharpe. Omitted when untestable. */
  bootstrap?: BootstrapDistribution;
  baselineComparison: BaselineComparisonRow[];
  dataCoverage: DataCoverageReport;
  aiInterpretation: {
    paragraphs: string[];
    disclaimer: string;
  };
  nextSteps: { title: string; detail: string }[];
  ledgerSuggestion: { stage: LedgerStage; note: string };
}

/* ------------------------------------------------------------------ */
/* Ledger                                                              */
/* ------------------------------------------------------------------ */

export interface LedgerStageMark {
  stage: LedgerStage;
  at: string;
  note: string;
}

export interface LedgerEntry {
  id: string;
  scenarioKey: ScenarioKey;
  hypothesisText: string;
  family: string;
  instruments: string[];
  stage: LedgerStage;
  marks: LedgerStageMark[];
  verdict?: Verdict;
  keyNumbers: { label: string; value: string }[];
  decision?: {
    summary: string;
    rationale: string;
    nextTest: string;
  };
}

/* ------------------------------------------------------------------ */
/* Landing-facing definitions                                          */
/* ------------------------------------------------------------------ */

/** The nine known traps scanned on every frozen test. */
export interface TrapDefinition {
  id: string;
  index: string;
  name: string;
  category: TrapCategory;
  tagline: string;
  description: string;
  detection: string;
}

export interface ExampleHypothesis {
  scenarioKey: ScenarioKey;
  chip: string;
  text: string;
  note: string;
}

/* ------------------------------------------------------------------ */
/* Scenario bundle                                                     */
/* ------------------------------------------------------------------ */

export interface ScenarioFixture {
  spec: ResearchSpec;
  frozen: FrozenResearchSpec;
  runStages: RunStageDef[];
  report: VerdictReport;
}
