"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useDesk } from "@/lib/desk/store";
import { killlab } from "@/lib/research/live";
import { MonoChip, Mono, VERDICT_TONE } from "@/components/kl/atoms";
import { cn } from "@/lib/utils";

/**
 * LEDGER — the research memory.
 * Vertical timeline. Written stages are KNOWN, UNKNOWN, RESULT, DECISION, plus REVIEW, FORWARD_CHECK, and AUTO_RUN when the API records them.
 * The newest lab run appears on top with its live promotion to DECISION.
 */
const STAGE_ORDER = ["KNOWN", "UNKNOWN", "RESULT", "DECISION"] as const;

const STAGE_TONE: Record<string, string> = {
  KNOWN: "border-hairline bg-secondary/40 text-muted-foreground",
  UNKNOWN: "border-ice/30 bg-ice/[0.06] text-ice",
  RESULT: "border-verdict-untestable/30 bg-verdict-untestable/8 text-verdict-untestable",
  DECISION: "border-verdict-alive/30 bg-verdict-alive/8 text-verdict-alive",
  REVIEW: "border-hairline bg-secondary/40 text-muted-foreground",
  FORWARD_CHECK: "border-ice/30 bg-ice/[0.06] text-ice",
  AUTO_RUN: "border-ice/40 bg-ice/[0.09] text-ice",
};

export function LedgerView() {
  const ledger = useDesk((s) => s.ledger);
  const advanceLedger = useDesk((s) => s.advanceLedger);
  const reduce = useReducedMotion();
  const [forward, setForward] = React.useState<{ stage: string; window?: string; label?: string; n_units?: number; units_short?: number; created_at?: string; automatic?: boolean }[]>([]);
  React.useEffect(() => {
    let cancelled = false;
    killlab("GET", "/v1/forward/recent")
      .then((data) => {
        if (!cancelled) setForward(data.entries || []);
      })
      .catch(() => {
        if (!cancelled) setForward([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="kl-display text-2xl text-foreground sm:text-[1.7rem]">The research ledger.</h1>
          <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-muted-foreground">
            Every idea the desk has touched — what was known, what was asked,
            what was frozen, what resulted, what was decided.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {STAGE_ORDER.map((s) => (
            <span
              key={s}
              title={s}
              className={cn("rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]", STAGE_TONE[s])}
            >
              {s.slice(0, 2)}
            </span>
          ))}
        </div>
      </div>

      {/* Stage legend */}
      <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-hairline bg-panel/40 px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">the arc</p>
        <div className="flex flex-wrap items-center gap-2">
          {STAGE_ORDER.map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <span aria-hidden="true" className="text-muted-foreground/40">→</span>}
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground/70">{s}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Entries */}
      {forward.length > 0 ? (
        <ul className="mt-6 space-y-2 rounded-xl border border-hairline bg-panel/40 px-5 py-4">
          {forward.map((entry, index) => (
            <li key={`${entry.stage}-${entry.created_at}-${index}`} className="font-mono text-[12px] text-foreground/80">
              {entry.stage} · {entry.automatic ? "automatic, same hash" : "manual"} · {entry.label || entry.window || "—"} · {entry.n_units ?? "—"} units
              {entry.units_short !== undefined && entry.units_short !== null ? ` · short ${entry.units_short}` : ""} · {entry.created_at || "unknown"}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative mt-10">
        {/* spine */}
        <div aria-hidden="true" className="absolute bottom-4 left-[13px] top-4 w-px bg-hairline" />

        <div className="space-y-5">
          {ledger.length === 0 ? (
            <p className="pl-12 text-[14px] text-muted-foreground">
              The ledger is empty until a hypothesis is stored. Freeze a test to write the first marks.
            </p>
          ) : null}
          {ledger.map((entry, i) => (
            <motion.article
              key={entry.id}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-8% 0px" }}
              transition={{ duration: 0.6, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="relative pl-12"
            >
              {/* node */}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-0 top-5 flex h-[27px] w-[27px] items-center justify-center rounded-full border font-mono text-[9.5px]",
                  STAGE_TONE[entry.stage]
                )}
              >
                {entry.stage.slice(0, 2)}
              </span>

              <div className="rounded-2xl border border-hairline bg-panel/60 p-5 sm:p-6">
                {/* header */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-[11px] text-muted-foreground/70">
                    {entry.id} · {entry.family}
                  </p>
                  <div className="flex items-center gap-2">
                    {entry.verdict ? (
                      <span className={cn("font-mono text-[11px] uppercase tracking-[0.16em]", VERDICT_TONE[entry.verdict].text)}>
                        {entry.verdict}
                      </span>
                    ) : null}
                    <MonoChip>{entry.stage}</MonoChip>
                  </div>
                </div>

                {/* hypothesis */}
                <p className="mt-3 text-[15px] leading-relaxed text-foreground/90">
                  “{entry.hypothesisText}”
                </p>

                {/* instruments */}
                <p className="mt-2 font-mono text-[10.5px] text-muted-foreground/60">
                  {entry.instruments.join(" · ")}
                </p>

                {/* the stage walk */}
                <ol className="mt-5 space-y-0 border-t border-hairline/60 pt-4">
                  {entry.marks.map((mark, mi) => {
                    const isCurrent = mark.stage === entry.stage && mi === entry.marks.length - 1;
                    return (
                      <li key={`${mark.stage}-${mi}`} className="relative flex gap-4 pb-4 last:pb-0">
                        {/* stage connector */}
                        <div className="flex flex-col items-center">
                          <span
                            className={cn(
                              "flex h-6 w-11 shrink-0 items-center justify-center rounded-md border font-mono text-[8.5px] uppercase tracking-[0.1em]",
                              STAGE_TONE[mark.stage],
                              isCurrent && "ring-1 ring-inset ring-current/30"
                            )}
                          >
                            {mark.stage}
                          </span>
                          <span aria-hidden="true" className="mt-1 w-px flex-1 bg-hairline" />
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className={cn("text-[12.5px] leading-relaxed", isCurrent ? "text-foreground/90" : "text-muted-foreground")}>
                            {mark.note}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/45">
                            {formatStamp(mark.at)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>

                {/* key numbers */}
                {entry.keyNumbers.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-hairline/60 pt-4">
                    {entry.keyNumbers.map((kn) => (
                      <span key={kn.label} className="rounded-lg border border-hairline bg-secondary/30 px-3 py-1.5">
                        <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground/60">{kn.label} </span>
                        <Mono className="text-[12px]">{kn.value}</Mono>
                      </span>
                    ))}
                  </div>
                )}

                {/* decision */}
                {entry.decision && (
                  <div className="mt-4 rounded-xl border border-verdict-alive/20 bg-verdict-alive/[0.04] p-4">
                    <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-verdict-alive/80">decision</p>
                    <p className="mt-1.5 text-[13.5px] font-medium text-foreground/90">{entry.decision.summary}</p>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{entry.decision.rationale}</p>
                    {entry.decision.nextTest ? (
                      <p className="mt-2.5 border-t border-verdict-alive/15 pt-2.5 text-[12.5px] leading-relaxed text-foreground/75">
                        <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ice/80">next unknown — </span>
                        {entry.decision.nextTest}
                      </p>
                    ) : null}
                  </div>
                )}

                {/* Awaiting-decision action for the fresh lab run */}
                {(entry.stage === "RESULT" || entry.stage === "DECISION") && i === 0 && (
                  <button
                    onClick={advanceLedger}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-ice/30 bg-ice/[0.06] px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ice transition-all duration-300 hover:bg-ice/[0.12] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ice"
                  >
                    ask for the next question
                  </button>
                )}
              </div>
            </motion.article>
          ))}
        </div>
      </div>

      <p className="mt-8 text-center font-mono text-[10.5px] text-muted-foreground/45">
        the ledger evolves: every decision raises the next unknown
      </p>
    </div>
  );
}

function formatStamp(iso: string) {
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[1]} · ${m[2]}Z` : iso;
}
