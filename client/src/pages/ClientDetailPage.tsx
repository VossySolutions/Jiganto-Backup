import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CLIENTS_PATH } from "@shared/app-routes";
import { Link, Redirect, useRoute } from "wouter";
import { Sidebar } from "@/components/Sidebar";
import { useShellLayout } from "@/hooks/use-shell-layout";
import { useClientContext } from "@/hooks/use-client-context";
import { usePermissions } from "@/hooks/use-permissions";
import { fetchWithAuth } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pencil, Users, Settings2 } from "lucide-react";
import { formatClientDate } from "@/lib/client-workspace-utils";
import { ClientFormDialog } from "@/components/clients/ClientFormDialog";
import { ClientMembersPanel } from "@/components/clients/ClientMembersPanel";
import { ClientModuleVisibilityPanel } from "@/components/clients/ClientModuleVisibilityPanel";
import { ClientsDetailLoading, ClientsPanelState } from "@/components/clients/ClientLoadingStates";
import type { ClientWorkspace } from "@/components/clients/types";
import { userDisplayName } from "@/components/clients/types";
import type { PlatformRole } from "@shared/models/permissions";

export default function ClientDetailPage() {
  const [, params] = useRoute("/clients/:id");
  const clientId = Number(params?.id);
  const { mainOffset, mobileTopOffset } = useShellLayout();
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
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className={cn("flex-1 flex flex-col overflow-hidden transition-all duration-300", mainOffset, mobileTopOffset)}>
        <div className="flex-1 overflow-y-auto">
          <div className="border-b bg-gradient-to-b from-muted/40 to-background px-4 sm:px-6 py-4 sm:py-5">
            <Link href={CLIENTS_PATH}>
              <Button variant="ghost" size="sm" className="gap-2 -ml-2 mb-3 sm:mb-4">
                <ArrowLeft className="h-4 w-4" />
                Back to workspaces
              </Button>
            </Link>

            <ClientsPanelState
              isLoading={isLoading}
              isError={isError || (!isLoading && !client)}
              error={error ?? new Error("Workspace not found")}
              onRetry={() => void refetch()}
              loadingFallback={<ClientsDetailLoading />}
              errorTitle="Could not load workspace"
            >
            {client && (
              <div className="max-w-3xl space-y-5 sm:space-y-6">
                <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
                  <div
                    className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl flex items-center justify-center text-sm font-bold text-white shadow-lg shrink-0"
                    style={{ backgroundColor: client.color }}
                  >
                    {client.shortCode}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight break-words">{client.name}</h1>
                    <p className="text-muted-foreground mt-1">{client.industry || "Client workspace"}</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Badge variant="outline" className="capitalize">
                        {client.engagementStatus?.replace("_", " ") ?? client.status}
                      </Badge>
                      {client.tags && <Badge variant="secondary">{client.tags}</Badge>}
                      {client.status === "pending_delete" && (
                        <Badge variant="destructive">Pending deletion</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm rounded-2xl border bg-card p-4 sm:p-6 shadow-sm">
                  <DetailItem label="Created" value={formatClientDate(client.createdAt)} />
                  <DetailItem label="Members" value={String(client.memberCount ?? 0)} />
                  <DetailItem label="Engagement start" value={client.contractStart || "—"} />
                  <DetailItem label="Engagement end" value={client.contractEnd || "—"} />
                  <DetailItem label="Projects" value={String(client.projectCount ?? 0)} />
                  <DetailItem label="At risk" value={String(client.atRiskCount ?? 0)} />
                  <DetailItem label="Account manager" value={userDisplayName(client.accountManagerUser)} />
                  <DetailItem label="Created by" value={userDisplayName(client.createdByUser)} />
                </dl>

                {client.website && (
                  <p className="text-sm px-1">
                    <span className="text-muted-foreground">Website: </span>
                    <a
                      href={client.website.startsWith("http") ? client.website : `https://${client.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline break-all"
                    >
                      {client.website}
                    </a>
                  </p>
                )}

                {client.notes && (
                  <div className="rounded-2xl border bg-muted/30 p-4 sm:p-5 text-sm text-muted-foreground whitespace-pre-wrap">
                    {client.notes}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row flex-wrap gap-2 pb-6">
                  <Button variant="outline" size="sm" className="gap-2 w-full sm:w-auto" onClick={() => setShowForm(true)}>
                    <Pencil className="h-4 w-4" /> Edit details
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 w-full sm:w-auto" onClick={() => setShowMembers(true)}>
                    <Users className="h-4 w-4" /> Manage members
                  </Button>
                  {canCreate && (
                    <Button variant="outline" size="sm" className="gap-2 w-full sm:w-auto" onClick={() => setShowVisibility(true)}>
                      <Settings2 className="h-4 w-4" /> Module visibility
                    </Button>
                  )}
                </div>
              </div>
            )}
            </ClientsPanelState>
          </div>
        </div>
      </main>

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
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground uppercase tracking-wide">{label}</dt>
      <dd className="font-medium mt-1 break-words">{value}</dd>
    </div>
  );
}
