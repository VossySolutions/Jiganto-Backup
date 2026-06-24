import type { Express, Request } from "express";
import { z } from "zod";
import { effectiveUserId } from "../auth/impersonationRoutes";
import { requireApiTenantId } from "../lib/api-tenant-id";
import { resolveListClientId } from "../lib/list-client-id";
import { storage } from "../storage";
import { insertPmPortfolioSchema, insertPmReportScheduleSchema, insertPmCustomReportSchema } from "@shared/schema";
import {
  getPortfolioDashboard,
  getProgrammesList,
  getProgrammeDetail,
  getRoadmapData,
  getHealthMatrix,
  generate360Report,
  saveReportSnapshot,
  listReportSchedules,
  createReportSchedule,
  listPortfoliosWithLinks,
  syncProjectPortfolioLinks,
  syncPortfolioProjectLinks,
  getPortfolioSummaryReport,
  getRaidConsolidated,
  getMilestoneRegister,
  getScopedMilestones,
  getPortfolioProjectLinks,
} from "./service";
import {
  captureHealthMatrixSnapshots,
  getProjectHealthHistory,
  getHealthMatrixAtWeek,
  listHealthSnapshotWeeks,
} from "./health-history";
import {
  listCustomReports,
  getCustomReport,
  createCustomReport,
  updateCustomReport,
  deleteCustomReport,
  runCustomReport,
  getAvailableFields,
} from "./custom-reports";
import { build360ReportPptx, map360ReportToPptxInput } from "./pptx-export";

function getUserId(req: Request): string | null {
  return effectiveUserId(req);
}

export function registerPortfolioRoutes(app: Express): void {
  app.get("/api/portfolio/dashboard", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    const data = await getPortfolioDashboard(tenantId, resolveListClientId(req));
    res.json(data);
  });

  app.get("/api/portfolio/programmes", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    res.json(await getProgrammesList(tenantId, resolveListClientId(req)));
  });

  app.get("/api/portfolio/programmes/:source/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    const source = req.params.source === "project" ? "project" : "program";
    const detail = await getProgrammeDetail(tenantId, Number(req.params.id), source);
    if (!detail) return res.status(404).json({ message: "Programme not found" });
    res.json(detail);
  });

  app.get("/api/portfolio/roadmap", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    res.json(await getRoadmapData(tenantId, resolveListClientId(req)));
  });

  app.get("/api/portfolio/health-matrix", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    const clientId = resolveListClientId(req);
    const snapshotWeek = typeof req.query.snapshotWeek === "string" ? req.query.snapshotWeek : undefined;

    if (snapshotWeek) {
      const historical = await getHealthMatrixAtWeek(tenantId, snapshotWeek, clientId);
      if (historical) return res.json(historical);
    }

    const weeks = await listHealthSnapshotWeeks(tenantId);
    if (!weeks.length) await captureHealthMatrixSnapshots(tenantId, clientId);
    res.json(await getHealthMatrix(tenantId, clientId));
  });

  app.get("/api/portfolio/health-matrix/snapshot-weeks", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    res.json(await listHealthSnapshotWeeks(tenantId));
  });

  app.get("/api/portfolio/health-matrix/history/:projectId", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    const weeks = Number(req.query.weeks) || 4;
    res.json(await getProjectHealthHistory(Number(req.params.projectId), tenantId, weeks));
  });

  app.post("/api/portfolio/health-matrix/capture", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    const saved = await captureHealthMatrixSnapshots(tenantId, resolveListClientId(req));
    res.json({ saved });
  });

  app.get("/api/portfolio/milestones", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    res.json(await getMilestoneRegister(tenantId, resolveListClientId(req)));
  });

  app.get("/api/portfolio/portfolios", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    res.json(await listPortfoliosWithLinks(tenantId, resolveListClientId(req)));
  });

  app.post("/api/portfolio/portfolios", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const input = insertPmPortfolioSchema.parse({ ...req.body, tenantId });
      const portfolio = await storage.createPmPortfolio(input);
      res.status(201).json(portfolio);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put("/api/portfolio/portfolios/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    const existing = await storage.getPmPortfolio(Number(req.params.id));
    if (!existing || existing.tenantId !== tenantId) return res.status(404).json({ message: "Portfolio not found" });
    const portfolio = await storage.updatePmPortfolio(Number(req.params.id), req.body);
    res.json(portfolio);
  });

  app.delete("/api/portfolio/portfolios/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    const existing = await storage.getPmPortfolio(Number(req.params.id));
    if (!existing || existing.tenantId !== tenantId) return res.status(404).json({ message: "Portfolio not found" });
    await storage.deletePmPortfolio(Number(req.params.id));
    res.status(204).send();
  });

  app.put("/api/portfolio/projects/:projectId/portfolios", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    const project = await storage.getPmProject(Number(req.params.projectId));
    if (!project || project.tenantId !== tenantId) return res.status(404).json({ message: "Project not found" });
    const portfolioIds = Array.isArray(req.body.portfolioIds) ? req.body.portfolioIds.map(Number) : [];
    await syncProjectPortfolioLinks(Number(req.params.projectId), portfolioIds);
    res.json({ ok: true, portfolioIds });
  });

  app.get("/api/portfolio/reports/summary", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    res.json(await getPortfolioSummaryReport(tenantId, resolveListClientId(req)));
  });

  app.get("/api/portfolio/reports/raid-consolidated", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    res.json(await getRaidConsolidated(tenantId, resolveListClientId(req)));
  });

  app.get("/api/portfolio/reports/360/:projectId", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    const report = await generate360Report(tenantId, Number(req.params.projectId));
    if (!report) return res.status(404).json({ message: "Project not found" });
    res.json(report);
  });

  app.post("/api/portfolio/reports/360/:projectId", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    const narrative = typeof req.body?.narrative === "string" ? req.body.narrative : undefined;
    const report = await generate360Report(tenantId, Number(req.params.projectId), narrative);
    if (!report) return res.status(404).json({ message: "Project not found" });
    const snapshot = await saveReportSnapshot(tenantId, "360_report", report, userId, Number(req.params.projectId));
    res.status(201).json({ report, snapshotId: snapshot.id });
  });

  app.get("/api/portfolio/reports/360/:projectId/pptx", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    const narrative = typeof req.query.narrative === "string" ? req.query.narrative : undefined;
    const report = await generate360Report(tenantId, Number(req.params.projectId), narrative);
    if (!report) return res.status(404).json({ message: "Project not found" });
    const buffer = await build360ReportPptx(map360ReportToPptxInput(report, narrative));
    const safeName = report.executiveSummary.projectName.replace(/[^a-z0-9]/gi, "_");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}_360_report.pptx"`);
    res.send(buffer);
  });

  app.get("/api/portfolio/portfolios/:id/projects", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    res.json(await getPortfolioProjectLinks(Number(req.params.id), tenantId, resolveListClientId(req)));
  });

  app.put("/api/portfolio/portfolios/:id/projects", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    const portfolio = await storage.getPmPortfolio(Number(req.params.id));
    if (!portfolio || portfolio.tenantId !== tenantId) return res.status(404).json({ message: "Portfolio not found" });
    const projectIds = Array.isArray(req.body.projectIds) ? req.body.projectIds.map(Number) : [];
    await syncPortfolioProjectLinks(Number(req.params.id), projectIds);
    res.json({ ok: true, projectIds });
  });

  app.get("/api/portfolio/reports/schedules", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    res.json(await listReportSchedules(tenantId));
  });

  app.post("/api/portfolio/reports/schedules", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const input = insertPmReportScheduleSchema.parse({
        ...req.body,
        tenantId,
        createdBy: userId,
      });
      const schedule = await createReportSchedule(input);
      res.status(201).json(schedule);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.get("/api/portfolio/custom-reports", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    res.json(await listCustomReports(tenantId));
  });

  app.get("/api/portfolio/custom-reports/fields/:dataSource", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    res.json(getAvailableFields(req.params.dataSource));
  });

  app.get("/api/portfolio/custom-reports/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    const report = await getCustomReport(Number(req.params.id), tenantId);
    if (!report) return res.status(404).json({ message: "Report not found" });
    res.json(report);
  });

  app.post("/api/portfolio/custom-reports", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    try {
      const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
      const input = insertPmCustomReportSchema.parse({
        ...req.body,
        tenantId,
        createdBy: userId,
      });
      const report = await createCustomReport(input);
      res.status(201).json(report);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put("/api/portfolio/custom-reports/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    const report = await updateCustomReport(Number(req.params.id), tenantId, req.body);
    if (!report) return res.status(404).json({ message: "Report not found" });
    res.json(report);
  });

  app.delete("/api/portfolio/custom-reports/:id", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    await deleteCustomReport(Number(req.params.id), tenantId);
    res.status(204).send();
  });

  app.post("/api/portfolio/custom-reports/:id/run", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    const saved = await getCustomReport(Number(req.params.id), tenantId);
    if (!saved) return res.status(404).json({ message: "Report not found" });
    const result = await runCustomReport(tenantId, saved.dataSource, saved.config, resolveListClientId(req));
    res.json(result);
  });

  app.post("/api/portfolio/custom-reports/run", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const tenantId = requireApiTenantId(req, res);
      if (tenantId == null) return;
    const { dataSource, config } = req.body;
    if (!dataSource || !config) return res.status(400).json({ message: "dataSource and config required" });
    const result = await runCustomReport(tenantId, dataSource, config, resolveListClientId(req));
    res.json(result);
  });
}
