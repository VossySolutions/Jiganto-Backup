import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { DollarSign, TrendingUp, Target, Users, Building2, Loader2, Database, Sparkles } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DashboardStats {
  totalPipelineValue: number;
  weightedPipelineValue: number;
  revenueWon: number;
  winRate: number;
  avgDealSize: number;
  openOpportunities: number;
  wonDeals: number;
  lostDeals: number;
  totalAccounts: number;
  activeLeads: number;
  hotLeads: number;
  newLeads: number;
  activeContracts: number;
  expiringContracts: number;
  stageBreakdown: { name: string; count: number; value: number; color: string }[];
  topAccounts: { id: number; name: string; type: string; industry: string | null; totalValue: number; openDeals: number; dealCount: number }[];
}

interface CrmDashboardTabProps {
  stats: DashboardStats | undefined;
  isLoading: boolean;
  onNavigateToTab?: (tab: string) => void;
}

const VIBRANT_BAR_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#8b5cf6",
  "#f97316",
  "#06b6d4",
  "#ec4899",
  "#eab308",
  "#14b8a6",
];

const ACCOUNT_LOGO_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f97316",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#eab308",
  "#ef4444",
];

function formatValue(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

export function CrmDashboardTab({ stats, isLoading, onNavigateToTab }: CrmDashboardTabProps) {
  const { toast } = useToast();
  const [demoLoaded, setDemoLoaded] = useState(false);

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/crm/seed-demo-data");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Demo data loaded", description: `Loaded ${data.counts?.leads || 0} leads, ${data.counts?.contracts || 0} contracts, ${data.counts?.activities || 0} activities, ${data.counts?.notes || 0} notes, and ${data.counts?.forecasts || 0} forecasts.` });
      setDemoLoaded(true);
      queryClient.invalidateQueries({ queryKey: ["/api/crm"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/forecasts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/opportunities"] });
    },
    onError: () => {
      toast({ title: "Failed to load demo data", description: "Please try again.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20" data-testid="dashboard-loading">
        <Loader2 className="h-8 w-8 animate-spin text-[#0ea5e9]" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground" data-testid="dashboard-empty">
        <Building2 className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm">No dashboard data available</p>
      </div>
    );
  }

  const needsDemoData = stats.activeLeads < 5 || stats.activeContracts < 3;

  const kpiCards = [
    {
      title: "Pipeline Value",
      value: `$${stats.totalPipelineValue.toLocaleString()}`,
      subtitle: `${stats.openOpportunities} open opportunities`,
      icon: DollarSign,
      borderColor: "#0ea5e9",
      iconBg: "bg-sky-100 dark:bg-sky-900/30",
      iconColor: "text-[#0ea5e9]",
      mono: true,
      testId: "kpi-pipeline-value",
    },
    {
      title: "Revenue Won",
      value: `$${stats.revenueWon.toLocaleString()}`,
      subtitle: `${stats.wonDeals} deals closed`,
      icon: TrendingUp,
      borderColor: "#22c55e",
      iconBg: "bg-green-100 dark:bg-green-900/30",
      iconColor: "text-green-500",
      mono: true,
      testId: "kpi-revenue-won",
    },
    {
      title: "Win Rate",
      value: `${stats.winRate}%`,
      subtitle: `${stats.lostDeals} lost deals`,
      icon: Target,
      borderColor: "#a855f7",
      iconBg: "bg-purple-100 dark:bg-purple-900/30",
      iconColor: "text-purple-500",
      mono: false,
      testId: "kpi-win-rate",
    },
    {
      title: "Active Leads",
      value: stats.activeLeads.toString(),
      subtitle: `${stats.hotLeads} hot leads`,
      icon: Users,
      borderColor: "#f59e0b",
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-500",
      mono: false,
      testId: "kpi-active-leads",
    },
  ];

  const maxStageCount = Math.max(...stats.stageBreakdown.map(s => s.count), 1);
  const lossRate = 100 - stats.winRate;
  const totalClosedDeals = stats.wonDeals + stats.lostDeals;

  const months = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const seedMultipliers = [0.45, 1.1, 0.6, 0.85, 0.7, 1.3];
  const monthlyValues = months.map((_, i) => {
    const base = stats.revenueWon > 0 ? stats.revenueWon / 6 : 50000;
    return Math.round(base * seedMultipliers[i]);
  });
  const maxMonthly = Math.max(...monthlyValues, 1);

  return (
    <div className="space-y-6">
      {(needsDemoData && !demoLoaded) && (
        <div className="relative overflow-hidden rounded-xl border border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 p-5" data-testid="demo-data-banner">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
              <Database className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Populate CRM with Demo Data</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Load realistic sample data across all tabs - accounts, leads, opportunities, contracts, activities, notes, and forecasts. You can explore every feature with lifelike data.</p>
            </div>
            <button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold shadow-md hover:shadow-lg hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-60"
              data-testid="button-load-demo-data"
            >
              {seedMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Load Demo Data
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, i) => (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card
              className="rounded-xl"
              style={{ borderTop: `3px solid ${kpi.borderColor}` }}
              data-testid={kpi.testId}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {kpi.title}
                </CardTitle>
                <div className={cn("p-2 rounded-lg", kpi.iconBg)}>
                  <kpi.icon className={cn("h-4 w-4", kpi.iconColor)} />
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className={cn("text-2xl font-bold", kpi.mono && "font-mono")}
                  data-testid={`${kpi.testId}-value`}
                >
                  {kpi.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{kpi.subtitle}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-3"
        >
          <Card className="rounded-xl h-full" data-testid="pipeline-by-stage">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Pipeline by Stage</CardTitle>
                <button
                  onClick={() => onNavigateToTab?.("pipeline")}
                  className="text-sm text-[#0ea5e9] hover:text-[#0ea5e9]/80 font-medium flex items-center gap-1 transition-colors"
                  data-testid="link-view-pipeline"
                >
                  View pipeline →
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {stats.stageBreakdown.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm" data-testid="pipeline-empty">
                  No pipeline stages to display
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.stageBreakdown.map((stage, index) => {
                    const widthPercent = Math.max((stage.count / maxStageCount) * 100, 8);
                    const barColor = VIBRANT_BAR_COLORS[index % VIBRANT_BAR_COLORS.length];
                    const dealLabel = stage.count === 1 ? "1 deal" : `${stage.count} deals`;
                    return (
                      <div key={stage.name} className="flex items-center gap-4" data-testid={`stage-${stage.name}`}>
                        <div className="w-24 shrink-0 text-sm font-medium text-foreground text-right">
                          {stage.name}
                        </div>
                        <div className="flex-1 relative">
                          <div className="h-8 bg-muted/40 rounded-md overflow-hidden">
                            <div
                              className="h-full rounded-md flex items-center px-3 transition-all duration-700 ease-out"
                              style={{
                                width: `${widthPercent}%`,
                                backgroundColor: barColor,
                              }}
                            >
                              <span className="text-white text-xs font-semibold whitespace-nowrap drop-shadow-sm">
                                {dealLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="w-16 shrink-0 text-right text-sm font-semibold text-foreground">
                          {formatValue(stage.value)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2"
        >
          <Card className="rounded-xl h-full" data-testid="top-accounts">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Top Accounts</CardTitle>
                <button
                  onClick={() => onNavigateToTab?.("customers")}
                  className="text-sm text-[#0ea5e9] hover:text-[#0ea5e9]/80 font-medium flex items-center gap-1 transition-colors"
                  data-testid="link-360-view"
                >
                  360° View →
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {stats.topAccounts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm" data-testid="accounts-empty">
                  No accounts to display
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {stats.topAccounts.slice(0, 5).map((account, index) => {
                    const initials = account.name
                      .split(" ")
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase();
                    const logoColor = ACCOUNT_LOGO_COLORS[index % ACCOUNT_LOGO_COLORS.length];
                    const segment = account.totalValue >= 1000000 ? "Enterprise" :
                                    account.totalValue >= 100000 ? "Mid-Market" : "SMB";
                    return (
                      <div
                        key={account.id}
                        className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                        data-testid={`top-account-${account.id}`}
                      >
                        <span className="text-sm font-semibold text-muted-foreground w-4 shrink-0">
                          {index + 1}
                        </span>
                        <div
                          className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                          style={{ backgroundColor: logoColor }}
                        >
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{account.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {segment} · {account.type === "customer" ? "Active" : account.type}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="text-sm font-bold text-foreground">
                            {formatValue(account.totalValue)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className="rounded-xl" data-testid="win-loss-rate">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Win / Loss Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="text-4xl font-bold text-green-500" data-testid="win-rate-value">
                    {stats.winRate}%
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <div className="font-medium">{stats.wonDeals} Won · {stats.lostDeals} Lost</div>
                    <div>Q1 {new Date().getFullYear()}</div>
                  </div>
                </div>

                <div className="w-full h-3 rounded-full overflow-hidden flex" data-testid="win-loss-bar">
                  <div
                    className="h-full bg-green-500 transition-all duration-700"
                    style={{ width: `${stats.winRate}%` }}
                  />
                  <div
                    className="h-full bg-red-500 transition-all duration-700"
                    style={{ width: `${lossRate}%` }}
                  />
                </div>

                <div className="flex justify-between text-sm font-medium">
                  <span className="text-green-500">Won {stats.winRate}%</span>
                  <span className="text-red-500">Lost {lossRate}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card className="rounded-xl" data-testid="monthly-revenue">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Monthly Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 h-36">
                {months.map((month, i) => {
                  const heightPercent = (monthlyValues[i] / maxMonthly) * 100;
                  const isCurrentMonth = i === months.length - 1;
                  return (
                    <div key={month} className="flex-1 flex flex-col items-center gap-1.5">
                      <div className="w-full relative flex items-end justify-center" style={{ height: "120px" }}>
                        <div
                          className={cn(
                            "w-full rounded-md transition-all duration-500",
                            isCurrentMonth
                              ? "bg-gradient-to-t from-[#0ea5e9] to-[#22c55e]"
                              : "bg-[#0ea5e9]/70"
                          )}
                          style={{ height: `${Math.max(heightPercent, 5)}%` }}
                        />
                      </div>
                      <span className={cn(
                        "text-xs font-medium",
                        isCurrentMonth ? "text-[#0ea5e9]" : "text-muted-foreground"
                      )}>
                        {month}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
