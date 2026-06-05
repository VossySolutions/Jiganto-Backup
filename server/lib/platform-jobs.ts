import { eq } from "drizzle-orm";
import { db } from "../db";
import { tenants } from "@shared/schema";
import { runNotificationDigests } from "./notification-digest";
import { runOrgDataRetention } from "./data-retention";
import { resetMonthlyAiBalances } from "./ai-tokens";

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
  };

  setTimeout(() => void runDaily(), 60_000);
  setInterval(() => void runDaily(), DAILY_MS);
  console.log("[platform-jobs] Daily jobs: digests, retention; AI reset on 1st of month");
}
