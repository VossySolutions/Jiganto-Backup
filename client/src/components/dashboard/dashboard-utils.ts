import type { QueryClient } from "@tanstack/react-query";

export function scopeQuery(base: string, clientId?: number | null, projectId?: number | null) {
  const params = new URLSearchParams();
  if (clientId) params.set("clientId", String(clientId));
  if (projectId) params.set("projectId", String(projectId));
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

export function invalidateDashboardDetail(queryClient: QueryClient, dashboardId: number) {
  void queryClient.invalidateQueries({
    predicate: (query) =>
      typeof query.queryKey[0] === "string" &&
      query.queryKey[0].startsWith(`/api/dashboards/${dashboardId}`),
  });
}

export function bespokeGridClass(layout: string): string {
  switch (layout) {
    case "1-col":
      return "grid-cols-1";
    case "3-col":
      return "grid-cols-1 md:grid-cols-2 xl:grid-cols-3";
    default:
      return "grid-cols-1 md:grid-cols-2";
  }
}

export function widgetSpanClass(width: number, columns: number): string {
  if (columns <= 1 || width <= 1) return "";
  if (columns === 2 && width >= 2) return "md:col-span-2";
  if (columns >= 3 && width >= 3) return "md:col-span-2 xl:col-span-3";
  if (columns >= 3 && width >= 2) return "md:col-span-2";
  return "";
}
