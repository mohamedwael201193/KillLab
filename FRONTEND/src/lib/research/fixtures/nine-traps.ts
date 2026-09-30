import type { TrapDefinition } from "../types";

/**
 * Published failure-mode cards for the landing page.
 * They are not the engine detector registry. The registry is pinned in the backend.
 */
export const NINE_TRAPS: TrapDefinition[] = [
  {
    id: "multiple-testing",
    index: "01",
    name: "Multiple Testing",
    category: "statistical",
    tagline: "Test enough variants and one will shine — by luck.",
    description:
      "Run seven variations of one idea and something will look brilliant. The backtest you fell in love with was selected after the fact, from a set you never see counted. KillLab fixes the variant set at freeze and deflates every result by the full count.",
    detection: "Variant count is fixed at freeze; the Deflated Sharpe Ratio penalizes every comparison.",
  },
  {
    id: "overfitting",
    index: "02",
    name: "Backtest Overfitting",
    category: "statistical",
    tagline: "The spec bends until it fits noise.",
    description:
      "Thresholds, holds and filters get nudged until the curve turns green — tuning to the past. The tell is rank instability: a variant that wins in-sample places below median out-of-sample. KillLab measures that instability directly.",
    detection: "Probability of Backtest Overfitting measured via combinatorially symmetric cross-validation.",
  },
  {
    id: "survivorship",
    index: "03",
    name: "Survivorship Bias",
    category: "data",
    tagline: "The dataset only remembers the winners.",
    description:
      "Testing today's token list on yesterday's market silently excludes everything that died getting you here. The fix is blunt: universes are declared before the test starts, and listing dates are reconstructed honestly.",
    detection: "Universes are declared ex-ante; listings and delistings are reconstructed.",
  },
  {
    id: "look-ahead",
    index: "04",
    name: "Look-Ahead Bias",
    category: "data",
    tagline: "Decisions quietly use information from the future.",
    description:
      "A settlement price used as an entry signal. An earnings timestamp rounded to the friendly side. The backtest answers tomorrow's question with tomorrow's answer. KillLab replays every decision on lagged data only.",
    detection: "Every input is timestamped; decisions replay on lagged data only.",
  },
  {
    id: "cost-blindness",
    index: "05",
    name: "Cost Blindness",
    category: "execution",
    tagline: "Fees, funding and spread quietly eat the edge.",
    description:
      "A 42 bps edge with a 53 bps round trip is a hobby, not a strategy. Backtests forget funding during holds, taker fees on both sides, and spread on size. KillLab charges the full cost model on every fill.",
    detection: "Round-trip costs are charged on every fill, including funding during holds.",
  },
  {
    id: "liquidity",
    index: "06",
    name: "Liquidity Illusion",
    category: "execution",
    tagline: "Fills that would never happen at size.",
    description:
      "The backtest fills 500k at the touch. The book had 4k. Size turns paper edges into real losses the moment position size meets a real order book. KillLab checks modeled size against depth and caps participation.",
    detection: "Order size is checked against book depth and capped at participation limits.",
  },
  {
    id: "regime",
    index: "07",
    name: "Regime Dependence",
    category: "statistical",
    tagline: "An edge that only exists in one market era.",
    description:
      "Momentum that worked in 2023 and quietly died in 2024 still averages out positive across the full window. The aggregate hides the decay. Walk-forward folds are scored individually so concentration gets named.",
    detection: "Walk-forward folds are scored individually; concentration across regimes is flagged.",
  },
  {
    id: "small-sample",
    index: "08",
    name: "Small Sample",
    category: "statistical",
    tagline: "Too few independent events to conclude anything.",
    description:
      "Nine events can produce any Sharpe ratio, including impressive ones. This trap does not distort the number — it deletes the meaning. A minimum event count gates every verdict before statistics are allowed to run.",
    detection: "A minimum event count gates every verdict before statistics run.",
  },
  {
    id: "outlier",
    index: "09",
    name: "Outlier Dependence",
    category: "statistical",
    tagline: "One lucky trade carries the whole result.",
    description:
      "Three trades carry 41% of PnL, and the equity curve looks like a business. Remove them and the story is thin air. KillLab measures PnL concentration and re-scores with top events stress-removed.",
    detection: "PnL concentration is measured; top events are stress-removed and re-scored.",
  },
];
