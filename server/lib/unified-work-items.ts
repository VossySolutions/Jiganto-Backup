/**
 * Ensure Monday-style unified work items on pm_tasks.
 * - Adds columns if missing
 * - Migrates legacy phases / workstreams / milestones into pm_tasks once per project
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  pmMilestones,
  pmProjectPhases,
  pmProjects,
  pmTasks,
  pmWorkstreams,
  type PmTask,
} from "@shared/models/projects";

let columnsEnsured = false;

export async function ensureUnifiedWorkItemColumns(): Promise<void> {
  if (columnsEnsured) return;
  await db.execute(sql`ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS rag_status text DEFAULT 'green'`);
  await db.execute(sql`ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS phase_number integer`);
  await db.execute(sql`ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS methodology text`);
  await db.execute(sql`ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS legacy_source text`);
  await db.execute(sql`ALTER TABLE pm_tasks ADD COLUMN IF NOT EXISTS legacy_source_id integer`);
  columnsEnsured = true;
}

function normalizeGanttType(raw?: string | null, isSummary?: boolean | null): string {
  const t = (raw || "").toLowerCase();
  if (t === "summary") return "activity";
  if (t === "phase" || t === "workstream" || t === "activity" || t === "task" || t === "milestone") return t;
  if (isSummary) return "activity";
  return "task";
}

export function ganttTypeToEngineType(ganttType?: string | null, isSummary?: boolean | null): number {
  const t = normalizeGanttType(ganttType, isSummary);
  if (t === "phase") return 2;
  if (t === "workstream") return 3;
  if (t === "activity") return 4;
  if (t === "milestone") return 6;
  return 5;
}

export function engineTypeToGanttType(type: number): { ganttType: string; isSummary: boolean } {
  if (type === 2) return { ganttType: "phase", isSummary: true };
  if (type === 3) return { ganttType: "workstream", isSummary: true };
  if (type === 4) return { ganttType: "activity", isSummary: true };
  if (type === 6) return { ganttType: "milestone", isSummary: false };
  if (type === 0) return { ganttType: "phase", isSummary: true };
  if (type === 1) return { ganttType: "phase", isSummary: true };
  if (type === 7) return { ganttType: "phase", isSummary: true };
  return { ganttType: "task", isSummary: false };
}

function projectUnifiedFlag(meta: unknown): boolean {
  if (!meta || typeof meta !== "object") return false;
  return !!(meta as { unifiedWorkItems?: boolean }).unifiedWorkItems;
}

export async function ensureProjectUnifiedWorkItems(projectId: number): Promise<{ migrated: boolean }> {
  await ensureUnifiedWorkItemColumns();

  const [project] = await db.select().from(pmProjects).where(eq(pmProjects.id, projectId));
  if (!project) return { migrated: false };

  const meta = (project.metadata && typeof project.metadata === "object"
    ? { ...(project.metadata as Record<string, unknown>) }
    : {}) as Record<string, unknown>;

  // Fast path: already migrated — skip multi-table scans on every tasks/milestones read
  if (projectUnifiedFlag(meta)) {
    return { migrated: false };
  }

  // Already has unified rows from a prior partial run
  const existingUnified = await db
    .select()
    .from(pmTasks)
    .where(
      and(
        eq(pmTasks.projectId, projectId),
        inArray(pmTasks.ganttType, ["phase", "workstream", "milestone"]),
      ),
    );

  const phases = await db.select().from(pmProjectPhases).where(eq(pmProjectPhases.projectId, projectId));
  const workstreams = await db.select().from(pmWorkstreams).where(eq(pmWorkstreams.projectId, projectId));
  const milestones = await db.select().from(pmMilestones).where(eq(pmMilestones.projectId, projectId));
  const existingTasks = await db.select().from(pmTasks).where(eq(pmTasks.projectId, projectId));

  const mirroredPhaseIds = new Set(
    existingUnified.filter((t) => t.legacySource === "phase" && t.legacySourceId != null).map((t) => t.legacySourceId as number),
  );
  const mirroredWsIds = new Set(
    existingUnified.filter((t) => t.legacySource === "workstream" && t.legacySourceId != null).map((t) => t.legacySourceId as number),
  );
  const mirroredMsIds = new Set(
    existingUnified.filter((t) => t.legacySource === "milestone" && t.legacySourceId != null).map((t) => t.legacySourceId as number),
  );

  const phasesToMigrate = phases.filter((p) => !mirroredPhaseIds.has(p.id));
  const wsToMigrate = workstreams.filter((w) => !mirroredWsIds.has(w.id));
  const msToMigrate = milestones.filter((m) => !mirroredMsIds.has(m.id));

  const needsMigrate = phasesToMigrate.length > 0 || wsToMigrate.length > 0 || msToMigrate.length > 0;

  if (!needsMigrate) {
    for (const t of existingTasks) {
      if ((t.ganttType || "").toLowerCase() === "summary") {
        await db
          .update(pmTasks)
          .set({ ganttType: "activity", isSummary: true, updatedAt: new Date() })
          .where(eq(pmTasks.id, t.id));
      }
    }
    if (!projectUnifiedFlag(meta)) {
      meta.unifiedWorkItems = true;
      meta.unifiedWorkItemsAt = new Date().toISOString();
      await db.update(pmProjects).set({ metadata: meta, updatedAt: new Date() }).where(eq(pmProjects.id, projectId));
    }
    return { migrated: false };
  }

  const phaseMap = new Map<number, number>();
  for (const t of existingUnified) {
    if (t.legacySource === "phase" && t.legacySourceId != null) phaseMap.set(t.legacySourceId, t.id);
  }
  let orderBase = existingTasks.reduce((m, t) => Math.max(m, t.order ?? 0), 0);

  for (const ph of phasesToMigrate) {
    orderBase += 1;
    const [created] = await db
      .insert(pmTasks)
      .values({
        tenantId: project.tenantId,
        projectId,
        name: ph.name,
        description: ph.description,
        status: ph.status || "todo",
        progress: ph.progress ?? 0,
        ragStatus: (ph.ragStatus || "green").toLowerCase(),
        plannedStartDate: ph.plannedStartDate,
        plannedEndDate: ph.plannedEndDate,
        actualStartDate: ph.actualStartDate,
        actualEndDate: ph.actualEndDate,
        isSummary: true,
        ganttType: "phase",
        phaseNumber: ph.phaseNumber,
        methodology: ph.methodology,
        legacySource: "phase",
        legacySourceId: ph.id,
        parentTaskId: null,
        phaseId: ph.id,
        order: orderBase,
      })
      .returning();
    phaseMap.set(ph.id, created.id);
  }

  for (const ws of wsToMigrate) {
    orderBase += 1;
    const parentTaskId = ws.phaseId ? phaseMap.get(ws.phaseId) ?? null : null;
    await db.insert(pmTasks).values({
      tenantId: project.tenantId,
      projectId,
      name: ws.name,
      description: ws.description,
      status: ws.status || "todo",
      progress: ws.progress ?? 0,
      ragStatus: (ws.ragStatus || "green").toLowerCase(),
      plannedStartDate: ws.plannedStartDate,
      plannedEndDate: ws.plannedEndDate,
      actualStartDate: ws.actualStartDate,
      actualEndDate: ws.actualEndDate,
      isSummary: true,
      ganttType: "workstream",
      wbsCode: ws.wbsCode,
      legacySource: "workstream",
      legacySourceId: ws.id,
      parentTaskId,
      phaseId: ws.phaseId,
      order: orderBase,
    });
  }

  for (const t of existingTasks) {
    const updates: Partial<PmTask> & { updatedAt: Date } = { updatedAt: new Date() };
    let changed = false;
    const gt = normalizeGanttType(t.ganttType, t.isSummary);
    if (gt !== (t.ganttType || "task") || (t.ganttType || "").toLowerCase() === "summary") {
      updates.ganttType = gt;
      updates.isSummary = gt === "activity" || gt === "phase" || gt === "workstream";
      changed = true;
    }
    if (!t.parentTaskId && t.phaseId && phaseMap.has(t.phaseId)) {
      const mappedParent = phaseMap.get(t.phaseId)!;
      // Never parent a row under itself (phase rows store phaseId=legacy id → maps to own task id)
      if (mappedParent !== t.id) {
        updates.parentTaskId = mappedParent;
        changed = true;
      }
    }
    if (changed) {
      await db.update(pmTasks).set(updates).where(eq(pmTasks.id, t.id));
    }
  }

  for (const ms of msToMigrate) {
    orderBase += 1;
    const parentTaskId = ms.phaseId ? phaseMap.get(ms.phaseId) ?? null : null;
    const due = ms.dueDate || ms.targetDate;
    await db.insert(pmTasks).values({
      tenantId: project.tenantId,
      projectId,
      name: ms.name,
      description: ms.description || ms.commentary,
      status: ms.status === "completed" ? "done" : "todo",
      progress: ms.status === "completed" ? 100 : 0,
      ragStatus: (ms.ragStatus || "green").toLowerCase(),
      plannedStartDate: due,
      plannedEndDate: due,
      isSummary: false,
      ganttType: "milestone",
      legacySource: "milestone",
      legacySourceId: ms.id,
      parentTaskId,
      phaseId: ms.phaseId,
      milestoneId: ms.id,
      order: orderBase,
    });
  }

  meta.unifiedWorkItems = true;
  meta.unifiedWorkItemsAt = new Date().toISOString();
  await db.update(pmProjects).set({ metadata: meta, updatedAt: new Date() }).where(eq(pmProjects.id, projectId));

  return { migrated: true };
}

/** Map unified task row → legacy phase-shaped object for compatibility APIs */
export function taskAsLegacyPhase(t: PmTask) {
  return {
    id: t.legacySource === "phase" && t.legacySourceId ? t.legacySourceId : t.id,
    tenantId: t.tenantId,
    projectId: t.projectId,
    name: t.name,
    description: t.description,
    phaseNumber: t.phaseNumber ?? t.order ?? 0,
    methodology: t.methodology || "waterfall",
    status: t.status || "not_started",
    ragStatus: t.ragStatus || "green",
    progress: t.progress ?? 0,
    plannedStartDate: t.plannedStartDate,
    plannedEndDate: t.plannedEndDate,
    actualStartDate: t.actualStartDate,
    actualEndDate: t.actualEndDate,
    estimatedHours: t.estimatedHours,
    actualHours: t.actualHours,
    order: t.order ?? 0,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    /** Unified row id for Gantt consumers that need it */
    unifiedTaskId: t.id,
  };
}

export function taskAsLegacyMilestone(t: PmTask) {
  return {
    id: t.legacySource === "milestone" && t.legacySourceId ? t.legacySourceId : t.id,
    tenantId: t.tenantId,
    projectId: t.projectId,
    phaseId: t.phaseId,
    name: t.name,
    description: t.description,
    dueDate: t.plannedEndDate || t.plannedStartDate,
    targetDate: t.plannedEndDate || t.plannedStartDate,
    status: (t.progress ?? 0) >= 100 || t.status === "done" ? "completed" : t.status || "pending",
    ragStatus: t.ragStatus || "Green",
    commentary: t.description,
    order: t.order ?? 0,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    unifiedTaskId: t.id,
  };
}

export function taskAsLegacyWorkstream(t: PmTask) {
  return {
    id: t.legacySource === "workstream" && t.legacySourceId ? t.legacySourceId : t.id,
    tenantId: t.tenantId,
    projectId: t.projectId,
    phaseId: t.phaseId,
    name: t.name,
    description: t.description,
    wbsCode: t.wbsCode,
    status: t.status || "not_started",
    ragStatus: t.ragStatus || "green",
    progress: t.progress ?? 0,
    plannedStartDate: t.plannedStartDate,
    plannedEndDate: t.plannedEndDate,
    order: t.order ?? 0,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    unifiedTaskId: t.id,
    type: "workstream",
  };
}

export async function getUnifiedPhases(projectId: number) {
  await ensureProjectUnifiedWorkItems(projectId);
  const rows = await db
    .select()
    .from(pmTasks)
    .where(and(eq(pmTasks.projectId, projectId), eq(pmTasks.ganttType, "phase")))
    .orderBy(pmTasks.order, pmTasks.phaseNumber);
  return rows.map(taskAsLegacyPhase);
}

export async function getUnifiedMilestones(projectId: number) {
  await ensureProjectUnifiedWorkItems(projectId);
  const rows = await db
    .select()
    .from(pmTasks)
    .where(and(eq(pmTasks.projectId, projectId), eq(pmTasks.ganttType, "milestone")))
    .orderBy(pmTasks.order);
  return rows.map(taskAsLegacyMilestone);
}

export async function getUnifiedWorkstreams(projectId: number) {
  await ensureProjectUnifiedWorkItems(projectId);
  const rows = await db
    .select()
    .from(pmTasks)
    .where(and(eq(pmTasks.projectId, projectId), eq(pmTasks.ganttType, "workstream")))
    .orderBy(pmTasks.order);
  return rows.map(taskAsLegacyWorkstream);
}
