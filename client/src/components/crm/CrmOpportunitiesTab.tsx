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
  ChevronDown, X, Trash2, UserCheck, Paintbrush, Calendar,
  MoreHorizontal, Pencil
} from "lucide-react";
import { ImportModal, type ImportMode } from "@/components/ImportModal";
import { ConditionalFormattingPanel } from "@/components/ConditionalFormattingPanel";
import { evaluateConditionalFormatting, type ConditionalFormatRule } from "@/lib/conditionalFormatting";
import type { ColumnDef as MondayColumnDef } from "@/components/MondayTable";

type CrmAccount = { id: number; tenantId: number; name: string; type: string; industry: string | null; };
type CrmPipeline = { id: number; tenantId: number; name: string; description: string | null; isDefault: boolean | null; color: string | null; };
type CrmOpportunityStage = { id: number; tenantId: number; pipelineId: number | null; name: string; order: number; probability: number | null; color: string | null; isClosed: boolean | null; isWon: boolean | null; };
type CrmOpportunity = { id: number; tenantId: number; accountId: number | null; stageId: number | null; name: string; amount: string | null; probability: number | null; expectedCloseDate: string | null; ownerUserId: string | null; createdAt: string; };

interface CrmOpportunitiesTabProps {
  opportunities: CrmOpportunity[];
  stages: CrmOpportunityStage[];
  accounts: CrmAccount[];
  pipelines: CrmPipeline[];
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", { month: "short", day: "numeric" });
}

function formatCurrency(amount: string | null): string {
  if (!amount) return "—";
  const num = parseFloat(amount);
  if (isNaN(num)) return "—";
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
  return `$${num.toLocaleString()}`;
}

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

function ProbabilityBar({ probability }: { probability: number }) {
  const color = probability >= 75 ? "#22c55e" : probability >= 50 ? "#f59e0b" : probability >= 25 ? "#f97316" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-muted rounded-full overflow-hidden shrink-0">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(probability, 100)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums" style={{ color }}>{probability}%</span>
    </div>
  );
}

function StageBadge({ stage }: { stage: { name: string; color: string | null } | undefined }) {
  if (!stage) return <span className="text-sm text-muted-foreground">—</span>;
  const stageColors: Record<string, { bg: string; text: string; border: string }> = {
    "Prospect": { bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-400", border: "border-blue-200 dark:border-blue-800" },
    "Qualification": { bg: "bg-cyan-50 dark:bg-cyan-950/40", text: "text-cyan-700 dark:text-cyan-400", border: "border-cyan-200 dark:border-cyan-800" },
    "Proposal": { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-400", border: "border-amber-200 dark:border-amber-800" },
    "Negotiation": { bg: "bg-orange-50 dark:bg-orange-950/40", text: "text-orange-700 dark:text-orange-400", border: "border-orange-200 dark:border-orange-800" },
    "Closed Won": { bg: "bg-green-50 dark:bg-green-950/40", text: "text-green-700 dark:text-green-400", border: "border-green-200 dark:border-green-800" },
    "Closed Lost": { bg: "bg-red-50 dark:bg-red-950/40", text: "text-red-700 dark:text-red-400", border: "border-red-200 dark:border-red-800" },
  };
  const colors = stageColors[stage.name] || { bg: "bg-gray-50 dark:bg-gray-900", text: "text-gray-700 dark:text-gray-400", border: "border-gray-200 dark:border-gray-700" };
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border", colors.bg, colors.text, colors.border)}>
      {stage.name}
    </span>
  );
}

export function CrmOpportunitiesTab({ opportunities, stages, accounts, pipelines }: CrmOpportunitiesTabProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreatePipelineOpen, setIsCreatePipelineOpen] = useState(false);
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);
  const [pipelineName, setPipelineName] = useState("");
  const [stageFilter, setStageFilter] = useState<"all" | "closing-this-month">("all");
  const [selectedStageId, setSelectedStageId] = useState<number | null>(null);
  const [localSearch, setLocalSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "amount" | "probability" | "closeDate" | "created">("created");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [groupBy, setGroupBy] = useState<"none" | "stage" | "account" | "probability">("none");
  const [formatPanelOpen, setFormatPanelOpen] = useState(false);
  const [formatRules, setFormatRules] = useState<ConditionalFormatRule[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", amount: "", stageId: "", accountId: "", expectedCloseDate: "", probability: "" });
  const [importOpen, setImportOpen] = useState(false);
  const { toast } = useToast();

  const importMutation = useMutation({
    mutationFn: ({ rows, mode }: { rows: Record<string, string>[]; mode: ImportMode }) =>
      apiRequest("POST", "/api/crm/opportunities/bulk-import", { rows, mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
      toast({ title: "Opportunities imported successfully" });
    },
    onError: () => toast({ title: "Import failed", variant: "destructive" }),
  });

  const activePipelineId = selectedPipelineId || pipelines.find(p => p.isDefault)?.id || pipelines[0]?.id || null;
  const pipelineStages = activePipelineId ? stages.filter(s => s.pipelineId === activePipelineId) : stages;

  const createPipelineMutation = useMutation({
    mutationFn: (data: { name: string }) => apiRequest("POST", "/api/crm/pipelines", { ...data, tenantId: 1 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/pipelines"] });
      setIsCreatePipelineOpen(false);
      setPipelineName("");
      toast({ title: "Pipeline created successfully" });
    },
    onError: () => toast({ title: "Failed to create pipeline", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/crm/opportunities", {
      ...data,
      stageId: data.stageId ? parseInt(data.stageId) : null,
      accountId: data.accountId ? parseInt(data.accountId) : null,
      probability: data.probability ? parseInt(data.probability) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
      setIsOpen(false);
      setFormData({ name: "", amount: "", stageId: "", accountId: "", expectedCloseDate: "", probability: "" });
      toast({ title: "Opportunity created successfully" });
    },
    onError: () => toast({ title: "Failed to create opportunity", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Record<string, unknown> }) =>
      apiRequest("PUT", `/api/crm/opportunities/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
      toast({ title: "Opportunity updated" });
    },
    onError: () => toast({ title: "Failed to update opportunity", variant: "destructive" }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map(id => apiRequest("DELETE", `/api/crm/opportunities/${id}`))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
      setSelectedIds(new Set());
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

  const handleEdit = (opp: typeof enrichedOpportunities[0]) => {
    setFormData({
      name: opp.name,
      amount: opp.amount || "",
      stageId: opp.stageId ? String(opp.stageId) : "",
      accountId: opp.accountId ? String(opp.accountId) : "",
      expectedCloseDate: opp.expectedCloseDate ? opp.expectedCloseDate.split("T")[0] : "",
      probability: opp.probability ? String(opp.probability) : "",
    });
    setEditingId(opp.id);
    setIsOpen(true);
  };

  const toggleStageFilter = (filter: "all" | "closing-this-month") => {
    setStageFilter(prev => prev === filter ? "all" : filter);
  };

  let pipelineOpportunities = opportunities.filter(o => {
    const stage = stages.find(s => s.id === o.stageId);
    return stage && stage.pipelineId === activePipelineId;
  });

  if (stageFilter === "closing-this-month") {
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    pipelineOpportunities = pipelineOpportunities.filter(o => {
      if (!o.expectedCloseDate) return false;
      const closeDate = new Date(o.expectedCloseDate);
      return closeDate >= now && closeDate <= endOfMonth;
    });
  }

  if (selectedStageId !== null) {
    pipelineOpportunities = pipelineOpportunities.filter(o => o.stageId === selectedStageId);
  }

  const enrichedOpportunities = useMemo(() => {
    let result = pipelineOpportunities.map(opp => {
      const account = accounts.find(a => a.id === opp.accountId);
      const stage = stages.find(s => s.id === opp.stageId);
      return {
        ...opp,
        accountName: account?.name || "—",
        stage,
        stageName: stage?.name || "—",
        amountNum: parseFloat(opp.amount || "0"),
        probabilityNum: opp.probability ?? stage?.probability ?? 0,
      };
    });

    if (localSearch) {
      const s = localSearch.toLowerCase();
      result = result.filter(o =>
        o.name.toLowerCase().includes(s) ||
        o.accountName.toLowerCase().includes(s) ||
        o.stageName.toLowerCase().includes(s)
      );
    }

    result.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortField === "name") return dir * a.name.localeCompare(b.name);
      if (sortField === "amount") return dir * (a.amountNum - b.amountNum);
      if (sortField === "probability") return dir * (a.probabilityNum - b.probabilityNum);
      if (sortField === "closeDate") {
        const aDate = a.expectedCloseDate ? new Date(a.expectedCloseDate).getTime() : 0;
        const bDate = b.expectedCloseDate ? new Date(b.expectedCloseDate).getTime() : 0;
        return dir * (aDate - bDate);
      }
      return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });

    return result;
  }, [pipelineOpportunities, accounts, stages, localSearch, sortField, sortDir]);

  const formatColumns: MondayColumnDef<any>[] = [
    { id: "name", header: "Opportunity", type: "text", accessor: "name" },
    { id: "accountName", header: "Account", type: "text", accessor: "accountName" },
    { id: "stageName", header: "Stage", type: "text", accessor: "stageName" },
    { id: "amount", header: "Amount", type: "currency", accessor: "amount" },
    { id: "probabilityNum", header: "Probability", type: "number", accessor: (row: any) => row.probabilityNum },
    { id: "expectedCloseDate", header: "Close Date", type: "date", accessor: "expectedCloseDate" },
    { id: "createdAt", header: "Created", type: "date", accessor: "createdAt" },
  ];

  const cellFormatMap = useMemo(() => {
    if (formatRules.length === 0) return {};
    return evaluateConditionalFormatting(enrichedOpportunities as any[], formatColumns, formatRules);
  }, [formatRules, enrichedOpportunities]);

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

  const totalValue = enrichedOpportunities.reduce((sum, o) => sum + o.amountNum, 0);
  const weightedValue = enrichedOpportunities.reduce((sum, o) => sum + (o.amountNum * o.probabilityNum / 100), 0);
  const avgDeal = enrichedOpportunities.length > 0 ? Math.round(totalValue / enrichedOpportunities.length) : 0;

  const ownerInitials = ["AL", "PV", "SA", "JM", "RK", "DT", "NB", "CM"];
  const ownerColors = ["#3b82f6", "#8b5cf6", "#22c55e", "#f97316", "#ec4899", "#06b6d4", "#ef4444", "#eab308"];

  function getOwnerForOpp(opp: CrmOpportunity) {
    const hash = (opp.id * 7 + (opp.name?.charCodeAt(0) || 0)) % ownerInitials.length;
    return { initials: ownerInitials[hash], color: ownerColors[hash] };
  }

  const groupedData = useMemo(() => {
    if (groupBy === "none") return null;
    const groups: Record<string, typeof enrichedOpportunities> = {};
    for (const opp of enrichedOpportunities) {
      let key: string;
      if (groupBy === "stage") {
        key = opp.stageName;
      } else if (groupBy === "account") {
        key = opp.accountName;
      } else {
        if (opp.probabilityNum >= 75) key = "High (75%+)";
        else if (opp.probabilityNum >= 50) key = "Medium (50-74%)";
        else if (opp.probabilityNum >= 25) key = "Low (25-49%)";
        else key = "Very Low (<25%)";
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(opp);
    }
    return groups;
  }, [enrichedOpportunities, groupBy]);

  const groupColors: Record<string, string> = {
    "High (75%+)": "#22c55e", "Medium (50-74%)": "#f59e0b", "Low (25-49%)": "#f97316", "Very Low (<25%)": "#ef4444",
    "Prospect": "#3b82f6", "Qualification": "#06b6d4", "Proposal": "#f59e0b", "Negotiation": "#f97316",
    "Closed Won": "#22c55e", "Closed Lost": "#ef4444",
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === enrichedOpportunities.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(enrichedOpportunities.map(o => o.id)));
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const exportToCSV = () => {
    const headers = ["Name", "Account", "Stage", "Amount", "Probability", "Expected Close", "Created"];
    const rows = enrichedOpportunities.map(o => [
      o.name, o.accountName, o.stageName, o.amount || "", String(o.probabilityNum), o.expectedCloseDate || "", o.createdAt
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${(c || "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `opportunities-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Opportunities exported to CSV" });
  };

  const renderRow = (opp: typeof enrichedOpportunities[0]) => {
    const companyColor = getColorForName(opp.name);
    const companyInitials = getInitials(opp.name);
    const owner = getOwnerForOpp(opp);

    return (
      <tr
        key={opp.id}
        className={cn(
          "border-b border-border/40 hover:bg-muted/30 transition-colors",
          selectedIds.has(opp.id) && "bg-[#0ea5e9]/5"
        )}
        data-testid={`opp-row-${opp.id}`}
      >
        <td className="px-3 py-3 w-10">
          <Checkbox
            checked={selectedIds.has(opp.id)}
            onCheckedChange={() => toggleSelectOne(opp.id)}
            data-testid={`checkbox-opp-${opp.id}`}
          />
        </td>
        <td className={cn("px-4 py-3 whitespace-nowrap", getCellClasses(opp.id, "name"))} style={getCellStyle(opp.id, "name")}>
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
              style={{ backgroundColor: companyColor }}
            >
              {companyInitials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate max-w-[200px]">{opp.name}</p>
              <p className="text-xs text-muted-foreground">Opportunity</p>
            </div>
          </div>
        </td>
        <td className={cn("px-4 py-3 whitespace-nowrap", getCellClasses(opp.id, "accountName"))} style={getCellStyle(opp.id, "accountName")}>
          <span className="text-sm">{opp.accountName}</span>
        </td>
        <td className={cn("px-4 py-3 whitespace-nowrap", getCellClasses(opp.id, "stageName"))} style={getCellStyle(opp.id, "stageName")}>
          <StageBadge stage={opp.stage} />
        </td>
        <td className={cn("px-4 py-3 whitespace-nowrap", getCellClasses(opp.id, "amount"))} style={getCellStyle(opp.id, "amount")}>
          <span className="text-sm font-semibold">{formatCurrency(opp.amount)}</span>
        </td>
        <td className={cn("px-4 py-3 whitespace-nowrap", getCellClasses(opp.id, "probabilityNum"))} style={getCellStyle(opp.id, "probabilityNum")}>
          <ProbabilityBar probability={opp.probabilityNum} />
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-white font-semibold text-[10px] shrink-0"
              style={{ backgroundColor: owner.color }}
            >
              {owner.initials}
            </div>
          </div>
        </td>
        <td className={cn("px-4 py-3 whitespace-nowrap", getCellClasses(opp.id, "expectedCloseDate"))} style={getCellStyle(opp.id, "expectedCloseDate")}>
          <span className="text-sm text-muted-foreground">{formatDate(opp.expectedCloseDate)}</span>
        </td>
        <td className={cn("px-4 py-3 whitespace-nowrap", getCellClasses(opp.id, "createdAt"))} style={getCellStyle(opp.id, "createdAt")}>
          <span className="text-sm text-muted-foreground">{formatDate(opp.createdAt)}</span>
        </td>
        <td className="px-4 py-3 text-right whitespace-nowrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()} data-testid={`button-actions-opp-${opp.id}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEdit(opp)} data-testid={`action-edit-opp-${opp.id}`}>
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => deleteMutation.mutate(opp.id)}
                className="text-red-600 focus:text-red-600"
                data-testid={`action-delete-opp-${opp.id}`}
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
        <div className="rounded-xl border border-border/60 bg-card p-4" data-testid="card-opp-count">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <OpportunityIcon className="h-5 w-5" />
            Opportunities
          </div>
          <div className="text-2xl font-bold" data-testid="text-opp-count">{enrichedOpportunities.length}</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4" data-testid="card-total-value">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <DollarIcon className="h-5 w-5" />
            Total Value
          </div>
          <div className="text-2xl font-bold" data-testid="text-total-value">${totalValue.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4" data-testid="card-weighted-value">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <WeightedIcon className="h-5 w-5" />
            Weighted Value
          </div>
          <div className="text-2xl font-bold text-[#8b5cf6]" data-testid="text-weighted-value">${weightedValue.toLocaleString()}</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4" data-testid="card-avg-deal">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <AvgDealIcon className="h-5 w-5" />
            Avg Deal Size
          </div>
          <div className="text-2xl font-bold" data-testid="text-avg-deal">${avgDeal.toLocaleString()}</div>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[#0ea5e9]/10 border border-[#0ea5e9]/30 rounded-lg" data-testid="bulk-actions-bar-opp">
          <span className="text-sm font-medium text-[#0ea5e9]">{selectedIds.size} selected</span>
          <div className="h-4 w-px bg-[#0ea5e9]/30" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" data-testid="button-bulk-stage">
                <UserCheck className="h-3 w-3" />
                Change Stage
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {pipelineStages.map(stage => (
                <DropdownMenuItem key={stage.id} onClick={() => {
                  const ids = Array.from(selectedIds);
                  Promise.all(ids.map(id => apiRequest("PUT", `/api/crm/opportunities/${id}`, { stageId: stage.id }))).then(() => {
                    queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
                    setSelectedIds(new Set());
                    toast({ title: `${ids.length} opportunities moved to ${stage.name}` });
                  });
                }}>
                  {stage.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
            disabled={bulkDeleteMutation.isPending}
            data-testid="button-bulk-delete-opp"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </Button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground ml-auto"
            data-testid="button-clear-selection-opp"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2" data-testid="opp-toolbar">
        <button
          onClick={() => { toggleStageFilter("all"); setSelectedStageId(null); }}
          className={cn(
            "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
            stageFilter === "all" && selectedStageId === null
              ? "bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-400"
              : "bg-background border-border text-foreground hover:bg-violet-50/50 dark:hover:bg-violet-950/20"
          )}
          data-testid="button-filter-all-stages"
        >
          <OpportunityIcon className="h-4 w-4" />
          All Stages
        </button>

        <Select
          value={selectedStageId?.toString() || "all"}
          onValueChange={(val) => {
            if (val === "all") {
              setSelectedStageId(null);
            } else {
              setSelectedStageId(parseInt(val));
              setStageFilter("all");
            }
          }}
        >
          <SelectTrigger
            className={cn(
              "h-9 w-auto min-w-[140px] rounded-lg text-sm font-medium border transition-colors gap-1.5",
              selectedStageId !== null
                ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400"
                : "bg-background border-border text-foreground"
            )}
            data-testid="select-stage-filter"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {pipelineStages.map(stage => (
              <SelectItem key={stage.id} value={stage.id.toString()} data-testid={`stage-filter-${stage.id}`}>
                {stage.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          onClick={() => toggleStageFilter("closing-this-month")}
          className={cn(
            "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
            stageFilter === "closing-this-month"
              ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400"
              : "bg-background border-border text-foreground hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
          )}
          data-testid="button-filter-closing-month"
        >
          <Calendar className="h-4 w-4" />
          Closing This Month
        </button>

        {pipelines.length > 0 && (
          <Select value={activePipelineId?.toString() || ""} onValueChange={(v) => setSelectedPipelineId(parseInt(v))}>
            <SelectTrigger className="w-[180px] h-9 rounded-lg" data-testid="select-pipeline-opp">
              <SelectValue placeholder="Select pipeline" />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map(pipeline => (
                <SelectItem key={pipeline.id} value={pipeline.id.toString()}>{pipeline.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="h-6 w-px bg-border mx-1" />

        <button
          onClick={() => handleSort("amount")}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors"
          data-testid="button-sort-opp"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          Sort: {sortField === "name" ? "Name" : sortField === "amount" ? "Amount" : sortField === "probability" ? "Probability" : sortField === "closeDate" ? "Close Date" : "Created"}
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
              data-testid="button-group-opp"
            >
              <Layers className="h-3.5 w-3.5" />
              {groupBy === "none" ? "Group" : `Group: ${groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}`}
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setGroupBy("none")} data-testid="group-opp-none">None</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGroupBy("stage")} data-testid="group-opp-stage">Stage</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGroupBy("account")} data-testid="group-opp-account">Account</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGroupBy("probability")} data-testid="group-opp-probability">Probability</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          onClick={() => setFormatPanelOpen(true)}
          className={cn(
            "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
            formatRules.length > 0
              ? "bg-[#8b5cf6]/10 border-[#8b5cf6]/30 text-[#8b5cf6]"
              : "border-border bg-background text-foreground hover:bg-muted"
          )}
          data-testid="button-format-painter"
          title="Format Painter - Apply conditional formatting rules"
        >
          <Paintbrush className="h-3.5 w-3.5" />
          Format{formatRules.length > 0 ? ` (${formatRules.length})` : ""}
        </button>

        <div className="flex-1" />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search opportunities..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-9 h-9 w-52 rounded-lg"
            data-testid="input-search-opp"
          />
        </div>

        <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-1.5" data-testid="button-export-opportunities">
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setImportOpen(true)} data-testid="button-import-opp">
          <Upload className="h-3.5 w-3.5" />
          Import
        </Button>
        <ImportModal
          isOpen={importOpen}
          onClose={() => setImportOpen(false)}
          entityName="Opportunities"
          templateHeaders={["name","description","amount","probability","expectedCloseDate","type","source","nextStep","stageName","accountName"]}
          exampleRow={{ name:"Acme ERP Upgrade",description:"Full ERP modernisation project",amount:"125000",probability:"60",expectedCloseDate:"2026-09-30",type:"new_business",source:"Referral",nextStep:"Technical workshop",stageName:"Proposal",accountName:"Acme Ltd" }}
          currentCount={opportunities.length}
          onImport={async (rows, mode) => { await importMutation.mutateAsync({ rows, mode }); }}
        />

        <Dialog open={isCreatePipelineOpen} onOpenChange={setIsCreatePipelineOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-create-pipeline-opp">
              <Plus className="h-3.5 w-3.5" />
              New Pipeline
            </Button>
          </DialogTrigger>
          <DialogContent>
            <SubmitForm
              onSubmit={() => createPipelineMutation.mutate({ name: pipelineName })}
              disabled={!pipelineName || createPipelineMutation.isPending}
            >
            <DialogHeader>
              <DialogTitle>Create New Pipeline</DialogTitle>
            </DialogHeader>
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
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" data-testid="button-cancel-pipeline-opp">Cancel</Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={!pipelineName || createPipelineMutation.isPending}
                data-testid="button-save-pipeline-opp"
              >
                {createPipelineMutation.isPending ? "Creating..." : "Create Pipeline"}
              </Button>
            </DialogFooter>
            </SubmitForm>
          </DialogContent>
        </Dialog>

        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) { setEditingId(null); setFormData({ name: "", amount: "", stageId: "", accountId: "", expectedCloseDate: "", probability: "" }); } }}>
          <DialogTrigger asChild>
            <Button className="bg-[#0ea5e9] hover:bg-[#0ea5e9]/90 text-white gap-1.5" data-testid="button-add-opportunity-table">
              <Plus className="h-4 w-4" />
              New Opportunity
            </Button>
          </DialogTrigger>
          <DialogContent>
            <SubmitForm
              onSubmit={() => {
                if (editingId) {
                  updateMutation.mutate({ id: editingId, updates: {
                    ...formData,
                    stageId: formData.stageId ? parseInt(formData.stageId) : null,
                    accountId: formData.accountId ? parseInt(formData.accountId) : null,
                    probability: formData.probability ? parseInt(formData.probability) : null,
                  }});
                  setIsOpen(false);
                  setEditingId(null);
                  setFormData({ name: "", amount: "", stageId: "", accountId: "", expectedCloseDate: "", probability: "" });
                } else {
                  createMutation.mutate(formData);
                }
              }}
              disabled={!formData.name || createMutation.isPending}
            >
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Opportunity" : "Create New Opportunity"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="oppName">Opportunity Name *</Label>
                <Input
                  id="oppName"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  data-testid="input-opp-name"
                />
              </div>
              <div>
                <Label htmlFor="oppAmount">Deal Value ($)</Label>
                <Input
                  id="oppAmount"
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  data-testid="input-opp-amount"
                />
              </div>
              <div>
                <Label htmlFor="oppStage">Stage</Label>
                <Select value={formData.stageId} onValueChange={(v) => setFormData(prev => ({ ...prev, stageId: v }))}>
                  <SelectTrigger data-testid="select-opp-stage">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelineStages.map(stage => (
                      <SelectItem key={stage.id} value={stage.id.toString()}>{stage.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="oppAccount">Account</Label>
                <Select value={formData.accountId} onValueChange={(v) => setFormData(prev => ({ ...prev, accountId: v }))}>
                  <SelectTrigger data-testid="select-opp-account">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(account => (
                      <SelectItem key={account.id} value={account.id.toString()}>{account.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="oppProbability">Win Probability (%)</Label>
                <Input
                  id="oppProbability"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.probability}
                  onChange={(e) => setFormData(prev => ({ ...prev, probability: e.target.value }))}
                  placeholder="e.g., 50"
                  data-testid="input-opp-probability"
                />
              </div>
              <div>
                <Label htmlFor="oppCloseDate">Expected Close Date</Label>
                <Input
                  id="oppCloseDate"
                  type="date"
                  value={formData.expectedCloseDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, expectedCloseDate: e.target.value }))}
                  data-testid="input-opp-close-date"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" data-testid="button-cancel-opp">Cancel</Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={!formData.name || createMutation.isPending}
                data-testid="button-save-opp"
              >
                {editingId ? (updateMutation.isPending ? "Updating..." : "Update Opportunity") : (createMutation.isPending ? "Creating..." : "Create Opportunity")}
              </Button>
            </DialogFooter>
            </SubmitForm>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border/60 bg-card overflow-x-auto max-w-[95%]" data-testid="opp-table">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/60">
              <th className="px-3 py-3 w-10">
                <Checkbox
                  checked={enrichedOpportunities.length > 0 && selectedIds.size === enrichedOpportunities.length}
                  onCheckedChange={toggleSelectAll}
                  data-testid="checkbox-select-all-opp"
                />
              </th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Opportunity</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Account</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Stage</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Amount</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Probability</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Owner</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Close Date</th>
              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Created</th>
              <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {enrichedOpportunities.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-16 text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <OpportunityIcon className="h-10 w-10 opacity-30" />
                    <p className="text-sm">No opportunities found. Create your first deal to start tracking.</p>
                    <Button
                      size="sm"
                      className="mt-2 bg-[#0ea5e9] hover:bg-[#0ea5e9]/90"
                      onClick={() => setIsOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      New Opportunity
                    </Button>
                  </div>
                </td>
              </tr>
            ) : groupedData ? (
              Object.entries(groupedData).flatMap(([groupName, groupOpps]) => [
                <tr key={`group-header-${groupName}`} className="bg-muted/40 border-b border-border/40" data-testid={`group-opp-${groupName}`}>
                  <td colSpan={10} className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: groupColors[groupName] || "#6b7280" }}
                      />
                      <span className="text-sm font-semibold">{groupName}</span>
                      <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                        {groupOpps.length}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-2">
                        ${groupOpps.reduce((s, o) => s + o.amountNum, 0).toLocaleString()}
                      </span>
                    </div>
                  </td>
                </tr>,
                ...groupOpps.map(renderRow)
              ])
            ) : (
              enrichedOpportunities.map(renderRow)
            )}
          </tbody>
        </table>
        {enrichedOpportunities.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20 text-xs text-muted-foreground" data-testid="opp-count-footer">
            {enrichedOpportunities.length} of {opportunities.length} opportunities
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
        data={enrichedOpportunities as any[]}
      />
    </div>
  );
}
