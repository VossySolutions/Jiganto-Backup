import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCrmUsers } from "./CrmUsersProvider";
import { OpportunityFormDialog } from "./OpportunityFormDialog";
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

const GROUP_COLORS = [
  "bg-blue-50/80 dark:bg-blue-950/30",
  "bg-emerald-50/80 dark:bg-emerald-950/30",
  "bg-violet-50/80 dark:bg-violet-950/30",
  "bg-amber-50/80 dark:bg-amber-950/30",
  "bg-cyan-50/80 dark:bg-cyan-950/30",
  "bg-rose-50/80 dark:bg-rose-950/30",
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
  title?: string;
  onOpenOpportunityNotes?: (opportunityId: number, accountId: number | null) => void;
  onNavigateToResourcePlan?: (opportunityId: number, planId?: number | null) => void;
}

type MatrixRow = {
  opportunityId: number;
  name: string;
  accountId: number | null;
  accountName: string;
  stageId: number | null;
  stageName: string;
  ownerUserId: string | null;
  noteCount: number;
  notePreview: string | null;
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

export function ForecastMatrix({
  pipelines,
  stages,
  opportunities,
  accounts,
  contacts,
  forecastPeriodKey,
  forecastPeriodOptions,
  onForecastPeriodChange,
  title = "Pipeline Forecast",
  onOpenOpportunityNotes,
  onNavigateToResourcePlan,
}: ForecastMatrixProps) {
  const { users, resolveOwner } = useCrmUsers();
  const [period, setPeriod] = useState("monthly");
  const [scenario, setScenario] = useState("expected");
  const [pipelineId, setPipelineId] = useState<string>("all");
  const [stageId, setStageId] = useState<string>("all");
  const [ownerUserId, setOwnerUserId] = useState<string>("all");
  const [monthsAhead, setMonthsAhead] = useState<string>("12");
  const [sortBy, setSortBy] = useState<MatrixSort>("total-desc");
  const [groupBy, setGroupBy] = useState<MatrixGroupBy>("none");
  const [formOpen, setFormOpen] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<CrmForecastOpportunity | null>(null);

  const queryKey = `/api/crm/forecast-matrix?period=${period}&scenario=${scenario}${pipelineId !== "all" ? `&pipelineId=${pipelineId}` : ""}${stageId !== "all" ? `&stageId=${stageId}` : ""}${ownerUserId !== "all" ? `&ownerUserId=${ownerUserId}` : ""}&monthsAhead=${monthsAhead}${forecastPeriodKey ? `&forecastPeriod=${forecastPeriodKey}` : ""}`;
  const { data, isLoading } = useQuery<MatrixData>({ queryKey: [queryKey] });

  const openStages = useMemo(() => stages.filter((s) => !s.isClosed).sort((a, b) => a.order - b.order), [stages]);

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
    if (onOpenOpportunityNotes) {
      onOpenOpportunityNotes(row.opportunityId, row.accountId);
      return;
    }
    const opp = opportunities.find((o) => o.id === row.opportunityId) ?? null;
    setEditingOpportunity(opp);
    setFormOpen(true);
  };

  const exportCsv = () => {
    if (!data) return;
    const headers = ["Account", "Opportunity", "Stage", "Notes", ...data.columns, "Row Total"];
    const rows = data.rows.map((r) => [
      r.accountName,
      r.name,
      r.stageName,
      r.notePreview || "",
      ...r.cells.map((c) => String(Math.round(c))),
      String(Math.round(rowTotal(r))),
    ]);
    const footer = ["TOTAL", "", "", "", ...data.totals.map((t) => String(Math.round(t))), String(Math.round(data.totals.reduce((a, b) => a + b, 0)))];
    const csv = [headers, ...rows, footer].map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-forecast-${period}-${scenario}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderDataRow = (row: MatrixRow, groupColorIndex?: number) => {
    const total = rowTotal(row);
    const rowBg = groupColorIndex != null ? GROUP_COLORS[groupColorIndex] : "bg-card";
    return (
      <tr
        key={row.opportunityId}
        className={cn("border-t hover:bg-muted/20", rowBg)}
      >
        <td className={cn("px-3 py-2 text-muted-foreground sticky left-0 z-10", rowBg)}>{row.accountName}</td>
        <td className={cn("px-3 py-2 font-medium sticky left-[140px] z-10", rowBg)}>
          <button
            type="button"
            onClick={() => openOpportunity(row.opportunityId)}
            className="text-left text-primary hover:underline underline-offset-2"
            data-testid={`matrix-opp-link-${row.opportunityId}`}
          >
            {row.name}
          </button>
        </td>
        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{row.stageName}</td>
        <td className="px-3 py-2 max-w-[140px]">
          <button
            type="button"
            onClick={() => openNotes(row)}
            className="text-left text-[#0ea5e9] hover:underline text-xs flex items-start gap-1"
            data-testid={`matrix-note-link-${row.opportunityId}`}
          >
            <StickyNote className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="line-clamp-2">
              {row.noteCount > 0
                ? (row.notePreview || `${row.noteCount} note(s)`)
                : "Add note"}
            </span>
          </button>
        </td>
        {row.cells.map((cell, i) => (
          <td key={i} className={cn("px-3 py-2 text-right tabular-nums", cell > 0 && "font-medium")}>
            {formatValue(cell)}
          </td>
        ))}
        <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatValue(total)}</td>
      </tr>
    );
  };

  return (
    <div className="space-y-3" data-testid="forecast-matrix">
      <h3 className="text-base font-semibold">{title}</h3>
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
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              data-testid={`period-${p.value}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-36 h-8 text-xs" data-testid="matrix-period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="quarterly">Quarterly</SelectItem>
            <SelectItem value="half-year">Half-Year</SelectItem>
            <SelectItem value="annual">Annual</SelectItem>
          </SelectContent>
        </Select>
        <Select value={scenario} onValueChange={setScenario}>
          <SelectTrigger className="w-36 h-8 text-xs" data-testid="matrix-scenario">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="best">Best Case</SelectItem>
            <SelectItem value="expected">Weighted (Expected)</SelectItem>
            <SelectItem value="worst">Commit (Worst)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={pipelineId} onValueChange={setPipelineId}>
          <SelectTrigger className="w-44 h-8 text-xs" data-testid="matrix-pipeline">
            <SelectValue placeholder="All Pipelines" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Pipelines</SelectItem>
            {pipelines.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stageId} onValueChange={setStageId}>
          <SelectTrigger className="w-40 h-8 text-xs" data-testid="matrix-stage">
            <SelectValue placeholder="All Stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {openStages.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ownerUserId} onValueChange={setOwnerUserId}>
          <SelectTrigger className="w-40 h-8 text-xs" data-testid="matrix-owner">
            <SelectValue placeholder="All Owners" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Owners</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>{resolveOwner(u.id).name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as MatrixGroupBy)}>
          <SelectTrigger className="w-36 h-8 text-xs" data-testid="matrix-group">
            <SelectValue placeholder="Group by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No grouping</SelectItem>
            <SelectItem value="account">Group: Account</SelectItem>
            <SelectItem value="stage">Group: Stage</SelectItem>
            <SelectItem value="owner">Group: Owner</SelectItem>
          </SelectContent>
        </Select>
        <Select value={monthsAhead} onValueChange={setMonthsAhead}>
          <SelectTrigger className="w-32 h-8 text-xs" data-testid="matrix-months-ahead">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="6">6 periods</SelectItem>
            <SelectItem value="12">12 periods</SelectItem>
            <SelectItem value="18">18 periods</SelectItem>
            <SelectItem value="24">24 periods</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as MatrixSort)}>
          <SelectTrigger className="w-44 h-8 text-xs" data-testid="matrix-sort">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="total-desc">Total (high → low)</SelectItem>
            <SelectItem value="total-asc">Total (low → high)</SelectItem>
            <SelectItem value="account">Account (A → Z)</SelectItem>
            <SelectItem value="opportunity">Opportunity (A → Z)</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={exportCsv} disabled={!data} data-testid="matrix-export">
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !data || data.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No forecast data for selected filters</p>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-card max-h-[min(70vh,720px)] overflow-auto">
          <table className="w-full text-xs border-collapse min-w-max">
            <thead className="sticky top-0 z-20 shadow-sm">
              <tr className="bg-muted/90 backdrop-blur-sm">
                <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-muted/95 z-30 min-w-[140px]">Account</th>
                <th className="text-left px-3 py-2 font-semibold sticky left-[140px] bg-muted/95 z-30 min-w-[180px]">Opportunity</th>
                <th className="text-left px-3 py-2 font-semibold min-w-[100px]">Stage</th>
                <th className="text-left px-3 py-2 font-semibold min-w-[120px]">Notes</th>
                {data.columns.map((col) => (
                  <th key={col} className="text-right px-3 py-2 font-semibold min-w-[80px]">{col}</th>
                ))}
                <th className="text-right px-3 py-2 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {groupBy === "none"
                ? sortedRows.map((row) => renderDataRow(row))
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
              <tr className="border-t bg-muted/30 font-bold sticky bottom-0">
                <td className="px-3 py-2 sticky left-0 bg-muted/30 z-10" colSpan={4}>Period Totals</td>
                {data.totals.map((t, i) => (
                  <td key={i} className="px-3 py-2 text-right text-[#22c55e] tabular-nums">{formatValue(t)}</td>
                ))}
                <td className="px-3 py-2 text-right text-[#22c55e] tabular-nums">
                  {formatValue(data.totals.reduce((a, b) => a + b, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

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
