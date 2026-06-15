import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Gantt, ContextMenu, Willow } from "@svar-ui/react-gantt";
import type { IApi, ITask, ILink } from "@svar-ui/react-gantt";
import "@svar-ui/react-gantt/all.css";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Pencil, Maximize2, Minimize2, Plus, Trash2,
  ChevronUp, ChevronDown, Undo2, Redo2,
  IndentIncrease, IndentDecrease, ChevronsDown, ChevronsUp,
  Columns2, CalendarDays,
} from "lucide-react";
import type {
  PmProject,
  PmProjectPhase,
  PmTask,
  PmWorkstream,
  PmMilestone,
} from "@shared/models/projects";

// Non-overlapping numeric ID offsets per entity type
const PHASE_OFFSET = 100000;
const WS_OFFSET    = 200000;
const MS_OFFSET    = 300000;

const toDate = (s: string | Date | null | undefined): Date => {
  if (!s) return new Date();
  const d = new Date(s as string);
  return isNaN(d.getTime()) ? new Date() : d;
};

const toDateStr = (d: Date): string => d.toISOString().split("T")[0];

// ─────────────────────────────────────────────────────────────────────────────
// Zoom level definitions
// ─────────────────────────────────────────────────────────────────────────────

const ZOOM_LABELS = ["Year", "Month", "Week", "Day"] as const;
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS_SHORT   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function getWeekNumber(d: Date) {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
}

const ZOOM_LEVELS = [
  {
    minCellWidth: 40, maxCellWidth: 120,
    scales: [
      { unit: "year",  step: 1, format: (d: Date) => String(d.getFullYear()) },
      { unit: "month", step: 1, format: (d: Date) => MONTHS_SHORT[d.getMonth()] },
    ],
  },
  {
    minCellWidth: 28, maxCellWidth: 90,
    scales: [
      { unit: "month", step: 1, format: (d: Date) => `${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}` },
      { unit: "day",   step: 1, format: (d: Date) => String(d.getDate()) },
    ],
  },
  {
    minCellWidth: 40, maxCellWidth: 130,
    scales: [
      { unit: "week", step: 1, format: (d: Date) => `Wk ${getWeekNumber(d)}` },
      { unit: "day",  step: 1, format: (d: Date) => `${DAYS_SHORT[d.getDay()]} ${d.getDate()}` },
    ],
  },
  {
    minCellWidth: 50, maxCellWidth: 150,
    scales: [
      { unit: "day",  step: 1, format: (d: Date) => `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}` },
      { unit: "hour", step: 4, format: (d: Date) => `${String(d.getHours()).padStart(2,"0")}:00` },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface SVARGanttChartProps {
  projectId: number;
}

// Stable constants — created once at module level so they never change reference
const GANTT_START = new Date(new Date().getFullYear() - 3, 0, 1);
const GANTT_END   = new Date(new Date().getFullYear() + 10, 11, 31);

export function SVARGanttChart({ projectId }: SVARGanttChartProps) {
  const [ganttApi, setGanttApi] = useState<IApi | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [levelFilter, setLevelFilter] = useState(0);
  const [selectedId, setSelectedId] = useState<any>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [ganttKey, setGanttKey] = useState(0);

  const { toast } = useToast();

  const containerRef  = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<any>(null);
  const linksMapRef   = useRef<Map<any, { source: any; target: any }>>(new Map());

  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  // ── Fullscreen ─────────────────────────────────────────────────────────────

  const toggleMaximize = useCallback(() => {
    if (!document.fullscreenElement && containerRef.current) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsMaximized(true);
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      setIsMaximized(false);
    }
  }, []);

  useEffect(() => {
    const onFSChange = () => { if (!document.fullscreenElement) setIsMaximized(false); };
    document.addEventListener("fullscreenchange", onFSChange);
    return () => document.removeEventListener("fullscreenchange", onFSChange);
  }, []);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: project, isLoading: projectLoading } = useQuery<PmProject>({
    queryKey: [`/api/pm/projects/${projectId}`],
    enabled: !!projectId,
  });

  const { data: phases = [], isLoading: phasesLoading } = useQuery<PmProjectPhase[]>({
    queryKey: ["/api/pm/projects", projectId, "phases"],
    enabled: !!projectId,
  });

  const { data: workstreams = [], isLoading: wsLoading } = useQuery<PmWorkstream[]>({
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

  // ── Build SVAR task tree with recursive depth support ─────────────────────

  const ganttTasks = useMemo((): ITask[] => {
    if (!project) return [];

    const safePhases      = (phases      ?? []) as PmProjectPhase[];
    const safeWorkstreams = (workstreams ?? []) as PmWorkstream[];
    const safeTasks       = (tasks       ?? []) as PmTask[];
    const safeMilestones  = (milestones  ?? []) as PmMilestone[];

    const result: ITask[] = [];

    const projectStart = toDate(project.startDate);
    const projectEnd   = project.endDate
      ? toDate(project.endDate)
      : new Date(projectStart.getFullYear() + 1, 11, 31);

    result.push({
      id: projectId,
      text: project.name,
      start: projectStart,
      end: projectEnd,
      progress: project.progress || 0,
      type: "summary",
      parent: 0,
      _jType: "project",
      _jId: project.id,
    } as ITask);

    // ── Recursive helper: add a PM task and all its descendants ───────────
    const addTaskTree = (task: PmTask, parentGanttId: number) => {
      const type = task.ganttType === "milestone"
        ? "milestone"
        : task.isSummary ? "summary" : "task";
      result.push({
        id: task.id,
        text: task.name,
        start: toDate(task.plannedStartDate),
        end:   toDate(task.plannedEndDate),
        progress: task.progress || 0,
        type,
        parent: parentGanttId,
        _jType: "task",
        _jId: task.id,
      } as ITask);
      // Recursively add children at any depth
      safeTasks
        .filter(s => s.parentTaskId === task.id)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .forEach(child => addTaskTree(child, task.id));
    };

    // Phases
    safePhases
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach(phase => {
        const phaseId = PHASE_OFFSET + phase.id;
        result.push({
          id: phaseId,
          text: phase.name,
          start: toDate(phase.plannedStartDate),
          end: toDate(phase.plannedEndDate),
          progress: phase.progress || 0,
          type: "summary",
          parent: projectId,
          _jType: "phase",
          _jId: phase.id,
        } as ITask);

        // Workstreams in this phase
        safeWorkstreams
          .filter(ws => ws.phaseId === phase.id)
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .forEach(ws => {
            result.push({
              id: WS_OFFSET + ws.id,
              text: ws.name,
              start: ws.plannedStartDate ? toDate(ws.plannedStartDate) : toDate(phase.plannedStartDate),
              end:   ws.plannedEndDate   ? toDate(ws.plannedEndDate)   : toDate(phase.plannedEndDate),
              progress: ws.progress || 0,
              type: "summary",
              parent: phaseId,
              _jType: "workstream",
              _jId: ws.id,
            } as ITask);
          });

        // Top-level tasks in this phase (recursively adds children)
        safeTasks
          .filter(t => t.phaseId === phase.id && !t.parentTaskId)
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .forEach(task => addTaskTree(task, phaseId));
      });

    // Orphan tasks (no phase, no parent) — recursively
    safeTasks
      .filter(t => !t.phaseId && !t.parentTaskId)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach(task => addTaskTree(task, projectId));

    // Orphan workstreams (no phase)
    safeWorkstreams
      .filter(ws => !ws.phaseId)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .forEach(ws => {
        result.push({
          id: WS_OFFSET + ws.id,
          text: ws.name,
          start: ws.plannedStartDate ? toDate(ws.plannedStartDate) : new Date(),
          end:   ws.plannedEndDate   ? toDate(ws.plannedEndDate)   : new Date(),
          progress: ws.progress || 0,
          type: "summary",
          parent: projectId,
          _jType: "workstream",
          _jId: ws.id,
        } as ITask);
      });

    // PM milestones
    safeMilestones.forEach(ms => {
      const msDate   = ms.dueDate ? toDate(ms.dueDate) : new Date();
      const parentId = ms.phaseId ? PHASE_OFFSET + ms.phaseId : projectId;
      result.push({
        id: MS_OFFSET + ms.id,
        text: ms.name,
        start: msDate,
        end: msDate,
        progress: ms.status === "completed" ? 100 : 0,
        type: "milestone",
        parent: parentId,
        _jType: "milestone",
        _jId: ms.id,
      } as ITask);
    });

    // ── Auto-compute WBS codes and depth ──────────────────────────────────
    const depthMap   = new Map<number, number>();
    const counterMap = new Map<number, number>();
    const wbsMap     = new Map<number, string>();

    depthMap.set(projectId, 1);

    const withMeta = result.map(t => {
      const tid = t.id as number;
      const pid = t.parent as number;

      const parentDepth = depthMap.has(pid) ? depthMap.get(pid)! : 0;
      const depth = parentDepth + 1;
      depthMap.set(tid, depth);

      let wbs = "";
      if (pid && pid !== 0) {
        const n = (counterMap.get(pid) || 0) + 1;
        counterMap.set(pid, n);
        const parentWbs = wbsMap.get(pid) ?? "";
        wbs = parentWbs ? `${parentWbs}.${n}` : String(n);
        wbsMap.set(tid, wbs);
      }

      return { ...t, wbs, _depth: depth };
    });

    // Open summaries that have children
    const parentIds = new Set(
      withMeta.map(t => t.parent).filter((p): p is number => !!p && p !== 0)
    );
    return withMeta.map(t =>
      t.type === "summary" && parentIds.has(t.id as number)
        ? { ...t, open: true }
        : t
    );
  }, [project, phases, workstreams, tasks, milestones, projectId]);

  // ── Level-filter ───────────────────────────────────────────────────────────

  const filteredTasks = useMemo((): ITask[] => {
    if (levelFilter === 0) return ganttTasks;
    return ganttTasks
      .filter(t => (t as any)._depth <= levelFilter)
      .map(t => ({
        ...t,
        open: (t as any)._depth < levelFilter ? (t.open ?? false) : false,
      }));
  }, [ganttTasks, levelFilter]);

  // ── Dependency links ───────────────────────────────────────────────────────

  const ganttLinks = useMemo((): ILink[] => {
    const links: ILink[] = [];
    let lid = 1;
    (tasks ?? []).forEach(task => {
      (task.predecessorIds || []).forEach(predId => {
        links.push({ id: lid++, type: "e2s", source: predId, target: task.id });
      });
    });
    return links;
  }, [tasks]);

  useEffect(() => {
    ganttLinks.forEach(link => {
      linksMapRef.current.set(link.id, { source: link.source, target: link.target });
    });
  }, [ganttLinks]);

  // ── Zoom config ────────────────────────────────────────────────────────────

  const zoomConfig = useMemo(() => ({
    level: zoomLevel,
    levels: ZOOM_LEVELS,
  }), [zoomLevel]);

  // ── Column config — inline editing enabled on key fields ──────────────────

  const columns = useMemo(() => [
    { id: "text",     header: "Task Name", width: 200, resize: true, editor: true },
    { id: "wbs",      header: "WBS",       width: 58,  resize: true },
    { id: "start",    header: "Start",     width: 90,  resize: true },
    { id: "end",      header: "End",       width: 90,  resize: true },
    { id: "duration", header: "Days",      width: 48 },
    { id: "progress", header: "%",         width: 50,  align: "center" as const },
  ], []);

  // ── Stable handlers ref ────────────────────────────────────────────────────

  const handlersRef = useRef({
    toast,
    projectId,
    ganttTasks,

    async onUpdate(api: IApi, id: any) {
      const task = api.getTask(id);
      if (!task?._jType) return;
      try {
        const u: Record<string, any> = {};
        if (task.text  !== undefined)    u.name             = task.text;
        if (task.start instanceof Date)  u.plannedStartDate = toDateStr(task.start);
        if (task.end   instanceof Date)  u.plannedEndDate   = toDateStr(task.end);
        if (task.progress !== undefined) u.progress         = task.progress;
        if (!Object.keys(u).length)      return;

        if (task._jType === "task") {
          await apiRequest("PUT", `/api/pm/tasks/${task._jId}`, u);
        } else if (task._jType === "phase") {
          await apiRequest("PUT", `/api/pm/phases/${task._jId}`, u);
        } else if (task._jType === "workstream") {
          await apiRequest("PUT", `/api/pm/workstreams/${task._jId}`, u);
        } else if (task._jType === "project") {
          await apiRequest("PUT", `/api/pm/projects/${handlersRef.current.projectId}`, u);
        }
      } catch (err: any) {
        handlersRef.current.toast({ title: "Save failed", description: err.message, variant: "destructive" });
      }
    },

    async onAdd(api: IApi, ev: { id: any; task: Partial<ITask> }) {
      const { id, task } = ev;
      try {
        const body = {
          tenantId: 1,
          projectId: handlersRef.current.projectId,
          name: task.text || "New Task",
          plannedStartDate: task.start instanceof Date ? toDateStr(task.start) : toDateStr(new Date()),
          plannedEndDate: task.end instanceof Date ? toDateStr(task.end) : toDateStr(new Date(Date.now() + 7 * 86400000)),
          progress: task.progress || 0,
          status: "todo",
          priority: "medium",
          ganttType: task.type === "milestone" ? "milestone" : "task",
          isSummary: task.type === "summary",
        };
        const res = await fetch("/api/pm/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        const created = await res.json();
        if (created?.id && created.id !== id) {
          api.exec("update-task", {
            id,
            task: { id: created.id, _jType: "task", _jId: created.id },
          });
        }
        queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", handlersRef.current.projectId, "tasks"] });
      } catch (err: any) {
        handlersRef.current.toast({ title: "Add task failed", description: err.message, variant: "destructive" });
      }
    },

    async onDelete(_api: IApi, ev: { id: any }) {
      const t = _api.getTask(ev.id);
      if (!t?._jType) return;
      try {
        if (t._jType === "task") {
          await apiRequest("DELETE", `/api/pm/tasks/${t._jId}`);
          queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", handlersRef.current.projectId, "tasks"] });
        } else if (t._jType === "phase") {
          await apiRequest("DELETE", `/api/pm/phases/${t._jId}`);
          queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", handlersRef.current.projectId, "phases"] });
        } else if (t._jType === "workstream") {
          await apiRequest("DELETE", `/api/pm/workstreams/${t._jId}`);
          queryClient.invalidateQueries({ queryKey: [`/api/pm/workstreams?projectId=${handlersRef.current.projectId}`] });
        }
      } catch (err: any) {
        handlersRef.current.toast({ title: "Delete failed", description: err.message, variant: "destructive" });
      }
    },

    async onAddLink(link: { id: any; source: any; target: any }) {
      if (link.source >= PHASE_OFFSET || link.target >= PHASE_OFFSET) return;
      try {
        const cur = queryClient.getQueryData<PmTask[]>(
          ["/api/pm/projects", handlersRef.current.projectId, "tasks"]
        ) || [];
        const tgt = cur.find(t => t.id === link.target);
        if (tgt) {
          const preds = [...new Set([...(tgt.predecessorIds || []), link.source])];
          await apiRequest("PUT", `/api/pm/tasks/${link.target}`, { predecessorIds: preds });
        }
      } catch (err: any) {
        handlersRef.current.toast({ title: "Link save failed", description: err.message, variant: "destructive" });
      }
    },

    async onDeleteLink(link: { source: any; target: any }) {
      if (link.source >= PHASE_OFFSET || link.target >= PHASE_OFFSET) return;
      try {
        const cur = queryClient.getQueryData<PmTask[]>(
          ["/api/pm/projects", handlersRef.current.projectId, "tasks"]
        ) || [];
        const tgt = cur.find(t => t.id === link.target);
        if (tgt) {
          const preds = (tgt.predecessorIds || []).filter((id: number) => id !== link.source);
          await apiRequest("PUT", `/api/pm/tasks/${link.target}`, { predecessorIds: preds });
        }
      } catch (err: any) {
        handlersRef.current.toast({ title: "Link delete failed", description: err.message, variant: "destructive" });
      }
    },
  });

  useEffect(() => { handlersRef.current.toast = toast; }, [toast]);
  useEffect(() => { handlersRef.current.projectId = projectId; }, [projectId]);
  useEffect(() => { handlersRef.current.ganttTasks = ganttTasks; }, [ganttTasks]);

  // ── Scroll to today whenever ganttApi becomes available ───────────────────
  useEffect(() => {
    if (!ganttApi) return;
    // Allow SVAR to fully render before scrolling — 300ms is reliable
    const t1 = setTimeout(() => {
      try { ganttApi.exec("scroll-chart" as any, { date: new Date() }); } catch {}
    }, 300);
    const t2 = setTimeout(() => {
      try { ganttApi.exec("scroll-chart" as any, { date: new Date() }); } catch {}
    }, 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [ganttApi]);

  // ── Stable init callback ──────────────────────────────────────────────────

  const initGantt = useCallback((api: IApi) => {
    setGanttApi(api);

    api.on("select-task", (ev: any) => {
      const id = ev?.id ?? null;
      selectedIdRef.current = id;
      setSelectedId(id);
    });

    api.on("update-task", (ev: any) => {
      if (ev.inProgress) return;
      handlersRef.current.onUpdate(api, ev.id);
    });

    api.on("add-task",    (ev: any) => handlersRef.current.onAdd(api, ev));
    api.on("delete-task", (ev: any) => handlersRef.current.onDelete(api, ev));

    api.on("add-link", (ev: any) => {
      const link = ev?.link ?? ev;
      if (link?.source !== undefined && link?.target !== undefined) {
        linksMapRef.current.set(link.id, { source: link.source, target: link.target });
        handlersRef.current.onAddLink(link);
      }
    });

    api.on("delete-link", (ev: any) => {
      const stored = linksMapRef.current.get(ev?.id);
      if (stored) {
        handlersRef.current.onDeleteLink(stored);
        linksMapRef.current.delete(ev?.id);
      }
    });

    // indent-task: persist new parentTaskId to DB.
    // Do NOT call invalidateQueries — that would re-drive `tasks` prop into Gantt
    // and reset all SVAR internal state (selection, collapse state, cursor).
    api.on("indent-task" as any, (ev: any) => {
      const id = ev?.id;
      if (!id) return;
      setTimeout(() => {
        try {
          const task = api.getTask(id);
          if (!task || task._jType !== "task" || !task._jId) return;
          const svarParent = task.parent as number;
          const newParentTaskId =
            svarParent > 0 && svarParent < PHASE_OFFSET ? svarParent : null;
          apiRequest("PUT", `/api/pm/tasks/${task._jId}`, { parentTaskId: newParentTaskId })
            .catch((err: any) =>
              handlersRef.current.toast({
                title: "Indent save failed",
                description: err.message,
                variant: "destructive",
              })
            );
        } catch {}
      }, 50);
    });
  }, []);

  // ── Toolbar action handlers ───────────────────────────────────────────────

  const handleAddTask = () => {
    if (!ganttApi) return;
    const today = new Date();
    const sel = selectedIdRef.current;
    try {
      ganttApi.exec("add-task", {
        task: {
          text: "New Task",
          start: today,
          end: new Date(today.getTime() + 7 * 86400000),
          progress: 0,
          type: "task",
        },
        ...(sel != null ? { target: sel, mode: "after" as const } : {}),
        select: true,
      } as any);
    } catch (err: any) {
      toast({ title: "Add task failed", description: err.message, variant: "destructive" });
    }
  };

  // "Edit" scrolls the chart to the selected task's start date.
  // Users edit task fields by clicking directly in the grid cells (inline).
  const handleEditTask = () => {
    if (!ganttApi) return;
    const id = selectedIdRef.current;
    if (!id) return;
    try {
      const task = ganttApi.getTask(id);
      if (task?.start instanceof Date) {
        ganttApi.exec("scroll-chart" as any, { date: task.start });
      }
    } catch {}
  };

  const handleDeleteTask = () => {
    if (!ganttApi) return;
    const id = selectedIdRef.current;
    if (!id) return;
    ganttApi.exec("delete-task", { id });
    setSelectedId(null);
  };

  const handleMoveUp   = () => { try { ganttApi?.exec("move-task" as any, { id: selectedIdRef.current, mode: "up"   }); } catch {} };
  const handleMoveDown = () => { try { ganttApi?.exec("move-task" as any, { id: selectedIdRef.current, mode: "down" }); } catch {} };
  const handleIndent   = () => { try { ganttApi?.exec("indent-task" as any, { id: selectedIdRef.current, mode: true  }); } catch {} };
  const handleOutdent  = () => { try { ganttApi?.exec("indent-task" as any, { id: selectedIdRef.current, mode: false }); } catch {} };
  const handleUndo     = () => { try { ganttApi?.exec("undo" as any); } catch {} };
  const handleRedo     = () => { try { ganttApi?.exec("redo" as any); } catch {} };

  const handleExpandAll = () => {
    if (!ganttApi) return;
    try {
      const state = ganttApi.getState?.() as any;
      if (!state) return;
      const allTasks: any[] = Array.isArray(state._tasks)
        ? state._tasks
        : Array.isArray(state.tasks)
          ? state.tasks
          : [];
      allTasks.forEach((t: any) => {
        if (t?.type === "summary") {
          try {
            ganttApi.exec("update-task", { id: t.id, task: { open: true }, skipUndo: true } as any);
          } catch {}
        }
      });
    } catch {}
  };

  const handleCollapseAll = () => {
    if (!ganttApi) return;
    try {
      const state = ganttApi.getState?.() as any;
      if (!state) return;
      const allTasks: any[] = Array.isArray(state._tasks)
        ? state._tasks
        : Array.isArray(state.tasks)
          ? state.tasks
          : [];
      allTasks.forEach((t: any) => {
        if (t?.type === "summary") {
          try {
            ganttApi.exec("update-task", { id: t.id, task: { open: false }, skipUndo: true } as any);
          } catch {}
        }
      });
    } catch {}
  };

  const handleResetLayout = () => {
    setGanttApi(null);
    setSelectedId(null);
    selectedIdRef.current = null;
    setGanttKey(k => k + 1);
  };

  const handleScrollToToday = () => {
    try { ganttApi?.exec("scroll-chart" as any, { date: new Date() }); } catch {}
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const isLoading = projectLoading || phasesLoading || wsLoading || tasksLoading;

  if (isLoading) {
    return (
      <div className="h-full p-4 space-y-2" data-testid="svar-gantt-loading">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", background: "var(--background)" }}
      data-testid="svar-gantt-container"
    >
      {/* Inject CSS so Willow's auto-height div fills the flex container */}
      <style>{`
        [data-testid="svar-gantt-container"] .wx-willow-theme {
          flex: 1 !important;
          min-height: 0 !important;
          display: flex !important;
          flex-direction: column !important;
        }
      `}</style>

      {/* ── Single combined toolbar — horizontally scrollable ── */}
      <div
        className="flex items-center gap-1 px-2 py-1 border-b border-border bg-card flex-shrink-0"
        style={{ overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none" }}
        data-testid="gantt-control-bar"
      >
        {/* ── Task actions group ── */}
        <button
          onClick={handleAddTask}
          disabled={!ganttApi}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          data-testid="button-gantt-new-task"
        >
          <Plus className="h-3 w-3" /> New task
        </button>

        {(
          [
            { icon: <Pencil className="h-3.5 w-3.5" />,         onClick: handleEditTask,   needsSel: true,  title: "Scroll chart to selected task", testId: "edit"    },
            { icon: <Trash2 className="h-3.5 w-3.5" />,         onClick: handleDeleteTask, needsSel: true,  title: "Delete",                        testId: "delete"  },
            { icon: <ChevronUp className="h-3.5 w-3.5" />,      onClick: handleMoveUp,     needsSel: true,  title: "Move up",                       testId: "up"      },
            { icon: <ChevronDown className="h-3.5 w-3.5" />,    onClick: handleMoveDown,   needsSel: true,  title: "Move down",                     testId: "down"    },
            { icon: <IndentIncrease className="h-3.5 w-3.5" />, onClick: handleIndent,     needsSel: true,  title: "Indent (make child of row above)", testId: "indent"  },
            { icon: <IndentDecrease className="h-3.5 w-3.5" />, onClick: handleOutdent,    needsSel: true,  title: "Outdent (promote to parent level)", testId: "outdent" },
          ] as const
        ).map(({ icon, onClick, needsSel, title, testId }) => (
          <button
            key={testId}
            onClick={onClick}
            disabled={!ganttApi || (needsSel && !selectedId)}
            title={title}
            className="h-7 w-7 flex items-center justify-center rounded border border-transparent hover:border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            data-testid={`button-gantt-${testId}`}
          >
            {icon}
          </button>
        ))}

        <div className="w-px h-4 bg-border mx-0.5" />

        {/* ── Undo / Redo ── */}
        <button onClick={handleUndo} disabled={!ganttApi} title="Undo"
          className="h-7 w-7 flex items-center justify-center rounded border border-transparent hover:border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          data-testid="button-gantt-undo">
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button onClick={handleRedo} disabled={!ganttApi} title="Redo"
          className="h-7 w-7 flex items-center justify-center rounded border border-transparent hover:border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          data-testid="button-gantt-redo">
          <Redo2 className="h-3.5 w-3.5" />
        </button>

        <div className="w-px h-4 bg-border mx-0.5" />

        {/* ── Expand / Collapse all ── */}
        <button onClick={handleExpandAll} disabled={!ganttApi} title="Expand all rows"
          className="h-7 w-7 flex items-center justify-center rounded border border-transparent hover:border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          data-testid="button-gantt-expand-all">
          <ChevronsDown className="h-3.5 w-3.5" />
        </button>
        <button onClick={handleCollapseAll} disabled={!ganttApi} title="Collapse all rows"
          className="h-7 w-7 flex items-center justify-center rounded border border-transparent hover:border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          data-testid="button-gantt-collapse-all">
          <ChevronsUp className="h-3.5 w-3.5" />
        </button>

        <div className="w-px h-4 bg-border mx-0.5" />

        {/* ── Zoom ── */}
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide select-none">Zoom</span>
        <div className="flex items-center bg-muted rounded p-0.5 gap-px">
          {ZOOM_LABELS.map((label, level) => (
            <button
              key={level}
              onClick={() => setZoomLevel(level)}
              className={cn(
                "px-2 py-0.5 text-[11px] rounded font-medium transition-colors leading-tight",
                zoomLevel === level
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid={`button-zoom-${label.toLowerCase()}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Today ── */}
        <button onClick={handleScrollToToday} disabled={!ganttApi} title="Jump to today"
          className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded border border-transparent hover:border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          data-testid="button-gantt-today">
          <CalendarDays className="h-3 w-3" />Today
        </button>

        <div className="w-px h-4 bg-border mx-0.5" />

        {/* ── Level filter ── */}
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide select-none">Level</span>
        <div className="flex items-center bg-muted rounded p-0.5 gap-px">
          {["All", "1", "2", "3", "4", "5"].map((label, idx) => (
            <button
              key={idx}
              onClick={() => setLevelFilter(idx)}
              className={cn(
                "px-1.5 py-0.5 text-[11px] rounded font-medium transition-colors leading-tight",
                levelFilter === idx
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid={`button-level-${label.toLowerCase()}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-4 bg-border mx-0.5" />

        {/* ── Reset layout ── */}
        <button onClick={handleResetLayout}
          title="Reset layout — restores chart panel if divider was dragged too far"
          className="h-7 w-7 flex items-center justify-center rounded border border-transparent hover:border-border hover:bg-muted transition-colors"
          data-testid="button-gantt-reset-layout">
          <Columns2 className="h-3.5 w-3.5" />
        </button>

        <div className="w-px h-4 bg-border mx-0.5" />

        {/* ── Fullscreen ── */}
        <button onClick={toggleMaximize}
          title={isMaximized ? "Exit fullscreen" : "Fullscreen"}
          className="h-7 w-7 flex items-center justify-center rounded border border-transparent hover:border-border hover:bg-muted transition-colors"
          data-testid="button-gantt-fullscreen">
          {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* ── SVAR Gantt (Willow theme) ─────────────────────────────────────── */}
      <Willow>
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }}>
          <Gantt
            key={ganttKey}
            tasks={filteredTasks}
            links={ganttLinks}
            columns={columns as any}
            zoom={zoomConfig}
            cellHeight={36}
            undo={true}
            init={initGantt}
            start={GANTT_START}
            end={GANTT_END}
          />

          {ganttApi && <ContextMenu api={ganttApi} />}
        </div>
      </Willow>
    </div>
  );
}
