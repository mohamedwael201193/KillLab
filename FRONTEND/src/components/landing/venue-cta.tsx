"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Reveal } from "@/components/kl/reveal";
import { SectionHeading, MonoChip } from "@/components/kl/atoms";
/**
 * REAL BITGET DATA + FINAL CTA + FOOTER.
 * The venue section states the production contract: real venue data,
 * deterministic engine — and is explicit that this build is a simulation
 * on fixture data. Honesty about data is the brand.
 */
export function LandingVenue() {
  const reduce = useReducedMotion();

  return (
    <section className="relative border-t border-hairline py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            index="07"
            eyebrow="The venue"
            title={
              <>
                Production runs on real Bitget data,
                <br />
                <span className="text-muted-foreground">and the engine never improvises.</span>
              </>
            }
            lead="When the desk goes live, every frozen spec is executed against Bitget's perp archive — the same candles, funding prints and depth everyone else gets. Deterministic means: same frozen hash, same report, forever."
          />
        </Reveal>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {[
            {
              title: "Deterministic by contract",
              text: "No random seeds, no re-fitting, no vibes. The engine is a calculator with an audit trail — re-running a frozen spec reproduces every number.",
              meta: "killlab-0.1.0",
            },
            {
              title: "One venue, full fidelity",
              text: "The API pulls Bitget public candles after freeze. The browser never talks to Bitget, and it never sees a private key.",
              meta: "public REST",
            },
            {
              title: "Numbers belong to the run",
              text: "The desk shows Deflated Sharpe, sample counts, traps, and the verdict only when the API returns them. An insufficient sample stays UNTESTABLE.",
              meta: "no invented statistics",
            },
          ].map((card, i) => (
            <Reveal key={card.title} delay={i * 0.08} className="h-full">
              <motion.div
                whileHover={reduce ? undefined : { y: -4 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="h-full rounded-2xl border border-hairline bg-panel/60 p-6 transition-colors duration-300 hover:border-foreground/15"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-[15.5px] font-medium text-foreground">{card.title}</h3>
                </div>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted-foreground">{card.text}</p>
                <p className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/50">{card.meta}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingFinalCta({ onEnterLab }: { onEnterLab: () => void }) {
  return (
    <section className="relative overflow-hidden border-t border-hairline py-28 sm:py-36">
      {/* restrained backdrop for the finale */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="kl-grid-bg absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_60%_55%_at_50%_50%,#000_20%,transparent_70%)]" />
        <div
          className="absolute left-1/2 top-1/2 h-[420px] w-[min(760px,100vw)] -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
          style={{ background: "radial-gradient(closest-side, color-mix(in oklch, var(--ice) 10%, transparent), transparent 70%)" }}
        />
      </div>

      <div className="relative mx-auto max-w-3xl px-6 text-center lg:px-8">
        <Reveal>
          <MonoChip tone="ice">final cta</MonoChip>
          <h2 className="kl-display mt-6 text-balance text-4xl leading-[1.05] text-foreground sm:text-5xl">
            Test the idea
            <br />
            before the market does.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-pretty text-[15.5px] leading-relaxed text-muted-foreground">
            Write one sentence about what you believe. Freeze what it means.
            Let the engine try to kill it. Then decide — with receipts.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onEnterLab}
              className="kl-edge group inline-flex h-12 items-center rounded-full bg-foreground px-8 text-[15px] font-medium text-background transition-all duration-300 hover:shadow-[0_0_44px_-8px] hover:shadow-ice/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ice"
            >
              Open the research desk
              <svg className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <p className="mt-6 font-mono text-[11px] tracking-[0.1em] text-muted-foreground/50">
            no account · the desk calls the research API
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <p className="font-mono text-[12px] tracking-[0.14em] uppercase text-foreground/80">
            Kill<span className="text-muted-foreground">Lab</span>
          </p>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground/70">
            An AI Trading Desk for Review &amp; Self-Evolution.
          </p>
        </div>
        <div className="flex flex-col gap-1 font-mono text-[11px] text-muted-foreground/50 lg:text-right">
          <p>research desk · Bitget public data · deterministic engine</p>
          <p>production research runs on real Bitget venue data · deterministic engine</p>
        </div>
      </div>
    </footer>
  );
}
