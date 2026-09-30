import * as React from "react";
import { cn } from "@/lib/utils";
import type { EvidenceStatus, Verdict } from "@/lib/research/types";

/* -------------------------------------------------- */
/* Section scaffolding                                */
/* -------------------------------------------------- */

export function SectionHeading({
  index,
  eyebrow,
  title,
  lead,
  align = "left",
  className,
}: {
  index: string;
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 font-mono text-[11px] tracking-[0.22em] uppercase text-muted-foreground",
          align === "center" && "justify-center"
        )}
      >
        <span className="text-ice/80">{index}</span>
        <span aria-hidden="true" className="h-px w-8 bg-hairline" />
        <span>{eyebrow}</span>
      </div>
      <h2 className="kl-display mt-5 text-balance text-3xl leading-[1.08] text-foreground sm:text-4xl lg:text-[2.75rem]">
        {title}
      </h2>
      {lead ? (
        <p className="mt-4 text-pretty text-[15px] leading-relaxed text-muted-foreground sm:text-base">
          {lead}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------- */
/* Chips & mono atoms                                 */
/* -------------------------------------------------- */

export function MonoChip({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "ice" | "alive" | "killed" | "untestable" | "inconclusive";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "border-hairline bg-secondary/40 text-muted-foreground",
    ice: "border-ice/25 bg-ice/8 text-ice",
    alive: "border-verdict-alive/30 bg-verdict-alive/10 text-verdict-alive",
    killed: "border-verdict-killed/30 bg-verdict-killed/10 text-verdict-killed",
    untestable: "border-verdict-untestable/30 bg-verdict-untestable/10 text-verdict-untestable",
    inconclusive: "border-verdict-inconclusive/30 bg-verdict-inconclusive/10 text-verdict-inconclusive",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] tracking-[0.08em] uppercase",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-[12.5px] tracking-tight text-foreground/85", className)}>
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-[5px] border border-hairline bg-secondary/60 px-1.5 py-px font-mono text-[10px] text-muted-foreground">
      {children}
    </kbd>
  );
}

/* -------------------------------------------------- */
/* Status glyphs                                     */
/* -------------------------------------------------- */

const STATUS_TONE: Record<EvidenceStatus, { color: string; glyph: React.ReactNode }> = {
  pass: { color: "text-verdict-alive", glyph: <GlyphPass /> },
  fail: { color: "text-verdict-killed", glyph: <GlyphFail /> },
  warn: { color: "text-verdict-untestable", glyph: <GlyphWarn /> },
  info: { color: "text-muted-foreground", glyph: <GlyphInfo /> },
};

function GlyphPass() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.8 6.2 5.3 7.7 8.2 4.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function GlyphFail() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.2 4.2l3.6 3.6M7.8 4.2 4.2 7.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
function GlyphWarn() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 3.2v3.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="6" cy="8.4" r="0.7" fill="currentColor" />
    </svg>
  );
}
function GlyphInfo() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="6" cy="3.9" r="0.7" fill="currentColor" />
      <path d="M6 5.4v3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function StatusMark({ status, withLabel }: { status: EvidenceStatus; withLabel?: string }) {
  const tone = STATUS_TONE[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5", tone.color)}>
      {tone.glyph}
      {withLabel ? <span className="font-mono text-[10.5px] uppercase tracking-[0.1em]">{withLabel}</span> : null}
    </span>
  );
}

/* -------------------------------------------------- */
/* Verdict presentation                              */
/* -------------------------------------------------- */

export const VERDICT_TONE: Record<Verdict, { text: string; border: string; bg: string; label: string }> = {
  KILLED: {
    text: "text-verdict-killed",
    border: "border-verdict-killed/25",
    bg: "bg-verdict-killed/8",
    label: "The idea did not survive review.",
  },
  ALIVE: {
    text: "text-verdict-alive",
    border: "border-verdict-alive/25",
    bg: "bg-verdict-alive/8",
    label: "The idea survived review — so far.",
  },
  INCONCLUSIVE: {
    text: "text-verdict-inconclusive",
    border: "border-verdict-inconclusive/30",
    bg: "bg-verdict-inconclusive/10",
    label: "The evidence does not decide the idea.",
  },
  UNTESTABLE: {
    text: "text-verdict-untestable",
    border: "border-verdict-untestable/25",
    bg: "bg-verdict-untestable/8",
    label: "The idea could not be judged honestly.",
  },
};

export function VerdictStamp({ verdict, size = "md" }: { verdict: Verdict; size?: "sm" | "md" | "lg" }) {
  const tone = VERDICT_TONE[verdict];
  const sizes = {
    sm: "px-3 py-1 text-[11px] tracking-[0.22em]",
    md: "px-4 py-1.5 text-sm tracking-[0.3em]",
    lg: "px-6 py-2.5 text-lg tracking-[0.34em]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-mono uppercase",
        tone.text,
        tone.border,
        tone.bg,
        sizes[size]
      )}
    >
      {verdict}
    </span>
  );
}
