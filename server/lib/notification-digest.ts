import { eq } from "drizzle-orm";
import { db } from "../db";
import { tenants, users as usersTable } from "@shared/schema";
import { orgMemberships } from "@shared/models/permissions";
import { storage } from "../storage";
import { mergeNotificationPreferences } from "./notification-preferences";
import { sendOrgEmail } from "./org-email";
import type { OrgNotificationSettings } from "@shared/models/org-notifications";

/** Send digest emails for orgs with digestMode daily|weekly (best-effort). */
export async function runNotificationDigests(): Promise<{ sent: number; skipped: number }> {
  const allTenants = await db.select().from(tenants);
  let sent = 0;
  let skipped = 0;

  for (const tenant of allTenants) {
    const orgNotif = (tenant.brandingConfig as { orgNotifications?: OrgNotificationSettings })
      ?.orgNotifications;
    const mode = orgNotif?.digestMode;
    if (mode !== "daily" && mode !== "weekly") {
      skipped++;
      continue;
    }

    const members = await db
      .select({ userId: orgMemberships.userId })
      .from(orgMemberships)
      .where(eq(orgMemberships.orgId, tenant.id));

    for (const { userId } of members) {
      const [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);
      if (!user?.email) continue;
      const prefs = mergeNotificationPreferences(user.preferences);
      if (mode === "weekly" && !prefs.emailWeeklyDigest) continue;
      if (mode === "daily" && !prefs.emailWorkflow) continue;

      const unread = await storage.getUnreadNotificationCount(userId);
      if (unread === 0) continue;

      const result = await sendOrgEmail({
        tenant,
        to: user.email,
        subject: `Jiganto ${mode} digest — ${unread} notification${unread === 1 ? "" : "s"}`,
        html: `<p>You have <strong>${unread}</strong> unread in-app notification(s).</p><p>Sign in to Jiganto to review them.</p>`,
      });
      if (result.sent) sent++;
    }
  }

  return { sent, skipped };
}
