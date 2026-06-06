import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { GripVertical, Pencil, Share2, Trash2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BespokeDashboardPayload } from "@shared/models/dashboard";
import { BespokeWidgetRenderer } from "./BespokeWidgetRenderer";
import { WidgetPickerSheet } from "./WidgetPickerSheet";
import { ShareDashboardDialog, DigestDashboardDialog } from "./ShareDashboardDialog";

function scopeQuery(base: string, clientId?: number | null, projectId?: number | null) {
  const params = new URLSearchParams();
  if (clientId) params.set("clientId", String(clientId));
  if (projectId) params.set("projectId", String(projectId));
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

const COLS: Record<string, number> = { "1-col": 1, "2-col": 2, "3-col": 3 };

export function BespokeDashboardView({
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
  const [editMode, setEditMode] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [digestOpen, setDigestOpen] = useState(false);

  const url = scopeQuery(`/api/dashboards/${dashboardId}`, clientId, projectId);
  const { data, isLoading } = useQuery({
    queryKey: [url],
    queryFn: async () => {
      const res = await fetchWithAuth(url);
      if (!res.ok) throw new Error("Dashboard not found");
      return (await res.json()) as BespokeDashboardPayload;
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (widgetId: number) => {
      const deleteUrl = scopeQuery(`/api/dashboards/${dashboardId}/widgets/${widgetId}`, clientId, projectId);
      const res = await fetchWithAuth(deleteUrl, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove widget");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [url] });
      toast({ title: "Widget removed" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (widgetIds: number[]) => {
      const reorderUrl = scopeQuery(`/api/dashboards/${dashboardId}/widgets/reorder`, clientId, projectId);
      const res = await fetchWithAuth(reorderUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgetIds }),
      });
      if (!res.ok) throw new Error("Failed to reorder");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [url] }),
  });

  const handleDragEnd = (result: DropResult) => {
    if (!data || !result.destination) return;
    const sorted = [...data.widgets].sort((a, b) => a.positionY - b.positionY || a.positionX - b.positionX);
    const items = Array.from(sorted);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved!);
    reorderMutation.mutate(items.map((w) => w.id));
  };

  if (isLoading || !data) {
    return <Skeleton className="h-96 w-full rounded-2xl" />;
  }

  const columns = COLS[data.layout] ?? 2;
  const sorted = [...data.widgets].sort((a, b) => a.positionY - b.positionY || a.positionX - b.positionX);

  const widgetGrid = (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(${Math.min(columns, 4)}, minmax(0, 1fr))` }}
    >
      {sorted.map((widget, idx) => (
        <div
          key={widget.id}
          className="relative min-h-[180px]"
          style={{ gridColumn: `span ${Math.min(widget.width, columns)}` }}
        >
          {editMode && (
            <div className="absolute top-2 right-2 z-10 flex gap-1">
              <Button
                size="icon"
                variant="secondary"
                className="h-7 w-7 cursor-grab active:cursor-grabbing"
                title="Drag to reorder"
              >
                <GripVertical className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="destructive"
                className="h-7 w-7"
                disabled={removeMutation.isPending}
                onClick={() => removeMutation.mutate(widget.id)}
                title="Remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          <BespokeWidgetRenderer widget={widget} clientId={clientId} projectId={projectId} />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={editMode ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => setEditMode((v) => !v)}
        >
          <Pencil className="h-4 w-4" />
          {editMode ? "Done editing" : "Edit layout"}
        </Button>
        {editMode && (
          <Button size="sm" variant="secondary" onClick={() => setPickerOpen(true)}>
            Add widget
          </Button>
        )}
        <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setShareOpen(true)}>
          <Share2 className="h-4 w-4" />
          Share
        </Button>
        <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setDigestOpen(true)}>
          <Mail className="h-4 w-4" />
          Email digest
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-12 text-center text-muted-foreground">
          <p className="mb-3">This dashboard has no widgets yet.</p>
          <Button onClick={() => { setEditMode(true); setPickerOpen(true); }}>Add your first widget</Button>
        </div>
      ) : editMode ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="bespoke-widgets" direction="vertical">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
                {sorted.map((widget, index) => (
                  <Draggable key={widget.id} draggableId={String(widget.id)} index={index}>
                    {(dragProvided, snapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className={`rounded-xl border ${snapshot.isDragging ? "border-primary shadow-lg" : "border-border/50"}`}
                      >
                        <div
                          {...dragProvided.dragHandleProps}
                          className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-muted/30 text-xs text-muted-foreground cursor-grab active:cursor-grabbing"
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                          Drag to reorder
                        </div>
                        <div className="relative min-h-[160px] p-1">
                          <div className="absolute top-2 right-2 z-10">
                            <Button
                              size="icon"
                              variant="destructive"
                              className="h-7 w-7"
                              disabled={removeMutation.isPending}
                              onClick={() => removeMutation.mutate(widget.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <BespokeWidgetRenderer widget={widget} clientId={clientId} projectId={projectId} />
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        widgetGrid
      )}

      <WidgetPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        dashboardId={dashboardId}
        clientId={clientId}
        projectId={projectId}
      />
      <ShareDashboardDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        dashboardId={dashboardId}
        clientId={clientId}
        projectId={projectId}
      />
      <DigestDashboardDialog
        open={digestOpen}
        onOpenChange={setDigestOpen}
        dashboardId={dashboardId}
        clientId={clientId}
        projectId={projectId}
      />
    </div>
  );
}
