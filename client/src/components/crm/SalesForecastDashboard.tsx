import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogShell } from "@/components/ui/form-dialog-shell";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { ForecastMatrix } from "@/components/crm/ForecastMatrix";
import {
  buildForecastPeriodOptions,
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
  onOpenOpportunityNotes?: (opportunityId: number, accountId: number | null) => void;
  onNavigateToResourcePlan?: (opportunityId: number, planId?: number | null) => void;
}

export function SalesForecastDashboard({ opportunities, stages, pipelines = [], accounts = [], contacts = [], onOpenOpportunityNotes, onNavigateToResourcePlan }: SalesForecastDashboardProps) {
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
  const activePeriodLabel = periodRange?.label || periods.find(p => p.value === activePeriod)?.label || activePeriod;

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

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-2 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 pt-1">
        <div className="relative rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 50%, #3b82f6 100%)" }} data-testid="forecast-hero">
          <div className="absolute top-0 right-0 w-40 h-40 opacity-10">
            <svg viewBox="0 0 160 160" fill="none">
              <path d="M20 140L60 80L100 100L140 20" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="60" cy="80" r="6" fill="white"/>
              <circle cx="100" cy="100" r="6" fill="white"/>
              <circle cx="140" cy="20" r="6" fill="white"/>
            </svg>
          </div>
          <div className="px-6 sm:px-8 py-6 relative z-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-white" data-testid="text-forecast-title">
                  Pipeline Forecast — {activePeriodLabel}
                </h2>
                <p className="text-blue-200 text-sm mt-1 max-w-xl">
                  Time-period forecast matrix for open deals — weighted by stage probability. Summary KPIs live on the CRM Dashboard.
                </p>
              </div>
              <button
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-white/20 hover:bg-white/30 text-white border border-white/20 transition-colors shrink-0"
                data-testid="button-create-forecast"
                onClick={() => setCreateDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
                New Forecast
              </button>
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
          </div>
        </div>
      </div>

      <ForecastMatrix
        pipelines={pipelines}
        stages={stages.map(s => ({ ...s, pipelineId: s.pipelineId ?? null }))}
        opportunities={opportunities}
        accounts={accounts}
        contacts={contacts}
        forecastPeriodKey={activePeriod}
        forecastPeriodOptions={periods}
        onForecastPeriodChange={setSelectedPeriod}
        title="Pipeline Forecast"
        onOpenOpportunityNotes={onOpenOpportunityNotes}
        onNavigateToResourcePlan={onNavigateToResourcePlan}
      />
    </div>
  );
}
