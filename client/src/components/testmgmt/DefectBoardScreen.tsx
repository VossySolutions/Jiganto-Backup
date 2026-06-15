import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Bug, GripVertical, Loader2 } from "lucide-react";
import { useTmProject } from "@/contexts/TmProjectContext";
import { HD_BOARD_COLUMNS, SEV_BADGE, mapTicketToColumn, canMoveToColumn } from "@/lib/tm-utils";
import type { TmHdDefect } from "@/types/testmgmt";
import { useTmFetch } from "@/hooks/use-tm-fetch";
import { TmScreenShell } from "@/components/testmgmt/TmScreenShell";

function DefectCard({
  defect,
  columnId,
  isDragging,
  onDragStart,
}: {
  defect: TmHdDefect;
  columnId: string;
  isDragging: boolean;
  onDragStart: (id: number) => void;
}) {
  return (
    <div
      className={cn(
        "bg-card border border-border rounded-lg p-3 space-y-2 shadow-sm transition-all",
        "cursor-grab active:cursor-grabbing hover:border-primary/40 hover:shadow-md",
        isDragging && "opacity-40 scale-[0.98]",
      )}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("defectId", String(defect.id));
        e.dataTransfer.setData("fromColumn", columnId);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(defect.id);
      }}
      onDragEnd={() => onDragStart(0)}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
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
  const [draggingId, setDraggingId] = useState(0);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

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
    onError: async (e: Error) => {
      toast({ title: "Could not move defect", description: e.message, variant: "destructive" });
    },
  });

  const filtered = useMemo(() => {
    return defects.filter((d) => {
      if (filterSev !== "all" && d.severity !== filterSev) return false;
      if (search && !d.title.toLowerCase().includes(search.toLowerCase()) && !d.ref.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [defects, filterSev, search]);

  function handleDrop(columnId: string, defectId: number, fromStatus: string) {
    setDropTarget(null);
    setDraggingId(0);
    if (!defectId) return;
    const defect = defects.find((d) => d.id === defectId);
    const current = defect?.status ?? fromStatus;
    if (mapTicketToColumn(current) === columnId) return;
    if (!canMoveToColumn(current, columnId)) {
      toast({
        title: "Invalid move",
        description: `Cannot move from "${current}" to this column. Follow the workflow order.`,
        variant: "destructive",
      });
      return;
    }
    moveMutation.mutate({ id: defectId, column: columnId });
  }

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
          <span className="text-xs text-muted-foreground hidden md:inline">Drag cards between columns · multi-step transitions applied automatically</span>
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
          <div className="flex gap-3 h-full min-w-max pb-2">
            {HD_BOARD_COLUMNS.map((col) => {
              const cards = filtered.filter((d) => mapTicketToColumn(d.status) === col.id);
              const isTarget = dropTarget === col.id;
              return (
                <div
                  key={col.id}
                  className={cn(
                    "w-[min(280px,85vw)] sm:w-[260px] flex flex-col rounded-xl border-2 transition-colors min-h-[200px]",
                    col.color,
                    isTarget && "ring-2 ring-primary border-primary/60",
                  )}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDropTarget(col.id);
                  }}
                  onDragLeave={() => setDropTarget((t) => (t === col.id ? null : t))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = Number(e.dataTransfer.getData("defectId"));
                    const fromCol = e.dataTransfer.getData("fromColumn");
                    const fromDefect = defects.find((d) => d.id === id);
                    handleDrop(col.id, id, fromDefect?.status ?? fromCol);
                  }}
                >
                  <div className="px-3 py-2.5 border-b border-border/40 flex items-center justify-between flex-shrink-0">
                    <span className="text-xs font-semibold">{col.label}</span>
                    <span className="text-[10px] font-mono bg-background/60 px-1.5 py-0.5 rounded">{cards.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px]">
                    {cards.length === 0 ? (
                      <div className={cn(
                        "rounded-lg border border-dashed border-border/60 p-4 text-center text-[10px] text-muted-foreground",
                        isTarget && "border-primary/50 bg-primary/5 text-primary",
                      )}>
                        {isTarget ? "Drop here" : "Empty"}
                      </div>
                    ) : (
                      cards.map((d) => (
                        <DefectCard
                          key={d.id}
                          defect={d}
                          columnId={col.id}
                          isDragging={draggingId === d.id}
                          onDragStart={setDraggingId}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </TmScreenShell>
  );
}
