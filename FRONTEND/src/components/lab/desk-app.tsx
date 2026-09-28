"use client";

import * as React from "react";
import { useDesk } from "@/lib/desk/store";
import { DeskShell } from "@/components/lab/desk-shell";
import { WriteView } from "@/components/lab/write-view";
import { ReviewView, FreezeView } from "@/components/lab/review-view";
import { RunView } from "@/components/lab/run-view";
import { VerdictView } from "@/components/lab/verdict-view";
import { LedgerView } from "@/components/lab/ledger-view";
import { CursorGlow } from "@/components/kl/cursor-glow";

/**
 * The research desk application —
 * a view-state machine, not a page router.
 * WRITE → REVIEW → FREEZE → RUN → VERDICT, plus the LEDGER tab.
 */
export function DeskApp({ onExit }: { onExit: () => void }) {
  const tab = useDesk((s) => s.tab);
  const screen = useDesk((s) => s.screen);

  return (
    <>
      <CursorGlow />
      <DeskShell onExit={onExit}>
        {tab === "ledger" ? (
          <LedgerView />
        ) : (
          <>
            {screen.kind === "write" && <WriteView />}
            {screen.kind === "review" && <ReviewView />}
            {screen.kind === "freeze" && <FreezeView />}
            {screen.kind === "run" && <RunView />}
            {screen.kind === "verdict" && <VerdictView />}
          </>
        )}
      </DeskShell>
    </>
  );
}
