import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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
import { UniversalViewSystem, ColumnDef as ViewColumnDef } from "@/components/UniversalViewSystem";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckSquare, LayoutList, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AggregatedTask, TaskSummaryCounts } from "@shared/models/tasks";
import { TaskFilterBar } from "@/components/tasks/TaskFilterBar";
import { TaskQuickCreate } from "@/components/tasks/TaskQuickCreate";
import { TaskDetailSheet } from "@/components/tasks/TaskDetailSheet";
import { TaskAiTools } from "@/components/tasks/TaskAiTools";
import { TaskKpiStrip, TaskMobileCard } from "@/components/tasks/TaskKpiStrip";
import { TaskQueryShell, TaskTableSkeleton, TaskFilterSkeleton } from "@/components/tasks/loading";
import {
  DEFAULT_FILTERS,
  STATUS_COLORS,
  GROUP_OPTIONS,
  buildTasksQueryKey,
  dueGroupLabel,
  type TaskFilters,
} from "@/components/tasks/constants";
import { patchTasksListCache, rollbackTasksListCache } from "@/components/tasks/mutations";

function parseFiltersFromSearch(search: string): TaskFilters {
  const params = new URLSearchParams(search);
  return {
    source: params.get("source") ?? DEFAULT_FILTERS.source,
    status: params.get("status") ?? DEFAULT_FILTERS.status,
    priority: params.get("priority") ?? DEFAULT_FILTERS.priority,
    dueDatePreset: params.get("dueDatePreset") ?? DEFAULT_FILTERS.dueDatePreset,
    workspaceId: params.get("workspaceId") ?? DEFAULT_FILTERS.workspaceId,
    projectId: params.get("projectId") ?? DEFAULT_FILTERS.projectId,
    search: params.get("search") ?? DEFAULT_FILTERS.search,
  };
}

type RowTask = AggregatedTask & {
  dueGroup: string;
  groupSource: string;
  groupProject: string;
  groupWorkspace: string;
};

export default function TaskManagementPage() {
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const search = location.includes("?") ? location.slice(location.indexOf("?")) : "";
  const [filters, setFilters] = useState<TaskFilters>(() => parseFiltersFromSearch(search));
  const [selectedTask, setSelectedTask] = useState<AggregatedTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [groupBy, setGroupBy] = useState("source");
  const [aiOrder, setAiOrder] = useState<string[] | null>(null);
  const [mobileListMode, setMobileListMode] = useState(true);

  useEffect(() => {
    setFilters(parseFiltersFromSearch(search));
  }, [search]);

  const syncFiltersToUrl = (next: TaskFilters) => {
    const params = new URLSearchParams();
    if (next.source !== "all") params.set("source", next.source);
    if (next.status !== "all") params.set("status", next.status);
    if (next.priority !== "all") params.set("priority", next.priority);
    if (next.dueDatePreset !== "all") params.set("dueDatePreset", next.dueDatePreset);
    if (next.workspaceId !== "all") params.set("workspaceId", next.workspaceId);
    if (next.projectId !== "all") params.set("projectId", next.projectId);
    if (next.search) params.set("search", next.search);
    const q = params.toString();
    setLocation(q ? `/modules/tasks?${q}` : "/modules/tasks");
    setFilters(next);
  };

  const querySuffix = buildTasksQueryKey(filters)[0].replace("/api/tasks", "");

  const tasksQuery = useQuery<AggregatedTask[]>({
    queryKey: buildTasksQueryKey(filters),
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/tasks${querySuffix}`);
      if (!res.ok) throw new Error("Failed to load tasks");
      return res.json();
    },
  });

  const summaryQuery = useQuery<TaskSummaryCounts>({
    queryKey: [`/api/tasks/summary${querySuffix}`],
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/tasks/summary${querySuffix}`);
      if (!res.ok) throw new Error("Failed to load summary");
      return res.json();
    },
  });

  const workspacesQuery = useQuery<{ id: number; name: string; color: string }[]>({
    queryKey: ["/api/tasks/meta/workspaces"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/tasks/meta/workspaces");
      if (!res.ok) throw new Error("Failed to load workspaces");
      return res.json();
    },
    staleTime: 30_000,
  });

  const projectsQuery = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/tasks/meta/projects"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/tasks/meta/projects");
      if (!res.ok) throw new Error("Failed to load projects");
      return res.json();
    },
    staleTime: 30_000,
  });

  const tasks = tasksQuery.data ?? [];

  const tasksQueryKey = buildTasksQueryKey(filters);

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const res = await apiRequest("PUT", `/api/tasks/${id}`, updates);
      return res.json();
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: tasksQueryKey });
      const previous = patchTasksListCache(queryClient, filters, id, updates as Partial<AggregatedTask>);
      if (selectedTask?.id === id) {
        setSelectedTask((t) => (t ? { ...t, ...updates } as AggregatedTask : t));
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      rollbackTasksListCache(queryClient, filters, context?.previous);
      toast({ title: "Update failed", variant: "destructive" });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: tasksQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["/api/tasks/summary"] });
    },
  });

  const openTask = (task: AggregatedTask) => {
    setSelectedTask(task);
    setDetailOpen(true);
  };

  const tableData: RowTask[] = useMemo(() => {
    let rows = tasks.map((t) => ({
      ...t,
      dueGroup: dueGroupLabel(t.dueDate, t.isOverdue),
      groupSource: t.source,
      groupProject: t.projectName ?? "No project",
      groupWorkspace: t.workspaceName ?? "Internal",
    }));
    if (aiOrder?.length) {
      const orderMap = new Map(aiOrder.map((id, i) => [id, i]));
      rows = [...rows].sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999));
    }
    return rows;
  }, [tasks, aiOrder]);

  const statusOptions = [
    { value: "todo", label: "To Do", color: STATUS_COLORS.todo },
    { value: "in_progress", label: "In Progress", color: STATUS_COLORS.in_progress },
    { value: "completed", label: "Completed", color: STATUS_COLORS.completed },
    { value: "cancelled", label: "Cancelled", color: STATUS_COLORS.cancelled },
  ];

  const viewColumns: ViewColumnDef<RowTask>[] = [
    { id: "title", header: "Task", type: "text", accessor: "title", width: "32%", editable: false },
    { id: "source", header: "Source", type: "text", accessor: (r: RowTask) => r.source, width: "90px" },
    { id: "workspaceName", header: "Workspace", type: "text", accessor: "workspaceName", width: "110px" },
    { id: "contextLabel", header: "Project / context", type: "text", accessor: "contextLabel", width: "140px" },
    { id: "priority", header: "Priority", type: "priority", accessor: "priority", width: "90px", editable: true },
    { id: "dueDate", header: "Due", type: "date", accessor: "dueDate", width: "110px", editable: true },
    { id: "status", header: "Status", type: "status", accessor: "status", width: "120px", editable: true, options: statusOptions },
    { id: "dueGroup", header: "Due group", type: "text", accessor: "dueGroup", width: "0", hidden: true },
  ];

  const groupField =
    groupBy === "source" ? "source"
    : groupBy === "projectName" ? "contextLabel"
    : groupBy === "workspaceName" ? "workspaceName"
    : groupBy === "priority" ? "priority"
    : groupBy === "dueGroup" ? "dueGroup"
    : "status";

  const metaLoading = workspacesQuery.isLoading || projectsQuery.isLoading;

  return (
    <ModuleShell className={modulePageShellClass} testId="task-mgmt-page" mainClassName={modulePageMainClass}>
        <div className={modulePageBannerWrapClass}>
          <ModuleWelcomeBanner
            moduleKey="tasks"
            features={[
              "Cross-workspace aggregation",
              "Project · Team · Meeting · Helpdesk · Approval sources",
              "Quick-create (N)",
              "AI prioritisation",
            ]}
          />
        </div>

        <div className={modulePageStickyHeaderClass}>
          <ModuleHeader
            icon={CheckSquare}
            title="My Tasks"
            subtitle="What you need to do today, across everything"
            searchPlaceholder=""
            searchValue=""
            onSearchChange={() => {}}
            titleTestId="task-mgmt-title"
          />
        </div>

        <div className={modulePageContentOuterClass}>
          <div className={modulePageContentScrollClass}>
        <TaskQueryShell query={tasksQuery} skeleton="full">
          <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 max-w-[1600px] w-full mx-auto">
            <TaskQueryShell query={summaryQuery} skeleton="kpi">
              <TaskKpiStrip
                summary={summaryQuery.data}
                loading={summaryQuery.isLoading}
                onFilter={(patch) => syncFiltersToUrl({ ...filters, ...patch })}
              />
            </TaskQueryShell>

            <TaskQuickCreate filters={filters} />

            {metaLoading ? (
              <TaskFilterSkeleton />
            ) : (
              <TaskFilterBar
                filters={filters}
                onChange={(patch) => syncFiltersToUrl({ ...filters, ...patch })}
                workspaces={workspacesQuery.data ?? []}
                projects={projectsQuery.data ?? []}
              />
            )}

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">Group by</span>
                <Select value={groupBy} onValueChange={setGroupBy}>
                  <SelectTrigger className="h-9 w-full sm:w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GROUP_OPTIONS.map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 md:hidden">
                <Button
                  variant={mobileListMode ? "default" : "outline"}
                  size="sm"
                  className="h-9 flex-1"
                  onClick={() => setMobileListMode(true)}
                >
                  <LayoutList className="h-4 w-4 mr-1" /> Cards
                </Button>
                <Button
                  variant={!mobileListMode ? "default" : "outline"}
                  size="sm"
                  className="h-9 flex-1"
                  onClick={() => setMobileListMode(false)}
                >
                  <LayoutGrid className="h-4 w-4 mr-1" /> Views
                </Button>
              </div>
            </div>

            {tasksQuery.isLoading && !tasks.length ? (
              <TaskTableSkeleton />
            ) : (
              <>
                <div className={cn("md:hidden space-y-2", !mobileListMode && "hidden")}>
                  {tableData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">
                      No tasks match your filters. Press N to create a personal task.
                    </p>
                  ) : (
                    tableData.map((task) => (
                      <TaskMobileCard key={task.id} task={task} onOpen={() => openTask(task)} />
                    ))
                  )}
                </div>

                <div className={cn("relative", mobileListMode && "hidden md:block")}>
                  <UniversalViewSystem
                    columns={viewColumns}
                    data={tableData}
                    onRowClick={(row) => openTask(row)}
                    onRowDoubleClick={(row) => openTask(row)}
                    onCellEdit={(id, columnId, value) =>
                      updateMutation.mutateAsync({ id: String(id), updates: { [columnId]: value } })
                    }
                    onAddItem={() => {}}
                    dateField="dueDate"
                    statusField="status"
                    titleField="title"
                    emptyMessage="No tasks match your filters. Press N to create a personal task."
                    addItemLabel=""
                    enabledViews={["table", "kanban", "calendar", "gantt", "list"]}
                    defaultView="table"
                    initialGroupColumnId={groupField}
                  />
                </div>
              </>
            )}

            <TaskAiTools filters={filters} tasks={tasks} onPrioritized={setAiOrder} />
          </div>
        </TaskQueryShell>
          </div>
        </div>

        <TaskDetailSheet
          task={selectedTask}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          filters={filters}
        />
    </ModuleShell>
  );
}
