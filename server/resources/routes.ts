import type { Express, Request } from "express";
import { z } from "zod";
import {
  insertResourceLeaveSchema,
  insertTimesheetIntegrationSchema,
  insertDocumentResourceLinkSchema,
} from "@shared/schema";
import { effectiveUserId } from "../auth/impersonationRoutes";
import { getApiTenantIdWithFallback } from "../lib/api-tenant-id";
import { resolveUserPermissions } from "../lib/permissions";
import { storage } from "../storage";
import {
  exportTimesheetsCsv,
  getCapacityVsDemand,
  getExtendedResourceStats,
  getPipelineView,
  getSkillsDemandHeatmap,
  getUtilisationTrend,
  getAllResourceSkillsMap,
  getResourceOrgTree,
  listIntegrationLogs,
  listLeaves,
  listResourceDocuments,
  linkResourceDocument,
  unlinkResourceDocument,
  listTimesheetIntegrations,
  logTimesheetAudit,
  runSkillsGapAnalysis,
  searchResourcesBySkills,
} from "./service";
import {
  approveTimesheetPm,
  approveTimesheetRm,
  rejectTimesheetPeriod,
  submitTimesheetPeriod,
  bulkApproveTimesheets,
  approveTimesheetEntry,
  rejectTimesheetEntry,
  listTimesheetEntries,
  getTimesheetPeriod,
} from "../finance/repository";
import { deliverTimesheetIntegration } from "./jobs";
import {
  resolveResourceScope,
  canAccessResource,
  assertManager,
  type ResourceScope,
} from "./permissions";
import { db } from "../db";
import { timesheetIntegrations, resourceLeaves } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

function getUserId(req: Request): string | null {
  return effectiveUserId(req);
}

async function getScope(req: Request): Promise<{ userId: string; tenantId: number; scope: ResourceScope } | null> {
  const userId = getUserId(req);
  if (!userId) return null;
  const tenantId = getApiTenantIdWithFallback(req);
  const perms = await resolveUserPermissions(userId, tenantId);
  const scope = await resolveResourceScope(userId, tenantId, perms.platformRole);
  return { userId, tenantId, scope };
}

export function registerResourcesRoutes(app: Express): void {
  app.get("/api/resources/scope", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    res.json(ctx.scope);
  });

  app.get("/api/resources/org-chart", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    try {
      res.json(await getResourceOrgTree(ctx.tenantId));
    } catch (err: any) {
      res.status(500).json({ message: err.message ?? "Failed to load org chart" });
    }
  });

  app.get("/api/resources/skills-map", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    try {
      const map = await getAllResourceSkillsMap(ctx.tenantId);
      if (ctx.scope.visibleResourceIds !== "all") {
        const filtered: Record<number, unknown[]> = {};
        for (const id of ctx.scope.visibleResourceIds) {
          if (map[id]) filtered[id] = map[id];
        }
        return res.json(filtered);
      }
      res.json(map);
    } catch (err: any) {
      res.status(500).json({ message: err.message ?? "Failed to load skills map" });
    }
  });

  app.get("/api/resources/dashboard", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    if (ctx.scope.role === "self") {
      return res.json({
        stats: { utilisationPct: 0, onBench: 0, overAllocated: 0, activeResources: 1, utilByResource: {} },
        trend: [],
        capacityDemand: [],
        skillsHeatmap: { roles: [], weekLabels: [], matrix: {} },
      });
    }
    try {
      const [stats, trend, capacityDemand, skillsHeatmap] = await Promise.all([
        getExtendedResourceStats(ctx.tenantId),
        getUtilisationTrend(ctx.tenantId, 12),
        getCapacityVsDemand(ctx.tenantId, 8),
        getSkillsDemandHeatmap(ctx.tenantId, 8),
      ]);
      res.json({ stats, trend, capacityDemand, skillsHeatmap });
    } catch (err: any) {
      console.error("[resources/dashboard]", err);
      res.status(500).json({ message: err.message ?? "Failed to load dashboard" });
    }
  });

  app.get("/api/resources/pipeline-view", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    if (!ctx.scope.canViewPipeline) return res.status(403).json({ message: "Pipeline access denied" });
    const stages = typeof req.query.stages === "string" ? req.query.stages.split(",") : undefined;
    res.json(await getPipelineView(ctx.tenantId, stages));
  });

  app.post("/api/resources/skills/search", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    if (ctx.scope.role === "self") return res.status(403).json({ message: "Access denied" });
    try {
      const body = z.object({
        criteria: z.array(z.object({
          skillId: z.number(),
          minLevel: z.number().optional(),
          minYears: z.number().optional(),
        })),
        logic: z.enum(["and", "or"]).optional(),
        availableFrom: z.string().optional(),
        location: z.string().optional(),
      }).parse(req.body);
      const results = await searchResourcesBySkills(ctx.tenantId, body.criteria, body.logic ?? "and", {
        availableFrom: body.availableFrom,
        location: body.location,
      });
      res.json(results);
    } catch (err: any) {
      res.status(400).json({ message: err.message ?? "Invalid search" });
    }
  });

  app.get("/api/resources/skills/gap-analysis/:planId", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    if (ctx.scope.role === "self") return res.status(403).json({ message: "Access denied" });
    res.json(await runSkillsGapAnalysis(ctx.tenantId, Number(req.params.planId)));
  });

  app.get("/api/resources/leaves", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    const resourceId = req.query.resourceId ? Number(req.query.resourceId) : undefined;
    if (resourceId && !canAccessResource(ctx.scope, resourceId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    res.json(await listLeaves(ctx.tenantId, resourceId));
  });

  app.post("/api/resources/leaves", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    try {
      const data = insertResourceLeaveSchema.parse({ ...req.body, tenantId: ctx.tenantId });
      if (!canAccessResource(ctx.scope, data.resourceId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const [row] = await db.insert(resourceLeaves).values(data).returning();
      res.status(201).json(row);
    } catch (err: any) {
      res.status(400).json({ message: err.message ?? "Invalid leave" });
    }
  });

  app.get("/api/resources/timesheets/export", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    if (!ctx.scope.canViewReports && ctx.scope.role !== "manager") {
      return res.status(403).json({ message: "Export access denied" });
    }
    const resourceId = req.query.resourceId ? Number(req.query.resourceId) : undefined;
    if (resourceId && !canAccessResource(ctx.scope, resourceId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    const csv = await exportTimesheetsCsv(ctx.tenantId, {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      resourceId: resourceId ?? (ctx.scope.ownResourceId ?? undefined),
      format: (req.query.format as "standard" | "summary") ?? "standard",
    });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=timesheets-export.csv");
    res.send(csv);
  });

  app.get("/api/resources/timesheets/integrations", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    try { assertManager(ctx.scope); } catch { return res.status(403).json({ message: "Manager access required" }); }
    res.json(await listTimesheetIntegrations(ctx.tenantId));
  });

  app.post("/api/resources/timesheets/integrations", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    try { assertManager(ctx.scope); } catch { return res.status(403).json({ message: "Manager access required" }); }
    try {
      const data = insertTimesheetIntegrationSchema.parse({ ...req.body, tenantId: ctx.tenantId });
      const [row] = await db.insert(timesheetIntegrations).values(data).returning();
      res.status(201).json(row);
    } catch (err: any) {
      res.status(400).json({ message: err.message ?? "Invalid integration" });
    }
  });

  app.post("/api/resources/timesheets/integrations/:id/deliver", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    try { assertManager(ctx.scope); } catch { return res.status(403).json({ message: "Manager access required" }); }
    const result = await deliverTimesheetIntegration(ctx.tenantId, Number(req.params.id));
    res.json(result);
  });

  app.get("/api/resources/timesheets/integration-log", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    try { assertManager(ctx.scope); } catch { return res.status(403).json({ message: "Manager access required" }); }
    const integrationId = req.query.integrationId ? Number(req.query.integrationId) : undefined;
    res.json(await listIntegrationLogs(ctx.tenantId, integrationId));
  });

  app.post("/api/resources/timesheets/periods/bulk-approve", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    if (!ctx.scope.canApproveTimesheets) return res.status(403).json({ message: "Approval access denied" });
    try {
      const body = z.object({
        periodIds: z.array(z.number()).min(1),
        role: z.enum(["pm", "rm"]),
      }).parse(req.body);
      const results = await bulkApproveTimesheets(ctx.tenantId, body.periodIds, body.role, ctx.userId);
      for (const p of results) {
        await logTimesheetAudit(ctx.tenantId, p.id, body.role === "pm" ? "pm_approved" : "rm_approved", ctx.userId, "bulk");
      }
      res.json(results);
    } catch (err: any) {
      res.status(400).json({ message: err.message ?? "Bulk approve failed" });
    }
  });

  app.post("/api/resources/timesheets/entries/:id/approve", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    if (!ctx.scope.canApproveTimesheets) return res.status(403).json({ message: "Approval access denied" });
    const entry = await approveTimesheetEntry(ctx.tenantId, Number(req.params.id), ctx.userId);
    if (!entry) return res.status(404).json({ message: "Entry not found" });
    res.json(entry);
  });

  app.post("/api/resources/timesheets/entries/:id/reject", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    if (!ctx.scope.canApproveTimesheets) return res.status(403).json({ message: "Approval access denied" });
    const reason = (req.body?.reason as string) || "Needs revision";
    const entry = await rejectTimesheetEntry(ctx.tenantId, Number(req.params.id), reason, ctx.userId);
    if (!entry) return res.status(404).json({ message: "Entry not found" });
    res.json(entry);
  });

  app.get("/api/resources/timesheets/periods/:id/entries", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    const period = await getTimesheetPeriod(ctx.tenantId, Number(req.params.id));
    if (!period) return res.status(404).json({ message: "Period not found" });
    if (!canAccessResource(ctx.scope, period.resourceId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    res.json(await listTimesheetEntries(period.id));
  });

  app.post("/api/resources/timesheets/periods/:id/submit", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    const period = await getTimesheetPeriod(ctx.tenantId, Number(req.params.id));
    if (!period) return res.status(404).json({ message: "Timesheet not found" });
    if (!canAccessResource(ctx.scope, period.resourceId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    const updated = await submitTimesheetPeriod(ctx.tenantId, period.id);
    await logTimesheetAudit(ctx.tenantId, period.id, "submitted", ctx.userId);
    res.json(updated);
  });

  app.post("/api/resources/timesheets/periods/:id/approve-pm", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    if (!ctx.scope.canApproveTimesheets) return res.status(403).json({ message: "Approval access denied" });
    const period = await approveTimesheetPm(ctx.tenantId, Number(req.params.id), ctx.userId);
    if (!period) return res.status(404).json({ message: "Timesheet not found" });
    await logTimesheetAudit(ctx.tenantId, period.id, "pm_approved", ctx.userId);
    res.json(period);
  });

  app.post("/api/resources/timesheets/periods/:id/approve-rm", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    if (!ctx.scope.canApproveTimesheets) return res.status(403).json({ message: "Approval access denied" });
    const period = await approveTimesheetRm(ctx.tenantId, Number(req.params.id), ctx.userId);
    if (!period) return res.status(404).json({ message: "Timesheet not found" });
    await logTimesheetAudit(ctx.tenantId, period.id, "rm_approved", ctx.userId);
    res.json(period);
  });

  app.post("/api/resources/timesheets/periods/:id/reject", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    if (!ctx.scope.canApproveTimesheets) return res.status(403).json({ message: "Approval access denied" });
    const reason = (req.body?.reason as string) || "Needs revision";
    const period = await rejectTimesheetPeriod(ctx.tenantId, Number(req.params.id), reason);
    if (!period) return res.status(404).json({ message: "Timesheet not found" });
    await logTimesheetAudit(ctx.tenantId, period.id, "rejected", ctx.userId, reason);
    res.json(period);
  });

  app.post("/api/resources/timesheets/periods/:id/request-signoff", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    if (!ctx.scope.canApproveTimesheets) return res.status(403).json({ message: "Approval access denied" });
    const periodId = Number(req.params.id);
    const period = await getTimesheetPeriod(ctx.tenantId, periodId);
    if (!period) return res.status(404).json({ message: "Timesheet not found" });

    const resource = await storage.getResource(period.resourceId);
    const body = z.object({
      signerEmail: z.string().email(),
      signerName: z.string().min(1),
      message: z.string().optional(),
    }).parse(req.body);

    const created = await storage.createSignoffRequest({
      tenantId: ctx.tenantId,
      title: `Timesheet approval — ${resource?.firstName ?? ""} ${resource?.lastName ?? ""} (${new Date(period.weekStartDate).toLocaleDateString()})`,
      sourceType: "timesheet_period",
      timesheetPeriodId: periodId,
      message: body.message,
      status: "pending",
      createdBy: ctx.userId,
      createdByName: body.signerName,
    });

    const token = crypto.randomBytes(32).toString("hex");
    await storage.createSignoffSigner({
      requestId: created.id,
      signerOrder: 1,
      name: body.signerName,
      email: body.signerEmail,
      isInternal: true,
      status: "pending",
      token,
      tokenExpiresAt: new Date(Date.now() + 7 * 86400000),
    });

    await storage.createSignoffAuditLog({
      requestId: created.id,
      event: "sent",
      actorName: body.signerName,
      actorEmail: body.signerEmail,
    });

    res.status(201).json({ ...created, signUrl: `/sign/${token}` });
  });

  app.get("/api/resources/:id/documents", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    const resourceId = Number(req.params.id);
    if (!canAccessResource(ctx.scope, resourceId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    res.json(await listResourceDocuments(ctx.tenantId, resourceId));
  });

  app.post("/api/resources/:id/documents", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    const resourceId = Number(req.params.id);
    if (!canAccessResource(ctx.scope, resourceId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    try {
      const data = insertDocumentResourceLinkSchema.parse({
        ...req.body,
        tenantId: ctx.tenantId,
        resourceId,
        createdById: ctx.userId,
      });
      const row = await linkResourceDocument(
        ctx.tenantId,
        resourceId,
        data.documentId,
        data.linkType ?? "general",
        ctx.userId,
        data.notes ?? undefined,
      );
      res.status(201).json(row);
    } catch (err: any) {
      res.status(400).json({ message: err.message ?? "Invalid link" });
    }
  });

  app.delete("/api/resources/documents/:linkId", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    await unlinkResourceDocument(ctx.tenantId, Number(req.params.linkId));
    res.status(204).send();
  });

  app.get("/api/resources/:id/profile", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    const resourceId = Number(req.params.id);
    if (!canAccessResource(ctx.scope, resourceId)) {
      return res.status(403).json({ message: "Access denied" });
    }
    const resource = await storage.getResource(resourceId);
    if (!resource) return res.status(404).json({ message: "Resource not found" });
    const [skillsList, allocations, periods, leaves, documents] = await Promise.all([
      storage.getResourceSkills(resourceId),
      storage.getAllocations(ctx.tenantId),
      storage.getTimesheetPeriods(ctx.tenantId, resourceId),
      listLeaves(ctx.tenantId, resourceId),
      listResourceDocuments(ctx.tenantId, resourceId),
    ]);
    const myAllocations = allocations.filter((a) => a.resourceId === resourceId);
    res.json({ resource, skills: skillsList, allocations: myAllocations, timesheets: periods, leaves, documents });
  });

  app.post("/api/resources/pipeline/:oppId/flag-capacity", async (req, res) => {
    const ctx = await getScope(req);
    if (!ctx) return res.status(401).json({ message: "Not authenticated" });
    if (!ctx.scope.canViewPipeline) return res.status(403).json({ message: "Access denied" });
    res.json({ message: "Capacity concern flagged to opportunity owner", opportunityId: Number(req.params.oppId) });
  });
}
