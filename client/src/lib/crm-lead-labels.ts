import type { StatusOption } from "@/components/MondayTable";

const STATUS_KEY = "crm-lead-status-labels";
const RATING_KEY = "crm-lead-rating-labels";

/** monday.com saturated status palette (white text on solid color) */
export const DEFAULT_LEAD_STATUS_OPTIONS: StatusOption[] = [
  { value: "new", label: "New", color: "bg-[#00c875] text-white" },
  { value: "contacted", label: "Contacted", color: "bg-[#fdab3d] text-white" },
  { value: "qualified", label: "Qualified", color: "bg-[#579bfc] text-white" },
  { value: "unqualified", label: "Unqualified", color: "bg-[#c4c4c4] text-white" },
  { value: "converted", label: "Converted", color: "bg-[#a25ddc] text-white" },
  { value: "lost", label: "Lost", color: "bg-[#e2445c] text-white" },
];

export const DEFAULT_LEAD_RATING_OPTIONS: StatusOption[] = [
  { value: "hot", label: "Hot", color: "bg-[#e2445c] text-white" },
  { value: "warm", label: "Warm", color: "bg-[#fdab3d] text-white" },
  { value: "cold", label: "Cold", color: "bg-[#579bfc] text-white" },
];

export const LABEL_COLOR_PRESETS: { id: string; className: string; swatch: string }[] = [
  { id: "green", className: "bg-[#00c875] text-white", swatch: "#00c875" },
  { id: "orange", className: "bg-[#fdab3d] text-white", swatch: "#fdab3d" },
  { id: "blue", className: "bg-[#579bfc] text-white", swatch: "#579bfc" },
  { id: "purple", className: "bg-[#a25ddc] text-white", swatch: "#a25ddc" },
  { id: "red", className: "bg-[#e2445c] text-white", swatch: "#e2445c" },
  { id: "yellow", className: "bg-[#ffcb00] text-[#323338]", swatch: "#ffcb00" },
  { id: "gray", className: "bg-[#c4c4c4] text-white", swatch: "#c4c4c4" },
  { id: "dark-blue", className: "bg-[#0086c0] text-white", swatch: "#0086c0" },
  { id: "pink", className: "bg-[#ff5ac4] text-white", swatch: "#ff5ac4" },
  { id: "lime", className: "bg-[#9cd326] text-[#323338]", swatch: "#9cd326" },
  { id: "peach", className: "bg-[#ffadad] text-[#323338]", swatch: "#ffadad" },
  { id: "sky", className: "bg-[#66ccff] text-[#323338]", swatch: "#66ccff" },
];

const LEGACY_COLOR_MAP: Record<string, string> = {
  "bg-status-green text-status-green-foreground": "bg-[#00c875] text-white",
  "bg-status-amber text-status-amber-foreground": "bg-[#fdab3d] text-white",
  "bg-status-blue text-status-blue-foreground": "bg-[#579bfc] text-white",
  "bg-status-purple text-status-purple-foreground": "bg-[#a25ddc] text-white",
  "bg-status-red text-status-red-foreground": "bg-[#e2445c] text-white",
  "bg-muted text-muted-foreground": "bg-[#c4c4c4] text-white",
};

function migrateColor(color?: string): string {
  if (!color) return "bg-[#c4c4c4] text-white";
  return LEGACY_COLOR_MAP[color] || color;
}

function loadOptions(key: string, defaults: StatusOption[]): StatusOption[] {
  if (typeof window === "undefined") return defaults.map((o) => ({ ...o }));
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaults.map((o) => ({ ...o }));
    const parsed = JSON.parse(raw) as StatusOption[];
    if (!Array.isArray(parsed) || parsed.length === 0) return defaults.map((o) => ({ ...o }));
    return parsed
      .filter((o) => o && typeof o.value === "string" && typeof o.label === "string")
      .map((o) => ({
        value: o.value,
        label: o.label,
        color: migrateColor(o.color),
      }));
  } catch {
    return defaults.map((o) => ({ ...o }));
  }
}

function saveOptions(key: string, options: StatusOption[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(options));
}

export function loadLeadStatusOptions(): StatusOption[] {
  return loadOptions(STATUS_KEY, DEFAULT_LEAD_STATUS_OPTIONS);
}

export function saveLeadStatusOptions(options: StatusOption[]) {
  saveOptions(STATUS_KEY, options);
}

export function loadLeadRatingOptions(): StatusOption[] {
  return loadOptions(RATING_KEY, DEFAULT_LEAD_RATING_OPTIONS);
}

export function saveLeadRatingOptions(options: StatusOption[]) {
  saveOptions(RATING_KEY, options);
}

const SOURCE_KEY = "crm-lead-source-labels";

export const DEFAULT_LEAD_SOURCE_OPTIONS: StatusOption[] = [
  { value: "website", label: "Website", color: "bg-[#579bfc] text-white" },
  { value: "referral", label: "Referral", color: "bg-[#00c875] text-white" },
  { value: "linkedin", label: "LinkedIn", color: "bg-[#0086c0] text-white" },
  { value: "cold_call", label: "Cold call", color: "bg-[#fdab3d] text-white" },
  { value: "event", label: "Event", color: "bg-[#a25ddc] text-white" },
  { value: "other", label: "Other", color: "bg-[#c4c4c4] text-white" },
];

export function loadLeadSourceOptions(): StatusOption[] {
  return loadOptions(SOURCE_KEY, DEFAULT_LEAD_SOURCE_OPTIONS);
}

export function saveLeadSourceOptions(options: StatusOption[]) {
  saveOptions(SOURCE_KEY, options);
}

/** Merge catalog with values already present on leads (Infinity-style). */
export function mergeSourceOptionsWithData(
  catalog: StatusOption[],
  sourcesOnLeads: string[],
): StatusOption[] {
  const byValue = new Map(catalog.map((o) => [o.value, o]));
  for (const raw of sourcesOnLeads) {
    const value = raw.trim();
    if (!value || byValue.has(value)) continue;
    byValue.set(value, {
      value,
      label: value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      color: "bg-[#c4c4c4] text-white",
    });
  }
  return Array.from(byValue.values());
}

export function slugifyLabelValue(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return base || `label_${Date.now()}`;
}
