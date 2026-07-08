import { useState, useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ChevronDown, ChevronRight, LayoutGrid, List, GitBranch, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProgrammeListItem } from "./types";
import { formatBudget } from "./rag-utils";
import { PortfolioProgrammeDetail } from "./PortfolioProgrammeDetail";

function RagBadge({ status }: { status: string | null }) {
  const s = (status || "green").toLowerCase();
  const cls = s === "red" ? "bg-red-500/10 text-red-600" : s === "amber" ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600";
  return <Badge variant="outline" className={cn("text-[10px]", cls)}>{status || "green"}</Badge>;
}

export function PortfolioProgrammesTab({ searchTerm = "" }: { searchTerm?: string }) {
  const [, setLocation] = useLocation();
  const [view, setView] = useState<"table" | "card" | "cascade">("table");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filterPortfolio, setFilterPortfolio] = useState("");
  const [filterRag, setFilterRag] = useState("");
  const [selected, setSelected] = useState<{ id: number; source: "program" | "project" } | null>(null);

  const { data: programmes = [], isLoading } = useQuery<ProgrammeListItem[]>({
    queryKey: ["/api/portfolio/programmes"],
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    let rows = programmes;
    if (filterPortfolio) rows = rows.filter((p) => p.portfolioName === filterPortfolio);
    if (filterRag) rows = rows.filter((p) => (p.ragStatus || "").toLowerCase() === filterRag.toLowerCase());
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      rows = rows.filter((p) =>
        p.name.toLowerCase().includes(q)
        || (p.portfolioName ?? "").toLowerCase().includes(q)
        || p.clientNames.some((c) => c.toLowerCase().includes(q)),
      );
    }
    return rows;
  }, [programmes, filterPortfolio, filterRag, searchTerm]);

  const portfolios = useMemo(() => Array.from(new Set(programmes.map((p) => p.portfolioName).filter(Boolean))), [programmes]);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  if (selected) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)}><ArrowLeft className="h-4 w-4 mr-1" /> Back to programmes</Button>
        <PortfolioProgrammeDetail programmeId={selected.id} source={selected.source} />
      </div>
    );
  }

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
          <TabsList>
            <TabsTrigger value="table" className="gap-1"><List className="h-3.5 w-3.5" />Table</TabsTrigger>
            <TabsTrigger value="card" className="gap-1"><LayoutGrid className="h-3.5 w-3.5" />Card</TabsTrigger>
            <TabsTrigger value="cascade" className="gap-1"><GitBranch className="h-3.5 w-3.5" />Cascade</TabsTrigger>
          </TabsList>
        </Tabs>
        <select value={filterPortfolio} onChange={(e) => setFilterPortfolio(e.target.value)} className="text-xs border rounded-lg px-2 py-1.5 bg-background">
          <option value="">All Portfolios</option>
          {portfolios.map((p) => <option key={p} value={p!}>{p}</option>)}
        </select>
        <select value={filterRag} onChange={(e) => setFilterRag(e.target.value)} className="text-xs border rounded-lg px-2 py-1.5 bg-background">
          <option value="">All RAG</option>
          <option value="green">Green</option>
          <option value="amber">Amber</option>
          <option value="red">Red</option>
        </select>
      </div>

      {view === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((prog) => (
            <Card key={`${prog.source}-${prog.id}`} className="border-border/30 cursor-pointer hover:shadow-md" onClick={() => setSelected({ id: prog.id, source: prog.source })}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{prog.name}</CardTitle>
                <div className="flex gap-2 mt-1"><RagBadge status={prog.ragStatus} /><Badge variant="outline" className="text-[10px]">{prog.childCount} projects</Badge></div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                <p>Owner: {prog.ownerName || "—"}</p>
                <p>Clients: {prog.clientNames.join(", ") || "—"}</p>
                <p>Budget: {formatBudget(prog.budget)} · {prog.progress}% complete</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-border/30 overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm text-gray-700 dark:text-foreground min-w-[800px]">
              <thead>
                <tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground border-b border-border/60">
                  <th className="w-8 px-3 py-2.5 text-left align-middle font-semibold" />
                  <th className="px-3 py-2.5 text-left align-middle font-semibold">Programme</th>
                  <th className="px-3 py-2.5 text-left align-middle font-semibold">Owner</th>
                  <th className="px-3 py-2.5 text-left align-middle font-semibold">Client(s)</th>
                  <th className="px-3 py-2.5 text-left align-middle font-semibold">Projects</th>
                  <th className="px-3 py-2.5 text-left align-middle font-semibold">Health</th>
                  <th className="px-3 py-2.5 text-left align-middle font-semibold">Progress</th>
                  <th className="px-3 py-2.5 text-left align-middle font-semibold">Budget</th>
                  <th className="px-3 py-2.5 text-left align-middle font-semibold">End Date</th>
                  <th className="px-3 py-2.5 text-left align-middle font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((prog) => {
                  const key = `${prog.source}-${prog.id}`;
                  const open = expanded.has(key);
                  return (
                    <Fragment key={key}>
                      <tr className="border-b border-border/40 hover:bg-muted/30 cursor-pointer" onClick={() => setSelected({ id: prog.id, source: prog.source })}>
                        <td className="px-3 py-2.5 align-middle" onClick={(e) => { e.stopPropagation(); toggle(key); }}>
                          {prog.childCount > 0 ? (open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}
                        </td>
                        <td className="px-3 py-2.5 align-middle font-semibold">{prog.name}</td>
                        <td className="px-3 py-2.5 align-middle text-xs">{prog.ownerName || "—"}</td>
                        <td className="px-3 py-2.5 align-middle text-xs">{prog.clientNames.join(", ") || "—"}</td>
                        <td className="px-3 py-2.5 align-middle font-mono text-xs">{prog.childCount}</td>
                        <td className="px-3 py-2.5 align-middle"><RagBadge status={prog.ragStatus} /></td>
                        <td className="px-3 py-2.5 align-middle font-mono text-xs">{prog.progress}%</td>
                        <td className="px-3 py-2.5 align-middle font-mono text-xs">{formatBudget(prog.budget)}</td>
                        <td className="px-3 py-2.5 align-middle font-mono text-xs">{prog.endDate || "—"}</td>
                        <td className="px-3 py-2.5 align-middle"><Badge variant="outline" className="text-[10px]">{prog.status}</Badge></td>
                      </tr>
                      {open && prog.children.map((child) => (
                        <tr key={`child-${child.id}`} className="border-b border-border/40 bg-muted/10 hover:bg-muted/30 cursor-pointer" onClick={() => setLocation(`/modules/projects/${child.id}`)}>
                          <td />
                          <td className={cn("px-3 py-2.5 align-middle pl-8 text-muted-foreground", view === "cascade" && "pl-12")}>↳ {child.name}</td>
                          <td className="px-3 py-2.5 align-middle text-xs">{child.managerName || "—"}</td>
                          <td className="px-3 py-2.5 align-middle text-xs">{child.clientName || "—"}</td>
                          <td />
                          <td className="px-3 py-2.5 align-middle"><RagBadge status={child.ragStatus} /></td>
                          <td className="px-3 py-2.5 align-middle font-mono text-xs">{child.progress}%</td>
                          <td className="px-3 py-2.5 align-middle font-mono text-xs">{formatBudget(child.budget)}</td>
                          <td className="px-3 py-2.5 align-middle font-mono text-xs">{child.endDate || "—"}</td>
                          <td className="px-3 py-2.5 align-middle"><Badge variant="outline" className="text-[10px]">{child.status}</Badge></td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
