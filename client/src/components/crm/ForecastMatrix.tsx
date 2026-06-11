import { useState } from "react";
import { useCrmPagination } from "@/hooks/use-crm-pagination";
import { CrmTablePagination } from "./CrmTablePagination";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCrmUsers } from "./CrmUsersProvider";

type CrmPipeline = { id: number; name: string; isDefault: boolean | null };

interface ForecastMatrixProps {
  pipelines: CrmPipeline[];
}

type MatrixData = {
  period: string;
  scenario: string;
  columns: string[];
  rows: Array<{ opportunityId: number; name: string; accountName: string; cells: number[] }>;
  totals: number[];
};

function formatValue(v: number): string {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${Math.round(v / 1000)}K`;
  return v > 0 ? `$${Math.round(v)}` : "—";
}

export function ForecastMatrix({ pipelines }: ForecastMatrixProps) {
  const { users, resolveOwner } = useCrmUsers();
  const [period, setPeriod] = useState("monthly");
  const [scenario, setScenario] = useState("expected");
  const [pipelineId, setPipelineId] = useState<string>("all");
  const [ownerUserId, setOwnerUserId] = useState<string>("all");
  const [monthsAhead, setMonthsAhead] = useState<string>("12");

  const queryKey = `/api/crm/forecast-matrix?period=${period}&scenario=${scenario}${pipelineId !== "all" ? `&pipelineId=${pipelineId}` : ""}${ownerUserId !== "all" ? `&ownerUserId=${ownerUserId}` : ""}&monthsAhead=${monthsAhead}`;
  const { data, isLoading } = useQuery<MatrixData>({ queryKey: [queryKey] });

  const matrixRows = data?.rows ?? [];
  const pagination = useCrmPagination(matrixRows, {
    resetKey: `${period}|${scenario}|${pipelineId}|${ownerUserId}|${monthsAhead}|${matrixRows.length}`,
  });

  const exportCsv = () => {
    if (!data) return;
    const headers = ["Opportunity", "Account", ...data.columns, "Row Total"];
    const rows = data.rows.map(r => [
      r.name,
      r.accountName,
      ...r.cells.map(c => String(Math.round(c))),
      String(Math.round(r.cells.reduce((a, b) => a + b, 0))),
    ]);
    const footer = ["TOTAL", "", ...data.totals.map(t => String(Math.round(t))), String(Math.round(data.totals.reduce((a, b) => a + b, 0)))];
    const csv = [headers, ...rows, footer].map(row => row.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forecast-matrix-${period}-${scenario}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4" data-testid="forecast-matrix">
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
            {pipelines.map(p => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
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
            {users.map(u => (
              <SelectItem key={u.id} value={u.id}>{resolveOwner(u.id).name}</SelectItem>
            ))}
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
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={exportCsv} disabled={!data} data-testid="matrix-export">
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !data || data.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No forecast data for selected filters</p>
      ) : (
        <div className="border rounded-xl overflow-x-auto bg-card">
          <table className="w-full text-xs border-collapse min-w-max">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-3 py-2 font-semibold sticky left-0 bg-muted/80 z-10 min-w-[180px]">Opportunity</th>
                <th className="text-left px-3 py-2 font-semibold min-w-[120px]">Account</th>
                {data.columns.map(col => (
                  <th key={col} className="text-right px-3 py-2 font-semibold min-w-[80px]">{col}</th>
                ))}
                <th className="text-right px-3 py-2 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedItems.map(row => {
                const rowTotal = row.cells.reduce((a, b) => a + b, 0);
                return (
                  <tr key={row.opportunityId} className="border-t hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium sticky left-0 bg-card z-10">{row.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.accountName}</td>
                    {row.cells.map((cell, i) => (
                      <td key={i} className={cn("px-3 py-2 text-right tabular-nums", cell > 0 && "font-medium")}>
                        {formatValue(cell)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatValue(rowTotal)}</td>
                  </tr>
                );
              })}
              <tr className="border-t bg-muted/30 font-bold">
                <td className="px-3 py-2 sticky left-0 bg-muted/30 z-10" colSpan={2}>Period Totals</td>
                {data.totals.map((t, i) => (
                  <td key={i} className="px-3 py-2 text-right text-[#22c55e] tabular-nums">{formatValue(t)}</td>
                ))}
                <td className="px-3 py-2 text-right text-[#22c55e] tabular-nums">
                  {formatValue(data.totals.reduce((a, b) => a + b, 0))}
                </td>
              </tr>
            </tbody>
          </table>
          <CrmTablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            startIndex={pagination.startIndex}
            endIndex={pagination.endIndex}
            pageSize={pagination.pageSize}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </div>
      )}
    </div>
  );
}
