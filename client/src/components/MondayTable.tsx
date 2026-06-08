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
  Plus, MoreHorizontal, ChevronDown, ChevronRight, GripVertical,
  Text, Hash, Calendar as CalendarIcon, User, Tag, CheckSquare, 
  Link2, BarChart3, AlertCircle, Copy, Archive, Trash2, Edit, Eye,
  EyeOff, ArrowUpDown, Filter, Paintbrush
} from "lucide-react";
import { format } from "date-fns";
import {
  ConditionalFormatRule,
  evaluateConditionalFormatting,
  styleToClassAndInline,
} from "@/lib/conditionalFormatting";
import { ConditionalFormattingPanel } from "@/components/ConditionalFormattingPanel";

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
  | "rag";

export interface StatusOption {
  value: string;
  label: string;
  color: string;
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
  sticky?: boolean;
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
  onRowSelect?: (selectedIds: (number | string)[]) => void;
  onCellEdit?: (rowId: number | string, columnId: string, value: unknown) => void;
  onAddItem?: (groupId?: string) => void;
  onDeleteItems?: (ids: (number | string)[]) => void;
  onDuplicateItem?: (id: number | string) => void;
  onArchiveItem?: (id: number | string) => void;
  onEditItem?: (row: T) => void;
  renderRowActions?: (row: T) => React.ReactNode;
  renderBulkActions?: (selectedIds: (number | string)[]) => React.ReactNode;
  alwaysShowRowActions?: boolean;
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
};

export const defaultStatusColors: Record<string, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-status-green text-status-green-foreground",
  working_on_it: "bg-status-amber text-status-amber-foreground",
  done: "bg-status-blue text-status-blue-foreground",
  complete: "bg-status-blue text-status-blue-foreground",
  completed: "bg-status-blue text-status-blue-foreground",
  stuck: "bg-status-red text-status-red-foreground",
  delayed: "bg-status-red text-status-red-foreground",
  at_risk: "bg-status-amber text-status-amber-foreground",
  active: "bg-status-green text-status-green-foreground",
  approved: "bg-status-purple text-status-purple-foreground",
  on_hold: "bg-status-amber text-status-amber-foreground",
  not_applicable: "bg-muted text-muted-foreground",
  draft: "bg-muted text-muted-foreground",
  pending: "bg-status-amber text-status-amber-foreground",
  cancelled: "bg-muted text-muted-foreground",
  closed: "bg-muted text-muted-foreground",
  archived: "bg-muted text-muted-foreground",
  fit: "bg-status-green text-status-green-foreground",
  gap: "bg-status-red text-status-red-foreground",
  workaround: "bg-status-amber text-status-amber-foreground",
  custom_dev: "bg-status-purple text-status-purple-foreground",
  not_assessed: "bg-muted text-muted-foreground",
  critical: "bg-status-red text-status-red-foreground",
  high: "bg-status-amber text-status-amber-foreground",
  medium: "bg-status-blue text-status-blue-foreground",
  low: "bg-status-green text-status-green-foreground",
  simple: "bg-status-green text-status-green-foreground",
  complex: "bg-status-red text-status-red-foreground",
};

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-status-blue text-status-blue-foreground",
  high: "bg-status-amber text-status-amber-foreground",
  critical: "bg-status-red text-status-red-foreground",
  urgent: "bg-status-red text-status-red-foreground",
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
  onChange 
}: { 
  value: string; 
  options?: StatusOption[];
  editable?: boolean;
  onChange?: (value: string) => void;
}) {
  const getColor = () => {
    if (options) {
      const option = options.find(o => o.value === value);
      return option?.color || defaultStatusColors[value] || defaultStatusColors.not_started;
    }
    return defaultStatusColors[value] || defaultStatusColors.not_started;
  };

  const getLabel = () => {
    if (options) {
      const option = options.find(o => o.value === value);
      return option?.label || value?.replace(/_/g, " ");
    }
    return value?.replace(/_/g, " ") || "Not Set";
  };

  if (!editable || !onChange) {
    return (
      <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium capitalize inline-block", getColor())}>
        {getLabel()}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn(
          "px-2.5 py-1 rounded-full text-xs font-medium capitalize cursor-pointer hover:opacity-80 transition-opacity",
          getColor()
        )}>
          {getLabel()}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[140px]">
        {(options || Object.keys(defaultStatusColors).slice(0, 6)).map((opt) => {
          const optValue = typeof opt === "string" ? opt : opt.value;
          const optLabel = typeof opt === "string" ? opt.replace(/_/g, " ") : opt.label;
          const optColor = typeof opt === "string" ? defaultStatusColors[opt] : opt.color;
          return (
            <DropdownMenuItem
              key={optValue}
              onClick={() => onChange(optValue)}
              className="capitalize"
            >
              <span className={cn("px-2 py-0.5 rounded-full text-xs mr-2", optColor)}>
                {optLabel}
              </span>
            </DropdownMenuItem>
          );
        })}
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
  onChange
}: { 
  value: string;
  editable?: boolean;
  onChange?: (value: string) => void;
}) {
  const getColor = () => priorityColors[value?.toLowerCase()] || priorityColors.medium;

  if (!editable || !onChange) {
    return (
      <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium capitalize inline-block", getColor())}>
        {value || "Medium"}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn(
          "px-2.5 py-1 rounded-full text-xs font-medium capitalize cursor-pointer hover:opacity-80 transition-opacity",
          getColor()
        )}>
          {value || "Medium"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[120px]">
        {Object.entries(priorityColors).map(([priority, color]) => (
          <DropdownMenuItem
            key={priority}
            onClick={() => onChange(priority)}
            className="capitalize"
          >
            <span className={cn("px-2 py-0.5 rounded-full text-xs mr-2", color)}>
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

function NumberCell({ value, currency }: { value: number | string | null; currency?: boolean }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">-</span>;
  }
  
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  
  if (currency) {
    return <span className="text-sm font-medium">${numValue.toLocaleString()}</span>;
  }
  
  return <span className="text-sm">{numValue.toLocaleString()}</span>;
}

type NavigationDirection = "tab" | "shift-tab" | "enter" | "shift-enter" | "arrow-left" | "arrow-right" | "arrow-up" | "arrow-down";

function TextCell({ 
  value,
  editable,
  onChange,
  isEditing,
  onStartEdit,
  onCommit,
  onCancel,
  onNavigate,
}: { 
  value: string | null;
  editable?: boolean;
  onChange?: (value: string) => void;
  isEditing?: boolean;
  onStartEdit?: () => void;
  onCommit?: () => void;
  onCancel?: () => void;
  onNavigate?: (direction: NavigationDirection) => void;
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
      {value || <span className="text-muted-foreground italic">Empty</span>}
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
}

function CellRenderer<T>({ 
  column, 
  value, 
  row,
  onEdit,
  isEditing,
  isFocused,
  onStartEdit,
  onCommit,
  onCancel,
  onNavigate,
}: CellRendererProps<T>) {
  const editable = column.editable && !!onEdit;

  switch (column.type) {
    case "status":
      return (
        <StatusCell 
          value={value as string} 
          options={column.options}
          editable={editable}
          onChange={onEdit as (v: string) => void}
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
        />
      );
  }
}

export function MondayTable<T extends { id: number | string }>({
  columns,
  data,
  groups,
  onRowClick,
  onRowSelect,
  onCellEdit,
  onAddItem,
  onDeleteItems,
  onDuplicateItem,
  onArchiveItem,
  onEditItem,
  renderRowActions,
  renderBulkActions,
  alwaysShowRowActions = false,
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
}: MondayTableProps<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (columnWidthStorageKey) {
      try {
        const stored = localStorage.getItem(columnWidthStorageKey);
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return {};
  });
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [dragHeaderId, setDragHeaderId] = useState<string | null>(null);
  const [dragOverHeaderId, setDragOverHeaderId] = useState<string | null>(null);
  const [internalColumnOrder, setInternalColumnOrder] = useState<string[]>([]);
  const [internalCfRules, setInternalCfRules] = useState<ConditionalFormatRule[]>(defaultConditionalFormatRules || []);
  const [cfPanelOpen, setCfPanelOpen] = useState(false);
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
        if (prev[key]) merged[key] = prev[key];
      }
      return merged;
    });
  }, [visibleColumns]);

  const hasResizedWidths = Object.keys(columnWidths).length > 0;

  const gridTemplateColumns = useMemo(() => {
    const parts: string[] = [];
    if (selectable) parts.push("40px");
    visibleColumns.forEach((col, idx) => {
      if (hasResizedWidths && columnWidths[col.id]) {
        parts.push(`${columnWidths[col.id]}px`);
      } else if (col.width) {
        parts.push(col.width);
      } else if (idx === 0) {
        parts.push("minmax(200px, 1fr)");
      } else {
        parts.push("minmax(120px, auto)");
      }
    });
    if (renderRowActions) parts.push("40px");
    parts.push("40px");
    return parts.join(" ");
  }, [visibleColumns, selectable, renderRowActions, columnWidths, hasResizedWidths]);

  const totalMinWidth = useMemo(() => {
    let total = 0;
    if (selectable) total += 40;
    visibleColumns.forEach((col, idx) => {
      if (hasResizedWidths && columnWidths[col.id]) {
        total += columnWidths[col.id];
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
    if (renderRowActions) total += 40;
    total += 40;
    return Math.max(total, 640);
  }, [visibleColumns, selectable, renderRowActions, columnWidths, hasResizedWidths]);

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
    const cellIndex = colIndex + (selectable ? 1 : 0);
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
    maxWidth = Math.min(maxWidth, 600);
    setColumnWidths(prev => {
      const next = { ...prev, [columnId]: maxWidth };
      if (columnWidthStorageKey) {
        try { localStorage.setItem(columnWidthStorageKey, JSON.stringify(next)); } catch {}
      }
      return next;
    });
    onColumnResize?.(columnId, maxWidth);
  }, [visibleColumns, selectable, onColumnResize, columnWidthStorageKey]);

  useEffect(() => {
    if (!resizingColumn) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizeStartX.current;
      const newWidth = Math.max(60, resizeStartWidth.current + diff);
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

  const allItems = useMemo(() => {
    if (groups) {
      return groups.flatMap(g => g.items);
    }
    return data;
  }, [groups, data]);

  const isAllSelected = allItems.length > 0 && selectedIds.size === allItems.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < allItems.length;

  const formatMap = useMemo(
    () => evaluateConditionalFormatting(allItems, columns, cfRules),
    [allItems, columns, cfRules]
  );

  const flatRowIds = useMemo(() => {
    if (groups) {
      return groups.flatMap(g => collapsedGroups.has(g.id) ? [] : g.items.map(item => item.id));
    }
    return data.map(item => item.id);
  }, [groups, data, collapsedGroups]);

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

  const renderRow = (item: T, idx: number) => {
    const isSelected = selectedIds.has(item.id);
    const rowId = String(item.id);
    const rowFormat = formatMap[rowId]?.row;
    const cellFormats = formatMap[rowId]?.cells;
    const rowStyle = rowFormat ? styleToClassAndInline(rowFormat) : null;
    
    return (
      <div
        key={item.id}
        className={cn(
          "grid items-center min-h-[44px] transition-colors group",
          "hover:bg-accent/30",
          isSelected && "bg-primary/5",
          onRowClick && "cursor-pointer",
          gridLines ? "border-b border-border/30" : "border-b border-border/10",
          rowStyle?.className
        )}
        style={{ gridTemplateColumns, ...rowStyle?.inlineStyle }}
        onClick={() => onRowClick?.(item)}
        data-testid={`table-row-${item.id}`}
      >
        {selectable && (
          <div className={cn(
            "flex items-center justify-center px-2",
            gridLines && "border-r border-border/30"
          )}>
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => handleSelectRow(item.id, checked as boolean)}
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 data-[state=checked]:opacity-100 transition-opacity"
              data-testid={`checkbox-row-${item.id}`}
            />
          </div>
        )}
        
        {visibleColumns.map((column, colIdx) => {
          const value = getCellValue(item, column.accessor);
          const isLastCol = colIdx === visibleColumns.length - 1 && !renderRowActions;
          const cellFmt = cellFormats?.[column.id];
          const cellStyle = cellFmt ? styleToClassAndInline(cellFmt) : null;
          const isCellFocused = focusedCell?.rowId === item.id && focusedCell?.columnId === column.id;
          const isCellEditing = editingCell?.rowId === item.id && editingCell?.columnId === column.id;
          const isEditable = column.editable && !!onCellEdit && (!column.editableCondition || column.editableCondition(item));
          
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
                "px-3 py-2 flex items-center overflow-hidden outline-none",
                colIdx === 0 && "font-medium",
                gridLines && !isLastCol && "border-r border-border/30",
                isCellFocused && !isCellEditing && "bg-primary/5 border-b-2 border-b-primary/60",
                isCellEditing && "bg-primary/5",
                cellStyle?.className
              )}
              style={cellStyle?.inlineStyle}
              onClick={() => {
                if (isEditable) {
                  handleCellStartEdit(item.id, column.id);
                }
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
                onCancel={handleCellCancel}
                onNavigate={navigateFromCell}
              />
            </div>
          );
        })}

        {renderRowActions && (
          <div className={cn(
            "px-2 flex items-center justify-center transition-opacity",
            alwaysShowRowActions ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}>
            {renderRowActions(item)}
          </div>
        )}

        <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7" data-testid={`row-menu-${item.id}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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
              {(onEditItem || onDuplicateItem || onArchiveItem) && onDeleteItems && <DropdownMenuSeparator />}
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
    
    return (
      <div key={group.id} className="mb-4" data-testid={`table-group-${group.id}`}>
        <button
          onClick={() => toggleGroup(group.id)}
          className={cn(
            "flex items-center gap-2 w-full px-3 py-2 rounded-lg font-medium text-sm",
            "hover:bg-accent/50 transition-colors text-left",
            group.color || "bg-primary/10"
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          <span>{group.title}</span>
          <Badge variant="secondary" className="ml-2">
            {group.count ?? group.items.length}
          </Badge>
          {group.summary && (
            <span className="text-muted-foreground ml-auto text-xs">{group.summary}</span>
          )}
        </button>
        
        {!isCollapsed && (
          <div className="mt-1">
            {group.items.map((item, idx) => renderRow(item, idx))}
            {onAddItem && (
              <button
                onClick={() => onAddItem(group.id)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
                data-testid={`add-item-${group.id}`}
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

  return (
    <div className={cn("rounded-md border border-border/10 bg-card w-full max-w-full min-w-0", className)}>
      {selectedIds.size > 0 ? (
        <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 border-b border-border/10">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
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
      ) : (
        <div className="flex items-center justify-end px-2 py-1 border-b border-border/10">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCfPanelOpen(true)}
                className={cn(activeCfRuleCount > 0 && "text-primary")}
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
      )}

      <div
        className="w-full max-w-full min-w-0 overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] overscroll-x-contain touch-pan-x [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
        ref={tableContainerRef}
      >
        <div style={{ minWidth: `${totalMinWidth}px` }}>
          <div
            className={cn(
              "grid items-center bg-muted min-h-[40px] text-sm font-medium text-muted-foreground sticky top-0 z-20",
              gridLines ? "border-b-2 border-border/40" : "border-b border-border/10"
            )}
            style={{ gridTemplateColumns }}
          >
            {selectable && (
              <div className={cn(
                "flex items-center justify-center px-2",
                gridLines && "border-r border-border/30"
              )}>
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  className={cn(!isAllSelected && !isSomeSelected && "opacity-50")}
                  data-testid="checkbox-select-all"
                />
              </div>
            )}
            
            {visibleColumns.map((column, colIdx) => {
              const Icon = columnTypeIcons[column.type];
              const isLastCol = colIdx === visibleColumns.length - 1 && !renderRowActions;
              const isDragSource = dragHeaderId === column.id;
              const isDragOver = dragOverHeaderId === column.id && dragHeaderId !== column.id;
              
              return (
                <div
                  key={column.id}
                  className={cn(
                    "px-3 py-2 flex items-center gap-1.5 relative select-none cursor-grab",
                    gridLines && !isLastCol && "border-r border-border/30",
                    isDragSource && "opacity-40",
                    isDragOver && "bg-primary/10"
                  )}
                  draggable
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
                  data-testid={`column-header-${column.id}`}
                >
                  <Icon className="h-3.5 w-3.5 opacity-50 flex-shrink-0" />
                  <span className="truncate" title={column.header}>
                    {column.header}
                  </span>
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
              {data.map((item, idx) => renderRow(item, idx))}
              {onAddItem && (
                <button
                  onClick={() => onAddItem()}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors border-t border-border/10"
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

      {allItems.length > 0 && (
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
      )}

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
