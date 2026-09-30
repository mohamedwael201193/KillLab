"use client";

import * as React from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/kl/reveal";
import { SectionHeading } from "@/components/kl/atoms";
import { cn } from "@/lib/utils";

/**
 * HOW KILLLAB WORKS — the protocol rail.
 * A vertical spine on desktop that fills as you scroll, with seven steps.
 * The freeze line is deliberately the visual hinge of the whole section:
 * everything before is the trader's world, everything after is the engine's.
 */
const STEPS = [
  {
    id: "write",
    label: "Write the hypothesis",
    text: "Plain language, your words. What you believe, when you'd act, on what.",
    detail: "“Trade NVDA and TSLA perps after earnings in the direction of the after-hours move.”",
    side: "trader" as const,
  },
  {
    id: "draft",
    label: "AI drafts the test spec",
    text: "Qwen turns the sentence into instruments, windows, variants, and a kill floor. It does not compute the verdict.",
    detail: "family · instruments · window · variants · baselines",
    side: "trader" as const,
  },
  {
    id: "review",
    label: "You review every field",
    text: "This is the last moment anything can change. Ambiguity here becomes irreproducibility later.",
    detail: "instruments · windows · variants · kill floor · data needs",
    side: "trader" as const,
  },
  {
    id: "freeze",
    label: "Freeze",
    text: "The spec is hashed and sealed. From here, not a comma moves — not by you, not by the AI.",
    detail: "sha256 of the canonical spec",
    side: "hinge" as const,
  },
  {
    id: "pull",
    label: "Venue data is pulled",
    text: "Only now does Bitget data enter the room. After the decision, the family pack can attach candles, the forward book, open interest, official Signal, and the US-stock quote. A fallback stays labeled as a fallback.",
    detail: "Bitget public REST · after freeze",
    side: "engine" as const,
  },
  {
    id: "analyze",
    label: "Deterministic analysis",
    text: "Walk-forward folds, bootstrap confidence, Deflated Sharpe, PBO. Same inputs, same report, every time.",
    detail: "same inputs, same report",
    side: "engine" as const,
  },
  {
    id: "verdict",
    label: "The verdict",
    text: "KILLED, ALIVE, INCONCLUSIVE, or UNTESTABLE. A saved research posture can change the next question. It cannot change this label, the interval, or the costs.",
    detail: "KILLED, ALIVE, INCONCLUSIVE, or UNTESTABLE",
    side: "engine" as const,
  },
];

export function LandingProtocol() {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 70%", "end 55%"],
  });
  const spineScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section id="protocol" className="relative border-t border-hairline py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            index="02"
            eyebrow="How KillLab works"
            title={
              <>
                Define exactly what you&rsquo;re testing
                <br />
                <span className="text-muted-foreground">before you ever see the data.</span>
              </>
            }
            lead="The protocol has one hard hinge — the freeze. Before it, the idea is yours to shape. After it, the engine owns every number. The AI drafts and explains; it never judges."
          />
        </Reveal>

        <div ref={ref} className="relative mt-16 lg:pl-2">
          {/* The spine */}
          <div className="absolute left-[19px] top-2 hidden h-[calc(100%-16px)] w-px bg-hairline sm:block lg:left-[27px]">
            {!reduce && (
              <motion.div
                className="h-full w-px origin-top"
                style={{
                  scaleY: spineScale,
                  background:
                    "linear-gradient(180deg, transparent, color-mix(in oklch, var(--ice) 70%, transparent) 12%, color-mix(in oklch, var(--ice) 70%, transparent) 88%, transparent)",
                }}
              />
            )}
          </div>

          <StaggerGroup className="space-y-3">
            {STEPS.map((step, i) => (
              <StaggerItem key={step.id}>
                <ProtocolStep step={step} index={i} reduce={reduce} />
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </div>
    </section>
  );
}

function ProtocolStep({
  step,
  index,
  reduce,
}: {
  step: (typeof STEPS)[number];
  index: number;
  reduce: boolean | null;
}) {
  const isHinge = step.side === "hinge";
  return (
    <motion.div
      whileHover={reduce ? undefined : { x: 4 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative flex gap-5 rounded-2xl border p-5 sm:p-6 lg:pl-8",
        isHinge
          ? "border-ice/25 bg-ice/[0.045] shadow-[0_0_60px_-30px] shadow-ice/50"
          : "border-hairline bg-panel/60 hover:border-foreground/15"
      )}
    >
      {/* Node on the spine */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute -left-[13px] top-7 hidden h-[9px] w-[9px] rounded-full border sm:block lg:-left-[5px]",
          isHinge
            ? "border-ice bg-ice shadow-[0_0_14px_2px] shadow-ice/50"
            : "border-foreground/30 bg-background"
        )}
      />

      {/* Number */}
      <span
        className={cn(
          "hidden font-mono text-[11px] tabular-nums sm:block",
          isHinge ? "text-ice" : "text-muted-foreground/60"
        )}
      >
        {String(index + 1).padStart(2, "0")}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h3 className={cn("text-[16px] font-medium", isHinge ? "text-ice" : "text-foreground")}>
            {step.label}
          </h3>
          {isHinge && (
            <span className="rounded-full border border-ice/30 bg-ice/10 px-2 py-px font-mono text-[9.5px] uppercase tracking-[0.18em] text-ice">
              the hinge
            </span>
          )}
          {step.side === "trader" && (
            <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/50">your world</span>
          )}
          {step.side === "engine" && (
            <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/50">engine world</span>
          )}
        </div>
        <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-muted-foreground">{step.text}</p>
        <p className={cn("mt-2.5 font-mono text-[11.5px] tracking-tight", isHinge ? "text-ice/80" : "text-foreground/60")}>
          {step.detail}
        </p>
      </div>
    </motion.div>
  );
}
