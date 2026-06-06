import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchWithAuth } from "@/lib/queryClient";
import { DashboardBriefingStrip } from "./DashboardBriefingStrip";
import { DashboardKpiStrip } from "./DashboardKpiStrip";
import type {
  CrmModuleDashboard,
  ProjectsModuleDashboard,
  TasksModuleDashboard,
} from "@shared/models/dashboard";

function scopeQuery(base: string, clientId?: number | null, projectId?: number | null) {
  const params = new URLSearchParams();
  if (clientId) params.set("clientId", String(clientId));
  if (projectId) params.set("projectId", String(projectId));
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

function SummaryCard({
  title,
  description,
  href,
  kpis,
  loading,
}: {
  title: string;
  description: string;
  href: string;
  kpis: { label: string; value: string | number }[];
  loading?: boolean;
}) {
  return (
    <Card className="rounded-2xl border-border/50 h-full">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button variant="ghost" size="sm" className="gap-1 shrink-0" asChild>
          <Link href={href}>
            Open
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-lg border border-border/40 p-3">
                <div className="text-lg font-bold">{k.value}</div>
                <div className="text-xs text-muted-foreground">{k.label}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ExecutiveOverviewDashboard({
  clientId,
  projectId,
}: {
  clientId?: number | null;
  projectId?: number | null;
}) {
  const projectsUrl = scopeQuery("/api/dashboard/module/projects", clientId, projectId);
  const tasksUrl = scopeQuery("/api/dashboard/module/tasks", clientId, projectId);
  const crmUrl = scopeQuery("/api/dashboard/module/crm", clientId, projectId);

  const { data: projects, isLoading: lp } = useQuery({
    queryKey: [projectsUrl],
    queryFn: async () => {
      const res = await fetchWithAuth(projectsUrl);
      if (!res.ok) throw new Error("Failed");
      return (await res.json()) as ProjectsModuleDashboard;
    },
    staleTime: 60_000,
  });

  const { data: tasks, isLoading: lt } = useQuery({
    queryKey: [tasksUrl],
    queryFn: async () => {
      const res = await fetchWithAuth(tasksUrl);
      if (!res.ok) throw new Error("Failed");
      return (await res.json()) as TasksModuleDashboard;
    },
    staleTime: 60_000,
  });

  const { data: crm, isLoading: lc } = useQuery({
    queryKey: [crmUrl],
    queryFn: async () => {
      const res = await fetchWithAuth(crmUrl);
      if (!res.ok) throw new Error("Failed");
      return (await res.json()) as CrmModuleDashboard;
    },
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6">
      <DashboardBriefingStrip clientId={clientId} projectId={projectId} />
      <DashboardKpiStrip clientId={clientId} projectId={projectId} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SummaryCard
          title="Projects"
          description="Delivery health snapshot"
          href="/modules/projects"
          loading={lp}
          kpis={[
            { label: "Active", value: projects?.kpis.activeProjects ?? "—" },
            { label: "At risk", value: projects?.kpis.atRiskBehind ?? "—" },
            { label: "Portfolio", value: projects?.kpis.portfolioValueLabel ?? "—" },
            { label: "Milestones (30d)", value: projects?.kpis.milestonesDue ?? "—" },
          ]}
        />
        <SummaryCard
          title="Tasks"
          description="Personal and team workload"
          href="/modules/tasks"
          loading={lt}
          kpis={[
            { label: "My open", value: tasks?.kpis.myOpenTasks ?? "—" },
            { label: "Overdue", value: tasks?.kpis.overdue ?? "—" },
            { label: "Done this week", value: tasks?.kpis.completedThisWeek ?? "—" },
            { label: "Team open", value: tasks?.kpis.teamOpenTasks ?? "—" },
          ]}
        />
        <SummaryCard
          title="CRM"
          description="Pipeline and revenue outlook"
          href="/modules/crm"
          loading={lc}
          kpis={[
            { label: "Pipeline", value: crm?.kpis.pipelineLabel ?? "—" },
            { label: "Open deals", value: crm?.kpis.openOpportunities ?? "—" },
            { label: "Win rate", value: crm ? `${crm.kpis.winRate90d}%` : "—" },
            { label: "Overdue follow-ups", value: crm?.kpis.overdueFollowUps ?? "—" },
          ]}
        />
      </div>
    </div>
  );
}
