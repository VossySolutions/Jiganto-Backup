import { useState } from "react";

import { useQuery, useMutation } from "@tanstack/react-query";

import { Redirect } from "wouter";

import { Sidebar } from "@/components/Sidebar";

import { useShellLayout } from "@/hooks/use-shell-layout";

import { useClientContext } from "@/hooks/use-client-context";

import { usePermissions } from "@/hooks/use-permissions";

import type { PlatformRole } from "@shared/models/permissions";

import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";

import { cn } from "@/lib/utils";

import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";

import {

  AlertDialog,

  AlertDialogAction,

  AlertDialogCancel,

  AlertDialogContent,

  AlertDialogDescription,

  AlertDialogFooter,

  AlertDialogHeader,

  AlertDialogTitle,

} from "@/components/ui/alert-dialog";

import { Plus, Briefcase, TrendingUp, Users, AlertTriangle } from "lucide-react";

import { ClientFormDialog } from "@/components/clients/ClientFormDialog";

import { ClientCard } from "@/components/clients/ClientCard";

import { ClientDetailPanel } from "@/components/clients/ClientDetailPanel";

import { ClientMembersPanel } from "@/components/clients/ClientMembersPanel";

import { ClientDeleteDialog } from "@/components/clients/ClientDeleteDialog";

import { ClientModuleVisibilityPanel } from "@/components/clients/ClientModuleVisibilityPanel";

import { ClientAdminPanel } from "@/components/clients/ClientAdminPanel";

import {

  ClientsKpiLoading,

  ClientsCardGridLoading,

  ClientsPanelState,

} from "@/components/clients/ClientLoadingStates";

import { clientDetailPath } from "@shared/app-routes";
import { useLocation } from "wouter";

import type { ClientKpis, ClientWorkspace } from "@/components/clients/types";



function KpiCard({

  label,

  value,

  icon: Icon,

  color,

  loading,

}: {

  label: string;

  value: string | number;

  icon: React.ComponentType<{ className?: string }>;

  color: string;

  loading?: boolean;

}) {

  return (

    <div className="rounded-2xl border bg-card/90 backdrop-blur-sm p-4 sm:p-5 flex items-center gap-3 sm:gap-4 shadow-sm hover:shadow-md transition-shadow">

      <div

        className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center flex-shrink-0"

        style={{ backgroundColor: color + "18" }}

      >

        <Icon className="h-5 w-5" style={{ color }} />

      </div>

      <div className="min-w-0">

        <p className={cn("text-xl sm:text-2xl font-bold tabular-nums truncate", loading && "opacity-60")}>

          {loading ? "—" : value}

        </p>

        <p className="text-xs text-muted-foreground truncate">{label}</p>

      </div>

    </div>

  );

}



export default function ClientsPage() {

  const { mainOffset, mobileTopOffset } = useShellLayout();

  const { toast } = useToast();

  const { isClientUser } = useClientContext();

  const { platformRole, isJigantoStaff, permissions } = usePermissions();

  const tenantId = permissions?.orgId;



  const canAccess =

    isJigantoStaff ||

    platformRole === "si_super_admin" ||

    platformRole === "si_consultant_pm" ||

    platformRole === "jiganto_staff";

  const canCreate = isJigantoStaff || platformRole === "si_super_admin";

  const canDelete = canCreate;

  const canAdmin = isJigantoStaff || platformRole === "si_super_admin";

  const [, navigate] = useLocation();



  const [filter, setFilter] = useState<"active" | "archived" | "all">("active");

  const [showForm, setShowForm] = useState(false);

  const [editing, setEditing] = useState<ClientWorkspace | null>(null);

  const [archiving, setArchiving] = useState<ClientWorkspace | null>(null);

  const [deleting, setDeleting] = useState<ClientWorkspace | null>(null);

  const [detailClient, setDetailClient] = useState<ClientWorkspace | null>(null);

  const [membersClient, setMembersClient] = useState<ClientWorkspace | null>(null);

  const [visibilityClient, setVisibilityClient] = useState<ClientWorkspace | null>(null);



  const {

    data: clients = [],

    isLoading: clientsLoading,

    isError: clientsError,

    error: clientsQueryError,

    refetch: refetchClients,

  } = useQuery<ClientWorkspace[]>({

    queryKey: ["/api/clients", "all"],

    queryFn: async () => {

      const res = await fetchWithAuth("/api/clients?includeArchived=true");

      if (!res.ok) throw new Error(await res.text());

      return res.json();

    },

    enabled: canAccess,

  });



  const { data: kpis, isLoading: kpisLoading } = useQuery<ClientKpis>({

    queryKey: ["/api/clients/kpis"],

    enabled: canAccess,

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



  const archiveMutation = useMutation({

    mutationFn: (id: number) => apiRequest("DELETE", `/api/clients/${id}`, {}),

    onSuccess: () => {

      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });

      queryClient.invalidateQueries({ queryKey: ["/api/clients/kpis"] });

      toast({ title: "Client archived" });

      setArchiving(null);

    },

    onError: () => toast({ title: "Error", description: "Failed to archive client.", variant: "destructive" }),

  });



  const unarchiveMutation = useMutation({

    mutationFn: (id: number) => apiRequest("POST", `/api/clients/${id}/unarchive`, {}),

    onSuccess: () => {

      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });

      queryClient.invalidateQueries({ queryKey: ["/api/clients/kpis"] });

      toast({ title: "Workspace restored" });

    },

  });



  if (isClientUser || !canAccess) {

    return <Redirect to="/" />;

  }



  const displayed = clients.filter((c) => {

    if (filter === "active") return c.status === "active";

    if (filter === "archived") return c.status === "archived" || c.status === "pending_delete";

    return true;

  });



  const openForm = (client?: ClientWorkspace) => {

    setEditing(client ?? null);

    setShowForm(true);

  };



  const closeForm = () => {

    setShowForm(false);

    setEditing(null);

  };



  const handleEdit = (client: ClientWorkspace) => {

    setDetailClient(null);

    openForm(client);

  };



  const clientsInitialLoad = clientsLoading && clients.length === 0;

  const kpisBusy = kpisLoading && !kpis;



  return (

    <div className="flex h-screen bg-background">

      <Sidebar />

      <main className={cn("flex-1 flex flex-col overflow-hidden transition-all duration-300", mainOffset, mobileTopOffset)}>

        <div className="flex-1 overflow-y-auto">

          <div className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/75">

            <div className="px-4 sm:px-6 py-4 sm:py-5">

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                <div className="min-w-0">

                  <div className="flex items-center gap-2">

                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">

                      <Briefcase className="h-4 w-4 text-primary" />

                    </div>

                    <div>

                      <h1 className="text-lg sm:text-xl font-bold tracking-tight">Client Workspaces</h1>

                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-2 sm:line-clamp-1">

                        Manage engagements and switch between isolated client views

                      </p>

                    </div>

                  </div>

                </div>

                {canCreate && (

                  <Button

                    size="sm"

                    className="gap-2 w-full sm:w-auto shrink-0"

                    onClick={() => openForm()}

                    data-testid="button-add-client"

                  >

                    <Plus className="h-4 w-4" />

                    Add Client

                  </Button>

                )}

              </div>

            </div>

          </div>



          <div className="px-4 sm:px-6 py-5 sm:py-6 space-y-5 sm:space-y-6 max-w-[1600px]">

            {kpisBusy ? (

              <ClientsKpiLoading />

            ) : (

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

                <KpiCard label="Total Clients" value={kpis?.totalClients ?? clients.length} icon={Briefcase} color="#185FA5" loading={kpisBusy} />

                <KpiCard label="Active Engagements" value={kpis?.activeEngagements ?? 0} icon={TrendingUp} color="#0F6E56" loading={kpisBusy} />

                <KpiCard label="Projects Tracked" value={kpis?.projectsTracked ?? 0} icon={Users} color="#7C3AED" loading={kpisBusy} />

                <KpiCard

                  label="At-Risk Projects"

                  value={kpis?.atRiskProjects ?? 0}

                  icon={AlertTriangle}

                  color={(kpis?.atRiskProjects ?? 0) > 0 ? "#EF4444" : "#6B7280"}

                  loading={kpisBusy}

                />

              </div>

            )}



            <ClientAdminPanel canAdmin={canAdmin} />



            <div className="flex items-center gap-1 border-b overflow-x-auto scrollbar-none -mx-1 px-1">

              {(["active", "archived", "all"] as const).map((f) => (

                <button

                  key={f}

                  data-testid={`filter-${f}`}

                  onClick={() => setFilter(f)}

                  className={cn(

                    "px-3 sm:px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px capitalize whitespace-nowrap shrink-0",

                    filter === f

                      ? "border-primary text-primary"

                      : "border-transparent text-muted-foreground hover:text-foreground",

                  )}

                >

                  {f}

                  {f !== "all" && (

                    <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">

                      ({clients.filter((c) =>

                        f === "archived"

                          ? c.status === "archived" || c.status === "pending_delete"

                          : c.status === f,

                      ).length})

                    </span>

                  )}

                </button>

              ))}

            </div>



            <ClientsPanelState

              isLoading={clientsInitialLoad}

              isError={clientsError}

              error={clientsQueryError}

              onRetry={() => void refetchClients()}

              loadingFallback={<ClientsCardGridLoading />}

            >

            {displayed.length === 0 ? (

              <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4 rounded-2xl border border-dashed bg-muted/20">

                <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">

                  <Briefcase className="h-7 w-7 text-muted-foreground" />

                </div>

                <h3 className="font-semibold text-lg mb-1">

                  {filter === "archived" ? "No archived clients" : "No client workspaces yet"}

                </h3>

                <p className="text-sm text-muted-foreground mb-5 max-w-sm">

                  {filter === "archived"

                    ? "Archived clients will appear here."

                    : "Add a client workspace to isolate projects, tasks, and CRM data for each customer engagement."}

                </p>

                {filter !== "archived" && canCreate && (

                  <Button size="sm" className="gap-2" onClick={() => openForm()}>

                    <Plus className="h-4 w-4" />

                    Add client

                  </Button>

                )}

              </div>

            ) : (

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">

                {displayed.map((client) => (

                  <ClientCard

                    key={client.id}

                    client={client}

                    onViewDetails={(c) => navigate(clientDetailPath(c.id))}

                    onArchive={setArchiving}

                    onDelete={setDeleting}

                    onUnarchive={(c) => unarchiveMutation.mutate(c.id)}

                    canCreate={canCreate}

                    canDelete={canDelete}

                  />

                ))}

              </div>

            )}

            </ClientsPanelState>

          </div>

        </div>

      </main>



      {showForm && (

        <ClientFormDialog open={showForm} onClose={closeForm} editing={editing} siMembers={siMembers} />

      )}



      <ClientDetailPanel

        client={detailClient}

        open={!!detailClient}

        onClose={() => setDetailClient(null)}

        onEdit={handleEdit}

        onManageMembers={setMembersClient}

        onModuleVisibility={setVisibilityClient}

        canConfigure={canCreate}

      />



      <ClientMembersPanel

        client={membersClient}

        open={!!membersClient}

        onClose={() => setMembersClient(null)}

        siMembers={siMembers}

      />



      <ClientModuleVisibilityPanel

        client={visibilityClient}

        open={!!visibilityClient}

        onClose={() => setVisibilityClient(null)}

      />



      <ClientDeleteDialog client={deleting} onClose={() => setDeleting(null)} />



      <AlertDialog open={!!archiving} onOpenChange={(v) => !v && setArchiving(null)}>

        <AlertDialogContent className="sm:max-w-md">

          <AlertDialogHeader>

            <AlertDialogTitle>Archive {archiving?.name}?</AlertDialogTitle>

            <AlertDialogDescription>

              This workspace will move to the Archived tab. Data is preserved and can be viewed read-only.

            </AlertDialogDescription>

          </AlertDialogHeader>

          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">

            <AlertDialogCancel disabled={archiveMutation.isPending}>Cancel</AlertDialogCancel>

            <AlertDialogAction

              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"

              disabled={archiveMutation.isPending}

              onClick={() => archiving && archiveMutation.mutate(archiving.id)}

            >

              {archiveMutation.isPending ? "Archiving…" : "Archive"}

            </AlertDialogAction>

          </AlertDialogFooter>

        </AlertDialogContent>

      </AlertDialog>

    </div>

  );

}


