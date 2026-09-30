"use client";

import * as React from "react";
import { create } from "zustand";
import { draftSpec, killlab, mergeCompiledDraft } from "@/lib/research/live";
import { mapVerdict, scenarioKeyForFamily } from "@/lib/research/map-verdict";
import { runStatusLine } from "@/lib/desk/run-status";
import type { ScenarioFixture } from "@/lib/research/types";
import type {
  LedgerEntry,
  RunStageDef,
  ScenarioKey,
  VerdictReport,
} from "@/lib/research/types";

/**
 * The research desk state machine.
 *
 * draft → review → frozen → running → verdict
 * (with ledger view switchable anytime).
 *
 * The store never touches fixture modules directly — it goes through
 * the data-source seam so a real API can replace it later.
 */

export type DeskScreen =
  | { kind: "write" }
  | { kind: "review" }
  | { kind: "freeze"; holdMs: number }
  | { kind: "run" }
  | { kind: "verdict" };

export type DeskTab = "research" | "ledger";

export interface RunProgressState {
  stageIndex: number;
  stageStartedAt: number;
  completedKeys: string[];
  visibleLogs: string[];
}

interface DeskState {
  tab: DeskTab;
  screen: DeskScreen;
  hypothesisText: string;
  scenarioKey: ScenarioKey | null;
  report: VerdictReport | null;
  runProgram: RunStageDef[];
  runProgress: RunProgressState | null;
  ledger: LedgerEntry[];
  liveScenario: ScenarioFixture | null;
  hypothesisId: string | null;
  runId: string | null;
  error: string | null;
  specDraft: ReturnType<typeof draftSpec> | null;
  specId: string | null;
  specHash: string | null;
  nextProposal: string | null;
  reviewNote: string | null;
  busy: boolean;
  /** Fields set once per lab session. */
  setTab: (tab: DeskTab) => void;
  writeHypothesis: (text: string) => void;
  thesisText: string;
  submitHypothesis: (text: string, thesis?: string) => void;
  goReview: () => void;
  goWrite: () => void;
  updateWindow: (start: string, end: string) => void;
  prepareFreeze: () => Promise<void>;
  startFreeze: () => void;
  submitFills: (buyPx: string, sellPx: string) => Promise<void>;
  updateFreezeHold: (holdMs: number) => void;
  cancelFreeze: () => void;
  completeFreeze: () => void;
  startRun: () => void;
  tickRun: (stageIndex: number, logs: string[]) => void;
  finishRun: () => void;
  resetDesk: () => void;
  advanceLedger: () => void;
}

const initial = {
  tab: "research" as DeskTab,
  screen: { kind: "write" } as DeskScreen,
  hypothesisText: "",
  thesisText: "",
  scenarioKey: null as ScenarioKey | null,
  report: null as VerdictReport | null,
  runProgram: [] as RunStageDef[],
  runProgress: null as RunProgressState | null,
  ledger: [] as LedgerEntry[],
  liveScenario: null as ScenarioFixture | null,
  hypothesisId: null as string | null,
  runId: null as string | null,
  error: null as string | null,
  specDraft: null,
  specId: null as string | null,
  specHash: null as string | null,
  nextProposal: null as string | null,
  reviewNote: null as string | null,
  busy: false,
};

let finishing = false;

export const useDesk = create<DeskState>((set, get) => ({
  ...initial,

  setTab: (tab) => set({ tab }),

  writeHypothesis: (text) => set({ hypothesisText: text }),

  submitHypothesis: async (text, thesis) => {
    const thesisText = (thesis || "").trim();
    set({ error: null, hypothesisText: text, thesisText });
    try {
      const created = await killlab("POST", "/v1/hypotheses", { raw_text: text, thesis: thesisText || null });
      const local = draftSpec(text);
      let spec = local;
      try {
        const compiled = await killlab("POST", `/v1/hypotheses/${created.id}/compile`);
        spec = mergeCompiledDraft(local, compiled.draft, text);
      } catch {
        spec = local;
      }
      set({
        hypothesisId: created.id,
        specDraft: spec,
        specId: null,
        specHash: null,
        liveScenario: scenarioFrom(text, spec, null),
        scenarioKey: scenarioKeyForFamily(spec.family, spec.session_hour),
        screen: { kind: "review" },
        report: null,
        runProgress: null,
        runId: null,
        nextProposal: null,
        reviewNote: null,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "request_failed", screen: { kind: "write" } });
    }
  },

  goReview: () => set({ screen: { kind: "review" } }),

  goWrite: () => set({ screen: { kind: "write" }, error: null }),

  updateWindow: (start, end) => {
    const draft = get().specDraft;
    const text = get().hypothesisText;
    if (!draft) return;
    const next = { ...draft, test_start: start, test_end: end };
    set({ specDraft: next, specHash: null, liveScenario: scenarioFrom(text, next, null) });
  },

  prepareFreeze: async () => {
    const { hypothesisId, specDraft, specId, hypothesisText } = get();
    if (!hypothesisId || !specDraft || get().busy) return;
    set({ busy: true, error: null });
    try {
      const saved = specId
        ? await killlab("PUT", `/v1/test-specs/${specId}`, specDraft)
        : await killlab("POST", `/v1/hypotheses/${hypothesisId}/specs`, specDraft);
      const id = specId || saved.test_spec_id;
      const hash = saved.content_sha256 as string;
      set({
        specId: id,
        specHash: hash,
        liveScenario: scenarioFrom(hypothesisText, specDraft, hash),
        screen: { kind: "freeze", holdMs: 0 },
        busy: false,
      });
    } catch (err) {
      set({ busy: false, error: err instanceof Error ? err.message : "request_failed" });
    }
  },

  startFreeze: () => {
    void get().prepareFreeze();
  },

  updateFreezeHold: (holdMs) => {
    if (get().screen.kind === "freeze") set({ screen: { kind: "freeze", holdMs } });
  },

  cancelFreeze: () => set({ screen: { kind: "review" } }),

  completeFreeze: async () => {
    const { specId, specHash } = get();
    if (!specId || !specHash || get().busy || get().runId) return;
    set({
      busy: true,
      screen: { kind: "run" },
      error: null,
      runProgram: [
        {
          key: "engine",
          label: "Engine",
          detail: "Status comes from the run endpoint",
          durationMs: 0,
          logLines: [],
        },
      ],
      runProgress: { stageIndex: 0, stageStartedAt: Date.now(), completedKeys: [], visibleLogs: ["Spec is frozen"] },
    });
    try {
      const frozen = await killlab(
        "POST",
        `/v1/test-specs/${specId}/freeze`,
        { confirm: "FREEZE", expected_sha256: specHash },
        crypto.randomUUID(),
      );
      const run = await killlab("POST", "/v1/runs", { preregistration_id: frozen.preregistration_id }, crypto.randomUUID());
      set({ runId: run.test_run_id, busy: false });
      if (run.status === "failed") {
        const status = await killlab("GET", `/v1/runs/${run.test_run_id}`);
        set({ error: status.error_code || "run_failed" });
      }
    } catch (err) {
      set({ busy: false, error: err instanceof Error ? err.message : "request_failed", screen: { kind: "freeze", holdMs: 0 } });
    }
  },

  startRun: () => {
    set({ screen: { kind: "run" } });
  },

  tickRun: (stageIndex, logs) => {
    const progress = get().runProgress;
    if (!progress) return;
    set({
      runProgress: {
        ...progress,
        stageIndex,
        visibleLogs: logs,
        completedKeys:
          stageIndex > 0
            ? get().runProgram.slice(0, stageIndex).map((s) => s.key)
            : [],
      },
    });
  },

  finishRun: async () => {
    if (get().report || finishing) return;
    finishing = true;
    let runId = get().runId;
    for (let i = 0; i < 90 && !runId && !get().error; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      runId = get().runId;
    }
    if (!runId) {
      finishing = false;
      set({ error: get().error || "run_not_started" });
      return;
    }
    const hypothesisText = get().hypothesisText;
    const note = (line: string) => {
      const progress = get().runProgress;
      if (!progress || progress.visibleLogs.includes(line)) return;
      set({ runProgress: { ...progress, visibleLogs: [...progress.visibleLogs, line].slice(-6) } });
    };
    try {
      let status = await killlab("GET", `/v1/runs/${runId}`);
      note(runStatusLine(status.status));
      for (let i = 0; i < 40 && (status.status === "running" || status.status === "queued"); i++) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        status = await killlab("GET", `/v1/runs/${runId}`);
        note(runStatusLine(status.status));
      }
      if (status.status === "failed") {
        finishing = false;
        set({ error: status.error_code || "run_failed" });
        return;
      }
      const verdict = await killlab("GET", `/v1/runs/${runId}/verdict`);
      const results = await killlab("GET", `/v1/runs/${runId}/results`);
      const traps = await killlab("GET", `/v1/runs/${runId}/traps`);
      const evidence = await killlab("GET", `/v1/runs/${runId}/evidence`);
      const report = mapVerdict(
        { ...verdict, ...results, findings: traps.findings, snapshot_sha256: evidence.snapshot_sha256, engine_version: results.engine_version || evidence.engine_version },
        hypothesisText,
      );
      const engine = results.engine_version || evidence.engine_version;
      const live = get().liveScenario;
      set({
        report,
        screen: { kind: "verdict" },
        liveScenario: live
          ? { ...live, frozen: { ...live.frozen, engineVersion: engine || live.frozen.engineVersion } }
          : live,
      });
      await refreshLedger(set, get);
      finishing = false;
    } catch (err) {
      finishing = false;
      set({ error: err instanceof Error ? err.message : "request_failed" });
    }
  },

  resetDesk: () => {
    set({
      ...initial,
      screen: { kind: "write" },
      hypothesisText: "",
    });
  },

  advanceLedger: async () => {
    const decision = get().ledger.find((entry) => entry.stage === "DECISION") || get().ledger[0];
    if (!decision) return;
    try {
      const proposal = await killlab("POST", `/v1/ledger/${decision.id}/next`);
      set({
        nextProposal: proposal.proposed_raw_text || "",
        ledger: get().ledger.map((entry) =>
          entry.id === decision.id
            ? {
                ...entry,
                decision: {
                  summary: proposal.proposed_raw_text || "",
                  rationale: "The next question is text only. It is not stored and it has no metrics.",
                  nextTest: proposal.proposed_raw_text || "",
                },
              }
            : entry,
        ),
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "request_failed" });
    }
  },

  submitFills: async (buyPx, sellPx) => {
    const { hypothesisId, runId } = get();
    if (!hypothesisId || !runId) return;
    set({ reviewNote: null, error: null });
    try {
      const saved = await killlab("POST", `/v1/hypotheses/${hypothesisId}/fills`, {
        source: "pasted",
        fills: [
          { side: "buy", px: Number(buyPx) },
          { side: "sell", px: Number(sellPx) },
        ],
      });
      const review = await killlab("POST", `/v1/runs/${runId}/reconcile`, { fill_ids: [saved.id] });
      set({ reviewNote: JSON.stringify(review) });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "request_failed", reviewNote: null });
    }
  },
}));

async function refreshLedger(
  set: (partial: Partial<DeskState>) => void,
  get: () => DeskState,
) {
  const hypothesisId = get().hypothesisId;
  const hypothesisText = get().hypothesisText;
  const report = get().report;
  if (!hypothesisId) return;
  const ledger = await killlab("GET", `/v1/ledger?hypothesis_id=${hypothesisId}`);
  const entries = (ledger.entries || []) as { id: string; stage: LedgerEntry["stage"]; created_at?: string; body: { raw_text?: string; label?: string; primary_trap?: string } }[];
  if (entries.length === 0) return;
  const latest = entries[entries.length - 1];
  const decision = [...entries].reverse().find((entry) => entry.stage === "DECISION");
  const family = get().specDraft?.family || "";
  set({
    ledger: [
      {
        id: decision?.id || latest.id,
        scenarioKey: scenarioKeyForFamily(family, get().specDraft?.session_hour),
        hypothesisText,
        family: get().specDraft?.family || "",
        instruments: get().specDraft?.instruments || [],
        stage: latest.stage,
        marks: entries.map((entry) => ({
          stage: entry.stage,
          at: entry.created_at || "unknown",
          note: entry.body?.label || entry.body?.primary_trap || entry.body?.raw_text || (entry.body && "kill_floor" in entry.body ? "Kill floor recorded at freeze" : entry.stage),
        })),
        verdict: (decision?.body?.label || latest.body?.label) as LedgerEntry["verdict"],
        keyNumbers: (report?.evidence || [])
          .filter((row) => row.value !== "—")
          .slice(0, 6)
          .map((row) => ({ label: row.label, value: row.value })),
      },
    ],
  });
}

export function useActiveScenario() {
  return useDesk((s) => s.liveScenario);
}

function familyDetail(family: string, sessionHour: number | undefined, leader?: string): string {
  if (family === "session_timing" && sessionHour === 15) {
    return "Cash close. Hour 15 Eastern versus the other cash hours that day. Data stays unloaded until freeze.";
  }
  if (family === "session_timing") {
    return "Cash open. Hour 9 Eastern versus the other cash hours that day. Data stays unloaded until freeze.";
  }
  if (family === "event_earnings") return "Earnings impulse, then the hold. Data stays unloaded until freeze.";
  if (family === "carry_basis") return "One continuous funding hold versus cash. Data stays unloaded until freeze.";
  if (family === "basis_convergence") return "One calendar day of perp-versus-spot basis fade. Data stays unloaded until freeze.";
  if (family === "execution_venue_time") return "Weekend now versus wait, marked to the same exit. Data stays unloaded until freeze.";
  if (family === "lead_lag") return `The hour before the cash open signs that open hour. ${leader || "The leader"} is not traded. Data stays unloaded until freeze.`;
  if (family === "macro_regime") return "Cash-hour unit, only on days the frozen 10-year minus 2-year print is inverted. Missing dates are dropped. Data stays unloaded until freeze.";
  return "This wording is outside the scored families. Data stays unloaded until freeze.";
}

function scenarioFrom(text: string, spec: ReturnType<typeof draftSpec>, hash: string | null): ScenarioFixture {
  const now = new Date().toISOString();
  const researchSpec = {
    id: "live",
    scenarioKey: scenarioKeyForFamily(spec.family, spec.session_hour),
    hypothesisText: text,
    family: spec.family,
    familyDetail: familyDetail(spec.family, spec.session_hour, spec.leader),
    instruments: spec.instruments.map((symbol) => ({
      symbol,
      kind: symbol.toUpperCase().startsWith("R") ? ("spot" as const) : ("perp" as const),
      venue: "Bitget",
    })),
    testingWindow: { from: spec.test_start, to: spec.test_end, label: "Bitget tape" },
    variants: spec.variants.map((variant) => ({
      id: variant.code,
      label: variant.code,
      entry: "frozen rule",
      exit: "frozen rule",
      sizing: "notional",
    })),
    baselines: spec.baselines.map((baseline) => ({ id: baseline, label: baseline, description: "Required comparison" })),
    killFloor: [{ id: "floor", label: "Kill floor", rule: "DSR, sample size, and the frozen baselines" }],
    dataRequirements: [{ id: "bitget", label: "Bitget public candles", detail: "Fetched only after freeze" }],
    aiNote: "This draft is the test. The engine has not seen the tape yet.",
    draftedAt: now,
  };
  return {
    spec: researchSpec,
    frozen: { ...researchSpec, freezeHash: hash || "computed when you open freeze", frozenAt: now, engineVersion: "assigned at run", datasetVersion: "Bitget public REST after freeze" },
    runStages: [],
    report: {
      scenarioKey: scenarioKeyForFamily(spec.family, spec.session_hour),
      verdict: "UNTESTABLE",
      verdictSummary: "Waiting for the engine.",
      testabilityGates: [],
      killFloorResults: [],
      evidence: [],
      traps: [],
      baselineComparison: [],
      dataCoverage: { overallPct: 0, bars: "—", gaps: [], notes: ["No run yet"] },
      aiInterpretation: { paragraphs: [], disclaimer: "" },
      nextSteps: [],
      ledgerSuggestion: { stage: "RESULT", note: "" },
    },
  };
}
