import { useState, useMemo, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/ui/form-dialog-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MetricCard } from "@/components/ui/metric-card";
import { useToast } from "@/hooks/use-toast";
import {
  Trash2, UserCheck,
  MoreHorizontal, Pencil, Copy, Archive, Briefcase, Users, ChevronDown,
} from "lucide-react";
import { OpportunityFormDialog } from "@/components/crm/OpportunityFormDialog";
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
import { opportunityMatchesPipeline, stagesForActivePipeline } from "@/lib/crm-tab-counts";
import { type FilterConfig, type SortConfig } from "./SavedViewsDropdown";
import { useCrmCustomFields } from "@/hooks/use-crm-custom-fields";
import { findSegmentField, getSegmentColor, resolveAccountSegment } from "@/lib/crm-segment";
import { useCrmUsers } from "./CrmUsersProvider";
import type { CrmAccount, CrmPipeline, CrmOpportunity, CrmOpportunityStage, CrmContactPicklist } from "./types";
import {
  useDebouncedValue,
  buildCrmCustomFieldColumns,
  recordToMondayGroups,
  downloadBoardCsv,
  downloadImportTemplateCsv,
} from "@/lib/crm-monday-chrome";
import type { CrmColumnDef } from "@/lib/crm-list-columns";

const OPP_IMPORT_HEADERS = [
  "name", "description", "amount", "probability", "expectedCloseDate",
  "type", "source", "nextStep", "stageName", "accountName",
] as const;

const OPP_IMPORT_EXAMPLE: Record<string, string> = {
  name: "Acme ERP Upgrade",
  description: "Full ERP modernisation project",
  amount: "125000",
  probability: "60",
  expectedCloseDate: "2026-09-30",
  type: "new_business",
  source: "Referral",
  nextStep: "Technical workshop",
  stageName: "Proposal",
  accountName: "Acme Ltd",
};

const OPP_TABLE_COLUMNS: CrmColumnDef[] = [
  { id: "account", label: "Account" },
  { id: "segment", label: "Segment" },
  { id: "stage", label: "Stage" },
  { id: "amount", label: "Amount" },
  { id: "probability", label: "Probability" },
  { id: "owner", label: "Owner" },
  { id: "closeDate", label: "Close Date" },
  { id: "created", label: "Created" },
];

const OPP_FILTER_FIELDS: BoardFilterFieldDef[] = [
  { field: "name", label: "Opportunity", textInput: true },
  { field: "account", label: "Account", textInput: true },
  { field: "stage", label: "Stage" },
  { field: "owner", label: "Owner" },
  { field: "amount", label: "Amount", textInput: true },
  { field: "probability", label: "Probability", textInput: true },
  { field: "closing", label: "Closing window" },
];

const OPP_SORT_FIELDS: BoardSortFieldDef[] = [
  { field: "created", label: "Created" },
  { field: "name", label: "Name" },
  { field: "amount", label: "Amount" },
  { field: "probability", label: "Probability" },
  { field: "closeDate", label: "Close Date" },
];

interface CrmOpportunitiesTabProps {
  opportunities: CrmOpportunity[];
  stages: CrmOpportunityStage[];
  accounts: CrmAccount[];
  pipelines: CrmPipeline[];
  contacts: CrmContactPicklist[];
  searchTerm?: string;
  onNavigateToTab?: (tab: string) => void;
  onOpenCustomFieldsSettings?: () => void;
  onNavigateToResourcePlan?: (opportunityId: number, planId?: number | null) => void;
}

const STAGE_STATUS_COLORS: Record<string, string> = {
  Prospect: "#3b82f6",
  Qualification: "#06b6d4",
  Proposal: "#f59e0b",
  Negotiation: "#f97316",
  "Closed Won": "#22c55e",
  "Closed Lost": "#ef4444",
};

function OpportunityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="white" stroke="#ef4444" strokeWidth="1.5"/>
      <circle cx="8" cy="8" r="5" fill="#fee2e2" stroke="#ef4444" strokeWidth="1"/>
      <circle cx="8" cy="8" r="3" fill="#fecaca" stroke="#ef4444" strokeWidth="1"/>
      <circle cx="8" cy="8" r="1.5" fill="#ef4444"/>
    </svg>
  );
}

function DollarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#22c55e"/>
      <text x="8" y="12" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">$</text>
    </svg>
  );
}

function WeightedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#8b5cf6"/>
      <path d="M5 10L8 4L11 10H5Z" fill="white" fillOpacity="0.9"/>
      <rect x="4.5" y="11" width="7" height="1.5" rx="0.5" fill="white" fillOpacity="0.7"/>
    </svg>
  );
}

function AvgDealIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none">
      <rect x="1" y="8" width="3.5" height="6" rx="1" fill="#f97316"/>
      <rect x="6.25" y="5" width="3.5" height="9" rx="1" fill="#f97316" fillOpacity="0.7"/>
      <rect x="11.5" y="2" width="3.5" height="12" rx="1" fill="#f97316" fillOpacity="0.5"/>
      <line x1="1" y1="7" x2="15" y2="3" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2"/>
    </svg>
  );
}

function getOppFilterFieldValue(
  opp: {
    name: string;
    accountName: string;
    stageName: string;
    ownerUserId: string | null;
    amountNum: number;
    probabilityNum: number;
    expectedCloseDate: string | null;
  },
  field: string,
): string {
  switch (field) {
    case "name":
      return opp.name || "";
    case "account":
      return opp.accountName || "";
    case "stage":
      return opp.stageName || "";
    case "owner":
      return opp.ownerUserId || "__unassigned__";
    case "amount":
      return String(opp.amountNum ?? "");
    case "probability":
      return String(opp.probabilityNum ?? "");
    case "closing":
      return "";
    default:
      return "";
  }
}

function compareOppsByRules<T extends {
  name: string;
  amountNum: number;
  probabilityNum: number;
  expectedCloseDate: string | null;
  createdAt: string;
}>(a: T, b: T, rules: { field: string; dir: "asc" | "desc" }[]): number {
  for (const rule of rules) {
    const dir = rule.dir === "asc" ? 1 : -1;
    let cmp = 0;
    if (rule.field === "name") cmp = a.name.localeCompare(b.name);
    else if (rule.field === "amount") cmp = a.amountNum - b.amountNum;
    else if (rule.field === "probability") cmp = a.probabilityNum - b.probabilityNum;
    else if (rule.field === "closeDate") {
      const aDate = a.expectedCloseDate ? new Date(a.expectedCloseDate).getTime() : 0;
      const bDate = b.expectedCloseDate ? new Date(b.expectedCloseDate).getTime() : 0;
      cmp = aDate - bDate;
    } else {
      cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (cmp !== 0) return dir * cmp;
  }
  return 0;
}

export function CrmOpportunitiesTab({
  opportunities,
  stages,
  accounts,
  pipelines,
  contacts,
  searchTerm = "",
  onNavigateToTab,
  onOpenCustomFieldsSettings,
  onNavigateToResourcePlan,
}: CrmOpportunitiesTabProps) {
  const { users, resolveOwner } = useCrmUsers();
  const { fields: customFields } = useCrmCustomFields("opportunity");
  const { fields: accountCustomFields } = useCrmCustomFields("account");
  const segmentField = useMemo(() => findSegmentField(accountCustomFields), [accountCustomFields]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<CrmOpportunity | null>(null);
  const [isCreatePipelineOpen, setIsCreatePipelineOpen] = useState(false);
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);
  const [pipelineName, setPipelineName] = useState("");
  const [formatRules, setFormatRules] = useState<ConditionalFormatRule[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const { toast } = useToast();

  const shell = useMondayBoardShellState({
    storageKey: "jiganto-crm-opportunities",
    columnDefs: OPP_TABLE_COLUMNS,
    defaultSortField: "created",
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

  const runOppAction = async (request: () => Promise<Response>, successTitle: string) => {
    try {
      const res = await request();
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message || "Request failed");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
      toast({ title: successTitle });
    } catch (e: unknown) {
      toast({
        title: "Action failed",
        description: e instanceof Error ? e.message : "Please try again",
        variant: "destructive",
      });
    }
  };

  const importMutation = useMutation({
    mutationFn: ({ rows, mode }: { rows: Record<string, string>[]; mode: ImportMode }) =>
      apiRequest("POST", "/api/crm/opportunities/bulk-import", { rows, mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
      toast({ title: "Opportunities imported successfully" });
    },
    onError: () => toast({ title: "Import failed", variant: "destructive" }),
  });

  const updateOpportunityMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Partial<CrmOpportunity> }) =>
      apiRequest("PUT", `/api/crm/opportunities/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
    },
    onError: () => toast({ title: "Failed to update opportunity", variant: "destructive" }),
  });

  const activePipelineId = selectedPipelineId || pipelines.find((p) => p.isDefault)?.id || pipelines[0]?.id || null;
  const pipelineStages = stagesForActivePipeline(stages, pipelines, activePipelineId);
  const formStages = pipelineStages;

  const stageStatusOptions: StatusOption[] = useMemo(
    () =>
      pipelineStages.map((s) => ({
        value: String(s.id),
        label: s.name,
        color: s.color || STAGE_STATUS_COLORS[s.name] || "#64748b",
      })),
    [pipelineStages],
  );

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

  const createPipelineMutation = useMutation({
    mutationFn: (data: { name: string }) => apiRequest("POST", "/api/crm/pipelines", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/pipelines"] });
      setIsCreatePipelineOpen(false);
      setPipelineName("");
      toast({ title: "Pipeline created successfully" });
    },
    onError: () => toast({ title: "Failed to create pipeline", variant: "destructive" }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map((id) => apiRequest("DELETE", `/api/crm/opportunities/${id}`))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
      toast({ title: "Opportunities deleted successfully" });
    },
    onError: () => toast({ title: "Failed to delete opportunities", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/crm/opportunities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
      toast({ title: "Opportunity deleted" });
    },
    onError: () => toast({ title: "Failed to delete opportunity", variant: "destructive" }),
  });

  const openCreateForm = () => {
    setEditingOpportunity(null);
    setFormOpen(true);
  };

  const pipelineOpportunities = useMemo(
    () =>
      opportunities.filter((o) =>
        opportunityMatchesPipeline(o, stages, pipelines, activePipelineId),
      ),
    [opportunities, stages, pipelines, activePipelineId],
  );

  const enrichedOpportunities = useMemo(() => {
    let result = pipelineOpportunities.map((opp) => {
      const account = accounts.find((a) => a.id === opp.accountId);
      const stage = stages.find((s) => s.id === opp.stageId);
      return {
        ...opp,
        accountName: account?.name || "?",
        accountSegment: account ? resolveAccountSegment(account, segmentField) : "?",
        stage,
        stageName: stage?.name || "?",
        amountNum: parseFloat(opp.amount || "0"),
        probabilityNum: opp.probability ?? stage?.probability ?? 0,
      };
    });

    const effectiveSearch = searchTerm || debouncedLocalSearch;
    if (effectiveSearch) {
      const s = effectiveSearch.toLowerCase();
      result = result.filter(
        (o) =>
          o.name.toLowerCase().includes(s) ||
          o.accountName.toLowerCase().includes(s) ||
          o.stageName.toLowerCase().includes(s),
      );
    }

    if (ownerFilter === "__unassigned__") {
      result = result.filter((o) => !o.ownerUserId);
    } else if (ownerFilter !== "all") {
      result = result.filter((o) => o.ownerUserId === ownerFilter);
    }

    for (const rule of filterRules) {
      if ((rule.operator === "is" || rule.operator === "is_not" || rule.operator === "contains" || rule.operator === "not_contains" || rule.operator === "gt" || rule.operator === "lt") && !rule.value) {
        continue;
      }
      if (rule.field === "closing") {
        if (rule.value === "this-month" && (rule.operator === "is" || !rule.operator)) {
          const now = new Date();
          const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          result = result.filter((o) => {
            if (!o.expectedCloseDate) return false;
            const closeDate = new Date(o.expectedCloseDate);
            return closeDate >= now && closeDate <= endOfMonth;
          });
        }
        continue;
      }
      result = result.filter((o) => {
        const raw = getOppFilterFieldValue(o, rule.field);
        const forEmpty = rule.field === "owner" ? o.ownerUserId || "" : raw;
        const fieldVal =
          rule.operator === "is_empty" || rule.operator === "is_not_empty" ? forEmpty : raw;
        return matchBoardFilterValue(fieldVal, rule.operator, rule.value);
      });
    }

    return [...result].sort((a, b) => compareOppsByRules(a, b, sortRules));
  }, [
    pipelineOpportunities,
    accounts,
    stages,
    debouncedLocalSearch,
    searchTerm,
    segmentField,
    ownerFilter,
    filterRules,
    sortRules,
  ]);

  type EnrichedOpp = (typeof enrichedOpportunities)[number];

  const handleEdit = (opp: EnrichedOpp) => {
    setEditingOpportunity(opp as CrmOpportunity);
    setFormOpen(true);
  };

  const totalValue = enrichedOpportunities.reduce((sum, o) => sum + o.amountNum, 0);
  const weightedValue = enrichedOpportunities.reduce(
    (sum, o) => sum + (o.amountNum * o.probabilityNum) / 100,
    0,
  );
  const avgDeal =
    enrichedOpportunities.length > 0
      ? Math.round(totalValue / enrichedOpportunities.length)
      : 0;

  const groupedData = useMemo(() => {
    if (groupBy === "none") return null;
    const groups: Record<string, EnrichedOpp[]> = {};
    for (const opp of enrichedOpportunities) {
      let key: string;
      if (groupBy === "stage") key = opp.stageName;
      else if (groupBy === "account") key = opp.accountName;
      else if (groupBy === "owner") key = resolveOwner(opp.ownerUserId).name;
      else if (opp.probabilityNum >= 75) key = "High (75%+)";
      else if (opp.probabilityNum >= 50) key = "Medium (50-74%)";
      else if (opp.probabilityNum >= 25) key = "Low (25-49%)";
      else key = "Very Low (<25%)";
      if (!groups[key]) groups[key] = [];
      groups[key].push(opp);
    }
    return groups;
  }, [enrichedOpportunities, groupBy, resolveOwner]);

  const groupColors: Record<string, string> = {
    "High (75%+)": "#22c55e",
    "Medium (50-74%)": "#f59e0b",
    "Low (25-49%)": "#f97316",
    "Very Low (<25%)": "#ef4444",
    Prospect: "#3b82f6",
    Qualification: "#06b6d4",
    Proposal: "#f59e0b",
    Negotiation: "#f97316",
    "Closed Won": "#22c55e",
    "Closed Lost": "#ef4444",
  };

  const mondayColumns: MondayColumnDef<EnrichedOpp>[] = useMemo(() => {
    const byId: Record<string, MondayColumnDef<EnrichedOpp>> = {
      name: {
        id: "name",
        header: "Opportunity",
        type: "text",
        accessor: "name",
        width: "240px",
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
      },
      segment: {
        id: "segment",
        header: "Segment",
        type: "text",
        accessor: (row) => row.accountSegment,
        width: "120px",
        hidden: !isColVisible("segment"),
        editable: false,
        render: (opp) => (
          <span className="text-sm" style={{ color: getSegmentColor(opp.accountSegment) }}>
            {opp.accountSegment}
          </span>
        ),
      },
      stage: {
        id: "stage",
        header: "Stage",
        type: "status",
        accessor: (row) => (row.stageId != null ? String(row.stageId) : ""),
        width: "140px",
        hidden: !isColVisible("stage"),
        editable: true,
        options: stageStatusOptions,
      },
      amount: {
        id: "amount",
        header: "Amount",
        type: "currency",
        accessor: "amount",
        width: "120px",
        hidden: !isColVisible("amount"),
        editable: true,
        summary: "sum",
      },
      probability: {
        id: "probability",
        header: "Probability",
        type: "number",
        accessor: (row) => row.probabilityNum,
        width: "120px",
        hidden: !isColVisible("probability"),
        editable: true,
        summary: "avg",
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
      closeDate: {
        id: "closeDate",
        header: "Close Date",
        type: "date",
        accessor: "expectedCloseDate",
        width: "130px",
        hidden: !isColVisible("closeDate"),
        editable: true,
      },
      created: {
        id: "created",
        header: "Created",
        type: "date",
        accessor: "createdAt",
        width: "110px",
        hidden: !isColVisible("created"),
        editable: false,
      },
    };

    const order = ["name", ...(columnOrderIds.length ? columnOrderIds : OPP_TABLE_COLUMNS.map((c) => c.id))];
    const customCols = buildCrmCustomFieldColumns<EnrichedOpp>(customFields, (id) => isColVisible(id), {
      editable: true,
    });
    for (const col of customCols) byId[col.id] = col;
    const seen = new Set<string>();
    const ordered: MondayColumnDef<EnrichedOpp>[] = [];
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
    customFields,
    isColVisible,
    stageStatusOptions,
    ownerSelectOptions,
    pinActive,
    columnOrderIds,
  ]);

  const tableGroups = useMemo(
    () =>
      recordToMondayGroups(
        groupedData,
        groupColors,
        (items) => `$${items.reduce((s, o) => s + o.amountNum, 0).toLocaleString()}`,
      ),
    [groupedData],
  );

  const handleCellEdit = useCallback(
    (rowId: number | string, columnId: string, value: unknown) => {
      const id = typeof rowId === "string" ? Number(rowId) : rowId;
      const updates: Partial<CrmOpportunity> & { customData?: Record<string, unknown> } = {};

      switch (columnId) {
        case "name":
          updates.name = String(value || "") || "Untitled";
          break;
        case "stage": {
          const stageId = value ? parseInt(String(value), 10) : null;
          const stage = stages.find((s) => s.id === stageId);
          updates.stageId = stageId;
          if (stage?.probability != null) updates.probability = stage.probability;
          break;
        }
        case "amount":
          updates.amount =
            value === "" || value == null ? null : String(value);
          break;
        case "probability":
          updates.probability =
            value === "" || value == null ? null : Number(value);
          break;
        case "owner":
          updates.ownerUserId = String(value || "") || null;
          break;
        case "closeDate":
          updates.expectedCloseDate = value ? String(value) : null;
          break;
        default: {
          if (columnId.startsWith("custom_")) {
            const fieldName = columnId.replace(/^custom_/, "");
            const field = customFields.find((f) => f.fieldName === fieldName);
            const opp = opportunities.find((o) => o.id === id);
            const prev =
              opp?.customData && typeof opp.customData === "object"
                ? { ...opp.customData }
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

      updateOpportunityMutation.mutate({ id, updates });
    },
    [updateOpportunityMutation, stages, customFields, opportunities],
  );

  const getFilterFieldOptions = useCallback(
    (field: string) => {
      switch (field) {
        case "stage":
          return pipelineStages.map((s) => ({ value: s.name, label: s.name }));
        case "owner":
          return [
            { value: "__unassigned__", label: "Unassigned" },
            ...users.map((u) => ({ value: u.id, label: resolveOwner(u.id).name })),
          ];
        case "closing":
          return [{ value: "this-month", label: "Closing this month" }];
        case "account":
          return Array.from(new Set(enrichedOpportunities.map((o) => o.accountName).filter(Boolean))).map(
            (v) => ({ value: v, label: v }),
          );
        default:
          return [];
      }
    },
    [pipelineStages, users, resolveOwner, enrichedOpportunities],
  );

  const currentFilters = useMemo((): FilterConfig[] => {
    const filters: FilterConfig[] = filterRules.map((r) => ({
      columnId: r.field,
      operator: (r.operator === "contains" || r.operator === "not_contains"
        ? "contains"
        : r.operator === "gt"
          ? "greaterThan"
          : r.operator === "lt"
            ? "lessThan"
            : "equals") as FilterConfig["operator"],
      value: r.value,
    }));
    if (activePipelineId) {
      filters.push({ columnId: "pipeline", operator: "equals", value: String(activePipelineId) });
    }
    return filters;
  }, [filterRules, activePipelineId]);

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
    setSelectedPipelineId(null);
    const nextRules = filters
      .filter((f) => f.columnId !== "pipeline")
      .map((f, i) => ({
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
    for (const f of filters) {
      if (f.columnId === "pipeline") setSelectedPipelineId(parseInt(f.value, 10));
    }
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
    const headers = [...OPP_IMPORT_HEADERS];
    const rows = enrichedOpportunities.map((o) => {
      const raw = o as EnrichedOpp & {
        description?: string | null;
        type?: string | null;
        source?: string | null;
        nextStep?: string | null;
      };
      return headers.map((h) => {
        switch (h) {
          case "name":
            return o.name || "";
          case "description":
            return raw.description || "";
          case "amount":
            return o.amount || "";
          case "probability":
            return String(o.probabilityNum ?? "");
          case "expectedCloseDate":
            return o.expectedCloseDate || "";
          case "type":
            return raw.type || "";
          case "source":
            return raw.source || "";
          case "nextStep":
            return raw.nextStep || "";
          case "stageName":
            return o.stageName || "";
          case "accountName":
            return o.accountName || "";
          default:
            return "";
        }
      });
    });
    downloadBoardCsv(
      `opportunities-${new Date().toISOString().split("T")[0]}.csv`,
      headers,
      rows,
    );
    toast({
      title: "Opportunities exported to CSV",
      description: "File uses the same columns as Import.",
    });
  };

  const downloadImportTemplate = () => {
    downloadImportTemplateCsv(
      "opportunities-import-template.csv",
      [...OPP_IMPORT_HEADERS],
      OPP_IMPORT_EXAMPLE,
    );
    toast({ title: "Import template downloaded" });
  };

  const groupContent = (
    <>
      <DropdownMenuItem onClick={() => setGroupBy("none")} data-testid="group-opp-none">
        None
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setGroupBy("stage")} data-testid="group-opp-stage">
        Stage
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setGroupBy("account")} data-testid="group-opp-account">
        Account
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setGroupBy("probability")} data-testid="group-opp-probability">
        Probability
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setGroupBy("owner")} data-testid="group-opp-owner">
        Owner
      </DropdownMenuItem>
    </>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          title="Opportunities"
          value={enrichedOpportunities.length}
          subtitle="Matching current filters"
          helpText="Count of opportunities shown in the table below, after pipeline, stage, and search filters are applied."
          icon={OpportunityIcon}
          testId="card-opp-count"
        />
        <MetricCard
          title="Total Value"
          value={`$${totalValue.toLocaleString()}`}
          subtitle="Sum of deal amounts"
          helpText="Combined amount of all filtered opportunities before probability weighting."
          icon={DollarIcon}
          borderColor="#22c55e"
          valueClassName="text-[#22c55e]"
          testId="card-total-value"
        />
        <MetricCard
          title="Weighted Value"
          value={`$${weightedValue.toLocaleString()}`}
          subtitle="Amount ? probability"
          helpText="Expected revenue: each deal amount multiplied by its win probability (from stage or deal field)."
          icon={WeightedIcon}
          borderColor="#8b5cf6"
          valueClassName="text-[#8b5cf6]"
          testId="card-weighted-value"
        />
        <MetricCard
          title="Avg Deal Size"
          value={`$${avgDeal.toLocaleString()}`}
          subtitle="Per opportunity"
          helpText="Average deal amount across the filtered opportunities. Useful for spotting outliers."
          icon={AvgDealIcon}
          borderColor="#f97316"
          testId="card-avg-deal"
        />
      </div>

      <MondayBoardShell<EnrichedOpp>
        storageKey="jiganto-crm-opportunities"
        entityType="opportunity"
        ownsCustomColumns
        isColumnVisible={isColVisible}
        testId="opp-board"
        viewSnapshot={viewSnapshot}
        onApplyViewSnapshot={applyViewSnapshot}
        mainTableSorts={[{ field: "created", dir: "desc" }]}
        newLabel="New Opportunity"
        onNew={openCreateForm}
        newTestId="button-add-opportunity-table"
        afterNewSlot={
          pipelines.length > 0 ? (
            <Select
              value={activePipelineId?.toString() || ""}
              onValueChange={(v) => setSelectedPipelineId(parseInt(v, 10))}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs" data-testid="select-pipeline-opp">
                <SelectValue placeholder="Pipeline" />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id.toString()}>
                    {pipeline.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : undefined
        }
        searchValue={localSearch}
        onSearchChange={setLocalSearch}
        searchTestId="input-search-opp"
        personUsers={personUsers}
        personValue={ownerFilter}
        onPersonChange={setOwnerFilter}
        viewMode={viewMode}
        onViewModeChange={setViewModePersist}
        filterRules={filterRules}
        onFilterRulesChange={setFilterRules}
        filterFields={OPP_FILTER_FIELDS}
        getFilterFieldOptions={getFilterFieldOptions}
        filterOpen={filterOpen}
        onFilterOpenChange={setFilterOpen}
        sortRules={sortRules}
        sortFields={OPP_SORT_FIELDS}
        onSortToggle={onSortToggle}
        onSortAdd={onSortAdd}
        onSortRemove={onSortRemove}
        defaultSortField="created"
        groupContent={groupContent}
        groupActive={groupBy !== "none"}
        groupLabel={groupBy === "none" ? "Group by" : `Group by ${groupBy}`}
        grouped={groupBy !== "none"}
        pinActive={pinActive}
        onPinToggle={togglePin}
        pinTitle={pinActive ? "Unpin Opportunity column" : "Pin Opportunity column"}
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
        moreMenuItems={
          <DropdownMenuItem
            onClick={() => setIsCreatePipelineOpen(true)}
            data-testid="button-create-pipeline-opp"
          >
            Add pipeline?
          </DropdownMenuItem>
        }
        tableProps={{
          columns: mondayColumns,
          data: enrichedOpportunities,
          groups: tableGroups,
          conditionalFormatRules: formatRules,
          onConditionalFormatRulesChange: setFormatRules,
          emptyMessage: "No opportunities found. Create your first deal to start tracking.",
          addItemLabel: "New Opportunity",
          onAddItem: () => openCreateForm(),
          onEditItem: handleEdit,
          onCellEdit: handleCellEdit,
          onDeleteItems: (ids) => {
            const n = ids.length;
            if (
              !window.confirm(
                n === 1 ? "Delete this opportunity?" : `Delete ${n} opportunities?`,
              )
            )
              return;
            if (ids.length === 1) {
              deleteMutation.mutate(Number(ids[0]));
            } else {
              bulkDeleteMutation.mutate(ids.map(Number));
            }
          },
          searchHighlightTerm: searchTerm || debouncedLocalSearch,
          columnWidthStorageKey: "jiganto-crm-opportunities-col-widths",
          paginationResetKey: `${searchTerm}|${debouncedLocalSearch}|${ownerFilter}|${JSON.stringify(filterRules)}|${JSON.stringify(sortRules)}|${groupBy}|${activePipelineId}`,
          totalCount: opportunities.length,
          renderRowActions: (opp) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`button-actions-opp-${opp.id}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleEdit(opp)}
                  data-testid={`action-edit-opp-${opp.id}`}
                >
                  <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    sessionStorage.setItem("crm-resource-plan-opp-id", String(opp.id));
                    onNavigateToTab?.("resourceplan");
                    onNavigateToResourcePlan?.(opp.id);
                  }}
                  data-testid={`action-resource-plan-opp-${opp.id}`}
                >
                  <Users className="h-3.5 w-3.5 mr-2" /> Resource Plan
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    runOppAction(
                      () => apiRequest("POST", `/api/crm/opportunities/${opp.id}/clone`),
                      "Opportunity cloned",
                    )
                  }
                  data-testid={`action-clone-opp-${opp.id}`}
                >
                  <Copy className="h-3.5 w-3.5 mr-2" /> Clone
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    runOppAction(
                      () =>
                        apiRequest("POST", `/api/crm/opportunities/${opp.id}/convert-to-project`),
                      "Converted to project",
                    )
                  }
                  data-testid={`action-convert-opp-${opp.id}`}
                >
                  <Briefcase className="h-3.5 w-3.5 mr-2" /> Convert to Project
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    runOppAction(
                      () => apiRequest("POST", `/api/crm/opportunities/${opp.id}/archive`),
                      "Opportunity archived",
                    )
                  }
                  data-testid={`action-archive-opp-${opp.id}`}
                >
                  <Archive className="h-3.5 w-3.5 mr-2" /> Archive
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (!window.confirm("Delete this opportunity?")) return;
                    deleteMutation.mutate(opp.id);
                  }}
                  className="text-red-600 focus:text-red-700"
                  data-testid={`action-delete-opp-${opp.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
          renderBulkActions: (ids) => (
            <div className="flex items-center gap-1.5 flex-wrap">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-7 text-xs"
                    data-testid="button-bulk-stage"
                  >
                    <UserCheck className="h-3 w-3" />
                    Change Stage
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {pipelineStages.map((stage) => (
                    <DropdownMenuItem
                      key={stage.id}
                      onClick={async () => {
                        try {
                          const results = await Promise.all(
                            ids.map((id) =>
                              apiRequest("PUT", `/api/crm/opportunities/${id}`, {
                                stageId: stage.id,
                              }),
                            ),
                          );
                          if (results.some((r) => !r.ok)) throw new Error("Some updates failed");
                          queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
                          toast({
                            title: `${ids.length} opportunities moved to ${stage.name}`,
                          });
                        } catch {
                          toast({ title: "Failed to update stages", variant: "destructive" });
                        }
                      }}
                    >
                      {stage.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ),
        }}
      />

      <FormDialogShell
        open={isCreatePipelineOpen}
        onOpenChange={setIsCreatePipelineOpen}
        title="Create New Pipeline"
        subtitle="Add a pipeline for opportunity workflows"
        saveLabel={createPipelineMutation.isPending ? "Creating..." : "Create Pipeline"}
        onCancel={() => setIsCreatePipelineOpen(false)}
        onSubmit={() => createPipelineMutation.mutate({ name: pipelineName })}
        saving={createPipelineMutation.isPending}
        disabled={!pipelineName}
        saveTestId="button-save-pipeline-opp"
        size="sm"
      >
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="pipelineNameOpp">Pipeline Name *</Label>
            <Input
              id="pipelineNameOpp"
              value={pipelineName}
              onChange={(e) => setPipelineName(e.target.value)}
              placeholder="e.g., Enterprise Sales, SMB Sales"
              data-testid="input-pipeline-name-opp"
            />
          </div>
        </div>
      </FormDialogShell>

      <ImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        entityName="Opportunities"
        templateHeaders={[...OPP_IMPORT_HEADERS]}
        exampleRow={{ ...OPP_IMPORT_EXAMPLE }}
        currentCount={opportunities.length}
        onImport={async (rows, mode) => {
          await importMutation.mutateAsync({ rows, mode });
        }}
      />

      <OpportunityFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingOpportunity(null);
        }}
        editing={editingOpportunity}
        stages={formStages}
        accounts={accounts}
        contacts={contacts}
        onOpenCustomFieldsSettings={() => {
          setFormOpen(false);
          setEditingOpportunity(null);
          onOpenCustomFieldsSettings?.();
        }}
        onNavigateToResourcePlan={(oppId, planId) => {
          sessionStorage.setItem("crm-resource-plan-opp-id", String(oppId));
          if (planId) sessionStorage.setItem("crm-resource-plan-id", String(planId));
          setFormOpen(false);
          setEditingOpportunity(null);
          onNavigateToResourcePlan?.(oppId, planId);
          onNavigateToTab?.("resourceplan");
        }}
      />
    </div>
  );
}
