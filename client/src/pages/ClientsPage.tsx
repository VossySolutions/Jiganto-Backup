import { useMemo, useState } from "react";

import { useQuery, useMutation } from "@tanstack/react-query";

import { Redirect } from "wouter";

import { ModuleShell } from "@/components/ModuleShell";

import { ModuleHeader } from "@/components/ModuleHeader";

import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";

import {
  modulePageBannerWrapClass,
  modulePageContentOuterClass,
  modulePageContentScrollClass,
  modulePageMainClass,
  modulePageShellClass,
  modulePageStickyHeaderClass,
} from "@/components/ModulePageChrome";

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

import { Plus, Briefcase, TrendingUp, Users, AlertTriangle, X } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useDebouncedValue, downloadBoardCsv, downloadImportTemplateCsv } from "@/lib/crm-monday-chrome";
import { MondayBoardShell } from "@/components/board";
import { useMondayBoardShellState } from "@/hooks/use-monday-board-shell-state";
import { matchBoardFilterValue } from "@/lib/board-filters";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  const [pinClient, setPinClient] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("clients-pin-name") !== "0";
  });

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);

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

  const clientsListResetKey = `${filter}-${debouncedSearch}-${accountManagerFilter}-${engagementFilter}-${tagFilter}-${sortKey}-${sortDir}`;

  const clientsCardPagination = useTablePagination(displayed, {
    resetKey: clientsListResetKey,
    enabled: viewMode === "cards",
  });

  const sortLabel: Record<ClientSortKey, string> = {
    name: "Name",
    industry: "Industry",
    engagementStatus: "Engagement",
    accountManager: "Account manager",
    projects: "Projects",
    atRisk: "At risk",
  };

  const CLIENT_CSV_HEADERS = ["Client", "Industry", "Engagement", "Account manager", "Tags", "Projects", "At risk"];

  const exportClients = () => {
    const rows = displayed.map((c) => [
      c.name || "",
      c.industry || "",
      (c.engagementStatus || "").replace(/_/g, " "),
      userDisplayName(c.accountManagerUser),
      c.tags || "",
      String(c.projectCount ?? 0),
      String(c.atRiskCount ?? 0),
    ]);
    downloadBoardCsv(`clients-${new Date().toISOString().split("T")[0]}.csv`, CLIENT_CSV_HEADERS, rows);
    toast({ title: "Clients exported to CSV" });
  };

  const downloadClientsTemplate = () => {
    downloadImportTemplateCsv("clients-import-template.csv", CLIENT_CSV_HEADERS, CLIENT_CSV_HEADERS.map(() => ""));
    toast({ title: "Import template downloaded" });
  };

  const importUnavailable = () => {
    toast({ title: "Import is not available for this table yet" });
  };



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

    <ModuleShell className={modulePageShellClass} mainClassName={modulePageMainClass}>

        <div className={modulePageBannerWrapClass}>

          <ModuleWelcomeBanner moduleKey="clients" />

        </div>

        <div className={modulePageStickyHeaderClass}>

          <ModuleHeader

            icon={Briefcase}

            title="Client Workspaces"

            subtitle="Manage engagements and switch between isolated client views"

            titleTestId="clients-title"

            actions={undefined}

          />

        </div>

        <div className={modulePageContentOuterClass}>

          <div className={modulePageContentScrollClass}>

          <div className="p-3 sm:p-4 md:p-6 space-y-5 sm:space-y-6 max-w-[1600px]">

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



            <MondayBoardShell.Legacy
              storageKey="jiganto-clients"
              entityType="client"
              stateHook={useMondayBoardShellState}
              filterMatcher={matchBoardFilterValue}
            >
            <MondayBoardShell.Toolbar
              newLabel="Add Client"
              onNew={canCreate ? () => openForm() : undefined}
              newTestId="button-add-client-toolbar"
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search clients, tags, industry…"
              searchTestId="input-clients-search"
              viewLabel={viewMode === "table" ? "Table" : "Cards"}
              viewMenu={
                <>
                  <DropdownMenuItem onClick={() => setView("table")} data-testid="clients-view-table">Table</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setView("cards")} data-testid="clients-view-cards">Cards</DropdownMenuItem>
                </>
              }
              filterActive={hasActiveFilters}
              filterCount={
                (accountManagerFilter !== "all" ? 1 : 0) +
                (engagementFilter !== "all" ? 1 : 0) +
                (tagFilter !== "all" ? 1 : 0)
              }
              filterContent={
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Account manager</Label>
                    <Select value={accountManagerFilter} onValueChange={setAccountManagerFilter}>
                      <SelectTrigger className="h-8 text-xs" data-testid="filter-account-manager">
                        <SelectValue placeholder="Account manager" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All managers</SelectItem>
                        <SelectItem value="__unassigned__">Unassigned</SelectItem>
                        {accountManagerOptions.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Engagement</Label>
                    <Select value={engagementFilter} onValueChange={setEngagementFilter}>
                      <SelectTrigger className="h-8 text-xs" data-testid="filter-engagement-status">
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
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tags</Label>
                    <Select value={tagFilter} onValueChange={setTagFilter}>
                      <SelectTrigger className="h-8 text-xs" data-testid="filter-tags">
                        <SelectValue placeholder="Tags" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All tags</SelectItem>
                        {allTags.map((tag) => (
                          <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" className="h-8 gap-1 w-full" onClick={clearFilters}>
                      <X className="h-3.5 w-3.5" />
                      Clear filters
                    </Button>
                  )}
                </div>
              }
              sortContent={
                viewMode === "table" ? (
                  <>
                    {(Object.keys(sortLabel) as ClientSortKey[]).map((key) => (
                      <DropdownMenuItem key={key} onClick={() => handleSort(key)} data-testid={`sort-clients-${key}`}>
                        {sortLabel[key]} {sortKey === key ? `(${sortDir})` : ""}
                      </DropdownMenuItem>
                    ))}
                  </>
                ) : undefined
              }
              sortActive={viewMode === "table" && sortKey !== "name"}
              sortLabel={viewMode === "table" ? `Sort: ${sortLabel[sortKey]}` : "Sort"}
              pinActive={pinClient}
              onPinToggle={() => {
                setPinClient((v) => {
                  const next = !v;
                  localStorage.setItem("clients-pin-name", next ? "1" : "0");
                  return next;
                });
              }}
              pinTitle={pinClient ? "Unpin Client column" : "Pin Client column"}
              onExport={exportClients}
              onDownloadTemplate={downloadClientsTemplate}
              onPaste={importUnavailable}
              onImport={importUnavailable}
              testId="clients-toolbar"
            />
            <p className="text-xs text-muted-foreground mb-3">
              {displayed.length} client{displayed.length === 1 ? "" : "s"}
              {hasActiveFilters ? " matching filters" : ""}
              {viewMode === "cards" && displayed.length > clientsCardPagination.pageSize
                ? ` · Page ${clientsCardPagination.page} of ${clientsCardPagination.totalPages}`
                : ""}
            </p>



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
                clients={displayed}
                paginationResetKey={clientsListResetKey}
                searchHighlightTerm={debouncedSearch}
                pinFirstColumn={pinClient}
                onViewDetails={(c) => navigate(clientDetailPath(c.id))}
                onArchive={setArchiving}
                onDelete={setDeleting}
                onUnarchive={(c) => unarchiveMutation.mutate(c.id)}
                canCreate={canCreate}
                canDelete={canDelete}
              />

            ) : (

              <div className="rounded-xl border bg-card overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4 p-3 sm:p-4">

                {clientsCardPagination.paginatedItems.map((client) => (

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
                page={clientsCardPagination.page}
                totalPages={clientsCardPagination.totalPages}
                total={clientsCardPagination.total}
                startIndex={clientsCardPagination.startIndex}
                endIndex={clientsCardPagination.endIndex}
                pageSize={clientsCardPagination.pageSize}
                onPageChange={clientsCardPagination.setPage}
                onPageSizeChange={clientsCardPagination.setPageSize}
              />
              </div>

            )}

            </ClientsPanelState>

            </MondayBoardShell.Legacy>

          </div>

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


