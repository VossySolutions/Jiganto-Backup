import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClientWorkspace } from "./types";

interface Props {
  client: ClientWorkspace | null;
  onClose: () => void;
}

export function ClientDeleteDialog({ client, onClose }: Props) {
  const { toast } = useToast();
  const [confirmName, setConfirmName] = useState("");
  const open = !!client;

  useEffect(() => {
    setConfirmName("");
  }, [open, client?.id]);

  const deleteMut = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/clients/${client!.id}/delete-request`, { confirmName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients/kpis"] });
      toast({
        title: "Deletion scheduled",
        description: "Workspace enters a 30-day grace period before permanent removal.",
      });
      onClose();
      setConfirmName("");
    },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const matches = confirmName === client?.name;

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {client?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This is permanent after a 30-day grace period. All workspace data will be removed.
            Type the client name to confirm.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-2">
          <Label>Client name</Label>
          <Input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={client?.name}
            className="mt-1.5"
          />
        </div>
        <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <AlertDialogCancel onClick={() => setConfirmName("")} disabled={deleteMut.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            disabled={!matches || deleteMut.isPending}
            onClick={(e) => {
              e.preventDefault();
              deleteMut.mutate();
            }}
          >
            {deleteMut.isPending ? "Deleting…" : "Delete permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
