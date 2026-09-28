import type { ExampleHypothesis } from "../types";

/**
 * Example hypotheses offered in the writing view.
 * Each maps to a fully-specified research scenario in this simulation.
 */
export const EXAMPLE_HYPOTHESES: ExampleHypothesis[] = [
  {
    scenarioKey: "earnings-momentum",
    chip: "Earnings momentum",
    text: "Trade NVDA and TSLA perps after earnings in the direction of the after-hours move.",
    note: "Earnings family. The engine decides after freeze.",
  },
  {
    scenarioKey: "funding-carry",
    chip: "Funding carry",
    text: "Short BTC and ETH perps when funding exceeds +0.10% and hold for 48 hours.",
    note: "Carry family. No result is assumed.",
  },
  {
    scenarioKey: "range-rotation",
    chip: "Range rotation",
    text: "When BTC breaks its 20-day range, rotate into majors' alts perps within 48 hours.",
    note: "May fall outside the four supported families.",
  },
];
