import {
  AI_INSIGHTS_SYSTEM_PROMPT,
  generateAiInsights,
  type AiInsightItem,
} from "../lib/ai-insights-generator";
import {
  loadCrmModuleDashboard,
  loadKpiStrip,
  loadProjectsModuleDashboard,
  loadTasksModuleDashboard,
  type DashboardScope,
} from "./metrics";
import { loadDashboardBriefing } from "./module-metrics";

function dashboardRules(summary: Record<string, unknown>): AiInsightItem[] {
  const insights: AiInsightItem[] = [];
  const kpi = summary.kpiStrip as { activeItems?: number; atRisk?: number; critical?: number } | undefined;
  const projects = summary.projects as { atRisk?: number; total?: number; milestonesDue?: number } | undefined;
  const tasks = summary.tasks as { overdue?: number; open?: number } | undefined;

  if ((kpi?.atRisk ?? 0) > 0) {
    insights.push({
      type: "risk",
      severity: "high",
      title: "Projects at risk",
      description: `${kpi!.atRisk} project(s) flagged at risk. Review RAG status and recovery plans on the Projects dashboard.`,
    });
  }
  if ((kpi?.critical ?? 0) > 0) {
    insights.push({
      type: "anomaly",
      severity: "high",
      title: "Critical items need attention",
      description: `${kpi!.critical} critical item(s) including overdue work. Open the dashboard briefing for details.`,
    });
  }
  if ((tasks?.overdue ?? 0) > 0) {
    insights.push({
      type: "anomaly",
      severity: "high",
      title: "Overdue tasks",
      description: `${tasks!.overdue} task(s) are past due. Prioritise assignment and completion in Task Management.`,
    });
  }
  if ((projects?.milestonesDue ?? 0) > 0) {
    insights.push({
      type: "recommendation",
      severity: "medium",
      title: "Milestones due soon",
      description: `${projects!.milestonesDue} milestone(s) due — review project timelines.`,
    });
  }
  if ((projects?.total ?? 0) === 0) {
    insights.push({
      type: "recommendation",
      severity: "low",
      title: "No projects tracked",
      description: "Create projects to unlock portfolio KPIs and executive dashboard widgets.",
    });
  }
  if (insights.length === 0) {
    insights.push({
      type: "positive",
      severity: "info",
      title: "Portfolio looks healthy",
      description: "No critical dashboard alerts detected. Continue monitoring KPIs and module dashboards.",
    });
  }
  return insights;
}

export async function generateDashboardAiInsights(scope: DashboardScope) {
  const [kpiStrip, projects, tasks, crm, briefing] = await Promise.all([
    loadKpiStrip(scope),
    loadProjectsModuleDashboard(scope),
    loadTasksModuleDashboard(scope),
    loadCrmModuleDashboard(scope),
    loadDashboardBriefing(scope),
  ]);

  const summary = {
    kpiStrip: {
      activeItems: kpiStrip.activeItems,
      atRisk: kpiStrip.atRisk,
      critical: kpiStrip.critical,
      portfolioBudgetLabel: kpiStrip.portfolioBudgetLabel,
    },
    projects: {
      total: projects.kpis.activeProjects,
      atRisk: projects.kpis.atRiskBehind,
      milestonesDue: projects.kpis.milestonesDue,
      portfolioValueLabel: projects.kpis.portfolioValueLabel,
    },
    tasks: {
      open: tasks.kpis.myOpenTasks,
      overdue: tasks.kpis.overdue,
      completedThisWeek: tasks.kpis.completedThisWeek,
      dueSoonCount: tasks.dueSoon.length,
    },
    crm: {
      pipelineValue: crm.kpis.pipelineLabel,
      openOpportunities: crm.kpis.openOpportunities,
      winRate90d: crm.kpis.winRate90d,
      overdueFollowUps: crm.kpis.overdueFollowUps,
    },
    briefingHighlights: briefing.items.slice(0, 5).map((i) => ({ title: i.title, detail: i.detail })),
  };

  return generateAiInsights({
    summary,
    systemPrompt: `${AI_INSIGHTS_SYSTEM_PROMPT}
Focus on: project RAG status, overdue tasks, CRM pipeline health, KPI trends, and executive briefing highlights.`,
    rulesFallback: () => dashboardRules(summary),
  });
}
