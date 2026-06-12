import { db } from "../db";
import { pmHealthMatrixSnapshots } from "@shared/schema";
import { and, eq, desc, gte } from "drizzle-orm";
import { getHealthMatrix, type HealthMatrixRow, type RagLevel } from "./service";

function ragScore(level: RagLevel): number {
  return level === "green" ? 100 : level === "amber" ? 60 : 20;
}

export function weekStartMonday(d = new Date()): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().split("T")[0];
}

export async function captureHealthMatrixSnapshots(tenantId: number, clientId?: number) {
  const rows = await getHealthMatrix(tenantId, clientId);
  const week = weekStartMonday();
  let saved = 0;

  for (const row of rows) {
    const score = Math.round(
      (ragScore(row.overall) +
        ragScore(row.schedule) +
        ragScore(row.budget) +
        ragScore(row.quality) +
        ragScore(row.delivery) +
        ragScore(row.risk) +
        ragScore(row.resources) +
        ragScore(row.stakeholders)) /
        8,
    );

    const existing = await db
      .select()
      .from(pmHealthMatrixSnapshots)
      .where(and(eq(pmHealthMatrixSnapshots.projectId, row.projectId), eq(pmHealthMatrixSnapshots.snapshotWeek, week)))
      .limit(1);

    const values = {
      tenantId,
      projectId: row.projectId,
      snapshotWeek: week,
      overall: row.overall,
      schedule: row.schedule,
      budget: row.budget,
      quality: row.quality,
      delivery: row.delivery,
      risk: row.risk,
      resources: row.resources,
      stakeholders: row.stakeholders,
      healthScore: score,
    };

    if (existing.length) {
      await db.update(pmHealthMatrixSnapshots).set(values).where(eq(pmHealthMatrixSnapshots.id, existing[0].id));
    } else {
      await db.insert(pmHealthMatrixSnapshots).values(values);
    }
    saved++;
  }
  return saved;
}

export async function getProjectHealthHistory(projectId: number, tenantId: number, weeks = 4) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeks * 7);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const rows = await db
    .select()
    .from(pmHealthMatrixSnapshots)
    .where(
      and(
        eq(pmHealthMatrixSnapshots.tenantId, tenantId),
        eq(pmHealthMatrixSnapshots.projectId, projectId),
        gte(pmHealthMatrixSnapshots.snapshotWeek, cutoffStr),
      ),
    )
    .orderBy(pmHealthMatrixSnapshots.snapshotWeek);

  return rows.map((r) => ({
    week: r.snapshotWeek,
    healthScore: r.healthScore ?? 0,
    overall: r.overall,
    schedule: r.schedule,
    budget: r.budget,
    quality: r.quality,
    delivery: r.delivery,
    risk: r.risk,
    resources: r.resources,
    stakeholders: r.stakeholders,
  }));
}

export async function getHealthMatrixAtWeek(tenantId: number, snapshotWeek: string, clientId?: number): Promise<HealthMatrixRow[] | null> {
  const rows = await db
    .select()
    .from(pmHealthMatrixSnapshots)
    .where(and(eq(pmHealthMatrixSnapshots.tenantId, tenantId), eq(pmHealthMatrixSnapshots.snapshotWeek, snapshotWeek)));

  if (!rows.length) return null;

  const { getHealthMatrix } = await import("./service");
  const live = await getHealthMatrix(tenantId, clientId);
  const projMap = new Map(live.map((p) => [p.projectId, p]));

  return rows
    .filter((r) => projMap.has(r.projectId))
    .map((r) => {
      const p = projMap.get(r.projectId);
      if (!p) return null;
      return {
        projectId: r.projectId,
        projectName: p.projectName,
        clientName: p.clientName,
        managerName: p.managerName,
        portfolioNames: p.portfolioNames,
        programmeName: p.programmeName,
        overall: (r.overall || "green") as RagLevel,
        schedule: (r.schedule || "green") as RagLevel,
        budget: (r.budget || "green") as RagLevel,
        quality: (r.quality || "green") as RagLevel,
        delivery: (r.delivery || "green") as RagLevel,
        risk: (r.risk || "green") as RagLevel,
        resources: (r.resources || "green") as RagLevel,
        stakeholders: (r.stakeholders || "green") as RagLevel,
      };
    })
    .filter((r): r is HealthMatrixRow => r !== null);
}

export async function listHealthSnapshotWeeks(tenantId: number): Promise<string[]> {
  const rows = await db
    .selectDistinct({ week: pmHealthMatrixSnapshots.snapshotWeek })
    .from(pmHealthMatrixSnapshots)
    .where(eq(pmHealthMatrixSnapshots.tenantId, tenantId))
    .orderBy(desc(pmHealthMatrixSnapshots.snapshotWeek))
    .limit(12);
  return rows.map((r) => r.week);
}
