import React, { useState, useRef, useEffect, useMemo } from "react";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { TablePagination } from "@/components/TablePagination";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { getSelectColors, getSelectChoices } from "@/lib/selectColors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  FormDialogShell,
  FormSection,
} from "@/components/ui/form-dialog-shell";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Plus,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  FileText,
  Trash2,
  Search,
  Table,
  List,
  LayoutGrid,
  Calendar,
  Columns,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Filter,
  X,
  GripVertical,
  Check,
  Type,
  Tag,
  CalendarDays,
  CheckSquare,
  User,
  Link2,
  Hash,
  Copy,
  ArrowUpFromLine,
  ArrowDownFromLine,
  CircleDot,
  Star,
  Maximize2,
  Minimize2,
  Pencil,
  ClipboardList,
  Loader2,
  Layers,
  Eye,
  Save,
  ArrowLeftFromLine,
  ArrowRightFromLine,
  FileSpreadsheet,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calendar as CalendarWidget } from "@/components/ui/calendar";
import { format } from "date-fns";
import type {
  WorkspaceDatabaseColumn,
  WorkspaceDatabaseRow,
  WorkspaceSavedView,
} from "@shared/schema";
import { DATABASE_TEMPLATES, TEMPLATE_CATEGORIES, type DatabaseTemplate } from "@/lib/workspaceTemplates";
import { WorkspaceKanbanView } from "./WorkspaceKanbanView";
import { WorkspaceCalendarView } from "./WorkspaceCalendarView";
import { WorkspaceRowDetailPanel } from "./WorkspaceRowDetailPanel";
import { combineWorkspaceQueries, WorkspaceQueryShell } from "./loading";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const TEMPLATE_ICONS: Record<string, React.ElementType> = {
  "clipboard-list": ClipboardList,
  "layout-dashboard": LayoutGrid,
  "message-square": FileText,
  "book-open": FileText,
  "alert-triangle": FileText,
  "shield": FileText,
  "file-check": FileText,
  "flag": FileText,
  "bar-chart-3": FileText,
  "users": User,
  "target": FileText,
  "lightbulb": FileText,
  "briefcase": FileText,
};

const CATEGORY_COLORS: Record<string, string> = {
  "Project Management": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  "Governance": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "Business": "bg-green-500/10 text-green-600 dark:text-green-400",
  "Strategy": "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

const COLUMN_TYPES = [
  { type: "text", label: "Text", icon: Type },
  { type: "long_text", label: "Long Text", icon: Type },
  { type: "number", label: "Number", icon: Hash },
  { type: "select", label: "Select", icon: Tag },
  { type: "multi_select", label: "Multi Select", icon: Tag },
  { type: "rating", label: "Rating", icon: Star },
  { type: "date", label: "Date", icon: CalendarDays },
  { type: "created_date", label: "Created Date", icon: CalendarDays },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare },
  { type: "person", label: "Person", icon: User },
  { type: "url", label: "URL", icon: Link2 },
  { type: "rag", label: "RAG Status", icon: CircleDot },
];

interface FilterRule {
  id: string;
  columnId: number;
  operator: string;
  value: string;
}

function SavedViewsStrip({
  databaseId,
  activeViewConfig,
  onApplyView,
}: {
  databaseId: number;
  activeViewConfig: {
    viewType: string;
    sortColumn: number | null;
    sortDirection: string;
    secondarySortColumn?: number | null;
    secondarySortDirection?: string;
    groupByColumn: number | null;
    filterRules: FilterRule[];
  };
  onApplyView: (config: any) => void;
  onSaveView?: () => void;
}) {
  const [activeViewId, setActiveViewId] = useState<number | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newViewName, setNewViewName] = useState("");

  const { data: savedViews = [] } = useQuery<WorkspaceSavedView[]>({
    queryKey: ["/api/workspace-databases", databaseId, "views"],
  });

  const createViewMutation = useMutation({
    mutationFn: (data: { name: string; viewType: string; config: any }) =>
      apiRequest("POST", `/api/workspace-databases/${databaseId}/views`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/workspace-databases", databaseId, "views"],
      });
      setShowSaveDialog(false);
      setNewViewName("");
    },
  });

  const deleteViewMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/workspace-saved-views/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/workspace-databases", databaseId, "views"],
      });
      if (activeViewId) setActiveViewId(null);
    },
  });

  const handleSaveCurrentView = () => {
    if (!newViewName.trim()) return;
    createViewMutation.mutate({
      name: newViewName.trim(),
      viewType: activeViewConfig.viewType,
      config: {
        sortColumn: activeViewConfig.sortColumn,
        sortDirection: activeViewConfig.sortDirection,
        secondarySortColumn: activeViewConfig.secondarySortColumn ?? null,
        secondarySortDirection: activeViewConfig.secondarySortDirection ?? "asc",
        groupByColumn: activeViewConfig.groupByColumn,
        filterRules: activeViewConfig.filterRules,
      },
    });
  };

  const handleApplyView = (view: WorkspaceSavedView) => {
    setActiveViewId(view.id);
    const config = (view.config as any) || {};
    onApplyView({
      viewType: view.viewType || "table",
      sortColumn: config.sortColumn ?? null,
      sortDirection: config.sortDirection ?? "asc",
      secondarySortColumn: config.secondarySortColumn ?? null,
      secondarySortDirection: config.secondarySortDirection ?? "asc",
      groupByColumn: config.groupByColumn ?? null,
      filterRules: config.filterRules ?? [],
    });
  };

  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted/20 overflow-x-auto" data-testid="saved-views-strip">
      <button
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium whitespace-nowrap",
          activeViewId === null ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
        )}
        onClick={() => {
          setActiveViewId(null);
          onApplyView({
            viewType: "table",
            sortColumn: null,
            sortDirection: "asc",
            groupByColumn: null,
            filterRules: [],
          });
        }}
        data-testid="saved-view-all-items"
      >
        <Table className="h-3 w-3" />
        All Items
      </button>
      {savedViews.map((view) => (
        <div
          key={view.id}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium whitespace-nowrap group",
            activeViewId === view.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
          )}
        >
          <button
            onClick={() => handleApplyView(view)}
            className="flex items-center gap-1"
            data-testid={`saved-view-${view.id}`}
          >
            <Eye className="h-3 w-3" />
            {view.name}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteViewMutation.mutate(view.id);
            }}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10"
            data-testid={`delete-saved-view-${view.id}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      ))}
      <Popover open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <PopoverTrigger asChild>
          <button
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:bg-muted whitespace-nowrap"
            data-testid="save-view-button"
          >
            <Plus className="h-3 w-3" />
            Save View
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" align="start">
          <div className="space-y-2">
            <div className="text-xs font-medium">Save current view</div>
            <Input
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="View name..."
              className="h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveCurrentView();
              }}
              autoFocus
              data-testid="save-view-name-input"
            />
            <Button
              size="sm"
              className="w-full text-xs"
              onClick={handleSaveCurrentView}
              disabled={!newViewName.trim() || createViewMutation.isPending}
              data-testid="confirm-save-view"
            >
              <Save className="h-3 w-3 mr-1" />
              Save
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function FilterPanel({
  columns,
  filterRules,
  onUpdateFilters,
}: {
  columns: WorkspaceDatabaseColumn[];
  filterRules: FilterRule[];
  onUpdateFilters: (rules: FilterRule[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const operators = [
    { value: "is", label: "is" },
    { value: "is_not", label: "is not" },
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "does not contain" },
    { value: "is_empty", label: "is empty" },
    { value: "is_not_empty", label: "is not empty" },
  ];

  const addRule = () => {
    if (columns.length === 0) return;
    onUpdateFilters([
      ...filterRules,
      { id: crypto.randomUUID(), columnId: columns[0].id, operator: "contains", value: "" },
    ]);
  };

  const updateRule = (id: string, field: string, value: any) => {
    onUpdateFilters(
      filterRules.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const removeRule = (id: string) => {
    onUpdateFilters(filterRules.filter((r) => r.id !== id));
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={filterRules.length > 0 ? "secondary" : "ghost"}
            size="sm"
            className="gap-1 text-xs"
            data-testid="filter-panel-trigger"
          >
            <Filter className="h-3.5 w-3.5" />
            Filter
            {filterRules.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">
                {filterRules.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-3" align="start">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Filter rules</span>
              {filterRules.length > 0 && (
                <button
                  onClick={() => onUpdateFilters([])}
                  className="text-xs text-muted-foreground hover:text-foreground"
                  data-testid="clear-all-filters"
                >
                  Clear all
                </button>
              )}
            </div>
            {filterRules.map((rule) => (
              <div key={rule.id} className="flex items-center gap-1" data-testid={`filter-rule-${rule.id}`}>
                <select
                  value={rule.columnId}
                  onChange={(e) => updateRule(rule.id, "columnId", Number(e.target.value))}
                  className="h-7 text-xs border rounded px-1 flex-1 bg-background"
                  data-testid={`filter-column-select-${rule.id}`}
                >
                  {columns.map((col) => (
                    <option key={col.id} value={col.id}>{col.name}</option>
                  ))}
                </select>
                <select
                  value={rule.operator}
                  onChange={(e) => updateRule(rule.id, "operator", e.target.value)}
                  className="h-7 text-xs border rounded px-1 bg-background"
                  data-testid={`filter-operator-select-${rule.id}`}
                >
                  {operators.map((op) => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
                {!["is_empty", "is_not_empty"].includes(rule.operator) && (
                  <Input
                    value={rule.value}
                    onChange={(e) => updateRule(rule.id, "value", e.target.value)}
                    placeholder="Value..."
                    className="h-7 text-xs flex-1"
                    data-testid={`filter-value-input-${rule.id}`}
                  />
                )}
                <button
                  onClick={() => removeRule(rule.id)}
                  className="p-1 rounded hover:bg-destructive/10"
                  data-testid={`remove-filter-rule-${rule.id}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs gap-1"
              onClick={addRule}
              disabled={columns.length === 0}
              data-testid="add-filter-rule"
            >
              <Plus className="h-3 w-3" />
              Add filter rule
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {filterRules.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {filterRules.map((rule) => {
            const col = columns.find((c) => c.id === rule.columnId);
            return (
              <Badge
                key={rule.id}
                variant="secondary"
                className="text-[10px] gap-1 cursor-pointer"
                onClick={() => removeRule(rule.id)}
                data-testid={`filter-chip-${rule.id}`}
              >
                {col?.name} {rule.operator.replace("_", " ")} {rule.value}
                <X className="h-2.5 w-2.5" />
              </Badge>
            );
          })}
        </div>
      )}
    </>
  );
}

function BulkActionsBar({
  selectedCount,
  onDeselectAll,
  onBulkDelete,
  columns,
  onBulkUpdate,
}: {
  selectedCount: number;
  onDeselectAll: () => void;
  onBulkDelete: () => void;
  columns: WorkspaceDatabaseColumn[];
  onBulkUpdate: (colId: number, value: string) => void;
}) {
  if (selectedCount === 0) return null;

  const selectColumns = columns.filter((c) => c.type === "select" || c.type === "rag");

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-foreground text-background px-4 py-2.5 rounded-lg shadow-lg" data-testid="bulk-actions-bar">
      <span className="text-sm font-medium">{selectedCount} selected</span>
      <div className="w-px h-5 bg-background/20" />
      {selectColumns.slice(0, 2).map((col) => (
        <DropdownMenu key={col.id}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs text-background hover:bg-background/10" data-testid={`bulk-update-${col.id}`}>
              Set {col.name}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {col.type === "rag" ? (
              ["green", "amber", "red"].map((val) => (
                <DropdownMenuItem key={val} onClick={() => onBulkUpdate(col.id, val)} data-testid={`bulk-rag-${val}`}>
                  <span className={cn("h-3 w-3 rounded-full mr-2", val === "green" ? "bg-green-500" : val === "amber" ? "bg-amber-500" : "bg-red-500")} />
                  {val.charAt(0).toUpperCase() + val.slice(1)}
                </DropdownMenuItem>
              ))
            ) : (
              getSelectChoices(col.options).map((choice: string) => (
                <DropdownMenuItem key={choice} onClick={() => onBulkUpdate(col.id, choice)} data-testid={`bulk-choice-${choice}`}>
                  {choice}
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-destructive hover:bg-destructive/10"
        onClick={onBulkDelete}
        data-testid="bulk-delete-button"
      >
        <Trash2 className="h-3 w-3 mr-1" />
        Delete
      </Button>
      <div className="w-px h-5 bg-background/20" />
      <button onClick={onDeselectAll} className="text-xs text-background/60 hover:text-background" data-testid="bulk-deselect-all">
        Deselect all
      </button>
    </div>
  );
}

export function WorkspaceTableView({
  databaseId,
  isExpanded,
  onToggleExpand,
  readOnly = false,
}: {
  databaseId: number;
  workspaceId: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  readOnly?: boolean;
}) {
  const [sortColumn, setSortColumn] = useState<number | null>(null);
  const [secondarySortColumn, setSecondarySortColumn] = useState<number | null>(null);
  const [secondarySortDirection, setSecondarySortDirection] = useState<"asc" | "desc">("asc");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCell, setEditingCell] = useState<{ rowId: number; colId: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [activeView, setActiveView] = useState<string>("table");
  const [detailRowId, setDetailRowId] = useState<number | null>(null);
  const [hiddenColumnIds, setHiddenColumnIds] = useState<Set<number>>(new Set());
  const [addingColumnInline, setAddingColumnInline] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnType, setNewColumnType] = useState("text");
  const [columnTypeStep, setColumnTypeStep] = useState(false);
  const [editingColumnId, setEditingColumnId] = useState<number | null>(null);
  const [editingColumnName, setEditingColumnName] = useState("");
  const [showInlineTemplateDialog, setShowInlineTemplateDialog] = useState(false);
  const [inlineTemplateSearch, setInlineTemplateSearch] = useState("");
  const [inlineTemplateCategory, setInlineTemplateCategory] = useState<string | null>(null);
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);
  const [groupByColumn, setGroupByColumn] = useState<number | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [draggedColId, setDraggedColId] = useState<number | null>(null);
  const [dragOverColId, setDragOverColId] = useState<number | null>(null);
  const newColumnInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const lastPersistedViewRef = useRef<string | null>(null);

  const columnsQuery = useQuery<WorkspaceDatabaseColumn[]>({
    queryKey: ["/api/workspace-databases", databaseId, "columns"],
  });
  const rowsQuery = useQuery<WorkspaceDatabaseRow[]>({
    queryKey: ["/api/workspace-databases", databaseId, "rows"],
  });
  const { data: orgUsers = [] } = useQuery<{ id: string; firstName?: string | null; lastName?: string | null; displayName?: string | null }[]>({
    queryKey: ["/api/chat/users"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/chat/users");
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 60_000,
  });
  const columns = columnsQuery.data ?? [];
  const rows = rowsQuery.data ?? [];
  const tableDataQuery = combineWorkspaceQueries(columnsQuery, rowsQuery);

  const { data: databaseMeta } = useQuery<{ id: number; activeView?: string } | null>({
    queryKey: ["/api/workspace-databases", databaseId],
    queryFn: async () => {
      const res = await fetchWithAuth(`/api/workspace-databases/${databaseId}`);
      if (!res.ok) return null;
      return res.json();
    },
  });

  const addColumnMutation = useMutation({
    mutationFn: (data: { name: string; type: string }) => {
      const maxSort = columns.length > 0 ? Math.max(...columns.map((c) => c.sortOrder ?? 0)) : -1;
      return apiRequest("POST", `/api/workspace-databases/${databaseId}/columns`, { ...data, sortOrder: maxSort + 1 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-databases", databaseId, "columns"] });
      setAddingColumnInline(false);
      setNewColumnName("");
      setNewColumnType("text");
      setColumnTypeStep(false);
    },
  });

  const updateColumnMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      apiRequest("PATCH", `/api/workspace-database-columns/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-databases", databaseId, "columns"] });
      setEditingColumnId(null);
      setEditingColumnName("");
    },
  });

  const updateDatabaseMutation = useMutation({
    mutationFn: (data: { activeView: string }) =>
      apiRequest("PATCH", `/api/workspace-databases/${databaseId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-databases", databaseId] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-pages"] });
    },
  });

  const moveColumn = (colId: number, direction: "left" | "right") => {
    const idx = columns.findIndex((c) => c.id === colId);
    if (idx < 0) return;
    const swapIdx = direction === "left" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= columns.length) return;
    const a = columns[idx];
    const b = columns[swapIdx];
    const aOrder = a.sortOrder ?? idx;
    const bOrder = b.sortOrder ?? swapIdx;
    Promise.all([
      apiRequest("PATCH", `/api/workspace-database-columns/${a.id}`, { sortOrder: bOrder }),
      apiRequest("PATCH", `/api/workspace-database-columns/${b.id}`, { sortOrder: aOrder }),
    ]).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-databases", databaseId, "columns"] });
    });
  };

  const handleColDragStart = (e: React.DragEvent, colId: number) => {
    setDraggedColId(colId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(colId));
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleColDragOver = (e: React.DragEvent, colId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (colId !== draggedColId) setDragOverColId(colId);
  };

  const handleColDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setDraggedColId(null);
    setDragOverColId(null);
  };

  const handleColDrop = (e: React.DragEvent, targetColId: number) => {
    e.preventDefault();
    if (draggedColId === null || draggedColId === targetColId) {
      setDraggedColId(null);
      setDragOverColId(null);
      return;
    }
    const reordered = [...columns];
    const fromIdx = reordered.findIndex((c) => c.id === draggedColId);
    const toIdx = reordered.findIndex((c) => c.id === targetColId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const updates = reordered.map((c, i) =>
      apiRequest("PATCH", `/api/workspace-database-columns/${c.id}`, { sortOrder: i })
    );
    Promise.all(updates).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-databases", databaseId, "columns"] });
    });
    setDraggedColId(null);
    setDragOverColId(null);
  };

  const addRowMutation = useMutation({
    mutationFn: () => {
      const maxSort = rows.length > 0 ? Math.max(...rows.map((r) => r.sortOrder || 0)) : -1;
      return apiRequest("POST", `/api/workspace-databases/${databaseId}/rows`, { data: {}, sortOrder: maxSort + 1 });
    },
    onSuccess: (newRow: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-databases", databaseId, "rows"] });
      if (visibleColumns.length > 0) {
        setTimeout(() => {
          const rowId = newRow?.id;
          if (rowId) {
            setEditingCell({ rowId, colId: visibleColumns[0].id });
            setEditValue("");
          }
        }, 100);
      }
    },
  });

  const duplicateRowMutation = useMutation({
    mutationFn: (sourceRow: WorkspaceDatabaseRow) => {
      const maxSort = rows.length > 0 ? Math.max(...rows.map((r) => r.sortOrder || 0)) : 0;
      return apiRequest("POST", `/api/workspace-databases/${databaseId}/rows`, { data: sourceRow.data || {}, sortOrder: maxSort + 1 });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-databases", databaseId, "rows"] }),
  });

  const updateRowMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/workspace-database-rows/${id}`, { data }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-databases", databaseId, "rows"] }),
  });

  const deleteRowMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/workspace-database-rows/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-databases", databaseId, "rows"] }),
  });

  const deleteColumnMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/workspace-database-columns/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-databases", databaseId, "columns"] }),
  });

  const importCsvMutation = useMutation({
    mutationFn: (payload: { rows: Array<Record<string, unknown>>; mode: "append" | "overwrite" }) =>
      apiRequest("POST", `/api/workspace-databases/${databaseId}/import-csv`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-databases", databaseId, "rows"] });
      toast({ title: "CSV imported" });
    },
    onError: () => {
      toast({ title: "CSV import failed", variant: "destructive" });
    },
  });

  const { toast } = useToast();
  const applyTemplateMutation = useMutation({
    mutationFn: (template: DatabaseTemplate) =>
      apiRequest("POST", `/api/workspace-databases/${databaseId}/apply-template`, {
        name: template.name,
        columns: template.columns,
        rows: template.sampleRows,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-databases", databaseId, "columns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-databases", databaseId, "rows"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workspace-pages"] });
      setShowInlineTemplateDialog(false);
      toast({ title: "Template applied to board" });
    },
  });

  const handleCellEdit = (rowId: number, colId: number, value: string) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const rowData = (row.data as Record<string, unknown>) || {};
    const currentVal = String(rowData[String(colId)] || "");
    if (value !== currentVal) {
      updateRowMutation.mutate({ id: rowId, data: { ...rowData, [String(colId)]: value } });
    }
    setEditingCell(null);
  };

  useEffect(() => {
    if (!databaseMeta?.activeView) return;
    setActiveView(databaseMeta.activeView);
    lastPersistedViewRef.current = databaseMeta.activeView;
  }, [databaseMeta?.activeView]);

  useEffect(() => {
    if (!activeView) return;
    if (lastPersistedViewRef.current === null) {
      lastPersistedViewRef.current = activeView;
      return;
    }
    if (lastPersistedViewRef.current !== activeView) {
      lastPersistedViewRef.current = activeView;
      updateDatabaseMutation.mutate({ activeView });
    }
  }, [activeView]);

  useEffect(() => {
    setHiddenColumnIds(new Set(columns.filter((c) => c.isVisible === false).map((c) => c.id)));
  }, [columns]);

  const visibleColumns = useMemo(
    () => columns.filter((col) => col.isVisible !== false),
    [columns],
  );

  const toggleColumnVisibility = (col: WorkspaceDatabaseColumn) => {
    const nextVisible = col.isVisible === false;
    apiRequest("PATCH", `/api/workspace-database-columns/${col.id}`, { isVisible: nextVisible })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/workspace-databases", databaseId, "columns"] });
      })
      .catch(() => {
        toast({ title: "Failed to update column visibility", variant: "destructive" });
      });
  };

  const parseCsvRows = (csvText: string): Array<Record<string, unknown>> => {
    const lines = csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const parts = line.split(",");
      const row: Record<string, unknown> = {};
      headers.forEach((header, idx) => {
        row[header] = (parts[idx] || "").trim();
      });
      return row;
    });
  };

  const handleCsvImport = async (file: File) => {
    const text = await file.text();
    const parsedRows = parseCsvRows(text);
    if (parsedRows.length === 0) {
      toast({ title: "No rows found in CSV", variant: "destructive" });
      return;
    }
    importCsvMutation.mutate({ rows: parsedRows, mode: "append" });
  };

  const handleExcelExport = async () => {
    try {
      const res = await fetchWithAuth(`/api/workspace-databases/${databaseId}/export-xlsx`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `workspace-board-${databaseId}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Excel export failed", variant: "destructive" });
    }
  };

  const handleCsvExport = async () => {
    try {
      const response = await apiRequest("GET", `/api/workspace-databases/${databaseId}/export-csv`);
      const payload = await response.json();
      const headers = Array.isArray(payload.headers) ? payload.headers : [];
      const rowsData = Array.isArray(payload.rows) ? payload.rows : [];
      const content = [headers.join(","), ...rowsData.map((row: unknown[]) => row.map((cell) => String(cell ?? "")).join(","))].join("\n");
      const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `workspace-board-${databaseId}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "CSV export failed", variant: "destructive" });
    }
  };

  const handleTabNavigation = (currentRowId: number, currentColId: number, shift: boolean) => {
    if (visibleColumns.length === 0 || processedRows.length === 0) return;
    const colIndex = visibleColumns.findIndex((c) => c.id === currentColId);
    const rowIndex = processedRows.findIndex((r) => r.id === currentRowId);
    if (colIndex < 0 || rowIndex < 0) return;
    handleCellEdit(currentRowId, currentColId, editValue);
    if (!shift) {
      if (colIndex < visibleColumns.length - 1) {
        const nextCol = visibleColumns[colIndex + 1];
        setEditingCell({ rowId: currentRowId, colId: nextCol.id });
        const row = rows.find((r) => r.id === currentRowId);
        const rowData = (row?.data as Record<string, unknown>) || {};
        setEditValue(String(rowData[String(nextCol.id)] || ""));
      } else if (rowIndex < processedRows.length - 1) {
        const nextRow = processedRows[rowIndex + 1];
        setEditingCell({ rowId: nextRow.id, colId: columns[0].id });
        const rowData = (nextRow.data as Record<string, unknown>) || {};
        setEditValue(String(rowData[String(columns[0].id)] || ""));
      } else {
        setEditingCell(null);
      }
    } else {
      if (colIndex > 0) {
        const prevCol = visibleColumns[colIndex - 1];
        setEditingCell({ rowId: currentRowId, colId: prevCol.id });
        const row = rows.find((r) => r.id === currentRowId);
        const rowData = (row?.data as Record<string, unknown>) || {};
        setEditValue(String(rowData[String(prevCol.id)] || ""));
      } else if (rowIndex > 0) {
        const prevRow = processedRows[rowIndex - 1];
        const lastCol = visibleColumns[visibleColumns.length - 1];
        setEditingCell({ rowId: prevRow.id, colId: lastCol.id });
        const rowData = (prevRow.data as Record<string, unknown>) || {};
        setEditValue(String(rowData[String(lastCol.id)] || ""));
      } else {
        setEditingCell(null);
      }
    }
  };

  const insertRowAtPosition = async (targetRow: WorkspaceDatabaseRow, position: "above" | "below") => {
    const targetSort = targetRow.sortOrder || 0;
    const newSortOrder = position === "above" ? targetSort : targetSort + 1;
    const rowsToShift = rows.filter((r) => (r.sortOrder || 0) >= newSortOrder);
    if (rowsToShift.length > 0) {
      const updates = rowsToShift.map((r) => ({ id: r.id, sortOrder: (r.sortOrder || 0) + 1 }));
      await apiRequest("POST", "/api/workspace-database-rows/reorder", { updates });
    }
    await apiRequest("POST", `/api/workspace-databases/${databaseId}/rows`, { data: {}, sortOrder: newSortOrder });
    queryClient.invalidateQueries({ queryKey: ["/api/workspace-databases", databaseId, "rows"] });
  };

  const renderCellContent = (row: WorkspaceDatabaseRow, col: WorkspaceDatabaseColumn, cellValue: string, isEditing: boolean, _rowData: Record<string, unknown>) => {
    const colType = col.type || "text";

    if (colType === "created_date") {
      const createdAt = row.createdAt ? new Date(row.createdAt) : null;
      return (
        <span className="text-sm block min-h-[20px] text-muted-foreground">
          {createdAt && !isNaN(createdAt.getTime()) ? format(createdAt, "MMM d, yyyy") : ""}
        </span>
      );
    }

    if (colType === "rating" && !isEditing) {
      const rating = Math.max(0, Math.min(5, Number(cellValue || 0)));
      return (
        <div className="flex items-center gap-0.5 min-h-[20px]">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              onClick={() => {
                const rd = (row.data as Record<string, unknown>) || {};
                updateRowMutation.mutate({ id: row.id, data: { ...rd, [String(col.id)]: String(value) } });
              }}
              className="p-0.5"
              data-testid={`cell-rating-${row.id}-${col.id}-${value}`}
            >
              <Star className={cn("h-3.5 w-3.5", value <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
            </button>
          ))}
        </div>
      );
    }

    if (colType === "date") {
      const dateVal = cellValue ? new Date(cellValue) : null;
      const displayDate = dateVal && !isNaN(dateVal.getTime()) ? format(dateVal, "MMM d, yyyy") : "";
      return (
        <Popover>
          <PopoverTrigger asChild>
            <button className="w-full text-left text-sm min-h-[20px] flex items-center gap-1" data-testid={`cell-date-trigger-${row.id}-${col.id}`}>
              <CalendarDays className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              {displayDate || <span className="text-muted-foreground">Pick date...</span>}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarWidget
              mode="single"
              selected={dateVal && !isNaN(dateVal.getTime()) ? dateVal : undefined}
              onSelect={(date: Date | undefined) => {
                const val = date ? date.toISOString() : "";
                const rd = (row.data as Record<string, unknown>) || {};
                updateRowMutation.mutate({ id: row.id, data: { ...rd, [String(col.id)]: val } });
              }}
              data-testid={`cell-calendar-${row.id}-${col.id}`}
            />
          </PopoverContent>
        </Popover>
      );
    }

    if (colType === "rag") {
      const ragColors: Record<string, { bg: string; label: string }> = {
        red: { bg: "bg-red-500", label: "Red" },
        amber: { bg: "bg-amber-500", label: "Amber" },
        green: { bg: "bg-green-500", label: "Green" },
      };
      const current = ragColors[cellValue] || null;
      return (
        <Popover>
          <PopoverTrigger asChild>
            <button className="w-full text-left text-sm min-h-[20px] flex items-center gap-1.5" data-testid={`cell-rag-trigger-${row.id}-${col.id}`}>
              {current ? (
                <>
                  <span className={cn("inline-block h-3 w-3 rounded-full flex-shrink-0", current.bg)} />
                  <span>{current.label}</span>
                </>
              ) : (
                <span className="text-muted-foreground">Set status...</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" align="start">
            {[
              { value: "green", bg: "bg-green-500", label: "Green" },
              { value: "amber", bg: "bg-amber-500", label: "Amber" },
              { value: "red", bg: "bg-red-500", label: "Red" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  const rd = (row.data as Record<string, unknown>) || {};
                  updateRowMutation.mutate({ id: row.id, data: { ...rd, [String(col.id)]: opt.value } });
                }}
                className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover-elevate", cellValue === opt.value && "bg-accent")}
                data-testid={`rag-option-${opt.value}-${row.id}-${col.id}`}
              >
                <span className={cn("inline-block h-3 w-3 rounded-full", opt.bg)} />
                {opt.label}
              </button>
            ))}
            <button
              onClick={() => {
                const rd = (row.data as Record<string, unknown>) || {};
                updateRowMutation.mutate({ id: row.id, data: { ...rd, [String(col.id)]: "" } });
              }}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm text-muted-foreground hover-elevate"
              data-testid={`rag-option-clear-${row.id}-${col.id}`}
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          </PopoverContent>
        </Popover>
      );
    }

    if (colType === "checkbox") {
      const isChecked = cellValue === "true";
      return (
        <button
          onClick={() => {
            const rd = (row.data as Record<string, unknown>) || {};
            updateRowMutation.mutate({ id: row.id, data: { ...rd, [String(col.id)]: isChecked ? "false" : "true" } });
          }}
          className="flex items-center justify-center min-h-[20px]"
          data-testid={`cell-checkbox-${row.id}-${col.id}`}
        >
          <div className={cn("h-4 w-4 rounded border flex items-center justify-center", isChecked ? "bg-primary border-primary" : "border-muted-foreground/40")}>
            {isChecked && <Check className="h-3 w-3 text-primary-foreground" />}
          </div>
        </button>
      );
    }

    if (colType === "url" && !isEditing) {
      if (cellValue) {
        return (
          <div className="flex items-center gap-1 min-h-[20px]">
            <a href={cellValue.startsWith("http") ? cellValue : `https://${cellValue}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline truncate" data-testid={`cell-url-link-${row.id}-${col.id}`}>
              {cellValue}
            </a>
            <Link2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          </div>
        );
      }
      return <span className="text-sm block min-h-[20px] text-muted-foreground">Add URL...</span>;
    }

    if (colType === "person") {
      const display = cellValue || "";
      const initials = display
        ? display.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()
        : "?";
      return (
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="w-full text-left text-sm min-h-[20px] flex items-center gap-1.5"
              data-testid={`cell-person-trigger-${row.id}-${col.id}`}
              disabled={readOnly}
            >
              {display ? (
                <>
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{display}</span>
                </>
              ) : (
                <span className="text-muted-foreground">Assign person...</span>
              )}
            </button>
          </PopoverTrigger>
          {!readOnly && (
            <PopoverContent className="w-52 p-1 max-h-56 overflow-y-auto" align="start">
              {orgUsers.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">No users available to assign</p>
              ) : orgUsers.map((u) => {
                const name = u.displayName || [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => {
                      const rd = (row.data as Record<string, unknown>) || {};
                      updateRowMutation.mutate({ id: row.id, data: { ...rd, [String(col.id)]: name } });
                    }}
                    className={cn(
                      "flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover-elevate",
                      display === name && "bg-accent",
                    )}
                    data-testid={`person-option-${u.id}-${row.id}-${col.id}`}
                  >
                    <Avatar className="h-5 w-5 shrink-0">
                      <AvatarFallback className="text-[9px]">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{name}</span>
                  </button>
                );
              })}
              {display && (
                <button
                  onClick={() => {
                    const rd = (row.data as Record<string, unknown>) || {};
                    updateRowMutation.mutate({ id: row.id, data: { ...rd, [String(col.id)]: "" } });
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm text-muted-foreground hover-elevate"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              )}
            </PopoverContent>
          )}
        </Popover>
      );
    }

    if (colType === "multi_select" && !isEditing) {
      const options = getSelectChoices(col.options);
      let selected: string[] = [];
      if (cellValue) {
        try {
          const parsed = JSON.parse(cellValue);
          selected = Array.isArray(parsed) ? parsed.map(String) : cellValue.split(",").map((s) => s.trim()).filter(Boolean);
        } catch {
          selected = cellValue.split(",").map((s) => s.trim()).filter(Boolean);
        }
      }
      const toggleTag = (opt: string) => {
        const rd = (row.data as Record<string, unknown>) || {};
        const next = selected.includes(opt) ? selected.filter((v) => v !== opt) : [...selected, opt];
        updateRowMutation.mutate({ id: row.id, data: { ...rd, [String(col.id)]: next.length ? JSON.stringify(next) : "" } });
      };
      return (
        <Popover>
          <PopoverTrigger asChild>
            <button className="w-full text-left text-sm min-h-[20px] flex flex-wrap gap-1" data-testid={`cell-multiselect-trigger-${row.id}-${col.id}`} disabled={readOnly}>
              {selected.length > 0 ? selected.map((tag) => {
                const colors = getSelectColors(tag);
                return (
                  <span key={tag} className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", colors.bg, colors.text)}>
                    {tag}
                  </span>
                );
              }) : (
                <span className="text-muted-foreground">Select tags...</span>
              )}
            </button>
          </PopoverTrigger>
          {!readOnly && (
            <PopoverContent className="w-52 p-1 max-h-56 overflow-y-auto" align="start">
              {options.map((opt: string) => {
                const colors = getSelectColors(opt);
                const active = selected.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => toggleTag(opt)}
                    className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover-elevate", active && "bg-accent")}
                    data-testid={`multiselect-option-${opt}-${row.id}-${col.id}`}
                  >
                    <span className={cn("h-2.5 w-2.5 rounded-full flex-shrink-0", colors.dot)} />
                    {opt}
                    {active && <Check className="h-3 w-3 ml-auto" />}
                  </button>
                );
              })}
            </PopoverContent>
          )}
        </Popover>
      );
    }

    if (colType === "select" && !isEditing) {
      const options = getSelectChoices(col.options);
      return (
        <Popover>
          <PopoverTrigger asChild>
            <button className="w-full text-left text-sm min-h-[20px]" data-testid={`cell-select-trigger-${row.id}-${col.id}`}>
              {cellValue ? (
                (() => {
                  const colors = getSelectColors(cellValue);
                  return (
                    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium", colors.bg, colors.text)}>
                      <span className={cn("h-2 w-2 rounded-full flex-shrink-0", colors.dot)} />
                      {cellValue}
                    </span>
                  );
                })()
              ) : (
                <span className="text-muted-foreground">Select...</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="start">
            {options.map((opt: string) => {
              const colors = getSelectColors(opt);
              return (
                <button
                  key={opt}
                  onClick={() => {
                    const rd = (row.data as Record<string, unknown>) || {};
                    updateRowMutation.mutate({ id: row.id, data: { ...rd, [String(col.id)]: opt } });
                  }}
                  className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm hover-elevate", cellValue === opt && "bg-accent")}
                  data-testid={`select-option-${opt}-${row.id}-${col.id}`}
                >
                  <span className={cn("h-2.5 w-2.5 rounded-full flex-shrink-0", colors.dot)} />
                  {opt}
                </button>
              );
            })}
            <button
              onClick={() => {
                const rd = (row.data as Record<string, unknown>) || {};
                updateRowMutation.mutate({ id: row.id, data: { ...rd, [String(col.id)]: "" } });
              }}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm text-muted-foreground hover-elevate"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          </PopoverContent>
        </Popover>
      );
    }

    if (isEditing) {
      if (colType === "long_text") {
        return (
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => handleCellEdit(row.id, col.id, editValue)}
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                e.preventDefault();
                handleTabNavigation(row.id, col.id, e.shiftKey);
              } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                handleCellEdit(row.id, col.id, editValue);
              } else if (e.key === "Escape") {
                setEditingCell(null);
              }
            }}
            className="w-full text-sm bg-transparent outline-none resize-none min-h-[56px]"
            autoFocus
            data-testid={`cell-textarea-${row.id}-${col.id}`}
          />
        );
      }
      return (
        <input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => handleCellEdit(row.id, col.id, editValue)}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              handleTabNavigation(row.id, col.id, e.shiftKey);
            } else if (e.key === "Enter") {
              const colIndex = visibleColumns.findIndex((c) => c.id === col.id);
              if (colIndex === visibleColumns.length - 1) {
                addRowMutation.mutate();
              }
              handleCellEdit(row.id, col.id, editValue);
            } else if (e.key === "Escape") {
              setEditingCell(null);
            }
          }}
          className="w-full text-sm bg-transparent outline-none"
          autoFocus
          data-testid={`cell-input-${row.id}-${col.id}`}
        />
      );
    }

    return <span className="text-sm block min-h-[20px]">{cellValue || "\u00A0"}</span>;
  };

  const handleSort = (colId: number) => {
    if (sortColumn === colId) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(colId);
      setSortDirection("asc");
    }
  };

  const processedRows = useMemo(() => {
    let result = [...rows];

    if (searchQuery) {
      result = result.filter((row) => {
        const rowData = (row.data as Record<string, unknown>) || {};
        return Object.values(rowData).some((v) =>
          String(v || "").toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
    }

    if (filterRules.length > 0) {
      result = result.filter((row) => {
        const rowData = (row.data as Record<string, unknown>) || {};
        return filterRules.every((rule) => {
          const val = String(rowData[String(rule.columnId)] || "").toLowerCase();
          const target = rule.value.toLowerCase();
          switch (rule.operator) {
            case "is": return val === target;
            case "is_not": return val !== target;
            case "contains": return val.includes(target);
            case "not_contains": return !val.includes(target);
            case "is_empty": return !val;
            case "is_not_empty": return !!val;
            default: return true;
          }
        });
      });
    }

    if (sortColumn !== null) {
      result = [...result].sort((a, b) => {
        const aData = (a.data as Record<string, unknown>) || {};
        const bData = (b.data as Record<string, unknown>) || {};
        const aVal = String(aData[String(sortColumn)] || "");
        const bVal = String(bData[String(sortColumn)] || "");
        const cmp = aVal.localeCompare(bVal);
        if (cmp !== 0) return sortDirection === "asc" ? cmp : -cmp;
        if (secondarySortColumn !== null) {
          const aSecondary = String(aData[String(secondarySortColumn)] || "");
          const bSecondary = String(bData[String(secondarySortColumn)] || "");
          const secondaryCmp = aSecondary.localeCompare(bSecondary);
          if (secondaryCmp !== 0) return secondarySortDirection === "asc" ? secondaryCmp : -secondaryCmp;
        }
        return 0;
      });
    }

    return result;
  }, [rows, searchQuery, filterRules, sortColumn, sortDirection, secondarySortColumn, secondarySortDirection]);

  const rowPagination = useTablePagination(processedRows, {
    resetKey: `${searchQuery}-${JSON.stringify(filterRules)}-${sortColumn}-${sortDirection}`,
  });

  const displayRows = rowPagination.paginatedItems;

  const groupedRows = useMemo(() => {
    if (groupByColumn === null) return null;
    const groups: Record<string, WorkspaceDatabaseRow[]> = {};
    displayRows.forEach((row) => {
      const rowData = (row.data as Record<string, unknown>) || {};
      const groupVal = String(rowData[String(groupByColumn)] || "") || "(empty)";
      if (!groups[groupVal]) groups[groupVal] = [];
      groups[groupVal].push(row);
    });
    return groups;
  }, [displayRows, groupByColumn]);

  const toggleGroupCollapse = (groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  const toggleRowSelection = (rowId: number, _shiftKey?: boolean) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === processedRows.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(processedRows.map((r) => r.id)));
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedRows);
    for (const id of ids) {
      await apiRequest("DELETE", `/api/workspace-database-rows/${id}`);
    }
    queryClient.invalidateQueries({ queryKey: ["/api/workspace-databases", databaseId, "rows"] });
    setSelectedRows(new Set());
  };

  const handleBulkUpdate = async (colId: number, value: string) => {
    const ids = Array.from(selectedRows);
    for (const id of ids) {
      const row = rows.find((r) => r.id === id);
      if (!row) continue;
      const rowData = (row.data as Record<string, unknown>) || {};
      await apiRequest("PATCH", `/api/workspace-database-rows/${id}`, { data: { ...rowData, [String(colId)]: value } });
    }
    queryClient.invalidateQueries({ queryKey: ["/api/workspace-databases", databaseId, "rows"] });
    setSelectedRows(new Set());
  };

  const handleApplyView = (config: any) => {
    const nextView = config.viewType || "table";
    setActiveView(nextView);
    setSortColumn(config.sortColumn ?? null);
    setSortDirection(config.sortDirection ?? "asc");
    setSecondarySortColumn(config.secondarySortColumn ?? null);
    setSecondarySortDirection(config.secondarySortDirection ?? "asc");
    setGroupByColumn(config.groupByColumn ?? null);
    setFilterRules(config.filterRules ?? []);
  };

  const viewOptions = [
    { key: "table", icon: Table, label: "Table" },
    { key: "list", icon: List, label: "List" },
    { key: "kanban", icon: Columns, label: "Board" },
    { key: "calendar", icon: Calendar, label: "Calendar" },
  ];

  const startAddColumn = () => {
    setAddingColumnInline(true);
    setNewColumnName("");
    setNewColumnType("text");
    setColumnTypeStep(false);
    setTimeout(() => newColumnInputRef.current?.focus(), 50);
  };

  const renderTableRow = (row: WorkspaceDatabaseRow) => {
    const rowData = (row.data as Record<string, unknown>) || {};
    const isSelected = selectedRows.has(row.id);
    return (
      <tr
        key={row.id}
        className={cn("border-b border-border/40 last:border-b-0 group hover:bg-muted/30", isSelected && "bg-primary/5")}
        data-testid={`table-row-${row.id}`}
      >
        <td className="w-8 px-1 border-r text-center">
          <div className="flex items-center gap-0.5">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleRowSelection(row.id)}
              className="h-3.5 w-3.5 rounded border-muted-foreground/40"
              data-testid={`row-checkbox-${row.id}`}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-0.5 rounded invisible group-hover:visible hover-elevate" data-testid={`row-menu-${row.id}`}>
                  <GripVertical className="h-3 w-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => insertRowAtPosition(row, "above")} data-testid={`insert-row-above-${row.id}`}>
                  <ArrowUpFromLine className="h-4 w-4 mr-2" />
                  Insert Above
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => insertRowAtPosition(row, "below")} data-testid={`insert-row-below-${row.id}`}>
                  <ArrowDownFromLine className="h-4 w-4 mr-2" />
                  Insert Below
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => duplicateRowMutation.mutate(row)} data-testid={`duplicate-row-${row.id}`}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => deleteRowMutation.mutate(row.id)} className="text-red-600 focus:text-red-700" data-testid={`delete-row-${row.id}`}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </td>
        {visibleColumns.map((col) => {
          const cellValue = String(rowData[String(col.id)] || "");
          const isEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id;
          return (
            <td
              key={col.id}
              className={cn(
                "px-3 py-2.5 align-middle border-r last:border-r-0",
                !["date", "rag", "checkbox", "select", "rating", "created_date"].includes(col.type || "text") && "cursor-text",
                isEditing && "bg-accent/20 ring-1 ring-primary/30 ring-inset"
              )}
              onClick={() => {
                if (!isEditing && !["date", "rag", "checkbox", "select", "rating", "created_date"].includes(col.type || "text")) {
                  setEditingCell({ rowId: row.id, colId: col.id });
                  setEditValue(cellValue);
                }
              }}
              data-testid={`cell-${row.id}-${col.id}`}
            >
              {renderCellContent(row, col, cellValue, isEditing, rowData)}
            </td>
          );
        })}
        <td className="w-8 px-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setDetailRowId(row.id)}
            data-testid={`row-detail-open-${row.id}`}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </td>
      </tr>
    );
  };

  return (
    <>
      <WorkspaceQueryShell query={tableDataQuery} skeleton="table">
      <div className="border rounded-md bg-card overflow-hidden" data-testid="workspace-table">
        <SavedViewsStrip
          databaseId={databaseId}
          activeViewConfig={{
            viewType: activeView,
            sortColumn,
            sortDirection,
            secondarySortColumn,
            secondarySortDirection,
            groupByColumn,
            filterRules,
          }}
          onApplyView={handleApplyView}
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 border-b">
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {viewOptions.map((v) => (
              <Button
                key={v.key}
                variant={activeView === v.key ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveView(v.key)}
                className="gap-1 text-xs"
                data-testid={`view-toggle-${v.key}`}
              >
                <v.icon className="h-3.5 w-3.5" />
                {v.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={startAddColumn} className="gap-1 text-xs shrink-0" data-testid="toolbar-add-field-button">
              <Plus className="h-3.5 w-3.5" />
              Add Field
            </Button>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-7 text-xs w-full sm:w-40" data-testid="table-search-input" />
            </div>
            <FilterPanel columns={columns} filterRules={filterRules} onUpdateFilters={setFilterRules} />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 text-xs" data-testid="toggle-columns-trigger">
                  <Columns className="h-3.5 w-3.5" />
                  Hide columns
                  {hiddenColumnIds.size > 0 ? ` (${hiddenColumnIds.size})` : ""}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <div className="space-y-1">
                  {columns.map((col) => {
                    const isVisible = col.isVisible !== false;
                    return (
                      <button
                        key={col.id}
                        onClick={() => toggleColumnVisibility(col)}
                        className="flex w-full items-center justify-between rounded px-2 py-1 text-xs hover-elevate"
                        data-testid={`toggle-column-${col.id}`}
                      >
                        <span className={cn(!isVisible && "text-muted-foreground line-through")}>{col.name}</span>
                        {isVisible && <Check className="h-3.5 w-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => csvInputRef.current?.click()}
              data-testid="toolbar-import-csv"
            >
              <ArrowUpFromLine className="h-3.5 w-3.5" />
              Import CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={handleExcelExport}
              data-testid="toolbar-export-excel"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Export Excel
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={handleCsvExport}
              data-testid="toolbar-export-csv"
            >
              <ArrowDownFromLine className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCsvImport(file);
                e.currentTarget.value = "";
              }}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={groupByColumn !== null ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-1 text-xs"
                  data-testid="group-by-trigger"
                >
                  <Layers className="h-3.5 w-3.5" />
                  Group
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setGroupByColumn(null)} data-testid="group-by-none">
                  <X className="h-4 w-4 mr-2" />
                  No grouping
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {visibleColumns.map((col) => (
                  <DropdownMenuItem
                    key={col.id}
                    onClick={() => setGroupByColumn(col.id)}
                    className={cn(groupByColumn === col.id && "bg-accent")}
                    data-testid={`group-by-${col.id}`}
                  >
                    {col.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {onToggleExpand && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={onToggleExpand} data-testid="toggle-expand-table">
                    {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{isExpanded ? "Collapse to page width" : "Expand to full width"}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {activeView === "table" && (
          <div className="overflow-x-auto">
            {columns.length === 0 && rows.length === 0 && !addingColumnInline ? (
              <div className="text-center py-10 px-4" data-testid="empty-table-state">
                <Table className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium mb-1">Start building your board</p>
                <p className="text-xs text-muted-foreground mb-4">Add your first column to define the structure, or use a template to get started quickly.</p>
                <div className="flex items-center justify-center gap-2">
                  <Button variant="outline" size="sm" onClick={startAddColumn} data-testid="empty-state-add-column">
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add First Column
                  </Button>
                  <Button variant="default" size="sm" onClick={() => { setShowInlineTemplateDialog(true); setInlineTemplateSearch(""); setInlineTemplateCategory(null); }} data-testid="empty-state-use-template">
                    <ClipboardList className="h-3.5 w-3.5 mr-1" />
                    Use Template
                  </Button>
                </div>
              </div>
            ) : (
              <table className="w-full text-sm text-gray-700 dark:text-foreground">
                <thead>
                  <tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground border-b border-border/60">
                    <th className="w-8 px-1 py-2.5 border-r">
                      <input
                        type="checkbox"
                        checked={processedRows.length > 0 && selectedRows.size === processedRows.length}
                        onChange={toggleSelectAll}
                        className="h-3.5 w-3.5 rounded border-muted-foreground/40"
                        data-testid="select-all-checkbox"
                      />
                    </th>
                    {visibleColumns.map((col, colIndex) => {
                      const colType = COLUMN_TYPES.find((ct) => ct.type === col.type);
                      const ColIcon = colType?.icon || Type;
                      const isEditingHeader = editingColumnId === col.id;
                      return (
                        <th
                          key={col.id}
                          className={cn(
                            "px-3 py-2.5 text-left align-middle font-semibold border-r last:border-r-0 select-none group cursor-grab",
                            dragOverColId === col.id && draggedColId !== col.id && "bg-primary/10 shadow-[inset_2px_0_0_0_hsl(var(--primary))]"
                          )}
                          style={{ minWidth: col.width || 150 }}
                          draggable={!isEditingHeader}
                          onDragStart={(e) => handleColDragStart(e, col.id)}
                          onDragOver={(e) => handleColDragOver(e, col.id)}
                          onDragEnd={handleColDragEnd}
                          onDrop={(e) => handleColDrop(e, col.id)}
                          data-testid={`column-header-${col.id}`}
                        >
                          {isEditingHeader ? (
                            <input
                              value={editingColumnName}
                              onChange={(e) => setEditingColumnName(e.target.value)}
                              onBlur={() => {
                                if (editingColumnName.trim() && editingColumnName.trim() !== col.name) {
                                  updateColumnMutation.mutate({ id: col.id, name: editingColumnName.trim() });
                                } else {
                                  setEditingColumnId(null);
                                  setEditingColumnName("");
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && editingColumnName.trim()) updateColumnMutation.mutate({ id: col.id, name: editingColumnName.trim() });
                                if (e.key === "Escape") { setEditingColumnId(null); setEditingColumnName(""); }
                              }}
                              className="w-full text-sm font-medium bg-transparent outline-none border-b border-primary/30"
                              autoFocus
                              data-testid={`column-name-input-${col.id}`}
                            />
                          ) : (
                            <div className="flex items-center justify-between gap-1">
                              <span
                                className="flex items-center gap-1.5 cursor-pointer"
                                onClick={() => handleSort(col.id)}
                                onDoubleClick={(e) => { e.stopPropagation(); setEditingColumnId(col.id); setEditingColumnName(col.name); }}
                                title="Click to sort, double-click to rename"
                                data-testid={`column-name-${col.id}`}
                              >
                                <ColIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
                                {col.name}
                                {sortColumn === col.id && (sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                              </span>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover-elevate" onClick={(e) => e.stopPropagation()} data-testid={`column-menu-${col.id}`}>
                                    <MoreHorizontal className="h-3 w-3" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  <DropdownMenuItem onClick={() => { setEditingColumnId(col.id); setEditingColumnName(col.name); }} data-testid={`rename-column-${col.id}`}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Rename
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleSort(col.id)} data-testid={`sort-asc-${col.id}`}>
                                    <ArrowUp className="h-4 w-4 mr-2" />
                                    Sort A-Z
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setSortColumn(col.id); setSortDirection("desc"); }} data-testid={`sort-desc-${col.id}`}>
                                    <ArrowDown className="h-4 w-4 mr-2" />
                                    Sort Z-A
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setSecondarySortColumn(col.id); setSecondarySortDirection("asc"); }} data-testid={`secondary-sort-${col.id}`}>
                                    <ArrowUpDown className="h-4 w-4 mr-2" />
                                    Use as secondary sort (A-Z)
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setSecondarySortColumn(col.id); setSecondarySortDirection("desc"); }} data-testid={`secondary-sort-desc-${col.id}`}>
                                    <ArrowUpDown className="h-4 w-4 mr-2" />
                                    Secondary sort (Z-A)
                                  </DropdownMenuItem>
                                  {secondarySortColumn !== null && (
                                    <DropdownMenuItem onClick={() => setSecondarySortColumn(null)} data-testid="clear-secondary-sort">
                                      Clear secondary sort
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  {colIndex > 0 && (
                                    <DropdownMenuItem onClick={() => moveColumn(col.id, "left")} data-testid={`move-column-left-${col.id}`}>
                                      <ArrowLeftFromLine className="h-4 w-4 mr-2" />
                                      Move Left
                                    </DropdownMenuItem>
                                  )}
                                  {colIndex < visibleColumns.length - 1 && (
                                    <DropdownMenuItem onClick={() => moveColumn(col.id, "right")} data-testid={`move-column-right-${col.id}`}>
                                      <ArrowRightFromLine className="h-4 w-4 mr-2" />
                                      Move Right
                                    </DropdownMenuItem>
                                  )}
                                  {(colIndex > 0 || colIndex < visibleColumns.length - 1) && <DropdownMenuSeparator />}
                                  <DropdownMenuItem onClick={() => deleteColumnMutation.mutate(col.id)} className="text-destructive" data-testid={`delete-column-${col.id}`}>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Column
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                        </th>
                      );
                    })}
                    {addingColumnInline ? (
                      <th className="text-left px-2 py-1 min-w-[200px]" data-testid="inline-add-column">
                        {!columnTypeStep ? (
                          <div className="flex items-center gap-1">
                            <input
                              ref={newColumnInputRef}
                              value={newColumnName}
                              onChange={(e) => setNewColumnName(e.target.value)}
                              placeholder="Column name..."
                              className="w-full text-sm bg-transparent outline-none border-b border-primary/30 font-normal py-0.5"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && newColumnName.trim()) setColumnTypeStep(true);
                                if (e.key === "Escape") { setAddingColumnInline(false); setNewColumnName(""); }
                              }}
                              onBlur={() => {
                                if (!newColumnName.trim()) { setAddingColumnInline(false); setNewColumnName(""); }
                              }}
                              autoFocus
                              data-testid="inline-column-name-input"
                            />
                          </div>
                        ) : (
                          <div className="space-y-1 p-1" data-testid="inline-column-type-picker">
                            <div className="text-xs text-muted-foreground font-normal mb-1">Type for "{newColumnName}"</div>
                            {COLUMN_TYPES.map((ct) => (
                              <button
                                key={ct.type}
                                onClick={() => { setNewColumnType(ct.type); addColumnMutation.mutate({ name: newColumnName.trim(), type: ct.type }); }}
                                className={cn("flex items-center gap-2 w-full px-2 py-1 rounded text-xs font-normal hover-elevate", newColumnType === ct.type && "bg-accent")}
                                data-testid={`column-type-${ct.type}`}
                              >
                                <ct.icon className="h-3.5 w-3.5" />
                                {ct.label}
                              </button>
                            ))}
                            <button className="text-xs text-muted-foreground hover-elevate rounded px-2 py-1 w-full text-left font-normal" onClick={() => { setAddingColumnInline(false); setNewColumnName(""); setColumnTypeStep(false); }}>
                              Cancel
                            </button>
                          </div>
                        )}
                      </th>
                    ) : (
                      <th className="px-2 min-w-[80px]">
                        <Button variant="ghost" size="sm" onClick={startAddColumn} className="gap-1 text-xs text-muted-foreground w-full" data-testid="add-column-button">
                          <Plus className="h-3.5 w-3.5" />
                          Field
                        </Button>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                    {processedRows.length === 0 && visibleColumns.length > 0 && (
                    <tr>
                      <td colSpan={visibleColumns.length + 2} className="text-center py-8">
                        <p className="text-sm text-muted-foreground mb-2">No rows yet</p>
                        <button className="text-sm text-primary hover-elevate rounded px-3 py-1" onClick={() => addRowMutation.mutate()} data-testid="empty-rows-add-button">
                          <Plus className="h-3 w-3 inline mr-1" />
                          Add your first row
                        </button>
                      </td>
                    </tr>
                  )}
                  {groupedRows ? (
                    Object.entries(groupedRows).map(([groupKey, groupRows]) => {
                      const isCollapsed = collapsedGroups.has(groupKey);
                      const groupCol = columns.find((c) => c.id === groupByColumn);
                      return (
                        <React.Fragment key={groupKey}>
                          <tr className="bg-muted/40 border-b">
                            <td colSpan={visibleColumns.length + 2} className="px-3 py-1.5">
                              <button
                                className="flex items-center gap-2 text-sm font-medium"
                                onClick={() => toggleGroupCollapse(groupKey)}
                                data-testid={`group-header-${groupKey}`}
                              >
                                {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                {groupCol?.type === "rag" && groupKey !== "(empty)" && (
                                  <span className={cn("h-3 w-3 rounded-full", groupKey === "green" ? "bg-green-500" : groupKey === "amber" ? "bg-amber-500" : groupKey === "red" ? "bg-red-500" : "bg-muted-foreground")} />
                                )}
                                <span>{groupKey}</span>
                                <Badge variant="secondary" className="text-[10px] ml-1">{groupRows.length}</Badge>
                              </button>
                            </td>
                          </tr>
                          {!isCollapsed && groupRows.map(renderTableRow)}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    displayRows.map(renderTableRow)
                  )}
                </tbody>
              </table>
            )}
            {processedRows.length > 0 && (
              <TablePagination
                page={rowPagination.page}
                totalPages={rowPagination.totalPages}
                total={rowPagination.total}
                startIndex={rowPagination.startIndex}
                endIndex={rowPagination.endIndex}
                pageSize={rowPagination.pageSize}
                onPageChange={rowPagination.setPage}
                onPageSizeChange={rowPagination.setPageSize}
              />
            )}
          </div>
        )}

        {activeView === "list" && (
          <div className="p-3 space-y-1">
            {displayRows.map((row) => {
              const rowData = (row.data as Record<string, unknown>) || {};
              const firstCol = visibleColumns[0];
              const title = firstCol ? String(rowData[String(firstCol.id)] || "Untitled") : "Untitled";
              return (
                <div key={row.id} className="flex items-center gap-2 p-2 rounded hover-elevate cursor-pointer" onClick={() => setDetailRowId(row.id)} data-testid={`list-row-${row.id}`}>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm flex-1">{title}</span>
                  {visibleColumns.slice(1, 3).map((col) => (
                    <Badge key={col.id} variant="secondary" className="text-xs">
                      {String(rowData[String(col.id)] || "")}
                    </Badge>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {activeView === "kanban" && (
          <div className="p-3">
            <WorkspaceKanbanView
              columns={visibleColumns}
              rows={[...displayRows]}
              onUpdateRow={(rowId, data) => updateRowMutation.mutate({ id: rowId, data })}
              onAddRow={(statusColId, statusValue) => {
                const maxSort = rows.length > 0 ? Math.max(...rows.map((r) => r.sortOrder || 0)) : -1;
                apiRequest("POST", `/api/workspace-databases/${databaseId}/rows`, {
                  data: { [String(statusColId)]: statusValue },
                  sortOrder: maxSort + 1,
                }).then(() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/workspace-databases", databaseId, "rows"] });
                });
              }}
              onOpenRowDetail={(rowId) => setDetailRowId(rowId)}
            />
          </div>
        )}

        {activeView === "calendar" && (
          <div className="p-3">
            <WorkspaceCalendarView
              columns={visibleColumns}
              rows={[...displayRows]}
              onUpdateRow={(rowId, data) => updateRowMutation.mutate({ id: rowId, data })}
              onAddRow={(dateColId, isoDate) => {
                const maxSort = rows.length > 0 ? Math.max(...rows.map((r) => r.sortOrder || 0)) : -1;
                apiRequest("POST", `/api/workspace-databases/${databaseId}/rows`, {
                  data: { [String(dateColId)]: isoDate },
                  sortOrder: maxSort + 1,
                }).then(() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/workspace-databases", databaseId, "rows"] });
                });
              }}
              onOpenRowDetail={(rowId) => setDetailRowId(rowId)}
            />
          </div>
        )}

        <div className="flex items-center justify-between p-2 border-t text-xs text-muted-foreground">
          <button className="flex items-center gap-1 hover-elevate rounded px-2 py-1" onClick={() => addRowMutation.mutate()} data-testid="add-row-button">
            <Plus className="h-3 w-3" />
            New
          </button>
          <span data-testid="row-count">
            {processedRows.length}
            {processedRows.length !== rows.length ? ` / ${rows.length}` : ""}{" "}
            {rows.length === 1 ? "row" : "rows"}
          </span>
        </div>
      </div>
      </WorkspaceQueryShell>

      <FormDialogShell
        open={showInlineTemplateDialog}
        onOpenChange={setShowInlineTemplateDialog}
        title="Apply Template to Board"
        subtitle="Choose a template to populate this board with pre-configured columns and sample data."
        saveLabel="Close"
        onCancel={() => setShowInlineTemplateDialog(false)}
        onSubmit={() => setShowInlineTemplateDialog(false)}
        size="xl"
      >
        <FormSection title="Template library">
          <div className="flex items-center gap-2 px-1">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search templates..." value={inlineTemplateSearch} onChange={(e) => setInlineTemplateSearch(e.target.value)} className="pl-9 h-9" data-testid="inline-template-search-input" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            <Button variant={inlineTemplateCategory === null ? "default" : "outline"} size="sm" onClick={() => setInlineTemplateCategory(null)} data-testid="inline-template-category-all">All</Button>
            {TEMPLATE_CATEGORIES.map((cat) => (
              <Button key={cat} variant={inlineTemplateCategory === cat ? "default" : "outline"} size="sm" onClick={() => setInlineTemplateCategory(inlineTemplateCategory === cat ? null : cat)} data-testid={`inline-template-category-${cat.toLowerCase().replace(/\s+/g, "-")}`}>{cat}</Button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto px-1 pb-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DATABASE_TEMPLATES
                .filter((t) => {
                  const matchesCategory = !inlineTemplateCategory || t.category === inlineTemplateCategory;
                  const matchesSearch = !inlineTemplateSearch || t.name.toLowerCase().includes(inlineTemplateSearch.toLowerCase()) || t.description.toLowerCase().includes(inlineTemplateSearch.toLowerCase());
                  return matchesCategory && matchesSearch;
                })
                .map((template) => {
                  const IconComponent = TEMPLATE_ICONS[template.icon] || LayoutGrid;
                  return (
                    <Card key={template.id} className="p-4 cursor-pointer hover-elevate" onClick={() => applyTemplateMutation.mutate(template)} data-testid={`inline-template-card-${template.id}`}>
                      <div className="flex items-start gap-3">
                        <div className={cn("p-2 rounded-md flex-shrink-0", CATEGORY_COLORS[template.category] || "bg-muted")}>
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm truncate">{template.name}</h4>
                            <Badge variant="secondary" className="text-[10px] flex-shrink-0">{template.category}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{template.description}</p>
                          <div className="flex flex-wrap gap-1">
                            {template.columns.slice(0, 5).map((col) => (
                              <span key={col.name} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{col.name}</span>
                            ))}
                            {template.columns.length > 5 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">+{template.columns.length - 5} more</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
            </div>
            {DATABASE_TEMPLATES.filter((t) => {
              const matchesCategory = !inlineTemplateCategory || t.category === inlineTemplateCategory;
              const matchesSearch = !inlineTemplateSearch || t.name.toLowerCase().includes(inlineTemplateSearch.toLowerCase()) || t.description.toLowerCase().includes(inlineTemplateSearch.toLowerCase());
              return matchesCategory && matchesSearch;
            }).length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <LayoutGrid className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No templates match your search</p>
              </div>
            )}
          </div>
          {applyTemplateMutation.isPending && (
            <div className="flex items-center justify-center py-3 border-t gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Applying template...</span>
            </div>
          )}
        </FormSection>
      </FormDialogShell>

      <BulkActionsBar
        selectedCount={selectedRows.size}
        onDeselectAll={() => setSelectedRows(new Set())}
        onBulkDelete={handleBulkDelete}
        columns={columns}
        onBulkUpdate={handleBulkUpdate}
      />
      {detailRowId !== null && (
        <WorkspaceRowDetailPanel
          rowId={detailRowId}
          databaseId={databaseId}
          columns={columns}
          onClose={() => setDetailRowId(null)}
          readOnly={readOnly}
        />
      )}
    </>
  );
}

