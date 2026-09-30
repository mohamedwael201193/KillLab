"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Hero atmosphere: a cool core glow and vertical light streaks.
 * The canvas loop is cancelled on unmount. Reduced motion keeps the glow still.
 */
type Streak = { x: number; y: number; len: number; speed: number; width: number; alpha: number };

function makeStreaks(count: number): Streak[] {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    len: 0.06 + Math.random() * 0.2,
    speed: 0.0012 + Math.random() * 0.0036,
    width: 0.6 + Math.random() * 1.6,
    alpha: 0.12 + Math.random() * 0.5,
  }));
}

export function HeroField() {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();

  React.useEffect(() => {
    if (reduce) return;
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const streaks = makeStreaks(78);
    let raf = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const glow = ctx.createRadialGradient(width * 0.72, height * 0.12, 0, width * 0.72, height * 0.12, height * 0.85);
      glow.addColorStop(0, "rgba(214, 242, 255, 0.28)");
      glow.addColorStop(0.28, "rgba(150, 206, 228, 0.08)");
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      for (const streak of streaks) {
        streak.y += streak.speed;
        if (streak.y - streak.len > 1.05) streak.y = -streak.len;
        const x = streak.x * width;
        const y2 = streak.y * height;
        const y1 = y2 - streak.len * height;
        const line = ctx.createLinearGradient(x, y1, x, y2);
        line.addColorStop(0, "rgba(230, 248, 255, 0)");
        line.addColorStop(0.45, `rgba(226, 244, 255, ${streak.alpha})`);
        line.addColorStop(1, "rgba(230, 248, 255, 0)");
        ctx.strokeStyle = line;
        ctx.lineWidth = streak.width;
        ctx.beginPath();
        ctx.moveTo(x, y1);
        ctx.lineTo(x, y2);
        ctx.stroke();
      }
      raf = window.requestAnimationFrame(draw);
    };

    resize();
    raf = window.requestAnimationFrame(draw);
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [reduce]);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="kl-grid-bg absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_80%_70%_at_70%_0%,#000_20%,transparent_72%)]" />
      {reduce ? (
        <div
          className="absolute left-[58%] top-[-18%] h-[640px] w-[min(920px,120vw)] -translate-x-1/2 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in oklch, var(--ice) 22%, transparent), transparent 72%)",
          }}
        />
      ) : (
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_90%_at_70%_0%,transparent_40%,var(--background)_100%)]" />
    </div>
  );
}
