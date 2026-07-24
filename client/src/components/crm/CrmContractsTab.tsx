import { useState, useMemo, useEffect, useCallback, useRef, type ReactNode } from "react";
import { type FilterConfig, type SortConfig } from "./SavedViewsDropdown";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MetricCard } from "@/components/ui/metric-card";
import { buildContractSignoffUrl } from "@/lib/crm-contract-signoff";
import { ContractFormDialog } from "./ContractFormDialog";
import { resolveDocumentTitle, type LinkedDocument } from "./DocumentLinkSelect";
import {
  Trash2, MoreHorizontal, Pencil,
  FileSignature, Clock, CheckCircle2, XCircle, FileText, Link2
} from "lucide-react";
import { ImportModal, type ImportMode } from "@/components/ImportModal";
import { type ConditionalFormatRule } from "@/lib/conditionalFormatting";
import { type ColumnDef as MondayColumnDef, type StatusOption } from "@/components/MondayTable";
import { MondayBoardShell } from "@/components/board";
import { useMondayBoardShellState } from "@/hooks/use-monday-board-shell-state";
import {
  matchBoardFilterValue,
  type BoardFilterFieldDef,
  type BoardSortFieldDef,
} from "@/lib/board-filters";
import { useCrmUsers } from "./CrmUsersProvider";
import type { CrmAccountDetail, CrmContract } from "./types";
import {
  useDebouncedValue,
  recordToMondayGroups,
  downloadBoardCsv,
  downloadImportTemplateCsv,
} from "@/lib/crm-monday-chrome";
import type { CrmColumnDef } from "@/lib/crm-list-columns";

const CONTRACT_IMPORT_HEADERS = [
  "name", "type", "status", "startDate", "endDate",
  "value", "recurringValue", "terms", "accountName",
] as const;

const CONTRACT_IMPORT_EXAMPLE: Record<string, string> = {
  name: "Acme Support Agreement 2026",
  type: "service",
  status: "active",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  value: "48000",
  recurringValue: "4000",
  terms: "Net 30 days. Quarterly reviews.",
  accountName: "Acme Ltd",
};

const CONTRACT_TABLE_COLUMNS: CrmColumnDef[] = [
  { id: "account", label: "Account" },
  { id: "status", label: "Status" },
  { id: "value", label: "Value" },
  { id: "startDate", label: "Start Date" },
  { id: "endDate", label: "End Date" },
  { id: "signoff", label: "Sign-off" },
  { id: "owner", label: "Owner" },
];

const CONTRACT_FILTER_FIELDS: BoardFilterFieldDef[] = [
  { field: "name", label: "Contract", textInput: true },
  { field: "status", label: "Status" },
  { field: "type", label: "Type" },
  { field: "account", label: "Account", textInput: true },
  { field: "owner", label: "Owner" },
  { field: "value", label: "Value", textInput: true },
];

const CONTRACT_SORT_FIELDS: BoardSortFieldDef[] = [
  { field: "name", label: "Name" },
  { field: "value", label: "Value" },
  { field: "startDate", label: "Start Date" },
  { field: "endDate", label: "End Date" },
  { field: "status", label: "Status" },
];

const CONTRACT_STATUS_FILTER_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "expiring_soon", label: "Expiring Soon" },
  { value: "expired", label: "Expired" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "terminated", label: "Terminated" },
];

const CONTRACT_TYPE_OPTIONS = [
  { value: "service", label: "Service" },
  { value: "subscription", label: "Subscription" },
  { value: "license", label: "License" },
  { value: "maintenance", label: "Maintenance" },
];

const CONTRACT_STATUS_EDIT_OPTIONS: StatusOption[] = [
  { value: "draft", label: "Draft", color: "#6b7280" },
  { value: "sent", label: "Sent", color: "#f59e0b" },
  { value: "active", label: "Active", color: "#22c55e" },
  { value: "expired", label: "Expired", color: "#ef4444" },
  { value: "terminated", label: "Terminated", color: "#94a3b8" },
];

interface CrmContractsTabProps {
  contracts: CrmContract[];
  accounts: CrmAccountDetail[];
  searchTerm: string;
  initialContractId?: number | null;
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
  if (days !== null && days <= 30) return "expiring_soon";
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

const SIGNOFF_STATUS_CFG: Record<string, { icon: ReactNode; cls: string; label: string }> = {
  draft:             { icon: <Clock className="h-3 w-3" />,         cls: "text-muted-foreground",                label: "Draft" },
  pending:           { icon: <Clock className="h-3 w-3" />,         cls: "text-amber-600 dark:text-amber-400",   label: "Pending" },
  partially_signed:  { icon: <Clock className="h-3 w-3" />,         cls: "text-amber-600 dark:text-amber-400",   label: "Partial" },
  sent:              { icon: <Clock className="h-3 w-3" />,         cls: "text-amber-600 dark:text-amber-400",   label: "Pending" },
  completed:         { icon: <CheckCircle2 className="h-3 w-3" />,  cls: "text-green-600 dark:text-green-400",   label: "Signed" },
  declined:          { icon: <XCircle className="h-3 w-3" />,       cls: "text-red-600 dark:text-red-400",       label: "Declined" },
  cancelled:         { icon: <XCircle className="h-3 w-3" />,       cls: "text-muted-foreground",                label: "Cancelled" },
  voided:            { icon: <XCircle className="h-3 w-3" />,       cls: "text-muted-foreground",                label: "Voided" },
  expired:           { icon: <Clock className="h-3 w-3" />,         cls: "text-orange-600 dark:text-orange-400", label: "Expired" },
};

function getContractFilterFieldValue(
  c: {
    name: string;
    accountName: string;
    computedStatus: string;
    type: string | null;
    ownerUserId: string | null;
    valueNum: number;
  },
  field: string,
): string {
  switch (field) {
    case "name":
      return c.name || "";
    case "account":
      return c.accountName || "";
    case "status":
      return c.computedStatus || "";
    case "type":
      return c.type || "";
    case "owner":
      return c.ownerUserId || "__unassigned__";
    case "value":
      return String(c.valueNum ?? "");
    default:
      return "";
  }
}

function compareContractsByRules<T extends {
  name: string;
  valueNum: number;
  startDate: string | null;
  endDate: string | null;
  computedStatus: string;
}>(a: T, b: T, rules: { field: string; dir: "asc" | "desc" }[]): number {
  for (const rule of rules) {
    const dir = rule.dir === "asc" ? 1 : -1;
    let cmp = 0;
    if (rule.field === "value") cmp = a.valueNum - b.valueNum;
    else if (rule.field === "startDate") cmp = (a.startDate || "").localeCompare(b.startDate || "");
    else if (rule.field === "endDate") cmp = (a.endDate || "").localeCompare(b.endDate || "");
    else if (rule.field === "status") cmp = a.computedStatus.localeCompare(b.computedStatus);
    else cmp = a.name.localeCompare(b.name);
    if (cmp !== 0) return dir * cmp;
  }
  return 0;
}

export function CrmContractsTab({ contracts, accounts, searchTerm, initialContractId = null }: CrmContractsTabProps) {
  const { users, resolveOwner } = useCrmUsers();
  const [formOpen, setFormOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<CrmContract | null>(null);
  const [formatRules, setFormatRules] = useState<ConditionalFormatRule[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const shell = useMondayBoardShellState({
    storageKey: "jiganto-crm-contracts",
    columnDefs: CONTRACT_TABLE_COLUMNS,
    defaultSortField: "name",
    defaultSortDir: "asc",
    defaultGroupBy: "none",
  });
  const {
    localSearch,
    setLocalSearch,
    filterRules,
    setFilterRules,
    filterOpen,
    setFilterOpen,
    sortRules,
    onSortToggle,
    onSortAdd,
    onSortRemove,
    groupBy,
    setGroupBy,
    ownerFilter,
    setOwnerFilter,
    viewMode,
    setViewModePersist,
    pinActive,
    togglePin,
    isColVisible,
    setColVisible,
    moveColumn,
    columnMenuItems,
    columnOrderIds,
    viewSnapshot,
    applyViewSnapshot,
  } = shell;
  const debouncedLocalSearch = useDebouncedValue(localSearch);

  const consumedInitialId = useRef(false);
  useEffect(() => {
    if (consumedInitialId.current) return;
    if (!initialContractId || contracts.length === 0) return;
    const match = contracts.find((c) => c.id === initialContractId);
    if (match) {
      setEditingContract(match);
      setFormOpen(true);
      consumedInitialId.current = true;
    }
  }, [initialContractId, contracts]);

  const { data: allSignoffRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/signoff"],
  });

  const { data: linkedDocuments = [] } = useQuery<LinkedDocument[]>({
    queryKey: ["/api/documents", "contracts-tab"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/documents");
      if (!res.ok) throw new Error("Failed to load documents");
      return res.json();
    },
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

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => apiRequest("POST", "/api/crm/contracts/bulk-delete", { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contracts"] });
      toast({ title: "Contracts deleted successfully" });
    },
    onError: () => toast({ title: "Failed to delete contracts", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/crm/contracts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contracts"] });
      toast({ title: "Contract deleted" });
    },
    onError: () => toast({ title: "Failed to delete contract", variant: "destructive" }),
  });

  const updateContractMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Partial<CrmContract> }) =>
      apiRequest("PUT", `/api/crm/contracts/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contracts"] });
    },
    onError: () => toast({ title: "Failed to update contract", variant: "destructive" }),
  });

  function openCreateForm() {
    setEditingContract(null);
    setFormOpen(true);
  }

  function openEditForm(contract: CrmContract) {
    setEditingContract(contract);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingContract(null);
  }

  function requestSignoff(contract: CrmContract) {
    const documentTitle = resolveDocumentTitle(linkedDocuments, contract.documentId);
    const url = buildContractSignoffUrl({
      id: contract.id,
      name: contract.name,
      documentId: contract.documentId,
      documentTitle,
    });
    if (!url) {
      toast({
        title: "Link a document first",
        description: "Open the contract and link a document from the Documents module before sending for sign-off.",
        variant: "destructive",
      });
      setEditingContract(contract);
      setFormOpen(true);
      return;
    }
    setLocation(url);
  }

  function getContractSignoffStatus(contractId: number) {
    const reqs = allSignoffRequests.filter((r: any) => r.crmContractId === contractId);
    if (reqs.length === 0) return null;
    const latest = reqs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    return latest;
  }

  const ownerSelectOptions: StatusOption[] = useMemo(
    () => [
      { value: "", label: "Unassigned", color: "#94a3b8" },
      ...users.map((u) => {
        const o = resolveOwner(u.id);
        return { value: u.id, label: o.name, color: o.color };
      }),
    ],
    [users, resolveOwner],
  );

  const personUsers = useMemo(
    () =>
      users.map((u) => {
        const o = resolveOwner(u.id);
        return { id: u.id, name: o.name, initials: o.initials, color: o.color };
      }),
    [users, resolveOwner],
  );

  const enrichedContracts = useMemo(() => {
    let result = contracts.map(c => {
      const account = accounts.find(a => a.id === c.accountId);
      const computedStatus = getContractStatus(c.status, c.endDate);
      const daysUntilExpiry = getDaysUntilExpiry(c.endDate);
      const owner = resolveOwner(c.ownerUserId);
      const valueNum = parseFloat(c.value || c.recurringValue || "0");
      return {
        ...c,
        accountName: account?.name || "",
        computedStatus,
        daysUntilExpiry,
        owner,
        valueNum,
        documentTitle: resolveDocumentTitle(linkedDocuments, c.documentId),
      };
    });

    const search = debouncedLocalSearch || searchTerm;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(s) ||
        c.accountName.toLowerCase().includes(s) ||
        c.owner.name.toLowerCase().includes(s)
      );
    }

    if (ownerFilter === "__unassigned__") {
      result = result.filter((c) => !c.ownerUserId);
    } else if (ownerFilter !== "all") {
      result = result.filter((c) => c.ownerUserId === ownerFilter);
    }

    for (const rule of filterRules) {
      if ((rule.operator === "is" || rule.operator === "is_not" || rule.operator === "contains" || rule.operator === "not_contains" || rule.operator === "gt" || rule.operator === "lt") && !rule.value) {
        continue;
      }
      result = result.filter((c) => {
        const raw = getContractFilterFieldValue(c, rule.field);
        const forEmpty = rule.field === "owner" ? c.ownerUserId || "" : raw;
        const fieldVal =
          rule.operator === "is_empty" || rule.operator === "is_not_empty" ? forEmpty : raw;
        return matchBoardFilterValue(fieldVal, rule.operator, rule.value);
      });
    }

    return [...result].sort((a, b) => compareContractsByRules(a, b, sortRules));
  }, [contracts, accounts, debouncedLocalSearch, searchTerm, ownerFilter, filterRules, sortRules, resolveOwner, linkedDocuments]);

  type EnrichedContract = (typeof enrichedContracts)[number];

  const totalValue = enrichedContracts.reduce((sum, c) => sum + c.valueNum, 0);
  const expiringCount = contracts.filter(c => getContractStatus(c.status, c.endDate) === "expiring_soon").length;
  const activeCount = contracts.filter(c => getContractStatus(c.status, c.endDate) === "active").length;

  const groupedData = useMemo(() => {
    if (groupBy === "none") return null;
    const groups: Record<string, EnrichedContract[]> = {};
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

  const tableGroups = useMemo(
    () => recordToMondayGroups(
      groupedData,
      groupColors,
      (items) => `£${items.reduce((s, c) => s + c.valueNum, 0).toLocaleString()}`,
    ),
    [groupedData],
  );

  const mondayColumns: MondayColumnDef<EnrichedContract>[] = useMemo(() => {
    const byId: Record<string, MondayColumnDef<EnrichedContract>> = {
      name: {
        id: "name",
        header: "Contract",
        type: "text",
        accessor: "name",
        width: "220px",
        sticky: pinActive,
        editable: true,
        summary: "count",
      },
      account: {
        id: "account",
        header: "Account",
        type: "text",
        accessor: (row) => row.accountName,
        width: "160px",
        hidden: !isColVisible("account"),
        editable: false,
        render: (c) => <span className="text-sm text-muted-foreground">{c.accountName || "—"}</span>,
      },
      status: {
        id: "status",
        header: "Status",
        type: "status",
        accessor: (row) => row.status || "draft",
        width: "130px",
        hidden: !isColVisible("status"),
        editable: true,
        options: CONTRACT_STATUS_EDIT_OPTIONS,
      },
      value: {
        id: "value",
        header: "Value",
        type: "currency",
        accessor: "value",
        width: "120px",
        hidden: !isColVisible("value"),
        editable: true,
        summary: "sum",
      },
      startDate: {
        id: "startDate",
        header: "Start Date",
        type: "date",
        accessor: "startDate",
        width: "120px",
        hidden: !isColVisible("startDate"),
        editable: true,
      },
      endDate: {
        id: "endDate",
        header: "End Date",
        type: "date",
        accessor: "endDate",
        width: "120px",
        hidden: !isColVisible("endDate"),
        editable: true,
      },
      signoff: {
        id: "signoff",
        header: "Sign-off",
        type: "files",
        accessor: () => null,
        width: "110px",
        hidden: !isColVisible("signoff"),
        editable: false,
        render: (c) => {
          const req = getContractSignoffStatus(c.id);
          if (!req) {
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  requestSignoff(c);
                }}
                className={cn(
                  "inline-flex items-center gap-1 text-xs transition-colors",
                  c.documentId
                    ? "text-muted-foreground hover:text-primary"
                    : "text-amber-600 dark:text-amber-400 hover:text-amber-700",
                )}
                title={c.documentId ? "Send for sign-off" : "Link a document before sending for sign-off"}
                data-testid={`button-signoff-contract-${c.id}`}
              >
                <FileSignature className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{c.documentId ? "Send" : "Link doc"}</span>
              </button>
            );
          }
          const cfg = SIGNOFF_STATUS_CFG[req.status] || SIGNOFF_STATUS_CFG.draft;
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLocation(`/modules/e-sign?request=${req.id}`);
              }}
              className={cn("inline-flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80", cfg.cls)}
              title={`View in e-Sign: ${req.title}`}
              data-testid={`signoff-status-contract-${c.id}`}
            >
              {cfg.icon}
              {cfg.label}
            </button>
          );
        },
      },
      owner: {
        id: "owner",
        header: "Owner",
        type: "select",
        accessor: (row) => row.ownerUserId || "",
        width: "160px",
        hidden: !isColVisible("owner"),
        editable: true,
        options: ownerSelectOptions,
      },
    };

    const order = ["name", ...(columnOrderIds.length ? columnOrderIds : CONTRACT_TABLE_COLUMNS.map((c) => c.id))];
    const seen = new Set<string>();
    const ordered: MondayColumnDef<EnrichedContract>[] = [];
    for (const id of order) {
      if (seen.has(id) || !byId[id]) continue;
      seen.add(id);
      ordered.push(byId[id]);
    }
    for (const id of Object.keys(byId)) {
      if (!seen.has(id)) ordered.push(byId[id]);
    }
    return ordered;
  }, [
    allSignoffRequests,
    linkedDocuments,
    setLocation,
    pinActive,
    isColVisible,
    ownerSelectOptions,
    columnOrderIds,
  ]);

  const handleCellEdit = useCallback(
    (rowId: number | string, columnId: string, value: unknown) => {
      const id = typeof rowId === "string" ? Number(rowId) : rowId;
      const updates: Partial<CrmContract> = {};

      switch (columnId) {
        case "name":
          updates.name = String(value || "") || "Untitled";
          break;
        case "status":
          updates.status = String(value || "") || null;
          break;
        case "value":
          updates.value = value === "" || value == null ? null : String(value);
          break;
        case "startDate":
          updates.startDate = value ? String(value) : null;
          break;
        case "endDate":
          updates.endDate = value ? String(value) : null;
          break;
        case "owner":
          updates.ownerUserId = String(value || "") || null;
          break;
        default:
          return;
      }

      updateContractMutation.mutate({ id, updates });
    },
    [updateContractMutation],
  );

  const getFilterFieldOptions = useCallback(
    (field: string) => {
      switch (field) {
        case "status":
          return CONTRACT_STATUS_FILTER_OPTIONS;
        case "type":
          return CONTRACT_TYPE_OPTIONS;
        case "owner":
          return [
            { value: "__unassigned__", label: "Unassigned" },
            ...users.map((u) => ({ value: u.id, label: resolveOwner(u.id).name })),
          ];
        case "account":
          return Array.from(new Set(enrichedContracts.map((c) => c.accountName).filter(Boolean))).map(
            (v) => ({ value: v, label: v }),
          );
        default:
          return [];
      }
    },
    [users, resolveOwner, enrichedContracts],
  );

  const currentFilters = useMemo((): FilterConfig[] => (
    filterRules.map((r) => ({
      columnId: r.field,
      operator: (r.operator === "contains" || r.operator === "not_contains"
        ? "contains"
        : r.operator === "gt"
          ? "greaterThan"
          : r.operator === "lt"
            ? "lessThan"
            : "equals") as FilterConfig["operator"],
      value: r.value,
    }))
  ), [filterRules]);

  const currentSorts = useMemo(
    (): SortConfig[] => sortRules.map((r) => ({ columnId: r.field, direction: r.dir })),
    [sortRules],
  );

  const applySavedView = (
    filters: FilterConfig[],
    sorts?: SortConfig[],
    _columns?: unknown,
    extras?: { viewMode?: string; groupBy?: string },
  ) => {
    const nextRules = filters.map((f, i) => ({
      id: `sv-${i}-${f.columnId}`,
      field: f.columnId,
      operator: (f.operator === "contains"
        ? "contains"
        : f.operator === "greaterThan"
          ? "gt"
          : f.operator === "lessThan"
            ? "lt"
            : "is") as "is" | "contains" | "gt" | "lt",
      value: f.value,
    }));
    setFilterRules(nextRules);
    if (sorts?.length) {
      applyViewSnapshot({
        ...viewSnapshot,
        filters: nextRules,
        sorts: sorts.map((s) => ({ field: s.columnId, dir: s.direction })),
        viewMode: extras?.viewMode || viewMode,
        groupBy: extras?.groupBy || groupBy,
      });
    }
    if (extras?.viewMode) setViewModePersist(extras.viewMode as typeof viewMode);
    if (extras?.groupBy) setGroupBy(extras.groupBy);
  };

  const exportToCSV = () => {
    const headers = [...CONTRACT_IMPORT_HEADERS];
    const rows = enrichedContracts.map((c) =>
      headers.map((h) => {
        switch (h) {
          case "name": return c.name || "";
          case "type": return c.type || "";
          case "status": return c.status || "";
          case "startDate": return c.startDate || "";
          case "endDate": return c.endDate || "";
          case "value": return c.value || "";
          case "recurringValue": return c.recurringValue || "";
          case "terms": return c.terms || "";
          case "accountName": return c.accountName || "";
          default: return "";
        }
      }),
    );
    downloadBoardCsv(`contracts-${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
    toast({ title: "Contracts exported to CSV", description: "File uses the same columns as Import." });
  };

  const downloadImportTemplate = () => {
    downloadImportTemplateCsv("contracts-import-template.csv", [...CONTRACT_IMPORT_HEADERS], CONTRACT_IMPORT_EXAMPLE);
    toast({ title: "Import template downloaded" });
  };

  const handleEdit = (c: EnrichedContract) => {
    openEditForm(c);
  };

  const groupContent = (
    <>
      <DropdownMenuItem onClick={() => setGroupBy("none")} data-testid="group-contracts-none">None</DropdownMenuItem>
      <DropdownMenuItem onClick={() => setGroupBy("status")} data-testid="group-contracts-status">Status</DropdownMenuItem>
      <DropdownMenuItem onClick={() => setGroupBy("type")} data-testid="group-contracts-type">Type</DropdownMenuItem>
      <DropdownMenuItem onClick={() => setGroupBy("account")} data-testid="group-contracts-account">Account</DropdownMenuItem>
    </>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard title="Total Contracts" value={enrichedContracts.length} subtitle="Matching filters" helpText="All contracts visible after status and search filters." icon={ContractIcon} testId="card-total-contracts" />
        <MetricCard title="Total Value" value={`£${totalValue.toLocaleString()}`} subtitle="Sum of contract values" helpText="Combined value of all filtered contracts." icon={ValueIcon} borderColor="#22c55e" valueClassName="text-[#22c55e]" testId="card-total-value" />
        <MetricCard title="Expiring (30 days)" value={expiringCount} subtitle="End date within 30d" helpText="Active contracts whose end date falls within the next 30 days." icon={ExpiringIcon} borderColor="#f97316" valueClassName="text-[#f97316]" testId="card-expiring-contracts" />
        <MetricCard
          title="Active Contracts"
          value={contracts.length > 0 ? `${Math.round((activeCount / contracts.length) * 100)}%` : "0%"}
          subtitle={`${activeCount} of ${contracts.length} contracts`}
          helpText="Percentage of all contracts currently in active status (not draft, expired, or terminated)."
          icon={RenewalIcon}
          borderColor="#8b5cf6"
          valueClassName="text-[#8b5cf6]"
          testId="card-renewal-rate"
        />
      </div>

      <MondayBoardShell<EnrichedContract>
        storageKey="jiganto-crm-contracts"
        entityType="contracts"
        testId="contracts-board"
        viewSnapshot={viewSnapshot}
        onApplyViewSnapshot={applyViewSnapshot}
        mainTableSorts={[{ field: "name", dir: "asc" }]}
        newLabel="New Contract"
        onNew={openCreateForm}
        newTestId="button-add-contract"
        searchValue={localSearch}
        onSearchChange={setLocalSearch}
        searchTestId="input-search-contracts"
        personUsers={personUsers}
        personValue={ownerFilter}
        onPersonChange={setOwnerFilter}
        viewMode={viewMode}
        onViewModeChange={setViewModePersist}
        filterRules={filterRules}
        onFilterRulesChange={setFilterRules}
        filterFields={CONTRACT_FILTER_FIELDS}
        getFilterFieldOptions={getFilterFieldOptions}
        filterOpen={filterOpen}
        onFilterOpenChange={setFilterOpen}
        sortRules={sortRules}
        sortFields={CONTRACT_SORT_FIELDS}
        onSortToggle={onSortToggle}
        onSortAdd={onSortAdd}
        onSortRemove={onSortRemove}
        defaultSortField="name"
        groupContent={groupContent}
        groupActive={groupBy !== "none"}
        groupLabel={groupBy === "none" ? "Group by" : `Group by ${groupBy}`}
        grouped={groupBy !== "none"}
        pinActive={pinActive}
        onPinToggle={togglePin}
        pinTitle={pinActive ? "Unpin Contract column" : "Pin Contract column"}
        columnMenuItems={columnMenuItems}
        onColumnVisible={setColVisible}
        onColumnMove={moveColumn}
        savedViewFilters={currentFilters}
        savedViewSorts={currentSorts}
        onApplySavedViewDropdown={applySavedView}
        onExport={exportToCSV}
        onDownloadTemplate={downloadImportTemplate}
        onPaste={() => setImportOpen(true)}
        onImport={() => setImportOpen(true)}
        tableProps={{
          columns: mondayColumns,
          data: enrichedContracts,
          groups: tableGroups,
          conditionalFormatRules: formatRules,
          onConditionalFormatRulesChange: setFormatRules,
          emptyMessage: "No contracts yet. Create your first contract to start tracking agreements.",
          addItemLabel: "New Contract",
          onAddItem: () => openCreateForm(),
          onEditItem: handleEdit,
          onCellEdit: handleCellEdit,
          onDeleteItems: (ids) => {
            const n = ids.length;
            if (!window.confirm(n === 1 ? "Delete this contract?" : `Delete ${n} contracts?`)) return;
            if (ids.length === 1) {
              deleteMutation.mutate(Number(ids[0]));
            } else {
              bulkDeleteMutation.mutate(ids.map(Number));
            }
          },
          searchHighlightTerm: searchTerm || debouncedLocalSearch,
          columnWidthStorageKey: "jiganto-crm-contracts-col-widths",
          paginationResetKey: `${debouncedLocalSearch}|${searchTerm}|${ownerFilter}|${JSON.stringify(filterRules)}|${JSON.stringify(sortRules)}|${groupBy}`,
          totalCount: contracts.length,
          renderRowActions: (c) => (
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
                {c.documentId ? (
                  <>
                    <DropdownMenuItem
                      onClick={() => window.open(`/modules/documents?doc=${c.documentId}`, "_blank", "noopener,noreferrer")}
                      data-testid={`action-view-document-contract-${c.id}`}
                    >
                      <FileText className="h-3.5 w-3.5 mr-2" />
                      View linked document
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => requestSignoff(c)} data-testid={`action-signoff-contract-${c.id}`}>
                      <FileSignature className="h-3.5 w-3.5 mr-2" />
                      Send for sign-off
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => openEditForm(c)} data-testid={`action-link-document-contract-${c.id}`}>
                      <Link2 className="h-3.5 w-3.5 mr-2" />
                      Link document
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled
                      className="opacity-60"
                      data-testid={`action-signoff-disabled-contract-${c.id}`}
                    >
                      <FileSignature className="h-3.5 w-3.5 mr-2" />
                      Send for sign-off (needs document)
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    if (!window.confirm("Delete this contract?")) return;
                    deleteMutation.mutate(c.id);
                  }}
                  className="text-red-600 focus:text-red-700"
                  data-testid={`action-delete-contract-${c.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
        }}
      />

      <ImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        entityName="Contracts"
        templateHeaders={[...CONTRACT_IMPORT_HEADERS]}
        exampleRow={{ ...CONTRACT_IMPORT_EXAMPLE }}
        currentCount={contracts.length}
        onImport={async (rows, mode) => { await importMutation.mutateAsync({ rows, mode }); }}
      />

      <ContractFormDialog
        open={formOpen}
        onClose={closeForm}
        editing={editingContract}
        accounts={accounts}
      />
    </div>
  );
}
