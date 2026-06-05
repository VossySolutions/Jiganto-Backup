/** Modules configurable in Settings → Users / Module roles (legacy). */
export const SETTINGS_MODULE_KEYS = [
  { key: "dashboard", name: "Dashboard" },
  { key: "chat", name: "Chat" },
  { key: "business-mgmt", name: "Business Management" },
  { key: "crm", name: "CRM" },
  { key: "documents", name: "Documents" },
  { key: "tasks", name: "Tasks" },
  { key: "portfolio-mgmt", name: "Portfolio" },
  { key: "project-mgmt", name: "Projects" },
  { key: "finance-mgmt", name: "Finance" },
  { key: "resource-mgmt", name: "Resources" },
  { key: "test-mgmt", name: "Testing" },
  { key: "bpm", name: "BPM" },
  { key: "workspaces", name: "Workspaces" },
] as const;

/** Maps sidebar routes to legacy module permission keys (Settings → Module roles). */
export const NAV_PATH_TO_MODULE_KEY: Record<string, string> = {
  "/": "dashboard",
  "/modules/chat": "chat",
  "/modules/documents": "documents",
  "/modules/business-mgmt": "business-mgmt",
  "/modules/clients": "crm",
  "/modules/crm": "crm",
  "/modules/finance-mgmt": "finance-mgmt",
  "/modules/resource-mgmt": "resource-mgmt",
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
};

/** Longest-prefix match for API module guard (ordered longest first). */
export const API_PREFIX_TO_MODULE_KEY: readonly [string, string][] = [
  ["/api/org-chart-templates", "org-chart"],
  ["/api/org-charts", "org-chart"],
  ["/api/org-chart", "org-chart"],
  ["/api/business", "business-mgmt"],
  ["/api/portfolio", "portfolio-mgmt"],
  ["/api/pm", "project-mgmt"],
  ["/api/crm", "crm"],
  ["/api/documents", "documents"],
  ["/api/tasks", "tasks"],
  ["/api/resources", "resource-mgmt"],
  ["/api/finance", "finance-mgmt"],
  ["/api/bpm", "bpm"],
  ["/api/tm", "test-mgmt"],
  ["/api/surveys", "surveys"],
  ["/api/signoff", "e-sign"],
  ["/api/frameworks", "templates"],
  ["/api/portal", "help-desk"],
  ["/api/workspaces", "workspaces"],
  ["/api/conversations", "chat"],
];

/** Hidden in client workspace view for client_project_user / client_executive (Section 4). */
export const CLIENT_WORKSPACE_BLOCKED_MODULE_KEYS = new Set([
  "business-mgmt",
  "crm",
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
