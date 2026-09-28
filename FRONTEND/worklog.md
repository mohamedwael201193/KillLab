# KillLab — Build Worklog

Project: KillLab frontend simulation — an AI Trading Desk for Review & Self-Evolution.
Stack: Next.js 16 (App Router) + TypeScript + Tailwind 4 + shadcn/ui + framer-motion + zustand.
Single visible route: `/` (landing ⟷ lab are view states, not routes).

Core product story: "Don't let a convincing backtest fool you."
Flow: WRITE IDEA → REVIEW TEST → FREEZE → RUN → VERDICT → REVIEW (ledger: KNOWN → UNKNOWN → TEST → RESULT → DECISION).

Naming rule: never use the words mock/demo in filenames, identifiers, or UI copy. Use fixtures / sample / scenario vocabulary.

---
Task ID: 1
Agent: main (Z.ai Code)
Task: Foundation — worklog, research domain types, data-source seam, design tokens, layout/fonts

Work Log:
- Created this worklog.
- Defined the full research domain type system in `src/lib/research/types.ts` (Verdict, LedgerStage, ResearchSpec, FrozenResearchSpec, RunStageDef, VerdictReport, LedgerEntry, TrapDefinition, ScenarioFixture, …).
- Delegated fixture content generation to a subagent (Task 2) against the exact type contracts.
- Planned dark-first design tokens (near-black cool foundation, ice-cyan accent, restrained verdict colors) in `src/app/globals.css`.
- Planned layout/fonts (Geist Sans + Geist Mono, Space Grotesk display if network allows) and KillLab metadata in `src/app/layout.tsx`.

Stage Summary:
- Type contracts are the single source of truth for the data layer; UI imports only from `@/lib/research/fixtures` via the `ResearchDataSource` seam in `src/lib/research/data-source.ts`, so a real KillLab API can replace fixtures later without redesign.

---
Task ID: 1-13
Agent: main (Z.ai Code)
Task: Full KillLab frontend simulation — landing + research desk, fixture data layer, original visual identity

Work Log:
- Defined research domain types (src/lib/research/types.ts): Verdict, LedgerStage, ResearchSpec, FrozenResearchSpec, RunStageDef, VerdictReport, LedgerEntry, TrapDefinition, ScenarioFixture.
- Built fixture data layer (src/lib/research/fixtures/): three coherent scenarios — earnings-momentum (KILLED, 7 variants, 24 folds, 5/9 traps), funding-carry (ALIVE, 5/5 floor pass), range-rotation (UNTESTABLE, gates fail before statistics); nine-traps definitions; example hypotheses; ledger entries (KL-001..003).
- Built the data-source seam (src/lib/research/data-source.ts): ResearchDataSource interface, fixture implementation — the single swap point for a future real KillLab API.
- Design system: dark-first oklch tokens with ice-cyan accent and restrained verdict colors (globals.css); Geist Sans/Mono; KillLab metadata.
- Shared primitives: Reveal/Stagger motion system, Backdrop (grid + ice glow + scan bands), CursorGlow (pointer-fine only, spring-damped), original Logotype/Sigil, atoms (SectionHeading, MonoChip, StatusMark, VerdictStamp), the signature ResearchMachine hero SVG (hypothesis → frozen frame → engine rings → nine-gate corridor → verdict aperture).
- Landing (single flow): Hero → Problem (one chart, three honesties, scroll-driven phases) → Protocol (7 steps, freeze as the hinge) → Nine Traps (interactive constellation with original per-trap glyphs + reading pane) → Verdicts (aperture visual grammar: cut/pass/withhold) → Evidence (receipt-style audit chain + real fixture rows) → Evolution (KNOWN→UNKNOWN→TEST→RESULT→DECISION rail) → Venue (determinism + honest simulation disclosure) → Final CTA → Footer.
- Desk (view-state machine in zustand, src/lib/desk/store.ts): Write (large textarea, example chips, "data not loaded" state) → Review (full spec: family, instruments, window, variants, baselines, kill floor, data requirements) → Freeze (hold-to-seal ceremony with ring progress, hash, immutable summary; Space/hold accessible) → Run (8 stages, streaming engine logs, Esc skip) → Verdict (large verdict, why, evidence, bespoke SVG equity/fold/bootstrap charts, traps, baselines, coverage, advisory AI interpretation, next steps) → Ledger (timeline with live KL-004 entry + RESULT→DECISION promotion).
- page.tsx: landing ⟷ desk view states, desk lazy-loaded via next/dynamic, keyboard affordances (Enter opens desk, L toggles ledger, Esc exits/skips).
- Fixed: freeze hold RAF self-reference lint error, ref-during-render, unused eslint-disable, framer-motion container warning (html position), HoldButton opacity initial. Added allowedDevOrigins for preview domain.
- Verification (agent-browser, desktop 1440×900 + mobile 390×844): hero/problem/protocol/traps/verdicts/evidence/evolution all render; full golden path ×3 scenarios (KILLED, ALIVE, UNTESTABLE) including hold-freeze, run stages, verdict sections, ledger promotion; traps tab interactivity; Enter/L/Esc shortcuts; sticky footer (short + long content); VLM checks on hero, verdict (9/9 sections), mobile (5/5), artwork. Lint clean, dev.log clean, zero console errors/warnings at end.

Stage Summary:
- The app runs at / as one route with two experiences: cinematic landing story + fully functional research desk simulation.
- All data flows through the ResearchDataSource seam — replacing fixtures with a real API touches one file.
- Naming rule honored: no mock/demo identifiers anywhere; fixtures are professional research vocabulary.
- Honest-data stance: UI consistently labels the simulation as fixture data, never production results.
