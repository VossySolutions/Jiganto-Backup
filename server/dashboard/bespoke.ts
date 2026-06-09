import { and, desc, eq, or } from "drizzle-orm";
import { db } from "../db";
import {
  dashboardShares,
  dashboardWidgets,
  dashboards,
} from "@shared/schema";
import type { BespokeDashboardPayload, DashboardLayout } from "@shared/models/dashboard";
import type { DashboardScope } from "./metrics";
import { recordDashboardHistory } from "./history";

function readSettings(row: { settings?: unknown }): Record<string, unknown> {
  return (row.settings as Record<string, unknown>) ?? {};
}

export async function listAccessibleDashboards(scope: DashboardScope) {
  const owned = await db
    .select()
    .from(dashboards)
    .where(
      and(
        eq(dashboards.orgId, scope.tenantId),
        or(eq(dashboards.userId, scope.userId), eq(dashboards.isShared, true)),
      ),
    )
    .orderBy(desc(dashboards.updatedAt));

  const shareConditions = [eq(dashboardShares.sharedWithUserId, scope.userId)];
  if (scope.clientId != null) {
    shareConditions.push(eq(dashboardShares.sharedWithWorkspaceId, scope.clientId));
  }
  const sharedRows = await db
    .select({ dashboard: dashboards })
    .from(dashboardShares)
    .innerJoin(dashboards, eq(dashboardShares.dashboardId, dashboards.id))
    .where(
      and(
        eq(dashboards.orgId, scope.tenantId),
        or(...shareConditions),
      ),
    );

  const map = new Map<number, typeof owned[0]>();
  for (const d of owned) map.set(d.id, d);
  for (const { dashboard } of sharedRows) map.set(dashboard.id, dashboard);

  return Array.from(map.values()).filter((d) => d.type === "bespoke");
}

export async function loadBespokeDashboard(
  dashboardId: number,
  scope: DashboardScope,
): Promise<BespokeDashboardPayload | null> {
  const [row] = await db.select().from(dashboards).where(eq(dashboards.id, dashboardId));
  if (!row || row.type !== "bespoke") return null;
  if (row.orgId !== scope.tenantId) return null;
  if (row.userId !== scope.userId && !row.isShared) {
    const shareConditions = [eq(dashboardShares.sharedWithUserId, scope.userId)];
    if (scope.clientId != null) {
      shareConditions.push(eq(dashboardShares.sharedWithWorkspaceId, scope.clientId));
    }
    const [share] = await db
      .select()
      .from(dashboardShares)
      .where(and(eq(dashboardShares.dashboardId, dashboardId), or(...shareConditions)));
    if (!share) return null;
  }

  const widgets = await db
    .select()
    .from(dashboardWidgets)
    .where(eq(dashboardWidgets.dashboardId, dashboardId))
    .orderBy(dashboardWidgets.positionY, dashboardWidgets.positionX);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    layout: row.layout as DashboardLayout,
    widgets: widgets.map((w) => ({
      id: w.id,
      widgetType: w.widgetType,
      widgetModule: w.widgetModule,
      positionX: w.positionX,
      positionY: w.positionY,
      width: w.width,
      height: w.height,
      config: (w.config as Record<string, unknown>) ?? {},
    })),
  };
}

export async function createBespokeDashboard(
  scope: DashboardScope,
  input: { name: string; description?: string; layout: DashboardLayout },
) {
  const [row] = await db
    .insert(dashboards)
    .values({
      orgId: scope.tenantId,
      workspaceId: scope.clientId ?? null,
      userId: scope.userId,
      name: input.name,
      description: input.description ?? null,
      type: "bespoke",
      layout: input.layout,
    })
    .returning();
  const loaded = await loadBespokeDashboard(row!.id, scope);
  if (loaded) {
    await recordDashboardHistory(row!.id, scope, "created", `Created "${input.name}"`, loaded);
  }
  return loaded;
}

export async function updateBespokeDashboard(
  dashboardId: number,
  scope: DashboardScope,
  patch: Partial<{ name: string; description: string; layout: DashboardLayout }>,
) {
  const [row] = await db.select().from(dashboards).where(eq(dashboards.id, dashboardId));
  if (!row || row.userId !== scope.userId) return null;
  await db
    .update(dashboards)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(dashboards.id, dashboardId));
  const loaded = await loadBespokeDashboard(dashboardId, scope);
  if (loaded) {
    await recordDashboardHistory(dashboardId, scope, "updated", "Dashboard settings updated", loaded);
  }
  return loaded;
}

export async function deleteBespokeDashboard(dashboardId: number, scope: DashboardScope) {
  const [row] = await db.select().from(dashboards).where(eq(dashboards.id, dashboardId));
  if (!row || row.userId !== scope.userId) return false;
  await db.delete(dashboards).where(eq(dashboards.id, dashboardId));
  return true;
}

export async function addWidget(
  dashboardId: number,
  scope: DashboardScope,
  input: {
    widgetType: string;
    widgetModule?: string;
    positionX?: number;
    positionY?: number;
    width?: number;
    height?: number;
    config?: Record<string, unknown>;
  },
) {
  const [row] = await db.select().from(dashboards).where(eq(dashboards.id, dashboardId));
  if (!row || row.userId !== scope.userId) return null;
  await db.insert(dashboardWidgets).values({
    dashboardId,
    widgetType: input.widgetType,
    widgetModule: input.widgetModule ?? null,
    positionX: input.positionX ?? 0,
    positionY: input.positionY ?? 0,
    width: input.width ?? 2,
    height: input.height ?? 2,
    config: input.config ?? {},
  });
  const loaded = await loadBespokeDashboard(dashboardId, scope);
  if (loaded) {
    await recordDashboardHistory(
      dashboardId,
      scope,
      "widget_added",
      `Added widget ${input.widgetType}`,
      loaded,
    );
  }
  return loaded;
}

export async function updateWidget(
  dashboardId: number,
  widgetId: number,
  scope: DashboardScope,
  patch: Partial<{
    positionX: number;
    positionY: number;
    width: number;
    height: number;
    config: Record<string, unknown>;
  }>,
) {
  const [row] = await db.select().from(dashboards).where(eq(dashboards.id, dashboardId));
  if (!row || row.userId !== scope.userId) return null;
  await db
    .update(dashboardWidgets)
    .set(patch)
    .where(and(eq(dashboardWidgets.id, widgetId), eq(dashboardWidgets.dashboardId, dashboardId)));
  const loaded = await loadBespokeDashboard(dashboardId, scope);
  if (loaded && (patch.positionX != null || patch.positionY != null)) {
    await recordDashboardHistory(dashboardId, scope, "layout_updated", "Widget layout changed", loaded);
  }
  return loaded;
}

export async function removeWidget(dashboardId: number, widgetId: number, scope: DashboardScope) {
  const [row] = await db.select().from(dashboards).where(eq(dashboards.id, dashboardId));
  if (!row || row.userId !== scope.userId) return false;
  await db
    .delete(dashboardWidgets)
    .where(and(eq(dashboardWidgets.id, widgetId), eq(dashboardWidgets.dashboardId, dashboardId)));
  const loaded = await loadBespokeDashboard(dashboardId, scope);
  if (loaded) {
    await recordDashboardHistory(dashboardId, scope, "widget_removed", "Removed a widget", loaded);
  }
  return true;
}

export async function shareDashboard(
  dashboardId: number,
  scope: DashboardScope,
  input: { sharedWithUserId?: string; sharedWithWorkspaceId?: number; permission?: string },
) {
  const [row] = await db.select().from(dashboards).where(eq(dashboards.id, dashboardId));
  if (!row || row.userId !== scope.userId) return null;
  await db.insert(dashboardShares).values({
    dashboardId,
    sharedWithUserId: input.sharedWithUserId ?? null,
    sharedWithWorkspaceId: input.sharedWithWorkspaceId ?? null,
    permission: input.permission ?? "view",
  });
  await db.update(dashboards).set({ isShared: true }).where(eq(dashboards.id, dashboardId));
  return { ok: true };
}

export async function scheduleDashboardDigest(
  dashboardId: number,
  scope: DashboardScope,
  input: { frequency: "daily" | "weekly"; email?: string },
) {
  const [row] = await db.select().from(dashboards).where(eq(dashboards.id, dashboardId));
  if (!row || row.userId !== scope.userId) return null;
  const settings = readSettings(row);
  await db
    .update(dashboards)
    .set({
      settings: {
        ...settings,
        digest: {
          frequency: input.frequency,
          email: input.email ?? null,
          scheduledAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date(),
    })
    .where(eq(dashboards.id, dashboardId));
  return { scheduled: true, frequency: input.frequency };
}

export async function reorderWidgets(
  dashboardId: number,
  scope: DashboardScope,
  widgetIds: number[],
) {
  const [row] = await db.select().from(dashboards).where(eq(dashboards.id, dashboardId));
  if (!row || row.userId !== scope.userId) return null;

  for (let i = 0; i < widgetIds.length; i++) {
    await db
      .update(dashboardWidgets)
      .set({ positionY: i, positionX: 0 })
      .where(and(eq(dashboardWidgets.id, widgetIds[i]!), eq(dashboardWidgets.dashboardId, dashboardId)));
  }

  const loaded = await loadBespokeDashboard(dashboardId, scope);
  if (loaded) {
    await recordDashboardHistory(dashboardId, scope, "layout_updated", "Reordered widgets", loaded);
  }
  return loaded;
}

export async function duplicateBespokeDashboard(dashboardId: number, scope: DashboardScope) {
  const source = await loadBespokeDashboard(dashboardId, scope);
  if (!source) return null;

  const [row] = await db
    .insert(dashboards)
    .values({
      orgId: scope.tenantId,
      workspaceId: scope.clientId ?? null,
      userId: scope.userId,
      name: `${source.name} (copy)`,
      description: source.description,
      type: "bespoke",
      layout: source.layout,
    })
    .returning();

  for (let i = 0; i < source.widgets.length; i++) {
    const w = source.widgets[i]!;
    await db.insert(dashboardWidgets).values({
      dashboardId: row!.id,
      widgetType: w.widgetType,
      widgetModule: w.widgetModule,
      positionX: w.positionX,
      positionY: i,
      width: w.width,
      height: w.height,
      config: w.config ?? {},
    });
  }

  const loaded = await loadBespokeDashboard(row!.id, scope);
  if (loaded) {
    await recordDashboardHistory(row!.id, scope, "created", `Duplicated from "${source.name}"`, loaded);
  }
  return loaded;
}
