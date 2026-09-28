"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * KillLab ambient backdrop — a very restrained layer:
 * radial ice glow + faint grid + two slow-drifting scan bands.
 * Pure CSS transforms, zero per-frame JS, GPU-composited.
 */
export function Backdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}
    >
      {/* Grid, fading out downward */}
      <div className="kl-grid-bg absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_75%_60%_at_50%_0%,#000_30%,transparent_75%)]" />

      {/* Ice glow at the top center */}
      <div
        className="absolute left-1/2 top-[-22%] h-[560px] w-[min(860px,110vw)] -translate-x-1/2 rounded-full blur-2xl"
        style={{
          background:
            "radial-gradient(closest-side, color-mix(in oklch, var(--ice) 13%, transparent), transparent 72%)",
        }}
      />

      {/* Horizontal scan bands */}
      <ScanBand top="24%" duration={26} opacity={0.35} />
      <ScanBand top="58%" duration={34} opacity={0.22} reverse />

      {/* Vignette to keep edges quiet */}
      <div className="absolute inset-0 [background:radial-gradient(ellipse_120%_100%_at_50%_0%,transparent_55%,var(--background)_100%)]" />
    </div>
  );
}

function ScanBand({
  top,
  duration,
  opacity,
  reverse = false,
}: {
  top: string;
  duration: number;
  opacity: number;
  reverse?: boolean;
}) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <motion.div
      className="absolute left-0 right-0 h-px"
      style={{
        top,
        opacity,
        background:
          "linear-gradient(90deg, transparent, color-mix(in oklch, var(--ice) 34%, transparent) 30%, color-mix(in oklch, var(--ice) 34%, transparent) 70%, transparent)",
      }}
      animate={{ x: reverse ? ["-30%", "30%"] : ["30%", "-30%"] }}
      transition={{ duration, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
    />
  );
}
