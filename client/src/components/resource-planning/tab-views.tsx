import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormDialogShell, FormSection, FieldGrid, FieldLabel } from "@/components/ui/form-dialog-shell";
import { cn } from "@/lib/utils";
import {
  RpAlertBanner, RpAvatar, RpSectionCard, RpDemandBar, RpDsCell, RpHmCell, RpKpiCard,
  RpMiniChart, RpProgressRow, RpScenarioTabs, RpTabToolbar, RpSkillBar, RpStatusPill, RpTableWrap, RpUtilRing, RP_ACCENT,
} from "./ui";
import {
  useRpAiQuery, useRpAiInsights, useRpAutoMatch, useRpBench, useRpBenchAssign, useRpCreateBooking, useRpCreateScenario,
  useRpDashboard, useRpDemandSupply, useRpDeleteBooking, useRpExtendBooking, useRpHeatMap, useRpMoveBooking, useRpPipeline, useRpPipelineSync,
  useRpPromoteBooking, useRpPromoteOpportunity, useRpRecruitment,
  useRpRecruitmentAction, useRpScheduler, useRpScenarios, useRpSkillsInventory, useRpUpdateBooking,
} from "./hooks";
import { AI_QUICK_QUERY_CATEGORIES, AI_SUGGESTED_QUERIES, toAvatarColor } from "./types";
import { canRpRead, useRpPersona, withRpPersona } from "./persona-context";
import { RpQueryShell, RpInlineLoading } from "./loading";
import { RpVirtualPaddingRows, RpVirtualScrollContainer, useVirtualRows } from "./virtual-table";
import { Sparkles, Send, Target, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

type TabNav = (tab: string) => void;

export function ExecutiveDashboardTab({ onNavigate }: { onNavigate: TabNav }) {
  const query = useRpDashboard();
  const data = query.data;

  return (
    <RpQueryShell query={query} skeleton="grid" kpiCount={5}>
      {data && (
    <div className="space-y-4 sm:space-y-6" data-testid="rp-exec-dashboard">
      {data.alert && (
        <RpAlertBanner
          action={
            <Button variant="ghost" size="sm" className="h-auto p-0 text-destructive font-semibold shrink-0" onClick={() => onNavigate("recruit")}>
              View recruitment forecast →
            </Button>
          }
        >
          <strong>{data.alert.text}</strong>
        </RpAlertBanner>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        {data.kpis.map((k) => (
          <RpKpiCard key={k.label} label={k.label} value={k.value} sub={k.sub} accent={k.accent} valueColor={k.valueColor} />
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        <RpSectionCard title="Demand vs Supply — Next 6 Months" subtitle="Confirmed + pipeline weighted">
          <RpMiniChart values={data.demandSupplyChart.demand} />
          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: RP_ACCENT }} />Demand</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-teal-200 border border-teal-500" />Supply</span>
          </div>
        </RpSectionCard>

        <RpSectionCard title="Utilisation Trend" subtitle="Billable % by month">
          <div className="flex items-center gap-4 mb-4">
            <RpUtilRing pct={data.utilisation.current} colorClass="text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">Current utilisation</p>
              <p className="text-2xl font-extrabold text-amber-600">{data.utilisation.current}%</p>
              <p className="text-xs text-muted-foreground">Target: <strong className="text-primary">{data.utilisation.target}%</strong></p>
            </div>
          </div>
          <RpMiniChart values={data.utilisation.trend} accent="#D97706" />
        </RpSectionCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <RpSectionCard title="Resources at Risk" subtitle="Rolling off in next 30 days">
          <RpTableWrap>
            <table className="w-full text-sm text-gray-700 dark:text-foreground">
              <thead><tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground border-b border-border/60"><th className="px-3 py-2.5 text-left align-middle font-semibold">Resource</th><th className="px-3 py-2.5 text-left align-middle font-semibold">Role</th><th className="px-3 py-2.5 text-left align-middle font-semibold">Roll-off</th><th className="px-3 py-2.5 text-left align-middle font-semibold">Booking</th><th className="px-3 py-2.5 text-left align-middle font-semibold">Status</th></tr></thead>
              <tbody>
                {(data.atRiskResources ?? []).map((r) => (
                  <tr key={r.name} className="border-b border-border/40 hover:bg-muted/30 cursor-pointer" onClick={() => onNavigate("scheduler")}>
                    <td className="px-3 py-2.5 align-middle"><div className="flex items-center gap-2"><RpAvatar initials={r.initials} color={toAvatarColor(r.color, r.id)} /><span className="font-semibold">{r.name}</span></div></td>
                    <td className="px-3 py-2.5 align-middle text-muted-foreground">{r.role}</td>
                    <td className="px-3 py-2.5 align-middle font-semibold">{r.rolloff}</td>
                    <td className="px-3 py-2.5 align-middle"><RpStatusPill variant={r.bookingStatus === "Confirmed" ? "success" : r.bookingStatus === "Prospect" ? "warning" : "destructive"}>{r.bookingStatus ?? "—"}</RpStatusPill></td>
                    <td className="px-3 py-2.5 align-middle"><RpStatusPill variant={r.statusVariant as "destructive" | "warning" | "success"}>{r.status}</RpStatusPill></td>
                  </tr>
                ))}
                {!data.atRiskResources?.length && (
                  <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No resources rolling off in the next 30 days</td></tr>
                )}
              </tbody>
            </table>
          </RpTableWrap>
        </RpSectionCard>

        <RpSectionCard title="Pipeline Demand" subtitle="Soft demand by role · weighted">
          <div className="flex flex-col gap-2">
            {(data.pipelineDemand ?? []).map((d) => (
              <RpDemandBar key={d.role} role={d.role} count={Math.round(d.demand)} pct={d.pct} color="bg-indigo-500" />
            ))}
          </div>
        </RpSectionCard>

        <RpSectionCard title="Critical Skills Gaps" subtitle="Demand exceeds supply">
          <div className="flex flex-col gap-2.5">
            {(data.skillsGaps ?? []).map((g) => (
              <div key={g.skill} className={cn("rounded-md border-l-[3px] p-2.5", g.severity === "critical" ? "border-red-500 bg-red-50/50 dark:bg-red-950/20" : "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20")}>
                <p className="text-xs font-bold">{g.skill}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Demand: {g.demand} · Supply: {g.supply} · Gap: {g.gap}</p>
                <p className="text-[10px] mt-1">⚡ {g.action}</p>
              </div>
            ))}
          </div>
        </RpSectionCard>
      </div>
    </div>
      )}
    </RpQueryShell>
  );
}

export function DemandSupplyTab({ onNavigate }: { onNavigate: TabNav }) {
  const persona = useRpPersona();
  const [includePipeline, setIncludePipeline] = useState(false);
  const [practice, setPractice] = useState("all");
  const [cellDetail, setCellDetail] = useState<{ skill: string; monthIndex: number } | null>(null);
  const [detailText, setDetailText] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const query = useRpDemandSupply(includePipeline, practice);
  const data = query.data;
  const dsmVirtual = useVirtualRows(data?.rows ?? [], { rowHeight: 44, maxHeight: 480 });

  const openCell = async (skill: string, monthIndex: number) => {
    setCellDetail({ skill, monthIndex });
    setDetailLoading(true);
    try {
      const params = new URLSearchParams({ skill, monthIndex: String(monthIndex), includePipeline: String(includePipeline) });
      const res = await apiRequest("GET", withRpPersona(`/api/resource-planning/demand-supply/cell?${params}`, persona));
      const json = await res.json();
      setDetailText(json.detail ?? "");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExport = async (format: "csv" | "pdf") => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ includePipeline: String(includePipeline), format });
      const res = await apiRequest("GET", withRpPersona(`/api/resource-planning/demand-supply/export?${params}`, persona));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = format === "pdf" ? "demand-supply-matrix.pdf" : "demand-supply-matrix.csv";
      a.click();
    } finally {
      setExporting(false);
    }
  };

  return (
    <RpQueryShell query={query} skeleton="grid" kpiCount={4}>
      {data && (
    <div className="space-y-4 sm:space-y-6">
      <RpTabToolbar>
        <Button variant="outline" size="sm" className="text-xs h-8 rounded-xl" onClick={() => handleExport("csv")} disabled={exporting}>
          {exporting ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Exporting…</> : "Export CSV"}
        </Button>
        <Button variant="outline" size="sm" className="text-xs h-8 rounded-xl" onClick={() => handleExport("pdf")} disabled={exporting}>Export PDF</Button>
        <Button size="sm" className="text-xs h-8 rounded-xl" onClick={() => onNavigate("recruit")}>View Recruitment Actions</Button>
      </RpTabToolbar>
      <RpAlertBanner variant="info">
        Numbers show available supply minus demand. <strong>Negative = shortage requiring action.</strong> Click any cell for detail.
      </RpAlertBanner>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <RpKpiCard label="Skills Tracked" value={String(data.kpis.skillsTracked)} sub="across practice areas" />
        <RpKpiCard label="Critical Shortages" value={String(data.kpis.criticalShortages)} sub="in forecast period" accent="#DC2626" valueColor="#DC2626" />
        <RpKpiCard label="Confirmed Demand" value={String(data.kpis.confirmedDemand)} sub="headcount required" />
        <RpKpiCard label="Pipeline Demand" value={`+${data.kpis.pipelineDemand}`} sub="probability weighted" accent="#D97706" valueColor="#D97706" />
      </div>

      <RpSectionCard
        title="Skill Demand vs Supply Matrix"
        subtitle={includePipeline ? "Confirmed + weighted pipeline demand" : "Confirmed demand only"}
        headerRight={
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
              <Checkbox id="pipeline-toggle" checked={includePipeline} onCheckedChange={(v) => setIncludePipeline(!!v)} /> Include pipeline
            </label>
            <Select value={practice} onValueChange={setPractice}>
              <SelectTrigger className="h-7 w-28 text-[11px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All practices</SelectItem>
                <SelectItem value="sap">SAP</SelectItem>
                <SelectItem value="digital">Digital</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        <RpVirtualScrollContainer scrollRef={dsmVirtual.scrollRef} onScroll={dsmVirtual.onScroll} maxHeight={dsmVirtual.maxHeight}>
        <RpTableWrap>
          <table className="w-full text-xs min-w-[800px] text-gray-700 dark:text-foreground">
            <thead>
              <tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground border-b-2 border-border/60">
                <th className="text-left py-2 px-3 font-bold uppercase text-[10px] text-gray-700 dark:text-foreground">Skill / Role</th>
                <th className="py-2 px-2 font-bold uppercase text-[10px] text-gray-700 dark:text-foreground text-center">Supply</th>
                {data.months.map((m) => <th key={m} className="py-2 px-2 font-bold uppercase text-[10px] text-gray-700 dark:text-foreground text-center whitespace-nowrap">{m}</th>)}
                <th className="py-2 px-2 font-bold uppercase text-[10px] text-gray-700 dark:text-foreground text-center">Trend</th>
              </tr>
            </thead>
            <tbody>
              <RpVirtualPaddingRows height={dsmVirtual.padTop} />
              {dsmVirtual.visibleRows.map((row) => (
                <tr key={row.skill} className="border-b border-border/40 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/10">
                  <td className="py-2.5 px-3"><div className="font-bold">{row.skill}</div><div className="text-[10px] text-muted-foreground">{row.sub}</div></td>
                  <td className={cn("py-2.5 px-2 text-center font-bold", row.supplyColor ?? "text-indigo-600")}>{row.supply}</td>
                  {row.cells.map((cell, i) => (
                    <td key={i} className="py-2.5 px-2 text-center cursor-pointer" onClick={() => openCell(row.skill, i)}>
                      <RpDsCell value={cell} type={row.cellTypes[i]} />
                    </td>
                  ))}
                  <td className="py-2.5 px-2"><div className="flex gap-0.5 justify-end h-8 items-end">{row.trend.map((h, i) => <div key={i} className="w-1.5 rounded-t bg-red-200 dark:bg-red-900/50" style={{ height: `${h}%` }} />)}</div></td>
                </tr>
              ))}
              <RpVirtualPaddingRows height={dsmVirtual.padBottom} />
            </tbody>
          </table>
        </RpTableWrap>
        </RpVirtualScrollContainer>
      </RpSectionCard>

      <Dialog open={!!cellDetail} onOpenChange={() => setCellDetail(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{cellDetail?.skill} — Cell Detail</DialogTitle></DialogHeader>
          {detailLoading ? <RpInlineLoading label="Loading cell detail…" /> : <p className="text-sm text-muted-foreground">{detailText}</p>}
        </DialogContent>
      </Dialog>
    </div>
      )}
    </RpQueryShell>
  );
}

export function HeatMapTab() {
  const [granularity, setGranularity] = useState("Week");
  const granMap = { Month: "month", Week: "week", Quarter: "quarter" } as const;
  const query = useRpHeatMap(16, granMap[granularity as keyof typeof granMap] ?? "week");
  const data = query.data;
  const virtual = useVirtualRows(data?.resources ?? [], { rowHeight: 36, maxHeight: 520 });

  return (
    <RpQueryShell query={query} skeleton="table">
      {data && (
    <div className="space-y-4 sm:space-y-6">
      <RpTabToolbar>
        <RpScenarioTabs options={["Month", "Week", "Quarter"]} value={granularity} onChange={setGranularity} />
      </RpTabToolbar>
      <div className="flex flex-wrap gap-3 mb-3 text-[11px]">
        {[
          { c: "bg-emerald-100 border-emerald-500 dark:bg-emerald-900/30 dark:border-emerald-600", l: "Available (0–49%)" },
          { c: "bg-amber-100 border-amber-500 dark:bg-amber-900/30 dark:border-amber-600", l: "Partially allocated (50–79%)" },
          { c: "bg-red-100 border-red-500 dark:bg-red-900/30 dark:border-red-600", l: "Fully allocated (80–100%)" },
          { c: "bg-muted border-border", l: "Leave / unavailable" },
          { c: "bg-blue-100 border-blue-400 border-dashed dark:bg-blue-900/30 dark:border-blue-600", l: "Soft booking (pipeline)" },
        ].map((x) => (
          <span key={x.l} className="flex items-center gap-1.5">
            <span className={cn("w-3.5 h-3.5 rounded border", x.c)} />{x.l}
          </span>
        ))}
      </div>
      <RpSectionCard title="Resource Capacity Heat Map">
        <RpVirtualScrollContainer scrollRef={virtual.scrollRef} onScroll={virtual.onScroll} maxHeight={virtual.maxHeight}>
        <RpTableWrap>
          <table className="w-full text-xs min-w-[900px] text-gray-700 dark:text-foreground">
            <thead>
              <tr className="border-b border-border/60 bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground">
                <th className="text-left py-2 px-2 min-w-[140px] font-semibold">Resource</th>
                <th className="text-left py-2 px-2 font-semibold">Role</th>
                {data.monthGroups.map((g, gi) => (
                  <th key={`${g.label}-${gi}`} colSpan={g.weekCount} className="text-center py-2 border-b-2 font-semibold">{g.label}</th>
                ))}
              </tr>
              <tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground text-[10px]">
                <th /><th />
                {Array.from({ length: data.weekCount }).map((_, i) => <th key={i} className="py-1 px-0.5 text-center">W{(i % 4) + 1}</th>)}
              </tr>
            </thead>
            <tbody>
              <RpVirtualPaddingRows height={virtual.padTop} />
              {virtual.visibleRows.map((r) => (
                <tr key={r.name} className="border-b border-border/40">
                  <td className="py-2 px-2"><div className="flex items-center gap-1.5"><RpAvatar initials={r.initials} color={toAvatarColor(r.color, r.id)} size="sm" /><span className="font-semibold">{r.name}</span></div></td>
                  <td className="py-2 px-2 text-muted-foreground">{r.role}</td>
                  {r.weeks.map((w, i) => <td key={i} className="p-0.5"><RpHmCell value={w} type={r.weekTypes[i]} /></td>)}
                </tr>
              ))}
              <RpVirtualPaddingRows height={virtual.padBottom} />
            </tbody>
          </table>
        </RpTableWrap>
        </RpVirtualScrollContainer>
      </RpSectionCard>
    </div>
      )}
    </RpQueryShell>
  );
}

export function SchedulerTab() {
  const query = useRpScheduler(16);
  const data = query.data;
  const createBooking = useRpCreateBooking();
  const updateBooking = useRpUpdateBooking();
  const moveBooking = useRpMoveBooking();
  const extendBookingMut = useRpExtendBooking();
  const deleteBooking = useRpDeleteBooking();
  const promoteBooking = useRpPromoteBooking();
  const autoMatch = useRpAutoMatch();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ resourceId: 0, projectName: "", role: "", startDate: "", endDate: "", daysPerWeek: 5 });
  const [dragBooking, setDragBooking] = useState<{ id: number; resourceId: number; soft?: boolean; label?: string } | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [extendingId, setExtendingId] = useState<number | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  const handleCreate = () => {
    if (!form.resourceId || !form.startDate || !form.endDate) return;
    createBooking.mutate(form, {
      onSuccess: (res) => {
        if (res.conflict?.hasConflict) setConflictWarning(`Booking created with conflict: ${res.conflict.conflicts.length} overlapping assignment(s)`);
        else setConflictWarning(null);
        setDialogOpen(false);
      },
    });
  };

  const handleBarClick = (bar: { id?: number; resourceId?: number; soft?: boolean; label?: string }) => {
    if (bar.id) setDragBooking({ id: bar.id, resourceId: bar.resourceId ?? 0, soft: bar.soft, label: bar.label });
  };

  const extendBookingWeeks = (weeks: number) => {
    if (!dragBooking || !data) return;
    let currentEndWeek = 0;
    for (const row of data.rows) {
      for (const bar of row.bars) {
        if (bar.id === dragBooking.id) {
          currentEndWeek = bar.endWeek ?? ((bar.startWeek ?? 0) + bar.span - 1);
          break;
        }
      }
    }
    extendBookingMut.mutate(
      { id: dragBooking.id, endWeek: currentEndWeek + weeks },
      { onSuccess: () => setDragBooking(null) },
    );
  };

  const handleExtendDrop = (endWeek: number) => {
    if (!extendingId) return;
    extendBookingMut.mutate({ id: extendingId, endWeek }, { onSuccess: () => setExtendingId(null) });
  };

  const handleDrop = (resourceId: number, startWeek: number) => {
    if (!draggedId) return;
    moveBooking.mutate(
      { id: draggedId, resourceId, startWeek },
      {
        onSuccess: (res) => {
          if (res.conflict?.hasConflict) setConflictWarning(`Booking moved with conflict: ${res.conflict.conflicts.length} overlapping assignment(s)`);
          setDraggedId(null);
        },
      },
    );
  };

  return (
    <RpQueryShell query={query} skeleton="table">
      {data && (
    <div className="space-y-4 sm:space-y-6">
      <RpTabToolbar>
        <Button variant="outline" size="sm" className="text-xs h-8 gap-1 rounded-xl" onClick={() => autoMatch.mutate({ roleName: "Consultant", startDate: new Date().toISOString().slice(0, 10), endDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10) })} disabled={autoMatch.isPending}>
          {autoMatch.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Target className="h-3.5 w-3.5" />}
          Auto-match Resources
        </Button>
        <Button size="sm" className="text-xs h-8 rounded-xl" onClick={() => setDialogOpen(true)}>+ New Booking</Button>
      </RpTabToolbar>
      {conflictWarning && <RpAlertBanner variant="info">{conflictWarning}</RpAlertBanner>}
      {(moveBooking.isPending || extendBookingMut.isPending || deleteBooking.isPending || promoteBooking.isPending) && <RpInlineLoading label="Updating scheduler…" />}
      <RpAlertBanner variant="info">
        <strong>Drag booking bars</strong> to move. <strong>Drag the right edge</strong> to extend. <strong>Click bars</strong> to confirm or delete. Dashed = soft pipeline.
      </RpAlertBanner>
      <RpSectionCard title="Resource Scheduler">
        <RpTableWrap>
          <table className="w-full text-xs min-w-[1000px]">
            <thead>
              <tr className="bg-muted/50 border-b-2">
                <th className="text-left py-2 px-3 min-w-[180px]">Resource</th>
                {data.monthGroups.map((g, gi) => (
                  <th key={`${g.label}-${gi}`} colSpan={g.weekCount} className="text-center py-2">{g.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => {
                let weekCursor = 0;
                return (
                <tr key={row.name} className="border-b border-border/40">
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <RpAvatar initials={row.initials} color={toAvatarColor(row.color, row.id)} />
                      <div><div className="font-semibold">{row.name}</div><div className="text-[10px] text-muted-foreground">{row.role}</div></div>
                    </div>
                  </td>
                  {row.bars.map((bar, i) => {
                    const startWeek = bar.startWeek ?? weekCursor;
                    weekCursor += bar.span;
                    return (
                    <td key={i} colSpan={bar.span} className="p-0.5">
                      {bar.type === "avail" ? (
                        <div
                          className={cn("h-5 rounded bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center text-[9px] text-emerald-700 font-semibold cursor-pointer hover:bg-emerald-600 hover:text-white transition-colors", draggedId && "ring-2 ring-primary/40")}
                          onClick={() => { setForm((f) => ({ ...f, resourceId: row.id })); setDialogOpen(true); }}
                          onDragOver={(e) => { e.preventDefault(); }}
                          onDrop={() => handleDrop(row.id, startWeek)}
                        >+ Available</div>
                      ) : bar.type === "leave" ? (
                        <div className="h-5 rounded bg-muted flex items-center justify-center text-[9px] text-muted-foreground">✈ Leave</div>
                      ) : (
                        <div
                          className="relative h-5"
                          onDragOver={(e) => { e.preventDefault(); }}
                          onDrop={() => extendingId ? handleExtendDrop(startWeek + bar.span - 1) : handleDrop(row.id, startWeek)}
                        >
                          <div
                            draggable
                            onDragStart={() => bar.id && setDraggedId(bar.id)}
                            onDragEnd={() => setDraggedId(null)}
                            className={cn("h-5 rounded flex items-center justify-center text-[9px] font-semibold text-white cursor-grab active:cursor-grabbing truncate px-1", bar.color, bar.soft && "border-2 border-dashed border-blue-300 opacity-70", draggedId === bar.id && "opacity-50")}
                            onClick={() => handleBarClick({ id: bar.id, resourceId: row.id, soft: bar.soft, label: bar.label })}
                          >
                            {bar.label}
                          </div>
                          <div
                            draggable
                            onDragStart={(e) => { e.stopPropagation(); if (bar.id) setExtendingId(bar.id); }}
                            onDragEnd={() => setExtendingId(null)}
                            className="absolute right-0 top-0 w-1.5 h-full cursor-ew-resize bg-white/40 rounded-r hover:bg-white/70"
                            title="Drag to extend"
                          />
                        </div>
                      )}
                    </td>
                  );})}
                </tr>
              );})}
            </tbody>
          </table>
        </RpTableWrap>
      </RpSectionCard>

      <FormDialogShell
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCancel={() => setDialogOpen(false)}
        onSubmit={handleCreate}
        title="New Booking"
        saveLabel={createBooking.isPending ? "Creating..." : "Create booking"}
        saving={createBooking.isPending}
        disabled={!form.resourceId || !form.startDate || !form.endDate}
      >
        <FormSection title="Booking details" icon={<span className="h-2 w-2 rounded-full bg-blue-500" />}>
          <div className="space-y-1.5 mb-3.5">
            <FieldLabel required>Resource</FieldLabel>
            <Select
              value={form.resourceId ? String(form.resourceId) : ""}
              onValueChange={(v) => setForm({ ...form, resourceId: Number(v) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select resource" />
              </SelectTrigger>
              <SelectContent>
                {(data?.resources ?? []).map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 mb-3.5">
            <FieldLabel>Project name</FieldLabel>
            <Input value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} />
          </div>
          <div className="space-y-1.5 mb-3.5">
            <FieldLabel>Role</FieldLabel>
            <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          </div>
          <FieldGrid className="mb-3.5">
            <div className="space-y-1.5">
              <FieldLabel required>Start</FieldLabel>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <FieldLabel required>End</FieldLabel>
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </FieldGrid>
          <div className="space-y-1.5">
            <FieldLabel>Days/week</FieldLabel>
            <Input type="number" min={1} max={5} value={form.daysPerWeek} onChange={(e) => setForm({ ...form, daysPerWeek: Number(e.target.value) })} />
          </div>
        </FormSection>
      </FormDialogShell>

      <Dialog open={!!dragBooking} onOpenChange={() => setDragBooking(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dragBooking?.label ?? "Booking"}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Extend, confirm soft booking, or remove this assignment.</p>
          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => extendBookingWeeks(2)} disabled={updateBooking.isPending}>+2 weeks</Button>
            <Button onClick={() => extendBookingWeeks(4)} disabled={updateBooking.isPending}>+4 weeks</Button>
            {dragBooking?.soft && (
              <Button variant="secondary" onClick={() => promoteBooking.mutate(dragBooking.id, { onSuccess: () => setDragBooking(null) })} disabled={promoteBooking.isPending}>
                Confirm soft booking
              </Button>
            )}
            <Button variant="destructive" onClick={() => deleteBooking.mutate(dragBooking!.id, { onSuccess: () => setDragBooking(null) })} disabled={deleteBooking.isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {autoMatch.data && autoMatch.data.matches.length > 0 && (
        <RpAlertBanner variant="info">
          Auto-match found {autoMatch.data.matches.length} candidates: {autoMatch.data.matches.map((m) => m.name).join(", ")}
        </RpAlertBanner>
      )}
    </div>
      )}
    </RpQueryShell>
  );
}

export function SkillsInventoryTab({ searchTerm = "" }: { searchTerm?: string }) {
  const query = useRpSkillsInventory(searchTerm);
  const data = query.data;
  const matrixVirtual = useVirtualRows(data?.matrix ?? [], { rowHeight: 52, maxHeight: 480 });
  const [, setLocation] = useLocation();

  return (
    <RpQueryShell query={query} skeleton="grid" kpiCount={2}>
      {data && (
    <div className="space-y-4 sm:space-y-6">
      <RpTabToolbar>
        <Button size="sm" className="text-xs h-8 rounded-xl" onClick={() => setLocation("/modules/resource-mgmt")}>+ Manage Skills</Button>
      </RpTabToolbar>
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        <RpSectionCard title="Skills Distribution" subtitle="By practice area">
          <div className="flex flex-col gap-3">
            {data.distribution.map((s) => (
              <RpProgressRow key={s.practice} label={s.practice} count={s.count} pct={s.pct} color={s.color} />
            ))}
          </div>
        </RpSectionCard>
        <RpSectionCard title="Top Demanded Skills">
          <RpTableWrap>
            <table className="w-full text-sm text-gray-700 dark:text-foreground">
              <thead><tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground border-b border-border/60"><th className="px-3 py-2.5 text-left align-middle font-semibold">Skill</th><th className="px-3 py-2.5 text-center align-middle font-semibold">Supply</th><th className="px-3 py-2.5 text-center align-middle font-semibold">Demand</th><th className="px-3 py-2.5 text-center align-middle font-semibold">Gap</th><th className="px-3 py-2.5 text-left align-middle font-semibold">Status</th></tr></thead>
              <tbody>
                {data.topDemanded.map((s) => (
                  <tr key={s.skill} className="border-b border-border/40 hover:bg-muted/30">
                    <td className="px-3 py-2.5 align-middle font-semibold">{s.skill}</td>
                    <td className="px-3 py-2.5 align-middle text-center">{s.supply}</td>
                    <td className="px-3 py-2.5 align-middle text-center">{s.demand}</td>
                    <td className={cn("px-3 py-2.5 align-middle text-center font-bold", s.gap < 0 ? "text-red-600" : "text-emerald-600")}>{s.gap > 0 ? `+${s.gap}` : s.gap}</td>
                    <td className="px-3 py-2.5 align-middle"><RpStatusPill variant={s.variant as "destructive" | "warning" | "success"}>{s.status}</RpStatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </RpTableWrap>
        </RpSectionCard>
      </div>
      <RpSectionCard title="Resource Skills Matrix">
        <RpVirtualScrollContainer scrollRef={matrixVirtual.scrollRef} onScroll={matrixVirtual.onScroll} maxHeight={matrixVirtual.maxHeight}>
        <RpTableWrap>
          <table className="w-full text-xs min-w-[700px] text-gray-700 dark:text-foreground">
            <thead><tr className="border-b border-border/60 bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground"><th className="text-left py-2 px-3 font-bold">Resource</th><th className="text-left py-2 px-3 font-semibold">Role / Grade</th><th className="text-left py-2 px-3 font-semibold">Location</th><th className="text-left py-2 px-3 font-semibold">Languages</th><th className="text-left py-2 px-3 font-semibold">Top Skills</th><th className="text-left py-2 px-3 font-semibold">Utilisation</th></tr></thead>
            <tbody>
              <RpVirtualPaddingRows height={matrixVirtual.padTop} />
              {matrixVirtual.visibleRows.map((r) => (
                <tr key={r.id} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="py-2.5 px-3"><div className="flex items-center gap-2"><RpAvatar initials={r.initials} color={toAvatarColor(r.color, r.id)} /><div><div className="font-semibold">{r.name}</div></div></div></td>
                  <td className="py-2.5 px-3"><RpStatusPill>{r.role}</RpStatusPill><div className="text-[10px] text-muted-foreground mt-0.5">{r.grade}</div></td>
                  <td className="py-2.5 px-3">{r.location}</td>
                  <td className="py-2.5 px-3">{r.languages}</td>
                  <td className="py-2.5 px-3"><div className="flex flex-col gap-1">{r.skills.map((s) => <RpSkillBar key={s.name} name={s.name} level={(s.level / s.maxLevel) * 100} />)}</div></td>
                  <td className="py-2.5 px-3"><div className={cn("text-sm font-bold", r.utilColor)}>{r.util}%</div>{r.utilNote && <div className="text-[10px] text-red-600">{r.utilNote}</div>}</td>
                </tr>
              ))}
              <RpVirtualPaddingRows height={matrixVirtual.padBottom} />
            </tbody>
          </table>
        </RpTableWrap>
        </RpVirtualScrollContainer>
      </RpSectionCard>
    </div>
      )}
    </RpQueryShell>
  );
}

export function PipelineDemandTab({ onNavigate }: { onNavigate: TabNav }) {
  const [scenario, setScenario] = useState<"expected" | "best" | "worst">("expected");
  const scenarioLabel = scenario === "expected" ? "Expected" : scenario === "best" ? "Best Case" : "Worst Case";
  const query = useRpPipeline(scenario);
  const pipelineSync = useRpPipelineSync();
  const promoteOpp = useRpPromoteOpportunity();
  const data = query.data;

  return (
    <RpQueryShell query={query} skeleton="grid" kpiCount={4}>
      {data && (
    <div className="space-y-4 sm:space-y-6">
      <RpTabToolbar>
        <Button variant="outline" size="sm" className="text-xs h-8 rounded-xl" onClick={() => pipelineSync.mutate()} disabled={pipelineSync.isPending}>
          {pipelineSync.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
          Sync from CRM
        </Button>
        {pipelineSync.data && <span className="text-[11px] text-muted-foreground">{pipelineSync.data.message}</span>}
      </RpTabToolbar>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <RpKpiCard label="Active Opportunities" value={String(data.kpis.activeOpportunities)} sub="pipeline opportunities" />
        <RpKpiCard label="Soft Demand (weighted)" value={String(data.kpis.softDemand)} sub="headcount across opps" accent="#D97706" valueColor="#D97706" />
        <RpKpiCard label="At-risk opportunities" value={String(data.kpis.atRiskOpportunities)} sub="insufficient capacity" accent="#DC2626" valueColor="#DC2626" />
        <RpKpiCard label="Avg probability" value={`${data.kpis.avgProbability}%`} sub="across active pipeline" />
      </div>
      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-3">
          {data.opportunities.map((opp) => (
            <div key={opp.id} className="rounded-xl border border-border/50 p-3 sm:p-4 hover:border-primary/30 bg-card">
              <div className="flex justify-between items-start mb-2">
                <div><p className="text-sm font-bold">{opp.client}</p><p className="text-[11px] text-muted-foreground">{opp.project}</p></div>
                <p className="text-sm font-bold text-primary">{opp.value}</p>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">{opp.tags.map((t) => <RpStatusPill key={t.label} variant={t.variant as "info" | "warning" | "destructive" | "success"}>{t.label}</RpStatusPill>)}</div>
              <div className="border-t pt-2">
                {opp.roles.map((role) => (
                  <div key={role.role} className="flex items-center gap-2 text-[11px] py-0.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 flex items-center justify-center text-[9px] font-bold shrink-0">{role.count}</span>
                    <span className="flex-1">{role.role}</span>
                    <RpStatusPill variant={role.availVariant as "destructive" | "success"}>{role.avail}</RpStatusPill>
                  </div>
                ))}
              </div>
              {(opp.softBookings ?? 0) > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-2 text-[11px] h-7"
                  disabled={promoteOpp.isPending}
                  onClick={() => promoteOpp.mutate(opp.id, { onSuccess: () => onNavigate("scheduler") })}
                >
                  {promoteOpp.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Confirm {opp.softBookings} soft booking{(opp.softBookings ?? 0) > 1 ? "s" : ""}
                </Button>
              )}
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <RpSectionCard title="Pipeline Probability Model">
            <RpScenarioTabs options={["Expected", "Best Case", "Worst Case"]} value={scenarioLabel} onChange={(v) => setScenario(v === "Best Case" ? "best" : v === "Worst Case" ? "worst" : "expected")} className="w-full mb-3" />
            <div className="flex flex-col gap-2">
              {data.probabilityModel.map((m) => (
                <div key={m.label} className={cn("flex justify-between p-2 rounded-md border-l-[3px]", m.severity === "critical" ? "border-red-500 bg-red-50/50 dark:bg-red-950/20" : m.severity === "warning" ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20" : "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20")}>
                  <span className="text-xs font-bold">{m.label}</span>
                  <span className="text-sm font-extrabold">{m.value}</span>
                </div>
              ))}
            </div>
          </RpSectionCard>
          {data.aiRecommendation && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm font-bold flex items-center gap-1"><Sparkles className="h-4 w-4 text-primary" /> AI Recommendation</p>
              <p className="text-xs text-muted-foreground mt-2">{data.aiRecommendation.text}</p>
              <Button size="sm" className="w-full mt-3 text-xs rounded-xl" onClick={() => onNavigate("recruit")}>View Recruitment Plan →</Button>
            </div>
          )}
        </div>
      </div>
    </div>
      )}
    </RpQueryShell>
  );
}

export function RecruitmentForecastTab() {
  const persona = useRpPersona();
  const query = useRpRecruitment();
  const data = query.data;
  const action = useRpRecruitmentAction();
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: "csv" | "pdf") => {
    setExporting(true);
    try {
      const res = await apiRequest("GET", withRpPersona(`/api/resource-planning/recruitment/export?format=${format}`, persona));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = format === "pdf" ? "recruitment-export.pdf" : "recruitment-export.csv";
      a.click();
    } finally {
      setExporting(false);
    }
  };

  return (
    <RpQueryShell query={query} skeleton="grid" kpiCount={3}>
      {data && (
    <div className="space-y-4 sm:space-y-6">
      <RpTabToolbar>
        <Button size="sm" className="text-xs h-8 rounded-xl" onClick={() => handleExport("csv")} disabled={exporting}>
          {exporting ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />Exporting…</> : "Export CSV"}
        </Button>
        <Button variant="outline" size="sm" className="text-xs h-8 rounded-xl" onClick={() => handleExport("pdf")} disabled={exporting}>Export PDF</Button>
      </RpTabToolbar>
      {data.alert && <RpAlertBanner><strong>{data.alert.text}</strong></RpAlertBanner>}
      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        {data.cards.map((card) => (
          <div key={card.id} className={cn("rounded-xl border border-border/50 p-3.5 sm:p-4 bg-card", card.type === "shortage" ? "border-l-4 border-l-destructive" : "border-l-4 border-l-amber-500")}>
            <p className="text-[10px] font-bold uppercase text-muted-foreground">{card.month}</p>
            <p className="text-sm font-bold mt-1">{card.skill}</p>
            {card.rows.map((row) => (
              <div key={row.l} className="flex justify-between text-[11px] py-1 border-b border-border/40 last:border-0">
                <span className="text-muted-foreground">{row.l}</span>
                <span className={cn("font-semibold", row.red && "text-red-600", row.amber && "text-amber-600")}>{row.v}</span>
              </div>
            ))}
            <p className="text-[11px] font-semibold mt-2 p-2 rounded-md bg-primary/10 text-primary">{card.action}</p>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant={card.type === "shortage" ? "destructive" : "default"} className="flex-1 text-[11px] h-8" onClick={() => action.mutate({ id: card.id, status: "in-progress" })} disabled={action.isPending}>
                {action.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : card.primary}
              </Button>
              {card.secondary && <Button size="sm" variant="outline" className="flex-1 text-[11px] h-8">{card.secondary}</Button>}
            </div>
          </div>
        ))}
      </div>
      <RpSectionCard title="Recruitment Timeline — 12-Month View">
        <RpTableWrap>
          <table className="w-full text-sm text-gray-700 dark:text-foreground">
            <thead><tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground border-b border-border/60"><th className="px-3 py-2.5 text-left align-middle font-semibold">Role</th><th className="px-3 py-2.5 text-left align-middle font-semibold">Grade</th><th className="px-3 py-2.5 text-center align-middle font-semibold">Headcount</th><th className="px-3 py-2.5 text-center align-middle font-semibold">Time-to-Hire</th><th className="px-3 py-2.5 text-left align-middle font-semibold">Latest Start</th><th className="px-3 py-2.5 text-left align-middle font-semibold">Go-Live</th><th className="px-3 py-2.5 text-left align-middle font-semibold">Est. Cost</th><th className="px-3 py-2.5 text-left align-middle font-semibold">Status</th></tr></thead>
            <tbody>
              {data.timeline.map((row) => (
                <tr key={row.id} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="px-3 py-2.5 align-middle font-semibold">{row.role}</td>
                  <td className="px-3 py-2.5 align-middle"><RpStatusPill>{row.grade}</RpStatusPill></td>
                  <td className="px-3 py-2.5 align-middle text-center font-bold">{row.headcount}</td>
                  <td className="px-3 py-2.5 align-middle text-center">{row.tth}</td>
                  <td className="px-3 py-2.5 align-middle font-semibold">{row.start}</td>
                  <td className="px-3 py-2.5 align-middle">{row.goLive}</td>
                  <td className="px-3 py-2.5 align-middle">{row.cost}</td>
                  <td className="px-3 py-2.5 align-middle"><RpStatusPill variant={row.statusVariant as "destructive" | "warning" | "success"}>{row.status}</RpStatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </RpTableWrap>
      </RpSectionCard>
    </div>
      )}
    </RpQueryShell>
  );
}

export function BenchManagementTab({ onNavigate, persona = "res-mgr" }: { onNavigate?: TabNav; persona?: string }) {
  const query = useRpBench();
  const data = query.data;
  const assign = useRpBenchAssign();
  const hideCost = persona === "exec" || persona === "sales";
  const benchVirtual = useVirtualRows(data?.resources ?? [], { rowHeight: 40, maxHeight: 480 });

  return (
    <RpQueryShell query={query} skeleton="grid" kpiCount={hideCost ? 3 : 4}>
      {data && (
    <div className="space-y-4 sm:space-y-6">
      <div className={cn("grid gap-3 sm:gap-4", hideCost ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4")}>
        <RpKpiCard label="On Bench Today" value={String(data.kpis.onBench)} sub={`${data.kpis.benchPct}% of total capacity`} accent="#DC2626" valueColor="#DC2626" />
        <RpKpiCard label="Rolling off (30 days)" value={String(data.kpis.rollingOff)} sub="will join bench unless booked" accent="#D97706" valueColor="#D97706" />
        {!hideCost && data.kpis.benchCostMonth != null && <RpKpiCard label="Bench Cost / Month" value={`£${(data.kpis.benchCostMonth / 1000).toFixed(0)}K`} sub="unbillable salary cost" accent="#DC2626" valueColor="#DC2626" />}
        <RpKpiCard label="Redeployable" value={String(data.kpis.redeployable)} sub="matched to open demand" accent="#059669" valueColor="#059669" />
      </div>
      <RpSectionCard title="Resources Available Now">
        <RpVirtualScrollContainer scrollRef={benchVirtual.scrollRef} onScroll={benchVirtual.onScroll} maxHeight={benchVirtual.maxHeight}>
        <RpTableWrap>
          <table className="w-full text-xs">
            <thead><tr className="border-b bg-muted/50 text-muted-foreground"><th className="text-left py-2 px-3 font-bold">Resource</th><th>Role</th><th>Key Skills</th><th>Available Since</th><th>Days on Bench</th><th>Pipeline Match</th><th>Action</th></tr></thead>
            <tbody>
              <RpVirtualPaddingRows height={benchVirtual.padTop} />
              {benchVirtual.visibleRows.map((r) => (
                <tr key={r.id} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="py-2 px-3"><div className="flex items-center gap-2"><RpAvatar initials={r.initials} color={toAvatarColor(r.color, r.id)} /><span className="font-semibold">{r.name}</span></div></td>
                  <td className="py-2 px-2"><RpStatusPill variant="info">{r.role}</RpStatusPill></td>
                  <td className="py-2 px-2">{r.skills}</td>
                  <td className="py-2 px-2">{r.since}</td>
                  <td className={cn("py-2 px-2 font-bold", r.daysColor === "red" || r.days > 14 ? "text-red-600" : r.daysColor === "amber" || r.days > 7 ? "text-amber-600" : "text-emerald-600")}>{r.days} days</td>
                  <td className="py-2 px-2"><RpStatusPill variant={r.matchVariant as "success" | "warning"}>{r.match}</RpStatusPill></td>
                  <td className="py-2 px-2">
                    <Button
                      size="sm"
                      variant={r.actionVariant === "warning" ? "secondary" : "default"}
                      className="text-[11px] h-7"
                      disabled={assign.isPending}
                      onClick={() => {
                        if (r.matchVariant === "success") {
                          assign.mutate({
                            id: r.id,
                            projectName: r.match.split(" — ")[0],
                            role: r.matchRoleName ?? r.role,
                            opportunityId: r.matchOpportunityId ?? undefined,
                          }, { onSuccess: () => onNavigate?.("scheduler") });
                        } else {
                          onNavigate?.("skills");
                        }
                      }}
                    >
                      {assign.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : r.action}
                    </Button>
                  </td>
                </tr>
              ))}
              <RpVirtualPaddingRows height={benchVirtual.padBottom} />
            </tbody>
          </table>
        </RpTableWrap>
        </RpVirtualScrollContainer>
      </RpSectionCard>
    </div>
      )}
    </RpQueryShell>
  );
}

export function AiWorkforceTab({ onNavigate }: { onNavigate?: TabNav }) {
  const persona = useRpPersona();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const aiQuery = useRpAiQuery();
  const insightsQuery = useRpAiInsights();
  const dashboardQuery = useRpDashboard({ enabled: canRpRead(persona, "dashboard") });
  const dashboard = dashboardQuery.data;

  const send = (text: string) => {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    aiQuery.mutate(text, {
      onSuccess: (res) => {
        setMessages((m) => [...m, { role: "assistant", text: res.reply }]);
      },
    });
  };

  const insights = insightsQuery.data ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid lg:grid-cols-[1fr_280px] gap-4 sm:gap-6">
        <div className="rounded-xl border border-border/50 shadow-sm flex flex-col h-[560px] bg-card">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <div>
              <p className="text-sm font-bold">Jiganto AI Workforce Planner</p>
              {dashboardQuery.isLoading && canRpRead(persona, "dashboard") ? (
                <RpInlineLoading label="Connecting to workforce data…" />
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Connected to live workforce data
                  {canRpRead(persona, "dashboard") && (
                    <> · {dashboard?.meta?.resourceCount ?? "—"} resources · {dashboard?.meta?.opportunityCount ?? "—"} opportunities</>
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.length === 0 && <p className="text-xs text-muted-foreground">Ask about resources, demand, skills, or capacity…</p>}
            {messages.map((msg, i) => (
              <div key={i} className={cn("max-w-[85%]", msg.role === "user" ? "self-end" : "self-start")}>
                <div className={cn("px-3.5 py-2.5 rounded-xl text-xs leading-relaxed whitespace-pre-line", msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted border rounded-bl-sm")}>{msg.text}</div>
              </div>
            ))}
            {aiQuery.isPending && <RpInlineLoading label="Thinking…" />}
          </div>
          <div className="flex flex-wrap gap-1.5 px-4 pb-2">
            {AI_SUGGESTED_QUERIES.map((s) => (
              <button key={s} type="button" onClick={() => send(s)} className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground transition-colors">{s}</button>
            ))}
          </div>
          <div className="flex gap-2 p-3 border-t">
            <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)} placeholder="Ask about resources, demand, skills, capacity..." className="rounded-xl text-xs" />
            <Button size="icon" className="rounded-xl shrink-0 h-9 w-9" onClick={() => send(input)} disabled={aiQuery.isPending}><Send className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="space-y-3">
          <RpSectionCard title="Quick Queries">
            <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto">
              {Object.entries(AI_QUICK_QUERY_CATEGORIES).map(([cat, queries]) => (
                <div key={cat}>
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">{cat}</p>
                  {queries.map((q) => (
                    <button key={q} type="button" onClick={() => send(q)} className="block w-full text-left px-2 py-1 rounded text-[11px] font-semibold text-primary hover:bg-primary/10 mb-0.5">{q}</button>
                  ))}
                </div>
              ))}
            </div>
          </RpSectionCard>
          <div className="rounded-xl border border-border/50 bg-card shadow-sm p-4">
            <p className="text-sm font-bold mb-2">Today&apos;s AI Insights</p>
            {insightsQuery.isLoading ? <RpInlineLoading label="Loading insights…" /> : insightsQuery.isError ? (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => insightsQuery.refetch()}>Retry loading insights</Button>
            ) : (
              <div className="text-[11px] leading-relaxed space-y-1.5">
                {insights.map((ins, i) => (
                  <button key={i} type="button" onClick={() => onNavigate?.(ins.linkTab)} className={cn("block w-full text-left hover:underline", ins.color === "red" ? "text-red-600" : ins.color === "green" ? "text-emerald-600" : ins.color === "blue" ? "text-blue-600" : "text-foreground")}>
                    {ins.type === "urgent" ? "⚡" : ins.type === "positive" ? "📈" : ins.type === "opportunity" ? "🎯" : "⚠"} <strong>{ins.type}:</strong> {ins.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScenarioPlanningTab() {
  const query = useRpScenarios();
  const data = query.data;
  const createScenario = useRpCreateScenario();
  const [active, setActive] = useState("Expected Case");

  const scenario = data?.scenarios.find((s) => s.name === active) ?? data?.scenarios[0];

  return (
    <RpQueryShell query={query} skeleton="grid" kpiCount={4}>
      {data && (
    <div className="space-y-4 sm:space-y-6">
      <RpTabToolbar>
        <Button size="sm" className="text-xs h-8 rounded-xl" onClick={() => createScenario.mutate({ name: `Custom ${Date.now()}`, scenarioType: "custom" })} disabled={createScenario.isPending}>
          {createScenario.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}+ New Scenario
        </Button>
      </RpTabToolbar>
      <RpScenarioTabs options={data.scenarios.map((s) => s.name)} value={active} onChange={setActive} className="max-w-lg flex-wrap" />
      {scenario && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <RpKpiCard label="Expected Revenue" value={scenario.revenue} sub="probability-weighted pipeline" />
          <RpKpiCard label="Resource Demand" value={scenario.demand} sub="weighted headcount needed" accent="#D97706" valueColor="#D97706" />
          <RpKpiCard label="Utilisation Forecast" value={scenario.util} sub="if all actions taken" accent="#059669" valueColor="#059669" />
          <RpKpiCard label="Shortfall" value={scenario.shortfall} sub="action required" accent="#DC2626" valueColor="#DC2626" />
        </div>
      )}
      <div className="grid lg:grid-cols-2 gap-4">
        <RpSectionCard title="Scenario Comparison">
          <RpTableWrap>
            <table className="w-full text-xs text-gray-700 dark:text-foreground">
              <thead><tr className="border-b border-border/60 bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground"><th className="text-left py-2 px-3 font-bold">Metric</th><th className="text-amber-600 font-bold">Worst</th><th className="text-indigo-600 font-bold">Expected</th><th className="text-emerald-600 font-bold">Best</th></tr></thead>
              <tbody>
                {data.comparison.map((row) => (
                  <tr key={row.metric} className="border-b border-border/40">
                    <td className="py-2 px-3 font-semibold">{row.metric}</td>
                    <td className="py-2 px-2 text-amber-600">{row.worst}</td>
                    <td className="py-2 px-2 text-indigo-600">{row.expected}</td>
                    <td className="py-2 px-2 text-emerald-600">{row.best}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </RpTableWrap>
        </RpSectionCard>
        <RpSectionCard title={`Recommended Actions (${active})`}>
          <div className="flex flex-col gap-2.5">
            {(scenario?.actions ?? []).map((a) => (
              <div key={a.title} className={cn("rounded-md border-l-[3px] p-2.5", a.severity === "critical" && "border-red-500 bg-red-50/50 dark:bg-red-950/20", a.severity === "warning" && "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20", a.severity === "info" && "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20", a.severity === "success" && "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20")}>
                <p className="text-xs font-bold">{a.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{a.detail}</p>
              </div>
            ))}
          </div>
        </RpSectionCard>
      </div>
    </div>
      )}
    </RpQueryShell>
  );
}
