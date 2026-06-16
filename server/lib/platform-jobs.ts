import { eq } from "drizzle-orm";
import { db } from "../db";
import { tenants } from "@shared/schema";
import { runNotificationDigests } from "./notification-digest";
import { runOrgDataRetention } from "./data-retention";
import { resetMonthlyAiBalances } from "./ai-tokens";
import { storage } from "../storage";

const DAILY_MS = 24 * 60 * 60 * 1000;

let started = false;

export function startPlatformBackgroundJobs(): void {
  if (process.env.DISABLE_PLATFORM_JOBS === "true") return;
  if (started) return;
  started = true;

  const runDaily = async () => {
    try {
      const digest = await runNotificationDigests();
      if (digest.sent > 0) console.log(`[platform-jobs] Digests sent: ${digest.sent}`);
    } catch (err) {
      console.warn("[platform-jobs] Digest error:", err);
    }

    try {
      const orgRows = await db.select({ id: tenants.id }).from(tenants);
      for (const { id } of orgRows) {
        await runOrgDataRetention(id);
      }
    } catch (err) {
      console.warn("[platform-jobs] Retention error:", err);
    }

    const day = new Date().getDate();
    if (day === 1) {
      const n = await resetMonthlyAiBalances();
      if (n > 0) console.log(`[platform-jobs] Reset AI balances for ${n} org(s)`);
    }

    try {
      const purged = await storage.purgeExpiredDeletedClients();
      if (purged > 0) console.log(`[platform-jobs] Purged ${purged} expired client workspace(s)`);
    } catch (err) {
      console.warn("[platform-jobs] Client purge error:", err);
    }

    try {
      const { retryFailedIntegrationDeliveries, runScheduledTimesheetExports } = await import("../resources/jobs");
      const retried = await retryFailedIntegrationDeliveries();
      const scheduled = await runScheduledTimesheetExports();
      if (retried > 0) console.log(`[platform-jobs] Retried ${retried} timesheet integration(s)`);
      if (scheduled > 0) console.log(`[platform-jobs] Scheduled ${scheduled} timesheet export(s)`);
    } catch (err) {
      console.warn("[platform-jobs] Timesheet integration jobs error:", err);
    }

    try {
      const { runPortfolioReportSchedules, runWeeklyHealthMatrixSnapshots } = await import("../portfolio/jobs");
      const reports = await runPortfolioReportSchedules();
      if (reports > 0) console.log(`[platform-jobs] Ran ${reports} portfolio report schedule(s)`);
      if (new Date().getDay() === 1) {
        const snapshots = await runWeeklyHealthMatrixSnapshots();
        if (snapshots > 0) console.log(`[platform-jobs] Captured ${snapshots} health matrix snapshot(s)`);
      }
    } catch (err) {
      console.warn("[platform-jobs] Portfolio report jobs error:", err);
    }

    try {
      const { runSurveyJobs } = await import("../surveys/jobs");
      const surveyJobs = await runSurveyJobs();
      if (surveyJobs.surveysClosed > 0 || surveyJobs.pollsClosed > 0) {
        console.log(`[platform-jobs] Surveys: closed ${surveyJobs.surveysClosed} survey(s), ${surveyJobs.pollsClosed} poll(s)`);
      }
    } catch (err) {
      console.warn("[platform-jobs] Survey jobs error:", err);
    }

    try {
      const { runEsignJobs } = await import("../signoff/jobs");
      const esignJobs = await runEsignJobs();
      if (esignJobs.expired > 0 || esignJobs.reminders > 0) {
        console.log(`[platform-jobs] eSign: expired ${esignJobs.expired}, reminders ${esignJobs.reminders}`);
      }
    } catch (err) {
      console.warn("[platform-jobs] eSign jobs error:", err);
    }
  };

  setTimeout(() => void runDaily(), 60_000);
  setInterval(() => void runDaily(), DAILY_MS);
  console.log("[platform-jobs] Daily jobs: digests, retention, client purge; AI reset on 1st of month");
}
