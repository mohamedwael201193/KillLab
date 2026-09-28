"use client";

import * as React from "react";
import { Logotype } from "@/components/kl/logotype";
import { useDesk } from "@/lib/desk/store";
import { Kbd } from "@/components/kl/atoms";
import { cn } from "@/lib/utils";
import { ArrowLeft, FlaskConical, ScrollText } from "lucide-react";

/**
 * The desk shell — deliberately minimal.
 * Two destinations: Research and Ledger. Everything else lives
 * inside the research flow itself.
 */
export function DeskShell({
  onExit,
  children,
}: {
  onExit: () => void;
  children: React.ReactNode;
}) {
  const tab = useDesk((s) => s.tab);
  const setTab = useDesk((s) => s.setTab);
  const screen = useDesk((s) => s.screen);

  const researchLocked = screen.kind === "run";

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-hairline bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <button
            onClick={onExit}
            className="group inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ice"
            aria-label="Back to the KillLab overview"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" aria-hidden="true" />
            <Logotype className="hidden sm:inline-flex" markClassName="h-6 w-6" />
            <span className="font-mono text-[12px] uppercase tracking-[0.14em] sm:hidden">KillLab</span>
          </button>

          {/* The only two destinations */}
          <nav className="flex items-center gap-1 rounded-full border border-hairline bg-secondary/40 p-1" aria-label="Desk destinations">
            <button
              onClick={() => setTab("research")}
              disabled={researchLocked}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-all duration-300 focus-visible:outline-2 focus-visible:outline-ice",
                tab === "research"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground disabled:opacity-40",
                researchLocked && "cursor-not-allowed"
              )}
              aria-current={tab === "research" ? "page" : undefined}
            >
              <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
              Research
            </button>
            <button
              onClick={() => setTab("ledger")}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-all duration-300 focus-visible:outline-2 focus-visible:outline-ice",
                tab === "ledger"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-current={tab === "ledger" ? "page" : undefined}
            >
              <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
              Ledger
            </button>
          </nav>

          <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/50 md:flex">
            <Kbd>L</Kbd> ledger
          </div>
        </div>
      </header>

      {/* Flow breadcrumb */}
      <FlowBreadcrumb />

      {/* Body */}
      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">{children}</div>
      </main>

      <footer className="mt-auto border-t border-hairline">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 font-mono text-[10.5px] text-muted-foreground/45 sm:px-6 lg:px-8">
          <p>live engine · Bitget public data · numbers come from this run</p>
          <p>deterministic engine · production runs on real Bitget data</p>
        </div>
      </footer>
    </div>
  );
}

const FLOW_STEPS = [
  { key: "write", label: "Write" },
  { key: "review", label: "Review" },
  { key: "freeze", label: "Freeze" },
  { key: "run", label: "Run" },
  { key: "verdict", label: "Verdict" },
] as const;

function FlowBreadcrumb() {
  const screen = useDesk((s) => s.screen);
  const tab = useDesk((s) => s.tab);
  const activeIndex =
    screen.kind === "write" ? 0
    : screen.kind === "review" ? 1
    : screen.kind === "freeze" ? 2
    : screen.kind === "run" ? 3
    : 4;

  if (tab !== "research") return null;

  return (
    <div className="border-b border-hairline/60 bg-secondary/20">
      <ol className="mx-auto flex w-full max-w-6xl items-center gap-1.5 overflow-x-auto px-4 py-2.5 sm:px-6 lg:px-8" aria-label="Research flow">
        {FLOW_STEPS.map((step, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <li key={step.key} className="flex items-center gap-1.5 whitespace-nowrap">
              {i > 0 && (
                <span aria-hidden="true" className="h-3 w-px bg-hairline" />
              )}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em]",
                  active ? "text-ice" : done ? "text-foreground/60" : "text-muted-foreground/40"
                )}
                aria-current={active ? "step" : undefined}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    active ? "bg-ice shadow-[0_0_8px_1px] shadow-ice/60" : done ? "bg-foreground/50" : "bg-foreground/15"
                  )}
                />
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
