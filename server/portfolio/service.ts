import { db } from "../db";
import { storage } from "../storage";
import {
  pmPortfolios,
  pmProjectPortfolios,
  pmMilestones,
  pmRaiddItems,
  pmWorkstreams,
  pmDeliverables,
  pmReportSchedules,
  pmReportSnapshots,
  pmTeamMembers,
  pmHealthMatrixSnapshots,
  projectBudgets,
  budgetLabourLines,
  budgetExpenseLines,
  type PmMilestone
} from "@shared/schema";
import { and, eq, inArray, sql, or, desc, isNull } from "drizzle-orm";
import { resources } from "@shared/schema";
import { users } from "@shared/models/auth";
import { generate360ExecutiveNarrative } from "./ai-narrative";
import { buildActivityPlan, buildLevel1PlanRows } from "./report-360-builders";

function weekStartMonday(d = new Date()): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().split("T")[0];
}

function isoDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function looksLikeUserId(v?: string | null): boolean {
  if (!v) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());
}

async function resolveUserDisplayName(userId?: string | null): Promise<string | null> {
  if (!userId) return null;
  const [u] = await db
    .select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u) return null;
  const name = [u.firstName || "", u.lastName || ""].join(" ").trim();
  return name || u.email || null;
}

/** Prefer a human name; if the stored value is a user UUID, resolve it. */
async function displayPersonName(...candidates: Array<string | null | undefined>): Promise<string | null> {
  for (const c of candidates) {
    if (!c || !String(c).trim()) continue;
    const raw = String(c).trim();
    if (looksLikeUserId(raw)) {
      const resolved = await resolveUserDisplayName(raw);
      if (resolved) return resolved;
      continue;
    }
    return raw;
  }
  return null;
}

export type RagLevel = "green" | "amber" | "red";

export interface PortfolioProjectRow {
  id: number;
  name: string;
  code: string | null;
  description: string | null;
  status: string | null;
  ragStatus: string | null;
  progress: number;
  budget: number;
  spentBudget: number;
  startDate: string | null;
  endDate: string | null;
  clientId: number | null;
  clientName: string | null;
  managerId: string | null;
  managerName: string | null;
  portfolioId: number | null;
  portfolioIds: number[];
  portfolioNames: string[];
  programId: number | null;
  programName: string | null;
  parentProjectId: number | null;
  workType: string | null;
  scheduleRag: string | null;
  financialRag: string | null;
  updatedAt: string | null;
}

function ragLevel(v: string | null | undefined): RagLevel {
  const s = (v || "green").toLowerCase();
  if (s === "red" || s === "behind" || s === "critical") return "red";
  if (s === "amber" || s === "at risk" || s === "yellow") return "amber";
  return "green";
}

function budgetNum(v: string | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : parseFloat(v) || 0;
}

function healthScore(project: PortfolioProjectRow): number {
  const weights = [project.ragStatus, project.scheduleRag, project.financialRag];
  let sum = 0;
  for (const w of weights) {
    const r = ragLevel(w);
    sum += r === "green" ? 100 : r === "amber" ? 60 : 20;
  }
  return Math.round(sum / weights.length);
}

async function loadClientMap(tenantId: number): Promise<Map<number, string>> {
  const rows = await storage.getClients(tenantId);
  return new Map(rows.map((c) => [c.id, c.name]));
}

/** Backfill M:N links from legacy portfolioId FK (spec §2). */
export async function ensurePortfolioLinks(tenantId: number) {
  const projects = await storage.getPmProjects(tenantId);
  const existing = await db.select().from(pmProjectPortfolios);
  const linked = new Set(existing.map((l) => `${l.projectId}:${l.portfolioId}`));
  for (const p of projects) {
    if (p.portfolioId && !linked.has(`${p.id}:${p.portfolioId}`)) {
      try {
        await db.insert(pmProjectPortfolios).values({ projectId: p.id, portfolioId: p.portfolioId });
        linked.add(`${p.id}:${p.portfolioId}`);
      } catch {
        /* duplicate */
      }
    }
  }
}

async function getDashboardResourceUtilisation(tenantId: number) {
  try {
    const { getExtendedResourceStats } = await import("../resources/service");
    const stats = await getExtendedResourceStats(tenantId);
    const people = await db.select().from(resources).where(eq(resources.tenantId, tenantId));
    const active = people.filter((p) => p.status === "active" || p.status === "available");
    return active
      .map((p) => ({
        initials: `${(p.firstName[0] || "")}${(p.lastName[0] || "")}`.toUpperCase(),
        name: `${p.firstName} ${p.lastName}`,
        role: p.jobTitle || p.department || "Resource",
        utilisation: stats.utilByResource[p.id] ?? 0,
        color: stats.utilByResource[p.id] > 100 ? "#EF4444" : stats.utilByResource[p.id] > 85 ? "#F59E0B" : "#22C55E",
      }))
      .sort((a, b) => b.utilisation - a.utilisation)
      .slice(0, 6);
  } catch {
    return [];
  }
}

async function getPortfolioActivityFeed(tenantId: number, clientId?: number) {
  const projects = await loadScopedProjects(tenantId, clientId);
  const projectIds = projects.map((p) => p.id);
  if (!projectIds.length) return [];
  const items = await db
    .select()
    .from(pmRaiddItems)
    .where(and(eq(pmRaiddItems.tenantId, tenantId), inArray(pmRaiddItems.projectId, projectIds)))
    .orderBy(desc(pmRaiddItems.updatedAt))
    .limit(8);
  const projMap = new Map(projects.map((p) => [p.id, p.name]));
  return items.map((i) => ({
    id: i.id,
    user: i.ownerName || i.createdBy || "Team member",
    action: i.type === "risk" ? "updated risk on" : i.type === "issue" ? "raised issue on" : `updated ${i.type} on`,
    target: projMap.get(i.projectId) || i.title,
    time: i.updatedAt ? new Date(i.updatedAt).toLocaleDateString("en-GB") : "Recently",
    dot: i.priority === "critical" || i.priority === "high" ? "bg-red-500" : i.type === "issue" ? "bg-amber-500" : "bg-emerald-500",
  }));
}

async function loadScopedProjects(tenantId: number, clientId?: number): Promise<PortfolioProjectRow[]> {
  const filters: Parameters<typeof storage.getPmProjects>[1] = {};
  if (clientId !== undefined) filters.clientId = clientId;
  const [projects, programs, links, clientMap] = await Promise.all([
    storage.getPmProjects(tenantId, filters),
    storage.getPmPrograms(tenantId, undefined, clientId),
    db.select().from(pmProjectPortfolios),
    loadClientMap(tenantId),
  ]);

  const programMap = new Map(programs.map((p) => [p.id, p.name]));
  const linkMap = new Map<number, number[]>();
  for (const l of links) {
    const arr = linkMap.get(l.projectId) || [];
    arr.push(l.portfolioId);
    linkMap.set(l.projectId, arr);
  }

  const portfolioRows = await db.select().from(pmPortfolios).where(eq(pmPortfolios.tenantId, tenantId));
  const portfolioNameMap = new Map(portfolioRows.map((p) => [p.id, p.name]));

  return projects
    .filter((p) => p.workType !== "programme" && p.workType !== "portfolio")
    .map((p) => {
      const pids = [...new Set([...(linkMap.get(p.id) || []), ...(p.portfolioId ? [p.portfolioId] : [])])];
      return {
        id: p.id,
        name: p.name,
        code: p.code,
        description: p.description,
        status: p.status,
        ragStatus: p.ragStatus,
        progress: p.progress ?? 0,
        budget: budgetNum(p.budget),
        spentBudget: budgetNum(p.spentBudget),
        startDate: p.startDate,
        endDate: p.endDate,
        clientId: p.clientId ?? null,
        clientName: p.clientId ? clientMap.get(p.clientId) ?? null : null,
        managerId: p.managerId,
        managerName: p.projectManager || p.managerId,
        portfolioId: p.portfolioId,
        portfolioIds: pids,
        portfolioNames: pids.map((id) => portfolioNameMap.get(id) || `Portfolio ${id}`),
        programId: p.programId,
        programName: p.programId ? programMap.get(p.programId) ?? null : null,
        parentProjectId: p.parentProjectId,
        workType: p.workType,
        scheduleRag: p.scheduleRag,
        financialRag: p.financialRag,
        updatedAt: p.updatedAt?.toISOString() ?? null,
      };
    });
}

export async function getPortfolioDashboard(tenantId: number, clientId?: number) {
  await ensurePortfolioLinks(tenantId);
  const [projects, programmes, portfolios, milestones, allProjects, resourceUtilisation, activityFeed] = await Promise.all([
    loadScopedProjects(tenantId, clientId),
    getProgrammesList(tenantId, clientId),
    storage.getPmPortfolios(tenantId, clientId),
    getScopedMilestones(tenantId, clientId),
    storage.getPmProjects(tenantId, clientId !== undefined ? { clientId } : {}),
    getDashboardResourceUtilisation(tenantId),
    getPortfolioActivityFeed(tenantId, clientId),
  ]);

  const active = projects.filter((p) => p.status === "active" || p.status === "planning");
  const atRisk = projects.filter((p) => ragLevel(p.ragStatus) !== "green");
  const totalBudget = projects.reduce((s, p) => s + p.budget, 0);
  const totalSpent = projects.reduce((s, p) => s + p.spentBudget, 0);

  const now = new Date();
  const in30 = new Date(now);
  in30.setDate(in30.getDate() + 30);
  const milestonesDue30d = milestones.filter((m) => {
    const d = m.targetDate || m.dueDate;
    if (!d) return false;
    const td = new Date(d + "T00:00:00");
    return td >= now && td <= in30 && (m.ragStatus || "").toLowerCase() !== "blue";
  }).length;

  const healthScores = active.map(healthScore);
  const avgHealth = healthScores.length ? Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length) : 0;

  const portfolioHealth = portfolios.map((pf) => {
    const pfProjects = projects.filter((p) => p.portfolioIds.includes(pf.id));
    const green = pfProjects.filter((p) => ragLevel(p.ragStatus) === "green").length;
    const amber = pfProjects.filter((p) => ragLevel(p.ragStatus) === "amber").length;
    const red = pfProjects.filter((p) => ragLevel(p.ragStatus) === "red").length;
    const budget = pfProjects.reduce((s, p) => s + p.budget, 0);
    const spent = pfProjects.reduce((s, p) => s + p.spentBudget, 0);
    return {
      id: pf.id,
      name: pf.name,
      colour: pf.colour || "#7C3AED",
      green,
      amber,
      red,
      total: pfProjects.length,
      budget,
      spent,
    };
  });

  const attention = projects
    .filter((p) => ragLevel(p.ragStatus) === "red" || ragLevel(p.ragStatus) === "amber")
    .slice(0, 20)
    .map((p) => ({
      id: p.id,
      name: p.name,
      clientName: p.clientName,
      managerName: p.managerName,
      ragStatus: p.ragStatus,
      updatedAt: p.updatedAt,
    }));

  const milestoneTimeline = milestones
    .filter((m) => {
      const d = m.targetDate || m.dueDate;
      if (!d) return false;
      const td = new Date(d + "T00:00:00");
      const end = new Date(now);
      end.setDate(end.getDate() + 90);
      return td >= now && td <= end;
    })
    .slice(0, 30)
    .map((m) => ({
      id: m.id,
      name: m.name,
      projectName: m.projectName,
      targetDate: m.targetDate || m.dueDate,
      ragStatus: m.ragStatus,
    }));

  const programmeCount = programmes.length;
  const childProjectCount = programmes.reduce((s, g) => s + g.childCount, 0);

  const { getPortfolioAvgHealthTrend } = await import("./health-history");
  const avgHealthTrend = await getPortfolioAvgHealthTrend(
    tenantId,
    avgHealth,
    active.map((p) => p.id),
  );

  return {
    kpis: {
      activeProjects: active.length,
      atRiskCount: atRisk.length,
      totalBudget,
      totalSpent,
      milestonesDue30d,
      avgHealth,
      avgHealthTrend,
      programmeCount,
      childProjectCount,
      greenCount: projects.filter((p) => ragLevel(p.ragStatus) === "green").length,
      amberCount: projects.filter((p) => ragLevel(p.ragStatus) === "amber").length,
      redCount: projects.filter((p) => ragLevel(p.ragStatus) === "red").length,
    },
    portfolioHealth,
    budgetByPortfolio: portfolioHealth.map((p) => ({ name: p.name, budget: p.budget, spent: p.spent, colour: p.colour })),
    milestoneTimeline,
    attentionQueue: attention,
    programmes: programmes.slice(0, 10),
    projects,
    portfolios,
    allProgrammeRecords: allProjects.filter((p) => p.workType === "programme"),
    resourceUtilisation,
    activityFeed,
  };
}

export interface ProgrammeListItem {
  id: number;
  source: "program" | "project";
  name: string;
  description: string | null;
  ownerId: string | null;
  ownerName: string | null;
  status: string | null;
  ragStatus: string | null;
  progress: number;
  budget: number;
  spentBudget: number;
  startDate: string | null;
  endDate: string | null;
  portfolioId: number | null;
  portfolioName: string | null;
  clientNames: string[];
  childCount: number;
  children: PortfolioProjectRow[];
}

export async function getProgrammesList(tenantId: number, clientId?: number): Promise<ProgrammeListItem[]> {
  const [programs, projects, clientMap] = await Promise.all([
    storage.getPmPrograms(tenantId, undefined, clientId),
    loadScopedProjects(tenantId, clientId),
    loadClientMap(tenantId),
  ]);

  const portfolios = await storage.getPmPortfolios(tenantId, clientId);
  const pfMap = new Map(portfolios.map((p) => [p.id, p.name]));

  const items: ProgrammeListItem[] = [];

  for (const prog of programs) {
    const children = projects.filter((p) => p.programId === prog.id);
    const avgProgress = children.length
      ? Math.round(children.reduce((s, c) => s + c.progress, 0) / children.length)
      : 0;
    const clientNames = [...new Set(children.map((c) => c.clientName).filter(Boolean))] as string[];
    items.push({
      id: prog.id,
      source: "program",
      name: prog.name,
      description: prog.description,
      ownerId: prog.ownerId,
      ownerName: prog.ownerId,
      status: prog.status,
      ragStatus: prog.ragStatus,
      progress: avgProgress,
      budget: budgetNum(prog.budget),
      spentBudget: budgetNum(prog.spentBudget),
      startDate: prog.startDate,
      endDate: prog.endDate,
      portfolioId: prog.portfolioId,
      portfolioName: prog.portfolioId ? pfMap.get(prog.portfolioId) ?? null : null,
      clientNames,
      childCount: children.length,
      children,
    });
  }

  const allProjects = await storage.getPmProjects(tenantId, clientId !== undefined ? { clientId } : {});
  const programmeProjects = allProjects.filter((p) => p.workType === "programme");
  for (const pp of programmeProjects) {
    const childRows = projects.filter((p) => p.parentProjectId === pp.id);
    const avgProgress = childRows.length
      ? Math.round(childRows.reduce((s, c) => s + c.progress, 0) / childRows.length)
      : pp.progress ?? 0;
    const clientNames = [...new Set(childRows.map((c) => c.clientName).filter(Boolean))] as string[];
    if (pp.clientId && !clientNames.length) clientNames.push(clientMap.get(pp.clientId) || "");
    items.push({
      id: pp.id,
      source: "project",
      name: pp.name,
      description: pp.description,
      ownerId: pp.ownerId,
      ownerName: pp.projectManager || pp.ownerId,
      status: pp.status,
      ragStatus: pp.ragStatus,
      progress: avgProgress,
      budget: budgetNum(pp.budget),
      spentBudget: budgetNum(pp.spentBudget),
      startDate: pp.startDate,
      endDate: pp.endDate,
      portfolioId: pp.portfolioId,
      portfolioName: pp.portfolioId ? pfMap.get(pp.portfolioId) ?? null : null,
      clientNames,
      childCount: childRows.length,
      children: childRows,
    });
  }

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getProgrammeDetail(tenantId: number, id: number, source: "program" | "project") {
  const programmes = await getProgrammesList(tenantId);
  const item = programmes.find((p) => p.id === id && p.source === source);
  if (!item) return null;

  const projectIds = item.children.map((c) => c.id);
  let milestones: PmMilestone[] = [];
  let raidd: typeof pmRaiddItems.$inferSelect[] = [];
  if (projectIds.length) {
    [milestones, raidd] = await Promise.all([
      db.select().from(pmMilestones).where(and(eq(pmMilestones.tenantId, tenantId), inArray(pmMilestones.projectId, projectIds))),
      db.select().from(pmRaiddItems).where(and(eq(pmRaiddItems.tenantId, tenantId), inArray(pmRaiddItems.projectId, projectIds))),
    ]);
  }

  const health = item.children.length
    ? Math.round(item.children.reduce((s, c) => s + healthScore(c), 0) / item.children.length)
    : healthScore({
        ...item,
        id: item.id,
        code: null,
        clientId: null,
        clientName: null,
        managerId: item.ownerId,
        managerName: item.ownerName,
        portfolioIds: item.portfolioId ? [item.portfolioId] : [],
        portfolioNames: item.portfolioName ? [item.portfolioName] : [],
        programId: null,
        programName: null,
        parentProjectId: null,
        workType: "programme",
        scheduleRag: null,
        financialRag: null,
        updatedAt: null,
      } as PortfolioProjectRow);

  return { ...item, health, milestones, raidd };
}

export async function getScopedMilestones(tenantId: number, clientId?: number) {
  const projects = await loadScopedProjects(tenantId, clientId);
  const projectIds = projects.map((p) => p.id);
  if (!projectIds.length) {
    const standalone = await db.select().from(pmMilestones).where(and(eq(pmMilestones.tenantId, tenantId), sql`${pmMilestones.projectId} IS NULL`));
    return standalone;
  }
  const rows = await db
    .select()
    .from(pmMilestones)
    .where(
      and(
        eq(pmMilestones.tenantId, tenantId),
        or(inArray(pmMilestones.projectId, projectIds), sql`${pmMilestones.projectId} IS NULL`),
      ),
    )
    .orderBy(pmMilestones.targetDate);
  return rows;
}

export async function getRoadmapData(tenantId: number, clientId?: number) {
  const [projects, programmes, clientMap] = await Promise.all([
    loadScopedProjects(tenantId, clientId),
    getProgrammesList(tenantId, clientId),
    loadClientMap(tenantId),
  ]);

  const allRows = await storage.getPmProjects(tenantId, clientId !== undefined ? { clientId } : {});
  const programmeProjects = allRows.filter((p) => p.workType === "programme");

  type RoadmapItem = {
    id: string;
    entityId: number;
    name: string;
    type: "project" | "programme" | "internal";
    clientId: number | null;
    clientName: string | null;
    managerName: string | null;
    startDate: string | null;
    endDate: string | null;
    ragStatus: string | null;
    status: string | null;
    portfolioName: string | null;
    programmeName: string | null;
    colour: string;
    provisional: boolean;
  };

  const items: RoadmapItem[] = [];

  for (const prog of programmes) {
    items.push({
      id: `prog-${prog.source}-${prog.id}`,
      entityId: prog.id,
      name: prog.name,
      type: "programme",
      clientId: null,
      clientName: prog.clientNames.join(", ") || null,
      managerName: prog.ownerName,
      startDate: prog.startDate,
      endDate: prog.endDate,
      ragStatus: prog.ragStatus,
      status: prog.status,
      portfolioName: prog.portfolioName,
      programmeName: prog.name,
      colour: "#3B82F6",
      provisional: !prog.endDate,
    });
  }

  for (const p of projects) {
    const isInternal = !p.clientId;
    items.push({
      id: `proj-${p.id}`,
      entityId: p.id,
      name: p.name,
      type: isInternal ? "internal" : "project",
      clientId: p.clientId,
      clientName: p.clientName || (p.clientId ? clientMap.get(p.clientId) ?? null : null),
      managerName: p.managerName,
      startDate: p.startDate,
      endDate: p.endDate,
      ragStatus: p.ragStatus,
      status: p.status,
      portfolioName: p.portfolioNames[0] ?? null,
      programmeName: p.programName,
      colour: isInternal ? "#8B5CF6" : "#22C55E",
      provisional: !p.endDate,
    });
  }

  for (const pp of programmeProjects) {
    if (items.some((i) => i.entityId === pp.id && i.type === "programme")) continue;
  }

  const milestones = await getScopedMilestones(tenantId, clientId);
  const milestoneMarkers = milestones
    .filter((m) => m.targetDate || m.dueDate)
    .map((m) => ({
      id: m.id,
      name: m.name,
      projectName: m.projectName,
      date: m.targetDate || m.dueDate,
      ragStatus: m.ragStatus,
      projectId: m.projectId,
    }));

  return { items, milestoneMarkers };
}

export interface HealthMatrixRow {
  projectId: number;
  projectName: string;
  clientName: string | null;
  managerName: string | null;
  portfolioNames: string[];
  programmeName: string | null;
  overall: RagLevel;
  schedule: RagLevel;
  budget: RagLevel;
  quality: RagLevel;
  delivery: RagLevel;
  risk: RagLevel;
  resources: RagLevel;
  stakeholders: RagLevel;
}

export async function getHealthMatrix(tenantId: number, clientId?: number): Promise<HealthMatrixRow[]> {
  const projects = await loadScopedProjects(tenantId, clientId);
  const projectIds = projects.map((p) => p.id);

  const [milestones, risks, issues, teamCounts] = await Promise.all([
    projectIds.length
      ? db.select().from(pmMilestones).where(and(eq(pmMilestones.tenantId, tenantId), inArray(pmMilestones.projectId, projectIds)))
      : Promise.resolve([]),
    projectIds.length
      ? db.select().from(pmRaiddItems).where(and(eq(pmRaiddItems.tenantId, tenantId), inArray(pmRaiddItems.projectId, projectIds), eq(pmRaiddItems.type, "risk")))
      : Promise.resolve([]),
    projectIds.length
      ? db.select().from(pmRaiddItems).where(and(eq(pmRaiddItems.tenantId, tenantId), inArray(pmRaiddItems.projectId, projectIds), eq(pmRaiddItems.type, "issue")))
      : Promise.resolve([]),
    projectIds.length
      ? db.select({ projectId: pmTeamMembers.projectId, count: sql<number>`count(*)` }).from(pmTeamMembers).where(inArray(pmTeamMembers.projectId, projectIds)).groupBy(pmTeamMembers.projectId)
      : Promise.resolve([]),
  ]);

  const teamMap = new Map(teamCounts.map((t) => [t.projectId, Number(t.count)]));
  const today = new Date().toISOString().split("T")[0];

  return projects.map((p) => {
    const pMilestones = milestones.filter((m) => m.projectId === p.id);
    const overdue = pMilestones.filter((m) => {
      const d = m.targetDate || m.dueDate;
      return d && d < today && (m.status || "") !== "completed" && (m.ragStatus || "").toLowerCase() !== "blue";
    }).length;

    const pRisks = risks.filter((r) => r.projectId === p.id && (r.status || "open") === "open");
    const highRisk = pRisks.some((r) => r.priority === "critical" || r.priority === "high");

    const pIssues = issues.filter((i) => i.projectId === p.id && (i.status || "open") === "open");
    const issueHeavy = pIssues.length >= 5;

    const spentPct = p.budget > 0 ? (p.spentBudget / p.budget) * 100 : 0;
    let budgetRag: RagLevel = ragLevel(p.financialRag);
    if (spentPct > 100) budgetRag = "red";
    else if (spentPct >= 80) budgetRag = "amber";

    let deliveryRag: RagLevel = "green";
    if (overdue > 2) deliveryRag = "red";
    else if (overdue > 0) deliveryRag = "amber";

    const riskRag: RagLevel = highRisk ? "red" : pRisks.length > 3 ? "amber" : "green";
    const qualityRag: RagLevel = issueHeavy ? "amber" : "green";
    const resourcesRag: RagLevel = (teamMap.get(p.id) || 0) === 0 ? "red" : "green";

    const dims: RagLevel[] = [
      ragLevel(p.ragStatus),
      ragLevel(p.scheduleRag),
      budgetRag,
      qualityRag,
      deliveryRag,
      riskRag,
      resourcesRag,
      "green",
    ];
    const overall: RagLevel = dims.includes("red") ? "red" : dims.includes("amber") ? "amber" : "green";

    return {
      projectId: p.id,
      projectName: p.name,
      clientName: p.clientName,
      managerName: p.managerName,
      portfolioNames: p.portfolioNames,
      programmeName: p.programName,
      overall,
      schedule: ragLevel(p.scheduleRag),
      budget: budgetRag,
      quality: qualityRag,
      delivery: deliveryRag,
      risk: riskRag,
      resources: resourcesRag,
      stakeholders: "green",
    };
  });
}

export async function generate360Report(tenantId: number, projectId: number, narrativeOverride?: string) {
  const project = await storage.getPmProject(projectId);
  if (!project || project.tenantId !== tenantId) return null;

  const [phases, milestones, workstreams, deliverables, team, clientRow, raidRows, budgetRows, tasks] = await Promise.all([
    storage.getPmProjectPhases(projectId),
    storage.getPmMilestones(projectId),
    db.select().from(pmWorkstreams).where(eq(pmWorkstreams.projectId, projectId)),
    db.select().from(pmDeliverables).where(and(eq(pmDeliverables.projectId, projectId), or(eq(pmDeliverables.archived, false), isNull(pmDeliverables.archived)))),
    storage.getPmTeamMembers(projectId),
    project.clientId ? storage.getClientById(project.clientId, tenantId) : Promise.resolve(undefined),
    db.select().from(pmRaiddItems).where(and(
      eq(pmRaiddItems.projectId, projectId),
      or(eq(pmRaiddItems.archived, false), isNull(pmRaiddItems.archived)),
    )),
    db.select().from(projectBudgets).where(and(eq(projectBudgets.tenantId, tenantId), eq(projectBudgets.projectId, projectId))).orderBy(desc(projectBudgets.updatedAt)).limit(1),
    storage.getPmTasks(projectId),
  ]);

  const openish = (status: string | null | undefined) => {
    const s = (status || "open").toLowerCase();
    return s !== "closed" && s !== "resolved" && s !== "cancelled" && s !== "done" && s !== "complete" && s !== "completed";
  };

  // Same non-archived rows as sidebar RAID logs (Risk / Issues / Dependencies / Decisions Log).
  // Do not filter to open-only — Issues Log shows the full log by default.
  const risks = raidRows.filter((r) => r.type === "risk");
  const issues = raidRows.filter((r) => r.type === "issue");
  const dependencies = raidRows.filter((r) => r.type === "dependency");
  const decisions = raidRows.filter((r) => r.type === "decision");
  const actions = raidRows.filter((r) =>
    r.type === "action" || (r.type === "issue" && (r.issueType || "").toLowerCase() === "action"),
  );
  const openRisksCount = risks.filter((r) => openish(r.status)).length;
  const openIssuesCount = issues.filter((r) => openish(r.status)).length;

  const topRisks = [...risks]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .map((r) => ({
      id: r.id,
      ref: r.code,
      description: r.title,
      owner: r.ownerName || r.ownerId,
      severity: r.priority,
      mitigation: r.mitigation || "",
      category: r.category,
      likelihood: r.likelihood,
      impact: r.impact,
      status: r.status,
      due: isoDate(r.dueDate),
      dateRaised: isoDate(r.createdAt),
      contingency: r.contingency,
      escalated: !!r.escalated,
    }));

  const topIssues = [...issues]
    .sort((a, b) => {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.priority || "medium"] ?? 9) - (order[b.priority || "medium"] ?? 9);
    })
    .map((i) => ({
      id: i.id,
      ref: i.code,
      description: i.title,
      owner: i.ownerName || i.ownerId,
      priority: i.priority,
      targetResolution: isoDate(i.resolutionTarget) || isoDate(i.dueDate),
      impact: i.impact || i.timelineImpact,
      resolution: i.resolution || i.response,
      status: i.status,
      dateRaised: isoDate(i.createdAt),
    }));

  const openDependencies = dependencies
    .filter((d) => {
      const s = (d.status || "").toLowerCase();
      return openish(d.status) && !d.closed && s !== "met";
    })
    .map((d) => ({
    id: d.id,
    ref: d.code,
    description: d.title,
    direction: d.dependentOn || "Inbound",
    requiredBy: isoDate(d.requiredByDate),
    status: d.status,
    type: d.issueType || d.category || null,
    source: d.workstream || d.basis || null,
    impact: d.impact || d.timelineImpact,
    owner: d.ownerName || d.ownerId,
    dateIdentified: isoDate(d.createdAt),
  }));

  const decisionRows = decisions.map((d) => ({
    id: d.id,
    ref: d.code,
    text: d.title,
    owner: d.ownerName || d.ownerId || "",
    decisionDate: d.decisionDate,
    rationale: d.rationale || d.description || "",
    forum: d.decisionBody,
    impact: d.impact,
    status: d.status,
  }));

  const actionRows = actions.map((a) => ({
    id: a.id,
    ref: a.code,
    text: a.title,
    owner: a.ownerName || a.ownerId || "",
    due: isoDate(a.dueDate) || isoDate(a.resolutionTarget) || "",
    status: a.status,
    raisedFrom: a.linkedItemType || a.workstream || a.category,
    raised: isoDate(a.createdAt),
  }));

  const healthRow = (await getHealthMatrix(tenantId)).find((h) => h.projectId === projectId);

  const thisWeek = weekStartMonday();
  const prior = new Date(thisWeek + "T00:00:00");
  prior.setDate(prior.getDate() - 7);
  const priorWeek = prior.toISOString().split("T")[0];
  const [lastWeekSnap] = await db
    .select()
    .from(pmHealthMatrixSnapshots)
    .where(and(
      eq(pmHealthMatrixSnapshots.tenantId, tenantId),
      eq(pmHealthMatrixSnapshots.projectId, projectId),
      eq(pmHealthMatrixSnapshots.snapshotWeek, priorWeek),
    ))
    .limit(1);

  const lastWeekRag = lastWeekSnap
    ? {
        schedule: lastWeekSnap.schedule,
        cost: lastWeekSnap.budget,
        quality: lastWeekSnap.quality,
        resources: lastWeekSnap.resources,
        risk: lastWeekSnap.risk,
        overall: lastWeekSnap.overall,
      }
    : null;

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const overdueMilestones = milestones.filter(
    (m) => (m.targetDate || m.dueDate || "") < todayStr && m.status !== "completed",
  ).length;
  const budgetUsedPct = budgetNum(project.budget) > 0
    ? Math.round((budgetNum(project.spentBudget) / budgetNum(project.budget)) * 100)
    : 0;

  const meta = (project.metadata && typeof project.metadata === "object" ? project.metadata : {}) as Record<string, unknown>;
  const report360Meta = (meta.report360 && typeof meta.report360 === "object" ? meta.report360 : {}) as Record<string, unknown>;

  const savedNarrative = typeof report360Meta.narrative === "string" ? report360Meta.narrative : undefined;
  const { narrative: aiNarrative, source: narrativeSource } = narrativeOverride
    ? { narrative: narrativeOverride, source: "manual" as const }
    : savedNarrative
      ? { narrative: savedNarrative, source: "manual" as const }
      : await generate360ExecutiveNarrative({
          projectName: project.name,
          client: clientRow?.name || project.customer || null,
          pm: await displayPersonName(project.projectManager, project.managerId),
          overallRag: project.ragStatus,
          progress: project.progress ?? 0,
          status: project.status,
          openRisks: openRisksCount,
          openIssues: openIssuesCount,
          overdueMilestones,
          budgetUsedPct,
        });

  let budgetBreakdown: { category: string; budgeted: number; actual: number }[] = [];
  const finBudget = budgetRows[0];
  if (finBudget) {
    const [labour, expenses] = await Promise.all([
      db.select().from(budgetLabourLines).where(eq(budgetLabourLines.budgetId, finBudget.id)),
      db.select().from(budgetExpenseLines).where(eq(budgetExpenseLines.budgetId, finBudget.id)),
    ]);
    const labourBudgeted = labour.reduce((s, l) => s + budgetNum(l.budgetedCost), 0);
    const labourActual = labour.reduce((s, l) => s + budgetNum(l.actualCost), 0);
    if (labour.length) budgetBreakdown.push({ category: "Labour", budgeted: labourBudgeted, actual: labourActual });
    for (const e of expenses) {
      budgetBreakdown.push({
        category: e.category,
        budgeted: budgetNum(e.budgetedAmount),
        actual: budgetNum(e.actualAmount),
      });
    }
    if (!budgetBreakdown.length) {
      budgetBreakdown = [
        { category: "Labour", budgeted: budgetNum(finBudget.labourBudget), actual: 0 },
        { category: "Expenses", budgeted: budgetNum(finBudget.expenseBudget), actual: budgetNum(finBudget.actualCost) },
      ].filter((r) => r.budgeted > 0 || r.actual > 0);
    }
  }

  const level1PlanRows = buildLevel1PlanRows(project.name, phases, milestones);
  const savedActivity = Array.isArray(report360Meta.activityPlan) ? report360Meta.activityPlan : null;
  const activityPlan = savedActivity?.length
    ? savedActivity
    : buildActivityPlan(project.name, workstreams, tasks);

  const savedLevel1 = Array.isArray(report360Meta.level1PlanRows) ? report360Meta.level1PlanRows : null;
  const level1Rows = savedLevel1?.length ? savedLevel1 : level1PlanRows;

  const currentPhase =
    phases.find((ph) => (ph.status || "").toLowerCase() === "in_progress")?.name
    || phases.find((ph) => (ph.status || "").toLowerCase() !== "completed")?.name
    || "";
  const progressPct = project.progress ?? 0;
  const healthScoreVal = healthRow
    ? Math.round(
      (
        (["green", "amber", "red"].indexOf((healthRow.overall || "green").toLowerCase()) === 0 ? 100
          : ["green", "amber", "red"].indexOf((healthRow.overall || "green").toLowerCase()) === 1 ? 60 : 20)
        + (healthRow.schedule === "green" ? 100 : healthRow.schedule === "amber" ? 60 : 20)
        + (healthRow.budget === "green" ? 100 : healthRow.budget === "amber" ? 60 : 20)
        + (healthRow.quality === "green" ? 100 : healthRow.quality === "amber" ? 60 : 20)
      ) / 4,
    )
    : progressPct;

  const metaPmo = typeof meta.pmoName === "string" ? meta.pmoName
    : typeof meta.leadPmo === "string" ? meta.leadPmo
      : project.deliveryOwner || null;
  const metaProgMgr = typeof meta.programmeManager === "string" ? meta.programmeManager
    : project.executiveSponsor || project.businessOwner || null;

  const [pmName, programmeManagerName, pmoName] = await Promise.all([
    displayPersonName(project.projectManager, project.managerId),
    displayPersonName(metaProgMgr),
    displayPersonName(metaPmo),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    executiveSummary: {
      projectName: project.name,
      client: clientRow?.name || project.customer,
      pm: pmName,
      programmeManager: programmeManagerName,
      pmo: pmoName,
      methodology: project.methodology,
      framework: project.framework,
      currentPhase: currentPhase || null,
      progress: progressPct,
      healthScore: healthScoreVal,
      status: project.status,
      overallRag: project.ragStatus,
      narrative: aiNarrative,
      narrativeSource,
      startDate: project.startDate,
      plannedEnd: project.endDate,
      revisedEnd: project.baselineEndDate || project.endDate,
    },
    healthDashboard: healthRow || null,
    lastWeekRag,
    level1Plan: phases.map((ph) => ({
      id: ph.id,
      name: ph.name,
      rag: ph.ragStatus || ph.status,
      progress: ph.progress ?? 0,
      plannedStart: ph.plannedStartDate,
      plannedEnd: ph.plannedEndDate,
    })),
    level1PlanRows: level1Rows,
    activityPlan,
    milestones: milestones.map((m) => ({
      id: m.id,
      name: m.name,
      targetDate: m.targetDate || m.dueDate,
      rag: m.ragStatus,
      status: m.status,
      overdue: (m.targetDate || m.dueDate || "") < todayStr && m.status !== "completed",
    })),
    workstreamUpdates: workstreams
      .filter((w) => (w.type || "workstream") === "workstream")
      .map((w) => ({
        id: w.id,
        name: w.name,
        owner: w.ownerId,
        rag: w.ragStatus || w.status,
        progress: w.progress ?? 0,
        note: w.description,
        status: w.status,
        updatedAt: isoDate(w.updatedAt),
      })),
    raidSummary: {
      topRisks,
      topIssues,
      openDependencies,
      decisions: decisionRows,
      actions: actionRows,
    },
    deliverablesTracker: deliverables.map((d) => {
      const owners = Array.isArray(d.owners) ? (d.owners as string[]) : [];
      const approvers = Array.isArray(d.approvers) ? (d.approvers as string[]) : [];
      return {
        id: d.id,
        name: d.name,
        dueDate: d.dueDate,
        owner: owners[0],
        owners,
        status: d.status,
        phase: d.phaseName,
        type: d.type,
        approvalRequired: approvers.length > 0,
        approver: approvers[0] || null,
        approvers,
      };
    }),
    nextPhasePreview: phases.find((ph) => ph.status === "in_progress" || ph.status === "not_started")?.name || "",
    // Prefer pm_projects budget fields (same source as Finance Tracker); fall back to finance budget record.
    financialSummary: {
      budget: budgetNum(project.budget) || budgetNum(finBudget?.totalBudget),
      spent: budgetNum(project.spentBudget) || budgetNum(finBudget?.actualCost) || budgetNum(finBudget?.billedToDate),
      remaining: Math.max(
        0,
        (budgetNum(project.budget) || budgetNum(finBudget?.totalBudget)) -
          (budgetNum(project.spentBudget) || budgetNum(finBudget?.actualCost) || budgetNum(finBudget?.billedToDate)),
      ),
      forecast: budgetNum(project.forecastBudget) || budgetNum(finBudget?.forecastCost),
    },
    budgetBreakdown,
    resourceSummary: team.map((t) => {
      const role = (t.role || "team_member").toLowerCase();
      const memberType =
        role.includes("customer") || role.includes("client") || role.includes("sponsor")
          ? "Customer"
          : role.includes("contractor") || role.includes("vendor") || role.includes("supplier")
            ? "Contractor"
            : "Employee";
      return {
        id: t.id,
        name: t.user ? [t.user.firstName || "", t.user.lastName || ""].join(" ").trim() || t.userId : t.userId,
        role: t.role,
        allocation: t.allocation ?? 100,
        risk: null as string | null,
        startDate: t.startDate || null,
        endDate: t.endDate || null,
        isActive: t.isActive !== false,
        userId: t.userId,
        organisation: memberType === "Customer" ? (clientRow?.name || project.customer || "Customer") : "Internal",
        memberType,
        workstream: null as string | null,
      };
    }),
    report360: {
      highlights: Array.isArray(report360Meta.highlights) ? report360Meta.highlights as string[] : [],
      lowlights: Array.isArray(report360Meta.lowlights) ? report360Meta.lowlights as string[] : [],
      ragCommentary: typeof report360Meta.ragCommentary === "string" ? report360Meta.ragCommentary : "",
      ragComments: (report360Meta.ragComments && typeof report360Meta.ragComments === "object"
        ? report360Meta.ragComments
        : {}) as { schedule?: string; cost?: string; qualityRisk?: string },
      indicators: Array.isArray(report360Meta.indicators) ? report360Meta.indicators : null,
      readinessItems: Array.isArray(report360Meta.readinessItems) ? report360Meta.readinessItems : [],
      lastWeekRagOverride: (report360Meta.lastWeekRag && typeof report360Meta.lastWeekRag === "object"
        ? report360Meta.lastWeekRag
        : null) as Record<string, string> | null,
    },
    projectId,
  };
}

/** Persist 360 presentation + plan overlays onto pm_projects.metadata.report360 */
export async function saveProjectReport360Meta(
  tenantId: number,
  projectId: number,
  patch: Record<string, unknown>,
) {
  const project = await storage.getPmProject(projectId);
  if (!project || project.tenantId !== tenantId) return null;
  const meta = (project.metadata && typeof project.metadata === "object" ? project.metadata : {}) as Record<string, unknown>;
  const prev = (meta.report360 && typeof meta.report360 === "object" ? meta.report360 : {}) as Record<string, unknown>;
  const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
  await storage.updatePmProject(projectId, {
    metadata: { ...meta, report360: next },
  } as Parameters<typeof storage.updatePmProject>[1]);
  return next;
}


export async function saveReportSnapshot(
  tenantId: number,
  reportType: string,
  content: object,
  userId: string,
  projectId?: number,
  portfolioId?: number,
) {
  const [row] = await db
    .insert(pmReportSnapshots)
    .values({
      tenantId,
      reportType,
      projectId: projectId ?? null,
      portfolioId: portfolioId ?? null,
      contentJson: content,
      generatedBy: userId,
    })
    .returning();
  return row;
}

/** Latest snapshot for a project report type (used to restore sectionOverrides). */
export async function getLatestReportSnapshot(
  tenantId: number,
  reportType: string,
  projectId: number,
) {
  const [row] = await db
    .select()
    .from(pmReportSnapshots)
    .where(
      and(
        eq(pmReportSnapshots.tenantId, tenantId),
        eq(pmReportSnapshots.reportType, reportType),
        eq(pmReportSnapshots.projectId, projectId),
      ),
    )
    .orderBy(desc(pmReportSnapshots.generatedAt))
    .limit(1);
  return row ?? null;
}

export async function listReportSchedules(tenantId: number) {
  return db.select().from(pmReportSchedules).where(eq(pmReportSchedules.tenantId, tenantId)).orderBy(desc(pmReportSchedules.createdAt));
}

export async function createReportSchedule(data: typeof pmReportSchedules.$inferInsert) {
  const [row] = await db.insert(pmReportSchedules).values(data).returning();
  return row;
}

export async function listPortfoliosWithLinks(tenantId: number, clientId?: number) {
  const portfolios = await storage.getPmPortfolios(tenantId, clientId);
  const links = await db.select().from(pmProjectPortfolios);
  return portfolios.map((pf) => ({
    ...pf,
    projectCount: links.filter((l) => l.portfolioId === pf.id).length,
  }));
}

export async function getPortfolioProjectLinks(portfolioId: number, tenantId: number, clientId?: number) {
  const [projects, links] = await Promise.all([
    loadScopedProjects(tenantId, clientId),
    db.select().from(pmProjectPortfolios).where(eq(pmProjectPortfolios.portfolioId, portfolioId)),
  ]);
  const linkedProjectIds = links.map((l) => l.projectId);
  const legacyLinked = projects.filter((p) => p.portfolioIds.includes(portfolioId)).map((p) => p.id);
  return { projects, linkedProjectIds: [...new Set([...linkedProjectIds, ...legacyLinked])] };
}

export async function syncProjectPortfolioLinks(projectId: number, portfolioIds: number[]) {
  await db.delete(pmProjectPortfolios).where(eq(pmProjectPortfolios.projectId, projectId));
  if (portfolioIds.length) {
    await db.insert(pmProjectPortfolios).values(portfolioIds.map((portfolioId) => ({ projectId, portfolioId })));
  }
  if (portfolioIds[0]) {
    await storage.updatePmProject(projectId, { portfolioId: portfolioIds[0] });
  }
}

export async function syncPortfolioProjectLinks(portfolioId: number, projectIds: number[]) {
  await db.delete(pmProjectPortfolios).where(eq(pmProjectPortfolios.portfolioId, portfolioId));
  if (projectIds.length) {
    await db.insert(pmProjectPortfolios).values(projectIds.map((projectId) => ({ projectId, portfolioId })));
    for (const projectId of projectIds) {
      const project = await storage.getPmProject(projectId);
      if (project && !project.portfolioId) {
        await storage.updatePmProject(projectId, { portfolioId });
      }
    }
  }
}

export async function getPortfolioSummaryReport(tenantId: number, clientId?: number) {
  const projects = await loadScopedProjects(tenantId, clientId);
  return projects.map((p) => ({
    name: p.name,
    client: p.clientName,
    pm: p.managerName,
    rag: p.ragStatus,
    budget: p.budget,
    spent: p.spentBudget,
    progress: p.progress,
    portfolios: p.portfolioNames.join(", "),
    programme: p.programName,
  }));
}

export async function getRaidConsolidated(tenantId: number, clientId?: number) {
  const projects = await loadScopedProjects(tenantId, clientId);
  const projectIds = projects.map((p) => p.id);
  if (!projectIds.length) return [];
  const items = await db
    .select()
    .from(pmRaiddItems)
    .where(and(eq(pmRaiddItems.tenantId, tenantId), inArray(pmRaiddItems.projectId, projectIds), eq(pmRaiddItems.status, "open")));
  const projMap = new Map(projects.map((p) => [p.id, p.name]));
  return items.map((i) => ({
    ...i,
    projectName: projMap.get(i.projectId),
  }));
}

export async function getMilestoneRegister(tenantId: number, clientId?: number) {
  const milestones = await getScopedMilestones(tenantId, clientId);
  const projects = await loadScopedProjects(tenantId, clientId);
  const projMap = new Map(projects.map((p) => [p.id, p]));
  return milestones.map((m) => {
    const proj = m.projectId ? projMap.get(m.projectId) : undefined;
    return {
      ...m,
      ref: m.ref || `MS-${String(m.id).padStart(3, "0")}`,
      programme: proj?.programName ?? null,
      portfolio: proj?.portfolioNames?.join(", ") ?? null,
      client: proj?.clientName ?? null,
    };
  });
}
