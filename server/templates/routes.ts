import type { Express, Request } from "express";
import { requireApiTenantId } from "../lib/api-tenant-id";
import * as tplService from "./service";
import { generateTemplateWithAi } from "./ai";
import type { TemplateModule } from "@shared/models/templates";

function userId(req: Request): string {
  const u = req.user as { id?: string; claims?: { sub?: string }; firstName?: string; lastName?: string; email?: string };
  return u?.id ?? u?.claims?.sub ?? "";
}

function userName(req: Request): string {
  const u = req.user as { firstName?: string; lastName?: string; email?: string };
  return u?.firstName && u?.lastName ? `${u.firstName} ${u.lastName}` : (u?.email ?? "User");
}

export function registerTemplateRoutes(app: Express): void {
  app.get("/api/templates", async (req, res) => {
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      if (!userId(req)) return res.status(401).json({ message: "Unauthorized" });
      await tplService.ensureTemplatesReady(tenantId);
      const templates = await tplService.listTemplates({
        tenantId,
        userId: userId(req),
        module: req.query.module as string | undefined,
        tier: req.query.tier as string | undefined,
        tag: req.query.tag as string | undefined,
        status: (req.query.status as string) || "active",
        search: req.query.search as string | undefined,
        createdBy: req.query.createdBy as string | undefined,
        sort: req.query.sort as string | undefined,
      });
      res.json(templates);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/templates/marketplace", async (req, res) => {
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      if (!userId(req)) return res.status(401).json({ message: "Unauthorized" });
      await tplService.ensureTemplatesReady(tenantId);
      const items = await tplService.listMarketplaceTemplates(tenantId);
      res.json(items);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/templates/discovery", async (req, res) => {
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const uid = userId(req);
      if (!uid) return res.status(401).json({ message: "Unauthorized" });
      await tplService.ensureTemplatesReady(tenantId);
      const discovery = await tplService.getDiscovery(tenantId, uid);
      res.json(discovery);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/templates/module-counts", async (req, res) => {
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      if (!userId(req)) return res.status(401).json({ message: "Unauthorized" });
      await tplService.ensureTemplatesReady(tenantId);
      const counts = await tplService.getModuleCounts(tenantId);
      res.json(counts);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/templates/snapshot", async (req, res) => {
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      if (!userId(req)) return res.status(401).json({ message: "Unauthorized" });
      const module = req.query.module as TemplateModule;
      const sourceId = Number(req.query.sourceId);
      if (!module || !sourceId) return res.status(400).json({ message: "module and sourceId required" });
      const snapshot = await tplService.buildSnapshot(module, sourceId, tenantId);
      res.json({ snapshot });
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.get("/api/templates/:id", async (req, res) => {
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      if (!userId(req)) return res.status(401).json({ message: "Unauthorized" });
      const tpl = await tplService.getTemplate(Number(req.params.id), tenantId);
      if (!tpl) return res.status(404).json({ message: "Template not found" });
      res.json(tpl);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/templates", async (req, res) => {
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const uid = userId(req);
      if (!uid) return res.status(401).json({ message: "Unauthorized" });
      const tpl = await tplService.registerTemplate({
        tenantId, userId: uid, userName: userName(req), ...req.body,
      });
      res.status(201).json(tpl);
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.post("/api/templates/register", async (req, res) => {
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const uid = userId(req);
      if (!uid) return res.status(401).json({ message: "Unauthorized" });
      const tpl = await tplService.registerTemplate({
        tenantId, userId: uid, userName: userName(req), ...req.body,
      });
      res.status(201).json(tpl);
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.patch("/api/templates/:id", async (req, res) => {
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      if (!userId(req)) return res.status(401).json({ message: "Unauthorized" });
      const tpl = await tplService.updateTemplate(Number(req.params.id), tenantId, req.body);
      res.json(tpl);
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.delete("/api/templates/:id", async (req, res) => {
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      if (!userId(req)) return res.status(401).json({ message: "Unauthorized" });
      await tplService.deleteTemplate(Number(req.params.id), tenantId);
      res.status(204).send();
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.post("/api/templates/apply", async (req, res) => {
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const uid = userId(req);
      if (!uid) return res.status(401).json({ message: "Unauthorized" });
      const { templateId, name, workspaceId, projectId } = req.body;
      if (!templateId) return res.status(400).json({ message: "templateId required" });
      const result = await tplService.applyAndLog({
        templateId: Number(templateId),
        tenantId, userId: uid, userName: userName(req),
        name, workspaceId, projectId,
      });
      res.json(result);
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.post("/api/templates/:id/submit", async (req, res) => {
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      if (!userId(req)) return res.status(401).json({ message: "Unauthorized" });
      const tpl = await tplService.submitForReview(Number(req.params.id), tenantId, req.body.note);
      res.json(tpl);
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.post("/api/templates/:id/review", async (req, res) => {
    try {
      if (!userId(req)) return res.status(401).json({ message: "Unauthorized" });
      const { status, note } = req.body;
      if (!["approved", "declined"].includes(status)) return res.status(400).json({ message: "status must be approved or declined" });
      const tpl = await tplService.reviewTemplate(Number(req.params.id), status, note, req.body.contributorOrgId);
      res.json(tpl);
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.post("/api/templates/ai-generate", async (req, res) => {
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const uid = userId(req);
      if (!uid) return res.status(401).json({ message: "Unauthorized" });
      const { module, prompt, categoryTags } = req.body;
      if (!module || !prompt?.trim()) return res.status(400).json({ message: "module and prompt required" });
      const tpl = await generateTemplateWithAi({
        tenantId, userId: uid, userName: userName(req),
        module, prompt: prompt.trim(), categoryTags,
      });
      res.status(201).json(tpl);
    } catch (e: unknown) {
      const msg = (e as Error).message;
      if (msg.includes("token") || msg.includes("AI")) return res.status(402).json({ message: msg });
      res.status(400).json({ message: msg });
    }
  });

  app.post("/api/templates/sync", async (req, res) => {
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      if (!userId(req)) return res.status(401).json({ message: "Unauthorized" });
      await tplService.ensureTemplatesReady(tenantId);
      res.json({ success: true });
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  // Source-module save-as-template shortcuts
  const sourceSave = async (
    req: Request,
    res: import("express").Response,
    module: TemplateModule,
    sourceModule: string,
    sourceId: number,
    name: string,
    description?: string,
    categoryTags?: string[],
  ) => {
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const uid = userId(req);
      if (!uid) return res.status(401).json({ message: "Unauthorized" });
      const tpl = await tplService.registerTemplate({
        tenantId, userId: uid, userName: userName(req),
        module, sourceModule, sourceId, name, description, categoryTags,
        tier: "customer", status: "active",
      });
      res.status(201).json(tpl);
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  };

  app.post("/api/frameworks/:id/save-as-template", async (req, res) => {
    const tenantId = requireApiTenantId(req, res);
    if (tenantId == null) return;
    const fw = await (await import("../storage")).storage.getFramework(Number(req.params.id));
    if (!fw || fw.tenantId !== tenantId) return res.status(404).json({ message: "Framework not found" });
    await sourceSave(req, res, "bpm_framework", "bpm_framework", fw.id, req.body.name ?? fw.name, req.body.description ?? fw.description ?? undefined, req.body.categoryTags);
  });

  app.post("/api/pm/projects/:id/save-as-template", async (req, res) => {
    const tenantId = requireApiTenantId(req, res);
    if (tenantId == null) return;
    const project = await (await import("../storage")).storage.getPmProject(Number(req.params.id));
    if (!project || project.tenantId !== tenantId) return res.status(404).json({ message: "Project not found" });
    await sourceSave(req, res, "project", "project", project.id, req.body.name ?? project.name, req.body.description ?? project.description ?? undefined, req.body.categoryTags);
  });

  app.post("/api/org-charts/:id/save-as-template", async (req, res) => {
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    const { orgCharts } = await import("@shared/schema");
    const { db } = await import("../db");
    const { eq, and } = await import("drizzle-orm");
    const [chart] = await db.select().from(orgCharts).where(
      and(eq(orgCharts.id, Number(req.params.id)), eq(orgCharts.tenantId, tenantId)),
    );
    if (!chart) return res.status(404).json({ message: "Org chart not found" });
    await sourceSave(req, res, "bpm_orgchart", "bpm_orgchart", chart.id, req.body.name ?? chart.name, req.body.description ?? chart.description ?? undefined, req.body.categoryTags);
  });

  app.post("/api/bpml/templates/:id/save-as-template", async (req, res) => {
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    const { storage } = await import("../storage");
    const template = await storage.getBpmlTemplate(Number(req.params.id));
    if (!template || template.tenantId !== tenantId) return res.status(404).json({ message: "BPML library not found" });
    await sourceSave(req, res, "bpml", "bpml", template.id, req.body.name ?? template.name, req.body.description ?? template.description ?? undefined, req.body.categoryTags);
  });

  app.post("/api/tm/projects/:id/save-as-template", async (req, res) => {
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    const { storage } = await import("../storage");
    const project = await storage.getTmProject(Number(req.params.id));
    if (!project || project.tenantId !== tenantId) return res.status(404).json({ message: "Test project not found" });
    await sourceSave(req, res, "test_mgmt", "test_mgmt", project.id, req.body.name ?? project.name, req.body.description ?? project.description ?? undefined, req.body.categoryTags);
  });

  app.post("/api/whiteboard/:id/save-as-template", async (req, res) => {
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    const { whiteboards } = await import("@shared/schema");
    const { db } = await import("../db");
    const { eq, and } = await import("drizzle-orm");
    const [board] = await db.select().from(whiteboards).where(
      and(eq(whiteboards.id, Number(req.params.id)), eq(whiteboards.tenantId, tenantId)),
    );
    if (!board) return res.status(404).json({ message: "Whiteboard not found" });
    await sourceSave(req, res, "whiteboard", "whiteboard", board.id, req.body.name ?? board.name, req.body.description ?? board.description ?? undefined, req.body.categoryTags);
  });
}
