import { CLIENT_WORKSPACE_ALWAYS_HIDDEN_KEYS } from "../client-workspace-modules";

/** Modules configurable in Settings → Users / Module roles (legacy). */
export const SETTINGS_MODULE_KEYS = [
  { key: "dashboard", name: "Dashboard" },
  { key: "chat", name: "Chat" },
  { key: "clients", name: "Clients" },
  { key: "business-mgmt", name: "Business Management" },
  { key: "crm", name: "CRM" },
  { key: "documents", name: "Documents" },
  { key: "tasks", name: "Tasks" },
  { key: "portfolio-mgmt", name: "Portfolio" },
  { key: "project-mgmt", name: "Projects" },
  { key: "customer-mgmt", name: "Customer Management" },
  { key: "finance-mgmt", name: "Finance" },
  { key: "resource-mgmt", name: "Resources" },
  { key: "resource-planning", name: "Resource Planning" },
  { key: "test-mgmt", name: "Testing" },
  { key: "bpm", name: "BPM" },
  { key: "workspaces", name: "Workspaces" },
  { key: "service-desk", name: "Service Desk" },
  { key: "help-desk", name: "Help Desk" },
  { key: "surveys", name: "Surveys" },
  { key: "e-sign", name: "e-Sign" },
  { key: "whiteboard", name: "Whiteboard" },
  { key: "templates", name: "Templates" },
] as const;

import { DASHBOARD_PATH, LANDING_PATH } from "../app-routes";

/** Maps sidebar routes to legacy module permission keys (Settings → Module roles). */
export const NAV_PATH_TO_MODULE_KEY: Record<string, string> = {
  [LANDING_PATH]: "dashboard",
  [DASHBOARD_PATH]: "dashboard",
  "/modules/chat": "chat",
  "/modules/documents": "documents",
  "/modules/business-mgmt": "business-mgmt",
  "/clients": "clients",
  "/modules/clients": "clients",
  "/modules/crm": "crm",
  "/modules/finance-mgmt": "finance-mgmt",
  "/modules/resource-mgmt": "resource-mgmt",
  "/modules/resource-planning": "resource-planning",
  "/modules/portfolio": "portfolio-mgmt",
  "/modules/projects": "project-mgmt",
  "/modules/tasks": "tasks",
  "/modules/workspaces": "workspaces",
  "/modules/service-desk": "service-desk",
  "/modules/help-desk": "help-desk",
  "/modules/test-mgmt": "test-mgmt",
  "/modules/bpm": "bpm",
  "/modules/surveys": "surveys",
  "/modules/e-sign": "e-sign",
  "/modules/whiteboarding": "whiteboard",
  "/modules/templates": "templates",
  "/modules/customer-mgmt": "customer-mgmt",
};

/** Longest-prefix match for API module guard (ordered longest first). */
export const API_PREFIX_TO_MODULE_KEY: readonly [string, string][] = [
  ["/api/org-chart-templates", "org-chart"],
  ["/api/org-charts", "org-chart"],
  ["/api/org-chart", "org-chart"],
  ["/api/business", "business-mgmt"],
  ["/api/clients", "clients"],
  ["/api/portfolio", "portfolio-mgmt"],
  ["/api/pm/portfolios", "portfolio-mgmt"],
  ["/api/pm/programs", "portfolio-mgmt"],
  ["/api/pm", "project-mgmt"],
  ["/api/crm", "crm"],
  ["/api/documents", "documents"],
  ["/api/tasks", "tasks"],
  ["/api/resources", "resource-mgmt"],
  ["/api/resource-planning", "resource-planning"],
  ["/api/finance", "finance-mgmt"],
  ["/api/bpm", "bpm"],
  ["/api/tm", "test-mgmt"],
  ["/api/surveys", "surveys"],
  ["/api/signoff", "e-sign"],
  ["/api/templates", "templates"],
  ["/api/frameworks", "templates"],
  ["/api/portal", "help-desk"],
  ["/api/help-desk", "help-desk"],
  ["/api/workspaces", "workspaces"],
  ["/api/service-desk", "service-desk"],
  ["/api/conversations", "chat"],
  ["/api/chat", "chat"],
  ["/api/customer-mgmt", "customer-mgmt"],
  ["/api/whiteboard", "whiteboard"],
];

/** Always hidden in client workspace for all users (Docs §5). */
export const CLIENT_WORKSPACE_BLOCKED_MODULE_KEYS = CLIENT_WORKSPACE_ALWAYS_HIDDEN_KEYS;

/** Modules visible in contractor portal (limited sidebar). */
export const CONTRACTOR_PORTAL_ALLOWED_MODULE_KEYS = new Set([
  "dashboard",
  "resource-mgmt",
  "documents",
  "tasks",
  "chat",
]);

/** Additional modules hidden for client-role users only. */
export const CLIENT_ROLE_EXTRA_BLOCKED_MODULE_KEYS = new Set([
  "resource-mgmt",
  "bpm",
  "test-mgmt",
  "workspaces",
  "surveys",
  "e-sign",
  "templates",
  "org-chart",
  "help-desk",
]);

export function apiPathToModuleKey(path: string): string | null {
  for (const [prefix, key] of API_PREFIX_TO_MODULE_KEY) {
    if (path.startsWith(prefix)) return key;
  }
  return null;
}

export function navPathToModuleKey(href: string): string | null {
  return NAV_PATH_TO_MODULE_KEY[href] ?? null;
}
