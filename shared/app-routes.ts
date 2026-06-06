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
