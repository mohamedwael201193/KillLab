"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/kl/reveal";
import { SectionHeading, MonoChip } from "@/components/kl/atoms";
import { cn } from "@/lib/utils";

/**
 * THE VERDICT — three endings, one visual grammar:
 * the aperture. The same signal passes through the same frame;
 * only the outcome geometry differs.
 */
export function LandingVerdicts() {
  return (
    <section id="verdicts" className="relative border-t border-hairline py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            index="04"
            eyebrow="The verdict"
            title={
              <>
                Every frozen test ends
                <br />
                <span className="text-muted-foreground">in exactly one of three places.</span>
              </>
            }
            lead="No score out of ten. No star rating. The engine states which of three worlds you are in — and every number behind that statement is reproducible from the frozen spec."
            align="center"
          />
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          <VerdictCard verdict="KILLED" delay={0} />
          <VerdictCard verdict="ALIVE" delay={0.1} />
          <VerdictCard verdict="UNTESTABLE" delay={0.2} />
        </div>

        <Reveal delay={0.15} className="mt-10">
          <p className="mx-auto max-w-xl text-center text-[13.5px] leading-relaxed text-muted-foreground/80">
            The AI explains what these results mean, in plain language. It never
            owns the numbers, and it never issues the verdict — that belongs to
            the engine alone.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

const VERDICT_META = {
  KILLED: {
    color: "var(--verdict-killed)",
    chip: "killed" as const,
    title: "The idea did not survive review.",
    points: [
      ["The floor failed", "Kill-floor criteria were evaluated against out-of-sample, deflated, cost-charged numbers."],
      ["A trap was caught", "Multiple testing, overfitting, costs, regime — the lie was found and named."],
      ["It ends here", "The variant family is retired for this window. Re-testing means a new frozen spec — not a tuned one."],
    ],
    signal: "cut" as const,
  },
  ALIVE: {
    color: "var(--verdict-alive)",
    chip: "alive" as const,
    title: "It survived — so far.",
    points: [
      ["The floor held", "Every kill-floor criterion passed on walk-forward, deflated, cost-charged numbers."],
      ["Permission, not proof", "ALIVE means the idea earned the right to be traded carefully and reviewed honestly."],
      ["Fills get reviewed", "After trading, real executions are compared against the frozen forecast. That's where thin edges tell the truth."],
    ],
    signal: "pass" as const,
  },
  UNTESTABLE: {
    color: "var(--verdict-untestable)",
    chip: "untestable" as const,
    title: "It could not be judged honestly.",
    points: [
      ["The gates refused", "Too few events, incomplete data, structural bias — the sample cannot support statistics."],
      ["No numbers were invented", "The engine would rather withhold a verdict than manufacture one from noise."],
      ["Unknown, not dead", "The idea stays in the ledger as an open question, waiting for a better-specified test."],
    ],
    signal: "withhold" as const,
  },
};

function VerdictCard({ verdict, delay }: { verdict: keyof typeof VERDICT_META; delay: number }) {
  const meta = VERDICT_META[verdict];
  const reduce = useReducedMotion();

  return (
    <Reveal delay={delay} className="h-full">
      <motion.div
        whileHover={reduce ? undefined : { y: -5 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex h-full flex-col rounded-2xl border border-hairline bg-panel/70 p-7 transition-colors duration-300"
        style={{ ["--vc" as string]: meta.color }}
      >
        {/* Aperture visual */}
        <VerdictAperture signal={meta.signal} color={meta.color} reduce={reduce} />

        <div className="mt-6 flex items-center justify-between">
          <h3 className="kl-display font-mono text-2xl uppercase tracking-[0.18em]" style={{ color: meta.color }}>
            {verdict}
          </h3>
          <MonoChip tone={meta.chip}>final state</MonoChip>
        </div>

        <p className="mt-2 text-[15px] font-medium text-foreground/90">{meta.title}</p>

        <ul className="mt-5 space-y-4 border-t border-hairline pt-5">
          {meta.points.map(([label, text]) => (
            <li key={label} className="flex gap-3">
              <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full" style={{ background: meta.color }} />
              <div>
                <p className="text-[13.5px] font-medium text-foreground/90">{label}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </motion.div>
    </Reveal>
  );
}

/** The verdict aperture — one geometry, three outcomes. */
function VerdictAperture({ signal, color, reduce }: { signal: "cut" | "pass" | "withhold"; color: string; reduce: boolean | null }) {
  return (
    <div className="flex h-24 items-center justify-center">
      <svg viewBox="0 0 160 96" fill="none" className="h-full w-auto" aria-hidden="true">
        {/* frame */}
        <rect x="8" y="10" width="144" height="76" rx="8" stroke="oklch(1 0 0 / 14%)" strokeWidth="1.2" />
        {/* incoming signal */}
        <motion.path
          d="M14 48 H 58"
          stroke="oklch(1 0 0 / 40%)"
          strokeWidth="2"
          strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        />
        {/* gate */}
        <path d="M66 30 v36 M66 30 l10 8 M66 66 l10 -8" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
        {signal === "pass" && (
          <motion.path
            d="M84 48 H 146"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.5 }}
          />
        )}
        {signal === "cut" && (
          <>
            <motion.path
              d="M84 48 H 96"
              stroke={color}
              strokeWidth="2.2"
              strokeLinecap="round"
              initial={reduce ? false : { pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.45 }}
            />
            {/* the scissors cut mark */}
            <motion.path
              d="M104 38 L 118 58 M118 38 L 104 58"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              initial={reduce ? false : { opacity: 0, scale: 0.6 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: 0.85 }}
              style={{ transformOrigin: "111px 48px" }}
            />
          </>
        )}
        {signal === "withhold" && (
          <>
            {/* signal stops at the gate and turns into a question */}
            <motion.path
              d="M84 48 H 96"
              stroke={color}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeDasharray="4 5"
              initial={reduce ? false : { pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.45 }}
            />
            <text x="112" y="56" fill={color} fontSize="26" fontFamily="var(--font-geist-mono)" opacity="0.9">
              ?
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
