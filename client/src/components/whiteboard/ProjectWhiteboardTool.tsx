import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import type { WhiteboardListItem } from "@shared/models/whiteboard";
import { thumbnailPlaceholder } from "@/lib/whiteboard-constants";
import { fetchWhiteboards } from "@/lib/whiteboard-api";
import { WhiteboardCardSkeleton } from "@/components/whiteboard/WhiteboardLoadingState";

export function ProjectWhiteboardTool({ projectId }: { projectId: number }) {
  const [, navigate] = useLocation();

  const { data: boards = [], isLoading, isError, refetch } = useQuery<WhiteboardListItem[]>({
    queryKey: ["/api/whiteboard", "project", projectId],
    queryFn: () => fetchWhiteboards({ filter: "project", projectId }),
  });

  if (isLoading) {
    return <WhiteboardCardSkeleton count={3} />;
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Could not load whiteboards.{" "}
          <button type="button" className="underline text-primary" onClick={() => refetch()}>Retry</button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <p className="text-sm text-muted-foreground">Collaborative sticky-note boards linked to this project.</p>
        <Button
          size="sm"
          className="w-full sm:w-auto shrink-0"
          onClick={() => navigate(`/modules/whiteboarding?compose=1&projectId=${projectId}`)}
        >
          <Plus className="h-4 w-4 mr-1" /> New Whiteboard
        </Button>
      </div>
      {boards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No whiteboards linked yet. Create one to start brainstorming.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {boards.map((b) => (
            <button
              key={b.id}
              type="button"
              className="text-left border rounded-lg overflow-hidden hover:border-primary/40 transition-colors bg-card"
              onClick={() => navigate(`/modules/whiteboarding/${b.id}`)}
            >
              <img src={b.thumbnailUrl || thumbnailPlaceholder(b.name)} alt="" className="w-full aspect-video object-cover bg-muted" loading="lazy" />
              <div className="p-3">
                <div className="font-medium text-sm truncate">{b.name}</div>
                <div className="text-xs text-muted-foreground">{b.noteCount} notes</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
