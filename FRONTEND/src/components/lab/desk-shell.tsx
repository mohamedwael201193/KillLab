"use client";

import * as React from "react";
import { Logotype } from "@/components/kl/logotype";
import { useActiveScenario, useDesk } from "@/lib/desk/store";
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
  const scenario = useActiveScenario();
  const engine = scenario?.frozen.engineVersion;

  const researchLocked = screen.kind === "run";

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#desk-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-foreground focus:px-4 focus:py-2 focus:text-background">
        Skip to research
      </a>
      <header className="sticky top-0 z-40 border-b border-hairline bg-background">
        <div className="mx-auto flex min-h-[72px] w-full max-w-[1180px] flex-wrap items-center justify-between gap-x-4 gap-y-3 bg-background px-4 py-3 sm:px-6 lg:px-8">
          <button
            onClick={onExit}
            className="group inline-flex items-center gap-3 rounded-lg px-1 py-1 text-left text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ice"
            aria-label="Back to the KillLab overview"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" aria-hidden="true" />
            <Logotype className="hidden sm:inline-flex" markClassName="h-7 w-7" />
            <span className="min-w-0">
              <span className="kl-verdict-word block text-lg leading-none text-foreground">KillLab</span>
              <span className="mt-1 block text-xs text-muted-foreground">AI research desk</span>
            </span>
          </button>

          <nav className="flex items-center gap-1 rounded-full border border-hairline bg-secondary/40 p-1" aria-label="Desk destinations">
            <button
              onClick={() => setTab("research")}
              disabled={researchLocked}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-ice",
                tab === "research"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground disabled:opacity-40",
                researchLocked && "cursor-not-allowed"
              )}
              aria-current={tab === "research" ? "page" : undefined}
            >
              <FlaskConical className="h-4 w-4" aria-hidden="true" />
              Research
            </button>
            <button
              onClick={() => setTab("ledger")}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-ice",
                tab === "ledger"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-current={tab === "ledger" ? "page" : undefined}
            >
              <ScrollText className="h-4 w-4" aria-hidden="true" />
              Ledger
            </button>
          </nav>

          <div className="min-w-0 basis-full text-left sm:basis-auto sm:text-right">
            <p className="text-xs text-muted-foreground">Engine</p>
            <p className="mt-0.5 max-w-[16rem] truncate font-mono text-sm text-foreground">{engine || "assigned at run"}</p>
          </div>
        </div>
      </header>

      {/* Flow breadcrumb */}
      <FlowBreadcrumb />

      {/* Body */}
      <main id="desk-main" className="flex-1">
        <div className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">{children}</div>
      </main>

      <footer className="mt-auto border-t border-hairline">
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-6 lg:px-8">
          <p>Live engine. Bitget public data. Numbers come from this run.</p>
          <p>Deterministic engine. Production runs on real Bitget data.</p>
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
      <ol className="mx-auto flex w-full max-w-[1180px] items-center gap-2 overflow-x-auto px-4 py-3 sm:gap-4 sm:px-6 lg:px-8" aria-label="Research flow">
        {FLOW_STEPS.map((step, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <li key={step.key} className="flex items-center gap-2 whitespace-nowrap">
              {i > 0 && (
                <span aria-hidden="true" className={cn("hidden h-px w-6 sm:block", done || active ? "bg-foreground/30" : "bg-hairline")} />
              )}
              <span
                className={cn(
                  "inline-flex items-baseline gap-2 border-b-2 pb-1 text-sm transition-colors duration-300",
                  active ? "border-ice text-foreground" : done ? "border-transparent text-foreground/70" : "border-transparent text-muted-foreground/55"
                )}
                aria-current={active ? "step" : undefined}
              >
                <span className="font-mono text-xs tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
