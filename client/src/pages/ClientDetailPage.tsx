import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CLIENTS_PATH } from "@shared/app-routes";
import { Redirect, useRoute } from "wouter";
import { ModuleShell } from "@/components/ModuleShell";
import { useClientContext } from "@/hooks/use-client-context";
import { usePermissions } from "@/hooks/use-permissions";
import { fetchWithAuth } from "@/lib/queryClient";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { ClientMembersPanel } from "@/components/clients/ClientMembersPanel";
import { ClientModuleVisibilityPanel } from "@/components/clients/ClientModuleVisibilityPanel";
import { ClientDetailContent } from "@/components/clients/ClientDetailContent";
import { ClientsDetailLoading, ClientsPanelState } from "@/components/clients/ClientLoadingStates";
import type { ClientWorkspace } from "@/components/clients/types";
import type { PlatformRole } from "@shared/models/permissions";

export default function ClientDetailPage() {
  const [, params] = useRoute("/clients/:id");
  const clientId = Number(params?.id);
  const { isClientUser } = useClientContext();
  const { platformRole, isJigantoStaff, permissions } = usePermissions();
  const tenantId = permissions?.orgId;

  const canAccess =
    isJigantoStaff ||
    platformRole === "si_super_admin" ||
    platformRole === "si_consultant_pm" ||
    platformRole === "jiganto_staff";
  const canCreate = isJigantoStaff || platformRole === "si_super_admin";

  const [showForm, setShowForm] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showVisibility, setShowVisibility] = useState(false);

  const { data: client, isLoading, isError, error, refetch } = useQuery<ClientWorkspace>({
    queryKey: ["/api/clients", clientId],
    enabled: canAccess && Number.isFinite(clientId) && clientId > 0,
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/clients/${clientId}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: orgData } = useQuery({
    queryKey: ["/api/org-memberships", tenantId],
    enabled: canAccess && !!tenantId,
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/org-memberships?orgId=${tenantId}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{
        memberships: {
          userId: string;
          platformRole: PlatformRole;
          user?: { email: string | null; firstName: string | null; lastName: string | null };
        }[];
      }>;
    },
  });

  const siMembers = (orgData?.memberships ?? [])
    .filter((m) => m.platformRole === "si_consultant_pm" || m.platformRole === "si_super_admin")
    .map((m) => ({
      userId: m.userId,
      label:
        `${m.user?.firstName ?? ""} ${m.user?.lastName ?? ""}`.trim() ||
        m.user?.email ||
        m.userId,
    }));

  if (isClientUser || !canAccess) return <Redirect to="/" />;
  if (!Number.isFinite(clientId) || clientId <= 0) return <Redirect to={CLIENTS_PATH} />;

  return (
    <>
      <ModuleShell className="flex h-screen bg-muted/20" mainClassName="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <ClientsPanelState
            isLoading={isLoading}
            isError={isError || (!isLoading && !client)}
            error={error ?? new Error("Workspace not found")}
            onRetry={() => void refetch()}
            loadingFallback={<ClientsDetailLoading />}
            errorTitle="Could not load workspace"
          >
            {client && (
              <ClientDetailContent
                client={client}
                canConfigure={canCreate}
                onEdit={() => setShowForm(true)}
                onManageMembers={() => setShowMembers(true)}
                onModuleVisibility={() => setShowVisibility(true)}
              />
            )}
          </ClientsPanelState>
        </div>
      </ModuleShell>

      {showForm && client && (
        <ClientFormDialog
          open={showForm}
          onClose={() => setShowForm(false)}
          editing={client}
          siMembers={siMembers}
        />
      )}

      <ClientMembersPanel
        client={showMembers ? client ?? null : null}
        open={showMembers}
        onClose={() => setShowMembers(false)}
        siMembers={siMembers}
      />

      <ClientModuleVisibilityPanel
        client={showVisibility ? client ?? null : null}
        open={showVisibility}
        onClose={() => setShowVisibility(false)}
      />
    </>
  );
}
