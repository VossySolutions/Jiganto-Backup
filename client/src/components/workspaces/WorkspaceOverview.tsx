import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  FileText,
  Clock,
  Loader2,
  ChevronRight,
  Plus,
  Users,
  LayoutGrid,
  FileIcon,
  Layers,
  Timer,
  CalendarDays,
  CheckCircle2,
  Pencil,
  Star,
  FolderOpen,
  ClipboardList,
  ArrowUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  Workspace,
  WorkspacePage,
  WorkspaceMember,
  WorkspaceDatabase,
  WorkspaceDatabaseColumn,
  WorkspaceDatabaseRow,
} from "@shared/schema";
import {
  WorkspaceIconRenderer,
  getWorkspaceIconDef,
} from "@/components/workspaces/WorkspaceIconPicker";
import { WorkspaceOverviewSkeleton } from "@/components/workspaces/loading";

const WORKSPACE_COLORS = [
  "#7C3AED", "#1E88C8", "#22C55E", "#F59E0B", "#EC4899",
  "#EF4444", "#6366F1", "#14B8A6", "#F97316", "#8B5CF6",
];

function getWorkspaceColor(id: number, color?: string | null): string {
  if (color) return color;
  return WORKSPACE_COLORS[id % WORKSPACE_COLORS.length];
}

function getCardColor(index: number): string {
  return WORKSPACE_COLORS[index % WORKSPACE_COLORS.length];
}

function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return "";
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(date).toLocaleDateString();
}

function isCurrentWeek(dateStr: string): boolean {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return date >= monday && date <= sunday;
}

function useWorkspaceKPIs(databasePages: WorkspacePage[]) {
  const dbQueries = useQuery<{ databases: WorkspaceDatabase[]; pageId: number }[]>({
    queryKey: ["workspace-overview-databases", databasePages.map((p) => p.id).join(",")],
    queryFn: async () => {
      const results = await Promise.all(
        databasePages.map(async (page) => {
          const resp = await fetchWithAuth(`/api/workspace-pages/${page.id}/databases`);
          const databases: WorkspaceDatabase[] = resp.ok ? await resp.json() : [];
          return { databases, pageId: page.id };
        })
      );
      return results;
    },
    enabled: databasePages.length > 0,
    staleTime: 30000,
  });

  const allDatabases = dbQueries.data?.flatMap((d) => d.databases) || [];

  const rowsAndColumnsQuery = useQuery<{
    rows: WorkspaceDatabaseRow[];
    columns: WorkspaceDatabaseColumn[];
    rowCountByDb: Record<number, number>;
  }>({
    queryKey: ["workspace-overview-rows-columns", allDatabases.map((d) => d.id).join(",")],
    queryFn: async () => {
      const allRows: WorkspaceDatabaseRow[] = [];
      const allColumns: WorkspaceDatabaseColumn[] = [];
      const rowCountByDb: Record<number, number> = {};
      await Promise.all(
        allDatabases.map(async (db) => {
          const [rowsResp, colsResp] = await Promise.all([
            fetchWithAuth(`/api/workspace-databases/${db.id}/rows`),
            fetchWithAuth(`/api/workspace-databases/${db.id}/columns`),
          ]);
          const rows: WorkspaceDatabaseRow[] = rowsResp.ok ? await rowsResp.json() : [];
          const cols: WorkspaceDatabaseColumn[] = colsResp.ok ? await colsResp.json() : [];
          rowCountByDb[db.id] = rows.length;
          allRows.push(...rows);
          allColumns.push(...cols);
        })
      );
      return { rows: allRows, columns: allColumns, rowCountByDb };
    },
    enabled: allDatabases.length > 0,
    staleTime: 30000,
  });

  const rows = rowsAndColumnsQuery.data?.rows || [];
  const columns = rowsAndColumnsQuery.data?.columns || [];
  const rowCountByDb = rowsAndColumnsQuery.data?.rowCountByDb || {};

  const selectColumnIds = new Set(
    columns.filter((c) => c.type === "select").map((c) => String(c.id))
  );
  const dateColumnIds = new Set(
    columns.filter((c) => c.type === "date").map((c) => String(c.id))
  );

  let totalItems = rows.length;
  let inProgress = 0;
  let completed = 0;
  let dueThisWeek = 0;

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  let addedToday = 0;
  let completedToday = 0;
  let inProgressToday = 0;

  for (const row of rows) {
    const data = (row.data || {}) as Record<string, unknown>;
    const createdAt = row.createdAt ? new Date(row.createdAt) : null;
    const updatedAt = (row as any).updatedAt ? new Date((row as any).updatedAt) : null;
    const isRecentlyCreated = createdAt && createdAt >= oneDayAgo;
    const isRecentlyUpdated = updatedAt && updatedAt >= oneDayAgo;

    if (isRecentlyCreated) addedToday++;

    for (const [key, val] of Object.entries(data)) {
      if (selectColumnIds.has(key) && typeof val === "string") {
        const lower = val.toLowerCase();
        if (lower === "in progress") {
          inProgress++;
          if (isRecentlyCreated || isRecentlyUpdated) inProgressToday++;
        }
        if (lower === "done" || lower === "completed") {
          completed++;
          if (isRecentlyCreated || isRecentlyUpdated) completedToday++;
        }
      }
      if (dateColumnIds.has(key) && typeof val === "string" && val) {
        if (isCurrentWeek(val)) dueThisWeek++;
      }
    }
  }

  const completedPct = totalItems > 0 ? Math.round((completed / totalItems) * 100) : 0;

  return {
    totalItems,
    inProgress,
    dueThisWeek,
    completed,
    addedToday,
    completedToday,
    inProgressToday,
    completedPct,
    isLoading: dbQueries.isLoading || rowsAndColumnsQuery.isLoading,
    rowCountByDb,
    allDatabases,
  };
}

function KPICard({
  title,
  value,
  icon: Icon,
  colorClass,
  iconColorClass,
  isLoading,
  testId,
  delta,
  deltaLabel,
  subtitle,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  colorClass: string;
  iconColorClass: string;
  isLoading: boolean;
  testId: string;
  delta?: number;
  deltaLabel?: string;
  subtitle?: string;
}) {
  return (
    <div
      className={cn("rounded-md border border-border/40 p-4 flex items-center gap-3", colorClass)}
      data-testid={testId}
    >
      <div className={cn("w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0", iconColorClass)}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-2xl font-bold leading-none mb-0.5">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : value}
        </div>
        <div className="text-xs text-muted-foreground">{title}</div>
        {!isLoading && (delta !== undefined && delta > 0 || subtitle) && (
          <div className="flex items-center gap-1 mt-1">
            {delta !== undefined && delta > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
                <ArrowUp className="h-2.5 w-2.5" />
                +{delta} {deltaLabel}
              </span>
            )}
            {subtitle && (
              <span className="text-[10px] text-muted-foreground">{subtitle}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionPanel({
  title,
  count,
  icon: Icon,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  children,
  testId,
}: {
  title: string;
  count: number;
  icon: React.ElementType;
  actionLabel: string;
  onAction: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <div
      className="rounded-md border border-border/60 bg-muted/30 dark:bg-muted/10 mb-6"
      data-testid={testId}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/40 flex-wrap">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">{title}</span>
          <Badge variant="secondary" className="text-xs">{count}</Badge>
        </div>
        <div className="flex items-center gap-2">
          {secondaryActionLabel && onSecondaryAction && (
            <Button size="sm" variant="ghost" onClick={onSecondaryAction} data-testid={`${testId}-from-template`}>
              <ClipboardList className="h-3.5 w-3.5 mr-1" />
              {secondaryActionLabel}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onAction} data-testid={`${testId}-add`}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            {actionLabel}
          </Button>
        </div>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

function ColoredTopCard({
  color,
  onClick,
  children,
  isDashed,
  testId,
}: {
  color?: string;
  onClick: () => void;
  children: React.ReactNode;
  isDashed?: boolean;
  testId: string;
}) {
  return (
    <div
      className={cn(
        "rounded-md overflow-hidden cursor-pointer hover-elevate group bg-card border",
        isDashed && "border-2 border-dashed border-muted-foreground/25 hover:border-muted-foreground/40 bg-muted/20 hover:bg-muted/30 transition-colors"
      )}
      onClick={onClick}
      data-testid={testId}
    >
      {color && !isDashed && <div className="h-[3px]" style={{ backgroundColor: color }} />}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

export function WorkspaceOverview({
  workspaceId,
  onBack: _onBack,
  onSelectPage,
  onCreatePage,
  onEditWorkspace,
  onToggleFavorite,
  onCreateFromTemplate,
}: {
  workspaceId: number;
  onBack: () => void;
  onSelectPage: (id: number) => void;
  onCreatePage: (parentId?: number, pageType?: string) => void;
  onEditWorkspace?: (workspace: Workspace) => void;
  onToggleFavorite?: (workspaceId: number) => void;
  onCreateFromTemplate?: () => void;
}) {
  const { data: workspace } = useQuery<Workspace>({
    queryKey: ["/api/workspaces", workspaceId],
  });

  const pagesQuery = useQuery<WorkspacePage[]>({
    queryKey: ["/api/workspaces", workspaceId, "pages"],
  });
  const pages = pagesQuery.data ?? [];
  const pagesLoading = pagesQuery.isLoading;

  const { data: members = [] } = useQuery<WorkspaceMember[]>({
    queryKey: ["/api/workspaces", workspaceId, "members"],
  });

  const rootPages = pages
    .filter((p) => !p.parentId)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const documentPages = rootPages.filter((p) => p.pageType === "page" || !p.pageType);
  const databasePages = rootPages.filter((p) => p.pageType === "database");
  const sectionPages = rootPages.filter((p) => p.pageType === "section");

  const totalDatabases = databasePages.length;
  const totalDocuments = documentPages.length;
  const totalMembers = members.length;

  const {
    totalItems,
    inProgress,
    dueThisWeek,
    completed,
    addedToday,
    completedToday,
    inProgressToday,
    completedPct,
    isLoading: kpiLoading,
    rowCountByDb,
    allDatabases,
  } = useWorkspaceKPIs(databasePages);

  const getRowCountForPage = (pageId: number): number => {
    const dbs = allDatabases.filter((db) => db.pageId === pageId);
    return dbs.reduce((sum, db) => sum + (rowCountByDb[db.id] || 0), 0);
  };

  const wsColor = workspace ? getWorkspaceColor(workspace.id, workspace.color) : "#7C3AED";
  const wsStatus = (workspace as any)?.status || "active";
  const isFavorite = (workspace as any)?.isFavorite || false;

  const favoriteMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/workspaces/${workspaceId}/favorite`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
    },
  });

  if (pagesLoading) {
    return <WorkspaceOverviewSkeleton />;
  }

  return (
    <div className="flex-1 overflow-y-auto" data-testid="workspace-overview">
      <div className="w-full px-4 sm:px-6 py-4 pb-8">
        <div className="flex items-start gap-5 mb-6">
          <WorkspaceIconRenderer
            iconKey={getWorkspaceIconDef(workspace?.icon) ? workspace?.icon : null}
            size={64}
            fallbackLetter={workspace?.name?.charAt(0).toUpperCase() || "W"}
            fallbackColor={wsColor}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold truncate" data-testid="overview-workspace-name">
                {workspace?.name || "Workspace"}
              </h1>
              {onEditWorkspace && workspace && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onEditWorkspace(workspace)}
                  data-testid="overview-edit-workspace"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className={cn("toggle-elevate", isFavorite && "toggle-elevated")}
                onClick={() => {
                  if (onToggleFavorite) {
                    onToggleFavorite(workspaceId);
                  } else {
                    favoriteMutation.mutate();
                  }
                }}
                data-testid="overview-toggle-favorite"
              >
                <Star className={cn("h-4 w-4", isFavorite ? "fill-yellow-400 text-yellow-400" : "")} />
              </Button>
            </div>
            {workspace?.description && (
              <p className="text-sm text-muted-foreground mb-3">{workspace.description}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" data-testid="stat-members">
                <Users className="h-3 w-3 mr-1" />
                {totalMembers} {totalMembers === 1 ? "Member" : "Members"}
              </Badge>
              <Badge variant="secondary" data-testid="stat-databases">
                <LayoutGrid className="h-3 w-3 mr-1" />
                {totalDatabases} {totalDatabases === 1 ? "Board" : "Boards"}
              </Badge>
              <Badge variant="secondary" data-testid="stat-documents">
                <FileText className="h-3 w-3 mr-1" />
                {totalDocuments} {totalDocuments === 1 ? "Document" : "Documents"}
              </Badge>
              <Badge
                variant="secondary"
                className={cn(
                  wsStatus === "active" && "bg-green-500/10 text-green-700 dark:text-green-400",
                  wsStatus === "archived" && "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
                  wsStatus === "closed" && "bg-red-500/10 text-red-700 dark:text-red-400"
                )}
                data-testid="stat-status"
              >
                {wsStatus.charAt(0).toUpperCase() + wsStatus.slice(1)}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8" data-testid="kpi-cards">
          <KPICard
            title="Total Items"
            value={totalItems}
            icon={Layers}
            colorClass="bg-blue-500/8 dark:bg-blue-500/10"
            iconColorClass="bg-blue-500"
            isLoading={kpiLoading}
            testId="kpi-total-items"
            delta={addedToday}
            deltaLabel="added today"
          />
          <KPICard
            title="In Progress"
            value={inProgress}
            icon={Timer}
            colorClass="bg-amber-500/8 dark:bg-amber-500/10"
            iconColorClass="bg-amber-500"
            isLoading={kpiLoading}
            testId="kpi-in-progress"
            delta={inProgressToday}
            deltaLabel="today"
          />
          <KPICard
            title="Due This Week"
            value={dueThisWeek}
            icon={CalendarDays}
            colorClass="bg-purple-500/8 dark:bg-purple-500/10"
            iconColorClass="bg-purple-500"
            isLoading={kpiLoading}
            testId="kpi-due-this-week"
          />
          <KPICard
            title="Completed"
            value={completed}
            icon={CheckCircle2}
            colorClass="bg-green-500/8 dark:bg-green-500/10"
            iconColorClass="bg-green-500"
            isLoading={kpiLoading}
            testId="kpi-completed"
            delta={completedToday}
            deltaLabel="today"
            subtitle={completedPct > 0 ? `${completedPct}% complete` : undefined}
          />
        </div>

        <SectionPanel
          title="Boards"
          count={totalDatabases}
          icon={LayoutGrid}
          actionLabel="New Board"
          onAction={() => onCreatePage(undefined, "database")}
          secondaryActionLabel={onCreateFromTemplate ? "From Template" : undefined}
          onSecondaryAction={onCreateFromTemplate}
          testId="overview-boards-panel"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="overview-boards">
            {databasePages.map((page, idx) => {
              const itemCount = getRowCountForPage(page.id);
              return (
                <ColoredTopCard
                  key={page.id}
                  color={getCardColor(idx)}
                  onClick={() => onSelectPage(page.id)}
                  testId={`overview-board-${page.id}`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: getCardColor(idx) + "1A" }}
                    >
                      <LayoutGrid className="h-4 w-4" style={{ color: getCardColor(idx) }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{page.title || "Untitled"}</div>
                      {page.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{page.description}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground invisible group-hover:visible flex-shrink-0 mt-0.5" />
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      {kpiLoading ? "..." : `${itemCount} item${itemCount !== 1 ? "s" : ""}`}
                    </span>
                    {page.updatedAt && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(page.updatedAt)}
                      </span>
                    )}
                  </div>
                </ColoredTopCard>
              );
            })}
            <ColoredTopCard
              isDashed
              onClick={() => onCreatePage(undefined, "database")}
              testId="overview-add-board"
            >
              <div className="flex flex-col items-center justify-center min-h-[80px]">
                <div className="w-9 h-9 rounded-md flex items-center justify-center bg-muted/50 mb-2">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-sm text-muted-foreground">Add New Board</span>
              </div>
            </ColoredTopCard>
          </div>
        </SectionPanel>

        <SectionPanel
          title="Documents"
          count={totalDocuments}
          icon={FileIcon}
          actionLabel="New Document"
          onAction={() => onCreatePage(undefined, "page")}
          testId="overview-documents-panel"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="overview-documents">
            {documentPages.map((page, idx) => (
              <ColoredTopCard
                key={page.id}
                color={getCardColor(idx + databasePages.length)}
                onClick={() => onSelectPage(page.id)}
                testId={`overview-doc-${page.id}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: getCardColor(idx + databasePages.length) + "1A" }}
                  >
                    <FileText className="h-4 w-4" style={{ color: getCardColor(idx + databasePages.length) }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{page.title || "Untitled"}</div>
                    {page.updatedAt && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(page.updatedAt)}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground invisible group-hover:visible flex-shrink-0 mt-0.5" />
                </div>
              </ColoredTopCard>
            ))}
            <ColoredTopCard
              isDashed
              onClick={() => onCreatePage(undefined, "page")}
              testId="overview-add-document"
            >
              <div className="flex flex-col items-center justify-center min-h-[80px]">
                <div className="w-9 h-9 rounded-md flex items-center justify-center bg-muted/50 mb-2">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="text-sm text-muted-foreground">Add New Document</span>
              </div>
            </ColoredTopCard>
          </div>
        </SectionPanel>

        {sectionPages.length > 0 && (
          <SectionPanel
            title="Sections"
            count={sectionPages.length}
            icon={FolderOpen}
            actionLabel="New Section"
            onAction={() => onCreatePage(undefined, "section")}
            testId="overview-sections-panel"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="overview-sections">
              {sectionPages.map((page, idx) => (
                <ColoredTopCard
                  key={page.id}
                  color={getCardColor(idx + databasePages.length + documentPages.length)}
                  onClick={() => onSelectPage(page.id)}
                  testId={`overview-section-${page.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: getCardColor(idx + databasePages.length + documentPages.length) + "1A" }}
                    >
                      <FolderOpen className="h-4 w-4" style={{ color: getCardColor(idx + databasePages.length + documentPages.length) }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{page.title || "Untitled"}</div>
                      {page.updatedAt && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(page.updatedAt)}
                        </span>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground invisible group-hover:visible flex-shrink-0 mt-0.5" />
                  </div>
                </ColoredTopCard>
              ))}
              <ColoredTopCard
                isDashed
                onClick={() => onCreatePage(undefined, "section")}
                testId="overview-add-section"
              >
                <div className="flex flex-col items-center justify-center min-h-[80px]">
                  <div className="w-9 h-9 rounded-md flex items-center justify-center bg-muted/50 mb-2">
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">Add New Section</span>
                </div>
              </ColoredTopCard>
            </div>
          </SectionPanel>
        )}
      </div>
    </div>
  );
}
