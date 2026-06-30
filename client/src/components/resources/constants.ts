import { SKILL_LEVELS } from "@shared/models/resources";

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
    s.level <= 1 ? "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300" :
    s.level === 2 ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" :
    s.level === 3 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" :
    s.level === 4 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" :
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
}));

export const PERSON_TYPES = [
  { value: "employee", label: "Employee" },
  { value: "contractor", label: "Contractor" },
  { value: "third-party", label: "Third-party" },
  { value: "customer", label: "Customer resource" },
];

export const RESOURCE_STATUSES = [
  { value: "active", label: "Active" },
  { value: "on-leave", label: "On leave" },
  { value: "inactive", label: "Inactive" },
  { value: "bench", label: "Bench (unallocated)" },
];

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

export const statusColors: Record<string, string> = {
  active: "bg-status-green text-status-green-foreground",
  available: "bg-status-green text-status-green-foreground",
  bench: "bg-status-blue text-status-blue-foreground",
  "on-leave": "bg-status-amber text-status-amber-foreground",
  inactive: "bg-muted text-muted-foreground",
  "partially-allocated": "bg-status-amber text-status-amber-foreground",
  "fully-allocated": "bg-status-red text-status-red-foreground",
};
