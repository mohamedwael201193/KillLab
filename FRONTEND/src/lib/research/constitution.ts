export type ResearchConstitution = {
  posture: "conservative" | "exploratory";
  horizon: "session" | "swing" | "event";
  universe: string;
  avoid: string;
};

const KEY = "killlab.constitution";

const EMPTY: ResearchConstitution = {
  posture: "conservative",
  horizon: "session",
  universe: "the same instruments",
  avoid: "a new family",
};

export function loadConstitution(): ResearchConstitution {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<ResearchConstitution>;
    return {
      posture: parsed.posture === "exploratory" ? "exploratory" : "conservative",
      horizon: parsed.horizon === "swing" || parsed.horizon === "event" ? parsed.horizon : "session",
      universe: String(parsed.universe || EMPTY.universe).slice(0, 80),
      avoid: String(parsed.avoid || EMPTY.avoid).slice(0, 80),
    };
  } catch {
    return { ...EMPTY };
  }
}

export function postureFromReasons(reasons: string[]): ResearchConstitution["posture"] | null {
  const line = reasons.find((reason) => reason.includes("Constitution posture is"));
  if (!line) return null;
  if (line.includes("exploratory")) return "exploratory";
  if (line.includes("conservative")) return "conservative";
  return null;
}

export function saveConstitution(next: ResearchConstitution): ResearchConstitution {
  const saved = {
    posture: next.posture === "exploratory" ? "exploratory" as const : "conservative" as const,
    horizon: next.horizon === "swing" || next.horizon === "event" ? next.horizon : "session" as const,
    universe: String(next.universe || EMPTY.universe).slice(0, 80),
    avoid: String(next.avoid || EMPTY.avoid).slice(0, 80),
  };
  window.localStorage.setItem(KEY, JSON.stringify(saved));
  return saved;
}
