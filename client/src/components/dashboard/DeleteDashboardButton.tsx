import { useState, type MouseEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDashboardSelector } from "@/hooks/use-dashboard-selector";
import { cn } from "@/lib/utils";
import { scopeQuery } from "./dashboard-utils";

type DeleteDashboardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardId: number;
  dashboardName: string;
  clientId?: number | null;
  projectId?: number | null;
  onDeleted?: () => void;
};

/** Confirm + delete API. Keep this outside DropdownMenu so the dialog is not unmounted when the menu closes. */
export function DeleteDashboardDialog({
  open,
  onOpenChange,
  dashboardId,
  dashboardName,
  clientId,
  projectId,
  onDeleted,
}: DeleteDashboardDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setCurrentDashboard, refreshCustomDashboards } = useDashboardSelector();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetchWithAuth(scopeQuery(`/api/dashboards/${dashboardId}`, clientId, projectId), {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: async () => {
      await refreshCustomDashboards();
      void queryClient.invalidateQueries({ queryKey: ["/api/dashboards"] });
      setCurrentDashboard("modules");
      onOpenChange(false);
      onDeleted?.();
      toast({ title: "Dashboard deleted" });
    },
    onError: () => {
      toast({
        title: "Could not delete dashboard",
        description: "You may not have permission to delete this dashboard.",
        variant: "destructive",
      });
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{dashboardName}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the dashboard and its widgets. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleteMutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              deleteMutation.mutate();
            }}
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete dashboard"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type DeleteDashboardButtonProps = {
  dashboardId: number;
  dashboardName: string;
  clientId?: number | null;
  projectId?: number | null;
  onDeleted?: () => void;
  variant?: "header" | "toolbar" | "icon";
  className?: string;
  "data-testid"?: string;
  /** When set, only the trigger is rendered; parent owns the confirm dialog (required inside DropdownMenu). */
  onRequestDelete?: () => void;
};

export function DeleteDashboardButton({
  dashboardId,
  dashboardName,
  clientId,
  projectId,
  onDeleted,
  variant = "toolbar",
  className,
  "data-testid": testId = "delete-dashboard-btn",
  onRequestDelete,
}: DeleteDashboardButtonProps) {
  const [open, setOpen] = useState(false);

  const requestDelete = (e?: MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (onRequestDelete) {
      onRequestDelete();
      return;
    }
    setOpen(true);
  };

  const trigger =
    variant === "icon" ? (
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className={cn(
          "h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10",
          className,
        )}
        title={`Delete ${dashboardName}`}
        aria-label={`Delete ${dashboardName}`}
        data-testid={testId}
        onClick={requestDelete}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    ) : (
      <Button
        type="button"
        size="sm"
        variant="destructive"
        className={cn("gap-1.5", className)}
        data-testid={testId}
        onClick={() => requestDelete()}
      >
        <Trash2 className="h-4 w-4" />
        {variant === "header" ? "Delete dashboard" : "Delete"}
      </Button>
    );

  return (
    <>
      {trigger}
      {!onRequestDelete && (
        <DeleteDashboardDialog
          open={open}
          onOpenChange={setOpen}
          dashboardId={dashboardId}
          dashboardName={dashboardName}
          clientId={clientId}
          projectId={projectId}
          onDeleted={onDeleted}
        />
      )}
    </>
  );
}
