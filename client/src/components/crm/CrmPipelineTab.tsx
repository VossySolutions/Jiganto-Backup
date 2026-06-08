import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { SubmitForm } from "@/components/ui/submit-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Separator } from "@/components/ui/separator";
import { Plus, MoreHorizontal, CheckCircle2, XCircle, ArrowRight, Calendar, Settings2, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";

type CrmAccount = { id: number; tenantId: number; name: string; type: string; industry: string | null; };
type CrmPipeline = { id: number; tenantId: number; name: string; description: string | null; isDefault: boolean | null; color: string | null; };
type CrmOpportunityStage = { id: number; tenantId: number; pipelineId: number | null; name: string; order: number; probability: number | null; color: string | null; isClosed: boolean | null; isWon: boolean | null; };
type CrmOpportunity = { id: number; tenantId: number; accountId: number | null; stageId: number | null; name: string; amount: string | null; probability: number | null; expectedCloseDate: string | null; ownerUserId: string | null; createdAt: string; };

interface CrmPipelineTabProps {
  opportunities: CrmOpportunity[];
  stages: CrmOpportunityStage[];
  accounts: CrmAccount[];
  pipelines: CrmPipeline[];
}

const STAGE_COLORS = [
  "#3b82f6", "#06b6d4", "#8b5cf6", "#f59e0b", "#f97316", "#22c55e", "#ec4899", "#ef4444", "#14b8a6", "#6366f1"
];

const ownerData = [
  { initials: "AL", name: "Alex Lee", color: "#3b82f6" },
  { initials: "PV", name: "Priya Verma", color: "#8b5cf6" },
  { initials: "SA", name: "Sarah Adams", color: "#22c55e" },
  { initials: "JM", name: "James Miller", color: "#f97316" },
  { initials: "RK", name: "Rachel Kim", color: "#ec4899" },
  { initials: "DT", name: "David Taylor", color: "#06b6d4" },
  { initials: "NB", name: "Nadia Brown", color: "#ef4444" },
  { initials: "CM", name: "Chris Martin", color: "#eab308" },
];

function getOwnerForOpp(opp: CrmOpportunity) {
  const hash = (opp.id * 7 + (opp.name?.charCodeAt(0) || 0)) % ownerData.length;
  return ownerData[hash];
}

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

export function CrmPipelineTab({ opportunities, stages, accounts, pipelines }: CrmPipelineTabProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreatePipelineOpen, setIsCreatePipelineOpen] = useState(false);
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);
  const [pipelineName, setPipelineName] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null);
  const [addDealStageId, setAddDealStageId] = useState<number | null>(null);
  const [cardFieldsOpen, setCardFieldsOpen] = useState(false);
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
      setAddDealStageId(null);
      setFormData({ name: "", amount: "", stageId: "", accountId: "", expectedCloseDate: "", probability: "" });
      toast({ title: "Opportunity created successfully" });
    },
    onError: () => toast({ title: "Failed to create opportunity", variant: "destructive" }),
  });

  const updateStageMutation = useMutation({
    mutationFn: ({ id, stageId }: { id: number; stageId: number }) =>
      apiRequest("PUT", `/api/crm/opportunities/${id}`, { stageId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
      toast({ title: "Opportunity moved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to move opportunity", variant: "destructive" });
    },
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

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    const opportunityId = parseInt(draggableId.replace("opp-", ""));
    const newStageId = parseInt(destination.droppableId.replace("stage-", ""));
    updateStageMutation.mutate({ id: opportunityId, stageId: newStageId });
  };

  const activeStages = pipelineStages.filter(s => !s.isClosed).sort((a, b) => a.order - b.order);
  const closedStages = pipelineStages.filter(s => s.isClosed);

  let pipelineOpportunities = opportunities.filter(o => {
    const stage = stages.find(s => s.id === o.stageId);
    return stage && stage.pipelineId === activePipelineId && !stage.isClosed;
  });

  if (ownerFilter) {
    pipelineOpportunities = pipelineOpportunities.filter(o => {
      const owner = getOwnerForOpp(o);
      return owner.initials === ownerFilter;
    });
  }

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
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-4 shadow-sm" data-testid="card-open-deals">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <OpenDealsIcon className="h-5 w-5" />
            Open Deals
          </div>
          <div className="text-2xl font-bold" data-testid="text-open-deals">{pipelineOpportunities.length}</div>
        </div>
        <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-4 shadow-sm" data-testid="card-pipeline-value">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <PipelineValueIcon className="h-5 w-5" />
            Total Pipeline Value
          </div>
          <div className="text-2xl font-bold text-[#22c55e]" data-testid="text-pipeline-value">${totalPipelineValue.toLocaleString()}</div>
        </div>
        <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-4 shadow-sm" data-testid="card-weighted-value">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <WeightedIcon className="h-5 w-5" />
            Weighted Value
          </div>
          <div className="text-2xl font-bold text-[#8b5cf6]" data-testid="text-weighted-value">${weightedPipelineValue.toLocaleString()}</div>
        </div>
        <div className="bg-white dark:bg-card rounded-xl border border-border/40 p-4 shadow-sm" data-testid="card-avg-deal">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <AvgDealIcon className="h-5 w-5" />
            Avg Deal Size
          </div>
          <div className="text-2xl font-bold text-[#f97316]" data-testid="text-avg-deal">${Math.round(avgDealSize).toLocaleString()}</div>
        </div>
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
            {ownerData.map(owner => (
              <SelectItem key={owner.initials} value={owner.initials}>
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
            ))}
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

        <button
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors"
          data-testid="button-filter-pipeline"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          Filter
        </button>

        <div className="flex-1" />

        <Dialog open={isCreatePipelineOpen} onOpenChange={setIsCreatePipelineOpen}>
          <DialogTrigger asChild>
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background text-foreground hover:bg-muted transition-colors"
              data-testid="button-create-pipeline-kanban"
            >
              <Plus className="h-4 w-4" />
              New Pipeline
            </button>
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
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" data-testid="button-cancel-pipeline-kanban">Cancel</Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={!pipelineName || createPipelineMutation.isPending}
                data-testid="button-save-pipeline-kanban"
              >
                {createPipelineMutation.isPending ? "Creating..." : "Create Pipeline"}
              </Button>
            </DialogFooter>
            </SubmitForm>
          </DialogContent>
        </Dialog>

        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) { setAddDealStageId(null); setEditingId(null); setFormData({ name: "", amount: "", stageId: "", accountId: "", expectedCloseDate: "", probability: "" }); } }}>
          <DialogTrigger asChild>
            <button
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#0ea5e9] hover:bg-[#0ea5e9]/90 text-white transition-colors"
              data-testid="button-add-opportunity-kanban"
            >
              <Plus className="h-4 w-4" />
              New Opportunity
            </button>
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
              disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
            >
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Opportunity" : "Create New Opportunity"}</DialogTitle>
            </DialogHeader>
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
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" data-testid="button-cancel-opp-kanban">Cancel</Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-opp-kanban"
              >
                {editingId
                  ? (updateMutation.isPending ? "Updating..." : "Update Opportunity")
                  : (createMutation.isPending ? "Creating..." : "Create Opportunity")}
              </Button>
            </DialogFooter>
            </SubmitForm>
          </DialogContent>
        </Dialog>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 pb-4 overflow-x-auto">
          {activeStages.map((stage, stageIndex) => {
            const stageColor = getStageColor(stage, stageIndex);
            const stageOpps = pipelineOpportunities.filter(o => o.stageId === stage.id);
            const stageValue = stageOpps.reduce((sum, o) => sum + parseFloat(o.amount || "0"), 0);

            return (
              <div key={stage.id} className="w-72 flex-shrink-0" data-testid={`stage-column-${stage.id}`}>
                <div
                  className="rounded-t-xl border border-b-0 border-border/40 bg-muted/30 dark:bg-muted/10 px-4 py-3"
                  style={{ borderTopColor: stageColor, borderTopWidth: "3px" }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm" data-testid={`stage-name-${stage.id}`}>{stage.name}</h3>
                      <div className="flex items-center gap-1">
                        <div
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: stageColor }}
                        />
                        <div
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: stageColor, opacity: 0.5 }}
                        />
                        <div
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: stageColor, opacity: 0.25 }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground" data-testid={`stage-value-${stage.id}`}>
                      {formatCurrency(stageValue.toString())}
                    </span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground" data-testid={`stage-count-${stage.id}`}>
                      {stageOpps.length} {stageOpps.length === 1 ? "deal" : "deals"}
                    </span>
                  </div>
                </div>

                <Droppable droppableId={`stage-${stage.id}`}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "space-y-2 min-h-[120px] p-2 border border-t-0 border-border/40 rounded-b-xl bg-muted/10 dark:bg-muted/5 transition-colors",
                        snapshot.isDraggingOver && "bg-primary/5 border-primary/30"
                      )}
                    >
                      {stageOpps.map((opp, index) => {
                        const account = accounts.find(a => a.id === opp.accountId);
                        const owner = getOwnerForOpp(opp);
                        const oppStage = stages.find(s => s.id === opp.stageId);
                        const probability = opp.probability ?? oppStage?.probability ?? 0;

                        return (
                          <Draggable key={opp.id} draggableId={`opp-${opp.id}`} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={cn(
                                  "bg-white dark:bg-card rounded-lg border border-border/50 shadow-sm cursor-grab hover:shadow-md transition-shadow overflow-hidden",
                                  snapshot.isDragging && "shadow-lg ring-2 ring-primary/30 rotate-1"
                                )}
                                data-testid={`opportunity-card-${opp.id}`}
                              >
                                <div className="flex">
                                  <div
                                    className="w-1 shrink-0 rounded-l-lg"
                                    style={{ backgroundColor: stageColor }}
                                  />
                                  <div className="flex-1 p-3 min-w-0">
                                    <div className="flex items-start justify-between gap-1 mb-1">
                                      <div className="min-w-0">
                                        {visibleFields.has("account") && account && (
                                          <p className="text-[11px] text-muted-foreground truncate" data-testid={`opp-account-${opp.id}`}>
                                            {account.name}
                                          </p>
                                        )}
                                        <h4 className="font-semibold text-sm leading-tight truncate" data-testid={`opp-name-${opp.id}`}>
                                          {opp.name}
                                        </h4>
                                      </div>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 shrink-0 -mt-0.5 -mr-1"
                                            data-testid={`opp-menu-${opp.id}`}
                                          >
                                            <MoreHorizontal className="h-3.5 w-3.5" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-52">
                                          <DropdownMenuItem
                                            onClick={() => handleEditOpp(opp)}
                                            data-testid={`action-edit-opp-${opp.id}`}
                                          >
                                            <Pencil className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                                            Edit Deal
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => deleteMutation.mutate(opp.id)}
                                            className="text-red-600 focus:text-red-600"
                                            data-testid={`action-delete-opp-${opp.id}`}
                                          >
                                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                                            Delete Deal
                                          </DropdownMenuItem>
                                          <Separator className="my-1" />
                                          <DropdownMenuItem
                                            onClick={() => setCardFieldsOpen(true)}
                                            data-testid={`edit-card-${opp.id}`}
                                          >
                                            <Settings2 className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                                            Edit Card Fields
                                          </DropdownMenuItem>
                                          <Separator className="my-1" />
                                          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                            Move to Stage
                                          </div>
                                          <Separator className="my-1" />
                                          {pipelineStages.filter(s => !s.isClosed && s.id !== stage.id).map((targetStage, ti) => (
                                            <DropdownMenuItem
                                              key={targetStage.id}
                                              onClick={() => updateStageMutation.mutate({ id: opp.id, stageId: targetStage.id })}
                                              data-testid={`move-opp-${opp.id}-to-stage-${targetStage.id}`}
                                            >
                                              <div
                                                className="w-2.5 h-2.5 rounded-full mr-2 shrink-0"
                                                style={{ backgroundColor: getStageColor(targetStage, ti) }}
                                              />
                                              {targetStage.name}
                                            </DropdownMenuItem>
                                          ))}
                                          {pipelines.filter(p => p.id !== activePipelineId).length > 0 && (
                                            <>
                                              <Separator className="my-1" />
                                              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                                Move to Pipeline
                                              </div>
                                              {pipelines.filter(p => p.id !== activePipelineId).map(targetPipeline => {
                                                const firstStage = stages.find(s => s.pipelineId === targetPipeline.id && !s.isClosed);
                                                return (
                                                  <DropdownMenuItem
                                                    key={targetPipeline.id}
                                                    onClick={() => {
                                                      if (firstStage) {
                                                        updateStageMutation.mutate({ id: opp.id, stageId: firstStage.id });
                                                      } else {
                                                        toast({
                                                          title: "Cannot move to pipeline",
                                                          description: "Target pipeline has no stages",
                                                          variant: "destructive"
                                                        });
                                                      }
                                                    }}
                                                    data-testid={`move-opp-${opp.id}-to-pipeline-${targetPipeline.id}`}
                                                  >
                                                    <ArrowRight className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                                                    {targetPipeline.name}
                                                  </DropdownMenuItem>
                                                );
                                              })}
                                            </>
                                          )}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>

                                    {visibleFields.has("amount") && (
                                      <div className="text-lg font-bold mt-1" data-testid={`opp-amount-${opp.id}`}>
                                        {formatCurrency(opp.amount)}
                                      </div>
                                    )}

                                    {visibleFields.has("stage") && oppStage && (
                                      <div className="mt-1.5">
                                        <span
                                          className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                                          style={{
                                            backgroundColor: `${stageColor}15`,
                                            color: stageColor
                                          }}
                                        >
                                          {oppStage.name}
                                        </span>
                                      </div>
                                    )}

                                    {visibleFields.has("industry") && account?.industry && (
                                      <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
                                        <span className="font-medium">Industry:</span> {account.industry}
                                      </p>
                                    )}

                                    {visibleFields.has("accountType") && account && (
                                      <p className="text-[11px] text-muted-foreground mt-1 truncate">
                                        <span className="font-medium">Type:</span> {account.type}
                                      </p>
                                    )}

                                    {visibleFields.has("pipeline") && activePipeline && (
                                      <p className="text-[11px] text-muted-foreground mt-1 truncate">
                                        <span className="font-medium">Pipeline:</span> {activePipeline.name}
                                      </p>
                                    )}

                                    {visibleFields.has("created") && opp.createdAt && (
                                      <p className="text-[11px] text-muted-foreground mt-1">
                                        <span className="font-medium">Created:</span> {formatDate(opp.createdAt)}
                                      </p>
                                    )}

                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                      {visibleFields.has("owner") && (
                                        <div
                                          className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                                          style={{ backgroundColor: owner.color }}
                                          title={owner.name}
                                        >
                                          {owner.initials}
                                        </div>
                                      )}
                                      {visibleFields.has("probability") && (
                                        <span className="text-xs text-muted-foreground">{probability}%</span>
                                      )}
                                      {visibleFields.has("closeDate") && opp.expectedCloseDate && (
                                        <>
                                          {visibleFields.has("probability") && <span className="text-xs text-muted-foreground">·</span>}
                                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                            <Calendar className="h-3 w-3" />
                                            {formatDate(opp.expectedCloseDate)}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                      {stageOpps.length === 0 && !snapshot.isDraggingOver && (
                        <div className="p-4 border-2 border-dashed border-border/30 rounded-lg text-center text-sm text-muted-foreground" data-testid={`stage-empty-${stage.id}`}>
                          Drop opportunities here
                        </div>
                      )}

                      <button
                        onClick={() => openAddDealForStage(stage.id)}
                        className="w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors py-2 px-1 flex items-center gap-1"
                        data-testid={`add-deal-stage-${stage.id}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add deal
                      </button>
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

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
    </div>
  );
}
