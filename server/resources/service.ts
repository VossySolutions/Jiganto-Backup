import {
  and,
  asc,
  desc,
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
  timesheetEntries,
  timesheetPeriods,
  timesheetIntegrations,
  timesheetIntegrationLog,
  timesheetAuditLog,
  documentResourceLinks,
  documents,
  type Resource,
  type ResourceAllocation,
  UTILISATION_TARGET_PCT,
} from "@shared/schema";

const MS_DAY = 86400000;

function parseNum(v: string | number | null | undefined, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function workingDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  while (d <= end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function weeksOverlap(startA: Date, endA: Date, startB: Date, endB: Date): number {
  const start = Math.max(startA.getTime(), startB.getTime());
  const end = Math.min(endA.getTime(), endB.getTime());
  if (end < start) return 0;
  return Math.ceil((end - start + MS_DAY) / (7 * MS_DAY));
}

export function resourceWeeklyCapacityHours(r: Resource): number {
  const daily = parseNum(r.dailyHours, 8);
  const days = parseNum(r.workingDaysPerWeek, 5);
  const weekly = parseNum(r.weeklyCapacityHours, 0);
  if (weekly > 0) return weekly * parseNum(r.fte, 1);
  return daily * days * parseNum(r.fte, 1);
}

export function computeAllocationPctForResource(
  resourceId: number,
  allocations: ResourceAllocation[],
  at: Date = new Date(),
): number {
  const windowEnd = new Date(at);
  windowEnd.setDate(windowEnd.getDate() + 28);
  let pct = 0;
  for (const a of allocations) {
    if (a.resourceId !== resourceId || a.status !== "active") continue;
    const start = new Date(a.startDate);
    const end = new Date(a.endDate);
    if (end < at || start > windowEnd) continue;
    if (a.daysPerWeek != null) {
      pct += (parseNum(a.daysPerWeek) / 5) * 100;
    } else {
      pct += parseNum(a.allocationPercentage, 100);
    }
  }
  return pct;
}

export async function getExtendedResourceStats(tenantId: number, resourceIds?: number[]) {
  const [people, allocations, periods, entries, oppRows, stages] = await Promise.all([
    db.select().from(resources).where(eq(resources.tenantId, tenantId)),
    db.select().from(resourceAllocations).where(eq(resourceAllocations.tenantId, tenantId)),
    db.select().from(timesheetPeriods).where(eq(timesheetPeriods.tenantId, tenantId)),
    db.select().from(timesheetEntries).innerJoin(timesheetPeriods, eq(timesheetEntries.timesheetPeriodId, timesheetPeriods.id))
      .where(and(eq(timesheetPeriods.tenantId, tenantId), eq(timesheetPeriods.approvalStatus, "fully_approved"))),
    db.select().from(opportunityResourceRows)
      .innerJoin(opportunityResourcePlans, eq(opportunityResourceRows.planId, opportunityResourcePlans.id))
      .innerJoin(crmOpportunities, eq(opportunityResourcePlans.opportunityId, crmOpportunities.id))
      .where(eq(crmOpportunities.tenantId, tenantId)),
    db.select().from(crmOpportunityStages).where(eq(crmOpportunityStages.tenantId, tenantId)),
  ]);

  const scopedPeople = resourceIds?.length
    ? people.filter((p) => resourceIds.includes(p.id))
    : people;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const activePeople = scopedPeople.filter((p) => p.status === "active" || p.status === "available");
  const contractors = activePeople.filter((p) => p.personType === "contractor");
  const employees = activePeople.filter((p) => p.personType === "employee" || !p.personType);

  const utilByResource: Record<number, number> = {};
  let totalCapacityHrs = 0;
  let totalBillableHrs = 0;

  for (const p of activePeople) {
    const cap = resourceWeeklyCapacityHours(p);
    const workingDays = workingDaysBetween(monthStart, monthEnd);
    const capacityHrs = (cap / 5) * workingDays;
    totalCapacityHrs += capacityHrs;

    const approvedHrs = entries
      .filter((e) => e.timesheet_entries.resourceId === p.id)
      .filter((e) => {
        const d = e.timesheet_entries.entryDate ? new Date(e.timesheet_entries.entryDate) : null;
        return !d || (d >= monthStart && d <= monthEnd);
      })
      .reduce((s, e) => s + parseNum(e.timesheet_entries.hours), 0);

    const billable = entries
      .filter((e) => e.timesheet_entries.resourceId === p.id && (e.timesheet_entries.activityType === "billable" || !e.timesheet_entries.activityType))
      .reduce((s, e) => s + parseNum(e.timesheet_entries.hours), 0);

    totalBillableHrs += billable;
    utilByResource[p.id] = capacityHrs > 0 ? Math.round((approvedHrs / capacityHrs) * 100) : computeAllocationPctForResource(p.id, allocations);
  }

  const utilisationPct = totalCapacityHrs > 0 ? Math.round((totalBillableHrs / totalCapacityHrs) * 100) : 0;

  const benchCount = activePeople.filter((p) => {
    const alloc = computeAllocationPctForResource(p.id, allocations);
    return alloc <= 0;
  }).length;

  const overAllocated = activePeople.filter((p) => computeAllocationPctForResource(p.id, allocations) > 100).length;

  const pendingApprovals = periods.filter((p) =>
    p.status === "submitted" && p.approvalStatus !== "fully_approved",
  ).length;

  const proposalStageIds = new Set(
    stages.filter((s) => /proposal|negotiation/i.test(s.name)).map((s) => s.id),
  );

  const in90 = new Date(now);
  in90.setDate(in90.getDate() + 90);

  let pipelineDemandDays = 0;
  for (const row of oppRows) {
    const opp = row.crm_opportunities;
    const planRow = row.opportunity_resource_rows;
    if (proposalStageIds.size && opp.stageId && !proposalStageIds.has(opp.stageId)) continue;
    const close = opp.expectedCloseDate ? new Date(opp.expectedCloseDate) : in90;
    if (close > in90) continue;
    const start = planRow.startDate ? new Date(planRow.startDate) : now;
    const end = planRow.endDate ? new Date(planRow.endDate) : close;
    const weeks = weeksOverlap(start, end, now, in90);
    pipelineDemandDays += parseNum(planRow.daysPerWeek, 0) * weeks;
  }

  let availableCapacityDays = 0;
  for (const p of activePeople) {
    const daysPerWeek = parseNum(p.workingDaysPerWeek, 5) * parseNum(p.fte, 1);
    const allocDays = allocations
      .filter((a) => a.resourceId === p.id && a.status === "active")
      .reduce((s, a) => s + parseNum(a.daysPerWeek, parseNum(a.allocationPercentage, 0) / 20), 0);
    availableCapacityDays += Math.max(0, daysPerWeek * 13 - allocDays);
  }

  const forecastSurplusDeficit = Math.round(availableCapacityDays - pipelineDemandDays);

  const monthlyUtils: number[] = [];
  for (let m = 0; m < 3; m++) {
    const ms = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const me = new Date(now.getFullYear(), now.getMonth() - m + 1, 0);
    let cap = 0;
    let bill = 0;
    for (const p of activePeople) {
      const wh = resourceWeeklyCapacityHours(p);
      const wd = workingDaysBetween(ms, me);
      cap += (wh / 5) * wd;
    }
    for (const e of entries) {
      const entry = e.timesheet_entries;
      const d = entry.entryDate ? new Date(entry.entryDate) : null;
      if (d && d >= ms && d <= me && (entry.activityType === "billable" || !entry.activityType)) {
        bill += parseNum(entry.hours);
      }
    }
    monthlyUtils.push(cap > 0 ? Math.round((bill / cap) * 100) : 0);
  }
  const avgUtilisation3m = monthlyUtils.length
    ? Math.round(monthlyUtils.reduce((a, b) => a + b, 0) / monthlyUtils.length)
    : 0;

  const contractorRatio = activePeople.length
    ? Math.round((contractors.length / activePeople.length) * 100)
    : 0;

  return {
    utilisationPct,
    utilisationTarget: UTILISATION_TARGET_PCT,
    utilisationColor: utilisationPct >= UTILISATION_TARGET_PCT ? "green" : utilisationPct >= UTILISATION_TARGET_PCT - 10 ? "amber" : "red",
    onBench: benchCount,
    overAllocated,
    activeResources: activePeople.length,
    permanentCount: employees.length,
    contractorCount: contractors.length,
    unapprovedTimesheets: pendingApprovals,
    forecastDemand90d: Math.round(pipelineDemandDays),
    availableCapacity90d: Math.round(availableCapacityDays),
    forecastSurplusDeficit,
    avgUtilisation3m,
    contractorRatio,
    totalResources: scopedPeople.length,
    availableResources: activePeople.length,
    avgUtilization: utilisationPct,
    pendingTimesheetApprovals: pendingApprovals,
    activeAllocations: allocations.filter((a) => a.status === "active").length,
    utilByResource,
  };
}

export async function getPersonalResourceDashboard(tenantId: number, resourceId: number) {
  const full = await getExtendedResourceStats(tenantId, [resourceId]);
  const util = full.utilByResource?.[resourceId] ?? 0;
  const trend = await getResourceUtilisationTrend(tenantId, resourceId, 12);
  const avgUtilisation3m = trend.length >= 3
    ? Math.round(trend.slice(-3).reduce((s, t) => s + t.utilisation, 0) / 3)
    : util;
  return {
    linked: true,
    stats: {
      utilisationPct: util,
      onBench: util <= 5 ? 1 : 0,
      overAllocated: util > 100 ? 1 : 0,
      activeResources: 1,
      utilByResource: { [resourceId]: util },
      pendingTimesheetApprovals: 0,
      benchCount: util <= 5 ? 1 : 0,
      contractorRatio: full.contractorRatio ?? 0,
      forecastSurplusDeficit: 0,
      avgUtilisation3m,
    },
    trend,
    capacityDemand: [],
    skillsHeatmap: { roles: [], weekLabels: [], matrix: {} },
  };
}

export async function getResourceUtilisationTrend(tenantId: number, resourceId: number, months = 12) {
  const [person] = await db.select().from(resources).where(and(eq(resources.tenantId, tenantId), eq(resources.id, resourceId))).limit(1);
  if (!person) return [];
  const now = new Date();
  const result: { month: string; utilisation: number }[] = [];

  // Fetch periods and entries once to avoid N+1 inside loop
  const allPeriods = await db.select({ id: timesheetPeriods.id }).from(timesheetPeriods)
    .where(and(eq(timesheetPeriods.tenantId, tenantId), eq(timesheetPeriods.approvalStatus, "fully_approved")));
  const allPeriodIds = allPeriods.map((p) => p.id);
  const allEntries = allPeriodIds.length
    ? await db.select().from(timesheetEntries)
      .where(and(inArray(timesheetEntries.timesheetPeriodId, allPeriodIds), eq(timesheetEntries.resourceId, resourceId)))
    : [];

  for (let i = months - 1; i >= 0; i--) {
    const ms = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const me = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const label = ms.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
    const capacity = (resourceWeeklyCapacityHours(person) / 5) * workingDaysBetween(ms, me);

    let billable = 0;
    for (const e of allEntries) {
      if (e.activityType && e.activityType !== "billable") continue;
      const d = e.entryDate ? new Date(e.entryDate) : null;
      if (!d || (d >= ms && d <= me)) billable += parseNum(e.hours);
    }
    result.push({ month: label, utilisation: capacity > 0 ? Math.round((billable / capacity) * 100) : 0 });
  }
  return result;
}

export async function getUtilisationTrend(tenantId: number, months = 12, resourceIds?: number[]) {
  let people = await db.select().from(resources).where(eq(resources.tenantId, tenantId));
  if (resourceIds?.length) {
    const allowed = new Set(resourceIds);
    people = people.filter((p) => allowed.has(p.id));
  }
  const active = people.filter((p) => p.status === "active" || p.status === "available");
  const scopedResourceIds = resourceIds?.length ? new Set(resourceIds) : null;
  const now = new Date();
  const result: { month: string; utilisation: number }[] = [];

  // Fetch all approved periods once to avoid N+1
  const allPeriods = await db.select().from(timesheetPeriods)
    .where(and(eq(timesheetPeriods.tenantId, tenantId), eq(timesheetPeriods.approvalStatus, "fully_approved")));
  const allPeriodIds = allPeriods.map((p) => p.id);
  const allEntries = allPeriodIds.length
    ? await db.select().from(timesheetEntries).where(inArray(timesheetEntries.timesheetPeriodId, allPeriodIds))
    : [];

  for (let i = months - 1; i >= 0; i--) {
    const ms = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const me = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const label = ms.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });

    let billable = 0;
    let capacity = 0;

    for (const p of active) {
      capacity += (resourceWeeklyCapacityHours(p) / 5) * workingDaysBetween(ms, me);
    }

    for (const e of allEntries) {
      if (scopedResourceIds && !scopedResourceIds.has(e.resourceId)) continue;
      if (e.activityType && e.activityType !== "billable") continue;
      const d = e.entryDate ? new Date(e.entryDate) : null;
      if (!d || (d >= ms && d <= me)) billable += parseNum(e.hours);
    }

    result.push({ month: label, utilisation: capacity > 0 ? Math.round((billable / capacity) * 100) : 0 });
  }
  return result;
}

export async function getCapacityVsDemand(tenantId: number, weeks = 8) {
  const [people, allocations, oppRows] = await Promise.all([
    db.select().from(resources).where(eq(resources.tenantId, tenantId)),
    db.select().from(resourceAllocations).where(eq(resourceAllocations.tenantId, tenantId)),
    db.select({
      row: opportunityResourceRows,
      opp: crmOpportunities,
    })
      .from(opportunityResourceRows)
      .innerJoin(opportunityResourcePlans, eq(opportunityResourceRows.planId, opportunityResourcePlans.id))
      .innerJoin(crmOpportunities, eq(opportunityResourcePlans.opportunityId, crmOpportunities.id))
      .where(eq(crmOpportunities.tenantId, tenantId)),
  ]);

  const active = people.filter((p) => p.status === "active" || p.status === "available");
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  const result: { week: string; available: number; allocated: number; pipeline: number }[] = [];

  for (let w = 0; w < weeks; w++) {
    const ws = new Date(monday);
    ws.setDate(ws.getDate() + w * 7);
    const we = new Date(ws);
    we.setDate(we.getDate() + 6);

    let capacity = 0;
    let allocated = 0;
    let pipeline = 0;

    for (const p of active) {
      capacity += parseNum(p.workingDaysPerWeek, 5) * parseNum(p.fte, 1);
      for (const a of allocations) {
        if (a.resourceId !== p.id || a.status !== "active") continue;
        const start = new Date(a.startDate);
        const end = new Date(a.endDate);
        if (ws <= end && we >= start) {
          allocated += parseNum(a.daysPerWeek, parseNum(a.allocationPercentage, 0) / 20);
        }
      }
    }

    for (const item of oppRows) {
      const row = item.row;
      if (!row.startDate || !row.endDate) continue;
      const start = new Date(row.startDate);
      const end = new Date(row.endDate);
      if (ws <= end && we >= start && row.status !== "Confirmed") {
        pipeline += parseNum(row.daysPerWeek, 0);
      }
    }

    result.push({
      week: `W${w + 1}`,
      available: Math.round(capacity - allocated),
      allocated: Math.round(allocated),
      pipeline: Math.round(pipeline),
    });
  }
  return result;
}

export async function getSkillsDemandHeatmap(tenantId: number, weeks = 8) {
  const skillList = await db.select().from(skills).where(eq(skills.tenantId, tenantId));
  const rows = await db.select({
    roleName: opportunityResourceRows.roleName,
    daysPerWeek: opportunityResourceRows.daysPerWeek,
    startDate: opportunityResourceRows.startDate,
    endDate: opportunityResourceRows.endDate,
  })
    .from(opportunityResourceRows)
    .innerJoin(opportunityResourcePlans, eq(opportunityResourceRows.planId, opportunityResourcePlans.id))
    .innerJoin(crmOpportunities, eq(opportunityResourcePlans.opportunityId, crmOpportunities.id))
    .where(eq(crmOpportunities.tenantId, tenantId));

  const now = new Date();
  const monday = new Date(now);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  const weekLabels = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i * 7);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  });

  const roleNames = Array.from(new Set(rows.map((r) => r.roleName).filter(Boolean)));
  const matrix: Record<string, number[]> = {};

  for (const role of roleNames) {
    matrix[role] = Array(weeks).fill(0);
    for (const r of rows.filter((x) => x.roleName === role)) {
      if (!r.startDate || !r.endDate) continue;
      const start = new Date(r.startDate);
      const end = new Date(r.endDate);
      for (let w = 0; w < weeks; w++) {
        const ws = new Date(monday);
        ws.setDate(ws.getDate() + w * 7);
        const we = new Date(ws);
        we.setDate(we.getDate() + 6);
        if (ws <= end && we >= start) {
          matrix[role][w] += parseNum(r.daysPerWeek, 0);
        }
      }
    }
  }

  return { skills: skillList.map((s) => s.name), roles: roleNames, weekLabels, matrix };
}

export async function searchResourcesBySkills(
  tenantId: number,
  criteria: Array<{ skillId: number; minLevel?: number; minYears?: number }>,
  logic: "and" | "or" = "and",
  filters?: { availableFrom?: string; location?: string },
) {
  const people = await db.select().from(resources).where(eq(resources.tenantId, tenantId));
  const allSkills = await db.select().from(resourceSkills)
    .innerJoin(skills, eq(resourceSkills.skillId, skills.id))
    .where(eq(skills.tenantId, tenantId));

  const allocations = await db.select().from(resourceAllocations).where(eq(resourceAllocations.tenantId, tenantId));

  const matches = people.filter((p) => {
    if (p.status === "inactive") return false;
    if (filters?.location && p.location && !p.location.toLowerCase().includes(filters.location.toLowerCase())) return false;

    const pSkills = allSkills.filter((s) => s.resource_skills.resourceId === p.id);

    const check = (c: { skillId: number; minLevel?: number; minYears?: number }) => {
      const match = pSkills.find((s) => s.resource_skills.skillId === c.skillId);
      if (!match) return false;
      const level = match.resource_skills.skillLevel ?? 3;
      const years = parseNum(match.resource_skills.yearsExperience);
      if (c.minLevel && level < c.minLevel) return false;
      if (c.minYears && years < c.minYears) return false;
      return true;
    };

    if (criteria.length === 0) return true;
    return logic === "and" ? criteria.every(check) : criteria.some(check);
  });

  return matches.map((p) => {
    const util = computeAllocationPctForResource(p.id, allocations);
    const pSkills = allSkills.filter((s) => s.resource_skills.resourceId === p.id);
    return {
      ...p,
      utilisationPct: util,
      matchingSkills: pSkills.map((s) => ({
        name: s.skills.name,
        level: s.resource_skills.skillLevel,
        proficiency: s.resource_skills.proficiencyLevel,
        years: s.resource_skills.yearsExperience,
      })),
      availableFrom: util >= 100 ? null : new Date().toISOString().slice(0, 10),
    };
  });
}

export async function runSkillsGapAnalysis(tenantId: number, planId: number) {
  const planRows = await db.select().from(opportunityResourceRows)
    .where(eq(opportunityResourceRows.planId, planId));

  const people = await db.select().from(resources).where(eq(resources.tenantId, tenantId));
  const allSkills = await db.select().from(resourceSkills)
    .innerJoin(skills, eq(resourceSkills.skillId, skills.id))
    .where(eq(skills.tenantId, tenantId));

  return planRows.map((row) => {
    const role = row.roleName;
    const candidates = people.filter((p) =>
      (p.jobTitle || "").toLowerCase().includes(role.toLowerCase()) ||
      role.toLowerCase().includes((p.jobTitle || "").toLowerCase()),
    );

    const qualified = candidates.filter((p) => {
      const pSkills = allSkills.filter((s) => s.resource_skills.resourceId === p.id);
      return pSkills.length > 0;
    });

    let coverage: "full" | "partial" | "none" = "none";
    if (qualified.length >= 2) coverage = "full";
    else if (qualified.length === 1) coverage = "partial";

    return {
      role,
      phase: row.phase,
      daysPerWeek: row.daysPerWeek,
      coverage,
      candidateCount: candidates.length,
      qualifiedCount: qualified.length,
      candidates: qualified.map((p) => `${p.firstName} ${p.lastName}`),
    };
  });
}

export async function getPipelineView(tenantId: number, stageFilter?: string[]) {
  const [opps, stages, accounts, plans] = await Promise.all([
    db.select().from(crmOpportunities).where(eq(crmOpportunities.tenantId, tenantId)).orderBy(asc(crmOpportunities.expectedCloseDate)),
    db.select().from(crmOpportunityStages).where(eq(crmOpportunityStages.tenantId, tenantId)),
    db.select().from(crmAccounts).where(eq(crmAccounts.tenantId, tenantId)),
    db.select().from(opportunityResourcePlans).where(eq(opportunityResourcePlans.tenantId, tenantId)),
  ]);

  const defaultStages = stages.filter((s) => /proposal|negotiation/i.test(s.name)).map((s) => s.id);
  const filterIds = stageFilter?.length
    ? stages.filter((s) => stageFilter.some((n) => s.name.toLowerCase().includes(n.toLowerCase()))).map((s) => s.id)
    : defaultStages;

  const filtered = opps.filter((o) => !filterIds.length || (o.stageId && filterIds.includes(o.stageId)));

  const planByOpp = new Map(plans.map((p) => [p.opportunityId, p]));
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const stageById = new Map(stages.map((s) => [s.id, s]));

  let totalDemandDays = 0;
  const byRole: Record<string, number> = {};

  const items = await Promise.all(filtered.map(async (o) => {
    const plan = planByOpp.get(o.id);
    let skillsSummary = "";
    let demandDays = 0;
    if (plan) {
      const rows = await db.select().from(opportunityResourceRows).where(eq(opportunityResourceRows.planId, plan.id));
      const roles = Array.from(new Set(rows.map((r) => r.roleName)));
      skillsSummary = roles.slice(0, 3).join(", ");
      for (const r of rows) {
        demandDays += parseNum(r.daysPerWeek, 0) * 4;
        byRole[r.roleName] = (byRole[r.roleName] || 0) + parseNum(r.daysPerWeek, 0) * 4;
      }
      totalDemandDays += demandDays;
    }

    return {
      id: o.id,
      name: o.name,
      client: accountById.get(o.accountId ?? 0)?.name ?? "—",
      stage: stageById.get(o.stageId ?? 0)?.name ?? "—",
      expectedCloseDate: o.expectedCloseDate,
      totalValue: o.amount,
      hasResourcePlan: !!plan,
      planId: plan?.id ?? null,
      skillsSummary,
      owner: o.ownerUserId,
      demandDays,
    };
  }));

  return { items, totalDemandDays, byRole };
}

export async function getAllResourceSkillsMap(tenantId: number): Promise<Record<number, import("@shared/schema").ResourceSkill[]>> {
  const rows = await db
    .select({ skill: resourceSkills })
    .from(resourceSkills)
    .innerJoin(resources, eq(resourceSkills.resourceId, resources.id))
    .where(eq(resources.tenantId, tenantId));

  const map: Record<number, import("@shared/schema").ResourceSkill[]> = {};
  for (const row of rows) {
    const s = row.skill;
    if (!map[s.resourceId]) map[s.resourceId] = [];
    map[s.resourceId].push(s);
  }
  return map;
}

export async function logTimesheetAudit(
  tenantId: number,
  periodId: number,
  action: string,
  actorUserId: string | null,
  details?: string,
) {
  await db.insert(timesheetAuditLog).values({
    tenantId,
    timesheetPeriodId: periodId,
    action,
    actorUserId: actorUserId ?? undefined,
    details,
  });
}

export async function listLeaves(tenantId: number, resourceId?: number) {
  const conds = [eq(resourceLeaves.tenantId, tenantId)];
  if (resourceId) conds.push(eq(resourceLeaves.resourceId, resourceId));
  return db.select().from(resourceLeaves).where(and(...conds)).orderBy(desc(resourceLeaves.startDate));
}

export async function listTimesheetIntegrations(tenantId: number) {
  return db.select().from(timesheetIntegrations).where(eq(timesheetIntegrations.tenantId, tenantId));
}

export async function listIntegrationLogs(tenantId: number, integrationId?: number) {
  const conds = [eq(timesheetIntegrationLog.tenantId, tenantId)];
  if (integrationId) conds.push(eq(timesheetIntegrationLog.integrationId, integrationId));
  return db.select().from(timesheetIntegrationLog).where(and(...conds)).orderBy(desc(timesheetIntegrationLog.createdAt)).limit(100);
}

export async function exportTimesheetsCsv(
  tenantId: number,
  opts: { from?: string; to?: string; resourceId?: number; format?: "standard" | "summary" },
) {
  const periods = await db.select().from(timesheetPeriods).where(eq(timesheetPeriods.tenantId, tenantId));
  const filteredPeriods = periods.filter((p) => {
    if (opts.resourceId && p.resourceId !== opts.resourceId) return false;
    if (opts.from && new Date(p.weekStartDate) < new Date(opts.from)) return false;
    if (opts.to && new Date(p.weekEndDate) > new Date(opts.to)) return false;
    return p.approvalStatus === "fully_approved" || p.status === "approved";
  });

  const people = await db.select().from(resources).where(eq(resources.tenantId, tenantId));
  const peopleMap = new Map(people.map((p) => [p.id, p]));

  const lines: string[] = [];
  if (opts.format === "summary") {
    lines.push("Person,Week Commencing,Project,Total Hours,Role,Approval Status");
    for (const p of filteredPeriods) {
      const person = peopleMap.get(p.resourceId);
      const entries = await db.select().from(timesheetEntries).where(eq(timesheetEntries.timesheetPeriodId, p.id));
      const byProject: Record<string, number> = {};
      for (const e of entries) {
        const key = e.projectName || "General";
        byProject[key] = (byProject[key] || 0) + parseNum(e.hours);
      }
      for (const [project, hours] of Object.entries(byProject)) {
        lines.push([
          `"${person?.firstName ?? ""} ${person?.lastName ?? ""}"`,
          new Date(p.weekStartDate).toISOString().slice(0, 10),
          `"${project}"`,
          hours.toFixed(1),
          `"${entries[0]?.role ?? ""}"`,
          p.approvalStatus ?? p.status,
        ].join(","));
      }
    }
  } else {
    lines.push("Person,ID,Week Commencing,Date,Project,Project Code,Cost Centre,Hours,Time Type,Role,Notes,Approval Status");
    for (const p of filteredPeriods) {
      const person = peopleMap.get(p.resourceId);
      const entries = await db.select().from(timesheetEntries).where(eq(timesheetEntries.timesheetPeriodId, p.id));
      for (const e of entries) {
        lines.push([
          `"${person?.firstName ?? ""} ${person?.lastName ?? ""}"`,
          person?.payrollId ?? person?.id ?? "",
          new Date(p.weekStartDate).toISOString().slice(0, 10),
          e.entryDate ?? "",
          `"${e.projectName ?? ""}"`,
          e.projectId ?? "",
          `"${e.costCentreCode ?? e.departmentCode ?? ""}"`,
          parseNum(e.hours).toFixed(1),
          e.activityType ?? "billable",
          `"${e.role ?? ""}"`,
          `"${(e.description ?? "").replace(/"/g, '""')}"`,
          p.approvalStatus ?? p.status,
        ].join(","));
      }
    }
  }
  return lines.join("\n");
}

export type ResourceOrgNode = {
  id: number;
  name: string;
  jobTitle: string | null;
  department: string | null;
  photoUrl: string | null;
  personType: string | null;
  reportsToId: number | null;
  children: ResourceOrgNode[];
};

export async function getResourceOrgTree(tenantId: number): Promise<ResourceOrgNode[]> {
  const people = await db.select().from(resources).where(eq(resources.tenantId, tenantId));
  const nodeMap = new Map<number, ResourceOrgNode>();

  for (const p of people) {
    nodeMap.set(p.id, {
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      jobTitle: p.jobTitle,
      department: p.department,
      photoUrl: p.photoUrl,
      personType: p.personType,
      reportsToId: p.reportsToId,
      children: [],
    });
  }

  const roots: ResourceOrgNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.reportsToId && nodeMap.has(node.reportsToId)) {
      nodeMap.get(node.reportsToId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function listResourceDocuments(tenantId: number, resourceId: number) {
  const rows = await db
    .select({
      link: documentResourceLinks,
      document: documents,
    })
    .from(documentResourceLinks)
    .innerJoin(documents, eq(documentResourceLinks.documentId, documents.id))
    .where(and(
      eq(documentResourceLinks.tenantId, tenantId),
      eq(documentResourceLinks.resourceId, resourceId),
    ))
    .orderBy(desc(documentResourceLinks.createdAt));

  return rows.map((r) => ({
    id: r.link.id,
    documentId: r.document.id,
    title: r.document.title,
    linkType: r.link.linkType,
    notes: r.link.notes,
    createdAt: r.link.createdAt,
  }));
}

export async function linkResourceDocument(
  tenantId: number,
  resourceId: number,
  documentId: number,
  linkType: string,
  createdById: string,
  notes?: string,
) {
  const [row] = await db.insert(documentResourceLinks).values({
    tenantId,
    resourceId,
    documentId,
    linkType,
    notes,
    createdById,
  }).returning();
  return row;
}

export async function unlinkResourceDocument(tenantId: number, linkId: number) {
  await db.delete(documentResourceLinks).where(and(
    eq(documentResourceLinks.id, linkId),
    eq(documentResourceLinks.tenantId, tenantId),
  ));
}
