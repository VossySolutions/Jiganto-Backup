import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";
import {
  processPortalSettings, bpmlEntryHistory, bpmStepLinks, bpmTemplateSubmissions,
  type InsertProcessPortalSettings, type InsertBpmlEntryHistory, type InsertBpmStepLink,
} from "@shared/models/bpm-extensions";
import { bpmlEntries, bpmlTemplates } from "@shared/models/bpml";
import { bpmTemplates } from "@shared/models/bpm";

export async function getPortalSettings(tenantId: number, libraryId?: number) {
  const conditions = libraryId
    ? and(eq(processPortalSettings.tenantId, tenantId), eq(processPortalSettings.libraryId, libraryId))
    : eq(processPortalSettings.tenantId, tenantId);
  const rows = await db.select().from(processPortalSettings).where(conditions).limit(1);
  return rows[0] ?? null;
}

export async function upsertPortalSettings(data: InsertProcessPortalSettings) {
  const existing = data.libraryId
    ? await getPortalSettings(data.tenantId, data.libraryId)
    : await getPortalSettings(data.tenantId);
  if (existing) {
    const [row] = await db.update(processPortalSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(processPortalSettings.id, existing.id))
      .returning();
    return row;
  }
  const [row] = await db.insert(processPortalSettings).values(data).returning();
  return row;
}

export async function getBpmlEntryHistory(entryId: number) {
  return db.select().from(bpmlEntryHistory)
    .where(eq(bpmlEntryHistory.entryId, entryId))
    .orderBy(desc(bpmlEntryHistory.changedAt));
}

export async function recordBpmlEntryChanges(
  entryId: number,
  oldEntry: Record<string, unknown>,
  newEntry: Record<string, unknown>,
  changedBy: string | null,
  trackFields: string[],
) {
  const rows: InsertBpmlEntryHistory[] = [];
  for (const field of trackFields) {
    const oldVal = oldEntry[field] != null ? String(oldEntry[field]) : null;
    const newVal = newEntry[field] != null ? String(newEntry[field]) : null;
    if (oldVal !== newVal) {
      rows.push({ entryId, fieldName: field, oldValue: oldVal, newValue: newVal, changedBy });
    }
  }
  if (rows.length === 0) return [];
  return db.insert(bpmlEntryHistory).values(rows).returning();
}

export async function getBpmStepLinks(diagramId: number, nodeId?: string) {
  const conditions = nodeId
    ? and(eq(bpmStepLinks.diagramId, diagramId), eq(bpmStepLinks.nodeId, nodeId))
    : eq(bpmStepLinks.diagramId, diagramId);
  return db.select().from(bpmStepLinks).where(conditions);
}

export async function createBpmStepLink(data: InsertBpmStepLink) {
  const [row] = await db.insert(bpmStepLinks).values(data).returning();
  return row;
}

export async function deleteBpmStepLink(id: number) {
  await db.delete(bpmStepLinks).where(eq(bpmStepLinks.id, id));
}

export async function getTestCoverageForDiagram(diagramId: number) {
  const links = await getBpmStepLinks(diagramId);
  const testLinks = links.filter(l => l.linkType === "test_scenario");
  const passed = testLinks.filter(l => (l.metadata as any)?.status === "passed").length;
  return { total: testLinks.length, passed, passRate: testLinks.length ? Math.round((passed / testLinks.length) * 100) : 0 };
}

export async function bulkUpsertBpmlEntries(
  templateId: number,
  tenantId: number,
  rows: Record<string, unknown>[],
  mode: "append" | "upsert",
) {
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const processName = String(row.processName || row["Process Name"] || "").trim();
    if (!processName) {
      errors.push({ row: i + 1, message: "Process Name is required" });
      continue;
    }
    const matchKey = String(row.bpmlId || row["BPML ID"] || row.processCode || "").trim();
    if (mode === "upsert" && matchKey) {
      const existing = await db.select().from(bpmlEntries).where(
        and(
          eq(bpmlEntries.templateId, templateId),
          eq(bpmlEntries.tenantId, tenantId),
        ),
      );
      const match = existing.find(e => e.bpmlId === matchKey || e.processCode === matchKey);
      if (match) {
        await db.update(bpmlEntries).set({
          processName,
          processDescription: row.processDescription as string || null,
          level1: row.level1 as string || null,
          level2: row.level2 as string || null,
          level3: row.level3 as string || null,
          updatedAt: new Date(),
        }).where(eq(bpmlEntries.id, match.id));
        updated++;
        continue;
      }
    }
    await db.insert(bpmlEntries).values({
      templateId,
      tenantId,
      processName,
      bpmlId: row.bpmlId as string || null,
      processCode: row.processCode as string || null,
      processDescription: row.processDescription as string || null,
      level1: row.level1 as string || null,
      level2: row.level2 as string || null,
      level3: row.level3 as string || null,
      level4: row.level4 as string || null,
      level5: row.level5 as string || null,
    });
    imported++;
  }
  return { imported, updated, skipped, errors };
}

export async function submitBpmTemplate(templateId: number, tenantId: number, submittedBy: string) {
  const [sub] = await db.insert(bpmTemplateSubmissions).values({
    templateId, tenantId, submittedBy, status: "pending",
  }).returning();
  await db.update(bpmTemplates).set({ tier: "submitted", submissionStatus: "pending" }).where(eq(bpmTemplates.id, templateId));
  return sub;
}

export async function reviewBpmTemplateSubmission(
  submissionId: number,
  status: "approved" | "rejected",
  feedback: string,
  reviewedBy: string,
) {
  const [sub] = await db.update(bpmTemplateSubmissions)
    .set({ status, reviewFeedback: feedback, reviewedBy, reviewedAt: new Date() })
    .where(eq(bpmTemplateSubmissions.id, submissionId))
    .returning();
  if (sub && status === "approved") {
    await db.update(bpmTemplates)
      .set({ tier: "system", isSystem: true, submissionStatus: "approved", reviewFeedback: feedback })
      .where(eq(bpmTemplates.id, sub.templateId));
  } else if (sub) {
    await db.update(bpmTemplates)
      .set({ submissionStatus: "rejected", reviewFeedback: feedback })
      .where(eq(bpmTemplates.id, sub.templateId));
  }
  return sub;
}

export async function getBpmTemplateSubmissions(tenantId: number) {
  return db.select().from(bpmTemplateSubmissions)
    .where(eq(bpmTemplateSubmissions.tenantId, tenantId))
    .orderBy(desc(bpmTemplateSubmissions.createdAt));
}

export async function generateProcessId(templateId: number, tenantId: number): Promise<string> {
  const [template] = await db.select().from(bpmlTemplates).where(eq(bpmlTemplates.id, templateId));
  const prefix = template?.processIdPrefix || "P-";
  const entries = await db.select().from(bpmlEntries).where(
    and(eq(bpmlEntries.templateId, templateId), eq(bpmlEntries.tenantId, tenantId)),
  );
  const maxNum = entries.reduce((max, e) => {
    const match = (e.bpmlId || "").match(/(\d+)$/);
    return match ? Math.max(max, parseInt(match[1], 10)) : max;
  }, 0);
  return `${prefix}${String(maxNum + 1).padStart(4, "0")}`;
}
