import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell, FormSection, FieldGrid, FieldLabel, FormDivider } from "@/components/ui/form-dialog-shell";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { PmProjectPhase } from "@shared/models/projects";

interface PhaseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  phase?: PmProjectPhase | null;
  existingPhasesCount: number;
}

const methodologyOptions = [
  { value: "waterfall", label: "Waterfall" },
  { value: "agile", label: "Agile" },
];

const statusOptions = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On Hold" },
];

export function PhaseFormDialog({ 
  open, 
  onOpenChange, 
  projectId, 
  phase,
  existingPhasesCount 
}: PhaseFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!phase;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [methodology, setMethodology] = useState("waterfall");
  const [status, setStatus] = useState("not_started");
  const [plannedStartDate, setPlannedStartDate] = useState("");
  const [plannedEndDate, setPlannedEndDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");

  useEffect(() => {
    if (open && phase) {
      setName(phase.name || "");
      setDescription(phase.description || "");
      setMethodology(phase.methodology || "waterfall");
      setStatus(phase.status || "not_started");
      setPlannedStartDate(phase.plannedStartDate || "");
      setPlannedEndDate(phase.plannedEndDate || "");
      setEstimatedHours(phase.estimatedHours?.toString() || "");
    } else if (open && !phase) {
      resetForm();
    }
  }, [open, phase]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setMethodology("waterfall");
    setStatus("not_started");
    setPlannedStartDate("");
    setPlannedEndDate("");
    setEstimatedHours("");
  };

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiRequest("POST", "/api/pm/phases", data);
    },
    onSuccess: () => {
      toast({ title: "Phase created", description: "The phase has been added to your project." });
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "phases"] });
      resetForm();
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create phase. Please try again.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiRequest("PUT", `/api/pm/phases/${phase?.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Phase updated", description: "The phase has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "phases"] });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update phase. Please try again.", variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      toast({ title: "Missing name", description: "Please enter a phase name.", variant: "destructive" });
      return;
    }

    const data = {
      projectId,
      name: name.trim(),
      description: description.trim() || null,
      phaseNumber: isEditing ? phase?.phaseNumber : existingPhasesCount + 1,
      methodology,
      status,
      plannedStartDate: plannedStartDate || null,
      plannedEndDate: plannedEndDate || null,
      estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
      order: isEditing ? phase?.order : existingPhasesCount,
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      onCancel={() => onOpenChange(false)}
      onSubmit={handleSubmit}
      title={isEditing ? "Edit Phase" : "Add New Phase"}
      subtitle={isEditing ? "Update the phase details below." : "Create a new phase for your project timeline."}
      saveLabel={isPending ? "Saving..." : isEditing ? "Update Phase" : "Create Phase"}
      saving={isPending}
      saveTestId="button-save-phase"
      testId="phase-form-dialog"
    >
      <FormSection title="Phase details" icon={<span className="h-2 w-2 rounded-full bg-blue-500" />}>
        <div className="space-y-1.5 mb-3.5">
          <FieldLabel required>Name</FieldLabel>
          <Input
            id="phase-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Requirements Gathering"
            data-testid="input-phase-name"
          />
        </div>

        <div className="space-y-1.5">
          <FieldLabel>Description</FieldLabel>
          <Textarea
            id="phase-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the phase objectives..."
            rows={3}
            data-testid="input-phase-description"
          />
        </div>
      </FormSection>

      <FormDivider />

      <FormSection title="Planning" icon={<span className="h-2 w-2 rounded-full bg-violet-500" />}>
        <FieldGrid className="mb-3.5">
          <div className="space-y-1.5">
            <FieldLabel>Methodology</FieldLabel>
            <Select value={methodology} onValueChange={setMethodology}>
              <SelectTrigger id="phase-methodology" data-testid="select-phase-methodology">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {methodologyOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Status</FieldLabel>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="phase-status" data-testid="select-phase-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FieldGrid>

        <FieldGrid className="mb-3.5">
          <div className="space-y-1.5">
            <FieldLabel>Planned Start Date</FieldLabel>
            <Input
              id="phase-start-date"
              type="date"
              value={plannedStartDate}
              onChange={(e) => setPlannedStartDate(e.target.value)}
              data-testid="input-phase-start-date"
            />
          </div>

          <div className="space-y-1.5">
            <FieldLabel>Planned End Date</FieldLabel>
            <Input
              id="phase-end-date"
              type="date"
              value={plannedEndDate}
              onChange={(e) => setPlannedEndDate(e.target.value)}
              data-testid="input-phase-end-date"
            />
          </div>
        </FieldGrid>

        <div className="space-y-1.5">
          <FieldLabel>Estimated Hours</FieldLabel>
          <Input
            id="phase-hours"
            type="number"
            min="0"
            step="0.5"
            value={estimatedHours}
            onChange={(e) => setEstimatedHours(e.target.value)}
            placeholder="e.g., 40"
            data-testid="input-phase-hours"
          />
        </div>
      </FormSection>
    </FormDialogShell>
  );
}

export default PhaseFormDialog;
