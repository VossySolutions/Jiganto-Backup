import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/ui/form-dialog-shell";
import { MetricCard } from "@/components/ui/metric-card";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Percent, Target, TrendingUp, CalendarRange } from "lucide-react";
import { ForecastMatrix } from "@/components/crm/ForecastMatrix";
import {
  buildForecastPeriodOptions,
  closeDateInForecastPeriod,
  getCurrentForecastPeriodKey,
  parseForecastPeriodKey,
} from "@/lib/crm-forecast-period";

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
  pipelineId?: number | null;
};

import type { CrmPipelineSummary } from "./types";

interface SalesForecastDashboardProps {
  opportunities: Opportunity[];
  stages: Stage[];
  pipelines?: CrmPipelineSummary[];
  accounts?: Array<{ id: number; name: string; annualRevenue?: string | null; customData?: Record<string, unknown> | null }>;
  contacts?: Array<{ id: number; firstName: string; lastName: string; accountId: number | null }>;
  onNavigateToResourcePlan?: (opportunityId: number, planId?: number | null) => void;
}

function formatCompact(value: number): string {
  if (value >= 1000000) return `£${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `£${Math.round(value / 1000)}K`;
  return `£${Math.round(value)}`;
}

export function SalesForecastDashboard({
  opportunities,
  stages,
  pipelines = [],
  accounts = [],
  contacts = [],
  onNavigateToResourcePlan,
}: SalesForecastDashboardProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(getCurrentForecastPeriodKey);
  const [newForecast, setNewForecast] = useState({
    forecastPeriod: "monthly",
    periodStart: "",
    periodEnd: "",
    quotaAmount: "",
    notes: "",
  });
  const { toast } = useToast();

  const now = new Date();
  const currentYear = now.getFullYear();

  const periods = useMemo(() => buildForecastPeriodOptions(currentYear), [currentYear]);

  const activePeriod = selectedPeriod || getCurrentForecastPeriodKey();
  const periodRange = useMemo(() => parseForecastPeriodKey(activePeriod), [activePeriod]);
  const activePeriodLabel = periodRange?.label || periods.find((p) => p.value === activePeriod)?.label || activePeriod;

  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);
  const closedStageIds = useMemo(() => new Set(stages.filter((s) => s.isClosed).map((s) => s.id)), [stages]);

  const scopedOpportunities = useMemo(() => {
    if (!periodRange) return opportunities;
    return opportunities.filter((o) => closeDateInForecastPeriod(o.expectedCloseDate, periodRange));
  }, [opportunities, periodRange]);

  const openOpps = useMemo(
    () => scopedOpportunities.filter((o) => !o.stageId || !closedStageIds.has(o.stageId)),
    [scopedOpportunities, closedStageIds],
  );

  const getEffectiveProbability = (o: Opportunity) => {
    const stage = o.stageId ? stageById.get(o.stageId) : undefined;
    return o.probability ?? stage?.probability ?? 0;
  };

  const forecastKpis = useMemo(() => {
    const totalPipeline = openOpps.reduce((s, o) => s + parseFloat(o.amount || "0"), 0);
    const weightedForecast = openOpps.reduce(
      (s, o) => s + parseFloat(o.amount || "0") * (getEffectiveProbability(o) / 100),
      0,
    );
    const probs = openOpps.map(getEffectiveProbability).filter((p) => p > 0);
    const avgWinProbability = probs.length > 0 ? Math.round(probs.reduce((a, b) => a + b, 0) / probs.length) : 0;
    const avgDealSize = openOpps.length > 0 ? totalPipeline / openOpps.length : 0;
    return {
      totalPipeline,
      weightedForecast,
      closingThisQuarter: totalPipeline,
      avgWinProbability,
      avgDealSize,
      dealCount: openOpps.length,
    };
  }, [openOpps, stageById]);

  const getDefaultDates = (period: string) => {
    const year = currentYear;
    const month = now.getMonth();
    if (period === "monthly") {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
    }
    if (period === "quarterly") {
      const quarter = Math.floor(month / 3);
      const start = new Date(year, quarter * 3, 1);
      const end = new Date(year, quarter * 3 + 3, 0);
      return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
    }
    return { start: `${year}-01-01`, end: `${year}-12-31` };
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

  return (
    <div className="space-y-4" data-testid="forecast-dashboard">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-2 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 pt-1 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold" data-testid="text-forecast-title">
              Pipeline Forecast — {activePeriodLabel}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Time-period forecast matrix for open deals in the selected quarter
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <MetricCard
            title="Total Pipeline"
            value={formatCompact(forecastKpis.totalPipeline)}
            subtitle={`${forecastKpis.dealCount} open deal${forecastKpis.dealCount !== 1 ? "s" : ""}`}
            icon={DollarSign}
            borderColor="#0ea5e9"
            iconBgClassName="bg-sky-100 dark:bg-sky-900/30"
            iconClassName="text-[#0ea5e9]"
            valueClassName="font-mono text-lg"
            testId="kpi-total-pipeline"
          />
          <MetricCard
            title="Weighted Forecast"
            value={formatCompact(forecastKpis.weightedForecast)}
            subtitle="Amount × probability"
            icon={TrendingUp}
            borderColor="#8b5cf6"
            iconBgClassName="bg-violet-100 dark:bg-violet-900/30"
            iconClassName="text-violet-500"
            valueClassName="font-mono text-lg"
            testId="kpi-weighted-forecast"
          />
          <MetricCard
            title="Closing This Quarter"
            value={formatCompact(forecastKpis.closingThisQuarter)}
            subtitle={activePeriodLabel}
            icon={CalendarRange}
            borderColor="#22c55e"
            iconBgClassName="bg-emerald-100 dark:bg-emerald-900/30"
            iconClassName="text-emerald-600"
            valueClassName="font-mono text-lg"
            testId="kpi-closing-quarter"
          />
          <MetricCard
            title="Avg Win Probability"
            value={`${forecastKpis.avgWinProbability}%`}
            subtitle="Across open deals"
            icon={Percent}
            borderColor="#f59e0b"
            iconBgClassName="bg-amber-100 dark:bg-amber-900/30"
            iconClassName="text-amber-600"
            testId="kpi-avg-probability"
          />
          <MetricCard
            title="Avg Deal Size"
            value={formatCompact(forecastKpis.avgDealSize)}
            subtitle="Per opportunity"
            icon={Target}
            borderColor="#06b6d4"
            iconBgClassName="bg-cyan-100 dark:bg-cyan-900/30"
            iconClassName="text-cyan-600"
            valueClassName="font-mono text-lg"
            testId="kpi-avg-deal-size"
          />
        </div>
      </div>

      <ForecastMatrix
        pipelines={pipelines}
        stages={stages.map((s) => ({ ...s, pipelineId: s.pipelineId ?? null }))}
        opportunities={opportunities}
        accounts={accounts}
        contacts={contacts}
        forecastPeriodKey={activePeriod}
        forecastPeriodOptions={periods}
        onForecastPeriodChange={setSelectedPeriod}
        onCreateForecast={() => setCreateDialogOpen(true)}
        onNavigateToResourcePlan={onNavigateToResourcePlan}
      />

      <FormDialogShell
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        title="Create Forecast"
        subtitle="Create a new forecast period"
        saveLabel={createForecastMutation.isPending ? "Creating..." : "Create Forecast"}
        onCancel={() => setCreateDialogOpen(false)}
        onSubmit={() => createForecastMutation.mutate(newForecast)}
        saving={createForecastMutation.isPending}
        size="md"
        saveTestId="button-save-forecast"
      >
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
      </FormDialogShell>
    </div>
  );
}
