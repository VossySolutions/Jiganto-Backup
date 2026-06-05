import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import type { PmTask, PmProjectPhase, PmMilestone } from "@shared/models/projects";

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  task?: PmTask | null;
}

const statusOptions = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "in_review", label: "In Review" },
  { value: "done", label: "Done" },
  { value: "blocked", label: "Blocked" },
];

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export function TaskFormDialog({ 
  open, 
  onOpenChange, 
  projectId, 
  task 
}: TaskFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!task;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phaseId, setPhaseId] = useState<string>("");
  const [milestoneId, setMilestoneId] = useState<string>("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [progress, setProgress] = useState("0");
  const [plannedStartDate, setPlannedStartDate] = useState("");
  const [plannedEndDate, setPlannedEndDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [wbsCode, setWbsCode] = useState("");
  const [predecessorIds, setPredecessorIds] = useState<number[]>([]);

  const { data: phases = [] } = useQuery<PmProjectPhase[]>({
    queryKey: ["/api/pm/projects", projectId, "phases"],
    enabled: open && !!projectId,
  });

  const { data: milestones = [] } = useQuery<PmMilestone[]>({
    queryKey: [`/api/pm/projects/${projectId}/milestones`],
    enabled: open && !!projectId,
  });

  const { data: existingTasks = [] } = useQuery<PmTask[]>({
    queryKey: ["/api/pm/projects", projectId, "tasks"],
    enabled: open && !!projectId,
  });

  useEffect(() => {
    if (open && task) {
      setName(task.name || "");
      setDescription(task.description || "");
      setPhaseId(task.phaseId?.toString() || "");
      setMilestoneId(task.milestoneId?.toString() || "");
      setStatus(task.status || "todo");
      setPriority(task.priority || "medium");
      setProgress(task.progress?.toString() || "0");
      setPlannedStartDate(task.plannedStartDate || "");
      setPlannedEndDate(task.plannedEndDate || "");
      setEstimatedHours(task.estimatedHours?.toString() || "");
      setWbsCode(task.wbsCode || "");
      setPredecessorIds(task.predecessorIds || []);
    } else if (open && !task) {
      resetForm();
    }
  }, [open, task]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setPhaseId("");
    setMilestoneId("");
    setStatus("todo");
    setPriority("medium");
    setProgress("0");
    setPlannedStartDate("");
    setPlannedEndDate("");
    setEstimatedHours("");
    setWbsCode("");
    setPredecessorIds([]);
  };

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiRequest("POST", "/api/pm/tasks", data);
    },
    onSuccess: () => {
      toast({ title: "Task created", description: "The task has been added to your project." });
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "tasks"] });
      resetForm();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create task. Please try again.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiRequest("PUT", `/api/pm/tasks/${task?.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Task updated", description: "The task has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "tasks"] });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update task. Please try again.", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Missing name", description: "Please enter a task name.", variant: "destructive" });
      return;
    }

    const data = {
      tenantId: 1,
      projectId,
      name: name.trim(),
      description: description.trim() || null,
      phaseId: phaseId ? parseInt(phaseId) : null,
      milestoneId: milestoneId ? parseInt(milestoneId) : null,
      status,
      priority,
      progress: parseInt(progress) || 0,
      plannedStartDate: plannedStartDate || null,
      plannedEndDate: plannedEndDate || null,
      estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
      wbsCode: wbsCode.trim() || null,
      predecessorIds: predecessorIds.length > 0 ? predecessorIds : null,
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const availablePredecessors = existingTasks.filter(t => t.id !== task?.id);

  const togglePredecessor = (taskId: number) => {
    if (predecessorIds.includes(taskId)) {
      setPredecessorIds(predecessorIds.filter(id => id !== taskId));
    } else {
      setPredecessorIds([...predecessorIds, taskId]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto" data-testid="task-form-dialog">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Task" : "Add New Task"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the task details below." : "Create a new task for your project."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-name">Name *</Label>
            <Input
              id="task-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Create database schema"
              data-testid="input-task-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the task..."
              rows={2}
              data-testid="input-task-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="task-phase">Phase</Label>
              <Select value={phaseId || "__none__"} onValueChange={(v) => setPhaseId(v === "__none__" ? "" : v)}>
                <SelectTrigger id="task-phase" data-testid="select-task-phase">
                  <SelectValue placeholder="Select phase..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No Phase</SelectItem>
                  {phases.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id.toString()}>{phase.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-milestone">Milestone</Label>
              <Select value={milestoneId || "__none__"} onValueChange={(v) => setMilestoneId(v === "__none__" ? "" : v)}>
                <SelectTrigger id="task-milestone" data-testid="select-task-milestone">
                  <SelectValue placeholder="Select milestone..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No Milestone</SelectItem>
                  {milestones.map((ms) => (
                    <SelectItem key={ms.id} value={ms.id.toString()}>{ms.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="task-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="task-status" data-testid="select-task-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-priority">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="task-priority" data-testid="select-task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-progress">Progress %</Label>
              <Input
                id="task-progress"
                type="number"
                min="0"
                max="100"
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
                data-testid="input-task-progress"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="task-start-date">Planned Start Date</Label>
              <Input
                id="task-start-date"
                type="date"
                value={plannedStartDate}
                onChange={(e) => setPlannedStartDate(e.target.value)}
                data-testid="input-task-start-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-end-date">Planned End Date</Label>
              <Input
                id="task-end-date"
                type="date"
                value={plannedEndDate}
                onChange={(e) => setPlannedEndDate(e.target.value)}
                data-testid="input-task-end-date"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="task-wbs">WBS Code</Label>
              <Input
                id="task-wbs"
                value={wbsCode}
                onChange={(e) => setWbsCode(e.target.value)}
                placeholder="e.g., 1.2.3.1"
                data-testid="input-task-wbs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-hours">Estimated Hours</Label>
              <Input
                id="task-hours"
                type="number"
                min="0"
                step="0.5"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="e.g., 8"
                data-testid="input-task-hours"
              />
            </div>
          </div>

          {availablePredecessors.length > 0 && (
            <div className="space-y-2">
              <Label>Dependencies (Predecessor Tasks)</Label>
              <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-1">
                {availablePredecessors.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={predecessorIds.includes(t.id)}
                      onChange={() => togglePredecessor(t.id)}
                      className="rounded"
                      data-testid={`checkbox-predecessor-${t.id}`}
                    />
                    <span>{t.name}</span>
                    {t.wbsCode && <span className="text-muted-foreground">({t.wbsCode})</span>}
                  </label>
                ))}
              </div>
              {predecessorIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {predecessorIds.length} task(s) selected as dependencies
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-task">
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="button-save-task">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Task" : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default TaskFormDialog;
