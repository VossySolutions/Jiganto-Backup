import type { Express, Request, Response } from "express";
import { z } from "zod";
import { isRequestAuthenticated } from "../auth/supabaseAuth";
import { effectiveUserId } from "../auth/impersonationRoutes";
import { requireApiTenantId } from "../lib/api-tenant-id";
import {
  assertRpAccess,
  assertRpPersonaAllowed,
  filterRpResponse,
  getRpPersona,
  resolveAllowedRpPersonas,
  type RpFeature,
  type RpPersona,
} from "./persona-access";
import { resolveUserPermissions } from "../lib/permissions";
import { resolveResourceScope } from "../resources/permissions";
import { DEFAULT_TTL_MS, invalidateRpTenantCache, rpCacheKey, rpCached } from "./cache";
import { demandSupplyMatrixPdf, recruitmentForecastPdf } from "./pdf";
import {
  autoMatchResources,
  assignBenchResource,
  createBooking,
  createScenario,
  deleteBooking,
  exportDemandSupplyCsv,
  exportRecruitmentToHr,
  extendBookingToWeek,
  getBenchManagement,
  getCellDetail,
  getDailyAiInsights,
  getDemandSupplyMatrix,
  getExecutiveDashboard,
  getHeatMap,
  getPipelineDemand,
  getRecruitmentForecast,
  getSchedulerData,
  getScenarios,
  getSkillsInventory,
  queryAiWorkforcePlanner,
  syncPipelineFromCrm,
  moveBookingToWeek,
  promoteBooking,
  promoteOpportunityDemand,
  updateBooking,
  updateRecruitmentStatus,
} from "./service";

function getUserId(req: Request): string | null {
  return effectiveUserId(req);
}

function requireAuth(req: Request, res: Response): boolean {
  if (!isRequestAuthenticated(req)) {
    res.status(401).json({ message: "Unauthorized" });
    return false;
  }
  return true;
}

function tenantId(req: Request, res: Response): number | null {
  try {
    return requireApiTenantId(req, res);
  } catch {
    return null;
  }
}

async function guardRp(req: Request, res: Response, feature: RpFeature): Promise<{ tid: number; persona: RpPersona } | null> {
  if (!requireAuth(req, res)) return null;
  const tid = tenantId(req, res);
  if (tid == null) return null;
  const persona = getRpPersona(req);
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  const perms = await resolveUserPermissions(userId, tid);
  const resourceScope = await resolveResourceScope(userId, tid, perms.platformRole);
  if (!assertRpPersonaAllowed(res, persona, perms.platformRole, resourceScope)) return null;
  if (!assertRpAccess(res, persona, feature, req.method)) return null;
  return { tid, persona };
}

function sendFiltered(res: Response, persona: ReturnType<typeof getRpPersona>, feature: RpFeature, data: unknown) {
  res.json(filterRpResponse(persona, feature, data));
}

function mutateInvalidate(tid: number) {
  invalidateRpTenantCache(tid);
}

const bookingSchema = z.object({
  resourceId: z.number().int().positive(),
  projectId: z.number().int().positive().optional(),
  projectName: z.string().optional(),
  role: z.string().optional(),
  startDate: z.string(),
  endDate: z.string(),
  daysPerWeek: z.number().optional(),
  allocationType: z.enum(["confirmed", "pipeline", "soft"]).optional(),
  opportunityRowId: z.number().int().positive().optional(),
});

export function registerResourcePlanningRoutes(app: Express): void {
  app.get("/api/resource-planning/personas", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tid = tenantId(req, res);
    if (tid == null) return;
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const perms = await resolveUserPermissions(userId, tid);
      const resourceScope = await resolveResourceScope(userId, tid, perms.platformRole);
      const { allowed, defaultPersona } = resolveAllowedRpPersonas(perms.platformRole, resourceScope);
      res.json({ allowed, defaultPersona });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to resolve personas" });
    }
  });

  app.get("/api/resource-planning/dashboard", async (req, res) => {
    const ctx = await guardRp(req, res, "dashboard");
    if (!ctx) return;
    try {
      const data = await rpCached(
        rpCacheKey(ctx.tid, "dashboard"),
        DEFAULT_TTL_MS,
        () => getExecutiveDashboard(ctx.tid),
      );
      sendFiltered(res, ctx.persona, "dashboard", data);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to load dashboard" });
    }
  });

  app.get("/api/resource-planning/demand-supply", async (req, res) => {
    const ctx = await guardRp(req, res, "demand-supply");
    if (!ctx) return;
    const includePipeline = req.query.includePipeline === "true";
    const practice = String(req.query.practice ?? "all");
    const months = req.query.months ? Number(req.query.months) : 10;
    try {
      const data = await rpCached(
        rpCacheKey(ctx.tid, "demand-supply", { includePipeline, practice, months }),
        DEFAULT_TTL_MS,
        () => getDemandSupplyMatrix(ctx.tid, { includePipeline, practice, months }),
      );
      sendFiltered(res, ctx.persona, "demand-supply", data);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to load demand/supply matrix" });
    }
  });

  app.get("/api/resource-planning/demand-supply/export", async (req, res) => {
    const ctx = await guardRp(req, res, "demand-supply");
    if (!ctx) return;
    const includePipeline = req.query.includePipeline === "true";
    const format = String(req.query.format ?? "csv");
    const matrix = await getDemandSupplyMatrix(ctx.tid, { includePipeline, months: 10 });
    if (format === "pdf") {
      const buf = demandSupplyMatrixPdf(
        includePipeline ? "Demand vs Supply (incl. pipeline)" : "Demand vs Supply",
        matrix.months,
        matrix.rows,
      );
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=demand-supply-matrix.pdf");
      return res.send(buf);
    }
    const csv = await exportDemandSupplyCsv(ctx.tid, includePipeline);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=demand-supply-matrix.csv");
    res.send(csv);
  });

  app.get("/api/resource-planning/ai/insights", async (req, res) => {
    const ctx = await guardRp(req, res, "ai");
    if (!ctx) return;
    sendFiltered(res, ctx.persona, "ai", await getDailyAiInsights(ctx.tid, ctx.persona));
  });

  app.post("/api/resource-planning/bench/:id/assign", async (req, res) => {
    const ctx = await guardRp(req, res, "bench");
    if (!ctx) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    try {
      const result = await assignBenchResource(ctx.tid, id, req.body ?? {}, getUserId(req));
      mutateInvalidate(ctx.tid);
      res.status(201).json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to assign resource" });
    }
  });

  app.post("/api/resource-planning/pipeline/sync", async (req, res) => {
    const ctx = await guardRp(req, res, "pipeline");
    if (!ctx) return;
    const result = await syncPipelineFromCrm(ctx.tid, getUserId(req));
    mutateInvalidate(ctx.tid);
    res.json(result);
  });

  /** CRM webhook — auto-sync pipeline demand when opportunities change */
  app.post("/api/resource-planning/webhooks/crm", async (req, res) => {
    if (!requireAuth(req, res)) return;
    const tid = tenantId(req, res);
    if (tid == null) return;
    const event = String(req.body?.event ?? "opportunity.updated");
    if (!event.startsWith("opportunity.")) {
      return res.status(400).json({ message: "Unsupported event" });
    }
    const result = await syncPipelineFromCrm(tid, getUserId(req));
    mutateInvalidate(tid);
    res.json({ ...result, event });
  });

  app.get("/api/resource-planning/demand-supply/cell", async (req, res) => {
    const ctx = await guardRp(req, res, "demand-supply");
    if (!ctx) return;
    const skill = String(req.query.skill ?? "");
    const monthIndex = Number(req.query.monthIndex ?? 0);
    const includePipeline = req.query.includePipeline === "true";
    if (!skill) return res.status(400).json({ message: "skill required" });
    const detail = await getCellDetail(ctx.tid, skill, monthIndex, includePipeline);
    if (!detail) return res.status(404).json({ message: "Not found" });
    res.json(detail);
  });

  app.get("/api/resource-planning/heatmap", async (req, res) => {
    const ctx = await guardRp(req, res, "heatmap");
    if (!ctx) return;
    const weeks = req.query.weeks ? Number(req.query.weeks) : 16;
    const granularity = (req.query.granularity as "week" | "month" | "quarter") ?? "week";
    try {
      const data = await rpCached(
        rpCacheKey(ctx.tid, "heatmap", { weeks, granularity }),
        DEFAULT_TTL_MS,
        () => getHeatMap(ctx.tid, { weeks, granularity }),
      );
      sendFiltered(res, ctx.persona, "heatmap", data);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to load heat map" });
    }
  });

  app.get("/api/resource-planning/scheduler", async (req, res) => {
    const ctx = await guardRp(req, res, "scheduler");
    if (!ctx) return;
    const weeks = req.query.weeks ? Number(req.query.weeks) : 16;
    try {
      const data = await rpCached(
        rpCacheKey(ctx.tid, "scheduler", { weeks }),
        DEFAULT_TTL_MS,
        () => getSchedulerData(ctx.tid, weeks),
      );
      sendFiltered(res, ctx.persona, "scheduler", data);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to load scheduler" });
    }
  });

  app.post("/api/resource-planning/bookings", async (req, res) => {
    const ctx = await guardRp(req, res, "scheduler");
    if (!ctx) return;
    const parsed = bookingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message });
    try {
      const result = await createBooking(ctx.tid, parsed.data, getUserId(req));
      mutateInvalidate(ctx.tid);
      res.status(201).json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to create booking" });
    }
  });

  app.put("/api/resource-planning/bookings/:id", async (req, res) => {
    const ctx = await guardRp(req, res, "scheduler");
    if (!ctx) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    try {
      const result = await updateBooking(ctx.tid, id, req.body, getUserId(req));
      if (!result) return res.status(404).json({ message: "Booking not found" });
      mutateInvalidate(ctx.tid);
      res.json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to update booking" });
    }
  });

  app.post("/api/resource-planning/bookings/:id/move", async (req, res) => {
    const ctx = await guardRp(req, res, "scheduler");
    if (!ctx) return;
    const id = Number(req.params.id);
    const resourceId = Number(req.body?.resourceId);
    const startWeek = Number(req.body?.startWeek);
    if (!Number.isFinite(id) || !Number.isFinite(resourceId) || !Number.isFinite(startWeek)) {
      return res.status(400).json({ message: "id, resourceId, startWeek required" });
    }
    try {
      const result = await moveBookingToWeek(ctx.tid, id, { resourceId, startWeek }, getUserId(req));
      if (!result) return res.status(404).json({ message: "Booking not found" });
      mutateInvalidate(ctx.tid);
      res.json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to move booking" });
    }
  });

  app.post("/api/resource-planning/bookings/:id/extend", async (req, res) => {
    const ctx = await guardRp(req, res, "scheduler");
    if (!ctx) return;
    const id = Number(req.params.id);
    const endWeek = Number(req.body?.endWeek);
    if (!Number.isFinite(id) || !Number.isFinite(endWeek)) {
      return res.status(400).json({ message: "id, endWeek required" });
    }
    try {
      const result = await extendBookingToWeek(ctx.tid, id, endWeek, getUserId(req));
      if (!result) return res.status(404).json({ message: "Booking not found" });
      mutateInvalidate(ctx.tid);
      res.json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to extend booking" });
    }
  });

  app.post("/api/resource-planning/bookings/:id/promote", async (req, res) => {
    const ctx = await guardRp(req, res, "scheduler");
    if (!ctx) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const result = await promoteBooking(ctx.tid, id, getUserId(req));
    if (!result) return res.status(404).json({ message: "Booking not found" });
    mutateInvalidate(ctx.tid);
    res.json(result);
  });

  app.post("/api/resource-planning/pipeline/:id/promote", async (req, res) => {
    const ctx = await guardRp(req, res, "pipeline");
    if (!ctx) return;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const result = await promoteOpportunityDemand(ctx.tid, id, getUserId(req));
    mutateInvalidate(ctx.tid);
    res.json(result);
  });

  app.delete("/api/resource-planning/bookings/:id", async (req, res) => {
    const ctx = await guardRp(req, res, "scheduler");
    if (!ctx) return;
    const id = Number(req.params.id);
    const ok = await deleteBooking(ctx.tid, id, getUserId(req));
    if (!ok) return res.status(404).json({ message: "Booking not found" });
    mutateInvalidate(ctx.tid);
    res.json({ success: true });
  });

  app.post("/api/resource-planning/auto-match", async (req, res) => {
    const ctx = await guardRp(req, res, "scheduler");
    if (!ctx) return;
    const { roleName, startDate, endDate } = req.body ?? {};
    if (!roleName || !startDate || !endDate) {
      return res.status(400).json({ message: "roleName, startDate, endDate required" });
    }
    res.json({ matches: await autoMatchResources(ctx.tid, roleName, startDate, endDate) });
  });

  app.get("/api/resource-planning/skills-inventory", async (req, res) => {
    const ctx = await guardRp(req, res, "skills");
    if (!ctx) return;
    const q = String(req.query.q ?? "");
    const data = await rpCached(
      rpCacheKey(ctx.tid, "skills", { q }),
      DEFAULT_TTL_MS,
      () => getSkillsInventory(ctx.tid, q),
    );
    sendFiltered(res, ctx.persona, "skills", data);
  });

  app.get("/api/resource-planning/pipeline", async (req, res) => {
    const ctx = await guardRp(req, res, "pipeline");
    if (!ctx) return;
    const scenario = (req.query.scenario as "expected" | "best" | "worst") ?? "expected";
    const data = await rpCached(
      rpCacheKey(ctx.tid, "pipeline", { scenario }),
      DEFAULT_TTL_MS,
      () => getPipelineDemand(ctx.tid, scenario),
    );
    sendFiltered(res, ctx.persona, "pipeline", data);
  });

  app.get("/api/resource-planning/recruitment", async (req, res) => {
    const ctx = await guardRp(req, res, "recruitment");
    if (!ctx) return;
    const data = await rpCached(
      rpCacheKey(ctx.tid, "recruitment"),
      DEFAULT_TTL_MS,
      () => getRecruitmentForecast(ctx.tid),
    );
    sendFiltered(res, ctx.persona, "recruitment", data);
  });

  app.post("/api/resource-planning/recruitment/:id/status", async (req, res) => {
    const ctx = await guardRp(req, res, "recruitment");
    if (!ctx) return;
    const id = Number(req.params.id);
    const status = String(req.body?.status ?? "in-progress");
    const row = await updateRecruitmentStatus(ctx.tid, id, status, getUserId(req));
    if (!row) return res.status(404).json({ message: "Not found" });
    mutateInvalidate(ctx.tid);
    res.json(row);
  });

  app.get("/api/resource-planning/recruitment/export", async (req, res) => {
    const ctx = await guardRp(req, res, "recruitment");
    if (!ctx) return;
    const format = String(req.query.format ?? "csv");
    const data = await getRecruitmentForecast(ctx.tid);
    if (format === "pdf") {
      const buf = recruitmentForecastPdf(data.cards, data.timeline);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=recruitment-export.pdf");
      return res.send(buf);
    }
    const csv = await exportRecruitmentToHr(ctx.tid);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=recruitment-export.csv");
    res.send(csv);
  });

  app.get("/api/resource-planning/bench", async (req, res) => {
    const ctx = await guardRp(req, res, "bench");
    if (!ctx) return;
    const data = await rpCached(
      rpCacheKey(ctx.tid, "bench"),
      DEFAULT_TTL_MS,
      () => getBenchManagement(ctx.tid),
    );
    sendFiltered(res, ctx.persona, "bench", data);
  });

  app.get("/api/resource-planning/scenarios", async (req, res) => {
    const ctx = await guardRp(req, res, "scenarios");
    if (!ctx) return;
    const data = await rpCached(
      rpCacheKey(ctx.tid, "scenarios"),
      DEFAULT_TTL_MS,
      () => getScenarios(ctx.tid),
    );
    sendFiltered(res, ctx.persona, "scenarios", data);
  });

  app.post("/api/resource-planning/scenarios", async (req, res) => {
    const ctx = await guardRp(req, res, "scenarios");
    if (!ctx) return;
    const name = String(req.body?.name ?? "").trim();
    if (!name) return res.status(400).json({ message: "name required" });
    const row = await createScenario(ctx.tid, { name, scenarioType: req.body?.scenarioType, assumptions: req.body?.assumptions }, getUserId(req));
    mutateInvalidate(ctx.tid);
    res.status(201).json(row);
  });

  app.post("/api/resource-planning/ai/query", async (req, res) => {
    const ctx = await guardRp(req, res, "ai");
    if (!ctx) return;
    const query = String(req.body?.query ?? "").trim();
    if (!query) return res.status(400).json({ message: "query required" });
    try {
      sendFiltered(res, ctx.persona, "ai", await queryAiWorkforcePlanner(ctx.tid, query));
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "AI query failed" });
    }
  });
}

/** Called from CRM routes after opportunity mutations */
export async function triggerCrmPipelineSync(tenantId: number, actorUserId: string | null) {
  const result = await syncPipelineFromCrm(tenantId, actorUserId);
  invalidateRpTenantCache(tenantId);
  return result;
}
