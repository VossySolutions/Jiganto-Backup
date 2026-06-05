import { useQuery } from "@tanstack/react-query";
import type { PlatformRole, PermissionLevel } from "@shared/models/permissions";
import { useAuth } from "@/hooks/use-auth";
import { getSupabaseAccessToken } from "@/lib/supabase-session";
import { getStaffOrgOverride } from "@/lib/staff-org-scope";

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
  canViewPmoMaster: boolean;
}

type SessionPayload = {
  permissions: SessionPermissions;
  workspace?: SessionWorkspace;
};

async function fetchSessionPermissions(): Promise<SessionPayload | null> {
  const token = await getSupabaseAccessToken();
  const res = await fetch("/api/auth/session", {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  const data = await res.json();
  return {
    permissions: data.permissions as SessionPermissions,
    workspace: data.workspace as SessionWorkspace | undefined,
  };
}

export function usePermissions() {
  const { isAuthenticated, sessionReady } = useAuth();
  const { data: access } = useQuery<{ granted: boolean }>({
    queryKey: ["/api/auth/access"],
    enabled: sessionReady && isAuthenticated,
    staleTime: 60_000,
  });
  const accessGranted = access?.granted === true;

  const staffOrg = getStaffOrgOverride();

  const { data, isLoading } = useQuery({
    queryKey: ["/api/auth/session", staffOrg],
    queryFn: () => fetchSessionPermissions(staffOrg),
    enabled: sessionReady && isAuthenticated && accessGranted,
    staleTime: 60_000,
  });

  const permissions = data?.permissions;

  return {
    permissions,
    workspace: data?.workspace,
    isLoading: isLoading || !sessionReady,
    sessionReady,
    isAuthenticated,
    isReadOnly: permissions?.isReadOnly ?? false,
    showContextSwitcher: permissions?.showContextSwitcher ?? false,
    platformRole: permissions?.platformRole,
    isJigantoStaff: permissions?.isJigantoStaff ?? false,
  };
}
