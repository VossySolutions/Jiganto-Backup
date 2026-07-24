import { useCallback, useMemo, useState } from "react";
import type {
  BoardFilterRule,
  BoardSortRule,
  BoardViewMode,
  BoardViewSnapshot,
} from "@/lib/board-filters";
import { BOARD_VIEW_MODES } from "@/lib/board-filters";
import { loadColumnVisibility, saveColumnVisibility } from "@/lib/crm-list-columns";
import type { BoardColumnMenuItem } from "@/components/board/BoardColumnsMenu";

type ColDef = { id: string; label: string };

/**
 * Shared board chrome state used by MondayBoardShell consumers (Leads parity).
 */
export function useMondayBoardShellState(opts: {
  storageKey: string;
  columnDefs: ColDef[];
  defaultSortField?: string;
  /** Default sort direction for the primary rule (Opportunities/Leads: desc; name lists: asc). */
  defaultSortDir?: "asc" | "desc";
  defaultGroupBy?: string;
  viewModeStorageKey?: string;
  pinStorageKey?: string;
  pinDefault?: boolean;
}) {
  const {
    storageKey,
    columnDefs,
    defaultSortField = "created",
    defaultSortDir = "desc",
    defaultGroupBy = "none",
    viewModeStorageKey = `${storageKey}-view-mode`,
    pinStorageKey = `${storageKey}-pin`,
    pinDefault = true,
  } = opts;

  const [localSearch, setLocalSearch] = useState("");
  const [filterRules, setFilterRules] = useState<BoardFilterRule[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortRules, setSortRules] = useState<BoardSortRule[]>([
    { field: defaultSortField, dir: defaultSortDir },
  ]);
  const [groupBy, setGroupBy] = useState(defaultGroupBy);
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [viewMode, setViewMode] = useState<BoardViewMode>(() => {
    if (typeof window === "undefined") return "table";
    const stored = localStorage.getItem(viewModeStorageKey) as BoardViewMode | null;
    return stored && BOARD_VIEW_MODES.includes(stored) ? stored : "table";
  });
  const [pinActive, setPinActive] = useState(() => {
    if (typeof window === "undefined") return pinDefault;
    return localStorage.getItem(pinStorageKey) !== "0";
  });
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() =>
    loadColumnVisibility(storageKey, columnDefs),
  );
  const [columnOrderIds, setColumnOrderIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(`${storageKey}-column-order`);
      if (!raw) return columnDefs.map((c) => c.id);
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((n: unknown) => typeof n === "string") : columnDefs.map((c) => c.id);
    } catch {
      return columnDefs.map((c) => c.id);
    }
  });

  const setViewModePersist = useCallback(
    (mode: BoardViewMode) => {
      setViewMode(mode);
      localStorage.setItem(viewModeStorageKey, mode);
    },
    [viewModeStorageKey],
  );

  const togglePin = useCallback(() => {
    setPinActive((v) => {
      const next = !v;
      localStorage.setItem(pinStorageKey, next ? "1" : "0");
      return next;
    });
  }, [pinStorageKey]);

  const isColVisible = useCallback(
    (id: string) => columnVisibility[id] !== false,
    [columnVisibility],
  );

  const setColVisible = useCallback(
    (id: string, visible: boolean) => {
      setColumnVisibility((prev) => {
        const next = { ...prev, [id]: visible };
        saveColumnVisibility(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const moveColumn = useCallback(
    (id: string, direction: -1 | 1) => {
      setColumnOrderIds((prev) => {
        const ids = prev.length ? [...prev] : columnDefs.map((c) => c.id);
        let idx = ids.indexOf(id);
        if (idx < 0) {
          ids.push(id);
          idx = ids.length - 1;
        }
        const nextIdx = idx + direction;
        if (nextIdx < 0 || nextIdx >= ids.length) return ids;
        const tmp = ids[idx];
        ids[idx] = ids[nextIdx];
        ids[nextIdx] = tmp;
        localStorage.setItem(`${storageKey}-column-order`, JSON.stringify(ids));
        return ids;
      });
    },
    [columnDefs, storageKey],
  );

  const onSortToggle = useCallback((field: string) => {
    setSortRules((prev) => {
      const existing = prev.find((r) => r.field === field);
      if (existing) {
        if (existing.dir === "desc") {
          return prev.map((r) => (r.field === field ? { ...r, dir: "asc" as const } : r));
        }
        return prev.filter((r) => r.field !== field);
      }
      return [...prev, { field, dir: "desc" }];
    });
  }, []);

  const onSortAdd = useCallback((field: string) => {
    setSortRules((prev) => (prev.some((r) => r.field === field) ? prev : [...prev, { field, dir: "desc" }]));
  }, []);

  const onSortRemove = useCallback((field: string) => {
    setSortRules((prev) => prev.filter((r) => r.field !== field));
  }, []);

  const columnMenuItems: BoardColumnMenuItem[] = useMemo(() => {
    const order = columnOrderIds.length ? columnOrderIds : columnDefs.map((c) => c.id);
    const byId = new Map(columnDefs.map((c) => [c.id, c]));
    const ordered = order.map((id) => byId.get(id)).filter(Boolean) as ColDef[];
    const rest = columnDefs.filter((c) => !order.includes(c.id));
    return [...ordered, ...rest].map((c) => ({
      id: c.id,
      label: c.label,
      visible: columnVisibility[c.id] !== false,
      kind: "builtin" as const,
    }));
  }, [columnDefs, columnOrderIds, columnVisibility]);

  const viewSnapshot: BoardViewSnapshot = useMemo(
    () => ({
      filters: filterRules,
      sorts: sortRules,
      columns: columnMenuItems.map((c, order) => ({
        id: c.id,
        header: c.label,
        visible: c.visible,
        order,
      })),
      viewMode,
      groupBy,
    }),
    [filterRules, sortRules, columnMenuItems, viewMode, groupBy],
  );

  const applyViewSnapshot = useCallback(
    (snap: BoardViewSnapshot) => {
      setFilterRules(Array.isArray(snap.filters) ? (snap.filters as BoardFilterRule[]) : []);
      if (snap.sorts?.length) {
        setSortRules(
          snap.sorts.map((s: any) => ({
            field: s.field || s.columnId || defaultSortField,
            dir: (s.dir || s.direction || "desc") as "asc" | "desc",
          })),
        );
      } else {
        setSortRules([{ field: defaultSortField, dir: defaultSortDir }]);
      }
      if (snap.columns?.length) {
        const vis: Record<string, boolean> = {};
        for (const c of snap.columns) vis[c.id] = c.visible;
        setColumnVisibility(vis);
        saveColumnVisibility(storageKey, vis);
        const ordered = [...snap.columns].sort((a, b) => a.order - b.order).map((c) => c.id);
        setColumnOrderIds(ordered);
        localStorage.setItem(`${storageKey}-column-order`, JSON.stringify(ordered));
      }
      if (snap.viewMode && BOARD_VIEW_MODES.includes(snap.viewMode as BoardViewMode)) {
        setViewModePersist(snap.viewMode as BoardViewMode);
      }
      if (snap.groupBy != null) setGroupBy(snap.groupBy);
    },
    [defaultSortField, defaultSortDir, storageKey, setViewModePersist],
  );

  return {
    localSearch,
    setLocalSearch,
    filterRules,
    setFilterRules,
    filterOpen,
    setFilterOpen,
    sortRules,
    setSortRules,
    onSortToggle,
    onSortAdd,
    onSortRemove,
    groupBy,
    setGroupBy,
    ownerFilter,
    setOwnerFilter,
    viewMode,
    setViewModePersist,
    pinActive,
    togglePin,
    columnVisibility,
    isColVisible,
    setColVisible,
    moveColumn,
    columnMenuItems,
    columnOrderIds,
    viewSnapshot,
    applyViewSnapshot,
  };
}
