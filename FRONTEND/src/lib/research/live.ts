export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

export async function killlab(method: string, path: string, body?: unknown, idempotencyKey?: string) {
  const response = await fetch(`/api/killlab${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, data?.error?.code || `http_${response.status}`);
  }
  return data;
}

const NAMES = ["NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "COIN", "MSTR", "SPY", "QQQ"];

export function draftSpec(text: string) {
  const upper = text.toUpperCase();
  const instruments = NAMES.filter((name) => upper.includes(name)).map((name) => `${name}USDT`);
  if (instruments.length === 0) instruments.push("NVDAUSDT");
  const family = /earn|after[- ]hours|print/i.test(text)
    ? "event_earnings"
    : /fund|carry|basis/i.test(text)
      ? "carry_basis"
      : /weekend|wait|stockroute|sunday/i.test(text)
        ? "execution_venue_time"
        : "session_timing";
  return {
    family,
    instruments,
    venue: "bitget_perp",
    test_start: "2026-07-01",
    test_end: "2026-09-28",
    grain: "1H",
    costs: { perp_taker_bps: 6 },
    baselines: ["buy_and_hold"],
    variants: [{ code: "continuation" }, { code: "reversal" }],
    selection: { split: "IS" },
    target_metric: "oos_mean_bps",
    notional_usd: 10000,
    seed: 1,
    transforms: [],
    risk: family === "execution_venue_time" ? { sigma_span: "until_sunday_switch", horizon_span: "until_sunday_switch", alternatives: ["NOW", "WAIT"], lambda_grid: [0.5] } : {},
    claims_alpha: false,
    event_kind: "none",
  };
}
