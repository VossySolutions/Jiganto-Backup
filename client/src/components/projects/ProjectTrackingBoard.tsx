import { ModuleTrackingBoard } from "@/components/workspaces/ModuleTrackingBoard";

export function ProjectTrackingBoard({ projectId }: { projectId: number }) {
  return (
    <ModuleTrackingBoard
      apiPath={`/api/projects/${projectId}/tracking-board`}
      queryKey={["/api/projects", projectId, "tracking-board"]}
      title="Project Task Tracker"
      description="Track deliverables, owners, status, and progress for this project."
    />
  );
}
