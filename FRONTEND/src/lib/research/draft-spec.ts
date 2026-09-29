const NAMES = ["NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "COIN", "MSTR", "SPY", "QQQ", "BTC", "ETH"];

const VARIANTS: Record<string, { code: string }[]> = {
  session_timing: [{ code: "continuation" }, { code: "reversal" }],
  event_earnings: [{ code: "continuation" }, { code: "reversal" }],
  carry_basis: [{ code: "receive" }],
  basis_convergence: [{ code: "fade" }],
  execution_venue_time: [{ code: "NOW" }, { code: "WAIT" }],
  lead_lag: [{ code: "follow" }, { code: "fade" }],
};

export const COMPILED_KEYS = [
  "family",
  "instruments",
  "venue",
  "test_start",
  "test_end",
  "grain",
  "costs",
  "baselines",
  "variants",
  "selection",
  "target_metric",
  "notional_usd",
  "seed",
  "transforms",
  "risk",
  "claims_alpha",
  "event_kind",
  "session_hour",
  "leader",
] as const;

export function familyFromText(text: string): string {
  if (/\bleads?\b|\blags?\b/i.test(text)) return "lead_lag";
  if (/weekend|stockroute/i.test(text)) return "execution_venue_time";
  if (/earn|after[- ]hours/i.test(text)) return "event_earnings";
  if (/fund|carry/i.test(text)) return "carry_basis";
  if (/basis|converge|perp versus spot|perp vs spot/i.test(text)) return "basis_convergence";
  if (/cash close|closing hour|last cash hour|session|first hour|cash open|ny open|new york open/i.test(text)) return "session_timing";
  return "unsupported";
}

function cashClose(text: string): boolean {
  return /cash close|closing hour|last cash hour/i.test(text);
}

function cashOpen(text: string): boolean {
  return /first hour|cash open|ny open|new york open/i.test(text);
}

export type DraftSpec = {
  family: string;
  instruments: string[];
  venue: string;
  test_start: string;
  test_end: string;
  grain: string;
  costs: { perp_taker_bps: number };
  baselines: string[];
  variants: { code: string }[];
  selection: { split: string };
  target_metric: string;
  notional_usd: number;
  seed: number;
  transforms: unknown[];
  risk: Record<string, unknown>;
  claims_alpha: boolean;
  event_kind: string;
  session_hour?: number;
  leader?: string;
};

export function draftSpec(text: string): DraftSpec {
  const family = familyFromText(text);
  const upper = text.toUpperCase();
  const named = NAMES.filter((name) => upper.includes(name)).map((name) => `${name}USDT`);
  const coins = ["BTC", "ETH"].filter((name) => upper.includes(name));
  const equities = NAMES.filter((name) => name !== "BTC" && name !== "ETH" && upper.includes(name));
  const spec: DraftSpec = {
    family,
    instruments:
      family === "basis_convergence"
        ? ["NVDAUSDT", "RNVDAUSDT"]
        : family === "lead_lag"
          ? [`${equities[0] || "NVDA"}USDT`]
          : named.length
            ? named
            : ["NVDAUSDT"],
    venue: "bitget_perp",
    test_start: "2026-05-18",
    test_end: "2026-09-28",
    grain: "1H",
    costs: { perp_taker_bps: 6 },
    baselines: family === "carry_basis" ? ["earn_usdt", "btc_eth_carry"] : ["buy_and_hold"],
    variants: VARIANTS[family] || [{ code: "none" }],
    selection: { split: "IS" },
    target_metric: "oos_mean_bps",
    notional_usd: 10000,
    seed: 1,
    transforms: [],
    risk:
      family === "execution_venue_time"
        ? { sigma_span: "until_sunday_switch", horizon_span: "until_sunday_switch", alternatives: ["NOW", "WAIT"], lambda_grid: [0.5], book_max_spread_bps: 50 }
        : {},
    claims_alpha: false,
    event_kind: "none",
  };
  if (family === "session_timing" && cashClose(text) && !cashOpen(text)) spec.session_hour = 15;
  if (family === "lead_lag") spec.leader = `${coins[0] || "BTC"}USDT`;
  return spec;
}

export function mergeCompiledDraft(local: DraftSpec, compiled: Record<string, unknown> | null | undefined, text: string): DraftSpec {
  const merged: DraftSpec = { ...local };
  if (compiled && typeof compiled.family === "string" && Array.isArray(compiled.instruments)) {
    for (const key of COMPILED_KEYS) {
      if (compiled[key] !== undefined) (merged as Record<string, unknown>)[key] = compiled[key];
    }
  }
  if (/weekend|stockroute/i.test(text) && merged.family !== "execution_venue_time") {
    merged.family = "execution_venue_time";
    merged.variants = [{ code: "NOW" }, { code: "WAIT" }];
    merged.risk = {
      sigma_span: "until_sunday_switch",
      horizon_span: "until_sunday_switch",
      alternatives: ["NOW", "WAIT"],
      lambda_grid: [0.5],
      book_max_spread_bps: 50,
    };
  }
  return merged;
}
