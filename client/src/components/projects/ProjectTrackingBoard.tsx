import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { WorkspaceTableView } from "@/components/workspaces/WorkspaceTableView";
import { WorkspaceQueryShell } from "@/components/workspaces/loading";

export function ProjectTrackingBoard({ projectId }: { projectId: number }) {
  const trackingQuery = useQuery<{ id: number }>({
    queryKey: ["/api/projects", projectId, "tracking-board"],
    enabled: !!projectId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/projects/${projectId}/tracking-board`);
      if (!res.ok) throw new Error("Failed to load tracking board");
      return res.json();
    },
  });

  return (
    <WorkspaceQueryShell query={trackingQuery} skeleton="table">
      {trackingQuery.data?.id ? (
        <WorkspaceTableView databaseId={trackingQuery.data.id} workspaceId={0} />
      ) : (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No tracking board configured for this project yet.
        </div>
      )}
    </WorkspaceQueryShell>
  );
}
