import { EXAMPLE_HYPOTHESES } from "./fixtures/hypotheses";
import { NINE_TRAPS } from "./fixtures/nine-traps";
import type { ExampleHypothesis, TrapDefinition } from "./types";

/** Prompt chips and trap explanations. Run numbers come from the API. */
export const researchData = {
  listExampleHypotheses(): ExampleHypothesis[] {
    return EXAMPLE_HYPOTHESES;
  },
  listTraps(): TrapDefinition[] {
    return NINE_TRAPS;
  },
};
