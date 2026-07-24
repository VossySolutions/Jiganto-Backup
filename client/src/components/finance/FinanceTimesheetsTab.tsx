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
  Clock,
  UserCheck,
  Plus,
  Copy,
  Calendar,
  BarChart3,
  PenLine,
  CheckSquare
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FinanceTabLoading,
  FinanceTableSkeleton,
  FinanceButtonSpinner
} from "./FinanceUi";
import type { FinanceTimesheetPeriod } from "./types";
import { type ColumnDef as MondayColumnDef } from "@/components/MondayTable";
import {
  MondayBoardProvider,
  MondayBoardTable,
  MondayBoardChromeControls,
} from "@/components/MondayBoardTable";
import { useDebouncedValue } from "@/lib/crm-monday-chrome";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { TablePagination } from "@/components/TablePagination";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatWeekRange(start: string, end: string) {
  return `${new Date(start).toLocaleDateString()} – ${new Date(end).toLocaleDateString()}`;
}

function getMonday(d = new Date()) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatLocalDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  canApprove?: boolean;
  ownResourceId?: number | null;
  initialViewMode?: "entry" | "approval" | "reports";
}

type TimesheetEntryRow = {
  id: number;
  projectName: string | null;
  entryDate: string | null;
  dayOfWeek: number;
  hours: string | null;
  approvalStatus?: string | null;
  role?: string | null;
};

function PeriodEntriesPanel({ periodId, canApprove, onChanged }: { periodId: number; canApprove: boolean; onChanged?: () => void }) {
  const { data: entries = [], refetch } = useQuery<TimesheetEntryRow[]>({
    queryKey: [`/api/finance/timesheets/periods/${periodId}/entries`],
    staleTime: 30_000,
  });

  const approveEntry = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/resources/timesheets/entries/${id}/approve`),
    onSuccess: () => { refetch(); onChanged?.(); },
  });

  const rejectEntry = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/resources/timesheets/entries/${id}/reject`, { reason: "Needs revision" }),
    onSuccess: () => { refetch(); onChanged?.(); },
  });

  if (entries.length === 0) return <p className="text-xs text-muted-foreground pl-6">No line entries</p>;

  return (
    <div className="mt-2 pl-6 space-y-1 border-l-2 border-orange-500/20 ml-2">
      {entries.map((e) => (
        <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 text-xs p-2 rounded bg-muted/30">
          <span>{e.projectName ?? "General"} · Day {e.dayOfWeek} · {e.hours ?? 0}h</span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">{e.approvalStatus ?? "pending"}</Badge>
            {canApprove && e.approvalStatus !== "approved" && (
              <>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => approveEntry.mutate(e.id)}>Approve</Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => rejectEntry.mutate(e.id)}>Reject</Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function FinanceTimesheetsTab({
  periods: periodsProp,
  pendingPeriods: pendingProp,
  isLoading: isLoadingProp,
  searchTerm = "",
  canApprove = true,
  ownResourceId = null,
  initialViewMode = "entry",
}: FinanceTimesheetsTabProps) {
  const { toast } = useToast();
  const [periodSearch, setPeriodSearch] = useState("");
  const debouncedPeriodSearch = useDebouncedValue(periodSearch || searchTerm);
  const [viewMode, setViewMode] = useState<"entry" | "approval" | "reports">(initialViewMode);
  const [gridMode, setGridMode] = useState<"weekly" | "daily">("weekly");
  const [selectedDay, setSelectedDay] = useState(1);
  const [useHhMm, setUseHhMm] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState<string>("");
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [expandedPeriodId, setExpandedPeriodId] = useState<number | null>(null);
  const [signoffPeriodId, setSignoffPeriodId] = useState<number | null>(null);
  const [signoffEmail, setSignoffEmail] = useState("");
  const [signoffName, setSignoffName] = useState("");

  const { data: fetchedPeriods = [], isLoading: fetchLoading } = useQuery<FinanceTimesheetPeriod[]>({
    queryKey: ["/api/finance/timesheets/periods"],
    enabled: periodsProp === undefined,
    staleTime: 30_000,
  });

  const { data: fetchedPending = [] } = useQuery<FinanceTimesheetPeriod[]>({
    queryKey: ["/api/finance/timesheets/periods?status=submitted"],
    enabled: pendingProp === undefined,
    staleTime: 30_000,
  });

  const periods = periodsProp ?? fetchedPeriods;
  const pendingPeriods = pendingProp ?? fetchedPending;
  const isLoading = isLoadingProp ?? fetchLoading;

  const { data: resources = [] } = useQuery<Array<{ id: number; firstName: string; lastName: string }>>({
    queryKey: ["/api/resources"],
    staleTime: 60_000,
  });

  const visibleResources = ownResourceId
    ? resources.filter((r) => r.id === ownResourceId)
    : resources;

  const { data: projects = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/pm/projects"],
    staleTime: 60_000,
  });

  const { data: signoffRequests = [] } = useQuery<Array<{ id: number; title: string; status: string; timesheetPeriodId?: number }>>({
    queryKey: ["/api/signoff"],
    staleTime: 30_000,
  });

  const signoffByPeriodId = useMemo(() => {
    const map = new Map<number, { id: number; status: string; title: string }>();
    for (const r of signoffRequests) {
      if (r.timesheetPeriodId) map.set(r.timesheetPeriodId, { id: r.id, status: r.status, title: r.title });
    }
    return map;
  }, [signoffRequests]);

  const activePeriodId = selectedPeriodId ?? (selectedResourceId
    ? periods.find((p) => String(p.resourceId) === selectedResourceId)?.id ?? null
    : null);

  const { data: periodDetail, refetch: refetchPeriod } = useQuery<FinanceTimesheetPeriod>({
    queryKey: [`/api/finance/timesheets/periods/${activePeriodId}`],
    enabled: activePeriodId != null,
    staleTime: 30_000,
  });

  const { data: utilisation } = useQuery({
    queryKey: ["/api/finance/timesheets/reports/utilisation"],
    enabled: viewMode === "reports",
    staleTime: 30_000,
  });

  const { data: missing = [] } = useQuery<Array<{ resourceId: number; name: string }>>({
    queryKey: [`/api/finance/timesheets/reports/missing?weekStartDate=${formatLocalDate(getMonday())}`],
    enabled: viewMode === "reports",
    staleTime: 30_000,
  });

  useEffect(() => {
    if (ownResourceId) {
      setSelectedResourceId(String(ownResourceId));
    } else if (!selectedResourceId && visibleResources[0]) {
      setSelectedResourceId(String(visibleResources[0].id));
    }
  }, [visibleResources, selectedResourceId, ownResourceId]);

  const resourceName = (resourceId: number) => {
    const r = resources.find((res) => res.id === resourceId);
    return r ? `${r.firstName} ${r.lastName}` : `Resource #${resourceId}`;
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/finance/timesheets/periods"] });
    queryClient.invalidateQueries({ queryKey: ["/api/finance/timesheets/periods?status=submitted"] });
    queryClient.invalidateQueries({ queryKey: ["/api/finance/dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/finance/budgets"] });
    queryClient.invalidateQueries({ queryKey: ["/api/finance/timesheets/reports/utilisation"] });
    if (activePeriodId) refetchPeriod();
  };

  const createPeriodMutation = useMutation({
    mutationFn: async () => {
      const monday = getMonday();
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      return apiRequest("POST", "/api/finance/timesheets/periods", {
        resourceId: Number(selectedResourceId),
        weekStartDate: formatLocalDate(monday),
        weekEndDate: formatLocalDate(sunday),
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

  const handleNewWeek = () => {
    if (!selectedResourceId) return;
    const monday = formatLocalDate(getMonday());
    const existing = periods.find(
      (p) => String(p.resourceId) === selectedResourceId && String(p.weekStartDate).slice(0, 10) === monday,
    );
    if (existing) {
      toast({ title: "Period already exists" });
      setSelectedPeriodId(existing.id);
      return;
    }
    createPeriodMutation.mutate();
  };

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

  const bulkApproveMutation = useMutation({
    mutationFn: ({ periodIds, role }: { periodIds: number[]; role: "pm" | "rm" }) =>
      apiRequest("POST", "/api/resources/timesheets/periods/bulk-approve", { periodIds, role }),
    onSuccess: () => { invalidate(); toast({ title: "Bulk approval complete" }); },
    onError: () => toast({ title: "Bulk approval failed", variant: "destructive" }),
  });

  const signoffMutation = useMutation({
    mutationFn: ({ periodId, signerEmail, signerName }: { periodId: number; signerEmail: string; signerName: string }) =>
      apiRequest("POST", `/api/resources/timesheets/periods/${periodId}/request-signoff`, { signerEmail, signerName }),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/signoff"] });
      invalidate();
      toast({
        title: "E-sign request sent",
        description: data.signUrl ? `Signer portal: ${data.signUrl}` : undefined,
      });
      setSignoffPeriodId(null);
      setSignoffEmail("");
      setSignoffName("");
    },
    onError: async (err: Error & { message?: string }) => {
      toast({ title: "E-sign request failed", description: err.message, variant: "destructive" });
    },
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
  const entryRows = useMemo(() => Object.entries(hoursGrid), [hoursGrid]);
  const entryPagination = useTablePagination(entryRows, {
    resetKey: `${activePeriodId ?? "none"}|${gridMode}|${selectedDay}|${useHhMm}`,
  });
  const pendingResetKey = useMemo(
    () => pendingPeriods.map((p) => `${p.id}:${p.approvalStatus ?? p.status}`).join("|"),
    [pendingPeriods]
  );

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

  const filteredResourcePeriods = useMemo(() => {
    const q = debouncedPeriodSearch.toLowerCase();
    return resourcePeriods.filter((p) => {
      if (!q) return true;
      const label = `${formatWeekRange(String(p.weekStartDate), String(p.weekEndDate))} ${p.status ?? ""} ${p.approvalStatus ?? ""}`.toLowerCase();
      return label.includes(q);
    });
  }, [resourcePeriods, debouncedPeriodSearch]);

  const filteredPendingPeriods = useMemo(() => {
    const q = debouncedPeriodSearch.toLowerCase();
    return pendingPeriods.filter((p) => {
      if (!q) return true;
      const label = `${resourceName(p.resourceId)} ${formatWeekRange(String(p.weekStartDate), String(p.weekEndDate))} ${p.totalHours ?? ""} ${p.approvalStatus ?? p.status ?? ""}`.toLowerCase();
      return label.includes(q);
    });
  }, [pendingPeriods, debouncedPeriodSearch, resources]);

  type PeriodRow = FinanceTimesheetPeriod & { resourceLabel?: string };

  const periodListColumns: MondayColumnDef<PeriodRow>[] = useMemo(() => [
    {
      id: "resource",
      header: "Resource",
      type: "text",
      accessor: (row) => row.resourceLabel ?? resourceName(row.resourceId),
      width: "160px",
      editable: false,
      render: (row) => <span className="font-medium">{row.resourceLabel ?? resourceName(row.resourceId)}</span>,
    },
    {
      id: "week",
      header: "Week",
      type: "text",
      accessor: (row) => formatWeekRange(String(row.weekStartDate), String(row.weekEndDate)),
      width: "220px",
      editable: false,
    },
    {
      id: "hours",
      header: "Hours",
      type: "number",
      accessor: (row) => row.totalHours ?? "0",
      width: "80px",
      editable: false,
    },
    {
      id: "status",
      header: "Status",
      type: "text",
      accessor: (row) => row.approvalStatus ?? row.status,
      width: "120px",
      editable: false,
      render: (row) => <Badge variant="outline" className="capitalize">{row.approvalStatus ?? row.status ?? "—"}</Badge>,
    },
  ], [resources]);

  const entryPeriodColumns: MondayColumnDef<FinanceTimesheetPeriod>[] = useMemo(() => [
    {
      id: "week",
      header: "Week",
      type: "text",
      accessor: (row) => formatWeekRange(String(row.weekStartDate), String(row.weekEndDate)),
      width: "240px",
      sticky: true,
      editable: false,
      render: (row) => (
        <span className={cn("font-medium", activePeriodId === row.id && "text-primary")}>
          {formatWeekRange(String(row.weekStartDate), String(row.weekEndDate))}
        </span>
      ),
    },
    {
      id: "hours",
      header: "Hours",
      type: "number",
      accessor: (row) => row.totalHours ?? "0",
      width: "80px",
      editable: false,
    },
    {
      id: "status",
      header: "Status",
      type: "text",
      accessor: (row) => row.status,
      width: "120px",
      editable: false,
      render: (row) => <Badge variant="outline" className="capitalize">{row.status ?? "—"}</Badge>,
    },
  ], [activePeriodId]);

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
        {canApprove && (
        <Button variant={viewMode === "approval" ? "default" : "outline"} size="sm" className="flex-1 sm:flex-none" onClick={() => setViewMode("approval")}>
          <UserCheck className="h-4 w-4 mr-1" /> Approvals
          {pendingPeriods.length > 0 && <Badge variant="secondary" className="ml-2">{pendingPeriods.length}</Badge>}
        </Button>
        )}
        {(canApprove || ownResourceId == null) && (
        <Button variant={viewMode === "reports" ? "default" : "outline"} size="sm" className="flex-1 sm:flex-none" onClick={() => setViewMode("reports")}>
          <BarChart3 className="h-4 w-4 mr-1" /> Reports
        </Button>
        )}
      </div>

      {viewMode === "entry" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedResourceId} onValueChange={(v) => { setSelectedResourceId(v); setSelectedPeriodId(null); }} disabled={!!ownResourceId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Team member" /></SelectTrigger>
              <SelectContent>
                {visibleResources.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>{r.firstName} {r.lastName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleNewWeek} disabled={!selectedResourceId || createPeriodMutation.isPending}>
              {createPeriodMutation.isPending ? <FinanceButtonSpinner className="mr-1" /> : <Calendar className="h-4 w-4 mr-1" />}
              New Week
            </Button>
            <div className="flex gap-1 ml-auto items-center">
              <Button variant={gridMode === "weekly" ? "secondary" : "ghost"} size="sm" onClick={() => setGridMode("weekly")}>Weekly</Button>
              <Button variant={gridMode === "daily" ? "secondary" : "ghost"} size="sm" onClick={() => setGridMode("daily")}>Daily</Button>
              {gridMode === "daily" && (
                <Select value={String(selectedDay)} onValueChange={(v) => setSelectedDay(Number(v))}>
                  <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAY_LABELS.map((d, i) => (
                      <SelectItem key={d} value={String(i + 1)}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button variant={useHhMm ? "secondary" : "ghost"} size="sm" onClick={() => setUseHhMm(!useHhMm)}>HH:MM</Button>
            </div>
          </div>

          {selectedResourceId && (
            <MondayBoardProvider storageKey="jiganto-finance-timesheets-entry-periods">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
              <Input
                placeholder="Search periods…"
                value={periodSearch}
                onChange={(e) => setPeriodSearch(e.target.value)}
                className="max-w-xs h-8 text-sm"
                data-testid="timesheet-period-search"
              />
              <MondayBoardChromeControls />
              </div>
              <MondayBoardTable
                columns={entryPeriodColumns}
                data={filteredResourcePeriods}
                gridLines
                emptyMessage={resourcePeriods.length === 0 ? "No timesheet periods yet — create a new week." : "No periods match your search."}
                onRowClick={(row) => setSelectedPeriodId(row.id)}
                searchHighlightTerm={debouncedPeriodSearch}
                paginationResetKey={`${selectedResourceId}-${debouncedPeriodSearch}`}
              />
            </div>
            </MondayBoardProvider>
          )}

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
                      {entryPagination.paginatedItems.map(([project, row]) => {
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
              <TablePagination
                page={entryPagination.page}
                totalPages={entryPagination.totalPages}
                total={entryPagination.total}
                startIndex={entryPagination.startIndex}
                endIndex={entryPagination.endIndex}
                pageSize={entryPagination.pageSize}
                onPageChange={entryPagination.setPage}
                onPageSizeChange={entryPagination.setPageSize}
              />

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
          ) : (
            <MondayBoardProvider storageKey="jiganto-finance-timesheets-approval-periods">
            <>
              <div className="flex items-center gap-2 flex-wrap">
              <Input
                placeholder="Search pending periods…"
                value={periodSearch}
                onChange={(e) => setPeriodSearch(e.target.value)}
                className="max-w-xs h-8 text-sm"
                data-testid="timesheet-approval-search"
              />
              <MondayBoardChromeControls />
              </div>
              <MondayBoardTable
                columns={periodListColumns}
                data={filteredPendingPeriods}
                gridLines
                selectable={canApprove}
                onRowClick={(row) => setExpandedPeriodId(expandedPeriodId === row.id ? null : row.id)}
                searchHighlightTerm={debouncedPeriodSearch}
                paginationResetKey={`${pendingResetKey}-${debouncedPeriodSearch}`}
                renderBulkActions={canApprove ? (ids) => (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!ids.length || bulkApproveMutation.isPending}
                      onClick={() => bulkApproveMutation.mutate({ periodIds: ids.map(Number), role: "pm" })}>
                      <CheckSquare className="h-3 w-3 mr-1" /> Bulk PM Approve
                    </Button>
                    <Button size="sm" className="h-7 text-xs" disabled={!ids.length || bulkApproveMutation.isPending}
                      onClick={() => bulkApproveMutation.mutate({ periodIds: ids.map(Number), role: "rm" })}>
                      Bulk RM Approve
                    </Button>
                  </div>
                ) : undefined}
                renderRowActions={(p) => {
                  if (!canApprove) return null;
                  const periodSignoff = signoffByPeriodId.get(p.id);
                  const signoffActive = periodSignoff && !["voided", "declined", "expired"].includes(periodSignoff.status);
                  return (
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setSignoffPeriodId(p.id); }} disabled={!!signoffActive}>
                        <PenLine className="h-3 w-3 mr-1" /> E-Sign
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); rejectMutation.mutate({ id: p.id, reason: "Needs revision" }); }}>
                        Return
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); approvePmMutation.mutate(p.id); }} disabled={!!p.approvedByPmAt}>
                        PM
                      </Button>
                      <Button size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); approveRmMutation.mutate(p.id); }} disabled={!!p.approvedByRmAt}>
                        RM
                      </Button>
                    </div>
                  );
                }}
                alwaysShowRowActions={canApprove}
              />
              {expandedPeriodId != null && (
                <Card className="rounded-xl border-primary/30">
                  <CardContent className="p-4">
                    <PeriodEntriesPanel periodId={expandedPeriodId} canApprove={canApprove} onChanged={invalidate} />
                  </CardContent>
                </Card>
              )}
            </>
            </MondayBoardProvider>
          )}

          {signoffPeriodId && (
            <Card className="border-orange-500/30">
              <CardContent className="p-4 space-y-3">
                <p className="font-medium text-sm">Request e-sign for timesheet #{signoffPeriodId}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label className="text-xs">Signer name</Label><Input value={signoffName} onChange={(e) => setSignoffName(e.target.value)} /></div>
                  <div><Label className="text-xs">Signer email</Label><Input type="email" value={signoffEmail} onChange={(e) => setSignoffEmail(e.target.value)} /></div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSignoffPeriodId(null)}>Cancel</Button>
                  <Button size="sm" disabled={!signoffEmail || !signoffName || signoffMutation.isPending}
                    onClick={() => signoffMutation.mutate({ periodId: signoffPeriodId, signerEmail: signoffEmail, signerName: signoffName })}>
                    {signoffMutation.isPending ? <><FinanceButtonSpinner className="mr-1" /> Sending…</> : "Send e-sign request"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
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
