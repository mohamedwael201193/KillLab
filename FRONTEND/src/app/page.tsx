"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { LandingPage } from "@/components/landing/landing-page";
import { useDesk } from "@/lib/desk/store";
import { cn } from "@/lib/utils";

/**
 * KillLab — one route, two experiences:
 * the landing story and the research desk (lazy-loaded view state).
 */
const DeskApp = dynamic(() => import("@/components/lab/desk-app").then((m) => m.DeskApp), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-hairline border-t-ice" aria-hidden="true" />
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground/60">
          opening the desk
        </p>
      </div>
    </div>
  ),
});

type Experience = "landing" | "desk";

export default function Home() {
  const [experience, setExperience] = React.useState<Experience>("landing");
  const setTab = useDesk((s) => s.setTab);

  // Lock body scroll only for the landing's ambient effects? No —
  // both experiences scroll normally; no scroll juggling needed.

  const enterLab = React.useCallback(() => {
    setExperience("desk");
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const exitLab = React.useCallback(() => {
    setExperience("landing");
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  // Global keyboard affordances.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLInputElement ||
        (el instanceof HTMLElement && el.isContentEditable);

      if (typing) return;

      if (e.key === "Enter" && experience === "landing") {
        // Only when not focused on an interactive landing element.
        if (el instanceof HTMLElement && el.closest("button, a, [role='tab']")) return;
        enterLab();
      }
      if ((e.key === "l" || e.key === "L") && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (el instanceof HTMLElement && el.closest("button, a, textarea, [role='tab']")) return;
        if (experience === "landing") {
          enterLab();
          setTab("ledger");
        } else {
          setTab(useDesk.getState().tab === "ledger" ? "research" : "ledger");
        }
        e.preventDefault();
      }
      if (e.key === "Escape" && experience === "desk") {
        // Escape in desk only skips the run (handled inside RunView);
        // otherwise it exits to landing.
        const screen = useDesk.getState().screen;
        if (screen.kind !== "run") exitLab();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [experience, enterLab, exitLab, setTab]);

  return (
    <>
      <div className={cn(experience === "landing" ? "block" : "hidden")} aria-hidden={experience !== "landing"}>
        <LandingPage onEnterLab={enterLab} />
      </div>
      {experience === "desk" ? <DeskApp onExit={exitLab} /> : null}
    </>
  );
}
