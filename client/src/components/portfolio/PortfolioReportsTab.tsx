import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FileText } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Portfolio360ReportView } from "./Portfolio360ReportView";
import { PortfolioCustomReportBuilder } from "./PortfolioCustomReportBuilder";
import { formatBudget } from "./rag-utils";
import { PortfolioMobileCard, PortfolioTableShell } from "./PortfolioUi";

export function PortfolioReportsTab() {
  const { toast } = useToast();
  const [report360ProjectId, setReport360ProjectId] = useState<number | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    reportType: "360_report",
    frequency: "weekly",
    format: "pdf",
    projectId: "",
    recipientIds: [] as string[],
  });

  const { data: projects = [], isLoading: loadingProjects } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/portfolio/dashboard"],
    select: (d: any) => d.projects?.map((p: any) => ({ id: p.id, name: p.name })) ?? [],
    staleTime: 30_000,
  });

  const reportStale = { staleTime: 30_000 as const };
  const { data: summary = [] } = useQuery<any[]>({ queryKey: ["/api/portfolio/reports/summary"], ...reportStale });
  const { data: milestones = [] } = useQuery<any[]>({ queryKey: ["/api/portfolio/milestones"], ...reportStale });
  const { data: raid = [] } = useQuery<any[]>({ queryKey: ["/api/portfolio/reports/raid-consolidated"], ...reportStale });
  const { data: schedules = [], refetch: refetchSchedules } = useQuery<any[]>({ queryKey: ["/api/portfolio/reports/schedules"], ...reportStale });

  const { data: orgUsers = [] } = useQuery<{ user: { id: string; email: string | null; firstName: string | null; lastName: string | null } }[]>({
    queryKey: ["/api/settings/users"],
    staleTime: 60_000,
  });

  const createSchedule = async () => {
    try {
      const payload = {
        reportType: scheduleForm.reportType,
        frequency: scheduleForm.frequency,
        format: scheduleForm.format,
        recipientIds: scheduleForm.recipientIds,
        projectId: scheduleForm.projectId ? Number(scheduleForm.projectId) : undefined,
      };
      await apiRequest("POST", "/api/portfolio/reports/schedules", payload);
      toast({ title: "Report schedule created" });
      refetchSchedules();
    } catch {
      toast({ title: "Failed to create schedule", variant: "destructive" });
    }
  };

  if (report360ProjectId) {
    return <Portfolio360ReportView projectId={report360ProjectId} onClose={() => setReport360ProjectId(null)} />;
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/30 border-dashed border-primary/30 bg-primary/5">
        <CardContent className="py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-bold flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> 360° Project Report</h3>
            <p className="text-sm text-muted-foreground mt-1">Full project health view — executive summary, RAID, milestones, finance & resources.</p>
          </div>
          <div className="flex items-center gap-2">
            {loadingProjects ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <select className="text-sm border rounded-lg px-3 py-2 bg-background" onChange={(e) => e.target.value && setReport360ProjectId(Number(e.target.value))} defaultValue="">
                <option value="" disabled>Generate 360° Report → select project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="summary">
        <div className="overflow-x-auto -mx-1 px-1 pb-1 scrollbar-thin">
          <TabsList className="w-max sm:w-auto flex-nowrap">
            <TabsTrigger value="summary" className="text-xs sm:text-sm shrink-0">Summary</TabsTrigger>
            <TabsTrigger value="milestones" className="text-xs sm:text-sm shrink-0">Milestones</TabsTrigger>
            <TabsTrigger value="raid" className="text-xs sm:text-sm shrink-0">RAID</TabsTrigger>
            <TabsTrigger value="custom" className="text-xs sm:text-sm shrink-0">Custom</TabsTrigger>
            <TabsTrigger value="schedules" className="text-xs sm:text-sm shrink-0">Schedules</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="summary" className="mt-4">
          <div className="md:hidden space-y-2">
            {summary.map((r: any, i: number) => (
              <PortfolioMobileCard key={i} title={r.name} subtitle={`${r.client || "—"} · ${r.pm || "—"}`} badge={<span className="text-[10px] font-mono uppercase">{r.rag}</span>}>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatBudget(r.budget)}</span>
                  <span>{r.progress}%</span>
                  <span className="truncate max-w-[120px]">{r.portfolios}</span>
                </div>
              </PortfolioMobileCard>
            ))}
          </div>
          <Card className="border-border/30 hidden md:block">
            <CardHeader><CardTitle className="text-sm">Portfolio Summary — Board View</CardTitle></CardHeader>
            <CardContent>
              <PortfolioTableShell>
                <table className="w-full text-sm text-gray-700 dark:text-foreground min-w-[640px]">
                  <thead><tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground border-b border-border/60">
                    <th className="px-3 py-2.5 text-left align-middle font-semibold">Project</th>
                    <th className="px-3 py-2.5 text-left align-middle font-semibold">Client</th>
                    <th className="px-3 py-2.5 text-left align-middle font-semibold">PM</th>
                    <th className="px-3 py-2.5 text-left align-middle font-semibold">RAG</th>
                    <th className="px-3 py-2.5 text-left align-middle font-semibold">Budget</th>
                    <th className="px-3 py-2.5 text-left align-middle font-semibold">Progress</th>
                    <th className="px-3 py-2.5 text-left align-middle font-semibold">Portfolio</th>
                  </tr></thead>
                  <tbody>
                    {summary.map((r: any, i: number) => (
                      <tr key={i} className="border-b border-border/40 hover:bg-muted/30">
                        <td className="px-3 py-2.5 align-middle font-medium">{r.name}</td>
                        <td className="px-3 py-2.5 align-middle text-xs">{r.client}</td>
                        <td className="px-3 py-2.5 align-middle text-xs">{r.pm}</td>
                        <td className="px-3 py-2.5 align-middle">{r.rag}</td>
                        <td className="px-3 py-2.5 align-middle font-mono text-xs">{formatBudget(r.budget)}</td>
                        <td className="px-3 py-2.5 align-middle font-mono text-xs">{r.progress}%</td>
                        <td className="px-3 py-2.5 align-middle text-xs">{r.portfolios}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </PortfolioTableShell>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="milestones" className="mt-4">
          <Card className="border-border/30">
            <CardHeader><CardTitle className="text-sm">Milestone Register</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm text-gray-700 dark:text-foreground">
                <thead><tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground border-b border-border/60">
                  <th className="px-3 py-2.5 text-left align-middle font-semibold">Ref</th>
                  <th className="px-3 py-2.5 text-left align-middle font-semibold">Name</th>
                  <th className="px-3 py-2.5 text-left align-middle font-semibold">Project</th>
                  <th className="px-3 py-2.5 text-left align-middle font-semibold">Programme</th>
                  <th className="px-3 py-2.5 text-left align-middle font-semibold">Portfolio</th>
                  <th className="px-3 py-2.5 text-left align-middle font-semibold">Client</th>
                  <th className="px-3 py-2.5 text-left align-middle font-semibold">RAG</th>
                  <th className="px-3 py-2.5 text-left align-middle font-semibold">Target</th>
                </tr></thead>
                <tbody>
                  {milestones.map((m: any) => (
                    <tr key={m.id} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="px-3 py-2.5 align-middle font-mono">{m.ref}</td>
                      <td className="px-3 py-2.5 align-middle">{m.name}</td>
                      <td className="px-3 py-2.5 align-middle">{m.projectName}</td>
                      <td className="px-3 py-2.5 align-middle">{m.programme}</td>
                      <td className="px-3 py-2.5 align-middle">{m.portfolio}</td>
                      <td className="px-3 py-2.5 align-middle">{m.client}</td>
                      <td className="px-3 py-2.5 align-middle">{m.ragStatus}</td>
                      <td className="px-3 py-2.5 align-middle font-mono">{m.targetDate || m.dueDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="raid" className="mt-4">
          <Card className="border-border/30">
            <CardHeader><CardTitle className="text-sm">RAID Consolidated</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm text-gray-700 dark:text-foreground">
                <thead><tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground border-b border-border/60">
                  <th className="px-3 py-2.5 text-left align-middle font-semibold">Type</th>
                  <th className="px-3 py-2.5 text-left align-middle font-semibold">Ref</th>
                  <th className="px-3 py-2.5 text-left align-middle font-semibold">Title</th>
                  <th className="px-3 py-2.5 text-left align-middle font-semibold">Project</th>
                  <th className="px-3 py-2.5 text-left align-middle font-semibold">Priority</th>
                  <th className="px-3 py-2.5 text-left align-middle font-semibold">Status</th>
                </tr></thead>
                <tbody>
                  {raid.map((r: any) => (
                    <tr key={r.id} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="px-3 py-2.5 align-middle capitalize">{r.type}</td>
                      <td className="px-3 py-2.5 align-middle font-mono">{r.code}</td>
                      <td className="px-3 py-2.5 align-middle">{r.title}</td>
                      <td className="px-3 py-2.5 align-middle">{r.projectName}</td>
                      <td className="px-3 py-2.5 align-middle">{r.priority}</td>
                      <td className="px-3 py-2.5 align-middle">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="mt-4">
          <PortfolioCustomReportBuilder />
        </TabsContent>

        <TabsContent value="schedules" className="mt-4 space-y-4">
          <Card className="border-border/30">
            <CardHeader><CardTitle className="text-sm">Report Schedules</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {schedules.map((s: any) => (
                <div key={s.id} className="flex flex-col sm:flex-row sm:justify-between gap-1 text-sm border-b border-border/20 pb-2">
                  <span>{s.reportType} — {s.frequency}</span>
                  <span className="text-muted-foreground text-xs">
                    {s.format} · {(s.recipientIds?.length ?? 0)} recipient(s) · last run {s.lastRunAt || "never"}
                  </span>
                </div>
              ))}
              {!schedules.length && <p className="text-sm text-muted-foreground">No schedules yet</p>}
            </CardContent>
          </Card>
          <Card className="border-border/30">
            <CardHeader><CardTitle className="text-sm">Create Schedule</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              <select value={scheduleForm.reportType} onChange={(e) => setScheduleForm((f) => ({ ...f, reportType: e.target.value }))} className="text-sm border rounded-lg px-2 py-1.5">
                <option value="360_report">360° Report</option>
                <option value="portfolio_summary">Portfolio Summary</option>
                <option value="milestone_register">Milestone Register</option>
              </select>
              <select value={scheduleForm.frequency} onChange={(e) => setScheduleForm((f) => ({ ...f, frequency: e.target.value }))} className="text-sm border rounded-lg px-2 py-1.5">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <select value={scheduleForm.format} onChange={(e) => setScheduleForm((f) => ({ ...f, format: e.target.value }))} className="text-sm border rounded-lg px-2 py-1.5">
                <option value="pdf">PDF (snapshot)</option>
                <option value="pptx">PowerPoint (snapshot)</option>
              </select>
              {scheduleForm.reportType === "360_report" && (
                <select value={scheduleForm.projectId} onChange={(e) => setScheduleForm((f) => ({ ...f, projectId: e.target.value }))} className="text-sm border rounded-lg px-2 py-1.5">
                  <option value="">Select project…</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
              <Button size="sm" onClick={createSchedule} disabled={scheduleForm.reportType === "360_report" && !scheduleForm.projectId}>Schedule Report</Button>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Email recipients (optional — report summary sent on schedule)</p>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto border rounded-lg p-2 bg-muted/20">
                  {orgUsers.filter((p) => p.user?.email).map((p) => {
                    const id = p.user.id;
                    const label = `${p.user.firstName || ""} ${p.user.lastName || ""}`.trim() || p.user.email!;
                    const checked = scheduleForm.recipientIds.includes(id);
                    return (
                      <label key={id} className="flex items-center gap-1.5 text-xs cursor-pointer bg-background border rounded-full px-2.5 py-1">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => setScheduleForm((f) => ({
                            ...f,
                            recipientIds: e.target.checked
                              ? [...f.recipientIds, id]
                              : f.recipientIds.filter((x) => x !== id),
                          }))}
                        />
                        {label}
                      </label>
                    );
                  })}
                  {!orgUsers.length && <span className="text-xs text-muted-foreground">No users with email found</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
