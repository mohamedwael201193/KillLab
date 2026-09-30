"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Logotype } from "@/components/kl/logotype";
import { HeroField } from "@/components/kl/hero-field";
import { ResearchMachine } from "@/components/kl/research-machine";
import { MonoChip, Kbd } from "@/components/kl/atoms";
import { Button } from "@/components/ui/button";
import { ArrowRight, Terminal } from "lucide-react";

export function LandingHero({ onEnterLab }: { onEnterLab: () => void }) {
  const reduce = useReducedMotion();

  return (
    <header className="relative overflow-hidden">
      <HeroField />

      {/* ── Nav ─────────────────────────────────────────── */}
      <nav className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-6 lg:px-8">
        <Logotype />
        <div className="hidden items-center gap-7 font-mono text-[11px] tracking-[0.14em] uppercase text-muted-foreground md:flex">
          {[
            ["Protocol", "#protocol"],
            ["Detectors", "#traps"],
            ["Verdicts", "#verdicts"],
            ["Ledger", "#evolution"],
          ].map(([label, href]) => (
            <a
              key={label}
              href={href}
              className="transition-colors duration-200 hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onEnterLab}
          className="kl-edge h-9 rounded-full border-hairline bg-secondary/50 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground/90 transition-all duration-300 hover:border-ice/40 hover:text-ice"
        >
          Open the desk
          <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </nav>

      {/* ── Hero ────────────────────────────────────────── */}
      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-10 px-6 pb-12 pt-10 sm:pt-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-8 lg:px-8 lg:pb-16 lg:pt-12">
        <div>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-wrap items-center gap-2"
          >
            <MonoChip tone="ice">AI Trading Desk</MonoChip>
            <MonoChip>Review &amp; Self-Evolution</MonoChip>
            <MonoChip>Qwen compiles. The engine computes.</MonoChip>
          </motion.div>

          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="kl-hero-title mt-6 max-w-3xl text-balance text-[2.8rem] text-foreground sm:text-6xl lg:text-[4.55rem]"
          >
            Don&rsquo;t let a convincing
            <br />
            backtest&nbsp;
            <span className="relative whitespace-nowrap">
              fool&nbsp;you.
              <motion.span
                aria-hidden="true"
                className="absolute -bottom-1 left-0 h-[2px] w-full origin-left rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, color-mix(in oklch, var(--ice) 60%, transparent), transparent)",
                }}
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1.2, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
              />
            </span>
          </motion.h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 max-w-xl text-pretty text-[16px] leading-relaxed text-muted-foreground sm:text-[17px]"
          >
            Qwen compiles the hypothesis into a bounded test. You freeze it.
            The engine decides on real Bitget data.
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.34, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 flex flex-wrap items-center gap-3"
          >
            <Button
              onClick={onEnterLab}
              size="lg"
              className="kl-edge group h-12 rounded-full bg-foreground px-7 text-[15px] font-medium text-background transition-all duration-300 hover:shadow-[0_0_44px_-8px] hover:shadow-ice/40"
            >
              <Terminal className="mr-2 h-4 w-4" aria-hidden="true" />
              Test an idea now
              <ArrowRight
                className="ml-1.5 h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Button>
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="h-12 rounded-full px-6 text-[15px] text-muted-foreground transition-colors duration-300 hover:bg-secondary/60 hover:text-foreground"
            >
              <a href="#protocol">See how it works</a>
            </Button>
          </motion.div>

          <motion.ol
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.48, ease: [0.16, 1, 0.3, 1] }}
            className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2"
            aria-label="Research loop"
          >
            {["Write", "Review", "Freeze", "Run", "Verdict", "Ledger"].map((step, index) => (
              <li key={step} className="flex items-center gap-2">
                <span className="rounded-full border border-hairline px-2.5 py-1 font-mono text-[11px] tracking-[0.08em] text-foreground/80">
                  {step}
                </span>
                {index < 5 ? (
                  <span aria-hidden="true" className="text-muted-foreground/40">
                    →
                  </span>
                ) : null}
              </li>
            ))}
          </motion.ol>

          <motion.dl
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.62 }}
            className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4"
          >
            {[
              ["105", "engine tests"],
              ["7", "research families"],
              ["4", "verdict states"],
              ["0.13.1", "engine"],
            ].map(([value, label]) => (
              <div key={label}>
                <dt className="font-mono text-[15px] text-foreground">{value}</dt>
                <dd className="text-[12px] text-muted-foreground">{label}</dd>
              </div>
            ))}
          </motion.dl>

          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.72 }}
            className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-muted-foreground/80"
          >
            <span className="inline-flex items-center gap-2">
              <Kbd>Enter</Kbd> open the desk
            </span>
            <span className="hidden items-center gap-2 sm:inline-flex">
              <Kbd>L</Kbd> research ledger
            </span>
            <span className="font-mono text-[11px] tracking-[0.08em] text-muted-foreground/60">
              live research API · Bitget public data
            </span>
          </motion.div>
        </div>

        {/* The signature artwork */}
        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 rounded-[2rem] opacity-60"
            style={{
              background:
                "radial-gradient(ellipse 62% 52% at 50% 42%, color-mix(in oklch, var(--ice) 7%, transparent), transparent 70%)",
            }}
          />
          <ResearchMachine className="mx-auto w-full max-w-[560px]" />
        </div>
      </div>
    </header>
  );
}
