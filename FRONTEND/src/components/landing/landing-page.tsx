"use client";

import * as React from "react";
import { LandingHero } from "@/components/landing/hero";
import { LandingProblem } from "@/components/landing/problem";
import { LandingProtocol } from "@/components/landing/protocol";
import { LandingTraps } from "@/components/landing/traps";
import { LandingVerdicts } from "@/components/landing/verdicts";
import { LandingEvidence } from "@/components/landing/evidence";
import { LandingEvolution } from "@/components/landing/evolution";
import { LandingVenue, LandingFinalCta, LandingFooter } from "@/components/landing/venue-cta";
import { CursorGlow } from "@/components/kl/cursor-glow";

/**
 * The KillLab landing — one continuous storytelling flow:
 * hero → problem → protocol → nine traps → verdicts → evidence →
 * evolution → venue → final cta.
 */
export function LandingPage({ onEnterLab }: { onEnterLab: () => void }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <CursorGlow />
      <LandingHero onEnterLab={onEnterLab} />
      <main className="flex-1">
        <LandingProblem />
        <LandingProtocol />
        <LandingTraps />
        <LandingVerdicts />
        <LandingEvidence />
        <LandingEvolution />
        <LandingVenue />
        <LandingFinalCta onEnterLab={onEnterLab} />
      </main>
      <LandingFooter />
    </div>
  );
}
