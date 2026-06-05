import type { Tenant } from "@shared/schema";

export type OrgCalendarConfig = {
  businessHoursStart?: string;
  businessHoursEnd?: string;
  publicHolidayRegion?: string;
  holidays?: string[];
  timezone?: string;
};

export function getOrgCalendarConfig(tenant: Tenant | null | undefined): OrgCalendarConfig {
  const branding = tenant?.brandingConfig as {
    organization?: OrgCalendarConfig;
    holidays?: string[];
  };
  return {
    businessHoursStart: branding?.organization?.businessHoursStart ?? "09:00",
    businessHoursEnd: branding?.organization?.businessHoursEnd ?? "18:00",
    publicHolidayRegion: branding?.organization?.publicHolidayRegion,
    holidays: branding?.holidays ?? [],
    timezone: tenant?.timezone ?? "UTC",
  };
}

function parseTimeMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Weekday within configured business hours and not a public holiday. */
export function isWithinBusinessTime(date: Date, tenant: Tenant | null | undefined): boolean {
  const cfg = getOrgCalendarConfig(tenant);
  const day = date.getDay();
  if (day === 0 || day === 6) return false;

  const ymd = date.toISOString().slice(0, 10);
  if (cfg.holidays?.includes(ymd)) return false;

  const mins = date.getHours() * 60 + date.getMinutes();
  const start = parseTimeMinutes(cfg.businessHoursStart ?? "09:00");
  const end = parseTimeMinutes(cfg.businessHoursEnd ?? "18:00");
  return mins >= start && mins < end;
}

/** Elapsed business milliseconds between two instants (Mon–Fri, hours only, holidays excluded). */
export function businessMsBetween(
  from: Date,
  to: Date,
  tenant: Tenant | null | undefined,
): number {
  if (to <= from) return 0;
  let total = 0;
  const cursor = new Date(from);
  while (cursor < to) {
    if (isWithinBusinessTime(cursor, tenant)) {
      total += 60_000;
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  return total;
}
