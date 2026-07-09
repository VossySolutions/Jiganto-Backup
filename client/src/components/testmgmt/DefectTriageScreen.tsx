import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Filter } from "lucide-react";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { TablePagination } from "@/components/TablePagination";
import { SEV_BADGE } from "@/lib/tm-utils";
import type { TmHdDefect } from "@/types/testmgmt";
import { useTmFetch } from "@/hooks/use-tm-fetch";
import { TmScreenShell } from "@/components/testmgmt/TmScreenShell";

export function DefectTriageScreen() {
  const { toast } = useToast();
  const [filterSev, setFilterSev] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

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
    if (search && !d.title.toLowerCase().includes(search.toLowerCase()) && !d.ref.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...filtered].sort((a, b) => {
    const sev = (sevOrder[a.severity ?? "medium"] ?? 9) - (sevOrder[b.severity ?? "medium"] ?? 9);
    if (sev !== 0) return sev;
    return b.daysOpen - a.daysOpen;
  });

  const pagination = useTablePagination(sorted, { resetKey: `${filterSev}-${filterStatus}-${search}` });

  return (
    <TmScreenShell
      loading={isLoading}
      error={isError ? error : null}
      onRetry={() => refetch()}
      label="Loading defect triage..."
    >
      <div className="flex flex-col h-full overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <input className="border rounded px-2.5 py-1 text-xs bg-background w-48" placeholder="Search defects..."
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="border rounded px-2 py-1 text-xs bg-background" value={filterSev} onChange={e => setFilterSev(e.target.value)}>
            <option value="all">All Severities</option>
            {["critical", "high", "medium", "low"].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="border rounded px-2 py-1 text-xs bg-background" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="all">All Statuses</option>
            {["open", "assigned", "in_progress", "fix_ready", "retesting", "fixed", "wont_fix", "closed"].map(s =>
              <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <span className="text-xs text-muted-foreground">{sorted.length} defects · sorted by severity, then days open</span>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-gray-700 dark:text-foreground">
            <thead className="sticky top-0 bg-gray-100 dark:bg-muted/80">
              <tr className="bg-gray-100 dark:bg-muted/80 text-gray-700 dark:text-foreground border-b border-border/60">
                <th className="px-3 py-2.5 text-left align-middle font-semibold">Ref</th>
                <th className="px-3 py-2.5 text-left align-middle font-semibold">Title</th>
                <th className="px-3 py-2.5 text-left align-middle font-semibold">Severity</th>
                <th className="px-3 py-2.5 text-left align-middle font-semibold">Status</th>
                <th className="px-3 py-2.5 text-left align-middle font-semibold">Days Open</th>
                <th className="px-3 py-2.5 text-left align-middle font-semibold">Test Case</th>
              </tr>
            </thead>
            <tbody>
              {pagination.paginatedItems.map(d => (
                <tr key={d.id} className="border-b border-border/40 hover:bg-muted/30">
                  <td className="px-3 py-2.5 align-middle font-mono text-xs">{d.ref}</td>
                  <td className="px-3 py-2.5 align-middle text-xs font-medium max-w-[280px] truncate">{d.title}</td>
                  <td className="px-3 py-2.5 align-middle">
                    <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded uppercase", SEV_BADGE[d.severity ?? "medium"])}>{d.severity}</span>
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <select className="text-xs border rounded px-1 py-0.5 bg-background capitalize"
                      value={d.status} onChange={e => updateMutation.mutate({ id: d.id, status: e.target.value })}>
                      {["open", "assigned", "in_progress", "fix_ready", "retesting", "fixed", "wont_fix", "closed"].map(s =>
                        <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2.5 align-middle font-mono text-xs">{d.daysOpen}</td>
                  <td className="px-3 py-2.5 align-middle text-xs text-muted-foreground">{d.linkedTestCaseId ? `#${d.linkedTestCaseId}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination
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
    </TmScreenShell>
  );
}
