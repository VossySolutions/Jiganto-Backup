import { useMemo, useState, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { HealthMatrixRow, RagLevel } from "./types";
import { RAG_DOT } from "./rag-utils";
import { PortfolioToolbar, PortfolioMobileCard } from "./PortfolioUi";

const DIMENSIONS: { key: keyof HealthMatrixRow; label: string }[] = [
  { key: "overall", label: "Overall" },
  { key: "schedule", label: "Schedule" },
  { key: "budget", label: "Budget" },
  { key: "quality", label: "Quality" },
  { key: "delivery", label: "Delivery" },
  { key: "risk", label: "Risk" },
  { key: "resources", label: "Resources" },
  { key: "stakeholders", label: "Stakeholders" },
];

type HealthHistoryPoint = {
  week: string;
  healthScore: number;
  overall: string;
};

function RagCell({ level, onClick }: { level: RagLevel; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex justify-center py-2 hover:bg-muted/40 rounded" title={level}>
      <div className={cn("h-3 w-3 rounded-full", RAG_DOT[level])} />
    </button>
  );
}

function HealthTrendSparkline({ projectId }: { projectId: number }) {
  const { data: history = [], isLoading } = useQuery<HealthHistoryPoint[]>({
    queryKey: [`/api/portfolio/health-matrix/history/${projectId}`],
    staleTime: 30_000,
  });

  const points = history.slice(-4);
  const maxScore = Math.max(...points.map((p) => p.healthScore), 100);

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  if (!points.length) {
    return <span className="text-[10px] text-muted-foreground">No historical snapshots yet — capture weekly to see trends</span>;
  }

  return (
    <div className="flex items-end gap-1.5">
      {points.map((p) => (
        <div key={p.week} className="flex flex-col items-center gap-0.5">
          <div
            className={cn("w-7 rounded-t opacity-80", RAG_DOT[(p.overall || "green") as RagLevel])}
            style={{ height: `${Math.max(12, (p.healthScore / maxScore) * 32)}px` }}
            title={`Week of ${p.week}: score ${p.healthScore}`}
          />
          <span className="text-[9px] text-muted-foreground font-mono">{p.week.slice(5)}</span>
        </div>
      ))}
      <span className="text-[10px] text-muted-foreground ml-1">4-week health trend</span>
    </div>
  );
}

export function PortfolioHealthMatrixTab() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [hiddenDims, setHiddenDims] = useState<Set<string>>(new Set());
  const [filterPortfolio, setFilterPortfolio] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [snapshotWeek, setSnapshotWeek] = useState("");

  const { data: snapshotWeeks = [] } = useQuery<string[]>({
    queryKey: ["/api/portfolio/health-matrix/snapshot-weeks"],
    staleTime: 30_000,
  });

  const matrixUrl = snapshotWeek
    ? `/api/portfolio/health-matrix?snapshotWeek=${encodeURIComponent(snapshotWeek)}`
    : "/api/portfolio/health-matrix";

  const { data: rows = [], isLoading, refetch } = useQuery<HealthMatrixRow[]>({
    queryKey: [matrixUrl],
    staleTime: 30_000,
  });

  const portfolios = useMemo(() => Array.from(new Set(rows.flatMap((r) => r.portfolioNames))), [rows]);
  const visibleDims = DIMENSIONS.filter((d) => !hiddenDims.has(d.key));

  const filtered = useMemo(() => {
    if (!filterPortfolio) return rows;
    return rows.filter((r) => r.portfolioNames.includes(filterPortfolio));
  }, [rows, filterPortfolio]);

  const captureSnapshot = async () => {
    try {
      const res = await apiRequest("POST", "/api/portfolio/health-matrix/capture", {});
      const data = (await res.json()) as { saved: number };
      toast({ title: `Snapshot captured — ${data.saved} projects` });
      queryClient.invalidateQueries({ queryKey: ["/api/portfolio/health-matrix/snapshot-weeks"] });
      refetch();
    } catch {
      toast({ title: "Failed to capture snapshot", variant: "destructive" });
    }
  };

  const exportCsv = () => {
    const header = ["Project", "Client", "PM", ...visibleDims.map((d) => d.label)].join(",");
    const body = filtered.map((r) => [
      r.projectName, r.clientName || "", r.managerName || "",
      ...visibleDims.map((d) => r[d.key as keyof HealthMatrixRow]),
    ].join(",")).join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "health-matrix.csv";
    a.click();
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!isLoading && filtered.length === 0) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[420px] text-center gap-3">
        <div className="bg-primary/10 rounded-full p-4">
          <Loader2 className="h-8 w-8 text-primary opacity-40" />
        </div>
        <h2 className="text-lg font-semibold">No projects in health matrix</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          {filterPortfolio
            ? `No projects found for portfolio "${filterPortfolio}". Try clearing the filter.`
            : "Add projects to a portfolio and enable health tracking to see the RAG matrix."}
        </p>
        {filterPortfolio && (
          <Button variant="outline" size="sm" onClick={() => setFilterPortfolio("")}>
            Clear filter
          </Button>
        )}
      </div>
    );
  }

  const toggleExpand = (projectId: number) => {
    setExpanded((p) => {
      const n = new Set(p);
      if (n.has(projectId)) n.delete(projectId); else n.add(projectId);
      return n;
    });
  };

  return (
    <div className="space-y-4">
      <PortfolioToolbar>
        <select value={snapshotWeek} onChange={(e) => setSnapshotWeek(e.target.value)} className="text-xs border rounded-lg px-2 py-1.5 bg-background w-full sm:w-auto">
          <option value="">Live (current week)</option>
          {snapshotWeeks.map((w) => <option key={w} value={w}>Week of {w}</option>)}
        </select>
        <select value={filterPortfolio} onChange={(e) => setFilterPortfolio(e.target.value)} className="text-xs border rounded-lg px-2 py-1.5 bg-background w-full sm:w-auto">
          <option value="">All Portfolios</option>
          {portfolios.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <div className="flex flex-wrap gap-1.5">
          {DIMENSIONS.map((d) => (
            <button key={d.key} onClick={() => setHiddenDims((prev) => {
              const next = new Set(prev);
              if (next.has(d.key)) next.delete(d.key); else next.add(d.key);
              return next;
            })} className={cn("text-xs px-2 py-1 rounded-full border", hiddenDims.has(d.key) ? "opacity-40" : "bg-primary/10 border-primary/30")}>
              {d.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={captureSnapshot}><Camera className="h-3.5 w-3.5 mr-1" /> Snapshot</Button>
          <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={exportCsv}><Download className="h-3.5 w-3.5 mr-1" /> Export</Button>
        </div>
      </PortfolioToolbar>

      <div className="md:hidden space-y-2">
        {filtered.map((row) => (
          <PortfolioMobileCard
            key={row.projectId}
            title={row.projectName}
            subtitle={`${row.clientName || "—"} · ${row.managerName || "—"}`}
            badge={<div className={cn("h-3 w-3 rounded-full", RAG_DOT[row.overall])} />}
            onClick={() => setLocation(`/modules/projects/${row.projectId}`)}
          >
            <div className="grid grid-cols-4 gap-2 pt-1">
              {visibleDims.slice(0, 4).map((d) => (
                <div key={d.key} className="text-center">
                  <p className="text-[9px] text-muted-foreground mb-0.5">{d.label}</p>
                  <div className={cn("h-2.5 w-2.5 rounded-full mx-auto", RAG_DOT[row[d.key as keyof HealthMatrixRow] as RagLevel])} />
                </div>
              ))}
            </div>
            <button type="button" className="text-[10px] text-primary mt-1" onClick={(e) => { e.stopPropagation(); toggleExpand(row.projectId); }}>
              {expanded.has(row.projectId) ? "Hide trend" : "Show 4-week trend"}
            </button>
            {expanded.has(row.projectId) && <HealthTrendSparkline projectId={row.projectId} />}
          </PortfolioMobileCard>
        ))}
      </div>

      <Card className="border-border/30 overflow-hidden hidden md:block">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-bold">
            Health Matrix — Weekly PMO Review
            {snapshotWeek && <span className="text-muted-foreground font-normal ml-2">(historical: {snapshotWeek})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm min-w-[900px] text-gray-700 dark:text-foreground">
            <thead>
              <tr className="border-b border-border/60 bg-gray-100 dark:bg-muted/80 text-xs text-gray-700 dark:text-foreground">
                <th className="p-3 text-left w-8" />
                <th className="p-3 text-left font-semibold">Project</th>
                <th className="p-3 text-left font-semibold">Client</th>
                <th className="p-3 text-left font-semibold">PM</th>
                {visibleDims.map((d) => <th key={d.key} className="p-3 text-center font-semibold">{d.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <Fragment key={row.projectId}>
                  <tr className="border-b border-border/30 hover:bg-muted/20">
                    <td className="p-2 text-center">
                      <button onClick={() => toggleExpand(row.projectId)} className="text-xs text-muted-foreground">▸</button>
                    </td>
                    <td className="p-3 font-medium cursor-pointer" onClick={() => setLocation(`/modules/projects/${row.projectId}`)}>{row.projectName}</td>
                    <td className="p-3 text-xs text-muted-foreground">{row.clientName || "—"}</td>
                    <td className="p-3 text-xs">{row.managerName || "—"}</td>
                    {visibleDims.map((d) => (
                      <td key={d.key} className="p-1">
                        <RagCell
                          level={row[d.key as keyof HealthMatrixRow] as RagLevel}
                          onClick={() => {
                            if (d.key === "budget") setLocation(`/modules/finance-mgmt?tab=budgets&projectId=${row.projectId}`);
                            else setLocation(`/modules/projects/${row.projectId}`);
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                  {expanded.has(row.projectId) && (
                    <tr className="bg-muted/10">
                      <td colSpan={4 + visibleDims.length} className="px-6 py-2">
                        <HealthTrendSparkline projectId={row.projectId} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
