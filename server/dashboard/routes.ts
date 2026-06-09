import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { users } from "@shared/schema";
import {
  DASHBOARD_WIDGET_CATALOG,
  type DashboardUserPreferences,
} from "@shared/models/dashboard";
import { isRequestAuthenticated } from "../auth/supabaseAuth";
import { effectiveUserId } from "../auth/impersonationRoutes";
import { requireApiTenantId } from "../lib/api-tenant-id";
import { resolveListClientId } from "../lib/list-client-id";
import { generateAiDashboard } from "./ai";
import {
  addWidget,
  createBespokeDashboard,
  deleteBespokeDashboard,
  duplicateBespokeDashboard,
  listAccessibleDashboards,
  loadBespokeDashboard,
  removeWidget,
  reorderWidgets,
  scheduleDashboardDigest,
  shareDashboard,
  updateBespokeDashboard,
  updateWidget,
} from "./bespoke";
import {
  loadBusinessModuleDashboard,
  loadDashboardBriefing,
  loadFinanceModuleDashboard,
  loadHelpDeskModuleDashboard,
} from "./module-metrics";
import {
  loadCrmModuleDashboard,
  loadKpiStrip,
  loadProjectsModuleDashboard,
  loadScopedProjects,
  loadTasksModuleDashboard,
  type DashboardScope,
} from "./metrics";
import { resolveWidgetData } from "./widget-data";
import { loadModuleEntitlements } from "./entitlements";
import { listDashboardHistory, restoreDashboardHistory } from "./history";

function parseDashboardId(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function zodBadRequest(res: Response, err: unknown): boolean {
  if (err instanceof z.ZodError) {
    res.status(400).json({ message: err.errors[0]?.message ?? "Invalid input" });
    return true;
  }
  return false;
}

function getUserId(req: Request): string | null {
  return effectiveUserId(req);
}

function parseScope(req: Request, res: Response): DashboardScope | null {
  const tenantId = requireApiTenantId(req, res);
  if (tenantId == null) return null;
  const userId = getUserId(req);
  if (!userId) return null;

  const clientId = resolveListClientId(req);
  const projectRaw = req.query.projectId;
  const projectId =
    projectRaw != null && projectRaw !== "" ? Number(projectRaw) : undefined;

  return {
    tenantId,
    userId,
    clientId,
    projectId: Number.isFinite(projectId) && projectId! > 0 ? projectId : undefined,
  };
}

const DEFAULT_PREFS: DashboardUserPreferences = {
  defaultDashboard: "modules",
  hiddenModuleKeys: [],
  enabledDashboardIds: [],
};

function readDashboardPrefs(raw: unknown): DashboardUserPreferences {
  if (!raw || typeof raw !== "object") return DEFAULT_PREFS;
  const d = raw as Record<string, unknown>;
  return {
    defaultDashboard:
      typeof d.defaultDashboard === "string" ? d.defaultDashboard : DEFAULT_PREFS.defaultDashboard,
    hiddenModuleKeys: Array.isArray(d.hiddenModuleKeys)
      ? d.hiddenModuleKeys.filter((k): k is string => typeof k === "string")
      : [],
    enabledDashboardIds: Array.isArray(d.enabledDashboardIds)
      ? d.enabledDashboardIds.filter((k): k is string => typeof k === "string")
      : [],
    lastDashboard: typeof d.lastDashboard === "string" ? d.lastDashboard : undefined,
  };
}

export function registerDashboardRoutes(app: Express): void {
  app.get("/api/dashboard/kpi-strip", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });
    res.json(await loadKpiStrip(scope));
  });

  app.get("/api/dashboard/kpi-strip/stream", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    let closed = false;
    req.on("close", () => {
      closed = true;
    });

    const push = async () => {
      if (closed) return;
      try {
        const data = await loadKpiStrip(scope);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch {
        res.write(`event: error\ndata: "refresh failed"\n\n`);
      }
    };

    await push();
    const timer = setInterval(() => {
      void push();
    }, 30_000);

    req.on("close", () => clearInterval(timer));
  });

  app.get("/api/dashboard/module-entitlements", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tenantId = requireApiTenantId(req, res);
    if (tenantId == null) return;
    res.json(await loadModuleEntitlements(tenantId));
  });

  app.get("/api/dashboard/briefing", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });
    res.json(await loadDashboardBriefing(scope));
  });

  app.get("/api/dashboard/module/projects", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });
    res.json(await loadProjectsModuleDashboard(scope));
  });

  app.get("/api/dashboard/module/tasks", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });
    res.json(await loadTasksModuleDashboard(scope));
  });

  app.get("/api/dashboard/module/crm", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });
    res.json(await loadCrmModuleDashboard(scope));
  });

  app.get("/api/dashboard/module/helpdesk", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });
    res.json(await loadHelpDeskModuleDashboard(scope));
  });

  app.get("/api/dashboard/module/finance", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });
    res.json(await loadFinanceModuleDashboard(scope));
  });

  app.get("/api/dashboard/module/business", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });
    res.json(await loadBusinessModuleDashboard(scope));
  });

  app.get("/api/dashboard/projects", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });
    res.json(await loadScopedProjects(scope));
  });

  app.get("/api/dashboard/widget-catalog", (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    res.json(DASHBOARD_WIDGET_CATALOG);
  });

  app.get("/api/dashboard-data/:widgetType", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });
    const data = await resolveWidgetData(String(req.params.widgetType), scope);
    if (!data) return res.status(404).json({ message: "Unknown widget type" });
    res.json(data);
  });

  app.get("/api/dashboards", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });
    const rows = await listAccessibleDashboards(scope);
    res.json(
      rows.map((d) => ({
        id: d.id,
        name: d.name,
        description: d.description,
        layout: d.layout,
        isShared: d.isShared,
      })),
    );
  });

  app.get("/api/dashboards/:id", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });
    const dashboardId = parseDashboardId(String(req.params.id));
    if (dashboardId == null) return res.status(400).json({ message: "Invalid dashboard id" });
    const detail = await loadBespokeDashboard(dashboardId, scope);
    if (!detail) return res.status(404).json({ message: "Dashboard not found" });
    res.json(detail);
  });

  app.post("/api/dashboards", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });
    try {
      const input = z
        .object({
          name: z.string().min(2),
          description: z.string().optional(),
          layout: z.enum(["1-col", "2-col", "3-col"]).default("2-col"),
        })
        .parse(req.body);
      const created = await createBespokeDashboard(scope, input);
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid input" });
      }
      throw err;
    }
  });

  app.patch("/api/dashboards/:id", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });
    const dashboardId = parseDashboardId(String(req.params.id));
    if (dashboardId == null) return res.status(400).json({ message: "Invalid dashboard id" });
    try {
      const patch = z
        .object({
          name: z.string().min(2).optional(),
          description: z.string().optional(),
          layout: z.enum(["1-col", "2-col", "3-col"]).optional(),
        })
        .parse(req.body);
      const updated = await updateBespokeDashboard(dashboardId, scope, patch);
      if (!updated) return res.status(404).json({ message: "Dashboard not found" });
      res.json(updated);
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      throw err;
    }
  });

  app.delete("/api/dashboards/:id", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });
    const dashboardId = parseDashboardId(String(req.params.id));
    if (dashboardId == null) return res.status(400).json({ message: "Invalid dashboard id" });
    const ok = await deleteBespokeDashboard(dashboardId, scope);
    if (!ok) return res.status(404).json({ message: "Dashboard not found" });
    res.status(204).end();
  });

  app.post("/api/dashboards/:id/duplicate", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });
    const dashboardId = parseDashboardId(String(req.params.id));
    if (dashboardId == null) return res.status(400).json({ message: "Invalid dashboard id" });
    const copy = await duplicateBespokeDashboard(dashboardId, scope);
    if (!copy) return res.status(404).json({ message: "Dashboard not found" });
    res.status(201).json(copy);
  });

  app.get("/api/dashboards/:id/history", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });
    const dashboardId = parseDashboardId(String(req.params.id));
    if (dashboardId == null) return res.status(400).json({ message: "Invalid dashboard id" });
    const detail = await loadBespokeDashboard(dashboardId, scope);
    if (!detail) return res.status(404).json({ message: "Dashboard not found" });
    res.json(await listDashboardHistory(dashboardId));
  });

  app.post("/api/dashboards/:id/history/:hid/restore", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });
    const dashboardId = parseDashboardId(String(req.params.id));
    const historyId = parseDashboardId(String(req.params.hid));
    if (dashboardId == null || historyId == null) {
      return res.status(400).json({ message: "Invalid dashboard or history id" });
    }
    const restored = await restoreDashboardHistory(dashboardId, historyId, scope);
    if (!restored) return res.status(404).json({ message: "History version not found" });
    res.json(restored);
  });

  app.post("/api/dashboards/:id/widgets/reorder", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });
    const dashboardId = parseDashboardId(String(req.params.id));
    if (dashboardId == null) return res.status(400).json({ message: "Invalid dashboard id" });
    try {
      const { widgetIds } = z.object({ widgetIds: z.array(z.number()) }).parse(req.body);
      const updated = await reorderWidgets(dashboardId, scope, widgetIds);
      if (!updated) return res.status(404).json({ message: "Dashboard not found" });
      res.json(updated);
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      throw err;
    }
  });

  app.post("/api/dashboards/:id/widgets", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });
    const dashboardId = parseDashboardId(String(req.params.id));
    if (dashboardId == null) return res.status(400).json({ message: "Invalid dashboard id" });
    try {
      const input = z
        .object({
          widgetType: z.string(),
          widgetModule: z.string().optional(),
          positionX: z.number().optional(),
          positionY: z.number().optional(),
          width: z.number().optional(),
          height: z.number().optional(),
          config: z.record(z.unknown()).optional(),
        })
        .parse(req.body);
      const updated = await addWidget(dashboardId, scope, input);
      if (!updated) return res.status(404).json({ message: "Dashboard not found" });
      res.status(201).json(updated);
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      throw err;
    }
  });

  app.patch("/api/dashboards/:id/widgets/:wid", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });
    const dashboardId = parseDashboardId(String(req.params.id));
    const widgetId = parseDashboardId(String(req.params.wid));
    if (dashboardId == null || widgetId == null) {
      return res.status(400).json({ message: "Invalid dashboard or widget id" });
    }
    try {
      const patch = z
        .object({
          positionX: z.number().optional(),
          positionY: z.number().optional(),
          width: z.number().optional(),
          height: z.number().optional(),
          config: z.record(z.unknown()).optional(),
        })
        .parse(req.body);
      const updated = await updateWidget(dashboardId, widgetId, scope, patch);
      if (!updated) return res.status(404).json({ message: "Widget not found" });
      res.json(updated);
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      throw err;
    }
  });

  app.delete("/api/dashboards/:id/widgets/:wid", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });
    const dashboardId = parseDashboardId(String(req.params.id));
    const widgetId = parseDashboardId(String(req.params.wid));
    if (dashboardId == null || widgetId == null) {
      return res.status(400).json({ message: "Invalid dashboard or widget id" });
    }
    const ok = await removeWidget(dashboardId, widgetId, scope);
    if (!ok) return res.status(404).json({ message: "Widget not found" });
    res.status(204).end();
  });

  app.post("/api/dashboards/:id/share", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });
    const dashboardId = parseDashboardId(String(req.params.id));
    if (dashboardId == null) return res.status(400).json({ message: "Invalid dashboard id" });
    try {
      const input = z
        .object({
          sharedWithUserId: z.string().optional(),
          sharedWithWorkspaceId: z.number().optional(),
          permission: z.enum(["view", "edit"]).optional(),
        })
        .refine((v) => v.sharedWithUserId || v.sharedWithWorkspaceId, {
          message: "Share with a user or workspace",
        })
        .parse(req.body);
      const result = await shareDashboard(dashboardId, scope, input);
      if (!result) return res.status(404).json({ message: "Dashboard not found" });
      res.json(result);
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      throw err;
    }
  });

  app.post("/api/dashboards/:id/digest", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });
    const dashboardId = parseDashboardId(String(req.params.id));
    if (dashboardId == null) return res.status(400).json({ message: "Invalid dashboard id" });
    try {
      const input = z
        .object({
          frequency: z.enum(["daily", "weekly"]),
          email: z.string().email().optional(),
        })
        .parse(req.body);
      const result = await scheduleDashboardDigest(dashboardId, scope, input);
      if (!result) return res.status(404).json({ message: "Dashboard not found" });
      res.json(result);
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      throw err;
    }
  });

  app.post("/api/dashboard/ai/generate", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const scope = parseScope(req, res);
    if (!scope) return res.status(403).json({ message: "Organisation context required." });
    try {
      const { prompt } = z.object({ prompt: z.string().min(8) }).parse(req.body);
      const result = await generateAiDashboard(scope, prompt);
      if ("error" in result) return res.status(503).json({ message: result.error });
      res.status(201).json(result);
    } catch (err) {
      if (zodBadRequest(res, err)) return;
      throw err;
    }
  });

  app.get("/api/dashboard/preferences", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const [row] = await db.select({ preferences: users.preferences }).from(users).where(eq(users.id, userId));
    const prefs = (row?.preferences ?? {}) as Record<string, unknown>;
    res.json(readDashboardPrefs(prefs.dashboard));
  });

  app.patch("/api/dashboard/preferences", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const patchSchema = z.object({
      defaultDashboard: z.string().optional(),
      hiddenModuleKeys: z.array(z.string()).optional(),
      enabledDashboardIds: z.array(z.string()).optional(),
      lastDashboard: z.string().optional(),
    });

    try {
      const patch = patchSchema.parse(req.body);
      const [row] = await db.select({ preferences: users.preferences }).from(users).where(eq(users.id, userId));
      const prefs = (row?.preferences ?? {}) as Record<string, unknown>;
      const current = readDashboardPrefs(prefs.dashboard);
      const next: DashboardUserPreferences = { ...current, ...patch };
      await db
        .update(users)
        .set({
          preferences: { ...prefs, dashboard: next },
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
      res.json(next);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message ?? "Invalid input" });
      }
      throw err;
    }
  });
}
