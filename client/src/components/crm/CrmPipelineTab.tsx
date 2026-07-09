import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FormDialogShell } from "@/components/ui/form-dialog-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MetricCard } from "@/components/ui/metric-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Plus,
  CheckCircle2,
  XCircle,
  Settings2,
  Eye,
  EyeOff,
  Pencil,
  Trash2
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useCrmUsers } from "./CrmUsersProvider";
import { opportunityMatchesPipeline, stagesForActivePipeline } from "@/lib/crm-tab-counts";
import { CrmPipelineKanban } from "./CrmPipelineKanban";
import type { CrmAccount, CrmPipeline, CrmOpportunity, CrmOpportunityStage } from "./types";

interface CrmPipelineTabProps {
  opportunities: CrmOpportunity[];
  stages: CrmOpportunityStage[];
  accounts: CrmAccount[];
  pipelines: CrmPipeline[];
  searchTerm?: string;
}

const STAGE_COLORS = [
  "#3b82f6", "#06b6d4", "#8b5cf6", "#f59e0b", "#f97316", "#22c55e", "#ec4899", "#ef4444", "#14b8a6", "#6366f1"
];

function formatCurrency(val: string | null): string {
  const num = parseFloat(val || "0");
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${Math.round(num / 1000)}K`;
  return `$${num.toLocaleString()}`;
}

function formatDate(date: string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function OpenDealsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1.5" fill="#3b82f6" opacity="0.85"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5" fill="#06b6d4" opacity="0.85"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5" fill="#f59e0b" opacity="0.85"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5" fill="#8b5cf6" opacity="0.85"/>
    </svg>
  );
}

function PipelineValueIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="#22c55e" opacity="0.15"/>
      <circle cx="12" cy="12" r="7" fill="#22c55e" opacity="0.3"/>
      <text x="12" y="16" textAnchor="middle" fill="#22c55e" fontSize="11" fontWeight="bold">$</text>
    </svg>
  );
}

function WeightedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="6" r="3" fill="#8b5cf6" opacity="0.8"/>
      <path d="M5 20 L12 10 L19 20Z" fill="#8b5cf6" opacity="0.25"/>
      <line x1="5" y1="20" x2="19" y2="20" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round"/>
      <line x1="12" y1="10" x2="12" y2="6" stroke="#8b5cf6" strokeWidth="1.5"/>
    </svg>
  );
}

function AvgDealIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="14" width="4" height="7" rx="1" fill="#f97316" opacity="0.7"/>
      <rect x="10" y="9" width="4" height="12" rx="1" fill="#f97316" opacity="0.85"/>
      <rect x="17" y="4" width="4" height="17" rx="1" fill="#f97316"/>
      <line x1="2" y1="12" x2="22" y2="8" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2"/>
    </svg>
  );
}

interface CardField {
  id: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
}

const CARD_FIELDS: CardField[] = [
  { id: "account", label: "Account Name", description: "Company or account name", defaultEnabled: true },
  { id: "amount", label: "Deal Amount", description: "Deal value in currency", defaultEnabled: true },
  { id: "owner", label: "Owner", description: "Deal owner avatar and name", defaultEnabled: true },
  { id: "probability", label: "Probability", description: "Win probability percentage", defaultEnabled: true },
  { id: "closeDate", label: "Close Date", description: "Expected close date", defaultEnabled: true },
  { id: "industry", label: "Industry", description: "Account industry sector", defaultEnabled: false },
  { id: "accountType", label: "Account Type", description: "Account type (Customer, Prospect, etc.)", defaultEnabled: false },
  { id: "stage", label: "Stage Name", description: "Current pipeline stage label", defaultEnabled: false },
  { id: "created", label: "Created Date", description: "When the opportunity was created", defaultEnabled: false },
  { id: "pipeline", label: "Pipeline", description: "Which pipeline this deal belongs to", defaultEnabled: false },
];

const DEFAULT_VISIBLE_FIELDS = new Set(CARD_FIELDS.filter(f => f.defaultEnabled).map(f => f.id));

export function CrmPipelineTab({ opportunities, stages, accounts, pipelines, searchTerm = "" }: CrmPipelineTabProps) {
  const { users, resolveOwner } = useCrmUsers();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreatePipelineOpen, setIsCreatePipelineOpen] = useState(false);
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);
  const [pipelineName, setPipelineName] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [, setAddDealStageId] = useState<number | null>(null);
  const [cardFieldsOpen, setCardFieldsOpen] = useState(false);
  const [stageMgmtOpen, setStageMgmtOpen] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [newStageProbability, setNewStageProbability] = useState("50");
  const [editingStageId, setEditingStageId] = useState<number | null>(null);
  const [editStageName, setEditStageName] = useState("");
  const [editStageProbability, setEditStageProbability] = useState("");
  const [editStageColor, setEditStageColor] = useState("");
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set(DEFAULT_VISIBLE_FIELDS));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", amount: "", stageId: "", accountId: "", expectedCloseDate: "", probability: "" });
  const { toast } = useToast();

  function toggleField(fieldId: string) {
    setVisibleFields(prev => {
      const next = new Set(prev);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.add(fieldId);
      return next;
    });
  }

  const activePipelineId = selectedPipelineId || pipelines.find(p => p.isDefault)?.id || pipelines[0]?.id || null;
  const activePipeline = pipelines.find(p => p.id === activePipelineId);
  const pipelineStages = stagesForActivePipeline(stages, pipelines, activePipelineId);

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
      setAddDealStageId(null);
      setFormData({ name: "", amount: "", stageId: "", accountId: "", expectedCloseDate: "", probability: "" });
      toast({ title: "Opportunity created successfully" });
    },
    onError: () => toast({ title: "Failed to create opportunity", variant: "destructive" }),
  });

  const [closeReasonOpen, setCloseReasonOpen] = useState(false);
  const [pendingClose, setPendingClose] = useState<{ oppId: number; stageId: number; isWon: boolean } | null>(null);
  const [closeReason, setCloseReason] = useState("");

  const updateStageMutation = useMutation({
    mutationFn: ({ id, stageId, probability, winReason, lossReason, actualCloseDate }: {
      id: number; stageId: number; probability?: number; winReason?: string; lossReason?: string; actualCloseDate?: string;
    }) => apiRequest("PUT", `/api/crm/opportunities/${id}`, { stageId, probability, winReason, lossReason, actualCloseDate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
      toast({ title: "Opportunity moved successfully" });
      setCloseReasonOpen(false);
      setPendingClose(null);
      setCloseReason("");
    },
    onError: () => toast({ title: "Failed to move opportunity", variant: "destructive" }),
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

  const createStageMutation = useMutation({
    mutationFn: (data: { name: string; pipelineId: number; order: number; probability: number; color: string; isClosed: boolean; isWon: boolean }) =>
      apiRequest("POST", "/api/crm/stages", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stages"] });
      setNewStageName("");
      setNewStageProbability("50");
      toast({ title: "Stage created" });
    },
    onError: () => toast({ title: "Failed to create stage", variant: "destructive" }),
  });

  const updateStageMgmtMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Record<string, unknown> }) =>
      apiRequest("PUT", `/api/crm/stages/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stages"] });
      setEditingStageId(null);
      toast({ title: "Stage updated" });
    },
    onError: () => toast({ title: "Failed to update stage", variant: "destructive" }),
  });

  const deleteStageMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/crm/stages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stages"] });
      toast({ title: "Stage deleted" });
    },
    onError: () => toast({ title: "Failed to delete stage", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/crm/opportunities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
      toast({ title: "Opportunity deleted" });
    },
    onError: () => toast({ title: "Failed to delete opportunity", variant: "destructive" }),
  });

  const handleEditOpp = (opp: CrmOpportunity) => {
    setEditingId(opp.id);
    setFormData({
      name: opp.name,
      amount: opp.amount || "",
      stageId: opp.stageId ? String(opp.stageId) : "",
      accountId: opp.accountId ? String(opp.accountId) : "",
      expectedCloseDate: opp.expectedCloseDate ? opp.expectedCloseDate.split("T")[0] : "",
      probability: opp.probability ? String(opp.probability) : "",
    });
    setIsOpen(true);
  };

  const confirmCloseReason = () => {
    if (!pendingClose) return;
    const stage = stages.find(s => s.id === pendingClose.stageId);
    updateStageMutation.mutate({
      id: pendingClose.oppId,
      stageId: pendingClose.stageId,
      probability: stage?.probability ?? (pendingClose.isWon ? 100 : 0),
      winReason: pendingClose.isWon ? closeReason : undefined,
      lossReason: !pendingClose.isWon ? closeReason : undefined,
      actualCloseDate: new Date().toISOString().split("T")[0],
    });
  };

  const activeStages = pipelineStages.filter(s => !s.isClosed).sort((a, b) => a.order - b.order);
  const closedStages = pipelineStages.filter(s => s.isClosed);

  const pipelineOpportunities = useMemo(() => {
    let list = opportunities.filter(o =>
      opportunityMatchesPipeline(o, stages, pipelines, activePipelineId, { openOnly: true }),
    );

    if (ownerFilter) {
      if (ownerFilter === "__unassigned__") {
        list = list.filter(o => !o.ownerUserId);
      } else {
        list = list.filter(o => o.ownerUserId === ownerFilter);
      }
    }

    if (stageFilter !== "all") {
      list = list.filter(o => o.stageId === parseInt(stageFilter));
    }

    if (minAmount) {
      const min = parseFloat(minAmount);
      if (!isNaN(min)) list = list.filter(o => (parseFloat(o.amount || "0") || 0) >= min);
    }
    if (maxAmount) {
      const max = parseFloat(maxAmount);
      if (!isNaN(max)) list = list.filter(o => (parseFloat(o.amount || "0") || 0) <= max);
    }

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(o => {
        const account = accounts.find(a => a.id === o.accountId);
        return o.name.toLowerCase().includes(s) || (account?.name || "").toLowerCase().includes(s);
      });
    }

    return list;
  }, [opportunities, stages, pipelines, activePipelineId, ownerFilter, stageFilter, minAmount, maxAmount, searchTerm, accounts]);

  const activeFilterCount = [stageFilter !== "all", minAmount, maxAmount].filter(Boolean).length;

  const totalPipelineValue = pipelineOpportunities.reduce((sum, o) => sum + (parseFloat(o.amount || "0") || 0), 0);
  const weightedPipelineValue = pipelineOpportunities.reduce((sum, o) => {
    const stage = stages.find(s => s.id === o.stageId);
    const probability = o.probability || stage?.probability || 0;
    return sum + ((parseFloat(o.amount || "0") || 0) * probability / 100);
  }, 0);
  const avgDealSize = pipelineOpportunities.length > 0 ? totalPipelineValue / pipelineOpportunities.length : 0;

  function openAddDealForStage(stageId: number) {
    setFormData({ name: "", amount: "", stageId: stageId.toString(), accountId: "", expectedCloseDate: "", probability: "" });
    setAddDealStageId(stageId);
    setIsOpen(true);
  }

  function getStageColor(stage: CrmOpportunityStage, index: number): string {
    return stage.color || STAGE_COLORS[index % STAGE_COLORS.length];
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard
          title="Open Deals"
          value={pipelineOpportunities.length}
          subtitle="In selected pipeline"
          helpText="Number of open opportunities in the currently selected pipeline and owner filter."
          icon={OpenDealsIcon}
          testId="card-open-deals"
        />
        <MetricCard
          title="Total Pipeline Value"
          value={`$${totalPipelineValue.toLocaleString()}`}
          subtitle="Sum of deal amounts"
          helpText="Combined value of all open deals before probability weighting."
          icon={PipelineValueIcon}
          borderColor="#22c55e"
          valueClassName="text-[#22c55e]"
          testId="card-pipeline-value"
        />
        <MetricCard
          title="Weighted Value"
          value={`$${weightedPipelineValue.toLocaleString()}`}
          subtitle="Amount × probability"
          helpText="Expected revenue based on each deal's amount and stage win probability."
          icon={WeightedIcon}
          borderColor="#8b5cf6"
          valueClassName="text-[#8b5cf6]"
          testId="card-weighted-value"
        />
        <MetricCard
          title="Avg Deal Size"
          value={`$${Math.round(avgDealSize).toLocaleString()}`}
          subtitle="Per open deal"
          helpText="Average amount per opportunity in the current pipeline view."
          icon={AvgDealIcon}
          borderColor="#f97316"
          testId="card-avg-deal"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setOwnerFilter(null)}
          className={cn(
            "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
            ownerFilter === null
              ? "bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-400"
              : "bg-background border-border text-foreground hover:bg-violet-50/50 dark:hover:bg-violet-950/20"
          )}
          data-testid="button-filter-all-owners"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          All Owners
        </button>

        <Select
          value={ownerFilter || "all"}
          onValueChange={(val) => setOwnerFilter(val === "all" ? null : val)}
        >
          <SelectTrigger
            className={cn(
              "h-9 w-auto min-w-[140px] rounded-lg text-sm font-medium border transition-colors gap-1.5",
              ownerFilter
                ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400"
                : "bg-background border-border text-foreground"
            )}
            data-testid="select-owner-filter"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Owners</SelectItem>
            <SelectItem value="__unassigned__">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 bg-muted-foreground/50">
                  —
                </div>
                Unassigned
              </div>
            </SelectItem>
            {users.map(user => {
              const owner = resolveOwner(user.id);
              return (
                <SelectItem key={user.id} value={user.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-5 w-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                      style={{ backgroundColor: owner.color }}
                    >
                      {owner.initials}
                    </div>
                    {owner.name}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {pipelines.length > 0 && (
          <Select value={activePipelineId?.toString() || ""} onValueChange={(v) => setSelectedPipelineId(parseInt(v))}>
            <SelectTrigger
              className="h-9 w-auto min-w-[180px] rounded-lg text-sm font-medium border border-border bg-background gap-1.5"
              data-testid="select-pipeline-kanban"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
              </svg>
              <SelectValue placeholder="Select pipeline" />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map(pipeline => (
                <SelectItem key={pipeline.id} value={pipeline.id.toString()}>{pipeline.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {activePipelineId && (
          <button
            onClick={() => setStageMgmtOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors"
            data-testid="button-manage-stages"
          >
            <Settings2 className="h-4 w-4" />
            Manage Stages
          </button>
        )}

        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                activeFilterCount > 0
                  ? "bg-[#0ea5e9]/10 border-[#0ea5e9]/30 text-[#0ea5e9]"
                  : "border-border bg-background text-foreground hover:bg-muted"
              )}
              data-testid="button-filter-pipeline"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              Filter
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{activeFilterCount}</Badge>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Stage</Label>
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="h-8" data-testid="filter-pipeline-stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stages</SelectItem>
                  {activeStages.map(stage => (
                    <SelectItem key={stage.id} value={String(stage.id)}>{stage.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Min amount</Label>
                <Input type="number" min={0} value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="0" className="h-8" data-testid="filter-min-amount" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Max amount</Label>
                <Input type="number" min={0} value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="Any" className="h-8" data-testid="filter-max-amount" />
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => { setStageFilter("all"); setMinAmount(""); setMaxAmount(""); }}
              data-testid="button-clear-pipeline-filters"
            >
              Clear filters
            </Button>
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors"
              data-testid="button-setup-pipeline"
            >
              <Settings2 className="h-4 w-4" />
              Setup
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsCreatePipelineOpen(true)} data-testid="button-create-pipeline-kanban">
              Add pipeline…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
          <FormDialogShell
            open={isCreatePipelineOpen}
            onOpenChange={setIsCreatePipelineOpen}
            title="Create New Pipeline"
            subtitle="Add a new sales pipeline"
            saveLabel={createPipelineMutation.isPending ? "Creating..." : "Create Pipeline"}
            onCancel={() => setIsCreatePipelineOpen(false)}
            onSubmit={() => createPipelineMutation.mutate({ name: pipelineName })}
            saving={createPipelineMutation.isPending}
            disabled={!pipelineName}
            saveTestId="button-save-pipeline-kanban"
            size="sm"
          >
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="pipelineNameKanban">Pipeline Name *</Label>
                <Input
                  id="pipelineNameKanban"
                  value={pipelineName}
                  onChange={(e) => setPipelineName(e.target.value)}
                  placeholder="e.g., Enterprise Sales, SMB Sales"
                  data-testid="input-pipeline-name-kanban"
                />
              </div>
            </div>
          </FormDialogShell>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#0ea5e9] hover:bg-[#0ea5e9]/90 text-white transition-colors"
              data-testid="button-add-opportunity-kanban"
              onClick={() => setIsOpen(true)}
            >
              <Plus className="h-4 w-4" />
              New Opportunity
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs text-xs">
            Add a deal to this pipeline. Use column &quot;Add deal&quot; to pre-select a stage.
          </TooltipContent>
        </Tooltip>
          <FormDialogShell
            open={isOpen}
            onOpenChange={(open) => { setIsOpen(open); if (!open) { setAddDealStageId(null); setEditingId(null); setFormData({ name: "", amount: "", stageId: "", accountId: "", expectedCloseDate: "", probability: "" }); } }}
            title={editingId ? "Edit Opportunity" : "Create New Opportunity"}
            subtitle="Create or update a pipeline opportunity"
            saveLabel={
              editingId
                ? (updateMutation.isPending ? "Updating..." : "Update Opportunity")
                : (createMutation.isPending ? "Creating..." : "Create Opportunity")
            }
            onCancel={() => { setIsOpen(false); setEditingId(null); }}
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
            saving={createMutation.isPending || updateMutation.isPending}
            disabled={!formData.name}
            saveTestId="button-save-opp-kanban"
            size="md"
          >
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="oppNameKanban">Opportunity Name *</Label>
                <Input
                  id="oppNameKanban"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  data-testid="input-opp-name-kanban"
                />
              </div>
              <div>
                <Label htmlFor="oppAmountKanban">Deal Value ($)</Label>
                <Input
                  id="oppAmountKanban"
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  data-testid="input-opp-amount-kanban"
                />
              </div>
              <div>
                <Label htmlFor="oppStageKanban">Stage</Label>
                <Select value={formData.stageId} onValueChange={(v) => setFormData(prev => ({ ...prev, stageId: v }))}>
                  <SelectTrigger data-testid="select-opp-stage-kanban">
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
                <Label htmlFor="oppAccountKanban">Account</Label>
                <Select value={formData.accountId} onValueChange={(v) => setFormData(prev => ({ ...prev, accountId: v }))}>
                  <SelectTrigger data-testid="select-opp-account-kanban">
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
                <Label htmlFor="oppProbabilityKanban">Win Probability (%)</Label>
                <Input
                  id="oppProbabilityKanban"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.probability}
                  onChange={(e) => setFormData(prev => ({ ...prev, probability: e.target.value }))}
                  placeholder="e.g., 50"
                  data-testid="input-opp-probability-kanban"
                />
              </div>
              <div>
                <Label htmlFor="oppCloseDateKanban">Expected Close Date</Label>
                <Input
                  id="oppCloseDateKanban"
                  type="date"
                  value={formData.expectedCloseDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, expectedCloseDate: e.target.value }))}
                  data-testid="input-opp-close-date-kanban"
                />
              </div>
            </div>
          </FormDialogShell>
      </div>

      {activeStages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-10 text-center" data-testid="pipeline-no-stages">
            <p className="text-sm font-medium mb-1">No stages in this pipeline</p>
            <p className="text-xs text-muted-foreground mb-4">
              Add stages via Manage Stages, or switch pipeline if deals use global stages.
            </p>
            <Button size="sm" variant="outline" onClick={() => setStageMgmtOpen(true)}>
              Manage stages
            </Button>
          </div>
        ) : (
          <CrmPipelineKanban
            opportunities={pipelineOpportunities}
            activeStages={activeStages}
            pipelineStages={pipelineStages}
            stages={stages}
            pipelines={pipelines}
            accounts={accounts}
            activePipelineId={activePipelineId}
            activePipeline={activePipeline}
            visibleFields={visibleFields}
            getStageColor={getStageColor}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            resolveOwner={resolveOwner}
            onEdit={handleEditOpp}
            onDelete={(id) => deleteMutation.mutate(id)}
            onMoveStage={(id, stageId, probability) =>
              new Promise<void>((resolve, reject) => {
                updateStageMutation.mutate(
                  { id, stageId, probability },
                  { onSuccess: () => resolve(), onError: (e) => reject(e) },
                );
              })
            }
            onOpenCardFields={() => setCardFieldsOpen(true)}
            onAddDeal={openAddDealForStage}
            onMovePipeline={(oppId, targetPipelineId) => {
              const firstStage = stages.find((s) => s.pipelineId === targetPipelineId && !s.isClosed);
              if (firstStage) {
                updateStageMutation.mutate({ id: oppId, stageId: firstStage.id });
              } else {
                toast({
                  title: "Cannot move to pipeline",
                  description: "Target pipeline has no stages",
                  variant: "destructive",
                });
              }
            }}
            toast={toast}
          />
        )}

      {closedStages.length > 0 && (
        <div className="pt-4 border-t border-border/20" data-testid="closed-deals-section">
          <h3 className="text-sm font-medium mb-3 text-muted-foreground">Closed Deals</h3>
          <div className="flex gap-4 flex-wrap">
            {closedStages.map(stage => {
              const stageOpps = opportunities.filter(o => o.stageId === stage.id);
              return (
                <Badge
                  key={stage.id}
                  variant={stage.isWon ? "default" : "secondary"}
                  className="gap-1"
                  data-testid={`closed-stage-${stage.id}`}
                >
                  {stage.isWon ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {stage.name}: {stageOpps.length}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      <Sheet open={cardFieldsOpen} onOpenChange={setCardFieldsOpen}>
        <SheetContent side="right" className="w-[360px] sm:w-[400px]" data-testid="card-fields-sheet">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-[#8b5cf6]" />
              Card Display Fields
            </SheetTitle>
          </SheetHeader>
          <p className="text-sm text-muted-foreground mt-2 mb-4">
            Choose which fields to display on pipeline cards. Changes apply to all cards.
          </p>
          <div className="space-y-1">
            <div className="px-3 py-2 bg-muted/30 rounded-lg mb-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Deal Name</p>
              <p className="text-xs text-muted-foreground">Always shown</p>
            </div>
            {CARD_FIELDS.map(field => {
              const isEnabled = visibleFields.has(field.id);
              return (
                <div
                  key={field.id}
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors cursor-pointer",
                    isEnabled
                      ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/30"
                      : "bg-background border-transparent hover:bg-muted/40"
                  )}
                  onClick={() => toggleField(field.id)}
                  data-testid={`toggle-field-${field.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "h-7 w-7 rounded-md flex items-center justify-center shrink-0",
                      isEnabled ? "bg-[#3b82f6]/10 text-[#3b82f6]" : "bg-muted text-muted-foreground"
                    )}>
                      {isEnabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{field.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{field.description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={() => toggleField(field.id)}
                    data-testid={`switch-field-${field.id}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-border/40">
            <button
              onClick={() => setVisibleFields(new Set(DEFAULT_VISIBLE_FIELDS))}
              className="text-sm text-[#3b82f6] hover:text-[#3b82f6]/80 font-medium transition-colors"
              data-testid="button-reset-card-fields"
            >
              Reset to defaults
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <FormDialogShell
        open={stageMgmtOpen}
        onOpenChange={setStageMgmtOpen}
        title={`Manage Stages — ${activePipeline?.name || ""}`}
        subtitle="Add, edit, and remove stages"
        saveLabel="Done"
        onCancel={() => setStageMgmtOpen(false)}
        onSubmit={() => setStageMgmtOpen(false)}
        disabled={false}
        testId="stage-management-dialog"
        size="md"
      >
          <div className="space-y-3 py-2">
            {[...pipelineStages].sort((a, b) => a.order - b.order).map(stage => (
              <div key={stage.id} className="flex items-center gap-2 p-2 border rounded-lg" data-testid={`stage-mgmt-row-${stage.id}`}>
                {editingStageId === stage.id ? (
                  <>
                    <Input value={editStageName} onChange={e => setEditStageName(e.target.value)} className="h-8 flex-1" data-testid={`input-edit-stage-name-${stage.id}`} />
                    <Input type="number" min={0} max={100} value={editStageProbability} onChange={e => setEditStageProbability(e.target.value)} className="h-8 w-16" data-testid={`input-edit-stage-prob-${stage.id}`} />
                    <Input type="color" value={editStageColor || "#3b82f6"} onChange={e => setEditStageColor(e.target.value)} className="h-8 w-10 p-0.5" />
                    <Button size="sm" onClick={() => updateStageMgmtMutation.mutate({ id: stage.id, updates: { name: editStageName, probability: parseInt(editStageProbability) || 0, color: editStageColor } })} data-testid={`button-save-stage-${stage.id}`}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingStageId(null)}>Cancel</Button>
                  </>
                ) : (
                  <>
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: stage.color || "#3b82f6" }} />
                    <span className="text-sm font-medium flex-1">{stage.name}</span>
                    <Badge variant="outline" className="text-[10px]">{stage.probability ?? 0}%</Badge>
                    {stage.isClosed && <Badge variant="secondary" className="text-[10px]">Closed</Badge>}
                    {!stage.isClosed && (
                      <>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingStageId(stage.id); setEditStageName(stage.name); setEditStageProbability(String(stage.probability ?? 0)); setEditStageColor(stage.color || "#3b82f6"); }} data-testid={`button-edit-stage-${stage.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteStageMutation.mutate(stage.id)} data-testid={`button-delete-stage-${stage.id}`}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-end gap-2 pt-2 border-t">
            <div className="flex-1">
              <Label className="text-xs">New stage name</Label>
              <Input value={newStageName} onChange={e => setNewStageName(e.target.value)} placeholder="Stage name" data-testid="input-new-stage-name" />
            </div>
            <div className="w-20">
              <Label className="text-xs">Prob %</Label>
              <Input type="number" min={0} max={100} value={newStageProbability} onChange={e => setNewStageProbability(e.target.value)} data-testid="input-new-stage-prob" />
            </div>
            <Button
              disabled={!newStageName.trim() || !activePipelineId || createStageMutation.isPending}
              onClick={() => {
                const openStages = pipelineStages.filter(s => !s.isClosed);
                const maxOrder = openStages.reduce((m, s) => Math.max(m, s.order), 0);
                createStageMutation.mutate({
                  name: newStageName.trim(),
                  pipelineId: activePipelineId!,
                  order: maxOrder + 1,
                  probability: parseInt(newStageProbability) || 50,
                  color: STAGE_COLORS[openStages.length % STAGE_COLORS.length],
                  isClosed: false,
                  isWon: false,
                });
              }}
              data-testid="button-add-stage"
            >
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
      </FormDialogShell>

      <FormDialogShell
        open={closeReasonOpen}
        onOpenChange={setCloseReasonOpen}
        title={pendingClose?.isWon ? "Win Reason" : "Loss Reason"}
        subtitle="Required for closed stage move"
        saveLabel="Confirm"
        onCancel={() => { setCloseReasonOpen(false); setPendingClose(null); }}
        onSubmit={confirmCloseReason}
        disabled={!closeReason.trim()}
        saveTestId="button-confirm-close-reason"
        size="sm"
      >
          <div className="py-4">
            <Label>{pendingClose?.isWon ? "Why was this deal won?" : "Why was this deal lost?"}</Label>
            <Input value={closeReason} onChange={e => setCloseReason(e.target.value)} className="mt-2" data-testid="input-close-reason" />
          </div>
      </FormDialogShell>
    </div>
  );
}
