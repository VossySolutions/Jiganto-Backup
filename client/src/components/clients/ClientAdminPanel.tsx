import { useQuery, useMutation } from "@tanstack/react-query";
import { formatClientDate } from "@/lib/client-workspace-utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import { ClientsAdminLoading } from "./ClientLoadingStates";
import type { ClientWorkspace } from "./types";
import { userDisplayName } from "./types";

interface Props {
  canAdmin: boolean;
}

export function ClientAdminPanel({ canAdmin }: Props) {
  const { toast } = useToast();

  const { data: pending = [], isLoading } = useQuery<ClientWorkspace[]>({
    queryKey: ["/api/clients/admin/pending-delete"],
    enabled: canAdmin,
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/clients/${id}/restore`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients/admin/pending-delete"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients/kpis"] });
      toast({ title: "Workspace restored" });
    },
    onError: () => toast({ title: "Restore failed", variant: "destructive" }),
  });

  const purgeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/clients/purge-expired", {}),
    onSuccess: async (res) => {
      const body = (await res.json()) as { purged?: number };
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients/admin/pending-delete"] });
      toast({
        title: body.purged ? `Purged ${body.purged} workspace(s)` : "No expired workspaces to purge",
      });
    },
    onError: () => toast({ title: "Purge failed", variant: "destructive" }),
  });

  if (!canAdmin) return null;
  if (isLoading) return <ClientsAdminLoading />;
  if (pending.length === 0) return null;

  return (
    <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h2 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            Pending deletion
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Workspaces scheduled for permanent removal after the 30-day grace period.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-2 w-full sm:w-auto shrink-0"
          onClick={() => purgeMutation.mutate()}
          disabled={purgeMutation.isPending}
        >
          <Trash2 className="h-4 w-4" />
          {purgeMutation.isPending ? "Purging…" : "Purge expired"}
        </Button>
      </div>

      <div className="space-y-2">
        {pending.map((client) => (
          <div
            key={client.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-sm"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{client.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5 break-words">
                Purge {client.purgeAt ? formatClientDate(client.purgeAt) : "—"}
                {client.createdByUser && ` · Created by ${userDisplayName(client.createdByUser)}`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="destructive" className="text-[10px]">Pending delete</Badge>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 flex-1 sm:flex-none"
                onClick={() => restoreMutation.mutate(client.id)}
                disabled={restoreMutation.isPending}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {restoreMutation.isPending ? "Restoring…" : "Restore"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
