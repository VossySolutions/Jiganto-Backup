import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { SubmitForm } from "@/components/ui/submit-form";
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

type CrmLead = {
  id: number;
  tenantId: number;
  firstName: string;
  lastName: string;
  email: string | null;
  company: string | null;
  source: string | null;
  status: string;
  score: number | null;
  createdAt: string;
};

interface CrmLeadsTabProps {
  leads: CrmLead[];
  searchTerm: string;
}

function getTemperature(score: number | null): "hot" | "warm" | "cold" {
  if (score === null) return "cold";
  if (score >= 80) return "hot";
  if (score >= 40) return "warm";
  return "cold";
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

export function CrmLeadsTab({ leads, searchTerm }: CrmLeadsTabProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [temperatureFilter, setTemperatureFilter] = useState<"all" | "hot" | "warm" | "cold">("all");
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
  const [formData, setFormData] = useState({ firstName: "", lastName: "", email: "", company: "", source: "", status: "new" });
  const [importOpen, setImportOpen] = useState(false);
  const { toast } = useToast();

  const importMutation = useMutation({
    mutationFn: ({ rows, mode }: { rows: Record<string, string>[]; mode: ImportMode }) =>
      apiRequest("POST", "/api/crm/leads/bulk-import", { rows, mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      toast({ title: "Leads imported successfully" });
    },
    onError: () => toast({ title: "Import failed", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/crm/leads", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      setIsOpen(false);
      setFormData({ firstName: "", lastName: "", email: "", company: "", source: "", status: "new" });
      toast({ title: "Lead created successfully" });
    },
    onError: () => toast({ title: "Failed to create lead", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Record<string, unknown> }) =>
      apiRequest("PUT", `/api/crm/leads/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      toast({ title: "Lead updated" });
    },
    onError: () => toast({ title: "Failed to update lead", variant: "destructive" }),
  });

  const convertMutation = useMutation({
    mutationFn: ({ id, options }: { id: number; options: typeof convertOptions }) =>
      apiRequest("POST", `/api/crm/leads/${id}/convert`, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
      setIsConvertOpen(false);
      setSelectedLead(null);
      setConvertOptions({ createAccount: true, createContact: true, createOpportunity: true, accountName: "", opportunityName: "", opportunityAmount: "" });
      toast({ title: "Lead converted successfully", description: "Account, contact, and opportunity created" });
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
    setEditingId(lead.id);
    setFormData({
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email || "",
      company: lead.company || "",
      source: lead.source || "",
      status: lead.status,
    });
    setIsOpen(true);
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

  const filteredLeads = useMemo(() => {
    let result = leads.filter(l => {
      const matchesSearch =
        `${l.firstName} ${l.lastName}`.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
        l.company?.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
        l.email?.toLowerCase().includes(effectiveSearch.toLowerCase());
      if (!matchesSearch) return false;
      if (temperatureFilter === "all") return true;
      return getTemperature(l.score) === temperatureFilter;
    });

    result.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "date") return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      if (sortField === "score") return dir * ((a.score ?? 0) - (b.score ?? 0));
      return dir * `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });

    return result;
  }, [leads, effectiveSearch, temperatureFilter, sortField, sortDir]);

  const hotCount = leads.filter(l => getTemperature(l.score) === "hot").length;
  const warmCount = leads.filter(l => getTemperature(l.score) === "warm").length;
  const coldCount = leads.filter(l => getTemperature(l.score) === "cold").length;

  const ownerInitials = ["AL", "PV", "SA", "JM", "RK", "DT", "NB", "CM"];
  const ownerNames = ["Alex Liu", "Priya Verma", "Sam Adams", "Julie Mason", "Ryan Kim", "Dan Torres", "Nina Brooks", "Chris Moore"];
  const ownerColors = ["#3b82f6", "#8b5cf6", "#22c55e", "#f97316", "#ec4899", "#06b6d4", "#ef4444", "#eab308"];

  function getOwnerForLead(lead: CrmLead) {
    const hash = (lead.id * 7 + (lead.firstName?.charCodeAt(0) || 0)) % ownerInitials.length;
    return { initials: ownerInitials[hash], color: ownerColors[hash], name: ownerNames[hash] };
  }

  const groupedLeads = useMemo(() => {
    if (groupBy === "none") return null;

    const groups: Record<string, CrmLead[]> = {};
    for (const lead of filteredLeads) {
      let key: string;
      if (groupBy === "owner") {
        key = getOwnerForLead(lead).name;
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
  }, [filteredLeads, groupBy]);

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
    const temp = getTemperature(lead.score);
    const companyName = lead.company || `${lead.firstName} ${lead.lastName}`;
    const companyColor = getColorForName(companyName);
    const companyInitials = getInitials(companyName);
    const owner = getOwnerForLead(lead);

    return (
      <tr
        key={lead.id}
        className={cn(
          "border-b border-border/40 hover:bg-muted/30 transition-colors",
          selectedIds.has(lead.id) && "bg-[#0ea5e9]/5"
        )}
        data-testid={`lead-row-${lead.id}`}
      >
        <td className="px-3 py-3 w-10">
          <Checkbox
            checked={selectedIds.has(lead.id)}
            onCheckedChange={() => toggleSelectOne(lead.id)}
            data-testid={`checkbox-lead-${lead.id}`}
          />
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
              style={{ backgroundColor: companyColor }}
            >
              {companyInitials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate max-w-[200px]">{companyName}</p>
              <p className="text-xs text-muted-foreground">Lead</p>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span className="text-sm">{lead.firstName} {lead.lastName}</span>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <StatusDot status={lead.status} />
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <TemperatureDisplay score={lead.score} temperature={temp} />
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span className="text-sm text-foreground capitalize">{lead.source || "—"}</span>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-white font-semibold text-[10px] shrink-0"
              style={{ backgroundColor: owner.color }}
            >
              {owner.initials}
            </div>
            <span className="text-xs text-muted-foreground">{owner.initials}</span>
          </div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span className="text-sm text-muted-foreground">{formatDate(lead.createdAt)}</span>
        </td>
        <td className="px-4 py-3 text-right whitespace-nowrap">
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
                  className="text-red-600 focus:text-red-600"
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

        <button
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors"
          data-testid="button-filter"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filter
        </button>
        <button
          onClick={() => handleSort("date")}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors"
          data-testid="button-sort"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          Sort: {sortField === "date" ? "Date" : sortField === "score" ? "Score" : "Name"}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                groupBy !== "none"
                  ? "bg-[#0ea5e9]/10 border-[#0ea5e9]/30 text-[#0ea5e9]"
                  : "border-border bg-background text-foreground hover:bg-muted"
              )}
              data-testid="button-group"
            >
              <Layers className="h-3.5 w-3.5" />
              {groupBy === "none" ? "Group" : `Group: ${groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}`}
              <ChevronDown className="h-3 w-3" />
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

        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) { setEditingId(null); setFormData({ firstName: "", lastName: "", email: "", company: "", source: "", status: "new" }); } }}>
          <DialogTrigger asChild>
            <Button className="bg-[#0ea5e9] hover:bg-[#0ea5e9]/90 text-white gap-1.5" data-testid="button-add-lead">
              <Plus className="h-4 w-4" />
              New Lead
            </Button>
          </DialogTrigger>
          <DialogContent>
            <SubmitForm
              onSubmit={() => {
                if (editingId) {
                  updateMutation.mutate({ id: editingId, updates: formData });
                  setIsOpen(false);
                  setEditingId(null);
                  setFormData({ firstName: "", lastName: "", email: "", company: "", source: "", status: "new" });
                } else {
                  createMutation.mutate(formData);
                }
              }}
              disabled={!formData.firstName || !formData.lastName || createMutation.isPending || updateMutation.isPending}
            >
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Lead" : "Create New Lead"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    data-testid="input-lead-firstName"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    data-testid="input-lead-lastName"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  data-testid="input-lead-email"
                />
              </div>
              <div>
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                  data-testid="input-lead-company"
                />
              </div>
              <div>
                <Label htmlFor="source">Lead Source</Label>
                <Select value={formData.source} onValueChange={(v) => setFormData(prev => ({ ...prev, source: v }))}>
                  <SelectTrigger data-testid="select-lead-source">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inbound">Inbound</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="web">Web</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="cold_email">Cold Email</SelectItem>
                    <SelectItem value="cold_call">Cold Call</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" data-testid="button-cancel-lead">Cancel</Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={!formData.firstName || !formData.lastName || createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-lead"
              >
                {editingId
                  ? (updateMutation.isPending ? "Updating..." : "Update Lead")
                  : (createMutation.isPending ? "Creating..." : "Create Lead")}
              </Button>
            </DialogFooter>
            </SubmitForm>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-x-auto max-w-[95%]" data-testid="leads-table">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/60">
              <th className="px-3 py-3 w-10">
                <Checkbox
                  checked={filteredLeads.length > 0 && selectedIds.size === filteredLeads.length}
                  onCheckedChange={toggleSelectAll}
                  data-testid="checkbox-select-all"
                />
              </th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Company</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Contact</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Status</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Score</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Source</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Owner</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Created</th>
              <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-16 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <FlameIcon className="h-10 w-10 opacity-30" />
                    <p className="text-sm">No leads yet. Capture leads to grow your sales pipeline.</p>
                    <Button
                      size="sm"
                      className="mt-2 bg-[#0ea5e9] hover:bg-[#0ea5e9]/90"
                      onClick={() => setIsOpen(true)}
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
                  <td colSpan={9} className="px-4 py-2">
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
              filteredLeads.map(renderRow)
            )}
          </tbody>
        </table>
        {filteredLeads.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20 text-xs text-muted-foreground" data-testid="leads-count-footer">
            {filteredLeads.length} of {leads.length} leads
            {selectedIds.size > 0 && <span className="ml-2 text-[#0ea5e9]">({selectedIds.size} selected)</span>}
          </div>
        )}
      </div>

      <Dialog open={isConvertOpen} onOpenChange={setIsConvertOpen}>
        <DialogContent className="max-w-md">
          <SubmitForm
            onSubmit={() => {
              if (selectedLead) {
                convertMutation.mutate({ id: selectedLead.id, options: convertOptions });
              }
            }}
            disabled={convertMutation.isPending}
          >
          <DialogHeader>
            <DialogTitle>Convert Lead</DialogTitle>
          </DialogHeader>
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
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" data-testid="button-cancel-convert">Cancel</Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={convertMutation.isPending}
              className="bg-[#0ea5e9] hover:bg-[#0ea5e9]/90"
              data-testid="button-confirm-convert"
            >
              {convertMutation.isPending ? "Converting..." : "Convert Lead"}
            </Button>
          </DialogFooter>
          </SubmitForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}
