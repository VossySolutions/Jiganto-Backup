import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/ui/form-dialog-shell";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Plus, X, Table2 } from "lucide-react";
import {
  BOARD_SAVED_VIEWS_API,
  encodeBoardViewFilters,
  decodeBoardViewFilters,
  type BoardViewSnapshot,
  type BoardFilterRule,
  type BoardSortRule,
} from "@/lib/board-filters";

type SavedView = {
  id: number;
  name: string;
  filters: unknown;
  sorts: unknown;
  columns: unknown;
  isDefault: boolean | null;
};

export type { BoardViewSnapshot };

type BoardSavedViewTabsProps = {
  entityType: string;
  current: BoardViewSnapshot;
  onApply: (snapshot: BoardViewSnapshot) => void;
  /** Default sorts when clicking Main Table */
  mainTableSorts?: BoardSortRule[];
  apiBase?: string;
};

function snapshotFromSavedView(view: SavedView): BoardViewSnapshot {
  const decoded = decodeBoardViewFilters(view.filters);
  const sortsFromCol = Array.isArray(view.sorts)
    ? (view.sorts as { columnId?: string; field?: string; direction?: string; dir?: string }[]).map((s) => ({
        field: s.field || s.columnId || "created",
        dir: (s.dir || s.direction || "desc") as "asc" | "desc",
      }))
    : [];
  const columns = Array.isArray(view.columns)
    ? (view.columns as BoardViewSnapshot["columns"])
    : [];
  return {
    filters: decoded.rules as BoardFilterRule[],
    sorts: decoded.sorts.length ? decoded.sorts : sortsFromCol,
    columns,
    viewMode: decoded.viewMode,
    groupBy: decoded.groupBy,
  };
}

export function BoardSavedViewTabs({
  entityType,
  current,
  onApply,
  mainTableSorts = [{ field: "created", dir: "desc" }],
  apiBase = BOARD_SAVED_VIEWS_API,
}: BoardSavedViewTabsProps) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const { toast } = useToast();
  const defaultAppliedRef = useRef(false);
  const listUrl = `${apiBase}?entityType=${entityType}`;

  const { data: savedViews = [] } = useQuery<SavedView[]>({
    queryKey: [listUrl],
  });

  useEffect(() => {
    if (defaultAppliedRef.current || !savedViews.length) return;
    const def = savedViews.find((v) => v.isDefault);
    defaultAppliedRef.current = true;
    if (!def) return;
    setActiveId(def.id);
    onApply(snapshotFromSavedView(def));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedViews]);

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", apiBase, {
        entityType,
        name: name.trim(),
        filters: encodeBoardViewFilters({
          rules: current.filters,
          viewMode: current.viewMode || "table",
          groupBy: current.groupBy || "none",
          sorts: current.sorts,
        }),
        sorts: current.sorts.map((s) => ({ columnId: s.field, direction: s.dir })),
        columns: current.columns,
        isDefault,
        isShared: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [listUrl] });
      setSaveOpen(false);
      setName("");
      setIsDefault(false);
      toast({ title: "View tab saved" });
    },
    onError: () => toast({ title: "Failed to save view", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `${apiBase}/${id}`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [listUrl] });
      if (activeId === id) setActiveId(null);
      toast({ title: "View deleted" });
    },
  });

  return (
    <>
      <div
        className="flex items-center gap-0.5 overflow-x-auto border-b border-border pb-0"
        data-testid="board-saved-view-tabs"
      >
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 h-8 px-3 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
            activeId === null
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
          onClick={() => {
            setActiveId(null);
            onApply({
              filters: [],
              sorts: mainTableSorts,
              columns: current.columns,
              viewMode: "table",
              groupBy: "none",
            });
          }}
          data-testid="board-view-tab-main"
        >
          <Table2 className="h-3.5 w-3.5" />
          Main Table
        </button>
        {savedViews.map((view) => (
          <div
            key={view.id}
            className={cn(
              "group inline-flex items-center gap-0.5 h-8 border-b-2 -mb-px whitespace-nowrap",
              activeId === view.id ? "border-primary" : "border-transparent",
            )}
          >
            <button
              type="button"
              className={cn(
                "px-2.5 text-[13px] font-medium",
                activeId === view.id ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => {
                setActiveId(view.id);
                onApply(snapshotFromSavedView(view));
              }}
              data-testid={`board-view-tab-${view.id}`}
            >
              {view.name}
            </button>
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 h-5 w-5 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-muted"
              title="Delete view"
              onClick={(e) => {
                e.stopPropagation();
                deleteMutation.mutate(view.id);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="inline-flex items-center gap-1 h-8 px-2.5 text-[13px] font-medium text-primary hover:bg-primary/10 rounded-md ml-1"
          onClick={() => setSaveOpen(true)}
          data-testid="button-add-view-tab"
        >
          <Plus className="h-3.5 w-3.5" />
          Add view
        </button>
      </div>

      <FormDialogShell
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title="Save view tab"
        subtitle="Saves filters, sorts, columns, group-by, and view mode"
        saveLabel="Save"
        onCancel={() => setSaveOpen(false)}
        onSubmit={() => {
          if (!name.trim()) {
            toast({ title: "Enter a view name", variant: "destructive" });
            return;
          }
          createMutation.mutate();
        }}
        saving={createMutation.isPending}
        disabled={!name.trim()}
        size="sm"
        saveTestId="button-confirm-save-view-tab"
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My working view"
              data-testid="input-view-tab-name"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isDefault} onCheckedChange={(v) => setIsDefault(v === true)} />
            Set as default
          </label>
        </div>
      </FormDialogShell>
    </>
  );
}
