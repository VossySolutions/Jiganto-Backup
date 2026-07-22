import { and, eq, sql, count, or, inArray } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  timesheetEntries,
  timesheetPeriods,
  resources,
  pmEpics,
  pmAgileStories,
  pmAgileSprints,
  pmAgileDefects,
  pmRaiddItems,
  pmDeliverables,
  pmGanttVersions,
  pmTeamMembers,
  pmTasks,
  pmMilestones,
  pmProjectTools,
  documents,
} from "@shared/schema";
import type { PmProject } from "@shared/models/projects";

export type ToolBadgeTone = "red" | "amber" | "green" | "blue" | "gray";

export type ToolBadge = {
  label: string;
  tone: ToolBadgeTone;
  count?: number;
};

export type ProjectToolBadgesResponse = {
  healthScore: number;
  attention: boolean;
  alertCount: number;
  progress: number;
  financialRag: string;
  scheduleRag: string;
  ragStatus: string;
  badges: Record<string, ToolBadge | null>;
  teamMembers: number;
  statusReportCount: number;
};

function ragTone(rag?: string | null): ToolBadgeTone {
  const v = (rag || "green").toLowerCase();
  if (v === "red") return "red";
  if (v === "amber" || v === "yellow") return "amber";
  return "green";
}

function ragLabel(tone: ToolBadgeTone): string {
  if (tone === "red") return "Off track";
  if (tone === "amber") return "Monitor";
  return "On track";
}

/** Match enrichPmProjectsForList health math without loading users/teams/portfolios. */
function inlineHealth(project: PmProject): { healthScore: number; attention: boolean } {
  const ragPoints = (rag: string | null | undefined) => {
    if (rag === "green") return 100;
    if (rag === "amber") return 60;
    if (rag === "red") return 25;
    if (rag === "blue") return 70;
    return 70;
  };
  const budgetRag = project.financialRag || "green";
  const scheduleRag = project.scheduleRag || "green";
  const scopeRag = project.ragStatus || "green";
  const ragAvg = (ragPoints(budgetRag) + ragPoints(scheduleRag) + ragPoints(scopeRag)) / 3;
  const riskPenalty = Math.min(40, Math.max(0, project.riskScore || 0) * 0.4);
  const healthScore = Math.round(Math.max(0, Math.min(100, ragAvg - riskPenalty)));
  const attention = budgetRag === "red" || scheduleRag === "red" || scopeRag === "red";
  return { healthScore, attention };
}

function badge(label: string, tone: ToolBadgeTone, count?: number): ToolBadge {
  return { label, tone, ...(count != null ? { count } : {}) };
}

function isMilestoneDueRow(m: {
  status?: string | null;
  completedDate?: string | Date | null;
  targetDate?: string | Date | null;
  dueDate?: string | Date | null;
}): boolean {
  if (m.completedDate) return false;
  const s = (m.status || "").trim().toLowerCase();
  if (["completed", "done", "cancelled"].includes(s)) return false;
  const dateStr = m.targetDate || m.dueDate;
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

export async function getProjectToolBadges(
  projectId: number,
  tenantId: number,
  projectHint?: PmProject | null,
): Promise<ProjectToolBadgesResponse | null> {
  const project = projectHint ?? (await storage.getPmProject(projectId));
  if (!project || project.tenantId !== tenantId) return null;

  const { healthScore, attention } = inlineHealth(project);
  const meta = (project.metadata && typeof project.metadata === "object" ? project.metadata : {}) as Record<
    string,
    unknown
  >;
  const linkedIds = Array.isArray(meta.linkedDocumentIds)
    ? (meta.linkedDocumentIds as number[]).filter((id) => typeof id === "number")
    : [];
  const statusReports = Array.isArray(meta.statusReports) ? (meta.statusReports as unknown[]) : [];
  const statusReportCount = statusReports.length;

  const metaMatch = sql`(${documents.metadata}->>'projectId')::int = ${projectId}`;
  const docFilter =
    linkedIds.length > 0
      ? and(eq(documents.tenantId, tenantId), or(metaMatch, inArray(documents.id, linkedIds)))
      : and(eq(documents.tenantId, tenantId), metaMatch);

  const raiddOpenCond = and(
    eq(pmRaiddItems.projectId, projectId),
    sql`coalesce(${pmRaiddItems.archived}, false) = false`,
    sql`coalesce(${pmRaiddItems.closed}, false) = false`,
    sql`lower(coalesce(${pmRaiddItems.status}, '')) not in ('closed', 'resolved', 'approved', 'met', 'validated', 'completed', 'done', 'invalidated')`,
  );

  const [
    raiddByType,
    escalatedRow,
    deliverableRows,
    unifiedMilestones,
    legacyMilestones,
    toolTypeRows,
    ganttCountRow,
    docsCountRow,
    teamCountRow,
    overdueTsRows,
    epicCountRow,
    storyCountRow,
    sprintCountRow,
    defectOpenRow,
  ] = await Promise.all([
    db
      .select({ type: pmRaiddItems.type, n: count() })
      .from(pmRaiddItems)
      .where(raiddOpenCond)
      .groupBy(pmRaiddItems.type),
    db
      .select({ n: count() })
      .from(pmRaiddItems)
      .where(
        and(
          eq(pmRaiddItems.projectId, projectId),
          sql`coalesce(${pmRaiddItems.archived}, false) = false`,
          eq(pmRaiddItems.escalated, true),
        ),
      ),
    db
      .select({
        status: pmDeliverables.status,
        archived: pmDeliverables.archived,
      })
      .from(pmDeliverables)
      .where(eq(pmDeliverables.projectId, projectId)),
    db
      .select({
        status: pmTasks.status,
        completedDate: pmTasks.actualEndDate,
        targetDate: pmTasks.plannedEndDate,
        dueDate: pmTasks.plannedEndDate,
      })
      .from(pmTasks)
      .where(and(eq(pmTasks.projectId, projectId), eq(pmTasks.ganttType, "milestone"))),
    db
      .select({
        status: pmMilestones.status,
        completedDate: pmMilestones.completedDate,
        targetDate: pmMilestones.targetDate,
        dueDate: pmMilestones.dueDate,
      })
      .from(pmMilestones)
      .where(eq(pmMilestones.projectId, projectId)),
    db
      .select({ toolType: pmProjectTools.toolType, isEnabled: pmProjectTools.isEnabled })
      .from(pmProjectTools)
      .where(eq(pmProjectTools.projectId, projectId)),
    db.select({ n: count() }).from(pmGanttVersions).where(eq(pmGanttVersions.projectId, projectId)),
    db.select({ n: count() }).from(documents).where(docFilter),
    db
      .select({ n: count() })
      .from(pmTeamMembers)
      .where(and(eq(pmTeamMembers.projectId, projectId), eq(pmTeamMembers.isActive, true))),
    db
      .selectDistinct({
        periodId: timesheetPeriods.id,
        personName: sql<string | null>`${resources.firstName} || ' ' || ${resources.lastName}`,
        status: timesheetPeriods.status,
        weekEndDate: timesheetPeriods.weekEndDate,
      })
      .from(timesheetEntries)
      .innerJoin(timesheetPeriods, eq(timesheetEntries.timesheetPeriodId, timesheetPeriods.id))
      .innerJoin(resources, eq(timesheetPeriods.resourceId, resources.id))
      .where(
        and(
          eq(timesheetPeriods.tenantId, tenantId),
          eq(timesheetEntries.projectId, projectId),
          sql`lower(coalesce(${timesheetPeriods.status}, '')) in ('draft', 'rejected', 'submitted', 'overdue')`,
          sql`${timesheetPeriods.weekEndDate} < current_date`,
        ),
      ),
    db.select({ n: count() }).from(pmEpics).where(eq(pmEpics.projectId, projectId)),
    db.select({ n: count() }).from(pmAgileStories).where(eq(pmAgileStories.projectId, projectId)),
    db.select({ n: count() }).from(pmAgileSprints).where(eq(pmAgileSprints.projectId, projectId)),
    db
      .select({ n: count() })
      .from(pmAgileDefects)
      .where(
        and(
          eq(pmAgileDefects.projectId, projectId),
          sql`lower(coalesce(${pmAgileDefects.status}, '')) not in ('closed', 'resolved', 'done', 'verified')`,
        ),
      ),
  ]);

  const typeCount = (type: string) =>
    Number(raiddByType.find((r) => r.type === type)?.n ?? 0);

  const riskOpen = typeCount("risk");
  const issueOpen = typeCount("issue");
  const assumptionOpen = typeCount("assumption");
  const dependencyOpen = typeCount("dependency");
  const decisionOpen = typeCount("decision");
  const changeOpen = typeCount("change");
  const raiddOpen =
    riskOpen + issueOpen + assumptionOpen + dependencyOpen + decisionOpen + changeOpen;
  const escalated = Number(escalatedRow[0]?.n ?? 0);

  const deliverablesOpen = deliverableRows.filter((d) => {
    if (d.archived) return false;
    const s = (d.status || "").toLowerCase();
    return !["approved", "completed"].includes(s);
  }).length;
  const deliverablesTotal = deliverableRows.length;

  const milestoneSource = unifiedMilestones.length > 0 ? unifiedMilestones : legacyMilestones;
  const milestonesDue = milestoneSource.filter(isMilestoneDueRow).length;
  const milestonesTotal = milestoneSource.length;

  const activeTools = toolTypeRows.filter((t) => t.isEnabled !== false);
  const ganttToolRows = activeTools.filter((t) => t.toolType === "gantt_chart").length;
  const ganttCount = Math.max(Number(ganttCountRow[0]?.n ?? 0), ganttToolRows);
  const trackingCount = activeTools.filter((t) => t.toolType === "tracking_board").length;
  const docsCount = Number(docsCountRow[0]?.n ?? 0);
  const teamMembers = Number(teamCountRow[0]?.n ?? 0);
  const timesheetOverdue = overdueTsRows.length;

  const epicCount = Number(epicCountRow[0]?.n ?? 0);
  const storyCount = Number(storyCountRow[0]?.n ?? 0);
  const sprintCount = Number(sprintCountRow[0]?.n ?? 0);
  const defectOpenCount = Number(defectOpenRow[0]?.n ?? 0);

  const financeTone = ragTone(project.financialRag);
  const financeLabel = ragLabel(financeTone);

  const alertCount =
    (project.financialRag === "red" ? 1 : 0) +
    (project.scheduleRag === "red" ? 1 : 0) +
    (project.ragStatus === "red" ? 1 : 0) +
    (escalated > 0 ? 1 : 0) +
    (milestonesDue > 0 ? 1 : 0) +
    (timesheetOverdue > 0 ? 1 : 0) +
    (defectOpenCount > 0 ? 1 : 0);

  const badges: Record<string, ToolBadge | null> = {
    risk_log: riskOpen > 0 ? badge(String(riskOpen), riskOpen >= 3 ? "red" : "amber", riskOpen) : null,
    issues_log: issueOpen > 0 ? badge(String(issueOpen), issueOpen >= 3 ? "red" : "amber", issueOpen) : null,
    assumptions_log:
      assumptionOpen > 0 ? badge(String(assumptionOpen), "gray", assumptionOpen) : null,
    dependencies_log:
      dependencyOpen > 0 ? badge(String(dependencyOpen), "gray", dependencyOpen) : null,
    decisions_log: decisionOpen > 0 ? badge(String(decisionOpen), "gray", decisionOpen) : null,
    change_log: changeOpen > 0 ? badge(String(changeOpen), "amber", changeOpen) : null,
    raid_log: raiddOpen > 0 ? badge(String(raiddOpen), raiddOpen >= 5 ? "red" : "amber", raiddOpen) : null,
    status_reporting:
      statusReportCount > 0 ? badge(String(statusReportCount), "gray", statusReportCount) : null,
    gantt_chart: ganttCount > 0 ? badge(String(ganttCount), "blue", ganttCount) : null,
    tracking_board: trackingCount > 0 ? badge(String(trackingCount), "blue", trackingCount) : null,
    milestone_plan:
      milestonesDue > 0
        ? badge(`${milestonesDue} due`, "amber", milestonesDue)
        : milestonesTotal > 0
          ? badge(String(milestonesTotal), "gray", milestonesTotal)
          : null,
    deliverables_tracker:
      deliverablesOpen > 0
        ? badge(`${deliverablesOpen} open`, "amber", deliverablesOpen)
        : deliverablesTotal > 0
          ? badge(String(deliverablesTotal), "gray", deliverablesTotal)
          : null,
    documentation: docsCount > 0 ? badge(`${docsCount} docs`, "gray", docsCount) : null,
    test_tracker: null,
    timesheets:
      timesheetOverdue > 0 ? badge(`${timesheetOverdue} overdue`, "red", timesheetOverdue) : null,
    org_chart:
      timesheetOverdue > 0
        ? badge(`${timesheetOverdue} overdue TS`, "red", timesheetOverdue)
        : teamMembers > 0
          ? badge(String(teamMembers), "gray", teamMembers)
          : null,
    finance_tracker: financeTone === "green" ? null : badge(financeLabel, financeTone),
    resource_tracker: teamMembers > 0 ? badge(String(teamMembers), "gray", teamMembers) : null,
    agile:
      defectOpenCount > 0
        ? badge(`${defectOpenCount} defects`, "red", defectOpenCount)
        : storyCount > 0
          ? badge(`${storyCount} stories`, "blue", storyCount)
          : epicCount > 0
            ? badge(`${epicCount} epics`, "blue", epicCount)
            : sprintCount > 0
              ? badge(`${sprintCount} sprints`, "gray", sprintCount)
              : null,
  };

  return {
    healthScore,
    attention,
    alertCount,
    progress: project.progress ?? 0,
    financialRag: project.financialRag || "green",
    scheduleRag: project.scheduleRag || "green",
    ragStatus: project.ragStatus || "green",
    badges,
    teamMembers,
    statusReportCount,
  };
}
