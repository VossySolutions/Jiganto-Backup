import {
  DEFAULT_ORG_NOTIFICATION_DEFAULTS,
  NOTIFICATION_CATEGORIES,
  type OrgNotificationSettings,
} from "@shared/models/org-notifications";

export function mergeOrgNotificationSettings(raw: unknown): OrgNotificationSettings {
  const base: OrgNotificationSettings = {
    defaults: { ...DEFAULT_ORG_NOTIFICATION_DEFAULTS },
    digestMode: "off",
  };
  if (!raw || typeof raw !== "object") return base;
  const src = raw as Record<string, unknown>;
  const digest = src.digestMode;
  if (digest === "daily" || digest === "weekly" || digest === "off") {
    base.digestMode = digest;
  }
  const defaultsRaw = src.defaults;
  if (!defaultsRaw || typeof defaultsRaw !== "object") return base;
  const merged = { ...base.defaults! };
  for (const cat of NOTIFICATION_CATEGORIES) {
    const row = (defaultsRaw as Record<string, unknown>)[cat];
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    merged[cat] = {
      inApp: r.inApp !== undefined ? !!r.inApp : merged[cat]?.inApp,
      email: r.email !== undefined ? !!r.email : merged[cat]?.email,
    };
  }
  base.defaults = merged;
  return base;
}
