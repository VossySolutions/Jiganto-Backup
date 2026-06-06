import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { dashboardHistory, dashboardWidgets, dashboards } from "@shared/schema";
import type { BespokeDashboardPayload, DashboardHistoryEntry } from "@shared/models/dashboard";
import type { DashboardScope } from "./metrics";
import { loadBespokeDashboard } from "./bespoke";

const MAX_HISTORY = 30;

export async function recordDashboardHistory(
  dashboardId: number,
  scope: DashboardScope,
  changeType: string,
  summary: string,
  snapshot?: BespokeDashboardPayload | null,
) {
  const payload = snapshot ?? (await loadBespokeDashboard(dashboardId, scope));
  if (!payload) return;

  const [latest] = await db
    .select({ version: dashboardHistory.version })
    .from(dashboardHistory)
    .where(eq(dashboardHistory.dashboardId, dashboardId))
    .orderBy(desc(dashboardHistory.version))
    .limit(1);

  const version = (latest?.version ?? 0) + 1;

  await db.insert(dashboardHistory).values({
    dashboardId,
    version,
    userId: scope.userId,
    changeType,
    summary,
    snapshot: payload,
  });

  const allRows = await db
    .select({ id: dashboardHistory.id })
    .from(dashboardHistory)
    .where(eq(dashboardHistory.dashboardId, dashboardId))
    .orderBy(desc(dashboardHistory.version));

  if (allRows.length > MAX_HISTORY) {
    const toDelete = allRows.slice(MAX_HISTORY).map((r) => r.id);
    await db.delete(dashboardHistory).where(inArray(dashboardHistory.id, toDelete));
  }
}

export async function listDashboardHistory(dashboardId: number): Promise<DashboardHistoryEntry[]> {
  const rows = await db
    .select({
      id: dashboardHistory.id,
      version: dashboardHistory.version,
      changeType: dashboardHistory.changeType,
      summary: dashboardHistory.summary,
      userId: dashboardHistory.userId,
      createdAt: dashboardHistory.createdAt,
    })
    .from(dashboardHistory)
    .where(eq(dashboardHistory.dashboardId, dashboardId))
    .orderBy(desc(dashboardHistory.version))
    .limit(MAX_HISTORY);

  return rows.map((r) => ({
    id: r.id,
    version: r.version,
    changeType: r.changeType,
    summary: r.summary,
    userId: r.userId,
    createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
  }));
}

export async function restoreDashboardHistory(
  dashboardId: number,
  historyId: number,
  scope: DashboardScope,
): Promise<BespokeDashboardPayload | null> {
  const [row] = await db
    .select()
    .from(dashboardHistory)
    .where(and(eq(dashboardHistory.id, historyId), eq(dashboardHistory.dashboardId, dashboardId)));

  if (!row) return null;

  const snapshot = row.snapshot as BespokeDashboardPayload;

  const [owned] = await db.select().from(dashboards).where(eq(dashboards.id, dashboardId));
  if (!owned || owned.userId !== scope.userId) return null;

  await db.delete(dashboardWidgets).where(eq(dashboardWidgets.dashboardId, dashboardId));

  await db
    .update(dashboards)
    .set({
      name: snapshot.name,
      description: snapshot.description,
      layout: snapshot.layout,
      updatedAt: new Date(),
    })
    .where(eq(dashboards.id, dashboardId));

  for (const w of snapshot.widgets) {
    await db.insert(dashboardWidgets).values({
      dashboardId,
      widgetType: w.widgetType,
      widgetModule: w.widgetModule,
      positionX: w.positionX,
      positionY: w.positionY,
      width: w.width,
      height: w.height,
      config: w.config ?? {},
    });
  }

  const restored = await loadBespokeDashboard(dashboardId, scope);
  if (restored) {
    await recordDashboardHistory(
      dashboardId,
      scope,
      "restored",
      `Restored version ${row.version}`,
      restored,
    );
  }
  return restored;
}
