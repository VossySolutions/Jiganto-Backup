/** Public sign-in / marketing landing page. */
export const LANDING_PATH = "/";

/** Authenticated platform home (dashboard). */
export const DASHBOARD_PATH = "/dashboard";

export function isDashboardPath(pathname: string): boolean {
  return pathname === DASHBOARD_PATH || pathname.startsWith("/ws/");
}

export function workspaceDashboardPath(slug: string): string {
  return `/ws/${slug}`;
}

/** Client workspaces module (Module 05 — spec route). */
export const CLIENTS_PATH = "/clients";

export function clientDetailPath(id: number): string {
  return `${CLIENTS_PATH}/${id}`;
}
