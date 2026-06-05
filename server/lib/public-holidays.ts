/** Static holiday calendars by region key (expand or replace with external API later). */
const REGION_HOLIDAYS: Record<string, string[]> = {
  "GB-England": [
    "2026-01-01",
    "2026-04-18",
    "2026-04-21",
    "2026-05-04",
    "2026-05-25",
    "2026-08-31",
    "2026-12-25",
    "2026-12-28",
  ],
  US: [
    "2026-01-01",
    "2026-01-19",
    "2026-02-16",
    "2026-05-25",
    "2026-07-03",
    "2026-09-07",
    "2026-11-26",
    "2026-12-25",
  ],
  AU: ["2026-01-01", "2026-01-26", "2026-04-18", "2026-04-21", "2026-12-25", "2026-12-28"],
};

export function holidaysForRegion(region: string): string[] {
  const key = region.trim();
  return REGION_HOLIDAYS[key] ?? REGION_HOLIDAYS["GB-England"] ?? [];
}

export function mergeCustomHolidays(existing: string[], extra: string[]): string[] {
  return [...new Set([...existing, ...extra])].sort();
}
