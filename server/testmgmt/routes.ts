import type { Express, Request, Response, RequestHandler } from "express";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { isRequestAuthenticated } from "../auth/supabaseAuth";
import { effectiveUserId } from "../auth/impersonationRoutes";
import type { TmBusinessArea, TmBusinessProcess, TmScenario, TmTestResult } from "@shared/models/testmgmt";
import { tmTestSuites } from "@shared/models/testmgmt";
import {
  buildHierarchyTree,
  computeCycleMetrics,
  computeReleaseReadiness,
  enrichCycle,
  groupResultsByRunId,
  normalizeExecutionStatus,
  isPassRateEligible,
  isExecutedStatus,
} from "./service";
import { generateSignOffPdf } from "./pdf-export";
import { generateTestsForScenario } from "./ai-generate";
import { createDefectFromTestResult, handleRetestResult } from "../help-desk/tm-bridge";
import * as sd from "../service-desk/service";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { requireApiTenantId } from "../lib/api-tenant-id";

function tmTenantId(req: Request): number {
  return (req as Request & { tmTenantId?: number }).tmTenantId!;
}

type TmStorage = {
  getTmProjects: (tenantId: number) => Promise<any[]>;
  getTmProject: (id: number) => Promise<any | undefined>;
  createTmProject: (data: Record<string, unknown>) => Promise<any>;
  updateTmProject: (id: number, data: Record<string, unknown>) => Promise<any>;
  deleteTmProject: (id: number) => Promise<void>;
  getTmBusinessAreas: (tenantId: number, projectId?: number) => Promise<TmBusinessArea[]>;
  createTmBusinessArea: (data: Record<string, unknown>) => Promise<TmBusinessArea>;
  updateTmBusinessArea: (id: number, data: Record<string, unknown>) => Promise<TmBusinessArea | undefined>;
  deleteTmBusinessArea: (id: number) => Promise<void>;
  getTmBusinessProcesses: (tenantId: number, projectId?: number, businessAreaId?: number) => Promise<TmBusinessProcess[]>;
  createTmBusinessProcess: (data: Record<string, unknown>) => Promise<TmBusinessProcess>;
  updateTmBusinessProcess: (id: number, data: Record<string, unknown>) => Promise<TmBusinessProcess | undefined>;
  deleteTmBusinessProcess: (id: number) => Promise<void>;
  getTmScenarios: (tenantId: number, projectId?: number) => Promise<TmScenario[]>;
  createTmScenario: (data: Record<string, unknown>) => Promise<TmScenario>;
  updateTmScenario: (id: number, data: Record<string, unknown>) => Promise<TmScenario | undefined>;
  deleteTmScenario: (id: number) => Promise<void>;
  getTmTestCases: (tenantId: number, suiteId?: number, projectId?: number) => Promise<any[]>;
  getTmTestCase: (id: number) => Promise<any | undefined>;
  createTmTestCase: (data: Record<string, unknown>) => Promise<any>;
  createTmTestStep: (data: Record<string, unknown>) => Promise<any>;
  updateTmTestCase: (id: number, data: Record<string, unknown>) => Promise<any | undefined>;
  getTmTestRuns: (tenantId: number, projectId?: number) => Promise<any[]>;
  getTmTestRun: (id: number) => Promise<any | undefined>;
  createTmTestRun: (data: Record<string, unknown>) => Promise<any>;
  updateTmTestRun: (id: number, data: Record<string, unknown>) => Promise<any | undefined>;
  getTmTestResults: (testRunId: number) => Promise<TmTestResult[]>;
  getTmTestResultsForRuns: (runIds: number[]) => Promise<TmTestResult[]>;
  getTmTestResult: (id: number) => Promise<TmTestResult | undefined>;
  createTmTestResult: (data: Record<string, unknown>) => Promise<TmTestResult>;
  updateTmTestResult: (id: number, data: Record<string, unknown>) => Promise<TmTestResult | undefined>;
  getTmSignOffs: (tenantId: number, projectId?: number, testCycleId?: number) => Promise<any[]>;
  createTmSignOff: (data: Record<string, unknown>) => Promise<any>;
  getTmTestCasesByScenario: (scenarioId: number) => Promise<any[]>;
};

const signOffEntityTypeSchema = z.enum(["scenario", "business_process", "business_area", "test_cycle"]);

const signOffEntitySchema = z.object({
  entityType: signOffEntityTypeSchema,
  entityId: z.number().int().positive(),
  testCycleId: z.number().int().positive().optional(),
  signedOffBy: z.string().min(1),
  notes: z.string().optional(),
  isConditional: z.boolean().optional(),
  projectId: z.number().int().positive().optional(),
});

const executionSubmitSchema = z.object({
  status: z.string().min(1),
  actualResult: z.string().optional(),
  blockedReason: z.string().optional(),
  notes: z.string().optional(),
  stepResults: z.array(z.any()).optional(),
  executedBy: z.string().optional(),
  raiseDefect: z.boolean().optional(),
  defectSeverity: z.string().optional(),
  evidence: z.array(z.any()).optional(),
});

function getUserId(req: Request): string | null {
  return effectiveUserId(req);
}

function parseId(raw: unknown): number | null {
  if (raw == null) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.floor(num);
}

function getRequiredQueryId(req: Request, res: Response, key: string): number | null {
  const value = parseId(req.query[key] as string | string[] | undefined);
  if (!value) {
    res.status(400).json({ message: `${key} query parameter is required` });
    return null;
  }
  return value;
}

function tmHandler(
  fn: (req: Request, res: Response) => unknown | Promise<unknown>,
): RequestHandler {
  return async (req, res) => {
    if (!isRequestAuthenticated(req)) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const tenantId = requireApiTenantId(req, res);
    if (tenantId == null) return;
    (req as Request & { tmTenantId?: number }).tmTenantId = tenantId;
    try {
      await fn(req, res);
    } catch (err) {
      console.error("[testmgmt]", err);
      if (!res.headersSent) {
        res.status(500).json({ message: (err as Error).message ?? "Test management error" });
      }
    }
  };
}

function methodologyLabels(methodology?: string | null) {
  if (methodology === "agile") {
    return { area: "Epic", process: "Feature", scenario: "User Story" };
  }
  if (methodology === "hybrid") {
    return { area: "Business Area / Epic", process: "Process / Feature", scenario: "Scenario / Story" };
  }
  return { area: "Business Area", process: "Business Process", scenario: "Scenario" };
}

function toDayKey(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function parseSqlStatements(content: string): string[] {
  const lines = content
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
  return lines
    .split(";")
    .map((stmt) => stmt.trim())
    .filter(Boolean);
}

async function ensureChildrenSignedOff(
  storage: TmStorage,
  tenantId: number,
  entityType: "scenario" | "business_process" | "business_area",
  entityId: number,
  cycleId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (entityType === "scenario") {
    const cases = await storage.getTmTestCasesByScenario(entityId);
    const results = await storage.getTmTestResults(cycleId);
    const relatedResults = results.filter((result) => cases.some((testCase) => testCase.id === result.testCaseId));
    const allValid = relatedResults.every((result) => {
      const normalized = normalizeExecutionStatus(result.status);
      return normalized === "pass" || normalized === "not_applicable";
    });
    if (!allValid) {
      return { ok: false, message: "Scenario sign-off requires all scenario test cases to be pass or not_applicable in the selected cycle" };
    }
    if (cases.length > 0 && relatedResults.length !== cases.length) {
      return { ok: false, message: "Scenario sign-off requires every scenario test case to have an execution in the selected cycle" };
    }
    return { ok: true };
  }

  const signOffs = await storage.getTmSignOffs(tenantId, undefined, cycleId);
  if (entityType === "business_process") {
    const scenarios = await storage.getTmScenarios(tenantId);
    const childScenarioIds = scenarios.filter((scenario) => scenario.businessProcessId === entityId).map((scenario) => scenario.id);
    const signedChildren = signOffs
      .filter((item) => item.entityType === "scenario")
      .map((item) => item.entityId);
    const missing = childScenarioIds.filter((id) => !signedChildren.includes(id));
    if (missing.length > 0) {
      return { ok: false, message: "Business process sign-off requires all child scenarios to be signed off first" };
    }
    return { ok: true };
  }

  const processes = await storage.getTmBusinessProcesses(tenantId);
  const childProcessIds = processes.filter((process) => process.businessAreaId === entityId).map((process) => process.id);
  const signedProcesses = signOffs
    .filter((item) => item.entityType === "business_process")
    .map((item) => item.entityId);
  const missing = childProcessIds.filter((id) => !signedProcesses.includes(id));
  if (missing.length > 0) {
    return { ok: false, message: "Business area sign-off requires all child business processes to be signed off first" };
  }
  return { ok: true };
}

export function registerTestMgmtExtensionRoutes(
  app: Express,
  deps: { storage: any },
): void {
  const storage = deps.storage as TmStorage;

  app.get("/api/tm/business-areas", tmHandler(async (req, res) => {
    const projectId = parseId(req.query.projectId as string | string[] | undefined) ?? undefined;
    res.json(await storage.getTmBusinessAreas(tmTenantId(req), projectId));
  }));

  app.post("/api/tm/business-areas", tmHandler(async (req, res) => {
    const payload = { ...req.body, tenantId: tmTenantId(req) };
    res.status(201).json(await storage.createTmBusinessArea(payload));
  }));

  app.patch("/api/tm/business-areas/:id", tmHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid business area id" });
    const updated = await storage.updateTmBusinessArea(id, req.body ?? {});
    if (!updated) return res.status(404).json({ message: "Business area not found" });
    res.json(updated);
  }));

  app.patch("/api/tm/business-areas", tmHandler(async (req, res) => {
    const id = parseId(req.body?.id ?? req.query.id);
    if (!id) return res.status(400).json({ message: "id is required" });
    const updated = await storage.updateTmBusinessArea(id, req.body ?? {});
    if (!updated) return res.status(404).json({ message: "Business area not found" });
    res.json(updated);
  }));

  app.delete("/api/tm/business-areas/:id", tmHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid business area id" });
    await storage.deleteTmBusinessArea(id);
    res.status(204).send();
  }));

  app.delete("/api/tm/business-areas", tmHandler(async (req, res) => {
    const id = parseId(req.body?.id ?? req.query.id);
    if (!id) return res.status(400).json({ message: "id is required" });
    await storage.deleteTmBusinessArea(id);
    res.status(204).send();
  }));

  app.get("/api/tm/business-processes", tmHandler(async (req, res) => {
    const projectId = parseId(req.query.projectId as string | string[] | undefined) ?? undefined;
    const businessAreaId = parseId(req.query.businessAreaId as string | string[] | undefined) ?? undefined;
    res.json(await storage.getTmBusinessProcesses(tmTenantId(req), projectId, businessAreaId));
  }));

  app.post("/api/tm/business-processes", tmHandler(async (req, res) => {
    const payload = { ...req.body, tenantId: tmTenantId(req) };
    res.status(201).json(await storage.createTmBusinessProcess(payload));
  }));

  app.patch("/api/tm/business-processes/:id", tmHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid business process id" });
    const updated = await storage.updateTmBusinessProcess(id, req.body ?? {});
    if (!updated) return res.status(404).json({ message: "Business process not found" });
    res.json(updated);
  }));

  app.patch("/api/tm/business-processes", tmHandler(async (req, res) => {
    const id = parseId(req.body?.id ?? req.query.id);
    if (!id) return res.status(400).json({ message: "id is required" });
    const updated = await storage.updateTmBusinessProcess(id, req.body ?? {});
    if (!updated) return res.status(404).json({ message: "Business process not found" });
    res.json(updated);
  }));

  app.delete("/api/tm/business-processes/:id", tmHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid business process id" });
    await storage.deleteTmBusinessProcess(id);
    res.status(204).send();
  }));

  app.delete("/api/tm/business-processes", tmHandler(async (req, res) => {
    const id = parseId(req.body?.id ?? req.query.id);
    if (!id) return res.status(400).json({ message: "id is required" });
    await storage.deleteTmBusinessProcess(id);
    res.status(204).send();
  }));

  app.get("/api/tm/hierarchy", tmHandler(async (req, res) => {
    const projectId = getRequiredQueryId(req, res, "projectId");
    if (!projectId) return;
    try {
      const [project, areas, processes, scenarios, testCases] = await Promise.all([
        storage.getTmProjects(tmTenantId(req)).then((items) => items.find((item) => item.id === projectId)),
        storage.getTmBusinessAreas(tmTenantId(req), projectId).catch(() => []),
        storage.getTmBusinessProcesses(tmTenantId(req), projectId).catch(() => []),
        storage.getTmScenarios(tmTenantId(req), projectId),
        storage.getTmTestCases(tmTenantId(req), undefined, projectId),
      ]);
      if (!project) return res.status(404).json({ message: "Project not found" });
      const tree = buildHierarchyTree(areas, processes, scenarios, testCases);
      res.json({ tree, labels: methodologyLabels(project.methodology) });
    } catch (err) {
      console.warn("[testmgmt] hierarchy fallback:", err);
      res.json({ tree: [], labels: methodologyLabels("waterfall") });
    }
  }));

  app.get("/api/tm/cycles", tmHandler(async (req, res) => {
    const projectId = getRequiredQueryId(req, res, "projectId");
    if (!projectId) return;
    const cycles = await storage.getTmTestRuns(tmTenantId(req), projectId);
    const runIds = cycles.map((c) => c.id);
    const allResults = await storage.getTmTestResultsForRuns(runIds);
    const byRun = groupResultsByRunId(allResults);
    const enriched = cycles.map((cycle) => enrichCycle(cycle, byRun.get(cycle.id) ?? []));
    res.json(enriched);
  }));

  app.get("/api/tm/cycles/:id", tmHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid cycle id" });
    const cycle = await storage.getTmTestRun(id);
    if (!cycle) return res.status(404).json({ message: "Cycle not found" });
    const results = await storage.getTmTestResults(id);
    res.json({ ...enrichCycle(cycle, results), results });
  }));

  app.patch("/api/tm/cycles/:id/active", tmHandler(async (req, res) => {
    const cycleId = parseId(req.params.id);
    if (!cycleId) return res.status(400).json({ message: "Invalid cycle id" });
    const projectId = parseId(req.body?.projectId);
    if (!projectId) return res.status(400).json({ message: "projectId is required in body" });
    const updated = await storage.updateTmProject(projectId, { activeCycleId: cycleId });
    if (!updated) return res.status(404).json({ message: "Project not found" });
    res.json(updated);
  }));

  app.get("/api/tm/dashboard", tmHandler(async (req, res) => {
    const projectId = getRequiredQueryId(req, res, "projectId");
    if (!projectId) return;

    const [cycles, areas, processes, scenarios, testCases, suites] = await Promise.all([
      storage.getTmTestRuns(tmTenantId(req), projectId),
      storage.getTmBusinessAreas(tmTenantId(req), projectId),
      storage.getTmBusinessProcesses(tmTenantId(req), projectId),
      storage.getTmScenarios(tmTenantId(req), projectId),
      storage.getTmTestCases(tmTenantId(req), undefined, projectId),
      db.select().from(tmTestSuites).where(and(eq(tmTestSuites.tenantId, tmTenantId(req)), eq(tmTestSuites.projectId, projectId))),
    ]);

    const runIds = cycles.map((c) => c.id);
    const allResultsFlat = await storage.getTmTestResultsForRuns(runIds);
    const resultsByRun = groupResultsByRunId(allResultsFlat);
    const cycleRows = cycles.map((cycle) => {
      const results = resultsByRun.get(cycle.id) ?? [];
      return { cycle, results, metrics: computeCycleMetrics(results) };
    });

    const allResults = allResultsFlat;
    const overall = computeCycleMetrics(allResults);
    const defects = await sd.listTickets(tmTenantId(req), {
      source: "help_desk",
      type: "defect",
      projectId,
      lightweight: true,
    } as any);
    const criticalDefects = defects.filter((item) => item.defectSeverity === "critical" && item.status !== "closed").length;
    const openDefects = defects.filter((item) => !["closed", "resolved", "wont_fix"].includes(item.status ?? "")).length;
    const readiness = computeReleaseReadiness(overall.passRatePct, criticalDefects);
    const totalCaseCount = Math.max(testCases.length, overall.total);

    const project = await storage.getTmProject(projectId);
    const activeCycleRow = project?.activeCycleId
      ? cycles.find((c) => c.id === project.activeCycleId)
      : cycles.find((c) => c.status === "in_progress") ?? null;

    const today = new Date();
    const burndownDays = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (13 - index));
      const dayKey = toDayKey(date);
      const dayResults = allResults.filter((result) => toDayKey(result.executedAt ?? result.updatedAt ?? result.createdAt) <= dayKey);
      const executed = dayResults.filter((result) => isExecutedStatus(result.status)).length;
      const remaining = Math.max(totalCaseCount - executed, 0);
      const target = Math.round(totalCaseCount * (1 - index / 13));
      return { date: dayKey, target, actual: remaining, remaining };
    });

    const byArea = areas.map((area) => {
      const processIds = processes.filter((process) => process.businessAreaId === area.id).map((process) => process.id);
      const scenarioIds = scenarios.filter((scenario) => processIds.includes(scenario.businessProcessId ?? -1)).map((scenario) => scenario.id);
      const caseIds = testCases.filter((testCase) => scenarioIds.includes(testCase.scenarioId ?? -1)).map((testCase) => testCase.id);
      const areaResults = allResults.filter((result) => caseIds.includes(result.testCaseId));
      const stats = computeCycleMetrics(areaResults);
      return {
        areaId: area.id,
        areaName: area.name,
        passRatePct: stats.passRatePct,
        completionPct: stats.completionPct,
        executed: stats.executed,
        total: stats.total,
      };
    });

    const latestByCase = new Map<number, TmTestResult>();
    for (const result of allResults) {
      const prev = latestByCase.get(result.testCaseId);
      const resultTime = new Date(result.executedAt ?? result.updatedAt ?? result.createdAt ?? 0).getTime();
      const prevTime = prev
        ? new Date(prev.executedAt ?? prev.updatedAt ?? prev.createdAt ?? 0).getTime()
        : 0;
      if (!prev || resultTime > prevTime) latestByCase.set(result.testCaseId, result);
    }

    const bySuite = suites.map((suite) => {
      const suiteCases = testCases.filter((tc) => tc.suiteId === suite.id);
      const caseIds = new Set(suiteCases.map((c) => c.id));
      let pass = 0;
      let fail = 0;
      let blocked = 0;
      let notRun = 0;
      for (const testCase of suiteCases) {
        const latest = latestByCase.get(testCase.id);
        const status = normalizeExecutionStatus(latest?.status) ?? "not_started";
        if (status === "pass") pass++;
        else if (status === "fail") fail++;
        else if (status === "blocked") blocked++;
        else notRun++;
      }
      const executed = pass + fail + blocked;
      const passRatePct = executed > 0 ? Math.round((pass / executed) * 100) : 0;
      const openSuiteDefects = defects.filter(
        (d) =>
          !["closed", "resolved", "wont_fix"].includes(d.status ?? "")
          && d.linkedTestCaseId != null
          && caseIds.has(d.linkedTestCaseId),
      );
      return {
        suiteId: suite.id,
        suiteName: suite.name,
        total: suiteCases.length,
        pass,
        fail,
        blocked,
        notRun,
        passRatePct,
        completionPct: suiteCases.length > 0 ? Math.round((executed / suiteCases.length) * 100) : 0,
        openDefects: openSuiteDefects.length,
        criticalDefects: openSuiteDefects.filter((d) => d.defectSeverity === "critical").length,
      };
    });

    const defectTrend = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (13 - index));
      const dayKey = toDayKey(date);
      const open = defects.filter((ticket) =>
        toDayKey(ticket.createdAt) <= dayKey
        && !["closed", "resolved", "wont_fix"].includes(ticket.status ?? ""),
      ).length;
      const closed = defects.filter((ticket) =>
        ticket.closedAt && toDayKey(ticket.closedAt) <= dayKey,
      ).length;
      return { date: dayKey, open, closed, count: open };
    });

    const passRateTrend = cycleRows.map((row) => ({
      cycleId: row.cycle.id,
      cycleName: row.cycle.name,
      label: row.cycle.name,
      rate: row.metrics.passRatePct,
      passRatePct: row.metrics.passRatePct,
      eligibleExecuted: row.results.filter((result) => isPassRateEligible(result.status) && isExecutedStatus(result.status)).length,
      completionPct: row.metrics.completionPct,
      total: row.metrics.total,
      executed: row.metrics.executed,
      testPhase: row.cycle.testPhase ?? "uat",
    }));

    const executedPct = overall.total > 0 ? Math.round((overall.executed / overall.total) * 100) : 0;
    const passedPct = overall.executed > 0 ? Math.round((overall.passed / overall.executed) * 100) : 0;
    const failedPct = overall.executed > 0 ? Math.round((overall.failed / overall.executed) * 100) : 0;

    res.json({
      kpis: {
        totalCases: totalCaseCount,
        executed: overall.executed,
        executedPct,
        passed: overall.passed,
        passedPct,
        failed: overall.failed,
        failedPct,
        blocked: overall.blocked,
        openDefects,
        criticalDefects,
        completionPct: overall.completionPct,
        passRatePct: overall.passRatePct,
        releaseReadiness: readiness,
      },
      burndown: burndownDays,
      byArea: byArea.map((a) => ({
        name: a.areaName,
        areaName: a.areaName,
        passRatePct: a.passRatePct,
        completionPct: a.completionPct,
        passed: a.executed > 0 ? Math.round(a.executed * (a.passRatePct / 100)) : 0,
        failed: 0,
        blocked: 0,
        notStarted: Math.max(a.total - a.executed, 0),
      })),
      bySuite,
      defectTrend,
      passRateTrend,
      activeCycle: activeCycleRow
        ? { id: activeCycleRow.id, name: activeCycleRow.name, status: activeCycleRow.status ?? "planning" }
        : null,
      charts: {
        burndown: burndownDays,
        byArea,
        defectTrend,
        passRateTrend,
      },
    });
  }));

  app.get("/api/tm/sign-offs", tmHandler(async (req, res) => {
    const projectId = parseId(req.query.projectId as string | string[] | undefined) ?? undefined;
    const cycleId = parseId(req.query.testCycleId as string | string[] | undefined) ?? undefined;
    res.json(await storage.getTmSignOffs(tmTenantId(req), projectId, cycleId));
  }));

  app.post("/api/tm/sign-offs", tmHandler(async (req, res) => {
    const signedOffBy = getUserId(req) ?? req.body?.signedOffBy;
    if (!signedOffBy) return res.status(400).json({ message: "signedOffBy is required" });
    const payload = {
      ...req.body,
      signedOffBy,
      tenantId: tmTenantId(req),
    };
    res.status(201).json(await storage.createTmSignOff(payload));
  }));

  app.post("/api/tm/sign-offs/entity", tmHandler(async (req, res) => {
    const parsed = signOffEntitySchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid sign-off payload" });
    const payload = parsed.data;

    const signedOffBy = getUserId(req) ?? payload.signedOffBy;
    if (!signedOffBy) return res.status(400).json({ message: "Unable to resolve signedOffBy" });
    const cycleId = payload.testCycleId;

    if ((payload.entityType === "scenario" || payload.entityType === "business_process" || payload.entityType === "business_area")) {
      if (!cycleId) return res.status(400).json({ message: "testCycleId is required for scenario/process/area sign-off" });
      const validation = await ensureChildrenSignedOff(storage, tmTenantId(req), payload.entityType, payload.entityId, cycleId);
      if (!validation.ok) return res.status(400).json({ message: validation.message });
    }

    const created = await storage.createTmSignOff({
      tenantId: tmTenantId(req),
      projectId: payload.projectId,
      entityType: payload.entityType,
      entityId: payload.entityId,
      testCycleId: cycleId,
      signedOffBy,
      notes: payload.notes,
      isConditional: payload.isConditional ?? false,
    });

    if (payload.entityType === "scenario") {
      await storage.updateTmScenario(payload.entityId, { signOffStatus: "signed_off", signOffBy: signedOffBy, signOffAt: new Date() });
    } else if (payload.entityType === "business_process") {
      await storage.updateTmBusinessProcess(payload.entityId, { signOffStatus: "signed_off", signOffBy: signedOffBy, signOffAt: new Date() });
    } else if (payload.entityType === "business_area") {
      await storage.updateTmBusinessArea(payload.entityId, { signOffStatus: "signed_off", signOffBy: signedOffBy, signOffAt: new Date() });
    }

    res.status(201).json(created);
  }));

  app.post("/api/tm/cycles/:id/sign-off", tmHandler(async (req, res) => {
    const cycleId = parseId(req.params.id);
    if (!cycleId) return res.status(400).json({ message: "Invalid cycle id" });
    const cycle = await storage.getTmTestRun(cycleId);
    if (!cycle) return res.status(404).json({ message: "Cycle not found" });
    if (!cycle.projectId) return res.status(400).json({ message: "Cycle is not linked to a project" });
    const areas = await storage.getTmBusinessAreas(tmTenantId(req), cycle.projectId);
    const signOffs = await storage.getTmSignOffs(tmTenantId(req), cycle.projectId, cycleId);
    const signedAreaIds = signOffs.filter((item) => item.entityType === "business_area").map((item) => item.entityId);
    const missing = areas.filter((area) => !signedAreaIds.includes(area.id));
    if (missing.length > 0) {
      return res.status(400).json({ message: "All business areas must be signed off before cycle sign-off" });
    }

    const signedOffBy = getUserId(req) ?? req.body?.signedOffBy;
    if (!signedOffBy) return res.status(400).json({ message: "Unable to resolve signedOffBy" });
    const results = await storage.getTmTestResults(cycleId);
    const metrics = computeCycleMetrics(results);
    const entry = await storage.createTmSignOff({
      tenantId: tmTenantId(req),
      projectId: cycle.projectId,
      entityType: "test_cycle",
      entityId: cycleId,
      testCycleId: cycleId,
      signedOffBy,
      passRateAtSignOff: metrics.passRatePct,
      notes: req.body?.notes,
      isConditional: false,
    });
    await storage.updateTmTestRun(cycleId, { status: "signed_off" });
    res.status(201).json(entry);
  }));

  app.post("/api/tm/executions/:id/submit", tmHandler(async (req, res) => {
    const executionId = parseId(req.params.id);
    if (!executionId) return res.status(400).json({ message: "Invalid execution id" });
    const parsed = executionSubmitSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Invalid execution payload" });
    const payload = parsed.data;
    const normalizedStatus = normalizeExecutionStatus(payload.status);

    if (normalizedStatus === "fail" && !(payload.actualResult && payload.actualResult.trim().length > 0)) {
      return res.status(400).json({ message: "actualResult is required when status is fail" });
    }
    if (normalizedStatus === "blocked" && !(payload.blockedReason && payload.blockedReason.trim().length > 0)) {
      return res.status(400).json({ message: "blockedReason is required when status is blocked" });
    }

    const existing = await storage.getTmTestResult(executionId);
    if (!existing) return res.status(404).json({ message: "Execution not found" });

    const executedBy = getUserId(req) ?? payload.executedBy ?? existing.executedBy ?? "system";

    const updated = await storage.updateTmTestResult(executionId, {
      status: normalizedStatus,
      actualResult: payload.actualResult,
      blockedReason: payload.blockedReason,
      notes: payload.notes,
      stepResults: payload.stepResults,
      evidence: payload.evidence,
      executedBy,
      executedAt: new Date(),
      comment: payload.notes ?? existing.comment,
    });
    if (!updated) return res.status(404).json({ message: "Execution not found" });

    let defectTicket: unknown = null;
    if (normalizedStatus === "fail" && payload.raiseDefect) {
      defectTicket = await createDefectFromTestResult(tmTenantId(req), executedBy, executionId, {
        comment: payload.actualResult ?? payload.notes,
      });
      if (defectTicket && payload.defectSeverity) {
        const ticketAny = defectTicket as { id?: number };
        if (ticketAny.id) {
          await sd.updateTicket(tmTenantId(req), ticketAny.id, executedBy, { defectSeverity: payload.defectSeverity } as any);
        }
      }
    }

    if (normalizedStatus === "pass") {
      await handleRetestResult(tmTenantId(req), executionId, "pass", executedBy);
    }

    res.json({ execution: updated, defectTicket });
  }));

  app.get("/api/tm/defects/hd", tmHandler(async (req, res) => {
    const projectId = getRequiredQueryId(req, res, "projectId");
    if (!projectId) return;
    const cycleId = parseId(req.query.cycleId as string | string[] | undefined) ?? undefined;
    const ticketRows = await sd.listTickets(tmTenantId(req), {
      source: "help_desk",
      type: "defect",
      lightweight: true,
    } as any);
    let tickets = ticketRows.filter((ticket) => ticket.projectId === projectId || ticket.projectId == null);
    if (cycleId) {
      const results = await storage.getTmTestResults(cycleId);
      const resultIds = new Set(results.map((item) => item.id));
      tickets = tickets.filter((ticket) => ticket.linkedTestResultId && resultIds.has(ticket.linkedTestResultId));
    }
    const now = Date.now();
    res.json(tickets.map((t) => ({
      id: t.id,
      ref: t.ref,
      title: t.title,
      severity: t.defectSeverity ?? "medium",
      status: t.status,
      assigneeId: t.assignedAgentId,
      linkedTestCaseId: t.linkedTestCaseId,
      linkedTestResultId: t.linkedTestResultId,
      daysOpen: Math.max(0, Math.floor((now - new Date(t.createdAt).getTime()) / 86400000)),
      businessArea: t.category ?? undefined,
    })));
  }));

  app.patch("/api/tm/defects/hd/:id/status", tmHandler(async (req, res) => {
    const ticketId = parseId(req.params.id);
    if (!ticketId) return res.status(400).json({ message: "Invalid ticket id" });
    const column = typeof req.body?.column === "string" ? req.body.column : "";
    let status = typeof req.body?.status === "string" ? req.body.status : "";
    if (column && !status) {
      const { COLUMN_TO_STATUS } = await import("./defect-board");
      status = COLUMN_TO_STATUS[column] ?? column;
    }
    if (!status) return res.status(400).json({ message: "status or column is required" });

    const uid = getUserId(req) ?? "system";
    const tickets = await sd.listTickets(tmTenantId(req), { source: "help_desk", type: "defect" } as any);
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const { findDefectTransitionPath } = await import("./defect-board");
    const path = findDefectTransitionPath(ticket.status ?? "open", status);
    if (path === null) {
      return res.status(400).json({
        message: `Cannot move defect from "${ticket.status}" to "${status}". Use the next valid workflow step.`,
      });
    }

    let updated: Awaited<ReturnType<typeof sd.updateTicketStatus>> = ticket;
    try {
      for (const step of path) {
        updated = await sd.updateTicketStatus(tmTenantId(req), ticketId, uid, step, req.body?.reason ?? "Defect board update");
        if (!updated) return res.status(404).json({ message: "Ticket not found" });
      }
    } catch (err) {
      return res.status(400).json({ message: (err as Error).message });
    }
    res.json(updated);
  }));

  app.post("/api/tm/migrate-schema", tmHandler(async (_req, res) => {
    const sqlPath = path.resolve(process.cwd(), "scripts/sql/test-mgmt-module.sql");
    const rawSql = await readFile(sqlPath, "utf-8");
    const statements = parseSqlStatements(rawSql);
    for (const statement of statements) {
      await db.execute(sql.raw(statement));
    }
    res.json({ success: true, executed: statements.length });
  }));

  app.post("/api/tm/seed-hierarchy", tmHandler(async (req, res) => {
    const projectId = parseId(req.body?.projectId) ?? parseId(req.query.projectId as string | string[] | undefined);
    if (!projectId) return res.status(400).json({ message: "projectId is required" });

    const [scenarios, existingAreas, existingProcesses, suites] = await Promise.all([
      storage.getTmScenarios(tmTenantId(req), projectId),
      storage.getTmBusinessAreas(tmTenantId(req), projectId),
      storage.getTmBusinessProcesses(tmTenantId(req), projectId),
      db.select().from(tmTestSuites).where(and(eq(tmTestSuites.tenantId, tmTenantId(req)), eq(tmTestSuites.projectId, projectId))),
    ]);

    const areaByName = new Map(existingAreas.map((area) => [area.name.trim().toLowerCase(), area]));
    const processByComposite = new Map(
      existingProcesses.map((process) => [`${process.businessAreaId}:${process.name.trim().toLowerCase()}`, process]),
    );

    let createdAreas = 0;
    let createdProcesses = 0;
    let updatedScenarios = 0;

    const seedRows = [
      ...scenarios.map((scenario) => ({
        areaName: scenario.functionalArea?.trim() || "General",
        processName: scenario.process?.trim() || "General",
        scenarioId: scenario.id,
      })),
      ...suites.map((suite) => ({
        areaName: (suite.name ?? "General").trim(),
        processName: "General",
        scenarioId: null as number | null,
      })),
    ];

    for (const row of seedRows) {
      const areaKey = row.areaName.toLowerCase();
      let area = areaByName.get(areaKey);
      if (!area) {
        area = await storage.createTmBusinessArea({
          tenantId: tmTenantId(req),
          projectId,
          name: row.areaName,
          description: `Auto-seeded from existing suites/scenarios for project ${projectId}`,
        });
        areaByName.set(areaKey, area);
        createdAreas += 1;
      }

      const processKey = `${area.id}:${row.processName.toLowerCase()}`;
      let process = processByComposite.get(processKey);
      if (!process) {
        process = await storage.createTmBusinessProcess({
          tenantId: tmTenantId(req),
          projectId,
          businessAreaId: area.id,
          name: row.processName,
          description: `Auto-seeded under ${area.name}`,
        });
        processByComposite.set(processKey, process);
        createdProcesses += 1;
      }

      if (row.scenarioId) {
        const scenario = scenarios.find((item) => item.id === row.scenarioId);
        if (scenario && scenario.businessProcessId !== process.id) {
          await storage.updateTmScenario(scenario.id, { businessProcessId: process.id });
          updatedScenarios += 1;
        }
      }
    }

    res.json({
      success: true,
      projectId,
      createdAreas,
      createdProcesses,
      linkedScenarios: updatedScenarios,
    });
  }));

  app.get("/api/tm/reports/phase-comparison", tmHandler(async (req, res) => {
    const projectId = getRequiredQueryId(req, res, "projectId");
    if (!projectId) return;

    const cycles = await storage.getTmTestRuns(tmTenantId(req), projectId);
    const runIds = cycles.map((c) => c.id);
    const allResults = await storage.getTmTestResultsForRuns(runIds);
    const resultsByRun = groupResultsByRunId(allResults);
    const defectTickets = await sd.listTickets(tmTenantId(req), {
      source: "help_desk",
      type: "defect",
      projectId,
      lightweight: true,
    } as any);
    const cycleRows = cycles.map((cycle) => {
      const results = resultsByRun.get(cycle.id) ?? [];
      const metrics = computeCycleMetrics(results);
      const cycleDefects = defectTickets.filter((t) => t.sprintPhase === cycle.testPhase);
      return {
        cycle,
        metrics,
        defectCount: cycleDefects.length,
        openDefects: cycleDefects.filter((t) => !["closed", "resolved", "wont_fix"].includes(t.status ?? "")).length,
      };
    });

    const phaseMap = new Map<string, typeof cycleRows>();
    for (const row of cycleRows) {
      const phase = (row.cycle.testPhase ?? "uat").toLowerCase();
      if (!phaseMap.has(phase)) phaseMap.set(phase, []);
      phaseMap.get(phase)!.push(row);
    }

    const phases = Array.from(phaseMap.entries()).map(([phase, rows]) => {
      const totals = rows.reduce(
        (acc, r) => ({
          total: acc.total + r.metrics.total,
          executed: acc.executed + r.metrics.executed,
          passed: acc.passed + r.metrics.passed,
          failed: acc.failed + r.metrics.failed,
          blocked: acc.blocked + r.metrics.blocked,
        }),
        { total: 0, executed: 0, passed: 0, failed: 0, blocked: 0 },
      );
      const completionPct = totals.total > 0 ? Math.round((totals.executed / totals.total) * 100) : 0;
      const passRatePct = totals.executed > 0 ? Math.round((totals.passed / totals.executed) * 100) : 0;
      return {
        phase,
        phaseLabel: phase.toUpperCase(),
        cycleCount: rows.length,
        cycles: rows.map((r) => ({
          id: r.cycle.id,
          name: r.cycle.name,
          status: r.cycle.status,
          buildVersion: r.cycle.buildVersion,
          startDate: r.cycle.startDate,
          endDate: r.cycle.endDate,
          metrics: r.metrics,
          defectCount: r.defectCount,
          openDefects: r.openDefects,
        })),
        totals: { ...totals, completionPct, passRatePct },
        defectCount: rows.reduce((s, r) => s + r.defectCount, 0),
        openDefects: rows.reduce((s, r) => s + r.openDefects, 0),
      };
    });

    res.json({ projectId, phases, generatedAt: new Date().toISOString() });
  }));

  app.get("/api/tm/sign-offs/pdf", tmHandler(async (req, res) => {
    const projectId = getRequiredQueryId(req, res, "projectId");
    if (!projectId) return;
    const cycleId = parseId(req.query.testCycleId as string | string[] | undefined) ?? undefined;
    const entityType = String(req.query.entityType ?? "test_cycle");
    const entityId = parseId(req.query.entityId as string | string[] | undefined) ?? cycleId;

    const project = await storage.getTmProject(projectId);
    const signOffs = await storage.getTmSignOffs(tmTenantId(req), projectId, cycleId);
    const latest = signOffs
      .filter((s) => s.entityType === entityType && (!entityId || s.entityId === entityId))
      .sort((a, b) => new Date(b.signedOffAt ?? 0).getTime() - new Date(a.signedOffAt ?? 0).getTime())[0];

    let entityName = "Sign-Off";
    let cycleName: string | undefined;
    let testPhase: string | undefined;
    let metrics;

    if (entityType === "test_cycle" && entityId) {
      const cycle = await storage.getTmTestRun(entityId);
      entityName = cycle?.name ?? `Cycle #${entityId}`;
      cycleName = cycle?.name ?? undefined;
      testPhase = cycle?.testPhase ?? undefined;
      const results = await storage.getTmTestResults(entityId);
      metrics = computeCycleMetrics(results);
    } else if (entityType === "business_area" && entityId) {
      const areas = await storage.getTmBusinessAreas(tmTenantId(req), projectId);
      entityName = areas.find((a) => a.id === entityId)?.name ?? `Area #${entityId}`;
    } else if (entityType === "business_process" && entityId) {
      const processes = await storage.getTmBusinessProcesses(tmTenantId(req), projectId);
      entityName = processes.find((p) => p.id === entityId)?.name ?? `Process #${entityId}`;
    } else if (entityType === "scenario" && entityId) {
      const scenarios = await storage.getTmScenarios(tmTenantId(req), projectId);
      const sc = scenarios.find((s) => s.id === entityId);
      entityName = sc?.title ?? sc?.scenarioId ?? `Scenario #${entityId}`;
    }

    if (cycleId && !cycleName) {
      const cycle = await storage.getTmTestRun(cycleId);
      cycleName = cycle?.name;
      testPhase = cycle?.testPhase ?? undefined;
    }

    const cascade = await Promise.all(
      signOffs.slice(0, 30).map(async (s) => {
        let name = `#${s.entityId}`;
        if (s.entityType === "business_area") {
          name = (await storage.getTmBusinessAreas(tmTenantId(req), projectId)).find((a) => a.id === s.entityId)?.name ?? name;
        } else if (s.entityType === "test_cycle") {
          name = (await storage.getTmTestRun(s.entityId))?.name ?? name;
        } else if (s.entityType === "scenario") {
          const sc = (await storage.getTmScenarios(tmTenantId(req), projectId)).find((x) => x.id === s.entityId);
          name = sc?.title ?? name;
        }
        return {
          entityType: s.entityType,
          entityName: name,
          signedOffBy: s.signedOffBy,
          signedOffAt: s.signedOffAt ? new Date(s.signedOffAt).toLocaleString() : "—",
        };
      }),
    );

    const pdf = generateSignOffPdf({
      projectName: project?.name ?? `Project #${projectId}`,
      entityType,
      entityName,
      cycleName,
      testPhase,
      signedOffBy: latest?.signedOffBy ?? "—",
      signedOffAt: latest?.signedOffAt ? new Date(latest.signedOffAt).toLocaleString() : new Date().toLocaleString(),
      passRateAtSignOff: latest?.passRateAtSignOff ?? metrics?.passRatePct ?? null,
      notes: latest?.notes,
      isConditional: latest?.isConditional ?? false,
      metrics,
      signOffs: cascade,
    });

    const safeName = entityName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 40);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="tm-signoff-${safeName}.pdf"`);
    res.send(pdf);
  }));

  app.post("/api/tm/ai/generate-tests", tmHandler(async (req, res) => {
    const scenarioId = parseId(req.body?.scenarioId);
    if (!scenarioId) return res.status(400).json({ message: "scenarioId is required" });
    const projectId = parseId(req.body?.projectId);
    const count = Math.min(Math.max(Number(req.body?.count ?? 3), 1), 8);
    const create = req.body?.create === true;

    const scenarios = await storage.getTmScenarios(tmTenantId(req), projectId ?? undefined);
    const scenario = scenarios.find((s) => s.id === scenarioId);
    if (!scenario) return res.status(404).json({ message: "Scenario not found" });

    const project = projectId ? await storage.getTmProject(projectId) : null;
    const generated = await generateTestsForScenario(scenario, {
      count,
      methodology: project?.methodology ?? undefined,
    });

    if (!create) {
      return res.json(generated);
    }

    const created: any[] = [];
    for (const tc of generated.testCases) {
      const testCase = await storage.createTmTestCase({
        tenantId: tmTenantId(req),
        projectId: projectId ?? scenario.projectId,
        scenarioId: scenario.id,
        title: tc.title,
        description: tc.description,
        priority: tc.priority,
        status: "draft",
        caseType: "manual",
      });
      for (const step of tc.steps) {
        await storage.createTmTestStep({
          testCaseId: testCase.id,
          stepOrder: step.stepOrder,
          action: step.action,
          expectedResult: step.expectedResult,
        });
      }
      created.push(testCase);
    }

    const linkedIds = [...(scenario.linkedCaseIds ?? []), ...created.map((c) => c.id)];
    await storage.updateTmScenario(scenario.id, { linkedCaseIds: linkedIds });

    res.status(201).json({ ...generated, created, createdCount: created.length });
  }));

  // Evidence upload for executions (max 25MB)
  app.post("/api/tm/evidence/upload", async (req: Request, res: Response, next) => {
    try {
      const multer = (await import("multer")).default;
      const fs = await import("node:fs");
      const uploadDir = path.resolve(process.cwd(), "uploads");
      fs.mkdirSync(uploadDir, { recursive: true });
      const upload = multer({
        storage: multer.diskStorage({
          destination: (_req, _file, cb) => cb(null, uploadDir),
          filename: (_req, file, cb) => cb(null, `tm-${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_")}`),
        }),
        limits: { fileSize: 25 * 1024 * 1024 },
      }).single("file");
      upload(req, res, (err) => {
        if (err) return res.status(400).json({ message: err.message });
        const file = (req as any).file;
        if (!file) return res.status(400).json({ message: "No file uploaded" });
        res.json({ name: file.originalname, url: `/uploads/${file.filename}`, size: file.size, mimeType: file.mimetype });
      });
    } catch (e) {
      next(e);
    }
  });
}
