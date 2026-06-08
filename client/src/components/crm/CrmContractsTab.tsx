import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
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
  ChevronDown, X, Trash2, Paintbrush, Bookmark, MoreHorizontal, Pencil,
  FileSignature, Clock, CheckCircle2, XCircle, Eye
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

type CrmContract = {
  id: number;
  tenantId: number;
  accountId: number | null;
  opportunityId: number | null;
  projectId: number | null;
  name: string;
  type: string | null;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  value: string | null;
  recurringValue: string | null;
  terms: string | null;
  signedDate: string | null;
  signedByContactId: number | null;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

interface CrmContractsTabProps {
  contracts: CrmContract[];
  accounts: CrmAccount[];
  searchTerm: string;
}

const VIBRANT_LOGO_COLORS = [
  "#3b82f6", "#22c55e", "#f97316", "#8b5cf6",
  "#ec4899", "#06b6d4", "#eab308", "#ef4444",
  "#14b8a6", "#6366f1",
];

const OWNER_NAMES = [
  "Alex Morgan", "Jordan Lee", "Sam Taylor", "Chris Rivera",
  "Pat Quinn", "Drew Blake", "Jamie West", "Morgan Chen"
];

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return VIBRANT_LOGO_COLORS[Math.abs(hash) % VIBRANT_LOGO_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

function getDaysUntilExpiry(endDate: string | null): number | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getContractStatus(status: string | null, endDate: string | null): string {
  if (status === "draft") return "draft";
  const days = getDaysUntilExpiry(endDate);
  if (days !== null && days < 0) return "expired";
  if (days !== null && days < 90) return "expiring_soon";
  if (status === "active") return "active";
  return status || "draft";
}

function getStatusInfo(status: string): { label: string; color: string; bg: string; dot: string } {
  switch (status) {
    case "active": return { label: "Active", color: "#22c55e", bg: "rgba(34,197,94,0.1)", dot: "#22c55e" };
    case "expiring_soon": return { label: "Expiring", color: "#f97316", bg: "rgba(249,115,22,0.1)", dot: "#f97316" };
    case "expired": return { label: "Expired", color: "#ef4444", bg: "rgba(239,68,68,0.1)", dot: "#ef4444" };
    case "draft": return { label: "Draft", color: "#6b7280", bg: "rgba(107,114,128,0.1)", dot: "#6b7280" };
    default: return { label: status, color: "#6b7280", bg: "rgba(107,114,128,0.1)", dot: "#6b7280" };
  }
}

function formatValue(val: string | null, recurring: string | null): string {
  const num = parseFloat(val || "0");
  if (num === 0 && !recurring) return "—";
  if (recurring) {
    const rNum = parseFloat(recurring);
    if (rNum >= 1000) return `£${Math.round(rNum / 1000)}K/yr`;
    return `£${rNum.toLocaleString()}/yr`;
  }
  if (num >= 1000000) return `£${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `£${Math.round(num / 1000)}K`;
  return `£${num.toLocaleString()}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getOwnerForContract(contract: CrmContract): { name: string; color: string; initials: string } {
  let hash = 0;
  for (let i = 0; i < contract.name.length; i++) hash = contract.name.charCodeAt(i) + ((hash << 5) - hash);
  const idx = Math.abs(hash) % OWNER_NAMES.length;
  const name = OWNER_NAMES[idx];
  return { name, color: getColorForName(name), initials: getInitials(name) };
}

function ContractIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="2" width="16" height="20" rx="2" fill="#3b82f6" opacity="0.15"/>
      <path d="M8 7h8M8 11h8M8 15h4" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="17" cy="17" r="4" fill="#22c55e" opacity="0.8"/>
      <path d="M15.5 17l1 1 2-2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ValueIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#22c55e" opacity="0.15"/>
      <circle cx="12" cy="12" r="7" fill="#22c55e" opacity="0.3"/>
      <text x="12" y="16" textAnchor="middle" fill="#22c55e" fontSize="11" fontWeight="bold">£</text>
    </svg>
  );
}

function ExpiringIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#f97316" opacity="0.15"/>
      <circle cx="12" cy="13" r="7" fill="none" stroke="#f97316" strokeWidth="1.5"/>
      <path d="M12 9v4l2.5 1.5" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function RenewalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#8b5cf6" opacity="0.15"/>
      <path d="M17 12a5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5" stroke="#8b5cf6" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M17 8v4h-4" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

export function CrmContractsTab({ contracts, accounts, searchTerm }: CrmContractsTabProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [localSearch, setLocalSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "value" | "startDate" | "endDate" | "status">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [groupBy, setGroupBy] = useState<"none" | "status" | "type" | "account">("none");
  const [formatPanelOpen, setFormatPanelOpen] = useState(false);
  const [formatRules, setFormatRules] = useState<ConditionalFormatRule[]>([]);
  const [formData, setFormData] = useState({
    name: "", accountId: "", type: "service", status: "draft",
    startDate: "", endDate: "", value: "",
  });
  const [importOpen, setImportOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: allSignoffRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/signoff"],
  });

  const importMutation = useMutation({
    mutationFn: ({ rows, mode }: { rows: Record<string, string>[]; mode: ImportMode }) =>
      apiRequest("POST", "/api/crm/contracts/bulk-import", { rows, mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contracts"] });
      toast({ title: "Contracts imported successfully" });
    },
    onError: () => toast({ title: "Import failed", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiRequest("POST", "/api/crm/contracts", {
        ...data,
        accountId: data.accountId ? parseInt(data.accountId) : null,
        value: data.value || null,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contracts"] });
      setIsOpen(false);
      setFormData({ name: "", accountId: "", type: "service", status: "draft", startDate: "", endDate: "", value: "" });
      toast({ title: "Contract created successfully" });
    },
    onError: () => toast({ title: "Failed to create contract", variant: "destructive" }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => apiRequest("POST", "/api/crm/contracts/bulk-delete", { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contracts"] });
      setSelectedIds(new Set());
      toast({ title: "Contracts deleted successfully" });
    },
    onError: () => toast({ title: "Failed to delete contracts", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Record<string, unknown> }) =>
      apiRequest("PUT", `/api/crm/contracts/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contracts"] });
      toast({ title: "Contract updated" });
    },
    onError: () => toast({ title: "Failed to update contract", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/crm/contracts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contracts"] });
      toast({ title: "Contract deleted" });
    },
    onError: () => toast({ title: "Failed to delete contract", variant: "destructive" }),
  });

  function getContractSignoffStatus(contractId: number) {
    const reqs = allSignoffRequests.filter((r: any) => r.crmContractId === contractId);
    if (reqs.length === 0) return null;
    const latest = reqs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    return latest;
  }

  const enrichedContracts = useMemo(() => {
    let result = contracts.map(c => {
      const account = accounts.find(a => a.id === c.accountId);
      const computedStatus = getContractStatus(c.status, c.endDate);
      const daysUntilExpiry = getDaysUntilExpiry(c.endDate);
      const owner = getOwnerForContract(c);
      const valueNum = parseFloat(c.value || c.recurringValue || "0");
      return {
        ...c,
        accountName: account?.name || "",
        computedStatus,
        daysUntilExpiry,
        owner,
        valueNum,
      };
    });

    const search = localSearch || searchTerm;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(s) ||
        c.accountName.toLowerCase().includes(s) ||
        c.owner.name.toLowerCase().includes(s)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter(c => {
        if (statusFilter === "active") return c.computedStatus === "active";
        if (statusFilter === "expiring") return c.computedStatus === "expiring_soon";
        if (statusFilter === "expired") return c.computedStatus === "expired";
        if (statusFilter === "draft") return c.computedStatus === "draft";
        return true;
      });
    }

    if (typeFilter !== "all") {
      result = result.filter(c => c.type === typeFilter);
    }

    result.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "name") return dir * a.name.localeCompare(b.name);
      if (sortField === "value") return dir * (a.valueNum - b.valueNum);
      if (sortField === "startDate") return dir * ((a.startDate || "").localeCompare(b.startDate || ""));
      if (sortField === "endDate") return dir * ((a.endDate || "").localeCompare(b.endDate || ""));
      if (sortField === "status") return dir * a.computedStatus.localeCompare(b.computedStatus);
      return 0;
    });

    return result;
  }, [contracts, accounts, localSearch, searchTerm, statusFilter, typeFilter, sortField, sortDir]);

  const formatColumns: MondayColumnDef<any>[] = [
    { id: "name", header: "Contract", type: "text", accessor: "name" },
    { id: "accountName", header: "Account", type: "text", accessor: "accountName" },
    { id: "computedStatus", header: "Status", type: "text", accessor: "computedStatus" },
    { id: "value", header: "Value", type: "currency", accessor: "value" },
  ];

  const cellFormatMap = useMemo(() => {
    if (formatRules.length === 0) return {};
    return evaluateConditionalFormatting(enrichedContracts as any[], formatColumns, formatRules);
  }, [formatRules, enrichedContracts]);

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

  const totalValue = enrichedContracts.reduce((sum, c) => sum + c.valueNum, 0);
  const activeCount = enrichedContracts.filter(c => c.computedStatus === "active").length;
  const expiringCount = contracts.filter(c => getContractStatus(c.status, c.endDate) === "expiring_soon").length;
  const draftCount = contracts.filter(c => getContractStatus(c.status, c.endDate) === "draft").length;

  const statusCounts = {
    all: contracts.length,
    active: contracts.filter(c => getContractStatus(c.status, c.endDate) === "active").length,
    expiring: expiringCount,
    expired: contracts.filter(c => getContractStatus(c.status, c.endDate) === "expired").length,
    draft: draftCount,
  };

  const groupedData = useMemo(() => {
    if (groupBy === "none") return null;
    const groups: Record<string, typeof enrichedContracts> = {};
    for (const c of enrichedContracts) {
      let key: string;
      if (groupBy === "status") key = getStatusInfo(c.computedStatus).label;
      else if (groupBy === "type") key = c.type || "No Type";
      else key = c.accountName || "No Account";
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }
    return groups;
  }, [enrichedContracts, groupBy]);

  const groupColors: Record<string, string> = {
    "Active": "#22c55e", "Expiring": "#f97316", "Expired": "#ef4444", "Draft": "#6b7280",
    "Service": "#3b82f6", "Subscription": "#8b5cf6", "License": "#06b6d4", "Maintenance": "#ec4899",
  };

  const allSelected = enrichedContracts.length > 0 && selectedIds.size === enrichedContracts.length;
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(enrichedContracts.map(c => c.id)));
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

  const exportToCSV = () => {
    const headers = ["Contract", "Account", "Status", "Value", "Start Date", "End Date", "Type", "Owner"];
    const rows = enrichedContracts.map(c => [
      c.name, c.accountName, getStatusInfo(c.computedStatus).label,
      c.value || c.recurringValue || "", c.startDate || "", c.endDate || "",
      c.type || "", c.owner.name,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${(c || "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `contracts-${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Contracts exported to CSV" });
  };

  const handleEdit = (c: typeof enrichedContracts[0]) => {
    setEditingId(c.id);
    setFormData({
      name: c.name,
      accountId: c.accountId ? String(c.accountId) : "",
      type: c.type || "service",
      status: c.status || "draft",
      startDate: c.startDate ? c.startDate.split("T")[0] : "",
      endDate: c.endDate ? c.endDate.split("T")[0] : "",
      value: c.value || "",
    });
    setIsOpen(true);
  };

  const renderRow = (c: typeof enrichedContracts[0]) => {
    const status = getStatusInfo(c.computedStatus);

    return (
      <tr
        key={c.id}
        className={cn(
          "border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer",
          selectedIds.has(c.id) && "bg-blue-50/50 dark:bg-blue-950/20"
        )}
        data-testid={`contract-row-${c.id}`}
      >
        <td className="px-4 py-3 w-10" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selectedIds.has(c.id)}
            onCheckedChange={() => toggleSelectOne(c.id)}
            data-testid={`checkbox-contract-${c.id}`}
          />
        </td>
        <td className={cn("px-4 py-3 whitespace-nowrap", getCellClasses(c.id, "name"))} style={getCellStyle(c.id, "name")}>
          <span className="text-sm font-semibold">{c.name}</span>
        </td>
        <td className={cn("px-4 py-3 whitespace-nowrap", getCellClasses(c.id, "accountName"))} style={getCellStyle(c.id, "accountName")}>
          <span className="text-sm text-muted-foreground">{c.accountName || "—"}</span>
        </td>
        <td className={cn("px-4 py-3 whitespace-nowrap", getCellClasses(c.id, "computedStatus"))} style={getCellStyle(c.id, "computedStatus")}>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: status.dot }} />
            <span
              className="text-xs font-medium"
              style={{ color: status.color }}
            >
              {status.label}
            </span>
          </span>
        </td>
        <td className={cn("px-4 py-3 whitespace-nowrap", getCellClasses(c.id, "value"))} style={getCellStyle(c.id, "value")}>
          <span className="text-sm font-semibold">{formatValue(c.value, c.recurringValue)}</span>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span className="text-sm text-muted-foreground">{formatDate(c.startDate)}</span>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <span className="text-sm text-muted-foreground">{formatDate(c.endDate)}</span>
        </td>
        <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          {(() => {
            const req = getContractSignoffStatus(c.id);
            if (!req) {
              return (
                <button
                  onClick={() => {
                    const params = new URLSearchParams({ compose: "1", crmContractId: String(c.id), crmContractTitle: c.name });
                    setLocation(`/modules/e-sign?${params.toString()}`);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                  data-testid={`button-signoff-contract-${c.id}`}
                >
                  <FileSignature className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              );
            }
            const cfgMap: Record<string, { icon: React.ReactNode; cls: string; label: string }> = {
              draft:     { icon: <Clock className="h-3 w-3" />,         cls: "text-muted-foreground",                label: "Draft" },
              sent:      { icon: <Clock className="h-3 w-3" />,         cls: "text-amber-600 dark:text-amber-400",   label: "Pending" },
              completed: { icon: <CheckCircle2 className="h-3 w-3" />,  cls: "text-green-600 dark:text-green-400",   label: "Signed" },
              declined:  { icon: <XCircle className="h-3 w-3" />,       cls: "text-red-600 dark:text-red-400",       label: "Declined" },
              cancelled: { icon: <XCircle className="h-3 w-3" />,       cls: "text-muted-foreground",                label: "Cancelled" },
              expired:   { icon: <Clock className="h-3 w-3" />,         cls: "text-orange-600 dark:text-orange-400", label: "Expired" },
            };
            const cfg = cfgMap[req.status] || cfgMap.draft;
            return (
              <button
                onClick={() => setLocation(`/modules/e-sign`)}
                className={cn("inline-flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80", cfg.cls)}
                title={`View in e-Sign: ${req.title}`}
                data-testid={`signoff-status-contract-${c.id}`}
              >
                {cfg.icon}
                {cfg.label}
              </button>
            );
          })()}
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex items-center justify-end">
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: c.owner.color }}
              title={c.owner.name}
            >
              {c.owner.initials}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-right whitespace-nowrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()} data-testid={`button-actions-contract-${c.id}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEdit(c)} data-testid={`action-edit-contract-${c.id}`}>
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const params = new URLSearchParams({ compose: "1", crmContractId: String(c.id), crmContractTitle: c.name });
                  setLocation(`/modules/e-sign?${params.toString()}`);
                }}
                data-testid={`action-signoff-contract-${c.id}`}
              >
                <FileSignature className="h-3.5 w-3.5 mr-2" />
                Send for Sign-off
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => deleteMutation.mutate(c.id)}
                className="text-red-600 focus:text-red-600"
                data-testid={`action-delete-contract-${c.id}`}
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
        <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-4 shadow-sm" data-testid="card-total-contracts">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <ContractIcon className="h-5 w-5" />
            Total Contracts
          </div>
          <div className="text-2xl font-bold" data-testid="text-total-contracts">{enrichedContracts.length}</div>
        </div>
        <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-4 shadow-sm" data-testid="card-total-value">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <ValueIcon className="h-5 w-5" />
            Total Value
          </div>
          <div className="text-2xl font-bold text-[#22c55e]" data-testid="text-total-value">£{totalValue.toLocaleString()}</div>
        </div>
        <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-4 shadow-sm" data-testid="card-expiring-contracts">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <ExpiringIcon className="h-5 w-5" />
            Expiring Soon
          </div>
          <div className="text-2xl font-bold text-[#f97316]" data-testid="text-expiring-contracts">{expiringCount}</div>
        </div>
        <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-4 shadow-sm" data-testid="card-renewal-rate">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <RenewalIcon className="h-5 w-5" />
            Active Rate
          </div>
          <div className="text-2xl font-bold text-[#8b5cf6]" data-testid="text-renewal-rate">
            {contracts.length > 0 ? Math.round((statusCounts.active / contracts.length) * 100) : 0}%
          </div>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl" data-testid="bulk-actions-contracts">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-400">{selectedIds.size} selected</span>
          <button
            onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
            data-testid="button-bulk-delete-contracts"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-background border border-border hover:bg-muted transition-colors"
            data-testid="button-clear-selection-contracts"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2" data-testid="contracts-toolbar">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            className={cn(
              "h-9 w-auto min-w-[140px] rounded-lg text-sm font-medium border transition-colors gap-1.5",
              statusFilter !== "all"
                ? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
                : "bg-background border-border text-foreground"
            )}
            data-testid="select-status-filter"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses ({statusCounts.all})</SelectItem>
            <SelectItem value="active">Active ({statusCounts.active})</SelectItem>
            <SelectItem value="expiring">Expiring Soon ({statusCounts.expiring})</SelectItem>
            <SelectItem value="expired">Expired ({statusCounts.expired})</SelectItem>
            <SelectItem value="draft">Draft ({statusCounts.draft})</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger
            className={cn(
              "h-9 w-auto min-w-[130px] rounded-lg text-sm font-medium border transition-colors gap-1.5",
              typeFilter !== "all"
                ? "bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400"
                : "bg-background border-border text-foreground"
            )}
            data-testid="select-type-filter"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="service">Service</SelectItem>
            <SelectItem value="subscription">Subscription</SelectItem>
            <SelectItem value="license">License</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
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
              data-testid="button-sort-contracts"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Sort: {sortField === "name" ? "Name" : sortField === "value" ? "Value" : sortField === "startDate" ? "Start" : sortField === "endDate" ? "End" : "Status"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => handleSort("name")} data-testid="sort-contracts-name">Name</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("value")} data-testid="sort-contracts-value">Value</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("startDate")} data-testid="sort-contracts-start">Start Date</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("endDate")} data-testid="sort-contracts-end">End Date</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("status")} data-testid="sort-contracts-status">Status</DropdownMenuItem>
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
              data-testid="button-group-contracts"
            >
              <Layers className="h-3.5 w-3.5" />
              Group
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setGroupBy("none")} data-testid="group-contracts-none">None</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGroupBy("status")} data-testid="group-contracts-status">Status</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGroupBy("type")} data-testid="group-contracts-type">Type</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGroupBy("account")} data-testid="group-contracts-account">Account</DropdownMenuItem>
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
          data-testid="button-format-contracts"
        >
          <Paintbrush className="h-3.5 w-3.5" />
          Format{formatRules.length > 0 ? ` (${formatRules.length})` : ""}
        </button>

        <div className="flex-1" />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search contracts..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/20 w-[200px]"
            data-testid="input-search-contracts"
          />
        </div>

        <button
          onClick={exportToCSV}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors"
          data-testid="button-export-contracts"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>

        <button
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors"
          onClick={() => setImportOpen(true)}
          data-testid="button-import-contracts"
        >
          <Upload className="h-3.5 w-3.5" />
          Import
        </button>
        <ImportModal
          isOpen={importOpen}
          onClose={() => setImportOpen(false)}
          entityName="Contracts"
          templateHeaders={["name","type","status","startDate","endDate","value","recurringValue","terms","accountName"]}
          exampleRow={{ name:"Acme Support Agreement 2026",type:"service",status:"active",startDate:"2026-01-01",endDate:"2026-12-31",value:"48000",recurringValue:"4000",terms:"Net 30 days. Quarterly reviews.",accountName:"Acme Ltd" }}
          currentCount={contracts.length}
          onImport={async (rows, mode) => { await importMutation.mutateAsync({ rows, mode }); }}
        />

        <button
          onClick={() => toast({ title: "View saved", description: "Current filters and layout saved" })}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors"
          data-testid="button-save-view-contracts"
        >
          <Bookmark className="h-3.5 w-3.5" />
          Save View
        </button>

        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) { setEditingId(null); setFormData({ name: "", accountId: "", type: "service", status: "draft", startDate: "", endDate: "", value: "" }); } }}>
          <DialogTrigger asChild>
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#0ea5e9] hover:bg-[#0ea5e9]/90 text-white transition-colors"
              data-testid="button-add-contract"
            >
              <Plus className="h-4 w-4" />
              New Contract
            </button>
          </DialogTrigger>
          <DialogContent>
            <SubmitForm
              onSubmit={() => {
                if (editingId) {
                  updateMutation.mutate({
                    id: editingId,
                    updates: {
                      name: formData.name,
                      accountId: formData.accountId ? parseInt(formData.accountId) : null,
                      type: formData.type,
                      status: formData.status,
                      startDate: formData.startDate || null,
                      endDate: formData.endDate || null,
                      value: formData.value || null,
                    },
                  });
                  setIsOpen(false);
                  setEditingId(null);
                  setFormData({ name: "", accountId: "", type: "service", status: "draft", startDate: "", endDate: "", value: "" });
                } else {
                  createMutation.mutate(formData);
                }
              }}
              disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
            >
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Contract" : "Create New Contract"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="contract-name">Name *</Label>
                <Input
                  id="contract-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  data-testid="input-contract-name"
                />
              </div>
              <div>
                <Label htmlFor="contract-account">Account</Label>
                <Select value={formData.accountId} onValueChange={(v) => setFormData(prev => ({ ...prev, accountId: v }))}>
                  <SelectTrigger data-testid="select-contract-account">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(account => (
                      <SelectItem key={account.id} value={account.id.toString()}>{account.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contract-type">Type</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData(prev => ({ ...prev, type: v }))}>
                    <SelectTrigger data-testid="select-contract-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="service">Service</SelectItem>
                      <SelectItem value="subscription">Subscription</SelectItem>
                      <SelectItem value="license">License</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="contract-status">Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
                    <SelectTrigger data-testid="select-contract-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contract-start">Start Date</Label>
                  <Input
                    id="contract-start"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    data-testid="input-contract-start-date"
                  />
                </div>
                <div>
                  <Label htmlFor="contract-end">End Date</Label>
                  <Input
                    id="contract-end"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    data-testid="input-contract-end-date"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="contract-value">Value</Label>
                <Input
                  id="contract-value"
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                  data-testid="input-contract-value"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-contract"
              >
                {editingId
                  ? (updateMutation.isPending ? "Updating..." : "Update Contract")
                  : (createMutation.isPending ? "Creating..." : "Create Contract")}
              </Button>
            </DialogFooter>
            </SubmitForm>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white dark:bg-card rounded-xl border border-border/40 shadow-sm overflow-hidden max-w-[95%]" data-testid="contracts-table">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                <th className="px-4 py-3 w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    data-testid="checkbox-select-all-contracts"
                  />
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => handleSort("name")}>
                  Contract {sortField === "name" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                  Account
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => handleSort("status")}>
                  Status {sortField === "status" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => handleSort("value")}>
                  Value {sortField === "value" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => handleSort("startDate")}>
                  Start Date {sortField === "startDate" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap cursor-pointer hover:text-foreground" onClick={() => handleSort("endDate")}>
                  End Date {sortField === "endDate" && (sortDir === "asc" ? "↑" : "↓")}
                </th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                  Sign-off
                </th>
                <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                  Owner
                </th>
                <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {enrichedContracts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <ContractIcon className="h-10 w-10 opacity-30" />
                      <p className="text-sm">No contracts yet. Create your first contract to start tracking agreements.</p>
                      <Button
                        size="sm"
                        className="mt-2 bg-[#0ea5e9] hover:bg-[#0ea5e9]/90"
                        onClick={() => setIsOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        New Contract
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : groupedData ? (
                Object.entries(groupedData).flatMap(([groupName, groupContracts]) => [
                  <tr key={`group-header-${groupName}`} className="bg-muted/40 border-b border-border/40" data-testid={`group-contracts-header-${groupName}`}>
                    <td colSpan={10} className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: groupColors[groupName] || "#6b7280" }}
                        />
                        <span className="text-sm font-semibold">{groupName}</span>
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                          {groupContracts.length}
                        </Badge>
                        <span className="text-xs text-muted-foreground ml-2">
                          £{groupContracts.reduce((s, c) => s + c.valueNum, 0).toLocaleString()}
                        </span>
                      </div>
                    </td>
                  </tr>,
                  ...groupContracts.map(renderRow)
                ])
              ) : (
                enrichedContracts.map(renderRow)
              )}
            </tbody>
          </table>
        </div>
        {enrichedContracts.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20 text-xs text-muted-foreground" data-testid="contracts-count-footer">
            {enrichedContracts.length} of {contracts.length} contracts
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
        data={enrichedContracts as any[]}
      />
    </div>
  );
}
