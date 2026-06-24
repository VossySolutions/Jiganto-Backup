import { useMemo, useState } from "react";

import { useQuery, useMutation } from "@tanstack/react-query";

import { Redirect } from "wouter";

import { ModuleShell } from "@/components/ModuleShell";

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

import { Plus, Briefcase, TrendingUp, Users, AlertTriangle, Search, LayoutGrid, List, X } from "lucide-react";

import { ClientFormDialog } from "@/components/clients/ClientFormDialog";

import { ClientCard } from "@/components/clients/ClientCard";

import { ClientTable, type ClientSortDir, type ClientSortKey } from "@/components/clients/ClientTable";

import { ClientDetailPanel } from "@/components/clients/ClientDetailPanel";

import { ClientMembersPanel } from "@/components/clients/ClientMembersPanel";

import { ClientDeleteDialog } from "@/components/clients/ClientDeleteDialog";

import { ClientModuleVisibilityPanel } from "@/components/clients/ClientModuleVisibilityPanel";

import { ClientAdminPanel } from "@/components/clients/ClientAdminPanel";

import {

  ClientsKpiLoading,

  ClientsCardGridLoading,

  ClientsTableLoading,

  ClientsPanelState,

} from "@/components/clients/ClientLoadingStates";

import { clientDetailPath } from "@shared/app-routes";
import { useLocation } from "wouter";

import type { ClientKpis, ClientWorkspace } from "@/components/clients/types";
import { userDisplayName } from "@/components/clients/types";

import { Input } from "@/components/ui/input";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  collectUniqueTags,
  filterClientWorkspaces,
  sortClientWorkspaces,
} from "@/lib/client-workspace-list";

import { useTablePagination } from "@/hooks/use-table-pagination";

import { TablePagination } from "@/components/TablePagination";
import { MetricCard } from "@/components/ui/metric-card";



export default function ClientsPage() {

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

  const [viewMode, setViewMode] = useState<"cards" | "table">(() => {
    const saved = localStorage.getItem("clients-view-mode");
    return saved === "cards" ? "cards" : "table";
  });

  const [search, setSearch] = useState("");

  const [accountManagerFilter, setAccountManagerFilter] = useState("all");

  const [engagementFilter, setEngagementFilter] = useState("all");

  const [tagFilter, setTagFilter] = useState("all");

  const [sortKey, setSortKey] = useState<ClientSortKey>("name");

  const [sortDir, setSortDir] = useState<ClientSortDir>("asc");

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



  const displayed = useMemo(() => {
    const filtered = filterClientWorkspaces(clients, {
      tab: filter,
      search,
      accountManagerId: accountManagerFilter,
      engagementStatus: engagementFilter,
      tag: tagFilter,
    });
    return sortClientWorkspaces(filtered, sortKey, sortDir);
  }, [
    clients,
    filter,
    search,
    accountManagerFilter,
    engagementFilter,
    tagFilter,
    sortKey,
    sortDir,
  ]);

  const allTags = useMemo(() => collectUniqueTags(clients), [clients]);

  const accountManagerOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const client of clients) {
      if (client.accountManagerId && client.accountManagerUser) {
        map.set(client.accountManagerId, userDisplayName(client.accountManagerUser));
      }
    }
    for (const member of siMembers) {
      if (!map.has(member.userId)) map.set(member.userId, member.label);
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [clients, siMembers]);

  const hasActiveFilters =
    search.trim() !== "" ||
    accountManagerFilter !== "all" ||
    engagementFilter !== "all" ||
    tagFilter !== "all";

  const handleSort = (key: ClientSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const clearFilters = () => {
    setSearch("");
    setAccountManagerFilter("all");
    setEngagementFilter("all");
    setTagFilter("all");
  };

  const setView = (mode: "cards" | "table") => {
    setViewMode(mode);
    localStorage.setItem("clients-view-mode", mode);
  };

  const clientsListResetKey = `${filter}-${search}-${accountManagerFilter}-${engagementFilter}-${tagFilter}-${sortKey}-${sortDir}`;

  const clientsPagination = useTablePagination(displayed, {
    resetKey: clientsListResetKey,
  });



  if (isClientUser || !canAccess) {

    return <Redirect to="/" />;

  }



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

    <>

    <ModuleShell className="flex h-screen bg-background" mainClassName="flex-1 flex flex-col overflow-hidden">

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

                <MetricCard title="Total Clients" value={kpisBusy ? "—" : (kpis?.totalClients ?? clients.length)} icon={Briefcase} borderColor="#185FA5" helpText="All client organisations in your portfolio." testId="kpi-total-clients" />

                <MetricCard title="Active Engagements" value={kpisBusy ? "—" : (kpis?.activeEngagements ?? 0)} icon={TrendingUp} borderColor="#0F6E56" helpText="Clients with at least one active project or engagement." testId="kpi-active-engagements" />

                <MetricCard title="Projects Tracked" value={kpisBusy ? "—" : (kpis?.projectsTracked ?? 0)} icon={Users} borderColor="#7C3AED" helpText="Projects linked across all client workspaces." testId="kpi-projects-tracked" />

                <MetricCard
                  title="At-Risk Projects"
                  value={kpisBusy ? "—" : (kpis?.atRiskProjects ?? 0)}
                  icon={AlertTriangle}
                  borderColor={(kpis?.atRiskProjects ?? 0) > 0 ? "#EF4444" : "#6B7280"}
                  helpText="Projects flagged red or amber on health or delivery status."
                  testId="kpi-at-risk-projects"
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



            <div className="flex flex-col gap-3">
              <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search clients, tags, industry…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                    data-testid="input-clients-search"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={accountManagerFilter} onValueChange={setAccountManagerFilter}>
                    <SelectTrigger className="w-[160px] h-9" data-testid="filter-account-manager">
                      <SelectValue placeholder="Account manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All managers</SelectItem>
                      <SelectItem value="__unassigned__">Unassigned</SelectItem>
                      {accountManagerOptions.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={engagementFilter} onValueChange={setEngagementFilter}>
                    <SelectTrigger className="w-[150px] h-9" data-testid="filter-engagement-status">
                      <SelectValue placeholder="Engagement" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_hold">On hold</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={tagFilter} onValueChange={setTagFilter}>
                    <SelectTrigger className="w-[130px] h-9" data-testid="filter-tags">
                      <SelectValue placeholder="Tags" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All tags</SelectItem>
                      {allTags.map((tag) => (
                        <SelectItem key={tag} value={tag}>
                          {tag}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" className="h-9 gap-1" onClick={clearFilters}>
                      <X className="h-3.5 w-3.5" />
                      Clear
                    </Button>
                  )}
                  <div className="flex items-center rounded-lg border p-0.5 ml-auto lg:ml-0">
                    <Button
                      type="button"
                      variant={viewMode === "table" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-8 px-2.5"
                      onClick={() => setView("table")}
                      data-testid="clients-view-table"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant={viewMode === "cards" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-8 px-2.5"
                      onClick={() => setView("cards")}
                      data-testid="clients-view-cards"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {displayed.length} client{displayed.length === 1 ? "" : "s"}
                {hasActiveFilters ? " matching filters" : ""}
                {viewMode === "table" ? " · Click column headers to sort" : ""}
                {displayed.length > clientsPagination.pageSize
                  ? ` · Page ${clientsPagination.page} of ${clientsPagination.totalPages}`
                  : ""}
              </p>
            </div>



            <ClientsPanelState

              isLoading={clientsInitialLoad}

              isError={clientsError}

              error={clientsQueryError}

              onRetry={() => void refetchClients()}

              loadingFallback={viewMode === "table" ? <ClientsTableLoading /> : <ClientsCardGridLoading />}

            >

            {displayed.length === 0 ? (

              <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4 rounded-2xl border border-dashed bg-muted/20">

                <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">

                  <Briefcase className="h-7 w-7 text-muted-foreground" />

                </div>

                <h3 className="font-semibold text-lg mb-1">

                  {filter === "archived"
                    ? "No archived clients"
                    : hasActiveFilters
                      ? "No clients match your filters"
                      : "No client workspaces yet"}

                </h3>

                <p className="text-sm text-muted-foreground mb-5 max-w-sm">

                  {filter === "archived"

                    ? "Archived clients will appear here."

                    : hasActiveFilters

                      ? "Try adjusting search or filter criteria."

                      : "Add a client workspace to isolate projects, tasks, and CRM data for each customer engagement."}

                </p>

                {hasActiveFilters && (
                  <Button size="sm" variant="outline" className="mb-3" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}

                {filter !== "archived" && canCreate && !hasActiveFilters && (

                  <Button size="sm" className="gap-2" onClick={() => openForm()}>

                    <Plus className="h-4 w-4" />

                    Add client

                  </Button>

                )}

              </div>

            ) : viewMode === "table" ? (

              <ClientTable

                clients={clientsPagination.paginatedItems}

                sortKey={sortKey}

                sortDir={sortDir}

                onSort={handleSort}

                onViewDetails={(c) => navigate(clientDetailPath(c.id))}

                onArchive={setArchiving}

                onDelete={setDeleting}

                onUnarchive={(c) => unarchiveMutation.mutate(c.id)}

                canCreate={canCreate}

                canDelete={canDelete}

                pagination={{
                  page: clientsPagination.page,
                  totalPages: clientsPagination.totalPages,
                  total: clientsPagination.total,
                  startIndex: clientsPagination.startIndex,
                  endIndex: clientsPagination.endIndex,
                  pageSize: clientsPagination.pageSize,
                  onPageChange: clientsPagination.setPage,
                  onPageSizeChange: clientsPagination.setPageSize,
                }}

              />

            ) : (

              <div className="rounded-xl border bg-card overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4 p-3 sm:p-4">

                {clientsPagination.paginatedItems.map((client) => (

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
              <TablePagination
                page={clientsPagination.page}
                totalPages={clientsPagination.totalPages}
                total={clientsPagination.total}
                startIndex={clientsPagination.startIndex}
                endIndex={clientsPagination.endIndex}
                pageSize={clientsPagination.pageSize}
                onPageChange={clientsPagination.setPage}
                onPageSizeChange={clientsPagination.setPageSize}
              />
              </div>

            )}

            </ClientsPanelState>

          </div>

        </div>

    </ModuleShell>



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

    </>

  );

}


