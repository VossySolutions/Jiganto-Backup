import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell, FormSection, FieldGrid, FieldLabel, FormDivider } from "@/components/ui/form-dialog-shell";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { PmWorkstream, PmProjectPhase } from "@shared/models/projects";

interface WorkstreamFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  workstream?: PmWorkstream | null;
}

const statusOptions = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On Hold" },
];

const ragOptions = [
  { value: "green", label: "Green - On Track" },
  { value: "amber", label: "Amber - At Risk" },
  { value: "red", label: "Red - Off Track" },
];

export function WorkstreamFormDialog({ 
  open, 
  onOpenChange, 
  projectId, 
  workstream 
}: WorkstreamFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!workstream;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phaseId, setPhaseId] = useState<string>("");
  const [parentWorkstreamId, setParentWorkstreamId] = useState<string>("");
  const [wbsCode, setWbsCode] = useState("");
  const [status, setStatus] = useState("not_started");
  const [ragStatus, setRagStatus] = useState("green");
  const [plannedStartDate, setPlannedStartDate] = useState("");
  const [plannedEndDate, setPlannedEndDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");

  const { data: phases = [] } = useQuery<PmProjectPhase[]>({
    queryKey: ["/api/pm/projects", projectId, "phases"],
    enabled: open && !!projectId,
  });

  const { data: workstreams = [] } = useQuery<PmWorkstream[]>({
    queryKey: [`/api/pm/workstreams?projectId=${projectId}`],
    enabled: open && !!projectId,
  });

  useEffect(() => {
    if (open && workstream) {
      setName(workstream.name || "");
      setDescription(workstream.description || "");
      setPhaseId(workstream.phaseId?.toString() || "");
      setParentWorkstreamId(workstream.parentWorkstreamId?.toString() || "");
      setWbsCode(workstream.wbsCode || "");
      setStatus(workstream.status || "not_started");
      setRagStatus(workstream.ragStatus || "green");
      setPlannedStartDate(workstream.plannedStartDate || "");
      setPlannedEndDate(workstream.plannedEndDate || "");
      setEstimatedHours(workstream.estimatedHours?.toString() || "");
    } else if (open && !workstream) {
      resetForm();
    }
  }, [open, workstream]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setPhaseId("");
    setParentWorkstreamId("");
    setWbsCode("");
    setStatus("not_started");
    setRagStatus("green");
    setPlannedStartDate("");
    setPlannedEndDate("");
    setEstimatedHours("");
  };

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiRequest("POST", "/api/pm/workstreams", data);
    },
    onSuccess: () => {
      toast({ title: "Workstream created", description: "The workstream has been added to your project." });
      queryClient.invalidateQueries({ queryKey: [`/api/pm/workstreams?projectId=${projectId}`] });
      resetForm();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create workstream. Please try again.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiRequest("PUT", `/api/pm/workstreams/${workstream?.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Workstream updated", description: "The workstream has been updated." });
      queryClient.invalidateQueries({ queryKey: [`/api/pm/workstreams?projectId=${projectId}`] });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update workstream. Please try again.", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      toast({ title: "Missing name", description: "Please enter a workstream name.", variant: "destructive" });
      return;
    }

    const data = {
      projectId,
      name: name.trim(),
      description: description.trim() || null,
      phaseId: phaseId ? parseInt(phaseId) : null,
      parentWorkstreamId: parentWorkstreamId ? parseInt(parentWorkstreamId) : null,
      wbsCode: wbsCode.trim() || null,
      status,
      ragStatus,
      plannedStartDate: plannedStartDate || null,
      plannedEndDate: plannedEndDate || null,
      estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const availableParentWorkstreams = workstreams.filter(w => 
    w.id !== workstream?.id && !w.parentWorkstreamId
  );

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCancel={() => onOpenChange(false)}
      onSubmit={handleSubmit}
      title={isEditing ? "Edit Workstream" : "Add New Workstream"}
      subtitle={isEditing ? "Update the workstream details below." : "Create a new workstream to organize your project work."}
      saveLabel={isPending ? "Saving..." : isEditing ? "Update Workstream" : "Create Workstream"}
      saving={isPending}
      saveTestId="button-save-workstream"
      testId="workstream-form-dialog"
    >
      <FormSection title="Workstream details" icon={<span className="h-2 w-2 rounded-full bg-blue-500" />}>
        <div className="space-y-1.5 mb-3.5">
          <FieldLabel required>Name</FieldLabel>
          <Input
            id="workstream-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Backend Development"
            data-testid="input-workstream-name"
          />
        </div>

        <div className="space-y-1.5">
          <FieldLabel>Description</FieldLabel>
          <Textarea
            id="workstream-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the workstream scope..."
            rows={2}
            data-testid="input-workstream-description"
          />
        </div>
      </FormSection>

      <FormDivider />

      <FormSection title="Planning" icon={<span className="h-2 w-2 rounded-full bg-violet-500" />}>
        <FieldGrid className="mb-3.5">
          <div className="space-y-1.5">
            <FieldLabel>Phase</FieldLabel>
            <Select value={phaseId || "__none__"} onValueChange={(v) => setPhaseId(v === "__none__" ? "" : v)}>
              <SelectTrigger id="workstream-phase" data-testid="select-workstream-phase">
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

          <div className="space-y-1.5">
            <FieldLabel>Parent Workstream</FieldLabel>
            <Select value={parentWorkstreamId || "__none__"} onValueChange={(v) => setParentWorkstreamId(v === "__none__" ? "" : v)}>
              <SelectTrigger id="workstream-parent" data-testid="select-workstream-parent">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {availableParentWorkstreams.map((ws) => (
                  <SelectItem key={ws.id} value={ws.id.toString()}>{ws.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FieldGrid>

        <FieldGrid className="mb-3.5">
          <div className="space-y-1.5">
            <FieldLabel>WBS Code</FieldLabel>
            <Input
              id="workstream-wbs"
              value={wbsCode}
              onChange={(e) => setWbsCode(e.target.value)}
              placeholder="e.g., 1.2.3"
              data-testid="input-workstream-wbs"
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Estimated Hours</FieldLabel>
            <Input
              id="workstream-hours"
              type="number"
              min="0"
              step="0.5"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              placeholder="e.g., 80"
              data-testid="input-workstream-hours"
            />
          </div>
        </FieldGrid>

        <FieldGrid className="mb-3.5">
          <div className="space-y-1.5">
            <FieldLabel>Status</FieldLabel>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="workstream-status" data-testid="select-workstream-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>RAG Status</FieldLabel>
            <Select value={ragStatus} onValueChange={setRagStatus}>
              <SelectTrigger id="workstream-rag" data-testid="select-workstream-rag">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ragOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FieldGrid>

        <FieldGrid>
          <div className="space-y-1.5">
            <FieldLabel>Planned Start Date</FieldLabel>
            <Input
              id="workstream-start-date"
              type="date"
              value={plannedStartDate}
              onChange={(e) => setPlannedStartDate(e.target.value)}
              data-testid="input-workstream-start-date"
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Planned End Date</FieldLabel>
            <Input
              id="workstream-end-date"
              type="date"
              value={plannedEndDate}
              onChange={(e) => setPlannedEndDate(e.target.value)}
              data-testid="input-workstream-end-date"
            />
          </div>
        </FieldGrid>
      </FormSection>
    </FormDialogShell>
  );
}

export default WorkstreamFormDialog;
