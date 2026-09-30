"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VERDICT_TONE } from "@/components/kl/atoms";
import { cn } from "@/lib/utils";
import type { EvidenceRow, Verdict, VerdictReport } from "@/lib/research/types";
import type { BookCardModel, ContextCardModel, VerdictPresentation } from "@/lib/research/present-verdict";

const EASE = [0.16, 1, 0.3, 1] as const;

export function DeskSection({
  title,
  delay = 0,
  children,
}: {
  title: string;
  delay?: number;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: EASE }}
      className="mt-12"
    >
      <h2 className="text-lg font-medium tracking-tight text-foreground">{title}</h2>
      <div className="mt-4">{children}</div>
    </motion.section>
  );
}

function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border border-hairline bg-panel/80 p-5 transition-colors duration-300 hover:border-foreground/15 sm:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "warn" | "bad" | "ok" }) {
  const tones = {
    neutral: "border-hairline bg-secondary/50 text-foreground/80",
    warn: "border-verdict-inconclusive/30 bg-verdict-inconclusive/10 text-verdict-inconclusive",
    bad: "border-verdict-killed/30 bg-verdict-killed/10 text-verdict-killed",
    ok: "border-verdict-alive/30 bg-verdict-alive/10 text-verdict-alive",
  };
  return (
    <span className={cn("inline-flex max-w-full items-center rounded-full border px-2.5 py-1 font-mono text-[12px] leading-none", tones[tone])}>
      <span className="truncate">{children}</span>
    </span>
  );
}

function freshnessTone(value: string): "neutral" | "warn" | "bad" | "ok" {
  if (value === "current" || value === "historical") return "ok";
  if (value === "stale") return "warn";
  if (value === "empty_result" || value === "tool_error" || value === "timeout") return "bad";
  return "neutral";
}

export function VerdictHero({
  verdict,
  summary,
  observed,
  required,
  engine,
  mechanism,
  origin,
  hash,
}: {
  verdict: Verdict;
  summary: string;
  observed: string;
  required: string;
  engine: string;
  mechanism: string;
  origin: string;
  hash: string;
}) {
  const reduce = useReducedMotion();
  const tone = VERDICT_TONE[verdict];
  const ratio = observed && required ? `${observed} / ${required}` : observed || required;
  return (
    <header className="pt-2 sm:pt-4">
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        className={cn("text-sm font-medium", tone.text)}
      >
        {tone.label}
      </motion.p>
      <div className="relative mt-3">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-6 top-0 -z-10 h-40 w-72 rounded-full blur-3xl"
          style={{
            background: `radial-gradient(closest-side, color-mix(in oklch, var(${verdictVar(verdict)}) 22%, transparent), transparent 72%)`,
          }}
        />
        <motion.h1
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE }}
          className={cn("kl-verdict-word text-[clamp(3.4rem,8vw,6.4rem)] uppercase", tone.text)}
        >
          {verdict}
        </motion.h1>
      </div>
      {ratio ? (
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12, ease: EASE }}
          className="mt-5 font-mono text-2xl tabular-nums tracking-tight text-foreground sm:text-3xl"
        >
          {ratio} <span className="font-sans text-base font-normal text-muted-foreground">units</span>
        </motion.p>
      ) : null}
      <motion.p
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: EASE }}
        className="mt-4 max-w-[62ch] text-lg leading-relaxed text-foreground/85"
      >
        {summary}
      </motion.p>
      <motion.dl
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.32 }}
        className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Meta label="Engine" value={engine} mono />
        <Meta label="Mechanism" value={mechanism} mono />
        <Meta label="Run origin" value={origin} mono />
        <Meta label="Freeze hash" value={hash} mono />
      </motion.dl>
    </header>
  );
}

function verdictVar(verdict: Verdict) {
  if (verdict === "KILLED") return "--verdict-killed";
  if (verdict === "ALIVE") return "--verdict-alive";
  if (verdict === "INCONCLUSIVE") return "--verdict-inconclusive";
  return "--verdict-untestable";
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 border-t border-hairline pt-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 break-all text-sm text-foreground", mono && "font-mono")}>{value || "none"}</dd>
    </div>
  );
}

export function WhyCard({ report, view, body }: { report: VerdictReport; view: VerdictPresentation; body: string }) {
  return (
    <Panel>
      <p className="max-w-[68ch] text-base leading-relaxed text-foreground/80">{body}</p>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric value={view.observed || "none"} label="Observed" />
        <Metric value={view.required || "none"} label="Required" />
        <Metric value={view.gap || "none"} label="Still needed" />
      </div>
      {report.killFloorNote ? (
        <p className="mt-5 max-w-[68ch] text-base leading-relaxed text-muted-foreground">{report.killFloorNote}</p>
      ) : null}
      {report.killFloorResults.length > 0 ? (
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {report.killFloorResults.map((item) => (
            <li key={item.label} className="min-w-0 rounded-xl border border-hairline px-4 py-3">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="mt-1 font-mono text-lg text-foreground">{item.value}</p>
              <p className="mt-1 break-words text-sm text-muted-foreground">{item.rule}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-background/40 px-4 py-4">
      <p className="font-mono text-3xl tabular-nums tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function EvidenceGroups({ view }: { view: VerdictPresentation }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <FactCard title="Core result" rows={view.core} />
      <FactCard title="Coverage" rows={view.coverage} />
      <FactCard title="Experiment" rows={view.experiment} />
    </div>
  );
}

function FactCard({ title, rows }: { title: string; rows: EvidenceRow[] }) {
  if (rows.length === 0) return null;
  return (
    <Panel className="h-full">
      <h3 className="text-base font-medium text-foreground">{title}</h3>
      <ul className="mt-4 space-y-4">
        {rows.map((item) => (
          <li key={item.label} className="min-w-0">
            <p className="text-sm text-muted-foreground">{item.label}</p>
            <p className={cn("mt-1 break-all text-foreground", shortValue(item.value) ? "font-mono text-2xl tabular-nums tracking-tight" : "text-base leading-snug")}>
              {item.value}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function shortValue(value: string) {
  return value.length > 0 && value.length <= 18 && !value.includes(" ");
}

export function MarketEvidence({ book }: { book: BookCardModel }) {
  const cells = [
    book.spread ? { label: "Spread", value: `${book.spread} bps` } : null,
    book.walk ? { label: book.notional ? `$${book.notional} walk` : "Walk", value: `${book.walk} bps` } : null,
    book.imbalance ? { label: "Depth imbalance", value: book.imbalance } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Chip>{book.provenance}</Chip>
          {book.historical ? <Chip tone={book.historical === "no" ? "warn" : "ok"}>historical: {book.historical}</Chip> : null}
        </div>
      </div>
      {cells.length > 0 ? (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {cells.map((cell) => (
            <Metric key={cell.label} value={cell.value} label={cell.label} />
          ))}
        </div>
      ) : (
        <p className="mt-4 break-words text-base leading-relaxed text-foreground/80">{book.raw}</p>
      )}
      <p className="mt-4 break-words text-sm leading-relaxed text-muted-foreground">
        {book.threshold || "Provenance is the book record on this run."}
      </p>
      <details className="group mt-4">
        <summary className="cursor-pointer list-none text-sm text-foreground/80 [&::-webkit-details-marker]:hidden">
          View raw source details
        </summary>
        <p className="mt-2 break-all font-mono text-sm leading-relaxed text-muted-foreground">{book.raw}</p>
      </details>
    </Panel>
  );
}

export function ResearchContext({ view }: { view: VerdictPresentation }) {
  if (view.contexts.length === 0 && !view.skill) return null;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {view.skill ? <p className="text-base text-foreground">{view.skill}</p> : null}
        </div>
        {view.contextChanges ? (
          <Chip tone="neutral">Context changes the verdict: {view.contextChanges}</Chip>
        ) : null}
      </div>
      {view.lanes.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {view.lanes.map((lane) => (
            <li key={lane.id} className="rounded-full border border-hairline px-3 py-1 font-mono text-[11px] text-foreground/80">
              {lane.id} · {lane.sourceClass} · {lane.detail}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {view.contexts.map((card, index) => (
          <ContextCard key={`${card.title}-${card.hash}-${index}`} card={card} />
        ))}
      </div>
    </div>
  );
}

function ContextCard({ card }: { card: ContextCardModel }) {
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-medium tracking-tight text-foreground">{card.title}</h3>
          {card.tool ? <p className="mt-1 font-mono text-sm text-muted-foreground">{card.tool}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {card.freshness ? <Chip tone={freshnessTone(card.freshness)}>{card.freshness}</Chip> : null}
          {card.failureClass ? <Chip tone={freshnessTone(card.failureClass)}>{card.failureClass}</Chip> : null}
        </div>
      </div>
      {card.sourceClass ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Source class <span className="font-mono text-foreground/90">{card.sourceClass}</span>
        </p>
      ) : null}
      {card.facts.length > 0 ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {card.facts.map((fact) => (
            <li key={`${fact.key}-${fact.value}`} className="min-w-0">
              <p className="text-sm capitalize text-muted-foreground">{fact.key}</p>
              <p className="mt-1 break-all font-mono text-base text-foreground">{fact.value}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 break-words text-base leading-relaxed text-foreground/85">{card.summary}</p>
      )}
      <dl className="mt-4 space-y-1 text-sm text-muted-foreground">
        {card.dataTime ? <div className="break-all">Source time <span className="font-mono text-foreground/80">{card.dataTime}</span></div> : null}
        {card.retrieved ? <div className="break-all">Retrieved <span className="font-mono text-foreground/80">{card.retrieved}</span></div> : null}
        {card.url ? <div className="break-all">URL <span className="font-mono text-foreground/80">{card.url}</span></div> : null}
      </dl>
      <details className="group mt-4 border-t border-hairline pt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm text-foreground/80 [&::-webkit-details-marker]:hidden">
          View provenance
          <ChevronDown className="h-4 w-4 transition-transform duration-300 group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="mt-3 space-y-2 break-all font-mono text-sm leading-relaxed text-muted-foreground">
          <p>{card.summary}</p>
          {card.rawMeta ? <p>{card.rawMeta}</p> : null}
          {card.hash ? <p>{card.hash}</p> : null}
        </div>
      </details>
    </Panel>
  );
}

export function AssistantCard({ report, question }: { report: VerdictReport; question: string }) {
  const paragraphs = report.aiInterpretation.paragraphs.filter((item) => item && item !== question);
  return (
    <Panel className="bg-ice/[0.04]">
      <p className="text-sm font-medium text-ice">Assistant interpretation</p>
      <p className="mt-4 text-sm text-muted-foreground">Question</p>
      <p className="mt-1 max-w-[68ch] text-lg leading-snug text-foreground">{question}</p>
      <div className="mt-5 space-y-3">
        {paragraphs.map((paragraph) => (
          <p key={paragraph} className="max-w-[68ch] text-base leading-relaxed text-foreground/85">
            {paragraph}
          </p>
        ))}
      </div>
      <p className="mt-5 border-t border-hairline pt-4 text-sm leading-relaxed text-muted-foreground">
        {report.aiInterpretation.disclaimer}
      </p>
    </Panel>
  );
}

export function NextTestCard({
  question,
  reasons,
  onLedger,
  onPosture,
}: {
  question: string;
  reasons: string[];
  onLedger: () => void;
  onPosture: (posture: "conservative" | "exploratory") => void;
}) {
  return (
    <Panel className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 max-w-[62ch]">
        <h3 className="text-xl font-medium tracking-tight text-foreground">Next test</h3>
        <p className="mt-3 text-base leading-relaxed text-foreground/85">{question}</p>
        {reasons.length > 0 ? (
          <ul className="mt-4 space-y-1 text-sm leading-relaxed text-muted-foreground">
            {reasons.slice(0, 3).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-9 rounded-full px-4 text-sm" onClick={() => onPosture("conservative")}>
            Conservative
          </Button>
          <Button type="button" variant="outline" className="h-9 rounded-full px-4 text-sm" onClick={() => onPosture("exploratory")}>
            Exploratory
          </Button>
        </div>
      </div>
      <Button
        onClick={onLedger}
        className="h-12 shrink-0 rounded-full bg-foreground px-6 text-base font-medium text-background"
      >
        Open ledger
        <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
      </Button>
    </Panel>
  );
}

export function TradeReview({
  buy,
  sell,
  onBuy,
  onSell,
  onSubmit,
  note,
  error,
}: {
  buy: string;
  sell: string;
  onBuy: (value: string) => void;
  onSell: (value: string) => void;
  onSubmit: () => void;
  note: string | null;
  error: string | null;
}) {
  return (
    <Panel className="max-w-xl">
      <h3 className="text-base font-medium text-foreground">Trade review</h3>
      <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
        Paste a buy and a sell from your own log. KillLab does not place orders. If this run has no confidence interval, reconciliation stays unavailable.
      </p>
      <form
        className="mt-5 grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label className="text-sm text-muted-foreground">
          Buy price
          <input
            required
            inputMode="decimal"
            value={buy}
            onChange={(event) => onBuy(event.target.value)}
            className="mt-2 block h-11 w-full rounded-xl border border-hairline bg-background px-3 text-base text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ice"
          />
        </label>
        <label className="text-sm text-muted-foreground">
          Sell price
          <input
            required
            inputMode="decimal"
            value={sell}
            onChange={(event) => onSell(event.target.value)}
            className="mt-2 block h-11 w-full rounded-xl border border-hairline bg-background px-3 text-base text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ice"
          />
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" className="h-11 rounded-full px-6">
            Reconcile
          </Button>
        </div>
      </form>
      {note ? <p className="mt-4 text-sm leading-relaxed text-foreground/85">{note}</p> : null}
      {error ? <p className="mt-3 text-sm text-verdict-killed" role="alert">{error}</p> : null}
    </Panel>
  );
}
