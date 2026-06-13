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
      return "grid-cols-1 lg:grid-cols-3";
    default:
      return "grid-cols-1 lg:grid-cols-2";
  }
}

export function widgetSpanClass(width: number, columns: number): string {
  if (columns <= 1) return "";
  const span = Math.min(Math.max(width, 1), columns);
  if (span >= columns) {
    return columns === 3 ? "lg:col-span-3" : "lg:col-span-2";
  }
  if (span === 2 && columns >= 2) return "lg:col-span-2";
  return "";
}
