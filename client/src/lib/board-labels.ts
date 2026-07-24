import type { StatusOption } from "@/components/MondayTable";
import { LABEL_COLOR_PRESETS, slugifyLabelValue } from "@/lib/crm-lead-labels";

export { LABEL_COLOR_PRESETS, slugifyLabelValue };

function storageKeyFor(boardKey: string, columnId: string) {
  return `board-labels:${boardKey}:${columnId}`;
}

export function humanizeLabelValue(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function defaultLabelOptionsFromValues(values: string[]): StatusOption[] {
  const seen = new Map<string, StatusOption>();
  for (const raw of values) {
    const value = String(raw ?? "").trim();
    if (!value || seen.has(value)) continue;
    seen.set(value, {
      value,
      label: humanizeLabelValue(value),
      color: LABEL_COLOR_PRESETS[seen.size % LABEL_COLOR_PRESETS.length].className,
    });
  }
  return Array.from(seen.values());
}

export function loadBoardLabels(boardKey: string, columnId: string): StatusOption[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKeyFor(boardKey, columnId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StatusOption[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed
      .filter((o) => o && typeof o.value === "string" && typeof o.label === "string")
      .map((o) => ({ value: o.value, label: o.label, color: o.color || "bg-[#c4c4c4] text-white" }));
  } catch {
    return null;
  }
}

export function saveBoardLabels(boardKey: string, columnId: string, options: StatusOption[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKeyFor(boardKey, columnId), JSON.stringify(options));
}

/** Saved labels win, but values already on rows must stay visible. */
export function mergeBoardLabels(
  saved: StatusOption[] | null,
  fallback: StatusOption[],
): StatusOption[] {
  if (!saved) return fallback;
  const byValue = new Map(saved.map((o) => [o.value, o]));
  for (const option of fallback) {
    if (!byValue.has(option.value)) byValue.set(option.value, option);
  }
  return Array.from(byValue.values());
}
