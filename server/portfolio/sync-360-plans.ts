/**
 * Write Level-1 / Activity plan overlays back to canonical PM tables.
 */
import { storage } from "../storage";
import { db } from "../db";
import { pmWorkstreams } from "@shared/schema";
import { eq } from "drizzle-orm";

type PlanBarStatus = "not_started" | "in_progress" | "at_risk" | "delayed" | "completed";

type Level1Row =
  | { id: string; kind: "release"; name: string; startWeek?: number; endWeek?: number }
  | {
      id: string;
      kind: "phase";
      name: string;
      status: PlanBarStatus;
      startWeek: number;
      endWeek: number;
      phaseId?: number;
    }
  | {
      id: string;
      kind: "milestone";
      name: string;
      week: number;
      done?: boolean;
      milestoneId?: number;
      parentPhaseRowId?: string;
      phaseId?: number;
    };

type ActivityRelease = {
  id: string;
  name: string;
  workstreamId?: number;
  lanes: {
    id: string;
    name: string;
    cells: string[];
    workstreamId?: number;
  }[];
};

function weekIndexToIso(week: number, year: number): string {
  const w = Math.max(0, Math.min(47, week));
  const month = Math.floor(w / 4);
  const weekInMonth = w % 4;
  const day = Math.min(28, weekInMonth * 7 + 1);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function statusToPhase(status: PlanBarStatus): { status: string; ragStatus: string; progress: number } {
  switch (status) {
    case "completed":
      return { status: "completed", ragStatus: "green", progress: 100 };
    case "delayed":
      return { status: "in_progress", ragStatus: "red", progress: 40 };
    case "at_risk":
      return { status: "in_progress", ragStatus: "amber", progress: 50 };
    case "in_progress":
      return { status: "in_progress", ragStatus: "green", progress: 40 };
    default:
      return { status: "not_started", ragStatus: "green", progress: 0 };
  }
}

function laneDateRange(cells: string[]): { start: string | null; end: string | null; year: number } {
  const year = new Date().getFullYear();
  let first = -1;
  let last = -1;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i]) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) return { start: null, end: null, year };
  return {
    start: weekIndexToIso(first, year),
    end: weekIndexToIso(last, year),
    year,
  };
}

export async function sync360PlansToDb(
  tenantId: number,
  projectId: number,
  opts: {
    level1PlanRows?: unknown;
    activityPlan?: unknown;
  },
): Promise<{
  phasesUpdated: number;
  milestonesUpdated: number;
  workstreamsUpdated: number;
  activityPlan?: ActivityRelease[];
}> {
  const project = await storage.getPmProject(projectId);
  if (!project || project.tenantId !== tenantId) {
    return { phasesUpdated: 0, milestonesUpdated: 0, workstreamsUpdated: 0 };
  }

  const year = new Date().getFullYear();
  let phasesUpdated = 0;
  let milestonesUpdated = 0;
  let workstreamsUpdated = 0;

  const rows = Array.isArray(opts.level1PlanRows) ? (opts.level1PlanRows as Level1Row[]) : [];
  let phaseOrder = 0;
  let lastPhaseId: number | undefined;
  /** Map Level-1 phase row id → DB phase id (for nested milestones). */
  const phaseRowToDbId = new Map<string, number>();

  for (const row of rows) {
    if (row.kind === "phase") {
      phaseOrder += 1;
      const mapped = statusToPhase(row.status);
      const payload = {
        name: row.name,
        ...mapped,
        plannedStartDate: weekIndexToIso(row.startWeek, year),
        plannedEndDate: weekIndexToIso(row.endWeek, year),
        order: phaseOrder,
        phaseNumber: phaseOrder,
      };
      if (row.phaseId) {
        await storage.updatePmProjectPhase(row.phaseId, payload);
        lastPhaseId = row.phaseId;
        phaseRowToDbId.set(row.id, row.phaseId);
        phasesUpdated += 1;
      } else {
        const created = await storage.createPmProjectPhase({
          tenantId,
          projectId,
          ...payload,
        } as Parameters<typeof storage.createPmProjectPhase>[0]);
        lastPhaseId = created.id;
        phaseRowToDbId.set(row.id, created.id);
        phasesUpdated += 1;
      }
    } else if (row.kind === "milestone") {
      const targetDate = weekIndexToIso(row.week, year);
      const linkedPhaseId =
        (row.parentPhaseRowId ? phaseRowToDbId.get(row.parentPhaseRowId) : undefined)
        ?? row.phaseId
        ?? lastPhaseId
        ?? null;
      const msPayload = {
        name: row.name,
        targetDate,
        dueDate: targetDate,
        status: row.done ? "completed" : "pending",
        ragStatus: row.done ? "green" : "Green",
        phaseId: linkedPhaseId,
        projectId,
        tenantId,
      };
      if (row.milestoneId) {
        await storage.updatePmMilestone(row.milestoneId, msPayload);
        milestonesUpdated += 1;
      } else {
        await storage.createPmMilestone(msPayload as Parameters<typeof storage.createPmMilestone>[0]);
        milestonesUpdated += 1;
      }
    }
  }

  const releases = Array.isArray(opts.activityPlan) ? (opts.activityPlan as ActivityRelease[]) : [];
  const patchedReleases: ActivityRelease[] = [];
  let wsOrder = 0;

  const existingWs = await db
    .select()
    .from(pmWorkstreams)
    .where(eq(pmWorkstreams.projectId, projectId));

  const findWs = (pred: (w: (typeof existingWs)[number]) => boolean) =>
    existingWs.find(pred);

  for (const rel of releases) {
    wsOrder += 1;
    let parentId = rel.workstreamId;
    const parentPayload = {
      name: rel.name,
      type: "workstream" as const,
      order: wsOrder,
      updatedAt: new Date(),
    };

    if (parentId) {
      await db.update(pmWorkstreams).set(parentPayload).where(eq(pmWorkstreams.id, parentId));
      workstreamsUpdated += 1;
    } else {
      const matched = findWs(
        (w) => (w.type || "workstream") === "workstream" && (w.name || "") === rel.name,
      );
      if (matched) {
        parentId = matched.id;
        await db.update(pmWorkstreams).set(parentPayload).where(eq(pmWorkstreams.id, parentId));
        workstreamsUpdated += 1;
      } else {
        const [created] = await db
          .insert(pmWorkstreams)
          .values({
            tenantId,
            projectId,
            type: "workstream",
            name: rel.name,
            order: wsOrder,
            status: "not_started",
            ragStatus: "green",
            progress: 0,
          })
          .returning();
        parentId = created.id;
        existingWs.push(created);
        workstreamsUpdated += 1;
      }
    }

    const patchedLanes: ActivityRelease["lanes"] = [];
    for (const lane of rel.lanes) {
      wsOrder += 1;
      const range = laneDateRange(lane.cells);
      const code = lane.cells.find(Boolean) || null;
      const hasSchedule = !!(range.start || range.end || code);
      let laneId = lane.workstreamId;

      if (laneId) {
        await db
          .update(pmWorkstreams)
          .set({
            name: lane.name,
            type: "activity",
            parentWorkstreamId: parentId,
            plannedStartDate: range.start,
            plannedEndDate: range.end,
            wbsCode: code,
            order: wsOrder,
            updatedAt: new Date(),
          })
          .where(eq(pmWorkstreams.id, laneId));
        workstreamsUpdated += 1;
      } else if (hasSchedule) {
        const matchedLane = findWs(
          (w) =>
            (w.type || "") === "activity" &&
            w.parentWorkstreamId === parentId &&
            (w.name || "") === lane.name,
        );
        if (matchedLane) {
          laneId = matchedLane.id;
          await db
            .update(pmWorkstreams)
            .set({
              name: lane.name,
              type: "activity",
              parentWorkstreamId: parentId,
              plannedStartDate: range.start,
              plannedEndDate: range.end,
              wbsCode: code,
              order: wsOrder,
              updatedAt: new Date(),
            })
            .where(eq(pmWorkstreams.id, laneId));
          workstreamsUpdated += 1;
        } else {
          const [created] = await db
            .insert(pmWorkstreams)
            .values({
              tenantId,
              projectId,
              parentWorkstreamId: parentId,
              type: "activity",
              name: lane.name,
              plannedStartDate: range.start,
              plannedEndDate: range.end,
              wbsCode: code,
              order: wsOrder,
              status: "not_started",
              ragStatus: "green",
              progress: 0,
            })
            .returning();
          laneId = created.id;
          existingWs.push(created);
          workstreamsUpdated += 1;
        }
      }

      patchedLanes.push({ ...lane, workstreamId: laneId });
    }

    patchedReleases.push({ ...rel, workstreamId: parentId, lanes: patchedLanes });
  }

  return {
    phasesUpdated,
    milestonesUpdated,
    workstreamsUpdated,
    activityPlan: releases.length ? patchedReleases : undefined,
  };
}
