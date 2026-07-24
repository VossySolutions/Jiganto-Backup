import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { type ColumnDef as MondayColumnDef } from "@/components/MondayTable";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MondayBoardShell } from "@/components/board";
import { useMondayBoardShellState } from "@/hooks/use-monday-board-shell-state";
import { matchBoardFilterValue } from "@/lib/board-filters";
import { useDebouncedValue, downloadBoardCsv, downloadImportTemplateCsv } from "@/lib/crm-monday-chrome";
import { SEV_BADGE } from "@/lib/tm-utils";
import type { TmHdDefect } from "@/types/testmgmt";
import { useTmFetch } from "@/hooks/use-tm-fetch";
import { TmScreenShell } from "@/components/testmgmt/TmScreenShell";

const DEFECT_STATUSES = ["open", "assigned", "in_progress", "fix_ready", "retesting", "fixed", "wont_fix", "closed"] as const;

export function DefectTriageScreen() {
  const { toast } = useToast();
  const [filterSev, setFilterSev] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [pinRef, setPinRef] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("tm-defects-pin-ref") !== "0";
  });

  const {
    data: defects = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useTmFetch<TmHdDefect[]>(["/api/tm/defects/hd"], "/api/tm/defects/hd");

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/tm/defects/hd/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/defects/hd"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = defects.filter(d => {
    if (filterSev !== "all" && d.severity !== filterSev) return false;
    if (filterStatus !== "all" && d.status !== filterStatus) return false;
    if (debouncedSearch && !d.title.toLowerCase().includes(debouncedSearch.toLowerCase()) && !d.ref.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
    return true;
  });

  const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...filtered].sort((a, b) => {
    const sev = (sevOrder[a.severity ?? "medium"] ?? 9) - (sevOrder[b.severity ?? "medium"] ?? 9);
    if (sev !== 0) return sev;
    return b.daysOpen - a.daysOpen;
  });

  const mondayColumns: MondayColumnDef<TmHdDefect>[] = useMemo(() => [
    {
      id: "ref",
      header: "Ref",
      type: "text",
      accessor: "ref",
      width: "100px",
      sticky: pinRef,
      editable: false,
      render: (d) => <span className="font-mono text-xs">{d.ref}</span>,
    },
    {
      id: "title",
      header: "Title",
      type: "text",
      accessor: "title",
      width: "280px",
      editable: false,
      render: (d) => <span className="text-xs font-medium max-w-[280px] truncate block">{d.title}</span>,
    },
    {
      id: "severity",
      header: "Severity",
      type: "text",
      accessor: "severity",
      width: "110px",
      editable: false,
      render: (d) => (
        <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded uppercase", SEV_BADGE[d.severity ?? "medium"])}>
          {d.severity}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      type: "status",
      accessor: "status",
      width: "150px",
      editable: true,
      options: DEFECT_STATUSES.map((s) => ({ value: s, label: s.replace("_", " ") })),
    },
    {
      id: "daysOpen",
      header: "Days Open",
      type: "number",
      accessor: "daysOpen",
      width: "100px",
      editable: false,
      render: (d) => <span className="font-mono text-xs">{d.daysOpen}</span>,
    },
    {
      id: "linkedTestCaseId",
      header: "Test Case",
      type: "text",
      accessor: "linkedTestCaseId",
      width: "110px",
      editable: false,
      render: (d) => <span className="text-xs text-muted-foreground">{d.linkedTestCaseId ? `#${d.linkedTestCaseId}` : "—"}</span>,
    },
  ], [pinRef]);

  return (
    <TmScreenShell
      loading={isLoading}
      error={isError ? error : null}
      onRetry={() => refetch()}
      label="Loading defect triage..."
    >
      <div className="flex flex-col h-full overflow-hidden">
        <MondayBoardShell.Legacy
          storageKey="jiganto-tm-defect-triage"
          entityType="test_defect"
          stateHook={useMondayBoardShellState}
          filterMatcher={matchBoardFilterValue}
        >
        <MondayBoardShell.Toolbar
          newLabel="Defect"
          searchValue={search}
          onSearchChange={setSearch}
          filterActive={filterSev !== "all" || filterStatus !== "all"}
          filterCount={(filterSev !== "all" ? 1 : 0) + (filterStatus !== "all" ? 1 : 0)}
          filterContent={
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Severity</Label>
                <Select value={filterSev} onValueChange={setFilterSev}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Severities" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    {["critical", "high", "medium", "low"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {DEFECT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          }
          pinActive={pinRef}
          onPinToggle={() => {
            setPinRef((v) => {
              const next = !v;
              localStorage.setItem("tm-defects-pin-ref", next ? "1" : "0");
              return next;
            });
          }}
          pinTitle={pinRef ? "Unpin Ref column" : "Pin Ref column"}
          onExport={() => {
            const headers = ["Ref", "Title", "Severity", "Status", "Days Open", "Test Case"];
            const rows = sorted.map((d) => [
              d.ref || "",
              d.title || "",
              d.severity || "",
              d.status || "",
              String(d.daysOpen ?? ""),
              d.linkedTestCaseId ? `#${d.linkedTestCaseId}` : "",
            ]);
            downloadBoardCsv(`defects-${new Date().toISOString().split("T")[0]}.csv`, headers, rows);
            toast({ title: "Defects exported to CSV" });
          }}
          onDownloadTemplate={() => {
            const headers = ["Ref", "Title", "Severity", "Status", "Days Open", "Test Case"];
            downloadImportTemplateCsv("defects-import-template.csv", headers, headers.map(() => ""));
            toast({ title: "Import template downloaded" });
          }}
          onPaste={() => toast({ title: "Import is not available for this table yet" })}
          onImport={() => toast({ title: "Import is not available for this table yet" })}
          testId="defect-triage-toolbar"
          className="mx-6 mt-3"
        />

        <div className="flex-1 overflow-auto p-4">
          <MondayBoardShell.Table
            columns={mondayColumns}
            data={sorted}
            gridLines
            emptyMessage="No defects match your filters."
            searchHighlightTerm={debouncedSearch}
            columnWidthStorageKey="jiganto-tm-defect-triage-col-widths"
            paginationResetKey={`${filterSev}-${filterStatus}-${debouncedSearch}`}
            onCellEdit={(rowId, columnId, value) => {
              if (columnId !== "status") return;
              updateMutation.mutate({ id: Number(rowId), status: String(value) });
            }}
          />
        </div>
        </MondayBoardShell.Legacy>
      </div>
    </TmScreenShell>
  );
}
