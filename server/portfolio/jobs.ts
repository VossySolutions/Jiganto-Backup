import { db } from "../db";
import { pmReportSchedules, tenants } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  generate360Report,
  saveReportSnapshot,
  getPortfolioSummaryReport,
  getMilestoneRegister,
} from "./service";
import { captureHealthMatrixSnapshots } from "./health-history";
import { build360ReportPptx, map360ReportToPptxInput } from "./pptx-export";
import { sendPortfolioReportEmails } from "./report-email";

/** Capture weekly health matrix snapshots for all tenants (Monday job). */
export async function runWeeklyHealthMatrixSnapshots(): Promise<number> {
  const tenantRows = await db.select({ id: tenants.id }).from(tenants);
  let total = 0;
  for (const { id } of tenantRows) {
    total += await captureHealthMatrixSnapshots(id);
  }
  return total;
}

async function buildScheduledReportContent(
  sched: typeof pmReportSchedules.$inferSelect,
): Promise<Record<string, unknown> | null> {
  if (sched.reportType === "360_report" && sched.projectId) {
    const report = await generate360Report(sched.tenantId, sched.projectId);
    if (!report) return null;
    const content: Record<string, unknown> = { ...report };
    if (sched.format === "pptx") {
      const buffer = await build360ReportPptx(map360ReportToPptxInput(report));
      content.pptxBase64 = buffer.toString("base64");
    }
    return content;
  }

  if (sched.reportType === "portfolio_summary") {
    const rows = await getPortfolioSummaryReport(sched.tenantId);
    return { rows, generatedAt: new Date().toISOString() };
  }

  if (sched.reportType === "milestone_register") {
    const rows = await getMilestoneRegister(sched.tenantId);
    return { rows, generatedAt: new Date().toISOString() };
  }

  return null;
}

/** Run due portfolio report schedules (daily job). */
export async function runPortfolioReportSchedules(): Promise<number> {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const schedules = await db.select().from(pmReportSchedules);

  let ran = 0;
  for (const sched of schedules) {
    const due =
      sched.frequency === "daily" ||
      (sched.frequency === "weekly" && (sched.dayOfWeek ?? 1) === dayOfWeek) ||
      (sched.frequency === "monthly" && now.getDate() === 1);

    if (!due) continue;

    const lastRun = sched.lastRunAt ? new Date(sched.lastRunAt) : null;
    if (lastRun && now.getTime() - lastRun.getTime() < 20 * 60 * 60 * 1000) continue;

    try {
      const content = await buildScheduledReportContent(sched);
      if (content) {
        const snapshot = await saveReportSnapshot(
          sched.tenantId,
          sched.reportType,
          content,
          sched.createdBy || "system",
          sched.projectId ?? undefined,
          sched.portfolioId ?? undefined,
        );

        const recipientIds = Array.isArray(sched.recipientIds) ? sched.recipientIds : [];
        if (recipientIds.length) {
          const emailResult = await sendPortfolioReportEmails({
            tenantId: sched.tenantId,
            reportType: sched.reportType,
            format: sched.format || "pdf",
            content,
            recipientIds,
            projectId: sched.projectId,
            snapshotId: snapshot.id,
          });
          if (emailResult.sent > 0) {
            console.log(`[portfolio-jobs] Emailed schedule ${sched.id} to ${emailResult.sent} recipient(s)`);
          }
        }
      }

      await db
        .update(pmReportSchedules)
        .set({ lastRunAt: now, updatedAt: now })
        .where(eq(pmReportSchedules.id, sched.id));
      ran++;
    } catch (err) {
      console.warn(`[portfolio-jobs] Schedule ${sched.id} failed:`, err);
    }
  }
  return ran;
}
