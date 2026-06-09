import {
  AI_INSIGHTS_SYSTEM_PROMPT,
  generateAiInsights,
  type AiInsightItem,
} from "../lib/ai-insights-generator";
import { getCustomerMgmtDashboard } from "./store";

function customerMgmtRules(summary: Record<string, unknown>): AiInsightItem[] {
  const insights: AiInsightItem[] = [];
  const health = summary.health as { atRisk?: number; watch?: number; healthy?: number } | undefined;
  const trials = summary.trials as { expiringThisWeek?: number } | undefined;
  const billing = summary.billing as { overdueInvoices?: number; mrrPence?: number } | undefined;

  if ((health?.atRisk ?? 0) > 0) {
    insights.push({
      type: "anomaly",
      severity: "high",
      title: "Customers at risk",
      description: `${health!.atRisk} customer(s) in the At Risk health band. Schedule CSM outreach immediately.`,
    });
  }
  if ((health?.watch ?? 0) > 0) {
    insights.push({
      type: "risk",
      severity: "medium",
      title: "Customers on watch",
      description: `${health!.watch} customer(s) need proactive check-ins before health deteriorates.`,
    });
  }
  if ((trials?.expiringThisWeek ?? 0) > 0) {
    insights.push({
      type: "risk",
      severity: "high",
      title: "Trials expiring this week",
      description: `${trials!.expiringThisWeek} trial(s) expire within 7 days. Prioritise conversion conversations.`,
    });
  }
  if ((billing?.overdueInvoices ?? 0) > 0) {
    insights.push({
      type: "anomaly",
      severity: "medium",
      title: "Overdue invoices",
      description: `${billing!.overdueInvoices} overdue invoice(s). Review billing and payment follow-up.`,
    });
  }
  if (insights.length === 0) {
    insights.push({
      type: "positive",
      severity: "info",
      title: "Customer portfolio stable",
      description: "No urgent customer health or trial alerts. Continue regular CSM cadence.",
    });
  }
  return insights;
}

export async function generateCustomerMgmtAiInsights() {
  const dashboard = await getCustomerMgmtDashboard();

  const summary = {
    overview: {
      activeCustomers: dashboard.overview.kpis.activeCustomers,
      onTrial: dashboard.overview.kpis.onTrial,
      mrrPence: dashboard.overview.kpis.mrrPence,
      atRiskCount: dashboard.overview.kpis.atRiskCount,
    },
    health: {
      healthy: dashboard.health.healthy,
      watch: dashboard.health.watch,
      atRisk: dashboard.health.atRisk,
      averageScore: dashboard.health.averageScore,
      attentionCustomers: dashboard.health.attentionRows.slice(0, 5).map((r) => ({
        name: r.customerName,
        band: r.band,
        score: r.score,
        signal: r.primarySignal,
      })),
    },
    trials: {
      expiringThisWeek: dashboard.trials.kpis.expiringThisWeek,
      conversionRate90d: dashboard.trials.kpis.conversionRate90d,
      activeTrials: dashboard.trials.rows.length,
    },
    renewals: {
      atRiskRenewals: dashboard.renewals.kpis.atRiskRenewals,
      renewing30DaysPence: dashboard.renewals.kpis.renewing30DaysPence,
    },
    billing: {
      mrrPence: dashboard.billing.mrrPence,
      overdueInvoices: dashboard.billing.overdueInvoices,
      thresholdBreached: dashboard.billing.thresholdBreached,
    },
  };

  return generateAiInsights({
    summary,
    systemPrompt: `${AI_INSIGHTS_SYSTEM_PROMPT}
Focus on: customer health bands, trial conversion, renewals at risk, MRR trends, and CSM actions.`,
    rulesFallback: () => customerMgmtRules(summary),
  });
}
