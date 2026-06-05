import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useShellLayout } from "@/hooks/use-shell-layout";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  CheckSquare, Plus, Search, MoreHorizontal, Edit, Trash2,
  BarChart3, User, Building2, Users, FolderKanban, Briefcase, Upload
} from "lucide-react";
import { ImportModal } from "@/components/ImportModal";
import {
  TaskDashboardIcon,
  TaskPersonalIcon,
  TaskCompanyIcon,
  TaskTeamIcon,
  TaskProjectIcon,
  TaskCustomerIcon,
} from "@/components/icons/ModuleIcons";
import { ModuleHeader } from "@/components/ModuleHeader";
import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";
import { MondayTable, ColumnDef, StatusOption } from "@/components/MondayTable";
import { UniversalViewSystem, ColumnDef as ViewColumnDef, StatusOption as ViewStatusOption } from "@/components/UniversalViewSystem";
import type { Task } from "@shared/schema";

type TaskWithDetails = Task & { 
  assignee?: { 
    id: string; 
    firstName: string | null; 
    lastName: string | null; 
    profileImageUrl: string | null 
  } 
};

const statusOptions = [
  { value: "not_started", label: "Not Started", color: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300" },
  { value: "in_progress", label: "In Progress", color: "bg-status-green text-status-green-foreground" },
  { value: "complete", label: "Complete", color: "bg-status-blue text-status-blue-foreground" },
  { value: "delayed", label: "Delayed", color: "bg-status-red text-status-red-foreground" },
  { value: "at_risk", label: "At Risk", color: "bg-status-amber text-status-amber-foreground" },
];

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const tabItems = [
  { id: "dashboard", label: "Dashboard", icon: TaskDashboardIcon, bgColor: "bg-status-blue", iconColor: "text-status-blue-foreground" },
  { id: "personal", label: "Personal", icon: TaskPersonalIcon, bgColor: "bg-status-purple", iconColor: "text-status-purple-foreground" },
  { id: "company", label: "Company", icon: TaskCompanyIcon, bgColor: "bg-status-green", iconColor: "text-status-green-foreground" },
  { id: "team", label: "Team", icon: TaskTeamIcon, bgColor: "bg-status-amber", iconColor: "text-status-amber-foreground" },
  { id: "project", label: "Project", icon: TaskProjectIcon, bgColor: "bg-status-teal", iconColor: "text-status-teal-foreground" },
  { id: "customer", label: "Customer", icon: TaskCustomerIcon, bgColor: "bg-status-red", iconColor: "text-status-red-foreground" },
];

export default function TaskManagementPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { mainOffset, mobileTopOffset } = useShellLayout();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithDetails | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");
  const [newTaskStatus, setNewTaskStatus] = useState("not_started");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskSource, setNewTaskSource] = useState("personal");
  const [customColumns, setCustomColumns] = useState<ViewColumnDef<TaskWithDetails>[]>([]);

  const { data: tasks = [], isLoading } = useQuery<TaskWithDetails[]>({
    queryKey: ["/api/tasks"],
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: { title: string; description?: string; priority: string; status: string; dueDate?: string; source: string }) => {
      const response = await apiRequest("POST", "/api/tasks", {
        ...data,
        tenantId: 1,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setIsNewTaskOpen(false);
      resetNewTaskForm();
      toast({ title: "Task created", description: "Your task has been created successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create task.", variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Task> }) => {
      const response = await apiRequest("PUT", `/api/tasks/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setEditingTask(null);
      toast({ title: "Task updated" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task deleted" });
    },
  });

  useEffect(() => {
    const handleCreateTask = () => {
      setIsNewTaskOpen(true);
    };
    window.addEventListener("jiganto:create-task", handleCreateTask);
    return () => window.removeEventListener("jiganto:create-task", handleCreateTask);
  }, []);

  const resetNewTaskForm = () => {
    setNewTaskTitle("");
    setNewTaskDescription("");
    setNewTaskPriority("medium");
    setNewTaskStatus("not_started");
    setNewTaskDueDate("");
    setNewTaskSource("personal");
  };

  const getFilteredTasks = (source?: string) => {
    let filtered = tasks;
    if (source) {
      filtered = filtered.filter(t => t.source === source);
    }
    if (searchTerm) {
      filtered = filtered.filter(t => 
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return filtered;
  };

  const getStatusBadge = (status: string) => {
    const option = statusOptions.find(o => o.value === status);
    if (!option) return <Badge variant="secondary">Unknown</Badge>;
    return <Badge className={cn("text-xs font-medium", option.color)}>{option.label}</Badge>;
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  const getStats = () => {
    const sources = ["personal", "company", "team", "project", "customer"];
    const statsBySource = sources.reduce((acc, source) => {
      const sourceTasks = tasks.filter(t => t.source === source);
      acc[source] = {
        total: sourceTasks.length,
        notStarted: sourceTasks.filter(t => t.status === "not_started").length,
        inProgress: sourceTasks.filter(t => t.status === "in_progress").length,
        complete: sourceTasks.filter(t => t.status === "complete").length,
        delayed: sourceTasks.filter(t => t.status === "delayed").length,
        atRisk: sourceTasks.filter(t => t.status === "at_risk").length,
      };
      return acc;
    }, {} as Record<string, { total: number; notStarted: number; inProgress: number; complete: number; delayed: number; atRisk: number }>);
    
    return {
      total: tasks.length,
      notStarted: tasks.filter(t => t.status === "not_started").length,
      inProgress: tasks.filter(t => t.status === "in_progress").length,
      complete: tasks.filter(t => t.status === "complete").length,
      delayed: tasks.filter(t => t.status === "delayed").length,
      atRisk: tasks.filter(t => t.status === "at_risk").length,
      bySource: statsBySource,
    };
  };

  const stats = getStats();

  const taskStatusOptions: StatusOption[] = statusOptions.map(opt => ({
    value: opt.value,
    label: opt.label,
    color: opt.color,
  }));

  const getTaskColumns = (showSource: boolean): ColumnDef<TaskWithDetails>[] => {
    const cols: ColumnDef<TaskWithDetails>[] = [
      {
        id: "title",
        header: "Title",
        type: "text",
        accessor: "title",
        width: "40%",
      },
      {
        id: "status",
        header: "Status",
        type: "status",
        accessor: "status",
        width: "140px",
        editable: true,
        options: taskStatusOptions,
      },
      {
        id: "priority",
        header: "Priority",
        type: "priority",
        accessor: "priority",
        width: "120px",
        editable: true,
      },
    ];

    if (showSource) {
      cols.push({
        id: "source",
        header: "Source",
        type: "status",
        accessor: "source",
        width: "120px",
      });
    }

    cols.push(
      {
        id: "assignee",
        header: "Assignee",
        type: "person",
        accessor: "assignee",
        width: "160px",
      },
      {
        id: "dueDate",
        header: "Due Date",
        type: "date",
        accessor: "dueDate",
        width: "130px",
        editable: true,
      }
    );

    return cols;
  };

  const handleTaskCellEdit = (taskId: number | string, columnId: string, value: unknown) => {
    updateTaskMutation.mutate({ id: taskId as number, updates: { [columnId]: value } });
  };

  const inlineAddTaskMutation = useMutation({
    mutationFn: async (data: Partial<TaskWithDetails>) => {
      const response = await apiRequest("POST", "/api/tasks", {
        title: data.title || "New Task",
        description: data.description,
        priority: data.priority || "medium",
        status: data.status || "not_started",
        dueDate: data.dueDate,
        source: newTaskSource || "personal",
        tenantId: 1,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task created" });
    },
    onError: () => {
      toast({ title: "Failed to create task", variant: "destructive" });
    },
  });

  const viewTaskColumns: ViewColumnDef<TaskWithDetails>[] = [
    {
      id: "title",
      header: "Title",
      type: "text",
      accessor: "title",
      width: "35%",
      editable: true,
    },
    {
      id: "status",
      header: "Status",
      type: "status",
      accessor: "status",
      width: "130px",
      editable: true,
      options: statusOptions.map(opt => ({ value: opt.value, label: opt.label, color: opt.color })),
    },
    {
      id: "priority",
      header: "Priority",
      type: "priority",
      accessor: "priority",
      width: "110px",
      editable: true,
    },
    {
      id: "source",
      header: "Source",
      type: "status",
      accessor: "source",
      width: "110px",
    },
    {
      id: "assignee",
      header: "Assignee",
      type: "person",
      accessor: "assignee",
      width: "140px",
    },
    {
      id: "dueDate",
      header: "Due Date",
      type: "date",
      accessor: "dueDate",
      width: "120px",
      editable: true,
    },
  ];

  const handleAddColumn = (newColumn: ViewColumnDef<TaskWithDetails>) => {
    setCustomColumns(prev => [...prev, newColumn]);
    toast({ title: "Column added", description: `Added "${newColumn.header}" column.` });
  };

  const TaskViewSystem = ({ tasks: tableTasks, showSource = false }: { tasks: TaskWithDetails[]; showSource?: boolean }) => {
    const baseCols = showSource ? viewTaskColumns : viewTaskColumns.filter(c => c.id !== "source");
    const allColumns = [...baseCols, ...customColumns];
    
    return (
      <UniversalViewSystem
        columns={allColumns}
        data={tableTasks}
        onRowDoubleClick={(task) => setEditingTask(task)}
        onCellEdit={handleTaskCellEdit}
        onAddItem={() => { setNewTaskSource(activeTab === "dashboard" ? "personal" : activeTab); setIsNewTaskOpen(true); }}
        onInlineAddItem={(data) => inlineAddTaskMutation.mutate(data)}
        onDeleteItems={(ids) => ids.forEach(id => deleteTaskMutation.mutate(id as number))}
        onAddColumn={handleAddColumn}
        dateField="dueDate"
        statusField="status"
        titleField="title"
        emptyMessage="No tasks found. Click below to create one."
        addItemLabel="New Task"
        enabledViews={["table", "kanban", "calendar", "gantt", "list", "chart"]}
        defaultView="table"
      />
    );
  };

  const DashboardTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-5 gap-3">
        {tabItems.filter(t => t.id !== "dashboard").map((tab) => {
          const sourceStats = stats.bySource[tab.id] || { total: 0, inProgress: 0, complete: 0 };
          return (
            <Card 
              key={tab.id} 
              className="cursor-pointer hover-elevate transition-all border-border/30"
              onClick={() => setActiveTab(tab.id)}
              data-testid={`stat-card-${tab.id}`}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <tab.icon className="h-4 w-4" />
                  <div>
                    <p className="text-lg font-bold leading-none">{sourceStats.total}</p>
                    <p className="text-xs text-muted-foreground capitalize">{tab.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-5 gap-3">
        <Card className="bg-slate-50 dark:bg-slate-900/50 border-border/30">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-slate-600 dark:text-slate-400">{stats.notStarted}</p>
            <p className="text-xs text-slate-500">Not Started</p>
          </CardContent>
        </Card>
        <Card className="bg-brand-green/10 border-border/30">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-brand-green">{stats.inProgress}</p>
            <p className="text-xs text-brand-green">In Progress</p>
          </CardContent>
        </Card>
        <Card className="bg-brand-orange/10 border-border/30">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-brand-orange">{stats.atRisk}</p>
            <p className="text-xs text-brand-orange">At Risk</p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 border-border/30">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.delayed}</p>
            <p className="text-xs text-destructive">Delayed</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/10 border-border/30">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{stats.complete}</p>
            <p className="text-xs text-primary">Complete</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">All Tasks</h3>
        <TaskViewSystem tasks={getFilteredTasks()} showSource={true} />
      </div>
    </div>
  );

  const SourceTab = ({ source }: { source: string }) => (
    <div className="space-y-4">
      <TaskViewSystem tasks={getFilteredTasks(source)} />
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background" data-testid="task-mgmt-page">
        <Sidebar />
        <main className={cn("transition-all duration-300 h-screen flex items-center justify-center", mainOffset, mobileTopOffset)}>
          <div className="animate-pulse text-muted-foreground">Loading tasks...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="task-mgmt-page">
      <Sidebar />
      <main className={cn("transition-all duration-300 h-screen flex flex-col overflow-hidden", mainOffset, mobileTopOffset)}>
        <div className="px-4 pt-4">
          <ModuleWelcomeBanner moduleKey="tasks" features={["List & Kanban views", "Priority levels", "Status tracking", "Cross-module linking"]} />
        </div>
        <div className="border-b border-border/30 bg-card backdrop-blur-sm sticky top-0 z-50">
          <ModuleHeader
            icon={CheckSquare}
            title="Task Management"
            subtitle="Track and manage your tasks across all areas"
            searchPlaceholder="Search tasks..."
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchTestId="input-task-search"
            titleTestId="task-mgmt-title"
            actions={<>
                <Dialog open={isNewTaskOpen} onOpenChange={setIsNewTaskOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-2" data-testid="button-new-task">
                      <Plus className="h-4 w-4" />
                      New Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Create New Task</DialogTitle>
                      <DialogDescription>Add a new task to track and manage.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          placeholder="What needs to be done?"
                          data-testid="input-task-title"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          value={newTaskDescription}
                          onChange={(e) => setNewTaskDescription(e.target.value)}
                          placeholder="Add more details..."
                          rows={3}
                          data-testid="input-task-description"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select value={newTaskStatus} onValueChange={setNewTaskStatus}>
                            <SelectTrigger data-testid="select-task-status">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Priority</Label>
                          <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                            <SelectTrigger data-testid="select-task-priority">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {priorityOptions.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Due Date</Label>
                          <Input
                            type="date"
                            value={newTaskDueDate}
                            onChange={(e) => setNewTaskDueDate(e.target.value)}
                            data-testid="input-task-due-date"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Category</Label>
                          <Select value={newTaskSource} onValueChange={setNewTaskSource}>
                            <SelectTrigger data-testid="select-task-source">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {tabItems.filter(t => t.id !== "dashboard").map(tab => (
                                <SelectItem key={tab.id} value={tab.id}>{tab.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" className="border-border/30" onClick={() => setIsNewTaskOpen(false)}>Cancel</Button>
                      <Button 
                        onClick={() => createTaskMutation.mutate({
                          title: newTaskTitle,
                          description: newTaskDescription || undefined,
                          priority: newTaskPriority,
                          status: newTaskStatus,
                          dueDate: newTaskDueDate || undefined,
                          source: newTaskSource,
                        })}
                        disabled={!newTaskTitle.trim() || createTaskMutation.isPending}
                        data-testid="button-create-task"
                      >
                        {createTaskMutation.isPending ? "Creating..." : "Create Task"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
            </>}
          />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4">
            <TabsList className="h-12 bg-transparent border-0 gap-1">
              {tabItems.map((tab) => (
                <TabsTrigger 
                  key={tab.id}
                  value={tab.id} 
                  className="gap-2 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" 
                  data-testid={`tab-${tab.id}`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsContent value="dashboard" className="m-0">
                <DashboardTab />
              </TabsContent>
              <TabsContent value="personal" className="m-0">
                <SourceTab source="personal" />
              </TabsContent>
              <TabsContent value="company" className="m-0">
                <SourceTab source="company" />
              </TabsContent>
              <TabsContent value="team" className="m-0">
                <SourceTab source="team" />
              </TabsContent>
              <TabsContent value="project" className="m-0">
                <SourceTab source="project" />
              </TabsContent>
              <TabsContent value="customer" className="m-0">
                <SourceTab source="customer" />
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
            </DialogHeader>
            {editingTask && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={editingTask.title}
                    onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={editingTask.description || ""}
                    onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select 
                      value={editingTask.status} 
                      onValueChange={(value) => setEditingTask({ ...editingTask, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select 
                      value={editingTask.priority} 
                      onValueChange={(value) => setEditingTask({ ...editingTask, priority: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {priorityOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button 
                variant="destructive" 
                onClick={() => editingTask && deleteTaskMutation.mutate(editingTask.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </Button>
              <Button 
                onClick={() => editingTask && updateTaskMutation.mutate({ 
                  id: editingTask.id, 
                  updates: { 
                    title: editingTask.title,
                    description: editingTask.description,
                    status: editingTask.status,
                    priority: editingTask.priority,
                  } 
                })}
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
