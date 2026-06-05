import { useEffect, useRef, useState, useCallback } from "react";
import Gantt from "frappe-gantt";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, ZoomIn, ZoomOut, Calendar, Layers } from "lucide-react";
import type { PmProject, PmProjectPhase, PmTask, PmWorkstream } from "@shared/models/projects";

interface FrappeGanttChartProps {
  projectId: number;
  onItemClick?: (item: GanttItem) => void;
  onAddPhase?: () => void;
  onAddWorkstream?: () => void;
  onAddTask?: () => void;
  onAddMilestone?: () => void;
  onEditPhase?: (phase: PmProjectPhase) => void;
  onEditWorkstream?: (workstream: PmWorkstream) => void;
  onEditTask?: (task: PmTask) => void;
}

interface GanttItem {
  id: string;
  type: "project" | "phase" | "workstream" | "activity" | "sub_activity" | "task" | "sub_task" | "milestone";
  originalId: number;
  name: string;
  start: string;
  end: string;
  progress: number;
  dependencies: string;
  custom_class: string;
  data?: PmProjectPhase | PmWorkstream | PmTask | PmProject;
}

type ViewMode = "Quarter Day" | "Half Day" | "Day" | "Week" | "Month" | "Year";

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: "Day", label: "Day" },
  { value: "Week", label: "Week" },
  { value: "Month", label: "Month" },
  { value: "Year", label: "Year" },
];

const getItemColor = (type: string, status?: string | null): string => {
  const colors: Record<string, string> = {
    project: "bar-project",
    phase: "bar-phase",
    workstream: "bar-workstream",
    activity: "bar-activity",
    sub_activity: "bar-subactivity",
    task: "bar-task",
    sub_task: "bar-subtask",
    milestone: "bar-milestone",
  };
  
  if (status === "completed" || status === "done") {
    return `${colors[type] || "bar-task"} bar-completed`;
  }
  if (status === "blocked" || status === "on_hold") {
    return `${colors[type] || "bar-task"} bar-blocked`;
  }
  
  return colors[type] || "bar-task";
};

const formatDate = (date: string | Date | null | undefined): string => {
  if (!date) {
    const today = new Date();
    return today.toISOString().split("T")[0];
  }
  if (typeof date === "string") return date.split("T")[0];
  return date.toISOString().split("T")[0];
};

const addDays = (dateStr: string, days: number): string => {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
};

export function FrappeGanttChart({
  projectId,
  onItemClick,
  onAddPhase,
  onAddWorkstream,
  onAddTask,
  onAddMilestone,
  onEditPhase,
  onEditWorkstream,
  onEditTask,
}: FrappeGanttChartProps) {
  const ganttContainerRef = useRef<HTMLDivElement>(null);
  const ganttInstanceRef = useRef<Gantt | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("Week");
  const { toast } = useToast();

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

  const updatePhaseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PmProjectPhase> }) => {
      return apiRequest("PUT", `/api/pm/phases/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "phases"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update phase",
        description: error.message || "An error occurred while updating the phase.",
        variant: "destructive",
      });
    },
  });

  const updateWorkstreamMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PmWorkstream> }) => {
      return apiRequest("PUT", `/api/pm/workstreams/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pm/workstreams?projectId=${projectId}`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update workstream",
        description: error.message || "An error occurred while updating the workstream.",
        variant: "destructive",
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<PmTask> }) => {
      return apiRequest("PUT", `/api/pm/tasks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "tasks"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update task",
        description: error.message || "An error occurred while updating the task.",
        variant: "destructive",
      });
    },
  });

  const buildGanttTasks = useCallback((): GanttItem[] => {
    const items: GanttItem[] = [];
    const today = formatDate(new Date());

    if (!project) return items;

    const projectStart = formatDate(project.startDate) || today;
    const projectEnd = formatDate(project.endDate) || addDays(today, 90);

    items.push({
      id: `project-${project.id}`,
      type: "project",
      originalId: project.id,
      name: project.name,
      start: projectStart,
      end: projectEnd,
      progress: project.progress || 0,
      dependencies: "",
      custom_class: getItemColor("project", project.status),
      data: project,
    });

    const sortedPhases = [...phases].sort((a, b) => (a.order || 0) - (b.order || 0));
    
    sortedPhases.forEach((phase) => {
      const phaseStart = formatDate(phase.plannedStartDate) || projectStart;
      const phaseEnd = formatDate(phase.plannedEndDate) || addDays(phaseStart, 30);

      items.push({
        id: `phase-${phase.id}`,
        type: "phase",
        originalId: phase.id,
        name: `  ${phase.name}`,
        start: phaseStart,
        end: phaseEnd,
        progress: phase.progress || 0,
        dependencies: `project-${project.id}`,
        custom_class: getItemColor("phase", phase.status),
        data: phase,
      });

      const phaseWorkstreams = workstreams
        .filter((ws) => ws.phaseId === phase.id && !ws.parentWorkstreamId)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      phaseWorkstreams.forEach((ws) => {
        const wsType = (ws as any).type || "workstream";
        const wsStart = formatDate(ws.plannedStartDate) || phaseStart;
        const wsEnd = formatDate(ws.plannedEndDate) || addDays(wsStart, 14);

        items.push({
          id: `workstream-${ws.id}`,
          type: wsType as GanttItem["type"],
          originalId: ws.id,
          name: `    ${ws.name}`,
          start: wsStart,
          end: wsEnd,
          progress: ws.progress || 0,
          dependencies: `phase-${phase.id}`,
          custom_class: getItemColor(wsType, ws.status),
          data: ws,
        });

        const childWorkstreams = workstreams
          .filter((child) => child.parentWorkstreamId === ws.id)
          .sort((a, b) => (a.order || 0) - (b.order || 0));

        childWorkstreams.forEach((child) => {
          const childType = (child as any).type || "activity";
          const childStart = formatDate(child.plannedStartDate) || wsStart;
          const childEnd = formatDate(child.plannedEndDate) || addDays(childStart, 7);

          items.push({
            id: `workstream-${child.id}`,
            type: childType as GanttItem["type"],
            originalId: child.id,
            name: `      ${child.name}`,
            start: childStart,
            end: childEnd,
            progress: child.progress || 0,
            dependencies: `workstream-${ws.id}`,
            custom_class: getItemColor(childType, child.status),
            data: child,
          });

          const activityTasks = tasks
            .filter((t) => t.phaseId === phase.id && !t.parentTaskId)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

          activityTasks.forEach((task) => {
            addTaskToItems(task, `workstream-${child.id}`, 8);
          });
        });

        const wsTasks = tasks
          .filter((t) => t.phaseId === phase.id && !t.parentTaskId && !childWorkstreams.length)
          .sort((a, b) => (a.order || 0) - (b.order || 0));

        if (!childWorkstreams.length) {
          wsTasks.forEach((task) => {
            addTaskToItems(task, `workstream-${ws.id}`, 6);
          });
        }
      });

      if (!phaseWorkstreams.length) {
        const phaseTasks = tasks
          .filter((t) => t.phaseId === phase.id && !t.parentTaskId)
          .sort((a, b) => (a.order || 0) - (b.order || 0));

        phaseTasks.forEach((task) => {
          addTaskToItems(task, `phase-${phase.id}`, 4);
        });
      }
    });

    const orphanTasks = tasks
      .filter((t) => !t.phaseId && !t.parentTaskId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    orphanTasks.forEach((task) => {
      addTaskToItems(task, `project-${project.id}`, 2);
    });

    function addTaskToItems(task: PmTask, dependency: string, indent: number) {
      const taskStart = formatDate(task.plannedStartDate) || today;
      const taskEnd = formatDate(task.plannedEndDate) || addDays(taskStart, 5);
      const hasParent = !!task.parentTaskId;
      const taskType = hasParent ? "sub_task" : "task";

      const predecessorDeps = (task.predecessorIds || [])
        .map((id) => `task-${id}`)
        .join(", ");
      
      const allDeps = predecessorDeps ? `${dependency}, ${predecessorDeps}` : dependency;

      items.push({
        id: `task-${task.id}`,
        type: taskType,
        originalId: task.id,
        name: " ".repeat(indent) + task.name,
        start: taskStart,
        end: taskEnd,
        progress: task.progress || 0,
        dependencies: allDeps,
        custom_class: getItemColor(taskType, task.status),
        data: task,
      });

      const subTasks = tasks
        .filter((t) => t.parentTaskId === task.id)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      subTasks.forEach((subTask) => {
        addTaskToItems(subTask, `task-${task.id}`, indent + 2);
      });
    }

    return items;
  }, [project, phases, workstreams, tasks]);

  const handleDateChange = useCallback(
    (task: any, start: Date, end: Date) => {
      const [type, idStr] = task.id.split("-");
      const id = parseInt(idStr, 10);
      const startStr = start.toISOString().split("T")[0];
      const endStr = end.toISOString().split("T")[0];

      if (type === "phase") {
        updatePhaseMutation.mutate({
          id,
          data: { plannedStartDate: startStr, plannedEndDate: endStr },
        });
        toast({ title: "Phase dates updated" });
      } else if (type === "workstream") {
        updateWorkstreamMutation.mutate({
          id,
          data: { plannedStartDate: startStr, plannedEndDate: endStr },
        });
        toast({ title: "Workstream dates updated" });
      } else if (type === "task") {
        updateTaskMutation.mutate({
          id,
          data: { plannedStartDate: startStr, plannedEndDate: endStr },
        });
        toast({ title: "Task dates updated" });
      }
    },
    [updatePhaseMutation, updateWorkstreamMutation, updateTaskMutation, toast]
  );

  const handleProgressChange = useCallback(
    (task: any, progress: number) => {
      const [type, idStr] = task.id.split("-");
      const id = parseInt(idStr, 10);
      const roundedProgress = Math.round(progress);

      if (type === "phase") {
        updatePhaseMutation.mutate({ id, data: { progress: roundedProgress } });
      } else if (type === "workstream") {
        updateWorkstreamMutation.mutate({ id, data: { progress: roundedProgress } });
      } else if (type === "task") {
        updateTaskMutation.mutate({ id, data: { progress: roundedProgress } });
      }
      toast({ title: `Progress updated to ${roundedProgress}%` });
    },
    [updatePhaseMutation, updateWorkstreamMutation, updateTaskMutation, toast]
  );

  const handleClick = useCallback(
    (task: any) => {
      const [type, idStr] = task.id.split("-");
      const id = parseInt(idStr, 10);

      if (type === "phase") {
        const phase = phases.find((p) => p.id === id);
        if (phase && onEditPhase) onEditPhase(phase);
      } else if (type === "workstream") {
        const ws = workstreams.find((w) => w.id === id);
        if (ws && onEditWorkstream) onEditWorkstream(ws);
      } else if (type === "task") {
        const t = tasks.find((t) => t.id === id);
        if (t && onEditTask) onEditTask(t);
      }

      if (onItemClick) {
        onItemClick(task);
      }
    },
    [phases, workstreams, tasks, onEditPhase, onEditWorkstream, onEditTask, onItemClick]
  );

  useEffect(() => {
    if (!ganttContainerRef.current || phasesLoading || workstreamsLoading || tasksLoading) {
      return;
    }

    const ganttTasks = buildGanttTasks();

    if (ganttTasks.length === 0) {
      if (ganttInstanceRef.current) {
        ganttInstanceRef.current = null;
      }
      return;
    }

    if (ganttInstanceRef.current) {
      ganttInstanceRef.current = null;
    }
    
    // Clear the container and let Frappe Gantt create its own SVG
    ganttContainerRef.current.innerHTML = "";

    // Pass the container element directly - Frappe Gantt will create its own SVG
    ganttInstanceRef.current = new Gantt(ganttContainerRef.current, ganttTasks, {
      view_mode: viewMode,
      date_format: "YYYY-MM-DD",
      popup_trigger: "click",
      readonly: false,
      readonly_dates: false,
      readonly_progress: false,
      bar_height: 28,
      bar_corner_radius: 4,
      arrow_curve: 5,
      padding: 18,
      language: "en",
      on_click: handleClick,
      on_date_change: handleDateChange,
      on_progress_change: handleProgressChange,
      custom_popup_html: (task: any) => {
        const [type] = task.id.split("-");
        const typeLabel = type.charAt(0).toUpperCase() + type.slice(1).replace("_", " ");
        return `
          <div class="gantt-popup">
            <h5 class="gantt-popup-title">${task.name.trim()}</h5>
            <p class="gantt-popup-type">${typeLabel}</p>
            <p class="gantt-popup-dates">${task.start} to ${task.end}</p>
            <p class="gantt-popup-progress">${Math.round(task.progress)}% complete</p>
            <p class="gantt-popup-hint">Click to edit</p>
          </div>
        `;
      },
    });

    return () => {
      if (ganttInstanceRef.current) {
        ganttInstanceRef.current = null;
      }
    };
  }, [
    project,
    phases,
    workstreams,
    tasks,
    phasesLoading,
    workstreamsLoading,
    tasksLoading,
    viewMode,
    buildGanttTasks,
    handleClick,
    handleDateChange,
    handleProgressChange,
  ]);

  useEffect(() => {
    if (ganttInstanceRef.current) {
      ganttInstanceRef.current.change_view_mode(viewMode);
    }
  }, [viewMode]);

  const isLoading = phasesLoading || workstreamsLoading || tasksLoading;
  const hasData = project && (phases.length > 0 || workstreams.length > 0 || tasks.length > 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gantt Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Project Plan
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <SelectTrigger className="w-[120px]" data-testid="select-view-mode">
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent>
                {VIEW_MODES.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {onAddPhase && (
              <Button
                size="sm"
                variant="outline"
                onClick={onAddPhase}
                data-testid="button-add-phase-gantt"
              >
                <Plus className="h-4 w-4 mr-1" />
                Phase
              </Button>
            )}
            {onAddWorkstream && (
              <Button
                size="sm"
                variant="outline"
                onClick={onAddWorkstream}
                data-testid="button-add-workstream"
              >
                <Plus className="h-4 w-4 mr-1" />
                Workstream
              </Button>
            )}
            {onAddTask && (
              <Button
                size="sm"
                variant="outline"
                onClick={onAddTask}
                data-testid="button-add-task"
              >
                <Plus className="h-4 w-4 mr-1" />
                Task
              </Button>
            )}
            {onAddMilestone && (
              <Button
                size="sm"
                variant="outline"
                onClick={onAddMilestone}
                data-testid="button-add-milestone"
              >
                <Plus className="h-4 w-4 mr-1" />
                Milestone
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
            <Layers className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No plan items yet</p>
            <p className="text-sm">Add phases, activities, or tasks to build your project plan</p>
            <div className="flex gap-2 mt-4">
              {onAddPhase && (
                <Button size="sm" onClick={onAddPhase} data-testid="button-add-phase-empty">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Phase
                </Button>
              )}
              {onAddTask && (
                <Button size="sm" variant="outline" onClick={onAddTask} data-testid="button-add-task-empty">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Task
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div
            ref={ganttContainerRef}
            className="gantt-container overflow-x-auto w-full"
            style={{ minHeight: '400px' }}
            data-testid="gantt-chart-container"
          />
        )}
      </CardContent>
    </Card>
  );
}
