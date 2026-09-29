"use client";

import * as React from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { useDesk, useActiveScenario } from "@/lib/desk/store";
import { MonoChip, Mono, StatusMark, VERDICT_TONE, VerdictStamp } from "@/components/kl/atoms";
import { EquityChart, BootstrapChart, FoldChart } from "@/components/lab/charts";
import { Button } from "@/components/ui/button";
import { ScrollText, Brain, ArrowRight, RotateCcw, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * VERDICT — the strongest screen in the desk.
 * Big verdict, why, evidence, traps, baseline comparison, coverage,
 * AI interpretation (clearly advisory), and what happens next.
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
  const [revealed, setRevealed] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 450);
    return () => clearTimeout(t);
  }, []);

  if (!scenario || !report) return null;
  const tone = VERDICT_TONE[report.verdict];
  const triggeredTraps = report.traps.filter((t) => t.triggered);
  const clearTraps = report.traps.filter((t) => !t.triggered);

  return (
    <div className="mx-auto max-w-3xl">
      {/* ── The verdict reveal ──────────────────────────── */}
      <div className="pt-6 text-center sm:pt-10">
        <MonoChip>step 5 · verdict</MonoChip>

        <div className="relative mt-6">
          {/* flash backdrop */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center"
            initial={reduce ? false : { opacity: 0 }}
            animate={revealed ? { opacity: 1 } : undefined}
            transition={{ duration: 0.9 }}
          >
            <div
              className="h-52 w-52 rounded-full blur-3xl"
              style={{
                background: `radial-gradient(closest-side, color-mix(in oklch, ${report.verdict === "KILLED" ? "var(--verdict-killed)" : report.verdict === "ALIVE" ? "var(--verdict-alive)" : "var(--verdict-untestable)"} 16%, transparent), transparent 72%)`,
              }}
            />
          </motion.div>

          <AnimatePresence>
            {revealed && (
              <motion.h1
                initial={reduce ? false : { scale: 0.92, opacity: 0, filter: "blur(6px)" }}
                animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                className={cn("kl-display font-mono text-[3.4rem] uppercase leading-none tracking-[0.06em] sm:text-[4.6rem]", tone.text)}
              >
                {report.verdict}
              </motion.h1>
            )}
          </AnimatePresence>
        </div>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={revealed ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mx-auto mt-4 max-w-lg text-[15.5px] leading-relaxed text-foreground/85"
        >
          {report.verdictSummary}
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0 }}
          animate={revealed ? { opacity: 1 } : undefined}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-4 font-mono text-[10.5px] tracking-[0.08em] text-muted-foreground/60"
        >
          {scenario.frozen.freezeHash} · {scenario.frozen.engineVersion}
        </motion.div>
      </div>

      {/* ── Why (kill floor / gates) ────────────────────── */}
      <VerdictBlock title="Why" delay={0.1}>
        {report.verdict === "UNTESTABLE" ? (
          <>
            <p className="text-[13.5px] leading-relaxed text-muted-foreground">
              {report.verdictSummary} Scores are withheld because the sample cannot carry them.
            </p>
            <ul className="mt-4 space-y-2">
              {report.testabilityGates.map((gate) => (
                <li key={gate.label} className="flex items-center justify-between gap-4 rounded-xl border border-hairline bg-secondary/25 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground/90">{gate.label}</p>
                    <p className="mt-0.5 font-mono text-[10.5px] text-muted-foreground/60">required {gate.required}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <Mono className="text-verdict-killed">{gate.value}</Mono>
                    <StatusMark status={gate.status} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-xl border border-verdict-untestable/25 bg-verdict-untestable/5 px-4 py-3 text-[13px] leading-relaxed text-foreground/80">
              {report.killFloorNote}
            </p>
          </>
        ) : (
          <>
            <p className="text-[13.5px] leading-relaxed text-muted-foreground">
              The kill floor was fixed at freeze. The engine evaluated every
              criterion on walk-forward, deflated, cost-charged numbers.
            </p>
            <ul className="mt-4 space-y-2">
              {report.killFloorResults.map((kf) => (
                <li key={kf.label} className="flex items-center justify-between gap-4 rounded-xl border border-hairline bg-secondary/25 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground/90">{kf.label}</p>
                    <p className="mt-0.5 font-mono text-[10.5px] text-muted-foreground/60">{kf.rule}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <Mono className={kf.status === "fail" ? "text-verdict-killed" : kf.status === "pass" ? "text-verdict-alive" : ""}>{kf.value}</Mono>
                    <StatusMark status={kf.status} />
                  </div>
                </li>
              ))}
            </ul>
            <p className={cn("mt-4 rounded-xl border px-4 py-3 text-[13px] leading-relaxed", report.killFloorResults.every((k) => k.status === "pass") ? "border-verdict-alive/25 bg-verdict-alive/5 text-foreground/80" : "border-verdict-killed/25 bg-verdict-killed/5 text-foreground/80")}>
              {report.killFloorNote}
            </p>
          </>
        )}
      </VerdictBlock>

      {/* ── Evidence table ─────────────────────────────── */}
      <VerdictBlock title="Evidence" delay={0.15}>
        <div className="overflow-hidden rounded-xl border border-hairline">
          <ul className="divide-y divide-hairline/60">
            {report.evidence.map((row) => (
              <li key={row.label} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[12.5px] text-foreground/80">{row.label}</p>
                  {row.threshold ? (
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/50">{row.threshold}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <Mono
                    className={cn(
                      row.status === "fail" && "text-verdict-killed",
                      row.status === "pass" && "text-verdict-alive"
                    )}
                  >
                    {row.value}
                  </Mono>
                  <StatusMark status={row.status} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </VerdictBlock>

      {/* ── Charts (only when they carry meaning) ──────── */}
      {report.equityCurves && report.folds && (
        <VerdictBlock title="The story, drawn honestly" delay={0.18}>
          <div className="rounded-xl border border-hairline bg-panel/50 p-4 sm:p-5">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
              cumulative return · same test, three honesties
            </p>
            <EquityChart curves={report.equityCurves} />
          </div>
          <div className="mt-4 rounded-xl border border-hairline bg-panel/50 p-4 sm:p-5">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
              walk-forward sharpe · decay by fold
            </p>
            <FoldChart folds={report.folds} />
          </div>
        </VerdictBlock>
      )}

      {report.bootstrap && (
        <VerdictBlock title="Bootstrap confidence" delay={0.2}>
          <div className="rounded-xl border border-hairline bg-panel/50 p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
                distribution of sharpe · 10,000 resamples
              </p>
              <Mono className={report.bootstrap.ciLow <= 0 ? "text-verdict-killed" : "text-verdict-alive"}>
                90% CI {report.bootstrap.ciLow > 0 ? "+" : ""}{report.bootstrap.ciLow} … +{report.bootstrap.ciHigh}
              </Mono>
            </div>
            <BootstrapChart bootstrap={report.bootstrap} />
          </div>
        </VerdictBlock>
      )}

      {/* ── Traps ──────────────────────────────────────── */}
      <VerdictBlock title={`Traps · ${triggeredTraps.length} named by the engine`} delay={0.22}>
        <div className="space-y-2">
          {triggeredTraps.map((trap) => (
            <details key={trap.id} className="group rounded-xl border border-hairline bg-secondary/25">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      trap.severity === "high" ? "bg-verdict-killed" : trap.severity === "medium" ? "bg-verdict-untestable" : "bg-muted-foreground/50"
                    )}
                  />
                  <p className="truncate text-[13px] font-medium text-foreground/90">{trap.name}</p>
                  <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground/50">{trap.severity}</span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform duration-300 group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="border-t border-hairline/60 px-4 py-3">
                <p className="text-[12.5px] leading-relaxed text-foreground/80">{trap.summary}</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{trap.finding}</p>
              </div>
            </details>
          ))}
          {clearTraps.length > 0 && (
            <div className="rounded-xl border border-hairline/60 bg-panel/40 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/50">
                clear
              </p>
              <p className="mt-1.5 font-mono text-[11.5px] leading-relaxed text-muted-foreground/70">
                {clearTraps.map((t) => t.name).join(" · ")}
              </p>
            </div>
          )}
        </div>
      </VerdictBlock>

      {/* ── Baseline comparison ────────────────────────── */}
      {report.baselineComparison.length > 0 ? (
      <VerdictBlock title="Against the baselines" delay={0.24}>
        <div className="overflow-x-auto rounded-xl border border-hairline">
          <table className="w-full min-w-[420px] text-left">
            <thead>
              <tr className="border-b border-hairline bg-secondary/30">
                <th scope="col" className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">baseline</th>
                <th scope="col" className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">sharpe</th>
                <th scope="col" className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">return</th>
                <th scope="col" className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">max dd</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline/60">
              {report.baselineComparison.map((row) => (
                <tr key={row.label} className={cn(row.isStrategy && "bg-ice/[0.045]")}>
                  <th scope="row" className={cn("px-4 py-3 text-[12.5px] font-medium", row.isStrategy ? "text-ice" : "text-foreground/80")}>
                    {row.label}
                  </th>
                  <td className={cn("px-4 py-3 text-right font-mono text-[12.5px]", row.isStrategy ? "text-ice" : "text-foreground/70")}>{row.sharpe.toFixed(2)}</td>
                  <td className={cn("px-4 py-3 text-right font-mono text-[12.5px]", row.netReturnPct >= 0 ? "text-foreground/70" : "text-verdict-killed")}>
                    {row.netReturnPct >= 0 ? "+" : ""}{row.netReturnPct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[12.5px] text-muted-foreground">{row.maxDrawdownPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </VerdictBlock>
      ) : null}
      <VerdictBlock title="Data coverage" delay={0.26}>
        <div className="rounded-xl border border-hairline bg-panel/50 p-5">
          {report.dataCoverage.overallPct > 0 ? (
            <>
          <div className="flex items-baseline justify-between">
            <Mono>venue coverage</Mono>
            <Mono className={report.dataCoverage.overallPct >= 95 ? "text-verdict-alive" : "text-verdict-killed"}>
              {report.dataCoverage.overallPct}%
            </Mono>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-secondary/60">
            <motion.div
              className={cn("h-full rounded-full", report.dataCoverage.overallPct >= 95 ? "bg-verdict-alive/70" : "bg-verdict-killed/70")}
              initial={reduce ? false : { width: 0 }}
              whileInView={{ width: `${report.dataCoverage.overallPct}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
            </>
          ) : (
            <p className="font-mono text-[12px] text-foreground/80">Oldest fetched bar {report.dataCoverage.bars}</p>
          )}
          {report.dataCoverage.gaps.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-hairline/60 pt-3">
              {report.dataCoverage.gaps.map((g) => (
                <li key={g.period} className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-[11px]">
                  <span className="text-foreground/70">{g.period}</span>
                  <span className="text-muted-foreground/60">{g.reason}</span>
                </li>
              ))}
            </ul>
          )}
          {report.dataCoverage.notes.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-hairline/60 pt-3">
              {report.dataCoverage.notes.map((n) => (
                <li key={n} className="text-[12px] leading-relaxed text-muted-foreground">— {n}</li>
              ))}
            </ul>
          )}
        </div>
      </VerdictBlock>

      {/* ── AI interpretation (advisory, clearly bounded) */}
      <VerdictBlock title="What the assistant makes of it" delay={0.28}>
        <div className="rounded-xl border border-ice/15 bg-ice/[0.03] p-5">
          <div className="flex items-center gap-2.5">
            <Brain className="h-4 w-4 text-ice" aria-hidden="true" />
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ice/90">advisory interpretation</p>
          </div>
          <div className="mt-4 space-y-3.5">
            {report.aiInterpretation.paragraphs.map((p, i) => (
              <p key={i} className="text-[13.5px] leading-relaxed text-foreground/80">{p}</p>
            ))}
          </div>
          <p className="mt-4 border-t border-ice/10 pt-3 font-mono text-[10.5px] leading-relaxed text-muted-foreground/70">
            {report.aiInterpretation.disclaimer}
          </p>
        </div>
      </VerdictBlock>

      {/* ── What happens next ─────────────────────────── */}
      <VerdictBlock title="What happens next" delay={0.3}>
        <ol className="space-y-2.5">
          {report.nextSteps.map((step, i) => (
            <li key={step.title} className="flex gap-3.5 rounded-xl border border-hairline bg-secondary/25 px-4 py-3.5">
              <span className="font-mono text-[11px] text-ice/80">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <p className="text-[13.5px] font-medium text-foreground/90">{step.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </VerdictBlock>

      <VerdictBlock title="Review fills" delay={0.32}>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Paste a buy and a sell from your own log. KillLab does not place orders. If this run has no confidence interval, reconciliation stays unavailable.
        </p>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submitFills(buyPx, sellPx);
          }}
        >
          <label className="font-mono text-[11px] text-muted-foreground">
            buy price
            <input required inputMode="decimal" value={buyPx} onChange={(event) => setBuyPx(event.target.value)} className="mt-1 block w-36 rounded-md border border-hairline bg-transparent px-2 py-1 text-foreground" />
          </label>
          <label className="font-mono text-[11px] text-muted-foreground">
            sell price
            <input required inputMode="decimal" value={sellPx} onChange={(event) => setSellPx(event.target.value)} className="mt-1 block w-36 rounded-md border border-hairline bg-transparent px-2 py-1 text-foreground" />
          </label>
          <Button type="submit" variant="outline" className="rounded-full">
            Reconcile
          </Button>
        </form>
        {reviewNote ? <p className="mt-3 font-mono text-[12px] text-foreground/80">{formatReview(reviewNote)}</p> : null}
        {error ? <p className="mt-3 font-mono text-[12px] text-verdict-killed" role="alert">{error}</p> : null}
      </VerdictBlock>

      {/* ── Closing actions ───────────────────────────── */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3 pb-4">
        <Button
          onClick={() => setTab("ledger")}
          className="kl-edge group h-11 rounded-full bg-foreground px-6 text-[14px] font-medium text-background transition-all duration-300 hover:shadow-[0_0_36px_-8px] hover:shadow-ice/50"
        >
          <ScrollText className="mr-2 h-4 w-4" aria-hidden="true" />
          Open the ledger
          <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          onClick={resetDesk}
          className="h-11 rounded-full border-hairline bg-transparent px-5 text-[14px] text-muted-foreground transition-colors duration-300 hover:border-foreground/25 hover:text-foreground"
        >
          <RotateCcw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
          Test another idea
        </Button>
      </div>
    </div>
  );
}

function formatReview(note: string) {
  try {
    const data = JSON.parse(note) as { realized_bps?: number; unit_low?: number; unit_high?: number; inside_predictive?: boolean; status?: string };
    if (data.status) return data.status;
    const bps = data.realized_bps === undefined ? "—" : String(Math.round(data.realized_bps * 1000) / 1000);
    return `Realized ${bps} bps. One-trade range ${data.unit_low} to ${data.unit_high}. Inside that range: ${data.inside_predictive}.`;
  } catch {
    return note;
  }
}

function VerdictBlock({
  title,
  children,
  delay = 0,
}: {
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className="mt-12"
    >
      <div className="flex items-center gap-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{title}</h2>
        <span aria-hidden="true" className="h-px flex-1 bg-hairline" />
      </div>
      <div className="mt-4">{children}</div>
    </motion.section>
  );
}
