import type { InsertNotification, Tenant } from "@shared/schema";
import { storage } from "../storage";
import { authStorage } from "../auth/storage";
import { mergeNotificationPreferences } from "./notification-preferences";
import { sendOrgEmail } from "./org-email";
import type { NotificationCategory } from "@shared/models/org-notifications";

const CATEGORY_MODULE: Record<NotificationCategory, string> = {
  projects: "projects",
  finance: "finance",
  helpDesk: "help-desk",
  serviceDesk: "service-desk",
  eSign: "e-sign",
  surveys: "surveys",
  testManagement: "test-mgmt",
  system: "system",
};

export async function notifyUser(params: {
  userId: string;
  tenantId?: number | null;
  tenant?: Tenant | null;
  title: string;
  message?: string;
  type?: InsertNotification["type"];
  source?: string;
  sourceId?: string;
  category?: NotificationCategory;
  emailSubject?: string;
}): Promise<void> {
  const user = await authStorage.getUser(params.userId);
  const prefs = mergeNotificationPreferences(user?.preferences);
  const orgDefaults = (
    params.tenant?.brandingConfig as {
      orgNotifications?: { defaults?: Record<string, { inApp?: boolean; email?: boolean }> };
    }
  )?.orgNotifications?.defaults;
  const cat = params.category ?? "system";
  const catPrefs = orgDefaults?.[cat];

  const inAppAllowed = catPrefs?.inApp !== false && prefs.inAppWorkflow !== false;
  const emailAllowed = catPrefs?.email !== false && prefs.emailWorkflow !== false;

  if (inAppAllowed) {
    await storage.createNotification({
      userId: params.userId,
      tenantId: params.tenantId ?? params.tenant?.id ?? null,
      title: params.title,
      message: params.message ?? null,
      type: params.type ?? "workflow",
      source: params.source ?? CATEGORY_MODULE[cat],
      sourceId: params.sourceId ?? null,
    });
  }

  if (emailAllowed && user?.email) {
    await sendOrgEmail({
      tenant: params.tenant ?? (params.tenantId ? await storage.getTenant(params.tenantId) : null),
      to: user.email,
      subject: params.emailSubject ?? params.title,
      html: `<p>${params.message ?? params.title}</p>`,
    });
  }
}
