"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/kl/reveal";
import { SectionHeading, MonoChip } from "@/components/kl/atoms";

/**
 * REVIEW & SELF-EVOLUTION — the ledger rail.
 * KNOWN → UNKNOWN → TEST → RESULT → DECISION, shown as a horizontal
 * (desktop) / vertical (mobile) progression with a live example entry
 * walking through it. The point: the desk remembers, so the next
 * question is better than the last.
 */
const STAGES = [
  {
    key: "KNOWN",
    label: "Known",
    caption: "What the desk already believes — notes, priors, folklore.",
    example: "“Positive funding spikes mean-revert within days on BTC perps.”",
  },
  {
    key: "UNKNOWN",
    label: "Unknown",
    caption: "The belief sharpened into one falsifiable question.",
    example: "“Does funding ≥ +0.10% persist long enough to harvest a 48h carry?”",
  },
  {
    key: "TEST",
    label: "Test",
    caption: "The question frozen into a spec. Hash on record, nothing mutable.",
    example: "A content hash, written before any candle is requested.",
  },
  {
    key: "RESULT",
    label: "Result",
    caption: "The engine's numbers, receipts attached. Not negotiable, not tunable.",
    example: "Whatever the engine returns for that frozen spec.",
  },
  {
    key: "DECISION",
    label: "Decision",
    caption: "What the desk now does — and the next question this raises.",
    example: "“Trade small, hard 72h cap, weekly fill review.”",
  },
] as const;

export function LandingEvolution() {
  const reduce = useReducedMotion();

  return (
    <section id="evolution" className="relative border-t border-hairline py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            index="06"
            eyebrow="Review & self-evolution"
            title={
              <>
                The desk doesn&rsquo;t forget.
                <br />
                <span className="text-muted-foreground">That&rsquo;s the whole advantage.</span>
              </>
            }
            lead="After trading, fills are reviewed against the original forecast. What was learned enters the ledger, and the ledger sharpens the next question. Ideas die; the process compounds."
          />
        </Reveal>

        {/* ── The stage rail ─────────────────────────────── */}
        <Reveal delay={0.1} className="mt-16">
          <div className="relative">
            {/* connector (desktop) */}
            <div aria-hidden="true" className="absolute left-0 right-0 top-[13px] hidden h-px bg-hairline lg:block" />
            <motion.div
              aria-hidden="true"
              className="absolute left-0 right-0 top-[13px] hidden h-px origin-left lg:block"
              style={{ background: "linear-gradient(90deg, color-mix(in oklch, var(--ice) 55%, transparent), color-mix(in oklch, var(--ice) 20%, transparent))" }}
              initial={reduce ? false : { scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: "-20% 0px" }}
              transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
            />

            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
              {STAGES.map((stage, i) => (
                <motion.div
                  key={stage.key}
                  initial={reduce ? false : { opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-15% 0px" }}
                  transition={{ duration: 0.7, delay: 0.12 + i * 0.14, ease: [0.16, 1, 0.3, 1] }}
                  className="relative"
                >
                  {/* node */}
                  <div className="relative z-10 flex items-center gap-3 lg:block">
                    <span
                      className={`flex h-[27px] w-[27px] items-center justify-center rounded-full border font-mono text-[10px] ${
                        i === 4
                          ? "border-verdict-alive/40 bg-verdict-alive/10 text-verdict-alive"
                          : "border-ice/30 bg-ice/[0.07] text-ice"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-foreground/85 lg:mt-4 lg:block">
                      {stage.key}
                    </span>
                  </div>
                  <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{stage.caption}</p>
                  <p className="mt-2.5 border-l border-hairline pl-3 font-mono text-[11px] leading-relaxed text-foreground/55">
                    {stage.example}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* ── The loop note ─────────────────────────────── */}
        <Reveal delay={0.15} className="mt-14">
          <div className="relative overflow-hidden rounded-2xl border border-hairline bg-panel/60 p-7 sm:p-9">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-50"
              style={{ background: "radial-gradient(closest-side, color-mix(in oklch, var(--ice) 9%, transparent), transparent)" }}
            />
            <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <MonoChip tone="ice">the loop</MonoChip>
                <h3 className="kl-display mt-4 text-2xl text-foreground">
                  Every decision raises the next UNKNOWN.
                </h3>
                <p className="mt-3 max-w-lg text-[14.5px] leading-relaxed text-muted-foreground">
                  A decision can name the next question. That question is text only
                  until someone freezes a new spec. The desk does not invent a result
                  for a test that has not been run.
                </p>
              </div>
              <div className="rounded-xl border border-hairline bg-background/40 p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/60">
                  next question · not a result
                </p>
                <p className="mt-3 text-[14.5px] leading-relaxed text-foreground/85">
                  The next hypothesis is a sentence. It is stored only when you submit it, and it has no metrics until a new run finishes.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
