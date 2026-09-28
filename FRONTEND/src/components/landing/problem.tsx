"use client";

import * as React from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Reveal } from "@/components/kl/reveal";
import { SectionHeading, MonoChip, Mono } from "@/components/kl/atoms";
import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";

/**
 * THE PROBLEM — a single equity curve that changes its story as you scroll.
 * The same chart, three honesties: as shown, with costs, out-of-sample.
 * One line, three truths — that is the entire problem KillLab exists for.
 */
export function LandingProblem() {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Phase drives the story: 0 → as shown · 0.5 → costs charged · 1 → out-of-sample
  const [phase, setPhase] = React.useState(0);
  React.useEffect(() => {
    if (reduce) return;
    const unsub = scrollYProgress.on("change", (v) => {
      setPhase(v < 0.35 ? 0 : v < 0.62 ? 1 : 2);
    });
    return () => unsub();
  }, [scrollYProgress, reduce]);

  const shown = reduce ? 2 : phase;
  const caption = PHASES[shown];

  return (
    <section ref={ref} className="relative border-t border-hairline py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            index="01"
            eyebrow="The problem"
            title={
              <>
                Every backtest tells you a story.
                <br />
                <span className="text-muted-foreground">Some of them lie.</span>
              </>
            }
            lead="The curve that convinced you was selected, cost-free, and fitted to the past. It looks exactly like a real edge — right up until it isn't. Watch what happens when one number at a time is treated honestly."
          />
        </Reveal>

        <Reveal delay={0.12} className="mt-14">
          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
            {/* ── The chart that confesses ─────────────────── */}
            <div className="relative overflow-hidden rounded-2xl border border-hairline bg-panel p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    Post-earnings momentum · NVDA + TSLA perps
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground/70">
                    a claim, before any Bitget candle is requested
                  </p>
                </div>
                <motion.div key={shown} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                  <MonoChip tone={shown === 0 ? "ice" : shown === 1 ? "untestable" : "killed"}>{caption.chip}</MonoChip>
                </motion.div>
              </div>

              <ConfessingChart phase={shown} />

              <div className="mt-6 grid gap-3 border-t border-hairline pt-5 sm:grid-cols-3">
                {caption.stats.map((s, i) => (
                  <div key={s.label}>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">{s.label}</p>
                    <motion.p
                      key={`${shown}-${i}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.45 }}
                      className={`mt-1 font-mono text-lg ${s.tone}`}
                    >
                      {s.value}
                    </motion.p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Marginalia ───────────────────────────────── */}
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-hairline bg-panel p-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">What the backtest claimed</p>
                <p className="mt-3 text-[14.5px] leading-relaxed text-foreground/90">
                  “The curve looks clean. One variant is shown. Costs are a footnote.”
                </p>
              </div>
              <div className="rounded-2xl border border-hairline bg-panel p-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">What the desk found</p>
                <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
                  The desk freezes the variant set first, then scores the idea on Bitget
                  data. If the sample cannot carry a statistic, the verdict is
                  UNTESTABLE and no Sharpe is invented.
                </p>
              </div>
              <div className="mt-auto rounded-2xl border border-verdict-killed/20 bg-verdict-killed/5 p-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-verdict-killed/80">Engine verdict</p>
                <p className="kl-display mt-2 text-2xl text-foreground">from the run</p>
                <p className="mt-1.5 text-[13px] text-muted-foreground">
                  The story was real. The edge was not.
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1} className="mt-12">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mx-auto flex rounded-full font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
          >
            <a href="#protocol">
              So KillLab forces the truth out
              <ArrowDown className="ml-2 h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </Button>
        </Reveal>
      </div>
    </section>
  );
}

/* One chart, three honesties — drawn as smooth paths that morph. */
function ConfessingChart({ phase }: { phase: number }) {
  const reduce = useReducedMotion();
  const W = 620;
  const H = 210;
  const series = [SERIES_SHOWN, SERIES_COSTS, SERIES_OOS];

  return (
    <div className="relative mt-6">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="The same backtest, shown three ways: as presented, after costs, and out-of-sample. Only the first looks profitable.">
        {/* zero line */}
        <line x1="0" y1={H * 0.62} x2={W} y2={H * 0.62} stroke="oklch(1 0 0 / 8%)" strokeDasharray="3 6" />
        {/* faded original for reference in later phases */}
        <path
          d={buildPath(SERIES_SHOWN, W, H)}
          fill="none"
          stroke="oklch(1 0 0 / 10%)"
          strokeWidth="1.4"
          strokeDasharray="4 5"
        />
        {/* the live series morphs between honesties */}
        {series.map((s, i) => (
          <motion.path
            key={i}
            d={buildPath(s, W, H)}
            fill="none"
            stroke={i === phase ? "var(--ice)" : "transparent"}
            strokeWidth={i === phase ? 2.4 : 2}
            strokeLinecap="round"
            initial={false}
            animate={reduce ? {} : { opacity: i === phase ? 1 : 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
        ))}
        {/* end marker */}
        {series.map((s, i) => (
          <motion.circle
            key={`dot-${i}`}
            cx={W - 4}
            cy={scaleY(s[s.length - 1], H)}
            r="3.4"
            fill={i === phase ? "var(--ice)" : "transparent"}
            animate={reduce ? {} : { opacity: i === phase ? 1 : 0 }}
            transition={{ duration: 0.6 }}
          />
        ))}
        {/* phase labels */}
        <text x="8" y="16" fill="oklch(0.55 0.008 250)" fontSize="10" fontFamily="var(--font-geist-mono)" letterSpacing="1.8">
          {["AS SHOWN TO YOU", "WITH COSTS CHARGED", "OUT-OF-SAMPLE, DEFLATED"][phase]}
        </text>
      </svg>
    </div>
  );
}

/* Deterministic sample series — 48 points each. */
const SERIES_SHOWN = (() => {
  const pts: number[] = [];
  for (let i = 0; i < 48; i++) pts.push(Math.round((i / 47) ** 0.9 * 34.2 * 10) / 10);
  return pts;
})();

const SERIES_COSTS = (() => {
  const pts: number[] = [];
  for (let i = 0; i < 48; i++) pts.push(Math.round((i / 47) ** 1.4 * 9.4 * 10) / 10);
  return pts;
})();

const SERIES_OOS = (() => {
  const pts: number[] = [];
  for (let i = 0; i < 48; i++) {
    const t = i / 47;
    const v = t < 0.34 ? t * 33 : 11.4 - (t - 0.34) * 42;
    pts.push(Math.round(v * 10) / 10);
  }
  return pts;
})();

function scaleY(v: number, H: number) {
  const min = -8;
  const max = 36;
  const t = (v - min) / (max - min);
  return H - 12 - t * (H - 24);
}

function buildPath(series: number[], W: number, H: number) {
  return series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * (W - 8) + 4;
      const y = scaleY(v, H);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

const PHASES = [
  {
    chip: "As shown",
    stats: [
      { label: "Story", value: "best variant shown", tone: "text-ice" },
      { label: "Selection", value: "after the fact", tone: "text-ice" },
      { label: "Costs", value: "not yet charged", tone: "text-foreground/80" },
    ],
  },
  {
    chip: "Costs charged",
    stats: [
      { label: "Costs", value: "frozen schedule", tone: "text-verdict-untestable" },
      { label: "Baseline", value: "required", tone: "text-verdict-untestable" },
      { label: "Fees", value: "included", tone: "text-foreground/80" },
    ],
  },
  {
    chip: "Out-of-sample",
    stats: [
      { label: "Sample", value: "from the tape", tone: "text-verdict-killed" },
      { label: "Deflation", value: "counts every variant", tone: "text-verdict-killed" },
      { label: "Verdict", value: "engine only", tone: "text-verdict-killed" },
    ],
  },
] as const;
