import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Plus,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Text,
  Hash,
  Calendar as CalendarIcon,
  User,
  Tag,
  CheckSquare,
  Link2,
  BarChart3,
  AlertCircle,
  Copy,
  Archive,
  Trash2,
  Edit,
  Eye,
  Paintbrush,
  Paperclip,
  ListTodo,
  GripVertical,
  Pin,
} from "lucide-react";
import { format } from "date-fns";
import {
  ConditionalFormatRule,
  evaluateConditionalFormatting,
  styleToClassAndInline,
} from "@/lib/conditionalFormatting";
import { ConditionalFormattingPanel } from "@/components/ConditionalFormattingPanel";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { TablePagination } from "@/components/TablePagination";

export type ColumnType = 
  | "text" 
  | "status" 
  | "select"
  | "priority" 
  | "person" 
  | "date" 
  | "timeline"
  | "tags" 
  | "checkbox" 
  | "number" 
  | "currency"
  | "link" 
  | "progress"
  | "rag"
  | "files"
  | "checklist"
  | "formula";

export type ColumnSummaryKind = "sum" | "avg" | "count" | "filled";

export interface StatusOption {
  value: string;
  label: string;
  color?: string;
}

export interface PersonValue {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
  profileImageUrl?: string | null;
}

export interface ColumnDef<T = Record<string, unknown>> {
  id: string;
  header: string;
  type: ColumnType;
  accessor: keyof T | ((row: T) => unknown);
  width?: string;
  editable?: boolean;
  editableCondition?: (row: T) => boolean;
  options?: StatusOption[];
  hidden?: boolean;
  /** Pin column to the left while scrolling horizontally (Infinity / monday). */
  sticky?: boolean;
  /** monday.com-style "Edit Labels" for status/select columns */
  onEditLabels?: () => void;
  /** Custom cell renderer, overrides the built-in type-based rendering (e.g. Files/Subtasks count columns). */
  render?: (row: T, value: unknown) => React.ReactNode;
  /** Infinity-style column footer aggregation. */
  summary?: ColumnSummaryKind | ((rows: T[]) => React.ReactNode);
  /** For type "formula" — computed cell value. */
  formula?: (row: T) => unknown;
}

export interface GroupDef<T = Record<string, unknown>> {
  id: string;
  title: string;
  color?: string;
  collapsed?: boolean;
  items: T[];
  count?: number;
  summary?: string;
}

export interface MondayTableProps<T extends { id: number | string }> {
  columns: ColumnDef<T>[];
  data: T[];
  groups?: GroupDef<T>[];
  onRowClick?: (row: T) => void;
  /** Prefer this for detail panels — cell edits won't accidentally open them. */
  onRowDoubleClick?: (row: T) => void;
  onRowSelect?: (selectedIds: (number | string)[]) => void;
  onCellEdit?: (rowId: number | string, columnId: string, value: unknown) => void;
  onAddItem?: (groupId?: string) => void;
  onDeleteItems?: (ids: (number | string)[]) => void;
  onDuplicateItem?: (id: number | string) => void;
  onArchiveItem?: (id: number | string) => void;
  onEditItem?: (row: T) => void;
  /** Opens item detail from the row ⋮ menu (does not fire on cell edit). */
  onOpenItem?: (row: T) => void;
  renderRowActions?: (row: T) => React.ReactNode;
  renderBulkActions?: (selectedIds: (number | string)[]) => React.ReactNode;
  alwaysShowRowActions?: boolean;
  /** CSS grid track size for the custom row-actions column (default widens when alwaysShowRowActions). */
  rowActionsWidth?: string;
  selectable?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  addItemLabel?: string;
  className?: string;
  gridLines?: boolean;
  onColumnResize?: (columnId: string, width: number) => void;
  onColumnReorder?: (fromColumnId: string, toColumnId: string) => void;
  columnWidthStorageKey?: string;
  totalCount?: number;
  conditionalFormatRules?: ConditionalFormatRule[];
  defaultConditionalFormatRules?: ConditionalFormatRule[];
  onConditionalFormatRulesChange?: (rules: ConditionalFormatRule[]) => void;
  /** Hide the built-in Format toolbar strip (parent can host the Format control). */
  hideFormatToolbar?: boolean;
  /** Controlled Format panel open state (optional). */
  formatPanelOpen?: boolean;
  onFormatPanelOpenChange?: (open: boolean) => void;
  /** Client-side pagination (default: enabled). Pass false to show all rows. */
  pagination?: boolean | { defaultPageSize?: number; resetKey?: string | number };
  /** Highlights matching text in read-only text cells (case-insensitive). */
  /** Called when files are dropped onto a row (monday-style attachment drop). */
  onRowFilesDrop?: (row: T, files: File[]) => void;
  searchHighlightTerm?: string;
  /** Row density — Infinity-style expand/compact (default: comfortable). */
  density?: "compact" | "comfortable" | "expanded";
  /** Infinity expand/collapse-all: bump these counters to expand or collapse all groups. */
  expandAllSignal?: number;
  collapseAllSignal?: number;
  /** Enable drag-handle row reorder (Infinity table). */
  reorderable?: boolean;
  /** Called with the new full order of visible item ids after a row drag.
   *  When grouped, meta.targetGroupId is the group the row was dropped into. */
  onRowReorder?: (
    orderedIds: (number | string)[],
    meta?: {
      draggedId: number | string;
      targetId: number | string;
      targetGroupId?: string;
    },
  ) => void;
  /** Show per-column summary footer (Infinity Summarize). Default true when any column has summary. */
  showColumnSummary?: boolean;
}

const columnTypeIcons: Record<ColumnType, typeof Text> = {
  text: Text,
  status: AlertCircle,
  select: ChevronDown,
  priority: AlertCircle,
  person: User,
  date: CalendarIcon,
  timeline: CalendarIcon,
  tags: Tag,
  checkbox: CheckSquare,
  number: Hash,
  currency: Hash,
  link: Link2,
  progress: BarChart3,
  rag: AlertCircle,
  files: Paperclip,
  checklist: ListTodo,
  formula: Hash,
};

/** Theme-aware Monday table chrome (light + dark). Prefer tokens over light-only hex. */
const mtBorder = "border-border";
const mtHeaderBg = "bg-muted";
const mtHeaderSticky = "sticky z-[25] bg-muted";
const mtSummaryBg = "bg-muted border-t border-border text-[12px] text-muted-foreground";
/** Sticky data cells inherit the row background — never paint their own grey fill. */
const mtStickyCell = "sticky z-[16] bg-card group-hover:bg-muted/80";
const mtGridLine = "border-r border-border/80";
const mtRowHover = "hover:bg-muted/80";
const mtRowSelected = "bg-primary/10 dark:bg-primary/20";
const mtFocusCell = "bg-primary/15 dark:bg-primary/20 border-b-2 border-b-primary";
const CHROME_COL_PX = 48;
const MIN_COL_WIDTH_PX = 72;

export const defaultStatusColors: Record<string, string> = {
  not_started: "bg-[#c4c4c4] text-white",
  in_progress: "bg-[#fdab3d] text-white",
  working_on_it: "bg-[#fdab3d] text-white",
  done: "bg-[#00c875] text-white",
  complete: "bg-[#00c875] text-white",
  completed: "bg-[#00c875] text-white",
  stuck: "bg-[#e2445c] text-white",
  delayed: "bg-[#e2445c] text-white",
  at_risk: "bg-[#fdab3d] text-white",
  active: "bg-[#00c875] text-white",
  approved: "bg-[#a25ddc] text-white",
  on_hold: "bg-[#ffcb00] text-[#323338]",
  not_applicable: "bg-[#c4c4c4] text-white",
  draft: "bg-[#c4c4c4] text-white",
  pending: "bg-[#fdab3d] text-white",
  cancelled: "bg-[#c4c4c4] text-white",
  closed: "bg-[#c4c4c4] text-white",
  archived: "bg-[#c4c4c4] text-white",
  fit: "bg-[#00c875] text-white",
  gap: "bg-[#e2445c] text-white",
  workaround: "bg-[#fdab3d] text-white",
  custom_dev: "bg-[#a25ddc] text-white",
  not_assessed: "bg-[#c4c4c4] text-white",
  critical: "bg-[#e2445c] text-white",
  high: "bg-[#e2445c] text-white",
  medium: "bg-[#fdab3d] text-white",
  low: "bg-[#579bfc] text-white",
  simple: "bg-[#00c875] text-white",
  complex: "bg-[#e2445c] text-white",
};

const priorityColors: Record<string, string> = {
  low: "bg-[#579bfc] text-white",
  medium: "bg-[#fdab3d] text-white",
  high: "bg-[#e2445c] text-white",
  critical: "bg-[#e2445c] text-white",
  urgent: "bg-[#e2445c] text-white",
};

const ragColors: Record<string, string> = {
  green: "bg-brand-green",
  amber: "bg-brand-orange",
  red: "bg-destructive",
  grey: "bg-muted-foreground/40",
  gray: "bg-muted-foreground/40",
};

function getCellValue<T>(row: T, accessor: keyof T | ((row: T) => unknown)): unknown {
  if (typeof accessor === "function") {
    return accessor(row);
  }
  return row[accessor];
}

function StatusCell({ 
  value, 
  options,
  editable,
  onChange,
  onEditLabels,
}: { 
  value: string; 
  options?: StatusOption[];
  editable?: boolean;
  onChange?: (value: string) => void;
  onEditLabels?: () => void;
}) {
  const isEmpty = value == null || String(value).trim() === "";

  const getColor = () => {
    if (isEmpty) return "bg-transparent text-muted-foreground/50 hover:bg-muted/60";
    if (options) {
      const raw = String(value);
      const option =
        options.find((o) => o.value === raw) ||
        options.find((o) => o.value.toLowerCase() === raw.toLowerCase()) ||
        options.find((o) => o.label.toLowerCase() === raw.toLowerCase());
      return option?.color || defaultStatusColors[raw] || defaultStatusColors[raw.toLowerCase()] || defaultStatusColors.not_started;
    }
    return defaultStatusColors[value] || defaultStatusColors[String(value).toLowerCase()] || defaultStatusColors.not_started;
  };

  const getLabel = () => {
    if (isEmpty) return "";
    if (options) {
      const raw = String(value);
      const option =
        options.find((o) => o.value === raw) ||
        options.find((o) => o.value.toLowerCase() === raw.toLowerCase()) ||
        options.find((o) => o.label.toLowerCase() === raw.toLowerCase());
      return option?.label || raw.replace(/_/g, " ");
    }
    return String(value).replace(/_/g, " ") || "";
  };

  // monday.com: status fills the cell when set; empty stays clear (no grey block)
  const mondayCellClass = cn(
    "w-full min-h-[32px] px-2 flex items-center justify-center",
    "rounded-[4px] text-[13px] font-medium capitalize text-center leading-tight",
    "transition-opacity",
    getColor(),
  );

  if (!editable || !onChange) {
    return <span className={mondayCellClass}>{getLabel()}</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn(mondayCellClass, "cursor-pointer hover:opacity-90")}>
          {getLabel()}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[180px] p-1">
        <DropdownMenuItem
          onClick={() => onChange("")}
          className="p-1 focus:bg-transparent"
        >
          <span className="w-full min-h-[28px] px-2 rounded-[4px] text-[13px] font-medium flex items-center justify-center text-muted-foreground hover:bg-muted">
            Clear
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {(options || Object.keys(defaultStatusColors).slice(0, 6)).map((opt) => {
          const optValue = typeof opt === "string" ? opt : opt.value;
          const optLabel = typeof opt === "string" ? opt.replace(/_/g, " ") : opt.label;
          const optColor = typeof opt === "string" ? defaultStatusColors[opt] : opt.color;
          return (
            <DropdownMenuItem
              key={optValue}
              onClick={() => onChange(optValue)}
              className="p-1 focus:bg-transparent"
            >
              <span className={cn(
                "w-full min-h-[28px] px-2 rounded-[4px] text-[13px] font-medium capitalize",
                "flex items-center justify-center",
                optColor,
              )}>
                {optLabel}
              </span>
            </DropdownMenuItem>
          );
        })}
        {onEditLabels && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                onEditLabels();
              }}
              data-testid="button-edit-status-labels"
            >
              Edit labels
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SelectCell({
  value,
  options,
  editable,
  onChange,
}: {
  value: string | number | null;
  options?: StatusOption[];
  editable?: boolean;
  onChange?: (value: string) => void;
}) {
  const getLabel = () => {
    if (options && value != null) {
      const option = options.find(o => o.value === String(value));
      return option?.label || String(value);
    }
    return value != null ? String(value) : "";
  };

  const displayLabel = getLabel();

  if (!editable || !onChange || !options) {
    return (
      <span className="text-sm truncate">
        {displayLabel || <span className="text-muted-foreground">—</span>}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="text-sm truncate cursor-pointer hover:text-primary transition-colors text-left flex items-center gap-1 max-w-full">
          <span className="truncate">{displayLabel || <span className="text-muted-foreground">Select...</span>}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px] max-h-[300px] overflow-y-auto">
        <DropdownMenuItem onClick={() => onChange("")} className="text-muted-foreground">
          <span className="text-sm">None</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn("text-sm", String(value) === opt.value && "bg-accent")}
          >
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PriorityCell({ 
  value,
  editable,
  onChange,
  options,
}: { 
  value: string;
  editable?: boolean;
  onChange?: (value: string) => void;
  options?: StatusOption[];
}) {
  const getColor = () => {
    if (options?.length) {
      const match = options.find(
        (o) => o.value === value || o.value.toLowerCase() === String(value || "").toLowerCase(),
      );
      if (match?.color) return match.color;
    }
    return priorityColors[value?.toLowerCase()] || priorityColors.medium;
  };
  const mondayCellClass = cn(
    "w-full min-h-[32px] px-2 flex items-center justify-center",
    "rounded-[4px] text-[13px] font-medium capitalize text-center leading-tight",
    getColor(),
  );
  const choices = options?.length
    ? options.map((o) => [o.value, o.color || priorityColors[o.value] || priorityColors.medium] as const)
    : Object.entries(priorityColors);

  if (!editable || !onChange) {
    return <span className={mondayCellClass}>{value || "Medium"}</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={cn(mondayCellClass, "cursor-pointer hover:opacity-90")}>
          {value || "Medium"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[140px] p-1">
        {choices.map(([priority, color]) => (
          <DropdownMenuItem
            key={priority}
            onClick={() => onChange(priority)}
            className="p-1 focus:bg-transparent capitalize"
          >
            <span className={cn(
              "w-full min-h-[28px] px-2 rounded-[4px] text-[13px] font-medium",
              "flex items-center justify-center",
              color,
            )}>
              {priority}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PersonCell({ value }: { value: PersonValue | PersonValue[] | null }) {
  if (!value) {
    return <span className="text-muted-foreground text-sm">Unassigned</span>;
  }

  const people = Array.isArray(value) ? value : [value];
  
  if (people.length === 0) {
    return <span className="text-muted-foreground text-sm">Unassigned</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-2">
        {people.slice(0, 3).map((person, idx) => (
          <Tooltip key={person.id || idx}>
            <TooltipTrigger asChild>
              <Avatar className="h-6 w-6 border-2 border-background">
                <AvatarImage src={person.profileImageUrl || undefined} />
                <AvatarFallback className="text-[10px] bg-primary/10">
                  {person.firstName?.[0] || person.email?.[0] || "?"}
                  {person.lastName?.[0] || ""}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <p>{person.firstName} {person.lastName}</p>
              {person.email && <p className="text-xs text-muted-foreground">{person.email}</p>}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      {people.length > 3 && (
        <span className="text-xs text-muted-foreground">+{people.length - 3}</span>
      )}
      {people.length === 1 && (
        <span className="text-sm truncate max-w-[100px]">
          {people[0].firstName} {people[0].lastName}
        </span>
      )}
    </div>
  );
}

function DateCell({ 
  value,
  editable,
  onChange
}: { 
  value: string | Date | null;
  editable?: boolean;
  onChange?: (value: Date | undefined) => void;
}) {
  const dateValue = value ? new Date(value) : null;
  const isOverdue = dateValue && dateValue < new Date() && dateValue.toDateString() !== new Date().toDateString();

  const displayDate = dateValue ? format(dateValue, "MMM d, yyyy") : null;

  if (!editable || !onChange) {
    return (
      <span className={cn("text-sm", isOverdue && "text-red-600 dark:text-red-400")}>
        {displayDate || <span className="text-muted-foreground">No date</span>}
      </span>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn(
          "text-sm hover:bg-accent/50 px-2 py-1 rounded transition-colors text-left",
          isOverdue && "text-red-600 dark:text-red-400"
        )}>
          {displayDate || <span className="text-muted-foreground">No date</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue || undefined}
          onSelect={onChange}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

function TagsCell({ value }: { value: string | string[] | null }) {
  if (!value) return null;
  
  const tags = Array.isArray(value) ? value : [value];
  
  if (tags.length === 0) return null;

  const tagColors = [
    "bg-status-blue text-status-blue-foreground",
    "bg-status-green text-status-green-foreground",
    "bg-status-purple text-status-purple-foreground",
    "bg-status-amber text-status-amber-foreground",
    "bg-status-red text-status-red-foreground",
  ];

  return (
    <div className="flex flex-wrap gap-1">
      {tags.slice(0, 3).map((tag, idx) => (
        <span
          key={tag}
          className={cn("px-2 py-0.5 rounded-full text-xs font-medium", tagColors[idx % tagColors.length])}
        >
          {tag}
        </span>
      ))}
      {tags.length > 3 && (
        <span className="text-xs text-muted-foreground">+{tags.length - 3}</span>
      )}
    </div>
  );
}

function ProgressCell({ value }: { value: number | null }) {
  const progress = typeof value === "number" ? value : 0;
  
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <Progress value={progress} className="h-2 flex-1" />
      <span className="text-xs text-muted-foreground w-8 text-right">{progress}%</span>
    </div>
  );
}

function RagCell({ value }: { value: string | null }) {
  const color = ragColors[value?.toLowerCase() || "grey"] || ragColors.grey;
  
  return (
    <div className="flex items-center justify-center">
      <div className={cn("h-4 w-4 rounded-full", color)} />
    </div>
  );
}

function CheckboxCell({ 
  value,
  onChange
}: { 
  value: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <Checkbox
      checked={value}
      onCheckedChange={onChange}
      className="data-[state=checked]:bg-primary"
    />
  );
}

function LinkCell({ value }: { value: string | null }) {
  if (!value) return null;
  
  return (
    <a 
      href={value} 
      target="_blank" 
      rel="noopener noreferrer"
      className="text-primary hover:underline text-sm flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <Link2 className="h-3 w-3" />
      Link
    </a>
  );
}

type NavigationDirection = "tab" | "shift-tab" | "enter" | "shift-enter" | "arrow-left" | "arrow-right" | "arrow-up" | "arrow-down";

function highlightTextParts(text: string, term: string): React.ReactNode {
  if (!term.trim()) return text;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === term.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-900 rounded px-0.5">{part}</mark>
      : part,
  );
}

function TextCell({ 
  value,
  editable,
  onChange,
  isEditing,
  onStartEdit,
  onCommit,
  onCancel,
  onNavigate,
  searchHighlightTerm,
}: { 
  value: string | null;
  editable?: boolean;
  onChange?: (value: string) => void;
  isEditing?: boolean;
  onStartEdit?: () => void;
  onCommit?: () => void;
  onCancel?: () => void;
  onNavigate?: (direction: NavigationDirection) => void;
  searchHighlightTerm?: string;
}) {
  const [editValue, setEditValue] = useState(value || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setEditValue(value || "");
    }
  }, [isEditing, value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const navigatingRef = useRef(false);

  if (isEditing && editable && onChange) {
    return (
      <input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={() => {
          if (!navigatingRef.current) {
            onChange(editValue);
            onCommit?.();
          }
          navigatingRef.current = false;
        }}
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            e.preventDefault();
            navigatingRef.current = true;
            onChange(editValue);
            onNavigate?.(e.shiftKey ? "shift-tab" : "tab");
          } else if (e.key === "Enter") {
            e.preventDefault();
            navigatingRef.current = true;
            onChange(editValue);
            onNavigate?.(e.shiftKey ? "shift-enter" : "enter");
          } else if (e.key === "Escape") {
            e.preventDefault();
            navigatingRef.current = true;
            setEditValue(value || "");
            onCancel?.();
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-transparent text-sm outline-none border-b-2 border-primary py-0.5"
        data-testid="cell-edit-input"
      />
    );
  }

  return (
    <span 
      className={cn("text-sm truncate block", editable && "cursor-text hover:bg-accent/50 px-1 py-0.5 rounded -mx-1")}
      onClick={(e) => {
        if (editable) {
          e.stopPropagation();
          onStartEdit?.();
        }
      }}
    >
      {value
        ? (searchHighlightTerm ? highlightTextParts(value, searchHighlightTerm) : value)
        : <span className="text-muted-foreground italic">Empty</span>}
    </span>
  );
}

function NumberEditCell({ 
  value,
  editable,
  onChange,
  currency,
  isEditing,
  onStartEdit,
  onCommit,
  onCancel,
  onNavigate,
}: { 
  value: number | string | null;
  editable?: boolean;
  onChange?: (value: number) => void;
  currency?: boolean;
  isEditing?: boolean;
  onStartEdit?: () => void;
  onCommit?: () => void;
  onCancel?: () => void;
  onNavigate?: (direction: NavigationDirection) => void;
}) {
  const numValue = value !== null && value !== undefined ? (typeof value === "string" ? parseFloat(value) : value) : 0;
  const [editValue, setEditValue] = useState(String(numValue || ""));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setEditValue(String(numValue || ""));
    }
  }, [isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const navigatingRef = useRef(false);

  if (isEditing && editable && onChange) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={() => {
          if (!navigatingRef.current) {
            const parsed = parseFloat(editValue);
            if (!isNaN(parsed)) onChange(parsed);
            onCommit?.();
          }
          navigatingRef.current = false;
        }}
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            e.preventDefault();
            navigatingRef.current = true;
            const parsed = parseFloat(editValue);
            if (!isNaN(parsed)) onChange(parsed);
            onNavigate?.(e.shiftKey ? "shift-tab" : "tab");
          } else if (e.key === "Enter") {
            e.preventDefault();
            navigatingRef.current = true;
            const parsed = parseFloat(editValue);
            if (!isNaN(parsed)) onChange(parsed);
            onNavigate?.(e.shiftKey ? "shift-enter" : "enter");
          } else if (e.key === "Escape") {
            e.preventDefault();
            navigatingRef.current = true;
            setEditValue(String(numValue || ""));
            onCancel?.();
          }
        }}
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-transparent text-sm outline-none border-b-2 border-primary py-0.5"
        data-testid="cell-edit-input"
      />
    );
  }

  if (value === null || value === undefined) {
    return (
      <span 
        className={cn("text-muted-foreground", editable && "cursor-text hover:bg-accent/50 px-1 py-0.5 rounded -mx-1")}
        onClick={(e) => { if (editable) { e.stopPropagation(); onStartEdit?.(); } }}
      >
        -
      </span>
    );
  }

  return (
    <span 
      className={cn("text-sm", currency && "font-medium", editable && "cursor-text hover:bg-accent/50 px-1 py-0.5 rounded -mx-1")}
      onClick={(e) => { if (editable) { e.stopPropagation(); onStartEdit?.(); } }}
    >
      {currency ? `$${numValue.toLocaleString()}` : numValue.toLocaleString()}
    </span>
  );
}

interface CellRendererProps<T> {
  column: ColumnDef<T>;
  value: unknown;
  row: T;
  onEdit?: (value: unknown) => void;
  isEditing?: boolean;
  isFocused?: boolean;
  onStartEdit?: () => void;
  onCommit?: () => void;
  onCancel?: () => void;
  onNavigate?: (direction: NavigationDirection) => void;
  searchHighlightTerm?: string;
}

/** Column types with a built-in editor — custom `render` must not swallow these when editable. */
const INLINE_EDITABLE_TYPES = new Set([
  "status",
  "select",
  "priority",
  "date",
  "checkbox",
  "text",
  "number",
  "currency",
]);

function CellRenderer<T>({ 
  column, 
  value, 
  row,
  onEdit,
  isEditing,
  isFocused: _isFocused,
  onStartEdit,
  onCommit,
  onCancel,
  onNavigate,
  searchHighlightTerm,
}: CellRendererProps<T>) {
  const editable = column.editable && !!onEdit;

  // Custom render is display-only. When the column is editable, prefer the built-in
  // editor (status/select/date/text/…) so `render` no longer silently blocks updates.
  if (column.render) {
    const useBuiltInEditor = editable && INLINE_EDITABLE_TYPES.has(column.type);
    if (!useBuiltInEditor) {
      return <>{column.render(row, value)}</>;
    }
    // text/number/currency: keep custom display until the user starts editing
    if (
      (column.type === "text" || column.type === "number" || column.type === "currency") &&
      !isEditing
    ) {
      return (
        <div
          className="w-full min-w-0 cursor-text"
          onClick={(e) => {
            e.stopPropagation();
            onStartEdit?.();
          }}
        >
          {column.render(row, value)}
        </div>
      );
    }
  }

  if (column.type === "formula") {
    const computed = column.formula ? column.formula(row) : value;
    return (
      <span className="text-[13px] tabular-nums text-foreground">
        {computed == null || computed === "" ? "—" : String(computed)}
      </span>
    );
  }

  switch (column.type) {
    case "status":
      return (
        <StatusCell 
          value={value as string} 
          options={column.options}
          editable={editable}
          onChange={onEdit as (v: string) => void}
          onEditLabels={column.onEditLabels}
        />
      );
    case "select":
      return (
        <SelectCell
          value={value as string | number | null}
          options={column.options}
          editable={editable}
          onChange={onEdit as (v: string) => void}
        />
      );
    case "priority":
      return (
        <PriorityCell 
          value={value as string}
          editable={editable}
          onChange={onEdit as (v: string) => void}
          options={column.options}
        />
      );
    case "person":
      return <PersonCell value={value as PersonValue | PersonValue[] | null} />;
    case "date":
      return (
        <DateCell 
          value={value as string | Date | null}
          editable={editable}
          onChange={(date) => onEdit?.(date?.toISOString())}
        />
      );
    case "timeline":
      const timeline = value as { start?: string; end?: string } | null;
      return (
        <span className="text-sm">
          {timeline?.start ? format(new Date(timeline.start), "MMM d") : "?"} -{" "}
          {timeline?.end ? format(new Date(timeline.end), "MMM d") : "?"}
        </span>
      );
    case "tags":
      return <TagsCell value={value as string | string[] | null} />;
    case "checkbox":
      return (
        <CheckboxCell 
          value={value as boolean}
          onChange={editable ? (checked) => onEdit?.(checked) : undefined}
        />
      );
    case "number":
      return (
        <NumberEditCell 
          value={value as number | string | null}
          editable={editable}
          onChange={editable ? (v) => onEdit?.(v) : undefined}
          isEditing={isEditing}
          onStartEdit={onStartEdit}
          onCommit={onCommit}
          onCancel={onCancel}
          onNavigate={onNavigate}
        />
      );
    case "currency":
      return (
        <NumberEditCell 
          value={value as number | string | null}
          editable={editable}
          onChange={editable ? (v) => onEdit?.(v) : undefined}
          currency
          isEditing={isEditing}
          onStartEdit={onStartEdit}
          onCommit={onCommit}
          onCancel={onCancel}
          onNavigate={onNavigate}
        />
      );
    case "link":
      return <LinkCell value={value as string | null} />;
    case "progress":
      return <ProgressCell value={value as number | null} />;
    case "rag":
      return <RagCell value={value as string | null} />;
    case "text":
    default:
      return (
        <TextCell 
          value={value as string | null}
          editable={editable}
          onChange={onEdit as (v: string) => void}
          isEditing={isEditing}
          onStartEdit={onStartEdit}
          onCommit={onCommit}
          onCancel={onCancel}
          onNavigate={onNavigate}
          searchHighlightTerm={searchHighlightTerm}
        />
      );
  }
}

export function MondayTable<T extends { id: number | string }>({
  columns,
  data,
  groups,
  onRowClick,
  onRowDoubleClick,
  onRowSelect,
  onCellEdit,
  onAddItem,
  onDeleteItems,
  onDuplicateItem,
  onArchiveItem,
  onEditItem,
  onOpenItem,
  renderRowActions,
  renderBulkActions,
  alwaysShowRowActions = false,
  rowActionsWidth,
  selectable = true,
  loading = false,
  emptyMessage = "No items yet",
  addItemLabel = "Add Item",
  className,
  gridLines = false,
  onColumnResize,
  onColumnReorder,
  columnWidthStorageKey,
  totalCount,
  conditionalFormatRules: controlledRules,
  defaultConditionalFormatRules,
  onConditionalFormatRulesChange,
  hideFormatToolbar = false,
  formatPanelOpen: controlledFormatPanelOpen,
  onFormatPanelOpenChange,
  pagination = true,
  searchHighlightTerm,
  density = "comfortable",
  onRowFilesDrop,
  expandAllSignal,
  collapseAllSignal,
  reorderable = false,
  onRowReorder,
  showColumnSummary,
}: MondayTableProps<T>) {
  const rowMinHeight =
    density === "compact" ? "min-h-[32px]" : density === "expanded" ? "min-h-[56px]" : "min-h-[44px]";
  const headerMinHeight =
    density === "compact" ? "min-h-[32px]" : density === "expanded" ? "min-h-[48px]" : "min-h-[40px]";
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [dragRowId, setDragRowId] = useState<string | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (columnWidthStorageKey) {
      try {
        const stored = localStorage.getItem(columnWidthStorageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as Record<string, number>;
          const clamped: Record<string, number> = {};
          for (const [k, v] of Object.entries(parsed)) {
            if (typeof v === "number" && Number.isFinite(v)) {
              clamped[k] = Math.max(MIN_COL_WIDTH_PX, Math.min(v, 640));
            }
          }
          return clamped;
        }
      } catch {}
    }
    return {};
  });
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [dragHeaderId, setDragHeaderId] = useState<string | null>(null);
  const [dragOverHeaderId, setDragOverHeaderId] = useState<string | null>(null);
  const [internalColumnOrder, setInternalColumnOrder] = useState<string[]>([]);
  const [internalCfRules, setInternalCfRules] = useState<ConditionalFormatRule[]>(defaultConditionalFormatRules || []);
  const [internalCfPanelOpen, setInternalCfPanelOpen] = useState(false);
  const cfPanelOpen = controlledFormatPanelOpen ?? internalCfPanelOpen;
  const setCfPanelOpen = (open: boolean) => {
    if (controlledFormatPanelOpen === undefined) setInternalCfPanelOpen(open);
    onFormatPanelOpenChange?.(open);
  };
  const [focusedCell, setFocusedCell] = useState<{ rowId: number | string; columnId: string } | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: number | string; columnId: string } | null>(null);
  const focusedCellRef = useRef(focusedCell);
  focusedCellRef.current = focusedCell;
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const cellRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

  const cfRules = controlledRules !== undefined ? controlledRules : internalCfRules;
  const setCfRules = (rules: ConditionalFormatRule[]) => {
    if (controlledRules === undefined) setInternalCfRules(rules);
    onConditionalFormatRulesChange?.(rules);
  };

  const visibleColumns = useMemo(() => {
    const filtered = columns.filter(c => !c.hidden);
    if (!onColumnReorder && internalColumnOrder.length > 0) {
      const orderMap = new Map(internalColumnOrder.map((id, idx) => [id, idx]));
      return [...filtered].sort((a, b) => {
        const aIdx = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999;
        const bIdx = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999;
        return aIdx - bIdx;
      });
    }
    return filtered;
  }, [columns, onColumnReorder, internalColumnOrder]);

  useEffect(() => {
    const initial: Record<string, number> = {};
    visibleColumns.forEach((col, idx) => {
      if (col.width) {
        const parsed = parseInt(col.width, 10);
        if (!isNaN(parsed)) {
          initial[col.id] = parsed;
        } else {
          initial[col.id] = idx === 0 ? 200 : 140;
        }
      } else {
        initial[col.id] = idx === 0 ? 200 : 140;
      }
    });
    setColumnWidths(prev => {
      const hasExisting = Object.keys(prev).length > 0;
      if (!hasExisting) return initial;
      const merged = { ...initial };
      for (const key of Object.keys(prev)) {
        if (typeof prev[key] === "number" && Number.isFinite(prev[key])) {
          merged[key] = Math.max(MIN_COL_WIDTH_PX, Math.min(prev[key], 640));
        }
      }
      return merged;
    });
  }, [visibleColumns]);

  const hasResizedWidths = Object.keys(columnWidths).length > 0;

  const resolvedRowActionsWidth =
    rowActionsWidth || (alwaysShowRowActions ? "minmax(132px, max-content)" : "40px");
  const rowActionsMinPx = alwaysShowRowActions ? 132 : 40;

  const showRowChrome = reorderable || selectable;
  const chromeColWidth = showRowChrome ? `${CHROME_COL_PX}px` : null;

  const gridTemplateColumns = useMemo(() => {
    const parts: string[] = [];
    if (chromeColWidth) parts.push(chromeColWidth);
    visibleColumns.forEach((col, idx) => {
      if (hasResizedWidths && columnWidths[col.id]) {
        parts.push(`${Math.max(MIN_COL_WIDTH_PX, columnWidths[col.id])}px`);
      } else if (col.width) {
        parts.push(col.width);
      } else if (idx === 0) {
        parts.push("minmax(200px, 1fr)");
      } else {
        parts.push("minmax(120px, auto)");
      }
    });
    if (renderRowActions) parts.push(resolvedRowActionsWidth);
    parts.push("40px");
    return parts.join(" ");
  }, [visibleColumns, chromeColWidth, renderRowActions, columnWidths, hasResizedWidths, resolvedRowActionsWidth]);

  const totalMinWidth = useMemo(() => {
    let total = 0;
    if (showRowChrome) total += CHROME_COL_PX;
    visibleColumns.forEach((col, idx) => {
      if (hasResizedWidths && columnWidths[col.id]) {
        total += Math.max(MIN_COL_WIDTH_PX, columnWidths[col.id]);
      } else if (col.width) {
        const px = parseInt(col.width, 10);
        if (!isNaN(px) && col.width.includes("px")) {
          total += px;
        } else if (!isNaN(px) && col.width.includes("%")) {
          total += Math.max(px * 12, idx === 0 ? 200 : 120);
        } else {
          total += idx === 0 ? 200 : 140;
        }
      } else {
        total += idx === 0 ? 200 : 140;
      }
    });
    if (renderRowActions) total += rowActionsMinPx;
    total += 40;
    return Math.max(total, 640);
  }, [visibleColumns, showRowChrome, renderRowActions, columnWidths, hasResizedWidths, rowActionsMinPx]);

  const handleResizeStart = useCallback((e: React.MouseEvent, columnId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(columnId);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = columnWidths[columnId] || 140;
  }, [columnWidths]);

  const handleResizeDoubleClick = useCallback((e: React.MouseEvent, columnId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!tableContainerRef.current) return;
    const colIndex = visibleColumns.findIndex(c => c.id === columnId);
    if (colIndex < 0) return;
    const cellIndex = colIndex + (showRowChrome ? 1 : 0);
    const rows = tableContainerRef.current.querySelectorAll('[style*="grid-template-columns"]');
    let maxWidth = 60;
    rows.forEach(row => {
      const cell = row.children[cellIndex] as HTMLElement | undefined;
      if (cell) {
        const clone = cell.cloneNode(true) as HTMLElement;
        clone.style.position = "absolute";
        clone.style.visibility = "hidden";
        clone.style.width = "auto";
        clone.style.whiteSpace = "nowrap";
        clone.style.overflow = "visible";
        document.body.appendChild(clone);
        const contentWidth = clone.scrollWidth + 24;
        document.body.removeChild(clone);
        if (contentWidth > maxWidth) maxWidth = contentWidth;
      }
    });
    maxWidth = Math.min(Math.max(maxWidth, MIN_COL_WIDTH_PX), 600);
    setColumnWidths(prev => {
      const next = { ...prev, [columnId]: maxWidth };
      if (columnWidthStorageKey) {
        try { localStorage.setItem(columnWidthStorageKey, JSON.stringify(next)); } catch {}
      }
      return next;
    });
    onColumnResize?.(columnId, maxWidth);
  }, [visibleColumns, showRowChrome, onColumnResize, columnWidthStorageKey]);

  useEffect(() => {
    if (!resizingColumn) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizeStartX.current;
      const newWidth = Math.max(MIN_COL_WIDTH_PX, resizeStartWidth.current + diff);
      setColumnWidths(prev => ({ ...prev, [resizingColumn]: newWidth }));
    };

    const handleMouseUp = () => {
      if (resizingColumn) {
        onColumnResize?.(resizingColumn, columnWidths[resizingColumn] || 140);
        if (columnWidthStorageKey) {
          try { localStorage.setItem(columnWidthStorageKey, JSON.stringify(columnWidths)); } catch {}
        }
      }
      setResizingColumn(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizingColumn, onColumnResize, columnWidths, columnWidthStorageKey]);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      const allIds = (groups?.flatMap(g => g.items) || data).map(item => item.id);
      setSelectedIds(new Set(allIds));
      onRowSelect?.(allIds);
    } else {
      setSelectedIds(new Set());
      onRowSelect?.([]);
    }
  }, [data, groups, onRowSelect]);

  const handleSelectRow = useCallback((id: number | string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
    onRowSelect?.(Array.from(newSelected));
  }, [selectedIds, onRowSelect]);

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  }, []);

  useEffect(() => {
    if (!expandAllSignal) return;
    setCollapsedGroups(new Set());
  }, [expandAllSignal]);

  useEffect(() => {
    if (!collapseAllSignal || !groups?.length) return;
    setCollapsedGroups(new Set(groups.map((g) => g.id)));
  }, [collapseAllSignal, groups]);

  const resolveColWidthPx = useCallback((col: ColumnDef<T>, idx: number) => {
    if (columnWidths[col.id]) return columnWidths[col.id];
    if (col.width?.includes("px")) {
      const n = parseInt(col.width, 10);
      if (!Number.isNaN(n)) return n;
    }
    return idx === 0 ? 220 : 140;
  }, [columnWidths]);

  const stickyLeftById = useMemo(() => {
    const map = new Map<string, number>();
    let left = showRowChrome ? CHROME_COL_PX : 0;
    // Only a leading sticky prefix (checkbox chrome + identity column) pins while scrolling.
    for (let idx = 0; idx < visibleColumns.length; idx++) {
      const col = visibleColumns[idx];
      if (!col.sticky) break;
      map.set(col.id, left);
      left += resolveColWidthPx(col, idx);
    }
    return map;
  }, [visibleColumns, showRowChrome, resolveColWidthPx]);

  const hasStickyColumns = stickyLeftById.size > 0;

  const allItems = useMemo(() => {
    if (groups) {
      return groups.flatMap(g => g.items);
    }
    return data;
  }, [groups, data]);

  const paginationEnabled = pagination !== false;
  const paginationOpts = typeof pagination === "object" ? pagination : {};
  const tablePagination = useTablePagination(allItems, {
    defaultPageSize: paginationOpts.defaultPageSize,
    resetKey: paginationOpts.resetKey ?? `${allItems.length}-${groups?.length ?? 0}`,
    enabled: paginationEnabled,
  });

  const visibleItemIds = useMemo(() => {
    if (!paginationEnabled) return null;
    return new Set(tablePagination.paginatedItems.map((item) => item.id));
  }, [paginationEnabled, tablePagination.paginatedItems]);

  const displayData = paginationEnabled ? tablePagination.paginatedItems : data;

  const isAllSelected = allItems.length > 0 && selectedIds.size === allItems.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < allItems.length;

  const formatMap = useMemo(
    () => evaluateConditionalFormatting(
      paginationEnabled ? tablePagination.paginatedItems : allItems,
      columns,
      cfRules,
    ),
    [paginationEnabled, tablePagination.paginatedItems, allItems, columns, cfRules]
  );

  const flatRowIds = useMemo(() => {
    if (groups) {
      return groups.flatMap((g) => {
        if (collapsedGroups.has(g.id)) return [];
        const items = visibleItemIds
          ? g.items.filter((item) => visibleItemIds.has(item.id))
          : g.items;
        return items.map((item) => item.id);
      });
    }
    return displayData.map((item) => item.id);
  }, [groups, data, collapsedGroups, displayData, visibleItemIds]);

  const editableColumnIds = useMemo(() => {
    return visibleColumns.filter(c => c.editable).map(c => c.id);
  }, [visibleColumns]);

  const isInlineEditableType = useCallback((columnId: string) => {
    const col = visibleColumns.find(c => c.id === columnId);
    if (!col) return false;
    return ["text", "number", "currency"].includes(col.type);
  }, [visibleColumns]);

  const isToggleType = useCallback((columnId: string) => {
    const col = visibleColumns.find(c => c.id === columnId);
    if (!col) return false;
    return col.type === "checkbox";
  }, [visibleColumns]);

  useEffect(() => {
    if (focusedCell && !flatRowIds.includes(focusedCell.rowId)) {
      setFocusedCell(null);
      setEditingCell(null);
    }
  }, [flatRowIds, focusedCell]);

  const cellRefKey = useCallback((rowId: number | string, colId: string) => `${rowId}::${colId}`, []);

  const focusCellElement = useCallback((rowId: number | string, colId: string) => {
    requestAnimationFrame(() => {
      const el = cellRefsMap.current.get(cellRefKey(rowId, colId));
      if (el) {
        el.focus();
        el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      }
    });
  }, [cellRefKey]);

  const navigateFromCell = useCallback((direction: NavigationDirection) => {
    const currentFocus = focusedCellRef.current;
    if (!currentFocus) return;
    const { rowId, columnId } = currentFocus;
    const rowIdx = flatRowIds.indexOf(rowId);
    const colIdx = editableColumnIds.indexOf(columnId);

    let nextRowIdx = rowIdx;
    let nextColIdx = colIdx;

    switch (direction) {
      case "tab":
        nextColIdx = colIdx + 1;
        if (nextColIdx >= editableColumnIds.length) {
          nextColIdx = 0;
          nextRowIdx = rowIdx + 1;
        }
        break;
      case "shift-tab":
        nextColIdx = colIdx - 1;
        if (nextColIdx < 0) {
          nextColIdx = editableColumnIds.length - 1;
          nextRowIdx = rowIdx - 1;
        }
        break;
      case "enter":
      case "arrow-down":
        nextRowIdx = rowIdx + 1;
        break;
      case "shift-enter":
      case "arrow-up":
        nextRowIdx = rowIdx - 1;
        break;
      case "arrow-right":
        nextColIdx = colIdx + 1;
        if (nextColIdx >= editableColumnIds.length) nextColIdx = editableColumnIds.length - 1;
        break;
      case "arrow-left":
        nextColIdx = colIdx - 1;
        if (nextColIdx < 0) nextColIdx = 0;
        break;
    }

    if (nextRowIdx < 0) nextRowIdx = 0;
    if (nextRowIdx >= flatRowIds.length) nextRowIdx = flatRowIds.length - 1;
    if (editableColumnIds.length === 0 || flatRowIds.length === 0) return;

    nextColIdx = Math.max(0, Math.min(nextColIdx, editableColumnIds.length - 1));

    const nextRowId = flatRowIds[nextRowIdx];
    const nextColId = editableColumnIds[nextColIdx];
    if (!nextColId || (nextRowId === rowId && nextColId === columnId)) return;

    setFocusedCell({ rowId: nextRowId, columnId: nextColId });

    const shouldEdit = ["tab", "shift-tab", "enter", "shift-enter"].includes(direction) && isInlineEditableType(nextColId);
    setEditingCell(shouldEdit ? { rowId: nextRowId, columnId: nextColId } : null);
    focusCellElement(nextRowId, nextColId);
  }, [flatRowIds, editableColumnIds, isInlineEditableType, focusCellElement]);

  const handleCellFocus = useCallback((rowId: number | string, columnId: string) => {
    setFocusedCell({ rowId, columnId });
  }, []);

  const handleCellStartEdit = useCallback((rowId: number | string, columnId: string) => {
    setFocusedCell({ rowId, columnId });
    if (isInlineEditableType(columnId)) {
      setEditingCell({ rowId, columnId });
    }
  }, [isInlineEditableType]);

  const handleCellCommit = useCallback(() => {
    setEditingCell(null);
  }, []);

  const handleCellCancel = useCallback(() => {
    setEditingCell(null);
  }, []);

  const handleCellKeyDown = useCallback((e: React.KeyboardEvent, rowId: number | string, columnId: string) => {
    const isEditing = editingCell?.rowId === rowId && editingCell?.columnId === columnId;
    if (isEditing) return;

    if (e.key === "Tab") {
      e.preventDefault();
      setFocusedCell({ rowId, columnId });
      navigateFromCell(e.shiftKey ? "shift-tab" : "tab");
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      if (isInlineEditableType(columnId)) {
        e.preventDefault();
        setEditingCell({ rowId, columnId });
      } else if (isToggleType(columnId)) {
        e.preventDefault();
        const cellEl = cellRefsMap.current.get(cellRefKey(rowId, columnId));
        const checkbox = cellEl?.querySelector('button[role="checkbox"]') as HTMLElement;
        if (checkbox) checkbox.click();
      } else {
        const cellEl = cellRefsMap.current.get(cellRefKey(rowId, columnId));
        const trigger = cellEl?.querySelector('button') as HTMLElement;
        if (trigger) {
          e.preventDefault();
          trigger.click();
        }
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setFocusedCell(null);
      setEditingCell(null);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedCell({ rowId, columnId });
      navigateFromCell("arrow-down");
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedCell({ rowId, columnId });
      navigateFromCell("arrow-up");
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setFocusedCell({ rowId, columnId });
      navigateFromCell("arrow-right");
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setFocusedCell({ rowId, columnId });
      navigateFromCell("arrow-left");
      return;
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && isInlineEditableType(columnId)) {
      setEditingCell({ rowId, columnId });
    }
  }, [editingCell, navigateFromCell, isInlineEditableType, isToggleType, cellRefKey]);

  const computeSummaryValue = useCallback((column: ColumnDef<T>, rows: readonly T[]) => {
    if (!column.summary) return null;
    if (typeof column.summary === "function") return column.summary(rows as T[]);
    const nums = rows
      .map((r) => {
        const raw = column.formula ? column.formula(r) : getCellValue(r, column.accessor);
        const n = typeof raw === "number" ? raw : Number(raw);
        return Number.isFinite(n) ? n : null;
      })
      .filter((n): n is number => n != null);
    if (column.summary === "count") return String(rows.length);
    if (column.summary === "filled") {
      const filled = rows.filter((r) => {
        const raw = column.formula ? column.formula(r) : getCellValue(r, column.accessor);
        return raw != null && raw !== "";
      }).length;
      return `${filled}/${rows.length}`;
    }
    if (nums.length === 0) return "—";
    if (column.summary === "sum") return String(Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100);
    if (column.summary === "avg") return String(Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100);
    return null;
  }, []);

  const summaryEnabled = showColumnSummary ?? visibleColumns.some((c) => !!c.summary);

  const renderSummaryRow = (rows: readonly T[], keySuffix: string) => {
    if (!summaryEnabled) return null;
    return (
      <div
        key={`summary-${keySuffix}`}
        className={cn("grid items-center text-[12px] text-muted-foreground", mtSummaryBg, rowMinHeight)}
        style={{ gridTemplateColumns }}
        data-testid={`table-summary-${keySuffix}`}
      >
        {showRowChrome && (
          <div
            className={cn(hasStickyColumns && mtHeaderSticky)}
            style={hasStickyColumns ? { left: 0 } : undefined}
          />
        )}
        {visibleColumns.map((column) => {
          const left = stickyLeftById.get(column.id);
          const label =
            column.summary === "sum" ? "Σ "
              : column.summary === "avg" ? "avg "
                : column.summary === "count" ? "count "
                  : column.summary === "filled" ? ""
                    : "";
          const val = computeSummaryValue(column, rows);
          return (
            <div
              key={column.id}
              className={cn(
                "px-3 py-1 tabular-nums truncate",
                left != null && `${mtHeaderSticky} shadow-[2px_0_4px_rgba(0,0,0,0.04)]`,
              )}
              style={left != null ? { left } : undefined}
            >
              {val != null ? `${label}${val}` : ""}
            </div>
          );
        })}
        {renderRowActions && <div />}
        <div />
      </div>
    );
  };

  const findGroupIdForItem = useCallback((itemId: number | string) => {
    if (!groups?.length) return undefined;
    const key = String(itemId);
    for (const g of groups) {
      if (g.items.some((i) => String(i.id) === key)) return g.id;
    }
    return undefined;
  }, [groups]);

  const handleRowDropReorder = (targetId: number | string, targetGroupId?: string) => {
    if (!onRowReorder || !dragRowId) return;
    const ids = allItems.map((i) => i.id);
    const from = ids.findIndex((id) => String(id) === dragRowId);
    const to = ids.findIndex((id) => id === targetId);
    if (from < 0 || to < 0 || from === to) {
      // Still allow group membership change when dropping onto same visual slot in another group is rare;
      // if from===to but group changed, handle via meta below when ids differ only by group
      if (from < 0 || to < 0) {
        setDragRowId(null);
        return;
      }
    }
    const next = [...ids];
    if (from !== to) {
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
    }
    const resolvedGroup = targetGroupId ?? findGroupIdForItem(targetId);
    onRowReorder(next, {
      draggedId: dragRowId.match(/^\d+$/) ? Number(dragRowId) : dragRowId,
      targetId,
      targetGroupId: resolvedGroup,
    });
    setDragRowId(null);
  };

  const renderRow = (item: T, _idx: number, groupId?: string) => {
    const isSelected = selectedIds.has(item.id);
    const rowId = String(item.id);
    const rowFormat = formatMap[rowId]?.row;
    const cellFormats = formatMap[rowId]?.cells;
    const rowStyle = rowFormat ? styleToClassAndInline(rowFormat) : null;
    
    return (
      <div
        key={item.id}
        className={cn(
          "grid items-center transition-colors group bg-card",
          rowMinHeight,
          mtRowHover,
          isSelected && mtRowSelected,
          (onRowClick || onRowDoubleClick) && "cursor-pointer",
          "border-b border-border/70",
          dragRowId === rowId && "opacity-60",
          rowStyle?.className
        )}
        style={{ gridTemplateColumns, ...rowStyle?.inlineStyle }}
        onClick={() => onRowClick?.(item)}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onRowDoubleClick?.(item);
        }}
        onDragOver={onRowFilesDrop || onRowReorder ? (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (dragRowId) e.dataTransfer.dropEffect = "move";
          else e.dataTransfer.dropEffect = "copy";
        } : undefined}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (dragRowId && onRowReorder) {
            handleRowDropReorder(item.id, groupId);
            return;
          }
          if (onRowFilesDrop) {
            const files = Array.from(e.dataTransfer.files || []);
            if (files.length) onRowFilesDrop(item, files);
          }
        }}
        data-testid={`table-row-${item.id}`}
      >
        {showRowChrome && (
          <div
            className={cn(
              "relative flex items-center justify-center gap-0 min-w-0 h-full overflow-hidden",
              gridLines && mtGridLine,
              hasStickyColumns && mtStickyCell,
              hasStickyColumns && isSelected && mtRowSelected,
            )}
            style={hasStickyColumns ? { left: 0 } : undefined}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            {reorderable && (
              <div
                className="absolute left-0 inset-y-0 w-4 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing"
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  setDragRowId(rowId);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => setDragRowId(null)}
                title="Drag to reorder"
                data-testid={`row-drag-${item.id}`}
              >
                <GripVertical className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
            {selectable && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => handleSelectRow(item.id, checked as boolean)}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "h-3.5 w-3.5 rounded-[3px] border-muted-foreground/50 bg-transparent shadow-none",
                  "opacity-0 group-hover:opacity-100 data-[state=checked]:opacity-100 transition-opacity",
                  "data-[state=checked]:bg-primary data-[state=checked]:border-primary",
                )}
                data-testid={`checkbox-row-${item.id}`}
              />
            )}
          </div>
        )}
        
        {visibleColumns.map((column, colIdx) => {
          const value = column.formula ? column.formula(item) : getCellValue(item, column.accessor);
          const isLastCol = colIdx === visibleColumns.length - 1 && !renderRowActions;
          const cellFmt = cellFormats?.[column.id];
          const cellStyle = cellFmt ? styleToClassAndInline(cellFmt) : null;
          const isCellFocused = focusedCell?.rowId === item.id && focusedCell?.columnId === column.id;
          const isCellEditing = editingCell?.rowId === item.id && editingCell?.columnId === column.id;
          const isEditable = column.editable && !!onCellEdit && (!column.editableCondition || column.editableCondition(item));
          const stickyLeft = stickyLeftById.get(column.id);
          
          return (
            <div
              key={column.id}
              ref={(el) => {
                if (el && isEditable) {
                  cellRefsMap.current.set(cellRefKey(item.id, column.id), el);
                }
              }}
              tabIndex={isEditable ? 0 : undefined}
              className={cn(
                "flex items-center overflow-hidden outline-none",
                column.type === "status" || column.type === "priority" || column.render
                  ? "px-1 py-1"
                  : "px-3 py-2",
                colIdx === 0 && "font-medium",
                gridLines && !isLastCol && mtGridLine,
                isCellFocused && !isCellEditing && mtFocusCell,
                isCellEditing && "bg-primary/10 dark:bg-primary/15",
                stickyLeft != null && `${mtStickyCell} shadow-[2px_0_4px_rgba(0,0,0,0.06)]`,
                stickyLeft != null && isSelected && mtRowSelected,
                cellStyle?.className
              )}
              style={{
                ...(cellStyle?.inlineStyle || {}),
                ...(stickyLeft != null ? { left: stickyLeft } : {}),
              }}
              onClick={(e) => {
                // Keep cell edits / focus from bubbling to row click (detail panel).
                e.stopPropagation();
                if (isEditable) {
                  handleCellStartEdit(item.id, column.id);
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
              }}
              onFocus={() => {
                if (isEditable) {
                  handleCellFocus(item.id, column.id);
                }
              }}
              onKeyDown={(e) => {
                if (isEditable) {
                  handleCellKeyDown(e, item.id, column.id);
                }
              }}
              data-testid={`cell-${column.id}-${item.id}`}
            >
              <CellRenderer
                column={column}
                value={value}
                row={item}
                onEdit={isEditable ? 
                  (newValue) => onCellEdit(item.id, column.id, newValue) : 
                  undefined
                }
                isEditing={isCellEditing}
                isFocused={isCellFocused}
                onStartEdit={() => handleCellStartEdit(item.id, column.id)}
                onCommit={handleCellCommit}
                searchHighlightTerm={searchHighlightTerm}
                onCancel={handleCellCancel}
                onNavigate={navigateFromCell}
              />
            </div>
          );
        })}

        {renderRowActions && (
          <div
            className={cn(
              "px-1.5 flex items-center justify-end gap-0.5 overflow-visible shrink-0 transition-opacity",
              alwaysShowRowActions ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            {renderRowActions(item)}
          </div>
        )}

        <div
          className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`row-menu-${item.id}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onOpenItem && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpenItem(item); }}>
                  <Eye className="h-4 w-4 mr-2" /> Open
                </DropdownMenuItem>
              )}
              {onEditItem && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditItem(item); }}>
                  <Edit className="h-4 w-4 mr-2" /> Edit
                </DropdownMenuItem>
              )}
              {onDuplicateItem && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicateItem(item.id); }}>
                  <Copy className="h-4 w-4 mr-2" /> Duplicate
                </DropdownMenuItem>
              )}
              {onArchiveItem && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchiveItem(item.id); }}>
                  <Archive className="h-4 w-4 mr-2" /> Archive
                </DropdownMenuItem>
              )}
              {(onOpenItem || onEditItem || onDuplicateItem || onArchiveItem) && onDeleteItems && <DropdownMenuSeparator />}
              {onDeleteItems && (
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDeleteItems([item.id]); }}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  const renderGroup = (group: GroupDef<T>) => {
    const isCollapsed = collapsedGroups.has(group.id);
    const pageItems = visibleItemIds
      ? group.items.filter((item) => visibleItemIds.has(item.id))
      : group.items;
    if (visibleItemIds && pageItems.length === 0) return null;

    const colorValue = group.color || "";
    const isRawColor =
      colorValue.startsWith("#") ||
      colorValue.startsWith("hsl") ||
      colorValue.startsWith("rgb");

    return (
      <div key={group.id} className="mb-4" data-testid={`table-group-${group.id}`}>
        <button
          onClick={() => toggleGroup(group.id)}
          className={cn(
            "flex items-center gap-2 w-full px-2 py-1.5 font-bold text-sm tracking-tight",
            "hover:bg-muted/50 dark:hover:bg-white/[0.04] transition-colors text-left",
            !isRawColor && (group.color || "text-foreground")
          )}
          style={
            isRawColor
              ? { color: colorValue }
              : undefined
          }
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
          )}
          <span
            className="h-6 w-1.5 rounded-full shrink-0"
            style={isRawColor ? { backgroundColor: colorValue } : undefined}
          />
          <span className={cn(!isRawColor && "text-foreground")}>{group.title}</span>
          <span className="text-xs font-normal text-muted-foreground ml-1">
            {group.count ?? group.items.length}
          </span>
          {group.summary && (
            <span className="text-muted-foreground ml-auto text-xs font-normal">{group.summary}</span>
          )}
        </button>
        
        {!isCollapsed && (
          <div className="mt-1">
            {pageItems.map((item, idx) => renderRow(item, idx, group.id))}
            {renderSummaryRow(pageItems, group.id)}
            {onAddItem && (
              <button
                onClick={() => onAddItem(group.id)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
                data-testid={`add-item-${group.id}`}
                onDragOver={onRowReorder ? (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dragRowId) e.dataTransfer.dropEffect = "move";
                } : undefined}
                onDrop={onRowReorder ? (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!dragRowId) return;
                  // Drop onto empty area / add-row of a group → move into that group
                  const ids = allItems.map((i) => i.id);
                  const from = ids.findIndex((id) => String(id) === dragRowId);
                  if (from < 0) { setDragRowId(null); return; }
                  const next = [...ids];
                  const [moved] = next.splice(from, 1);
                  // Append within overall order at end of this group's items
                  const lastInGroup = group.items[group.items.length - 1];
                  let insertAt = lastInGroup
                    ? next.findIndex((id) => String(id) === String(lastInGroup.id)) + 1
                    : next.length;
                  if (insertAt < 0) insertAt = next.length;
                  next.splice(insertAt, 0, moved);
                  onRowReorder(next, {
                    draggedId: dragRowId.match(/^\d+$/) ? Number(dragRowId) : dragRowId,
                    targetId: lastInGroup?.id ?? moved,
                    targetGroupId: group.id,
                  });
                  setDragRowId(null);
                } : undefined}
              >
                <Plus className="h-4 w-4" />
                {addItemLabel}
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={cn("rounded-md border border-border/10 bg-card", className)}>
        <div className="p-8 text-center text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  const activeCfRuleCount = cfRules.filter(r => r.enabled).length;
  // When parent owns Format (toolbar), never render the in-table Format strip
  const showInlineFormatToolbar = !hideFormatToolbar && onFormatPanelOpenChange == null;

  return (
    <div className={cn(`rounded-lg border ${mtBorder} bg-card w-full max-w-full min-w-0 shadow-[0_4px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_8px_rgba(0,0,0,0.25)]`, className)}>
      {selectedIds.size > 0 ? (
        <div className={cn("flex items-center gap-3 px-4 py-2", "bg-primary/10 dark:bg-primary/20 border-b border-border")}>
          <span className="text-sm font-medium text-foreground">{selectedIds.size} selected</span>
          {renderBulkActions && renderBulkActions(Array.from(selectedIds))}
          {onDeleteItems && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onDeleteItems(Array.from(selectedIds))}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => { setSelectedIds(new Set()); onRowSelect?.([]); }}>
            Clear Selection
          </Button>
        </div>
      ) : showInlineFormatToolbar ? (
        <div className="flex items-center justify-end px-2 py-1 border-b border-border/80">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCfPanelOpen(true)}
                className={cn(
                  "text-muted-foreground hover:text-foreground hover:bg-muted",
                  activeCfRuleCount > 0 && "text-primary",
                )}
                data-testid="button-conditional-formatting"
              >
                <Paintbrush className="h-3.5 w-3.5 mr-1.5" />
                Format
                {activeCfRuleCount > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5">
                    {activeCfRuleCount}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Conditional Formatting</TooltipContent>
          </Tooltip>
        </div>
      ) : null}

      <div
        className="w-full max-w-full min-w-0 overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] overscroll-x-contain touch-pan-x [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30"
        ref={tableContainerRef}
      >
        <div style={{ minWidth: `${totalMinWidth}px` }}>
          <div
            className={cn(
              "grid items-center text-[13px] font-medium text-muted-foreground sticky top-0 z-20",
              mtHeaderBg,
              headerMinHeight,
              "border-b border-border",
            )}
            style={{ gridTemplateColumns }}
          >
            {showRowChrome && (
              <div
                className={cn(
                  "flex items-center justify-center min-w-0 overflow-hidden",
                  gridLines && mtGridLine,
                  hasStickyColumns && mtHeaderSticky,
                )}
                style={hasStickyColumns ? { left: 0 } : undefined}
              >
                {selectable ? (
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    className={cn(
                      "h-3.5 w-3.5 rounded-[3px] border-muted-foreground/50 bg-transparent shadow-none",
                      !isAllSelected && !isSomeSelected && "opacity-40",
                    )}
                    data-testid="checkbox-select-all"
                  />
                ) : null}
              </div>
            )}
            
            {visibleColumns.map((column, colIdx) => {
              const Icon = columnTypeIcons[column.type];
              const isLastCol = colIdx === visibleColumns.length - 1 && !renderRowActions;
              const isDragSource = dragHeaderId === column.id;
              const isDragOver = dragOverHeaderId === column.id && dragHeaderId !== column.id;
              const stickyLeft = stickyLeftById.get(column.id);
              
              return (
                <div
                  key={column.id}
                  className={cn(
                    "px-3 py-2 flex items-center gap-1.5 relative select-none cursor-grab",
                    gridLines && !isLastCol && mtGridLine,
                    isDragSource && "opacity-40",
                    isDragOver && "bg-primary/20",
                    stickyLeft != null && `${mtHeaderSticky} shadow-[2px_0_4px_rgba(0,0,0,0.04)]`,
                  )}
                  style={stickyLeft != null ? { left: stickyLeft } : undefined}
                  draggable
                  data-testid={`column-header-${column.id}`}
                  onDragStart={(e) => {
                    setDragHeaderId(column.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", column.id);
                  }}
                  onDragOver={(e) => {
                    if (!dragHeaderId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDragOverHeaderId(column.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverHeaderId === column.id) setDragOverHeaderId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!dragHeaderId || dragHeaderId === column.id) return;
                    if (onColumnReorder) {
                      onColumnReorder(dragHeaderId, column.id);
                    } else {
                      const currentIds = visibleColumns.map(c => c.id);
                      const fromIdx = currentIds.indexOf(dragHeaderId);
                      const toIdx = currentIds.indexOf(column.id);
                      if (fromIdx >= 0 && toIdx >= 0) {
                        currentIds.splice(fromIdx, 1);
                        currentIds.splice(toIdx, 0, dragHeaderId);
                        setInternalColumnOrder(currentIds);
                      }
                    }
                    setDragHeaderId(null);
                    setDragOverHeaderId(null);
                  }}
                  onDragEnd={() => {
                    setDragHeaderId(null);
                    setDragOverHeaderId(null);
                  }}
                >
                  <Icon className="h-3.5 w-3.5 opacity-50 flex-shrink-0" />
                  <span className="truncate" title={column.header}>
                    {column.header}
                  </span>
                  {column.sticky && (
                    <Pin className="h-3 w-3 text-primary shrink-0" aria-label="Pinned" />
                  )}
                  {isDragOver && (
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary z-10" />
                  )}
                  <div
                    className={cn(
                      "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize",
                      "bg-transparent hover:bg-primary/30 transition-colors",
                      resizingColumn === column.id && "bg-primary/50"
                    )}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleResizeStart(e, column.id);
                    }}
                    onDoubleClick={(e) => handleResizeDoubleClick(e, column.id)}
                    style={{ visibility: "visible" }}
                  />
                </div>
              );
            })}

            {renderRowActions && <div />}
            
            <div />
          </div>

          {groups ? (
            <div className="p-2">
              {groups.map(renderGroup)}
            </div>
          ) : allItems.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="mb-4">{emptyMessage}</p>
              {onAddItem && (
                <Button onClick={() => onAddItem()} data-testid="button-add-first-item">
                  <Plus className="h-4 w-4 mr-1" /> {addItemLabel}
                </Button>
              )}
            </div>
          ) : (
            <div>
              {displayData.map((item, idx) => renderRow(item, idx))}
              {renderSummaryRow(displayData, "all")}
              {onAddItem && (
                <button
                  onClick={() => onAddItem()}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-primary hover:bg-muted transition-colors border-t border-border/80"
                  data-testid="button-add-item"
                >
                  <Plus className="h-4 w-4" />
                  {addItemLabel}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {allItems.length > 0 && paginationEnabled ? (
        <TablePagination
          page={tablePagination.page}
          totalPages={tablePagination.totalPages}
          total={tablePagination.total}
          startIndex={tablePagination.startIndex}
          endIndex={tablePagination.endIndex}
          pageSize={tablePagination.pageSize}
          onPageChange={tablePagination.setPage}
          onPageSizeChange={tablePagination.setPageSize}
          extra={
            <>
              {totalCount != null && totalCount !== allItems.length && (
                <span className="text-muted-foreground/80">({allItems.length} of {totalCount} filtered)</span>
              )}
              {selectedIds.size > 0 && (
                <span data-testid="table-selected-count">{selectedIds.size} selected</span>
              )}
            </>
          }
        />
      ) : allItems.length > 0 ? (
        <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground border-t border-border/20" data-testid="table-record-count">
          <span>
            {totalCount != null && totalCount !== allItems.length ? (
              <>{allItems.length} of {totalCount} records</>
            ) : (
              <>{allItems.length} {allItems.length === 1 ? "record" : "records"}</>
            )}
          </span>
          {selectedIds.size > 0 && (
            <span data-testid="table-selected-count">{selectedIds.size} selected</span>
          )}
        </div>
      ) : null}

      <ConditionalFormattingPanel
        open={cfPanelOpen}
        onOpenChange={setCfPanelOpen}
        rules={cfRules}
        onRulesChange={setCfRules}
        columns={columns}
        data={allItems}
      />
    </div>
  );
}

export default MondayTable;
