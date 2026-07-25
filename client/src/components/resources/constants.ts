import { SKILL_LEVELS, EXPIRING_WINDOW_DAYS } from "@shared/models/resources";

export type ProficiencyConfig = {
  value: string;
  label: string;
  level: number;
  color: string;
};

export const PROFICIENCY_LEVELS: ProficiencyConfig[] = SKILL_LEVELS.map((s) => ({
  value: s.value,
  label: s.label,
  level: s.level,
  color:
    s.level <= 1 ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200" :
    s.level === 2 ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200" :
    s.level === 3 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200" :
    s.level === 4 ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200" :
    "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-200",
}));

/* ── PERSON TYPES ─────────────────────────────────────────────
 * Five resource types (client spec): Employee, Contractor, Customer staff, Partner, Associate.
 */
export const PERSON_TYPES = [
  { value: "employee", label: "Employee" },
  { value: "contractor", label: "Contractor" },
  { value: "customer", label: "Customer staff" },
  { value: "partner", label: "Partner" },
  { value: "associate", label: "Associate" },
];

export type PersonTypeVisual = {
  label: string;
  bg: string;
  text: string;
  dot: string;
  gradient: string;
};

export const PERSON_TYPE_CONFIG: Record<string, PersonTypeVisual> = {
  employee: { label: "Employee", bg: "#EEF2FF", text: "#4338CA", dot: "#4338CA", gradient: "linear-gradient(135deg,#4338CA,#6366F1)" },
  contractor: { label: "Contractor", bg: "#FEF3C7", text: "#92400E", dot: "#D97706", gradient: "linear-gradient(135deg,#D97706,#F59E0B)" },
  customer: { label: "Customer staff", bg: "#D1FAE5", text: "#065F46", dot: "#059669", gradient: "linear-gradient(135deg,#059669,#10B981)" },
  partner: { label: "Partner", bg: "#EDE9FE", text: "#5B21B6", dot: "#7C3AED", gradient: "linear-gradient(135deg,#7C3AED,#A78BFA)" },
  associate: { label: "Associate", bg: "#FCE7F3", text: "#9D174D", dot: "#DB2777", gradient: "linear-gradient(135deg,#DB2777,#F472B6)" },
};

/** Neutral styling for legacy / unknown person types found in the database. */
function neutralTypeVisual(type: string): PersonTypeVisual {
  const label = type
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
  return { label, bg: "#F1F5F9", text: "#475569", dot: "#94A3B8", gradient: "linear-gradient(135deg,#64748B,#94A3B8)" };
}

export function getTypeConfig(type?: string | null): PersonTypeVisual {
  if (!type) return PERSON_TYPE_CONFIG.employee;
  return PERSON_TYPE_CONFIG[type] ?? neutralTypeVisual(type);
}

/* ── STATUS ───────────────────────────────────────────────────
 * Stored statuses are Active / Inactive. `expiring` and `expired` are derived
 * from the person's end/expiry date (contractors, partners, associates, customer staff).
 */
export const RESOURCE_STATUSES = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export const STATUS_FILTERS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "expiring", label: "Expiring <30 days" },
  { value: "expired", label: "Expired" },
];

export type EffectiveStatus = "active" | "inactive" | "expiring" | "expired";

export { EXPIRING_WINDOW_DAYS };

/** Derive the display status from the stored status + end/expiry date. */
export function getEffectiveStatus(status?: string | null, endDate?: string | Date | null): EffectiveStatus {
  if (endDate) {
    const diff = (new Date(endDate).getTime() - Date.now()) / 86_400_000;
    if (diff < 0) return "expired";
    if (diff < EXPIRING_WINDOW_DAYS) return "expiring";
  }
  return status === "inactive" ? "inactive" : "active";
}

/** Days until the end/expiry date (negative = already expired). Null when no expiry set. */
export function daysUntilExpiry(endDate?: string | Date | null): number | null {
  if (!endDate) return null;
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000);
}

export type StatusVisual = { label: string; bg: string; text: string; dot: string };

export const STATUS_CONFIG: Record<EffectiveStatus, StatusVisual> = {
  active: { label: "Active", bg: "#D1FAE5", text: "#065F46", dot: "#059669" },
  inactive: { label: "Inactive", bg: "#F1F5F9", text: "#64748B", dot: "#94A3B8" },
  expiring: { label: "Expiring", bg: "#FEF3C7", text: "#92400E", dot: "#D97706" },
  expired: { label: "Expired", bg: "#FEE2E2", text: "#991B1B", dot: "#DC2626" },
};

/** People-view utilisation colour (client design: high utilisation = red / at risk). */
export function peopleUtilColor(u: number): string {
  return u >= 85 ? "#DC2626" : u >= 60 ? "#D97706" : "#059669";
}

export const ALLOCATION_TYPES = [
  { value: "confirmed", label: "Confirmed", className: "bg-emerald-500" },
  { value: "provisional", label: "Provisional", className: "bg-amber-400 bg-stripes" },
  { value: "on_hold", label: "On hold", className: "border-2 border-dashed border-slate-400" },
];

export const UTILISATION_TARGET = 75;

export function getInitials(first: string, last: string) {
  return `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase();
}

export function getProficiencyConfig(level: string | null | number) {
  if (typeof level === "number") {
    return PROFICIENCY_LEVELS.find((p) => p.level === level) ?? PROFICIENCY_LEVELS[2];
  }
  return PROFICIENCY_LEVELS.find((p) => p.value === level) ?? PROFICIENCY_LEVELS[2];
}

/* ── SKILLS MATRIX ────────────────────────────────────────────
 * Client design: 4-point proficiency scale + 3 assessment sources.
 * Levels are stored on resource_skills.skillLevel (1-4). Colours follow the
 * shared design (awareness=slate, practitioner=blue, advanced=teal, expert=violet).
 */
export type MatrixLevel = { level: number; label: string; desc: string; bg: string; text: string };

export const MATRIX_LEVELS: MatrixLevel[] = [
  { level: 1, label: "Awareness", desc: "Basic theoretical knowledge, limited hands-on experience.", bg: "#CBD5E1", text: "#475569" },
  { level: 2, label: "Practitioner", desc: "Works independently on standard tasks; some mentoring may be needed.", bg: "#93C5FD", text: "#1D4ED8" },
  { level: 3, label: "Advanced", desc: "Leads delivery in this area, mentors others, handles complex scenarios.", bg: "#5EEAD4", text: "#0F766E" },
  { level: 4, label: "Expert", desc: "Recognised authority; defines standards, architecture and practice direction.", bg: "#A78BFA", text: "#5B21B6" },
];

export function getMatrixLevel(level?: number | null): MatrixLevel {
  const n = Math.max(1, Math.min(4, Number(level) || 1));
  return MATRIX_LEVELS[n - 1];
}

/** Map a numeric matrix level to the stored proficiencyLevel string (best-effort). */
export function levelToProficiencyValue(level: number): string {
  const byLevel = SKILL_LEVELS.find((s) => s.level === level);
  return byLevel?.value ?? "practitioner";
}

export type AssessmentSource = "validated" | "self" | "pending";

export const ASSESSMENT_SOURCES: Array<{ value: AssessmentSource; label: string; short: string; icon: string }> = [
  { value: "self", label: "Self-assessed", short: "Self", icon: "✏" },
  { value: "pending", label: "Pending review", short: "Pending", icon: "⏳" },
  { value: "validated", label: "Manager validated", short: "Validated", icon: "✓" },
];

export function getAssessmentSource(v?: string | null): AssessmentSource {
  return v === "self" || v === "pending" ? v : "validated";
}

export const statusColors: Record<string, string> = {
  active: "bg-status-green text-status-green-foreground",
  available: "bg-status-green text-status-green-foreground",
  bench: "bg-status-blue text-status-blue-foreground",
  "on-leave": "bg-status-amber text-status-amber-foreground",
  inactive: "bg-muted text-muted-foreground",
  "partially-allocated": "bg-status-amber text-status-amber-foreground",
  "fully-allocated": "bg-status-red text-status-red-foreground",
};
