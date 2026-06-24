import type { PlatformRole } from "@shared/models/permissions";

/** Settings tabs — spec §1 two-tier model + personal (all users). */
export type SettingsTabId =
  | "personal"
  | "organization"
  | "users"
  | "customers"
  | "cost-centres"
  | "branding"
  | "roles"
  | "audit"
  | "integrations"
  | "notifications"
  | "billing"
  | "data"
  | "ai-usage"
  | "crm";

export type SettingsTier = "personal" | "workspace" | "system";

export interface SettingsAccess {
  tier: SettingsTier;
  tierLabel: string;
  subtitle: string;
  tabs: SettingsTabId[];
}

const PERSONAL: SettingsTabId[] = ["personal"];

const WORKSPACE: SettingsTabId[] = ["personal", "users", "customers", "crm", "audit"];

const SYSTEM: SettingsTabId[] = [
  "personal",
  "organization",
  "users",
  "customers",
  "cost-centres",
  "branding",
  "roles",
  "audit",
  "integrations",
  "notifications",
  "billing",
  "data",
  "ai-usage",
  "crm",
];

/** SI Super Admin + Jiganto Staff — compliance / impersonation audit. */
export function canViewSettingsAudit(
  platformRole?: PlatformRole,
  isJigantoStaff?: boolean,
): boolean {
  return !!isJigantoStaff || platformRole === "si_super_admin";
}

/**
 * Who sees what in Settings (spec image 1).
 * - System: SI Super Admin + Jiganto Staff
 * - Workspace: Client Jiganto User (org admin)
 * - Personal only: consultants, client project/executive users
 */
export function getSettingsAccess(
  platformRole?: PlatformRole,
  isJigantoStaff?: boolean,
): SettingsAccess {
  if (isJigantoStaff || platformRole === "si_super_admin") {
    return {
      tier: "system",
      tierLabel: "System administration",
      subtitle: "Manage your organisation, users, client workspaces, and permissions",
      tabs: SYSTEM,
    };
  }

  if (platformRole === "client_jiganto_user") {
    return {
      tier: "workspace",
      tierLabel: "Workspace administration",
      subtitle: "Manage team members and customer users in your organisation",
      tabs: WORKSPACE,
    };
  }

  return {
    tier: "personal",
    tierLabel: "Personal settings",
    subtitle: "Your profile and display preferences",
    tabs: PERSONAL,
  };
}

export function tenantNeedsAdminFetch(tabs: SettingsTabId[]): boolean {
  return tabs.some(
    (t) =>
      t === "organization" ||
      t === "branding" ||
      t === "billing" ||
      t === "integrations" ||
      t === "notifications" ||
      t === "data" ||
      t === "ai-usage",
  );
}

export function usersDataNeeded(tabs: SettingsTabId[]): boolean {
  return tabs.some((t) => t === "users" || t === "customers" || t === "roles");
}

/** Prefer trading/display name in header when set (spec §2.1). */
export function organisationDisplayName(tenant: {
  name: string;
  brandingConfig?: unknown;
} | null | undefined): string | undefined {
  if (!tenant) return undefined;
  const cfg = tenant.brandingConfig as { displayName?: string } | null | undefined;
  const display = cfg?.displayName?.trim();
  if (display) return display;
  return tenant.name?.trim() || undefined;
}
