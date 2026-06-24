import { useState, useCallback, useMemo, useEffect, memo, Fragment } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { SubmitForm } from "@/components/ui/submit-form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, MoreHorizontal, ChevronDown, ChevronRight, ChevronLeft,
  Text, Hash, Calendar as CalendarIcon, User, Tag, CheckSquare, 
  Link2, BarChart3, AlertCircle, Copy, Archive, Trash2, Edit, Eye,
  Filter, Search, Settings2, Save, Star, Columns, Grid3X3, List,
  GanttChart, FileText, PieChart, Layers, X, Check, Grip,
  ArrowUpDown, SortAsc, SortDesc, Group, FolderOpen, LayoutGrid, Clock, GripVertical
} from "lucide-react";
import { AppKanbanBoard } from "@/components/kanban";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, addDays } from "date-fns";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { TablePagination } from "@/components/TablePagination";

export type ViewType = 
  | "table" 
  | "kanban" 
  | "calendar" 
  | "gantt" 
  | "list" 
  | "form" 
  | "document" 
  | "chart";

export type ColumnType = 
  | "text" 
  | "status" 
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
  | "email"
  | "phone"
  | "dropdown"
  | "multiselect"
  | "rating"
  | "formula"
  | "lookup"
  | "rollup"
  | "autonumber"
  | "created_time"
  | "modified_time"
  | "created_by"
  | "modified_by";

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
  options?: StatusOption[];
  hidden?: boolean;
  sticky?: boolean;
  required?: boolean;
  defaultValue?: unknown;
}

export interface FilterDef {
  id: string;
  columnId: string;
  operator: "equals" | "contains" | "gt" | "lt" | "gte" | "lte" | "isEmpty" | "isNotEmpty";
  value: unknown;
}

export interface SortDef {
  columnId: string;
  direction: "asc" | "desc";
}

export interface GroupDef {
  columnId: string;
}

export interface SavedView {
  id: string;
  name: string;
  viewType: ViewType;
  columns: string[];
  filters: FilterDef[];
  sorts: SortDef[];
  groups: GroupDef[];
  isDefault?: boolean;
  createdAt: string;
}

export interface UniversalViewSystemProps<T extends { id: number | string }> {
  columns: ColumnDef<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
  onCellEdit?: (rowId: number | string, columnId: string, value: unknown) => void | Promise<void>;
  onAddItem?: () => void;
  onInlineAddItem?: (data: Partial<T>) => void;
  onDeleteItems?: (ids: (number | string)[]) => void;
  onDuplicateItem?: (id: number | string) => void;
  onArchiveItem?: (id: number | string) => void;
  onColumnsChange?: (columns: ColumnDef<T>[]) => void;
  onAddColumn?: (column: ColumnDef<T>) => void;
  onViewChange?: (view: SavedView) => void;
  savedViews?: SavedView[];
  onSaveView?: (view: SavedView) => void;
  onDeleteView?: (viewId: string) => void;
  dateField?: keyof T;
  statusField?: keyof T;
  titleField?: keyof T;
  loading?: boolean;
  emptyMessage?: string;
  addItemLabel?: string;
  className?: string;
  moduleId?: string;
  showViewSwitcher?: boolean;
  defaultView?: ViewType;
  enabledViews?: ViewType[];
  initialGroupColumnId?: string;
}

const viewTypeConfig: Record<ViewType, { label: string; icon: typeof Text; description: string }> = {
  table: { label: "Table", icon: Grid3X3, description: "Spreadsheet-style data view" },
  kanban: { label: "Kanban", icon: Columns, description: "Board with draggable cards" },
  calendar: { label: "Calendar", icon: CalendarIcon, description: "Date-based view" },
  gantt: { label: "Timeline", icon: GanttChart, description: "Gantt chart view" },
  list: { label: "List", icon: List, description: "Simple list view" },
  form: { label: "Form", icon: FileText, description: "Data entry form" },
  document: { label: "Document", icon: FileText, description: "Wiki-style documentation" },
  chart: { label: "Chart", icon: PieChart, description: "Data visualization" },
};

const columnTypeConfig: Record<ColumnType, { label: string; icon: typeof Text; description: string }> = {
  text: { label: "Text", icon: Text, description: "Single line text" },
  status: { label: "Status", icon: AlertCircle, description: "Status with colors" },
  priority: { label: "Priority", icon: AlertCircle, description: "Priority levels" },
  person: { label: "Person", icon: User, description: "Assign people" },
  date: { label: "Date", icon: CalendarIcon, description: "Date picker" },
  timeline: { label: "Timeline", icon: GanttChart, description: "Date range" },
  tags: { label: "Tags", icon: Tag, description: "Multiple tags" },
  checkbox: { label: "Checkbox", icon: CheckSquare, description: "Boolean toggle" },
  number: { label: "Number", icon: Hash, description: "Numeric value" },
  currency: { label: "Currency", icon: Hash, description: "Money value" },
  link: { label: "Link", icon: Link2, description: "URL link" },
  progress: { label: "Progress", icon: BarChart3, description: "Progress bar" },
  rag: { label: "RAG Status", icon: AlertCircle, description: "Red/Amber/Green" },
  email: { label: "Email", icon: Text, description: "Email address" },
  phone: { label: "Phone", icon: Text, description: "Phone number" },
  dropdown: { label: "Dropdown", icon: ChevronDown, description: "Single select" },
  multiselect: { label: "Multi-select", icon: Layers, description: "Multiple selections" },
  rating: { label: "Rating", icon: Star, description: "Star rating" },
  formula: { label: "Formula", icon: Hash, description: "Calculated field" },
  lookup: { label: "Lookup", icon: Search, description: "Reference data" },
  rollup: { label: "Rollup", icon: Layers, description: "Aggregate data" },
  autonumber: { label: "Auto Number", icon: Hash, description: "Auto-incrementing" },
  created_time: { label: "Created Time", icon: Clock, description: "When created" },
  modified_time: { label: "Modified Time", icon: Clock, description: "Last modified" },
  created_by: { label: "Created By", icon: User, description: "Who created" },
  modified_by: { label: "Modified By", icon: User, description: "Who modified" },
};

const defaultStatusColors: Record<string, string> = {
  not_started: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  in_progress: "bg-status-blue text-status-blue-foreground",
  working_on_it: "bg-status-amber text-status-amber-foreground",
  done: "bg-status-green text-status-green-foreground",
  complete: "bg-status-green text-status-green-foreground",
  completed: "bg-status-green text-status-green-foreground",
  stuck: "bg-status-red text-status-red-foreground",
  delayed: "bg-status-red text-status-red-foreground",
  at_risk: "bg-status-amber text-status-amber-foreground",
  active: "bg-status-green text-status-green-foreground",
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  pending: "bg-status-amber text-status-amber-foreground",
  cancelled: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  closed: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  new: "bg-status-blue text-status-blue-foreground",
};

const priorityColors: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  medium: "bg-status-blue text-status-blue-foreground",
  high: "bg-status-amber text-status-amber-foreground",
  critical: "bg-status-red text-status-red-foreground",
  urgent: "bg-status-red text-status-red-foreground",
};

function getCellValue<T>(row: T, accessor: keyof T | ((row: T) => unknown)): unknown {
  if (typeof accessor === "function") {
    return accessor(row);
  }
  return row[accessor];
}

function StatusPill({ value, options, editable, onChange }: { 
  value: string; 
  options?: StatusOption[];
  editable?: boolean;
  onChange?: (v: string) => void;
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
            <DropdownMenuItem key={optValue} onClick={() => onChange(optValue)} className="capitalize">
              <span className={cn("px-2 py-0.5 rounded-full text-xs mr-2", optColor)}>{optLabel}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PriorityPill({ value, editable, onChange }: { 
  value: string; 
  editable?: boolean;
  onChange?: (v: string) => void;
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
          <DropdownMenuItem key={priority} onClick={() => onChange(priority)} className="capitalize">
            <span className={cn("px-2 py-0.5 rounded-full text-xs mr-2", color)}>{priority}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PersonDisplay({ value }: { value: PersonValue | PersonValue[] | null }) {
  if (!value) return <span className="text-muted-foreground text-sm">Unassigned</span>;
  
  const people = Array.isArray(value) ? value : [value];
  if (people.length === 0) return <span className="text-muted-foreground text-sm">Unassigned</span>;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex -space-x-2">
        {people.slice(0, 3).map((person, idx) => (
          <Tooltip key={person.id || idx}>
            <TooltipTrigger asChild>
              <Avatar className="h-6 w-6 border-2 border-background">
                <AvatarImage src={person.profileImageUrl || undefined} />
                <AvatarFallback className="text-[10px] bg-primary/10">
                  {person.firstName?.[0] || person.email?.[0] || "?"}{person.lastName?.[0] || ""}
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
      {people.length > 3 && <span className="text-xs text-muted-foreground">+{people.length - 3}</span>}
      {people.length === 1 && (
        <span className="text-sm truncate max-w-[100px]">{people[0].firstName} {people[0].lastName}</span>
      )}
    </div>
  );
}

function EditableCell<T>({ 
  column, 
  value, 
  row, 
  isEditing, 
  onStartEdit,
  onEdit,
  onCancelEdit
}: { 
  column: ColumnDef<T>; 
  value: unknown; 
  row: T;
  isEditing: boolean;
  onStartEdit: () => void;
  onEdit: (value: unknown) => void;
  onCancelEdit: () => void;
}) {
  const [editValue, setEditValue] = useState<string>(String(value || ""));

  useEffect(() => {
    setEditValue(String(value || ""));
  }, [value, isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      onEdit(editValue);
    } else if (e.key === "Escape") {
      onCancelEdit();
    }
  };

  if (isEditing && column.editable !== false) {
    switch (column.type) {
      case "text":
      case "email":
      case "phone":
      case "link":
        return (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => onEdit(editValue)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="h-7 text-sm"
          />
        );
      case "number":
      case "currency":
        return (
          <Input
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => onEdit(Number(editValue))}
            onKeyDown={handleKeyDown}
            autoFocus
            className="h-7 text-sm"
          />
        );
      case "status":
        return (
          <StatusPill 
            value={value as string} 
            options={column.options}
            editable={true}
            onChange={(v) => { onEdit(v); }}
          />
        );
      case "priority":
        return (
          <PriorityPill 
            value={value as string}
            editable={true}
            onChange={(v) => { onEdit(v); }}
          />
        );
      case "date":
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-sm border-border/30">
                {value ? format(new Date(value as string), "MMM d, yyyy") : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value ? new Date(value as string) : undefined}
                onSelect={(date) => onEdit(date?.toISOString())}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        );
      case "checkbox":
        return (
          <Checkbox
            checked={value as boolean}
            onCheckedChange={(checked) => onEdit(checked)}
          />
        );
      default:
        return (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => onEdit(editValue)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="h-7 text-sm"
          />
        );
    }
  }

  const renderDisplay = () => {
    switch (column.type) {
      case "status":
        return <StatusPill value={value as string} options={column.options} />;
      case "priority":
        return <PriorityPill value={value as string} />;
      case "person":
        return <PersonDisplay value={value as PersonValue | PersonValue[] | null} />;
      case "date":
        const dateVal = value ? new Date(value as string) : null;
        return (
          <span className="text-sm">
            {dateVal ? format(dateVal, "MMM d, yyyy") : <span className="text-muted-foreground">No date</span>}
          </span>
        );
      case "checkbox":
        return <Checkbox checked={value as boolean} disabled />;
      case "progress":
        const progress = Number(value) || 0;
        return (
          <div className="flex items-center gap-2 w-full">
            <Progress value={progress} className="h-2 flex-1" />
            <span className="text-xs text-muted-foreground w-8">{progress}%</span>
          </div>
        );
      case "tags":
        const tags = Array.isArray(value) ? value : (value ? [value] : []);
        return (
          <div className="flex gap-1 flex-wrap">
            {tags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-xs">{String(tag)}</Badge>
            ))}
          </div>
        );
      case "currency":
        return <span className="text-sm">${Number(value || 0).toLocaleString()}</span>;
      case "number":
        return <span className="text-sm">{Number(value || 0).toLocaleString()}</span>;
      case "link":
        return value ? (
          <a href={String(value)} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate">
            {String(value)}
          </a>
        ) : <span className="text-muted-foreground text-sm">No link</span>;
      default:
        return <span className="text-sm truncate">{String(value || "")}</span>;
    }
  };

  return (
    <div 
      className={cn("w-full cursor-text", column.editable !== false && "hover:bg-accent/30 rounded px-1 -mx-1")}
      onClick={(e) => { e.stopPropagation(); if (column.editable !== false) onStartEdit(); }}
    >
      {renderDisplay()}
    </div>
  );
}

function ViewSwitcher({ 
  currentView, 
  onViewChange, 
  enabledViews 
}: { 
  currentView: ViewType; 
  onViewChange: (view: ViewType) => void;
  enabledViews: ViewType[];
}) {
  const currentConfig = viewTypeConfig[currentView];
  const CurrentIcon = currentConfig.icon;
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2 border-border/30" data-testid="view-dropdown">
          <CurrentIcon className="h-4 w-4" />
          {currentConfig.label}
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>View Type</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {enabledViews.map((view) => {
          const config = viewTypeConfig[view];
          const Icon = config.icon;
          return (
            <DropdownMenuItem 
              key={view} 
              onClick={() => onViewChange(view)}
              className={cn(currentView === view && "bg-accent")}
              data-testid={`view-${view}`}
            >
              <Icon className="h-4 w-4 mr-2" />
              <div>
                <div>{config.label}</div>
                <div className="text-xs text-muted-foreground">{config.description}</div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SortBar<T>({ 
  columns, 
  sorts, 
  onSortsChange 
}: { 
  columns: ColumnDef<T>[]; 
  sorts: SortDef[];
  onSortsChange: (sorts: SortDef[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const addSort = (columnId: string) => {
    const newSort: SortDef = {
      columnId,
      direction: "asc",
    };
    onSortsChange([...sorts, newSort]);
  };

  const removeSort = (columnId: string) => {
    onSortsChange(sorts.filter(s => s.columnId !== columnId));
  };

  const toggleDirection = (columnId: string) => {
    onSortsChange(sorts.map(s => 
      s.columnId === columnId 
        ? { ...s, direction: s.direction === "asc" ? "desc" : "asc" } 
        : s
    ));
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 border-border/30" data-testid="button-sort">
          <ArrowUpDown className="h-3.5 w-3.5" />
          Sort
          {sorts.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">{sorts.length}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-3">
          <div className="font-medium text-sm">Sort by</div>
          {sorts.map((sort) => {
            const column = columns.find(c => c.id === sort.columnId);
            return (
              <div key={sort.columnId} className="flex items-center gap-2">
                <Select value={sort.columnId} onValueChange={(v) => {
                  onSortsChange(sorts.map(s => s.columnId === sort.columnId ? { ...s, columnId: v } : s));
                }}>
                  <SelectTrigger className="h-8 flex-1">
                    <SelectValue>{column?.header || sort.columnId}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map(col => (
                      <SelectItem key={col.id} value={col.id}>{col.header}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 px-2"
                  onClick={() => toggleDirection(sort.columnId)}
                >
                  {sort.direction === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => removeSort(sort.columnId)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-full h-8 border-border/30">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {columns.filter(c => !sorts.find(s => s.columnId === c.id)).map(col => (
                <DropdownMenuItem key={col.id} onClick={() => addSort(col.id)}>
                  {col.header}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ImportExportBar<T>({
  data,
  columns,
  onImport,
}: {
  data: T[];
  columns: ColumnDef<T>[];
  onImport?: (data: Partial<T>[]) => void;
}) {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importText, setImportText] = useState("");

  const handleExport = (format: "csv" | "excel" | "html" | "pdf") => {
    const visibleColumns = columns.filter(c => !c.hidden);
    const headers = visibleColumns.map(c => c.header);
    const rows = data.map(row => 
      visibleColumns.map(col => {
        const value = getCellValue(row, col.accessor);
        return String(value ?? "");
      })
    );

    if (format === "csv") {
      const csvContent = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
      downloadFile(csvContent, "export.csv", "text/csv");
    } else if (format === "excel") {
      const csvContent = [headers.join("\t"), ...rows.map(r => r.join("\t"))].join("\n");
      downloadFile(csvContent, "export.xls", "application/vnd.ms-excel");
    } else if (format === "html") {
      const htmlContent = `
        <html><head><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}</style></head>
        <body><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>
      `;
      downloadFile(htmlContent, "export.html", "text/html");
    } else if (format === "pdf") {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html><head><title>Export</title><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}</style></head>
          <body><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
          <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1 border-border/30" data-testid="button-import">
            <Layers className="h-3.5 w-3.5" />
            Import
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Data</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Paste CSV or Excel data</Label>
              <Textarea
                placeholder="Paste data here (tab or comma separated)..."
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="min-h-32 mt-2"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      setImportText(ev.target?.result as string || "");
                    };
                    reader.readAsText(file);
                  }
                }}
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (onImport && importText) {
                const lines = importText.split("\n").filter(l => l.trim());
                if (lines.length > 1) {
                  const delimiter = importText.includes("\t") ? "\t" : ",";
                  const headerRow = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, ""));
                  const dataRows = lines.slice(1).map(line => {
                    const values = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ""));
                    const obj: Record<string, string> = {};
                    headerRow.forEach((h, i) => {
                      const col = columns.find(c => c.header.toLowerCase() === h.toLowerCase());
                      if (col) obj[col.id] = values[i] || "";
                    });
                    return obj as Partial<T>;
                  });
                  onImport(dataRows);
                }
              }
              setIsImportOpen(false);
              setImportText("");
            }}>
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1 border-border/30" data-testid="button-export">
            <FileText className="h-3.5 w-3.5" />
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleExport("csv")}>
            Export as CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport("excel")}>
            Export as Excel
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport("html")}>
            Export as HTML
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport("pdf")}>
            Export as PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function CustomiseColumnsDialog<T>({
  columns,
  onColumnsChange,
}: {
  columns: ColumnDef<T>[];
  onColumnsChange: (columns: ColumnDef<T>[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [localColumns, setLocalColumns] = useState(columns);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);

  useEffect(() => {
    setLocalColumns(columns);
  }, [columns]);

  const toggleColumn = (columnId: string) => {
    setLocalColumns(prev => prev.map(c => 
      c.id === columnId ? { ...c, hidden: !c.hidden } : c
    ));
  };

  const renameColumn = (columnId: string, newName: string) => {
    setLocalColumns(prev => prev.map(c => 
      c.id === columnId ? { ...c, header: newName } : c
    ));
  };

  const handleSave = () => {
    onColumnsChange(localColumns);
    setIsOpen(false);
    setEditingColumnId(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) setEditingColumnId(null);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 border-border/30" data-testid="button-customise">
          <Settings2 className="h-3.5 w-3.5" />
          Customise
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Customise Columns</DialogTitle>
          <p className="text-sm text-muted-foreground">Show/hide columns or click a name to rename it</p>
        </DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {localColumns.map((column) => {
            const Icon = columnTypeConfig[column.type]?.icon || Text;
            const isEditing = editingColumnId === column.id;
            return (
              <div 
                key={column.id} 
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50"
              >
                <Checkbox
                  id={`col-${column.id}`}
                  checked={!column.hidden}
                  onCheckedChange={() => toggleColumn(column.id)}
                  data-testid={`checkbox-column-${column.id}`}
                />
                <Icon className="h-4 w-4 text-muted-foreground" />
                {isEditing ? (
                  <Input
                    value={column.header}
                    onChange={(e) => renameColumn(column.id, e.target.value)}
                    onBlur={() => setEditingColumnId(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") setEditingColumnId(null);
                      if (e.key === "Escape") setEditingColumnId(null);
                    }}
                    className="h-7 flex-1"
                    autoFocus
                    data-testid={`input-rename-column-${column.id}`}
                  />
                ) : (
                  <button
                    onClick={() => setEditingColumnId(column.id)}
                    className="flex-1 text-left hover:underline cursor-pointer"
                    data-testid={`button-rename-column-${column.id}`}
                  >
                    {column.header}
                  </button>
                )}
                <Badge variant="outline" className="text-xs">
                  {columnTypeConfig[column.type]?.label || column.type}
                </Badge>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} data-testid="button-apply-customise">Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilterBar<T>({ 
  columns, 
  filters, 
  onFiltersChange 
}: { 
  columns: ColumnDef<T>[]; 
  filters: FilterDef[];
  onFiltersChange: (filters: FilterDef[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const addFilter = (columnId: string) => {
    const newFilter: FilterDef = {
      id: `filter-${Date.now()}`,
      columnId,
      operator: "contains",
      value: "",
    };
    onFiltersChange([...filters, newFilter]);
  };

  const removeFilter = (filterId: string) => {
    onFiltersChange(filters.filter(f => f.id !== filterId));
  };

  const updateFilter = (filterId: string, updates: Partial<FilterDef>) => {
    onFiltersChange(filters.map(f => f.id === filterId ? { ...f, ...updates } : f));
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 border-border/30">
          <Filter className="h-3.5 w-3.5" />
          Filter
          {filters.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">{filters.length}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div className="font-medium text-sm">Filters</div>
          {filters.map((filter) => {
            const column = columns.find(c => c.id === filter.columnId);
            return (
              <div key={filter.id} className="flex items-center gap-2">
                <Select value={filter.columnId} onValueChange={(v) => updateFilter(filter.id, { columnId: v })}>
                  <SelectTrigger className="h-8 w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map(col => (
                      <SelectItem key={col.id} value={col.id}>{col.header}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filter.operator} onValueChange={(v: FilterDef["operator"]) => updateFilter(filter.id, { operator: v })}>
                  <SelectTrigger className="h-8 w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">contains</SelectItem>
                    <SelectItem value="equals">equals</SelectItem>
                    <SelectItem value="gt">{">"}</SelectItem>
                    <SelectItem value="lt">{"<"}</SelectItem>
                    <SelectItem value="isEmpty">is empty</SelectItem>
                    <SelectItem value="isNotEmpty">is not empty</SelectItem>
                  </SelectContent>
                </Select>
                <Input 
                  value={String(filter.value || "")} 
                  onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                  className="h-8 flex-1"
                  placeholder="Value"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeFilter(filter.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-full border-border/30">
                <Plus className="h-4 w-4 mr-1" /> Add Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {columns.map(col => (
                <DropdownMenuItem key={col.id} onClick={() => addFilter(col.id)}>
                  {col.header}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function GroupBar<T>({ 
  columns, 
  groups, 
  onGroupsChange 
}: { 
  columns: ColumnDef<T>[]; 
  groups: GroupDef[];
  onGroupsChange: (groups: GroupDef[]) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 border-border/30">
          <Layers className="h-3.5 w-3.5" />
          Group
          {groups.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">{groups.length}</Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Group by</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.filter(c => ["status", "priority", "person", "tags"].includes(c.type)).map(col => (
          <DropdownMenuCheckboxItem
            key={col.id}
            checked={groups.some(g => g.columnId === col.id)}
            onCheckedChange={(checked) => {
              if (checked) {
                onGroupsChange([...groups, { columnId: col.id }]);
              } else {
                onGroupsChange(groups.filter(g => g.columnId !== col.id));
              }
            }}
          >
            {col.header}
          </DropdownMenuCheckboxItem>
        ))}
        {groups.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onGroupsChange([])}>
              Clear grouping
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AddColumnDialog<T>({ 
  onAddColumn, 
  trigger,
  existingColumns = [],
}: { 
  onAddColumn: (column: ColumnDef<T>) => void;
  trigger: React.ReactNode;
  existingColumns?: ColumnDef<T>[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ColumnType | null>(null);

  const handleSelectType = (selectedType: ColumnType) => {
    setType(selectedType);
  };

  const handleAdd = () => {
    if (!type) return;
    
    const typeLabel = columnTypeConfig[type]?.label || type;
    const columnName = name.trim() || typeLabel;
    
    // Generate unique ID by checking existing columns
    let baseId = columnName.toLowerCase().replace(/\s+/g, "_");
    let uniqueId = baseId;
    let counter = 1;
    while (existingColumns.some(c => c.id === uniqueId)) {
      uniqueId = `${baseId}_${counter}`;
      counter++;
    }
    
    const newColumn: ColumnDef<T> = {
      id: uniqueId,
      header: columnName,
      type,
      accessor: uniqueId as keyof T,
      editable: true,
    };
    
    onAddColumn(newColumn);
    setName("");
    setType(null);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        setName("");
        setType(null);
      }
    }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Column</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Select Column Type</Label>
            <div className="grid grid-cols-4 gap-2 max-h-[300px] overflow-y-auto">
              {Object.entries(columnTypeConfig).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelectType(key as ColumnType);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-colors",
                      type === key ? "border-primary bg-primary/10 ring-2 ring-primary" : "hover:bg-accent/50"
                    )}
                    data-testid={`column-type-${key}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-center">{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Custom Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder={type ? `Default: ${columnTypeConfig[type]?.label || type}` : "Select a type first"}
              data-testid="input-column-name"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleAdd} disabled={!type} data-testid="button-confirm-add-column">
            Add Column
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SaveViewDialog({ 
  currentView,
  columns,
  filters,
  sorts,
  groups,
  onSave,
  trigger 
}: { 
  currentView: ViewType;
  columns: string[];
  filters: FilterDef[];
  sorts: SortDef[];
  groups: GroupDef[];
  onSave: (view: SavedView) => void;
  trigger: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const handleSave = () => {
    if (!name.trim()) return;
    
    const newView: SavedView = {
      id: `view-${Date.now()}`,
      name,
      viewType: currentView,
      columns,
      filters,
      sorts,
      groups,
      isDefault,
      createdAt: new Date().toISOString(),
    };
    
    onSave(newView);
    setName("");
    setIsDefault(false);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save View</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>View Name</Label>
            <Input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="My Custom View"
              data-testid="input-view-name"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox 
              id="default" 
              checked={isDefault} 
              onCheckedChange={(c) => setIsDefault(c as boolean)} 
            />
            <Label htmlFor="default" className="text-sm">Set as default view</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim()} data-testid="button-save-view">
            <Save className="h-4 w-4 mr-1" /> Save View
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Memoized table row component for performance optimization
const MemoizedTableRow = memo(function TableRowComponent<T extends { id: number | string }>({
  row,
  columns,
  selectedIds,
  editingCell,
  onSelectRow,
  onRowDoubleClick,
  onStartEdit,
  onCellEdit,
  onCancelEdit,
  onDeleteItems,
  hasAddColumn,
}: {
  row: T;
  columns: ColumnDef<T>[];
  selectedIds: Set<number | string>;
  editingCell: { rowId: number | string; columnId: string } | null;
  onSelectRow: (id: number | string, checked: boolean) => void;
  onRowDoubleClick?: (row: T) => void;
  onStartEdit: (rowId: number | string, columnId: string) => void;
  onCellEdit: (rowId: number | string, columnId: string, value: unknown) => void;
  onCancelEdit: () => void;
  onDeleteItems?: (ids: (number | string)[]) => void;
  hasAddColumn?: boolean;
}) {
  return (
    <tr 
      className={cn(
        "border-b border-border/30 hover:bg-accent/30 transition-colors group",
        selectedIds.has(row.id) && "bg-primary/5"
      )}
      onDoubleClick={() => onRowDoubleClick?.(row)}
      data-testid={`table-row-${row.id}`}
    >
      <td className="px-2 py-2 border-r border-border/30">
        <Checkbox
          checked={selectedIds.has(row.id)}
          onCheckedChange={(checked) => onSelectRow(row.id, checked as boolean)}
          onClick={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 data-[state=checked]:opacity-100 transition-opacity"
          data-testid={`checkbox-row-${row.id}`}
        />
      </td>
      {columns.map((column) => {
        const value = getCellValue(row, column.accessor);
        const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === column.id;
        
        return (
          <td key={column.id} className="px-3 py-2 border-r border-border/30">
            <EditableCell
              column={column}
              value={value}
              row={row}
              isEditing={isEditing}
              onStartEdit={() => onStartEdit(row.id, column.id)}
              onEdit={(v) => onCellEdit(row.id, column.id, v)}
              onCancelEdit={onCancelEdit}
            />
          </td>
        );
      })}
      {hasAddColumn && <td className="px-2 py-2 border-r border-border/30" />}
      <td className="px-2 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              data-testid={`row-menu-${row.id}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onRowDoubleClick?.(row)}>
              <Eye className="h-4 w-4 mr-2" /> View Details
            </DropdownMenuItem>
            {onDeleteItems && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={() => onDeleteItems([row.id])}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}) as <T extends { id: number | string }>(props: {
  row: T;
  columns: ColumnDef<T>[];
  selectedIds: Set<number | string>;
  editingCell: { rowId: number | string; columnId: string } | null;
  onSelectRow: (id: number | string, checked: boolean) => void;
  onRowDoubleClick?: (row: T) => void;
  onStartEdit: (rowId: number | string, columnId: string) => void;
  onCellEdit: (rowId: number | string, columnId: string, value: unknown) => void;
  onCancelEdit: () => void;
  onDeleteItems?: (ids: (number | string)[]) => void;
  hasAddColumn?: boolean;
}) => JSX.Element;

function TableView<T extends { id: number | string }>({
  columns,
  data,
  onRowDoubleClick,
  onCellEdit,
  onInlineAddItem,
  onDeleteItems,
  selectedIds,
  onSelectIds,
  onAddColumn,
  groups = [],
}: {
  columns: ColumnDef<T>[];
  data: T[];
  onRowDoubleClick?: (row: T) => void;
  onCellEdit?: (rowId: number | string, columnId: string, value: unknown) => void | Promise<void>;
  onInlineAddItem?: (data: Partial<T>) => void;
  onDeleteItems?: (ids: (number | string)[]) => void;
  selectedIds: Set<number | string>;
  onSelectIds: (ids: Set<number | string>) => void;
  onAddColumn?: (column: ColumnDef<T>) => void;
  groups?: GroupDef[];
}) {
  const [editingCell, setEditingCell] = useState<{ rowId: number | string; columnId: string } | null>(null);
  const [newRowData, setNewRowData] = useState<Record<string, unknown>>({});
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const visibleColumns = columns.filter(c => !c.hidden);

  const pagination = useTablePagination(data, { resetKey: data.length });

  const groupedData = useMemo(() => {
    const pageData = pagination.paginatedItems;
    if (groups.length === 0) {
      return [{ groupKey: null, groupLabel: null, items: pageData }];
    }

    const firstGroup = groups[0];
    const groupColumn = columns.find(c => c.id === firstGroup.columnId);
    if (!groupColumn) {
      return [{ groupKey: null, groupLabel: null, items: pageData }];
    }

    const groupMap = new Map<string, T[]>();
    pageData.forEach(item => {
      const val = getCellValue(item, groupColumn.accessor);
      const key = String(val || "Ungrouped");
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(item);
    });

    return Array.from(groupMap.entries()).map(([key, items]) => ({
      groupKey: key,
      groupLabel: key,
      items,
    }));
  }, [pagination.paginatedItems, groups, columns]);

  const handleCellEdit = (rowId: number | string, columnId: string, value: unknown) => {
    onCellEdit?.(rowId, columnId, value);
    setEditingCell(null);
  };

  const handleNewRowChange = (columnId: string, value: unknown) => {
    setNewRowData(prev => ({ ...prev, [columnId]: value }));
  };

  const handleAddRow = () => {
    if (Object.keys(newRowData).length > 0 && onInlineAddItem) {
      onInlineAddItem(newRowData as Partial<T>);
      setNewRowData({});
      setIsAddingRow(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectIds(new Set(data.map(d => d.id)));
    } else {
      onSelectIds(new Set());
    }
  };

  const handleSelectRow = (id: number | string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    onSelectIds(newSelected);
  };

  return (
    <div className="rounded-lg border border-border/30 bg-card overflow-hidden">
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 border-b border-border/30">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
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
          <Button variant="ghost" size="sm" onClick={() => onSelectIds(new Set())}>
            Clear Selection
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border/30 bg-muted/30">
              <th className="w-10 px-2 py-2 border-r border-border/30">
                <Checkbox
                  checked={data.length > 0 && selectedIds.size === data.length}
                  onCheckedChange={handleSelectAll}
                  data-testid="checkbox-select-all"
                />
              </th>
              {visibleColumns.map((column) => {
                const Icon = columnTypeConfig[column.type]?.icon || Text;
                return (
                  <th 
                    key={column.id} 
                    className="px-3 py-2 text-left text-sm font-medium text-muted-foreground border-r border-border/30"
                    style={column.width ? { width: column.width } : undefined}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5 opacity-50" />
                      <span>{column.header}</span>
                    </div>
                  </th>
                );
              })}
              {onAddColumn && (
                <th className="w-28 px-2 py-2">
                  <AddColumnDialog
                    onAddColumn={onAddColumn}
                    existingColumns={columns}
                    trigger={
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        data-testid="button-add-column"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Add column
                      </Button>
                    }
                  />
                </th>
              )}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {groupedData.map((group, groupIndex) => (
              <Fragment key={group.groupKey || "ungrouped"}>
                {group.groupKey !== null && (
                  <tr className={cn(
                    "bg-muted/50",
                    groupIndex > 0 && "border-t-4 border-border"
                  )}>
                    <td 
                      colSpan={visibleColumns.length + (onAddColumn ? 3 : 2)} 
                      className="px-3 py-3"
                    >
                      <button
                        onClick={() => {
                          const newCollapsed = new Set(collapsedGroups);
                          if (newCollapsed.has(group.groupKey!)) {
                            newCollapsed.delete(group.groupKey!);
                          } else {
                            newCollapsed.add(group.groupKey!);
                          }
                          setCollapsedGroups(newCollapsed);
                        }}
                        className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors"
                        data-testid={`group-header-${group.groupKey}`}
                      >
                        <ChevronDown className={cn(
                          "h-4 w-4 transition-transform",
                          collapsedGroups.has(group.groupKey!) && "-rotate-90"
                        )} />
                        <span className="capitalize">{group.groupLabel?.replace(/_/g, " ")}</span>
                        <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                          {group.items.length}
                        </Badge>
                      </button>
                    </td>
                  </tr>
                )}
                {!collapsedGroups.has(group.groupKey || "") && group.items.map((row) => (
                  <MemoizedTableRow
                    key={row.id}
                    row={row}
                    columns={visibleColumns}
                    selectedIds={selectedIds}
                    editingCell={editingCell}
                    onSelectRow={handleSelectRow}
                    onRowDoubleClick={onRowDoubleClick}
                    onStartEdit={(rowId, columnId) => setEditingCell({ rowId, columnId })}
                    onCellEdit={handleCellEdit}
                    onCancelEdit={() => setEditingCell(null)}
                    onDeleteItems={onDeleteItems}
                    hasAddColumn={!!onAddColumn}
                  />
                ))}
              </Fragment>
            ))}
            {onInlineAddItem && (
              <tr className="border-t border-border/30 bg-muted/10">
                <td className="px-2 py-2 border-r border-border/30">
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </td>
                {visibleColumns.map((column, idx) => (
                  <td key={column.id} className="px-3 py-2 border-r border-border/30">
                    {idx === 0 || isAddingRow ? (
                      <Input
                        placeholder={idx === 0 ? "Add new item..." : `Enter ${column.header.toLowerCase()}`}
                        value={String(newRowData[column.id] || "")}
                        onChange={(e) => {
                          handleNewRowChange(column.id, e.target.value);
                          if (!isAddingRow) setIsAddingRow(true);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddRow();
                          if (e.key === "Escape") {
                            setNewRowData({});
                            setIsAddingRow(false);
                          }
                        }}
                        className="h-7 text-sm border-none bg-transparent focus-visible:ring-1"
                        data-testid={`input-new-row-${column.id}`}
                      />
                    ) : null}
                  </td>
                ))}
                {onAddColumn && <td className="px-2 py-2" />}
                <td className="px-2 py-2">
                  {isAddingRow && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleAddRow}>
                      <Check className="h-4 w-4 text-brand-green" />
                    </Button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        startIndex={pagination.startIndex}
        endIndex={pagination.endIndex}
        pageSize={pagination.pageSize}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
      />
    </div>
  );
}

function KanbanView<T extends { id: number | string }>({
  columns,
  data,
  statusField,
  titleField,
  dateField,
  onRowClick,
  onRowDoubleClick,
  onCellEdit,
}: {
  columns: ColumnDef<T>[];
  data: T[];
  statusField?: keyof T;
  titleField?: keyof T;
  dateField?: keyof T;
  onRowClick?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
  onCellEdit?: (rowId: number | string, columnId: string, value: unknown) => void | Promise<void>;
}) {
  const statusColumn = columns.find(c => c.id === statusField || c.type === "status");
  const statusOptions = statusColumn?.options || [
    { value: "not_started", label: "Not Started", color: "bg-slate-200" },
    { value: "in_progress", label: "In Progress", color: "bg-status-blue" },
    { value: "complete", label: "Complete", color: "bg-status-green" },
  ];

  const kanbanColumns = statusOptions.map((opt) => ({
    id: opt.value,
    title: (
      <span className="flex items-center gap-2">
        <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", opt.color.replace("text-", "bg-").split(" ")[0])} />
        {opt.label}
      </span>
    ),
  }));

  if (!statusField || !onCellEdit) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Kanban view requires a status field and edit handler.
      </div>
    );
  }

  const sf = statusField;

  return (
    <AppKanbanBoard
      columns={kanbanColumns}
      items={data}
      getItemId={(item) => String(item.id)}
      getColumnId={(item) => String(item[sf] || statusOptions[0]?.value || "not_started")}
      setColumnIdOnItem={(item, columnId) => ({ ...item, [sf]: columnId } as T)}
      onMove={(move) => Promise.resolve(onCellEdit(move.itemId, String(sf), move.toColumnId))}
      testIdPrefix="kanban"
      renderCard={(item, { dragHandleProps, isDragging, isSaving }) => {
        const title = titleField ? String(item[titleField] || "") : String((item as Record<string, unknown>).title || item.id);
        const dueRaw = dateField ? item[dateField] : (item as Record<string, unknown>).dueDate;
        const dueLabel = dueRaw ? String(dueRaw).slice(0, 10) : null;
        const priorityCol = columns.find((c) => c.type === "priority");
        const priorityValue = priorityCol ? getCellValue(item, priorityCol.accessor) : null;
        return (
          <Card
            className={cn(
              "hover-elevate transition-shadow cursor-pointer",
              isDragging && "shadow-md ring-2 ring-primary/20",
              isSaving && "pointer-events-none",
            )}
            onClick={() => onRowClick?.(item)}
            onDoubleClick={() => onRowDoubleClick?.(item)}
          >
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <div
                  {...(dragHandleProps ?? {})}
                  className="text-muted-foreground mt-0.5 shrink-0 cursor-grab active:cursor-grabbing touch-none"
                  onClick={(e) => e.stopPropagation()}
                >
                  <GripVertical className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm leading-snug line-clamp-2">{title}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {priorityValue != null && priorityValue !== "" && (
                      <PriorityPill value={priorityValue as string} />
                    )}
                    {dueLabel && (
                      <span className="text-[11px] text-muted-foreground tabular-nums">{dueLabel}</span>
                    )}
                    {columns.filter(c => c.type === "person").slice(0, 1).map((col) => {
                      const value = getCellValue(item, col.accessor);
                      return <PersonDisplay key={col.id} value={value as PersonValue | null} />;
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      }}
    />
  );
}

function CalendarView<T extends { id: number | string }>({
  data,
  dateField,
  titleField,
  onRowDoubleClick,
}: {
  data: T[];
  dateField?: keyof T;
  titleField?: keyof T;
  onRowDoubleClick?: (row: T) => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: addDays(monthEnd, 6 - monthEnd.getDay()) });

  const itemsByDate = useMemo(() => {
    const map: Record<string, T[]> = {};
    data.forEach(item => {
      if (!dateField) return;
      const dateVal = item[dateField];
      if (!dateVal) return;
      const dateStr = format(new Date(dateVal as string), "yyyy-MM-dd");
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(item);
    });
    return map;
  }, [data, dateField]);

  return (
    <div className="rounded-lg border border-border/30 bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="font-semibold">{format(currentMonth, "MMMM yyyy")}</h3>
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
          <div key={day} className="bg-muted/50 p-2 text-center text-xs font-medium text-muted-foreground">
            {day}
          </div>
        ))}
        {calendarDays.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const items = itemsByDate[dateStr] || [];
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());
          
          return (
            <div 
              key={dateStr}
              className={cn(
                "bg-card min-h-[80px] p-1",
                !isCurrentMonth && "bg-muted/30 text-muted-foreground"
              )}
            >
              <div className={cn(
                "text-xs font-medium mb-1",
                isToday && "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center"
              )}>
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {items.slice(0, 2).map((item) => {
                  const title = titleField ? String(item[titleField] || "") : String(item.id);
                  return (
                    <div
                      key={item.id}
                      className="text-xs bg-primary/10 rounded px-1 py-0.5 truncate cursor-pointer hover:bg-primary/20"
                      onClick={() => onRowDoubleClick?.(item)}
                    >
                      {title}
                    </div>
                  );
                })}
                {items.length > 2 && (
                  <div className="text-xs text-muted-foreground">+{items.length - 2} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GanttView<T extends { id: number | string }>({
  data,
  dateField,
  titleField,
  onRowDoubleClick,
}: {
  data: T[];
  dateField?: keyof T;
  titleField?: keyof T;
  onRowDoubleClick?: (row: T) => void;
}) {
  const [startDate] = useState(new Date());
  const days = eachDayOfInterval({ start: startDate, end: addDays(startDate, 30) });

  return (
    <div className="rounded-lg border border-border/30 bg-card overflow-hidden">
      <div className="flex">
        <div className="w-48 flex-shrink-0 border-r border-border/30">
          <div className="h-10 border-b border-border/30 bg-muted/30 px-3 py-2 text-sm font-medium">Tasks</div>
          {data.map((item) => {
            const title = titleField ? String(item[titleField] || "") : String(item.id);
            return (
              <div 
                key={item.id} 
                className="h-10 border-b border-border/30 px-3 py-2 text-sm truncate cursor-pointer hover:bg-accent/30"
                onClick={() => onRowDoubleClick?.(item)}
              >
                {title}
              </div>
            );
          })}
        </div>
        <ScrollArea className="flex-1">
          <div className="min-w-[900px]">
            <div className="flex h-10 border-b border-border/30 bg-muted/30">
              {days.map((day) => (
                <div key={day.toISOString()} className="w-[30px] flex-shrink-0 text-center text-xs py-2 border-r border-border/30">
                  {format(day, "d")}
                </div>
              ))}
            </div>
            {data.map((item) => {
              const itemDate = dateField ? item[dateField] : null;
              const dayIndex = itemDate ? Math.max(0, Math.floor((new Date(itemDate as string).getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))) : 0;
              
              return (
                <div key={item.id} className="flex h-10 border-b border-border/30 relative">
                  {days.map((_, idx) => (
                    <div key={idx} className="w-[30px] flex-shrink-0 border-r border-border/30" />
                  ))}
                  <div 
                    className="absolute h-6 top-2 bg-primary/60 rounded"
                    style={{ left: `${dayIndex * 30}px`, width: "90px" }}
                  />
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  );
}

function ListView<T extends { id: number | string }>({
  columns,
  data,
  titleField,
  onRowDoubleClick,
}: {
  columns: ColumnDef<T>[];
  data: T[];
  titleField?: keyof T;
  onRowDoubleClick?: (row: T) => void;
}) {
  return (
    <div className="space-y-2">
      {data.map((item) => {
        const title = titleField ? String(item[titleField] || "") : String((item as Record<string, unknown>).title || item.id);
        const statusCol = columns.find(c => c.type === "status");
        const priorityCol = columns.find(c => c.type === "priority");
        const dateCol = columns.find(c => c.type === "date");
        
        return (
          <div
            key={item.id}
            className="flex items-center gap-4 p-3 rounded-lg border border-border/30 bg-card hover-elevate cursor-pointer"
            onClick={() => onRowDoubleClick?.(item)}
            data-testid={`list-item-${item.id}`}
          >
            <Checkbox />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{title}</p>
            </div>
            {statusCol && (
              <StatusPill value={getCellValue(item, statusCol.accessor) as string} options={statusCol.options} />
            )}
            {priorityCol && (
              <PriorityPill value={getCellValue(item, priorityCol.accessor) as string} />
            )}
            {dateCol && (
              <span className="text-sm text-muted-foreground">
                {getCellValue(item, dateCol.accessor) ? format(new Date(getCellValue(item, dateCol.accessor) as string), "MMM d") : "No date"}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FormView<T extends { id: number | string }>({
  columns,
  onInlineAddItem,
}: {
  columns: ColumnDef<T>[];
  onInlineAddItem?: (data: Partial<T>) => void;
}) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  const handleSubmit = () => {
    if (onInlineAddItem) {
      onInlineAddItem(formData as Partial<T>);
      setFormData({});
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New Item</CardTitle>
        <CardDescription>Fill in the details below to add a new item.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <SubmitForm onSubmit={handleSubmit}>
        {columns.filter(c => c.editable !== false && !["created_time", "modified_time", "created_by", "modified_by", "autonumber"].includes(c.type)).map((column) => (
          <div key={column.id} className="space-y-2">
            <Label>{column.header}{column.required && <span className="text-destructive ml-1">*</span>}</Label>
            {column.type === "text" || column.type === "email" || column.type === "phone" || column.type === "link" ? (
              <Input
                value={String(formData[column.id] || "")}
                onChange={(e) => setFormData(prev => ({ ...prev, [column.id]: e.target.value }))}
                placeholder={`Enter ${column.header.toLowerCase()}`}
              />
            ) : column.type === "number" || column.type === "currency" ? (
              <Input
                type="number"
                value={String(formData[column.id] || "")}
                onChange={(e) => setFormData(prev => ({ ...prev, [column.id]: Number(e.target.value) }))}
                placeholder={`Enter ${column.header.toLowerCase()}`}
              />
            ) : column.type === "status" || column.type === "priority" || column.type === "dropdown" ? (
              <Select value={String(formData[column.id] || "")} onValueChange={(v) => setFormData(prev => ({ ...prev, [column.id]: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${column.header.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {(column.options || []).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : column.type === "date" ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData[column.id] ? format(new Date(formData[column.id] as string), "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData[column.id] ? new Date(formData[column.id] as string) : undefined}
                    onSelect={(date) => setFormData(prev => ({ ...prev, [column.id]: date?.toISOString() }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            ) : column.type === "checkbox" ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={formData[column.id] as boolean}
                  onCheckedChange={(c) => setFormData(prev => ({ ...prev, [column.id]: c }))}
                />
                <span className="text-sm text-muted-foreground">Check if applicable</span>
              </div>
            ) : (
              <Input
                value={String(formData[column.id] || "")}
                onChange={(e) => setFormData(prev => ({ ...prev, [column.id]: e.target.value }))}
                placeholder={`Enter ${column.header.toLowerCase()}`}
              />
            )}
          </div>
        ))}
        <Button type="submit" className="w-full" data-testid="button-submit-form">
          <Plus className="h-4 w-4 mr-1" /> Add Item
        </Button>
        </SubmitForm>
      </CardContent>
    </Card>
  );
}

function DocumentView() {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="font-medium mb-2">Document View</h3>
        <p className="text-sm text-muted-foreground">
          Switch to the Documents module for wiki-style documentation with rich text editing.
        </p>
      </CardContent>
    </Card>
  );
}

function ChartView<T extends { id: number | string }>({
  columns,
  data,
}: {
  columns: ColumnDef<T>[];
  data: T[];
}) {
  const statusColumn = columns.find(c => c.type === "status");
  const priorityColumn = columns.find(c => c.type === "priority");

  const statusCounts = useMemo(() => {
    if (!statusColumn) return {};
    const counts: Record<string, number> = {};
    data.forEach(item => {
      const val = String(getCellValue(item, statusColumn.accessor) || "unknown");
      counts[val] = (counts[val] || 0) + 1;
    });
    return counts;
  }, [data, statusColumn]);

  const priorityCounts = useMemo(() => {
    if (!priorityColumn) return {};
    const counts: Record<string, number> = {};
    data.forEach(item => {
      const val = String(getCellValue(item, priorityColumn.accessor) || "unknown");
      counts[val] = (counts[val] || 0) + 1;
    });
    return counts;
  }, [data, priorityColumn]);

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">By Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center gap-2">
                <StatusPill value={status} />
                <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary/60" 
                    style={{ width: `${(count / data.length) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">By Priority</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(priorityCounts).map(([priority, count]) => (
              <div key={priority} className="flex items-center gap-2">
                <PriorityPill value={priority} />
                <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary/60" 
                    style={{ width: `${(count / data.length) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function UniversalViewSystem<T extends { id: number | string }>({
  columns: initialColumns,
  data: rawData,
  onRowClick,
  onRowDoubleClick,
  onCellEdit,
  onAddItem,
  onInlineAddItem,
  onDeleteItems,
  onDuplicateItem,
  onArchiveItem,
  onColumnsChange,
  onAddColumn,
  onViewChange,
  savedViews = [],
  onSaveView,
  onDeleteView,
  dateField,
  statusField,
  titleField,
  loading = false,
  emptyMessage = "No items yet",
  addItemLabel = "Add Item",
  className,
  moduleId,
  showViewSwitcher = true,
  defaultView = "table",
  enabledViews = ["table", "kanban", "calendar", "gantt", "list", "form", "document", "chart"],
  initialGroupColumnId,
}: UniversalViewSystemProps<T>) {
  const [currentView, setCurrentView] = useState<ViewType>(defaultView);
  const [columns, setColumns] = useState<ColumnDef<T>[]>(initialColumns);
  const [filters, setFilters] = useState<FilterDef[]>([]);
  const [sorts, setSorts] = useState<SortDef[]>([]);
  const [groups, setGroups] = useState<GroupDef[]>(
    initialGroupColumnId ? [{ columnId: initialGroupColumnId }] : [],
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());

  // Sync columns state when initialColumns prop changes
  useEffect(() => {
    setColumns(initialColumns);
  }, [initialColumns]);

  const filteredData = useMemo(() => {
    let result = [...rawData];
    
    if (searchTerm) {
      result = result.filter(item => {
        return columns.some(col => {
          const val = getCellValue(item, col.accessor);
          return String(val || "").toLowerCase().includes(searchTerm.toLowerCase());
        });
      });
    }

    filters.forEach(filter => {
      const column = columns.find(c => c.id === filter.columnId);
      if (!column) return;
      
      result = result.filter(item => {
        const val = getCellValue(item, column.accessor);
        switch (filter.operator) {
          case "equals": return String(val) === String(filter.value);
          case "contains": return String(val || "").toLowerCase().includes(String(filter.value || "").toLowerCase());
          case "gt": return Number(val) > Number(filter.value);
          case "lt": return Number(val) < Number(filter.value);
          case "gte": return Number(val) >= Number(filter.value);
          case "lte": return Number(val) <= Number(filter.value);
          case "isEmpty": return !val || val === "";
          case "isNotEmpty": return val && val !== "";
          default: return true;
        }
      });
    });

    sorts.forEach(sort => {
      const column = columns.find(c => c.id === sort.columnId);
      if (!column) return;
      
      result.sort((a, b) => {
        const aVal = getCellValue(a, column.accessor);
        const bVal = getCellValue(b, column.accessor);
        const cmp = String(aVal || "").localeCompare(String(bVal || ""));
        return sort.direction === "asc" ? cmp : -cmp;
      });
    });

    return result;
  }, [rawData, searchTerm, filters, sorts, columns]);

  const handleAddColumn = (column: ColumnDef<T>) => {
    const newColumns = [...columns, column];
    setColumns(newColumns);
    onColumnsChange?.(newColumns);
    onAddColumn?.(column);
  };

  const handleSaveView = (view: SavedView) => {
    onSaveView?.(view);
  };

  const visibleColumns = columns.filter(c => !c.hidden);

  if (loading) {
    return (
      <div className={cn("rounded-lg border border-border/30 bg-card p-8 text-center text-muted-foreground", className)}>
        Loading...
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Toolbar - Left: View, Filter, Group, Sort, Search | Right: Import, Customise, Export */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Left side controls */}
        <div className="flex items-center gap-2">
          {showViewSwitcher && (
            <ViewSwitcher
              currentView={currentView}
              onViewChange={setCurrentView}
              enabledViews={enabledViews}
            />
          )}
          
          <FilterBar columns={columns} filters={filters} onFiltersChange={setFilters} />
          <GroupBar columns={columns} groups={groups} onGroupsChange={setGroups} />
          <SortBar columns={columns} sorts={sorts} onSortsChange={setSorts} />
          
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 w-40 pl-8"
              data-testid="input-search"
            />
          </div>
        </div>
        
        <div className="flex-1" />
        
        {/* Right side controls */}
        <div className="flex items-center gap-2">
          <ImportExportBar 
            data={filteredData} 
            columns={columns} 
            onImport={onInlineAddItem ? (items) => items.forEach(item => onInlineAddItem(item)) : undefined}
          />
          
          <CustomiseColumnsDialog
            columns={columns}
            onColumnsChange={setColumns}
          />

          {savedViews.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1 border-border/30">
                  <FolderOpen className="h-3.5 w-3.5" /> Views
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {savedViews.map(view => (
                  <DropdownMenuItem key={view.id} onClick={() => {
                    setCurrentView(view.viewType);
                    setFilters(view.filters);
                    setSorts(view.sorts);
                    setGroups(view.groups);
                  }}>
                    {view.isDefault && <Star className="h-3 w-3 mr-1 text-brand-orange" />}
                    {view.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {onSaveView && (
            <SaveViewDialog
              currentView={currentView}
              columns={visibleColumns.map(c => c.id)}
              filters={filters}
              sorts={sorts}
              groups={groups}
              onSave={handleSaveView}
              trigger={
                <Button variant="outline" size="sm" className="h-8 gap-1 border-border/30" data-testid="button-save-view">
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              }
            />
          )}

          {onAddItem && currentView !== "form" && (
            <Button size="sm" className="h-8 gap-1" onClick={onAddItem} data-testid="button-new-item">
              <Plus className="h-3.5 w-3.5" /> {addItemLabel}
            </Button>
          )}
        </div>
      </div>

      {filteredData.length === 0 && currentView !== "form" ? (
        <div className="rounded-lg border border-border/30 bg-card p-8 text-center text-muted-foreground">
          <p className="mb-4">{emptyMessage}</p>
          {onAddItem && (
            <Button onClick={onAddItem} data-testid="button-add-first-item">
              <Plus className="h-4 w-4 mr-1" /> {addItemLabel}
            </Button>
          )}
        </div>
      ) : (
        <>
          {currentView === "table" && (
            <TableView
              columns={columns}
              data={filteredData}
              onRowDoubleClick={onRowDoubleClick || onRowClick}
              onCellEdit={onCellEdit}
              onInlineAddItem={onInlineAddItem}
              onDeleteItems={onDeleteItems}
              selectedIds={selectedIds}
              onSelectIds={setSelectedIds}
              onAddColumn={handleAddColumn}
              groups={groups}
            />
          )}
          {currentView === "kanban" && (
            <KanbanView
              columns={columns}
              data={filteredData}
              statusField={statusField}
              titleField={titleField}
              dateField={dateField}
              onRowClick={onRowClick}
              onRowDoubleClick={onRowDoubleClick || onRowClick}
              onCellEdit={onCellEdit}
            />
          )}
          {currentView === "calendar" && (
            <CalendarView
              data={filteredData}
              dateField={dateField}
              titleField={titleField}
              onRowDoubleClick={onRowDoubleClick || onRowClick}
            />
          )}
          {currentView === "gantt" && (
            <GanttView
              data={filteredData}
              dateField={dateField}
              titleField={titleField}
              onRowDoubleClick={onRowDoubleClick || onRowClick}
            />
          )}
          {currentView === "list" && (
            <ListView
              columns={columns}
              data={filteredData}
              titleField={titleField}
              onRowDoubleClick={onRowDoubleClick || onRowClick}
            />
          )}
          {currentView === "form" && (
            <FormView
              columns={columns}
              onInlineAddItem={onInlineAddItem}
            />
          )}
          {currentView === "document" && <DocumentView />}
          {currentView === "chart" && (
            <ChartView columns={columns} data={filteredData} />
          )}
        </>
      )}
    </div>
  );
}

export default UniversalViewSystem;
