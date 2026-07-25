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

/** Normalize API / blob sorts ({field,dir} or {columnId,direction}) to BoardSortRule. */
function normalizeSorts(raw: unknown): BoardSortRule[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => {
      const row = s as {
        field?: string;
        columnId?: string;
        dir?: string;
        direction?: string;
      };
      const field = row.field || row.columnId;
      if (!field) return null;
      const dir = (row.dir || row.direction || "desc") === "asc" ? "asc" : "desc";
      return { field, dir } as BoardSortRule;
    })
    .filter(Boolean) as BoardSortRule[];
}

function snapshotFromSavedView(view: SavedView): BoardViewSnapshot {
  const decoded = decodeBoardViewFilters(view.filters);
  const sorts =
    normalizeSorts(decoded.sorts).length > 0
      ? normalizeSorts(decoded.sorts)
      : normalizeSorts(view.sorts);
  const columns = Array.isArray(view.columns)
    ? (view.columns as BoardViewSnapshot["columns"])
    : [];
  return {
    filters: decoded.rules as BoardFilterRule[],
    sorts,
    columns,
    viewMode: decoded.viewMode || "table",
    groupBy: decoded.groupBy || "none",
  };
}

function buildPayload(
  entityType: string,
  name: string,
  snapshot: BoardViewSnapshot,
  isDefault: boolean,
) {
  const sorts = normalizeSorts(snapshot.sorts || []);
  return {
    entityType,
    name: name.trim(),
    filters: encodeBoardViewFilters({
      rules: snapshot.filters || [],
      viewMode: snapshot.viewMode || "table",
      groupBy: snapshot.groupBy || "none",
      sorts,
    }),
    // Keep field/dir so decode + snapshotKey stay stable (avoid autosave loops).
    sorts: sorts.map((s) => ({ field: s.field, dir: s.dir, columnId: s.field, direction: s.dir })),
    columns: snapshot.columns || [],
    isDefault,
    isShared: false,
  };
}

function snapshotKey(snapshot: BoardViewSnapshot) {
  return JSON.stringify({
    filters: snapshot.filters || [],
    sorts: normalizeSorts(snapshot.sorts || []),
    columns: snapshot.columns || [],
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
  const [autosaving, setAutosaving] = useState(false);
  const { toast } = useToast();
  const defaultAppliedRef = useRef(false);
  const skipAutosaveUntilRef = useRef(0);
  const lastSavedKeyRef = useRef<string>("");
  const listUrl = `${apiBase}?entityType=${entityType}`;

  const { data: savedViews = [], isLoading: viewsLoading, isError: viewsError, refetch: refetchViews } =
    useQuery<SavedView[]>({
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
    lastSavedKeyRef.current = "";
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
      skipAutosaveUntilRef.current = Date.now() + 400;
      lastSavedKeyRef.current = snapshotKey(snapshot);
      onApply(snapshot);
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

  const patchCache = (view: SavedView) => {
    queryClient.setQueryData<SavedView[]>([listUrl], (old) => {
      if (!Array.isArray(old)) return old;
      const idx = old.findIndex((v) => v.id === view.id);
      if (idx < 0) return [...old, view];
      const next = [...old];
      next[idx] = { ...old[idx], ...view };
      return next;
    });
  };

  const createMutation = useMutation({
    mutationFn: async (payload: ReturnType<typeof buildPayload>) => {
      const res = await apiRequest("POST", apiBase, payload);
      return (await res.json()) as SavedView;
    },
    onSuccess: (created) => {
      if (created?.id) {
        patchCache(created);
        setTabOrder((prev) => {
          const next = [...prev.filter((id) => id !== created.id), created.id];
          writeTabOrder(entityType, next);
          return next;
        });
        setActiveId(created.id);
        applySnapshot(snapshotFromSavedView(created));
      }
      setCreateOpen(false);
      setName("");
      setIsDefault(false);
      toast({ title: "Tab created" });
    },
    onError: () => toast({ title: "Failed to create tab", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      body,
      mode,
    }: {
      id: number;
      body: Record<string, unknown>;
      mode: "autosave" | "rename";
    }) => {
      const res = await apiRequest("PUT", `${apiBase}/${id}`, body);
      const updated = (await res.json()) as SavedView;
      return { updated, mode };
    },
    onMutate: ({ mode }) => {
      if (mode === "autosave") setAutosaving(true);
    },
    onSuccess: ({ updated, mode }) => {
      patchCache(updated);
      if (mode === "rename") {
        setRenameOpen(false);
        setRenameId(null);
        toast({ title: "Tab renamed" });
      } else {
        lastSavedKeyRef.current = snapshotKey(snapshotFromSavedView(updated));
      }
    },
    onError: (_err, vars) => {
      toast({
        title: vars.mode === "rename" ? "Failed to rename tab" : "Failed to save tab",
        variant: "destructive",
      });
    },
    onSettled: (_data, _err, vars) => {
      if (vars.mode === "autosave") setAutosaving(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `${apiBase}/${id}`),
    onSuccess: (_, id) => {
      queryClient.setQueryData<SavedView[]>([listUrl], (old) =>
        Array.isArray(old) ? old.filter((v) => v.id !== id) : old,
      );
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

  // Blocking busy: only create / rename / delete — never autosave (that was locking the tab bar).
  const busyCreating = createMutation.isPending;
  const busyRenaming = updateMutation.isPending && updateMutation.variables?.mode === "rename";
  const busyDeleting = deleteMutation.isPending;
  const tabsBusy = busyCreating || busyRenaming || busyDeleting;

  // Infinity: preferences on the active tab persist when you change filter/sort/view/etc.
  useEffect(() => {
    if (activeId == null) return;
    if (Date.now() < skipAutosaveUntilRef.current) return;
    if (updateMutation.isPending || createMutation.isPending) return;

    const view = savedViews.find((v) => v.id === activeId);
    if (!view) return;

    const nextKey = snapshotKey(current);
    const baseline =
      lastSavedKeyRef.current || snapshotKey(snapshotFromSavedView(view));
    if (nextKey === baseline) return;

    const timer = window.setTimeout(() => {
      if (Date.now() < skipAutosaveUntilRef.current) return;
      if (updateMutation.isPending) return;
      lastSavedKeyRef.current = nextKey;
      updateMutation.mutate({
        id: activeId,
        body: buildPayload(entityType, view.name, current, !!view.isDefault),
        mode: "autosave",
      });
    }, 700);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (busyCreating) return;
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
    if (busyRenaming) return;
    updateMutation.mutate({
      id: renameId,
      body: { name: renameName.trim() },
      mode: "rename",
    });
  };

  const duplicateView = (view: SavedView) => {
    if (tabsBusy) return;
    const snap = snapshotFromSavedView(view);
    createMutation.mutate(buildPayload(entityType, `${view.name} copy`, snap, false));
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
        aria-busy={viewsLoading || tabsBusy || autosaving || undefined}
      >
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 h-8 px-3 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
            activeId === null
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
            tabsBusy && "opacity-60",
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
            <span className="inline-flex gap-1.5 ml-1" aria-hidden>
              <span className="h-5 w-16 rounded bg-muted animate-pulse" />
              <span className="h-5 w-14 rounded bg-muted animate-pulse" />
            </span>
          </div>
        ) : viewsError ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 h-8 px-2 text-[12px] text-destructive hover:underline"
            onClick={() => refetchViews()}
            data-testid="board-view-tabs-retry"
          >
            Failed to load views — Retry
          </button>
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
                    <DropdownMenuItem
                      className="gap-2"
                      disabled={tabsBusy}
                      onClick={() => openRename(view)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="gap-2"
                      disabled={tabsBusy}
                      onClick={() => duplicateView(view)}
                    >
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

        {autosaving && (
          <span
            className="inline-flex items-center gap-1 h-8 px-2 text-[11px] text-muted-foreground whitespace-nowrap"
            data-testid="board-view-tabs-saving"
          >
            <Loader2 className="h-3 w-3 animate-spin" />
            Saving…
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
          if (busyCreating) return;
          setCreateOpen(open);
        }}
        title="New tab"
        subtitle={`Creates a ${VIEW_LABELS[createViewMode] || createViewMode} tab on the master table`}
        saveLabel={busyCreating ? "Creating…" : "Create"}
        onCancel={() => {
          if (busyCreating) return;
          setCreateOpen(false);
        }}
        onSubmit={submitCreate}
        saving={busyCreating}
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
              disabled={busyCreating}
              data-testid="input-view-tab-name"
            />
          </div>
          <div className="text-[12px] text-muted-foreground">
            View type:{" "}
            <span className="font-medium text-foreground">{VIEW_LABELS[createViewMode]}</span>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={isDefault}
              disabled={busyCreating}
              onCheckedChange={(v) => setIsDefault(v === true)}
            />
            Set as default
          </label>
        </div>
      </FormDialogShell>

      <FormDialogShell
        open={renameOpen}
        onOpenChange={(open) => {
          if (busyRenaming) return;
          setRenameOpen(open);
        }}
        title="Rename tab"
        saveLabel={busyRenaming ? "Saving…" : "Save"}
        onCancel={() => {
          if (busyRenaming) return;
          setRenameOpen(false);
        }}
        onSubmit={submitRename}
        saving={busyRenaming}
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
            disabled={busyRenaming}
            data-testid="input-rename-view-tab"
          />
        </div>
      </FormDialogShell>
    </>
  );
}
