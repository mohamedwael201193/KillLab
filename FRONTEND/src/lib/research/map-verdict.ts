import type { EvidenceRow, EvidenceStatus, TrapCheckResult, Verdict, VerdictReport } from "./types";

type VerdictJson = {
  label?: Verdict;
  primary_trap?: string | null;
  dsr?: number | null;
  pbo?: number | null;
  n_units?: { n?: number };
  n_events?: number;
  actual_first?: string | null;
  ci_low?: number | null;
  ci_high?: number | null;
  spec_sha256?: string;
  snapshot_sha256?: string;
  engine_version?: string;
  mechanism?: string;
  findings?: { code: string; severity: string; detail?: Record<string, unknown> }[];
};

function num(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return String(Math.round(value * 1000) / 1000);
}

export function mapVerdict(raw: VerdictJson, hypothesis: string): VerdictReport {
  const verdict = raw.label || "UNTESTABLE";
  const n = raw.n_units?.n;
  const showScores = verdict !== "UNTESTABLE";
  const scoreStatus: EvidenceStatus = raw.dsr === null || raw.dsr === undefined ? "info" : raw.dsr >= 0.95 ? "pass" : "fail";
  const scores: EvidenceRow[] = showScores
    ? [
        { label: "Deflated Sharpe", value: num(raw.dsr), status: scoreStatus },
        { label: "PBO", value: num(raw.pbo), status: "info" },
        { label: "Interval low", value: num(raw.ci_low), status: "info" },
        { label: "Interval high", value: num(raw.ci_high), status: "info" },
      ]
    : [];
  const evidence: EvidenceRow[] = [
    { label: "Verdict", value: verdict, status: verdict === "ALIVE" ? "pass" : verdict === "KILLED" ? "fail" : "warn" },
    { label: "Out-of-sample units", value: n === undefined ? "—" : String(n), status: "info" },
    { label: "Raw events", value: raw.n_events === undefined ? "—" : String(raw.n_events), status: "info" },
    ...scores,
    { label: "First Bitget bar", value: raw.actual_first || "—", status: "info" },
    { label: "Spec hash", value: raw.spec_sha256 ? raw.spec_sha256.slice(0, 16) : "—", status: "info" },
    { label: "Engine", value: raw.engine_version || "—", status: "info" },
    { label: "Mechanism", value: raw.mechanism || "—", status: "info" },
  ];
  const traps: TrapCheckResult[] = (raw.findings || []).map((finding, index) => ({
    id: finding.code || String(index),
    name: finding.code || "finding",
    category: "statistical",
    triggered: true,
    severity: finding.severity === "invalidate" ? "high" : "medium",
    summary: finding.code,
    finding: JSON.stringify(finding.detail || {}),
  }));
  const summary =
    verdict === "UNTESTABLE"
      ? `Not enough independent Bitget history to score this idea. First bar ${raw.actual_first || "unknown"}. Sample ${n ?? "unknown"}.`
      : verdict === "INCONCLUSIVE"
        ? "The interval still covers both a real edge and no edge. That is not a kill and it is not a pass."
      : verdict === "KILLED"
        ? `The frozen kill rule failed${raw.primary_trap ? ` on ${raw.primary_trap}` : ""}.`
        : "The frozen kill rule passed on this sample.";
  return {
    scenarioKey: "earnings-momentum",
    verdict,
    verdictSummary: summary,
    testabilityGates: [
      {
        label: "Independent units",
        value: n === undefined ? "—" : String(n),
        required: "family minimum",
        status: verdict === "UNTESTABLE" ? "warn" : "pass",
      },
    ],
    killFloorResults: [],
    evidence,
    traps,
    baselineComparison: [],
    dataCoverage: {
      overallPct: 0,
      bars: raw.actual_first || "—",
      gaps: [],
      notes: raw.snapshot_sha256 ? [`Snapshot ${raw.snapshot_sha256.slice(0, 16)}`] : [],
    },
    aiInterpretation: {
      paragraphs: [hypothesis, summary],
      disclaimer: "These numbers are the engine output for this run. The assistant does not calculate them.",
    },
    nextSteps: [{ title: "Next test", detail: "Use the ledger to ask for the next falsifiable question." }],
    ledgerSuggestion: { stage: "RESULT", note: summary },
  };
}
