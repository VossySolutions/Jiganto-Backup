import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown, ChevronRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { type ColumnDef as MondayColumnDef } from "@/components/MondayTable";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MondayBoardShell } from "@/components/board";
import { useMondayBoardShellState } from "@/hooks/use-monday-board-shell-state";
import { matchBoardFilterValue } from "@/lib/board-filters";
import { useDebouncedValue, downloadBoardCsv, downloadImportTemplateCsv } from "@/lib/crm-monday-chrome";
import { useToast } from "@/hooks/use-toast";
import type { ProgrammeListItem, PortfolioProjectRow } from "./types";
import { formatBudget } from "./rag-utils";
import { PortfolioProgrammeDetail } from "./PortfolioProgrammeDetail";

function RagBadge({ status }: { status: string | null }) {
  const s = (status || "green").toLowerCase();
  const cls = s === "red" ? "bg-red-500/10 text-red-600" : s === "amber" ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600";
  return <Badge variant="outline" className={cn("text-[10px]", cls)}>{status || "green"}</Badge>;
}

type ProgrammeTableRow = {
  id: string;
  rowType: "programme" | "child";
  programme: ProgrammeListItem;
  child?: PortfolioProjectRow;
};

export function PortfolioProgrammesTab({ searchTerm = "" }: { searchTerm?: string }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [localSearch, setLocalSearch] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm || localSearch);
  const [view, setView] = useState<"table" | "card" | "cascade">("table");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filterPortfolio, setFilterPortfolio] = useState("");
  const [filterRag, setFilterRag] = useState("");
  const [selected, setSelected] = useState<{ id: number; source: "program" | "project" } | null>(null);
  const [pinName, setPinName] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("portfolio-programmes-pin-name") !== "0";
  });

  const { data: programmes = [], isLoading } = useQuery<ProgrammeListItem[]>({
    queryKey: ["/api/portfolio/programmes"],
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    let rows = programmes;
    if (filterPortfolio) rows = rows.filter((p) => p.portfolioName === filterPortfolio);
    if (filterRag) rows = rows.filter((p) => (p.ragStatus || "").toLowerCase() === filterRag.toLowerCase());
    const q = debouncedSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter((p) =>
        p.name.toLowerCase().includes(q)
        || (p.portfolioName ?? "").toLowerCase().includes(q)
        || p.clientNames.some((c) => c.toLowerCase().includes(q)),
      );
    }
    return rows;
  }, [programmes, filterPortfolio, filterRag, debouncedSearch]);

  const portfolios = useMemo(() => Array.from(new Set(programmes.map((p) => p.portfolioName).filter(Boolean))), [programmes]);

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const tableRows = useMemo(() => {
    const rows: ProgrammeTableRow[] = [];
    for (const prog of filtered) {
      const key = `${prog.source}-${prog.id}`;
      rows.push({ id: key, rowType: "programme", programme: prog });
      if (expanded.has(key)) {
        for (const child of prog.children) {
          rows.push({
            id: `child-${child.id}-${key}`,
            rowType: "child",
            programme: prog,
            child,
          });
        }
      }
    }
    return rows;
  }, [filtered, expanded]);

  const mondayColumns: MondayColumnDef<ProgrammeTableRow>[] = useMemo(() => [
    {
      id: "expand",
      header: "",
      type: "text",
      accessor: "id",
      width: "40px",
      editable: false, // no write API for programmes board
      render: (row) => {
        if (row.rowType !== "programme") return null;
        const key = `${row.programme.source}-${row.programme.id}`;
        const open = expanded.has(key);
        if (row.programme.childCount <= 0) return null;
        return (
          <button
            type="button"
            className="inline-flex items-center justify-center"
            onClick={(e) => { e.stopPropagation(); toggle(key); }}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        );
      },
    },
    {
      id: "name",
      header: "Programme",
      type: "text",
      accessor: (row) => row.rowType === "programme" ? row.programme.name : row.child?.name,
      width: "240px",
      sticky: pinName,
      editable: false, // no write API for programmes board
      render: (row) => {
        if (row.rowType === "child" && row.child) {
          return (
            <span className={cn("text-sm text-muted-foreground", view === "cascade" ? "pl-8" : "pl-4")}>
              ↳ {row.child.name}
            </span>
          );
        }
        return <span className="font-semibold text-sm">{row.programme.name}</span>;
      },
    },
    {
      id: "owner",
      header: "Owner",
      type: "person",
      accessor: (row) => row.rowType === "programme" ? row.programme.ownerName : row.child?.managerName,
      width: "140px",
      editable: false,
      render: (row) => (
        <span className="text-xs">
          {row.rowType === "programme" ? (row.programme.ownerName || "—") : (row.child?.managerName || "—")}
        </span>
      ),
    },
    {
      id: "clients",
      header: "Client(s)",
      type: "text",
      accessor: (row) => row.rowType === "programme" ? row.programme.clientNames.join(", ") : row.child?.clientName,
      width: "180px",
      editable: false,
      render: (row) => (
        <span className="text-xs">
          {row.rowType === "programme"
            ? (row.programme.clientNames.join(", ") || "—")
            : (row.child?.clientName || "—")}
        </span>
      ),
    },
    {
      id: "projects",
      header: "Projects",
      type: "number",
      accessor: (row) => row.rowType === "programme" ? row.programme.childCount : null,
      width: "90px",
      editable: false,
      render: (row) => (
        row.rowType === "programme"
          ? <span className="font-mono text-xs">{row.programme.childCount}</span>
          : null
      ),
    },
    {
      id: "health",
      header: "Health",
      type: "rag",
      accessor: (row) => row.rowType === "programme" ? row.programme.ragStatus : row.child?.ragStatus,
      width: "100px",
      editable: false,
      render: (row) => (
        <RagBadge status={row.rowType === "programme" ? row.programme.ragStatus : (row.child?.ragStatus ?? null)} />
      ),
    },
    {
      id: "progress",
      header: "Progress",
      type: "progress",
      accessor: (row) => row.rowType === "programme" ? row.programme.progress : row.child?.progress,
      width: "100px",
      editable: false,
      render: (row) => (
        <span className="font-mono text-xs">
          {row.rowType === "programme" ? `${row.programme.progress}%` : `${row.child?.progress ?? 0}%`}
        </span>
      ),
    },
    {
      id: "budget",
      header: "Budget",
      type: "currency",
      accessor: (row) => row.rowType === "programme" ? row.programme.budget : row.child?.budget,
      width: "120px",
      editable: false,
      render: (row) => (
        <span className="font-mono text-xs">
          {formatBudget(row.rowType === "programme" ? row.programme.budget : (row.child?.budget ?? 0))}
        </span>
      ),
    },
    {
      id: "endDate",
      header: "End Date",
      type: "date",
      accessor: (row) => row.rowType === "programme" ? row.programme.endDate : row.child?.endDate,
      width: "110px",
      editable: false,
      render: (row) => (
        <span className="font-mono text-xs">
          {(row.rowType === "programme" ? row.programme.endDate : row.child?.endDate) || "—"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      type: "status",
      accessor: (row) => row.rowType === "programme" ? row.programme.status : row.child?.status,
      width: "110px",
      editable: false,
      render: (row) => (
        <Badge variant="outline" className="text-[10px]">
          {row.rowType === "programme" ? row.programme.status : row.child?.status}
        </Badge>
      ),
    },
  ], [expanded, toggle, view, pinName]);

  const handleRowClick = useCallback((row: ProgrammeTableRow) => {
    if (row.rowType === "child" && row.child) {
      setLocation(`/modules/projects/${row.child.id}`);
      return;
    }
    setSelected({ id: row.programme.id, source: row.programme.source });
  }, [setLocation]);

  const paginationResetKey = `${debouncedSearch}|${filterPortfolio}|${filterRag}|${view}|${Array.from(expanded).join(",")}`;

  const PROGRAMME_CSV_HEADERS = ["Programme", "Owner", "Client(s)", "Projects", "Health", "Progress", "Budget", "End Date", "Status"];

  const exportProgrammes = () => {
    const rows = filtered.map((p) => [
      p.name || "",
      p.ownerName || "",
      p.clientNames.join(", "),
      String(p.childCount ?? 0),
      p.ragStatus || "",
      `${p.progress ?? 0}%`,
      String(p.budget ?? ""),
      p.endDate || "",
      p.status || "",
    ]);
    downloadBoardCsv(`programmes-${new Date().toISOString().split("T")[0]}.csv`, PROGRAMME_CSV_HEADERS, rows);
    toast({ title: "Programmes exported to CSV" });
  };

  const downloadProgrammesTemplate = () => {
    downloadImportTemplateCsv("programmes-import-template.csv", PROGRAMME_CSV_HEADERS, PROGRAMME_CSV_HEADERS.map(() => ""));
    toast({ title: "Import template downloaded" });
  };

  const importUnavailable = () => toast({ title: "Import is not available for this table yet" });

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
      <MondayBoardShell.Legacy
        storageKey="jiganto-portfolio-programmes"
        entityType="portfolio_programme"
        stateHook={useMondayBoardShellState}
        filterMatcher={matchBoardFilterValue}
      >
      <MondayBoardShell.Toolbar
        newLabel="Programme"
        searchValue={localSearch || searchTerm}
        onSearchChange={setLocalSearch}
        viewLabel={view === "table" ? "Table" : view === "card" ? "Card" : "Cascade"}
        viewMenu={
          <>
            <DropdownMenuItem onClick={() => setView("table")}>Table</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView("card")}>Card</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setView("cascade")}>Cascade</DropdownMenuItem>
          </>
        }
        filterActive={!!filterPortfolio || !!filterRag}
        filterCount={(filterPortfolio ? 1 : 0) + (filterRag ? 1 : 0)}
        filterContent={
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Portfolio</Label>
              <Select value={filterPortfolio || "all"} onValueChange={(v) => setFilterPortfolio(v === "all" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Portfolios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Portfolios</SelectItem>
                  {portfolios.map((p) => (
                    <SelectItem key={p} value={p!}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">RAG</Label>
              <Select value={filterRag || "all"} onValueChange={(v) => setFilterRag(v === "all" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All RAG" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All RAG</SelectItem>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="amber">Amber</SelectItem>
                  <SelectItem value="red">Red</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        }
        grouped={view === "cascade"}
        pinActive={pinName}
        onPinToggle={() => {
          setPinName((v) => {
            const next = !v;
            localStorage.setItem("portfolio-programmes-pin-name", next ? "1" : "0");
            return next;
          });
        }}
        pinTitle={pinName ? "Unpin Programme column" : "Pin Programme column"}
        onExport={exportProgrammes}
        onDownloadTemplate={downloadProgrammesTemplate}
        onPaste={importUnavailable}
        onImport={importUnavailable}
        testId="portfolio-programmes-toolbar"
      />

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
        <MondayBoardShell.Table
          columns={mondayColumns}
          data={tableRows}
          emptyMessage="No programmes match your filters."
          onRowClick={handleRowClick}
          searchHighlightTerm={debouncedSearch}
          columnWidthStorageKey="jiganto-portfolio-programmes-col-widths"
          paginationResetKey={paginationResetKey}
          totalCount={programmes.length}
        />
      )}
      </MondayBoardShell.Legacy>
    </div>
  );
}
