"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * THE KILLLAB SIGNATURE ARTWORK — "The Research Machine".
 *
 * An original animated SVG diagram, drawn as one continuous system:
 *
 *   hypothesis (free line) → the FRAME (frozen spec)
 *        → deterministic engine (three rotating analysis rings:
 *          walk-forward · bootstrap · deflation)
 *        → the trap corridor (nine gates)
 *        → the verdict aperture (cut / pass / withhold)
 *
 * The whole piece reads as one machine: uncertain ink goes in,
 * a sealed verdict comes out. Every element is original geometry.
 */
export function ResearchMachine({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const [armed, setArmed] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setArmed(true), 350);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, scale: 0.96, y: 14 }}
      animate={armed ? { opacity: 1, scale: 1, y: 0 } : undefined}
      transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <svg viewBox="0 0 760 560" fill="none" className="h-auto w-full" role="img" aria-label="The KillLab research machine: a hypothesis enters a frozen frame, passes through the deterministic engine, and exits as a sealed verdict.">
        <defs>
          <linearGradient id="kl-ink" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="oklch(0.62 0.01 250)" />
            <stop offset="0.5" stopColor="var(--ice)" />
            <stop offset="1" stopColor="oklch(0.62 0.01 250)" />
          </linearGradient>
          <linearGradient id="kl-ink-dim" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="oklch(0.4 0.008 250)" stopOpacity="0.5" />
            <stop offset="1" stopColor="oklch(0.4 0.008 250)" stopOpacity="0.1" />
          </linearGradient>
          <radialGradient id="kl-core" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="var(--ice)" stopOpacity="0.22" />
            <stop offset="0.6" stopColor="var(--ice)" stopOpacity="0.05" />
            <stop offset="1" stopColor="var(--ice)" stopOpacity="0" />
          </radialGradient>
          <filter id="kl-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        {/* ── baseline rail ─────────────────────────────── */}
        <line x1="40" y1="280" x2="720" y2="280" stroke="oklch(1 0 0 / 6%)" strokeWidth="1" />
        {[64, 148, 612, 696].map((x) => (
          <circle key={x} cx={x} cy={280} r="2.5" fill="oklch(1 0 0 / 16%)" />
        ))}

        {/* ── 1 · hypothesis ink (the uncertain line) ──── */}
        <g>
          <motion.path
            d="M40 282 C 70 282, 78 210, 104 232 S 138 330, 162 296"
            stroke="url(#kl-ink)"
            strokeWidth="2"
            strokeLinecap="round"
            initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
            animate={armed ? { pathLength: 1 } : undefined}
            transition={{ duration: 1.1, delay: 0.35, ease: "easeOut" }}
          />
          <text x="40" y="330" fill="oklch(0.62 0.008 250)" fontSize="10" fontFamily="var(--font-geist-mono)" letterSpacing="2.4">HYPOTHESIS</text>
          <text x="40" y="344" fill="oklch(0.45 0.008 250)" fontSize="8.5" fontFamily="var(--font-geist-mono)" letterSpacing="1.6">unstructured · uncertain</text>
        </g>

        {/* ── 2 · the frozen frame ──────────────────────── */}
        <g>
          <rect x="196" y="212" width="136" height="136" rx="10" stroke="oklch(1 0 0 / 22%)" strokeWidth="1.4" fill="oklch(1 0 0 / 1.5%)" />
          {/* lock ticks at corners */}
          {[
            [196, 212, 1, 1], [332, 212, -1, 1], [196, 348, 1, -1], [332, 348, -1, -1],
          ].map(([cx, cy, dx, dy], i) => (
            <path
              key={i}
              d={`M${cx + dx * 14} ${cy} L${cx} ${cy} L${cx} ${cy + dy * 14}`}
              stroke="var(--ice)"
              strokeOpacity="0.75"
              strokeWidth="2"
              strokeLinecap="round"
            />
          ))}
          {/* the line being structured inside the frame */}
          <motion.path
            d="M216 280 C 236 246, 252 312, 272 276 S 300 262, 312 280"
            stroke="var(--ice)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeOpacity="0.85"
            initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
            animate={armed ? { pathLength: 1 } : undefined}
            transition={{ duration: 0.9, delay: 1.1, ease: "easeOut" }}
          />
          {/* hash line */}
          <text x="216" y="326" fill="oklch(0.5 0.008 250)" fontSize="7.5" fontFamily="var(--font-geist-mono)" letterSpacing="1">
            kl1_f3a9c2e8…
          </text>
          <text x="196" y="380" fill="oklch(0.62 0.008 250)" fontSize="10" fontFamily="var(--font-geist-mono)" letterSpacing="2.4">FREEZE</text>
          <text x="196" y="394" fill="oklch(0.45 0.008 250)" fontSize="8.5" fontFamily="var(--font-geist-mono)" letterSpacing="1.6">immutable spec · hash</text>
        </g>

        {/* connector: frame → engine */}
        <motion.line
          x1="332" y1="280" x2="388" y2="280"
          stroke="url(#kl-ink-dim)"
          strokeWidth="1.4"
          initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
          animate={armed ? { pathLength: 1 } : undefined}
          transition={{ duration: 0.5, delay: 1.6 }}
        />

        {/* ── 3 · the deterministic engine ──────────────── */}
        <g>
          <circle cx="470" cy="280" r="86" fill="url(#kl-core)" />
          {/* three analysis rings */}
          <EngineRing radius={84} dur={14} dash="4 10" opacity={0.5} reduce={reduce} />
          <EngineRing radius={68} dur={20} dash="2 8" opacity={0.4} reverse reduce={reduce} />
          <EngineRing radius={52} dur={11} dash="1 6" opacity={0.55} reduce={reduce} />
          {/* core */}
          <circle cx="470" cy="280" r="30" stroke="oklch(1 0 0 / 26%)" strokeWidth="1.2" fill="oklch(1 0 0 / 2%)" />
          <motion.circle
            cx="470" cy="280" r="7"
            fill="var(--ice)"
            initial={reduce ? {} : { scale: 0, opacity: 0 }}
            animate={armed ? { scale: 1, opacity: 1 } : undefined}
            transition={{ duration: 0.7, delay: 1.9, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: "470px 280px" }}
          />
          <circle cx="470" cy="280" r="7" fill="var(--ice)" filter="url(#kl-soft)" opacity="0.6" />
          {/* ring labels */}
          <text x="418" y="180" fill="oklch(0.62 0.008 250)" fontSize="9" fontFamily="var(--font-geist-mono)" letterSpacing="1.8">WALK-FWD</text>
          <text x="500" y="180" fill="oklch(0.62 0.008 250)" fontSize="9" fontFamily="var(--font-geist-mono)" letterSpacing="1.8">BOOTSTRAP</text>
          <text x="384" y="402" fill="oklch(0.62 0.008 250)" fontSize="9" fontFamily="var(--font-geist-mono)" letterSpacing="1.8">DSR · PBO</text>
          <text x="470" y="196" textAnchor="middle" fill="oklch(0.45 0.008 250)" fontSize="8.5" fontFamily="var(--font-geist-mono)" letterSpacing="1.6">deterministic engine</text>
        </g>

        {/* connector: engine → corridor */}
        <motion.line
          x1="556" y1="280" x2="588" y2="280"
          stroke="url(#kl-ink-dim)"
          strokeWidth="1.4"
          initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
          animate={armed ? { pathLength: 1 } : undefined}
          transition={{ duration: 0.5, delay: 2.2 }}
        />

        {/* ── 4 · the trap corridor (nine gates) ────────── */}
        <g>
          <TrapCorridor reduce={reduce} />
          <text x="588" y="402" fill="oklch(0.62 0.008 250)" fontSize="10" fontFamily="var(--font-geist-mono)" letterSpacing="2.4">NINE TRAPS</text>
          <text x="588" y="416" fill="oklch(0.45 0.008 250)" fontSize="8.5" fontFamily="var(--font-geist-mono)" letterSpacing="1.6">the known ways it lies</text>
        </g>

        {/* ── 5 · verdict aperture ──────────────────────── */}
        <g>
          {/* the aperture opens downward; the final line passes or is cut */}
          <motion.path
            d="M700 240 A 46 46 0 0 1 700 320"
            stroke="oklch(1 0 0 / 28%)"
            strokeWidth="1.6"
            strokeLinecap="round"
            initial={reduce ? {} : { pathLength: 0 }}
            animate={armed ? { pathLength: 1 } : undefined}
            transition={{ duration: 0.8, delay: 2.7 }}
          />
          <motion.path
            d="M716 244 A 58 58 0 0 1 716 316"
            stroke="oklch(1 0 0 / 14%)"
            strokeWidth="1.2"
            strokeLinecap="round"
            initial={reduce ? {} : { pathLength: 0 }}
            animate={armed ? { pathLength: 1 } : undefined}
            transition={{ duration: 0.8, delay: 2.9 }}
          />
          {/* the resolved line exiting */}
          <motion.path
            d="M696 280 C 704 280, 706 280, 718 280"
            stroke="var(--ice)"
            strokeWidth="2.2"
            strokeLinecap="round"
            initial={reduce ? {} : { pathLength: 0, opacity: 0 }}
            animate={armed ? { pathLength: 1, opacity: 1 } : undefined}
            transition={{ duration: 0.6, delay: 3.15 }}
          />
          {/* verdict caption */}
          <text x="700" y="196" textAnchor="middle" fill="oklch(0.62 0.008 250)" fontSize="10" fontFamily="var(--font-geist-mono)" letterSpacing="2.4">VERDICT</text>
          <text x="700" y="210" textAnchor="middle" fill="oklch(0.45 0.008 250)" fontSize="8.5" fontFamily="var(--font-geist-mono)" letterSpacing="1.6">sealed · reproducible</text>
          {/* pulsing exit dot */}
          {!reduce && (
            <motion.circle
              cx="722" cy="280" r="3.4" fill="var(--ice)"
              animate={{ opacity: [0.35, 1, 0.35], scale: [1, 1.35, 1] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut", delay: 3.4 }}
              style={{ transformOrigin: "722px 280px" }}
            />
          )}
        </g>

        {/* ── data substrate (bottom) ───────────────────── */}
        <g opacity="0.55">
          {Array.from({ length: 26 }).map((_, i) => (
            <line
              key={i}
              x1={44 + i * 26}
              y1={468}
              x2={44 + i * 26}
              y2={468 + (i % 5 === 2 ? 10 : 4)}
              stroke="oklch(1 0 0 / 10%)"
              strokeWidth="1"
            />
          ))}
          <text x="44" y="500" fill="oklch(0.4 0.008 250)" fontSize="8.5" fontFamily="var(--font-geist-mono)" letterSpacing="1.6">
            BITGET VENUE DATA · pulled only after freeze
          </text>
        </g>
      </svg>
    </motion.div>
  );
}

function EngineRing({
  radius,
  dur,
  dash,
  opacity,
  reverse = false,
  reduce,
}: {
  radius: number;
  dur: number;
  dash: string;
  opacity: number;
  reverse?: boolean;
  reduce: boolean | null;
}) {
  if (reduce) {
    return <circle cx="470" cy="280" r={radius} stroke="oklch(1 0 0 / 14%)" strokeWidth="1" strokeDasharray={dash} />;
  }
  return (
    <motion.circle
      cx="470"
      cy="280"
      r={radius}
      stroke="oklch(1 0 0 / 30%)"
      strokeWidth="1"
      strokeDasharray={dash}
      animate={{ rotate: reverse ? -360 : 360 }}
      transition={{ duration: dur, repeat: Infinity, ease: "linear" }}
      style={{ transformOrigin: "470px 280px", opacity }}
    />
  );
}

/** The nine trap gates: a vertical corridor of tick marks the signal passes through. */
function TrapCorridor({ reduce }: { reduce: boolean | null }) {
  const gates = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  return (
    <g>
      {gates.map((i) => {
        const y = 236 + i * 11;
        const isTripped = i === 1 || i === 4 || i === 6;
        return (
          <motion.g
            key={i}
            initial={reduce ? {} : { opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 2.3 + i * 0.08 }}
          >
            <line x1="596" y1={y} x2="636" y2={y} stroke={isTripped ? "oklch(0.66 0.19 25)" : "oklch(1 0 0 / 18%)"} strokeWidth="1.6" strokeLinecap="round" />
            {isTripped && (
              <circle cx="616" cy={y} r="1.8" fill="oklch(0.66 0.19 25)" />
            )}
          </motion.g>
        );
      })}
      {/* corridor rails */}
      <line x1="592" y1="230" x2="592" y2="330" stroke="oklch(1 0 0 / 10%)" strokeWidth="1" />
      <line x1="640" y1="230" x2="640" y2="330" stroke="oklch(1 0 0 / 10%)" strokeWidth="1" />
    </g>
  );
}
