"use client";

import * as React from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { useDesk, useActiveScenario } from "@/lib/desk/store";
import { MonoChip } from "@/components/kl/atoms";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

/**
 * RUN — waits on the run endpoint.
 * Log lines are engine status, not a timed script.
 */
export function RunView() {
  const scenario = useActiveScenario();
  const runProgram = useDesk((s) => s.runProgram);
  const runProgress = useDesk((s) => s.runProgress);
  const finishRun = useDesk((s) => s.finishRun);
  const error = useDesk((s) => s.error);
  const reduce = useReducedMotion();
  React.useEffect(() => {
    finishRun();
  }, [finishRun]);

  if (error) {
    return (
      <div className="mx-auto max-w-xl text-center" role="alert">
        <MonoChip tone="killed">run stopped</MonoChip>
        <h1 className="kl-display mt-4 text-2xl text-foreground">The engine returned an error.</h1>
        <p className="mt-3 font-mono text-[13px] text-verdict-killed">{error}</p>
      </div>
    );
  }

  if (!scenario) return null;
  if (!runProgress || runProgram.length === 0) return null;

  const frozen = scenario.frozen;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="text-center">
        <MonoChip tone="ice">step 4 · run</MonoChip>
        <h1 className="kl-display mt-4 text-2xl text-foreground sm:text-3xl">
          The engine is working.
        </h1>
        <p className="mx-auto mt-2.5 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
          {frozen.datasetVersion} · every number is being computed from the
          frozen spec — nothing can be adjusted from here.
        </p>
      </div>

      {/* Progress spine */}
      <div className="mt-9">
        <div className="h-1 overflow-hidden rounded-full bg-secondary/60">
          <motion.div
            className="h-full w-full rounded-full"
            style={{ background: "linear-gradient(90deg, color-mix(in oklch, var(--ice) 55%, transparent), var(--ice))" }}
            initial={reduce ? false : { opacity: 0.35 }}
            animate={{ opacity: [0.35, 0.9, 0.35] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        {/* Stage list */}
        <div className="mt-6 space-y-1.5">
          {runProgram.map((s, i) => {
            const done = i < runProgress.stageIndex;
            const active = i === runProgress.stageIndex;
            return (
              <motion.div
                key={s.key}
                initial={false}
                animate={{
                  opacity: done || active ? 1 : 0.45,
                }}
                transition={{ duration: 0.4 }}
                className={cn(
                  "flex items-center gap-3.5 rounded-xl border px-4 py-3 transition-colors duration-500",
                  active ? "border-ice/30 bg-ice/[0.045]" : "border-transparent"
                )}
              >
                {/* status glyph */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                    done
                      ? "border-verdict-alive/40 bg-verdict-alive/10 text-verdict-alive"
                      : active
                        ? "border-ice/50 text-ice"
                        : "border-hairline text-muted-foreground/40"
                  )}
                >
                  {done ? <Check className="h-3 w-3" /> : active ? <PulseDot reduce={reduce} /> : <span className="h-1 w-1 rounded-full bg-current" />}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={cn("text-[13.5px] font-medium", active ? "text-ice" : done ? "text-foreground/80" : "text-muted-foreground")}>
                      {s.label}
                    </p>
                    {active && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ice/70">running</span>
                    )}
                  </div>
                  {active && <p className="mt-0.5 text-[12px] text-muted-foreground">{s.detail}</p>}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Engine console */}
        <div className="mt-6 overflow-hidden rounded-xl border border-hairline bg-[oklch(0.1_0.005_250)]">
          <div className="flex items-center justify-between border-b border-hairline/70 px-4 py-2.5">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground/60">engine log</p>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground/50">
              opens when the engine returns
            </p>
          </div>
          <div className="kl-scroll h-28 overflow-y-auto px-4 py-3" aria-live="polite">
            <AnimatePresence initial={false}>
              {runProgress.visibleLogs.map((line, i) => (
                <motion.p
                  key={`${line}-${i}`}
                  initial={reduce ? false : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="font-mono text-[11.5px] leading-relaxed text-foreground/70"
                >
                  <span className="mr-2 text-ice/60">›</span>
                  {line}
                </motion.p>
              ))}
            </AnimatePresence>
            {runProgress.visibleLogs.length === 0 && (
              <p className="font-mono text-[11.5px] text-muted-foreground/40">awaiting stage output…</p>
            )}
          </div>
        </div>

        {/* Freeze receipt line */}
        <p className="mt-5 text-center font-mono text-[10.5px] leading-relaxed text-muted-foreground/50">
          frozen {frozen.freezeHash} · {frozen.engineVersion}
        </p>
      </div>
    </div>
  );
}

function PulseDot({ reduce }: { reduce: boolean | null }) {
  if (reduce) return <span className="h-1.5 w-1.5 rounded-full bg-current" />;
  return (
    <motion.span
      className="h-1.5 w-1.5 rounded-full bg-current"
      animate={{ scale: [1, 1.7, 1], opacity: [0.6, 1, 0.6] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}
