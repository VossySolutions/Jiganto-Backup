import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import type { PmMilestone } from "@shared/models/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FormDialogShell,
  FormSection,
  FieldGrid,
  FieldLabel
} from "@/components/ui/form-dialog-shell";
import { type ColumnDef as MondayColumnDef } from "@/components/MondayTable";
import {
  MondayBoardProvider,
  MondayBoardTable,
  MondayBoardChromeControls,
} from "@/components/MondayBoardTable";
import {
  Plus, Upload, Download, LayoutList, Clock, CalendarDays,
  Target, AlertTriangle, CheckCircle2, XCircle, Loader2, Trash2, X,
} from "lucide-react";

const RAG_CONFIG: Record<string, { bg: string; bgDark: string; fg: string; fgDark: string; dot: string; label: string }> = {
  Green: { bg: "#dcfce7", bgDark: "#052e16", fg: "#15803d", fgDark: "#86efac", dot: "#22c55e", label: "On Track" },
  Amber: { bg: "#fef3c7", bgDark: "#451a03", fg: "#92400e", fgDark: "#fcd34d", dot: "#f59e0b", label: "At Risk" },
  Red: { bg: "#fee2e2", bgDark: "#450a0a", fg: "#991b1b", fgDark: "#fca5a5", dot: "#ef4444", label: "Delayed" },
  Blue: { bg: "#dbeafe", bgDark: "#172554", fg: "#1d4ed8", fgDark: "#93c5fd", dot: "#3b82f6", label: "Delivered" },
};
const ragBg = (cfg: typeof RAG_CONFIG.Green, dark: boolean) => dark ? cfg.bgDark : cfg.bg;
const ragFg = (cfg: typeof RAG_CONFIG.Green, dark: boolean) => dark ? cfg.fgDark : cfg.fg;
const RAG_ORDER = ["Green", "Amber", "Red", "Blue"];

const KPI_DEFS = [
  { key: "total", label: "Total", color: "#3b6cf4", icon: Target, filter: null },
  { key: "green", label: "On Track", color: "#22c55e", icon: CheckCircle2, filter: "Green" },
  { key: "amber", label: "At Risk", color: "#f59e0b", icon: AlertTriangle, filter: "Amber" },
  { key: "red", label: "Delayed", color: "#ef4444", icon: XCircle, filter: "Red" },
  { key: "blue", label: "Delivered", color: "#3b82f6", icon: CheckCircle2, filter: "Blue" },
  { key: "overdue", label: "Overdue", color: "#dc2626", icon: Clock, filter: "__overdue__" },
];

const fmt = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
const isOverdue = (iso: string | null, rag: string) =>
  rag !== "Blue" && iso && new Date(iso + "T00:00:00") < new Date(new Date().toISOString().split("T")[0] + "T00:00:00");
const todayStr = () => new Date().toISOString().split("T")[0];

const parseCSVRow = (line: string) => {
  const result: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
    else cur += ch;
  }
  result.push(cur);
  return result.map(c => c.trim());
};

const HEADER_MAP: Record<string, string> = {
  "project": "projectName", "project name": "projectName",
  "phase": "phase",
  "workstream": "workstream", "work stream": "workstream",
  "milestone": "name", "milestone title": "name", "name": "name", "title": "name",
  "target date": "targetDate", "date": "targetDate", "due date": "targetDate", "planned date": "targetDate",
  "rag": "ragStatus", "rag status": "ragStatus",
  "commentary": "commentary", "comment": "commentary", "notes": "commentary",
};
const normaliseRAG = (v: string) => {
  const m: Record<string, string> = {
    green: "Green", "on track": "Green", amber: "Amber", "at risk": "Amber",
    red: "Red", delayed: "Red", blue: "Blue", delivered: "Blue", complete: "Blue",
  };
  return m[(v || "").toLowerCase().trim()] || "Green";
};
const normaliseDate = (v: string): string | null => {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const dmy = v.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const dt = new Date(v);
  return isNaN(dt.getTime()) ? null : dt.toISOString().split("T")[0];
};

interface MilestoneTrackerProps {
  mode: "project" | "cross-project" | "portfolio";
  projectId?: number;
  portfolioId?: number;
}

type EnrichedMilestone = PmMilestone & { ref?: string; programme?: string | null; portfolio?: string | null; client?: string | null };

export default function MilestoneTracker({ mode, projectId }: MilestoneTrackerProps) {
  const showProjectCol = mode !== "project";
  const showPortfolioCols = mode === "portfolio";
  const { toast } = useToast();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const [view, setView] = useState<"table" | "timeline">("timeline");
  const [granularity, setGranularity] = useState("Monthly");
  const [groupBy, setGroupBy] = useState("Project");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [activeKpi, setActiveKpi] = useState<string | null>(null);
  const [fProject, setFProject] = useState("");
  const [fPhase, setFPhase] = useState("");
  const [fWS, setFWS] = useState("");
  const [fRAG, setFRAG] = useState("");
  const [fDateFrom, setFDateFrom] = useState("");
  const [fDateTo, setFDateTo] = useState("");
  const [ragDropdownId, setRagDropdownId] = useState<number | null>(null);

  const queryKey = mode === "project" && projectId
    ? ["/api/pm/projects", projectId, "milestones"]
    : mode === "portfolio"
    ? ["/api/portfolio/milestones"]
    : ["/api/pm/milestones"];

  const { data: milestones = [], isLoading } = useQuery<PmMilestone[]>({
    queryKey,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PUT", `/api/pm/milestones/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast({ title: "Failed to update milestone", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/pm/milestones/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast({ title: "Failed to delete milestone", variant: "destructive" }),
  });

  const createMut = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/pm/milestones", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast({ title: "Failed to create milestone", variant: "destructive" }),
  });

  const importMut = useMutation({
    mutationFn: (rows: any[]) => apiRequest("POST", "/api/pm/milestones/import", { milestones: rows }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast({ title: "Failed to import milestones", variant: "destructive" }),
  });

  const projects = useMemo(() => [...new Set(milestones.map(m => m.projectName).filter(Boolean))].sort() as string[], [milestones]);
  const phases = useMemo(() => [...new Set(milestones.map(m => m.phase).filter(Boolean))].sort() as string[], [milestones]);
  const workstreams = useMemo(() => [...new Set(milestones.map(m => m.workstream).filter(Boolean))].sort() as string[], [milestones]);

  const kpis = useMemo(() => ({
    total: milestones.length,
    green: milestones.filter(m => m.ragStatus === "Green").length,
    amber: milestones.filter(m => m.ragStatus === "Amber").length,
    red: milestones.filter(m => m.ragStatus === "Red").length,
    blue: milestones.filter(m => m.ragStatus === "Blue").length,
    overdue: milestones.filter(m => isOverdue(m.targetDate, m.ragStatus || "Green")).length,
  }), [milestones]);

  const filtered = useMemo(() => {
    let ms = milestones;
    if (fProject) ms = ms.filter(m => m.projectName === fProject);
    if (fPhase) ms = ms.filter(m => m.phase === fPhase);
    if (fWS) ms = ms.filter(m => m.workstream === fWS);
    if (fRAG) ms = ms.filter(m => m.ragStatus === fRAG);
    if (fDateFrom) ms = ms.filter(m => (m.targetDate || "") >= fDateFrom);
    if (fDateTo) ms = ms.filter(m => (m.targetDate || "") <= fDateTo);
    if (activeKpi) {
      const def = KPI_DEFS.find(k => k.key === activeKpi);
      if (def?.filter === "__overdue__") ms = ms.filter(m => isOverdue(m.targetDate, m.ragStatus || "Green"));
      else if (def?.filter) ms = ms.filter(m => m.ragStatus === def.filter);
    }
    return [...ms].sort((a, b) => {
      const va = a.targetDate || "";
      const vb = b.targetDate || "";
      if (va < vb) return -1;
      if (va > vb) return 1;
      return 0;
    });
  }, [milestones, fProject, fPhase, fWS, fRAG, fDateFrom, fDateTo, activeKpi]);

  const activeFilters = [
    fProject && { label: `Project: ${fProject}`, clear: () => setFProject("") },
    fPhase && { label: `Phase: ${fPhase}`, clear: () => setFPhase("") },
    fWS && { label: `WS: ${fWS}`, clear: () => setFWS("") },
    fRAG && { label: `RAG: ${fRAG}`, clear: () => setFRAG("") },
    fDateFrom && { label: `From: ${fmt(fDateFrom)}`, clear: () => setFDateFrom("") },
    fDateTo && { label: `To: ${fmt(fDateTo)}`, clear: () => setFDateTo("") },
    activeKpi && { label: `KPI: ${KPI_DEFS.find(k => k.key === activeKpi)?.label}`, clear: () => setActiveKpi(null) },
  ].filter(Boolean) as Array<{ label: string; clear: () => void }>;

  const clearAll = () => { setFProject(""); setFPhase(""); setFWS(""); setFRAG(""); setFDateFrom(""); setFDateTo(""); setActiveKpi(null); };

  const ragStatusOptions = useMemo(
    () => RAG_ORDER.map((r) => ({ value: r, label: RAG_CONFIG[r].label, color: RAG_CONFIG[r].dot })),
    [],
  );

  const mondayColumns: MondayColumnDef<EnrichedMilestone>[] = useMemo(() => {
    const cols: MondayColumnDef<EnrichedMilestone>[] = [];
    if (showPortfolioCols) {
      cols.push({
        id: "ref",
        header: "Ref",
        type: "text",
        accessor: (row) => row.ref || `MS-${row.id}`,
        width: "90px",
        editable: false,
      });
      cols.push(
        { id: "client", header: "Client", type: "text", accessor: (row) => row.client, width: "110px", editable: false },
        { id: "portfolio", header: "Portfolio", type: "text", accessor: (row) => row.portfolio, width: "110px", editable: false },
        { id: "programme", header: "Programme", type: "text", accessor: (row) => row.programme, width: "110px", editable: false },
      );
    }
    if (showProjectCol) {
      cols.push({
        id: "projectName",
        header: "Project",
        type: "text",
        accessor: "projectName",
        width: "140px",
        editable: true,
      });
    }
    cols.push(
      { id: "phase", header: "Phase", type: "text", accessor: "phase", width: "110px", editable: true },
      { id: "workstream", header: "Workstream", type: "text", accessor: "workstream", width: "120px", editable: true },
      { id: "name", header: "Milestone", type: "text", accessor: "name", width: "180px", sticky: true, editable: true },
      {
        id: "targetDate",
        header: "Date",
        type: "date",
        accessor: "targetDate",
        width: "120px",
        editable: true,
        render: (row) => {
          const od = isOverdue(row.targetDate, row.ragStatus || "Green");
          return (
            <span className={cn("text-sm", od && "text-red-600 font-semibold")}>
              {fmt(row.targetDate)}
            </span>
          );
        },
      },
      {
        id: "ragStatus",
        header: "RAG",
        type: "status",
        accessor: "ragStatus",
        width: "110px",
        editable: true,
        options: ragStatusOptions,
        render: (row) => {
          const cfg = RAG_CONFIG[row.ragStatus || "Green"] || RAG_CONFIG.Green;
          return (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: ragBg(cfg, dark), color: ragFg(cfg, dark) }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: cfg.dot }} />
              {cfg.label}
            </span>
          );
        },
      },
      { id: "commentary", header: "Commentary", type: "text", accessor: "commentary", width: "200px", editable: true },
    );
    return cols;
  }, [showPortfolioCols, showProjectCol, ragStatusOptions, dark]);

  const onUpdate = useCallback((id: number, patch: any) => {
    updateMut.mutate({ id, data: patch });
  }, [updateMut]);

  const onDelete = useCallback((id: number) => {
    if (!window.confirm("Delete this milestone?")) return;
    deleteMut.mutate(id);
  }, [deleteMut]);

  const exportCSV = () => {
    const headers = showPortfolioCols
      ? ["Ref", "Client", "Portfolio", "Programme", "Project", "Phase", "Workstream", "Milestone", "Target Date", "RAG", "Commentary"]
      : ["Project", "Phase", "Workstream", "Milestone", "Target Date", "RAG", "Commentary"];
    const lines = filtered.map(r => {
      const em = r as EnrichedMilestone;
      return showPortfolioCols
        ? [em.ref || `MS-${r.id}`, em.client || "", em.portfolio || "", em.programme || "", r.projectName || "", r.phase || "", r.workstream || "", r.name, r.targetDate || "", r.ragStatus || "", r.commentary || ""]
        : [r.projectName || "", r.phase || "", r.workstream || "", r.name, r.targetDate || "", r.ragStatus || "", r.commentary || ""];
    }).map(fields =>
      fields
        .map(v => `"${(v || "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "milestones.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (ragDropdownId === null) return;
    const close = () => setRagDropdownId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [ragDropdownId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="milestones-loading">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="milestone-tracker">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground" data-testid="milestone-title">Milestone Tracker</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} of {milestones.length} milestones</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)} data-testid="button-import-milestones">
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Import
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} data-testid="button-export-milestones">
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
          </Button>
          <Button size="sm" onClick={() => setShowAddModal(true)} data-testid="button-add-milestone">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Milestone
          </Button>
          <div className="flex border rounded-lg overflow-hidden">
            <button
              className={`px-3 py-1.5 text-xs font-semibold transition ${view === "table" ? "bg-foreground text-background" : "bg-background text-muted-foreground hover:text-foreground"}`}
              onClick={() => setView("table")}
              data-testid="view-table"
            >
              <LayoutList className="h-3.5 w-3.5 inline mr-1" />Table
            </button>
            <button
              className={`px-3 py-1.5 text-xs font-semibold transition ${view === "timeline" ? "bg-foreground text-background" : "bg-background text-muted-foreground hover:text-foreground"}`}
              onClick={() => setView("timeline")}
              data-testid="view-timeline"
            >
              <CalendarDays className="h-3.5 w-3.5 inline mr-1" />Timeline
            </button>
          </div>
        </div>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5" data-testid="milestone-kpi-bar">
        {KPI_DEFS.map(kpi => {
          const count = (kpis as any)[kpi.key] || 0;
          const isActive = activeKpi === kpi.key;
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.key}
              className={`relative overflow-hidden rounded-xl border-2 p-3.5 cursor-pointer select-none transition-all hover:-translate-y-0.5 hover:shadow-md bg-card ${isActive ? "shadow-md" : ""}`}
              style={{
                borderColor: isActive ? kpi.color : "var(--border)",
                background: isActive ? `color-mix(in srgb, ${kpi.color} 6%, var(--background))` : undefined,
              }}
              onClick={() => setActiveKpi(activeKpi === kpi.key ? null : kpi.key)}
              data-testid={`kpi-${kpi.key}`}
            >
              <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: kpi.color }} />
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="h-3.5 w-3.5" style={{ color: kpi.color }} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{kpi.label}</span>
              </div>
              <span className="text-2xl font-bold" style={{ color: kpi.color }}>{count}</span>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {showProjectCol && (
          <select className="text-sm border rounded-lg px-2.5 py-1.5 bg-background text-foreground" value={fProject} onChange={e => setFProject(e.target.value)} data-testid="filter-project">
            <option value="">All Projects</option>
            {projects.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        <select className="text-sm border rounded-lg px-2.5 py-1.5 bg-background text-foreground" value={fPhase} onChange={e => setFPhase(e.target.value)} data-testid="filter-phase">
          <option value="">All Phases</option>
          {phases.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="text-sm border rounded-lg px-2.5 py-1.5 bg-background text-foreground" value={fWS} onChange={e => setFWS(e.target.value)} data-testid="filter-workstream">
          <option value="">All Workstreams</option>
          {workstreams.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
        <select className="text-sm border rounded-lg px-2.5 py-1.5 bg-background text-foreground" value={fRAG} onChange={e => setFRAG(e.target.value)} data-testid="filter-rag">
          <option value="">All RAG</option>
          {RAG_ORDER.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <div className="w-px h-5 bg-border" />
        <input type="date" className="text-xs border rounded-lg px-2 py-1.5 bg-background text-foreground" value={fDateFrom} onChange={e => setFDateFrom(e.target.value)} title="From date" data-testid="filter-date-from" />
        <span className="text-xs text-muted-foreground">→</span>
        <input type="date" className="text-xs border rounded-lg px-2 py-1.5 bg-background text-foreground" value={fDateTo} onChange={e => setFDateTo(e.target.value)} title="To date" data-testid="filter-date-to" />
        {activeFilters.length > 0 && (
          <>
            <div className="w-px h-5 bg-border" />
            {activeFilters.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary text-primary-foreground rounded-full text-xs font-semibold cursor-pointer" onClick={f.clear}>
                {f.label} <X className="h-3 w-3 opacity-70" />
              </span>
            ))}
            <button className="text-xs text-muted-foreground hover:text-foreground underline" onClick={clearAll}>Clear all</button>
          </>
        )}
      </div>

      {/* Table View */}
      {view === "table" && (
        <MondayBoardProvider storageKey="jiganto-milestones-table">
        <div className="flex items-center justify-end mb-2">
          <MondayBoardChromeControls />
        </div>
        <div data-testid="milestone-table-view">
        <MondayBoardTable
          columns={mondayColumns}
          data={filtered as EnrichedMilestone[]}
          gridLines
          emptyMessage="No milestones match the current filters"
          onCellEdit={(id, columnId, value) =>
            onUpdate(Number(id), { [columnId]: value === "" || value == null ? null : value })
          }
          renderRowActions={(row) => (
            <button
              type="button"
              className="p-1 rounded border border-border hover:border-red-400 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
              onClick={(e) => { e.stopPropagation(); onDelete(row.id); }}
              title="Delete"
              data-testid={`delete-milestone-${row.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          alwaysShowRowActions
          paginationResetKey={`${view}|${fProject}|${fPhase}|${fWS}|${fRAG}|${fDateFrom}|${fDateTo}|${activeKpi}`}
          className="shadow-sm"
          columnWidthStorageKey="jiganto-milestones-col-widths"
        />
        </div>
        </MondayBoardProvider>
      )}

      {/* Timeline View */}
      {view === "timeline" && (
        <TimelineView
          milestones={filtered}
          granularity={granularity}
          setGranularity={setGranularity}
          groupBy={groupBy}
          setGroupBy={setGroupBy}
          showProjectCol={showProjectCol}
        />
      )}

      {/* Add Modal */}
      <AddMilestoneModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={async (data) => {
          await createMut.mutateAsync(data);
          toast({ title: "Milestone added" });
          setShowAddModal(false);
        }}
        projects={projects}
        phases={phases}
        workstreams={workstreams}
        mode={mode}
        projectId={projectId}
      />

      {/* Import Modal */}
      <ImportMilestonesModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={async (rows) => {
          await importMut.mutateAsync(rows);
          toast({ title: `${rows.length} milestone${rows.length !== 1 ? "s" : ""} imported` });
          setShowImportModal(false);
        }}
        mode={mode}
        projectId={projectId}
      />
    </div>
  );
}

function TimelineView({ milestones, granularity, setGranularity, groupBy, setGroupBy, showProjectCol }: {
  milestones: PmMilestone[];
  granularity: string;
  setGranularity: (g: string) => void;
  groupBy: string;
  setGroupBy: (g: string) => void;
  showProjectCol: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const [tooltip, setTooltip] = useState<PmMilestone | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const COL_WIDTH: Record<string, number> = { Daily: 28, Weekly: 70, Monthly: 90, Yearly: 140 };
  const ROW_H = 44;
  const LANE_V_PAD = 8;

  const periods = useMemo(() => {
    if (!milestones.length) return [];
    const dates = milestones.map(m => new Date((m.targetDate || todayStr()) + "T00:00:00").getTime());
    const todayMs = new Date().setHours(0, 0, 0, 0);
    const allMs = [...dates, todayMs];
    const minMs = Math.min(...allMs);
    const maxMs = Math.max(...allMs);
    const pad: Record<string, number> = { Daily: 2, Weekly: 7, Monthly: 30, Yearly: 90 };
    const padMs = (pad[granularity] || 30) * 86400000;
    const startMs = minMs - padMs;
    const endMs = maxMs + padMs;
    const ps: Array<{ key: string; label: string; startMs: number; endMs: number; isToday: boolean }> = [];
    const cursor = new Date(startMs);
    cursor.setHours(0, 0, 0, 0);

    if (granularity === "Daily") {
      while (cursor.getTime() <= endMs) {
        ps.push({ key: cursor.toISOString().split("T")[0], label: cursor.getDate() === 1 ? cursor.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : String(cursor.getDate()), startMs: cursor.getTime(), endMs: cursor.getTime() + 86400000 - 1, isToday: cursor.toISOString().split("T")[0] === new Date().toISOString().split("T")[0] });
        cursor.setDate(cursor.getDate() + 1);
      }
    } else if (granularity === "Weekly") {
      const dow = cursor.getDay();
      cursor.setDate(cursor.getDate() - dow + (dow === 0 ? -6 : 1));
      while (cursor.getTime() <= endMs) {
        const end = new Date(cursor); end.setDate(end.getDate() + 6);
        ps.push({ key: cursor.toISOString().split("T")[0], label: cursor.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), startMs: cursor.getTime(), endMs: end.getTime(), isToday: false });
        cursor.setDate(cursor.getDate() + 7);
      }
      const tp = ps.find(p => todayMs >= p.startMs && todayMs <= p.endMs);
      if (tp) tp.isToday = true;
    } else if (granularity === "Monthly") {
      cursor.setDate(1);
      while (cursor.getTime() <= endMs) {
        const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
        ps.push({ key: `${cursor.getFullYear()}-${cursor.getMonth()}`, label: cursor.toLocaleDateString("en-GB", { month: "short", year: "numeric" }), startMs: cursor.getTime(), endMs: end.getTime(), isToday: false });
        cursor.setMonth(cursor.getMonth() + 1);
      }
      const tp = ps.find(p => todayMs >= p.startMs && todayMs <= p.endMs);
      if (tp) tp.isToday = true;
    } else {
      cursor.setMonth(0); cursor.setDate(1);
      while (cursor.getTime() <= endMs) {
        const end = new Date(cursor.getFullYear(), 11, 31);
        ps.push({ key: String(cursor.getFullYear()), label: String(cursor.getFullYear()), startMs: cursor.getTime(), endMs: end.getTime(), isToday: false });
        cursor.setFullYear(cursor.getFullYear() + 1);
      }
      const tp = ps.find(p => todayMs >= p.startMs && todayMs <= p.endMs);
      if (tp) tp.isToday = true;
    }
    return ps;
  }, [granularity, milestones]);

  const colW = COL_WIDTH[granularity] || 90;
  const totalW = periods.length * colW;
  const todayMs = new Date().setHours(0, 0, 0, 0);

  const getLeftPx = (dateStr: string | null) => {
    if (!dateStr) return null;
    const ms = new Date(dateStr + "T00:00:00").getTime();
    const periIdx = periods.findIndex(p => ms >= p.startMs && ms <= p.endMs);
    if (periIdx === -1) return null;
    const p = periods[periIdx];
    const frac = (ms - p.startMs) / (p.endMs - p.startMs + 1);
    return (periIdx + frac) * colW;
  };

  const todayPx = (() => {
    const periIdx = periods.findIndex(p => todayMs >= p.startMs && todayMs <= p.endMs);
    if (periIdx === -1) return null;
    const p = periods[periIdx];
    const frac = (todayMs - p.startMs) / (p.endMs - p.startMs + 1);
    return (periIdx + frac) * colW;
  })();

  const groups = useMemo(() => {
    if (groupBy === "None") return [{ key: "All Milestones", items: milestones }];
    const map: Record<string, PmMilestone[]> = {};
    milestones.forEach(m => {
      const k = (groupBy === "Project" ? m.projectName : groupBy === "Phase" ? (m.phase || "No Phase") : (m.workstream || "No Workstream")) || "Other";
      if (!map[k]) map[k] = [];
      map[k].push(m);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([key, items]) => ({ key, items }));
  }, [milestones, groupBy]);

  const assignSlots = (items: PmMilestone[]) => {
    const buckets: Record<string, number[]> = {};
    items.forEach(m => {
      const ms = new Date((m.targetDate || todayStr()) + "T00:00:00").getTime();
      const p = periods.find(p => ms >= p.startMs && ms <= p.endMs);
      const key = p ? p.key : "__oob__";
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(m.id);
    });
    const slots: Record<number, number> = {};
    Object.values(buckets).forEach(ids => {
      ids.forEach((id, i) => { slots[id] = i; });
    });
    return slots;
  };

  const groupColor = (key: string) => {
    const colors = ["#7c3aed", "#3b6cf4", "#db2777", "#d97706", "#dc2626", "#059669", "#4f46e5", "#0891b2"];
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) & 0xfffffff;
    return colors[h % colors.length];
  };

  const groupByOptions = showProjectCol ? ["Project", "Phase", "Workstream", "None"] : ["Phase", "Workstream", "None"];

  return (
    <div className="bg-card border rounded-xl overflow-hidden shadow-sm" data-testid="milestone-timeline-view">
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/50 flex-wrap">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Granularity</span>
        <div className="flex border rounded-lg overflow-hidden">
          {["Daily", "Weekly", "Monthly", "Yearly"].map(g => (
            <button key={g} className={`px-3 py-1 text-xs font-semibold transition ${granularity === g ? "bg-foreground text-background" : "bg-background text-muted-foreground hover:text-foreground"}`} onClick={() => setGranularity(g)} data-testid={`gran-${g.toLowerCase()}`}>{g}</button>
          ))}
        </div>
        <div className="w-px h-5 bg-border" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Group By</span>
        <div className="flex border rounded-lg overflow-hidden">
          {groupByOptions.map(g => (
            <button key={g} className={`px-3 py-1 text-xs font-semibold transition ${groupBy === g ? "bg-foreground text-background" : "bg-background text-muted-foreground hover:text-foreground"}`} onClick={() => setGroupBy(g)} data-testid={`group-${g.toLowerCase()}`}>{g}</button>
          ))}
        </div>
        <span className="ml-auto text-[11px] text-muted-foreground">{milestones.length} milestone{milestones.length !== 1 ? "s" : ""} · hover for details</span>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[520px]">
        <div className="relative" style={{ minWidth: 200 + totalW + 24 }}>
          {/* Header */}
          <div className="flex sticky top-0 z-20 bg-muted/50 border-b">
            <div className="w-[200px] min-w-[200px] shrink-0 px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-r bg-muted/50">{groupBy === "None" ? "Timeline" : groupBy}</div>
            <div className="flex" style={{ width: totalW }}>
              {periods.map(p => (
                <div key={p.key} className={`text-center text-[11px] font-bold text-muted-foreground py-2.5 border-r shrink-0 overflow-hidden whitespace-nowrap ${p.isToday ? "bg-primary/5 text-primary" : ""}`} style={{ width: colW }}>{p.label}</div>
              ))}
            </div>
          </div>

          {/* Swimlanes */}
          {groups.map(group => {
            const slots = assignSlots(group.items);
            const maxSlot = group.items.reduce((mx, m) => Math.max(mx, slots[m.id] ?? 0), 0);
            const numRows = maxSlot + 1;
            const laneH = numRows * ROW_H + LANE_V_PAD * 2;

            return (
              <div key={group.key} className="flex border-b last:border-b-0" style={{ minHeight: laneH }}>
                <div className="w-[200px] min-w-[200px] shrink-0 px-3.5 py-2.5 flex items-center gap-2 border-r bg-muted/50 sticky left-0 z-[5]" style={{ minHeight: laneH }}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: groupColor(group.key) }} />
                      <span className="text-[12.5px] font-semibold truncate text-foreground" title={group.key}>{group.key}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full mt-1 inline-block">{group.items.length}</span>
                  </div>
                </div>

                <div className="relative flex-1" style={{ width: totalW, height: laneH }}>
                  {periods.map((p, pi) => (
                    <div key={p.key} className={`absolute top-0 bottom-0 border-r border-border/50 ${p.isToday ? "bg-primary/5" : ""}`} style={{ left: pi * colW, width: colW }} />
                  ))}
                  {todayPx !== null && (
                    <div className="absolute top-0 bottom-0 w-0.5 bg-primary/25 z-[4] pointer-events-none" style={{ left: todayPx }} />
                  )}
                  {group.items.map(m => {
                    const leftPx = getLeftPx(m.targetDate);
                    if (leftPx === null) return null;
                    const slot = slots[m.id] ?? 0;
                    const topPx = LANE_V_PAD + slot * ROW_H + ROW_H / 2;
                    const cfg = RAG_CONFIG[m.ragStatus || "Green"] || RAG_CONFIG.Green;
                    const od = isOverdue(m.targetDate, m.ragStatus || "Green");
                    return (
                      <div
                        key={m.id}
                        className="absolute cursor-pointer z-[8] flex flex-col items-center"
                        style={{ left: leftPx, top: topPx, transform: "translate(-50%, -50%)" }}
                        onMouseMove={e => { setTooltip(m); setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                        onMouseLeave={() => setTooltip(null)}
                        data-testid={`timeline-marker-${m.id}`}
                      >
                        <div
                          className="w-3.5 h-3.5 rounded-full border-2 border-background shrink-0 transition hover:scale-[1.4]"
                          style={{ background: cfg.dot, boxShadow: `0 0 0 2.5px ${ragBg(cfg, dark)}, 0 2px 6px rgba(0,0,0,0.18)` }}
                        />
                        <span className={`text-[10.5px] font-semibold whitespace-nowrap max-w-[90px] overflow-hidden text-ellipsis mt-0.5 text-center ${od ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                          {m.name.slice(0, 18)}{m.name.length > 18 ? "…" : ""}
                          {od && <AlertTriangle className="inline h-2.5 w-2.5 ml-0.5 text-red-500" />}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {groups.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No milestones match current filters
            </div>
          )}

          {todayPx !== null && (
            <div className="absolute pointer-events-none z-[6]" style={{ left: 200 + todayPx, top: 0 }}>
              <div className="bg-primary text-white text-[9.5px] font-bold px-1.5 py-0.5 rounded-b whitespace-nowrap -translate-x-1/2">Today</div>
            </div>
          )}
        </div>
      </div>

      {tooltip && (
        <div className="fixed bg-gray-900 text-white rounded-xl px-3.5 py-3 text-xs z-[9999] pointer-events-none shadow-xl max-w-[260px] leading-relaxed" style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 10 }}>
          <div className="font-bold text-[13px] mb-1.5">{tooltip.name}</div>
          {[
            ["Project", tooltip.projectName],
            ["Phase", tooltip.phase],
            ["Workstream", tooltip.workstream],
            ["Date", fmt(tooltip.targetDate) + (isOverdue(tooltip.targetDate, tooltip.ragStatus || "Green") ? " (Overdue)" : "")],
            ["RAG", tooltip.ragStatus],
            ["Notes", tooltip.commentary],
          ].map(([k, v]) => (
            <div key={k as string} className="flex gap-2 items-start">
              <span className="text-gray-400 text-[11px] w-[70px] shrink-0">{k}</span>
              <span className="flex-1" style={k === "RAG" ? { color: RAG_CONFIG[v as string]?.dot, fontWeight: 700 } : undefined}>{v || "—"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddMilestoneModal({ open, onClose, onSave, projects, phases, workstreams, mode, projectId }: {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  projects: string[];
  phases: string[];
  workstreams: string[];
  mode: string;
  projectId?: number;
}) {
  const [form, setForm] = useState({
    projectName: projects[0] || "",
    phase: "",
    workstream: "",
    name: "",
    targetDate: todayStr(),
    ragStatus: "Green",
    commentary: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({
      projectName: projects[0] || "",
      phase: "",
      workstream: "",
      name: "",
      targetDate: todayStr(),
      ragStatus: "Green",
      commentary: "",
    });
  }, [open, projects]);

  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.name.trim() || !form.targetDate) return;
    setSaving(true);
    try {
      await onSave({
        projectId: mode === "project" ? projectId : null,
        name: form.name,
        projectName: mode === "project" ? undefined : form.projectName,
        phase: form.phase || null,
        workstream: form.workstream || null,
        targetDate: form.targetDate,
        ragStatus: form.ragStatus,
        commentary: form.commentary || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(v) => !v && onClose()}
      onCancel={onClose}
      onSubmit={save}
      title="Add Milestone"
      saveLabel={saving ? "Saving..." : "Save Milestone"}
      saving={saving}
      disabled={!form.name.trim() || !form.targetDate}
      saveTestId="button-save-milestone"
      size="md"
    >
      <FormSection title="Milestone details" icon={<span className="h-2 w-2 rounded-full bg-blue-500" />}>
        <div className="space-y-1.5 mb-3.5">
          <FieldLabel required>Milestone Title</FieldLabel>
          <Input value={form.name} onChange={set("name")} placeholder="e.g. UAT Sign-off" data-testid="input-milestone-title" />
        </div>
        <FieldGrid className="mb-3.5">
          {mode !== "project" ? (
            <div className="space-y-1.5">
              <FieldLabel>Project</FieldLabel>
              <Input value={form.projectName} onChange={set("projectName")} list="ms-project-list" placeholder="Project name" data-testid="input-milestone-project" />
              <datalist id="ms-project-list">{projects.map(p => <option key={p} value={p} />)}</datalist>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <FieldLabel required>Target Date</FieldLabel>
            <Input type="date" value={form.targetDate} onChange={set("targetDate")} data-testid="input-milestone-date" />
          </div>
        </FieldGrid>
        <FieldGrid className="mb-3.5">
          <div className="space-y-1.5">
            <FieldLabel>Phase</FieldLabel>
            <Input value={form.phase} onChange={set("phase")} list="ms-phase-list" placeholder="e.g. Build" data-testid="input-milestone-phase" />
            <datalist id="ms-phase-list">{phases.map(p => <option key={p} value={p} />)}</datalist>
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Workstream</FieldLabel>
            <Input value={form.workstream} onChange={set("workstream")} list="ms-ws-list" placeholder="e.g. Technical" data-testid="input-milestone-workstream" />
            <datalist id="ms-ws-list">{workstreams.map(w => <option key={w} value={w} />)}</datalist>
          </div>
        </FieldGrid>
        <FieldGrid className="mb-3.5">
          <div className="space-y-1.5">
            <FieldLabel>RAG Status</FieldLabel>
            <select className="w-full border rounded-lg px-3 py-2 text-sm bg-background text-foreground" value={form.ragStatus} onChange={set("ragStatus")} data-testid="select-milestone-rag">
              {RAG_ORDER.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </FieldGrid>
        <div className="space-y-1.5">
          <FieldLabel>Commentary</FieldLabel>
          <Textarea value={form.commentary} onChange={set("commentary")} placeholder="Brief status update (max 200 chars)" maxLength={200} rows={3} data-testid="input-milestone-commentary" />
        </div>
      </FormSection>
    </FormDialogShell>
  );
}

function ImportMilestonesModal({ open, onClose, onImport, mode, projectId }: {
  open: boolean;
  onClose: () => void;
  onImport: (rows: any[]) => Promise<void>;
  mode: string;
  projectId?: number;
}) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const [tab, setTab] = useState<"upload" | "template">("upload");
  const [parsed, setParsed] = useState<any[]>([]);
  const [status, setStatus] = useState<{ type: string; msg: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) { setParsed([]); setStatus(null); setTab("upload"); }
  }, [open]);

  const processText = (text: string) => {
    const lines = text.trim().split("\n").filter(l => l.trim());
    if (lines.length < 2) { setStatus({ type: "err", msg: "File appears empty" }); return; }
    const headers = parseCSVRow(lines[0]).map(h => HEADER_MAP[h.toLowerCase().trim()] || null);
    const errors: string[] = [];
    const rows: any[] = [];
    lines.slice(1).forEach((line, i) => {
      const cells = parseCSVRow(line);
      const obj: Record<string, string> = {};
      headers.forEach((h, hi) => { if (h) obj[h] = cells[hi] || ""; });
      if (!obj.name?.trim()) { errors.push(`Row ${i + 2}: Milestone name required`); return; }
      const targetDate = normaliseDate(obj.targetDate || "");
      if (!targetDate) { errors.push(`Row ${i + 2}: Invalid or missing target date`); return; }
      rows.push({
        projectId: mode === "project" ? projectId : null,
        name: obj.name.trim(),
        projectName: obj.projectName || (mode === "project" ? undefined : "Unknown Project"),
        phase: obj.phase || null,
        workstream: obj.workstream || null,
        targetDate,
        ragStatus: normaliseRAG(obj.ragStatus || ""),
        commentary: (obj.commentary || "").slice(0, 200),
      });
    });
    setParsed(rows);
    if (!rows.length) { setStatus({ type: "err", msg: `No valid rows found. ${errors[0] || ""}` }); return; }
    setStatus({ type: "ok", msg: `✓ ${rows.length} milestone${rows.length > 1 ? "s" : ""} ready${errors.length ? ` (${errors.length} skipped)` : ""}` });
  };

  const handleFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setStatus({ type: "err", msg: "Please upload a .csv file" }); return;
    }
    const reader = new FileReader();
    reader.onload = e => processText(e.target?.result as string);
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const h = "Project,Phase,Workstream,Milestone,Target Date,RAG,Commentary";
    const ex = '"SAP Finance","Build","Technical","Core Module Build Complete","2026-04-15","Amber","Finance GL 90% done."';
    const blob = new Blob([h + "\n" + ex], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "milestones-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async () => {
    setImporting(true);
    try {
      await onImport(parsed);
    } finally {
      setImporting(false);
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(v) => !v && onClose()}
      onCancel={onClose}
      onSubmit={doImport}
      title="Import Milestones"
      saveLabel={importing ? "Importing..." : `Add ${parsed.length} Milestone${parsed.length > 1 ? "s" : ""}`}
      saving={importing}
      disabled={parsed.length === 0}
      saveTestId="button-confirm-import-milestones"
      size="lg"
    >
      <FormSection title="Import setup" icon={<span className="h-2 w-2 rounded-full bg-violet-500" />}>
        <div className="flex border-b -mx-6 px-6 mb-4">
          <button type="button" className={`px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${tab === "upload" ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"}`} onClick={() => setTab("upload")}>Upload File</button>
          <button type="button" className={`px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${tab === "template" ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-foreground"}`} onClick={() => setTab("template")}>Template</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === "upload" && (
            <div>
              <div
                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition hover:border-primary hover:bg-primary/5"
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); }}
                onDrop={e => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <div className="font-semibold text-sm mb-1 text-foreground">Drop your file here, or click to browse</div>
                <div className="text-xs text-muted-foreground">CSV</div>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} data-testid="input-import-file" />
              </div>
              {status && (
                <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg mt-3 text-sm ${status.type === "ok" ? "bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800" : "bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800"}`}>
                  {status.msg}
                </div>
              )}
              {parsed.length > 0 && (
                <div className="mt-3 border rounded-lg overflow-hidden max-h-[220px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="px-2.5 py-2 text-left text-[11px] font-bold uppercase text-muted-foreground">Project</th>
                        <th className="px-2.5 py-2 text-left text-[11px] font-bold uppercase text-muted-foreground">Phase</th>
                        <th className="px-2.5 py-2 text-left text-[11px] font-bold uppercase text-muted-foreground">Milestone</th>
                        <th className="px-2.5 py-2 text-left text-[11px] font-bold uppercase text-muted-foreground">Date</th>
                        <th className="px-2.5 py-2 text-left text-[11px] font-bold uppercase text-muted-foreground">RAG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.slice(0, 7).map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-2.5 py-1.5 truncate max-w-[150px] text-foreground">{r.projectName || "—"}</td>
                          <td className="px-2.5 py-1.5">{r.phase || "—"}</td>
                          <td className="px-2.5 py-1.5 truncate max-w-[200px]">{r.name}</td>
                          <td className="px-2.5 py-1.5 whitespace-nowrap">{fmt(r.targetDate)}</td>
                          <td className="px-2.5 py-1.5">
                            <span className="inline-flex items-center gap-1 font-bold text-[11px]" style={{ color: RAG_CONFIG[r.ragStatus] ? ragFg(RAG_CONFIG[r.ragStatus], dark) : undefined }}>
                              <span className="w-[7px] h-[7px] rounded-full inline-block" style={{ background: RAG_CONFIG[r.ragStatus]?.dot }} />
                              {r.ragStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {parsed.length > 7 && (
                        <tr><td colSpan={5} className="text-center py-2 text-muted-foreground italic">…and {parsed.length - 7} more</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "template" && (
            <div>
              <div className="bg-muted/50 border rounded-xl p-5 mb-4">
                <div className="font-bold text-sm mb-2 text-foreground">Import Template</div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                  Download the template, fill in one milestone per row, and upload. Compatible with CSV exports from MS Project, Smartsheet, Monday.com, Excel or any PM tool.
                </p>
                <div className="flex flex-wrap gap-1.5 mb-3.5">
                  {[["Project ✱", true], ["Phase", false], ["Workstream", false], ["Milestone ✱", true], ["Target Date ✱", true], ["RAG", false], ["Commentary", false]].map(([f, req]) => (
                    <span key={f as string} className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${req ? "bg-primary/10 border-primary text-primary" : "bg-background border-border text-muted-foreground"}`}>{f as string}</span>
                  ))}
                </div>
                <Button type="button" size="sm" onClick={downloadTemplate} data-testid="button-download-template">
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Download CSV Template
                </Button>
              </div>
              <div className="text-sm text-muted-foreground leading-7">
                <strong className="text-foreground">Field guidance:</strong><br />
                • <strong>RAG</strong> — Green / Amber / Red / Blue <em>(or On Track / At Risk / Delayed / Delivered)</em><br />
                • <strong>Target Date</strong> — yyyy-mm-dd, dd/mm/yyyy accepted<br />
                • <strong>Column order doesn't matter</strong> — headers are auto-detected
              </div>
            </div>
          )}
        </div>

      </FormSection>
    </FormDialogShell>
  );
}
