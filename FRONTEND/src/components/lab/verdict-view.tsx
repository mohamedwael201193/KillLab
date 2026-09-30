"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, RotateCcw } from "lucide-react";
import { useDesk, useActiveScenario } from "@/lib/desk/store";
import { Mono } from "@/components/kl/atoms";
import { EquityChart, BootstrapChart, FoldChart } from "@/components/lab/charts";
import { Button } from "@/components/ui/button";
import { presentVerdict } from "@/lib/research/present-verdict";
import { killlab } from "@/lib/research/live";
import {
  AssistantCard,
  DeskSection,
  EvidenceGroups,
  MarketEvidence,
  NextTestCard,
  ResearchContext,
  TradeReview,
  VerdictHero,
  WhyCard,
} from "@/components/lab/verdict-panels";

/**
 * VERDICT — readable research card over the mapped engine report.
 * Grouping is presentational. Numbers stay the mapped strings.
 */
export function VerdictView() {
  const scenario = useActiveScenario();
  const report = useDesk((s) => s.report);
  const resetDesk = useDesk((s) => s.resetDesk);
  const setTab = useDesk((s) => s.setTab);
  const submitFills = useDesk((s) => s.submitFills);
  const reviewNote = useDesk((s) => s.reviewNote);
  const error = useDesk((s) => s.error);
  const [buyPx, setBuyPx] = React.useState("");
  const [sellPx, setSellPx] = React.useState("");
  const reduce = useReducedMotion();
  const runId = useDesk((s) => s.runId);
  const nextProposal = useDesk((s) => s.nextProposal);
  const nextReasons = useDesk((s) => s.nextReasons);
  const shiftPosture = useDesk((s) => s.shiftPosture);
  const [tried, setTried] = React.useState<{ relation: string; label?: string; primary_trap?: string; n_units?: number; created_at?: string }[]>([]);
  const [forwardNote, setForwardNote] = React.useState<string>("");

  React.useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    killlab("GET", `/v1/runs/${runId}/tried`)
      .then((data) => {
        if (!cancelled) setTried(data.runs || []);
      })
      .catch(() => {
        if (!cancelled) setTried([]);
      });
    killlab("GET", "/v1/forward/recent")
      .then((data) => {
        if (cancelled) return;
        const entries = data.entries || [];
        const auto = entries.find((entry: { stage?: string }) => entry.stage === "AUTO_RUN");
        const check = entries.find((entry: { stage?: string }) => entry.stage === "FORWARD_CHECK");
        const parts: string[] = [];
        if (auto) parts.push(`Automatic re-run ${auto.label || ""} ${auto.created_at || ""}`.trim());
        if (check) parts.push(`Forward check ${check.window || ""} ${check.n_units ?? "—"} units, still short ${check.units_short ?? ""}`.trim());
        setForwardNote(parts.join(" · "));
      })
      .catch(() => {
        if (!cancelled) setForwardNote("");
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  async function downloadReceipt() {
    if (!runId) return;
    const receipt = await killlab("GET", `/v1/runs/${runId}/receipt`);
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `killlab-receipt-${runId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!scenario || !report) return null;
  const view = presentVerdict(report);
  const question = report.aiInterpretation.paragraphs[0] || scenario.spec.hypothesisText;
  const lead = firstSentence(report.verdictSummary);
  const rest = report.verdictSummary.slice(lead.length).trim();
  const whyBody = [
    rest,
    report.verdict === "UNTESTABLE" ? "Scores are withheld because the sample cannot carry them." : "",
    report.verdict !== "UNTESTABLE" && !rest ? "The kill floor was fixed at freeze. The engine evaluated every criterion on walk-forward, deflated, cost-charged numbers." : "",
  ].filter(Boolean).join(" ");
  const nextQuestion = view.nextQuestion && view.nextQuestion !== "—"
    ? view.nextQuestion
    : report.nextSteps[0]?.detail || "Use the ledger to ask for the next falsifiable question.";
  const engine = view.experiment.find((item) => item.label === "Engine")?.value || scenario.frozen.engineVersion;
  const mechanism = view.experiment.find((item) => item.label === "Mechanism")?.value || "";
  const origin = view.experiment.find((item) => item.label === "Run origin")?.value || "";

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <VerdictHero
        verdict={report.verdict}
        summary={lead}
        observed={view.observed}
        required={view.required}
        engine={engine}
        mechanism={mechanism}
        origin={origin}
        hash={scenario.frozen.freezeHash}
      />

      <DeskSection title="Why this result?" delay={0.08}>
        <WhyCard report={report} view={view} body={whyBody || report.verdictSummary} />
      </DeskSection>

      <DeskSection title="Evidence" delay={0.14}>
        <EvidenceGroups view={view} />
      </DeskSection>

      {view.book ? (
        <DeskSection title="Market evidence" delay={0.18}>
          <MarketEvidence book={view.book} />
        </DeskSection>
      ) : null}

      {report.equityCurves && report.folds ? (
        <DeskSection title="Walk-forward" delay={0.2}>
          <div className="rounded-2xl border border-hairline bg-panel/80 p-5 sm:p-6">
            <p className="mb-4 text-sm text-muted-foreground">Cumulative return, same test</p>
            <EquityChart curves={report.equityCurves} />
          </div>
          <div className="mt-4 rounded-2xl border border-hairline bg-panel/80 p-5 sm:p-6">
            <p className="mb-4 text-sm text-muted-foreground">Walk-forward Sharpe by fold</p>
            <FoldChart folds={report.folds} />
          </div>
        </DeskSection>
      ) : null}

      {report.bootstrap ? (
        <DeskSection title="Bootstrap" delay={0.22}>
          <div className="rounded-2xl border border-hairline bg-panel/80 p-5 sm:p-6">
            <Mono className={report.bootstrap.ciLow <= 0 ? "text-verdict-killed" : "text-verdict-alive"}>
              90% CI {report.bootstrap.ciLow > 0 ? "+" : ""}{report.bootstrap.ciLow} to {report.bootstrap.ciHigh}
            </Mono>
            <div className="mt-4">
              <BootstrapChart bootstrap={report.bootstrap} />
            </div>
          </div>
        </DeskSection>
      ) : null}

      <DeskSection title={`Traps, ${report.traps.filter((trap) => trap.triggered).length} named by the engine`} delay={0.24}>
        <TrapList reportTraps={report.traps} />
      </DeskSection>

      {report.baselineComparison.length > 0 ? (
        <DeskSection title="Baselines" delay={0.26}>
          <div className="overflow-x-auto rounded-2xl border border-hairline">
            <table className="w-full min-w-[420px] text-left">
              <thead>
                <tr className="border-b border-hairline">
                  <th scope="col" className="px-4 py-3 text-sm font-medium text-muted-foreground">Baseline</th>
                  <th scope="col" className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Sharpe</th>
                  <th scope="col" className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Return</th>
                  <th scope="col" className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Max DD</th>
                </tr>
              </thead>
              <tbody>
                {report.baselineComparison.map((row) => (
                  <tr key={row.label} className="border-t border-hairline/70">
                    <th scope="row" className="px-4 py-3 text-base font-medium text-foreground">{row.label}</th>
                    <td className="px-4 py-3 text-right font-mono text-base">{row.sharpe.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono text-base">{row.netReturnPct.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-right font-mono text-base text-muted-foreground">{row.maxDrawdownPct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DeskSection>
      ) : null}

      {view.contexts.length > 0 || view.skill ? (
        <DeskSection title="Research context" delay={0.28}>
          <ResearchContext view={view} />
        </DeskSection>
      ) : null}

      <DeskSection title="Assistant" delay={0.32}>
        <AssistantCard report={report} question={question} />
      </DeskSection>

      <DeskSection title="Next" delay={0.36}>
        <NextTestCard
          question={nextProposal || nextQuestion}
          reasons={nextReasons.length > 0 ? nextReasons : view.reasons}
          onLedger={() => setTab("ledger")}
          onPosture={(posture) => void shiftPosture(posture)}
        />
        <section className="rounded-2xl border border-hairline bg-panel/50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-medium text-foreground">Already tried</h3>
            <button type="button" onClick={() => void downloadReceipt()} className="font-mono text-[11px] uppercase tracking-[0.14em] text-ice">
              Download receipt
            </button>
          </div>
          {tried.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No earlier run shares this fingerprint.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {tried.map((item) => (
                <li key={`${item.created_at}-${item.label}`} className="font-mono text-[12px] text-foreground/80">
                  {item.relation} · {item.label || "—"} · {item.primary_trap || "no trap"} · {item.n_units ?? "—"} units · {item.created_at || "unknown"}
                </li>
              ))}
            </ul>
          )}
          {forwardNote ? <p className="mt-3 text-sm text-muted-foreground">{forwardNote}</p> : null}
        </section>
      </DeskSection>

      <DeskSection title="Fills" delay={0.4}>
        <TradeReview
          buy={buyPx}
          sell={sellPx}
          onBuy={setBuyPx}
          onSell={setSellPx}
          onSubmit={() => void submitFills(buyPx, sellPx)}
          note={reviewNote ? formatReview(reviewNote) : null}
          error={error}
        />
        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6"
        >
          <Button
            variant="outline"
            onClick={resetDesk}
            className="h-11 rounded-full border-hairline bg-transparent px-5 text-base text-muted-foreground"
          >
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            Test another idea
          </Button>
        </motion.div>
      </DeskSection>
    </div>
  );
}

function firstSentence(summary: string) {
  const cut = summary.indexOf(". ");
  if (cut > 12) return summary.slice(0, cut + 1);
  return summary;
}

function formatReview(note: string) {
  try {
    const data = JSON.parse(note) as { realized_bps?: number; unit_low?: number; unit_high?: number; inside_predictive?: boolean; status?: string };
    if (data.status) return data.status;
    const bps = data.realized_bps === undefined ? "unavailable" : String(Math.round(data.realized_bps * 1000) / 1000);
    return `Realized ${bps} bps. One-trade range ${data.unit_low} to ${data.unit_high}. Inside that range: ${data.inside_predictive}.`;
  } catch {
    return note;
  }
}

function TrapList({ reportTraps }: { reportTraps: { id: string; name: string; severity: string; triggered: boolean; summary: string; finding: string }[] }) {
  const triggered = reportTraps.filter((trap) => trap.triggered);
  const clear = reportTraps.filter((trap) => !trap.triggered);
  if (triggered.length === 0 && clear.length === 0) {
    return <p className="text-base text-muted-foreground">No traps were named on this run.</p>;
  }
  return (
    <div className="space-y-3">
      {triggered.map((trap) => (
        <details key={trap.id} className="group rounded-2xl border border-hairline bg-panel/80">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">
              <span className="block text-base font-medium text-foreground">{trap.name}</span>
              <span className="mt-1 block font-mono text-sm text-muted-foreground">{trap.severity}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="border-t border-hairline px-5 py-4">
            <p className="text-base leading-relaxed text-foreground/85">{trap.summary}</p>
            <p className="mt-2 break-all font-mono text-sm leading-relaxed text-muted-foreground">{trap.finding}</p>
          </div>
        </details>
      ))}
      {clear.length > 0 ? (
        <p className="text-sm leading-relaxed text-muted-foreground">Clear: {clear.map((trap) => trap.name).join(", ")}</p>
      ) : null}
    </div>
  );
}
