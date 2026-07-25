import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/ui/form-dialog-shell";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Plus,
  Table2,
  List,
  Columns3,
  Calendar,
  GanttChart,
  FileText,
  BarChart3,
  FormInput,
  LayoutDashboard,
  Clock,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  GripVertical,
  Loader2,
} from "lucide-react";
import {
  BOARD_SAVED_VIEWS_API,
  BOARD_VIEW_MODES,
  encodeBoardViewFilters,
  decodeBoardViewFilters,
  type BoardViewSnapshot,
  type BoardFilterRule,
  type BoardSortRule,
  type BoardViewMode,
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
  /** View types offered when creating a new tab (Infinity-style). */
  viewModes?: BoardViewMode[];
  apiBase?: string;
};

const VIEW_ICONS: Record<BoardViewMode, typeof Table2> = {
  table: Table2,
  list: List,
  board: Columns3,
  calendar: Calendar,
  gantt: GanttChart,
  document: FileText,
  chart: BarChart3,
  form: FormInput,
  dashboard: LayoutDashboard,
  timesheet: Clock,
};

const VIEW_LABELS: Record<BoardViewMode, string> = {
  table: "Table",
  list: "List",
  board: "Board",
  calendar: "Calendar",
  gantt: "Gantt",
  document: "Document",
  chart: "Chart",
  form: "Form",
  dashboard: "Dashboard",
  timesheet: "Timesheet",
};

function tabOrderStorageKey(entityType: string) {
  return `jiganto-board-tab-order:${entityType}`;
}

function readTabOrder(entityType: string): number[] {
  try {
    const raw = localStorage.getItem(tabOrderStorageKey(entityType));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(Number).filter((n) => Number.isFinite(n)) : [];
  } catch {
    return [];
  }
}

function writeTabOrder(entityType: string, ids: number[]) {
  try {
    localStorage.setItem(tabOrderStorageKey(entityType), JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

function snapshotFromSavedView(view: SavedView): BoardViewSnapshot {
  const decoded = decodeBoardViewFilters(view.filters);
  const sortsFromCol = Array.isArray(view.sorts)
    ? (view.sorts as { columnId?: string; field?: string; direction?: string; dir?: string }[]).map(
        (s) => ({
          field: s.field || s.columnId || "created",
          dir: (s.dir || s.direction || "desc") as "asc" | "desc",
        }),
      )
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

function buildPayload(
  entityType: string,
  name: string,
  snapshot: BoardViewSnapshot,
  isDefault: boolean,
) {
  const sorts = snapshot.sorts || [];
  return {
    entityType,
    name: name.trim(),
    filters: encodeBoardViewFilters({
      rules: snapshot.filters || [],
      viewMode: snapshot.viewMode || "table",
      groupBy: snapshot.groupBy || "none",
      sorts,
    }),
    sorts: sorts.map((s) => ({ columnId: s.field, direction: s.dir })),
    columns: snapshot.columns || [],
    isDefault,
    isShared: false,
  };
}

function snapshotKey(snapshot: BoardViewSnapshot) {
  return JSON.stringify({
    filters: snapshot.filters,
    sorts: snapshot.sorts,
    columns: snapshot.columns,
    viewMode: snapshot.viewMode || "table",
    groupBy: snapshot.groupBy || "none",
  });
}

/**
 * Infinity-style board tabs: Main Table + saved tabs with view-type create,
 * rename / duplicate / delete / reorder, and auto-persist of the active tab.
 */
export function BoardSavedViewTabs({
  entityType,
  current,
  onApply,
  mainTableSorts = [{ field: "created", dir: "desc" }],
  viewModes = BOARD_VIEW_MODES,
  apiBase = BOARD_SAVED_VIEWS_API,
}: BoardSavedViewTabsProps) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createViewMode, setCreateViewMode] = useState<BoardViewMode>("table");
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameName, setRenameName] = useState("");
  const [tabOrder, setTabOrder] = useState<number[]>(() => readTabOrder(entityType));
  const [dragTabId, setDragTabId] = useState<number | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<number | null>(null);
  const { toast } = useToast();
  const defaultAppliedRef = useRef(false);
  const applyingRef = useRef(false);
  const skipAutosaveRef = useRef(false);
  const listUrl = `${apiBase}?entityType=${entityType}`;

  const { data: savedViews = [], isLoading: viewsLoading, isFetching: viewsFetching } = useQuery<SavedView[]>({
    queryKey: [listUrl],
  });

  const orderedViews = useMemo(() => {
    if (!savedViews.length) return [];
    const byId = new Map(savedViews.map((v) => [v.id, v]));
    const ordered: SavedView[] = [];
    const seen = new Set<number>();
    for (const id of tabOrder) {
      const v = byId.get(id);
      if (v) {
        ordered.push(v);
        seen.add(id);
      }
    }
    for (const v of savedViews) {
      if (!seen.has(v.id)) ordered.push(v);
    }
    return ordered;
  }, [savedViews, tabOrder]);

  useEffect(() => {
    setTabOrder(readTabOrder(entityType));
    defaultAppliedRef.current = false;
    setActiveId(null);
  }, [entityType]);

  useEffect(() => {
    if (!savedViews.length) return;
    const ids = savedViews.map((v) => v.id);
    setTabOrder((prev) => {
      const next = [...prev.filter((id) => ids.includes(id)), ...ids.filter((id) => !prev.includes(id))];
      if (next.length !== prev.length || next.some((id, i) => id !== prev[i])) {
        writeTabOrder(entityType, next);
        return next;
      }
      return prev;
    });
  }, [savedViews, entityType]);

  const applySnapshot = useCallback(
    (snapshot: BoardViewSnapshot) => {
      applyingRef.current = true;
      skipAutosaveRef.current = true;
      onApply(snapshot);
      // Allow React to flush applied state before autosave watches `current`
      requestAnimationFrame(() => {
        applyingRef.current = false;
        setTimeout(() => {
          skipAutosaveRef.current = false;
        }, 50);
      });
    },
    [onApply],
  );

  useEffect(() => {
    if (defaultAppliedRef.current || !savedViews.length) return;
    const def = savedViews.find((v) => v.isDefault);
    defaultAppliedRef.current = true;
    if (!def) return;
    setActiveId(def.id);
    applySnapshot(snapshotFromSavedView(def));
  }, [savedViews, applySnapshot]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [listUrl] });

  const createMutation = useMutation({
    mutationFn: async (payload: ReturnType<typeof buildPayload>) => {
      const res = await apiRequest("POST", apiBase, payload);
      return (await res.json()) as SavedView;
    },
    onSuccess: (created) => {
      invalidate();
      setCreateOpen(false);
      setName("");
      setIsDefault(false);
      if (created?.id) {
        setTabOrder((prev) => {
          const next = [...prev.filter((id) => id !== created.id), created.id];
          writeTabOrder(entityType, next);
          return next;
        });
        setActiveId(created.id);
        applySnapshot(snapshotFromSavedView(created));
      }
      toast({ title: "Tab created" });
    },
    onError: () => toast({ title: "Failed to create tab", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Record<string, unknown> }) => {
      const res = await apiRequest("PUT", `${apiBase}/${id}`, body);
      return (await res.json()) as SavedView;
    },
    onSuccess: () => invalidate(),
    onError: () => toast({ title: "Failed to update tab", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `${apiBase}/${id}`),
    onSuccess: (_, id) => {
      invalidate();
      setTabOrder((prev) => {
        const next = prev.filter((x) => x !== id);
        writeTabOrder(entityType, next);
        return next;
      });
      if (activeId === id) {
        setActiveId(null);
        applySnapshot({
          filters: [],
          sorts: mainTableSorts,
          columns: current.columns,
          viewMode: "table",
          groupBy: "none",
        });
      }
      toast({ title: "Tab deleted" });
    },
    onError: () => toast({ title: "Failed to delete tab", variant: "destructive" }),
  });

  const busyCreating = createMutation.isPending;
  const busyUpdating = updateMutation.isPending;
  const busyDeleting = deleteMutation.isPending;
  const tabsBusy = busyCreating || busyUpdating || busyDeleting;

  // Infinity: preferences on the active tab persist when you change filter/sort/view/etc.
  useEffect(() => {
    if (activeId == null || skipAutosaveRef.current || applyingRef.current) return;
    const view = savedViews.find((v) => v.id === activeId);
    if (!view) return;
    const nextKey = snapshotKey(current);
    const prevKey = snapshotKey(snapshotFromSavedView(view));
    if (nextKey === prevKey) return;

    const timer = window.setTimeout(() => {
      if (skipAutosaveRef.current || applyingRef.current) return;
      updateMutation.mutate({
        id: activeId,
        body: buildPayload(entityType, view.name, current, !!view.isDefault),
      });
    }, 700);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to current/activeId
  }, [current, activeId, entityType, savedViews]);

  const openCreate = (mode: BoardViewMode) => {
    setCreateViewMode(mode);
    setName(`${VIEW_LABELS[mode]} view`);
    setIsDefault(false);
    setCreateOpen(true);
  };

  const submitCreate = () => {
    if (!name.trim()) {
      toast({ title: "Enter a tab name", variant: "destructive" });
      return;
    }
    // New tab starts from master data (no filters) with the chosen view type — Infinity behaviour.
    const snapshot: BoardViewSnapshot = {
      filters: [],
      sorts: mainTableSorts,
      columns: current.columns,
      viewMode: createViewMode,
      groupBy: "none",
    };
    createMutation.mutate(buildPayload(entityType, name, snapshot, isDefault));
  };

  const openRename = (view: SavedView) => {
    setRenameId(view.id);
    setRenameName(view.name);
    setRenameOpen(true);
  };

  const submitRename = () => {
    if (!renameId || !renameName.trim()) {
      toast({ title: "Enter a tab name", variant: "destructive" });
      return;
    }
    updateMutation.mutate(
      { id: renameId, body: { name: renameName.trim() } },
      {
        onSuccess: () => {
          setRenameOpen(false);
          setRenameId(null);
          toast({ title: "Tab renamed" });
        },
      },
    );
  };

  const duplicateView = (view: SavedView) => {
    const snap = snapshotFromSavedView(view);
    createMutation.mutate(
      buildPayload(entityType, `${view.name} copy`, snap, false),
    );
  };

  const reorderTabs = (fromId: number, toId: number) => {
    if (fromId === toId) return;
    setTabOrder((prev) => {
      const ids = orderedViews.map((v) => v.id);
      const from = ids.indexOf(fromId);
      const to = ids.indexOf(toId);
      if (from < 0 || to < 0) return prev;
      const next = [...ids];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      writeTabOrder(entityType, next);
      return next;
    });
  };

  return (
    <>
      <div
        className="flex items-center gap-0.5 overflow-x-auto border-b border-border pb-0"
        data-testid="board-saved-view-tabs"
        aria-busy={viewsLoading || tabsBusy || undefined}
      >
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 h-8 px-3 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
            activeId === null
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
          disabled={tabsBusy}
          onClick={() => {
            setActiveId(null);
            applySnapshot({
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

        {viewsLoading ? (
          <div
            className="inline-flex items-center gap-2 h-8 px-2 text-[12px] text-muted-foreground"
            data-testid="board-view-tabs-loading"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading views…
            <span className="inline-flex gap-1.5 ml-1">
              <span className="h-5 w-16 rounded bg-muted animate-pulse" />
              <span className="h-5 w-14 rounded bg-muted animate-pulse" />
            </span>
          </div>
        ) : (
          orderedViews.map((view) => {
          const snap = snapshotFromSavedView(view);
          const mode = (snap.viewMode as BoardViewMode) || "table";
          const Icon = VIEW_ICONS[mode] || Table2;
          const isActive = activeId === view.id;
          return (
            <div
              key={view.id}
              draggable={!tabsBusy}
              onDragStart={(e) => {
                if (tabsBusy) return;
                setDragTabId(view.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(view.id));
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragTabId != null && dragTabId !== view.id) setDragOverTabId(view.id);
              }}
              onDragLeave={() => {
                if (dragOverTabId === view.id) setDragOverTabId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = Number(e.dataTransfer.getData("text/plain") || dragTabId);
                if (Number.isFinite(from)) reorderTabs(from, view.id);
                setDragTabId(null);
                setDragOverTabId(null);
              }}
              onDragEnd={() => {
                setDragTabId(null);
                setDragOverTabId(null);
              }}
              className={cn(
                "group inline-flex items-center gap-0.5 h-8 border-b-2 -mb-px whitespace-nowrap",
                isActive ? "border-primary" : "border-transparent",
                dragOverTabId === view.id && "bg-primary/10",
                dragTabId === view.id && "opacity-50",
                tabsBusy && "opacity-70",
              )}
            >
              <GripVertical className="h-3 w-3 text-muted-foreground/40 opacity-0 group-hover:opacity-100 cursor-grab shrink-0 ml-0.5" />
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 px-1.5 text-[13px] font-medium",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
                disabled={tabsBusy}
                onClick={() => {
                  setActiveId(view.id);
                  applySnapshot(snap);
                }}
                data-testid={`board-view-tab-${view.id}`}
              >
                <Icon className="h-3.5 w-3.5 opacity-70" />
                {view.name}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={tabsBusy}
                    className="opacity-0 group-hover:opacity-100 h-5 w-5 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-muted mr-0.5 disabled:opacity-40"
                    title="Tab options"
                    data-testid={`board-view-tab-menu-${view.id}`}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  <DropdownMenuItem className="gap-2" disabled={tabsBusy} onClick={() => openRename(view)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2" disabled={tabsBusy} onClick={() => duplicateView(view)}>
                    {busyCreating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2 text-destructive focus:text-destructive"
                    disabled={tabsBusy}
                    onClick={() => deleteMutation.mutate(view.id)}
                  >
                    {busyDeleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })
        )}

        {(busyUpdating || (viewsFetching && !viewsLoading)) && (
          <span
            className="inline-flex items-center gap-1 h-8 px-2 text-[11px] text-muted-foreground whitespace-nowrap"
            data-testid="board-view-tabs-saving"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            {busyUpdating ? "Saving…" : "Updating…"}
          </span>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={tabsBusy || viewsLoading}
              className="inline-flex items-center gap-1 h-8 px-2.5 text-[13px] font-medium text-primary hover:bg-primary/10 rounded-md ml-1 disabled:opacity-50 disabled:pointer-events-none"
              data-testid="button-add-view-tab"
            >
              {busyCreating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              {busyCreating ? "Creating…" : "Add view"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {viewModes.map((mode) => {
              const Icon = VIEW_ICONS[mode] || Table2;
              return (
                <DropdownMenuItem
                  key={mode}
                  className="gap-2"
                  disabled={tabsBusy}
                  onClick={() => openCreate(mode)}
                  data-testid={`board-add-view-${mode}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {VIEW_LABELS[mode] || mode}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <FormDialogShell
        open={createOpen}
        onOpenChange={(open) => {
          if (createMutation.isPending) return;
          setCreateOpen(open);
        }}
        title="New tab"
        subtitle={`Creates a ${VIEW_LABELS[createViewMode] || createViewMode} tab on the master table`}
        saveLabel="Create"
        onCancel={() => {
          if (createMutation.isPending) return;
          setCreateOpen(false);
        }}
        onSubmit={submitCreate}
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
              placeholder="e.g. High priority"
              autoFocus
              data-testid="input-view-tab-name"
            />
          </div>
          <div className="text-[12px] text-muted-foreground">
            View type: <span className="font-medium text-foreground">{VIEW_LABELS[createViewMode]}</span>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isDefault} onCheckedChange={(v) => setIsDefault(v === true)} />
            Set as default
          </label>
        </div>
      </FormDialogShell>

      <FormDialogShell
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Rename tab"
        saveLabel="Save"
        onCancel={() => setRenameOpen(false)}
        onSubmit={submitRename}
        saving={updateMutation.isPending}
        disabled={!renameName.trim()}
        size="sm"
        saveTestId="button-confirm-rename-view-tab"
      >
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            autoFocus
            data-testid="input-rename-view-tab"
          />
        </div>
      </FormDialogShell>
    </>
  );
}
