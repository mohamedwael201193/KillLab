"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useDesk } from "@/lib/desk/store";
import { loadConstitution, saveConstitution } from "@/lib/research/constitution";
import { researchData } from "@/lib/research/data-source";
import { Kbd, MonoChip } from "@/components/kl/atoms";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * WRITE IDEA — the desk's front door.
 * One large textarea, example hypotheses as one-click chips,
 * and an explicit "data not loaded" state so the protocol is felt
 * before it is explained.
 */
export function WriteView() {
  const writeHypothesis = useDesk((s) => s.writeHypothesis);
  const submitHypothesis = useDesk((s) => s.submitHypothesis);
  const [text, setText] = React.useState("");
  const [thesis, setThesis] = React.useState("");
  const [posture, setPosture] = React.useState<"conservative" | "exploratory">("conservative");
  React.useEffect(() => {
    setPosture(loadConstitution().posture);
  }, []);
  const examples = React.useMemo(() => researchData.listExampleHypotheses(), []);
  const error = useDesk((s) => s.error);
  const reduce = useReducedMotion();
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const trimmed = text.trim();
  const canSubmit = trimmed.length > 8;

  const submit = React.useCallback(() => {
    if (canSubmit) submitHypothesis(trimmed, thesis.trim());
  }, [canSubmit, submitHypothesis, thesis, trimmed]);

  // Keyboard: Cmd/Ctrl+Enter submits from the textarea.
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="kl-verdict-word text-4xl text-foreground sm:text-5xl">
              What do you want to test?
            </h1>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
              Write your trading hypothesis in plain language. The assistant will
              draft a structured test — nothing touches data until you freeze it.
            </p>
          </div>
          <MonoChip tone="ice" className="hidden sm:inline-flex">step 1 · write</MonoChip>
        </div>

        {/* The writing surface */}
        <div
          className={cn(
            "kl-edge mt-7 rounded-2xl border bg-panel/70 transition-colors duration-300",
            trimmed ? "border-ice/25" : "border-hairline"
          )}
        >
          <label htmlFor="hypothesis" className="sr-only">
            Your trading hypothesis
          </label>
          <textarea
            ref={textareaRef}
            id="hypothesis"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              writeHypothesis(e.target.value);
            }}
            onKeyDown={onKeyDown}
            rows={4}
            maxLength={400}
            placeholder="e.g. Trade NVDA and TSLA perps after earnings in the direction of the after-hours move."
            className="w-full resize-none rounded-t-2xl bg-transparent px-5 pt-5 text-[15.5px] leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none sm:px-6 sm:text-base"
          />
          <input
            id="thesis"
            value={thesis}
            onChange={(e) => setThesis(e.target.value.slice(0, 280))}
            maxLength={280}
            placeholder="Optional thesis. Stored with the claim. It does not change the test."
            className="w-full border-t border-hairline bg-transparent px-5 py-3 text-[13px] text-foreground/80 placeholder:text-muted-foreground/40 focus:outline-none sm:px-6"
          />
          <div className="flex items-center justify-between gap-3 border-t border-hairline px-5 py-3 sm:px-6">
            <label className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground/70" htmlFor="posture">
              Research posture
            </label>
            <select
              id="posture"
              value={posture}
              onChange={(event) => {
                const next = event.target.value === "exploratory" ? "exploratory" : "conservative";
                setPosture(next);
                saveConstitution({ ...loadConstitution(), posture: next });
              }}
              className="rounded-full border border-hairline bg-transparent px-3 py-1 text-[13px] text-foreground"
            >
              <option value="conservative">Conservative</option>
              <option value="exploratory">Exploratory</option>
            </select>
          </div>
          <div className="flex items-center justify-between border-t border-hairline px-5 py-3 sm:px-6">
            <span className="font-mono text-[10.5px] text-muted-foreground/50">
              {text.length}/400 · <Kbd>⌘</Kbd> <Kbd>↵</Kbd> to draft
            </span>
            <Button
              onClick={submit}
              disabled={!canSubmit}
              className="group h-9 rounded-full bg-foreground px-5 text-[13px] font-medium text-background transition-all duration-300 hover:shadow-[0_0_30px_-8px] hover:shadow-ice/50 disabled:opacity-30"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Draft the test
              <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
        {error ? (
          <p className="mt-3 font-mono text-[12px] text-verdict-killed" role="alert">
            {error}
          </p>
        ) : null}

        {/* Example hypotheses */}
        <div className="mt-7">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
            or start from a known idea
          </p>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
            {examples.map((ex) => {
              const selected = trimmed === ex.text;
              return (
                <button
                  key={ex.text}
                  onClick={() => {
                    setText(ex.text);
                    writeHypothesis(ex.text);
                    textareaRef.current?.focus();
                  }}
                  className={cn(
                    "group rounded-xl border p-4 text-left transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ice",
                    selected
                      ? "border-ice/35 bg-ice/[0.05]"
                      : "border-hairline bg-panel/50 hover:border-foreground/15 hover:bg-panel"
                  )}
                >
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ice/90">{ex.chip}</span>
                  <span className="mt-2 block text-[13px] leading-relaxed text-foreground/85">
                    “{ex.text}”
                  </span>
                  <span className="mt-2 block font-mono text-[10.5px] text-muted-foreground/60">{ex.note}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Data state — felt, not buried */}
        <div className="mt-9 flex items-center gap-3 rounded-xl border border-hairline bg-panel/40 px-5 py-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hairline bg-secondary/50">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[13px] font-medium text-foreground/85">Data has not been loaded yet.</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
              Venue data is pulled only after you freeze the spec. Nothing is
              being analyzed right now.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
