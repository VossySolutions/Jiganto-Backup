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
  Plus, Download, Upload, Search, ArrowUpDown, Layers,
  ChevronDown, X, Trash2, Paintbrush, Bookmark, MoreHorizontal, Pencil
} from "lucide-react";
import { ImportModal, type ImportMode } from "@/components/ImportModal";
import { ConditionalFormattingPanel } from "@/components/ConditionalFormattingPanel";
import { evaluateConditionalFormatting, type ConditionalFormatRule } from "@/lib/conditionalFormatting";
import type { ColumnDef as MondayColumnDef } from "@/components/MondayTable";

type CrmAccount = {
  id: number;
  tenantId: number;
  parentAccountId: number | null;
  name: string;
  type: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  ownerUserId: string | null;
  description: string | null;
  annualRevenue: string | null;
  employeeCount: number | null;
  createdAt: string;
  updatedAt: string;
};

interface CrmCustomersTabProps {
  accounts: CrmAccount[];
  searchTerm: string;
  onSelectAccount: (account: CrmAccount) => void;
}

const VIBRANT_LOGO_COLORS = [
  "#3b82f6", "#22c55e", "#f97316", "#8b5cf6",
  "#ec4899", "#06b6d4", "#eab308", "#ef4444",
  "#14b8a6", "#6366f1",
];

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return VIBRANT_LOGO_COLORS[Math.abs(hash) % VIBRANT_LOGO_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

function getSegment(annualRevenue: string | null): string {
  const rev = parseFloat(annualRevenue || "0");
  if (rev >= 1000000) return "Enterprise";
  if (rev >= 100000) return "Mid-Market";
  return "SMB";
}

function getSegmentColor(segment: string): string {
  if (segment === "Enterprise") return "#8b5cf6";
  if (segment === "Mid-Market") return "#3b82f6";
  return "#6b7280";
}

function formatCurrency(val: string | null): string {
  const num = parseFloat(val || "0");
  if (num === 0) return "—";
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${Math.round(num / 1000)}K`;
  return `$${num.toLocaleString()}`;
}

function getStatusInfo(type: string): { label: string; color: string; bg: string } {
  switch (type) {
    case "customer": return { label: "Active", color: "#22c55e", bg: "rgba(34,197,94,0.1)" };
    case "prospect": return { label: "Prospect", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" };
    case "partner": return { label: "Partner", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" };
    case "inactive": return { label: "Inactive", color: "#6b7280", bg: "rgba(107,114,128,0.1)" };
    default: return { label: type, color: "#6b7280", bg: "rgba(107,114,128,0.1)" };
  }
}

function CustomersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="7" r="4" fill="#3b82f6" opacity="0.8"/>
      <path d="M1 21v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2" fill="#3b82f6" opacity="0.3"/>
      <circle cx="18" cy="9" r="3" fill="#06b6d4" opacity="0.7"/>
      <path d="M21 21v-1.5a3.5 3.5 0 0 0-3-3.47" stroke="#06b6d4" strokeWidth="1.5" fill="none"/>
    </svg>
  );
}

function RevenueIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#22c55e" opacity="0.15"/>
      <circle cx="12" cy="12" r="7" fill="#22c55e" opacity="0.3"/>
      <text x="12" y="16" textAnchor="middle" fill="#22c55e" fontSize="11" fontWeight="bold">$</text>
    </svg>
  );
}

function IndustryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="10" width="6" height="11" rx="1" fill="#8b5cf6" opacity="0.6"/>
      <rect x="9" y="5" width="6" height="16" rx="1" fill="#8b5cf6" opacity="0.8"/>
      <rect x="16" y="2" width="6" height="19" rx="1" fill="#8b5cf6"/>
    </svg>
  );
}

function GrowthIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M3 20 L9 13 L13 16 L21 6" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="21" cy="6" r="2.5" fill="#f97316" opacity="0.8"/>
      <path d="M17 6 L21 6 L21 10" stroke="#f97316" strokeWidth="2" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

export function CrmCustomersTab({ accounts, searchTerm, onSelectAccount }: CrmCustomersTabProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [segmentFilter, setSegmentFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [localSearch, setLocalSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "revenue" | "segment" | "industry" | "created">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [groupBy, setGroupBy] = useState<"none" | "segment" | "industry" | "type">("none");
  const [formatPanelOpen, setFormatPanelOpen] = useState(false);
  const [formatRules, setFormatRules] = useState<ConditionalFormatRule[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", type: "prospect", industry: "", email: "", phone: "", website: "" });
  const [importOpen, setImportOpen] = useState(false);
  const { toast } = useToast();

  const importMutation = useMutation({
    mutationFn: ({ rows, mode }: { rows: Record<string, string>[]; mode: ImportMode }) =>
      apiRequest("POST", "/api/crm/accounts/bulk-import", { rows, mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/accounts"] });
      toast({ title: "Customers imported successfully" });
    },
    onError: () => toast({ title: "Import failed", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/crm/accounts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/accounts"] });
      setIsOpen(false);
      setFormData({ name: "", type: "prospect", industry: "", email: "", phone: "", website: "" });
      toast({ title: "Account created successfully" });
    },
    onError: () => toast({ title: "Failed to create account", variant: "destructive" }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => apiRequest("POST", "/api/crm/accounts/bulk-delete", { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/accounts"] });
      setSelectedIds(new Set());
      toast({ title: "Accounts deleted successfully" });
    },
    onError: () => toast({ title: "Failed to delete accounts", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Record<string, unknown> }) =>
      apiRequest("PUT", `/api/crm/accounts/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/accounts"] });
      toast({ title: "Account updated" });
    },
    onError: () => toast({ title: "Failed to update account", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/crm/accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/accounts"] });
      toast({ title: "Account deleted" });
    },
    onError: () => toast({ title: "Failed to delete account", variant: "destructive" }),
  });

  const industries = useMemo(() => {
    const set = new Set<string>();
    accounts.forEach(a => { if (a.industry) set.add(a.industry); });
    return Array.from(set).sort();
  }, [accounts]);

  const enrichedAccounts = useMemo(() => {
    let result = accounts.map(a => ({
      ...a,
      segment: getSegment(a.annualRevenue),
      revenueNum: parseFloat(a.annualRevenue || "0"),
    }));

    const search = localSearch || searchTerm;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(a =>
        a.name.toLowerCase().includes(s) ||
        a.industry?.toLowerCase().includes(s) ||
        a.email?.toLowerCase().includes(s)
      );
    }

    if (segmentFilter !== "all") {
      result = result.filter(a => a.segment === segmentFilter);
    }
    if (typeFilter !== "all") {
      result = result.filter(a => a.type === typeFilter);
    }
    if (industryFilter !== "all") {
      result = result.filter(a => a.industry === industryFilter);
    }

    result.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "name") return dir * a.name.localeCompare(b.name);
      if (sortField === "revenue") return dir * (a.revenueNum - b.revenueNum);
      if (sortField === "segment") return dir * a.segment.localeCompare(b.segment);
      if (sortField === "industry") return dir * (a.industry || "").localeCompare(b.industry || "");
      return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });

    return result;
  }, [accounts, localSearch, searchTerm, segmentFilter, typeFilter, industryFilter, sortField, sortDir]);

  const formatColumns: MondayColumnDef<any>[] = [
    { id: "name", header: "Account", type: "text", accessor: "name" },
    { id: "segment", header: "Segment", type: "text", accessor: "segment" },
    { id: "industry", header: "Industry", type: "text", accessor: "industry" },
    { id: "type", header: "Status", type: "text", accessor: "type" },
    { id: "annualRevenue", header: "Revenue", type: "currency", accessor: "annualRevenue" },
  ];

  const cellFormatMap = useMemo(() => {
    if (formatRules.length === 0) return {};
    return evaluateConditionalFormatting(enrichedAccounts as any[], formatColumns, formatRules);
  }, [formatRules, enrichedAccounts]);

  function getCellStyle(rowId: number | string, columnId: string): Record<string, string> {
    const rowFormat = cellFormatMap[rowId];
    if (!rowFormat) return {};
    const style: Record<string, string> = {};
    if (rowFormat.row) {
      if (rowFormat.row.bgColor) style.backgroundColor = rowFormat.row.bgColor;
      if (rowFormat.row.textColor) style.color = rowFormat.row.textColor;
    }
    const cellFormat = rowFormat.cells?.[columnId];
    if (cellFormat) {
      if (cellFormat.bgColor) style.backgroundColor = cellFormat.bgColor;
      if (cellFormat.textColor) style.color = cellFormat.textColor;
    }
    return style;
  }

  function getCellClasses(rowId: number | string, columnId: string): string {
    const rowFormat = cellFormatMap[rowId];
    if (!rowFormat) return "";
    const classes: string[] = [];
    if (rowFormat.row?.bold || rowFormat.cells?.[columnId]?.bold) classes.push("font-bold");
    if (rowFormat.row?.italic || rowFormat.cells?.[columnId]?.italic) classes.push("italic");
    return classes.join(" ");
  }

  const totalRevenue = enrichedAccounts.reduce((sum, a) => sum + a.revenueNum, 0);
  const uniqueIndustries = new Set(enrichedAccounts.filter(a => a.industry).map(a => a.industry));
  const activeCount = enrichedAccounts.filter(a => a.type === "customer").length;

  const segmentCounts = {
    all: accounts.length,
    Enterprise: accounts.filter(a => getSegment(a.annualRevenue) === "Enterprise").length,
    "Mid-Market": accounts.filter(a => getSegment(a.annualRevenue) === "Mid-Market").length,
    SMB: accounts.filter(a => getSegment(a.annualRevenue) === "SMB").length,
  };

  const groupedData = useMemo(() => {
    if (groupBy === "none") return null;
    const groups: Record<string, typeof enrichedAccounts> = {};
    for (const acc of enrichedAccounts) {
      let key: string;
      if (groupBy === "segment") key = acc.segment;
      else if (groupBy === "industry") key = acc.industry || "No Industry";
      else key = getStatusInfo(acc.type).label;
      if (!groups[key]) groups[key] = [];
      groups[key].push(acc);
    }
    return groups;
  }, [enrichedAccounts, groupBy]);

  const groupColors: Record<string, string> = {
    "Enterprise": "#8b5cf6", "Mid-Market": "#3b82f6", "SMB": "#6b7280",
    "Active": "#22c55e", "Prospect": "#f59e0b", "Partner": "#3b82f6", "Inactive": "#6b7280",
  };

  const allSelected = enrichedAccounts.length > 0 && selectedIds.size === enrichedAccounts.length;
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(enrichedAccounts.map(a => a.id)));
  };
  const toggleSelectOne = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const handleEdit = (acc: CrmAccount) => {
    setEditingId(acc.id);
    setFormData({
      name: acc.name,
      type: acc.type,
      industry: acc.industry || "",
      email: acc.email || "",
      phone: acc.phone || "",
      website: acc.website || "",
    });
    setIsOpen(true);
  };

  const exportToCSV = () => {
    const headers = ["Account", "Segment", "Industry", "Status", "Revenue", "Email", "Phone", "City", "Since"];
    const rows = enrichedAccounts.map(a => [
      a.name, a.segment, a.industry || "", getStatusInfo(a.type).label,
      a.annualRevenue || "", a.email || "", a.phone || "", a.city || "",
      new Date(a.createdAt).getFullYear().toString(),
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${(c || "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `customers-${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Customers exported to CSV" });
  };

  const renderRow = (acc: typeof enrichedAccounts[0]) => {
    const color = getColorForName(acc.name);
    const initials = getInitials(acc.name);
    const status = getStatusInfo(acc.type);
    const segColor = getSegmentColor(acc.segment);

    return (
      <tr
        key={acc.id}
        className={cn(
          "border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer",
          selectedIds.has(acc.id) && "bg-blue-50/50 dark:bg-blue-950/20"
        )}
        onClick={() => onSelectAccount(acc)}
        data-testid={`customer-row-${acc.id}`}
      >
        <td className="px-4 py-3 w-10" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selectedIds.has(acc.id)}
            onCheckedChange={() => toggleSelectOne(acc.id)}
            data-testid={`checkbox-customer-${acc.id}`}
          />
        </td>
        <td className={cn("px-4 py-3 whitespace-nowrap", getCellClasses(acc.id, "name"))} style={getCellStyle(acc.id, "name")}>
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
              style={{ backgroundColor: color }}
            >
              {initials}
            </div>
            <span className="text-sm font-semibold">{acc.name}</span>
          </div>
        </td>
        <td className={cn("px-4 py-3 whitespace-nowrap", getCellClasses(acc.id, "segment"))} style={getCellStyle(acc.id, "segment")}>
          <span className="text-sm" style={{ color: segColor }}>{acc.segment}</span>
        </td>
        <td className={cn("px-4 py-3 whitespace-nowrap", getCellClasses(acc.id, "industry"))} style={getCellStyle(acc.id, "industry")}>
          <span className="text-sm text-muted-foreground">{acc.industry || "—"}</span>
        </td>
        <td className={cn("px-4 py-3 whitespace-nowrap", getCellClasses(acc.id, "type"))} style={getCellStyle(acc.id, "type")}>
          <span
            className="text-xs font-medium px-2 py-1 rounded-full"
            style={{ backgroundColor: status.bg, color: status.color }}
          >
            {status.label}
          </span>
        </td>
        <td className={cn("px-4 py-3 whitespace-nowrap", getCellClasses(acc.id, "annualRevenue"))} style={getCellStyle(acc.id, "annualRevenue")}>
          <span className="text-sm font-semibold">{formatCurrency(acc.annualRevenue)}</span>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span className="text-sm text-muted-foreground">{acc.email || "—"}</span>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span className="text-sm text-muted-foreground">{acc.phone || "—"}</span>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span className="text-sm text-muted-foreground">{new Date(acc.createdAt).getFullYear()}</span>
        </td>
        <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`button-actions-customer-${acc.id}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEdit(acc)} data-testid={`action-edit-customer-${acc.id}`}>
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => deleteMutation.mutate(acc.id)}
                className="text-red-600 focus:text-red-600"
                data-testid={`action-delete-customer-${acc.id}`}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-4 shadow-sm" data-testid="card-total-customers">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <CustomersIcon className="h-5 w-5" />
            Total Customers
          </div>
          <div className="text-2xl font-bold" data-testid="text-total-customers">{enrichedAccounts.length}</div>
        </div>
        <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-4 shadow-sm" data-testid="card-total-revenue">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <RevenueIcon className="h-5 w-5" />
            Total Revenue
          </div>
          <div className="text-2xl font-bold text-[#22c55e]" data-testid="text-total-revenue">${totalRevenue.toLocaleString()}</div>
        </div>
        <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-4 shadow-sm" data-testid="card-industries">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <IndustryIcon className="h-5 w-5" />
            Industries
          </div>
          <div className="text-2xl font-bold text-[#8b5cf6]" data-testid="text-industries">{uniqueIndustries.size}</div>
        </div>
        <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-4 shadow-sm" data-testid="card-active-customers">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <GrowthIcon className="h-5 w-5" />
            Active Customers
          </div>
          <div className="text-2xl font-bold text-[#f97316]" data-testid="text-active-customers">{activeCount}</div>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl" data-testid="bulk-actions-customers">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">{selectedIds.size} selected</span>
          <button
            onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
            data-testid="button-bulk-delete-customers"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-background border border-border hover:bg-muted transition-colors"
            data-testid="button-clear-selection-customers"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2" data-testid="customers-toolbar">
        <Select value={segmentFilter} onValueChange={setSegmentFilter}>
          <SelectTrigger
            className={cn(
              "h-9 w-auto min-w-[140px] rounded-lg text-sm font-medium border transition-colors gap-1.5",
              segmentFilter !== "all"
                ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400"
                : "bg-background border-border text-foreground"
            )}
            data-testid="select-segment-filter"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20M2 12h20"/>
            </svg>
            <SelectValue placeholder="Segment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Segments ({segmentCounts.all})</SelectItem>
            <SelectItem value="Enterprise">Enterprise ({segmentCounts.Enterprise})</SelectItem>
            <SelectItem value="Mid-Market">Mid-Market ({segmentCounts["Mid-Market"]})</SelectItem>
            <SelectItem value="SMB">SMB ({segmentCounts.SMB})</SelectItem>
          </SelectContent>
        </Select>

        <Select value={industryFilter} onValueChange={setIndustryFilter}>
          <SelectTrigger
            className={cn(
              "h-9 w-auto min-w-[140px] rounded-lg text-sm font-medium border transition-colors gap-1.5",
              industryFilter !== "all"
                ? "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400"
                : "bg-background border-border text-foreground"
            )}
            data-testid="select-industry-filter"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            <SelectValue placeholder="Industry" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Industries</SelectItem>
            {industries.map(ind => (
              <SelectItem key={ind} value={ind}>{ind}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger
            className={cn(
              "h-9 w-auto min-w-[130px] rounded-lg text-sm font-medium border transition-colors gap-1.5",
              typeFilter !== "all"
                ? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
                : "bg-background border-border text-foreground"
            )}
            data-testid="select-type-filter"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="customer">Active</SelectItem>
            <SelectItem value="prospect">Prospect</SelectItem>
            <SelectItem value="partner">Partner</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                sortField !== "name" || sortDir !== "asc"
                  ? "bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-400"
                  : "bg-background border-border text-foreground hover:bg-muted"
              )}
              data-testid="button-sort-customers"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Sort: {sortField === "name" ? "Name" : sortField === "revenue" ? "Revenue" : sortField === "segment" ? "Segment" : sortField === "industry" ? "Industry" : "Created"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => handleSort("name")} data-testid="sort-customers-name">Name</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("revenue")} data-testid="sort-customers-revenue">Revenue</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("segment")} data-testid="sort-customers-segment">Segment</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("industry")} data-testid="sort-customers-industry">Industry</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("created")} data-testid="sort-customers-created">Created</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                groupBy !== "none"
                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400"
                  : "bg-background border-border text-foreground hover:bg-muted"
              )}
              data-testid="button-group-customers"
            >
              <Layers className="h-3.5 w-3.5" />
              Group
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setGroupBy("none")} data-testid="group-customers-none">None</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGroupBy("segment")} data-testid="group-customers-segment">Segment</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGroupBy("industry")} data-testid="group-customers-industry">Industry</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGroupBy("type")} data-testid="group-customers-type">Status</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          onClick={() => setFormatPanelOpen(true)}
          className={cn(
            "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
            formatRules.length > 0
              ? "bg-[#8b5cf6]/10 border-[#8b5cf6]/30 text-[#8b5cf6]"
              : "bg-background border-border text-foreground hover:bg-muted"
          )}
          data-testid="button-format-customers"
        >
          <Paintbrush className="h-3.5 w-3.5" />
          Format{formatRules.length > 0 ? ` (${formatRules.length})` : ""}
        </button>

        <div className="flex-1" />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search customers..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 w-[200px]"
            data-testid="input-search-customers"
          />
        </div>

        <button
          onClick={exportToCSV}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors"
          data-testid="button-export-customers"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>

        <button
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors"
          onClick={() => setImportOpen(true)}
          data-testid="button-import-customers"
        >
          <Upload className="h-3.5 w-3.5" />
          Import
        </button>
        <ImportModal
          isOpen={importOpen}
          onClose={() => setImportOpen(false)}
          entityName="Customers"
          templateHeaders={["name","type","industry","website","phone","email","address","city","state","country","postalCode","annualRevenue","employeeCount","description"]}
          exampleRow={{ name:"Acme Ltd",type:"customer",industry:"Technology",website:"https://acme.com",phone:"+44 20 7946 0958",email:"info@acme.com",address:"123 Tech Street",city:"London",state:"",country:"UK",postalCode:"EC1A 1BB",annualRevenue:"5000000",employeeCount:"250",description:"Strategic enterprise account" }}
          currentCount={accounts.length}
          onImport={async (rows, mode) => { await importMutation.mutateAsync({ rows, mode }); }}
        />

        <button
          onClick={() => toast({ title: "View saved", description: "Current filters and layout saved" })}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors"
          data-testid="button-save-view-customers"
        >
          <Bookmark className="h-3.5 w-3.5" />
          Save View
        </button>

        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) { setEditingId(null); setFormData({ name: "", type: "prospect", industry: "", email: "", phone: "", website: "" }); } }}>
          <DialogTrigger asChild>
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#0ea5e9] hover:bg-[#0ea5e9]/90 text-white transition-colors"
              data-testid="button-add-customer"
            >
              <Plus className="h-4 w-4" />
              New Customer
            </button>
          </DialogTrigger>
          <DialogContent>
            <SubmitForm
              onSubmit={() => {
                if (editingId) {
                  updateMutation.mutate({ id: editingId, updates: formData });
                  setIsOpen(false);
                } else {
                  createMutation.mutate(formData);
                }
              }}
              disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
            >
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Account" : "Create New Account"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name">Account Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  data-testid="input-customer-name"
                />
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger data-testid="select-customer-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="partner">Partner</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  value={formData.industry}
                  onChange={(e) => setFormData(prev => ({ ...prev, industry: e.target.value }))}
                  data-testid="input-customer-industry"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    data-testid="input-customer-email"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    data-testid="input-customer-phone"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-customer"
              >
                {editingId
                  ? (updateMutation.isPending ? "Updating..." : "Update Account")
                  : (createMutation.isPending ? "Creating..." : "Create Account")}
              </Button>
            </DialogFooter>
            </SubmitForm>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white dark:bg-card rounded-xl border border-border/40 shadow-sm overflow-hidden max-w-[95%]" data-testid="customers-table">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                <th className="px-4 py-3 w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    data-testid="checkbox-select-all-customers"
                  />
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => handleSort("name")}>
                  Account {sortField === "name" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => handleSort("segment")}>
                  Segment {sortField === "segment" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => handleSort("industry")}>
                  Industry {sortField === "industry" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Status</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => handleSort("revenue")}>
                  Total Revenue {sortField === "revenue" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Email</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Phone</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => handleSort("created")}>
                  Since {sortField === "created" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {enrichedAccounts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <CustomersIcon className="h-10 w-10 opacity-30" />
                      <p className="text-sm">No customers found. Create your first account to start managing relationships.</p>
                      <Button
                        size="sm"
                        className="mt-2 bg-[#0ea5e9] hover:bg-[#0ea5e9]/90"
                        onClick={() => setIsOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        New Customer
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : groupedData ? (
                Object.entries(groupedData).flatMap(([groupName, groupAccs]) => [
                  <tr key={`group-header-${groupName}`} className="bg-muted/40 border-b border-border/40" data-testid={`group-customers-header-${groupName}`}>
                    <td colSpan={10} className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: groupColors[groupName] || "#6b7280" }}
                        />
                        <span className="text-sm font-semibold">{groupName}</span>
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                          {groupAccs.length}
                        </Badge>
                        <span className="text-xs text-muted-foreground ml-2">
                          ${groupAccs.reduce((s, a) => s + a.revenueNum, 0).toLocaleString()}
                        </span>
                      </div>
                    </td>
                  </tr>,
                  ...groupAccs.map(renderRow)
                ])
              ) : (
                enrichedAccounts.map(renderRow)
              )}
            </tbody>
          </table>
        </div>
        {enrichedAccounts.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20 text-xs text-muted-foreground" data-testid="customers-count-footer">
            {enrichedAccounts.length} of {accounts.length} customers
            {selectedIds.size > 0 && <span className="ml-2 text-[#0ea5e9]">({selectedIds.size} selected)</span>}
          </div>
        )}
      </div>

      <ConditionalFormattingPanel
        open={formatPanelOpen}
        onOpenChange={setFormatPanelOpen}
        rules={formatRules}
        onRulesChange={setFormatRules}
        columns={formatColumns}
        data={enrichedAccounts as any[]}
      />
    </div>
  );
}
