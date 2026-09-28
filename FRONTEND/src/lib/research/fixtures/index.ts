import { earningsMomentum } from "./earnings-momentum";
import { fundingCarry } from "./funding-carry";
import { rangeRotation } from "./range-rotation";
import { NINE_TRAPS } from "./nine-traps";
import { EXAMPLE_HYPOTHESES } from "./hypotheses";
import { LEDGER_ENTRIES } from "./ledger";
import type { ScenarioFixture, ScenarioKey } from "../types";

/**
 * All research fixtures for this simulation.
 * Consumers import from the data-source seam, never from here directly.
 */
export const SCENARIOS: Record<ScenarioKey, ScenarioFixture> = {
  "earnings-momentum": earningsMomentum,
  "funding-carry": fundingCarry,
  "range-rotation": rangeRotation,
};

export { NINE_TRAPS, EXAMPLE_HYPOTHESES, LEDGER_ENTRIES };
