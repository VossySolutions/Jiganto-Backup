import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, ColDef, CellValueChangedEvent, RowDragEvent, GetContextMenuItemsParams, MenuItemDef } from "ag-grid-community";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Calendar, ChevronDown, ChevronRight, Milestone, Settings, Trash2, Copy, Save, MoreHorizontal, User, GitBranch, Palette, Edit } from "lucide-react";
import type { PmProject, PmProjectPhase, PmTask, PmWorkstream, PmMilestone } from "@shared/models/projects";

// Dependency types
type DependencyType = "FS" | "SS" | "FF" | "SF";

interface DependencyLink {
  fromId: string;
  toId: string;
  type: DependencyType;
}

ModuleRegistry.registerModules([AllCommunityModule]);

interface ProfessionalGanttChartProps {
  projectId: number;
}

type ItemType = "project" | "release" | "phase" | "workstream" | "activity" | "task" | "milestone";

interface GanttRow {
  id: string;
  wbsId: string;
  itemType: ItemType;
  name: string;
  duration: number;
  startDate: string;
  endDate: string;
  progress: number;
  status: string;
  priority: string;
  resource: string;
  predecessors: string;
  successors: string;
  isMilestone: boolean;
  level: number;
  isExpanded: boolean;
  hasChildren: boolean;
  originalId: number;
  originalData: PmProject | PmProjectPhase | PmWorkstream | PmTask | PmMilestone;
  parentId: string | null;
}

type ViewMode = "day" | "week" | "month" | "year";

// Color scheme presets
const COLOR_SCHEMES = {
  default: {
    project: { bar: "hsl(var(--primary))", progress: "#1d4ed8", text: "Project" },
    release: { bar: "hsl(var(--accent-pink))", progress: "#db2777", text: "Release" },
    phase: { bar: "#8b5cf6", progress: "#6d28d9", text: "Phase" },
    workstream: { bar: "#06b6d4", progress: "#0891b2", text: "Workstream" },
    activity: { bar: "#10b981", progress: "#059669", text: "Activity" },
    task: { bar: "hsl(var(--accent-orange))", progress: "#d97706", text: "Task" },
    milestone: { bar: "hsl(var(--destructive))", progress: "#dc2626", text: "Milestone" },
  },
  ocean: {
    project: { bar: "#0ea5e9", progress: "#0284c7", text: "Project" },
    release: { bar: "#06b6d4", progress: "#0891b2", text: "Release" },
    phase: { bar: "#14b8a6", progress: "#0d9488", text: "Phase" },
    workstream: { bar: "hsl(var(--accent-green))", progress: "#16a34a", text: "Workstream" },
    activity: { bar: "#84cc16", progress: "#65a30d", text: "Activity" },
    task: { bar: "#eab308", progress: "#ca8a04", text: "Task" },
    milestone: { bar: "#f97316", progress: "#ea580c", text: "Milestone" },
  },
  sunset: {
    project: { bar: "#f43f5e", progress: "#e11d48", text: "Project" },
    release: { bar: "hsl(var(--accent-pink))", progress: "#db2777", text: "Release" },
    phase: { bar: "#d946ef", progress: "#c026d3", text: "Phase" },
    workstream: { bar: "#a855f7", progress: "#9333ea", text: "Workstream" },
    activity: { bar: "#8b5cf6", progress: "hsl(var(--accent-purple))", text: "Activity" },
    task: { bar: "#f97316", progress: "#ea580c", text: "Task" },
    milestone: { bar: "hsl(var(--destructive))", progress: "#dc2626", text: "Milestone" },
  },
  forest: {
    project: { bar: "hsl(var(--accent-green))", progress: "#16a34a", text: "Project" },
    release: { bar: "#10b981", progress: "#059669", text: "Release" },
    phase: { bar: "#14b8a6", progress: "#0d9488", text: "Phase" },
    workstream: { bar: "#06b6d4", progress: "#0891b2", text: "Workstream" },
    activity: { bar: "#84cc16", progress: "#65a30d", text: "Activity" },
    task: { bar: "#eab308", progress: "#ca8a04", text: "Task" },
    milestone: { bar: "#a3e635", progress: "#84cc16", text: "Milestone" },
  },
  monochrome: {
    project: { bar: "#1f2937", progress: "#111827", text: "Project" },
    release: { bar: "#374151", progress: "#1f2937", text: "Release" },
    phase: { bar: "#4b5563", progress: "#374151", text: "Phase" },
    workstream: { bar: "#6b7280", progress: "#4b5563", text: "Workstream" },
    activity: { bar: "#9ca3af", progress: "#6b7280", text: "Activity" },
    task: { bar: "#d1d5db", progress: "#9ca3af", text: "Task" },
    milestone: { bar: "#f3f4f6", progress: "#d1d5db", text: "Milestone" },
  },
  softModern: {
    project: { bar: "hsl(var(--primary))", progress: "#1d4ed8", text: "Project" },
    release: { bar: "#66b2ff", progress: "#3399ff", text: "Release" },
    phase: { bar: "#ff8066", progress: "#e6594a", text: "Phase" },
    workstream: { bar: "#66ff99", progress: "#33cc66", text: "Workstream" },
    activity: { bar: "#ffcc66", progress: "#e6a833", text: "Activity" },
    task: { bar: "#b299ff", progress: "#8c66e6", text: "Task" },
    milestone: { bar: "hsl(var(--destructive))", progress: "#dc2626", text: "Milestone" },
  },
  vibrantContrast: {
    project: { bar: "hsl(var(--primary))", progress: "#1d4ed8", text: "Project" },
    release: { bar: "#0099ff", progress: "#0077cc", text: "Release" },
    phase: { bar: "#ff6600", progress: "#cc5200", text: "Phase" },
    workstream: { bar: "#00cc66", progress: "#009944", text: "Workstream" },
    activity: { bar: "#ff3399", progress: "#cc1a7a", text: "Activity" },
    task: { bar: "#9966ff", progress: "#7744cc", text: "Task" },
    milestone: { bar: "hsl(var(--destructive))", progress: "#dc2626", text: "Milestone" },
  },
  muted: {
    project: { bar: "hsl(var(--primary))", progress: "#1d4ed8", text: "Project" },
    release: { bar: "#4682b4", progress: "#365f8a", text: "Release" },
    phase: { bar: "#cc5500", progress: "#994400", text: "Phase" },
    workstream: { bar: "#869973", progress: "#667755", text: "Workstream" },
    activity: { bar: "#ccaa00", progress: "#998800", text: "Activity" },
    task: { bar: "#9966cc", progress: "#774499", text: "Task" },
    milestone: { bar: "hsl(var(--destructive))", progress: "#dc2626", text: "Milestone" },
  },
  pastel: {
    project: { bar: "hsl(var(--primary))", progress: "#1d4ed8", text: "Project" },
    release: { bar: "#99ccff", progress: "#66aaff", text: "Release" },
    phase: { bar: "#ffb399", progress: "#ff8866", text: "Phase" },
    workstream: { bar: "#99ffcc", progress: "#66dd99", text: "Workstream" },
    activity: { bar: "#ffff99", progress: "#eeee66", text: "Activity" },
    task: { bar: "#cc99ff", progress: "#aa66ee", text: "Task" },
    milestone: { bar: "hsl(var(--destructive))", progress: "#dc2626", text: "Milestone" },
  },
  boldModern: {
    project: { bar: "hsl(var(--primary))", progress: "#1d4ed8", text: "Project" },
    release: { bar: "#00ccff", progress: "#0099cc", text: "Release" },
    phase: { bar: "#ff8c00", progress: "#cc7000", text: "Phase" },
    workstream: { bar: "#99ff00", progress: "#77cc00", text: "Workstream" },
    activity: { bar: "#ff33cc", progress: "#cc1a99", text: "Activity" },
    task: { bar: "#6633cc", progress: "#4d2699", text: "Task" },
    milestone: { bar: "hsl(var(--destructive))", progress: "#dc2626", text: "Milestone" },
  },
};

type ColorScheme = keyof typeof COLOR_SCHEMES;

const MONTH_PASTEL_COLORS = [
  "bg-rose-50 dark:bg-rose-950/30",
  "bg-sky-50 dark:bg-sky-950/30",
  "bg-emerald-50 dark:bg-emerald-950/30",
  "bg-amber-50 dark:bg-amber-950/30",
  "bg-violet-50 dark:bg-violet-950/30",
  "bg-teal-50 dark:bg-teal-950/30",
  "bg-pink-50 dark:bg-pink-950/30",
  "bg-indigo-50 dark:bg-indigo-950/30",
  "bg-lime-50 dark:bg-lime-950/30",
  "bg-orange-50 dark:bg-orange-950/30",
  "bg-cyan-50 dark:bg-cyan-950/30",
  "bg-fuchsia-50 dark:bg-fuchsia-950/30",
];

const STATUS_OPTIONS = ["not_started", "in_progress", "completed", "on_hold", "blocked"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"];
const TYPE_OPTIONS: ItemType[] = ["project", "release", "phase", "workstream", "activity", "task", "milestone"];

const parseDate = (dateStr: string | Date | null | undefined): Date => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

const formatDate = (date: Date): string => {
  return date.toISOString().split("T")[0];
};

const calculateDuration = (start: Date, end: Date): number => {
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export function ProfessionalGanttChart({ projectId }: ProfessionalGanttChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set(["project-" + projectId]));
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [gridWidth, setGridWidth] = useState(750);
  const [isResizing, setIsResizing] = useState(false);
  const [colorScheme, setColorScheme] = useState<ColorScheme>("default");
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [colorDialogOpen, setColorDialogOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<"all" | "releases" | "phases" | "workstreams" | "activities" | "tasks">("all");
  
  // Bar dragging state
  const [isDraggingBar, setIsDraggingBar] = useState(false);
  const [draggingRowId, setDraggingRowId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<"move" | "resize-start" | "resize-end" | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [originalBarData, setOriginalBarData] = useState<{ startDate: string; endDate: string } | null>(null);
  
  // Dependency creation state
  const [isCreatingDependency, setIsCreatingDependency] = useState(false);
  const [dependencyStartRow, setDependencyStartRow] = useState<string | null>(null);
  const [dependencyStartPoint, setDependencyStartPoint] = useState<"start" | "end" | null>(null);
  const [dependencyMousePos, setDependencyMousePos] = useState({ x: 0, y: 0 });
  const [dependencyDialogOpen, setDependencyDialogOpen] = useState(false);
  const [pendingDependency, setPendingDependency] = useState<{ from: string; to: string; fromPoint: "start" | "end"; toPoint: "start" | "end" } | null>(null);
  
  const gridRef = useRef<AgGridReact>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineBodyRef = useRef<HTMLDivElement>(null);
  const timelineHeaderRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollSyncing = useRef(false);
  const { toast } = useToast();
  
  const TYPE_COLORS = COLOR_SCHEMES[colorScheme];

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      setGridWidth(Math.max(400, Math.min(newWidth, containerRect.width - 200)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const { data: project } = useQuery<PmProject>({
    queryKey: [`/api/pm/projects/${projectId}`],
    enabled: !!projectId,
  });

  const { data: phases = [], isLoading: phasesLoading } = useQuery<PmProjectPhase[]>({
    queryKey: ["/api/pm/projects", projectId, "phases"],
    enabled: !!projectId,
  });

  const { data: workstreams = [], isLoading: workstreamsLoading } = useQuery<PmWorkstream[]>({
    queryKey: [`/api/pm/workstreams?projectId=${projectId}`],
    enabled: !!projectId,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<PmTask[]>({
    queryKey: ["/api/pm/projects", projectId, "tasks"],
    enabled: !!projectId,
  });

  const { data: milestones = [] } = useQuery<PmMilestone[]>({
    queryKey: ["/api/pm/projects", projectId, "milestones"],
    enabled: !!projectId,
  });

  const { data: teamMembers = [] } = useQuery<{ id: number; userId: string; role: string }[]>({
    queryKey: ["/api/pm/projects", projectId, "team"],
    enabled: !!projectId,
  });

  const updatePhaseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PmProjectPhase> }) => {
      return apiRequest("PUT", `/api/pm/phases/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "phases"] });
    },
  });

  const updateWorkstreamMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PmWorkstream> }) => {
      return apiRequest("PUT", `/api/pm/workstreams/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pm/workstreams?projectId=${projectId}`] });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PmTask> }) => {
      return apiRequest("PUT", `/api/pm/tasks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "tasks"] });
    },
  });

  const createPhaseMutation = useMutation({
    mutationFn: async (data: Partial<PmProjectPhase>) => {
      return apiRequest("POST", `/api/pm/phases`, { ...data, projectId, tenantId: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "phases"] });
      toast({ title: "Phase created" });
    },
  });

  const createWorkstreamMutation = useMutation({
    mutationFn: async (data: Partial<PmWorkstream>) => {
      return apiRequest("POST", `/api/pm/workstreams`, { ...data, projectId, tenantId: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pm/workstreams?projectId=${projectId}`] });
      toast({ title: "Workstream created" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: Partial<PmTask>) => {
      return apiRequest("POST", `/api/pm/tasks`, { ...data, projectId, tenantId: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "tasks"] });
      toast({ title: "Task created" });
    },
  });

  const updateMilestoneMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PmMilestone> }) => {
      return apiRequest("PUT", `/api/pm/milestones/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "milestones"] });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PmProject> }) => {
      return apiRequest("PUT", `/api/pm/projects/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pm/projects/${projectId}`] });
    },
  });

  const createMilestoneMutation = useMutation({
    mutationFn: async (data: Partial<PmMilestone>) => {
      return apiRequest("POST", `/api/pm/milestones`, { ...data, projectId, tenantId: 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "milestones"] });
      toast({ title: "Milestone created" });
    },
  });

  const deletePhaseMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/pm/phases/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "phases"] });
      toast({ title: "Phase deleted" });
    },
  });

  const deleteWorkstreamMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/pm/workstreams/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pm/workstreams?projectId=${projectId}`] });
      toast({ title: "Workstream deleted" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/pm/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "tasks"] });
      toast({ title: "Task deleted" });
    },
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/pm/milestones/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "milestones"] });
      toast({ title: "Milestone deleted" });
    },
  });

  const buildGanttRows = useMemo((): GanttRow[] => {
    if (!project) return [];
    const rows: GanttRow[] = [];
    const today = new Date();
    let wbsCounter = { phase: 0, workstream: 0, activity: 0, task: 0 };

    const projectStart = parseDate(project.startDate) || today;
    const projectEnd = project.endDate ? parseDate(project.endDate) : addDays(projectStart, 90);

    rows.push({
      id: `project-${project.id}`,
      wbsId: "1",
      itemType: "project",
      name: project.name,
      duration: calculateDuration(projectStart, projectEnd),
      startDate: formatDate(projectStart),
      endDate: formatDate(projectEnd),
      progress: project.progress || 0,
      status: project.status || "active",
      priority: project.priority || "medium",
      resource: "",
      predecessors: "",
      successors: "",
      isMilestone: false,
      level: 0,
      isExpanded: expandedRows.has(`project-${project.id}`),
      hasChildren: phases.length > 0 || tasks.length > 0,
      originalId: project.id,
      originalData: project,
      parentId: null,
    });

    const sortedPhases = [...phases].sort((a, b) => (a.order || 0) - (b.order || 0));
    sortedPhases.forEach((phase, phaseIdx) => {
      wbsCounter.phase++;
      const phaseWbs = `1.${wbsCounter.phase}`;
      const phaseStart = phase.plannedStartDate ? parseDate(phase.plannedStartDate) : today;
      const phaseEnd = phase.plannedEndDate ? parseDate(phase.plannedEndDate) : addDays(phaseStart, 14);
      const phaseId = `phase-${phase.id}`;

      rows.push({
        id: phaseId,
        wbsId: phaseWbs,
        itemType: "phase",
        name: phase.name,
        duration: calculateDuration(phaseStart, phaseEnd),
        startDate: formatDate(phaseStart),
        endDate: formatDate(phaseEnd),
        progress: phase.progress || 0,
        status: phase.status || "not_started",
        priority: "medium",
        resource: "",
        predecessors: "",
        successors: "",
        isMilestone: false,
        level: 1,
        isExpanded: expandedRows.has(phaseId),
        hasChildren: workstreams.some(ws => ws.phaseId === phase.id) || tasks.some(t => t.phaseId === phase.id),
        originalId: phase.id,
        originalData: phase,
        parentId: `project-${project.id}`,
      });

      if (expandedRows.has(`project-${project.id}`)) {
        const phaseWorkstreams = workstreams
          .filter(ws => ws.phaseId === phase.id && ws.type === "workstream")
          .sort((a, b) => (a.order || 0) - (b.order || 0));

        let wsCounter = 0;
        phaseWorkstreams.forEach(ws => {
          wsCounter++;
          const wsWbs = `${phaseWbs}.${wsCounter}`;
          const wsStart = ws.plannedStartDate ? parseDate(ws.plannedStartDate) : phaseStart;
          const wsEnd = ws.plannedEndDate ? parseDate(ws.plannedEndDate) : addDays(wsStart, 7);
          const wsId = `workstream-${ws.id}`;

          if (expandedRows.has(phaseId)) {
            rows.push({
              id: wsId,
              wbsId: wsWbs,
              itemType: "workstream",
              name: ws.name,
              duration: calculateDuration(wsStart, wsEnd),
              startDate: formatDate(wsStart),
              endDate: formatDate(wsEnd),
              progress: ws.progress || 0,
              status: ws.status || "not_started",
              priority: "medium",
              resource: "",
              predecessors: "",
              successors: "",
              isMilestone: false,
              level: 2,
              isExpanded: expandedRows.has(wsId),
              hasChildren: workstreams.some(a => a.parentWorkstreamId === ws.id),
              originalId: ws.id,
              originalData: ws,
              parentId: phaseId,
            });

            const activities = workstreams
              .filter(a => a.parentWorkstreamId === ws.id && a.type === "activity")
              .sort((a, b) => (a.order || 0) - (b.order || 0));

            let actCounter = 0;
            activities.forEach(activity => {
              actCounter++;
              const actWbs = `${wsWbs}.${actCounter}`;
              const actStart = activity.plannedStartDate ? parseDate(activity.plannedStartDate) : wsStart;
              const actEnd = activity.plannedEndDate ? parseDate(activity.plannedEndDate) : addDays(actStart, 5);
              const actId = `activity-${activity.id}`;

              if (expandedRows.has(wsId)) {
                rows.push({
                  id: actId,
                  wbsId: actWbs,
                  itemType: "activity",
                  name: activity.name,
                  duration: calculateDuration(actStart, actEnd),
                  startDate: formatDate(actStart),
                  endDate: formatDate(actEnd),
                  progress: activity.progress || 0,
                  status: activity.status || "not_started",
                  priority: "medium",
                  resource: "",
                  predecessors: "",
                  successors: "",
                  isMilestone: false,
                  level: 3,
                  isExpanded: expandedRows.has(actId),
                  hasChildren: tasks.some(t => t.phaseId === phase.id),
                  originalId: activity.id,
                  originalData: activity,
                  parentId: wsId,
                });
              }
            });
          }
        });

        const phaseTasks = tasks
          .filter(t => t.phaseId === phase.id && !t.parentTaskId)
          .sort((a, b) => (a.order || 0) - (b.order || 0));

        let taskCounter = 0;
        phaseTasks.forEach(task => {
          taskCounter++;
          const taskWbs = `${phaseWbs}.T${taskCounter}`;
          const taskStart = task.plannedStartDate ? parseDate(task.plannedStartDate) : phaseStart;
          const taskEnd = task.plannedEndDate ? parseDate(task.plannedEndDate) : addDays(taskStart, 3);
          const taskId = `task-${task.id}`;

          if (expandedRows.has(phaseId)) {
            const predecessorStr = task.predecessorIds?.map(id => `T-${id}`).join(", ") || "";
            const successorStr = task.successorIds?.map(id => `T-${id}`).join(", ") || "";

            rows.push({
              id: taskId,
              wbsId: task.wbsCode || taskWbs,
              itemType: "task",
              name: task.name,
              duration: calculateDuration(taskStart, taskEnd),
              startDate: formatDate(taskStart),
              endDate: formatDate(taskEnd),
              progress: task.progress || 0,
              status: task.status || "todo",
              priority: task.priority || "medium",
              resource: task.assigneeId || "",
              predecessors: predecessorStr,
              successors: successorStr,
              isMilestone: false,
              level: 3,
              isExpanded: false,
              hasChildren: tasks.some(t => t.parentTaskId === task.id),
              originalId: task.id,
              originalData: task,
              parentId: phaseId,
            });
          }
        });

        const phaseMilestones = milestones
          .filter(m => m.phaseId === phase.id)
          .sort((a, b) => (a.order || 0) - (b.order || 0));

        phaseMilestones.forEach((ms, msIdx) => {
          const msWbs = `${phaseWbs}.M${msIdx + 1}`;
          const msDate = ms.dueDate ? parseDate(ms.dueDate) : phaseEnd;
          const msId = `milestone-${ms.id}`;

          if (expandedRows.has(phaseId)) {
            rows.push({
              id: msId,
              wbsId: msWbs,
              itemType: "milestone",
              name: ms.name,
              duration: 0,
              startDate: formatDate(msDate),
              endDate: formatDate(msDate),
              progress: ms.status === "completed" ? 100 : 0,
              status: ms.status || "pending",
              priority: ms.isCritical ? "critical" : "medium",
              resource: ms.ownerId || "",
              predecessors: "",
              successors: "",
              isMilestone: true,
              level: 2,
              isExpanded: false,
              hasChildren: false,
              originalId: ms.id,
              originalData: ms,
              parentId: phaseId,
            });
          }
        });
      }
    });

    // Orphan tasks — no phaseId, render directly under the project row
    if (expandedRows.has(`project-${project.id}`)) {
      const orphanTasks = tasks
        .filter(t => !t.phaseId && !t.parentTaskId)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      let orphanCounter = 0;
      orphanTasks.forEach(task => {
        orphanCounter++;
        const taskWbs = `1.T${orphanCounter}`;
        const taskStart = task.plannedStartDate ? parseDate(task.plannedStartDate) : today;
        const taskEnd = task.plannedEndDate ? parseDate(task.plannedEndDate) : addDays(taskStart, 3);
        const taskId = `task-${task.id}`;
        const isMilestone = task.ganttType === "milestone";

        const predecessorStr = task.predecessorIds?.map(id => `T-${id}`).join(", ") || "";
        const successorStr = task.successorIds?.map(id => `T-${id}`).join(", ") || "";

        rows.push({
          id: taskId,
          wbsId: task.wbsCode || taskWbs,
          itemType: isMilestone ? "milestone" : (task.ganttType as ItemType) || "task",
          name: task.name,
          duration: isMilestone ? 0 : calculateDuration(taskStart, taskEnd),
          startDate: formatDate(taskStart),
          endDate: isMilestone ? formatDate(taskStart) : formatDate(taskEnd),
          progress: task.progress || 0,
          status: task.status || "todo",
          priority: task.priority || "medium",
          resource: task.assigneeId || "",
          predecessors: predecessorStr,
          successors: successorStr,
          isMilestone,
          level: 1,
          isExpanded: false,
          hasChildren: tasks.some(t => t.parentTaskId === task.id),
          originalId: task.id,
          originalData: task,
          parentId: `project-${project.id}`,
        });

        // Child tasks (subtasks)
        const childTasks = tasks
          .filter(t => t.parentTaskId === task.id)
          .sort((a, b) => (a.order || 0) - (b.order || 0));

        childTasks.forEach((child, childIdx) => {
          const childStart = child.plannedStartDate ? parseDate(child.plannedStartDate) : taskStart;
          const childEnd = child.plannedEndDate ? parseDate(child.plannedEndDate) : addDays(childStart, 3);
          const childId = `task-${child.id}`;
          const childIsMilestone = child.ganttType === "milestone";

          rows.push({
            id: childId,
            wbsId: `${taskWbs}.${childIdx + 1}`,
            itemType: childIsMilestone ? "milestone" : (child.ganttType as ItemType) || "task",
            name: child.name,
            duration: childIsMilestone ? 0 : calculateDuration(childStart, childEnd),
            startDate: formatDate(childStart),
            endDate: childIsMilestone ? formatDate(childStart) : formatDate(childEnd),
            progress: child.progress || 0,
            status: child.status || "todo",
            priority: child.priority || "medium",
            resource: child.assigneeId || "",
            predecessors: child.predecessorIds?.map(id => `T-${id}`).join(", ") || "",
            successors: child.successorIds?.map(id => `T-${id}`).join(", ") || "",
            isMilestone: childIsMilestone,
            level: 2,
            isExpanded: false,
            hasChildren: false,
            originalId: child.id,
            originalData: child,
            parentId: taskId,
          });
        });
      });

      // Orphan milestones — no phaseId
      const orphanMilestones = milestones
        .filter(m => !m.phaseId)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      orphanMilestones.forEach((ms, msIdx) => {
        const msDate = ms.dueDate ? parseDate(ms.dueDate) : today;
        const msId = `milestone-${ms.id}`;
        rows.push({
          id: msId,
          wbsId: `1.M${msIdx + 1}`,
          itemType: "milestone",
          name: ms.name,
          duration: 0,
          startDate: formatDate(msDate),
          endDate: formatDate(msDate),
          progress: ms.status === "completed" ? 100 : 0,
          status: ms.status || "pending",
          priority: ms.isCritical ? "critical" : "medium",
          resource: ms.ownerId || "",
          predecessors: "",
          successors: "",
          isMilestone: true,
          level: 1,
          isExpanded: false,
          hasChildren: false,
          originalId: ms.id,
          originalData: ms,
          parentId: `project-${project.id}`,
        });
      });
    }

    return rows;
  }, [project, phases, workstreams, tasks, milestones, expandedRows]);

  const filteredGanttRows = useMemo(() => {
    if (filterTab === "all") return buildGanttRows;
    
    const typeMap: Record<string, string[]> = {
      releases: ["release"],
      phases: ["phase"],
      workstreams: ["workstream"],
      activities: ["activity"],
      tasks: ["task"],
    };
    
    const allowedTypes = typeMap[filterTab] || [];
    return buildGanttRows.filter(row => 
      row.itemType === "project" || allowedTypes.includes(row.itemType)
    );
  }, [buildGanttRows, filterTab]);

  const timelineData = useMemo(() => {
    if (buildGanttRows.length === 0) return { columns: [], startDate: new Date(), endDate: new Date() };

    let minDate = new Date();
    let maxDate = new Date();

    buildGanttRows.forEach(row => {
      const start = parseDate(row.startDate);
      const end = parseDate(row.endDate);
      if (start < minDate) minDate = start;
      if (end > maxDate) maxDate = end;
    });

    minDate = addDays(minDate, -7);
    maxDate = addDays(maxDate, 14);

    const columns: { date: Date; label: string; isWeekend: boolean; month: string; monthIndex: number }[] = [];
    let currentDate = new Date(minDate);
    let monthCounter = 0;
    let lastMonth = "";

    while (currentDate <= maxDate) {
      const dayOfWeek = currentDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dayNum = currentDate.getDate();
      const dayName = currentDate.toLocaleDateString("en-US", { weekday: "short" });
      const month = currentDate.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

      if (month !== lastMonth) {
        monthCounter++;
        lastMonth = month;
      }

      columns.push({
        date: new Date(currentDate),
        label: viewMode === "day" ? `${dayNum} ${dayName}` : `${dayName} ${dayNum}`,
        isWeekend,
        month,
        monthIndex: monthCounter - 1,
      });

      currentDate = addDays(currentDate, 1);
    }

    return { columns, startDate: minDate, endDate: maxDate };
  }, [buildGanttRows, viewMode]);

  const toggleExpand = useCallback((rowId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  const parsePredecessorIds = useCallback((value: string): number[] => {
    if (!value) return [];
    return value.split(",")
      .map(v => v.trim().replace(/^T-/i, ""))
      .filter(v => v)
      .map(v => parseInt(v))
      .filter(v => !isNaN(v));
  }, []);

  const handleCellValueChanged = useCallback((event: CellValueChangedEvent<GanttRow>) => {
    const { data, colDef, newValue } = event;
    if (!data || !colDef.field) return;

    const field = colDef.field;
    const { itemType, originalId } = data;

    if (itemType === "project") {
      const updateData: Partial<PmProject> = {};
      if (field === "name") updateData.name = newValue;
      if (field === "startDate") updateData.startDate = newValue;
      if (field === "endDate") updateData.endDate = newValue;
      if (field === "progress") updateData.progress = parseInt(newValue) || 0;
      if (field === "status") updateData.status = newValue;
      if (field === "priority") updateData.priority = newValue;
      if (Object.keys(updateData).length > 0) {
        updateProjectMutation.mutate({ id: originalId, data: updateData });
      }
    } else if (itemType === "phase" || itemType === "release") {
      const updateData: Partial<PmProjectPhase> = {};
      if (field === "name") updateData.name = newValue;
      if (field === "startDate") updateData.plannedStartDate = newValue;
      if (field === "endDate") updateData.plannedEndDate = newValue;
      if (field === "progress") updateData.progress = parseInt(newValue) || 0;
      if (field === "status") updateData.status = newValue;
      if (Object.keys(updateData).length > 0) {
        updatePhaseMutation.mutate({ id: originalId, data: updateData });
      }
    } else if (itemType === "workstream" || itemType === "activity") {
      const updateData: Partial<PmWorkstream> = {};
      if (field === "name") updateData.name = newValue;
      if (field === "startDate") updateData.plannedStartDate = newValue;
      if (field === "endDate") updateData.plannedEndDate = newValue;
      if (field === "progress") updateData.progress = parseInt(newValue) || 0;
      if (field === "status") updateData.status = newValue;
      if (Object.keys(updateData).length > 0) {
        updateWorkstreamMutation.mutate({ id: originalId, data: updateData });
      }
    } else if (itemType === "task") {
      const updateData: Partial<PmTask> = {};
      if (field === "name") updateData.name = newValue;
      if (field === "startDate") updateData.plannedStartDate = newValue;
      if (field === "endDate") updateData.plannedEndDate = newValue;
      if (field === "progress") updateData.progress = parseInt(newValue) || 0;
      if (field === "status") updateData.status = newValue;
      if (field === "priority") updateData.priority = newValue;
      if (field === "predecessors") {
        updateData.predecessorIds = parsePredecessorIds(newValue);
      }
      if (field === "successors") {
        updateData.successorIds = parsePredecessorIds(newValue);
      }
      if (field === "resource") {
        updateData.assigneeId = newValue || null;
      }
      if (Object.keys(updateData).length > 0) {
        updateTaskMutation.mutate({ id: originalId, data: updateData });
        toast({ title: "Saved", description: `${field} updated successfully` });
      }
    } else if (itemType === "milestone") {
      const updateData: Partial<PmMilestone> = {};
      if (field === "name") updateData.name = newValue;
      if (field === "startDate" || field === "endDate") updateData.dueDate = newValue;
      if (field === "status") updateData.status = newValue;
      if (Object.keys(updateData).length > 0) {
        updateMilestoneMutation.mutate({ id: originalId, data: updateData });
      }
    }
  }, [updateProjectMutation, updatePhaseMutation, updateWorkstreamMutation, updateTaskMutation, updateMilestoneMutation, parsePredecessorIds, toast]);

  const deleteRow = useCallback((row: GanttRow) => {
    const { itemType, originalId } = row;
    if (itemType === "phase" || itemType === "release") {
      deletePhaseMutation.mutate(originalId);
    } else if (itemType === "workstream" || itemType === "activity") {
      deleteWorkstreamMutation.mutate(originalId);
    } else if (itemType === "task") {
      deleteTaskMutation.mutate(originalId);
    } else if (itemType === "milestone") {
      deleteMilestoneMutation.mutate(originalId);
    }
  }, [deletePhaseMutation, deleteWorkstreamMutation, deleteTaskMutation, deleteMilestoneMutation]);

  const deleteSelectedRows = useCallback(() => {
    selectedRows.forEach(rowId => {
      const row = buildGanttRows.find(r => r.id === rowId);
      if (row && row.itemType !== "project") {
        deleteRow(row);
      }
    });
    setSelectedRows(new Set());
  }, [selectedRows, buildGanttRows, deleteRow]);

  // Bar dragging handlers
  const handleBarDragStart = useCallback((e: React.MouseEvent, rowId: string, type: "move" | "resize-start" | "resize-end") => {
    e.preventDefault();
    e.stopPropagation();
    const row = buildGanttRows.find(r => r.id === rowId);
    if (!row) return;
    
    setIsDraggingBar(true);
    setDraggingRowId(rowId);
    setDragType(type);
    setDragStartX(e.clientX);
    setOriginalBarData({ startDate: row.startDate, endDate: row.endDate });
  }, [buildGanttRows]);

  const handleBarDragMove = useCallback((e: MouseEvent) => {
    if (!isDraggingBar || !draggingRowId || !originalBarData) return;
    
    const row = buildGanttRows.find(r => r.id === draggingRowId);
    if (!row) return;
    
    const dayWidth = viewMode === "day" ? 40 : viewMode === "week" ? 30 : viewMode === "month" ? 15 : 4;
    const deltaX = e.clientX - dragStartX;
    const daysDelta = Math.round(deltaX / dayWidth);
    
    if (daysDelta === 0) return;
    
    const originalStart = parseDate(originalBarData.startDate);
    const originalEnd = parseDate(originalBarData.endDate);
    
    let newStartDate: Date;
    let newEndDate: Date;
    
    if (dragType === "move") {
      newStartDate = addDays(originalStart, daysDelta);
      newEndDate = addDays(originalEnd, daysDelta);
    } else if (dragType === "resize-start") {
      newStartDate = addDays(originalStart, daysDelta);
      newEndDate = originalEnd;
      if (newStartDate >= newEndDate) return;
    } else {
      newStartDate = originalStart;
      newEndDate = addDays(originalEnd, daysDelta);
      if (newEndDate <= newStartDate) return;
    }
    
    // Visual feedback - update is applied on mouse up
    const timelineEl = timelineRef.current;
    if (timelineEl) {
      const barEl = timelineEl.querySelector(`[data-bar-id="${draggingRowId}"]`) as HTMLElement;
      if (barEl) {
        const startOffset = Math.floor((newStartDate.getTime() - timelineData.startDate.getTime()) / (1000 * 60 * 60 * 24));
        const duration = calculateDuration(newStartDate, newEndDate);
        barEl.style.left = `${startOffset * dayWidth}px`;
        barEl.style.width = `${Math.max(duration * dayWidth - 4, 20)}px`;
      }
    }
  }, [isDraggingBar, draggingRowId, originalBarData, dragStartX, dragType, viewMode, buildGanttRows, timelineData]);

  const handleBarDragEnd = useCallback(() => {
    if (!isDraggingBar || !draggingRowId || !originalBarData) {
      setIsDraggingBar(false);
      setDraggingRowId(null);
      setDragType(null);
      return;
    }
    
    const row = buildGanttRows.find(r => r.id === draggingRowId);
    if (!row) {
      setIsDraggingBar(false);
      setDraggingRowId(null);
      setDragType(null);
      return;
    }
    
    // Calculate final dates based on bar position
    const dayWidth = viewMode === "day" ? 40 : viewMode === "week" ? 30 : viewMode === "month" ? 15 : 4;
    const timelineEl = timelineRef.current;
    if (timelineEl) {
      const barEl = timelineEl.querySelector(`[data-bar-id="${draggingRowId}"]`) as HTMLElement;
      if (barEl) {
        const left = parseInt(barEl.style.left) || 0;
        const width = parseInt(barEl.style.width) || 0;
        
        const startDays = Math.round(left / dayWidth);
        const duration = Math.round((width + 4) / dayWidth);
        
        const newStartDate = addDays(timelineData.startDate, startDays);
        const newEndDate = addDays(newStartDate, duration - 1);
        
        const formattedStart = formatDate(newStartDate);
        const formattedEnd = formatDate(newEndDate);
        
        if (formattedStart !== originalBarData.startDate || formattedEnd !== originalBarData.endDate) {
          const { itemType, originalId } = row;
          
          if (itemType === "phase" || itemType === "release") {
            updatePhaseMutation.mutate({ 
              id: originalId, 
              data: { plannedStartDate: formattedStart, plannedEndDate: formattedEnd } 
            });
          } else if (itemType === "workstream" || itemType === "activity") {
            updateWorkstreamMutation.mutate({ 
              id: originalId, 
              data: { plannedStartDate: formattedStart, plannedEndDate: formattedEnd } 
            });
          } else if (itemType === "task") {
            updateTaskMutation.mutate({ 
              id: originalId, 
              data: { plannedStartDate: formattedStart, plannedEndDate: formattedEnd } 
            });
          } else if (itemType === "milestone") {
            updateMilestoneMutation.mutate({ 
              id: originalId, 
              data: { dueDate: formattedStart } 
            });
          }
          
          toast({ title: "Dates updated", description: `${row.name}: ${formattedStart} - ${formattedEnd}` });
        }
      }
    }
    
    setIsDraggingBar(false);
    setDraggingRowId(null);
    setDragType(null);
    setOriginalBarData(null);
  }, [isDraggingBar, draggingRowId, originalBarData, viewMode, buildGanttRows, timelineData, updatePhaseMutation, updateWorkstreamMutation, updateTaskMutation, updateMilestoneMutation, toast]);

  // Dependency creation handlers
  const handleDependencyStart = useCallback((e: React.MouseEvent, rowId: string, point: "start" | "end") => {
    e.preventDefault();
    e.stopPropagation();
    setIsCreatingDependency(true);
    setDependencyStartRow(rowId);
    setDependencyStartPoint(point);
    const rect = timelineRef.current?.getBoundingClientRect();
    if (rect) {
      setDependencyMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }, []);

  const handleDependencyMove = useCallback((e: MouseEvent) => {
    if (!isCreatingDependency) return;
    const rect = timelineRef.current?.getBoundingClientRect();
    if (rect) {
      setDependencyMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  }, [isCreatingDependency]);

  const handleDependencyEnd = useCallback((rowId: string, point: "start" | "end") => {
    if (!isCreatingDependency || !dependencyStartRow) {
      setIsCreatingDependency(false);
      setDependencyStartRow(null);
      setDependencyStartPoint(null);
      return;
    }
    
    if (rowId === dependencyStartRow) {
      setIsCreatingDependency(false);
      setDependencyStartRow(null);
      setDependencyStartPoint(null);
      return;
    }
    
    setPendingDependency({
      from: dependencyStartRow,
      to: rowId,
      fromPoint: dependencyStartPoint!,
      toPoint: point
    });
    setDependencyDialogOpen(true);
    
    setIsCreatingDependency(false);
    setDependencyStartRow(null);
    setDependencyStartPoint(null);
  }, [isCreatingDependency, dependencyStartRow, dependencyStartPoint]);

  const handleDependencyCancel = useCallback(() => {
    setIsCreatingDependency(false);
    setDependencyStartRow(null);
    setDependencyStartPoint(null);
  }, []);

  const saveDependency = useCallback((type: DependencyType) => {
    if (!pendingDependency) return;
    
    const fromRow = buildGanttRows.find(r => r.id === pendingDependency.from);
    const toRow = buildGanttRows.find(r => r.id === pendingDependency.to);
    
    if (!fromRow || !toRow) {
      setDependencyDialogOpen(false);
      setPendingDependency(null);
      return;
    }
    
    // For now, we only support task dependencies
    if (toRow.itemType === "task") {
      const existingPreds = toRow.predecessors ? toRow.predecessors.split(",").map(p => p.trim()).filter(Boolean) : [];
      const newPred = `${fromRow.originalId}${type}`;
      if (!existingPreds.includes(newPred)) {
        existingPreds.push(newPred);
        const predecessorIds = existingPreds.map(p => parseInt(p.replace(/[A-Z]+$/, ""))).filter(id => !isNaN(id));
        updateTaskMutation.mutate({
          id: toRow.originalId,
          data: { predecessorIds }
        });
        toast({ title: "Dependency created", description: `${type}: ${fromRow.name} → ${toRow.name}` });
      }
    }
    
    setDependencyDialogOpen(false);
    setPendingDependency(null);
  }, [pendingDependency, buildGanttRows, updateTaskMutation, toast]);

  // Add event listeners for bar dragging and dependency creation
  useEffect(() => {
    if (isDraggingBar) {
      document.addEventListener("mousemove", handleBarDragMove);
      document.addEventListener("mouseup", handleBarDragEnd);
      return () => {
        document.removeEventListener("mousemove", handleBarDragMove);
        document.removeEventListener("mouseup", handleBarDragEnd);
      };
    }
  }, [isDraggingBar, handleBarDragMove, handleBarDragEnd]);

  useEffect(() => {
    if (isCreatingDependency) {
      document.addEventListener("mousemove", handleDependencyMove);
      document.addEventListener("mouseup", handleDependencyCancel);
      return () => {
        document.removeEventListener("mousemove", handleDependencyMove);
        document.removeEventListener("mouseup", handleDependencyCancel);
      };
    }
  }, [isCreatingDependency, handleDependencyMove, handleDependencyCancel]);

  // Scroll sync between AG Grid and timeline
  useEffect(() => {
    const gridApi = gridRef.current?.api;
    if (!gridApi || !timelineBodyRef.current) return;

    const handleGridScroll = () => {
      if (isScrollSyncing.current || !timelineBodyRef.current) return;
      isScrollSyncing.current = true;
      
      const gridBody = document.querySelector('.ag-body-viewport');
      if (gridBody && timelineBodyRef.current) {
        timelineBodyRef.current.scrollTop = gridBody.scrollTop;
      }
      
      requestAnimationFrame(() => {
        isScrollSyncing.current = false;
      });
    };

    const handleTimelineScroll = () => {
      if (isScrollSyncing.current) return;
      isScrollSyncing.current = true;
      
      const gridBody = document.querySelector('.ag-body-viewport');
      if (gridBody && timelineBodyRef.current) {
        gridBody.scrollTop = timelineBodyRef.current.scrollTop;
      }
      if (timelineHeaderRef.current && timelineBodyRef.current) {
        timelineHeaderRef.current.scrollLeft = timelineBodyRef.current.scrollLeft;
      }
      
      requestAnimationFrame(() => {
        isScrollSyncing.current = false;
      });
    };

    const gridBody = document.querySelector('.ag-body-viewport');
    if (gridBody) {
      gridBody.addEventListener('scroll', handleGridScroll);
    }
    
    const timelineBody = timelineBodyRef.current;
    if (timelineBody) {
      timelineBody.addEventListener('scroll', handleTimelineScroll);
    }

    return () => {
      if (gridBody) {
        gridBody.removeEventListener('scroll', handleGridScroll);
      }
      if (timelineBody) {
        timelineBody.removeEventListener('scroll', handleTimelineScroll);
      }
    };
  }, [buildGanttRows]);

  const addNewRow = useCallback((afterRowId: string, type: ItemType) => {
    const today = formatDate(new Date());
    const endDate = formatDate(addDays(new Date(), 7));

    const targetRow = buildGanttRows.find(r => r.id === afterRowId);
    const insertIndex = targetRow ? buildGanttRows.findIndex(r => r.id === afterRowId) : -1;

    if (type === "phase" || type === "release") {
      createPhaseMutation.mutate({
        name: type === "release" ? "New Release" : "New Phase",
        phaseNumber: phases.length + 1,
        plannedStartDate: today,
        plannedEndDate: endDate,
        order: insertIndex >= 0 ? insertIndex : phases.length,
      });
    } else if (type === "workstream") {
      const phaseId = targetRow?.itemType === "phase" ? targetRow.originalId : 
                      targetRow?.parentId?.startsWith("phase-") ? parseInt(targetRow.parentId.split("-")[1]) :
                      phases[0]?.id;
      if (phaseId) {
        createWorkstreamMutation.mutate({
          name: "New Workstream",
          phaseId,
          type: "workstream",
          plannedStartDate: today,
          plannedEndDate: endDate,
        });
      }
    } else if (type === "activity") {
      const phaseId = phases[0]?.id;
      if (phaseId) {
        createWorkstreamMutation.mutate({
          name: "New Activity",
          phaseId,
          type: "activity",
          plannedStartDate: today,
          plannedEndDate: endDate,
        });
      }
    } else if (type === "task") {
      const phaseId = targetRow?.itemType === "phase" ? targetRow.originalId :
                      targetRow?.parentId?.startsWith("phase-") ? parseInt(targetRow.parentId.split("-")[1]) :
                      (targetRow?.originalData as PmTask)?.phaseId || phases[0]?.id;
      createTaskMutation.mutate({
        name: "New Task",
        phaseId,
        plannedStartDate: today,
        plannedEndDate: endDate,
      });
    } else if (type === "milestone") {
      const phaseId = targetRow?.itemType === "phase" ? targetRow.originalId : 
                      targetRow?.parentId?.startsWith("phase-") ? parseInt(targetRow.parentId.split("-")[1]) :
                      phases[0]?.id;
      createMilestoneMutation.mutate({
        name: "New Milestone",
        phaseId,
        dueDate: endDate,
      });
    }
  }, [phases, buildGanttRows, createPhaseMutation, createWorkstreamMutation, createTaskMutation, createMilestoneMutation]);

  const toggleRowSelection = useCallback((rowId: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  const toggleColumnVisibility = useCallback((field: string) => {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  }, []);

  const handleSaveVersion = useCallback(() => {
    toast({ 
      title: "Version Saved", 
      description: `Project plan saved as v${new Date().toISOString().split("T")[0]}` 
    });
  }, [toast]);

  const handleCopyPlan = useCallback(() => {
    toast({ 
      title: "Plan Copied", 
      description: "Project plan copied to clipboard" 
    });
  }, [toast]);

  const handleLoadSampleData = useCallback(async () => {
    if (!project) return;
    try {
      const response = await apiRequest("POST", `/api/pm/projects/${project.id}/seed-s4hana`);
      await queryClient.invalidateQueries({ queryKey: ["/api/pm/projects"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "phases"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "workstreams"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "tasks"] });
      toast({
        title: "Sample Data Loaded",
        description: "S/4HANA Implementation project data has been loaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load sample data",
        variant: "destructive",
      });
    }
  }, [project, projectId, toast]);

  const baseColumnDefs: ColDef<GanttRow>[] = useMemo(() => [
    {
      headerName: "",
      field: "isExpanded",
      width: 40,
      cellRenderer: (params: { data: GanttRow }) => {
        if (!params.data?.hasChildren) return null;
        return (
          <button
            onClick={() => toggleExpand(params.data.id)}
            className="p-1 hover-elevate rounded"
            data-testid={`button-expand-${params.data.id}`}
          >
            {params.data.isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        );
      },
      sortable: false,
      filter: false,
    },
    {
      headerName: "",
      field: "addRow",
      width: 32,
      cellRenderer: (params: { data: GanttRow }) => {
        if (!params.data) return null;
        return (
          <button
            onClick={() => addNewRow(params.data.id, params.data.itemType === "project" ? "phase" : 
              params.data.itemType === "phase" ? "task" : "task")}
            className="p-0.5 hover-elevate rounded opacity-30 hover:opacity-100 transition-opacity"
            title="Add row below"
            data-testid={`button-inline-add-${params.data.id}`}
          >
            <Plus className="h-3 w-3" />
          </button>
        );
      },
      sortable: false,
      filter: false,
      suppressNavigable: true,
    },
    {
      headerName: "WBS",
      field: "wbsId",
      width: 80,
      editable: false,
    },
    {
      headerName: "Type",
      field: "itemType",
      width: 100,
      editable: true,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: TYPE_OPTIONS },
      cellRenderer: (params: { value: ItemType }) => {
        const color = TYPE_COLORS[params.value];
        return (
          <span 
            className="px-2 py-0.5 rounded text-xs font-medium text-white"
            style={{ backgroundColor: color?.bar }}
          >
            {color?.text || params.value}
          </span>
        );
      },
    },
    {
      headerName: "Name",
      field: "name",
      width: 250,
      minWidth: 100,
      maxWidth: 500,
      editable: true,
      rowDrag: true,
      resizable: true,
      cellStyle: (params) => ({
        paddingLeft: `${(params.data?.level || 0) * 16 + 8}px`,
        fontWeight: params.data?.level === 0 ? 600 : 400,
      }),
    },
    {
      headerName: "Duration",
      field: "duration",
      width: 80,
      editable: false,
      valueFormatter: (params) => `${params.value}d`,
    },
    {
      headerName: "Start",
      field: "startDate",
      width: 110,
      editable: true,
    },
    {
      headerName: "Finish",
      field: "endDate",
      width: 110,
      editable: true,
    },
    {
      headerName: "Progress",
      field: "progress",
      width: 90,
      editable: true,
      cellRenderer: (params: { value: number }) => (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
            <div 
              className="h-full bg-primary transition-all"
              style={{ width: `${params.value}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-8">{params.value}%</span>
        </div>
      ),
    },
    {
      headerName: "Status",
      field: "status",
      width: 110,
      editable: true,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: STATUS_OPTIONS },
    },
    {
      headerName: "Priority",
      field: "priority",
      width: 90,
      editable: true,
      cellEditor: "agSelectCellEditor",
      cellEditorParams: { values: PRIORITY_OPTIONS },
    },
    {
      headerName: "Resource",
      field: "resource",
      width: 120,
      editable: true,
    },
    {
      headerName: "Predecessors",
      field: "predecessors",
      width: 100,
      editable: true,
    },
    {
      headerName: "Successors",
      field: "successors",
      width: 100,
      editable: true,
    },
  ], [toggleExpand, TYPE_COLORS]) as ColDef<GanttRow>[];

  const columnDefs = useMemo(() => 
    baseColumnDefs.filter(col => !hiddenColumns.has(col.field || "")),
    [baseColumnDefs, hiddenColumns]
  );

  const calculateBarPosition = useCallback((row: GanttRow) => {
    const { columns, startDate } = timelineData;
    if (columns.length === 0) return { left: 0, width: 0 };

    const rowStart = parseDate(row.startDate);
    const rowEnd = parseDate(row.endDate);
    const dayWidth = viewMode === "day" ? 40 : viewMode === "week" ? 30 : viewMode === "month" ? 15 : 4;

    const startOffset = Math.floor((rowStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const duration = row.isMilestone ? 1 : calculateDuration(rowStart, rowEnd);

    return {
      left: startOffset * dayWidth,
      width: Math.max(duration * dayWidth - 4, row.isMilestone ? 16 : 20),
    };
  }, [timelineData, viewMode]);

  const handleRowDragEnd = useCallback((event: RowDragEvent<GanttRow>) => {
    const movedRow = event.node.data;
    const overRow = event.overNode?.data;
    if (!movedRow || !overRow) return;
    toast({ title: "Row moved", description: `${movedRow.name} moved` });
  }, [toast]);

  const isLoading = phasesLoading || workstreamsLoading || tasksLoading;

  if (isLoading) {
    return (
      <div className="h-full">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Project Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[500px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const dayWidth = viewMode === "day" ? 40 : viewMode === "week" ? 30 : viewMode === "month" ? 15 : 4;
  const totalTimelineWidth = timelineData.columns.length * dayWidth;

  const groupedColumns = timelineData.columns.reduce((acc, col) => {
    if (!acc[col.month]) acc[col.month] = { cols: [], monthIndex: col.monthIndex };
    acc[col.month].cols.push(col);
    return acc;
  }, {} as Record<string, { cols: typeof timelineData.columns; monthIndex: number }>);

  return (
    <div className="h-full flex flex-col">
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="pb-3 flex-shrink-0 border-b">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <span className="text-lg font-semibold">{project?.name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="text-xs">
                  <GitBranch className="h-3 w-3 mr-1" />
                  {project?.methodology || "Hybrid"}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  v1.0
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <User className="h-3 w-3 mr-1" />
                  Owner
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                <SelectTrigger className="w-[100px]" data-testid="select-view-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="year">Year</SelectItem>
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" data-testid="button-add-item-menu">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => addNewRow("", "release")}>
                    <Plus className="h-4 w-4 mr-2" /> Release
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addNewRow("", "phase")}>
                    <Plus className="h-4 w-4 mr-2" /> Phase
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addNewRow("", "workstream")}>
                    <Plus className="h-4 w-4 mr-2" /> Workstream
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addNewRow("", "activity")}>
                    <Plus className="h-4 w-4 mr-2" /> Activity
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => addNewRow("", "task")}>
                    <Plus className="h-4 w-4 mr-2" /> Task
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => addNewRow("", "milestone")}>
                    <Milestone className="h-4 w-4 mr-2" /> Milestone
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {selectedRows.size > 0 && (
                <Button 
                  size="sm" 
                  variant="destructive" 
                  onClick={deleteSelectedRows}
                  data-testid="button-delete-selected"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete ({selectedRows.size})
                </Button>
              )}

              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setProjectDialogOpen(true)}
                data-testid="button-edit-project"
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit Project
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" data-testid="button-color-scheme">
                    <Palette className="h-4 w-4 mr-1" />
                    Colors
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                  <DropdownMenuItem onClick={() => setColorScheme("default")}>
                    <div className="w-4 h-4 rounded-full bg-primary mr-2" /> Default
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setColorScheme("ocean")}>
                    <div className="w-4 h-4 rounded-full bg-sky-500 mr-2" /> Ocean
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setColorScheme("sunset")}>
                    <div className="w-4 h-4 rounded-full bg-rose-500 mr-2" /> Sunset
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setColorScheme("forest")}>
                    <div className="w-4 h-4 rounded-full bg-brand-green mr-2" /> Forest
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setColorScheme("monochrome")}>
                    <div className="w-4 h-4 rounded-full bg-gray-500 mr-2" /> Monochrome
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setColorScheme("softModern")}>
                    <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: "#66b2ff" }} /> Soft Modern
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setColorScheme("vibrantContrast")}>
                    <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: "#0099ff" }} /> Vibrant Contrast
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setColorScheme("muted")}>
                    <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: "#4682b4" }} /> Muted Professional
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setColorScheme("pastel")}>
                    <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: "#99ccff" }} /> Pastel Fresh
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setColorScheme("boldModern")}>
                    <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: "#00ccff" }} /> Bold Modern
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" data-testid="button-more-options">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleSaveVersion}>
                    <Save className="h-4 w-4 mr-2" /> Save Version
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyPlan}>
                    <Copy className="h-4 w-4 mr-2" /> Copy Plan
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => toggleColumnVisibility("resource")}>
                    {hiddenColumns.has("resource") ? "Show" : "Hide"} Resource Column
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleColumnVisibility("predecessors")}>
                    {hiddenColumns.has("predecessors") ? "Show" : "Hide"} Predecessors Column
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toggleColumnVisibility("successors")}>
                    {hiddenColumns.has("successors") ? "Show" : "Hide"} Successors Column
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLoadSampleData} data-testid="button-load-sample-data">
                    Load S/4HANA Sample Data
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <div className="flex items-center gap-1 border-t pt-2 border-border/50">
              <Button 
                size="sm" 
                variant={filterTab === "all" ? "default" : "ghost"} 
                onClick={() => setFilterTab("all")}
                data-testid="tab-gantt-all"
              >
                Gantt Chart
              </Button>
              <Button 
                size="sm" 
                variant={filterTab === "releases" ? "default" : "ghost"} 
                onClick={() => setFilterTab("releases")}
                data-testid="tab-releases"
              >
                Releases
              </Button>
              <Button 
                size="sm" 
                variant={filterTab === "phases" ? "default" : "ghost"} 
                onClick={() => setFilterTab("phases")}
                data-testid="tab-phases"
              >
                Phases
              </Button>
              <Button 
                size="sm" 
                variant={filterTab === "workstreams" ? "default" : "ghost"} 
                onClick={() => setFilterTab("workstreams")}
                data-testid="tab-workstreams"
              >
                Workstreams
              </Button>
              <Button 
                size="sm" 
                variant={filterTab === "activities" ? "default" : "ghost"} 
                onClick={() => setFilterTab("activities")}
                data-testid="tab-activities"
              >
                Activities
              </Button>
              <Button 
                size="sm" 
                variant={filterTab === "tasks" ? "default" : "ghost"} 
                onClick={() => setFilterTab("tasks")}
                data-testid="tab-tasks"
              >
                Tasks
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          <div className="flex h-full border-t border-border" ref={containerRef}>
            <div 
              className="flex-shrink-0 border-r border-border overflow-hidden"
              style={{ width: gridWidth }}
            >
              <div className="h-full ag-theme-quartz" style={{ height: "100%" }}>
                <AgGridReact
                  ref={gridRef}
                  rowData={filteredGanttRows}
                  columnDefs={columnDefs}
                  defaultColDef={{
                    resizable: true,
                    sortable: true,
                  }}
                  singleClickEdit
                  getRowId={(params) => params.data.id}
                  rowHeight={36}
                  headerHeight={40}
                  rowDragManaged
                  rowDragMultiRow
                  onCellValueChanged={handleCellValueChanged}
                  onRowDragEnd={handleRowDragEnd}
                  rowSelection={{
                    mode: "multiRow",
                    enableClickSelection: false,
                    checkboxes: true,
                    headerCheckbox: true,
                  }}
                  animateRows
                  onSelectionChanged={(event) => {
                    const selected = event.api.getSelectedRows();
                    setSelectedRows(new Set(selected.map(r => r.id)));
                  }}
                />
              </div>
            </div>

            <div
              className={`w-2 flex-shrink-0 cursor-col-resize hover:bg-primary/20 active:bg-primary/40 transition-colors ${isResizing ? 'bg-primary/40' : 'bg-gray-200 dark:bg-gray-700'}`}
              onMouseDown={handleMouseDown}
              title="Drag to resize"
            />

            <div className="flex-1 flex flex-col overflow-hidden" ref={timelineRef}>
              <div ref={timelineHeaderRef} className="flex-shrink-0 overflow-x-hidden overflow-y-hidden" style={{ width: "100%" }}>
                <div style={{ width: totalTimelineWidth }}>
                  <div className="bg-background border-b border-border">
                    <div className="flex h-[20px] border-b border-border">
                      {Object.entries(groupedColumns).map(([month, { cols, monthIndex }]) => (
                        <div
                          key={month}
                          className={`text-xs font-medium text-center border-r border-border flex items-center justify-center ${MONTH_PASTEL_COLORS[monthIndex % MONTH_PASTEL_COLORS.length]}`}
                          style={{ width: cols.length * dayWidth }}
                        >
                          {month}
                        </div>
                      ))}
                    </div>
                    <div className="flex h-[20px]">
                      {timelineData.columns.map((col, idx) => (
                        <div
                          key={idx}
                          className={`text-xs text-center border-r border-border flex items-center justify-center ${
                            col.isWeekend ? "bg-gray-100 dark:bg-gray-800" : MONTH_PASTEL_COLORS[col.monthIndex % MONTH_PASTEL_COLORS.length]
                          }`}
                          style={{ width: dayWidth }}
                        >
                          {viewMode !== "year" && col.date.getDate()}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div 
                className="flex-1 overflow-x-auto overflow-y-auto" 
                ref={timelineBodyRef}
                style={{ width: "100%" }}
              >
                <div style={{ width: totalTimelineWidth, minHeight: filteredGanttRows.length * 36 }}>
                  <div className="relative">
                  <svg
                    className="absolute top-0 left-0 pointer-events-none z-10"
                    style={{ width: totalTimelineWidth, height: filteredGanttRows.length * 36 }}
                  >
                    <defs>
                      <marker
                        id="arrowhead"
                        markerWidth="8"
                        markerHeight="8"
                        refX="8"
                        refY="4"
                        orient="auto"
                      >
                        <polygon points="0 0, 8 4, 0 8" fill="#6366f1" />
                      </marker>
                    </defs>
                    {filteredGanttRows.map((row, rowIdx) => {
                      if (!row.predecessors) return null;
                      const successorPos = calculateBarPosition(row);
                      const successorY = rowIdx * 36 + 18;
                      
                      const predecessorIds = row.predecessors.split(",").map(p => p.trim()).filter(Boolean);
                      
                      return predecessorIds.map((predId, predIdx) => {
                        const cleanPredId = predId.replace(/^T-/, "");
                        const predRow = filteredGanttRows.find(r => 
                          r.itemType === "task" && String(r.originalId) === cleanPredId
                        );
                        if (!predRow) return null;
                        
                        const predRowIdx = filteredGanttRows.findIndex(r => r.id === predRow.id);
                        const predPos = calculateBarPosition(predRow);
                        const predY = predRowIdx * 36 + 18;
                        
                        const startX = predPos.left + predPos.width;
                        const endX = successorPos.left;
                        const elbowOffset = 12;
                        const rowHeight = 36;
                        
                        if (predRowIdx === rowIdx) {
                          return (
                            <path
                              key={`${row.id}-${predId}-${predIdx}`}
                              d={`M ${startX} ${predY} L ${endX - 8} ${successorY}`}
                              fill="none"
                              stroke="#6366f1"
                              strokeWidth="2"
                              markerEnd="url(#arrowhead)"
                            />
                          );
                        }
                        
                        const goingDown = successorY > predY;
                        
                        if (endX > startX + elbowOffset) {
                          return (
                            <path
                              key={`${row.id}-${predId}-${predIdx}`}
                              d={`M ${startX} ${predY} 
                                  L ${startX + elbowOffset} ${predY} 
                                  L ${startX + elbowOffset} ${successorY} 
                                  L ${endX - 8} ${successorY}`}
                              fill="none"
                              stroke="#6366f1"
                              strokeWidth="2"
                              markerEnd="url(#arrowhead)"
                            />
                          );
                        } else {
                          const verticalY = goingDown 
                            ? predY + rowHeight / 2 + 4
                            : predY - rowHeight / 2 - 4;
                          return (
                            <path
                              key={`${row.id}-${predId}-${predIdx}`}
                              d={`M ${startX} ${predY} 
                                  L ${startX + elbowOffset} ${predY} 
                                  L ${startX + elbowOffset} ${verticalY}
                                  L ${endX - elbowOffset - 8} ${verticalY}
                                  L ${endX - elbowOffset - 8} ${successorY} 
                                  L ${endX - 8} ${successorY}`}
                              fill="none"
                              stroke="#6366f1"
                              strokeWidth="2"
                              markerEnd="url(#arrowhead)"
                            />
                          );
                        }
                      });
                    })}
                    {isCreatingDependency && dependencyStartRow && (() => {
                      const startRow = filteredGanttRows.find(r => r.id === dependencyStartRow);
                      if (!startRow) return null;
                      const startRowIdx = filteredGanttRows.findIndex(r => r.id === dependencyStartRow);
                      const startPos = calculateBarPosition(startRow);
                      const startX = dependencyStartPoint === "start" ? startPos.left : startPos.left + startPos.width;
                      const startY = startRowIdx * 36 + 18;
                      const scrollTop = timelineBodyRef.current?.scrollTop || 0;
                      const endY = dependencyMousePos.y - 40 + scrollTop;
                      const scrollLeft = timelineBodyRef.current?.scrollLeft || 0;
                      const endX = dependencyMousePos.x + scrollLeft;
                      return (
                        <line
                          x1={startX}
                          y1={startY}
                          x2={endX}
                          y2={endY}
                          stroke="#6366f1"
                          strokeWidth="2"
                          strokeDasharray="5,5"
                        />
                      );
                    })()}
                  </svg>
                  {filteredGanttRows.map((row, rowIdx) => {
                    const pos = calculateBarPosition(row);
                    const color = TYPE_COLORS[row.itemType];

                    return (
                      <div
                        key={row.id}
                        className="relative h-[36px] border-b border-border/50 group"
                        onMouseEnter={() => setHoveredRowId(row.id)}
                        onMouseLeave={() => setHoveredRowId(null)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          if (row.itemType !== "project") {
                            if (confirm(`Delete ${row.name}?`)) {
                              deleteRow(row);
                            }
                          }
                        }}
                      >
                        {timelineData.columns.map((col, colIdx) => (
                          <div
                            key={colIdx}
                            className={`absolute top-0 bottom-0 border-r border-border/50/50 ${
                              col.isWeekend ? "bg-gray-100/50 dark:bg-gray-800/30" : ""
                            }`}
                            style={{ left: colIdx * dayWidth, width: dayWidth }}
                          />
                        ))}

                        {row.isMilestone ? (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rotate-45"
                            style={{
                              left: pos.left + 2,
                              backgroundColor: color.bar,
                            }}
                            title={`${row.name} - ${row.startDate}`}
                          />
                        ) : (
                          <div
                            data-bar-id={row.id}
                            className="absolute top-[6px] h-[24px] rounded cursor-move transition-all hover:brightness-110 group/bar"
                            style={{
                              left: pos.left,
                              width: pos.width,
                              backgroundColor: color.bar,
                            }}
                            title={`${row.name} (${row.startDate} - ${row.endDate})`}
                            onMouseDown={(e) => {
                              if (row.itemType === "project") return;
                              handleBarDragStart(e, row.id, "move");
                            }}
                          >
                            <div
                              className="absolute top-0 left-0 h-full rounded-l transition-all pointer-events-none"
                              style={{
                                width: `${row.progress}%`,
                                backgroundColor: color.progress,
                              }}
                            />
                            {pos.width > 60 && (
                              <span className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium truncate px-1 pointer-events-none">
                                {row.name}
                              </span>
                            )}
                            
                            {row.itemType !== "project" && (
                              <>
                                <div
                                  className="absolute -left-1 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-primary opacity-0 group-hover/bar:opacity-100 cursor-ew-resize z-20 transition-opacity"
                                  title="Drag to change start date"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    handleBarDragStart(e, row.id, "resize-start");
                                  }}
                                />
                                <div
                                  className="absolute -right-1 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-primary opacity-0 group-hover/bar:opacity-100 cursor-ew-resize z-20 transition-opacity"
                                  title="Drag to change end date"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    handleBarDragStart(e, row.id, "resize-end");
                                  }}
                                />
                                
                                <div
                                  className="absolute -left-5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary border-2 border-white shadow-md opacity-0 group-hover/bar:opacity-100 hover:scale-125 cursor-crosshair z-30 transition-all"
                                  title="Drag to create dependency (start point)"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    handleDependencyStart(e, row.id, "start");
                                  }}
                                  onMouseUp={() => {
                                    if (isCreatingDependency && dependencyStartRow !== row.id) {
                                      handleDependencyEnd(row.id, "start");
                                    }
                                  }}
                                />
                                <div
                                  className="absolute -right-5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary border-2 border-white shadow-md opacity-0 group-hover/bar:opacity-100 hover:scale-125 cursor-crosshair z-30 transition-all"
                                  title="Drag to create dependency (end point)"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    handleDependencyStart(e, row.id, "end");
                                  }}
                                  onMouseUp={() => {
                                    if (isCreatingDependency && dependencyStartRow !== row.id) {
                                      handleDependencyEnd(row.id, "end");
                                    }
                                  }}
                                />
                              </>
                            )}
                          </div>
                        )}

                        {hoveredRowId === row.id && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <div
                                className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 z-20 transition-opacity cursor-pointer"
                                title="Add item"
                                data-testid={`button-add-row-${row.id}`}
                              >
                                <Plus className="h-3 w-3" />
                              </div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => addNewRow(row.id, "phase")}>
                                Add Phase Below
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => addNewRow(row.id, "workstream")}>
                                Add Workstream Below
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => addNewRow(row.id, "task")}>
                                Add Task Below
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => addNewRow(row.id, "milestone")}>
                                Add Milestone Below
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    );
                  })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const updateData: Partial<PmProject> = {
              name: formData.get("name") as string,
              description: formData.get("description") as string,
              methodology: formData.get("methodology") as string,
              status: formData.get("status") as string,
              priority: formData.get("priority") as string,
            };
            updateProjectMutation.mutate({ id: projectId, data: updateData }, {
              onSuccess: () => {
                setProjectDialogOpen(false);
                toast({ title: "Project updated" });
              }
            });
          }}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name</Label>
                <Input id="name" name="name" defaultValue={project?.name || ""} required data-testid="input-project-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" defaultValue={project?.description || ""} rows={3} data-testid="input-project-description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="methodology">Methodology</Label>
                  <Select name="methodology" defaultValue={project?.methodology || "hybrid"}>
                    <SelectTrigger data-testid="select-project-methodology">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="waterfall">Waterfall</SelectItem>
                      <SelectItem value="agile">Agile</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select name="status" defaultValue={project?.status || "draft"}>
                    <SelectTrigger data-testid="select-project-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select name="priority" defaultValue={project?.priority || "medium"}>
                  <SelectTrigger data-testid="select-project-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProjectDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" data-testid="button-save-project">
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dependencyDialogOpen} onOpenChange={setDependencyDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Select Dependency Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => saveDependency("FS")}
              data-testid="button-dep-fs"
            >
              <div className="flex flex-col items-start">
                <span className="font-medium">Finish-to-Start (FS)</span>
                <span className="text-xs text-muted-foreground">Successor starts when predecessor finishes</span>
              </div>
            </Button>
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => saveDependency("SS")}
              data-testid="button-dep-ss"
            >
              <div className="flex flex-col items-start">
                <span className="font-medium">Start-to-Start (SS)</span>
                <span className="text-xs text-muted-foreground">Both tasks start together</span>
              </div>
            </Button>
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => saveDependency("FF")}
              data-testid="button-dep-ff"
            >
              <div className="flex flex-col items-start">
                <span className="font-medium">Finish-to-Finish (FF)</span>
                <span className="text-xs text-muted-foreground">Both tasks finish together</span>
              </div>
            </Button>
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={() => saveDependency("SF")}
              data-testid="button-dep-sf"
            >
              <div className="flex flex-col items-start">
                <span className="font-medium">Start-to-Finish (SF)</span>
                <span className="text-xs text-muted-foreground">Successor finishes when predecessor starts</span>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDependencyDialogOpen(false);
              setPendingDependency(null);
            }}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
