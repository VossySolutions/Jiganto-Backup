import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, FolderKanban, Users } from "lucide-react";
import { ACCESS_LEVELS } from "@shared/schema";

interface BulkAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProfileIds: (number | string)[];
  selectedUserNames: string[];
  tenantId: number;
  onComplete: () => void;
}

export default function BulkAssignmentDialog({
  open,
  onOpenChange,
  selectedProfileIds,
  selectedUserNames,
  tenantId,
  onComplete,
}: BulkAssignmentDialogProps) {
  const { toast } = useToast();
  const [assignmentType, setAssignmentType] = useState<string>("project");
  const [projectId, setProjectId] = useState<string>("");
  const [programId, setProgramId] = useState<string>("");
  const [accessLevel, setAccessLevel] = useState<string>("view");

  const { data: projectsList = [] } = useQuery<any[]>({
    queryKey: [`/api/pm/projects?tenantId=${tenantId}`],
    enabled: open,
  });

  const { data: programmesList = [] } = useQuery<any[]>({
    queryKey: [`/api/pm/programs?tenantId=${tenantId}`],
    enabled: open,
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/settings/bulk-assignments", data);
      return res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/assignment-counts", tenantId] });
      for (const pid of selectedProfileIds) {
        queryClient.invalidateQueries({ queryKey: ["/api/settings/users", Number(pid), "assignments"] });
      }
      const msg = result.errors > 0
        ? `${result.created} assigned, ${result.errors} failed (may already be assigned)`
        : `${result.created} user${result.created !== 1 ? "s" : ""} assigned successfully`;
      toast({ title: "Bulk assignment complete", description: msg });
      resetForm();
      onOpenChange(false);
      onComplete();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create bulk assignments.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setAssignmentType("project");
    setProjectId("");
    setProgramId("");
    setAccessLevel("view");
  };

  const handleSubmit = () => {
    bulkAssignMutation.mutate({
      profileIds: selectedProfileIds.map(Number),
      assignmentType,
      projectId: assignmentType === "project" && projectId ? Number(projectId) : null,
      programId: assignmentType === "programme" && programId ? Number(programId) : null,
      accessLevel,
      tenantId,
    });
  };

  const programmeProjectCounts: Record<number, number> = {};
  for (const proj of projectsList) {
    if (proj.programId) {
      programmeProjectCounts[proj.programId] = (programmeProjectCounts[proj.programId] || 0) + 1;
    }
  }

  const hasSelection = assignmentType === "project" ? !!projectId : !!programId;
  const itemCount = selectedProfileIds.length;
  const displayNames = selectedUserNames.slice(0, 5);
  const moreCount = selectedUserNames.length - displayNames.length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5" />
            Bulk Assignment
          </DialogTitle>
          <DialogDescription>
            Assign {itemCount} selected user{itemCount !== 1 ? "s" : ""} to a project or programme
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Selected Users</Label>
            <div className="flex flex-wrap gap-1.5">
              {displayNames.map((name, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  {name}
                </Badge>
              ))}
              {moreCount > 0 && (
                <Badge variant="outline" className="text-xs">
                  +{moreCount} more
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Assignment Type</Label>
              <Select value={assignmentType} onValueChange={(v) => { setAssignmentType(v); setProjectId(""); setProgramId(""); }}>
                <SelectTrigger data-testid="select-bulk-assignment-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="programme">Programme</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Access Level</Label>
              <Select value={accessLevel} onValueChange={setAccessLevel}>
                <SelectTrigger data-testid="select-bulk-access-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCESS_LEVELS.map((al) => (
                    <SelectItem key={al} value={al}>{al.charAt(0).toUpperCase() + al.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{assignmentType === "project" ? "Project" : "Programme"}</Label>
            {assignmentType === "project" ? (
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger data-testid="select-bulk-project">
                  <SelectValue placeholder={projectsList.length === 0 ? "No projects available" : "Select a project"} />
                </SelectTrigger>
                <SelectContent>
                  {projectsList.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select value={programId} onValueChange={setProgramId}>
                <SelectTrigger data-testid="select-bulk-programme">
                  <SelectValue placeholder={programmesList.length === 0 ? "No programmes available" : "Select a programme"} />
                </SelectTrigger>
                <SelectContent>
                  {programmesList.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                      {programmeProjectCounts[p.id] ? ` (${programmeProjectCounts[p.id]} projects)` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {hasSelection && (
            <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground" data-testid="text-bulk-assignment-summary">
              This will assign <span className="font-medium text-foreground">{itemCount} user{itemCount !== 1 ? "s" : ""}</span> to the selected {assignmentType} with <span className="font-medium text-foreground">{accessLevel}</span> access. Users already assigned to this {assignmentType} will be skipped.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }} data-testid="button-cancel-bulk-assign">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!hasSelection || bulkAssignMutation.isPending}
            data-testid="button-submit-bulk-assign"
          >
            {bulkAssignMutation.isPending ? (
              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Assigning...</>
            ) : (
              <>Assign {itemCount} User{itemCount !== 1 ? "s" : ""}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}