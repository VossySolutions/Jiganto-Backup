import type { Client } from "@/hooks/use-client-context";

/** Append workspace scope query for API calls (Section 4.1). */
export function withWorkspaceScope(url: string, clientId: number | null): string {
  if (!clientId) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}clientId=${clientId}`;
}

export function workspacePathFromClient(client: Pick<Client, "slug"> | null): string {
  if (!client?.slug) return "/";
  return `/ws/${client.slug}`;
}

export function parseWorkspaceSlug(pathname: string): string | null {
  const m = pathname.match(/^\/ws\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
