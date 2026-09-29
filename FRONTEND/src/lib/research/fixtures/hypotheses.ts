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
    text: "Hold BTC perp funding against cash.",
    note: "Carry family. One continuous funding hold is the unit.",
  },
  {
    scenarioKey: "session-open",
    chip: "Cash open",
    text: "Trade NVDA in the first hour of the cash session.",
    note: "Session family. Hour 9 Eastern versus the other cash hours.",
  },
  {
    scenarioKey: "cash-close",
    chip: "Cash close",
    text: "Trade NVDA in the last cash hour.",
    note: "Session family. Hour 15 Eastern versus the other cash hours.",
  },
  {
    scenarioKey: "weekend-choice",
    chip: "Weekend choice",
    text: "Trade NVDA over the weekend instead of waiting for StockRoute.",
    note: "Execution family. Now versus wait, same exit.",
  },
  {
    scenarioKey: "basis-fade",
    chip: "Basis fade",
    text: "Fade the NVDA perp versus spot basis.",
    note: "Basis family. One calendar day is the unit.",
  },
  {
    scenarioKey: "prior-hour-lead",
    chip: "Prior-hour lead",
    text: "The BTC hour before the open leads NVDA's first cash hour.",
    note: "One weekday is the unit. BTC is the signal, not the trade. No result is assumed.",
  },
  {
    scenarioKey: "fed-backdrop",
    chip: "Fed backdrop",
    text: "Does the Fed funds backdrop change NVDA's first cash hour?",
    note: "Session family. Macro context is attached after freeze and cannot change the verdict.",
  },
  {
    scenarioKey: "crowd-positioning",
    chip: "Crowd positioning",
    text: "Is BTC crowd positioning one-sided while funding is harvested against cash?",
    note: "Carry family. Positioning context is a current observation, not a 60-unit history.",
  },
  {
    scenarioKey: "fed-release",
    chip: "Fed release",
    text: "Did a Fed release coincide with NVDA after earnings?",
    note: "Earnings family. News context is attached after freeze. No article is invented.",
  },
  {
    scenarioKey: "positioning-proxy",
    chip: "Positioning proxy",
    text: "Is NVDA basis fading while ETF headlines mention flows?",
    note: "Basis family. Direct ETF flow is not available. Positioning and public headlines are the proxy.",
  },
  {
    scenarioKey: "curve-inversion",
    chip: "Curve inversion",
    text: "Does NVDA's first cash hour differ when the Treasury 10-year minus 2-year is inverted?",
    note: "Regime family. The inversion rule is frozen. Too few inverted days stay UNTESTABLE.",
  },
  {
    scenarioKey: "range-rotation",
    chip: "Outside the tape",
    text: "When BTC breaks its 20-day range, rotate into majors' alts perps within 48 hours.",
    note: "This wording is outside the scored families.",
  },
];
