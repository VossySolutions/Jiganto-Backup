import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Bug, GripVertical, Loader2 } from "lucide-react";
import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { useTmProject } from "@/contexts/TmProjectContext";
import { HD_BOARD_COLUMNS, SEV_BADGE, mapTicketToColumn, canMoveToColumn } from "@/lib/tm-utils";
import type { TmHdDefect } from "@/types/testmgmt";
import { useTmFetch } from "@/hooks/use-tm-fetch";
import { TmScreenShell } from "@/components/testmgmt/TmScreenShell";
import { AppKanbanBoard } from "@/components/kanban";

function DefectCard({
  defect,
  dragHandleProps,
  isDragging,
}: {
  defect: TmHdDefect;
  dragHandleProps: DraggableProvidedDragHandleProps | null;
  isDragging: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-card border border-border rounded-lg p-3 space-y-2 shadow-sm transition-all",
        "hover:border-primary/40 hover:shadow-md",
        isDragging && "opacity-90 shadow-lg ring-2 ring-primary/25",
      )}
    >
      <div className="flex items-start gap-2">
        <div {...(dragHandleProps ?? {})} className="cursor-grab shrink-0 text-muted-foreground/50 mt-0.5">
          <GripVertical className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[10px] font-mono text-muted-foreground">{defect.ref}</span>
            <span className={cn("text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0", SEV_BADGE[defect.severity ?? "medium"])}>
              {defect.severity}
            </span>
          </div>
          <p className="text-xs font-medium leading-snug line-clamp-3">{defect.title}</p>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{defect.daysOpen}d open</span>
            {defect.linkedTestCaseId ? <span className="font-mono">TC #{defect.linkedTestCaseId}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DefectBoardScreen() {
  const { toast } = useToast();
  const [filterSev, setFilterSev] = useState("all");
  const [search, setSearch] = useState("");

  const {
    data: defects = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useTmFetch<TmHdDefect[]>(["/api/tm/defects/hd"], "/api/tm/defects/hd");

  const moveMutation = useMutation({
    mutationFn: ({ id, column }: { id: number; column: string }) =>
      apiRequest("PATCH", `/api/tm/defects/hd/${id}/status`, { column }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/defects/hd"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tm/dashboard"] });
      toast({ title: "Defect moved" });
    },
    onError: (e: Error) => {
      throw e;
    },
  });

  const filtered = useMemo(() => {
    return defects.filter((d) => {
      if (filterSev !== "all" && d.severity !== filterSev) return false;
      if (search && !d.title.toLowerCase().includes(search.toLowerCase()) && !d.ref.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [defects, filterSev, search]);

  const kanbanColumns = HD_BOARD_COLUMNS.map((col) => ({
    id: col.id,
    title: col.label,
    className: cn("w-[min(280px,85vw)] sm:w-[260px]", col.color),
  }));

  return (
    <TmScreenShell
      loading={isLoading}
      error={isError ? error : null}
      onRetry={() => refetch()}
      label="Loading defect board..."
    >
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-4 sm:px-6 py-3 border-b border-border flex flex-wrap items-center gap-2 sm:gap-3">
          <Bug className="h-4 w-4 text-primary flex-shrink-0" />
          <h2 className="text-sm font-semibold">Defect Board</h2>
          <span className="text-xs text-muted-foreground hidden md:inline">Drag cards between columns · workflow rules enforced</span>
          <input
            className="w-full sm:w-44 border rounded-md px-2 py-1 text-xs bg-background"
            placeholder="Search ref or title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="w-full sm:w-auto border rounded-md px-2 py-1 text-xs bg-background" value={filterSev} onChange={(e) => setFilterSev(e.target.value)}>
            <option value="all">All severities</option>
            {["critical", "high", "medium", "low"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {moveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin text-primary ml-auto" />}
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-hidden p-3 sm:p-4">
          <AppKanbanBoard
            columns={kanbanColumns}
            items={filtered}
            getItemId={(d) => String(d.id)}
            getColumnId={(d) => mapTicketToColumn(d.status)}
            setColumnIdOnItem={(d, columnId) => ({ ...d, status: columnId })}
            isMoveAllowed={(move) => {
              const defect = filtered.find((d) => String(d.id) === move.itemId);
              const current = defect?.status ?? move.fromColumnId;
              if (mapTicketToColumn(current) === move.toColumnId) return false;
              if (!canMoveToColumn(current, move.toColumnId)) {
                toast({
                  title: "Invalid move",
                  description: `Cannot move from "${current}" to this column. Follow the workflow order.`,
                  variant: "destructive",
                });
                return false;
              }
              return true;
            }}
            onMove={(move) =>
              new Promise<void>((resolve, reject) => {
                moveMutation.mutate(
                  { id: Number(move.itemId), column: move.toColumnId },
                  { onSuccess: () => resolve(), onError: (e) => reject(e) },
                );
              })
            }
            testIdPrefix="defect"
            idPrefix="defect-"
            emptyColumnLabel="Empty"
            className="h-full min-w-max pb-2"
            renderCard={(defect, ctx) => (
              <DefectCard defect={defect} dragHandleProps={ctx.dragHandleProps} isDragging={ctx.isDragging} />
            )}
          />
        </div>
      </div>
    </TmScreenShell>
  );
}
