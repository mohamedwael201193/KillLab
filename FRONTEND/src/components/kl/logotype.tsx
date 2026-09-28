import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The KillLab sigil — an original mark.
 *
 * Concept: a bracketed aperture. The hypothesis enters as a bright,
 * uncertain line (UNKNOWN). The lab frames it — a fixed, frozen frame —
 * and the line resolves into either a settled path (ALIVE) or is cut
 * (KILLED). The vertical stroke of the "K" doubles as the frame's edge.
 */
export function Sigil({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn("h-7 w-7", className)}
      aria-hidden="true"
    >
      {/* Frozen frame */}
      <rect x="4" y="4" width="24" height="24" rx="3" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.5" />
      {/* The K — two strokes, geometric */}
      <path d="M11 8.5v15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M21 8.5l-8.5 7.5L21 23.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* The tested signal crossing the frame */}
      <path d="M6.5 17.5c3.5-3 5-4.5 7-3s3 5.5 5.5 4 3.5-4.5 6.5-2.5" stroke="var(--kl-sigil-accent, currentColor)" strokeWidth="1.4" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

/** Wordmark lockup. */
export function Logotype({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <Sigil className={markClassName} />
      <span className="text-[15px] font-medium tracking-[0.14em] uppercase">
        Kill<span className="text-muted-foreground">Lab</span>
      </span>
    </span>
  );
}
