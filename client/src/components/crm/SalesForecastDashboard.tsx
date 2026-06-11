import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { SubmitForm } from "@/components/ui/submit-form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { ForecastMatrix } from "@/components/crm/ForecastMatrix";
import { useCrmUsers } from "./CrmUsersProvider";

type Forecast = {
  id: number;
  tenantId: number;
  userId: string;
  forecastPeriod: string;
  periodStart: string | null;
  periodEnd: string | null;
  quotaAmount: string | null;
  forecastAmount: string | null;
  closedAmount: string | null;
  pipelineAmount: string | null;
  weightedAmount: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type Opportunity = {
  id: number;
  name: string;
  amount: string | null;
  probability: number | null;
  expectedCloseDate: string | null;
  stageId: number | null;
  ownerUserId: string | null;
};

type Stage = {
  id: number;
  name: string;
  order: number;
  probability: number | null;
  color: string | null;
  isClosed: boolean | null;
  isWon: boolean | null;
};

type CrmPipeline = { id: number; name: string; isDefault: boolean | null };

interface SalesForecastDashboardProps {
  opportunities: Opportunity[];
  stages: Stage[];
  pipelines?: CrmPipeline[];
}

const VIBRANT_LOGO_COLORS = [
  "#3b82f6", "#22c55e", "#f97316", "#8b5cf6",
  "#ec4899", "#06b6d4", "#eab308", "#ef4444",
  "#14b8a6", "#6366f1",
];

const STAGE_COLORS: Record<string, string> = {
  "Prospecting": "#f97316",
  "Discovery": "#f97316",
  "Qualification": "#22c55e",
  "Demo": "#22c55e",
  "Needs Analysis": "#3b82f6",
  "Proposal": "#3b82f6",
  "Trial / POC": "#06b6d4",
  "Negotiation": "#f97316",
  "Closing": "#8b5cf6",
  "Closed Won": "#22c55e",
  "Closed Lost": "#ef4444",
};

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return VIBRANT_LOGO_COLORS[Math.abs(hash) % VIBRANT_LOGO_COLORS.length];
}

function getInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

function formatCompact(value: number): string {
  if (value >= 1000000) return `£${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `£${Math.round(value / 1000)}K`;
  return `£${Math.round(value)}`;
}

function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);
}

export function SalesForecastDashboard({ opportunities, stages, pipelines = [] }: SalesForecastDashboardProps) {
  const { resolveOwner } = useCrmUsers();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingForecast, setEditingForecast] = useState<Forecast | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [newForecast, setNewForecast] = useState({
    forecastPeriod: "monthly",
    periodStart: "",
    periodEnd: "",
    quotaAmount: "",
    notes: "",
  });
  const { toast } = useToast();

  const { data: forecasts = [] } = useQuery<Forecast[]>({
    queryKey: ["/api/crm/forecasts"],
  });

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);

  const periods = useMemo(() => {
    const result = [];
    const prevQ = currentQuarter === 1 ? 4 : currentQuarter - 1;
    const prevYear = currentQuarter === 1 ? currentYear - 1 : currentYear;
    result.push({ label: `Q${prevQ} ${prevYear}`, value: `Q${prevQ}-${prevYear}` });

    result.push({ label: `Q${currentQuarter} ${currentYear}`, value: `Q${currentQuarter}-${currentYear}` });

    const nextQ = currentQuarter === 4 ? 1 : currentQuarter + 1;
    const nextYear = currentQuarter === 4 ? currentYear + 1 : currentYear;
    result.push({ label: `Q${nextQ} ${nextYear}`, value: `Q${nextQ}-${nextYear}` });

    if (currentQuarter < 3) {
      const q = currentQuarter + 2;
      result.push({ label: `Q${q} ${currentYear}`, value: `Q${q}-${currentYear}` });
    }

    result.push({ label: `FY ${currentYear}`, value: `FY-${currentYear}` });
    return result;
  }, [currentYear, currentQuarter]);

  const activePeriod = selectedPeriod || `Q${currentQuarter}-${currentYear}`;
  const activePeriodLabel = periods.find(p => p.value === activePeriod)?.label || `Q${currentQuarter} ${currentYear}`;

  const openOpps = useMemo(() => {
    const closedStageIds = new Set(stages.filter(s => s.isClosed).map(s => s.id));
    return opportunities.filter(o => !o.stageId || !closedStageIds.has(o.stageId));
  }, [opportunities, stages]);

  const totalPipeline = useMemo(() => openOpps.reduce((s, o) => s + parseFloat(o.amount || "0"), 0), [openOpps]);
  const weightedForecast = useMemo(() => openOpps.reduce((s, o) => s + (parseFloat(o.amount || "0") * ((o.probability ?? 0) / 100)), 0), [openOpps]);
  const committedOpps = useMemo(() => openOpps.filter(o => (o.probability ?? 0) >= 70), [openOpps]);
  const committedValue = useMemo(() => committedOpps.reduce((s, o) => s + parseFloat(o.amount || "0"), 0), [committedOpps]);
  const avgWinRate = useMemo(() => {
    if (openOpps.length === 0) return 0;
    const sum = openOpps.reduce((s, o) => s + (o.probability ?? 0), 0);
    return Math.round(sum / openOpps.length);
  }, [openOpps]);

  const stageData = useMemo(() => {
    const openStages = stages.filter(s => !s.isClosed);
    return openStages
      .sort((a, b) => a.order - b.order)
      .map(stage => {
        const stageOpps = openOpps.filter(o => o.stageId === stage.id);
        const totalValue = stageOpps.reduce((s, o) => s + parseFloat(o.amount || "0"), 0);
        const weightedValue = stageOpps.reduce((s, o) => s + (parseFloat(o.amount || "0") * ((o.probability ?? 0) / 100)), 0);
        return {
          id: stage.id,
          name: stage.name,
          color: stage.color || STAGE_COLORS[stage.name] || getColorForName(stage.name),
          probability: stage.probability ?? 0,
          dealCount: stageOpps.length,
          totalValue,
          weightedValue,
        };
      })
      .filter(s => s.dealCount > 0);
  }, [stages, openOpps]);

  const maxWeightedBar = useMemo(() => Math.max(...stageData.map(s => s.weightedValue), 1), [stageData]);

  const repData = useMemo(() => {
    const reps: Record<string, { name: string; weighted: number }> = {};
    for (const o of openOpps) {
      const ownerId = o.ownerUserId || "unassigned";
      const ownerName = resolveOwner(o.ownerUserId).name;
      if (!reps[ownerId]) reps[ownerId] = { name: ownerName, weighted: 0 };
      reps[ownerId].weighted += parseFloat(o.amount || "0") * ((o.probability ?? 0) / 100);
    }
    return Object.entries(reps)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.weighted - a.weighted)
      .slice(0, 6);
  }, [openOpps, resolveOwner]);

  const getDefaultDates = (period: string) => {
    const year = currentYear;
    const month = now.getMonth();
    if (period === "monthly") {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
    } else if (period === "quarterly") {
      const quarter = Math.floor(month / 3);
      const start = new Date(year, quarter * 3, 1);
      const end = new Date(year, quarter * 3 + 3, 0);
      return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
    } else {
      return { start: `${year}-01-01`, end: `${year}-12-31` };
    }
  };

  const createForecastMutation = useMutation({
    mutationFn: async (data: typeof newForecast) => {
      const defaults = getDefaultDates(data.forecastPeriod);
      return apiRequest("POST", "/api/crm/forecasts", {
        forecastPeriod: data.forecastPeriod,
        periodStart: data.periodStart || defaults.start,
        periodEnd: data.periodEnd || defaults.end,
        quotaAmount: data.quotaAmount || "0",
        notes: data.notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/forecasts"] });
      toast({ title: "Forecast created successfully" });
      setCreateDialogOpen(false);
      setNewForecast({ forecastPeriod: "monthly", periodStart: "", periodEnd: "", quotaAmount: "", notes: "" });
    },
    onError: () => toast({ title: "Failed to create forecast", variant: "destructive" }),
  });

  const updateForecastMutation = useMutation({
    mutationFn: async (data: Partial<Forecast> & { id: number }) => {
      return apiRequest("PUT", `/api/crm/forecasts/${data.id}`, {
        forecastPeriod: data.forecastPeriod,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        quotaAmount: data.quotaAmount,
        notes: data.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/forecasts"] });
      toast({ title: "Forecast updated successfully" });
      setEditDialogOpen(false);
      setEditingForecast(null);
    },
    onError: () => toast({ title: "Failed to update forecast", variant: "destructive" }),
  });

  const deleteForecastMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/crm/forecasts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/forecasts"] });
      toast({ title: "Forecast deleted successfully" });
    },
    onError: () => toast({ title: "Failed to delete forecast", variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="relative rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 50%, #3b82f6 100%)" }} data-testid="forecast-hero">
        <div className="absolute top-0 right-0 w-40 h-40 opacity-10">
          <svg viewBox="0 0 160 160" fill="none">
            <path d="M20 140L60 80L100 100L140 20" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="60" cy="80" r="6" fill="white"/>
            <circle cx="100" cy="100" r="6" fill="white"/>
            <circle cx="140" cy="20" r="6" fill="white"/>
          </svg>
        </div>
        <div className="px-8 py-8 relative z-10">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h2 className="text-2xl font-bold text-white" data-testid="text-forecast-title">
                Revenue Forecast — {activePeriodLabel}
              </h2>
              <p className="text-blue-200 text-sm mt-1">
                AI-weighted pipeline forecast based on deal stage, probability and historical win rates
              </p>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <button
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-white/20 hover:bg-white/30 text-white border border-white/20 transition-colors"
                  data-testid="button-create-forecast"
                >
                  <Plus className="h-4 w-4" />
                  New Forecast
                </button>
              </DialogTrigger>
              <DialogContent>
                <SubmitForm
                  onSubmit={() => createForecastMutation.mutate(newForecast)}
                  disabled={createForecastMutation.isPending}
                >
                <DialogHeader>
                  <DialogTitle>Create Forecast</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Period Type</Label>
                    <Select value={newForecast.forecastPeriod} onValueChange={(v) => setNewForecast({ ...newForecast, forecastPeriod: v })}>
                      <SelectTrigger data-testid="select-period-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={newForecast.periodStart}
                        onChange={(e) => setNewForecast({ ...newForecast, periodStart: e.target.value })}
                        data-testid="input-period-start"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={newForecast.periodEnd}
                        onChange={(e) => setNewForecast({ ...newForecast, periodEnd: e.target.value })}
                        data-testid="input-period-end"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Quota Target (£)</Label>
                    <Input
                      type="number"
                      value={newForecast.quotaAmount}
                      onChange={(e) => setNewForecast({ ...newForecast, quotaAmount: e.target.value })}
                      placeholder="100000"
                      data-testid="input-quota"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Input
                      value={newForecast.notes}
                      onChange={(e) => setNewForecast({ ...newForecast, notes: e.target.value })}
                      placeholder="Optional notes"
                      data-testid="input-notes"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button
                    type="submit"
                    disabled={createForecastMutation.isPending}
                    data-testid="button-save-forecast"
                  >
                    {createForecastMutation.isPending ? "Creating..." : "Create Forecast"}
                  </Button>
                </DialogFooter>
                </SubmitForm>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex items-end gap-10 mt-6">
            <div data-testid="kpi-weighted-forecast">
              <div className="text-3xl font-bold text-white tracking-tight">{formatCompact(weightedForecast)}</div>
              <div className="text-blue-200 text-xs mt-0.5">Weighted Forecast</div>
            </div>
            <div data-testid="kpi-total-pipeline">
              <div className="text-3xl font-bold text-white tracking-tight">{formatCompact(totalPipeline)}</div>
              <div className="text-blue-200 text-xs mt-0.5">Total Pipeline</div>
            </div>
            <div data-testid="kpi-committed">
              <div className="text-3xl font-bold text-white tracking-tight">{formatCompact(committedValue)}</div>
              <div className="text-blue-200 text-xs mt-0.5">Committed (High Prob)</div>
            </div>
            <div data-testid="kpi-win-rate">
              <div className="text-3xl font-bold text-white tracking-tight">{avgWinRate}%</div>
              <div className="text-blue-200 text-xs mt-0.5">Avg Win Rate</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1" data-testid="period-selector">
        {periods.map(p => (
          <button
            key={p.value}
            onClick={() => setSelectedPeriod(p.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              activePeriod === p.value
                ? "bg-foreground text-background border-foreground"
                : "bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            data-testid={`period-${p.value}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,280px] gap-6">
        <div className="bg-white dark:bg-card rounded-xl border border-border/40 shadow-sm p-6" data-testid="pipeline-by-stage">
          <h3 className="text-base font-semibold mb-5">Pipeline by Stage — Weighted Value</h3>

          {stageData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <svg className="h-10 w-10 mx-auto opacity-30 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/>
              </svg>
              <p className="text-sm">No open opportunities to forecast</p>
            </div>
          ) : (
            <div className="space-y-4">
              {stageData.map(stage => {
                const barPercent = Math.max(5, (stage.weightedValue / maxWeightedBar) * 100);
                return (
                  <div key={stage.id} className="flex items-center gap-4" data-testid={`stage-bar-${stage.id}`}>
                    <div className="w-28 text-sm text-muted-foreground shrink-0 text-right">{stage.name}</div>
                    <div className="flex-1 flex items-center gap-3">
                      <div className="flex-1 relative h-8">
                        <div
                          className="absolute inset-y-0 left-0 rounded-md flex items-center px-3 transition-all"
                          style={{ width: `${barPercent}%`, backgroundColor: stage.color }}
                        >
                          <span className="text-white text-xs font-medium whitespace-nowrap">
                            {stage.dealCount} deal{stage.dealCount !== 1 ? "s" : ""} · {stage.probability}% prob
                          </span>
                        </div>
                      </div>
                      <div className="w-16 text-right text-sm font-semibold shrink-0">{formatCompact(stage.weightedValue)}</div>
                      <div className="w-10 text-right text-xs text-muted-foreground shrink-0">{Math.round((stage.weightedValue / weightedForecast) * 100) || 0}%</div>
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-end pt-3 border-t border-border/40 mt-2">
                <span className="text-sm text-muted-foreground mr-3">Total Weighted Forecast:</span>
                <span className="text-lg font-bold text-[#22c55e]" data-testid="text-total-weighted">{formatCompact(weightedForecast)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-card rounded-xl border border-border/40 shadow-sm p-5" data-testid="forecast-by-rep">
          <h3 className="text-base font-semibold mb-4">Forecast by Rep</h3>
          {repData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No data available</p>
          ) : (
            <div className="space-y-3">
              {repData.map(rep => {
                const color = getColorForName(rep.name);
                const initials = getInitials(rep.name);
                const displayName = rep.name.length > 12 ? rep.name.slice(0, 10) + "..." : rep.name;
                return (
                  <div key={rep.id} className="flex items-center gap-3" data-testid={`rep-forecast-${rep.id}`}>
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">{displayName}</span>
                    </div>
                    <span className="text-sm font-semibold text-right shrink-0">{formatCompact(rep.weighted)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {forecasts.length > 0 && (
        <div className="bg-white dark:bg-card rounded-xl border border-border/40 shadow-sm p-6" data-testid="forecast-history">
          <h3 className="text-base font-semibold mb-4">Forecast History</h3>
          <div className="space-y-3">
            {forecasts.slice(0, 5).map((forecast) => {
              const forecastQuota = parseFloat(forecast.quotaAmount || "0");
              const periodOpps = opportunities.filter(o => {
                if (!o.expectedCloseDate) return false;
                const closeDate = new Date(o.expectedCloseDate);
                if (forecast.periodStart && closeDate < new Date(forecast.periodStart)) return false;
                if (forecast.periodEnd && closeDate > new Date(forecast.periodEnd)) return false;
                return true;
              });
              const periodClosed = periodOpps.filter(o => o.probability === 100);
              const forecastClosed = periodClosed.reduce((sum, o) => sum + parseFloat(o.amount || "0"), 0);
              const attainment = forecastQuota > 0 ? Math.round((forecastClosed / forecastQuota) * 100) : 0;
              const status = attainment >= 100 ? "achieved" : attainment >= 70 ? "on-track" : attainment >= 40 ? "at-risk" : "behind";
              const statusColors: Record<string, string> = {
                "achieved": "#22c55e", "on-track": "#3b82f6", "at-risk": "#f97316", "behind": "#ef4444",
              };

              return (
                <div key={forecast.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40 hover:bg-muted/30 transition-colors" data-testid={`forecast-item-${forecast.id}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: statusColors[status] }} title={status} />
                    <div>
                      <div className="font-medium text-sm capitalize">{forecast.forecastPeriod} Forecast</div>
                      <div className="text-xs text-muted-foreground">
                        {forecast.periodStart ? new Date(forecast.periodStart).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "N/A"} – {forecast.periodEnd ? new Date(forecast.periodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "N/A"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-semibold text-sm">{formatCurrencyFull(forecastQuota)}</div>
                      <div className="text-xs text-muted-foreground">{attainment}% attained</div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`forecast-menu-${forecast.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditingForecast(forecast); setEditDialogOpen(true); }} data-testid={`forecast-edit-${forecast.id}`}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteForecastMutation.mutate(forecast.id)}
                          className="text-destructive focus:text-destructive"
                          data-testid={`forecast-delete-${forecast.id}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <SubmitForm
            onSubmit={() => editingForecast && updateForecastMutation.mutate(editingForecast)}
            disabled={updateForecastMutation.isPending}
          >
          <DialogHeader>
            <DialogTitle>Edit Forecast</DialogTitle>
          </DialogHeader>
          {editingForecast && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Period Type</Label>
                <Select
                  value={editingForecast.forecastPeriod}
                  onValueChange={(v) => setEditingForecast({ ...editingForecast, forecastPeriod: v })}
                >
                  <SelectTrigger data-testid="edit-select-period-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={editingForecast.periodStart?.split("T")[0] || ""}
                    onChange={(e) => setEditingForecast({ ...editingForecast, periodStart: e.target.value })}
                    data-testid="edit-input-period-start"
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={editingForecast.periodEnd?.split("T")[0] || ""}
                    onChange={(e) => setEditingForecast({ ...editingForecast, periodEnd: e.target.value })}
                    data-testid="edit-input-period-end"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Quota Target (£)</Label>
                <Input
                  type="number"
                  value={editingForecast.quotaAmount || ""}
                  onChange={(e) => setEditingForecast({ ...editingForecast, quotaAmount: e.target.value })}
                  placeholder="100000"
                  data-testid="edit-input-quota"
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={editingForecast.notes || ""}
                  onChange={(e) => setEditingForecast({ ...editingForecast, notes: e.target.value })}
                  placeholder="Optional notes"
                  data-testid="edit-input-notes"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={updateForecastMutation.isPending}
              data-testid="button-update-forecast"
            >
              {updateForecastMutation.isPending ? "Updating..." : "Update Forecast"}
            </Button>
          </DialogFooter>
          </SubmitForm>
        </DialogContent>
      </Dialog>

      <div className="mt-8 pt-6 border-t">
        <h3 className="text-base font-semibold mb-4">Time-Period Forecast Matrix</h3>
        <ForecastMatrix pipelines={pipelines} />
      </div>
    </div>
  );
}
