import {
  and,
  asc,
  eq,
  inArray
} from "drizzle-orm";
import { db } from "../db";
import {
  crmAccounts,
  crmOpportunities,
  crmOpportunityStages,
  opportunityResourcePlans,
  opportunityResourceRows,
  resources,
  resourceAllocations,
  resourceLeaves,
  resourceSkills,
  skills,
  skillCategories,
  recruitmentRecommendations,
  resourcePlanningScenarios,
  resourcePlanningAuditLog,
  UTILISATION_TARGET_PCT
} from "@shared/schema";
import {
  computeAllocationPctForResource,
  getCapacityVsDemand,
  getExtendedResourceStats,
  getPipelineView,
  getUtilisationTrend
} from "../resources/service";

const MS_DAY = 86400000;

function parseNum(v: string | number | null | undefined, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

function initials(first: string, last: string): string {
  return `${(first[0] ?? "").toUpperCase()}${(last[0] ?? "").toUpperCase()}`;
}

function avatarColor(id: number): string {
  const colors = ["#4338CA", "#059669", "#D97706", "#DC2626", "#7C3AED", "#0891B2"];
  return colors[id % colors.length];
}

function monthEnd(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function formatMonth(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function formatShortMonth(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "short" });
}

function mondayOf(d: Date): Date {
  const m = new Date(d);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  m.setHours(0, 0, 0, 0);
  return m;
}

function weeksBetween(start: Date, end: Date): number {
  const diff = end.getTime() - start.getTime();
  return Math.max(0, Math.ceil((diff + MS_DAY) / (7 * MS_DAY)));
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

function probabilityWeight(probability: number | null, scenario: "expected" | "best" | "worst"): number {
  const p = parseNum(probability, 50) / 100;
  if (scenario === "best") return Math.min(1, p * 1.4);
  if (scenario === "worst") return p * 0.6;
  return p;
}

async function loadTenantData(tenantId: number) {
  const [people, allocations, leaves, oppRows, stages, accounts, skillList, rsRows] = await Promise.all([
    db.select().from(resources).where(eq(resources.tenantId, tenantId)),
    db.select().from(resourceAllocations).where(eq(resourceAllocations.tenantId, tenantId)),
    db.select().from(resourceLeaves).where(eq(resourceLeaves.tenantId, tenantId)),
    db.select({
      row: opportunityResourceRows,
      plan: opportunityResourcePlans,
      opp: crmOpportunities,
      account: crmAccounts,
    })
      .from(opportunityResourceRows)
      .innerJoin(opportunityResourcePlans, eq(opportunityResourceRows.planId, opportunityResourcePlans.id))
      .innerJoin(crmOpportunities, eq(opportunityResourcePlans.opportunityId, crmOpportunities.id))
      .leftJoin(crmAccounts, eq(crmOpportunities.accountId, crmAccounts.id))
      .where(eq(crmOpportunities.tenantId, tenantId)),
    db.select().from(crmOpportunityStages).where(eq(crmOpportunityStages.tenantId, tenantId)),
    db.select().from(crmAccounts).where(eq(crmAccounts.tenantId, tenantId)),
    db.select({ skill: skills, category: skillCategories })
      .from(skills)
      .leftJoin(skillCategories, eq(skills.categoryId, skillCategories.id))
      .where(eq(skills.tenantId, tenantId)),
    db.select({ rs: resourceSkills, skill: skills })
      .from(resourceSkills)
      .innerJoin(skills, eq(resourceSkills.skillId, skills.id))
      .innerJoin(resources, eq(resourceSkills.resourceId, resources.id))
      .where(eq(resources.tenantId, tenantId)),
  ]);
  return { people, allocations, leaves, oppRows, stages, accounts, skillList, rsRows };
}

export async function logRpAudit(
  tenantId: number,
  entityType: string,
  entityId: number | null,
  action: string,
  actorUserId: string | null,
  details?: Record<string, unknown>,
) {
  await db.insert(resourcePlanningAuditLog).values({
    tenantId,
    entityType,
    entityId: entityId ?? undefined,
    action,
    actorUserId: actorUserId ?? undefined,
    details,
  });
}

export async function getExecutiveDashboard(tenantId: number) {
  const stats = await getExtendedResourceStats(tenantId);
  const trend = await getUtilisationTrend(tenantId, 8);
  const capacity = await getCapacityVsDemand(tenantId, 26);
  const { people, allocations, oppRows } = await loadTenantData(tenantId);

  const now = new Date();
  const in30 = new Date(now);
  in30.setDate(in30.getDate() + 30);

  const atRisk = people
    .filter((p) => p.status === "active" || p.status === "bench")
    .map((p) => {
      const activeAllocs = allocations.filter(
        (a) => a.resourceId === p.id && a.status === "active" && new Date(a.endDate) >= now && new Date(a.endDate) <= in30,
      );
      if (!activeAllocs.length) return null;
      const latest = activeAllocs.sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0];
      const daysLeft = Math.ceil((new Date(latest.endDate).getTime() - now.getTime()) / MS_DAY);
      const hasNext = allocations.some(
        (a) => a.resourceId === p.id && a.status === "active" && new Date(a.startDate) > new Date(latest.endDate),
      );
      const bookingStatus = hasNext ? "Confirmed" : latest.allocationType === "pipeline" || latest.allocationType === "soft" ? "Prospect" : "No booking";
      return {
        id: p.id,
        name: `${p.firstName} ${p.lastName}`,
        initials: initials(p.firstName, p.lastName),
        color: avatarColor(p.id),
        role: p.jobTitle ?? "—",
        rolloff: `${daysLeft}d`,
        bookingStatus,
        status: daysLeft <= 7 ? "Critical" : daysLeft <= 14 ? "At risk" : "Rolling off",
        statusVariant: daysLeft <= 7 ? "destructive" as const : daysLeft <= 14 ? "warning" as const : "success" as const,
      };
    })
    .filter(Boolean);

  const byRole: Record<string, { demand: number; supply: number }> = {};
  for (const p of people.filter((x) => x.status === "active" || x.status === "bench")) {
    const role = p.jobTitle ?? "Unassigned";
    byRole[role] = byRole[role] ?? { demand: 0, supply: 1 };
    byRole[role].supply += 1;
  }
  for (const item of oppRows) {
    if (item.row.status === "Confirmed") continue;
    const role = item.row.roleName ?? "Unknown";
    const weight = parseNum(item.opp.probability, 50) / 100;
    byRole[role] = byRole[role] ?? { demand: 0, supply: 0 };
    byRole[role].demand += parseNum(item.row.daysPerWeek, 0) * 4 * weight;
  }

  const pipelineDemand = Object.entries(byRole)
    .map(([role, v]) => ({
      role,
      demand: Math.round(v.demand * 10) / 10,
      supply: v.supply,
      pct: v.supply > 0 ? Math.min(100, Math.round((v.demand / v.supply) * 100)) : 100,
    }))
    .sort((a, b) => b.demand - a.demand)
    .slice(0, 6);

  const skillsGaps = pipelineDemand
    .filter((d) => d.demand > d.supply)
    .map((d) => ({
      skill: d.role,
      demand: Math.ceil(d.demand),
      supply: d.supply,
      gap: Math.ceil(d.demand - d.supply),
      severity: d.demand > d.supply * 1.5 ? "critical" as const : "warning" as const,
      action: `Recruit ${Math.ceil(d.demand - d.supply)} ${d.role}(s) before demand peak`,
    }))
    .slice(0, 4);

  const demandValues = capacity.map((c) => Math.round(c.allocated + c.pipeline));
  const supplyValues = capacity.map((c) => Math.round(c.available + c.allocated));

  const criticalShortages = skillsGaps.filter((g) => g.severity === "critical").length;
  const openGaps = skillsGaps.reduce((s, g) => s + g.gap, 0);
  let forecastRevenue = 0;
  for (const item of oppRows) {
    if (item.row.status === "Confirmed") continue;
    forecastRevenue += parseNum(item.opp.amount) * (parseNum(item.opp.probability, 50) / 100);
  }

  return {
    kpis: [
      { label: "Total Capacity", value: String(stats.activeResources), sub: `${stats.totalResources} total headcount` },
      { label: "Billable Utilisation", value: `${stats.utilisationPct}%`, sub: `Target ${stats.utilisationTarget}%`, valueColor: stats.utilisationPct >= stats.utilisationTarget ? "#059669" : "#D97706", accent: stats.utilisationPct >= stats.utilisationTarget ? "#059669" : "#D97706" },
      { label: "Forecast Revenue", value: forecastRevenue ? `£${(forecastRevenue / 1_000_000).toFixed(1)}M` : "—", sub: "weighted pipeline", accent: "#059669", valueColor: "#059669" },
      { label: "On Bench", value: String(stats.onBench), sub: `${stats.activeResources ? Math.round((stats.onBench / stats.activeResources) * 100) : 0}% of capacity`, accent: stats.onBench > 0 ? "#DC2626" : undefined, valueColor: stats.onBench > 0 ? "#DC2626" : undefined },
      { label: "Open Skills Gaps", value: String(openGaps || skillsGaps.length), sub: `${criticalShortages} critical`, accent: openGaps > 0 ? "#DC2626" : undefined, valueColor: openGaps > 0 ? "#DC2626" : undefined },
    ],
    alert: criticalShortages > 0
      ? { text: `Critical: ${criticalShortages} skill shortage${criticalShortages > 1 ? "s" : ""} identified in upcoming quarters.`, severity: "critical" as const }
      : null,
    demandSupplyChart: { demand: demandValues.slice(0, 6), supply: supplyValues.slice(0, 6) },
    utilisation: { current: stats.utilisationPct, target: UTILISATION_TARGET_PCT, trend: trend.map((t) => t.utilisation) },
    atRiskResources: atRisk,
    pipelineDemand,
    skillsGaps,
    meta: { resourceCount: people.length, opportunityCount: new Set(oppRows.map((r) => r.opp.id)).size },
  };
}

type DsCellType = "surplus" | "shortage" | "watch" | "ok";

function classifyCell(delta: number): { value: string; type: DsCellType } {
  if (delta > 1) return { value: `+${Math.round(delta)}`, type: "surplus" };
  if (delta < -2) return { value: String(Math.round(delta)), type: "shortage" };
  if (delta < 0) return { value: String(Math.round(delta)), type: "watch" };
  return { value: "0", type: "ok" };
}

export async function getDemandSupplyMatrix(
  tenantId: number,
  opts: { includePipeline?: boolean; practice?: string; months?: number } = {},
) {
  const months = opts.months ?? 10;
  const { people, allocations, oppRows, skillList } = await loadTenantData(tenantId);
  const now = new Date();
  const monthLabels = Array.from({ length: months }, (_, i) => formatShortMonth(addMonths(now, i)));

  const roleSet = new Set<string>();
  for (const p of people) if (p.jobTitle) roleSet.add(p.jobTitle);
  for (const item of oppRows) if (item.row.roleName) roleSet.add(item.row.roleName);

  let roles = Array.from(roleSet);
  if (opts.practice && opts.practice !== "all") {
    const practice = opts.practice.toLowerCase();
    roles = roles.filter((r) => r.toLowerCase().includes(practice));
  }

  const rows = roles.map((role) => {
    const supplyPeople = people.filter(
      (p) => (p.jobTitle ?? "").toLowerCase() === role.toLowerCase() && (p.status === "active" || p.status === "bench"),
    );
    const supply = supplyPeople.length;

    const cells = Array.from({ length: months }, (_, mi) => {
      const ms = addMonths(now, mi);
      const me = monthEnd(ms);

      let demand = 0;
      for (const a of allocations) {
        if (a.status !== "active" || (a.role ?? "").toLowerCase() !== role.toLowerCase()) continue;
        if (overlaps(new Date(a.startDate), new Date(a.endDate), ms, me)) {
          demand += parseNum(a.daysPerWeek, parseNum(a.allocationPercentage, 100) / 20);
        }
      }
      if (opts.includePipeline) {
        for (const item of oppRows) {
          if ((item.row.roleName ?? "").toLowerCase() !== role.toLowerCase()) continue;
          if (item.row.status === "Confirmed") continue;
          const start = item.row.startDate ? new Date(item.row.startDate) : ms;
          const end = item.row.endDate ? new Date(item.row.endDate) : me;
          if (overlaps(start, end, ms, me)) {
            const w = parseNum(item.opp.probability, 50) / 100;
            demand += parseNum(item.row.daysPerWeek, 0) * 4 * w;
          }
        }
      }

      const available = supply * 4;
      return classifyCell(available - demand);
    });

    const criticalMonths = cells.filter((c) => c.type === "shortage").length;
    return {
      skill: role,
      sub: skillList.find((s) => s.skill.name.toLowerCase().includes(role.toLowerCase().split(" ")[0]))?.category?.name ?? "General",
      supply,
      supplyColor: supply < 2 ? "#DC2626" : undefined,
      cells: cells.map((c) => c.value),
      cellTypes: cells.map((c) => c.type),
      trend: cells.map((c) => (c.type === "shortage" ? 90 : c.type === "watch" ? 60 : 30)),
      criticalMonths,
    };
  });

  const criticalShortages = rows.reduce((s, r) => s + r.criticalMonths, 0);
  let confirmedDemand = 0;
  let pipelineDemand = 0;
  for (const a of allocations.filter((x) => x.status === "active")) {
    confirmedDemand += parseNum(a.daysPerWeek, parseNum(a.allocationPercentage, 100) / 20);
  }
  if (opts.includePipeline) {
    for (const item of oppRows) {
      if (item.row.status === "Confirmed") continue;
      pipelineDemand += parseNum(item.row.daysPerWeek, 0) * 4 * (parseNum(item.opp.probability, 50) / 100);
    }
  }

  return {
    months: monthLabels,
    rows: rows.sort((a, b) => b.criticalMonths - a.criticalMonths),
    kpis: {
      skillsTracked: skillList.length,
      criticalShortages,
      confirmedDemand: Math.round(confirmedDemand),
      pipelineDemand: Math.round(pipelineDemand),
    },
  };
}

export async function getHeatMap(
  tenantId: number,
  opts: { weeks?: number; granularity?: "week" | "month" | "quarter" } = {},
) {
  const weeks = opts.weeks ?? 16;
  const { people, allocations, leaves, oppRows } = await loadTenantData(tenantId);
  const start = mondayOf(new Date());
  const active = people.filter((p) => p.status === "active" || p.status === "bench" || p.status === "on-leave");

  const resources = active.slice(0, 50).map((p) => {
    const weekData: { value: number; type: "avail" | "partial" | "full" | "leave" | "soft" }[] = [];

    for (let w = 0; w < weeks; w++) {
      const ws = new Date(start);
      ws.setDate(ws.getDate() + w * 7);
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);

      const onLeave = leaves.some(
        (l) => l.resourceId === p.id && overlaps(new Date(l.startDate), new Date(l.endDate), ws, we),
      );
      if (onLeave || p.status === "on-leave") {
        weekData.push({ value: 0, type: "leave" });
        continue;
      }

      let allocDays = 0;
      let softDays = 0;
      for (const a of allocations) {
        if (a.resourceId !== p.id || a.status !== "active") continue;
        if (!overlaps(new Date(a.startDate), new Date(a.endDate), ws, we)) continue;
        const days = parseNum(a.daysPerWeek, parseNum(a.allocationPercentage, 100) / 20);
        if (a.allocationType === "pipeline" || a.allocationType === "soft") softDays += days;
        else allocDays += days;
      }

      for (const item of oppRows) {
        if (item.row.resourceId !== p.id || item.row.status === "Confirmed") continue;
        const rs = item.row.startDate ? new Date(item.row.startDate) : ws;
        const re = item.row.endDate ? new Date(item.row.endDate) : we;
        if (overlaps(rs, re, ws, we)) softDays += parseNum(item.row.daysPerWeek, 0);
      }

      const capacity = parseNum(p.workingDaysPerWeek, 5) * parseNum(p.fte, 1);
      const total = allocDays + softDays;
      const pct = capacity > 0 ? Math.round((total / capacity) * 100) : 0;

      let type: "avail" | "partial" | "full" | "leave" | "soft" = "avail";
      if (softDays > 0 && allocDays === 0) type = "soft";
      else if (pct >= 80) type = "full";
      else if (pct >= 50) type = "partial";

      weekData.push({ value: pct, type });
    }

    return {
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      initials: initials(p.firstName, p.lastName),
      color: avatarColor(p.id),
      role: p.jobTitle ?? "—",
      weeks: weekData.map((w) => w.value),
      weekTypes: weekData.map((w) => w.type),
    };
  });

  const monthGroups: { label: string; weekCount: number }[] = [];
  let wi = 0;
  while (wi < weeks) {
    const d = new Date(start);
    d.setDate(d.getDate() + wi * 7);
    const weeksInMonth = Math.min(4, weeks - wi);
    monthGroups.push({ label: formatMonth(d), weekCount: weeksInMonth });
    wi += weeksInMonth;
  }

  return { resources, monthGroups, weekCount: weeks };
}

export async function getSchedulerData(tenantId: number, weeks = 16) {
  const heat = await getHeatMap(tenantId, { weeks });
  const { allocations } = await loadTenantData(tenantId);
  const start = mondayOf(new Date());

  const rows = heat.resources.map((r) => {
    const resourceAllocs = allocations.filter((a) => a.resourceId === r.id && a.status === "active");
    const bars: Array<{
      id?: number;
      span: number;
      type: "booking" | "avail" | "leave";
      label?: string;
      color?: string;
      soft?: boolean;
      startWeek?: number;
      endWeek?: number;
    }> = [];

    let week = 0;
    while (week < weeks) {
      const ws = new Date(start);
      ws.setDate(ws.getDate() + week * 7);

      if (r.weekTypes[week] === "leave") {
        bars.push({ span: 1, type: "leave" });
        week++;
        continue;
      }

      const weekAlloc = resourceAllocs.find((a) => {
        const aStart = new Date(a.startDate);
        const aEnd = new Date(a.endDate);
        const we = new Date(ws);
        we.setDate(we.getDate() + 6);
        return overlaps(aStart, aEnd, ws, we);
      });

      if (weekAlloc) {
        const aStart = new Date(weekAlloc.startDate);
        const aEnd = new Date(weekAlloc.endDate);
        let span = 1;
        while (week + span < weeks) {
          const nws = new Date(start);
          nws.setDate(nws.getDate() + (week + span) * 7);
          const nwe = new Date(nws);
          nwe.setDate(nwe.getDate() + 6);
          if (!overlaps(aStart, aEnd, nws, nwe)) break;
          span++;
        }
        const soft = weekAlloc.allocationType === "pipeline" || weekAlloc.allocationType === "soft";
        bars.push({
          id: weekAlloc.id,
          span,
          type: "booking",
          label: weekAlloc.projectName ?? weekAlloc.role ?? "Booking",
          color: soft ? "bg-blue-500" : "bg-indigo-600",
          soft,
          startWeek: week,
          endWeek: week + span - 1,
        });
        week += span;
      } else if (r.weekTypes[week] === "avail" || r.weekTypes[week] === "partial") {
        bars.push({ span: 1, type: "avail" });
        week++;
      } else {
        bars.push({ span: 1, type: "avail" });
        week++;
      }
    }

    return { ...r, bars };
  });

  return { rows, monthGroups: heat.monthGroups, weekCount: weeks };
}

export async function checkBookingConflicts(
  tenantId: number,
  resourceId: number,
  startDate: Date,
  endDate: Date,
  excludeId?: number,
) {
  const allocations = await db.select().from(resourceAllocations)
    .where(and(eq(resourceAllocations.tenantId, tenantId), eq(resourceAllocations.resourceId, resourceId), eq(resourceAllocations.status, "active")));

  const conflicts = allocations.filter((a) => {
    if (excludeId && a.id === excludeId) return false;
    return overlaps(new Date(a.startDate), new Date(a.endDate), startDate, endDate);
  });

  const person = await db.select().from(resources).where(eq(resources.id, resourceId)).limit(1);
  const capacity = person[0] ? parseNum(person[0].workingDaysPerWeek, 5) : 5;
  let totalDays = 0;
  for (const c of conflicts) {
    totalDays += parseNum(c.daysPerWeek, parseNum(c.allocationPercentage, 100) / 20);
  }

  return {
    hasConflict: conflicts.length > 0,
    overAllocated: totalDays > capacity,
    conflicts: conflicts.map((c) => ({
      id: c.id,
      projectName: c.projectName,
      role: c.role,
      startDate: c.startDate,
      endDate: c.endDate,
      daysPerWeek: c.daysPerWeek,
    })),
  };
}

export async function createBooking(
  tenantId: number,
  data: {
    resourceId: number;
    projectId?: number;
    projectName?: string;
    role?: string;
    startDate: string;
    endDate: string;
    daysPerWeek?: number;
    allocationType?: string;
    opportunityRowId?: number;
  },
  actorUserId: string | null,
) {
  const conflict = await checkBookingConflicts(
    tenantId,
    data.resourceId,
    new Date(data.startDate),
    new Date(data.endDate),
  );

  const [row] = await db.insert(resourceAllocations).values({
    tenantId,
    resourceId: data.resourceId,
    projectId: data.projectId,
    projectName: data.projectName,
    role: data.role,
    startDate: new Date(data.startDate),
    endDate: new Date(data.endDate),
    daysPerWeek: data.daysPerWeek != null ? String(data.daysPerWeek) : undefined,
    allocationType: data.allocationType ?? "confirmed",
    opportunityRowId: data.opportunityRowId,
    status: "active",
  }).returning();

  await logRpAudit(tenantId, "booking", row.id, "create", actorUserId, { ...data, conflict: conflict.hasConflict });

  return { booking: row, conflict };
}

export async function updateBooking(
  tenantId: number,
  id: number,
  data: Partial<{
    resourceId: number;
    projectName: string;
    role: string;
    startDate: string;
    endDate: string;
    daysPerWeek: number;
    allocationType: string;
  }>,
  actorUserId: string | null,
) {
  const [existing] = await db.select().from(resourceAllocations)
    .where(and(eq(resourceAllocations.id, id), eq(resourceAllocations.tenantId, tenantId)));
  if (!existing) return null;

  const resourceId = data.resourceId ?? existing.resourceId;
  const start = data.startDate ? new Date(data.startDate) : new Date(existing.startDate);
  const end = data.endDate ? new Date(data.endDate) : new Date(existing.endDate);
  const conflict = await checkBookingConflicts(tenantId, resourceId, start, end, id);

  const [row] = await db.update(resourceAllocations).set({
    resourceId,
    projectName: data.projectName ?? existing.projectName,
    role: data.role ?? existing.role,
    startDate: start,
    endDate: end,
    daysPerWeek: data.daysPerWeek != null ? String(data.daysPerWeek) : existing.daysPerWeek,
    allocationType: data.allocationType ?? existing.allocationType,
    updatedAt: new Date(),
  }).where(eq(resourceAllocations.id, id)).returning();

  await logRpAudit(tenantId, "booking", id, "update", actorUserId, { ...data, conflict: conflict.hasConflict });
  return { booking: row, conflict };
}

export async function moveBookingToWeek(
  tenantId: number,
  id: number,
  data: { resourceId: number; startWeek: number },
  actorUserId: string | null,
) {
  const [existing] = await db.select().from(resourceAllocations)
    .where(and(eq(resourceAllocations.id, id), eq(resourceAllocations.tenantId, tenantId)));
  if (!existing) return null;

  const anchor = mondayOf(new Date());
  const start = new Date(anchor);
  start.setDate(start.getDate() + data.startWeek * 7);
  const durationWeeks = Math.max(1, weeksBetween(new Date(existing.startDate), new Date(existing.endDate)));
  const end = new Date(start);
  end.setDate(end.getDate() + durationWeeks * 7 - 1);

  return updateBooking(tenantId, id, {
    resourceId: data.resourceId,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  }, actorUserId);
}

export async function extendBookingToWeek(
  tenantId: number,
  id: number,
  endWeek: number,
  actorUserId: string | null,
) {
  const [existing] = await db.select().from(resourceAllocations)
    .where(and(eq(resourceAllocations.id, id), eq(resourceAllocations.tenantId, tenantId)));
  if (!existing) return null;

  const anchor = mondayOf(new Date());
  const end = new Date(anchor);
  end.setDate(end.getDate() + (endWeek + 1) * 7 - 1);
  const start = new Date(existing.startDate);
  if (end < start) return null;

  return updateBooking(tenantId, id, {
    endDate: end.toISOString().slice(0, 10),
  }, actorUserId);
}

export async function promoteBooking(tenantId: number, id: number, actorUserId: string | null) {
  const [existing] = await db.select().from(resourceAllocations)
    .where(and(eq(resourceAllocations.id, id), eq(resourceAllocations.tenantId, tenantId)));
  if (!existing) return null;
  if (existing.allocationType !== "pipeline" && existing.allocationType !== "soft") {
    return { booking: existing, promoted: false };
  }
  const [row] = await db.update(resourceAllocations).set({
    allocationType: "confirmed",
    updatedAt: new Date(),
  }).where(eq(resourceAllocations.id, id)).returning();
  await logRpAudit(tenantId, "booking", id, "promote", actorUserId, {});
  return { booking: row, promoted: true };
}

export async function promoteOpportunityDemand(tenantId: number, opportunityId: number, actorUserId: string | null) {
  const { oppRows } = await loadTenantData(tenantId);
  const rowIds = oppRows.filter((x) => x.opp.id === opportunityId).map((x) => x.row.id);
  if (!rowIds.length) return { promoted: 0 };

  const allocs = await db.select().from(resourceAllocations).where(and(
    eq(resourceAllocations.tenantId, tenantId),
    inArray(resourceAllocations.opportunityRowId, rowIds),
    eq(resourceAllocations.status, "active"),
  ));

  const soft = allocs.filter((a) => a.allocationType === "pipeline" || a.allocationType === "soft");
  for (const a of soft) {
    await db.update(resourceAllocations).set({ allocationType: "confirmed", updatedAt: new Date() })
      .where(eq(resourceAllocations.id, a.id));
  }
  await logRpAudit(tenantId, "pipeline", opportunityId, "promote", actorUserId, { promoted: soft.length });
  return { promoted: soft.length, message: soft.length ? `Confirmed ${soft.length} soft booking(s)` : "No soft bookings to confirm" };
}

export async function deleteBooking(tenantId: number, id: number, actorUserId: string | null) {
  const [existing] = await db.select().from(resourceAllocations)
    .where(and(eq(resourceAllocations.id, id), eq(resourceAllocations.tenantId, tenantId)));
  if (!existing) return false;
  await db.update(resourceAllocations).set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(resourceAllocations.id, id));
  await logRpAudit(tenantId, "booking", id, "delete", actorUserId, {});
  return true;
}

export async function autoMatchResources(tenantId: number, roleName: string, _startDate: string, _endDate: string) {
  const { people, allocations, rsRows } = await loadTenantData(tenantId);

  const candidates = people
    .filter((p) => p.status === "active" || p.status === "bench")
    .map((p) => {
      const util = computeAllocationPctForResource(p.id, allocations);
      const roleMatch = (p.jobTitle ?? "").toLowerCase().includes(roleName.toLowerCase()) ||
        roleName.toLowerCase().includes((p.jobTitle ?? "").toLowerCase());
      const pSkills = rsRows.filter((s) => s.rs.resourceId === p.id);
      const skillMatch = pSkills.some((s) => s.skill.name.toLowerCase().includes(roleName.toLowerCase().split(" ")[0]));
      const score = (roleMatch ? 40 : 0) + (skillMatch ? 30 : 0) + (util < 80 ? 20 : 0) + (p.status === "bench" ? 10 : 0);
      return { ...p, util, score, roleMatch, skillMatch };
    })
    .filter((p) => p.score > 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return candidates.map((p) => ({
    id: p.id,
    name: `${p.firstName} ${p.lastName}`,
    role: p.jobTitle,
    location: p.location,
    languages: p.languages,
    grade: p.grade,
    utilisation: p.util,
    score: p.score,
    available: p.util < 100,
  }));
}

export async function getSkillsInventory(tenantId: number, searchTerm = "") {
  const { people, allocations, oppRows, skillList, rsRows } = await loadTenantData(tenantId);

  const byPractice: Record<string, number> = {};
  for (const item of skillList) {
    const practice = item.category?.name ?? "General";
    byPractice[practice] = (byPractice[practice] ?? 0) + 1;
  }
  const totalSkills = skillList.length || 1;
  const distribution = Object.entries(byPractice).map(([practice, count], i) => ({
    practice,
    count,
    pct: Math.round((count / totalSkills) * 100),
    color: ["#4338CA", "#059669", "#D97706", "#DC2626", "#7C3AED", "#0891B2"][i % 6],
  }));

  const demandBySkill: Record<string, number> = {};
  for (const item of oppRows) {
    const role = item.row.roleName ?? "Unknown";
    demandBySkill[role] = (demandBySkill[role] ?? 0) + parseNum(item.row.daysPerWeek, 0) * 4;
  }

  const supplyBySkill: Record<string, number> = {};
  for (const p of people.filter((x) => x.status === "active" || x.status === "bench")) {
    for (const s of rsRows.filter((r) => r.rs.resourceId === p.id)) {
      supplyBySkill[s.skill.name] = (supplyBySkill[s.skill.name] ?? 0) + 1;
    }
    if (p.jobTitle) supplyBySkill[p.jobTitle] = (supplyBySkill[p.jobTitle] ?? 0) + 1;
  }

  const allSkills = new Set([...Object.keys(demandBySkill), ...Object.keys(supplyBySkill)]);
  const topDemanded = Array.from(allSkills).map((skill) => {
    const demand = Math.round(demandBySkill[skill] ?? 0);
    const supply = supplyBySkill[skill] ?? 0;
    const gap = supply - demand;
    return {
      skill,
      supply,
      demand,
      gap,
      status: gap < -2 ? "Critical gap" : gap < 0 ? "Shortage" : "Balanced",
      variant: gap < -2 ? "destructive" as const : gap < 0 ? "warning" as const : "success" as const,
    };
  }).sort((a, b) => a.gap - b.gap).slice(0, 8);

  const q = searchTerm.toLowerCase();
  const matrix = people
    .filter((p) => p.status !== "inactive")
    .filter((p) => !q || `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) || (p.jobTitle ?? "").toLowerCase().includes(q))
    .map((p) => {
      const util = computeAllocationPctForResource(p.id, allocations);
      const pSkills = rsRows.filter((s) => s.rs.resourceId === p.id).slice(0, 4).map((s) => ({
        name: s.skill.name,
        level: s.rs.skillLevel ?? 3,
        maxLevel: 5,
      }));
      return {
        id: p.id,
        name: `${p.firstName} ${p.lastName}`,
        initials: initials(p.firstName, p.lastName),
        color: avatarColor(p.id),
        role: p.jobTitle ?? "—",
        grade: p.grade ?? "—",
        location: p.location ?? "—",
        languages: p.languages ?? "—",
        skills: pSkills,
        util,
        utilColor: util > 100 ? "text-red-600" : util >= 75 ? "text-emerald-600" : "text-amber-600",
        utilNote: util > 100 ? "Over-allocated" : undefined,
      };
    });

  return { distribution, topDemanded, matrix };
}

export async function getPipelineDemand(tenantId: number, scenario: "expected" | "best" | "worst" = "expected") {
  const { oppRows, people, allocations } = await loadTenantData(tenantId);
  const pipeline = await getPipelineView(tenantId);

  const oppsMap = new Map<number, typeof oppRows>();
  for (const item of oppRows) {
    const list = oppsMap.get(item.opp.id) ?? [];
    list.push(item);
    oppsMap.set(item.opp.id, list);
  }

  let totalValue = 0;
  let weightedDemand = 0;
  let atRisk = 0;
  let probSum = 0;

  const opportunities = pipeline.items.map((o) => {
    const rows = oppsMap.get(o.id) ?? [];
    const weight = probabilityWeight(
      rows[0]?.opp.probability ?? null,
      scenario,
    );
    const value = parseNum(o.totalValue);
    totalValue += value * weight;
    probSum += parseNum(rows[0]?.opp.probability, 50);

    const roles = rows.map((r) => {
      const demand = parseNum(r.row.daysPerWeek, 0) * 4 * weight;
      weightedDemand += demand;
      const roleSupply = people.filter(
        (p) => (p.jobTitle ?? "").toLowerCase().includes((r.row.roleName ?? "").toLowerCase().split(" ")[0]) &&
          (p.status === "active" || p.status === "bench"),
      ).length;
      const atRiskFlag = roleSupply < Math.ceil(demand / 4);
      if (atRiskFlag) atRisk++;
      return {
        role: r.row.roleName ?? "—",
        count: Math.ceil(parseNum(r.row.daysPerWeek, 0)),
        avail: atRiskFlag ? "At risk" : "Capacity OK",
        availVariant: atRiskFlag ? "destructive" as const : "success" as const,
      };
    });

    const tags: Array<{ label: string; variant: "info" | "warning" | "destructive" | "success" }> = [];
    const prob = parseNum(rows[0]?.opp.probability, 50);
    tags.push({ label: `${prob}% probability`, variant: prob >= 70 ? "success" : prob >= 40 ? "warning" : "destructive" });
    if (o.stage) tags.push({ label: o.stage, variant: "info" });

    const oppRowIds = rows.map((r) => r.row.id);
    const oppAllocs = allocations.filter((a) => a.opportunityRowId && oppRowIds.includes(a.opportunityRowId) && a.status === "active");
    const softBookings = oppAllocs.filter((a) => a.allocationType === "pipeline" || a.allocationType === "soft").length;
    const confirmedBookings = oppAllocs.filter((a) => a.allocationType === "confirmed").length;
    if (softBookings > 0) tags.push({ label: "Soft demand active", variant: "info" });
    if (confirmedBookings > 0 && softBookings === 0) tags.push({ label: "Resourcing confirmed", variant: "success" });

    return {
      id: o.id,
      client: o.client,
      project: o.name,
      value: value ? `£${(value / 1000).toFixed(0)}K` : "—",
      tags,
      roles,
      planId: o.planId,
      softBookings,
      confirmedBookings,
    };
  });

  const bySkill: Record<string, number> = {};
  for (const item of oppRows) {
    const w = probabilityWeight(item.opp.probability, scenario);
    const role = item.row.roleName ?? "Unknown";
    bySkill[role] = (bySkill[role] ?? 0) + parseNum(item.row.daysPerWeek, 0) * 4 * w;
  }

  const probabilityModel = Object.entries(bySkill)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([skill, fte], i) => ({
      label: `Weighted ${skill} demand`,
      value: `${fte.toFixed(1)} FTE`,
      severity: i === 0 ? "critical" as const : i === 1 ? "warning" as const : "success" as const,
    }));

  const aiRecommendation = opportunities.find((o) => o.roles.some((r) => r.availVariant === "destructive"));

  return {
    kpis: {
      activeOpportunities: opportunities.length,
      softDemand: Math.round(weightedDemand),
      atRiskOpportunities: atRisk,
      avgProbability: opportunities.length ? Math.round(probSum / opportunities.length) : 0,
      totalPipelineValue: totalValue,
    },
    opportunities,
    probabilityModel,
    aiRecommendation: aiRecommendation
      ? {
          text: `${aiRecommendation.client} opportunity is at risk. Review capacity for required roles before close date.`,
          opportunityId: aiRecommendation.id,
        }
      : null,
  };
}

export async function getRecruitmentForecast(tenantId: number) {
  let recs = await db.select().from(recruitmentRecommendations)
    .where(eq(recruitmentRecommendations.tenantId, tenantId))
    .orderBy(asc(recruitmentRecommendations.targetMonth));

  if (!recs.length) {
    await generateRecruitmentRecommendations(tenantId);
    recs = await db.select().from(recruitmentRecommendations)
      .where(eq(recruitmentRecommendations.tenantId, tenantId))
      .orderBy(asc(recruitmentRecommendations.targetMonth));
  }

  const cards = recs.slice(0, 6).map((r) => ({
    id: r.id,
    month: r.targetMonth ?? "TBD",
    skill: r.skillOrRole,
    type: r.recommendationType === "shortage" ? "shortage" as const : "watch" as const,
    rows: [
      { l: "Headcount needed", v: String(r.headcount), red: r.headcount > 2 },
      { l: "Latest start", v: r.latestStartDate ? new Date(r.latestStartDate).toLocaleDateString("en-GB") : "—", amber: true },
      { l: "Time to hire", v: `${r.timeToHireWeeks ?? 8} weeks`, red: false },
      { l: "Est. cost", v: r.estimatedCost ? `£${parseNum(r.estimatedCost).toLocaleString()}` : "—", red: false },
    ],
    action: r.actionText ?? `Initiate recruitment for ${r.headcount} ${r.skillOrRole}(s)`,
    primary: r.status === "open" ? "Create Requisition" : "View Requisition",
    secondary: "Find Contractor",
    status: r.status,
  }));

  const timeline = recs.map((r) => ({
    id: r.id,
    role: r.skillOrRole,
    grade: r.grade ?? "—",
    headcount: r.headcount,
    tth: `${r.timeToHireWeeks ?? 8}w`,
    start: r.latestStartDate ? new Date(r.latestStartDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "—",
    goLive: r.goLiveDate ? new Date(r.goLiveDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "—",
    cost: r.estimatedCost ? `£${parseNum(r.estimatedCost).toLocaleString()}` : "—",
    status: r.status === "open" ? "Action required" : r.status === "in-progress" ? "In progress" : "Complete",
    statusVariant: r.status === "open" ? "destructive" as const : r.status === "in-progress" ? "warning" as const : "success" as const,
  }));

  const openCount = recs.filter((r) => r.status === "open").length;

  return {
    alert: openCount > 0
      ? { text: `${openCount} recruitment action${openCount > 1 ? "s" : ""} required.`, count: openCount }
      : null,
    cards,
    timeline,
  };
}

export async function generateRecruitmentRecommendations(tenantId: number) {
  const matrix = await getDemandSupplyMatrix(tenantId, { includePipeline: true, months: 6 });
  const now = new Date();

  for (const row of matrix.rows.filter((r) => r.criticalMonths > 0)) {
    const gap = Math.abs(Math.min(...row.cells.map((c) => parseInt(c, 10) || 0)));
    const headcount = Math.max(1, Math.ceil(gap / 4));
    const targetMonth = formatMonth(addMonths(now, 2));
    const latestStart = addMonths(now, 1);
    const goLive = addMonths(now, 3);

    const [existing] = await db.select().from(recruitmentRecommendations).where(and(
      eq(recruitmentRecommendations.tenantId, tenantId),
      eq(recruitmentRecommendations.skillOrRole, row.skill),
      eq(recruitmentRecommendations.status, "open"),
    )).limit(1);

    if (existing) continue;

    await db.insert(recruitmentRecommendations).values({
      tenantId,
      skillOrRole: row.skill,
      grade: "Grade 3–4",
      headcount,
      targetMonth,
      latestStartDate: latestStart,
      goLiveDate: goLive,
      timeToHireWeeks: 8,
      estimatedCost: String(headcount * 65000),
      status: "open",
      priority: row.criticalMonths > 2 ? "high" : "medium",
      recommendationType: "shortage",
      actionText: `Recruit ${headcount} ${row.skill}(s) by ${targetMonth} to cover ${row.criticalMonths}-month shortage`,
    });
  }
}

export async function updateRecruitmentStatus(
  tenantId: number,
  id: number,
  status: string,
  actorUserId: string | null,
) {
  const [row] = await db.update(recruitmentRecommendations).set({ status, updatedAt: new Date() })
    .where(and(eq(recruitmentRecommendations.id, id), eq(recruitmentRecommendations.tenantId, tenantId)))
    .returning();
  if (row) await logRpAudit(tenantId, "recruitment", id, status, actorUserId, {});
  return row ?? null;
}

export async function exportRecruitmentToHr(tenantId: number) {
  const recs = await db.select().from(recruitmentRecommendations)
    .where(and(eq(recruitmentRecommendations.tenantId, tenantId), eq(recruitmentRecommendations.status, "open")));

  const lines = ["Role,Grade,Headcount,Latest Start,Go-Live,Time to Hire,Est Cost,Priority"];
  for (const r of recs) {
    lines.push([
      `"${r.skillOrRole}"`,
      `"${r.grade ?? ""}"`,
      r.headcount,
      r.latestStartDate ? new Date(r.latestStartDate).toISOString().slice(0, 10) : "",
      r.goLiveDate ? new Date(r.goLiveDate).toISOString().slice(0, 10) : "",
      r.timeToHireWeeks ?? 8,
      parseNum(r.estimatedCost),
      r.priority ?? "medium",
    ].join(","));
  }
  return lines.join("\n");
}

export async function getBenchManagement(tenantId: number) {
  const { people, allocations, oppRows, rsRows } = await loadTenantData(tenantId);
  const now = new Date();
  const in30 = new Date(now);
  in30.setDate(in30.getDate() + 30);

  const bench = people.filter((p) => {
    if (p.status !== "active" && p.status !== "bench") return false;
    return computeAllocationPctForResource(p.id, allocations) < 20;
  });

  const rollingOff = people.filter((p) => {
    const ending = allocations.filter(
      (a) => a.resourceId === p.id && a.status === "active" && new Date(a.endDate) >= now && new Date(a.endDate) <= in30,
    );
    return ending.length > 0;
  });

  let benchCost = 0;
  for (const p of bench) {
    benchCost += parseNum(p.costRate, 0) * 20;
  }

  const openDemand = oppRows.filter((r) => r.row.status !== "Confirmed");

  const benchRows = bench.map((p) => {
    const pSkills = rsRows.filter((s) => s.rs.resourceId === p.id).map((s) => s.skill.name).join(", ");
    const sinceDate = p.startDate ? new Date(p.startDate) : now;
    const daysOnBench = Math.max(0, Math.ceil((now.getTime() - sinceDate.getTime()) / MS_DAY));

    const match = openDemand.find((d) =>
      (d.row.roleName ?? "").toLowerCase().includes((p.jobTitle ?? "").toLowerCase().split(" ")[0]) ||
      pSkills.toLowerCase().includes((d.row.roleName ?? "").toLowerCase().split(" ")[0]),
    );

    return {
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      initials: initials(p.firstName, p.lastName),
      color: avatarColor(p.id),
      role: p.jobTitle ?? "—",
      skills: pSkills || "—",
      since: sinceDate.toLocaleDateString("en-GB", { month: "short", day: "numeric" }),
      days: daysOnBench,
      daysColor: daysOnBench < 7 ? "green" as const : daysOnBench <= 14 ? "amber" as const : "red" as const,
      match: match ? `${match.account?.name ?? "Pipeline"} — ${match.row.roleName}` : "No match",
      matchVariant: match ? "success" as const : "warning" as const,
      matchOpportunityId: match?.opp.id ?? null,
      matchRoleName: match?.row.roleName ?? null,
      action: match ? "Assign →" : "Redeploy",
      actionVariant: match ? "default" as const : "warning" as const,
    };
  });

  const redeployable = benchRows.filter((b) => b.matchVariant === "success").length;

  return {
    kpis: {
      onBench: bench.length,
      benchPct: people.length ? Math.round((bench.length / people.length) * 100) : 0,
      rollingOff: rollingOff.length,
      benchCostMonth: Math.round(benchCost),
      redeployable,
    },
    resources: benchRows,
  };
}

async function computeScenarioUtilAndShortfall(tenantId: number, demandFte: number) {
  const stats = await getExtendedResourceStats(tenantId);
  const capacity = Math.max(1, stats.activeResources);
  const allocatedFte = capacity * (stats.utilisationPct / 100);
  const projectedLoad = allocatedFte + demandFte;
  const util = Math.min(100, Math.round((projectedLoad / capacity) * 100));
  const shortfall = Math.round(capacity - projectedLoad);
  return { util, shortfall };
}

export async function getScenarios(tenantId: number) {
  let scenarios = await db.select().from(resourcePlanningScenarios)
    .where(eq(resourcePlanningScenarios.tenantId, tenantId));

  if (!scenarios.length) {
    const pipeline = await getPipelineDemand(tenantId, "expected");
    const best = await getPipelineDemand(tenantId, "best");
    const worst = await getPipelineDemand(tenantId, "worst");

    const [expectedMetrics, bestMetrics, worstMetrics] = await Promise.all([
      computeScenarioUtilAndShortfall(tenantId, pipeline.kpis.softDemand),
      computeScenarioUtilAndShortfall(tenantId, best.kpis.softDemand),
      computeScenarioUtilAndShortfall(tenantId, worst.kpis.softDemand),
    ]);

    const defaults = [
      { name: "Expected Case", scenarioType: "expected", multiplier: "1.0", revenue: pipeline.kpis.totalPipelineValue, demand: pipeline.kpis.softDemand, util: expectedMetrics.util, shortfall: expectedMetrics.shortfall },
      { name: "Best Case", scenarioType: "best", multiplier: "1.4", revenue: best.kpis.totalPipelineValue, demand: best.kpis.softDemand, util: bestMetrics.util, shortfall: bestMetrics.shortfall },
      { name: "Worst Case", scenarioType: "worst", multiplier: "0.6", revenue: worst.kpis.totalPipelineValue, demand: worst.kpis.softDemand, util: worstMetrics.util, shortfall: worstMetrics.shortfall },
    ];

    for (const d of defaults) {
      await db.insert(resourcePlanningScenarios).values({
        tenantId,
        name: d.name,
        scenarioType: d.scenarioType,
        probabilityMultiplier: d.multiplier,
        revenueForecast: String(Math.round(d.revenue)),
        demandFte: String(d.demand),
        utilisationForecast: d.util,
        shortfallFte: String(d.shortfall),
        isDefault: d.scenarioType === "expected",
        actions: [],
      });
    }
    scenarios = await db.select().from(resourcePlanningScenarios)
      .where(eq(resourcePlanningScenarios.tenantId, tenantId));
  }

  const topSkill = await getTopSkillGapName(tenantId);
  const comparison = [
    { metric: "Pipeline revenue", worst: fmtMoney(scenarios.find((s) => s.scenarioType === "worst")), expected: fmtMoney(scenarios.find((s) => s.scenarioType === "expected")), best: fmtMoney(scenarios.find((s) => s.scenarioType === "best")) },
    { metric: "Resource demand", worst: fmtFte(scenarios.find((s) => s.scenarioType === "worst")), expected: fmtFte(scenarios.find((s) => s.scenarioType === "expected")), best: fmtFte(scenarios.find((s) => s.scenarioType === "best")) },
    { metric: "Utilisation", worst: fmtPct(scenarios.find((s) => s.scenarioType === "worst")), expected: fmtPct(scenarios.find((s) => s.scenarioType === "expected")), best: fmtPct(scenarios.find((s) => s.scenarioType === "best")) },
    { metric: "Bench size", worst: await benchSizeForScenario(tenantId, "worst"), expected: await benchSizeForScenario(tenantId, "expected"), best: await benchSizeForScenario(tenantId, "best") },
    { metric: `${topSkill} shortage`, worst: await skillShortageForScenario(tenantId, topSkill, "worst"), expected: await skillShortageForScenario(tenantId, topSkill, "expected"), best: await skillShortageForScenario(tenantId, topSkill, "best") },
    { metric: "Recruitment needed", worst: await recruitmentNeededForScenario(tenantId, "worst"), expected: await recruitmentNeededForScenario(tenantId, "expected"), best: await recruitmentNeededForScenario(tenantId, "best") },
    { metric: "Shortfall", worst: fmtShortfall(scenarios.find((s) => s.scenarioType === "worst")), expected: fmtShortfall(scenarios.find((s) => s.scenarioType === "expected")), best: fmtShortfall(scenarios.find((s) => s.scenarioType === "best")) },
  ];

  return {
    scenarios: await Promise.all(scenarios.map(async (s) => ({
      id: s.id,
      name: s.name,
      type: s.scenarioType,
      revenue: fmtMoney(s),
      demand: fmtFte(s),
      util: fmtPct(s),
      shortfall: fmtShortfall(s),
      actions: (Array.isArray(s.actions) && (s.actions as unknown[]).length)
        ? (s.actions as Array<{ title: string; detail: string; severity: string }>)
        : await buildDefaultActions(tenantId, s.scenarioType ?? "expected"),
    }))),
    comparison,
  };
}

function fmtMoney(s?: { revenueForecast?: string | null }): string {
  const v = parseNum(s?.revenueForecast);
  return v ? `£${(v / 1_000_000).toFixed(1)}M` : "—";
}
function fmtFte(s?: { demandFte?: string | null }): string {
  return s?.demandFte ? `${parseNum(s.demandFte)} FTE` : "—";
}
function fmtPct(s?: { utilisationForecast?: number | null }): string {
  return s?.utilisationForecast != null ? `${s.utilisationForecast}%` : "—";
}
function fmtShortfall(s?: { shortfallFte?: string | null }): string {
  const v = parseNum(s?.shortfallFte);
  return v === 0 ? "0 FTE" : `${v} FTE`;
}

async function buildDefaultActions(tenantId: number, type: string) {
  const topSkill = await getTopSkillGapName(tenantId);
  const matrix = await getDemandSupplyMatrix(tenantId, { includePipeline: true, months: 6 });
  const row = matrix.rows.find((r) => r.skill === topSkill);
  const gapMonths = row ? row.cells.filter((c) => c.startsWith("-")).length : 0;
  const recs = await db.select().from(recruitmentRecommendations).where(eq(recruitmentRecommendations.tenantId, tenantId));
  const openRoles = recs.filter((r) => r.status === "open").reduce((s, r) => s + r.headcount, 0);
  const bench = await getBenchManagement(tenantId);

  if (type === "best") return [
    { title: `Accelerate ${topSkill} recruitment`, detail: `Hire ${Math.max(1, Math.round(openRoles * 0.5))} specialists to capture upside`, severity: "critical" },
    { title: "Secure contractor bench", detail: `Pre-approve contractors for ${topSkill} surge capacity`, severity: "warning" },
  ];
  if (type === "worst") return [
    { title: "Reduce bench cost", detail: `Redeploy ${Math.max(1, Math.round(bench.kpis.onBench * 0.4))} bench resources to internal projects`, severity: "info" },
    { title: "Pause non-critical hiring", detail: `Defer ${Math.max(1, Math.round(openRoles * 0.3))} open requisitions until pipeline firms up`, severity: "success" },
  ];
  return [
    { title: `Address ${topSkill} shortage`, detail: gapMonths > 0 ? `${gapMonths} month(s) of shortage forecast — initiate hiring now` : "Monitor demand-supply matrix for emerging gaps", severity: "critical" },
    { title: "Backfill rolling-off resources", detail: "Assign pipeline matches before allocations end", severity: "warning" },
    { title: "Optimise bench utilisation", detail: `${bench.kpis.redeployable ?? bench.kpis.onBench} redeployable bench resources matched to open demand`, severity: "success" },
  ];
}

export async function createScenario(
  tenantId: number,
  data: { name: string; scenarioType?: string; assumptions?: Record<string, unknown> },
  actorUserId: string | null,
) {
  const pipeline = await getPipelineDemand(tenantId, (data.scenarioType as "expected" | "best" | "worst") ?? "expected");
  const { util, shortfall } = await computeScenarioUtilAndShortfall(tenantId, pipeline.kpis.softDemand);
  const [row] = await db.insert(resourcePlanningScenarios).values({
    tenantId,
    name: data.name,
    scenarioType: data.scenarioType ?? "custom",
    revenueForecast: String(Math.round(pipeline.kpis.totalPipelineValue)),
    demandFte: String(pipeline.kpis.softDemand),
    utilisationForecast: util,
    shortfallFte: String(shortfall),
    assumptions: data.assumptions,
    createdById: actorUserId ?? undefined,
  }).returning();
  await logRpAudit(tenantId, "scenario", row.id, "create", actorUserId, data);
  return row;
}

export async function queryAiWorkforcePlanner(tenantId: number, query: string) {
  const dashboard = await getExecutiveDashboard(tenantId);
  const bench = await getBenchManagement(tenantId);
  const pipeline = await getPipelineDemand(tenantId);

  const context = JSON.stringify({
    resources: dashboard.meta.resourceCount,
    utilisation: dashboard.kpis[1]?.value,
    bench: bench.kpis.onBench,
    pipelineOpps: pipeline.kpis.activeOpportunities,
    shortages: dashboard.skillsGaps,
    atRisk: dashboard.atRiskResources?.length ?? 0,
  });

  const { getOpenAIConfig, isOpenAIConfigured } = await import("../lib/openai");
  if (!isOpenAIConfigured()) {
    return {
      reply: `Based on live data (${dashboard.meta.resourceCount} resources, ${pipeline.kpis.activeOpportunities} pipeline opportunities):\n\n` +
        `• Utilisation is ${dashboard.kpis[1]?.value} (target ${UTILISATION_TARGET_PCT}%)\n` +
        `• ${bench.kpis.onBench} resources on bench (${bench.kpis.redeployable} redeployable)\n` +
        `• ${dashboard.skillsGaps.length} critical skills gaps identified\n\n` +
        `Regarding "${query}": Review the Demand vs Supply matrix and Recruitment Forecast tabs for actionable next steps.`,
      insights: [
        { type: "urgent", text: dashboard.alert?.text ?? "No critical alerts" },
        { type: "positive", text: `${bench.kpis.redeployable} bench resources match open pipeline demand` },
        { type: "risk", text: `${dashboard.atRiskResources?.length ?? 0} resources rolling off within 30 days` },
      ],
      configured: false,
    };
  }

  const OpenAI = (await import("openai")).default;
  const { apiKey, baseURL } = getOpenAIConfig();
  const openai = new OpenAI({ apiKey, baseURL });

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are Jiganto AI Workforce Planner. Answer using this live workforce data: ${context}. Be concise, actionable, and reference specific numbers.`,
      },
      { role: "user", content: query },
    ],
  });

  const reply = completion.choices[0]?.message?.content ?? "I could not generate a response.";

  return {
    reply,
    insights: [
      { type: "urgent", text: dashboard.skillsGaps[0]?.action ?? "Review skills gaps" },
      { type: "positive", text: `Utilisation trend: ${dashboard.utilisation.trend.slice(-3).join("%, ")}%` },
      { type: "opportunity", text: `${bench.kpis.redeployable} bench resources ready for pipeline assignment` },
      { type: "risk", text: `${dashboard.atRiskResources?.length ?? 0} resources at roll-off risk` },
    ],
    configured: true,
  };
}

export async function getCellDetail(tenantId: number, skill: string, monthIndex: number, includePipeline: boolean) {
  const matrix = await getDemandSupplyMatrix(tenantId, { includePipeline, months: monthIndex + 2 });
  const row = matrix.rows.find((r) => r.skill.toLowerCase() === skill.toLowerCase());
  if (!row) return null;
  const cell = row.cells[monthIndex];
  const type = row.cellTypes[monthIndex];
  return {
    skill: row.skill,
    month: matrix.months[monthIndex],
    cell,
    type,
    supply: row.supply,
    detail: type === "shortage"
      ? `Shortage of ${Math.abs(parseInt(cell, 10) || 0)} FTE in ${matrix.months[monthIndex]}. Consider recruitment or contractor engagement.`
      : type === "surplus"
        ? `Surplus capacity of ${cell} available for pipeline or bench reduction.`
        : "Capacity is balanced for this period.",
  };
}

async function benchSizeForScenario(tenantId: number, scenario: "expected" | "best" | "worst") {
  const bench = await getBenchManagement(tenantId);
  const mult = scenario === "best" ? 0.7 : scenario === "worst" ? 1.3 : 1;
  return `${Math.round(bench.kpis.onBench * mult)}`;
}

async function skillShortageForScenario(tenantId: number, skill: string, scenario: "expected" | "best" | "worst") {
  const matrix = await getDemandSupplyMatrix(tenantId, { includePipeline: true, months: 6 });
  const row = matrix.rows.find((r) => r.skill.toLowerCase().includes(skill.toLowerCase()));
  if (!row) return "0 FTE";
  const shortages = row.cells.filter((c) => c.startsWith("-")).length;
  const mult = scenario === "best" ? 1.4 : scenario === "worst" ? 0.6 : 1;
  return `${Math.round(shortages * mult)} mo`;
}

async function getTopSkillGapName(tenantId: number): Promise<string> {
  const matrix = await getDemandSupplyMatrix(tenantId, { includePipeline: true, months: 6 });
  let topSkill = "Skills";
  let topShortages = 0;
  for (const row of matrix.rows) {
    const shortages = row.cells.filter((c) => c.startsWith("-")).length;
    if (shortages > topShortages) {
      topShortages = shortages;
      topSkill = row.skill;
    }
  }
  return topSkill;
}

async function recruitmentNeededForScenario(tenantId: number, scenario: "expected" | "best" | "worst") {
  const recs = await db.select().from(recruitmentRecommendations).where(eq(recruitmentRecommendations.tenantId, tenantId));
  const open = recs.filter((r) => r.status === "open").reduce((s, r) => s + r.headcount, 0);
  const mult = scenario === "best" ? 1.5 : scenario === "worst" ? 0.5 : 1;
  return `${Math.round(open * mult)} roles`;
}

export async function exportDemandSupplyCsv(tenantId: number, includePipeline: boolean) {
  const matrix = await getDemandSupplyMatrix(tenantId, { includePipeline, months: 10 });
  const lines = [`Skill/Role,Supply,${matrix.months.join(",")}`];
  for (const row of matrix.rows) {
    lines.push([`"${row.skill}"`, row.supply, ...row.cells].join(","));
  }
  return lines.join("\n");
}

export async function assignBenchResource(
  tenantId: number,
  resourceId: number,
  data: { projectName: string; role?: string; opportunityId?: number; startDate?: string; endDate?: string },
  actorUserId: string | null,
) {
  const start = data.startDate ?? new Date().toISOString().slice(0, 10);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 84);
  const end = data.endDate ?? endDate.toISOString().slice(0, 10);
  return createBooking(tenantId, {
    resourceId,
    projectName: data.projectName,
    role: data.role,
    startDate: start,
    endDate: end,
    daysPerWeek: 4,
    allocationType: data.opportunityId ? "pipeline" : "confirmed",
  }, actorUserId);
}

export async function getDailyAiInsights(tenantId: number, persona = "res-mgr") {
  const dashboard = await getExecutiveDashboard(tenantId);
  const bench = await getBenchManagement(tenantId);
  const recruit = await getRecruitmentForecast(tenantId);

  const insights = [
    {
      type: "urgent",
      text: dashboard.alert?.text ?? dashboard.skillsGaps[0]?.action ?? "Review skills gaps in Demand vs Supply",
      linkTab: "recruit",
      color: "red",
    },
    {
      type: "positive",
      text: `Utilisation at ${dashboard.utilisation.current}% — ${dashboard.utilisation.current >= dashboard.utilisation.target ? "on target" : "below target"}`,
      linkTab: "exec",
      color: "green",
    },
    {
      type: "opportunity",
      text: `${bench.kpis.redeployable} bench resources matched to open pipeline demand`,
      linkTab: "bench",
      color: "blue",
    },
    {
      type: "risk",
      text: `${dashboard.atRiskResources?.length ?? 0} resources rolling off within 30 days without confirmed bookings`,
      linkTab: "scheduler",
      color: "red",
    },
  ];

  if (persona === "exec" || persona === "exec-board") {
    return insights.filter((i) => i.type === "urgent" || i.type === "positive" || i.type === "risk");
  }
  if (persona === "hr") {
    return [
      insights[0],
      { type: "urgent", text: recruit.alert?.text ?? "Review recruitment forecast", linkTab: "recruit", color: "red" },
      insights[2],
      insights[3],
    ];
  }
  if (persona === "sales") {
    return [
      { type: "risk", text: `${dashboard.meta.opportunityCount} active pipeline opportunities — check capacity before committing`, linkTab: "pipeline", color: "red" },
      insights[2],
      insights[1],
      insights[0],
    ];
  }
  return insights;
}

export const AI_QUICK_QUERIES = {
  "Find resources": [
    "Show me all SAP consultants available in Q3",
    "Who has Azure skills available next month?",
    "Find senior BAs with public sector experience",
  ],
  "Risk analysis": [
    "Which opportunities are at risk due to capacity?",
    "What resources are rolling off in the next 30 days?",
    "Show over-allocated resources",
  ],
  Recruitment: [
    "What skills should we recruit over the next 6 months?",
    "When should we start hiring SAP consultants?",
    "What is the estimated cost of current recruitment needs?",
  ],
  Utilisation: [
    "Optimise utilisation above 80%",
    "Who is on the bench and why?",
    "Show utilisation by practice area",
  ],
  Scenarios: [
    "Model best case scenario for Q4",
    "What happens if we win all pipeline opportunities?",
    "Compare expected vs worst case headcount",
  ],
} as const;

export async function syncPipelineFromCrm(tenantId: number, actorUserId: string | null) {
  const { oppRows, people } = await loadTenantData(tenantId);
  let synced = 0;
  for (const item of oppRows) {
    if (item.row.status === "Confirmed" || item.row.resourceId) continue;
    const candidates = people.filter((p) =>
      (p.jobTitle ?? "").toLowerCase().includes((item.row.roleName ?? "").toLowerCase().split(" ")[0]),
    );
    if (!candidates[0]) continue;
    const [existing] = await db.select().from(resourceAllocations).where(and(
      eq(resourceAllocations.tenantId, tenantId),
      eq(resourceAllocations.resourceId, candidates[0].id),
      eq(resourceAllocations.opportunityRowId, item.row.id),
    )).limit(1);
    if (existing) continue;
    await db.insert(resourceAllocations).values({
      tenantId,
      resourceId: candidates[0].id,
      projectName: `${item.account?.name ?? "Pipeline"} — ${item.opp.name}`,
      role: item.row.roleName,
      allocationType: "pipeline",
      opportunityRowId: item.row.id,
      daysPerWeek: String(parseNum(item.row.daysPerWeek, 3)),
      startDate: item.row.startDate ? new Date(item.row.startDate) : new Date(),
      endDate: item.row.endDate ? new Date(item.row.endDate) : new Date(Date.now() + 90 * MS_DAY),
      status: "active",
    });
    synced++;
  }
  await logRpAudit(tenantId, "pipeline", null, "sync", actorUserId, { synced });
  return { synced, message: `Synced ${synced} soft bookings from CRM pipeline` };
}
