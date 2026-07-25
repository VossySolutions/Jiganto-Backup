import { useState, useMemo, useCallback, useEffect } from "react";
import { useCrmPagination } from "@/hooks/use-crm-pagination";
import { CrmTablePagination } from "./CrmTablePagination";
import { type ColumnDef as MondayColumnDef, type StatusOption } from "@/components/MondayTable";
import { MondayBoardShell } from "@/components/board";
import { useMondayBoardShellState } from "@/hooks/use-monday-board-shell-state";
import {
  matchBoardFilterValue,
  type BoardFilterFieldDef,
  type BoardSortFieldDef,
  type BoardViewMode,
} from "@/lib/board-filters";
import { type FilterConfig, type SortConfig } from "./SavedViewsDropdown";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/ui/form-dialog-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Trash2,
  MoreHorizontal,
  Pencil,
  MapPin,
  Globe,
} from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { Textarea } from "@/components/ui/textarea";
import { CrmCustomFieldsForm } from "./CrmCustomFieldsForm";
import { useCrmCustomFields } from "@/hooks/use-crm-custom-fields";
import { ImportModal, type ImportMode } from "@/components/ImportModal";
import { type ConditionalFormatRule } from "@/lib/conditionalFormatting";
import {
  useDebouncedValue,
  buildCrmCustomFieldColumns,
  recordToMondayGroups,
  downloadBoardCsv,
  downloadImportTemplateCsv,
} from "@/lib/crm-monday-chrome";
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
import type { CrmColumnDef } from "@/lib/crm-list-columns";

const ACCOUNT_IMPORT_HEADERS = [
  "name", "type", "industry", "website", "phone", "email",
  "address", "city", "state", "country", "postalCode",
  "annualRevenue", "employeeCount", "description",
] as const;

const ACCOUNT_IMPORT_EXAMPLE: Record<string, string> = {
  name: "Acme Ltd",
  type: "customer",
  industry: "Technology",
  website: "https://acme.com",
  phone: "+44 20 7946 0958",
  email: "info@acme.com",
  address: "123 Tech Street",
  city: "London",
  state: "",
  country: "UK",
  postalCode: "EC1A 1BB",
  annualRevenue: "5000000",
  employeeCount: "250",
  description: "Strategic enterprise account",
};

const CUSTOMER_TABLE_COLUMNS: CrmColumnDef[] = [
  { id: "segment", label: "Segment" },
  { id: "industry", label: "Industry" },
  { id: "status", label: "Status" },
  { id: "revenue", label: "Annual Revenue" },
  { id: "email", label: "Email" },
  { id: "phone", label: "Phone" },
  { id: "created", label: "Created" },
];

const CUSTOMER_FILTER_FIELDS: BoardFilterFieldDef[] = [
  { field: "name", label: "Account", textInput: true },
  { field: "segment", label: "Segment" },
  { field: "industry", label: "Industry" },
  { field: "type", label: "Status" },
  { field: "dealStage", label: "Deal stage" },
  { field: "owner", label: "Owner" },
  { field: "email", label: "Email", textInput: true },
  { field: "revenue", label: "Revenue", textInput: true },
];

const CUSTOMER_SORT_FIELDS: BoardSortFieldDef[] = [
  { field: "name", label: "Name" },
  { field: "revenue", label: "Revenue" },
  { field: "segment", label: "Segment" },
  { field: "industry", label: "Industry" },
  { field: "created", label: "Created" },
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

function getCustomerFilterFieldValue(
  acc: {
    name: string;
    segment: string;
    industry: string | null;
    type: string;
    ownerUserId: string | null;
    email: string | null;
    revenueNum: number;
  },
  field: string,
): string {
  switch (field) {
    case "name":
      return acc.name || "";
    case "segment":
      return acc.segment || "";
    case "industry":
      return acc.industry || "";
    case "type":
      return acc.type || "";
    case "owner":
      return acc.ownerUserId || "__unassigned__";
    case "email":
      return acc.email || "";
    case "revenue":
      return String(acc.revenueNum ?? "");
    default:
      return "";
  }
}

function compareAccountsByRules<T extends {
  name: string;
  revenueNum: number;
  segment: string;
  industry: string | null;
  createdAt: string;
}>(a: T, b: T, rules: { field: string; dir: "asc" | "desc" }[]): number {
  for (const rule of rules) {
    const dir = rule.dir === "asc" ? 1 : -1;
    let cmp = 0;
    if (rule.field === "name") cmp = a.name.localeCompare(b.name);
    else if (rule.field === "revenue") cmp = a.revenueNum - b.revenueNum;
    else if (rule.field === "segment") cmp = a.segment.localeCompare(b.segment);
    else if (rule.field === "industry") cmp = (a.industry || "").localeCompare(b.industry || "");
    else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (cmp !== 0) return dir * cmp;
  }
  return 0;
}

function mapLegacyViewMode(saved: string): BoardViewMode | null {
  if (saved === "table") return "table";
  if (saved === "card") return "board";
  if (saved === "map") return "dashboard";
  return null;
}

export function CrmCustomersTab({ accounts, opportunities = [], contracts = [], stages = [], searchTerm, onSelectAccount }: CrmCustomersTabProps) {
  const { users, resolveOwner } = useCrmUsers();
  const { fields: customFields } = useCrmCustomFields("account");
  const segmentField = useMemo(() => findSegmentField(customFields), [customFields]);
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
  const [formatRules, setFormatRules] = useState<ConditionalFormatRule[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const EMPTY_CUSTOMER_FORM = { name: "", type: "prospect", industry: "", email: "", phone: "", website: "", address: "", city: "", state: "", country: "", postalCode: "", employeeCount: "", annualRevenue: "", description: "", parentAccountId: "", ownerUserId: "" };
  const [formData, setFormData] = useState(EMPTY_CUSTOMER_FORM);
  const [customData, setCustomData] = useState<Record<string, unknown>>({});
  const [importOpen, setImportOpen] = useState(false);
  const { toast } = useToast();

  const shell = useMondayBoardShellState({
    storageKey: "jiganto-crm-customers",
    columnDefs: CUSTOMER_TABLE_COLUMNS,
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

  useEffect(() => {
    const saved = sessionStorage.getItem("crm-customers-view");
    if (!saved) return;
    const mapped = mapLegacyViewMode(saved);
    sessionStorage.removeItem("crm-customers-view");
    if (mapped) setViewModePersist(mapped);
  }, [setViewModePersist]);

  const importMutation = useMutation({
    mutationFn: ({ rows, mode }: { rows: Record<string, string>[]; mode: ImportMode }) =>
      apiRequest("POST", "/api/crm/accounts/bulk-import", { rows, mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/accounts"] });
      toast({ title: "Customers imported successfully" });
    },
    onError: () => toast({ title: "Import failed", variant: "destructive" }),
  });

  const buildAccountPayload = (data: typeof formData) => {
    const nullIfEmpty = (v: string) => (v === "" ? null : v);
    const parseOptionalInt = (v: string) => {
      if (v === "") return null;
      const n = parseInt(v, 10);
      return Number.isNaN(n) ? null : n;
    };
    return {
      ...data,
      industry: nullIfEmpty(data.industry),
      email: nullIfEmpty(data.email),
      phone: nullIfEmpty(data.phone),
      website: nullIfEmpty(data.website),
      address: nullIfEmpty(data.address),
      city: nullIfEmpty(data.city),
      state: nullIfEmpty(data.state),
      country: nullIfEmpty(data.country),
      postalCode: nullIfEmpty(data.postalCode),
      ownerUserId: nullIfEmpty(data.ownerUserId),
      annualRevenue: nullIfEmpty(data.annualRevenue),
      description: nullIfEmpty(data.description),
      employeeCount: parseOptionalInt(data.employeeCount),
      parentAccountId: parseOptionalInt(data.parentAccountId),
      customData,
    };
  };

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/crm/accounts", buildAccountPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/accounts"] });
      setIsOpen(false);
      setEditingId(null);
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
      toast({ title: "Accounts deleted successfully" });
    },
    onError: () => toast({ title: "Failed to delete accounts", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Record<string, unknown> }) =>
      apiRequest("PUT", `/api/crm/accounts/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/accounts"] });
      setIsOpen(false);
      setEditingId(null);
      setFormData(EMPTY_CUSTOMER_FORM);
      setCustomData({});
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

  const accountTypeOptions = useMemo(
    () => accountTypeFilterOptions(accounts.map((a) => a.type)),
    [accounts],
  );

  const segmentOptions = useMemo(() => {
    const values = accounts.map((a) => resolveAccountSegment(a, segmentField));
    return segmentFilterOptions(segmentField, values);
  }, [accounts, segmentField]);

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

  const typeStatusOptions: StatusOption[] = useMemo(
    () =>
      CRM_ACCOUNT_TYPES.map((t) => ({
        value: t.value,
        label: t.label,
        color: t.color,
      })),
    [],
  );

  const personUsers = useMemo(
    () =>
      users.map((u) => {
        const o = resolveOwner(u.id);
        return { id: u.id, name: o.name, initials: o.initials, color: o.color };
      }),
    [users, resolveOwner],
  );

  const enrichedAccounts = useMemo(() => {
    let result = accounts.map(a => ({
      ...a,
      segment: resolveAccountSegment(a, segmentField),
      revenueNum: parseFloat(a.annualRevenue || "0"),
    }));

    const search = debouncedLocalSearch || searchTerm;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(a =>
        a.name.toLowerCase().includes(s) ||
        a.industry?.toLowerCase().includes(s) ||
        a.email?.toLowerCase().includes(s)
      );
    }

    if (ownerFilter === "__unassigned__") {
      result = result.filter((a) => !a.ownerUserId);
    } else if (ownerFilter !== "all") {
      result = result.filter((a) => a.ownerUserId === ownerFilter);
    }

    for (const rule of filterRules) {
      if ((rule.operator === "is" || rule.operator === "is_not" || rule.operator === "contains" || rule.operator === "not_contains" || rule.operator === "gt" || rule.operator === "lt") && !rule.value) {
        continue;
      }
      if (rule.field === "dealStage") {
        const stageId = parseInt(rule.value, 10);
        if (!Number.isFinite(stageId)) continue;
        const accountIds = new Set(
          opportunities
            .filter((o) => o.accountId && o.stageId === stageId)
            .map((o) => o.accountId!),
        );
        const matches = (a: { id: number }) => accountIds.has(a.id);
        if (rule.operator === "is_not") {
          result = result.filter((a) => !matches(a));
        } else {
          result = result.filter(matches);
        }
        continue;
      }
      result = result.filter((a) => {
        const raw = getCustomerFilterFieldValue(a, rule.field);
        const forEmpty = rule.field === "owner" ? a.ownerUserId || "" : raw;
        const fieldVal =
          rule.operator === "is_empty" || rule.operator === "is_not_empty" ? forEmpty : raw;
        return matchBoardFilterValue(fieldVal, rule.operator, rule.value);
      });
    }

    return [...result].sort((a, b) => compareAccountsByRules(a, b, sortRules));
  }, [
    accounts,
    opportunities,
    debouncedLocalSearch,
    searchTerm,
    segmentField,
    ownerFilter,
    filterRules,
    sortRules,
  ]);

  type EnrichedAccount = (typeof enrichedAccounts)[number];

  const paginationResetKey = `${debouncedLocalSearch}|${searchTerm}|${ownerFilter}|${JSON.stringify(filterRules)}|${JSON.stringify(sortRules)}|${groupBy}|${viewMode}`;

  const pagination = useCrmPagination(enrichedAccounts, {
    resetKey: paginationResetKey,
    enabled: viewMode === "board",
  });

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
    (): SortConfig[] =>
      sortRules.map((r) => ({ columnId: r.field, direction: r.dir })),
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

  const totalRevenue = enrichedAccounts.reduce((sum, a) => sum + a.revenueNum, 0);
  const uniqueIndustries = new Set(enrichedAccounts.filter(a => a.industry).map(a => a.industry));
  const activeCount = enrichedAccounts.filter(a => a.type === "customer").length;

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

  const mondayColumns: MondayColumnDef<EnrichedAccount>[] = useMemo(() => {
    const byId: Record<string, MondayColumnDef<EnrichedAccount>> = {
      name: {
        id: "name",
        header: "Account",
        type: "text",
        accessor: "name",
        width: "240px",
        editable: true,
      },
      segment: {
        id: "segment",
        header: "Segment",
        type: "text",
        accessor: "segment",
        width: "120px",
        hidden: !isColVisible("segment"),
        editable: false,
        render: (acc) => (
          <span className="text-sm" style={{ color: getSegmentColor(acc.segment) }}>{acc.segment}</span>
        ),
      },
      industry: {
        id: "industry",
        header: "Industry",
        type: "text",
        accessor: "industry",
        width: "140px",
        hidden: !isColVisible("industry"),
        editable: true,
      },
      status: {
        id: "status",
        header: "Status",
        type: "status",
        accessor: "type",
        width: "130px",
        hidden: !isColVisible("status"),
        editable: true,
        options: typeStatusOptions,
      },
      revenue: {
        id: "revenue",
        header: "Annual Revenue (ARR)",
        type: "currency",
        accessor: "annualRevenue",
        width: "140px",
        hidden: !isColVisible("revenue"),
        editable: true,
      },
      email: {
        id: "email",
        header: "Email",
        type: "text",
        accessor: "email",
        width: "180px",
        hidden: !isColVisible("email"),
        editable: true,
      },
      phone: {
        id: "phone",
        header: "Phone",
        type: "text",
        accessor: "phone",
        width: "140px",
        hidden: !isColVisible("phone"),
        editable: true,
      },
      created: {
        id: "created",
        header: "Since",
        type: "date",
        accessor: "createdAt",
        width: "90px",
        hidden: !isColVisible("created"),
        editable: false,
      },
    };

    const order = ["name", ...(columnOrderIds.length ? columnOrderIds : CUSTOMER_TABLE_COLUMNS.map((c) => c.id))];
    const customCols = buildCrmCustomFieldColumns<EnrichedAccount>(customFields, (id) => isColVisible(id), {
      editable: true,
    });
    for (const col of customCols) byId[col.id] = col;
    const seen = new Set<string>();
    const ordered: MondayColumnDef<EnrichedAccount>[] = [];
    for (const id of order) {
      if (seen.has(id) || !byId[id]) continue;
      seen.add(id);
      ordered.push(byId[id]);
    }
    for (const id of Object.keys(byId)) {
      if (!seen.has(id)) ordered.push(byId[id]);
    }

    return ordered;
  }, [customFields, isColVisible, typeStatusOptions, pinActive, columnOrderIds]);

  const tableGroups = useMemo(
    () => recordToMondayGroups(
      groupedData,
      groupColors,
      (items) => `$${items.reduce((s, a) => s + a.revenueNum, 0).toLocaleString()}`,
    ),
    [groupedData],
  );

  const handleCellEdit = useCallback(
    (rowId: number | string, columnId: string, value: unknown) => {
      const id = typeof rowId === "string" ? Number(rowId) : rowId;
      const updates: Record<string, unknown> = {};

      switch (columnId) {
        case "name":
          updates.name = String(value || "") || "Untitled";
          break;
        case "industry":
          updates.industry = value === "" || value == null ? null : String(value);
          break;
        case "status":
          updates.type = String(value || "prospect");
          break;
        case "revenue":
          updates.annualRevenue = value === "" || value == null ? null : String(value);
          break;
        case "email":
          updates.email = value === "" || value == null ? null : String(value);
          break;
        case "phone":
          updates.phone = value === "" || value == null ? null : String(value);
          break;
        default: {
          if (columnId.startsWith("custom_")) {
            const fieldName = columnId.replace(/^custom_/, "");
            const field = customFields.find((f) => f.fieldName === fieldName);
            const acc = accounts.find((a) => a.id === id);
            const prev =
              acc?.customData && typeof acc.customData === "object"
                ? { ...acc.customData }
                : {};
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

      updateMutation.mutate({ id, updates });
    },
    [updateMutation, customFields, accounts],
  );

  const getFilterFieldOptions = useCallback(
    (field: string) => {
      switch (field) {
        case "segment":
          return segmentOptions.map((seg) => ({ value: seg, label: seg }));
        case "industry":
          return industries.map((ind) => ({ value: ind, label: ind }));
        case "type":
          return accountTypeOptions.map((t) => ({ value: t.value, label: t.label }));
        case "dealStage":
          return openStageOptions.map((s) => ({ value: String(s.id), label: s.name }));
        case "owner":
          return [
            { value: "__unassigned__", label: "Unassigned" },
            ...users.map((u) => ({ value: u.id, label: resolveOwner(u.id).name })),
          ];
        default:
          return [];
      }
    },
    [segmentOptions, industries, accountTypeOptions, openStageOptions, users, resolveOwner],
  );

  const openCreate = () => {
    setEditingId(null);
    setFormData(EMPTY_CUSTOMER_FORM);
    setCustomData({});
    setIsOpen(true);
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
    setCustomData(
      acc.customData && typeof acc.customData === "object" ? { ...acc.customData } : {},
    );
    setIsOpen(true);
  };

  const exportToCSV = () => {
    const headers = [...ACCOUNT_IMPORT_HEADERS];
    const rows = enrichedAccounts.map((a) =>
      headers.map((h) => {
        switch (h) {
          case "name": return a.name || "";
          case "type": return a.type || "";
          case "industry": return a.industry || "";
          case "website": return a.website || "";
          case "phone": return a.phone || "";
          case "email": return a.email || "";
          case "address": return a.address || "";
          case "city": return a.city || "";
          case "state": return a.state || "";
          case "country": return a.country || "";
          case "postalCode": return a.postalCode || "";
          case "annualRevenue": return a.annualRevenue || "";
          case "employeeCount": return a.employeeCount != null ? String(a.employeeCount) : "";
          case "description": return a.description || "";
          default: return "";
        }
      }),
    );
    downloadBoardCsv(`customers-${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
    toast({ title: "Customers exported to CSV", description: "File uses the same columns as Import." });
  };

  const downloadImportTemplate = () => {
    downloadImportTemplateCsv("customers-import-template.csv", [...ACCOUNT_IMPORT_HEADERS], ACCOUNT_IMPORT_EXAMPLE);
    toast({ title: "Import template downloaded" });
  };

  const groupContent = (
    <>
      <DropdownMenuItem onClick={() => setGroupBy("none")} data-testid="group-customers-none">None</DropdownMenuItem>
      <DropdownMenuItem onClick={() => setGroupBy("segment")} data-testid="group-customers-segment">Segment</DropdownMenuItem>
      <DropdownMenuItem onClick={() => setGroupBy("industry")} data-testid="group-customers-industry">Industry</DropdownMenuItem>
      <DropdownMenuItem onClick={() => setGroupBy("type")} data-testid="group-customers-type">Status</DropdownMenuItem>
    </>
  );

  const renderCardView = () => (
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
  );

  const renderMapView = () => {
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
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard title="Total Accounts" value={enrichedAccounts.length} subtitle="Matching filters" helpText="Customer and prospect accounts shown after filters are applied." icon={CustomersIcon} testId="card-total-customers" />
        <MetricCard title="Annual Revenue (Accounts)" value={`$${totalRevenue.toLocaleString()}`} subtitle="Sum of ARR fields" helpText="Combined annual revenue values stored on account records — not closed-won deal revenue." icon={RevenueIcon} borderColor="#22c55e" valueClassName="text-[#22c55e]" testId="card-total-revenue" />
        <MetricCard title="Industries" value={uniqueIndustries.size} subtitle="Distinct sectors" helpText="Number of unique industry values across filtered accounts." icon={IndustryIcon} borderColor="#8b5cf6" valueClassName="text-[#8b5cf6]" testId="card-industries" />
        <MetricCard title="Customer Accounts" value={activeCount} subtitle='Type = "customer"' helpText='Accounts with type set to customer (not prospect or partner).' icon={GrowthIcon} borderColor="#f97316" valueClassName="text-[#f97316]" testId="card-active-customers" />
      </div>

      <MondayBoardShell<EnrichedAccount>
        storageKey="jiganto-crm-customers"
        entityType="accounts"
        customFieldEntityType="account"
        ownsCustomColumns
        isColumnVisible={isColVisible}
        testId="customers-board"
        viewSnapshot={viewSnapshot}
        onApplyViewSnapshot={applyViewSnapshot}
        mainTableSorts={[{ field: "name", dir: "asc" }]}
        newLabel="New Customer"
        onNew={openCreate}
        newTestId="button-add-customer"
        searchValue={localSearch}
        onSearchChange={setLocalSearch}
        searchTestId="input-search-customers"
        personUsers={personUsers}
        personValue={ownerFilter}
        onPersonChange={setOwnerFilter}
        viewMode={viewMode}
        onViewModeChange={setViewModePersist}
        viewModes={["table", "board", "dashboard"]}
        filterRules={filterRules}
        onFilterRulesChange={setFilterRules}
        filterFields={CUSTOMER_FILTER_FIELDS}
        getFilterFieldOptions={getFilterFieldOptions}
        filterOpen={filterOpen}
        onFilterOpenChange={setFilterOpen}
        sortRules={sortRules}
        sortFields={CUSTOMER_SORT_FIELDS}
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
        pinTitle={pinActive ? "Unpin Account column" : "Pin Account column"}
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
        renderAlternateView={(mode) => {
          if (mode === "board") return renderCardView();
          if (mode === "dashboard") return renderMapView();
          return null;
        }}
        tableProps={{
          columns: mondayColumns,
          data: enrichedAccounts,
          groups: tableGroups,
          conditionalFormatRules: formatRules,
          onConditionalFormatRulesChange: setFormatRules,
          emptyMessage: "No customers found. Create your first account to start managing relationships.",
          addItemLabel: "New Customer",
          onAddItem: openCreate,
          onOpenItem: onSelectAccount,
          onEditItem: handleEdit,
          onCellEdit: handleCellEdit,
          onDeleteItems: (ids) => {
            const n = ids.length;
            if (!window.confirm(n === 1 ? "Delete this account?" : `Delete ${n} accounts?`)) return;
            if (ids.length === 1) {
              deleteMutation.mutate(Number(ids[0]));
            } else {
              bulkDeleteMutation.mutate(ids.map(Number));
            }
          },
          searchHighlightTerm: searchTerm || debouncedLocalSearch,
          columnWidthStorageKey: "jiganto-crm-customers-col-widths",
          paginationResetKey,
          totalCount: accounts.length,
          renderRowActions: (acc) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()} data-testid={`button-actions-customer-${acc.id}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEdit(acc)} data-testid={`action-edit-customer-${acc.id}`}>
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (!window.confirm("Delete this account?")) return;
                    deleteMutation.mutate(acc.id);
                  }}
                  className="text-red-600 focus:text-red-700"
                  data-testid={`action-delete-customer-${acc.id}`}
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
        entityName="Customers"
        templateHeaders={[...ACCOUNT_IMPORT_HEADERS]}
        exampleRow={{ ...ACCOUNT_IMPORT_EXAMPLE }}
        currentCount={accounts.length}
        onImport={async (rows, mode) => { await importMutation.mutateAsync({ rows, mode }); }}
      />

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
          if (editingId) {
            updateMutation.mutate({ id: editingId, updates: buildAccountPayload(formData) });
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
  );
}
