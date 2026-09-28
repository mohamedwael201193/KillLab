"use client";

import * as React from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";

/**
 * A calm cursor spotlight — desktop pointer devices only.
 * A single soft radial highlight follows the cursor with heavy spring
 * damping. Never a spinner/gimmick; it just makes the dark surface
 * feel like glass catching light.
 */
export function CursorGlow() {
  const reduce = useReducedMotion();
  const [enabled, setEnabled] = React.useState(false);
  const x = useMotionValue(-400);
  const y = useMotionValue(-400);
  const sx = useSpring(x, { stiffness: 60, damping: 22, mass: 0.7 });
  const sy = useSpring(y, { stiffness: 60, damping: 22, mass: 0.7 });

  React.useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    setEnabled(fine && !reduce);
  }, [reduce]);

  React.useEffect(() => {
    if (!enabled) return;
    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [enabled, x, y]);

  if (!enabled) return null;

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-30 hidden h-[420px] w-[420px] -ml-[210px] -mt-[210px] rounded-full md:block"
      style={{
        x: sx,
        y: sy,
        background:
          "radial-gradient(closest-side, color-mix(in oklch, var(--ice) 5.5%, transparent), transparent 70%)",
      }}
    />
  );
}
