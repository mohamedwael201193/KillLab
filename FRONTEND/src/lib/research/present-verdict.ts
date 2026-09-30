import type { EvidenceRow, VerdictReport } from "./types";

/**
 * Groups the mapped evidence rows for the desk.
 * Values stay the strings mapVerdict already produced.
 */

const WHY = ["Out-of-sample units", "Units required", "Units still needed"] as const;

const CORE = [
  "Verdict",
  "Primary trap",
  "Raw events",
  "Events inside tape",
  "Events outside tape",
  "Detectable edge bps",
  "Deflated Sharpe",
  "PBO",
  "Interval low",
  "Interval high",
] as const;

const COVERAGE = ["Requested start", "Oldest fetched bar", "Fetch stop", "Venue floor"] as const;

const EXPERIMENT = [
  "Spec hash",
  "Snapshot hash",
  "Engine",
  "Mechanism",
  "Prior trials",
  "Related trials",
  "Run origin",
  "Thesis",
] as const;

const HIDDEN_FROM_LEFTOVERS = new Set<string>([
  ...WHY,
  ...CORE,
  ...COVERAGE,
  ...EXPERIMENT,
  "Book record",
  "Next question",
  "Research skill",
  "Context changes the verdict",
]);

const SOURCE_CLASS = new Set(["official_signal_mcp", "authoritative_fallback", "bitget_public_rest"]);
const FAILURE_CLASS = new Set([
  "empty_result",
  "valid_data",
  "timeout",
  "malformed_response",
  "session_error",
  "transport_error",
  "unsupported_action",
  "undated_data",
  "stale_data",
  "tool_error",
]);
const FRESHNESS = new Set(["current", "historical", "stale", "unknown"]);

export type ContextCardModel = {
  title: string;
  summary: string;
  facts: { key: string; value: string }[];
  freshness: string;
  sourceClass: string;
  failureClass: string;
  tool: string;
  url: string;
  retrieved: string;
  dataTime: string;
  hash: string;
  rawMeta: string;
};

export type BookCardModel = {
  provenance: string;
  spread: string | null;
  notional: string | null;
  walk: string | null;
  imbalance: string | null;
  historical: string | null;
  retrieved: string | null;
  raw: string;
  threshold: string;
};

export type VerdictPresentation = {
  observed: string;
  required: string;
  gap: string;
  core: EvidenceRow[];
  coverage: EvidenceRow[];
  experiment: EvidenceRow[];
  book: BookCardModel | null;
  skill: string;
  contextChanges: string;
  nextQuestion: string;
  contexts: ContextCardModel[];
};

function row(report: VerdictReport, label: string): EvidenceRow | undefined {
  return report.evidence.find((item) => item.label === label);
}

function value(report: VerdictReport, label: string, fallback = ""): string {
  return row(report, label)?.value || fallback;
}

function take(report: VerdictReport, labels: readonly string[]): EvidenceRow[] {
  return labels.map((label) => row(report, label)).filter((item): item is EvidenceRow => Boolean(item));
}

function humanTitle(tool: string, url: string, label: string): string {
  const host = url.toLowerCase();
  if (host.includes("federalreserve.gov")) return "Federal Reserve RSS";
  if (host.includes("sofr/last")) return "SOFR history";
  if (host.includes("newyorkfed.org")) return "NY Fed rates";
  if (host.includes("treasury.gov")) return "Treasury curve";
  if (host.includes("coindesk.com")) return "CoinDesk RSS";
  if (host.includes("account-long-short")) return "Long/short ratio";
  if (host.includes("open-interest")) return "Open interest";
  if (host.includes("agent.bitget.com")) return "US-stock quote";
  const names: Record<string, string> = {
    news_feed: "News feed",
    rates_yields: "Rates and yields",
    sentiment_index: "Sentiment index",
    derivatives_sentiment: "Derivatives sentiment",
    do_query: "US-stock quote",
    rsi: "RSI",
    macd: "MACD",
    atr: "ATR",
    ema: "EMA",
    bollinger: "Bollinger",
    ma: "Moving average",
  };
  if (names[tool]) return names[tool];
  return label;
}

function summaryFacts(summary: string): { key: string; value: string }[] {
  const parts = summary.split(";").map((part) => part.trim()).filter(Boolean);
  const facts: { key: string; value: string }[] = [];
  for (const part of parts) {
    const match = part.match(/^([A-Za-z][A-Za-z0-9_ ]{0,40}?)\s+(.+)$/);
    if (!match) return [];
    facts.push({ key: match[1].replaceAll("_", " "), value: match[2] });
  }
  return facts.length >= 2 ? facts.slice(0, 6) : [];
}

export function parseContextRow(item: EvidenceRow): ContextCardModel {
  const parts = (item.threshold || "").split(" · ").map((part) => part.trim()).filter(Boolean);
  const model: ContextCardModel = {
    title: item.label,
    summary: item.value,
    facts: summaryFacts(item.value),
    freshness: "",
    sourceClass: "",
    failureClass: "",
    tool: "",
    url: "",
    retrieved: "",
    dataTime: "",
    hash: "",
    rawMeta: item.threshold || "",
  };
  const unnamed: string[] = [];
  for (const part of parts) {
    if (FRESHNESS.has(part)) model.freshness = part;
    else if (part === "no source time") model.dataTime = part;
    else if (part.startsWith("data ")) model.dataTime = part.slice(5);
    else if (part.startsWith("retrieved ")) model.retrieved = part.slice("retrieved ".length);
    else if (SOURCE_CLASS.has(part)) model.sourceClass = part;
    else if (FAILURE_CLASS.has(part)) model.failureClass = part;
    else if (/^[0-9a-f]{8,16}$/.test(part)) model.hash = part;
    else if (part.includes("/") || part.includes(".com") || part.includes(".gov") || part.includes(".org")) model.url = part;
    else unnamed.push(part);
  }
  model.tool = unnamed[0] || "";
  model.title = humanTitle(model.tool, model.url, item.label);
  return model;
}

export function parseBook(item: EvidenceRow | undefined): BookCardModel | null {
  if (!item || item.value === "—" || item.value === "-") return null;
  const spread = item.value.match(/spread\s+([-\d.]+)\s+bps/);
  const walk = item.value.match(/([-\d.]+)\s+notional walk\s+([-\d.]+)\s+bps/);
  const imbalance = item.value.match(/depth imbalance\s+([-\d.]+)/);
  const retrieved = (item.threshold || "").match(/retrieved\s+(.+?)(?:\s+·|$)/);
  const historical = (item.threshold || "").includes("not a past book")
    ? "no"
    : (item.threshold || "").toLowerCase().includes("historical")
      ? "yes"
      : null;
  return {
    provenance: item.value.startsWith("forward-recorded") ? "forward-recorded" : item.value.split(" · ")[0] || item.value,
    spread: spread?.[1] ?? null,
    notional: walk?.[1] ?? null,
    walk: walk?.[2] ?? null,
    imbalance: imbalance?.[1] ?? null,
    historical,
    retrieved: retrieved?.[1]?.trim() ?? null,
    raw: item.value,
    threshold: item.threshold || "",
  };
}

export function presentVerdict(report: VerdictReport): VerdictPresentation {
  const used = new Set<string>(HIDDEN_FROM_LEFTOVERS);
  const contexts = report.evidence.filter((item) => !used.has(item.label)).map(parseContextRow);
  return {
    observed: value(report, "Out-of-sample units"),
    required: value(report, "Units required"),
    gap: value(report, "Units still needed"),
    core: take(report, CORE),
    coverage: take(report, COVERAGE),
    experiment: take(report, EXPERIMENT),
    book: parseBook(row(report, "Book record")),
    skill: value(report, "Research skill"),
    contextChanges: value(report, "Context changes the verdict"),
    nextQuestion: value(report, "Next question"),
    contexts,
  };
}
