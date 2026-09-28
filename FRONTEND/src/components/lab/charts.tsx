"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { BootstrapDistribution, EquityCurve, FoldResult } from "@/lib/research/types";

/**
 * Hand-built SVG charts — used only where they communicate something.
 * No charting library weight; these are bespoke, quiet, and precise.
 */

/* ------------------------------------------------------------------ */
/* Equity curves — in-sample vs walk-forward vs baseline              */
/* ------------------------------------------------------------------ */

export function EquityChart({ curves, height = 190 }: { curves: EquityCurve[]; height?: number }) {
  const reduce = useReducedMotion();
  const W = 640;
  const H = height;
  const all = curves.flatMap((c) => c.points);
  const min = Math.min(0, ...all) * 1.08;
  const max = Math.max(...all) * 1.05;

  const y = (v: number) => H - 14 - ((v - min) / (max - min)) * (H - 28);
  const x = (i: number, n: number) => 6 + (i / (n - 1)) * (W - 12);

  const toneColor: Record<EquityCurve["tone"], string> = {
    insample: "oklch(0.55 0.01 250)",
    walkforward: "var(--ice)",
    baseline: "oklch(0.42 0.008 250)",
  };
  const toneDash: Record<EquityCurve["tone"], string | undefined> = {
    insample: "5 5",
    walkforward: undefined,
    baseline: "2 4",
  };

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Equity curves: in-sample, walk-forward and baseline comparison.">
        {/* zero line */}
        <line x1="6" y1={y(0)} x2={W - 6} y2={y(0)} stroke="oklch(1 0 0 / 10%)" strokeDasharray="3 5" />
        <text x="8" y={y(0) - 5} fill="oklch(0.5 0.008 250)" fontSize="8.5" fontFamily="var(--font-geist-mono)">0%</text>

        {curves.map((c, ci) => {
          const d = c.points
            .map((v, i) => `${i === 0 ? "M" : "L"}${x(i, c.points.length).toFixed(1)},${y(v).toFixed(1)}`)
            .join(" ");
          const color = toneColor[c.tone];
          return (
            <g key={c.key}>
              <motion.path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={c.tone === "walkforward" ? 2.2 : 1.5}
                strokeDasharray={toneDash[c.tone]}
                strokeLinecap="round"
                initial={reduce ? false : { pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.6, delay: 0.15 * ci, ease: [0.16, 1, 0.3, 1] }}
              />
              {/* end marker + label */}
              <motion.g
                initial={reduce ? false : { opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 1.2 + 0.15 * ci }}
              >
                <circle cx={x(c.points.length - 1, c.points.length)} cy={y(c.points[c.points.length - 1])} r="3" fill={color} />
                <text
                  x={W - 8}
                  y={y(c.points[c.points.length - 1]) - 7}
                  textAnchor="end"
                  fill={color}
                  fontSize="9.5"
                  fontFamily="var(--font-geist-mono)"
                >
                  {c.points[c.points.length - 1] > 0 ? "+" : ""}
                  {c.points[c.points.length - 1]}%
                </text>
              </motion.g>
            </g>
          );
        })}
      </svg>

      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {curves.map((c) => (
          <span key={c.key} className="inline-flex items-center gap-2 font-mono text-[10.5px] text-muted-foreground">
            <span aria-hidden="true" className="h-px w-5" style={{ background: toneColor[c.tone] }} />
            {c.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Bootstrap distribution histogram with CI                            */
/* ------------------------------------------------------------------ */

export function BootstrapChart({ bootstrap }: { bootstrap: BootstrapDistribution }) {
  const reduce = useReducedMotion();
  const W = 460;
  const H = 170;
  const maxCount = Math.max(...bootstrap.bins.map((b) => b.count));
  const x0 = bootstrap.bins[0].x0;
  const x1 = bootstrap.bins[bootstrap.bins.length - 1].x1;
  const x = (v: number) => 8 + ((v - x0) / (x1 - x0)) * (W - 16);
  const bw = (W - 16) / bootstrap.bins.length - 1.5;
  const zeroX = x(0);

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Bootstrap distribution of Sharpe. ${bootstrap.confidence} interval ${bootstrap.ciLow} to ${bootstrap.ciHigh}.`}>
        {/* zero line */}
        <line x1={zeroX} y1="10" x2={zeroX} y2={H - 22} stroke="oklch(1 0 0 / 18%)" strokeDasharray="3 4" />
        <text x={zeroX} y={H - 10} textAnchor="middle" fill="oklch(0.5 0.008 250)" fontSize="8.5" fontFamily="var(--font-geist-mono)">0</text>

        {/* CI band */}
        <rect
          x={x(bootstrap.ciLow)}
          y="10"
          width={Math.max(2, x(bootstrap.ciHigh) - x(bootstrap.ciLow))}
          height={H - 32}
          fill="var(--ice)"
          opacity="0.06"
        />
        {[bootstrap.ciLow, bootstrap.ciHigh].map((v, i) => (
          <g key={i}>
            <line x1={x(v)} y1="10" x2={x(v)} y2={H - 22} stroke="var(--ice)" strokeOpacity="0.5" strokeWidth="1.2" />
            <text x={x(v)} y={H - 10} textAnchor="middle" fill="var(--ice)" fillOpacity="0.8" fontSize="8.5" fontFamily="var(--font-geist-mono)">
              {v > 0 ? "+" : ""}{v.toFixed(2)}
            </text>
          </g>
        ))}

        {/* mean marker */}
        <line x1={x(bootstrap.meanSharpe)} y1="10" x2={x(bootstrap.meanSharpe)} y2={H - 22} stroke="var(--ice)" strokeWidth="1.4" strokeDasharray="2 3" />

        {/* bars */}
        {bootstrap.bins.map((b, i) => {
          const h = (b.count / maxCount) * (H - 40);
          const belowZero = b.x1 <= 0;
          return (
            <motion.rect
              key={i}
              x={x(b.x0)}
              y={H - 22 - h}
              width={Math.max(1.5, bw)}
              height={h}
              rx="1"
              fill={belowZero ? "var(--verdict-killed)" : "var(--ice)"}
              opacity={belowZero ? 0.55 : 0.4}
              initial={reduce ? false : { scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: i * 0.012, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: `${x(b.x0)}px ${H - 22}px` }}
            />
          );
        })}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-2 rounded-[2px] bg-ice/50" /> resamples above zero
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2 w-2 rounded-[2px] bg-verdict-killed/60" /> below zero
        </span>
        <span className="ml-auto">{bootstrap.confidence} CI</span>
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Fold bars — walk-forward Sharpe per fold                            */
/* ------------------------------------------------------------------ */

export function FoldChart({ folds }: { folds: FoldResult[] }) {
  const reduce = useReducedMotion();
  const W = 640;
  const H = 150;
  const maxAbs = Math.max(...folds.map((f) => Math.abs(f.sharpe)), 1.2) * 1.1;
  const bw = (W - 16) / folds.length - 3;
  const zeroY = H - 26;
  const y = (v: number) => zeroY - (v / maxAbs) * (H - 44);

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Walk-forward Sharpe ratio by fold.">
        <line x1="8" y1={zeroY} x2={W - 8} y2={zeroY} stroke="oklch(1 0 0 / 14%)" />
        {/* floor line at 0.5 if within range */}
        {maxAbs > 0.5 && (
          <g>
            <line x1="8" y1={y(0.5)} x2={W - 8} y2={y(0.5)} stroke="var(--verdict-alive)" strokeOpacity="0.35" strokeDasharray="3 4" />
            <text x="10" y={y(0.5) - 4} fill="var(--verdict-alive)" fillOpacity="0.7" fontSize="8" fontFamily="var(--font-geist-mono)">floor 0.50</text>
          </g>
        )}
        {folds.map((f, i) => {
          const h = Math.abs(y(f.sharpe) - zeroY);
          const up = f.sharpe >= 0;
          const bx = 8 + i * ((W - 16) / folds.length) + 1.5;
          return (
            <motion.rect
              key={f.fold}
              x={bx}
              y={up ? y(f.sharpe) : zeroY}
              width={Math.max(2, bw)}
              height={Math.max(1.5, h)}
              rx="1.5"
              fill={up ? "var(--ice)" : "var(--verdict-killed)"}
              opacity={up ? 0.5 : 0.65}
              initial={reduce ? false : { scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: `${bx}px ${zeroY}px` }}
            >
              <title>{`Fold ${f.fold} · ${f.period} · Sharpe ${f.sharpe}`}</title>
            </motion.rect>
          );
        })}
        {/* regime label markers */}
        {["2023", "2024", "2025"].map((yr) => {
          const idx = folds.findIndex((f) => f.period.includes(yr));
          if (idx < 0) return null;
          const bx = 8 + idx * ((W - 16) / folds.length);
          return (
            <text key={yr} x={bx} y={H - 8} fill="oklch(0.45 0.008 250)" fontSize="8.5" fontFamily="var(--font-geist-mono)">
              {yr}
            </text>
          );
        })}
      </svg>
      <figcaption className="mt-1.5 font-mono text-[10.5px] text-muted-foreground">
        fold Sharpe · net of costs · {folds.length} anchored folds
      </figcaption>
    </figure>
  );
}
