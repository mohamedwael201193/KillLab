"use client";

import * as React from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Reveal } from "@/components/kl/reveal";
import { SectionHeading } from "@/components/kl/atoms";
import { researchData } from "@/lib/research/data-source";
import { cn } from "@/lib/utils";

/**
 * THE NINE TRAPS — an interactive constellation.
 *
 * A 3×3 grid of gate glyphs; hovering/focusing a trap ignites it and
 * streams its evidence into the reading pane on the right. On mobile the
 * pane renders inline under the grid. Each trap has an original minimal
 * glyph — the visual grammar is: gates the signal must pass through.
 */
export function LandingTraps() {
  const traps = React.useMemo(() => researchData.listTraps(), []);
  const [activeId, setActiveId] = React.useState(traps[0].id);
  const active = traps.find((t) => t.id === activeId) ?? traps[0];
  const reduce = useReducedMotion();

  return (
    <section id="traps" className="relative border-t border-hairline py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            index="03"
            eyebrow="The nine traps"
            title={
              <>
                Nine known ways a backtest lies.
                <br />
                <span className="text-muted-foreground">Every test is scanned for all of them.</span>
              </>
            }
            lead="These aren't exotic — they're the standard ways convincing research fools smart people. KillLab scans every frozen test against all nine and names each one it finds."
          />
        </Reveal>

        <Reveal delay={0.12} className="mt-14">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            {/* ── The constellation grid ─────────────────── */}
            <div
              role="tablist"
              aria-label="The nine traps"
              className="grid grid-cols-3 gap-2 sm:gap-3"
              onMouseLeave={() => {}}
            >
              {traps.map((trap) => {
                const isActive = trap.id === activeId;
                return (
                  <button
                    key={trap.id}
                    role="tab"
                    aria-selected={isActive}
                    onMouseEnter={() => setActiveId(trap.id)}
                    onFocus={() => setActiveId(trap.id)}
                    onClick={() => setActiveId(trap.id)}
                    className={cn(
                      "group relative flex aspect-[1.05/1] flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border p-3 text-center outline-none transition-colors duration-300",
                      isActive
                        ? "border-ice/40 bg-ice/[0.06]"
                        : "border-hairline bg-panel/50 hover:border-foreground/15"
                    )}
                  >
                    {/* index watermark */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute right-2 top-1.5 font-mono text-[10px] tabular-nums transition-colors",
                        isActive ? "text-ice/60" : "text-muted-foreground/25"
                      )}
                    >
                      {trap.index}
                    </span>
                    <TrapGlyph id={trap.id} active={isActive} reduce={reduce} />
                    <span
                      className={cn(
                        "text-[11.5px] font-medium leading-tight transition-colors sm:text-[12.5px]",
                        isActive ? "text-ice" : "text-foreground/75"
                      )}
                    >
                      {trap.name}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ── Reading pane ──────────────────────────── */}
            <div className="relative min-h-[280px] overflow-hidden rounded-2xl border border-hairline bg-panel p-6 sm:p-8 lg:min-h-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active.id}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="flex items-center gap-3">
                    <TrapGlyph id={active.id} active reduce={reduce} className="h-8 w-8" />
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                        trap {active.index} · {active.category}
                      </p>
                      <h3 className="kl-display text-xl text-foreground">{active.name}</h3>
                    </div>
                  </div>

                  <p className="mt-5 text-[16px] leading-relaxed text-ice">{active.tagline}</p>

                  <p className="mt-4 text-[14.5px] leading-relaxed text-muted-foreground">
                    {active.description}
                  </p>

                  <div className="mt-6 rounded-xl border border-hairline bg-secondary/30 p-4">
                    <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground/60">
                      how KillLab detects it
                    </p>
                    <p className="mt-1.5 font-mono text-[12.5px] leading-relaxed text-foreground/80">
                      {active.detection}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Original trap glyphs — one geometric grammar, nine variations.     */
/* Each is a "gate" motif: a signal that must pass honestly through.  */
/* ------------------------------------------------------------------ */

function TrapGlyph({
  id,
  active,
  reduce,
  className,
}: {
  id: string;
  active: boolean;
  reduce: boolean | null;
  className?: string;
}) {
  const stroke = active ? "var(--ice)" : "currentColor";
  const cls = cn(
    "h-9 w-9 shrink-0 transition-colors duration-300",
    active ? "text-ice" : "text-muted-foreground/50",
    className
  );

  const animate = !reduce && active;

  switch (id) {
    case "multiple-testing": // many paths, one spotlighted
      return (
        <motion.svg viewBox="0 0 40 40" fill="none" className={cls} animate={animate ? { rotate: [0, 2, -2, 0] } : undefined} transition={{ duration: 5, repeat: Infinity }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={`M6 32 ${[`C 14 ${32 - i * 5}, 22 ${32 - i * 5}, 34 ${10 + i * 4}`, `C 14 ${30 - i * 2}, 24 ${34 - i * 2}, 34 ${12 + i * 4}`][i % 2]}`} stroke={i === 2 ? stroke : "currentColor"} strokeOpacity={i === 2 ? 0.95 : 0.28} strokeWidth="1.6" strokeLinecap="round" />
          ))}
        </motion.svg>
      );
    case "overfitting": // a line bending to touch every dot
      return (
        <motion.svg viewBox="0 0 40 40" fill="none" className={cls} animate={animate ? { x: [0, 1, -1, 0] } : undefined} transition={{ duration: 4, repeat: Infinity }}>
          <path d="M6 30 C 14 30, 14 22, 20 22 S 26 30, 30 16 S 34 10, 35 9" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
          {[[13, 27], [19, 21], [25, 26], [30, 15], [35, 9]].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="1.6" fill={stroke} />
          ))}
        </motion.svg>
      );
    case "survivorship": // several candles, some faded to ghost
      return (
        <svg viewBox="0 0 40 40" fill="none" className={cls}>
          {[[10, 26, true], [18, 18, true], [26, 12, true], [33, 20, false]].map(([cx, top, alive], i) => (
            <g key={i} opacity={alive ? 1 : 0.25}>
              <line x1={cx as number} y1={6} x2={cx as number} y2={34} stroke="currentColor" strokeWidth="1.2" />
              <rect x={(cx as number) - 3} y={top as number} width="6" height="10" rx="1" stroke={alive ? stroke : "currentColor"} strokeWidth="1.4" />
            </g>
          ))}
        </svg>
      );
    case "look-ahead": // clock hand escaping its boundary
      return (
        <motion.svg viewBox="0 0 40 40" fill="none" className={cls}>
          <circle cx="20" cy="22" r="12" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.4" />
          <motion.path
            d="M20 22 L20 12"
            stroke={stroke}
            strokeWidth="1.8"
            strokeLinecap="round"
            animate={animate ? { rotate: [0, 360] } : undefined}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "20px 22px" }}
          />
          <path d="M20 22 L27 26" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M33 6 l5 -5 M35 4 l3 3" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
        </motion.svg>
      );
    case "cost-blindness": // edge being eaten
      return (
        <svg viewBox="0 0 40 40" fill="none" className={cls}>
          <path d="M6 10 C 16 10, 24 14, 34 20" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
          {[
            "M12 24 l4 4",
            "M19 22 l4 4",
            "M26 20 l4 4",
          ].map((d, i) => (
            <path key={i} d={d} stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.4" strokeLinecap="round" />
          ))}
          <path d="M7 34 H 33" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.2" strokeDasharray="3 4" />
        </svg>
      );
    case "liquidity": // big order meeting a thin book
      return (
        <svg viewBox="0 0 40 40" fill="none" className={cls}>
          {[[8, 30, 3.4], [16, 24, 2.6], [24, 18, 1.8], [31, 13, 1.1]].map(([x, y, w], i) => (
            <rect key={i} x={(x as number) - (w as number)} y={y as number} width={(w as number) * 2} height="3" rx="1.2" fill={stroke} fillOpacity={0.28 + i * 0.16} />
          ))}
          <circle cx="33" cy="7" r="3" stroke={stroke} strokeWidth="1.5" />
          <path d="M33 10 v2" stroke={stroke} strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "regime": // edge that only exists in one band
      return (
        <svg viewBox="0 0 40 40" fill="none" className={cls}>
          <rect x="5" y="8" width="30" height="26" rx="3" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.3" />
          <path d="M9 28 H 17" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
          <path d="M22 28 H 31" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
          <line x1="19" y1="10" x2="19" y2="32" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
        </svg>
      );
    case "small-sample": // two points pretending to be a trend
      return (
        <svg viewBox="0 0 40 40" fill="none" className={cls}>
          <circle cx="12" cy="28" r="2.6" fill={stroke} />
          <circle cx="28" cy="14" r="2.6" fill={stroke} />
          <path d="M12 28 C 18 26, 22 16, 28 14" stroke={stroke} strokeWidth="1.2" strokeDasharray="2.5 3" strokeLinecap="round" />
          <path d="M6 34 q 4 -2 6 -6 M34 8 q -4 2 -6 6" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "outlier": // one huge peak holding up a modest line
      return (
        <svg viewBox="0 0 40 40" fill="none" className={cls}>
          <line x1="5" y1="33" x2="35" y2="33" stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.2" />
          {[[11, 26, 5], [17, 25, 6], [23, 24, 5], [29, 26, 4]].map(([x, y, h], i) => (
            <rect key={i} x={x as number} y={y as number} width="3" height={h as number} rx="1" fill={stroke} fillOpacity="0.35" />
          ))}
          <rect x="19.5" y="6" width="4" height="20" rx="1.4" fill={stroke} />
          <path d="M6 27 C 14 24, 24 28, 34 25" stroke={stroke} strokeWidth="1.2" strokeDasharray="2.5 3" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}
