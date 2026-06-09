import { CLIENT_WORKSPACE_ALWAYS_HIDDEN_KEYS } from "@shared/client-workspace-modules";
import { navPathToModuleKey } from "@shared/models/module-access";

const ACTION_MODULE_MAP: Record<string, string> = {
  "nav-crm": "crm",
  "nav-business": "business-mgmt",
  "nav-clients": "clients",
  "create-opportunity": "crm",
  "create-account": "crm",
  "create-contact": "crm",
};

export const NAV_ACTION_PATHS: Record<string, string> = {
  "nav-crm": "/modules/crm",
  "nav-business": "/modules/business-mgmt",
  "nav-clients": "/clients",
};

const HIDDEN_MODULE_TO_PREFIX: Record<string, string[]> = {
  "business-mgmt": ["/modules/business-mgmt"],
  crm: ["/modules/crm"],
  "finance-mgmt": ["/modules/finance-mgmt"],
  clients: ["/clients", "/modules/clients"],
};

export function isCommandActionAllowedInWorkspace(
  actionId: string,
  navigatePath: string | undefined,
  inClientWorkspace: boolean,
): boolean {
  if (!inClientWorkspace) return true;
  const mapped = ACTION_MODULE_MAP[actionId];
  if (mapped && CLIENT_WORKSPACE_ALWAYS_HIDDEN_KEYS.has(mapped)) return false;
  if (navigatePath) {
    const key = navPathToModuleKey(navigatePath);
    if (key && CLIENT_WORKSPACE_ALWAYS_HIDDEN_KEYS.has(key)) return false;
  }
  return true;
}

export function isNotificationRelevantInWorkspace(
  notification: { clientId?: number | null; source?: string | null },
  activeClientId: number | null,
): boolean {
  if (!activeClientId) return true;
  if (notification.clientId != null) return notification.clientId === activeClientId;
  const siSources = new Set(["crm", "business", "finance", "customer-mgmt"]);
  if (notification.source && siSources.has(notification.source)) return false;
  return true;
}

export const SI_DASHBOARD_MODULES = new Set(["business", "crm", "finance"]);

export function siModuleLabel(module: string): string {
  const labels: Record<string, string> = {
    business: "Business Management",
    crm: "CRM",
    finance: "Finance",
  };
  return labels[module] ?? module;
}
