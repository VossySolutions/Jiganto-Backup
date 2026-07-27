/** Accent tokens from docs/client/jiganto-360-report (3).html — chrome adapts to light/dark. */

export const R360 = {
  brand: "#4338CA",
  brandD: "#1E1B4B",
  brandL: "#EEF2FF",
  brandM: "#818CF8",
  teal: "#0D9488",
  tealL: "#CCFBF1",
  tealD: "#0F766E",
  green: "#059669",
  greenL: "#D1FAE5",
  greenD: "#065F46",
  amber: "#D97706",
  amberL: "#FEF3C7",
  amberD: "#92400E",
  red: "#DC2626",
  redL: "#FEE2E2",
  redD: "#991B1B",
  violet: "#7C3AED",
  violetL: "#EDE9FE",
  violetD: "#5B21B6",
  blue: "#2563EB",
  blueL: "#DBEAFE",
  blueD: "#1E3A8A",
  pink: "#DB2777",
  pinkL: "#FCE7F3",
  pinkD: "#9D174D",
  /** Light-mode text/chrome (prefer r360Chrome() when theming UI). */
  text: "#0F172A",
  text2: "#334155",
  text3: "#64748B",
  text4: "#94A3B8",
  border: "#E2E8F0",
  border2: "#F1F5F9",
  surface: "#FFFFFF",
  bg: "#F8FAFF",
  notStarted: "#6B7280",
} as const;

export type R360Rag = "green" | "amber" | "red" | "blue" | "neutral" | "complete";

export function isR360Dark(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

/** Theme-aware chrome for inline styles (call during render; pair with useTheme for updates). */
export function r360Chrome(dark = isR360Dark()) {
  if (!dark) {
    return {
      surface: R360.surface,
      bg: R360.bg,
      border: R360.border,
      border2: R360.border2,
      text: R360.text,
      text2: R360.text2,
      text3: R360.text3,
      text4: R360.text4,
      brandL: R360.brandL,
      tealL: R360.tealL,
      blueL: R360.blueL,
      amberL: R360.amberL,
      redL: R360.redL,
      greenL: R360.greenL,
      violetL: R360.violetL,
      pinkL: R360.pinkL,
      noticeBg: R360.blueL,
      noticeBorder: "#BFDBFE",
      noticeFg: R360.blueD,
      brandFg: R360.brandD,
      tealFg: R360.tealD,
      amberFg: R360.amberD,
      redFg: R360.redD,
      greenFg: R360.greenD,
      violetFg: R360.violetD,
      blueFg: R360.blueD,
      softSelected: "#F8FAFF",
    };
  }
  return {
    surface: "hsl(var(--card))",
    bg: "hsl(var(--background))",
    border: "hsl(var(--border))",
    border2: "hsl(var(--muted))",
    text: "hsl(var(--foreground))",
    text2: "hsl(var(--foreground) / 0.88)",
    text3: "hsl(var(--muted-foreground))",
    text4: "hsl(var(--muted-foreground) / 0.8)",
    brandL: "rgba(129,140,248,0.18)",
    tealL: "rgba(45,212,191,0.16)",
    blueL: "rgba(96,165,250,0.16)",
    amberL: "rgba(251,191,36,0.16)",
    redL: "rgba(248,113,113,0.16)",
    greenL: "rgba(52,211,153,0.16)",
    violetL: "rgba(167,139,250,0.16)",
    pinkL: "rgba(244,114,182,0.16)",
    noticeBg: "rgba(96,165,250,0.12)",
    noticeBorder: "rgba(96,165,250,0.35)",
    noticeFg: "#93C5FD",
    brandFg: "#A5B4FC",
    tealFg: "#5EEAD4",
    amberFg: "#FCD34D",
    redFg: "#FCA5A5",
    greenFg: "#6EE7B7",
    violetFg: "#C4B5FD",
    blueFg: "#93C5FD",
    softSelected: "rgba(129,140,248,0.12)",
  };
}

export function normR360Rag(v?: string | null): R360Rag {
  const s = (v || "").toLowerCase();
  if (s.includes("complete") || s.includes("done") || s.includes("approved")) return "complete";
  if (s.includes("blue") || s === "b") return "blue";
  if (s.includes("red") || s === "r" || s.includes("block") || s.includes("critical") || s.includes("overdue")) return "red";
  if (s.includes("amber") || s.includes("yellow") || s === "a" || s.includes("risk") || s.includes("monitor")) return "amber";
  if (s.includes("not") || s.includes("open") || !v) return s.includes("green") || s === "g" || s.includes("track") ? "green" : "neutral";
  if (s.includes("green") || s === "g" || s.includes("track") || s.includes("active")) return "green";
  return "green";
}

export function ragPillStyle(rag: R360Rag, dark = isR360Dark()): { background: string; color: string; dot: string } {
  const c = r360Chrome(dark);
  switch (rag) {
    case "amber":
      return { background: c.amberL, color: c.amberFg, dot: R360.amber };
    case "red":
      return { background: c.redL, color: c.redFg, dot: R360.red };
    case "blue":
      return { background: c.blueL, color: c.blueFg, dot: R360.blue };
    case "complete":
      return { background: c.tealL, color: c.tealFg, dot: R360.teal };
    case "neutral":
      return { background: c.border2, color: c.text4, dot: c.text4 };
    default:
      return { background: c.greenL, color: c.greenFg, dot: R360.green };
  }
}

export function ragBarColor(rag: R360Rag): string {
  switch (rag) {
    case "amber":
      return R360.amber;
    case "red":
      return R360.red;
    case "blue":
      return R360.blue;
    case "complete":
      return R360.teal;
    case "neutral":
      return R360.notStarted;
    default:
      return R360.green;
  }
}

export function statusPillStyle(status?: string | null, dark = isR360Dark()): { background: string; color: string } {
  const s = (status || "").toLowerCase();
  const c = r360Chrome(dark);
  if (s.includes("block") || s.includes("overdue") || s.includes("escalat")) return { background: c.redL, color: c.redFg };
  if (s.includes("review") || s.includes("pending") || s.includes("discuss")) return { background: c.amberL, color: c.amberFg };
  if (s.includes("done") || s.includes("approv") || s.includes("complete") || s.includes("closed")) return { background: c.tealL, color: c.tealFg };
  if (s.includes("active") || s.includes("progress") || s.includes("track")) return { background: c.greenL, color: c.greenFg };
  if (s.includes("not")) return { background: c.border2, color: c.text3 };
  return { background: c.border2, color: c.text3 };
}

export const PUBLISH_GRADIENT = `linear-gradient(135deg, ${R360.brand}, ${R360.violet})`;

export const LEVEL1_STATUS_COLORS = {
  not_started: { label: "Not started", color: R360.notStarted, text: "#fff" },
  in_progress: { label: "In progress", color: R360.brand, text: "#fff" },
  at_risk: { label: "At risk", color: R360.amber, text: "#fff" },
  delayed: { label: "Delayed", color: R360.red, text: "#fff" },
  completed: { label: "Complete", color: R360.teal, text: "#fff" },
} as const;
