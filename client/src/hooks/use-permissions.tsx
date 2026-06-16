import { useQuery } from "@tanstack/react-query";
import type { PlatformRole, PermissionLevel } from "@shared/models/permissions";
import { useAuth } from "@/hooks/use-auth";
import { getSupabaseAccessToken } from "@/lib/supabase-session";
import { getStaffOrgOverride } from "@/lib/staff-org-scope";
import type { ResourceScope } from "@/types/resources-scope";

export interface SessionPermissions {
  userId: string;
  orgId: number;
  platformRole: PlatformRole;
  permissionLevel: PermissionLevel;
  isReadOnly: boolean;
  showContextSwitcher: boolean;
  canAccessMultipleWorkspaces: boolean;
  canViewPmoMaster?: boolean;
  lockedWorkspaceId: number | null;
  isJigantoStaff: boolean;
  orgRoles: { orgId: number; platformRole: PlatformRole }[];
}

export interface SessionWorkspace {
  mode: "master" | "client";
  clientId: number | null;
  workspaceId?: number | null;
  canViewPmoMaster: boolean;
  client?: {
    id: number;
    name: string;
    slug?: string | null;
    shortCode: string;
    color: string;
    status: string;
  } | null;
}

type SessionPayload = {
  permissions: SessionPermissions;
  workspace?: SessionWorkspace;
  resourceScope?: ResourceScope;
};

async function fetchSessionPermissions(staffOrg?: number | null): Promise<SessionPayload | null> {
  const token = await getSupabaseAccessToken();
  const url = staffOrg != null ? `/api/auth/session?orgId=${staffOrg}` : "/api/auth/session";
  const res = await fetch(url, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  const data = await res.json();
  return {
    permissions: data.permissions as SessionPermissions,
    workspace: data.workspace as SessionWorkspace | undefined,
    resourceScope: data.resourceScope,
  };
}

export function usePermissions() {
  const { isAuthenticated, sessionReady } = useAuth();
  const { data: access } = useQuery<{ granted: boolean }>({
    queryKey: ["/api/auth/access"],
    enabled: sessionReady && isAuthenticated,
    staleTime: 5 * 60_000,
  });
  const accessGranted = access?.granted === true;

  const staffOrg = getStaffOrgOverride();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/auth/session", staffOrg],
    queryFn: () => fetchSessionPermissions(staffOrg),
    enabled: sessionReady && isAuthenticated && accessGranted,
    staleTime: 5 * 60_000,
  });

  const permissions = data?.permissions;

  return {
    permissions,
    workspace: data?.workspace,
    resourceScope: data?.resourceScope,
    isLoading: isLoading || !sessionReady,
    sessionReady,
    isAuthenticated,
    isReadOnly: permissions?.isReadOnly ?? false,
    showContextSwitcher: permissions?.showContextSwitcher ?? false,
    platformRole: permissions?.platformRole,
    isJigantoStaff: permissions?.isJigantoStaff ?? false,
  };
}
