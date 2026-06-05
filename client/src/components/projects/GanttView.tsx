import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Layers, GitBranch, ListTodo, Pencil, Trash2, MoreHorizontal, ChevronRight, Rocket } from "lucide-react";
import { ReactGanttChart } from "./ReactGanttChart";
import { PhaseFormDialog } from "./PhaseFormDialog";
import { WorkstreamFormDialog } from "./WorkstreamFormDialog";
import { TaskFormDialog } from "./TaskFormDialog";
import type { PmProjectPhase, PmWorkstream, PmTask } from "@shared/models/projects";

interface GanttViewProps {
  projectId: number;
}

export function GanttView({ projectId }: GanttViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("gantt");
  
  const [phaseDialogOpen, setPhaseDialogOpen] = useState(false);
  const [workstreamDialogOpen, setWorkstreamDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  
  const [editingPhase, setEditingPhase] = useState<PmProjectPhase | null>(null);
  const [editingWorkstream, setEditingWorkstream] = useState<PmWorkstream | null>(null);
  const [editingTask, setEditingTask] = useState<PmTask | null>(null);

  const { data: phases = [], isLoading: phasesLoading } = useQuery<PmProjectPhase[]>({
    queryKey: ["/api/pm/projects", projectId, "phases"],
  });

  const { data: workstreams = [], isLoading: workstreamsLoading } = useQuery<PmWorkstream[]>({
    queryKey: [`/api/pm/workstreams?projectId=${projectId}`],
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<PmTask[]>({
    queryKey: ["/api/pm/projects", projectId, "tasks"],
  });

  const releases = phases.filter(p => p.methodology === "release" || p.name.toLowerCase().includes("release"));
  const regularPhases = phases.filter(p => p.methodology !== "release" && !p.name.toLowerCase().includes("release"));
  const activities = workstreams.filter(ws => ws.type === "activity");
  const regularWorkstreams = workstreams.filter(ws => ws.type === "workstream");

  const deletePhase = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/pm/phases/${id}`),
    onSuccess: () => {
      toast({ title: "Phase deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "phases"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete phase", variant: "destructive" });
    },
  });

  const deleteWorkstream = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/pm/workstreams/${id}`),
    onSuccess: () => {
      toast({ title: "Workstream deleted" });
      queryClient.invalidateQueries({ queryKey: [`/api/pm/workstreams?projectId=${projectId}`] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete workstream", variant: "destructive" });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/pm/tasks/${id}`),
    onSuccess: () => {
      toast({ title: "Task deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "tasks"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
    },
  });

  const handleAddPhase = () => {
    setEditingPhase(null);
    setPhaseDialogOpen(true);
  };

  const handleEditPhase = (phase: PmProjectPhase) => {
    setEditingPhase(phase);
    setPhaseDialogOpen(true);
  };

  const handleAddWorkstream = () => {
    setEditingWorkstream(null);
    setWorkstreamDialogOpen(true);
  };

  const handleEditWorkstream = (ws: PmWorkstream) => {
    setEditingWorkstream(ws);
    setWorkstreamDialogOpen(true);
  };

  const handleAddTask = () => {
    setEditingTask(null);
    setTaskDialogOpen(true);
  };

  const handleEditTask = (task: PmTask) => {
    setEditingTask(task);
    setTaskDialogOpen(true);
  };

  const handleAddMilestone = () => {
    toast({ 
      title: "Coming Soon", 
      description: "Milestone creation will be available in the next update." 
    });
  };

  const getStatusBadge = (status: string | null | undefined) => {
    const statusColors: Record<string, string> = {
      not_started: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
      in_progress: "bg-status-blue text-status-blue-foreground",
      completed: "bg-status-green text-status-green-foreground",
      on_hold: "bg-status-amber text-status-amber-foreground",
      todo: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
      in_review: "bg-status-purple text-status-purple-foreground",
      done: "bg-status-green text-status-green-foreground",
      blocked: "bg-status-red text-status-red-foreground",
    };
    const label = status?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) || "Unknown";
    return (
      <Badge variant="outline" className={statusColors[status || ""] || "bg-gray-100"}>
        {label}
      </Badge>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4 flex-shrink-0">
          <TabsList>
            <TabsTrigger value="gantt" data-testid="tab-gantt-chart">Gantt Chart</TabsTrigger>
            <TabsTrigger value="releases" data-testid="tab-releases">Releases ({releases.length})</TabsTrigger>
            <TabsTrigger value="phases" data-testid="tab-phases">Phases ({regularPhases.length})</TabsTrigger>
            <TabsTrigger value="workstreams" data-testid="tab-workstreams">Workstreams ({regularWorkstreams.length})</TabsTrigger>
            <TabsTrigger value="activities" data-testid="tab-activities">Activities ({activities.length})</TabsTrigger>
            <TabsTrigger value="tasks" data-testid="tab-tasks">Tasks ({tasks.length})</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="gantt" className="mt-0 flex-1 overflow-hidden" style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            <ReactGanttChart projectId={projectId} />
          </div>
        </TabsContent>

        <TabsContent value="releases" className="mt-0 flex-1">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Rocket className="h-5 w-5" />
                  Releases
                </CardTitle>
                <Button size="sm" onClick={handleAddPhase} data-testid="button-add-release-card">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Release
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {phasesLoading ? (
                <p className="text-muted-foreground text-center py-8">Loading releases...</p>
              ) : releases.length === 0 ? (
                <div className="text-center py-8">
                  <Rocket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Releases Yet</h3>
                  <p className="text-muted-foreground mb-4">Add releases to organize your project deliverables.</p>
                  <Button onClick={handleAddPhase}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add First Release
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {releases.sort((a, b) => (a.phaseNumber || 0) - (b.phaseNumber || 0)).map((release) => (
                      <div
                        key={release.id}
                        className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50"
                        data-testid={`release-item-${release.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900 text-pink-600 dark:text-pink-300 font-semibold text-sm">
                            R{release.phaseNumber}
                          </div>
                          <div>
                            <p className="font-medium">{release.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {release.plannedStartDate && release.plannedEndDate && (
                                <span>{release.plannedStartDate} - {release.plannedEndDate}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(release.status)}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" data-testid={`button-release-menu-${release.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditPhase(release)}>
                                <Pencil className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => deletePhase.mutate(release.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="phases" className="mt-0 flex-1">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Layers className="h-5 w-5" />
                  Project Phases
                </CardTitle>
                <Button size="sm" onClick={handleAddPhase} data-testid="button-add-phase-card">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Phase
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {phasesLoading ? (
                <p className="text-muted-foreground text-center py-8">Loading phases...</p>
              ) : regularPhases.length === 0 ? (
                <div className="text-center py-8">
                  <Layers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Phases Yet</h3>
                  <p className="text-muted-foreground mb-4">Add phases to organize your project timeline.</p>
                  <Button onClick={handleAddPhase}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add First Phase
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {regularPhases.sort((a, b) => (a.phaseNumber || 0) - (b.phaseNumber || 0)).map((phase) => (
                      <div
                        key={phase.id}
                        className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50"
                        data-testid={`phase-item-${phase.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                            {phase.phaseNumber}
                          </div>
                          <div>
                            <p className="font-medium">{phase.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Badge variant="outline" className="text-xs">{phase.methodology}</Badge>
                              {phase.plannedStartDate && phase.plannedEndDate && (
                                <span>{phase.plannedStartDate} - {phase.plannedEndDate}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(phase.status)}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" data-testid={`button-phase-menu-${phase.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditPhase(phase)}>
                                <Pencil className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => deletePhase.mutate(phase.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workstreams" className="mt-0 flex-1">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <GitBranch className="h-5 w-5" />
                  Workstreams
                </CardTitle>
                <Button size="sm" onClick={handleAddWorkstream} data-testid="button-add-workstream-card">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Workstream
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {workstreamsLoading ? (
                <p className="text-muted-foreground text-center py-8">Loading workstreams...</p>
              ) : regularWorkstreams.length === 0 ? (
                <div className="text-center py-8">
                  <GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Workstreams Yet</h3>
                  <p className="text-muted-foreground mb-4">Add workstreams to organize work within phases.</p>
                  <Button onClick={handleAddWorkstream}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add First Workstream
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {regularWorkstreams.map((ws) => (
                      <div
                        key={ws.id}
                        className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50"
                        data-testid={`workstream-item-${ws.id}`}
                      >
                        <div className="flex items-center gap-3">
                          {ws.parentWorkstreamId && <ChevronRight className="h-4 w-4 text-muted-foreground ml-4" />}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{ws.name}</p>
                              {ws.wbsCode && <Badge variant="outline" className="text-xs">{ws.wbsCode}</Badge>}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {ws.plannedStartDate && ws.plannedEndDate && (
                                <span>{ws.plannedStartDate} - {ws.plannedEndDate}</span>
                              )}
                              {ws.estimatedHours && <span>{ws.estimatedHours}h estimated</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(ws.status)}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" data-testid={`button-workstream-menu-${ws.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditWorkstream(ws)}>
                                <Pencil className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => deleteWorkstream.mutate(ws.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activities" className="mt-0 flex-1">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <GitBranch className="h-5 w-5" />
                  Activities
                </CardTitle>
                <Button size="sm" onClick={handleAddWorkstream} data-testid="button-add-activity-card">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Activity
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {workstreamsLoading ? (
                <p className="text-muted-foreground text-center py-8">Loading activities...</p>
              ) : activities.length === 0 ? (
                <div className="text-center py-8">
                  <GitBranch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Activities Yet</h3>
                  <p className="text-muted-foreground mb-4">Add activities to break down workstreams.</p>
                  <Button onClick={handleAddWorkstream}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add First Activity
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {activities.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50"
                        data-testid={`activity-item-${activity.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{activity.name}</p>
                              {activity.wbsCode && <Badge variant="outline" className="text-xs">{activity.wbsCode}</Badge>}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {activity.plannedStartDate && activity.plannedEndDate && (
                                <span>{activity.plannedStartDate} - {activity.plannedEndDate}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(activity.status)}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" data-testid={`button-activity-menu-${activity.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditWorkstream(activity)}>
                                <Pencil className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => deleteWorkstream.mutate(activity.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="mt-0 flex-1">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ListTodo className="h-5 w-5" />
                  Tasks
                </CardTitle>
                <Button size="sm" onClick={handleAddTask} data-testid="button-add-task-card">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Task
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <p className="text-muted-foreground text-center py-8">Loading tasks...</p>
              ) : tasks.length === 0 ? (
                <div className="text-center py-8">
                  <ListTodo className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Tasks Yet</h3>
                  <p className="text-muted-foreground mb-4">Add tasks to populate your Gantt chart.</p>
                  <Button onClick={handleAddTask}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add First Task
                  </Button>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {tasks.map((task) => {
                      const phase = phases.find(p => p.id === task.phaseId);
                      return (
                        <div
                          key={task.id}
                          className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50"
                          data-testid={`task-item-${task.id}`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{task.name}</p>
                              {task.wbsCode && <Badge variant="outline" className="text-xs">{task.wbsCode}</Badge>}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              {phase && <span>Phase: {phase.name}</span>}
                              {task.plannedStartDate && task.plannedEndDate && (
                                <span>{task.plannedStartDate} - {task.plannedEndDate}</span>
                              )}
                              {task.progress !== null && task.progress !== undefined && (
                                <span>{task.progress}% complete</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(task.status)}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" data-testid={`button-task-menu-${task.id}`}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditTask(task)}>
                                  <Pencil className="h-4 w-4 mr-2" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => deleteTask.mutate(task.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PhaseFormDialog
        open={phaseDialogOpen}
        onOpenChange={setPhaseDialogOpen}
        projectId={projectId}
        phase={editingPhase}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "phases"] });
        }}
      />

      <WorkstreamFormDialog
        open={workstreamDialogOpen}
        onOpenChange={setWorkstreamDialogOpen}
        projectId={projectId}
        phases={phases}
        workstream={editingWorkstream}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: [`/api/pm/workstreams?projectId=${projectId}`] });
        }}
      />

      <TaskFormDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        projectId={projectId}
        phases={phases}
        task={editingTask}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "tasks"] });
        }}
      />
    </div>
  );
}
