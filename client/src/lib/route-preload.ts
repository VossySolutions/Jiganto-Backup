/** Preload lazy route chunks on sidebar hover (no-op if already cached). */

const preloaded = new Set<string>();

const ROUTE_PRELOADERS: Record<string, () => Promise<unknown>> = {
  "/dashboard": () => import("@/pages/Dashboard"),
  "/modules/chat": () => import("@/pages/ChatPage"),
  "/modules/crm": () => import("@/pages/CRMPage"),
  "/modules/business-mgmt": () => import("@/pages/BusinessManagementPage"),
  "/modules/documents": () => import("@/pages/DocumentManagementPage"),
  "/modules/tasks": () => import("@/pages/TaskManagementPage"),
  "/modules/portfolio": () => import("@/pages/PortfolioManagementPage"),
  "/modules/projects": () => import("@/pages/ProjectsManagementPage"),
  "/modules/resource-planning": () => import("@/pages/ResourcePlanningPage"),
  "/modules/resource-mgmt": () => import("@/pages/ResourceManagementPage"),
  "/modules/bpm": () => import("@/pages/BPMPage"),
  "/modules/test-mgmt": () => import("@/pages/TestManagementPage"),
  "/modules/workspaces": () => import("@/pages/WorkspacesPage"),
  "/modules/service-desk": () => import("@/pages/ServiceDeskPage"),
  "/modules/help-desk": () => import("@/pages/HelpDeskPage"),
  "/modules/surveys": () => import("@/pages/SurveysPage"),
  "/modules/e-sign": () => import("@/pages/SignOffPage"),
  "/modules/whiteboarding": () => import("@/pages/WhiteboardPage"),
  "/modules/templates": () => import("@/pages/TemplatesPage"),
  "/modules/customer-mgmt": () => import("@/pages/CustomerManagementPage"),
  "/modules/finance-mgmt": () => import("@/pages/FinanceManagementPage"),
  "/clients": () => import("@/pages/ClientsPage"),
  "/settings": () => import("@/pages/SettingsPage"),
};

function resolvePreloadKey(href: string): string | null {
  const path = href.split("?")[0];
  if (ROUTE_PRELOADERS[path]) return path;
  if (path.startsWith("/ws/")) return "/dashboard";
  if (path.startsWith("/clients/")) return "/clients";
  if (path.startsWith("/modules/projects/")) return "/modules/projects";
  if (path.startsWith("/modules/whiteboarding/")) return "/modules/whiteboarding";
  if (path.startsWith("/settings/")) return "/settings";
  const prefix = Object.keys(ROUTE_PRELOADERS)
    .filter((k) => k !== "/dashboard" && k !== "/clients" && k !== "/settings")
    .find((k) => path.startsWith(k));
  return prefix ?? null;
}

export function preloadRoute(href: string): void {
  const key = resolvePreloadKey(href);
  if (!key || preloaded.has(key)) return;
  preloaded.add(key);
  void ROUTE_PRELOADERS[key]();
}
