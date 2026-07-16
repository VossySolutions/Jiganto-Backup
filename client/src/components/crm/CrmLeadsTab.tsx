import { useState, useMemo, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/ui/form-dialog-shell";
import { LeadFormDialog } from "./LeadFormDialog";
import { LeadDetailSheet, type CrmLead } from "./LeadDetailSheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Plus, Download, Upload, ArrowUpRight, Search,
  SlidersHorizontal, ArrowUpDown, Layers,
  UserCheck, ChevronDown, Maximize2, Minimize2,
  Columns3, Table2, List, Calendar, Settings2,
  MessageSquare, Paperclip, ListTodo, Sparkles, FolderPlus, X,
} from "lucide-react";
import { ImportModal, type ImportMode } from "@/components/ImportModal";
import { useCrmUsers } from "./CrmUsersProvider";
import { useCrmCustomFields } from "@/hooks/use-crm-custom-fields";
import { CrmColumnVisibilityMenu } from "./CrmColumnVisibilityMenu";
import { CrmLeadLabelEditorDialog } from "./CrmLeadLabelEditorDialog";
import {
  CrmLeadListView,
  CrmLeadBoardView,
  CrmLeadCalendarView,
} from "./CrmLeadAlternateViews";
import { loadColumnVisibility, saveColumnVisibility, type CrmColumnDef } from "@/lib/crm-list-columns";
import { formatCustomFieldDisplayValue } from "@/lib/crm-custom-fields";
import {
  loadLeadStatusOptions,
  saveLeadStatusOptions,
  loadLeadRatingOptions,
  saveLeadRatingOptions,
} from "@/lib/crm-lead-labels";
import {
  loadManualLeadGroups,
  saveManualLeadGroups,
  createManualLeadGroup,
  moveLeadsToGroup,
  ungroupLeads,
  deleteManualGroup,
  compareLeadsByRules,
  LEAD_SORT_FIELDS,
  type ManualLeadGroup,
  type LeadSortRule,
  type LeadSortField,
} from "@/lib/crm-lead-manual-groups";
import MondayTable, {
  type ColumnDef,
  type GroupDef,
  type StatusOption,
} from "@/components/MondayTable";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Infinity-style field customize checklist (standard columns) */
const LEAD_TABLE_COLUMNS: CrmColumnDef[] = [
  { id: "contact", label: "Contact" },
  { id: "email", label: "Email", defaultVisible: false },
  { id: "phone", label: "Phone", defaultVisible: false },
  { id: "title", label: "Title" },
  { id: "files", label: "Files" },
  { id: "status", label: "Status" },
  { id: "score", label: "Score" },
  { id: "rating", label: "Rating" },
  { id: "source", label: "Source" },
  { id: "owner", label: "Owner" },
  { id: "industry", label: "Industry", defaultVisible: false },
  { id: "website", label: "Website", defaultVisible: false },
  { id: "description", label: "Description", defaultVisible: false },
  { id: "subtasks", label: "Subtasks" },
  { id: "followUp", label: "Follow-up date", defaultVisible: false },
  { id: "created", label: "Created" },
];

type LeadFilterField = "status" | "source" | "rating" | "temperature" | "industry" | "title";

const FILTER_FIELDS: { field: LeadFilterField; label: string }[] = [
  { field: "status", label: "Status" },
  { field: "source", label: "Source" },
  { field: "rating", label: "Rating" },
  { field: "temperature", label: "Temperature" },
  { field: "industry", label: "Industry" },
  { field: "title", label: "Title" },
];

interface LeadFilterRule {
  id: string;
  field: LeadFilterField;
  value: string;
}

type LeadAttachmentSummaryRow = { id: number; entityId: number };
type LeadTaskSummaryRow = { id: number; leadId: number | null; status?: string | null; completedAt?: string | null };
type LeadSubtaskRecord = { id: string; title: string; done: boolean };

function getLocalLeadSubtasks(lead: CrmLead): LeadSubtaskRecord[] {
  const raw = lead.customData && typeof lead.customData === "object"
    ? (lead.customData as Record<string, unknown>)["_subtasks"]
    : undefined;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s): s is LeadSubtaskRecord => !!s && typeof s === "object" && typeof (s as LeadSubtaskRecord).id === "string")
    .map((s) => ({ id: s.id, title: String(s.title || ""), done: !!s.done }));
}

function getTemperature(score: number | null): "hot" | "warm" | "cold" {
  if (score === null) return "cold";
  if (score >= 80) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

type LeadGroupBy =
  | "none"
  | "status"
  | "owner"
  | "source"
  | "temperature"
  | "rating"
  | "title"
  | "industry"
  | "manual"
  | "followUp";

type TableDensity = "compact" | "comfortable" | "expanded";
type LeadViewMode = "table" | "list" | "board" | "calendar";

const VIEW_OPTIONS: { id: LeadViewMode; label: string; icon: typeof Table2 }[] = [
  { id: "table", label: "Table", icon: Table2 },
  { id: "list", label: "List", icon: List },
  { id: "board", label: "Board", icon: Columns3 },
  { id: "calendar", label: "Calendar", icon: Calendar },
];

interface CrmLeadsTabProps {
  leads: CrmLead[];
  searchTerm: string;
  onNavigateToTab?: (tab: string) => void;
  onOpenCustomFieldsSettings?: () => void;
}

function getLeadFollowUpDate(lead: CrmLead): string | null {
  const raw = lead.customData && typeof lead.customData === "object"
    ? (lead.customData as Record<string, unknown>)["_followUpDate"]
    : undefined;
  return typeof raw === "string" && raw ? raw : null;
}

function formatFollowUpGroupKey(value: string | null): string {
  if (!value) return "No follow-up";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "No follow-up";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const VIBRANT_LOGO_COLORS = [
  "#3b82f6", "#22c55e", "#f97316", "#8b5cf6",
  "#ec4899", "#06b6d4", "#eab308", "#ef4444",
  "#14b8a6", "#6366f1",
];

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return VIBRANT_LOGO_COLORS[Math.abs(hash) % VIBRANT_LOGO_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join("")
    .toUpperCase();
}

function FlameIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none">
      <path d="M8 1C8 1 3 6 3 9.5C3 12.5 5.2 14.5 8 14.5C10.8 14.5 13 12.5 13 9.5C13 6 8 1 8 1Z" fill="#ef4444"/>
      <path d="M8 5C8 5 5.5 8 5.5 10C5.5 11.7 6.6 13 8 13C9.4 13 10.5 11.7 10.5 10C10.5 8 8 5 8 5Z" fill="#f97316"/>
      <path d="M8 8.5C8 8.5 6.8 10 6.8 11C6.8 11.9 7.3 12.5 8 12.5C8.7 12.5 9.2 11.9 9.2 11C9.2 10 8 8.5 8 8.5Z" fill="#fbbf24"/>
    </svg>
  );
}

function WarmIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none">
      <path d="M8 1C8 1 4.5 6.5 4.5 9.5C4.5 12 6 14 8 14C10 14 11.5 12 11.5 9.5C11.5 6.5 8 1 8 1Z" fill="#f97316"/>
      <path d="M8 5.5C8 5.5 6 8.5 6 10.2C6 11.5 6.9 12.5 8 12.5C9.1 12.5 10 11.5 10 10.2C10 8.5 8 5.5 8 5.5Z" fill="#fbbf24"/>
    </svg>
  );
}

function ColdIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none">
      <path d="M8 1L8 15M3 4L13 12M13 4L3 12" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="8" cy="8" r="2" fill="#60a5fa"/>
      <circle cx="8" cy="2" r="1" fill="#93c5fd"/>
      <circle cx="8" cy="14" r="1" fill="#93c5fd"/>
      <circle cx="3.5" cy="4.5" r="1" fill="#93c5fd"/>
      <circle cx="12.5" cy="11.5" r="1" fill="#93c5fd"/>
      <circle cx="12.5" cy="4.5" r="1" fill="#93c5fd"/>
      <circle cx="3.5" cy="11.5" r="1" fill="#93c5fd"/>
    </svg>
  );
}

function TemperatureDisplay({ score, temperature }: { score: number | null; temperature: "hot" | "warm" | "cold" }) {
  const config = {
    hot: { label: "Hot", textColor: "text-red-600", Icon: FlameIcon },
    warm: { label: "Warm", textColor: "text-amber-600", Icon: WarmIcon },
    cold: { label: "Cold", textColor: "text-blue-600", Icon: ColdIcon },
  };
  const { label, textColor, Icon } = config[temperature];
  return (
    <div className="flex items-center gap-2">
      <span className={cn("font-semibold tabular-nums", textColor)}>{score ?? "—"}</span>
      <div className="flex items-center gap-1">
        <Icon className="h-4 w-4" />
        <span className={cn("text-xs font-medium", textColor)}>{label}</span>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    new: "#22c55e",
    contacted: "#f59e0b",
    qualified: "#22c55e",
    unqualified: "#6b7280",
    converted: "#8b5cf6",
    lost: "#ef4444",
  };
  const color = colors[status] || "#6b7280";
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-sm">{label}</span>
    </div>
  );
}

const GROUP_COLOR_HEX: Record<string, string> = {
  Hot: "#e2445c",
  Warm: "#fdab3d",
  Cold: "#579bfc",
  New: "#00c875",
  Contacted: "#fdab3d",
  Qualified: "#579bfc",
  Unqualified: "#c4c4c4",
  Converted: "#a25ddc",
  Lost: "#e2445c",
};

export function CrmLeadsTab({ leads, searchTerm, onNavigateToTab, onOpenCustomFieldsSettings }: CrmLeadsTabProps) {
  const { users, resolveOwner } = useCrmUsers();
  const { fields: customFields } = useCrmCustomFields("lead");
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<CrmLead | null>(null);
  const [viewingLead, setViewingLead] = useState<CrmLead | null>(null);
  const [extrasTab, setExtrasTab] = useState<"comments" | "files" | "subtasks">("comments");
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterRules, setFilterRules] = useState<LeadFilterRule[]>([]);
  const [localSearch, setLocalSearch] = useState("");
  const [sortRules, setSortRules] = useState<LeadSortRule[]>([{ field: "date", dir: "desc" }]);
  const [groupBy, setGroupBy] = useState<LeadGroupBy>("none");
  const [manualGroups, setManualGroups] = useState<ManualLeadGroup[]>(() => loadManualLeadGroups());
  const [selectedLeadIds, setSelectedLeadIds] = useState<(number | string)[]>([]);
  const [density, setDensity] = useState<TableDensity>("comfortable");
  const [viewMode, setViewMode] = useState<LeadViewMode>(() => {
    if (typeof window === "undefined") return "table";
    const stored = localStorage.getItem("crm-leads-view-mode") as LeadViewMode | null;
    return stored && VIEW_OPTIONS.some((v) => v.id === stored) ? stored : "table";
  });
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>(() => loadLeadStatusOptions());
  const [ratingOptions, setRatingOptions] = useState<StatusOption[]>(() => loadLeadRatingOptions());
  const [labelEditor, setLabelEditor] = useState<"status" | "rating" | null>(null);
  const [convertOptions, setConvertOptions] = useState({
    createAccount: true,
    createContact: true,
    createOpportunity: true,
    accountName: "",
    opportunityName: "",
    opportunityAmount: ""
  });
  const [importOpen, setImportOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() =>
    loadColumnVisibility("crm-leads", LEAD_TABLE_COLUMNS),
  );
  const { toast } = useToast();

  const updateLeadMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Partial<CrmLead> }) =>
      apiRequest("PUT", `/api/crm/leads/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
    },
    onError: () => toast({ title: "Failed to update lead", variant: "destructive" }),
  });

  const isColVisible = (id: string) => columnVisibility[id] !== false;
  const setColVisible = (id: string, visible: boolean) => {
    setColumnVisibility((prev) => {
      const next = { ...prev, [id]: visible };
      saveColumnVisibility("crm-leads", next);
      return next;
    });
  };

  const importMutation = useMutation({
    mutationFn: ({ rows, mode }: { rows: Record<string, string>[]; mode: ImportMode }) =>
      apiRequest("POST", "/api/crm/leads/bulk-import", { rows, mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      toast({ title: "Leads imported successfully" });
    },
    onError: () => toast({ title: "Import failed", variant: "destructive" }),
  });

  const convertMutation = useMutation({
    mutationFn: async ({ id, options }: { id: number; options: typeof convertOptions }) => {
      const res = await apiRequest("POST", `/api/crm/leads/${id}/convert`, options);
      return res.json() as Promise<{ opportunityId?: number | null; accountId?: number | null }>;
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/dashboard-stats"] });
      setIsConvertOpen(false);
      setSelectedLead(null);
      setConvertOptions({ createAccount: true, createContact: true, createOpportunity: true, accountName: "", opportunityName: "", opportunityAmount: "" });

      const createdOpp = variables.options.createOpportunity && result.opportunityId;
      if (createdOpp) {
        onNavigateToTab?.("opportunities");
        toast({
          title: "Lead converted",
          description: "The new opportunity is ready in the Opportunities tab.",
        });
      } else if (variables.options.createAccount && result.accountId) {
        onNavigateToTab?.("customers");
        toast({
          title: "Lead converted",
          description: "The new account is ready in the Customers tab.",
        });
      } else {
        toast({ title: "Lead converted successfully" });
      }
    },
    onError: () => toast({ title: "Failed to convert lead", variant: "destructive" }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: (number | string)[]) => apiRequest("POST", "/api/crm/leads/bulk-delete", { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      toast({ title: "Leads deleted successfully" });
    },
    onError: () => toast({ title: "Failed to delete leads", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/crm/leads/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      toast({ title: "Lead deleted" });
    },
    onError: () => toast({ title: "Failed to delete lead", variant: "destructive" }),
  });

  const handleEdit = (lead: CrmLead) => {
    setEditingLead(lead);
    setFormOpen(true);
  };

  const openCreateForm = () => {
    setEditingLead(null);
    setFormOpen(true);
  };

  const handleConvert = (lead: CrmLead) => {
    setSelectedLead(lead);
    setConvertOptions({
      createAccount: true,
      createContact: true,
      createOpportunity: true,
      accountName: lead.company || `${lead.firstName} ${lead.lastName}`,
      opportunityName: `${lead.company || lead.firstName} - Opportunity`,
      opportunityAmount: ""
    });
    setIsConvertOpen(true);
  };

  const effectiveSearch = searchTerm || localSearch;

  const leadSources = useMemo(
    () => Array.from(new Set(leads.map(l => l.source).filter((s): s is string => !!s))),
    [leads]
  );

  const sourceSelectOptions: StatusOption[] = useMemo(
    () => leadSources.map((s) => ({ value: s, label: s, color: "" })),
    [leadSources],
  );

  const ownerSelectOptions: StatusOption[] = useMemo(
    () => [
      { value: "", label: "Unassigned", color: "" },
      ...users.map((u) => ({ value: u.id, label: resolveOwner(u.id).name, color: "" })),
    ],
    [users, resolveOwner],
  );

  const setViewModePersist = (mode: LeadViewMode) => {
    setViewMode(mode);
    localStorage.setItem("crm-leads-view-mode", mode);
  };

  const allAddableColumns = useMemo((): CrmColumnDef[] => {
    const customCols: CrmColumnDef[] = customFields.map((f) => ({
      id: `custom_${f.fieldName}`,
      label: f.fieldLabel,
      defaultVisible: true,
    }));
    return [...LEAD_TABLE_COLUMNS, ...customCols];
  }, [customFields]);

  const hiddenAddableCount = allAddableColumns.filter((c) => !isColVisible(c.id)).length;
  const activeFilterCount = filterRules.filter((r) => r.value).length;

  const getLeadFilterFieldValue = (lead: CrmLead, field: LeadFilterField): string => {
    switch (field) {
      case "status": return lead.status || "";
      case "source": return lead.source || "";
      case "rating": return lead.rating || "";
      case "temperature": return getTemperature(lead.score);
      case "industry": return lead.industry || "";
      case "title": return lead.title || "";
      default: return "";
    }
  };

  const getFilterFieldOptions = (field: LeadFilterField): { value: string; label: string }[] => {
    switch (field) {
      case "status": return statusOptions.map((o) => ({ value: o.value, label: o.label }));
      case "rating": return ratingOptions.map((o) => ({ value: o.value, label: o.label }));
      case "source": return leadSources.map((s) => ({ value: s, label: s }));
      case "temperature": return [
        { value: "hot", label: `Hot (${hotCount})` },
        { value: "warm", label: `Warm (${warmCount})` },
        { value: "cold", label: `Cold (${coldCount})` },
      ];
      case "industry": return Array.from(new Set(leads.map((l) => l.industry).filter((v): v is string => !!v)))
        .map((v) => ({ value: v, label: v }));
      case "title": return Array.from(new Set(leads.map((l) => l.title).filter((v): v is string => !!v)))
        .map((v) => ({ value: v, label: v }));
      default: return [];
    }
  };

  const addFilterRule = () => {
    setFilterRules((prev) => [...prev, { id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, field: "status", value: "" }]);
  };

  const updateFilterRule = (id: string, patch: Partial<LeadFilterRule>) => {
    setFilterRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch, ...(patch.field ? { value: "" } : {}) } : r)));
  };

  const removeFilterRule = (id: string) => {
    setFilterRules((prev) => prev.filter((r) => r.id !== id));
  };

  const filteredLeads = useMemo(() => {
    let result = leads.filter(l => {
      const matchesSearch =
        `${l.firstName} ${l.lastName}`.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
        l.company?.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
        l.email?.toLowerCase().includes(effectiveSearch.toLowerCase());
      if (!matchesSearch) return false;
      for (const rule of filterRules) {
        if (!rule.value) continue;
        if (getLeadFilterFieldValue(l, rule.field) !== rule.value) return false;
      }
      if (ownerFilter === "__unassigned__" && l.ownerUserId) return false;
      if (ownerFilter !== "all" && ownerFilter !== "__unassigned__" && l.ownerUserId !== ownerFilter) return false;
      return true;
    });

    return [...result].sort((a, b) => compareLeadsByRules(a, b, sortRules));
  }, [leads, effectiveSearch, filterRules, ownerFilter, sortRules]);

  const hotCount = leads.filter(l => getTemperature(l.score) === "hot").length;
  const warmCount = leads.filter(l => getTemperature(l.score) === "warm").length;
  const coldCount = leads.filter(l => getTemperature(l.score) === "cold").length;

  const { data: allLeadAttachments = [] } = useQuery<LeadAttachmentSummaryRow[]>({
    queryKey: ["/api/crm/attachments?entityType=lead"],
  });
  const { data: allLeadTasks = [] } = useQuery<LeadTaskSummaryRow[]>({
    queryKey: ["/api/crm/tasks?entityType=lead"],
  });

  const attachmentCountByLead = useMemo(() => {
    const map = new Map<number, number>();
    for (const a of allLeadAttachments) {
      map.set(a.entityId, (map.get(a.entityId) || 0) + 1);
    }
    return map;
  }, [allLeadAttachments]);

  const linkedSubtaskProgressByLead = useMemo(() => {
    const map = new Map<number, { done: number; total: number }>();
    for (const t of allLeadTasks) {
      if (t.leadId == null) continue;
      const done = t.status === "completed" || !!t.completedAt;
      const prev = map.get(t.leadId) || { done: 0, total: 0 };
      prev.total += 1;
      if (done) prev.done += 1;
      map.set(t.leadId, prev);
    }
    return map;
  }, [allLeadTasks]);

  const getSubtaskProgress = useCallback((lead: CrmLead) => {
    const linked = linkedSubtaskProgressByLead.get(lead.id) || { done: 0, total: 0 };
    const local = getLocalLeadSubtasks(lead);
    const localDone = local.filter((s) => s.done).length;
    return { done: linked.done + localDone, total: linked.total + local.length };
  }, [linkedSubtaskProgressByLead]);

  const tableColumns: ColumnDef<CrmLead>[] = useMemo(() => {
    const cols: ColumnDef<CrmLead>[] = [
      {
        id: "company",
        header: "Company",
        type: "text",
        accessor: (row) => row.company || `${row.firstName} ${row.lastName}`,
        width: "220px",
        sticky: true,
        editable: true,
      },
      {
        id: "contact",
        header: "Contact",
        type: "text",
        accessor: (row) => `${row.firstName} ${row.lastName}`.trim(),
        width: "160px",
        editable: true,
        hidden: !isColVisible("contact"),
      },
      {
        id: "email",
        header: "Email",
        type: "text",
        accessor: (row) => row.email || "",
        width: "180px",
        editable: true,
        hidden: !isColVisible("email"),
      },
      {
        id: "phone",
        header: "Phone",
        type: "text",
        accessor: (row) => row.phone || "",
        width: "130px",
        editable: true,
        hidden: !isColVisible("phone"),
      },
      {
        id: "title",
        header: "Title",
        type: "text",
        accessor: (row) => row.title || "",
        width: "140px",
        editable: true,
        hidden: !isColVisible("title"),
      },
      {
        id: "files",
        header: "Files",
        type: "files",
        accessor: (row) => attachmentCountByLead.get(row.id) || 0,
        width: "80px",
        editable: false,
        hidden: !isColVisible("files"),
        render: (row) => {
          const count = attachmentCountByLead.get(row.id) || 0;
          return (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openLeadExtras(row, "files"); }}
              className={cn(
                "w-full h-full min-h-[28px] flex items-center justify-center gap-1 rounded-[4px] text-[12px] font-medium transition-colors",
                count > 0 ? "text-[#323338] hover:bg-[#dcdfec]/50" : "text-[#c4c4c4] hover:bg-[#dcdfec]/50",
              )}
              data-testid={`cell-files-lead-${row.id}`}
            >
              <Paperclip className="h-3.5 w-3.5" />
              {count > 0 && <span>{count}</span>}
            </button>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        type: "status",
        accessor: "status",
        width: "130px",
        editable: true,
        editableCondition: (row) => row.status !== "converted",
        options: statusOptions,
        onEditLabels: () => setLabelEditor("status"),
        hidden: !isColVisible("status"),
      },
      {
        id: "score",
        header: "Score",
        type: "number",
        accessor: (row) => row.score,
        width: "90px",
        editable: true,
        hidden: !isColVisible("score"),
      },
      {
        id: "rating",
        header: "Rating",
        type: "status",
        accessor: (row) => row.rating || "",
        width: "110px",
        editable: true,
        options: ratingOptions,
        onEditLabels: () => setLabelEditor("rating"),
        hidden: !isColVisible("rating"),
      },
      {
        id: "source",
        header: "Source",
        type: "select",
        accessor: (row) => row.source || "",
        width: "130px",
        editable: true,
        options: sourceSelectOptions,
        hidden: !isColVisible("source"),
      },
      {
        id: "owner",
        header: "Owner",
        type: "select",
        accessor: (row) => row.ownerUserId || "",
        width: "150px",
        editable: true,
        options: ownerSelectOptions,
        hidden: !isColVisible("owner"),
      },
      {
        id: "industry",
        header: "Industry",
        type: "text",
        accessor: (row) => row.industry || "",
        width: "140px",
        editable: true,
        hidden: !isColVisible("industry"),
      },
      {
        id: "website",
        header: "Website",
        type: "link",
        accessor: (row) => row.website || "",
        width: "160px",
        editable: false,
        hidden: !isColVisible("website"),
      },
      {
        id: "description",
        header: "Description",
        type: "text",
        accessor: (row) => row.description || "",
        width: "200px",
        editable: true,
        hidden: !isColVisible("description"),
      },
      {
        id: "subtasks",
        header: "Subtasks",
        type: "checklist",
        accessor: (row) => getSubtaskProgress(row).total,
        width: "100px",
        editable: false,
        hidden: !isColVisible("subtasks"),
        render: (row) => {
          const { done, total } = getSubtaskProgress(row);
          return (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openLeadExtras(row, "subtasks"); }}
              className={cn(
                "w-full h-full min-h-[28px] flex items-center justify-center gap-1 rounded-[4px] text-[12px] font-medium transition-colors",
                total > 0 ? "text-[#323338] hover:bg-[#dcdfec]/50" : "text-[#c4c4c4] hover:bg-[#dcdfec]/50",
              )}
              data-testid={`cell-subtasks-lead-${row.id}`}
            >
              <ListTodo className="h-3.5 w-3.5" />
              {total > 0 && <span>{done}/{total}</span>}
            </button>
          );
        },
      },
      {
        id: "followUp",
        header: "Follow-up",
        type: "date",
        accessor: (row) => getLeadFollowUpDate(row),
        width: "130px",
        editable: true,
        hidden: !isColVisible("followUp"),
      },
      {
        id: "created",
        header: "Created",
        type: "date",
        accessor: (row) => row.createdAt,
        width: "120px",
        editable: false,
        hidden: !isColVisible("created"),
      },
    ];

    for (const field of customFields) {
      const colId = `custom_${field.fieldName}`;
      const editableType = field.fieldType === "text" || field.fieldType === "number" || field.fieldType === "textarea";
      cols.push({
        id: colId,
        header: field.fieldLabel,
        type: field.fieldType === "number" ? "number" : "text",
        accessor: (row) => {
          const raw = row.customData?.[field.fieldName];
          if (editableType) {
            if (raw == null || raw === "") return "";
            return String(raw);
          }
          return formatCustomFieldDisplayValue(field, raw, resolveOwner);
        },
        width: "140px",
        editable: editableType,
        hidden: !isColVisible(colId),
      });
    }

    return cols;
  }, [columnVisibility, customFields, sourceSelectOptions, ownerSelectOptions, resolveOwner, statusOptions, ratingOptions, attachmentCountByLead, getSubtaskProgress]);

  const tableGroups: GroupDef<CrmLead>[] | undefined = useMemo(() => {
    if (groupBy === "none") return undefined;

    if (groupBy === "manual") {
      const assigned = new Set(manualGroups.flatMap((g) => g.leadIds));
      const groups: GroupDef<CrmLead>[] = manualGroups.map((g) => ({
        id: g.id,
        title: g.title,
        color: g.color,
        items: filteredLeads.filter((l) => g.leadIds.includes(l.id)),
        count: filteredLeads.filter((l) => g.leadIds.includes(l.id)).length,
      }));
      const ungrouped = filteredLeads.filter((l) => !assigned.has(l.id));
      if (ungrouped.length > 0) {
        groups.push({
          id: "ungrouped",
          title: "Ungrouped",
          color: "#c4c4c4",
          items: ungrouped,
          count: ungrouped.length,
        });
      }
      return groups;
    }

    const groups: Record<string, CrmLead[]> = {};
    for (const lead of filteredLeads) {
      let key: string;
      if (groupBy === "owner") {
        key = resolveOwner(lead.ownerUserId).name;
      } else if (groupBy === "status") {
        key = lead.status.charAt(0).toUpperCase() + lead.status.slice(1);
      } else if (groupBy === "source") {
        key = lead.source
          ? lead.source.charAt(0).toUpperCase() + lead.source.slice(1).replace(/_/g, " ")
          : "Unknown";
      } else if (groupBy === "rating") {
        key = lead.rating
          ? lead.rating.charAt(0).toUpperCase() + lead.rating.slice(1)
          : "No Rating";
      } else if (groupBy === "title") {
        key = lead.title?.trim() || "No Title";
      } else if (groupBy === "industry") {
        key = lead.industry?.trim() || "No Industry";
      } else if (groupBy === "followUp") {
        key = formatFollowUpGroupKey(getLeadFollowUpDate(lead));
      } else {
        const temp = getTemperature(lead.score);
        key = temp.charAt(0).toUpperCase() + temp.slice(1);
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(lead);
    }

    return Object.entries(groups).map(([title, items]) => ({
      id: title,
      title,
      color: GROUP_COLOR_HEX[title] || "#579bfc",
      items,
      count: items.length,
    }));
  }, [filteredLeads, groupBy, resolveOwner, manualGroups]);

  const persistManualGroups = (next: ManualLeadGroup[]) => {
    setManualGroups(next);
    saveManualLeadGroups(next);
  };

  const handleCreateManualGroup = () => {
    const title = window.prompt("New group name");
    if (title == null) return;
    const leadIds = selectedLeadIds.map((id) => (typeof id === "string" ? Number(id) : id)).filter((n) => !Number.isNaN(n));
    // Remove from other groups first, then create with those IDs
    let next = ungroupLeads(manualGroups, leadIds);
    const group = createManualLeadGroup(title, leadIds, next.length);
    next = [...next, group];
    persistManualGroups(next);
    setGroupBy("manual");
    toast({
      title: `Group “${group.title}” created`,
      description: leadIds.length
        ? `${leadIds.length} selected lead${leadIds.length === 1 ? "" : "s"} moved into the group.`
        : "Select leads and use “Move to group” to add them.",
    });
  };

  const handleMoveSelectedToGroup = (groupId: string, ids: (number | string)[]) => {
    const leadIds = ids.map((id) => (typeof id === "string" ? Number(id) : id)).filter((n) => !Number.isNaN(n));
    if (!leadIds.length) return;
    if (groupId === "ungrouped") {
      persistManualGroups(ungroupLeads(manualGroups, leadIds));
      toast({ title: `${leadIds.length} lead(s) ungrouped` });
      return;
    }
    persistManualGroups(moveLeadsToGroup(manualGroups, groupId, leadIds));
    setGroupBy("manual");
    toast({ title: `${leadIds.length} lead(s) moved to group` });
  };

  const openLeadExtras = (lead: CrmLead, tab: "comments" | "files" | "subtasks") => {
    setExtrasTab(tab);
    setViewingLead(lead);
  };

  const handleCellEdit = useCallback((rowId: number | string, columnId: string, value: unknown) => {
    const id = typeof rowId === "string" ? Number(rowId) : rowId;
    const updates: Partial<CrmLead> = {};

    switch (columnId) {
      case "company":
        updates.company = String(value || "") || null;
        break;
      case "contact": {
        const parts = String(value || "").trim().split(/\s+/);
        updates.firstName = parts[0] || "";
        updates.lastName = parts.slice(1).join(" ") || "";
        break;
      }
      case "email":
        updates.email = String(value || "") || null;
        break;
      case "phone":
        updates.phone = String(value || "") || null;
        break;
      case "title":
        updates.title = String(value || "") || null;
        break;
      case "status":
        updates.status = String(value);
        break;
      case "score":
        updates.score = value === "" || value == null ? 0 : Number(value);
        break;
      case "rating":
        updates.rating = String(value || "") || null;
        break;
      case "source":
        updates.source = String(value || "") || null;
        break;
      case "owner":
        updates.ownerUserId = String(value || "") || null;
        break;
      case "industry":
        updates.industry = String(value || "") || null;
        break;
      case "description":
        updates.description = String(value || "") || null;
        break;
      case "followUp": {
        const lead = leads.find((l) => l.id === id);
        const prev = (lead?.customData && typeof lead.customData === "object") ? { ...lead.customData } : {};
        const dateVal = value ? String(value) : null;
        if (dateVal) prev._followUpDate = dateVal;
        else delete prev._followUpDate;
        updates.customData = prev;
        break;
      }
      default: {
        if (columnId.startsWith("custom_")) {
          const fieldName = columnId.replace(/^custom_/, "");
          const field = customFields.find((f) => f.fieldName === fieldName);
          const lead = leads.find((l) => l.id === id);
          const prev = (lead?.customData && typeof lead.customData === "object") ? { ...lead.customData } : {};
          if (field?.fieldType === "number") {
            const n = value === "" || value == null ? null : Number(value);
            prev[fieldName] = Number.isFinite(n as number) ? n : null;
          } else {
            prev[fieldName] = value === "" || value == null ? null : String(value);
          }
          updates.customData = prev;
          break;
        }
        return;
      }
    }

    updateLeadMutation.mutate({ id, updates });
  }, [updateLeadMutation, leads, customFields]);

  const handleBulkStatusChange = (ids: (number | string)[], status: string) => {
    Promise.all(ids.map(id => apiRequest("PUT", `/api/crm/leads/${id}`, { status }))).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      toast({ title: `${ids.length} leads updated to ${status}` });
    });
  };

  const exportToCSV = () => {
    const headers = ["Company", "Contact", "Status", "Score", "Temperature", "Source", "Created"];
    const rows = filteredLeads.map(l => [
      l.company || "", `${l.firstName} ${l.lastName}`, l.status || "", String(l.score || ""),
      getTemperature(l.score), l.source || "", new Date(l.createdAt).toLocaleDateString()
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${(c || "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Leads exported to CSV" });
  };

  const handleSortToggle = (field: LeadSortField) => {
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
  };

  const addSortRule = (field: LeadSortField) => {
    setSortRules((prev) => {
      if (prev.some((r) => r.field === field)) return prev;
      return [...prev, { field, dir: "desc" }];
    });
  };

  const removeSortRule = (field: LeadSortField) => {
    setSortRules((prev) => {
      const next = prev.filter((r) => r.field !== field);
      return next.length ? next : [{ field: "date", dir: "desc" }];
    });
  };

  const cycleDensity = () => {
    setDensity((prev) =>
      prev === "comfortable" ? "expanded" : prev === "expanded" ? "compact" : "comfortable",
    );
  };

  const groupByLabel =
    groupBy === "none" ? "Group by" : `Group by ${groupBy}`;

  /** monday.com board toolbar control */
  const toolBtn = (active = false) =>
    cn(
      "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[13px] font-medium transition-colors",
      "text-[#323338] hover:bg-[#dcdfec]/60",
      active && "bg-[#cce5ff] text-[#0073ea] hover:bg-[#cce5ff]",
    );

  return (
    <div className="space-y-3">
      {/* monday.com-style board toolbar */}
      <div className="flex flex-wrap items-center gap-1.5" data-testid="filter-temperature-bar">
          <Button
          className="h-8 bg-[#0073ea] hover:bg-[#0060b9] text-white gap-1.5 rounded-md text-[13px] font-medium shadow-none px-3"
          data-testid="button-add-lead"
          onClick={openCreateForm}
        >
          <Plus className="h-4 w-4" />
          New Lead
          </Button>

        <div className="relative ml-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#676879]" />
          <Input
            placeholder="Search / Filter Board"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-8 h-8 w-48 rounded-md border-[#c5c7d0] text-[13px] bg-white focus-visible:ring-[#0073ea]"
            data-testid="input-search-leads"
          />
        </div>

        <div className="h-5 w-px bg-[#d0d4e4] mx-1" />

        <div className="flex items-center gap-1" data-testid="owner-avatar-filter">
        <button
            type="button"
            onClick={() => setOwnerFilter("all")}
            className={toolBtn(ownerFilter === "all")}
            title="All people"
          >
            Person
        </button>
        <button
            type="button"
            onClick={() => setOwnerFilter(ownerFilter === "__unassigned__" ? "all" : "__unassigned__")}
          className={cn(
              "h-7 w-7 rounded-full border text-[10px] font-semibold transition-colors",
              ownerFilter === "__unassigned__"
                ? "ring-2 ring-[#0073ea] border-[#0073ea]"
                : "border-[#c5c7d0] bg-[#f5f6f8] text-[#676879]",
            )}
            title="Unassigned"
          >
            —
        </button>
          {users.slice(0, 12).map((user) => {
            const owner = resolveOwner(user.id);
            const active = ownerFilter === user.id;
            return (
        <button
                key={user.id}
                type="button"
                title={owner.name}
                onClick={() => setOwnerFilter(active ? "all" : user.id)}
          className={cn(
                  "h-7 w-7 rounded-full text-white text-[10px] font-semibold transition-transform",
                  active && "ring-2 ring-offset-1 ring-[#0073ea] scale-105",
                )}
                style={{ backgroundColor: owner.color }}
                data-testid={`filter-owner-avatar-${user.id}`}
              >
                {owner.initials}
        </button>
            );
          })}
        </div>

        <div className="h-5 w-px bg-[#d0d4e4] mx-1" />

        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <button
              className={toolBtn(activeFilterCount > 0)}
              data-testid="button-filter"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filter
              {activeFilterCount > 0 && (
                <span className="h-4 min-w-4 px-1 rounded-full bg-[#0073ea] text-white text-[10px] flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[420px] space-y-2 p-3">
            {filterRules.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1">No filters applied.</p>
            ) : (
              <div className="space-y-2">
                {filterRules.map((rule, idx) => (
                  <div key={rule.id} className="flex items-center gap-1.5" data-testid={`filter-rule-${idx}`}>
                    <span className="text-xs text-[#676879] w-9 shrink-0">{idx === 0 ? "Where" : "and"}</span>
                    <Select value={rule.field} onValueChange={(v) => updateFilterRule(rule.id, { field: v as LeadFilterField })}>
                      <SelectTrigger className="h-8 w-28 text-xs shrink-0" data-testid={`filter-rule-field-${idx}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FILTER_FIELDS.map((f) => (
                          <SelectItem key={f.field} value={f.field}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-[#676879] w-5 shrink-0 text-center">is</span>
                    <Select value={rule.value} onValueChange={(v) => updateFilterRule(rule.id, { value: v })}>
                      <SelectTrigger className="h-8 flex-1 text-xs" data-testid={`filter-rule-value-${idx}`}>
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        {getFilterFieldOptions(rule.field).map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => removeFilterRule(rule.id)}
                      data-testid={`button-remove-filter-${idx}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-[#0073ea] hover:text-[#0073ea] hover:bg-[#cce5ff]/40 gap-1 h-7 px-1.5"
              onClick={addFilterRule}
              data-testid="button-new-filter"
            >
              <Plus className="h-3.5 w-3.5" />
              New Filter
            </Button>
            {filterRules.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setFilterRules([])}
                data-testid="button-clear-filters"
              >
                Clear filters
              </Button>
            )}
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={toolBtn(sortRules.length > 1 || sortRules[0]?.field !== "date")}
              data-testid="button-sort"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Sort{sortRules.length > 1 ? ` (${sortRules.length})` : ""}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Active sorts</div>
            {sortRules.map((rule, idx) => {
              const meta = LEAD_SORT_FIELDS.find((f) => f.field === rule.field);
              return (
                <div key={rule.field} className="flex items-center gap-1 px-2 py-1">
                  <span className="text-xs text-muted-foreground w-4">{idx + 1}.</span>
                  <button
                    type="button"
                    className="flex-1 text-left text-sm hover:underline"
                    onClick={() => handleSortToggle(rule.field)}
                  >
                    {meta?.label || rule.field} ({rule.dir})
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeSortRule(rule.field)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Add sort</div>
            {LEAD_SORT_FIELDS.filter((f) => !sortRules.some((r) => r.field === f.field)).map((f) => (
              <DropdownMenuItem key={f.field} onClick={() => addSortRule(f.field)}>
                {f.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {viewMode === "table" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
                className={toolBtn(groupBy !== "none")}
                title={groupByLabel}
                aria-label={groupBy === "none" ? "Group leads" : groupByLabel}
              data-testid="button-group"
            >
                <Layers className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{groupByLabel}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setGroupBy("none")} data-testid="group-none">None</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy("status")} data-testid="group-status">Status</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy("owner")} data-testid="group-owner">Owner</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy("source")} data-testid="group-source">Source</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy("temperature")} data-testid="group-temperature">Temperature</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy("rating")} data-testid="group-rating">Rating</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy("title")} data-testid="group-title">Title</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy("industry")} data-testid="group-industry">Industry</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy("followUp")} data-testid="group-followup">Follow-up date</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupBy("manual")} data-testid="group-manual">Manual groups</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCreateManualGroup} data-testid="group-create-manual">
                <FolderPlus className="h-3.5 w-3.5 mr-2" />
                Create new group{selectedLeadIds.length > 0 ? ` (${selectedLeadIds.length} selected)` : ""}…
            </DropdownMenuItem>
              {manualGroups.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Delete group</div>
                  {manualGroups.map((g) => (
                    <DropdownMenuItem
                      key={`del-${g.id}`}
                      className="text-destructive"
                      onClick={() => {
                        persistManualGroups(deleteManualGroup(manualGroups, g.id));
                        toast({ title: `Deleted group “${g.title}”` });
                      }}
                    >
                      Delete “{g.title}”
            </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <CrmColumnVisibilityMenu
          columns={allAddableColumns}
          visibility={columnVisibility}
          onChange={setColVisible}
          testId="button-lead-fields"
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={toolBtn(hiddenAddableCount > 0)}
              data-testid="button-add-column"
            >
              <Plus className="h-3.5 w-3.5" />
              Columns
              {hiddenAddableCount > 0 && (
                <span className="h-4 min-w-4 px-1 rounded-full bg-[#0073ea] text-white text-[10px] flex items-center justify-center">
                  {hiddenAddableCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 max-h-80 overflow-y-auto">
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Standard columns</div>
            {LEAD_TABLE_COLUMNS.map((col) => (
              <DropdownMenuCheckboxItem
                key={col.id}
                checked={isColVisible(col.id)}
                onCheckedChange={(checked) => setColVisible(col.id, checked === true)}
                onSelect={(e) => e.preventDefault()}
                data-testid={`add-column-${col.id}`}
              >
                {col.label}
              </DropdownMenuCheckboxItem>
            ))}
            {customFields.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Custom fields</div>
                {customFields.map((f) => {
                  const id = `custom_${f.fieldName}`;
                  return (
                    <DropdownMenuCheckboxItem
                      key={id}
                      checked={isColVisible(id)}
                      onCheckedChange={(checked) => setColVisible(id, checked === true)}
                      onSelect={(e) => e.preventDefault()}
                      data-testid={`add-column-${id}`}
                    >
                      {f.fieldLabel}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onOpenCustomFieldsSettings?.()}
              data-testid="button-create-custom-field"
            >
              <Settings2 className="h-3.5 w-3.5 mr-2" />
              Create custom field…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLabelEditor("status")} data-testid="button-edit-status-labels-menu">
              Edit status labels…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLabelEditor("rating")} data-testid="button-edit-rating-labels-menu">
              Edit rating labels…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={toolBtn()} data-testid="view-switcher-leads">
              {(() => {
                const current = VIEW_OPTIONS.find((v) => v.id === viewMode) || VIEW_OPTIONS[0];
                const Icon = current.icon;
                return (
                  <>
                    <Icon className="h-3.5 w-3.5" />
                    {current.label}
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </>
                );
              })()}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            {VIEW_OPTIONS.map((view) => (
              <DropdownMenuItem
                key={view.id}
                onClick={() => setViewModePersist(view.id)}
                className="gap-2"
                data-testid={`view-leads-${view.id}`}
              >
                <view.icon className="h-4 w-4" />
                {view.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {viewMode === "table" && (
          <button
            type="button"
            onClick={cycleDensity}
            className={cn(toolBtn(), "px-2")}
            title={`Density: ${density}`}
            aria-label={`Table density ${density}`}
            data-testid="button-density"
          >
            {density === "compact" ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        )}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(toolBtn(), "opacity-50 cursor-not-allowed px-2")}
                data-testid="button-ai-leads"
                aria-label="AI assistant coming soon"
              >
                <Sparkles className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>AI assistant — coming later</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex-1" />

        <button type="button" onClick={exportToCSV} className={toolBtn()} data-testid="button-export-leads">
          <Download className="h-3.5 w-3.5" />
          Export
        </button>
        <button type="button" className={toolBtn()} onClick={() => setImportOpen(true)} data-testid="button-import-leads">
          <Upload className="h-3.5 w-3.5" />
          Import
        </button>
        <ImportModal
          isOpen={importOpen}
          onClose={() => setImportOpen(false)}
          entityName="Leads"
          templateHeaders={["firstName","lastName","email","phone","company","title","source","status","rating","industry","website","description"]}
          exampleRow={{ firstName:"Jane",lastName:"Smith",email:"jane@acme.com",phone:"+44 7700 123456",company:"Acme Ltd",title:"VP Sales",source:"Website",status:"new",rating:"hot",industry:"Technology",website:"https://acme.com",description:"Inbound enquiry via contact form" }}
          currentCount={leads.length}
          onImport={async (rows, mode) => { await importMutation.mutateAsync({ rows, mode }); }}
        />
      </div>

      <div data-testid="leads-table">
        {viewMode === "table" && (
          <MondayTable
            columns={tableColumns}
            data={filteredLeads}
            groups={tableGroups}
            selectable
            gridLines
            density={density}
            emptyMessage="No leads yet. Capture leads to grow your sales pipeline."
            addItemLabel="Add Lead"
            onRowSelect={(ids) => setSelectedLeadIds(ids)}
            onRowFilesDrop={async (lead, files) => {
              try {
                for (const file of files) {
                  const fileUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result));
                    reader.onerror = () => reject(new Error("Failed to read file"));
                    reader.readAsDataURL(file);
                  });
                  await apiRequest("POST", "/api/crm/attachments", {
                    entityType: "lead",
                    entityId: lead.id,
                    fileName: file.name,
                    fileType: file.type || null,
                    fileSize: file.size,
                    fileUrl,
                  });
                }
                queryClient.invalidateQueries({
                  queryKey: [`/api/crm/attachments?entityType=lead&entityId=${lead.id}`],
                });
                queryClient.invalidateQueries({ queryKey: ["/api/crm/attachments?entityType=lead"] });
                toast({ title: `${files.length} file(s) attached` });
                openLeadExtras(lead, "files");
              } catch {
                toast({
                  title: "Upload failed",
                  description: "If this persists, run npm run db:push to create the attachments table.",
                  variant: "destructive",
                });
              }
            }}
            onAddItem={(groupId) => {
              if (groupId && groupId !== "ungrouped" && manualGroups.some((g) => g.id === groupId)) {
                sessionStorage.setItem("crm-leads-pending-group", groupId);
              } else {
                sessionStorage.removeItem("crm-leads-pending-group");
              }
              openCreateForm();
            }}
            onRowClick={(lead) => {
              setExtrasTab("comments");
              setViewingLead(lead);
            }}
            onCellEdit={handleCellEdit}
            onEditItem={handleEdit}
            onDeleteItems={(ids) => {
              if (ids.length === 1) {
                deleteMutation.mutate(typeof ids[0] === "string" ? Number(ids[0]) : ids[0]);
              } else {
                bulkDeleteMutation.mutate(ids);
              }
            }}
            searchHighlightTerm={effectiveSearch}
            columnWidthStorageKey="jiganto-crm-leads-col-widths"
            pagination={
              groupBy === "none"
                ? { defaultPageSize: 25, resetKey: `${effectiveSearch}|${JSON.stringify(filterRules)}|${ownerFilter}|${JSON.stringify(sortRules)}` }
                : false
            }
            totalCount={leads.length}
            className="border rounded-xl border-border/60"
            alwaysShowRowActions
            renderRowActions={(lead) => (
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Comments"
                  onClick={(e) => { e.stopPropagation(); openLeadExtras(lead, "comments"); }}
                  data-testid={`button-comments-lead-${lead.id}`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </Button>
                {manualGroups.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Move to group"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`button-move-group-lead-${lead.id}`}
                      >
                        <FolderPlus className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      {manualGroups.map((g) => (
                        <DropdownMenuItem
                          key={g.id}
                          onClick={() => handleMoveSelectedToGroup(g.id, [lead.id])}
                        >
                          {g.title}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleMoveSelectedToGroup("ungrouped", [lead.id])}>
                        Ungroup
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {lead.status !== "converted" && (
                    <Button
                    variant="ghost"
                      size="sm"
                    onClick={(e) => { e.stopPropagation(); handleConvert(lead); }}
                    className="text-[#0ea5e9] hover:text-[#0ea5e9]/80 hover:bg-[#0ea5e9]/10 h-7 px-2"
                    data-testid={`button-convert-lead-${lead.id}`}
                    >
                    <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                    Convert
                    </Button>
                )}
                  </div>
            )}
            renderBulkActions={(ids) => (
              <div className="flex items-center gap-1.5 flex-wrap">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" data-testid="button-bulk-status">
                      <UserCheck className="h-3 w-3" />
                      Change Status
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {statusOptions.filter((o) => o.value !== "converted").map((opt) => (
                      <DropdownMenuItem key={opt.value} onClick={() => handleBulkStatusChange(ids, opt.value)}>
                        {opt.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" data-testid="button-bulk-move-group">
                      <FolderPlus className="h-3 w-3" />
                      Move to group
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {manualGroups.length === 0 ? (
                      <DropdownMenuItem onClick={handleCreateManualGroup}>Create first group…</DropdownMenuItem>
                    ) : (
                      <>
                        {manualGroups.map((g) => (
                          <DropdownMenuItem key={g.id} onClick={() => handleMoveSelectedToGroup(g.id, ids)}>
                            {g.title}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleMoveSelectedToGroup("ungrouped", ids)}>
                          Ungroup
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleCreateManualGroup}>
                          New group with selection…
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
          </div>
        )}
          />
        )}

        {viewMode === "list" && (
          <CrmLeadListView
            leads={filteredLeads}
            statusOptions={statusOptions}
            resolveOwner={resolveOwner}
            onOpenLead={setViewingLead}
            onConvert={handleConvert}
            onAddLead={openCreateForm}
          />
        )}

        {viewMode === "board" && (
          <CrmLeadBoardView
            leads={filteredLeads}
            statusOptions={statusOptions}
            resolveOwner={resolveOwner}
            onOpenLead={setViewingLead}
            onConvert={handleConvert}
            onAddLead={openCreateForm}
            onStatusChange={async (leadId, status) => {
              try {
                await updateLeadMutation.mutateAsync({ id: leadId, updates: { status } });
                toast({ title: "Status updated" });
              } catch {
                toast({ title: "Failed to update status", variant: "destructive" });
                throw new Error("status update failed");
              }
            }}
          />
        )}

        {viewMode === "calendar" && (
          <CrmLeadCalendarView
            leads={filteredLeads}
            statusOptions={statusOptions}
            resolveOwner={resolveOwner}
            onOpenLead={setViewingLead}
            onConvert={handleConvert}
            onAddLead={openCreateForm}
          />
        )}
      </div>

      <CrmLeadLabelEditorDialog
        open={labelEditor === "status"}
        onOpenChange={(open) => !open && setLabelEditor(null)}
        title="Edit status labels"
        options={statusOptions}
        lockedValues={["converted"]}
        onSave={(next) => {
          setStatusOptions(next);
          saveLeadStatusOptions(next);
          toast({ title: "Status labels updated" });
        }}
      />

      <CrmLeadLabelEditorDialog
        open={labelEditor === "rating"}
        onOpenChange={(open) => !open && setLabelEditor(null)}
        title="Edit rating labels"
        options={ratingOptions}
        onSave={(next) => {
          setRatingOptions(next);
          saveLeadRatingOptions(next);
          toast({ title: "Rating labels updated" });
        }}
      />

      <FormDialogShell
        open={isConvertOpen}
        onOpenChange={setIsConvertOpen}
        title="Convert Lead"
        subtitle="Create account/contact/opportunity records"
        saveLabel={convertMutation.isPending ? "Converting..." : "Convert Lead"}
        onCancel={() => setIsConvertOpen(false)}
        onSubmit={() => {
          if (selectedLead) {
            convertMutation.mutate({ id: selectedLead.id, options: convertOptions });
          }
        }}
        saving={convertMutation.isPending}
        disabled={false}
        saveTestId="button-confirm-convert"
        size="md"
      >
          {selectedLead && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted rounded-lg flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ backgroundColor: getColorForName(selectedLead.company || selectedLead.firstName) }}
                >
                  {getInitials(selectedLead.company || `${selectedLead.firstName} ${selectedLead.lastName}`)}
                </div>
                <div>
                  <p className="font-medium">{selectedLead.firstName} {selectedLead.lastName}</p>
                  {selectedLead.company && <p className="text-sm text-muted-foreground">{selectedLead.company}</p>}
                  {selectedLead.score !== null && (
                    <div className="flex items-center gap-2 mt-1">
                      <TemperatureDisplay score={selectedLead.score} temperature={getTemperature(selectedLead.score)} />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="createAccount"
                    checked={convertOptions.createAccount}
                    onCheckedChange={(checked) => setConvertOptions(prev => ({ ...prev, createAccount: !!checked }))}
                    data-testid="checkbox-create-account"
                  />
                  <Label htmlFor="createAccount">Create Account</Label>
                </div>
                {convertOptions.createAccount && (
                  <div className="pl-6">
                    <Label htmlFor="accountName" className="text-sm">Account Name</Label>
                    <Input
                      id="accountName"
                      value={convertOptions.accountName}
                      onChange={(e) => setConvertOptions(prev => ({ ...prev, accountName: e.target.value }))}
                      className="mt-1"
                      data-testid="input-convert-account-name"
                    />
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="createContact"
                    checked={convertOptions.createContact}
                    onCheckedChange={(checked) => setConvertOptions(prev => ({ ...prev, createContact: !!checked }))}
                    data-testid="checkbox-create-contact"
                  />
                  <Label htmlFor="createContact">Create Contact</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="createOpportunity"
                    checked={convertOptions.createOpportunity}
                    onCheckedChange={(checked) => setConvertOptions(prev => ({ ...prev, createOpportunity: !!checked }))}
                    data-testid="checkbox-create-opportunity"
                  />
                  <Label htmlFor="createOpportunity">Create Opportunity</Label>
                </div>
                {convertOptions.createOpportunity && (
                  <div className="pl-6 space-y-3">
                    <div>
                      <Label htmlFor="opportunityName" className="text-sm">Opportunity Name</Label>
                      <Input
                        id="opportunityName"
                        value={convertOptions.opportunityName}
                        onChange={(e) => setConvertOptions(prev => ({ ...prev, opportunityName: e.target.value }))}
                        className="mt-1"
                        data-testid="input-convert-opp-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="opportunityAmount" className="text-sm">Amount</Label>
                      <Input
                        id="opportunityAmount"
                        type="number"
                        value={convertOptions.opportunityAmount}
                        onChange={(e) => setConvertOptions(prev => ({ ...prev, opportunityAmount: e.target.value }))}
                        className="mt-1"
                        data-testid="input-convert-opp-amount"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
      </FormDialogShell>

      <LeadFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingLead(null); }}
        editing={editingLead ? {
          id: editingLead.id,
          firstName: editingLead.firstName,
          lastName: editingLead.lastName,
          email: editingLead.email ?? "",
          phone: editingLead.phone ?? "",
          company: editingLead.company ?? "",
          title: editingLead.title ?? "",
          industry: editingLead.industry ?? "",
          website: editingLead.website ?? "",
          description: editingLead.description ?? "",
          source: editingLead.source ?? "",
          status: editingLead.status,
          score: editingLead.score,
          rating: editingLead.rating ?? "",
          ownerUserId: editingLead.ownerUserId ?? "",
          customData: editingLead.customData,
          createdAt: editingLead.createdAt,
          updatedAt: editingLead.updatedAt,
        } : null}
        onCreated={(lead) => {
          const pendingGroup = sessionStorage.getItem("crm-leads-pending-group");
          if (pendingGroup && lead?.id) {
            persistManualGroups(moveLeadsToGroup(manualGroups, pendingGroup, [lead.id]));
            setGroupBy("manual");
            sessionStorage.removeItem("crm-leads-pending-group");
            toast({ title: "Lead added to group" });
          }
        }}
        onOpenCustomFieldsSettings={() => {
          setFormOpen(false);
          setEditingLead(null);
          onOpenCustomFieldsSettings?.();
        }}
      />

      <LeadDetailSheet
        lead={viewingLead}
        open={!!viewingLead}
        onClose={() => setViewingLead(null)}
        onEdit={handleEdit}
        onConvert={handleConvert}
        companyColor={viewingLead ? getColorForName(viewingLead.company || `${viewingLead.firstName} ${viewingLead.lastName}`) : "#3b82f6"}
        companyInitials={viewingLead ? getInitials(viewingLead.company || `${viewingLead.firstName} ${viewingLead.lastName}`) : "?"}
        ownerName={viewingLead ? resolveOwner(viewingLead.ownerUserId).name : "—"}
        statusLabel={viewingLead ? <StatusDot status={viewingLead.status} /> : null}
        temperatureLabel={viewingLead ? <TemperatureDisplay score={viewingLead.score} temperature={getTemperature(viewingLead.score)} /> : null}
        initialExtrasTab={extrasTab}
      />
    </div>
  );
}
