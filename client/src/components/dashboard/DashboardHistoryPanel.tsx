import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DashboardHistoryEntry } from "@shared/models/dashboard";

function scopeQuery(base: string, clientId?: number | null, projectId?: number | null) {
  const params = new URLSearchParams();
  if (clientId) params.set("clientId", String(clientId));
  if (projectId) params.set("projectId", String(projectId));
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

export function DashboardHistoryPanel({
  dashboardId,
  clientId,
  projectId,
}: {
  dashboardId: number;
  clientId?: number | null;
  projectId?: number | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const url = scopeQuery(`/api/dashboards/${dashboardId}/history`, clientId, projectId);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: [url],
    queryFn: async () => {
      const res = await fetchWithAuth(url);
      if (!res.ok) throw new Error("Failed to load history");
      return (await res.json()) as DashboardHistoryEntry[];
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (historyId: number) => {
      const restoreUrl = scopeQuery(
        `/api/dashboards/${dashboardId}/history/${historyId}/restore`,
        clientId,
        projectId,
      );
      const res = await fetchWithAuth(restoreUrl, { method: "POST" });
      if (!res.ok) throw new Error("Restore failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [scopeQuery(`/api/dashboards/${dashboardId}`, clientId, projectId)],
      });
      queryClient.invalidateQueries({ queryKey: [url] });
      toast({ title: "Dashboard restored" });
    },
    onError: (err: Error) =>
      toast({ title: "Could not restore", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <Skeleton className="h-32 w-full rounded-xl" />;

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground flex items-center gap-2">
        <History className="h-4 w-4" />
        No change history yet. Edits to widgets and layout are tracked automatically (up to 30 versions).
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border/50 p-3 text-sm"
        >
          <div className="min-w-0">
            <p className="font-medium">Version {entry.version}</p>
            <p className="text-xs text-muted-foreground truncate">
              {entry.summary ?? entry.changeType} · {new Date(entry.createdAt).toLocaleString()}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-1"
            disabled={restoreMutation.isPending}
            onClick={() => restoreMutation.mutate(entry.id)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restore
          </Button>
        </div>
      ))}
    </div>
  );
}
