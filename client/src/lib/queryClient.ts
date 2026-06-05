import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { withWorkspaceScope } from "./workspace-scope";
import { getStaffOrgOverride } from "./staff-org-scope";
import { getSupabaseAccessToken } from "./supabase-session";
import { supabaseAuthEnabled } from "./supabase";

/** Set by ClientContextProvider — scopes /api/* GETs to active client workspace. */
let activeWorkspaceClientId: number | null = null;
let apiReadOnly = false;

export function setActiveWorkspaceClientId(clientId: number | null) {
  activeWorkspaceClientId = clientId;
}

/** Set by ClientContextProvider when platform role is read-only (Section 3). */
export function setApiReadOnly(readOnly: boolean) {
  apiReadOnly = readOnly;
}

function scopeApiUrl(url: string): string {
  let scoped = url;
  const staffOrg = getStaffOrgOverride();
  if (
    staffOrg != null &&
    scoped.startsWith("/api") &&
    !scoped.includes("tenantId=") &&
    !scoped.startsWith("/api/auth/config")
  ) {
    const sep = scoped.includes("?") ? "&" : "?";
    scoped = `${scoped}${sep}tenantId=${staffOrg}`;
  }
  if (!activeWorkspaceClientId) return scoped;
  if (!scoped.startsWith("/api")) return scoped;
  if (scoped.includes("clientId=")) return scoped;
  if (scoped.startsWith("/api/clients/pmo-dashboard")) return scoped;
  if (scoped.startsWith("/api/clients/me")) return scoped;
  if (scoped.startsWith("/api/pm/projects") && scoped.includes("tenantId=")) return scoped;
  if (scoped.startsWith("/api/auth/")) return scoped;
  if (scoped.startsWith("/api/settings/")) return scoped;
  if (scoped.startsWith("/api/org-memberships")) return scoped;
  if (scoped.startsWith("/api/tenants")) return scoped;
  if (scoped.startsWith("/api/client-workspace-grants")) return scoped;
  return withWorkspaceScope(scoped, activeWorkspaceClientId);
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const raw = (await res.text()) || res.statusText;
    try {
      const parsed = JSON.parse(raw) as { message?: string; code?: string };
      if (parsed.code === "ACCESS_PENDING") {
        throw new Error(
          "Your account is authenticated, but access is pending. Ask your admin to assign an organisation role or accept your invite link.",
        );
      }
      if (parsed.message) {
        throw new Error(`${res.status}: ${parsed.message}`);
      }
    } catch {
      // Not JSON; fall back to raw text.
    }
    throw new Error(`${res.status}: ${raw}`);
  }
}

async function authHeaders(
  includeJson = false,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (includeJson) headers["Content-Type"] = "application/json";
  if (supabaseAuthEnabled) {
    const token = await getSupabaseAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/** Fetch with Supabase bearer token (required in production auth mode). */
export async function fetchWithAuth(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const auth = await authHeaders();
  const merged = new Headers(init?.headers);
  for (const [k, v] of Object.entries(auth)) {
    if (v) merged.set(k, v);
  }
  return fetch(scopeApiUrl(url), {
    ...init,
    credentials: "include",
    headers: merged,
  });
}

const READ_ONLY_WRITE_EXEMPT_PREFIXES = [
  "/api/auth/bootstrap-admin",
  "/api/auth/clear-dev-session",
  "/api/auth/invitations/",
];

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const isSetupWrite =
    method.toUpperCase() !== "GET" &&
    READ_ONLY_WRITE_EXEMPT_PREFIXES.some((p) => url.startsWith(p));
  if (apiReadOnly && method.toUpperCase() !== "GET" && !isSetupWrite) {
    throw new Error("Read-only: your role cannot modify data.");
  }
  const headers = await authHeaders(Boolean(data));
  const res = await fetch(scopeApiUrl(url), {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const raw = queryKey.join("/") as string;
    const headers = await authHeaders();
    const res = await fetch(scopeApiUrl(raw), {
      credentials: "include",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
