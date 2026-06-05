import { useState, useMemo, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LayoutList, LayoutGrid, Upload, Edit2, Loader2, Search, Target, Flag, Crosshair, Zap, TrendingUp, BarChart3, Layers, ChevronDown, ChevronRight, MessageSquare, Send, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import * as XLSX from "xlsx";

// ── Extended entity types (matching actual API responses) ─────────────────────

export type StrategyItemEx = {
  id: number; tenantId: number; templateType: string; title: string;
  description: string | null; ownerId: string | null; ownerName: string | null;
  departmentId: number | null; departmentName: string | null;
  status: string; ragStatus: string | null; progress: number | null; trend: string | null;
  timeframe: string | null; fiscalYear: string | null; reviewCadence: string | null;
  lastReviewDate: string | null; nextReviewDate: string | null;
  targetDate: string | null; notes: string | null; order: number | null; createdAt: string;
};

export type GoalEx = {
  id: number; tenantId: number; strategyItemId: number | null; type: string;
  title: string; description: string | null; ownerId: string | null;
  ownerName: string | null; departmentId: number | null; departmentName: string | null;
  status: string; ragStatus: string | null; progress: number | null; trend: string | null;
  startDate: string | null; endDate: string | null; targetDate: string | null;
  reviewCadence: string | null; createdAt: string;
};

export type ObjectiveEx = {
  id: number; tenantId: number; goalId: number | null; title: string;
  description: string | null; ownerId: string | null; ownerName: string | null;
  departmentId: number | null; departmentName: string | null;
  status: string; ragStatus: string | null; progress: number | null; trend: string | null;
  startDate: string | null; endDate: string | null; targetDate: string | null; createdAt: string;
};

export type InitiativeEx = {
  id: number; tenantId: number; goalId: number | null; objectiveId: number | null;
  title: string; description: string | null; ownerId: string | null;
  ownerName: string | null; departmentId: number | null; departmentName: string | null;
  status: string; ragStatus: string | null; progress: number | null;
  priority: string | null; startDate: string | null; dueDate: string | null;
  targetDate: string | null; projectId: number | null;
  deliveryType: string | null; linkedRecordRef: string | null; createdAt: string;
};

export type OkrEx = {
  id: number; tenantId: number; objectiveId: number | null; goalId: number | null;
  title: string; description: string | null; ownerId: string | null; ownerName: string | null;
  departmentId: number | null; departmentName: string | null;
  status: string; ragStatus: string | null; progress: number | null;
  startDate: string | null; endDate: string | null; targetDate: string | null; createdAt: string;
};

export type KpiEx = {
  id: number; tenantId: number; goalId: number | null; name: string;
  description: string | null; targetValue: string | null; currentValue: string | null;
  unit: string | null; indicatorType: string | null; ownerId: string | null;
  ownerName: string | null; departmentId: number | null; departmentName: string | null;
  status: string | null; trend: string | null; createdAt: string;
};

// ── Shared styling ────────────────────────────────────────────────────────────

const RAG_CLASS: Record<string, string> = {
  green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  red:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};
const RAG_DOT: Record<string, string> = { green:"bg-green-500", amber:"bg-amber-500", red:"bg-red-500" };
const RAG_LABEL: Record<string, string> = { green:"On Track", amber:"At Risk", red:"Behind" };

const STATUS_CLASS: Record<string, string> = {
  on_track:"bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  at_risk: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  off_track:"bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  active:  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress:"bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  completed:"bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  draft:   "bg-muted text-muted-foreground",
  active_project:"bg-blue-100 text-blue-700",
};

const PRIORITY_CLASS: Record<string, string> = {
  low:     "bg-muted text-muted-foreground",
  medium:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  high:    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  critical:"bg-red-900 text-red-100",
};

function RagBadge({ rag }: { rag: string | null | undefined }) {
  if (!rag) return <span className="text-muted-foreground/40">—</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap", RAG_CLASS[rag] ?? "bg-muted text-muted-foreground")}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", RAG_DOT[rag] ?? "bg-muted-foreground")} />
      {RAG_LABEL[rag] ?? rag}
    </span>
  );
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-muted-foreground/40">—</span>;
  return (
    <span className={cn("inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize whitespace-nowrap", STATUS_CLASS[status] ?? "bg-muted text-muted-foreground")}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function ProgressBar({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground/40">—</span>;
  const color = value >= 70 ? "bg-green-500" : value >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground w-7 shrink-0 tabular-nums">{value}%</span>
    </div>
  );
}

function refCode(prefix: string, id: number) {
  return `${prefix}-${String(id).padStart(3, "0")}`;
}

function DateCell({ date }: { date: string | null | undefined }) {
  if (!date) return <span className="text-muted-foreground/40">—</span>;
  const d = new Date(date);
  return <span className="text-xs whitespace-nowrap">{isNaN(d.getTime()) ? date : d.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" })}</span>;
}

function OwnerCell({ name }: { name: string | null | undefined }) {
  if (!name) return <span className="text-muted-foreground/40">—</span>;
  const initials = name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold text-primary shrink-0">{initials}</div>
      <span className="text-xs truncate max-w-[100px]">{name}</span>
    </div>
  );
}

// ── Edit Dialog ───────────────────────────────────────────────────────────────

type FieldType = "text" | "textarea" | "select" | "number" | "date";
type FieldDef = { key: string; label: string; type: FieldType; options?: {value:string;label:string}[]; span?: "full" };

function buildFormInit(item: Record<string,unknown>, fields: FieldDef[]): Record<string,unknown> {
  const init: Record<string,unknown> = {};
  fields.forEach(f => { init[f.key] = item[f.key] ?? ""; });
  return init;
}

function EditDialog({
  item, fields, open, onClose, onSave, isSaving, title,
}: {
  item: Record<string,unknown>; fields: FieldDef[]; open: boolean;
  onClose: ()=>void; onSave: (d: Record<string,unknown>)=>void;
  isSaving: boolean; title: string;
}) {
  const [form, setForm] = useState<Record<string,unknown>>(() => buildFormInit(item, fields));

  useEffect(() => {
    setForm(buildFormInit(item, fields));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, open]);

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
          {fields.map(f => (
            <div key={f.key} className={cn("space-y-1.5", f.span === "full" ? "col-span-2" : "")}>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{f.label}</Label>
              {f.type === "textarea" ? (
                <Textarea value={String(form[f.key] ?? "")} onChange={e => set(f.key, e.target.value)} rows={3} className="text-sm" />
              ) : f.type === "select" ? (
                <Select value={String(form[f.key] ?? "")} onValueChange={v => set(f.key, v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{(f.options ?? []).map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} value={String(form[f.key] ?? "")} onChange={e => set(f.key, e.target.value)} className="h-8 text-sm" />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── ManageLayerView core ──────────────────────────────────────────────────────

type ColDef<T> = { key: string; label: string; width?: string; render: (item: T) => React.ReactNode };
type FilterDef = { key: string; label: string; options: {value:string;label:string}[] };

type ReviewNote = {
  id: number; entityType: string; entityId: number; content: string;
  ragSnapshot: string | null; authorName: string; createdAt: string;
};

interface ManageLayerViewProps<T extends {id:number}> {
  items: T[];
  refPrefix: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  accent: string;
  columns: ColDef<T>[];
  editFields: FieldDef[];
  filters?: FilterDef[];
  apiBase: string;
  queryKey: string;
  defaultCard?: (item: T, onEdit: (i:T)=>void) => React.ReactNode;
  addButton?: React.ReactNode;
  importSheetName?: string;
  searchKeys?: (keyof T)[];
  parentItems?: Array<{id: number; title: string}>;
  parentKey?: string;
  parentLabel?: string;
  entityType?: string;
}

const DELIVERY_TYPE_OPTIONS = [
  { value: "project",    label: "Project" },
  { value: "programme",  label: "Programme" },
  { value: "event",      label: "Event" },
  { value: "workshop",   label: "Workshop" },
  { value: "task",       label: "Task" },
  { value: "campaign",   label: "Campaign" },
  { value: "bau",        label: "BAU Activity" },
  { value: "standalone", label: "Standalone" },
];

const DELIVERY_TYPE_LABELS: Record<string,string> = Object.fromEntries(DELIVERY_TYPE_OPTIONS.map(o => [o.value, o.label]));

const RAG_CHECKIN_OPTIONS = [
  { value: "green", label: "🟢 On Track" },
  { value: "amber", label: "🟡 At Risk" },
  { value: "red",   label: "🔴 Behind" },
];

// Entities that carry a ragStatus field
const ENTITY_HAS_RAG = new Set(["strategy","goal","objective","initiative","okr","kpi"]);

function formatCheckinDate(d: string) {
  try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return d; }
}

function ManageLayerView<T extends {id:number; [k:string]: unknown}>({
  items, refPrefix, title, subtitle, icon: Icon, accent,
  columns, editFields, filters = [], apiBase, queryKey,
  defaultCard, addButton, importSheetName, searchKeys = ["title" as keyof T, "name" as keyof T],
  parentItems, parentKey, parentLabel = "Parent", entityType,
}: ManageLayerViewProps<T>) {
  const { toast } = useToast();
  const [view, setView] = useState<"table"|"card">("table");
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string,string>>({});
  const [editItem, setEditItem] = useState<T|null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<"none"|"ragStatus"|"status"|"departmentName"|"ownerName"|"parent">("none");

  // ── Check-in Sheet state ──────────────────────────────────────────────────
  const [checkinItem, setCheckinItem] = useState<T|null>(null);
  const [checkinRag, setCheckinRag] = useState("");
  const [checkinProgress, setCheckinProgress] = useState("");
  const [checkinNote, setCheckinNote] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setCollapsedGroups(new Set()); }, [groupBy]);

  // ── Notes query (per entity type) ────────────────────────────────────────
  const { data: allNotes = [] } = useQuery<ReviewNote[]>({
    queryKey: ["/api/business/review-notes", entityType],
    queryFn: () => fetch(`/api/business/review-notes?tenantId=1&entityType=${entityType}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!entityType,
  });

  const noteCountByItem = useMemo(() => {
    const map: Record<number, number> = {};
    allNotes.forEach(n => { map[n.entityId] = (map[n.entityId] || 0) + 1; });
    return map;
  }, [allNotes]);

  const itemNotes = useMemo(() =>
    checkinItem ? allNotes.filter(n => n.entityId === checkinItem.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : [],
  [allNotes, checkinItem]);

  const openCheckin = (item: T) => {
    setCheckinItem(item);
    setCheckinRag(String(item.ragStatus ?? ""));
    setCheckinProgress(String(item.progress ?? ""));
    setCheckinNote("");
  };

  // ── Check-in mutations ───────────────────────────────────────────────────
  const addNoteMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest("POST", "/api/business/review-notes", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/business/review-notes"] }),
    onError: () => toast({ title: "Error", description: "Failed to save check-in.", variant: "destructive" }),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/business/review-notes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/business/review-notes"] }),
  });

  const saveCheckin = async () => {
    if (!checkinItem || !checkinNote.trim()) return;
    const itemRag = String(checkinItem.ragStatus ?? "");
    const itemProgress = checkinItem.progress as number | null;
    const newRag = checkinRag || null;
    const newProgress = checkinProgress !== "" ? Number(checkinProgress) : null;
    // Update item if RAG or progress changed
    if ((newRag && newRag !== itemRag) || (newProgress !== null && newProgress !== itemProgress)) {
      const patch: Record<string,unknown> = {};
      if (newRag && newRag !== itemRag) patch.ragStatus = newRag;
      if (newProgress !== null && newProgress !== itemProgress) patch.progress = newProgress;
      await apiRequest("PUT", `${apiBase}/${checkinItem.id}`, patch).catch(() => {});
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      queryClient.invalidateQueries({ queryKey: ["/api/business/strategy-map"] });
    }
    addNoteMutation.mutate({
      tenantId: 1, entityType, entityId: checkinItem.id,
      content: checkinNote.trim(),
      ragSnapshot: newRag || null,
    }, {
      onSuccess: () => {
        setCheckinNote("");
        toast({ title: "Check-in saved", description: "Progress note recorded." });
      },
    });
  };

  const updateMutation = useMutation({
    mutationFn: (d: {id:number; payload: Record<string,unknown>}) =>
      apiRequest("PUT", `${apiBase}/${d.id}`, d.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      queryClient.invalidateQueries({ queryKey: ["/api/business/strategy-map"] });
      setEditItem(null);
      toast({ title: "Saved", description: "Record updated successfully." });
    },
    onError: () => toast({ title: "Error", description: "Failed to save.", variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return items.filter(item => {
      const textMatch = !s || searchKeys.some(k => String(item[k] ?? "").toLowerCase().includes(s));
      const filterMatch = Object.entries(activeFilters).every(([k, v]) =>
        !v || v === "all" || String(item[k] ?? "").toLowerCase() === v.toLowerCase()
      );
      return textMatch && filterMatch;
    });
  }, [items, search, activeFilters, searchKeys]);

  const getGroupLabel = (item: T): string => {
    if (groupBy === "none") return "";
    if (groupBy === "parent") {
      if (!parentItems || !parentKey) return "No Parent";
      const parentId = item[parentKey as keyof T] as number | null | undefined;
      const parent = parentItems.find(p => p.id === parentId);
      return parent ? parent.title : "No Parent";
    }
    const raw = String(item[groupBy] ?? "");
    if (!raw) return groupBy === "ownerName" ? "Unassigned" : groupBy === "departmentName" ? "No Department" : "Unknown";
    if (groupBy === "ragStatus") {
      return raw === "green" ? "🟢 On Track" : raw === "amber" ? "🟡 At Risk" : raw === "red" ? "🔴 Behind" : raw;
    }
    if (groupBy === "status") {
      const map: Record<string,string> = { on_track: "On Track", at_risk: "At Risk", off_track: "Off Track", completed: "Completed", in_progress: "In Progress", active: "Active", draft: "Draft" };
      return map[raw] ?? raw;
    }
    return raw;
  };

  const ragGroupHeaderClass: Record<string, string> = {
    "🟢 On Track": "bg-green-50/80 dark:bg-green-950/30 border-green-300 dark:border-green-800 text-green-700 dark:text-green-400",
    "🟡 At Risk":  "bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400",
    "🔴 Behind":   "bg-red-50/80 dark:bg-red-950/30 border-red-300 dark:border-red-800 text-red-700 dark:text-red-400",
  };

  const toggleGroup = (label: string) =>
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });

  type TableRow<U> = { type: "header"; label: string; count: number; collapsed: boolean } | { type: "data"; item: U; rowIndex: number };

  const tableRows: TableRow<T>[] = useMemo(() => {
    if (groupBy === "none") return filtered.map((item, i) => ({ type: "data" as const, item, rowIndex: i }));
    const groupOrder = Array.from(new Set(filtered.map(item => getGroupLabel(item))));
    const result: TableRow<T>[] = [];
    for (const label of groupOrder) {
      const groupItems = filtered.filter(item => getGroupLabel(item) === label);
      const isCollapsed = collapsedGroups.has(label);
      result.push({ type: "header", label, count: groupItems.length, collapsed: isCollapsed });
      if (!isCollapsed) {
        groupItems.forEach((item, i) => result.push({ type: "data", item, rowIndex: i }));
      }
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, groupBy, collapsedGroups]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab);
      const sheetName = importSheetName ?? wb.SheetNames.find(s => s.toLowerCase().includes(title.toLowerCase())) ?? wb.SheetNames[0];
      const ws = wb.Sheets[sheetName] ?? wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string,unknown>>(ws);
      toast({ title: `Import ready`, description: `Parsed ${rows.length} rows from "${sheetName}". Review and confirm to apply.` });
    } catch {
      toast({ title: "Import failed", description: "Could not parse the file.", variant: "destructive" });
    }
    setImportOpen(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3 mr-auto">
          <div className="p-2 rounded-lg" style={{ background: `${accent}20` }}>
            <Icon className="h-5 w-5" style={{ color: accent }} />
          </div>
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground">{subtitle} · <span className="font-medium">{filtered.length}</span> of {items.length}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="h-8 pl-8 w-40 text-xs" />
        </div>

        {/* Dynamic filters */}
        {filters.map(f => (
          <Select key={f.key} value={activeFilters[f.key] ?? "all"} onValueChange={v => setActiveFilters(p => ({ ...p, [f.key]: v }))}>
            <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder={f.label} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All {f.label}s</SelectItem>
              {f.options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        ))}

        {/* Group by — table mode only */}
        {view === "table" && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium border transition-colors",
                  groupBy !== "none"
                    ? "bg-[#0ea5e9]/10 border-[#0ea5e9]/30 text-[#0ea5e9] hover:bg-[#0ea5e9]/20"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                )}
                data-testid="button-group-by"
              >
                <Layers className="h-3.5 w-3.5" />
                {groupBy === "none" ? "Group" :
                  groupBy === "ragStatus" ? "Group: RAG" :
                  groupBy === "status" ? "Group: Status" :
                  groupBy === "departmentName" ? "Group: Dept" :
                  groupBy === "parent" ? `Group: ${parentLabel}` : "Group: Owner"}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuItem onClick={() => setGroupBy("none")} data-testid="group-none">None</DropdownMenuItem>
              {parentItems && parentItems.length > 0 && (
                <DropdownMenuItem onClick={() => setGroupBy("parent")} data-testid="group-parent">{parentLabel}</DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setGroupBy("ragStatus")} data-testid="group-rag">RAG Status</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy("status")} data-testid="group-status">Status</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy("departmentName")} data-testid="group-department">Department</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy("ownerName")} data-testid="group-owner">Owner</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* View toggle */}
        <div className="flex rounded-md border border-border overflow-hidden">
          {(["table","card"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={cn("px-2.5 py-1.5 flex items-center gap-1 text-xs transition-colors",
                view === v ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted")}>
              {v === "table" ? <LayoutList className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline capitalize">{v}</span>
            </button>
          ))}
        </div>

        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setImportOpen(true)}>
          <Upload className="h-3.5 w-3.5" /> Import
        </Button>
        {addButton}
      </div>

      {/* Table View */}
      {view === "table" && (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-border bg-muted/60">
                  <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap w-[80px]">Ref</th>
                  {columns.map(c => (
                    <th key={c.key} className="px-3 py-2.5 text-left font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap" style={{ width: c.width }}>
                      {c.label}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 w-[52px]" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={columns.length + 2} className="px-4 py-14 text-center text-muted-foreground">No records match the current filters</td></tr>
                ) : tableRows.map(row => {
                  if (row.type === "header") {
                    return (
                      <tr key={`gh-${row.label}`}>
                        <td
                          colSpan={columns.length + 2}
                          className={cn(
                            "px-4 py-0 border-b border-border/40 cursor-pointer select-none",
                            ragGroupHeaderClass[row.label] ?? "bg-muted/60 text-muted-foreground"
                          )}
                          onClick={() => toggleGroup(row.label)}
                          data-testid={`group-header-${row.label}`}
                        >
                          <div className="flex items-center gap-2 py-2">
                            <span className="inline-flex">
                              {row.collapsed
                                ? <ChevronRight className="h-3.5 w-3.5 opacity-70" />
                                : <ChevronDown className="h-3.5 w-3.5 opacity-70" />}
                            </span>
                            <Layers className="h-3.5 w-3.5 opacity-60" />
                            <span className="font-semibold text-xs uppercase tracking-wider">{row.label}</span>
                            <span className="font-normal opacity-60 text-xs normal-case tracking-normal">
                              · {row.count} item{row.count !== 1 ? "s" : ""}
                              {row.collapsed && <span className="ml-1 italic">(collapsed)</span>}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  const { item, rowIndex } = row;
                  return (
                    <tr key={item.id}
                      className={cn("border-t border-border/30 hover:bg-muted/30 transition-colors", rowIndex % 2 !== 0 ? "bg-muted/10" : "")}>
                      <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground whitespace-nowrap" style={{ color: accent }}>
                        {refCode(refPrefix, item.id)}
                      </td>
                      {columns.map(c => (
                        <td key={c.key} className="px-3 py-2 align-middle max-w-[220px]">{c.render(item)}</td>
                      ))}
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        {entityType && (
                          <button onClick={() => openCheckin(item)}
                            className="relative text-muted-foreground hover:text-primary p-1 rounded hover:bg-muted transition-colors mr-0.5"
                            title="Add / view check-in notes"
                            data-testid={`button-checkin-${item.id}`}>
                            <MessageSquare className="h-3.5 w-3.5" />
                            {(noteCountByItem[item.id] || 0) > 0 && (
                              <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full text-[8px] font-bold flex items-center justify-center px-0.5 leading-none"
                                style={{ background: accent, color: "#fff" }}>
                                {noteCountByItem[item.id]}
                              </span>
                            )}
                          </button>
                        )}
                        <button onClick={() => setEditItem(item)}
                          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted transition-colors"
                          title="Edit record">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-border bg-muted/20 flex justify-between items-center">
            <span className="text-xs text-muted-foreground">{filtered.length} of {items.length} records shown</span>
            <span className="text-xs text-muted-foreground">Click <Edit2 className="h-2.5 w-2.5 inline mx-0.5" /> to edit any row</span>
          </div>
        </div>
      )}

      {/* Card View */}
      {view === "card" && (
        filtered.length === 0
          ? <div className="text-center py-16 text-muted-foreground text-sm">No records match the current filters</div>
          : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(item => defaultCard ? defaultCard(item, setEditItem) : (
                <DefaultCard key={item.id} item={item} refPrefix={refPrefix} accent={accent} onEdit={() => setEditItem(item)} />
              ))}
            </div>
      )}

      {/* ── Check-in Sheet ──────────────────────────────────────────────── */}
      <Sheet open={!!checkinItem} onOpenChange={open => !open && setCheckinItem(null)}>
        <SheetContent side="right" className="w-[480px] sm:w-[480px] flex flex-col overflow-hidden p-0">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted capitalize">{entityType}</span>
              {checkinItem && <span className="font-mono text-[10px] text-muted-foreground" style={{ color: accent }}>{refCode(refPrefix, checkinItem.id)}</span>}
            </div>
            <SheetTitle className="text-sm leading-snug line-clamp-2">
              {checkinItem ? String(checkinItem.title ?? checkinItem.name ?? "") : ""}
            </SheetTitle>
            {checkinItem && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {checkinItem.ragStatus && <RagBadge rag={String(checkinItem.ragStatus)} />}
                {checkinItem.progress !== null && checkinItem.progress !== undefined && (
                  <span className="text-[10px] text-muted-foreground">{String(checkinItem.progress)}% complete</span>
                )}
              </div>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Add check-in form */}
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Check-in</h4>
              {entityType && ENTITY_HAS_RAG.has(entityType) && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">RAG Status</Label>
                  <Select value={checkinRag || "none"} onValueChange={v => setCheckinRag(v === "none" ? "" : v)}>
                    <SelectTrigger className="h-8 text-sm" data-testid="select-checkin-rag"><SelectValue placeholder="No change" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No change</SelectItem>
                      {RAG_CHECKIN_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Progress % <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input
                  type="number" min={0} max={100} placeholder="e.g. 65"
                  value={checkinProgress}
                  onChange={e => setCheckinProgress(e.target.value)}
                  className="h-8 text-sm" data-testid="input-checkin-progress"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Note <span className="text-destructive">*</span></Label>
                <Textarea
                  placeholder="What's the current status? Any highlights, blockers, or decisions?"
                  value={checkinNote}
                  onChange={e => setCheckinNote(e.target.value)}
                  rows={3} className="text-sm resize-none" data-testid="textarea-checkin-note"
                />
              </div>
              <Button
                size="sm" className="w-full gap-1.5" onClick={saveCheckin}
                disabled={addNoteMutation.isPending || !checkinNote.trim()}
                data-testid="button-save-checkin"
              >
                {addNoteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Save Check-in
              </Button>
            </div>

            {/* History */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                History
                <span className="font-normal normal-case tracking-normal text-muted-foreground/60">· {itemNotes.length} note{itemNotes.length !== 1 ? "s" : ""}</span>
              </h4>
              {itemNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No check-ins yet for this item.</p>
              ) : itemNotes.map(note => (
                <div key={note.id} className="rounded-lg border border-border bg-card p-3 space-y-1.5"
                  data-testid={`note-history-${note.id}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {note.ragSnapshot && <RagBadge rag={note.ragSnapshot} />}
                      <span className="text-xs font-medium">{note.authorName}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[10px] text-muted-foreground">{formatCheckinDate(note.createdAt)}</span>
                      <button
                        onClick={() => deleteNoteMutation.mutate(note.id)}
                        disabled={deleteNoteMutation.isPending}
                        className="text-muted-foreground/50 hover:text-destructive p-0.5 rounded transition-colors"
                        data-testid={`button-delete-note-${note.id}`}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.content}</p>
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Dialog */}
      {editItem && (
        <EditDialog
          item={editItem as Record<string,unknown>}
          fields={editFields}
          open={!!editItem}
          onClose={() => setEditItem(null)}
          onSave={payload => updateMutation.mutate({ id: editItem.id, payload })}
          isSaving={updateMutation.isPending}
          title={`Edit ${title.replace(/s$/, "")}`}
        />
      )}

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Import {title}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Upload a CSV or Excel file. The first row must be column headers. Download the Strategy Map template for the expected column format.</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer" />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DefaultCard({ item, refPrefix, accent, onEdit }: {
  item: Record<string,unknown>; refPrefix: string; accent: string; onEdit: ()=>void;
}) {
  const title = String(item.title ?? item.name ?? "");
  const rag = item.ragStatus as string | null;
  const status = item.status as string | null;
  const progress = item.progress as number | null;
  return (
    <Card className="rounded-xl hover:shadow-md transition-all border-border/50 relative overflow-hidden">
      <div className="absolute top-0 left-0 bottom-0 w-[3px]" style={{ background: accent }} />
      <CardHeader className="pb-2 pl-5">
        <div className="flex items-start justify-between gap-2">
          <span className="font-mono text-[9px] text-muted-foreground" style={{ color: accent }}>{refCode(refPrefix, item.id as number)}</span>
          <button onClick={onEdit} className="text-muted-foreground hover:text-foreground p-0.5 shrink-0"><Edit2 className="h-3.5 w-3.5" /></button>
        </div>
        <CardTitle className="text-sm leading-snug line-clamp-2 mt-1">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pl-5 pb-3 space-y-2">
        {(item.ownerName || item.departmentName) && (
          <div className="text-xs text-muted-foreground truncate">
            {item.ownerName && <><OwnerCell name={item.ownerName as string} />&nbsp;</>}
            {item.departmentName && <span className="opacity-60">· {String(item.departmentName)}</span>}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 items-center">
          {rag && <RagBadge rag={rag} />}
          {status && <StatusBadge status={status} />}
          {(item.priority) && (
            <span className={cn("inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize", PRIORITY_CLASS[item.priority as string] ?? "bg-muted text-muted-foreground")}>
              {String(item.priority)}
            </span>
          )}
        </div>
        {progress !== null && progress !== undefined && <ProgressBar value={progress} />}
        {(item.targetDate || item.dueDate) && (
          <div className="text-[10px] text-muted-foreground">Target: <DateCell date={(item.targetDate ?? item.dueDate) as string} /></div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Shared filter options ─────────────────────────────────────────────────────

const STATUS_FILTER: FilterDef = {
  key: "status", label: "Status",
  options: [
    { value: "on_track", label: "On Track" },
    { value: "at_risk",  label: "At Risk" },
    { value: "off_track",label: "Off Track" },
    { value: "active",   label: "Active" },
    { value: "in_progress", label: "In Progress" },
    { value: "completed",label: "Completed" },
    { value: "draft",    label: "Draft" },
  ],
};

const RAG_FILTER: FilterDef = {
  key: "ragStatus", label: "RAG",
  options: [
    { value: "green", label: "🟢 On Track" },
    { value: "amber", label: "🟡 At Risk" },
    { value: "red",   label: "🔴 Behind" },
  ],
};

const EDIT_STATUS_OPTIONS = [
  { value: "on_track",   label: "On Track" },
  { value: "at_risk",    label: "At Risk" },
  { value: "off_track",  label: "Off Track" },
  { value: "active",     label: "Active" },
  { value: "in_progress",label: "In Progress" },
  { value: "completed",  label: "Completed" },
  { value: "draft",      label: "Draft" },
];

const EDIT_RAG_OPTIONS = [
  { value: "green", label: "🟢 Green — On Track" },
  { value: "amber", label: "🟡 Amber — At Risk" },
  { value: "red",   label: "🔴 Red — Behind" },
];

// ── Title cell ────────────────────────────────────────────────────────────────
function TitleCell({ text }: { text: string }) {
  return <span className="text-xs font-medium leading-snug line-clamp-2">{text}</span>;
}
function ParentCell({ text, prefix, id }: { text: string | undefined; prefix: string; id: number | null | undefined }) {
  if (!text || !id) return <span className="text-muted-foreground/40">—</span>;
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[9px] text-muted-foreground">{prefix}-{String(id).padStart(3,"0")}</span>
      <span className="text-[10px] leading-snug line-clamp-1 text-muted-foreground">{text}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTED TAB COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Strategy Tab ──────────────────────────────────────────────────────────────

const STRATEGY_TEMPLATE_LABELS: Record<string,string> = {
  vision:"Vision / Aspirations", target_market:"Target Market", competitor:"Competitor Analysis",
  swot:"SWOT Analysis", risk:"Strategic Risks", assumption:"Assumptions", strategy:"Strategy",
};

const STRATEGY_EDIT_FIELDS: FieldDef[] = [
  { key:"title", label:"Title", type:"text", span:"full" },
  { key:"description", label:"Description", type:"textarea", span:"full" },
  { key:"templateType", label:"Type", type:"select", options:[
    {value:"strategy",label:"Strategy"},{value:"vision",label:"Vision"},{value:"target_market",label:"Target Market"},
    {value:"competitor",label:"Competitor Analysis"},{value:"swot",label:"SWOT"},{value:"risk",label:"Strategic Risks"},{value:"assumption",label:"Assumptions"},
  ]},
  { key:"status", label:"Status", type:"select", options: EDIT_STATUS_OPTIONS },
  { key:"ragStatus", label:"RAG Status", type:"select", options: EDIT_RAG_OPTIONS },
  { key:"progress", label:"Progress (%)", type:"number" },
  { key:"targetDate", label:"Target Date", type:"date" },
  { key:"reviewCadence", label:"Review Cadence", type:"select", options:[
    {value:"monthly",label:"Monthly"},{value:"quarterly",label:"Quarterly"},{value:"bi-annual",label:"Bi-Annual"},{value:"annual",label:"Annual"},
  ]},
  { key:"ownerName", label:"Owner Name", type:"text" },
  { key:"notes", label:"Notes", type:"textarea", span:"full" },
];

export function EnhancedStrategyTab({
  strategyItems, addButton,
}: { strategyItems: StrategyItemEx[]; addButton?: React.ReactNode }) {
  const columns: ColDef<StrategyItemEx>[] = [
    { key:"title",        label:"Title",       width:"22%", render:r=><TitleCell text={r.title} /> },
    { key:"templateType", label:"Type",        width:"12%", render:r=><span className="text-[10px] capitalize">{STRATEGY_TEMPLATE_LABELS[r.templateType] ?? r.templateType}</span> },
    { key:"ownerName",    label:"Owner",       width:"13%", render:r=><OwnerCell name={r.ownerName} /> },
    { key:"departmentName",label:"Department", width:"12%", render:r=><span className="text-[10px] truncate max-w-[100px] block">{r.departmentName ?? "—"}</span> },
    { key:"ragStatus",    label:"RAG",         width:"10%", render:r=><RagBadge rag={r.ragStatus} /> },
    { key:"status",       label:"Status",      width:"10%", render:r=><StatusBadge status={r.status} /> },
    { key:"progress",     label:"Progress",    width:"12%", render:r=><ProgressBar value={r.progress} /> },
    { key:"targetDate",   label:"Target Date", width:"10%", render:r=><DateCell date={r.targetDate} /> },
    { key:"reviewCadence",label:"Cadence",     width:"8%",  render:r=><span className="text-[10px] capitalize">{r.reviewCadence ?? "—"}</span> },
  ];

  return (
    <ManageLayerView
      items={strategyItems} refPrefix="S" title="Strategies" subtitle="Strategic pillars & direction"
      icon={Target} accent="#a855f7" columns={columns} editFields={STRATEGY_EDIT_FIELDS}
      filters={[STATUS_FILTER, RAG_FILTER, { key:"templateType", label:"Type", options: Object.entries(STRATEGY_TEMPLATE_LABELS).map(([v,l])=>({value:v,label:l})) }]}
      apiBase="/api/business/strategy" queryKey="/api/business/strategy"
      addButton={addButton} importSheetName="Strategies" entityType="strategy"
    />
  );
}

// ── Goals Tab ─────────────────────────────────────────────────────────────────

const GOALS_EDIT_FIELDS: FieldDef[] = [
  { key:"title",       label:"Title",       type:"text",     span:"full" },
  { key:"description", label:"Description", type:"textarea", span:"full" },
  { key:"status",      label:"Status",      type:"select",   options: EDIT_STATUS_OPTIONS },
  { key:"ragStatus",   label:"RAG Status",  type:"select",   options: EDIT_RAG_OPTIONS },
  { key:"progress",    label:"Progress (%)",type:"number" },
  { key:"targetDate",  label:"Target Date", type:"date" },
  { key:"startDate",   label:"Start Date",  type:"date" },
  { key:"endDate",     label:"End Date",    type:"date" },
  { key:"ownerName",   label:"Owner Name",  type:"text" },
  { key:"reviewCadence",label:"Review Cadence",type:"select", options:[
    {value:"monthly",label:"Monthly"},{value:"quarterly",label:"Quarterly"},{value:"bi-annual",label:"Bi-Annual"},{value:"annual",label:"Annual"},
  ]},
];

export function EnhancedGoalsTab({
  goals, strategyItems, addButton,
}: { goals: GoalEx[]; strategyItems: StrategyItemEx[]; addButton?: React.ReactNode }) {
  const stratMap = useMemo(() => Object.fromEntries(strategyItems.map(s => [s.id, s])), [strategyItems]);

  const columns: ColDef<GoalEx>[] = [
    { key:"title",         label:"Title",           width:"22%", render:r=><TitleCell text={r.title} /> },
    { key:"strategyItemId",label:"Parent Strategy",  width:"17%", render:r=><ParentCell text={stratMap[r.strategyItemId??0]?.title} prefix="S" id={r.strategyItemId} /> },
    { key:"ownerName",     label:"Owner",           width:"12%", render:r=><OwnerCell name={r.ownerName} /> },
    { key:"departmentName",label:"Department",      width:"12%", render:r=><span className="text-[10px] truncate max-w-[100px] block">{r.departmentName ?? "—"}</span> },
    { key:"ragStatus",     label:"RAG",             width:"10%", render:r=><RagBadge rag={r.ragStatus} /> },
    { key:"status",        label:"Status",          width:"10%", render:r=><StatusBadge status={r.status} /> },
    { key:"progress",      label:"Progress",        width:"12%", render:r=><ProgressBar value={r.progress} /> },
    { key:"targetDate",    label:"Target Date",     width:"10%", render:r=><DateCell date={r.targetDate ?? r.endDate} /> },
    { key:"reviewCadence", label:"Cadence",         width:"8%",  render:r=><span className="text-[10px] capitalize">{r.reviewCadence ?? "—"}</span> },
  ];

  return (
    <ManageLayerView
      items={goals} refPrefix="G" title="Goals" subtitle="Strategic goals linked to pillars"
      icon={Flag} accent="#38bdf8" columns={columns} editFields={GOALS_EDIT_FIELDS}
      filters={[STATUS_FILTER, RAG_FILTER]}
      apiBase="/api/business/goals" queryKey="/api/business/goals"
      addButton={addButton} importSheetName="Goals"
      parentItems={strategyItems} parentKey="strategyItemId" parentLabel="Strategy"
      entityType="goal"
    />
  );
}

// ── Objectives Tab ────────────────────────────────────────────────────────────

const OBJECTIVES_EDIT_FIELDS: FieldDef[] = [
  { key:"title",       label:"Title",       type:"text",     span:"full" },
  { key:"description", label:"Description", type:"textarea", span:"full" },
  { key:"status",      label:"Status",      type:"select",   options: EDIT_STATUS_OPTIONS },
  { key:"ragStatus",   label:"RAG Status",  type:"select",   options: EDIT_RAG_OPTIONS },
  { key:"progress",    label:"Progress (%)",type:"number" },
  { key:"targetDate",  label:"Target Date", type:"date" },
  { key:"startDate",   label:"Start Date",  type:"date" },
  { key:"ownerName",   label:"Owner Name",  type:"text" },
];

export function EnhancedObjectivesTab({
  objectives, goals,
}: { objectives: ObjectiveEx[]; goals: GoalEx[] }) {
  const goalMap = useMemo(() => Object.fromEntries(goals.map(g => [g.id, g])), [goals]);

  const goalOptions = useMemo(() => goals.map(g => ({ value: String(g.id), label: g.title })), [goals]);
  const fieldsWithGoal = [...OBJECTIVES_EDIT_FIELDS, { key:"goalId", label:"Parent Goal", type:"select" as const, options: goalOptions }];

  const columns: ColDef<ObjectiveEx>[] = [
    { key:"title",         label:"Title",       width:"22%", render:r=><TitleCell text={r.title} /> },
    { key:"goalId",        label:"Parent Goal", width:"17%", render:r=><ParentCell text={goalMap[r.goalId??0]?.title} prefix="G" id={r.goalId} /> },
    { key:"ownerName",     label:"Owner",       width:"12%", render:r=><OwnerCell name={r.ownerName} /> },
    { key:"departmentName",label:"Department",  width:"12%", render:r=><span className="text-[10px] truncate max-w-[100px] block">{r.departmentName ?? "—"}</span> },
    { key:"ragStatus",     label:"RAG",         width:"10%", render:r=><RagBadge rag={r.ragStatus} /> },
    { key:"status",        label:"Status",      width:"10%", render:r=><StatusBadge status={r.status} /> },
    { key:"progress",      label:"Progress",    width:"12%", render:r=><ProgressBar value={r.progress} /> },
    { key:"targetDate",    label:"Target Date", width:"10%", render:r=><DateCell date={r.targetDate} /> },
  ];

  return (
    <ManageLayerView
      items={objectives} refPrefix="OBJ" title="Objectives" subtitle="Measurable outcomes per goal"
      icon={Crosshair} accent="#818cf8" columns={columns} editFields={fieldsWithGoal}
      filters={[STATUS_FILTER, RAG_FILTER, { key:"goalId", label:"Goal", options: goalOptions }]}
      apiBase="/api/business/objectives" queryKey="/api/business/objectives"
      importSheetName="Objectives"
      parentItems={goals} parentKey="goalId" parentLabel="Goal"
      entityType="objective"
    />
  );
}

// ── Initiatives Tab ───────────────────────────────────────────────────────────

const INITIATIVES_EDIT_FIELDS: FieldDef[] = [
  { key:"title",          label:"Title",           type:"text",     span:"full" },
  { key:"description",    label:"Description",     type:"textarea", span:"full" },
  { key:"deliveryType",   label:"Delivery Type",   type:"select",   options: DELIVERY_TYPE_OPTIONS },
  { key:"linkedRecordRef",label:"Linked Record Ref",type:"text",    span:"full" },
  { key:"status",         label:"Status",          type:"select",   options: EDIT_STATUS_OPTIONS },
  { key:"ragStatus",      label:"RAG Status",      type:"select",   options: EDIT_RAG_OPTIONS },
  { key:"priority",       label:"Priority",        type:"select",   options:[{value:"low",label:"Low"},{value:"medium",label:"Medium"},{value:"high",label:"High"},{value:"critical",label:"Critical"}] },
  { key:"progress",       label:"Progress (%)",    type:"number" },
  { key:"startDate",      label:"Start Date",      type:"date" },
  { key:"dueDate",        label:"Due Date",        type:"date" },
  { key:"ownerName",      label:"Owner Name",      type:"text" },
];

export function EnhancedInitiativesTab({
  initiatives, goals, addButton,
}: { initiatives: InitiativeEx[]; goals: GoalEx[]; addButton?: React.ReactNode }) {
  const goalMap = useMemo(() => Object.fromEntries(goals.map(g => [g.id, g])), [goals]);
  const goalOptions = useMemo(() => goals.map(g => ({ value: String(g.id), label: g.title })), [goals]);
  const fieldsWithGoal = [...INITIATIVES_EDIT_FIELDS, { key:"goalId", label:"Parent Goal", type:"select" as const, options: goalOptions }];

  const columns: ColDef<InitiativeEx>[] = [
    { key:"title",         label:"Title",         width:"18%", render:r=><TitleCell text={r.title} /> },
    { key:"deliveryType",  label:"Delivery",       width:"10%", render:r=>r.deliveryType ? <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 capitalize">{DELIVERY_TYPE_LABELS[r.deliveryType] ?? r.deliveryType}</span> : <span className="text-muted-foreground/40 text-[10px]">—</span> },
    { key:"linkedRecordRef",label:"Ref",           width:"8%",  render:r=>r.linkedRecordRef ? <span className="font-mono text-[10px] text-muted-foreground">{r.linkedRecordRef}</span> : <span className="text-muted-foreground/40">—</span> },
    { key:"goalId",        label:"Parent Goal",    width:"13%", render:r=><ParentCell text={goalMap[r.goalId??0]?.title} prefix="G" id={r.goalId} /> },
    { key:"ownerName",     label:"Owner",          width:"11%", render:r=><OwnerCell name={r.ownerName} /> },
    { key:"ragStatus",     label:"RAG",            width:"9%",  render:r=><RagBadge rag={r.ragStatus} /> },
    { key:"status",        label:"Status",         width:"10%", render:r=><StatusBadge status={r.status} /> },
    { key:"priority",      label:"Priority",       width:"8%",  render:r=> r.priority ? <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize", PRIORITY_CLASS[r.priority] ?? "bg-muted text-muted-foreground")}>{r.priority}</span> : <span className="text-muted-foreground/40">—</span> },
    { key:"progress",      label:"Progress",       width:"10%", render:r=><ProgressBar value={r.progress} /> },
    { key:"dueDate",       label:"Due Date",       width:"9%",  render:r=><DateCell date={r.dueDate ?? r.targetDate} /> },
  ];

  return (
    <ManageLayerView
      items={initiatives} refPrefix="INI" title="Initiatives" subtitle="Execution work linked to goals"
      icon={Zap} accent="#34d399" columns={columns} editFields={fieldsWithGoal}
      filters={[STATUS_FILTER, RAG_FILTER,
        { key:"priority", label:"Priority", options:[{value:"low",label:"Low"},{value:"medium",label:"Medium"},{value:"high",label:"High"},{value:"critical",label:"Critical"}] },
      ]}
      apiBase="/api/business/initiatives" queryKey="/api/business/initiatives"
      addButton={addButton} importSheetName="Initiatives"
      parentItems={goals} parentKey="goalId" parentLabel="Goal"
      entityType="initiative"
    />
  );
}

// ── OKRs Tab ──────────────────────────────────────────────────────────────────

const OKRS_EDIT_FIELDS: FieldDef[] = [
  { key:"title",       label:"Title",       type:"text",     span:"full" },
  { key:"description", label:"Description", type:"textarea", span:"full" },
  { key:"status",      label:"Status",      type:"select",   options: EDIT_STATUS_OPTIONS },
  { key:"ragStatus",   label:"RAG Status",  type:"select",   options: EDIT_RAG_OPTIONS },
  { key:"progress",    label:"Progress (%)",type:"number" },
  { key:"targetDate",  label:"Target Date", type:"date" },
  { key:"ownerName",   label:"Owner Name",  type:"text" },
];

export function EnhancedOkrsTab({
  okrs, objectives, goals,
}: { okrs: OkrEx[]; objectives: ObjectiveEx[]; goals: GoalEx[] }) {
  const objMap  = useMemo(() => Object.fromEntries(objectives.map(o => [o.id, o])), [objectives]);
  const goalMap = useMemo(() => Object.fromEntries(goals.map(g => [g.id, g])), [goals]);
  const objOptions = useMemo(() => objectives.map(o => ({ value: String(o.id), label: o.title })), [objectives]);
  const fieldsWithParent = [...OKRS_EDIT_FIELDS, { key:"objectiveId", label:"Parent Objective", type:"select" as const, options: objOptions }];

  const columns: ColDef<OkrEx>[] = [
    { key:"title",       label:"Title",            width:"22%", render:r=><TitleCell text={r.title} /> },
    { key:"objectiveId", label:"Parent Objective",  width:"17%", render:r=><ParentCell text={objMap[r.objectiveId??0]?.title} prefix="OBJ" id={r.objectiveId} /> },
    { key:"goalId",      label:"Parent Goal",       width:"15%", render:r=><ParentCell text={goalMap[r.goalId??0]?.title} prefix="G" id={r.goalId} /> },
    { key:"ownerName",   label:"Owner",             width:"12%", render:r=><OwnerCell name={r.ownerName} /> },
    { key:"ragStatus",   label:"RAG",               width:"10%", render:r=><RagBadge rag={r.ragStatus} /> },
    { key:"status",      label:"Status",            width:"10%", render:r=><StatusBadge status={r.status} /> },
    { key:"progress",    label:"Progress",          width:"12%", render:r=><ProgressBar value={r.progress} /> },
    { key:"targetDate",  label:"Target Date",       width:"10%", render:r=><DateCell date={r.targetDate} /> },
  ];

  return (
    <ManageLayerView
      items={okrs} refPrefix="OKR" title="OKRs" subtitle="Objectives & key results"
      icon={TrendingUp} accent="#fbbf24" columns={columns} editFields={fieldsWithParent}
      filters={[STATUS_FILTER, RAG_FILTER]}
      apiBase="/api/business/okrs" queryKey="/api/business/okrs"
      importSheetName="OKRs"
      parentItems={objectives} parentKey="objectiveId" parentLabel="Objective"
      entityType="okr"
    />
  );
}

// ── KPIs Tab ──────────────────────────────────────────────────────────────────

const KPIS_EDIT_FIELDS: FieldDef[] = [
  { key:"name",          label:"KPI Name",    type:"text",     span:"full" },
  { key:"description",   label:"Description", type:"textarea", span:"full" },
  { key:"indicatorType", label:"Type",        type:"select",   options:[{value:"leading",label:"Leading"},{value:"lagging",label:"Lagging"},{value:"process",label:"Process"},{value:"output",label:"Output"},{value:"outcome",label:"Outcome"}] },
  { key:"currentValue",  label:"Current Value",type:"text" },
  { key:"targetValue",   label:"Target Value", type:"text" },
  { key:"unit",          label:"Unit",         type:"text" },
  { key:"status",        label:"Status",       type:"select",  options: EDIT_STATUS_OPTIONS },
  { key:"trend",         label:"Trend",        type:"select",  options:[{value:"up",label:"↑ Up"},{value:"down",label:"↓ Down"},{value:"stable",label:"→ Stable"},{value:"flat",label:"— Flat"}] },
  { key:"ownerName",     label:"Owner Name",   type:"text" },
];

export function EnhancedKpisTab({
  kpis, goals,
}: { kpis: KpiEx[]; goals: GoalEx[] }) {
  const goalMap = useMemo(() => Object.fromEntries(goals.map(g => [g.id, g])), [goals]);
  const goalOptions = useMemo(() => goals.map(g => ({ value: String(g.id), label: g.title })), [goals]);
  const fieldsWithGoal = [...KPIS_EDIT_FIELDS, { key:"goalId", label:"Parent Goal", type:"select" as const, options: goalOptions }];

  const columns: ColDef<KpiEx>[] = [
    { key:"name",          label:"KPI Name",    width:"20%", render:r=><TitleCell text={r.name} /> },
    { key:"goalId",        label:"Parent Goal", width:"15%", render:r=><ParentCell text={goalMap[r.goalId??0]?.title} prefix="G" id={r.goalId} /> },
    { key:"indicatorType", label:"Type",        width:"10%", render:r=><span className="text-[10px] capitalize">{r.indicatorType ?? "—"}</span> },
    { key:"currentValue",  label:"Current",     width:"10%", render:r=><span className="text-xs font-semibold">{r.currentValue ?? "—"}{r.unit ? ` ${r.unit}` : ""}</span> },
    { key:"targetValue",   label:"Target",      width:"10%", render:r=><span className="text-xs">{r.targetValue ?? "—"}{r.unit ? ` ${r.unit}` : ""}</span> },
    { key:"ownerName",     label:"Owner",       width:"13%", render:r=><OwnerCell name={r.ownerName} /> },
    { key:"departmentName",label:"Department",  width:"11%", render:r=><span className="text-[10px] truncate max-w-[90px] block">{r.departmentName ?? "—"}</span> },
    { key:"status",        label:"Status",      width:"9%",  render:r=><StatusBadge status={r.status} /> },
    { key:"trend",         label:"Trend",       width:"8%",  render:r=><span className="text-[10px]">{r.trend === "up" ? "↑ Up" : r.trend === "down" ? "↓ Down" : r.trend === "stable" ? "→ Stable" : r.trend ?? "—"}</span> },
  ];

  return (
    <ManageLayerView
      items={kpis} refPrefix="KPI" title="KPIs" subtitle="Key performance indicators"
      icon={BarChart3} accent="#f472b6" columns={columns} editFields={fieldsWithGoal}
      filters={[STATUS_FILTER,
        { key:"indicatorType", label:"Type", options:[{value:"leading",label:"Leading"},{value:"lagging",label:"Lagging"},{value:"process",label:"Process"},{value:"output",label:"Output"},{value:"outcome",label:"Outcome"}] },
      ]}
      apiBase="/api/business/kpis" queryKey="/api/business/kpis"
      importSheetName="KPIs" searchKeys={["name"]}
      parentItems={goals} parentKey="goalId" parentLabel="Goal"
      entityType="kpi"
    />
  );
}

// re-export shared cells for use elsewhere
export { RagBadge, StatusBadge, ProgressBar, OwnerCell, DateCell, refCode };
