"use client";

import * as React from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Reveal } from "@/components/kl/reveal";
import { SectionHeading, Mono, MonoChip } from "@/components/kl/atoms";
/**
 * THE EVIDENCE — a receipt-style audit chain.
 * data → calculation → evidence → verdict, presented as a stamped
 * receipt: mono type, hairline separators, tamper-free seals.
 * Rows stream in as the page scrolls, connected by a fill line.
 */
export function LandingEvidence() {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 60%"] });
  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  const chain = [
    {
      key: "data",
      label: "Data",
      caption: "Bitget public candles, pulled only after the spec is frozen",
      note: "the browser never calls Bitget directly",
    },
    {
      key: "calc",
      label: "Calculation",
      caption: "Walk-forward, bootstrap, Deflated Sharpe, and PBO",
      note: "deterministic — same inputs, same outputs, every time",
    },
    {
      key: "evidence",
      label: "Evidence",
      caption: "Every number on the verdict screen is a field from that run",
      note: "missing fields stay blank",
    },
    {
      key: "verdict",
      label: "Verdict",
      caption: "KILLED, ALIVE, INCONCLUSIVE, or UNTESTABLE — whichever the engine returns",
      note: "sealed · reproducible from the frozen hash",
    },
  ];

  return (
    <section className="relative border-t border-hairline py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            index="05"
            eyebrow="The evidence"
            title={
              <>
                From raw data to a sealed verdict,
                <br />
                <span className="text-muted-foreground">every link is on the record.</span>
              </>
            }
            lead="A verdict you can't audit is just an opinion with formatting. KillLab receipts are reproducible: the frozen hash determines the data, the data determines the calculations, the calculations determine the verdict."
          />
        </Reveal>

        <div ref={ref} className="relative mt-14 grid gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          {/* ── The chain diagram ─────────────────────────── */}
          <div className="relative">
            {/* connector line */}
            <div aria-hidden="true" className="absolute left-[15px] top-4 hidden h-[calc(100%-32px)] w-px bg-hairline sm:block">
              {!reduce && (
                <motion.div
                  className="h-full w-px origin-top"
                  style={{
                    scaleY: lineScale,
                    background: "linear-gradient(180deg, color-mix(in oklch, var(--ice) 65%, transparent), color-mix(in oklch, var(--verdict-killed) 55%, transparent))",
                  }}
                />
              )}
            </div>

            <div className="space-y-4">
              {chain.map((link, i) => (
                <motion.div
                  key={link.key}
                  initial={reduce ? false : { opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-15% 0px" }}
                  transition={{ duration: 0.7, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  className="relative flex gap-5"
                >
                  <span
                    aria-hidden="true"
                    className="relative z-10 mt-1 hidden h-[31px] w-[31px] shrink-0 items-center justify-center rounded-full border border-hairline bg-background sm:flex"
                  >
                    <span className={`h-2 w-2 rounded-full ${link.key === "verdict" ? "bg-verdict-killed" : "bg-ice"}`} />
                  </span>
                  <div className="flex-1 rounded-xl border border-hairline bg-panel/60 p-5">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-mono text-[11px] uppercase tracking-[0.22em] text-ice">{link.label}</h3>
                      <span className="font-mono text-[10px] text-muted-foreground/50">step {i + 1}/4</span>
                    </div>
                    <p className="mt-2.5 font-mono text-[13px] leading-relaxed text-foreground/85">{link.caption}</p>
                    <p className="mt-1.5 text-[12.5px] text-muted-foreground">{link.note}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* ── The receipt ──────────────────────────────── */}
          <Reveal delay={0.1}>
            <div className="overflow-hidden rounded-2xl border border-hairline bg-panel">
              {/* receipt header */}
              <div className="flex items-center justify-between border-b border-dashed border-hairline px-6 py-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">
                    KillLab research receipt
                  </p>
                  <p className="mt-1 font-mono text-[12px] text-foreground/80">
                    hash · snapshot · engine version
                  </p>
                </div>
                <MonoChip tone="killed">sealed</MonoChip>
              </div>

              <ul className="px-6 py-4">
                {["Verdict", "Sample count", "Deflated Sharpe", "PBO", "Spec hash", "Engine version"].map((label) => (
                  <li key={label} className="flex items-center justify-between gap-4 border-b border-dashed border-hairline/60 py-3 last:border-0">
                    <p className="font-mono text-[12px] text-muted-foreground">{label}</p>
                    <Mono>from the run</Mono>
                  </li>
                ))}
              </ul>

              {/* receipt footer — the seal */}
              <div className="border-t border-dashed border-hairline px-6 py-4">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70">verdict</p>
                  <p className="kl-display font-mono text-lg uppercase tracking-[0.18em] text-foreground">after the run</p>
                </div>
                <p className="mt-1.5 font-mono text-[10.5px] leading-relaxed text-muted-foreground/50">
                  reproducible: hash → Bitget snapshot → engine → this receipt
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
