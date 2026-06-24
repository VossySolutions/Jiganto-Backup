import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { WorkspaceTableView } from "@/components/workspaces/WorkspaceTableView";
import { WorkspaceQueryShell } from "@/components/workspaces/loading";
import { ClipboardList } from "lucide-react";

interface ModuleTrackingBoardProps {
  /** API path returning `{ id: number }` tracking board database */
  apiPath: string;
  queryKey: readonly unknown[];
  title?: string;
  description?: string;
}

export function ModuleTrackingBoard({
  apiPath,
  queryKey,
  title = "Task Tracker",
  description = "Track tasks with status, priority, owners, and progress.",
}: ModuleTrackingBoardProps) {
  const trackingQuery = useQuery<{ id: number }>({
    queryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", apiPath);
      if (!res.ok) throw new Error("Failed to load task tracker");
      return res.json();
    },
    staleTime: 60_000,
    retry: 1,
  });

  return (
    <div className="space-y-3" data-testid="module-tracking-board">
      <div>
        <h2 className="text-base font-semibold flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          {title}
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground">{description}</p>
      </div>
      <WorkspaceQueryShell query={trackingQuery} skeleton="table">
        {trackingQuery.data?.id ? (
          <WorkspaceTableView databaseId={trackingQuery.data.id} workspaceId={0} />
        ) : (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            Task tracker is being prepared…
          </div>
        )}
      </WorkspaceQueryShell>
    </div>
  );
}
