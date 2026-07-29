import { useMemo } from "react";
import { useTheme } from "@/hooks/use-theme";

export type SurveyColors = {
  teal: string; tealL: string; tealM: string;
  amber: string; amberL: string;
  violet: string; violetL: string;
  rose: string; roseL: string;
  blue: string; blueL: string;
  ink: string; ink2: string; ink3: string; ink4: string;
  paper: string; paper2: string; paper3: string;
  line: string; line2: string;
  surface: string;
};

export const C_LIGHT: SurveyColors = {
  teal: "#1A6B5A", tealL: "#E4F2EE", tealM: "#2E8C74",
  amber: "#B85C0A", amberL: "#FDF0E4",
  violet: "#4A2D8C", violetL: "#EEE9FA",
  rose: "#9C2B2B", roseL: "#FAEAEA",
  blue: "#1A4A8C", blueL: "#E6EEF8",
  ink: "#0F0E0C", ink2: "#2E2C28", ink3: "#5C5952", ink4: "#9C9890",
  paper: "#FAFAF7", paper2: "#F2F0EB", paper3: "#E8E5DE",
  line: "#DDD9D0", line2: "#CBC7BC",
  surface: "#ffffff",
};

export const C_DARK: SurveyColors = {
  teal: "#4AAD90", tealL: "#1A3D34", tealM: "#2E8C74",
  amber: "#E8954A", amberL: "#3D2A14",
  violet: "#9B7EDE", violetL: "#2A2040",
  rose: "#E57373", roseL: "#3D1F1F",
  blue: "#5B9BD5", blueL: "#1A2A40",
  ink: "#F2F0EB", ink2: "#E8E5DE", ink3: "#9C9890", ink4: "#6B6860",
  paper: "#1a1f2e", paper2: "#151a26", paper3: "#252a36",
  line: "#3D3B36", line2: "#4A4840",
  surface: "#252a36",
};

/** @deprecated Use useSurveyColors() for theme-aware colors */
export const C = C_LIGHT;

export function getSurveyColors(theme: "light" | "dark"): SurveyColors {
  return theme === "dark" ? C_DARK : C_LIGHT;
}

export function useSurveyColors(): SurveyColors {
  const { resolvedTheme } = useTheme();
  return useMemo(() => getSurveyColors(resolvedTheme), [resolvedTheme]);
}

export function getStatusStyles(C: SurveyColors): Record<string, { label: string; bg: string; color: string; dot?: boolean }> {
  return {
    draft: { label: "Draft", bg: C.paper3, color: C.ink3 },
    active: { label: "Active", bg: C.tealL, color: C.teal, dot: true },
    closed: { label: "Closed", bg: C.roseL, color: C.rose },
    archived: { label: "Archived", bg: C.paper3, color: C.ink4 },
  };
}

/** @deprecated Use getStatusStyles(useSurveyColors()) */
export const STATUS_STYLES = getStatusStyles(C_LIGHT);

export const MC_BARS = [C_LIGHT.tealM, "#4AAD90", C_LIGHT.amber, C_LIGHT.rose, "#6842B8", "#1A4A8C"];
export const CB_BARS = [C_LIGHT.violet, "#6842B8", "#8C5ECC", "#AA7ADE", "#C89EEA"];

export const QUESTION_TYPES: { type: string; icon: string; label: string; group: string }[] = [
  { type: "mc", icon: "◉", label: "Multiple Choice", group: "Choice" },
  { type: "yn", icon: "✓✗", label: "Yes / No", group: "Choice" },
  { type: "cb", icon: "☑", label: "Checkboxes", group: "Choice" },
  { type: "dd", icon: "▾", label: "Dropdown", group: "Choice" },
  { type: "sc", icon: "⭐", label: "Star Rating", group: "Rating" },
  { type: "scale", icon: "◈", label: "Scale (1–10)", group: "Rating" },
  { type: "nps", icon: "📈", label: "NPS Score", group: "Rating" },
  { type: "likert", icon: "↔", label: "Likert Scale", group: "Rating" },
  { type: "text", icon: "✏", label: "Short Text", group: "Open-ended" },
  { type: "para", icon: "☰", label: "Paragraph", group: "Open-ended" },
  { type: "date", icon: "📅", label: "Date", group: "Other" },
  { type: "file", icon: "📎", label: "File Upload", group: "Other" },
  { type: "section", icon: "§", label: "Section Header", group: "Other" },
  { type: "matrix", icon: "⊞", label: "Matrix / Grid", group: "Other" },
];

export const TYPE_LABEL: Record<string, string> = Object.fromEntries(QUESTION_TYPES.map(q => [q.type, q.label]));

export const CATEGORY_ICONS: Record<string, string> = {
  "Retrospective": "📊", "Client Satisfaction": "🎯", "Team Wellbeing": "💡",
  "Onboarding": "📝", "Product Feedback": "🔧", "Change Management": "🔄",
  "Quality Assurance": "✅", "Other": "📋", "": "📋",
};

export const CATEGORIES = ["Retrospective", "Client Satisfaction", "Team Wellbeing", "Onboarding", "Product Feedback", "Change Management", "Quality Assurance", "Other"];

export const LIKERT_OPTIONS = ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"];

export const EMOJI_RATINGS = ["😞", "😐", "🙂", "😊", "🤩"];

export type MainTab = "surveys" | "polls" | "templates" | "results";
export type View = "dashboard" | "builder" | "results";

export function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtTime(s: number | null | undefined) {
  if (!s) return "—";
  const m = Math.floor(s / 60), sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

export function surveyLink(token: string) {
  return `${window.location.origin}/survey/${token}`;
}

export function pollLink(token: string) {
  return `${window.location.origin}/poll/${token}`;
}

export function qrCodeUrl(data: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
}

export function embedCode(url: string) {
  return `<iframe src="${url}" width="100%" height="600" frameborder="0" style="border:1px solid rgba(128,128,128,.35);border-radius:8px;"></iframe>`;
}

export function wordFrequency(texts: string[], limit = 30): { word: string; count: number }[] {
  const stop = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "is", "it", "this", "that", "with", "was", "are", "be", "have", "has", "had", "not", "we", "i", "you", "they", "our", "my", "your"]);
  const counts: Record<string, number> = {};
  for (const t of texts) {
    for (const w of t.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/)) {
      if (w.length < 3 || stop.has(w)) continue;
      counts[w] = (counts[w] || 0) + 1;
    }
  }
  return Object.entries(counts).map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count).slice(0, limit);
}
