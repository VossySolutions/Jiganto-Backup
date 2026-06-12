import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, CheckCircle2, XCircle, Clock, UserCheck, Users, Plus, Copy, Calendar, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FinanceTabLoading, FinanceTableSkeleton, FinanceEmptyState, FinanceButtonSpinner } from "./FinanceUi";
import type { FinanceTimesheetPeriod } from "./types";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TIME_TYPES = ["billable", "non_billable", "internal", "leave", "training"] as const;

function formatWeekRange(start: string, end: string) {
  return `${new Date(start).toLocaleDateString()} – ${new Date(end).toLocaleDateString()}`;
}

function getMonday(d = new Date()) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function parseHoursInput(val: string, useHhMm: boolean): number {
  if (!useHhMm) return parseFloat(val) || 0;
  const [h, m] = val.split(":").map((x) => parseInt(x, 10) || 0);
  return h + m / 60;
}

function formatHoursDisplay(hours: number, useHhMm: boolean): string {
  if (!useHhMm) return hours > 0 ? String(hours) : "";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return hours > 0 ? `${h}:${String(m).padStart(2, "0")}` : "";
}

interface FinanceTimesheetsTabProps {
  periods?: FinanceTimesheetPeriod[];
  pendingPeriods?: FinanceTimesheetPeriod[];
  isLoading?: boolean;
  searchTerm?: string;
}

export function FinanceTimesheetsTab({
  periods: periodsProp,
  pendingPeriods: pendingProp,
  isLoading: isLoadingProp,
  searchTerm = "",
}: FinanceTimesheetsTabProps) {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"entry" | "approval" | "reports">("entry");
  const [gridMode, setGridMode] = useState<"weekly" | "daily">("weekly");
  const [selectedDay, setSelectedDay] = useState(1);
  const [useHhMm, setUseHhMm] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState<string>("");
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [newProjectName, setNewProjectName] = useState("");

  const { data: fetchedPeriods = [], isLoading: fetchLoading } = useQuery<FinanceTimesheetPeriod[]>({
    queryKey: ["/api/finance/timesheets/periods"],
    enabled: periodsProp === undefined,
  });

  const { data: fetchedPending = [] } = useQuery<FinanceTimesheetPeriod[]>({
    queryKey: ["/api/finance/timesheets/periods?status=submitted"],
    enabled: pendingProp === undefined,
  });

  const periods = periodsProp ?? fetchedPeriods;
  const pendingPeriods = pendingProp ?? fetchedPending;
  const isLoading = isLoadingProp ?? fetchLoading;

  const { data: resources = [] } = useQuery<Array<{ id: number; firstName: string; lastName: string }>>({
    queryKey: ["/api/resources"],
  });

  const { data: projects = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/pm/projects"],
  });

  const activePeriodId = selectedPeriodId ?? (selectedResourceId
    ? periods.find((p) => String(p.resourceId) === selectedResourceId)?.id ?? null
    : null);

  const { data: periodDetail, refetch: refetchPeriod } = useQuery<FinanceTimesheetPeriod>({
    queryKey: [`/api/finance/timesheets/periods/${activePeriodId}`],
    enabled: activePeriodId != null,
  });

  const { data: utilisation } = useQuery({
    queryKey: ["/api/finance/timesheets/reports/utilisation"],
    enabled: viewMode === "reports",
  });

  const { data: missing = [] } = useQuery<Array<{ resourceId: number; name: string }>>({
    queryKey: [`/api/finance/timesheets/reports/missing?weekStartDate=${getMonday().toISOString().slice(0, 10)}`],
    enabled: viewMode === "reports",
  });

  useEffect(() => {
    if (!selectedResourceId && resources[0]) setSelectedResourceId(String(resources[0].id));
  }, [resources, selectedResourceId]);

  const resourceName = (resourceId: number) => {
    const r = resources.find((res) => res.id === resourceId);
    return r ? `${r.firstName} ${r.lastName}` : `Resource #${resourceId}`;
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/finance/timesheets/periods"] });
    queryClient.invalidateQueries({ queryKey: ["/api/finance/dashboard"] });
    if (activePeriodId) refetchPeriod();
  };

  const createPeriodMutation = useMutation({
    mutationFn: async () => {
      const monday = getMonday();
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      return apiRequest("POST", "/api/finance/timesheets/periods", {
        resourceId: Number(selectedResourceId),
        weekStartDate: monday.toISOString().slice(0, 10),
        weekEndDate: sunday.toISOString().slice(0, 10),
      });
    },
    onSuccess: async (res) => {
      const period = await res.json() as { id: number };
      setSelectedPeriodId(period.id);
      invalidate();
      toast({ title: "Timesheet week created" });
    },
    onError: () => toast({ title: "Failed to create timesheet week", variant: "destructive" }),
  });

  const saveEntryMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest("POST", `/api/finance/timesheets/periods/${activePeriodId}/entries`, payload),
    onSuccess: () => invalidate(),
  });

  const submitMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/finance/timesheets/periods/${activePeriodId}/submit`),
    onSuccess: () => { invalidate(); toast({ title: "Timesheet submitted" }); },
    onError: () => toast({ title: "Failed to submit timesheet", variant: "destructive" }),
  });

  const copyWeekMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/finance/timesheets/periods/${activePeriodId}/copy-last-week`),
    onSuccess: () => { invalidate(); toast({ title: "Project rows copied from last week" }); },
  });

  const approvePmMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/finance/timesheets/periods/${id}/approve-pm`),
    onSuccess: () => { invalidate(); toast({ title: "PM approval recorded" }); },
    onError: () => toast({ title: "PM approval failed", variant: "destructive" }),
  });

  const approveRmMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/finance/timesheets/periods/${id}/approve-rm`),
    onSuccess: () => { invalidate(); toast({ title: "RM approval recorded" }); },
    onError: () => toast({ title: "RM approval failed", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      apiRequest("POST", `/api/finance/timesheets/periods/${id}/reject`, { reason }),
    onSuccess: () => { invalidate(); toast({ title: "Timesheet returned" }); },
    onError: () => toast({ title: "Failed to return timesheet", variant: "destructive" }),
  });

  const selectedPeriod = periodDetail;
  const isDraft = selectedPeriod?.status === "draft";

  const entriesByProject = useMemo(() => {
    const map: Record<string, NonNullable<FinanceTimesheetPeriod["entries"]>> = {};
    (selectedPeriod?.entries ?? []).forEach((e) => {
      const key = e.projectName ?? "General";
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [selectedPeriod]);

  const hoursGrid = useMemo(() => {
    const grid: Record<string, { days: number[]; entryIds: (number | null)[]; activityType: string; role: string | null }> = {};
    Object.entries(entriesByProject).forEach(([project, entries]) => {
      const days = Array(7).fill(0);
      const entryIds: (number | null)[] = Array(7).fill(null);
      let activityType = "billable";
      let role: string | null = null;
      entries.forEach((e) => {
        const idx = e.dayOfWeek - 1;
        if (idx >= 0 && idx < 7) {
          days[idx] += parseFloat(e.hours ?? "0") || 0;
          entryIds[idx] = e.id;
        }
        activityType = e.activityType ?? activityType;
        role = e.role ?? role;
      });
      grid[project] = { days, entryIds, activityType, role };
    });
    return grid;
  }, [entriesByProject]);

  const dayTotals = useMemo(() => {
    const totals = Array(7).fill(0);
    Object.values(hoursGrid).forEach(({ days }) => days.forEach((h, i) => { totals[i] += h; }));
    return totals;
  }, [hoursGrid]);

  const grandTotal = dayTotals.reduce((s, h) => s + h, 0);

  const handleHourChange = (project: string, dayIdx: number, value: string) => {
    if (!activePeriodId || !selectedResourceId || !isDraft) return;
    const hours = parseHoursInput(value, useHhMm);
    const proj = projects.find((p) => p.name === project);
    const existingId = hoursGrid[project]?.entryIds[dayIdx];
    saveEntryMutation.mutate({
      id: existingId ?? undefined,
      resourceId: Number(selectedResourceId),
      projectId: proj?.id ?? null,
      projectName: project,
      dayOfWeek: dayIdx + 1,
      hours: String(hours),
      activityType: hoursGrid[project]?.activityType ?? "billable",
      role: hoursGrid[project]?.role,
    });
  };

  const addProjectRow = () => {
    if (!activePeriodId || !selectedResourceId || !newProjectName.trim()) return;
    const proj = projects.find((p) => p.name === newProjectName.trim());
    saveEntryMutation.mutate({
      resourceId: Number(selectedResourceId),
      projectId: proj?.id ?? null,
      projectName: newProjectName.trim(),
      dayOfWeek: gridMode === "daily" ? selectedDay : 1,
      hours: "0",
      activityType: "billable",
    });
    setNewProjectName("");
  };

  const resourcePeriods = periods.filter((p) => String(p.resourceId) === selectedResourceId);

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="finance-timesheets-loading">
        <FinanceTabLoading label="Loading timesheets..." />
        <FinanceTableSkeleton rows={6} cols={8} />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="finance-timesheets-tab">
      <div className="flex flex-col xs:flex-row flex-wrap items-stretch sm:items-center gap-2">
        <Button variant={viewMode === "entry" ? "default" : "outline"} size="sm" className="flex-1 sm:flex-none" onClick={() => setViewMode("entry")}>
          <Clock className="h-4 w-4 mr-1" /><span className="hidden xs:inline">Time </span>Entry
        </Button>
        <Button variant={viewMode === "approval" ? "default" : "outline"} size="sm" className="flex-1 sm:flex-none" onClick={() => setViewMode("approval")}>
          <UserCheck className="h-4 w-4 mr-1" /> Approvals
          {pendingPeriods.length > 0 && <Badge variant="secondary" className="ml-2">{pendingPeriods.length}</Badge>}
        </Button>
        <Button variant={viewMode === "reports" ? "default" : "outline"} size="sm" className="flex-1 sm:flex-none" onClick={() => setViewMode("reports")}>
          <BarChart3 className="h-4 w-4 mr-1" /> Reports
        </Button>
      </div>

      {viewMode === "entry" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedResourceId} onValueChange={(v) => { setSelectedResourceId(v); setSelectedPeriodId(null); }}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Team member" /></SelectTrigger>
              <SelectContent>
                {resources.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>{r.firstName} {r.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={activePeriodId ? String(activePeriodId) : ""} onValueChange={(v) => setSelectedPeriodId(Number(v))}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Select week" /></SelectTrigger>
              <SelectContent>
                {resourcePeriods.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{formatWeekRange(String(p.weekStartDate), String(p.weekEndDate))}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => createPeriodMutation.mutate()} disabled={!selectedResourceId || createPeriodMutation.isPending}>
              {createPeriodMutation.isPending ? <FinanceButtonSpinner className="mr-1" /> : <Calendar className="h-4 w-4 mr-1" />}
              New Week
            </Button>
            <div className="flex gap-1 ml-auto">
              <Button variant={gridMode === "weekly" ? "secondary" : "ghost"} size="sm" onClick={() => setGridMode("weekly")}>Weekly</Button>
              <Button variant={gridMode === "daily" ? "secondary" : "ghost"} size="sm" onClick={() => setGridMode("daily")}>Daily</Button>
              <Button variant={useHhMm ? "secondary" : "ghost"} size="sm" onClick={() => setUseHhMm(!useHhMm)}>HH:MM</Button>
            </div>
          </div>

          {selectedPeriod && (
            <>
              <div className="flex flex-wrap gap-2">
                {isDraft && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => copyWeekMutation.mutate()} disabled={copyWeekMutation.isPending}>
                      {copyWeekMutation.isPending ? <FinanceButtonSpinner className="mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                      Copy from last week
                    </Button>
                    <Button size="sm" onClick={() => submitMutation.mutate()} disabled={grandTotal <= 0 || submitMutation.isPending}>
                      {submitMutation.isPending ? <FinanceButtonSpinner className="mr-1" /> : null}
                      Submit for approval
                    </Button>
                  </>
                )}
                <Badge variant="outline" className="capitalize">{selectedPeriod.status}</Badge>
              </div>

              <Card className="rounded-xl border-border/50 overflow-hidden">
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-3 font-medium min-w-[160px]">Project</th>
                        {(gridMode === "weekly" ? DAY_LABELS : [DAY_LABELS[selectedDay - 1]]).map((d) => (
                          <th key={d} className="p-3 text-center font-medium w-20">{d}</th>
                        ))}
                        <th className="p-3 text-center font-medium w-16">Total</th>
                        <th className="p-3 text-left font-medium w-28">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(hoursGrid).map(([project, row]) => {
                        const cols = gridMode === "weekly" ? row.days : [row.days[selectedDay - 1] ?? 0];
                        const total = row.days.reduce((s, h) => s + h, 0);
                        return (
                          <tr key={project} className="border-b border-border/20">
                            <td className="p-3 font-medium">{project}</td>
                            {cols.map((h, i) => {
                              const dayIdx = gridMode === "weekly" ? i : selectedDay - 1;
                              return (
                                <td key={i} className="p-2">
                                  {isDraft ? (
                                    <Input
                                      className="h-8 text-center tabular-nums"
                                      value={formatHoursDisplay(h, useHhMm)}
                                      placeholder={useHhMm ? "0:00" : "0"}
                                      onChange={(e) => handleHourChange(project, dayIdx, e.target.value)}
                                    />
                                  ) : (
                                    <span className="block text-center tabular-nums">{h > 0 ? h.toFixed(1) : "—"}</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="p-3 text-center font-semibold tabular-nums">{total.toFixed(1)}</td>
                            <td className="p-3 text-xs capitalize">{row.activityType?.replace(/_/g, " ")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/20 font-medium">
                        <td className="p-3">Daily total</td>
                        {(gridMode === "weekly" ? dayTotals : [dayTotals[selectedDay - 1] ?? 0]).map((t, i) => (
                          <td key={i} className={cn("p-3 text-center tabular-nums", t < 7.5 && t > 0 && "text-amber-600", t === 0 && "text-red-500")}>
                            {t.toFixed(1)}
                          </td>
                        ))}
                        <td className="p-3 text-center">{grandTotal.toFixed(1)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </CardContent>
              </Card>

              {isDraft && (
                <div className="flex items-center gap-2">
                  <Select value={newProjectName} onValueChange={setNewProjectName}>
                    <SelectTrigger className="w-64"><SelectValue placeholder="Add project row" /></SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={addProjectRow} disabled={!newProjectName}>
                    <Plus className="h-4 w-4 mr-1" /> Add row
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {viewMode === "approval" && (
        <div className="space-y-3">
          {pendingPeriods.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No timesheets pending approval</CardContent></Card>
          ) : pendingPeriods.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{resourceName(p.resourceId)}</p>
                  <p className="text-sm text-muted-foreground">{formatWeekRange(String(p.weekStartDate), String(p.weekEndDate))}</p>
                  <div className="text-sm mt-1 flex flex-wrap items-center gap-1.5">
                    <span>{p.totalHours ?? "0"} hrs</span>
                    <Badge variant="outline">{p.approvalStatus ?? p.status}</Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => rejectMutation.mutate({ id: p.id, reason: "Needs revision" })}
                    disabled={rejectMutation.isPending && rejectMutation.variables?.id === p.id}
                  >
                    {rejectMutation.isPending && rejectMutation.variables?.id === p.id
                      ? <FinanceButtonSpinner className="mr-1" />
                      : <XCircle className="h-4 w-4 mr-1" />}
                    Return
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => approvePmMutation.mutate(p.id)}
                    disabled={!!p.approvedByPmAt || (approvePmMutation.isPending && approvePmMutation.variables === p.id)}
                  >
                    {approvePmMutation.isPending && approvePmMutation.variables === p.id
                      ? <FinanceButtonSpinner className="mr-1" />
                      : <Users className="h-4 w-4 mr-1" />}
                    PM Approve
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => approveRmMutation.mutate(p.id)}
                    disabled={!!p.approvedByRmAt || (approveRmMutation.isPending && approveRmMutation.variables === p.id)}
                  >
                    {approveRmMutation.isPending && approveRmMutation.variables === p.id
                      ? <FinanceButtonSpinner className="mr-1" />
                      : <CheckCircle2 className="h-4 w-4 mr-1" />}
                    RM Approve
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {viewMode === "reports" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium mb-2">Utilisation (this month)</h4>
              <p className="text-3xl font-bold text-emerald-600">{(utilisation as { pct?: number })?.pct ?? 0}%</p>
              <p className="text-sm text-muted-foreground mt-1">
                {(utilisation as { billableHours?: number })?.billableHours ?? 0} billable / {(utilisation as { availableHours?: number })?.availableHours ?? 0} available hrs
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h4 className="font-medium mb-2">Missing timesheets (this week)</h4>
              {missing.length === 0 ? (
                <p className="text-sm text-muted-foreground">Everyone has submitted</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {missing.map((m) => <li key={m.resourceId} className="text-red-600">{m.name}</li>)}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
