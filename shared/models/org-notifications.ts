/** Organisation-wide notification defaults (tenant.brandingConfig.orgNotificationDefaults). */

export const NOTIFICATION_CATEGORIES = [
  "projects",
  "finance",
  "helpDesk",
  "serviceDesk",
  "eSign",
  "surveys",
  "testManagement",
  "system",
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  projects: "Projects",
  finance: "Finance",
  helpDesk: "Help Desk",
  serviceDesk: "Service Desk",
  eSign: "eSign",
  surveys: "Surveys",
  testManagement: "Test Management",
  system: "System",
};

export type OrgNotificationChannelPrefs = {
  inApp?: boolean;
  email?: boolean;
};

export type OrgNotificationDefaults = Partial<
  Record<NotificationCategory, OrgNotificationChannelPrefs>
>;

export type OrgNotificationSettings = {
  defaults?: OrgNotificationDefaults;
  digestMode?: "off" | "daily" | "weekly";
};

export const DEFAULT_ORG_NOTIFICATION_DEFAULTS: OrgNotificationDefaults = {
  projects: { inApp: true, email: true },
  finance: { inApp: true, email: true },
  helpDesk: { inApp: true, email: true },
  serviceDesk: { inApp: true, email: true },
  eSign: { inApp: true, email: true },
  surveys: { inApp: true, email: false },
  testManagement: { inApp: true, email: false },
  system: { inApp: true, email: true },
};
