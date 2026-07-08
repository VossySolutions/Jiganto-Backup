import { useState, useMemo } from "react";
import { useCrmPagination } from "@/hooks/use-crm-pagination";
import { CrmTablePagination } from "./CrmTablePagination";
import { SavedViewsDropdown, type FilterConfig, type SortConfig } from "./SavedViewsDropdown";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FormDialogShell } from "@/components/ui/form-dialog-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Plus, Download, Upload, Search, ArrowUpDown, Layers,
  ChevronDown, X, Trash2, Paintbrush, Bookmark, MoreHorizontal, Pencil, MapPin, Globe
} from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { Textarea } from "@/components/ui/textarea";
import { CrmCustomFieldsForm } from "./CrmCustomFieldsForm";
import { CrmCustomFieldTableHeaders, CrmCustomFieldTableCells } from "./CrmCustomFieldTableCells";
import { useCrmCustomFields } from "@/hooks/use-crm-custom-fields";
import { ImportModal, type ImportMode } from "@/components/ImportModal";
import { ConditionalFormattingPanel } from "@/components/ConditionalFormattingPanel";
import { evaluateConditionalFormatting, type ConditionalFormatRule } from "@/lib/conditionalFormatting";
import type { ColumnDef as MondayColumnDef } from "@/components/MondayTable";
import { resolveAccountGeo, normalizeCountryLabel } from "@/lib/crm-geo";
import { accountTypeFilterOptions, getAccountTypeInfo, CRM_ACCOUNT_TYPES } from "@/lib/crm-account-types";
import {
  findSegmentField,
  getSegmentColor,
  getSegmentPinColor,
  resolveAccountSegment,
  segmentFilterOptions,
} from "@/lib/crm-segment";
import { CrmGeoMap } from "./CrmGeoMap";
import { CrmOwnerSelect } from "./CrmOwnerSelect";
import { useCrmUsers } from "./CrmUsersProvider";
import type { CrmAccountDetail, CrmOpportunitySummary, CrmContractSummary, CrmOpportunityStage } from "./types";
import { CrmColumnVisibilityMenu } from "./CrmColumnVisibilityMenu";
import { CrmInlineEditCell } from "./CrmInlineEditCell";
import { CrmInlineEditSelect } from "./CrmInlineEditSelect";
import { loadColumnVisibility, saveColumnVisibility, type CrmColumnDef } from "@/lib/crm-list-columns";

const CUSTOMER_TABLE_COLUMNS: CrmColumnDef[] = [
  { id: "segment", label: "Segment" },
  { id: "industry", label: "Industry" },
  { id: "status", label: "Status" },
  { id: "revenue", label: "Annual Revenue" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "created", label: "Created" },
];

interface CrmCustomersTabProps {
  accounts: CrmAccountDetail[];
  opportunities?: CrmOpportunitySummary[];
  contracts?: CrmContractSummary[];
  stages?: CrmOpportunityStage[];
  searchTerm: string;
  onSelectAccount: (account: CrmAccountDetail) => void;
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

function formatCurrency(val: string | null): string {
  const num = parseFloat(val || "0");
  if (num === 0) return "—";
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${Math.round(num / 1000)}K`;
  return `$${num.toLocaleString()}`;
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

export function CrmCustomersTab({ accounts, opportunities = [], contracts = [], stages = [], searchTerm, onSelectAccount }: CrmCustomersTabProps) {
  const { fields: customFields } = useCrmCustomFields("account");
  const segmentField = useMemo(() => findSegmentField(customFields), [customFields]);
  const tableColSpan = 10 + customFields.length;
  const openStageIds = useMemo(() => new Set(stages.filter(s => !s.isClosed).map(s => s.id)), [stages]);

  const accountStats = useMemo(() => {
    const map = new Map<number, { openOpps: number; activeContracts: number }>();
    for (const o of opportunities) {
      if (!o.accountId || !o.stageId || !openStageIds.has(o.stageId)) continue;
      const cur = map.get(o.accountId) || { openOpps: 0, activeContracts: 0 };
      cur.openOpps++;
      map.set(o.accountId, cur);
    }
    for (const c of contracts) {
      if (!c.accountId) continue;
      const status = c.status === "draft" ? "draft" : (c.endDate && new Date(c.endDate) < new Date() ? "expired" : c.status);
      if (status !== "active" && status !== "sent") continue;
      const cur = map.get(c.accountId) || { openOpps: 0, activeContracts: 0 };
      cur.activeContracts++;
      map.set(c.accountId, cur);
    }
    return map;
  }, [opportunities, contracts, openStageIds]);
  const [isOpen, setIsOpen] = useState(false);
  const [segmentFilter, setSegmentFilter] = useState<string>("all");
  /** `all` | `account:{type}` | `stage:{stageId}` */
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [localSearch, setLocalSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "revenue" | "segment" | "industry" | "created">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [groupBy, setGroupBy] = useState<"none" | "segment" | "industry" | "type">("none");
  const [formatPanelOpen, setFormatPanelOpen] = useState(false);
  const [formatRules, setFormatRules] = useState<ConditionalFormatRule[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "card" | "map">(() => {
    const saved = sessionStorage.getItem("crm-customers-view");
    if (saved === "map" || saved === "card" || saved === "table") {
      sessionStorage.removeItem("crm-customers-view");
      return saved;
    }
    return "table";
  });
  const EMPTY_CUSTOMER_FORM = { name: "", type: "prospect", industry: "", email: "", phone: "", website: "", address: "", city: "", state: "", country: "", postalCode: "", employeeCount: "", annualRevenue: "", description: "", parentAccountId: "", ownerUserId: "" };
  const { resolveOwner } = useCrmUsers();
  const [formData, setFormData] = useState(EMPTY_CUSTOMER_FORM);
  const [customData, setCustomData] = useState<Record<string, unknown>>({});
  const [importOpen, setImportOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() =>
    loadColumnVisibility("crm-customers", CUSTOMER_TABLE_COLUMNS),
  );
  const { toast } = useToast();

  const isColVisible = (id: string) => columnVisibility[id] !== false;
  const setColVisible = (id: string, visible: boolean) => {
    setColumnVisibility((prev) => {
      const next = { ...prev, [id]: visible };
      saveColumnVisibility("crm-customers", next);
      return next;
    });
  };

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
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/crm/accounts", {
      ...data,
      employeeCount: data.employeeCount ? parseInt(data.employeeCount) : null,
      parentAccountId: data.parentAccountId ? parseInt(data.parentAccountId) : null,
      customData,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/accounts"] });
      setIsOpen(false);
      setFormData(EMPTY_CUSTOMER_FORM);
      setCustomData({});
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
      segment: resolveAccountSegment(a, segmentField),
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
    if (statusFilter !== "all") {
      if (statusFilter.startsWith("account:")) {
        const accountType = statusFilter.slice(8);
        result = result.filter((a) => a.type === accountType);
      } else if (statusFilter.startsWith("stage:")) {
        const stageId = parseInt(statusFilter.slice(6), 10);
        const accountIds = new Set(
          opportunities
            .filter((o) => o.accountId && o.stageId === stageId)
            .map((o) => o.accountId!),
        );
        result = result.filter((a) => accountIds.has(a.id));
      }
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
  }, [accounts, opportunities, localSearch, searchTerm, segmentFilter, statusFilter, industryFilter, sortField, sortDir, segmentField]);

  const pagination = useCrmPagination(enrichedAccounts, {
    resetKey: `${localSearch}|${searchTerm}|${segmentFilter}|${statusFilter}|${industryFilter}|${sortField}|${sortDir}|${groupBy}|${viewMode}`,
    enabled: viewMode !== "map" && groupBy === "none",
  });

  const currentFilters = useMemo((): FilterConfig[] => {
    const filters: FilterConfig[] = [];
    if (segmentFilter !== "all") filters.push({ columnId: "segment", operator: "equals", value: segmentFilter });
    if (statusFilter !== "all") filters.push({ columnId: "status", operator: "equals", value: statusFilter });
    if (industryFilter !== "all") filters.push({ columnId: "industry", operator: "equals", value: industryFilter });
    return filters;
  }, [segmentFilter, statusFilter, industryFilter]);

  const currentSorts = useMemo((): SortConfig[] => (
    [{ columnId: sortField, direction: sortDir }]
  ), [sortField, sortDir]);

  const applySavedView = (filters: FilterConfig[], sorts?: SortConfig[]) => {
    setSegmentFilter("all");
    setStatusFilter("all");
    setIndustryFilter("all");
    for (const f of filters) {
      if (f.columnId === "segment") setSegmentFilter(f.value);
      if (f.columnId === "type") setStatusFilter(`account:${f.value}`);
      if (f.columnId === "status") setStatusFilter(f.value);
      if (f.columnId === "industry") setIndustryFilter(f.value);
    }
    if (sorts?.[0]) {
      setSortField(sorts[0].columnId as typeof sortField);
      setSortDir(sorts[0].direction);
    }
  };

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

  const accountTypeOptions = useMemo(
    () => accountTypeFilterOptions(accounts.map((a) => a.type)),
    [accounts],
  );

  const segmentOptions = useMemo(() => {
    const values = accounts.map((a) => resolveAccountSegment(a, segmentField));
    return segmentFilterOptions(segmentField, values);
  }, [accounts, segmentField]);

  const segmentCounts = useMemo(() => {
    const counts: Record<string, number> = { all: accounts.length };
    for (const seg of segmentOptions) {
      counts[seg] = accounts.filter((a) => resolveAccountSegment(a, segmentField) === seg).length;
    }
    return counts;
  }, [accounts, segmentField, segmentOptions]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: accounts.length };
    for (const t of accountTypeOptions) {
      counts[t.value] = accounts.filter((a) => a.type === t.value).length;
    }
    return counts;
  }, [accounts, accountTypeOptions]);

  const openStageOptions = useMemo(() => {
    const seen = new Set<number>();
    const list: Array<{ id: number; name: string }> = [];
    for (const stage of stages.filter((s) => !s.isClosed)) {
      if (seen.has(stage.id)) continue;
      seen.add(stage.id);
      list.push({ id: stage.id, name: stage.name });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [stages]);

  const stageCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const o of opportunities) {
      if (!o.accountId || !o.stageId) continue;
      counts[o.stageId] = (counts[o.stageId] ?? 0) + 1;
    }
    return counts;
  }, [opportunities]);

  const statusFilterLabel = useMemo(() => {
    if (statusFilter === "all") return "Status";
    if (statusFilter.startsWith("account:")) {
      return getAccountTypeInfo(statusFilter.slice(8)).label;
    }
    if (statusFilter.startsWith("stage:")) {
      const stageId = parseInt(statusFilter.slice(6), 10);
      return openStageOptions.find((s) => s.id === stageId)?.name ?? "Deal stage";
    }
    return "Status";
  }, [statusFilter, openStageOptions]);

  const groupedData = useMemo(() => {
    if (groupBy === "none") return null;
    const groups: Record<string, typeof enrichedAccounts> = {};
    for (const acc of enrichedAccounts) {
      let key: string;
      if (groupBy === "segment") key = acc.segment;
      else if (groupBy === "industry") key = acc.industry || "No Industry";
      else key = getAccountTypeInfo(acc.type).label;
      if (!groups[key]) groups[key] = [];
      groups[key].push(acc);
    }
    return groups;
  }, [enrichedAccounts, groupBy]);

  const groupColors: Record<string, string> = {
    "Enterprise": "#8b5cf6", "Mid-Market": "#3b82f6", "SMB": "#6b7280",
    ...Object.fromEntries(CRM_ACCOUNT_TYPES.map((t) => [t.label, t.color])),
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

  const handleEdit = (acc: CrmAccountDetail) => {
    setEditingId(acc.id);
    setFormData({
      name: acc.name,
      type: acc.type,
      industry: acc.industry || "",
      email: acc.email || "",
      phone: acc.phone || "",
      website: acc.website || "",
      address: acc.address || "",
      city: acc.city || "",
      state: acc.state || "",
      country: acc.country || "",
      ownerUserId: acc.ownerUserId || "",
      postalCode: acc.postalCode || "",
      employeeCount: acc.employeeCount != null ? String(acc.employeeCount) : "",
      annualRevenue: acc.annualRevenue || "",
      description: acc.description || "",
      parentAccountId: acc.parentAccountId != null ? String(acc.parentAccountId) : "",
    });
    setIsOpen(true);
  };

  const exportToCSV = () => {
    const headers = ["Account", "Segment", "Industry", "Status", "Revenue", "Email", "Phone", "City", "Since"];
    const rows = enrichedAccounts.map(a => [
      a.name, a.segment, a.industry || "", getAccountTypeInfo(a.type).label,
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
    const status = getAccountTypeInfo(acc.type);
    const segColor = getSegmentColor(acc.segment);

    return (
      <tr
        key={acc.id}
        className={cn(
          "border-b border-border/40 hover:bg-muted/30 transition-colors cursor-pointer",
          selectedIds.has(acc.id) && "bg-blue-50/50 dark:bg-blue-950/20"
        )}
        onClick={() => onSelectAccount(acc)}
        data-testid={`customer-row-${acc.id}`}
      >
        <td className="px-3 py-2.5 align-middle w-10" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selectedIds.has(acc.id)}
            onCheckedChange={() => toggleSelectOne(acc.id)}
            data-testid={`checkbox-customer-${acc.id}`}
          />
        </td>
        <td className={cn("px-3 py-2.5 align-middle whitespace-nowrap", getCellClasses(acc.id, "name"))} style={getCellStyle(acc.id, "name")} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
              style={{ backgroundColor: color }}
            >
              {initials}
            </div>
            <CrmInlineEditCell
              value={acc.name}
              onSave={(v) => updateMutation.mutate({ id: acc.id, updates: { name: v } })}
              className="text-sm font-semibold"
              testId={`inline-customer-name-${acc.id}`}
            />
          </div>
        </td>
        {isColVisible("segment") && (
        <td className={cn("px-3 py-2.5 align-middle whitespace-nowrap", getCellClasses(acc.id, "segment"))} style={getCellStyle(acc.id, "segment")}>
          <span className="text-sm" style={{ color: segColor }}>{acc.segment}</span>
        </td>
        )}
        {isColVisible("industry") && (
        <td className={cn("px-3 py-2.5 align-middle whitespace-nowrap", getCellClasses(acc.id, "industry"))} style={getCellStyle(acc.id, "industry")} onClick={(e) => e.stopPropagation()}>
          <CrmInlineEditCell
            value={acc.industry || ""}
            displayValue={acc.industry || "—"}
            onSave={(v) => updateMutation.mutate({ id: acc.id, updates: { industry: v || null } })}
            className="text-sm text-muted-foreground"
            testId={`inline-customer-industry-${acc.id}`}
          />
        </td>
        )}
        {isColVisible("status") && (
        <td className={cn("px-3 py-2.5 align-middle whitespace-nowrap", getCellClasses(acc.id, "type"))} style={getCellStyle(acc.id, "type")} onClick={(e) => e.stopPropagation()}>
          <CrmInlineEditSelect
            value={acc.type || "prospect"}
            displayValue={
              <span
                className="text-xs font-medium px-2 py-1 rounded-full"
                style={{ backgroundColor: status.bg, color: status.color }}
              >
                {status.label}
              </span>
            }
            options={CRM_ACCOUNT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            onSave={(v) => updateMutation.mutate({ id: acc.id, updates: { type: v } })}
            testId={`inline-customer-status-${acc.id}`}
          />
        </td>
        )}
        {isColVisible("revenue") && (
        <td className={cn("px-3 py-2.5 align-middle whitespace-nowrap", getCellClasses(acc.id, "annualRevenue"))} style={getCellStyle(acc.id, "annualRevenue")} onClick={(e) => e.stopPropagation()}>
          <CrmInlineEditCell
            value={acc.annualRevenue || ""}
            displayValue={formatCurrency(acc.annualRevenue)}
            type="number"
            onSave={(v) => updateMutation.mutate({ id: acc.id, updates: { annualRevenue: v || null } })}
            className="text-sm font-semibold"
            testId={`inline-customer-revenue-${acc.id}`}
          />
        </td>
        )}
        {isColVisible("email") && (
        <td className="px-3 py-2.5 align-middle whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <CrmInlineEditCell
            value={acc.email || ""}
            displayValue={acc.email || "—"}
            onSave={(v) => updateMutation.mutate({ id: acc.id, updates: { email: v || null } })}
            className="text-sm text-muted-foreground"
            testId={`inline-customer-email-${acc.id}`}
          />
        </td>
        )}
        {isColVisible("phone") && (
        <td className="px-3 py-2.5 align-middle whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <CrmInlineEditCell
            value={acc.phone || ""}
            displayValue={acc.phone || "—"}
            onSave={(v) => updateMutation.mutate({ id: acc.id, updates: { phone: v || null } })}
            className="text-sm text-muted-foreground"
            testId={`inline-customer-phone-${acc.id}`}
          />
        </td>
        )}
        {isColVisible("created") && (
        <td className="px-3 py-2.5 align-middle whitespace-nowrap">
          <span className="text-sm text-muted-foreground">{new Date(acc.createdAt).getFullYear()}</span>
        </td>
        )}
        <CrmCustomFieldTableCells fields={customFields} customData={acc.customData} />
        <td className="px-3 py-2.5 align-middle text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
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
                className="text-red-600 focus:text-red-700"
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard title="Total Accounts" value={enrichedAccounts.length} subtitle="Matching filters" helpText="Customer and prospect accounts shown after filters are applied." icon={CustomersIcon} testId="card-total-customers" />
        <MetricCard title="Annual Revenue (Accounts)" value={`$${totalRevenue.toLocaleString()}`} subtitle="Sum of ARR fields" helpText="Combined annual revenue values stored on account records — not closed-won deal revenue." icon={RevenueIcon} borderColor="#22c55e" valueClassName="text-[#22c55e]" testId="card-total-revenue" />
        <MetricCard title="Industries" value={uniqueIndustries.size} subtitle="Distinct sectors" helpText="Number of unique industry values across filtered accounts." icon={IndustryIcon} borderColor="#8b5cf6" valueClassName="text-[#8b5cf6]" testId="card-industries" />
        <MetricCard title="Customer Accounts" value={activeCount} subtitle='Type = "customer"' helpText='Accounts with type set to customer (not prospect or partner).' icon={GrowthIcon} borderColor="#f97316" valueClassName="text-[#f97316]" testId="card-active-customers" />
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl" data-testid="bulk-actions-customers">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">{selectedIds.size} selected</span>
          <button
            onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/60 transition-colors"
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
            <SelectValue placeholder="Segment">
              {segmentFilter === "all" ? `Segment (${segmentCounts.all})` : segmentFilter}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All segments ({segmentCounts.all})</SelectItem>
            {segmentOptions.map((seg) => (
              <SelectItem key={seg} value={seg}>{seg} ({segmentCounts[seg] ?? 0})</SelectItem>
            ))}
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

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            className={cn(
              "h-9 w-auto min-w-[130px] rounded-lg text-sm font-medium border transition-colors gap-1.5",
              statusFilter !== "all"
                ? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
                : "bg-background border-border text-foreground"
            )}
            data-testid="select-type-filter"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            <SelectValue placeholder="Status">{statusFilterLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[min(24rem,70vh)]">
            <SelectItem value="all">All accounts ({typeCounts.all})</SelectItem>
            {accountTypeOptions.map((t) => (
              <SelectItem key={`account-${t.value}`} value={`account:${t.value}`}>
                {t.label} ({typeCounts[t.value] ?? 0})
              </SelectItem>
            ))}
            {openStageOptions.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-t mt-1 pt-2">
                  Deal stage
                </div>
                {openStageOptions.map((stage) => (
                  <SelectItem key={`stage-${stage.id}`} value={`stage:${stage.id}`}>
                    {stage.name} ({stageCounts[stage.id] ?? 0})
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>

        <CrmColumnVisibilityMenu
          columns={CUSTOMER_TABLE_COLUMNS}
          visibility={columnVisibility}
          onChange={setColVisible}
          testId="button-customer-fields"
        />

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
                "inline-flex items-center justify-center h-9 w-9 rounded-lg border transition-colors",
                groupBy !== "none"
                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400"
                  : "bg-background border-border text-foreground hover:bg-muted"
              )}
              title={groupBy === "none" ? "Group" : `Grouped by ${groupBy}`}
              aria-label={groupBy === "none" ? "Group customers" : `Grouped by ${groupBy}`}
              data-testid="button-group-customers"
            >
              <Layers className="h-4 w-4" />
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

        <SavedViewsDropdown
          entityType="accounts"
          currentFilters={currentFilters}
          currentSorts={currentSorts}
          onApplyView={applySavedView}
        />

        <div className="flex border rounded-lg overflow-hidden">
          <button onClick={() => setViewMode("table")} className={cn("px-3 py-2 text-xs font-medium", viewMode === "table" ? "bg-[#0ea5e9] text-white" : "bg-background")} data-testid="view-table">Table</button>
          <button onClick={() => setViewMode("card")} className={cn("px-3 py-2 text-xs font-medium border-l", viewMode === "card" ? "bg-[#0ea5e9] text-white" : "bg-background")} data-testid="view-card">Cards</button>
          <button onClick={() => setViewMode("map")} className={cn("px-3 py-2 text-xs font-medium border-l", viewMode === "map" ? "bg-[#0ea5e9] text-white" : "bg-background")} data-testid="view-map">Map</button>
        </div>

        {enrichedAccounts.length > 0 && (
        <button
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#0ea5e9] hover:bg-[#0ea5e9]/90 text-white transition-colors"
          data-testid="button-add-customer"
          onClick={() => setIsOpen(true)}
        >
          <Plus className="h-4 w-4" />
          New Customer
        </button>
        )}
          <FormDialogShell
            open={isOpen}
            onOpenChange={(open) => { setIsOpen(open); if (!open) { setEditingId(null); setFormData(EMPTY_CUSTOMER_FORM); setCustomData({}); } }}
            title={editingId ? "Edit Account" : "Create New Account"}
            subtitle="Manage customer account details"
            saveLabel={
              editingId
                ? (updateMutation.isPending ? "Updating..." : "Update Account")
                : (createMutation.isPending ? "Creating..." : "Create Account")
            }
            onCancel={() => { setIsOpen(false); setEditingId(null); setFormData(EMPTY_CUSTOMER_FORM); setCustomData({}); }}
            onSubmit={() => {
              const payload = {
                ...formData,
                employeeCount: formData.employeeCount ? parseInt(formData.employeeCount) : null,
                parentAccountId: formData.parentAccountId ? parseInt(formData.parentAccountId) : null,
                customData,
              };
              if (editingId) {
                updateMutation.mutate({ id: editingId, updates: payload });
                setIsOpen(false);
              } else {
                createMutation.mutate(formData);
              }
            }}
            saving={createMutation.isPending || updateMutation.isPending}
            disabled={!formData.name}
            saveTestId="button-save-customer"
            size="lg"
          >
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
                    {CRM_ACCOUNT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
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
                  <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} data-testid="input-customer-email" />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={formData.phone} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} data-testid="input-customer-phone" />
                </div>
              </div>
              <div>
                <Label htmlFor="website">Website</Label>
                <Input id="website" value={formData.website} onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))} data-testid="input-customer-website" />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input id="address" value={formData.address} onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))} data-testid="input-customer-address" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={formData.city} onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))} data-testid="input-customer-city" />
                </div>
                <div>
                  <Label htmlFor="state">State / Region</Label>
                  <Input id="state" value={formData.state} onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))} data-testid="input-customer-state" />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" value={formData.country} onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))} data-testid="input-customer-country" />
                </div>
                <div>
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input id="postalCode" value={formData.postalCode} onChange={(e) => setFormData(prev => ({ ...prev, postalCode: e.target.value }))} data-testid="input-customer-postal" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="employeeCount">Employees</Label>
                  <Input id="employeeCount" type="number" value={formData.employeeCount} onChange={(e) => setFormData(prev => ({ ...prev, employeeCount: e.target.value }))} data-testid="input-customer-employees" />
                </div>
                <div>
                  <Label htmlFor="annualRevenue">Annual Revenue</Label>
                  <Input id="annualRevenue" type="number" value={formData.annualRevenue} onChange={(e) => setFormData(prev => ({ ...prev, annualRevenue: e.target.value }))} data-testid="input-customer-revenue" />
                </div>
              </div>
              <div>
                <Label htmlFor="parentAccountId">Parent Account</Label>
                <Select value={formData.parentAccountId || "none"} onValueChange={(v) => setFormData(prev => ({ ...prev, parentAccountId: v === "none" ? "" : v }))}>
                  <SelectTrigger data-testid="select-parent-account"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {accounts.filter(a => a.id !== editingId).map(a => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <CrmOwnerSelect
                value={formData.ownerUserId}
                onChange={(v) => setFormData(prev => ({ ...prev, ownerUserId: v }))}
                testId="select-customer-owner"
              />
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} rows={2} data-testid="input-customer-description" />
              </div>
              <CrmCustomFieldsForm entityType="account" values={customData} onChange={(k, v) => setCustomData(prev => ({ ...prev, [k]: v }))} />
            </div>
          </FormDialogShell>
      </div>

      {viewMode === "map" && (() => {
        const mapAccounts = enrichedAccounts.filter(a => a.country || a.city);
        const geoResolvedCount = mapAccounts.filter((a, i) =>
          resolveAccountGeo(a.country, a.city, a.state, a.name, i).resolved
        ).length;
        const mapPins = mapAccounts.map((a) => ({
          id: a.id,
          name: a.name,
          country: a.country,
          city: a.city,
          state: a.state,
          segment: a.segment,
          color: getSegmentPinColor(a.segment),
        }));
        return (
        <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-4 sm:p-6 shadow-sm" data-testid="customers-map-view">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-[#0ea5e9]" />
              <h3 className="text-sm font-semibold">Customer Geography</h3>
            </div>
            <span className="text-xs text-muted-foreground">
              {mapAccounts.length} accounts · {geoResolvedCount} geocoded from country/city data
            </span>
          </div>
          <CrmGeoMap
            pins={mapPins}
            onPinClick={(pin) => {
              const account = enrichedAccounts.find((a) => a.id === pin.id);
              if (account) onSelectAccount(account);
            }}
          />
          <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
            {segmentOptions.map((seg) => (
              <span key={seg} className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getSegmentPinColor(seg) }} />
                {seg}
              </span>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
            {(() => {
              const countryCounts = new Map<string, number>();
              for (const pin of mapPins) {
                const label = normalizeCountryLabel(pin.country) ?? "Unknown";
                countryCounts.set(label, (countryCounts.get(label) ?? 0) + 1);
              }
              return Array.from(countryCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([country, count]) => (
                  <div key={country} className="text-xs px-3 py-2 rounded-lg bg-muted/50 flex items-center gap-2">
                    <MapPin className="h-3 w-3 text-[#0ea5e9]" />
                    <span className="font-medium truncate">{country}</span>
                    <span className="text-muted-foreground ml-auto shrink-0">{count}</span>
                  </div>
                ));
            })()}
          </div>
        </div>
        );
      })()}

      {viewMode === "card" && (
        <div data-testid="customers-card-view">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pagination.paginatedItems.map(a => (
            <div key={a.id} className="border rounded-xl p-4 bg-card shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => onSelectAccount?.(a)} data-testid={`customer-card-${a.id}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: getColorForName(a.name) }}>{getInitials(a.name)}</div>
                <div><div className="font-semibold text-sm">{a.name}</div><div className="text-xs text-muted-foreground">{a.industry || "—"}</div></div>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="capitalize">{a.type}</span>
                <span>{accountStats.get(a.id)?.openOpps ?? 0} open opps</span>
                <span>{accountStats.get(a.id)?.activeContracts ?? 0} contracts</span>
              </div>
            </div>
          ))}
        </div>
        <CrmTablePagination
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
      )}

      {viewMode === "table" && <div className="bg-white dark:bg-card rounded-xl border border-border/40 shadow-sm overflow-hidden w-full" data-testid="customers-table">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-700 dark:text-foreground">
            <thead>
              <tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground border-b border-border/60">
                <th className="px-3 py-2.5 align-middle w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    data-testid="checkbox-select-all-customers"
                  />
                </th>
                <th className="px-3 py-2.5 text-left align-middle font-semibold whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => handleSort("name")}>
                  Account {sortField === "name" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                {isColVisible("segment") && (
                <th className="px-3 py-2.5 text-left align-middle font-semibold whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => handleSort("segment")}>
                  Segment {sortField === "segment" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                )}
                {isColVisible("industry") && (
                <th className="px-3 py-2.5 text-left align-middle font-semibold whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => handleSort("industry")}>
                  Industry {sortField === "industry" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                )}
                {isColVisible("status") && <th className="px-3 py-2.5 text-left align-middle font-semibold whitespace-nowrap">Status</th>}
                {isColVisible("revenue") && (
                <th className="px-3 py-2.5 text-left align-middle font-semibold whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => handleSort("revenue")}>
                  Annual Revenue (ARR) {sortField === "revenue" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                )}
                {isColVisible("email") && <th className="px-3 py-2.5 text-left align-middle font-semibold whitespace-nowrap">Email</th>}
                {isColVisible("phone") && <th className="px-3 py-2.5 text-left align-middle font-semibold whitespace-nowrap">Phone</th>}
                {isColVisible("created") && (
                <th className="px-3 py-2.5 text-left align-middle font-semibold whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => handleSort("created")}>
                  Since {sortField === "created" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                )}
                <th className="px-3 py-2.5 text-right align-middle font-semibold whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {enrichedAccounts.length === 0 ? (
                <tr>
                  <td colSpan={tableColSpan} className="text-center py-16 text-muted-foreground">
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
                    <td colSpan={tableColSpan} className="px-4 py-2">
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
                pagination.paginatedItems.map(renderRow)
              )}
            </tbody>
          </table>
        </div>
        {groupBy !== "none" && enrichedAccounts.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20 text-xs text-muted-foreground" data-testid="customers-count-footer">
            {enrichedAccounts.length} of {accounts.length} customers
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
      </div>}

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
