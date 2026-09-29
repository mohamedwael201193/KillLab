import type { EvidenceRow, EvidenceStatus, TrapCheckResult, Verdict, VerdictReport } from "./types";

type VerdictJson = {
  label?: Verdict;
  primary_trap?: string | null;
  dsr?: number | null;
  pbo?: number | null;
  n_units?: { n?: number };
  n_events?: number;
  units_short?: number;
  required_units?: number;
  pagination_stop?: string | null;
  venue_floor?: boolean;
  requested_start?: string | null;
  mde_bps?: number | null;
  events_in_tape?: number | null;
  events_outside_tape?: number | null;
  actual_first?: string | null;
  ci_low?: number | null;
  ci_high?: number | null;
  spec_sha256?: string;
  snapshot_sha256?: string;
  engine_version?: string;
  mechanism?: string;
  prior_trials?: number;
  related_trials?: number;
  next_question?: string;
  thesis?: string;
  book_capture?: {
    provenance?: string;
    historical?: boolean;
    spread_bps?: number | null;
    bid_depth?: number | null;
    ask_depth?: number | null;
    depth_imbalance?: number | null;
    walk_notional_usd?: number | null;
    walk_round_trip_bps?: number | null;
    payload_sha256?: string;
    ts?: string;
  };
  run_origin?: string;
  research_context?: {
    usable_for_verdict?: boolean;
    routing?: { skill?: string | null; secondary?: string | null; reason?: string };
    items?: {
      source_type?: string;
      source_url?: string;
      tool_name?: string;
      summary?: string;
      data_timestamp?: string | null;
      retrieved_at?: string;
      content_hash?: string;
      symbol?: string | null;
      current_or_historical?: string;
      category?: string;
      failure_reason?: string | null;
    }[];
  };
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
    { label: "Units required", value: raw.required_units === undefined ? "—" : String(raw.required_units), status: "info" },
    { label: "Units still needed", value: raw.units_short === undefined ? "—" : String(raw.units_short), status: "info" },
    { label: "Raw events", value: raw.n_events === undefined ? "—" : String(raw.n_events), status: "info" },
    { label: "Events inside tape", value: raw.events_in_tape === undefined || raw.events_in_tape === null ? "—" : String(raw.events_in_tape), status: "info" },
    { label: "Events outside tape", value: raw.events_outside_tape === undefined || raw.events_outside_tape === null ? "—" : String(raw.events_outside_tape), status: "info" },
    { label: "Detectable edge bps", value: raw.mde_bps === undefined || raw.mde_bps === null ? "—" : num(raw.mde_bps), status: "info" },
    ...scores,
    { label: "Requested start", value: raw.requested_start || "—", status: "info" },
    { label: "Oldest fetched bar", value: raw.actual_first || "—", status: "info" },
    { label: "Fetch stop", value: raw.pagination_stop || "—", status: raw.venue_floor ? "pass" : "warn" },
    { label: "Venue floor", value: raw.venue_floor ? "yes" : "no", status: raw.venue_floor ? "pass" : "warn" },
    { label: "Prior trials", value: raw.prior_trials === undefined ? "—" : String(raw.prior_trials), status: "info" },
    { label: "Related trials", value: raw.related_trials === undefined ? "—" : String(raw.related_trials), status: "info" },
    { label: "Spec hash", value: raw.spec_sha256 ? raw.spec_sha256.slice(0, 16) : "—", status: "info" },
    { label: "Snapshot hash", value: raw.snapshot_sha256 ? raw.snapshot_sha256.slice(0, 16) : "—", status: "info" },
    { label: "Engine", value: raw.engine_version || "—", status: "info" },
    { label: "Mechanism", value: raw.mechanism || "—", status: "info" },
    {
      label: "Book record",
      value:
        raw.book_capture?.provenance === "forward_recorded" && raw.book_capture.historical === false
          ? `forward-recorded${raw.book_capture.spread_bps === undefined || raw.book_capture.spread_bps === null ? "" : ` · spread ${num(raw.book_capture.spread_bps)} bps`}${raw.book_capture.walk_round_trip_bps === undefined || raw.book_capture.walk_round_trip_bps === null ? "" : ` · ${num(raw.book_capture.walk_notional_usd)} notional walk ${num(raw.book_capture.walk_round_trip_bps)} bps`}${raw.book_capture.depth_imbalance === undefined || raw.book_capture.depth_imbalance === null ? "" : ` · depth imbalance ${num(raw.book_capture.depth_imbalance)}`}`
          : "—",
      status: "info",
      threshold: raw.book_capture?.historical === false ? `retrieved ${raw.book_capture.ts || "unknown"} · not a past book` : undefined,
    },
    { label: "Run origin", value: raw.run_origin || "—", status: "info" },
    { label: "Thesis", value: raw.thesis || "—", status: "info" },
    { label: "Next question", value: raw.next_question || "—", status: "info" },
    {
      label: "Research skill",
      value: [raw.research_context?.routing?.skill, raw.research_context?.routing?.secondary].filter((item) => item).join(" + ") || "none",
      status: "info",
    },
    {
      label: "Context changes the verdict",
      value: raw.research_context && raw.research_context.usable_for_verdict === false ? "no" : raw.research_context ? "no" : "—",
      status: "info",
    },
    ...((raw.research_context?.items || []).slice(0, 8).map((item) => ({
      label: item.category || item.source_type || "Context",
      value: item.summary || "—",
      status: "info" as EvidenceStatus,
      threshold: [
        item.current_or_historical,
        item.data_timestamp ? `data ${item.data_timestamp}` : "no source time",
        item.retrieved_at ? `retrieved ${item.retrieved_at}` : "",
        item.source_url ? item.source_url.replace("https://", "") : "",
        item.tool_name,
        item.content_hash ? item.content_hash.slice(0, 12) : "",
      ]
        .filter((part) => part)
        .join(" · "),
    }))),
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
    verdict === "UNTESTABLE" && raw.primary_trap === "book_unusable"
      ? "The current forward book cannot support this execution claim. It is not historical depth."
      : verdict === "UNTESTABLE"
      ? `Not enough independent Bitget history. Observed ${n ?? "unknown"} of ${raw.required_units ?? "the family minimum"}. Oldest fetched bar ${raw.actual_first || "unknown"} (${raw.pagination_stop === "page_cap" ? "page cap, not a venue floor" : raw.pagination_stop === "window_start" ? "frozen window start, not a venue floor" : raw.pagination_stop || "fetch boundary"}).`
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
      notes: [
        raw.pagination_stop === "page_cap" ? "Page cap, not a venue floor" : raw.pagination_stop ? `Fetch stop ${raw.pagination_stop}` : "",
        raw.snapshot_sha256 ? `Snapshot ${raw.snapshot_sha256.slice(0, 16)}` : "",
      ].filter((item) => item.length > 0),
    },
    aiInterpretation: {
      paragraphs: [hypothesis, summary],
      disclaimer: "These numbers are the engine output for this run. The assistant does not calculate them.",
    },
    nextSteps: [{ title: "Next test", detail: "Use the ledger to ask for the next falsifiable question." }],
    ledgerSuggestion: { stage: "RESULT", note: summary },
  };
}
