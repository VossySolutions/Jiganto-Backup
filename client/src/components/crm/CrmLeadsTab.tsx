import { useState, useMemo } from "react";
import { useCrmPagination } from "@/hooks/use-crm-pagination";
import { CrmTablePagination } from "./CrmTablePagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FormDialogShell } from "@/components/ui/form-dialog-shell";
import { LeadFormDialog } from "./LeadFormDialog";
import { LeadDetailSheet, type CrmLead } from "./LeadDetailSheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Plus, Download, Upload, ArrowUpRight, Search,
  SlidersHorizontal, ArrowUpDown, Layers, Trash2,
  UserCheck, ChevronDown, X, MoreHorizontal, Pencil
} from "lucide-react";
import { ImportModal, type ImportMode } from "@/components/ImportModal";
import { CrmCustomFieldTableHeaders, CrmCustomFieldTableCells } from "./CrmCustomFieldTableCells";
import { useCrmUsers } from "./CrmUsersProvider";
import { useCrmCustomFields } from "@/hooks/use-crm-custom-fields";
import { CrmColumnVisibilityMenu } from "./CrmColumnVisibilityMenu";
import { CrmInlineEditCell } from "./CrmInlineEditCell";
import { CrmInlineEditSelect } from "./CrmInlineEditSelect";
import { loadColumnVisibility, saveColumnVisibility, type CrmColumnDef } from "@/lib/crm-list-columns";

const LEAD_STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "unqualified", label: "Unqualified" },
  { value: "converted", label: "Converted" },
  { value: "lost", label: "Lost" },
];

const LEAD_TABLE_COLUMNS: CrmColumnDef[] = [
  { id: "contact", label: "Contact" },
  { id: "title", label: "Title" },
  { id: "status", label: "Status" },
  { id: "score", label: "Score" },
  { id: "rating", label: "Rating" },
  { id: "source", label: "Source" },
  { id: "owner", label: "Owner" },
  { id: "created", label: "Created" },
];

interface CrmLeadsTabProps {
  leads: CrmLead[];
  searchTerm: string;
  onNavigateToTab?: (tab: string) => void;
  onOpenCustomFieldsSettings?: () => void;
}

function getTemperature(score: number | null): "hot" | "warm" | "cold" {
  if (score === null) return "cold";
  if (score >= 80) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

function RatingBadge({ rating }: { rating?: string | null }) {
  if (!rating) return <span className="text-muted-foreground">—</span>;
  const styles: Record<string, string> = {
    hot: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
    warm: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
    cold: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
  };
  return (
    <Badge variant="outline" className={cn("text-[10px] capitalize border-0", styles[rating] || "")}>
      {rating}
    </Badge>
  );
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.toLocaleString("en-US", { month: "short" });
  const day = date.getDate();
  return `${month} ${day}`;
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

function AllIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="4" height="4" rx="1" fill="#3b82f6"/>
      <rect x="6" y="3" width="4" height="4" rx="1" fill="#22c55e"/>
      <rect x="11" y="3" width="4" height="4" rx="1" fill="#f97316"/>
      <rect x="3.5" y="9" width="4" height="4" rx="1" fill="#8b5cf6"/>
      <rect x="8.5" y="9" width="4" height="4" rx="1" fill="#ec4899"/>
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

export function CrmLeadsTab({ leads, searchTerm, onNavigateToTab, onOpenCustomFieldsSettings }: CrmLeadsTabProps) {
  const { users, resolveOwner } = useCrmUsers();
  const { fields: customFields } = useCrmCustomFields("lead");
  const tableColSpan = 11 + customFields.length;
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<CrmLead | null>(null);
  const [viewingLead, setViewingLead] = useState<CrmLead | null>(null);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [temperatureFilter, setTemperatureFilter] = useState<"all" | "hot" | "warm" | "cold">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [sortField, setSortField] = useState<"date" | "score" | "name">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [groupBy, setGroupBy] = useState<"none" | "owner" | "status" | "source" | "temperature">("none");
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
      setSelectedIds(new Set());
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

  const toggleTemperatureFilter = (filter: "all" | "hot" | "warm" | "cold") => {
    setTemperatureFilter(prev => prev === filter ? "all" : filter);
  };

  const effectiveSearch = searchTerm || localSearch;

  const leadSources = useMemo(
    () => Array.from(new Set(leads.map(l => l.source).filter((s): s is string => !!s))),
    [leads]
  );

  const ownerSelectOptions = useMemo(
    () => [
      { value: "", label: "Unassigned" },
      ...users.map((u) => ({ value: u.id, label: resolveOwner(u.id).name })),
    ],
    [users, resolveOwner],
  );

  const sourceSelectOptions = useMemo(
    () => leadSources.map((s) => ({ value: s, label: s })),
    [leadSources],
  );

  const activeFilterCount = [statusFilter, sourceFilter, ownerFilter].filter(f => f !== "all").length;

  const filteredLeads = useMemo(() => {
    let result = leads.filter(l => {
      const matchesSearch =
        `${l.firstName} ${l.lastName}`.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
        l.company?.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
        l.email?.toLowerCase().includes(effectiveSearch.toLowerCase());
      if (!matchesSearch) return false;
      if (temperatureFilter !== "all" && getTemperature(l.score) !== temperatureFilter) return false;
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
      if (ownerFilter === "__unassigned__" && l.ownerUserId) return false;
      if (ownerFilter !== "all" && ownerFilter !== "__unassigned__" && l.ownerUserId !== ownerFilter) return false;
      return true;
    });

    result.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "date") return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      if (sortField === "score") return dir * ((a.score ?? 0) - (b.score ?? 0));
      return dir * `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });

    return result;
  }, [leads, effectiveSearch, temperatureFilter, statusFilter, sourceFilter, ownerFilter, sortField, sortDir]);

  const pagination = useCrmPagination(filteredLeads, {
    resetKey: `${effectiveSearch}|${temperatureFilter}|${statusFilter}|${sourceFilter}|${ownerFilter}|${sortField}|${sortDir}|${groupBy}`,
    enabled: groupBy === "none",
  });

  const hotCount = leads.filter(l => getTemperature(l.score) === "hot").length;
  const warmCount = leads.filter(l => getTemperature(l.score) === "warm").length;
  const coldCount = leads.filter(l => getTemperature(l.score) === "cold").length;

  const groupedLeads = useMemo(() => {
    if (groupBy === "none") return null;

    const groups: Record<string, CrmLead[]> = {};
    for (const lead of filteredLeads) {
      let key: string;
      if (groupBy === "owner") {
        key = resolveOwner(lead.ownerUserId).name;
      } else if (groupBy === "status") {
        key = lead.status.charAt(0).toUpperCase() + lead.status.slice(1);
      } else if (groupBy === "source") {
        key = lead.source ? lead.source.charAt(0).toUpperCase() + lead.source.slice(1).replace(/_/g, " ") : "Unknown";
      } else {
        key = getTemperature(lead.score).charAt(0).toUpperCase() + getTemperature(lead.score).slice(1);
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(lead);
    }
    return groups;
  }, [filteredLeads, groupBy, resolveOwner]);

  const groupColors: Record<string, string> = {
    Hot: "#ef4444", Warm: "#f59e0b", Cold: "#3b82f6",
    New: "#22c55e", Contacted: "#f59e0b", Qualified: "#22c55e", Converted: "#8b5cf6", Lost: "#ef4444",
  };

  const exportToCSV = () => {
    const headers = ["Company", "Contact", "Status", "Score", "Temperature", "Source", "Created"];
    const rows = filteredLeads.map(l => [
      l.company || "", `${l.firstName} ${l.lastName}`, l.status || "", String(l.score || ""),
      getTemperature(l.score), l.source || "", formatDate(l.createdAt)
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

  const handleSort = (field: "date" | "score" | "name") => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLeads.map(l => l.id)));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkStatusChange = (status: string) => {
    const ids = Array.from(selectedIds);
    Promise.all(ids.map(id => apiRequest("PUT", `/api/crm/leads/${id}`, { status }))).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      setSelectedIds(new Set());
      toast({ title: `${ids.length} leads updated to ${status}` });
    });
  };

  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedIds));
  };

  const renderRow = (lead: CrmLead) => {
    const companyName = lead.company || `${lead.firstName} ${lead.lastName}`;
    const companyColor = getColorForName(companyName);
    const companyInitials = getInitials(companyName);
    const owner = resolveOwner(lead.ownerUserId);

    return (
      <tr
        key={lead.id}
        className={cn(
          "border-b border-border/40 hover:bg-muted/30 transition-colors",
          selectedIds.has(lead.id) && "bg-[#0ea5e9]/5"
        )}
        data-testid={`lead-row-${lead.id}`}
      >
        <td className="px-3 py-2.5 align-middle w-10">
          <Checkbox
            checked={selectedIds.has(lead.id)}
            onCheckedChange={() => toggleSelectOne(lead.id)}
            data-testid={`checkbox-lead-${lead.id}`}
          />
        </td>
        <td className="px-3 py-2.5 align-middle whitespace-nowrap">
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
              style={{ backgroundColor: companyColor }}
            >
              {companyInitials}
            </div>
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => setViewingLead(lead)}
                className="text-sm font-semibold truncate max-w-[200px] text-left text-[#0ea5e9] hover:underline"
                data-testid={`link-lead-company-${lead.id}`}
              >
                {companyName}
              </button>
              <p className="text-xs text-muted-foreground">Lead</p>
            </div>
          </div>
        </td>
        {isColVisible("contact") && (
        <td className="px-3 py-2.5 align-middle whitespace-nowrap">
          <CrmInlineEditCell
            value={`${lead.firstName} ${lead.lastName}`.trim()}
            onSave={(v) => {
              const parts = v.trim().split(/\s+/);
              const firstName = parts[0] || lead.firstName;
              const lastName = parts.slice(1).join(" ") || lead.lastName;
              updateLeadMutation.mutate({ id: lead.id, updates: { firstName, lastName } });
            }}
            testId={`inline-lead-contact-${lead.id}`}
          />
        </td>
        )}
        {isColVisible("title") && (
        <td className="px-3 py-2.5 align-middle whitespace-nowrap text-sm text-muted-foreground">
          <CrmInlineEditCell
            value={lead.title || ""}
            displayValue={lead.title || "—"}
            onSave={(v) => updateLeadMutation.mutate({ id: lead.id, updates: { title: v || null } })}
            testId={`inline-lead-title-${lead.id}`}
          />
        </td>
        )}
        {isColVisible("status") && (
        <td className="px-3 py-2.5 align-middle whitespace-nowrap">
          <CrmInlineEditSelect
            value={lead.status}
            displayValue={<StatusDot status={lead.status} />}
            options={LEAD_STATUS_OPTIONS}
            onSave={(v) => updateLeadMutation.mutate({ id: lead.id, updates: { status: v } })}
            disabled={lead.status === "converted"}
            testId={`inline-lead-status-${lead.id}`}
          />
        </td>
        )}
        {isColVisible("score") && (
        <td className="px-3 py-2.5 align-middle whitespace-nowrap">
          <CrmInlineEditCell
            value={String(lead.score ?? "")}
            type="number"
            displayValue={String(lead.score ?? "—")}
            onSave={(v) => updateLeadMutation.mutate({ id: lead.id, updates: { score: v ? parseInt(v, 10) : 0 } })}
            testId={`inline-lead-score-${lead.id}`}
          />
        </td>
        )}
        {isColVisible("rating") && (
        <td className="px-3 py-2.5 align-middle whitespace-nowrap">
          <RatingBadge rating={lead.rating} />
        </td>
        )}
        {isColVisible("source") && (
        <td className="px-3 py-2.5 align-middle whitespace-nowrap">
          <CrmInlineEditSelect
            value={lead.source || ""}
            displayValue={<span className="text-sm capitalize">{lead.source || "—"}</span>}
            options={sourceSelectOptions}
            onSave={(v) => updateLeadMutation.mutate({ id: lead.id, updates: { source: v || null } })}
            testId={`inline-lead-source-${lead.id}`}
          />
        </td>
        )}
        {isColVisible("owner") && (
        <td className="px-3 py-2.5 align-middle whitespace-nowrap">
          <div className="flex items-center gap-2">
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-white font-semibold text-[10px] shrink-0"
              style={{ backgroundColor: owner.color }}
            >
              {owner.initials}
            </div>
            <CrmInlineEditSelect
              value={lead.ownerUserId || ""}
              displayValue={owner.name}
              options={ownerSelectOptions}
              onSave={(v) => updateLeadMutation.mutate({ id: lead.id, updates: { ownerUserId: v || null } })}
              className="text-xs text-muted-foreground"
              testId={`inline-lead-owner-${lead.id}`}
            />
          </div>
        </td>
        )}
        {isColVisible("created") && (
        <td className="px-3 py-2.5 align-middle whitespace-nowrap">
          <span className="text-sm text-muted-foreground">{formatDate(lead.createdAt)}</span>
        </td>
        )}
        <CrmCustomFieldTableCells fields={customFields} customData={lead.customData} />
        <td className="px-3 py-2.5 align-middle text-right whitespace-nowrap">
          <div className="flex items-center justify-end gap-1">
            {lead.status !== "converted" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.stopPropagation(); handleConvert(lead); }}
                className="text-[#0ea5e9] hover:text-[#0ea5e9]/80 hover:bg-[#0ea5e9]/10"
                data-testid={`button-convert-lead-${lead.id}`}
              >
                <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                Convert
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()} data-testid={`button-actions-lead-${lead.id}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEdit(lead)} data-testid={`action-edit-lead-${lead.id}`}>
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => deleteMutation.mutate(lead.id)}
                  className="text-red-600 focus:text-red-700"
                  data-testid={`action-delete-lead-${lead.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[#0ea5e9]/10 border border-[#0ea5e9]/30 rounded-lg" data-testid="bulk-actions-bar">
          <span className="text-sm font-medium text-[#0ea5e9]">{selectedIds.size} selected</span>
          <div className="h-4 w-px bg-[#0ea5e9]/30" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" data-testid="button-bulk-status">
                <UserCheck className="h-3 w-3" />
                Change Status
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleBulkStatusChange("new")}>New</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkStatusChange("contacted")}>Contacted</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkStatusChange("qualified")}>Qualified</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleBulkDelete}
            disabled={bulkDeleteMutation.isPending}
            data-testid="button-bulk-delete"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </Button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground ml-auto"
            data-testid="button-clear-selection"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2" data-testid="filter-temperature-bar">
        <button
          onClick={() => toggleTemperatureFilter("all")}
          className={cn(
            "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
            temperatureFilter === "all"
              ? "bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-400"
              : "bg-background border-border text-foreground hover:bg-violet-50/50 dark:hover:bg-violet-950/20"
          )}
          data-testid="button-filter-all"
        >
          <AllIcon className="h-4 w-4" />
          All ({leads.length})
        </button>
        <button
          onClick={() => toggleTemperatureFilter("hot")}
          className={cn(
            "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
            temperatureFilter === "hot"
              ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
              : "bg-background border-border text-foreground hover:bg-red-50/50 dark:hover:bg-red-950/20"
          )}
          data-testid="button-filter-hot"
        >
          <FlameIcon className="h-4 w-4" />
          Hot ({hotCount})
        </button>
        <button
          onClick={() => toggleTemperatureFilter("warm")}
          className={cn(
            "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
            temperatureFilter === "warm"
              ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400"
              : "bg-background border-border text-foreground hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
          )}
          data-testid="button-filter-warm"
        >
          <WarmIcon className="h-4 w-4" />
          Warm ({warmCount})
        </button>
        <button
          onClick={() => toggleTemperatureFilter("cold")}
          className={cn(
            "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
            temperatureFilter === "cold"
              ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400"
              : "bg-background border-border text-foreground hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
          )}
          data-testid="button-filter-cold"
        >
          <ColdIcon className="h-4 w-4" />
          Cold ({coldCount})
        </button>

        <div className="h-6 w-px bg-border mx-1" />

        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                activeFilterCount > 0
                  ? "bg-[#0ea5e9]/10 border-[#0ea5e9]/30 text-[#0ea5e9]"
                  : "border-border bg-background text-foreground hover:bg-muted"
              )}
              data-testid="button-filter"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filter
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{activeFilterCount}</Badge>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8" data-testid="filter-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="unqualified">Unqualified</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Source</Label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="h-8" data-testid="filter-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  {leadSources.map(source => (
                    <SelectItem key={source} value={source}>{source}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Owner</Label>
              <Select value={ownerFilter} onValueChange={setOwnerFilter}>
                <SelectTrigger className="h-8" data-testid="filter-owner">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All owners</SelectItem>
                  <SelectItem value="__unassigned__">Unassigned</SelectItem>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>{resolveOwner(user.id).name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => { setStatusFilter("all"); setSourceFilter("all"); setOwnerFilter("all"); }}
              data-testid="button-clear-filters"
            >
              Clear filters
            </Button>
          </PopoverContent>
        </Popover>

        <CrmColumnVisibilityMenu
          columns={LEAD_TABLE_COLUMNS}
          visibility={columnVisibility}
          onChange={setColVisible}
          testId="button-lead-fields"
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors"
              data-testid="button-sort"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Sort: {sortField === "date" ? "Date" : sortField === "score" ? "Score" : "Name"}
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => handleSort("date")}>Date {sortField === "date" ? `(${sortDir})` : ""}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("score")}>Score {sortField === "score" ? `(${sortDir})` : ""}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("name")}>Name {sortField === "name" ? `(${sortDir})` : ""}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "inline-flex items-center justify-center h-9 w-9 rounded-lg border transition-colors",
                groupBy !== "none"
                  ? "bg-[#0ea5e9]/10 border-[#0ea5e9]/30 text-[#0ea5e9]"
                  : "border-border bg-background text-foreground hover:bg-muted"
              )}
              title={groupBy === "none" ? "Group" : `Grouped by ${groupBy}`}
              aria-label={groupBy === "none" ? "Group leads" : `Grouped by ${groupBy}`}
              data-testid="button-group"
            >
              <Layers className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setGroupBy("none")} data-testid="group-none">
              None
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGroupBy("owner")} data-testid="group-owner">
              Owner
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGroupBy("status")} data-testid="group-status">
              Status
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGroupBy("source")} data-testid="group-source">
              Source
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGroupBy("temperature")} data-testid="group-temperature">
              Temperature
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1" />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-9 h-9 w-52 rounded-lg"
            data-testid="input-search-leads"
          />
        </div>

        <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-1.5" data-testid="button-export-leads">
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setImportOpen(true)} data-testid="button-import-leads">
          <Upload className="h-3.5 w-3.5" />
          Import
        </Button>
        <ImportModal
          isOpen={importOpen}
          onClose={() => setImportOpen(false)}
          entityName="Leads"
          templateHeaders={["firstName","lastName","email","phone","company","title","source","status","rating","industry","website","description"]}
          exampleRow={{ firstName:"Jane",lastName:"Smith",email:"jane@acme.com",phone:"+44 7700 123456",company:"Acme Ltd",title:"VP Sales",source:"Website",status:"new",rating:"hot",industry:"Technology",website:"https://acme.com",description:"Inbound enquiry via contact form" }}
          currentCount={leads.length}
          onImport={async (rows, mode) => { await importMutation.mutateAsync({ rows, mode }); }}
        />

        {filteredLeads.length > 0 && (
        <Button className="bg-[#0ea5e9] hover:bg-[#0ea5e9]/90 text-white gap-1.5" data-testid="button-add-lead" onClick={openCreateForm}>
          <Plus className="h-4 w-4" />
          New Lead
        </Button>
        )}
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-x-auto w-full" data-testid="leads-table">
        <table className="w-full text-sm text-gray-700 dark:text-foreground">
          <thead>
            <tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground border-b border-border/60">
              <th className="px-3 py-2.5 align-middle w-10">
                <Checkbox
                  checked={filteredLeads.length > 0 && selectedIds.size === filteredLeads.length}
                  onCheckedChange={toggleSelectAll}
                  data-testid="checkbox-select-all"
                />
              </th>
              <th className="px-3 py-2.5 text-left align-middle font-semibold whitespace-nowrap">Company</th>
              {isColVisible("contact") && <th className="px-3 py-2.5 text-left align-middle font-semibold whitespace-nowrap">Contact</th>}
              {isColVisible("title") && <th className="px-3 py-2.5 text-left align-middle font-semibold whitespace-nowrap">Title</th>}
              {isColVisible("status") && <th className="px-3 py-2.5 text-left align-middle font-semibold whitespace-nowrap">Status</th>}
              {isColVisible("score") && <th className="px-3 py-2.5 text-left align-middle font-semibold whitespace-nowrap">Score</th>}
              {isColVisible("rating") && <th className="px-3 py-2.5 text-left align-middle font-semibold whitespace-nowrap">Rating</th>}
              {isColVisible("source") && <th className="px-3 py-2.5 text-left align-middle font-semibold whitespace-nowrap">Source</th>}
              {isColVisible("owner") && <th className="px-3 py-2.5 text-left align-middle font-semibold whitespace-nowrap">Owner</th>}
              {isColVisible("created") && <th className="px-3 py-2.5 text-left align-middle font-semibold whitespace-nowrap">Created</th>}
              <CrmCustomFieldTableHeaders fields={customFields} />
              <th className="px-3 py-2.5 text-right align-middle font-semibold whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={tableColSpan} className="text-center py-16 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <FlameIcon className="h-10 w-10 opacity-30" />
                    <p className="text-sm">No leads yet. Capture leads to grow your sales pipeline.</p>
                    <Button
                      size="sm"
                      className="mt-2 bg-[#0ea5e9] hover:bg-[#0ea5e9]/90"
                      onClick={openCreateForm}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      New Lead
                    </Button>
                  </div>
                </td>
              </tr>
            ) : groupedLeads ? (
              Object.entries(groupedLeads).flatMap(([groupName, groupLeads]) => [
                <tr key={`group-header-${groupName}`} className="bg-muted/40 border-b border-border/40" data-testid={`group-${groupName}`}>
                  <td colSpan={tableColSpan} className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: groupColors[groupName] || "#6b7280" }}
                      />
                      <span className="text-sm font-semibold">{groupName}</span>
                      <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                        {groupLeads.length}
                      </Badge>
                    </div>
                  </td>
                </tr>,
                ...groupLeads.map(renderRow)
              ])
            ) : (
              pagination.paginatedItems.map(renderRow)
            )}
          </tbody>
        </table>
        {groupBy !== "none" && filteredLeads.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20 text-xs text-muted-foreground" data-testid="leads-count-footer">
            {filteredLeads.length} of {leads.length} leads
            {selectedIds.size > 0 && <span className="ml-2 text-[#0ea5e9]">({selectedIds.size} selected)</span>}
          </div>
        )}
        {groupBy === "none" && (
          <CrmTablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            startIndex={pagination.startIndex}
            endIndex={pagination.endIndex}
            pageSize={pagination.pageSize}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
            extra={selectedIds.size > 0 ? <span className="text-[#0ea5e9]">({selectedIds.size} selected)</span> : undefined}
          />
        )}
      </div>

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
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="createAccount"
                    checked={convertOptions.createAccount}
                    onCheckedChange={(checked) => setConvertOptions(prev => ({ ...prev, createAccount: !!checked }))}
                    data-testid="checkbox-create-account"
                  />
                  <Label htmlFor="createAccount" className="font-medium">Create Account</Label>
                </div>
                {convertOptions.createAccount && (
                  <div className="ml-6">
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

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="createContact"
                    checked={convertOptions.createContact}
                    onCheckedChange={(checked) => setConvertOptions(prev => ({ ...prev, createContact: !!checked }))}
                    disabled={!convertOptions.createAccount}
                    data-testid="checkbox-create-contact"
                  />
                  <Label htmlFor="createContact" className="font-medium">Create Contact</Label>
                </div>

                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="createOpportunity"
                    checked={convertOptions.createOpportunity}
                    onCheckedChange={(checked) => setConvertOptions(prev => ({ ...prev, createOpportunity: !!checked }))}
                    disabled={!convertOptions.createAccount}
                    data-testid="checkbox-create-opportunity"
                  />
                  <Label htmlFor="createOpportunity" className="font-medium">Create Opportunity</Label>
                </div>
                {convertOptions.createOpportunity && convertOptions.createAccount && (
                  <div className="ml-6 space-y-2">
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
      />
    </div>
  );
}
