"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useDesk, useActiveScenario } from "@/lib/desk/store";
import { MonoChip, Mono } from "@/components/kl/atoms";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Brain, Lock, Database, Gauge, Target, Layers, Scale, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * REVIEW TEST — the AI-drafted specification.
 * Every field the engine will hold the trader to, presented as
 * reviewable rows. One obvious action: FREEZE TEST.
 */
export function ReviewView() {
  const thesisText = useDesk((s) => s.thesisText);
  const scenario = useActiveScenario();
  const startFreeze = useDesk((s) => s.startFreeze);
  const goWrite = useDesk((s) => s.goWrite);
  const updateWindow = useDesk((s) => s.updateWindow);
  const error = useDesk((s) => s.error);
  const specDraft = useDesk((s) => s.specDraft);
  const reduce = useReducedMotion();

  if (!scenario) return null;
  const { spec } = scenario;

  return (
    <div className="mx-auto max-w-3xl">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <MonoChip tone="ice">step 2 · review</MonoChip>
              <MonoChip>ai-drafted</MonoChip>
            </div>
            <h1 className="kl-display mt-3.5 text-2xl text-foreground sm:text-[1.7rem]">
              The assistant read your idea like a researcher would.
            </h1>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
              This is the full test specification. Review every field — after
              freeze, nothing changes.
            </p>
          </div>
        </div>

        {/* The original words, preserved */}
        <div className="mt-7 rounded-2xl border border-hairline bg-panel/60 p-5 sm:p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
            your hypothesis
          </p>
          <p className="mt-2.5 text-[16px] leading-relaxed text-foreground/90">
            “{spec.hypothesisText}”
          </p>
          {thesisText ? (
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">Thesis, not a number: {thesisText}</p>
          ) : null}
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-ice/15 bg-ice/[0.04] p-4">
            <Brain className="mt-0.5 h-4 w-4 shrink-0 text-ice" aria-hidden="true" />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ice/90">assistant note</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-foreground/80">{spec.aiNote}</p>
            </div>
          </div>
        </div>

        {/* Detected fields */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <SpecCard icon={Layers} title="Hypothesis family">
            <p className="text-[14px] font-medium text-foreground/90">{spec.family}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{spec.familyDetail}</p>
          </SpecCard>

          <SpecCard icon={CalendarRange} title="Testing window">
            <div className="flex flex-wrap gap-2">
              <label className="font-mono text-[11px] text-muted-foreground">
                from
                <input
                  className="mt-1 block rounded-md border border-hairline bg-transparent px-2 py-1 text-foreground"
                  value={specDraft?.test_start || spec.testingWindow.from}
                  onChange={(event) => updateWindow(event.target.value, specDraft?.test_end || spec.testingWindow.to)}
                />
              </label>
              <label className="font-mono text-[11px] text-muted-foreground">
                to
                <input
                  className="mt-1 block rounded-md border border-hairline bg-transparent px-2 py-1 text-foreground"
                  value={specDraft?.test_end || spec.testingWindow.to}
                  onChange={(event) => updateWindow(specDraft?.test_start || spec.testingWindow.from, event.target.value)}
                />
              </label>
            </div>
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              Edited here before freeze. The engine does not see Bitget data yet.
            </p>
          </SpecCard>

          <SpecCard icon={Target} title="Instruments">
            <div className="flex flex-wrap gap-1.5">
              {spec.instruments.map((inst) => (
                <span key={inst.symbol} className="rounded-md border border-hairline bg-secondary/40 px-2 py-0.5 font-mono text-[11px] text-foreground/85">
                  {inst.symbol}
                  <span className="ml-1 text-muted-foreground/60">{inst.kind} · {inst.venue}</span>
                </span>
              ))}
            </div>
          </SpecCard>

          <SpecCard icon={Gauge} title="Kill floor">
            <ul className="space-y-1.5">
              {spec.killFloor.map((kf) => (
                <li key={kf.id} className="flex items-baseline gap-2 font-mono text-[11.5px] text-foreground/80">
                  <span className="text-verdict-killed/70">▸</span>
                  <span>
                    <span className="text-foreground">{kf.label}</span>
                    <span className="text-muted-foreground/70"> — {kf.rule}</span>
                  </span>
                </li>
              ))}
            </ul>
          </SpecCard>
        </div>

        {/* Variants */}
        <div className="mt-4 rounded-2xl border border-hairline bg-panel/60 p-5 sm:p-6">
          <SpecCardHeader icon={Layers} title={`Variants (${spec.variants.length})`} caption="all counted for multiple-testing deflation" />
          <div className="kl-scroll mt-4 grid max-h-72 gap-2 overflow-y-auto pr-1">
            {spec.variants.map((v) => (
              <div key={v.id} className="rounded-xl border border-hairline/70 bg-secondary/25 p-3.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-mono text-[12px] text-ice/90">{v.label}</p>
                  <p className="font-mono text-[10px] text-muted-foreground/60">{v.sizing}</p>
                </div>
                <p className="mt-1 font-mono text-[11px] leading-relaxed text-muted-foreground">
                  entry — {v.entry}
                </p>
                <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
                  exit — {v.exit}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Baselines */}
        <div className="mt-4 rounded-2xl border border-hairline bg-panel/60 p-5 sm:p-6">
          <SpecCardHeader icon={Scale} title={`Baselines (${spec.baselines.length})`} caption="the idea must beat these honestly" />
          <div className="mt-4 grid gap-2 sm:grid-cols-1">
            {spec.baselines.map((b) => (
              <div key={b.id} className="flex items-baseline gap-3 rounded-xl border border-hairline/70 bg-secondary/25 px-4 py-3">
                <p className="font-mono text-[12px] text-foreground/90">{b.label}</p>
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">{b.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Data requirements + unloaded state */}
        <div className="mt-4 rounded-2xl border border-hairline bg-panel/60 p-5 sm:p-6">
          <SpecCardHeader icon={Database} title="Data requirements" caption="pulled only after freeze" />
          <ul className="mt-4 space-y-2">
            {spec.dataRequirements.map((dr) => (
              <li key={dr.id} className="flex items-start gap-3 rounded-xl border border-hairline/70 bg-secondary/25 px-4 py-3">
                <span aria-hidden="true" className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                <div>
                  <p className="font-mono text-[12px] text-foreground/90">{dr.label}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{dr.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-dashed border-hairline px-4 py-3">
            <Database className="h-3.5 w-3.5 text-muted-foreground/60" aria-hidden="true" />
            <p className="font-mono text-[11px] text-muted-foreground/70">
              status: not loaded · venue pull begins at freeze
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 pb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={goWrite}
            className="rounded-full text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Edit the idea
          </Button>
          <Button
            onClick={startFreeze}
            className="kl-edge group h-12 rounded-full bg-foreground px-7 text-[15px] font-medium text-background transition-all duration-300 hover:shadow-[0_0_40px_-8px] hover:shadow-ice/50"
          >
            <Lock className="mr-2 h-4 w-4" aria-hidden="true" />
            Freeze test
          </Button>
        </div>
        {error ? (
          <p className="mt-3 font-mono text-[12px] text-verdict-killed" role="alert">
            {error}
          </p>
        ) : null}
      </motion.div>
    </div>
  );
}

function SpecCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-panel/60 p-5">
      <SpecCardHeader icon={Icon} title={title} />
      <div className="mt-3.5">{children}</div>
    </div>
  );
}

function SpecCardHeader({
  icon: Icon,
  title,
  caption,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  caption?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{title}</h3>
      </div>
      {caption ? <span className="font-mono text-[9.5px] text-muted-foreground/50">{caption}</span> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FREEZE — the ceremony. Hold to seal.                               */
/* ------------------------------------------------------------------ */

const HOLD_MS = 1600;

export function FreezeView() {
  const scenario = useActiveScenario();
  const screen = useDesk((s) => s.screen);
  const updateFreezeHold = useDesk((s) => s.updateFreezeHold);
  const cancelFreeze = useDesk((s) => s.cancelFreeze);
  const completeFreeze = useDesk((s) => s.completeFreeze);
  const reduce = useReducedMotion();
  const holdingRef = React.useRef(false);
  const rafRef = React.useRef<number | null>(null);
  const startRef = React.useRef(0);
  const doneRef = React.useRef(false);
  const [holdPct, setHoldPct] = React.useState(0);

  const holdMs = screen.kind === "freeze" ? screen.holdMs : 0;

  const stop = React.useCallback(() => {
    holdingRef.current = false;
    if (rafRef.current) window.clearTimeout(rafRef.current);
    rafRef.current = null;
    if (!doneRef.current) {
      setHoldPct(0);
      updateFreezeHold(0);
    }
  }, [updateFreezeHold]);

  const tickRef = React.useRef<() => void>(() => {});

  const tick = React.useCallback(() => {
    if (!holdingRef.current) return;
    const elapsed = Date.now() - startRef.current;
    const pct = Math.min(1, elapsed / HOLD_MS);
    setHoldPct(pct);
    updateFreezeHold(elapsed);
    if (pct >= 1) {
      doneRef.current = true;
      holdingRef.current = false;
      completeFreeze();
      return;
    }
    rafRef.current = window.setTimeout(() => tickRef.current(), 32);
  }, [completeFreeze, updateFreezeHold]);

  React.useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  const begin = React.useCallback(() => {
    if (doneRef.current || holdingRef.current) return;
    holdingRef.current = true;
    startRef.current = Date.now();
    rafRef.current = window.setTimeout(() => tickRef.current(), 32);
  }, []);

  React.useEffect(() => {
    return () => {
      holdingRef.current = false;
      if (rafRef.current) window.clearTimeout(rafRef.current);
    };
  }, []);

  React.useEffect(() => {
    // Keyboard accessibility: hold Space to freeze.
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        const el = document.activeElement;
        if (el && (el.tagName === "BUTTON" || el.tagName === "TEXTAREA" || el.tagName === "INPUT")) return;
        e.preventDefault();
        begin();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") stop();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [begin, stop]);

  if (!scenario) return null;
  const frozen = scenario.frozen;
  const { spec } = scenario;

  return (
    <div className="mx-auto max-w-2xl">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="text-center"
      >
        <MonoChip tone="ice">step 3 · freeze</MonoChip>
        <h1 className="kl-display mt-4 text-2xl text-foreground sm:text-3xl">
          Sealing is deliberate. Hold to freeze.
        </h1>
        <p className="mx-auto mt-2.5 max-w-md text-[14px] leading-relaxed text-muted-foreground">
          When the ring completes, this specification becomes immutable — hashed,
          locked, and handed to the engine. <span className="hidden sm:inline">Hold <span className="font-mono text-[12px] text-foreground/70">Space</span> or the button.</span>
        </p>
      </motion.div>

      {/* The sealed document */}
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="mt-8 overflow-hidden rounded-2xl border border-hairline bg-panel text-left"
      >
        <div className="flex items-center justify-between border-b border-dashed border-hairline px-6 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">immutable test summary</p>
            <p className="mt-1 font-mono text-[12.5px] text-foreground/85">{spec.id}</p>
          </div>
          <MonoChip>pre-freeze</MonoChip>
        </div>

        <div className="space-y-0 px-6 py-2">
          {[
            ["Hypothesis", spec.hypothesisText],
            ["Family", spec.family],
            ["Instruments", spec.instruments.map((i) => i.symbol).join(" · ")],
            ["Window", `${spec.testingWindow.from} → ${spec.testingWindow.to} (${spec.testingWindow.label})`],
            ["Variants", `${spec.variants.length} — all counted for deflation`],
            ["Baselines", spec.baselines.map((b) => b.label).join(" · ")],
            ["Kill floor", `${spec.killFloor.length} criteria`],
            ["Data", spec.dataRequirements.map((d) => d.label).join(" · ")],
          ].map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-6 border-b border-dashed border-hairline/50 py-3 last:border-0">
              <p className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground/60">{label}</p>
              <p className="text-right font-mono text-[12px] leading-relaxed text-foreground/80">{value}</p>
            </div>
          ))}
        </div>

        {/* Hash preview */}
        <div className="border-t border-dashed border-hairline px-6 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/60">freeze hash</p>
          <p className="mt-1.5 break-all font-mono text-[12.5px] text-ice">{frozen.freezeHash}</p>
        </div>
      </motion.div>

      {/* The hold-to-freeze control */}
      <div className="mt-8 flex flex-col items-center gap-4">
        <HoldButton
          pct={holdPct}
          onHoldStart={begin}
          onHoldEnd={stop}
          disabled={false}
          reduce={reduce}
        />
        <div className="flex items-center gap-4">
          <button
            onClick={cancelFreeze}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ice"
          >
            ← back to review
          </button>
        </div>
        <p className="font-mono text-[10.5px] text-muted-foreground/50">
          data access begins only after freeze · engine {frozen.engineVersion}
        </p>
      </div>
    </div>
  );
}

function HoldButton({
  pct,
  onHoldStart,
  onHoldEnd,
  reduce,
}: {
  pct: number;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  disabled: boolean;
  reduce: boolean | null;
}) {
  const R = 84;
  const C = 2 * Math.PI * R;
  const circumference = C * 0.78; // partial arc

  return (
    <div className="relative">
      <svg viewBox="0 0 200 200" className="pointer-events-none absolute -inset-3 h-[calc(100%+24px)] w-[calc(100%+24px)]" aria-hidden="true">
        {/* base ring */}
        <circle cx="100" cy="100" r={R} fill="none" stroke="oklch(1 0 0 / 8%)" strokeWidth="2" strokeDasharray={`${circumference} ${C}`} strokeLinecap="round" transform="rotate(135 100 100)" />
        {/* progress ring */}
        <motion.circle
          cx="100"
          cy="100"
          r={R}
          fill="none"
          stroke="var(--ice)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${circumference * pct} ${C}`}
          transform="rotate(135 100 100)"
          style={{ filter: pct > 0 ? "drop-shadow(0 0 6px color-mix(in oklch, var(--ice) 60%, transparent))" : undefined }}
          initial={{ opacity: 0.001 }}
          animate={reduce ? { opacity: 0.001 } : { opacity: pct > 0 && pct < 1 ? 1 : 0.001 }}
          transition={{ duration: 0.2 }}
        />
      </svg>
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          onHoldStart();
        }}
        onPointerUp={onHoldEnd}
        onPointerLeave={onHoldEnd}
        onPointerCancel={onHoldEnd}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onHoldStart();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === "Enter" || e.key === " ") onHoldEnd();
        }}
        className={cn(
          "relative flex h-32 w-32 select-none flex-col items-center justify-center gap-1.5 rounded-full border bg-panel/80 font-mono uppercase tracking-[0.2em] outline-none transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ice",
          pct >= 1 ? "border-ice/60 text-ice" : pct > 0 ? "border-ice/40 text-ice/90 scale-[0.985]" : "border-hairline text-foreground/85 hover:border-ice/30"
        )}
        style={{ touchAction: "none" }}
      >
        <Lock className="h-4 w-4" aria-hidden="true" />
        <span className="text-[11px]">{pct >= 1 ? "sealed" : pct > 0 ? "freezing" : "hold to"}</span>
        <span className="text-[11px]">{pct >= 1 ? "·" : pct > 0 ? `${Math.round(pct * 100)}%` : "freeze"}</span>
      </button>
    </div>
  );
}
