import type { Express } from "express";
import { storage } from "../storage";
import * as bpmService from "./service";
import { BPML_CORE_FIELDS } from "@shared/models/bpml";

function getUserId(req: any): string | null {
  return req.user?.claims?.sub ?? req.user?.id ?? req.session?.userId ?? null;
}

function getApiTenantIdWithFallback(req: any): number {
  return Number(req.query.tenantId || req.body?.tenantId || 1);
}

export function registerBpmExtensionRoutes(app: Express) {
  // Process Portal routes — registered before Help Desk /api/portal/:token to avoid route shadowing
  app.get("/api/portal/menu-nodes", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const nodes = await storage.getPortalMenuNodes(tenantId);
    res.json(nodes);
  });

  app.post("/api/portal/menu-nodes", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const node = await storage.createPortalMenuNode(req.body);
      res.status(201).json(node);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/portal/menu-nodes/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const node = await storage.updatePortalMenuNode(Number(req.params.id), req.body);
      if (!node) return res.status(404).json({ message: "Menu node not found" });
      res.json(node);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/portal/menu-nodes/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePortalMenuNode(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/portal/assignments", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = getApiTenantIdWithFallback(req);
    const menuNodeId = req.query.menuNodeId ? Number(req.query.menuNodeId) : undefined;
    if (menuNodeId) {
      const assignments = await storage.getPortalDiagramAssignments(menuNodeId);
      res.json(assignments);
    } else {
      const assignments = await storage.getAllPortalDiagramAssignments(tenantId);
      res.json(assignments);
    }
  });

  app.post("/api/portal/assignments", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const assignment = await storage.createPortalDiagramAssignment(req.body);
      res.status(201).json(assignment);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/portal/assignments/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    await storage.deletePortalDiagramAssignment(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/bpm/portal-settings", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const libraryId = req.query.libraryId ? Number(req.query.libraryId) : undefined;
      const settings = await bpmService.getPortalSettings(tenantId, libraryId);
      res.json(settings || {
        tenantId, libraryId: libraryId ?? null,
        accessModel: "open", businessAreaColors: {}, userAreaTags: {}, customAssetTypes: [],
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.put("/api/bpm/portal-settings", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const settings = await bpmService.upsertPortalSettings({ tenantId, ...req.body });
      res.json(settings);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/bpml/entries/:id/history", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const history = await bpmService.getBpmlEntryHistory(Number(req.params.id));
      res.json(history);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/bpml/entries/bulk-upsert", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { rows, mode = "append", templateId } = req.body;
      const tenantId = getApiTenantIdWithFallback(req);
      const result = await bpmService.bulkUpsertBpmlEntries(Number(templateId), tenantId, rows, mode);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/bpml/entries/:id/generate-id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const entry = await storage.getBpmlEntry(Number(req.params.id));
      if (!entry) return res.status(404).json({ message: "Entry not found" });
      const bpmlId = await bpmService.generateProcessId(entry.templateId, entry.tenantId);
      const updated = await storage.updateBpmlEntry(entry.id, { bpmlId, updatedBy: userId });
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/bpm/diagrams/:diagramId/step-links", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const nodeId = req.query.nodeId as string | undefined;
      const links = await bpmService.getBpmStepLinks(Number(req.params.diagramId), nodeId);
      res.json(links);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/bpm/diagrams/:diagramId/step-links", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const link = await bpmService.createBpmStepLink({
        diagramId: Number(req.params.diagramId),
        ...req.body,
      });
      res.status(201).json(link);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/bpm/step-links/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      await bpmService.deleteBpmStepLink(Number(req.params.id));
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/bpm/diagrams/:diagramId/test-coverage", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const coverage = await bpmService.getTestCoverageForDiagram(Number(req.params.diagramId));
      res.json(coverage);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.post("/api/bpm/templates/:id/submit", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const sub = await bpmService.submitBpmTemplate(Number(req.params.id), tenantId, userId);
      res.status(201).json(sub);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/bpm/template-submissions", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = getApiTenantIdWithFallback(req);
      const subs = await bpmService.getBpmTemplateSubmissions(tenantId);
      res.json(subs);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  app.patch("/api/bpm/template-submissions/:id/review", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const { status, feedback } = req.body;
      const sub = await bpmService.reviewBpmTemplateSubmission(
        Number(req.params.id), status, feedback || "", userId,
      );
      res.json(sub);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/bpm/diagrams/:id/process-report", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const diagram = await storage.getBpmDiagram(Number(req.params.id));
      if (!diagram) return res.status(404).json({ message: "Diagram not found" });
      const nodes = ((diagram.canvasData as any)?.nodes || []).filter((n: any) =>
        !["swimlane_pool", "swimlane_lane", "annotation"].includes(n.type),
      );
      let totalCost = 0, totalDuration = 0, totalFte = 0, automated = 0;
      const riskSummary: { label: string; risk: string }[] = [];
      for (const node of nodes) {
        const attrs = node.data?.attributes || {};
        totalCost += Number(attrs.cost) || 0;
        totalDuration += Number(attrs.duration) || 0;
        totalFte += Number(attrs.resources) || 0;
        if ((attrs.automationPercent ?? 0) >= 80) automated++;
        if (attrs.riskRating) riskSummary.push({ label: node.data?.label || node.id, risk: attrs.riskRating });
      }
      res.json({
        diagramName: diagram.name,
        totalCost, totalDuration, totalFte,
        stepCount: nodes.length,
        automationPercent: nodes.length ? Math.round((automated / nodes.length) * 100) : 0,
        riskSummary,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });
}

export { BPML_CORE_FIELDS };
