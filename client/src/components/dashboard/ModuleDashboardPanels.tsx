import { Link } from "wouter";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { CategoryBarChart } from "./CategoryBarChart";
import { scopeQuery } from "./dashboard-utils";
import {
  DashboardEmptyTable,
  DashboardTableWrap,
  ModuleDashboardLoader,
} from "./DashboardPanelState";
import type {
  BusinessModuleDashboard,
  CrmModuleDashboard,
  FinanceModuleDashboard,
  HelpDeskModuleDashboard,
  ProjectsModuleDashboard,
  TasksModuleDashboard,
} from "@shared/models/dashboard";
import { ArrowUpRight, FolderKanban, Headphones, Landmark, ListTodo, TrendingUp, Users } from "lucide-react";

function ragClass(rag: string) {
  const r = rag.toLowerCase();
  if (r === "red") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
  if (r === "amber" || r === "yellow") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
}

function ModuleLink({ href, label }: { href: string; label: string }) {
  return (
    <Button variant="ghost" size="sm" className="gap-1 text-primary" asChild>
      <Link href={href}>
        {label}
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </Button>
  );
}

function KpiRow({ items }: { items: { label: string; value: string | number }[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((k) => (
        <Card key={k.label} className="rounded-xl border-border/50">
          <CardContent className="p-4">
            <div className="text-2xl font-bold font-display">{k.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{k.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ProjectsModulePanel({
  clientId,
  projectId,
}: {
  clientId?: number | null;
  projectId?: number | null;
}) {
  const url = scopeQuery("/api/dashboard/module/projects", clientId, projectId);
  return (
    <ModuleDashboardLoader<ProjectsModuleDashboard> url={url}>
      {(data) => (
    <div className="space-y-6">
      <KpiRow
        items={[
          { label: "Active Projects", value: data.kpis.activeProjects },
          { label: "At Risk / Behind", value: data.kpis.atRiskBehind },
          { label: "Portfolio Value", value: data.kpis.portfolioValueLabel },
          { label: "Milestones Due (30d)", value: data.kpis.milestonesDue },
        ]}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Project Health Distribution</CardTitle>
              <CardDescription>Projects module · RAG status</CardDescription>
            </div>
            <ModuleLink href="/modules/projects" label="View full module" />
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.healthDistribution} dataKey="count" nameKey="label" innerRadius={50} outerRadius={80}>
                  {data.healthDistribution.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-primary" />
                Timeline Overview
              </CardTitle>
              <CardDescription>Active project date spans</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 max-h-64 overflow-y-auto">
            {data.timeline.map((row) => (
              <div key={row.id} className="flex items-center gap-3 text-sm">
                <Badge className={cn("capitalize shrink-0", ragClass(row.health))}>{row.health}</Badge>
                <span className="truncate flex-1">{row.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {row.startDate ?? "—"} → {row.endDate ?? "—"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card className="rounded-2xl border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Active Projects</CardTitle>
          <ModuleLink href="/modules/projects" label="View all" />
        </CardHeader>
        <CardContent>
          <DashboardTableWrap>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.activeProjects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <DashboardEmptyTable message="No active projects in this workspace." />
                  </TableCell>
                </TableRow>
              ) : (
              data.activeProjects.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.customer ?? "—"}</TableCell>
                  <TableCell>{p.lead ?? "—"}</TableCell>
                  <TableCell>{p.progress}%</TableCell>
                  <TableCell>
                    <Badge className={cn("capitalize", ragClass(p.health))}>{p.health}</Badge>
                  </TableCell>
                  <TableCell>{p.dueDate ?? "—"}</TableCell>
                </TableRow>
              ))
              )}
            </TableBody>
          </Table>
          </DashboardTableWrap>
        </CardContent>
      </Card>
    </div>
      )}
    </ModuleDashboardLoader>
  );
}

export function TasksModulePanel({
  clientId,
  projectId,
}: {
  clientId?: number | null;
  projectId?: number | null;
}) {
  const url = scopeQuery("/api/dashboard/module/tasks", clientId, projectId);
  return (
    <ModuleDashboardLoader<TasksModuleDashboard> url={url}>
      {(data) => (
    <div className="space-y-6">
      <KpiRow
        items={[
          { label: "My Open Tasks", value: data.kpis.myOpenTasks },
          { label: "Overdue", value: data.kpis.overdue },
          { label: "Completed This Week", value: data.kpis.completedThisWeek },
          { label: "Team Open Tasks", value: data.kpis.teamOpenTasks },
        ]}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-primary" />
              Tasks by Status
            </CardTitle>
            <CardDescription>Last 4 weeks · Tasks module</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byStatus}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="week" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="todo" stackId="a" fill="#6366f1" name="To do" />
                <Bar dataKey="inProgress" stackId="a" fill="#f59e0b" name="In progress" />
                <Bar dataKey="done" stackId="a" fill="#22c55e" name="Done" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Tasks by Priority</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.byPriority} dataKey="count" nameKey="label" innerRadius={50} outerRadius={80}>
                  {data.byPriority.map((entry) => (
                    <Cell key={entry.label} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card className="rounded-2xl border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">My Tasks Due Soon</CardTitle>
          <ModuleLink href="/modules/tasks" label="View full module" />
        </CardHeader>
        <CardContent>
          <DashboardTableWrap>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.dueSoon.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <DashboardEmptyTable message="No tasks due in the next 7 days." />
                  </TableCell>
                </TableRow>
              ) : (
              data.dueSoon.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell>{t.dueDate ?? "—"}</TableCell>
                  <TableCell className="capitalize">{t.priority}</TableCell>
                  <TableCell className="capitalize">{t.status.replace("_", " ")}</TableCell>
                </TableRow>
              ))
              )}
            </TableBody>
          </Table>
          </DashboardTableWrap>
        </CardContent>
      </Card>
    </div>
      )}
    </ModuleDashboardLoader>
  );
}

export function HelpDeskModulePanel({ clientId, projectId }: { clientId?: number | null; projectId?: number | null }) {
  const url = scopeQuery("/api/dashboard/module/helpdesk", clientId, projectId);
  return (
    <ModuleDashboardLoader<HelpDeskModuleDashboard> url={url}>
      {(data) => (
    <div className="space-y-6">
      <KpiRow items={[
        { label: "Open Tickets", value: data.kpis.openTickets },
        { label: "SLA Breached", value: data.kpis.slaBreached },
        { label: "Avg Resolution (hrs)", value: data.kpis.avgResolutionHours },
        { label: "CSAT Score", value: data.kpis.csatScore.toFixed(1) },
      ]} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Headphones className="h-4 w-4 text-primary" />Tickets by Status</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={data.byStatus} dataKey="count" nameKey="label" innerRadius={50} outerRadius={80}>
                {data.byStatus.map((e) => <Cell key={e.label} fill={e.color} />)}
              </Pie><Tooltip /></PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50">
          <CardHeader><CardTitle className="text-base">Volume Trend</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.volumeTrend.slice(-14)}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" hide /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#6366f1" /></BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card className="rounded-2xl border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Tickets</CardTitle>
          <ModuleLink href="/modules/help-desk" label="View full module" />
        </CardHeader>
        <CardContent>
          <DashboardTableWrap>
          <Table><TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Status</TableHead><TableHead>Priority</TableHead><TableHead>Due</TableHead></TableRow></TableHeader>
            <TableBody>{data.recentTickets.length === 0 ? (
              <TableRow><TableCell colSpan={4}><DashboardEmptyTable message="No recent tickets." /></TableCell></TableRow>
            ) : data.recentTickets.map((t) => (
              <TableRow key={t.id}><TableCell className="font-medium">{t.subject}</TableCell><TableCell className="capitalize">{t.status}</TableCell><TableCell className="capitalize">{t.priority}</TableCell><TableCell>{t.dueDate ?? "—"}</TableCell></TableRow>
            ))}</TableBody></Table>
          </DashboardTableWrap>
        </CardContent>
      </Card>
    </div>
      )}
    </ModuleDashboardLoader>
  );
}

export function FinanceModulePanel({ clientId, projectId }: { clientId?: number | null; projectId?: number | null }) {
  const url = scopeQuery("/api/dashboard/module/finance", clientId, projectId);
  return (
    <ModuleDashboardLoader<FinanceModuleDashboard> url={url}>
      {(data) => (
    <div className="space-y-6">
      <KpiRow items={[
        { label: "Revenue YTD", value: data.kpis.revenueYtdLabel },
        { label: "Outstanding", value: data.kpis.outstandingInvoicesLabel },
        { label: "Budget Utilisation", value: `${data.kpis.budgetUtilisationPercent}%` },
        { label: "Overdue Payments", value: data.kpis.overduePayments },
      ]} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl border-border/50">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Landmark className="h-4 w-4 text-primary" />Revenue vs Budget</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.revenueVsBudget}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Bar dataKey="budget" fill="#94a3b8" name="Budget" /><Bar dataKey="actual" fill="#22c55e" name="Actual" /></BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50">
          <CardHeader><CardTitle className="text-base">Expense Breakdown</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={data.expenseBreakdown} dataKey="count" nameKey="label" innerRadius={50} outerRadius={80}>
                {data.expenseBreakdown.map((e) => <Cell key={e.label} fill={e.color} />)}
              </Pie><Tooltip /></PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card className="rounded-2xl border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Unpaid Invoices</CardTitle>
          <ModuleLink href="/modules/finance-mgmt" label="View full module" />
        </CardHeader>
        <CardContent>
          <DashboardTableWrap>
          <Table><TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Amount</TableHead><TableHead>Due</TableHead><TableHead>Days overdue</TableHead></TableRow></TableHeader>
            <TableBody>{data.unpaidInvoices.length === 0 ? (
              <TableRow><TableCell colSpan={4}><DashboardEmptyTable message="No unpaid invoices." /></TableCell></TableRow>
            ) : data.unpaidInvoices.map((i) => (
              <TableRow key={i.id}><TableCell>{i.label}</TableCell><TableCell>£{(i.amountPence / 100).toLocaleString()}</TableCell><TableCell>{i.dueDate}</TableCell><TableCell>{i.daysOverdue}</TableCell></TableRow>
            ))}</TableBody></Table>
          </DashboardTableWrap>
        </CardContent>
      </Card>
    </div>
      )}
    </ModuleDashboardLoader>
  );
}

export function BusinessModulePanel({ clientId, projectId }: { clientId?: number | null; projectId?: number | null }) {
  const url = scopeQuery("/api/dashboard/module/business", clientId, projectId);
  return (
    <ModuleDashboardLoader<BusinessModuleDashboard> url={url}>
      {(data) => (
    <div className="space-y-6">
      <KpiRow items={[
        { label: "Active Strategies", value: data.kpis.activeStrategies },
        { label: "OKRs On Track", value: `${data.kpis.okrsOnTrackPercent}%` },
        { label: "Overdue Reviews", value: data.kpis.overdueReviews },
        { label: "Avg Progress", value: `${data.kpis.avgStrategyProgress}%` },
      ]} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl border-border/50">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Strategy Health</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart><Pie data={data.strategyHealth} dataKey="count" nameKey="label" innerRadius={50} outerRadius={80}>
                {data.strategyHealth.map((e) => <Cell key={e.label} fill={e.color} />)}
              </Pie><Tooltip /></PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50">
          <CardHeader><CardTitle className="text-base">Initiative Progress</CardTitle></CardHeader>
          <CardContent className="min-h-64 max-h-[420px] overflow-y-auto">
            <CategoryBarChart data={data.initiativeProgress} />
          </CardContent>
        </Card>
      </div>
      <Card className="rounded-2xl border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Overdue Governance</CardTitle>
          <ModuleLink href="/modules/business-mgmt" label="View full module" />
        </CardHeader>
        <CardContent>
          <DashboardTableWrap>
          <Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Owner</TableHead><TableHead>Layer</TableHead><TableHead>Days overdue</TableHead></TableRow></TableHeader>
            <TableBody>{data.overdueGovernance.length === 0 ? (
              <TableRow><TableCell colSpan={4}><DashboardEmptyTable message="No overdue governance items." /></TableCell></TableRow>
            ) : data.overdueGovernance.map((g, idx) => (
              <TableRow key={idx}><TableCell className="font-medium">{g.name}</TableCell><TableCell>{g.owner ?? "—"}</TableCell><TableCell>{g.layer}</TableCell><TableCell>{g.daysOverdue}</TableCell></TableRow>
            ))}</TableBody></Table>
          </DashboardTableWrap>
        </CardContent>
      </Card>
    </div>
      )}
    </ModuleDashboardLoader>
  );
}

export function CrmModulePanel({
  clientId,
  projectId,
}: {
  clientId?: number | null;
  projectId?: number | null;
}) {
  const url = scopeQuery("/api/dashboard/module/crm", clientId, projectId);
  return (
    <ModuleDashboardLoader<CrmModuleDashboard> url={url}>
      {(data) => (
    <div className="space-y-6">
      <KpiRow
        items={[
          { label: "Active Pipeline Value", value: data.kpis.pipelineLabel },
          { label: "Open Opportunities", value: data.kpis.openOpportunities },
          { label: "Win Rate (90d)", value: `${data.kpis.winRate90d}%` },
          { label: "Overdue Follow-ups", value: data.kpis.overdueFollowUps },
        ]}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Pipeline by Stage
            </CardTitle>
            <CardDescription>CRM module · open deals</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.pipelineByStage} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={90} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" name="Value (£)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Revenue Forecast</CardTitle>
            <CardDescription>Expected close value · next 6 months</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.revenueForecast}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#22c55e" name="Value (£)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card className="rounded-2xl border-border/50">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Hot Opportunities</CardTitle>
          <ModuleLink href="/modules/crm" label="View full module" />
        </CardHeader>
        <CardContent>
          <DashboardTableWrap>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opportunity</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Close date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.hotOpportunities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3}>
                    <DashboardEmptyTable message="No hot opportunities right now." />
                  </TableCell>
                </TableRow>
              ) : (
              data.hotOpportunities.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.name}</TableCell>
                  <TableCell>£{o.amount.toLocaleString()}</TableCell>
                  <TableCell>{o.closeDate ?? "—"}</TableCell>
                </TableRow>
              ))
              )}
            </TableBody>
          </Table>
          </DashboardTableWrap>
        </CardContent>
      </Card>
    </div>
      )}
    </ModuleDashboardLoader>
  );
}
