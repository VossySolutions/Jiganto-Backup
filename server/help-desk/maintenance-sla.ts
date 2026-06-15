import { and, eq, lte, gte, or, isNull } from "drizzle-orm";
import { db } from "../db";
import { hdMaintenanceWindows } from "@shared/models/service-desk";

function mergeIntervals(intervals: { start: number; end: number }[]): { start: number; end: number }[] {
  if (!intervals.length) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      merged.push(sorted[i]);
    }
  }
  return merged;
}

/** Overlap between [from, to] and active maintenance windows (tenant-wide or client-specific). */
export async function computeMaintenanceOverlapMs(
  tenantId: number,
  clientId: number | null | undefined,
  from: Date,
  to: Date,
): Promise<number> {
  if (to.getTime() <= from.getTime()) return 0;

  const rows = await db
    .select()
    .from(hdMaintenanceWindows)
    .where(
      and(
        eq(hdMaintenanceWindows.tenantId, tenantId),
        lte(hdMaintenanceWindows.startAt, to),
        gte(hdMaintenanceWindows.endAt, from),
        clientId
          ? or(isNull(hdMaintenanceWindows.clientId), eq(hdMaintenanceWindows.clientId, clientId))
          : isNull(hdMaintenanceWindows.clientId),
      ),
    );

  const intervals: { start: number; end: number }[] = [];
  const fromMs = from.getTime();
  const toMs = to.getTime();

  for (const w of rows) {
    const start = Math.max(new Date(w.startAt).getTime(), fromMs);
    const end = Math.min(new Date(w.endAt).getTime(), toMs);
    if (end > start) intervals.push({ start, end });
  }

  return mergeIntervals(intervals).reduce((sum, i) => sum + i.end - i.start, 0);
}

/** Extend an SLA deadline by maintenance-window overlap between ticket creation and now. */
export async function maintenancePauseForTicket(
  tenantId: number,
  clientId: number | null | undefined,
  createdAt: Date,
  now = new Date(),
): Promise<number> {
  return computeMaintenanceOverlapMs(tenantId, clientId, createdAt, now);
}
