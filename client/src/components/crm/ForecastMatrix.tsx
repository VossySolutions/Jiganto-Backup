import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowUpDown,
  Calendar,
  Download,
  Filter,
  GitBranch,
  Layers,
  Loader2,
  Plus,
  StickyNote,
  Target,
  TrendingUp,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCrmUsers } from "./CrmUsersProvider";
import { OpportunityFormDialog } from "./OpportunityFormDialog";
import { ForecastOpportunityNotesDialog } from "./ForecastOpportunityNotesDialog";
import { stagesForActivePipeline } from "@/lib/crm-tab-counts";
import type {
  CrmPipelineSummary,
  CrmForecastStage,
  CrmAccountForecast,
  CrmContactPicklist,
  CrmForecastOpportunity,
} from "./types";

type MatrixSort = "total-desc" | "total-asc" | "account" | "opportunity";
type MatrixGroupBy = "none" | "account" | "stage" | "owner";
type MatrixPeriodView = "monthly" | "quarterly" | "annual";

const GROUP_COLORS = [
  "bg-blue-50/80 dark:bg-blue-950/30",
  "bg-emerald-50/80 dark:bg-emerald-950/30",
  "bg-violet-50/80 dark:bg-violet-950/30",
  "bg-amber-50/80 dark:bg-amber-950/30",
  "bg-cyan-50/80 dark:bg-cyan-950/30",
  "bg-rose-50/80 dark:bg-rose-950/30",
];

const ACCOUNT_BAR_COLORS = [
  "#3b82f6", "#22c55e", "#f97316", "#8b5cf6",
  "#ec4899", "#06b6d4", "#eab308", "#ef4444",
  "#14b8a6", "#6366f1",
];

function accountBarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return ACCOUNT_BAR_COLORS[Math.abs(hash) % ACCOUNT_BAR_COLORS.length];
}

/** Fixed £ buckets — matches client mock (image 2) legend */
const HEATMAP_LEGEND = [
  { label: "<£50K", bg: "#f0f9ff", color: "#1e3a8a" },
  { label: "£50–100K", bg: "#bfdbfe", color: "#1e40af" },
  { label: "£100–150K", bg: "#60a5fa", color: "#ffffff" },
  { label: "£150K+", bg: "#2563eb", color: "#ffffff" },
] as const;

function heatmapCellStyle(value: number): React.CSSProperties {
  if (value <= 0) return {};
  if (value < 50_000) return { backgroundColor: HEATMAP_LEGEND[0].bg, color: HEATMAP_LEGEND[0].color };
  if (value < 100_000) return { backgroundColor: HEATMAP_LEGEND[1].bg, color: HEATMAP_LEGEND[1].color };
  if (value < 150_000) return { backgroundColor: HEATMAP_LEGEND[2].bg, color: HEATMAP_LEGEND[2].color };
  return { backgroundColor: HEATMAP_LEGEND[3].bg, color: HEATMAP_LEGEND[3].color };
}

const PERIOD_VIEWS: { value: MatrixPeriodView; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
];

interface ForecastMatrixProps {
  pipelines: CrmPipelineSummary[];
  stages: CrmForecastStage[];
  opportunities: CrmForecastOpportunity[];
  accounts: CrmAccountForecast[];
  contacts: CrmContactPicklist[];
  forecastPeriodKey?: string;
  forecastPeriodOptions?: Array<{ value: string; label: string }>;
  onForecastPeriodChange?: (periodKey: string) => void;
  onCreateForecast?: () => void;
  onNavigateToResourcePlan?: (opportunityId: number, planId?: number | null) => void;
}

type MatrixRow = {
  opportunityId: number;
  name: string;
  accountId: number | null;
  accountName: string;
  accountIndustry: string | null;
  stageId: number | null;
  stageName: string;
  ownerUserId: string | null;
  noteCount: number;
  notePreview: string | null;
  probability: number;
  expectedCloseDate: string | null;
  cells: number[];
};

type MatrixData = {
  period: string;
  scenario: string;
  columns: string[];
  rows: MatrixRow[];
  totals: number[];
};

type MatrixGroupItem = { type: "group"; groupKey: string; groupTotal: number };
type MatrixRowItem = { type: "row"; row: MatrixRow; groupKey: string; groupColorIndex: number };
type MatrixGroupedItem = MatrixGroupItem | MatrixRowItem;

function formatValue(v: number): string {
  if (v >= 1000000) return `£${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `£${Math.round(v / 1000)}K`;
  return v > 0 ? `£${Math.round(v)}` : "—";
}

function rowTotal(row: MatrixRow): number {
  return row.cells.reduce((a, b) => a + b, 0);
}

function formatCloseLabel(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const month = d.toLocaleString("en-GB", { month: "short" });
  const year = String(d.getFullYear()).slice(-2);
  return `Close ${month} '${year}`;
}

function probabilityColor(probability: number): string {
  if (probability >= 75) return "#22c55e";
  if (probability >= 50) return "#f59e0b";
  if (probability >= 25) return "#f97316";
  return "#ef4444";
}

function stageInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

const STAGE_FALLBACK_COLORS = ["#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4"];

function resolveStageColor(stage: { color?: string | null } | undefined, stageName: string): string {
  if (stage?.color) return stage.color;
  let hash = 0;
  for (let i = 0; i < stageName.length; i++) hash = stageName.charCodeAt(i) + ((hash << 5) - hash);
  return STAGE_FALLBACK_COLORS[Math.abs(hash) % STAGE_FALLBACK_COLORS.length];
}

function MatrixFilterSelect({
  value,
  onValueChange,
  icon: Icon,
  active,
  className,
  testId,
  children,
}: {
  value: string;
  onValueChange: (v: string) => void;
  icon: typeof Filter;
  active?: boolean;
  className?: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        className={cn(
          "h-8 text-xs gap-1.5 rounded-lg border shadow-sm",
          active
            ? "border-[#0ea5e9] bg-sky-50/80 dark:bg-sky-950/30 text-foreground"
            : "border-border bg-background",
          className,
        )}
        data-testid={testId}
      >
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}

export function ForecastMatrix({
  pipelines,
  stages,
  opportunities,
  accounts,
  contacts,
  forecastPeriodKey,
  forecastPeriodOptions,
  onForecastPeriodChange,
  onCreateForecast,
  onNavigateToResourcePlan,
}: ForecastMatrixProps) {
  const { users, resolveOwner } = useCrmUsers();
  const [period, setPeriod] = useState<MatrixPeriodView>("monthly");
  const [scenario, setScenario] = useState("expected");
  const [pipelineId, setPipelineId] = useState<string>("all");
  const [stageId, setStageId] = useState<string>("all");
  const [ownerUserId, setOwnerUserId] = useState<string>("all");
  const [monthsAhead, setMonthsAhead] = useState<string>("12");
  const [sortBy, setSortBy] = useState<MatrixSort>("total-desc");
  const [groupBy, setGroupBy] = useState<MatrixGroupBy>("none");
  const [formOpen, setFormOpen] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<CrmForecastOpportunity | null>(null);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [notesTarget, setNotesTarget] = useState<{ id: number; name: string } | null>(null);

  const queryKey = `/api/crm/forecast-matrix?period=${period}&scenario=${scenario}${pipelineId !== "all" ? `&pipelineId=${pipelineId}` : ""}${stageId !== "all" ? `&stageId=${stageId}` : ""}${ownerUserId !== "all" ? `&ownerUserId=${ownerUserId}` : ""}&monthsAhead=${monthsAhead}${forecastPeriodKey ? `&forecastPeriod=${forecastPeriodKey}` : ""}`;
  const { data, isLoading } = useQuery<MatrixData>({ queryKey: [queryKey] });

  const openStages = useMemo(() => stages.filter((s) => !s.isClosed).sort((a, b) => a.order - b.order), [stages]);
  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages]);

  const sortedRows = useMemo(() => {
    const rows = [...(data?.rows ?? [])];
    rows.sort((a, b) => {
      switch (sortBy) {
        case "total-desc":
          return rowTotal(b) - rowTotal(a);
        case "total-asc":
          return rowTotal(a) - rowTotal(b);
        case "account":
          return a.accountName.localeCompare(b.accountName) || a.name.localeCompare(b.name);
        case "opportunity":
          return a.name.localeCompare(b.name) || a.accountName.localeCompare(b.accountName);
        default:
          return 0;
      }
    });
    return rows;
  }, [data?.rows, sortBy]);

  const groupedRows = useMemo((): MatrixGroupedItem[] => {
    if (groupBy === "none") return [];

    const groups = new Map<string, MatrixRow[]>();
    for (const row of sortedRows) {
      let key = "Other";
      if (groupBy === "account") key = row.accountName;
      else if (groupBy === "stage") key = row.stageName;
      else if (groupBy === "owner") key = row.ownerUserId ? resolveOwner(row.ownerUserId).name : "Unassigned";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    const entries = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const flat: MatrixGroupedItem[] = [];
    entries.forEach(([key, rows], index) => {
      const groupTotal = rows.reduce((s, r) => s + rowTotal(r), 0);
      flat.push({ type: "group", groupKey: key, groupTotal });
      rows.forEach((row) => flat.push({ type: "row", row, groupKey: key, groupColorIndex: index % GROUP_COLORS.length }));
    });
    return flat;
  }, [sortedRows, groupBy, resolveOwner]);

  const formStages = useMemo(() => {
    if (!editingOpportunity?.stageId) {
      const defaultPipelineId = pipelines.find((p) => p.isDefault)?.id ?? pipelines[0]?.id ?? null;
      return stagesForActivePipeline(stages, pipelines, defaultPipelineId);
    }
    const stage = stages.find((s) => s.id === editingOpportunity.stageId);
    const pipelineForOpp = stage?.pipelineId ?? pipelines.find((p) => p.isDefault)?.id ?? pipelines[0]?.id ?? null;
    return stagesForActivePipeline(stages, pipelines, pipelineForOpp);
  }, [editingOpportunity, stages, pipelines]);

  const openOpportunity = (opportunityId: number) => {
    const opp = opportunities.find((o) => o.id === opportunityId);
    if (!opp) return;
    setEditingOpportunity(opp);
    setFormOpen(true);
  };

  const openNotes = (row: MatrixRow) => {
    setNotesTarget({ id: row.opportunityId, name: row.name });
    setNotesDialogOpen(true);
  };

  const exportCsv = () => {
    if (!data) return;
    const headers = ["Account", "Opportunity", "Stage", "Probability", "Close Date", "Notes", ...data.columns, "Row Total"];
    const rows = data.rows.map((r) => [
      r.accountName,
      r.name,
      r.stageName,
      `${r.probability}%`,
      r.expectedCloseDate || "",
      r.notePreview || "",
      ...r.cells.map((c) => String(Math.round(c))),
      String(Math.round(rowTotal(r))),
    ]);
    const footer = ["TOTAL", "", "", "", "", "", ...data.totals.map((t) => String(Math.round(t))), String(Math.round(data.totals.reduce((a, b) => a + b, 0)))];
    const csv = [headers, ...rows, footer].map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-forecast-${period}-${scenario}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderDataRow = (row: MatrixRow, groupColorIndex?: number, rowIndex?: number) => {
    const total = rowTotal(row);
    const labelBg =
      groupColorIndex != null
        ? GROUP_COLORS[groupColorIndex]
        : rowIndex != null && rowIndex % 2 === 1
          ? "bg-slate-50/90 dark:bg-muted/30"
          : "bg-white dark:bg-card";
    const closeLabel = formatCloseLabel(row.expectedCloseDate);
    const stage = row.stageId != null ? stageById.get(row.stageId) : undefined;
    const stageColor = resolveStageColor(stage, row.stageName);

    return (
      <tr key={row.opportunityId} className={cn("border-t border-border/40", labelBg)}>
        <td className={cn("px-0 py-0 sticky left-0 z-10 border-r border-border/30", labelBg)}>
          <div className="flex items-stretch min-h-[2.75rem]">
            <div
              className="w-1 shrink-0 self-stretch"
              style={{ backgroundColor: accountBarColor(row.accountName) }}
              aria-hidden
              data-testid={`matrix-account-bar-${row.opportunityId}`}
            />
            <div className="px-3 py-2 min-w-0 flex-1">
              <span className="font-semibold text-foreground block truncate">{row.accountName}</span>
              {row.accountIndustry && (
                <span className="text-[10px] text-muted-foreground mt-0.5 block truncate" data-testid={`matrix-account-industry-${row.opportunityId}`}>
                  {row.accountIndustry}
                </span>
              )}
            </div>
          </div>
        </td>
        <td className={cn("px-3 py-2 sticky left-[140px] z-10 border-r border-border/30 min-w-[200px]", labelBg)}>
          <button
            type="button"
            onClick={() => openOpportunity(row.opportunityId)}
            className="text-left w-full"
            data-testid={`matrix-opp-link-${row.opportunityId}`}
          >
            <span className="font-medium text-primary hover:underline underline-offset-2 block truncate">{row.name}</span>
            {(row.probability > 0 || row.stageName !== "—" || closeLabel) && (
              <span className="flex items-center gap-1.5 mt-0.5 flex-wrap" data-testid={`matrix-opp-meta-${row.opportunityId}`}>
                {row.probability > 0 && (
                  <span className="text-[10px] font-semibold tabular-nums" style={{ color: probabilityColor(row.probability) }}>
                    {Math.round(row.probability)}%
                  </span>
                )}
                {row.stageName !== "—" && (
                  <span
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white shrink-0"
                    style={{ backgroundColor: stageColor }}
                    title={row.stageName}
                  >
                    {stageInitials(row.stageName)}
                  </span>
                )}
                {closeLabel && (
                  <span className="text-[10px] text-muted-foreground">{closeLabel}</span>
                )}
              </span>
            )}
          </button>
        </td>
        <td className="px-3 py-2 whitespace-nowrap">
          {row.stageName === "—" ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border"
              style={{
                backgroundColor: `${stageColor}18`,
                color: stageColor,
                borderColor: `${stageColor}40`,
              }}
              data-testid={`matrix-stage-badge-${row.opportunityId}`}
            >
              {row.stageName}
            </span>
          )}
        </td>
        <td className="px-3 py-2 max-w-[140px]">
          <button
            type="button"
            onClick={() => openNotes(row)}
            className="text-left text-[#0ea5e9] hover:underline text-xs flex items-start gap-1 disabled:opacity-40"
            disabled={row.noteCount === 0}
            data-testid={`matrix-note-link-${row.opportunityId}`}
          >
            <StickyNote className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="line-clamp-2">
              {row.noteCount > 0 ? (row.notePreview || `View ${row.noteCount} note(s)`) : "—"}
            </span>
          </button>
        </td>
        {row.cells.map((cell, i) => (
          <td
            key={i}
            className={cn("px-3 py-2 text-right tabular-nums border-l border-border/20 font-medium")}
            style={heatmapCellStyle(cell)}
          >
            {formatValue(cell)}
          </td>
        ))}
        <td className="px-3 py-2 text-right font-semibold tabular-nums border-l border-border/20" style={heatmapCellStyle(total)}>
          {formatValue(total)}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-3" data-testid="forecast-matrix">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">Time Period Forecast Matrix</h3>
        <div className="flex flex-wrap items-center gap-2.5 text-[10px] text-muted-foreground" data-testid="matrix-heatmap-legend">
          {HEATMAP_LEGEND.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5 font-medium">
              <span
                className="inline-block h-4 w-9 rounded-sm border border-blue-200/60 shadow-sm"
                style={{ backgroundColor: item.bg }}
              />
              <span style={{ color: item.color === "#ffffff" ? undefined : item.color }}>{item.label}</span>
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 -mt-1">
          {onCreateForecast && (
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={onCreateForecast} data-testid="button-create-forecast">
              <Plus className="h-3.5 w-3.5" /> New Forecast
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={exportCsv} disabled={!data} data-testid="matrix-export">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
      </div>

      {forecastPeriodOptions && forecastPeriodOptions.length > 0 && onForecastPeriodChange && (
        <div className="flex flex-wrap items-center gap-1" data-testid="period-selector">
          {forecastPeriodOptions.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onForecastPeriodChange(p.value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                forecastPeriodKey === p.value
                  ? "bg-[#0ea5e9] text-white border-[#0ea5e9]"
                  : "bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              data-testid={`period-${p.value}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2" data-testid="matrix-period-view">
        {PERIOD_VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => setPeriod(v.value)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              period === v.value
                ? "bg-[#0ea5e9] text-white border-[#0ea5e9]"
                : "bg-background border-border text-muted-foreground hover:bg-muted",
            )}
            data-testid={`matrix-view-${v.value}`}
          >
            <Calendar className="h-3.5 w-3.5" />
            {v.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <MatrixFilterSelect
          value={scenario}
          onValueChange={setScenario}
          icon={TrendingUp}
          active={scenario !== "expected"}
          className="w-40"
          testId="matrix-scenario"
        >
          <SelectItem value="best">Best Case</SelectItem>
          <SelectItem value="expected">Weighted (Expected)</SelectItem>
          <SelectItem value="worst">Commit (Worst)</SelectItem>
        </MatrixFilterSelect>
        <MatrixFilterSelect
          value={pipelineId}
          onValueChange={setPipelineId}
          icon={GitBranch}
          active={pipelineId !== "all"}
          className="w-44"
          testId="matrix-pipeline"
        >
          <SelectItem value="all">All Pipelines</SelectItem>
          {pipelines.map((p) => (
            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
          ))}
        </MatrixFilterSelect>
        <MatrixFilterSelect
          value={stageId}
          onValueChange={setStageId}
          icon={Target}
          active={stageId !== "all"}
          className="w-40"
          testId="matrix-stage"
        >
          <SelectItem value="all">All Stages</SelectItem>
          {openStages.map((s) => (
            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
          ))}
        </MatrixFilterSelect>
        <MatrixFilterSelect
          value={ownerUserId}
          onValueChange={setOwnerUserId}
          icon={User}
          active={ownerUserId !== "all"}
          className="w-40"
          testId="matrix-owner"
        >
          <SelectItem value="all">All Owners</SelectItem>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id}>{resolveOwner(u.id).name}</SelectItem>
          ))}
        </MatrixFilterSelect>
        <MatrixFilterSelect
          value={groupBy}
          onValueChange={(v) => setGroupBy(v as MatrixGroupBy)}
          icon={Layers}
          active={groupBy !== "none"}
          className="w-36"
          testId="matrix-group"
        >
          <SelectItem value="none">No grouping</SelectItem>
          <SelectItem value="account">Group: Account</SelectItem>
          <SelectItem value="stage">Group: Stage</SelectItem>
          <SelectItem value="owner">Group: Owner</SelectItem>
        </MatrixFilterSelect>
        <MatrixFilterSelect
          value={monthsAhead}
          onValueChange={setMonthsAhead}
          icon={Filter}
          active={monthsAhead !== "12"}
          className="w-32"
          testId="matrix-months-ahead"
        >
          <SelectItem value="6">6 periods</SelectItem>
          <SelectItem value="12">12 periods</SelectItem>
          <SelectItem value="18">18 periods</SelectItem>
          <SelectItem value="24">24 periods</SelectItem>
        </MatrixFilterSelect>
        <MatrixFilterSelect
          value={sortBy}
          onValueChange={(v) => setSortBy(v as MatrixSort)}
          icon={ArrowUpDown}
          active={sortBy !== "total-desc"}
          className="w-44"
          testId="matrix-sort"
        >
          <SelectItem value="total-desc">Total (high → low)</SelectItem>
          <SelectItem value="total-asc">Total (low → high)</SelectItem>
          <SelectItem value="account">Account (A → Z)</SelectItem>
          <SelectItem value="opportunity">Opportunity (A → Z)</SelectItem>
        </MatrixFilterSelect>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !data || data.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No forecast data for selected filters</p>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-card max-h-[min(70vh,720px)] overflow-auto">
          <table className="w-full text-xs border-collapse min-w-max">
            <thead className="sticky top-0 z-20">
              <tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground border-b border-border/60">
                <th className="text-left px-3 py-2.5 font-semibold sticky left-0 bg-gray-100 dark:bg-muted/80 z-30 min-w-[140px] border-r border-border/40">
                  Account
                </th>
                <th className="text-left px-3 py-2.5 font-semibold sticky left-[140px] bg-gray-100 dark:bg-muted/80 z-30 min-w-[200px] border-r border-border/40">
                  Opportunity
                </th>
                <th className="text-left px-3 py-2.5 font-semibold min-w-[100px]">Stage</th>
                <th className="text-left px-3 py-2.5 font-semibold min-w-[120px]">Notes</th>
                {data.columns.map((col) => (
                  <th key={col} className="text-right px-3 py-2.5 font-semibold min-w-[80px] border-l border-border/30">
                    {col}
                  </th>
                ))}
                <th className="text-right px-3 py-2.5 font-semibold border-l border-border/30">Total</th>
              </tr>
            </thead>
            <tbody>
              {groupBy === "none"
                ? sortedRows.map((row, i) => renderDataRow(row, undefined, i))
                : groupedRows.map((item) => {
                    if (item.type === "group") {
                      return (
                        <tr key={`group-${item.groupKey}`} className="bg-muted/50 border-t font-semibold" data-testid={`matrix-group-${item.groupKey}`}>
                          <td colSpan={4 + data.columns.length + 1} className="px-3 py-2">
                            <span>{item.groupKey}</span>
                            <span className="ml-3 text-[#22c55e] tabular-nums">{formatValue(item.groupTotal)}</span>
                          </td>
                        </tr>
                      );
                    }
                    return renderDataRow(item.row, item.groupColorIndex);
                  })}
              <tr className="border-t bg-gray-50 dark:bg-muted/40 font-bold sticky bottom-0">
                <td className="px-3 py-2 sticky left-0 bg-gray-50 dark:bg-muted/40 z-10 border-r border-border/30" colSpan={4}>
                  Period Totals
                </td>
                {data.totals.map((t, i) => (
                  <td key={i} className="px-3 py-2 text-right tabular-nums border-l border-border/20 font-semibold" style={heatmapCellStyle(t)}>
                    {formatValue(t)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right tabular-nums border-l border-border/20 font-bold" style={heatmapCellStyle(data.totals.reduce((a, b) => a + b, 0))}>
                  {formatValue(data.totals.reduce((a, b) => a + b, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <ForecastOpportunityNotesDialog
        open={notesDialogOpen}
        onOpenChange={setNotesDialogOpen}
        opportunityId={notesTarget?.id ?? null}
        opportunityName={notesTarget?.name ?? ""}
      />

      <OpportunityFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingOpportunity(null); }}
        editing={editingOpportunity}
        stages={formStages}
        accounts={accounts}
        contacts={contacts}
        onNavigateToResourcePlan={(oppId, planId) => {
          setFormOpen(false);
          setEditingOpportunity(null);
          onNavigateToResourcePlan?.(oppId, planId);
        }}
      />
    </div>
  );
}
