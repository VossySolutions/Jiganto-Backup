import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { DollarSign, TrendingUp, Target, Users, Building2, Loader2, Plus, ArrowRight, Clock, MapPin } from "lucide-react";
import { useCrmUsers } from "./CrmUsersProvider";
import { ActivityAnalytics } from "./ActivityAnalytics";
import { getAccountTypeInfo } from "@/lib/crm-account-types";
import type { CrmActivity, CrmDashboardStats } from "./types";

interface CrmDashboardTabProps {
  stats: CrmDashboardStats | undefined;
  isLoading: boolean;
  activities?: CrmActivity[];
  onNavigateToTab?: (tab: string) => void;
  onNavigateToAccount360?: (accountId: number) => void;
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

export function CrmDashboardTab({ stats, isLoading, activities = [], onNavigateToTab, onNavigateToAccount360 }: CrmDashboardTabProps) {
  const { resolveOwner } = useCrmUsers();

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

  const isEmptyCrm =
    stats.openOpportunities === 0 &&
    stats.activeLeads === 0 &&
    stats.totalAccounts === 0;

  const displayWinRate = stats.winRate90d ?? stats.winRate;
  const wonRecent = stats.wonDeals90d ?? stats.wonDeals;
  const lostRecent = stats.lostDeals90d ?? stats.lostDeals;
  const totalClosedRecent = wonRecent + lostRecent;

  const kpiCards = [
    {
      title: "Pipeline Value",
      value: `$${stats.totalPipelineValue.toLocaleString()}`,
      subtitle: `${stats.openOpportunities} open opportunities`,
      helpText: "Sum of deal amounts for all open (not closed-won/lost) opportunities in your workspace.",
      icon: DollarSign,
      borderColor: "#0ea5e9",
      iconBgClassName: "bg-sky-100 dark:bg-sky-900/30",
      iconClassName: "text-[#0ea5e9]",
      valueClassName: "font-mono",
      testId: "kpi-pipeline-value",
    },
    {
      title: "Weighted Pipeline",
      value: `$${(stats.weightedPipelineValue || 0).toLocaleString()}`,
      subtitle: "Amount × stage probability",
      helpText: "Expected revenue from open deals: each opportunity amount multiplied by its stage win probability.",
      icon: TrendingUp,
      borderColor: "#8b5cf6",
      iconBgClassName: "bg-purple-100 dark:bg-purple-900/30",
      iconClassName: "text-purple-500",
      valueClassName: "font-mono",
      testId: "kpi-weighted-pipeline",
    },
    {
      title: "Win Rate (90d)",
      value: `${displayWinRate}%`,
      subtitle: totalClosedRecent > 0 ? `${wonRecent} won · ${lostRecent} lost (90 days)` : "No closed deals in 90 days",
      helpText: "Percentage of opportunities closed-won vs closed-lost in the last 90 days. Excludes still-open deals.",
      icon: Target,
      borderColor: "#a855f7",
      iconBgClassName: "bg-purple-100 dark:bg-purple-900/30",
      iconClassName: "text-purple-500",
      testId: "kpi-win-rate",
    },
    {
      title: "Avg Sales Cycle",
      value: stats.avgSalesCycle ? `${stats.avgSalesCycle} days` : "—",
      subtitle: "Create date → close date",
      helpText: "Average number of days from opportunity creation to close for won deals. Longer cycles may indicate complex sales.",
      icon: Clock,
      borderColor: "#06b6d4",
      iconBgClassName: "bg-cyan-100 dark:bg-cyan-900/30",
      iconClassName: "text-cyan-500",
      testId: "kpi-sales-cycle",
    },
    {
      title: "New Leads (Month)",
      value: String(stats.newLeadsThisMonth ?? stats.newLeads),
      subtitle: `${stats.hotLeads} marked hot`,
      helpText: "Leads created in the current calendar month. The subtitle shows leads flagged as hot priority.",
      icon: Users,
      borderColor: "#f59e0b",
      iconBgClassName: "bg-amber-100 dark:bg-amber-900/30",
      iconClassName: "text-amber-500",
      testId: "kpi-new-leads",
    },
    {
      title: "Lead Conversion",
      value: `${stats.leadConversionRate ?? 0}%`,
      subtitle: `${stats.activeLeads} leads not yet converted`,
      helpText: "Share of all leads that have been converted to customer accounts. Active leads are still in the funnel.",
      icon: Users,
      borderColor: "#22c55e",
      iconBgClassName: "bg-green-100 dark:bg-green-900/30",
      iconClassName: "text-green-500",
      testId: "kpi-lead-conversion",
    },
  ];

  const maxStageCount = Math.max(...stats.stageBreakdown.map(s => s.count), 1);
  const lossRate = totalClosedRecent > 0 ? 100 - displayWinRate : 0;

  const revenueForecast = stats.revenueForecast || [];
  const months = revenueForecast.map(r => r.month);
  const monthlyValues = revenueForecast.map(r => r.value);
  const hasForecastData = monthlyValues.some(v => v > 0);
  const maxMonthly = Math.max(...monthlyValues, 1);

  return (
    <div className="space-y-4 sm:space-y-6">
      {isEmptyCrm && onNavigateToTab && (
        <div
          className="rounded-xl border border-dashed border-[#0ea5e9]/40 bg-gradient-to-br from-sky-50/80 to-emerald-50/50 dark:from-sky-950/20 dark:to-emerald-950/10 p-4 sm:p-6"
          data-testid="crm-empty-state"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-[#0ea5e9]/10 flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6 text-[#0ea5e9]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm sm:text-base font-semibold">Get started with your CRM</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Add leads, accounts, and opportunities to populate your dashboard with live data from your workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button size="sm" className="gap-1.5" onClick={() => onNavigateToTab("leads")} data-testid="cta-add-lead">
                <Plus className="h-3.5 w-3.5" /> Add Lead
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onNavigateToTab("customers")} data-testid="cta-add-account">
                <ArrowRight className="h-3.5 w-3.5" /> Add Account
              </Button>
            </div>
          </div>
        </div>
      )}

      {onNavigateToTab && stats.totalAccounts > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="dashboard-quick-links">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              sessionStorage.setItem("crm-customers-view", "map");
              onNavigateToTab("customers");
            }}
            data-testid="dashboard-customer-geography"
          >
            <MapPin className="h-3.5 w-3.5" />
            Customer geography
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => onNavigateToTab("forecasting")}
            data-testid="dashboard-pipeline-forecast"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Pipeline forecast
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {kpiCards.map((kpi, i) => (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <MetricCard
              title={kpi.title}
              value={kpi.value}
              subtitle={kpi.subtitle}
              helpText={kpi.helpText}
              icon={kpi.icon}
              iconBgClassName={kpi.iconBgClassName}
              iconClassName={kpi.iconClassName}
              borderColor={kpi.borderColor}
              valueClassName={kpi.valueClassName}
              testId={kpi.testId}
            />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-3 flex h-full"
        >
          <Card className="rounded-xl flex flex-1 flex-col" data-testid="pipeline-by-stage">
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
          className="lg:col-span-2 flex h-full"
        >
          <Card className="rounded-xl flex flex-1 flex-col" data-testid="top-accounts">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Top Accounts</CardTitle>
                <button
                  onClick={() => onNavigateToTab?.("customers")}
                  className="text-sm text-[#0ea5e9] hover:text-[#0ea5e9]/80 font-medium flex items-center gap-1 transition-colors"
                  data-testid="link-view-customers"
                >
                  View customers →
                </button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              {stats.topAccounts.length === 0 ? (
                <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm" data-testid="accounts-empty">
                  No accounts to display
                </div>
              ) : (
                <div className="flex flex-1 flex-col divide-y divide-border/50">
                  {stats.topAccounts.slice(0, 5).map((account, index) => {
                    const initials = account.name
                      .split(" ")
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase();
                    const logoColor = ACCOUNT_LOGO_COLORS[index % ACCOUNT_LOGO_COLORS.length];
                    const typeLabel = getAccountTypeInfo(account.type).label;
                    const subtitle = [account.industry, typeLabel].filter(Boolean).join(" · ") || typeLabel;
                    const rowContent = (
                      <>
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
                            {subtitle}
                            {account.openDeals > 0 ? ` · ${account.openDeals} open deal${account.openDeals === 1 ? "" : "s"}` : ""}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="text-sm font-bold text-foreground">
                            {formatValue(account.totalValue)}
                          </span>
                        </div>
                      </>
                    );
                    return onNavigateToAccount360 ? (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => onNavigateToAccount360(account.id)}
                        className="flex flex-1 items-center gap-4 py-3 first:pt-0 last:pb-0 min-h-[2.75rem] w-full text-left hover:bg-muted/30 rounded-lg transition-colors -mx-1 px-1"
                        data-testid={`top-account-${account.id}`}
                      >
                        {rowContent}
                      </button>
                    ) : (
                      <div
                        key={account.id}
                        className="flex flex-1 items-center gap-4 py-3 first:pt-0 last:pb-0 min-h-[2.75rem]"
                        data-testid={`top-account-${account.id}`}
                      >
                        {rowContent}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex h-full"
        >
          <Card className="rounded-xl flex flex-1 flex-col" data-testid="win-loss-rate">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Win / Loss Rate</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Last 90 days · closed opportunities</p>
            </CardHeader>
            <CardContent className="flex flex-1 items-center">
              {totalClosedRecent === 0 ? (
                <div className="text-center w-full py-6 text-muted-foreground text-sm" data-testid="win-loss-empty">
                  No closed deals in the last 90 days
                </div>
              ) : (
              <div className="flex items-center gap-6 w-full">
                <div className="relative shrink-0" data-testid="win-loss-donut">
                  <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90">
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#ef4444" strokeWidth="14" />
                    <circle
                      cx="50" cy="50" r="38" fill="none" stroke="#22c55e" strokeWidth="14"
                      strokeDasharray={`${2 * Math.PI * 38}`}
                      strokeDashoffset={`${2 * Math.PI * 38 * (1 - displayWinRate / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-green-500" data-testid="win-rate-value">{displayWinRate}%</span>
                    <span className="text-[10px] text-muted-foreground">Win rate</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2 text-sm">
                  <div className="font-medium">{wonRecent} Won · {lostRecent} Lost</div>
                  <div className="flex items-center gap-3 pt-1">
                    <span className="inline-flex items-center gap-1.5 text-green-500 font-medium"><span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Won {displayWinRate}%</span>
                    <span className="inline-flex items-center gap-1.5 text-red-500 font-medium"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Lost {lossRate}%</span>
                  </div>
                </div>
              </div>
              )}
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
              <CardTitle className="text-base font-semibold">Revenue Forecast</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Weighted pipeline by expected close month</p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-end">
              {!hasForecastData ? (
                <div className="text-center py-8 text-muted-foreground text-sm" data-testid="revenue-forecast-empty">
                  No forecasted revenue from open opportunities
                </div>
              ) : (
              <div className="flex items-end gap-2 h-36">
                {months.map((month, i) => {
                  const heightPercent = (monthlyValues[i] / maxMonthly) * 100;
                  const isCurrentMonth = i === 0;
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
                          style={{ height: `${heightPercent}%` }}
                          title={`$${monthlyValues[i].toLocaleString()}`}
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
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="rounded-xl" data-testid="hot-opportunities">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Hot Opportunities</CardTitle>
              {onNavigateToTab && (stats.hotOpportunities || []).length > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigateToTab("opportunities")}
                  className="text-sm text-[#0ea5e9] hover:text-[#0ea5e9]/80 font-medium"
                >
                  View all →
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Highest-value open deals</p>
          </CardHeader>
          <CardContent>
            {(stats.hotOpportunities || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No open opportunities</p>
            ) : (
              <div className="space-y-2">
                {(stats.hotOpportunities || []).map(o => (
                  onNavigateToTab ? (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => onNavigateToTab("opportunities")}
                      className="flex justify-between text-sm border-b border-border/30 pb-2 last:border-0 w-full text-left hover:bg-muted/30 rounded-md px-1 -mx-1 transition-colors"
                      data-testid={`hot-opp-${o.id}`}
                    >
                      <div><span className="font-medium text-primary hover:underline">{o.name}</span><span className="text-xs text-muted-foreground block">{o.accountName} · {o.stage}</span></div>
                      <span className="font-semibold shrink-0">${o.amount.toLocaleString()}</span>
                    </button>
                  ) : (
                    <div key={o.id} className="flex justify-between text-sm border-b border-border/30 pb-2 last:border-0">
                      <div><span className="font-medium">{o.name}</span><span className="text-xs text-muted-foreground block">{o.accountName} · {o.stage}</span></div>
                      <span className="font-semibold shrink-0">${o.amount.toLocaleString()}</span>
                    </div>
                  )
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-xl" data-testid="recent-activity">
          <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Recent Activity</CardTitle></CardHeader>
          <CardContent>
            {(stats.recentActivity || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
            ) : (
              <div className="space-y-2">
                {(stats.recentActivity || []).map(a => (
                  <div key={a.id} className="text-sm border-b border-border/30 pb-2 last:border-0">
                    <span className="font-medium">{a.subject}</span>
                    <span className="text-xs text-muted-foreground block">{a.type} · {new Date(a.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-xl" data-testid="leaderboard">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Leaderboard</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Closed-won revenue by owner</p>
          </CardHeader>
          <CardContent>
            {(stats.leaderboard || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No closed-won deals yet</p>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const maxTotal = Math.max(...(stats.leaderboard || []).map(r => r.total), 1);
                  return (stats.leaderboard || []).map((r, i) => {
                    const owner = r.ownerId === "unassigned"
                      ? { name: "Unassigned", initials: "—", color: "#9ca3af" }
                      : resolveOwner(r.ownerId);
                    const barPct = Math.round((r.total / maxTotal) * 100);
                    return (
                      <div key={r.ownerId} className="space-y-1" data-testid={`leaderboard-bar-${r.ownerId}`}>
                        <div className="flex justify-between items-center gap-2 text-sm">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="text-muted-foreground shrink-0">#{i + 1}</span>
                            <span
                              className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                              style={{ backgroundColor: owner.color }}
                            >
                              {owner.initials}
                            </span>
                            <span className="truncate">{owner.name}</span>
                          </span>
                          <span className="font-semibold shrink-0 text-xs">${r.total.toLocaleString()} ({r.count})</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-[#0ea5e9] rounded-full transition-all duration-500" style={{ width: `${barPct}%` }} />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {activities.length > 0 && (
        <div className="border-t border-border/40 pt-6">
          <ActivityAnalytics activities={activities} />
        </div>
      )}
    </div>
  );
}
