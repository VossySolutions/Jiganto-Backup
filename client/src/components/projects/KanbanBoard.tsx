import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Layers, Users, Tag, Filter, Plus, AlertCircle, Settings2, ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import type { PmTask, PmProjectPhase } from "@shared/models/projects";

interface KanbanBoardProps {
  projectId: number;
  onTaskClick?: (task: PmTask) => void;
}

interface SwimlaneConfig {
  type: "none" | "assignee" | "priority" | "phase";
  showWipLimits: boolean;
  wipLimits: Record<string, number>;
}

interface KanbanColumn {
  id: string;
  title: string;
  wipLimit?: number;
  color: string;
}

const defaultColumns: KanbanColumn[] = [
  { id: "backlog", title: "Backlog", color: "bg-gray-100 dark:bg-gray-800" },
  { id: "todo", title: "To Do", color: "bg-slate-100 dark:bg-slate-800" },
  { id: "in_progress", title: "In Progress", wipLimit: 5, color: "bg-blue-50 dark:bg-blue-950" },
  { id: "in_review", title: "In Review", wipLimit: 3, color: "bg-purple-50 dark:bg-purple-950" },
  { id: "done", title: "Done", color: "bg-green-50 dark:bg-green-950" },
];

const getPriorityBgColor = (priority: string | null | undefined) => {
  switch (priority) {
    case "critical":
      return "bg-red-50 dark:bg-red-950";
    case "high":
      return "bg-orange-50 dark:bg-orange-950";
    case "medium":
      return "bg-yellow-50 dark:bg-yellow-950";
    case "low":
      return "bg-blue-50 dark:bg-blue-950";
    default:
      return "";
  }
};

export function KanbanBoard({ projectId, onTaskClick }: KanbanBoardProps) {
  const [swimlaneConfig, setSwimlaneConfig] = useState<SwimlaneConfig>({
    type: "none",
    showWipLimits: true,
    wipLimits: { in_progress: 5, in_review: 3 },
  });
  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState("");
  const { toast } = useToast();

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<PmTask[]>({
    queryKey: ["/api/pm/projects", projectId, "tasks"],
    enabled: !!projectId,
  });

  const { data: phases = [] } = useQuery<PmProjectPhase[]>({
    queryKey: ["/api/pm/projects", projectId, "phases"],
    enabled: !!projectId,
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest("PUT", `/api/pm/tasks/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "tasks"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update task", description: err.message, variant: "destructive" });
    },
  });

  const filteredTasks = useMemo(() => {
    if (!filterText) return tasks;
    const lower = filterText.toLowerCase();
    return tasks.filter(
      (task) =>
        task.name.toLowerCase().includes(lower) ||
        task.description?.toLowerCase().includes(lower)
    );
  }, [tasks, filterText]);

  const swimlanes = useMemo(() => {
    if (swimlaneConfig.type === "none") {
      return [{ id: "all", title: "All Tasks", tasks: filteredTasks }];
    }

    const groups: Record<string, { id: string; title: string; tasks: PmTask[] }> = {};

    filteredTasks.forEach((task) => {
      let groupKey: string;
      let groupTitle: string;

      switch (swimlaneConfig.type) {
        case "assignee":
          groupKey = task.assigneeId || "unassigned";
          groupTitle = task.assigneeId ? `Assigned to ${task.assigneeId}` : "Unassigned";
          break;
        case "priority":
          groupKey = task.priority || "none";
          groupTitle = task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : "No Priority";
          break;
        case "phase":
          const phase = phases.find(p => p.id === task.phaseId);
          groupKey = task.phaseId?.toString() || "no_phase";
          groupTitle = phase?.name || "No Phase";
          break;
        default:
          groupKey = "all";
          groupTitle = "All Tasks";
      }

      if (!groups[groupKey]) {
        groups[groupKey] = { id: groupKey, title: groupTitle, tasks: [] };
      }
      groups[groupKey].tasks.push(task);
    });

    return Object.values(groups).sort((a, b) => {
      if (swimlaneConfig.type === "priority") {
        const order = ["critical", "high", "medium", "low", "none"];
        return order.indexOf(a.id) - order.indexOf(b.id);
      }
      return a.title.localeCompare(b.title);
    });
  }, [filteredTasks, swimlaneConfig.type, phases]);

  const getColumnTasks = useCallback(
    (columnId: string, swimlaneTasks: PmTask[]) => {
      return swimlaneTasks.filter((task) => task.status === columnId);
    },
    []
  );

  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    e.dataTransfer.setData("taskId", taskId.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    const taskId = parseInt(e.dataTransfer.getData("taskId"));
    if (!isNaN(taskId)) {
      const column = defaultColumns.find(c => c.id === columnId);
      const currentCount = tasks.filter(t => t.status === columnId).length;
      
      if (swimlaneConfig.showWipLimits && column?.wipLimit && currentCount >= column.wipLimit) {
        toast({
          title: "WIP Limit Reached",
          description: `The "${column.title}" column has reached its limit of ${column.wipLimit} items.`,
          variant: "destructive",
        });
        return;
      }
      
      updateTaskStatusMutation.mutate({ id: taskId, status: columnId });
    }
  };

  const toggleSwimlane = (swimlaneId: string) => {
    const newCollapsed = new Set(collapsedSwimlanes);
    if (newCollapsed.has(swimlaneId)) {
      newCollapsed.delete(swimlaneId);
    } else {
      newCollapsed.add(swimlaneId);
    }
    setCollapsedSwimlanes(newCollapsed);
  };

  const getWipStatus = (columnId: string) => {
    const count = tasks.filter((t) => t.status === columnId).length;
    const limit = swimlaneConfig.wipLimits[columnId];
    if (!limit || !swimlaneConfig.showWipLimits) return null;
    
    if (count >= limit) {
      return <Badge variant="destructive" className="ml-2 text-xs">At Limit</Badge>;
    }
    if (count >= limit * 0.8) {
      return <Badge variant="outline" className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900">Near Limit</Badge>;
    }
    return null;
  };

  if (tasksLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {defaultColumns.map((col) => (
            <Skeleton key={col.id} className="h-96 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Filter tasks..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-48"
            data-testid="input-filter"
          />

          <Select
            value={swimlaneConfig.type}
            onValueChange={(value: SwimlaneConfig["type"]) =>
              setSwimlaneConfig((prev) => ({ ...prev, type: value }))
            }
          >
            <SelectTrigger className="w-40" data-testid="select-swimlane">
              <Layers className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Swimlane" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Swimlanes</SelectItem>
              <SelectItem value="assignee">By Assignee</SelectItem>
              <SelectItem value="priority">By Priority</SelectItem>
              <SelectItem value="phase">By Phase</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="wip-limits"
              checked={swimlaneConfig.showWipLimits}
              onCheckedChange={(checked) =>
                setSwimlaneConfig((prev) => ({ ...prev, showWipLimits: !!checked }))
              }
              data-testid="checkbox-wip"
            />
            <label htmlFor="wip-limits" className="text-sm text-muted-foreground">
              WIP Limits
            </label>
          </div>

          <Badge variant="outline">{tasks.length} tasks</Badge>
        </div>
      </div>

      <div className="space-y-4">
        {swimlanes.map((swimlane) => (
          <div key={swimlane.id} className="border rounded-lg overflow-hidden">
            {swimlaneConfig.type !== "none" && (
              <button
                className="w-full flex items-center justify-between p-3 bg-muted hover-elevate text-left"
                onClick={() => toggleSwimlane(swimlane.id)}
                data-testid={`button-swimlane-${swimlane.id}`}
              >
                <div className="flex items-center gap-2">
                  {collapsedSwimlanes.has(swimlane.id) ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  <span className="font-semibold">{swimlane.title}</span>
                  <Badge variant="outline">{swimlane.tasks.length}</Badge>
                </div>
              </button>
            )}

            {!collapsedSwimlanes.has(swimlane.id) && (
              <div className="grid grid-cols-4 gap-4 p-4 overflow-x-auto min-w-[800px]">
                {defaultColumns.map((column) => {
                  const columnTasks = getColumnTasks(column.id, swimlane.tasks);
                  const allColumnTasks = tasks.filter(t => t.status === column.id);
                  
                  return (
                    <div
                      key={column.id}
                      className={`rounded-lg p-3 min-h-[200px] ${column.color}`}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, column.id)}
                      data-testid={`column-${column.id}-${swimlane.id}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <h3 className="font-semibold text-sm">{column.title}</h3>
                          {swimlaneConfig.showWipLimits && column.wipLimit && (
                            <span className="text-xs text-muted-foreground ml-2">
                              {allColumnTasks.length}/{column.wipLimit}
                            </span>
                          )}
                          {getWipStatus(column.id)}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {columnTasks.length}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        {columnTasks.map((task) => (
                          <Card
                            key={task.id}
                            className={`cursor-grab active:cursor-grabbing hover-elevate ${getPriorityBgColor(task.priority)}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onClick={() => onTaskClick?.(task)}
                            data-testid={`card-task-${task.id}`}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start gap-2">
                                <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm line-clamp-2">{task.name}</p>
                                  {task.description && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                                  )}
                                  <div className="flex items-center justify-between mt-2">
                                    <div className="flex items-center gap-1">
                                      {task.priority && (
                                        <Badge variant="outline" className="text-xs px-1">
                                          {task.priority}
                                        </Badge>
                                      )}
                                    </div>
                                    {task.assigneeId && (
                                      <Avatar className="h-5 w-5">
                                        <AvatarFallback className="text-xs">
                                          {task.assigneeId.slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}

                        {columnTasks.length === 0 && (
                          <div className="text-center py-6 text-muted-foreground text-sm">
                            Drop tasks here
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {tasks.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Layers className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No Tasks Yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add tasks to your project to see them in the Kanban board.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default KanbanBoard;
