import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Resource / Capacity Report — who's allocated to this project and how much
 * headroom is left. Reads the same `/api/resources/allocations` data
 * `PmResourceTrackerTool` uses (real allocation %, role), so no new storage.
 *
 * Two things the design shows that this deliberately does NOT fabricate:
 * - Cross-project over-allocation (e.g. "112%" combining every project a
 *   person is on) — this project's allocations only tell you this project's
 *   share; true cross-project totals are a Resources-module concern, same
 *   `crossModule: "Resource Planning"` boundary as the tracker tool.
 * - An org "reports to" hierarchy — `projectReportsToId` exists on the
 *   allocation record but isn't populated in practice, so the Hierarchy view
 *   groups by role instead of inventing a reporting tree from data that
 *   isn't there.
 */

interface Allocation {
  id: number;
  resourceId: number;
  resourceName?: string;
  role: string | null;
  allocationPercentage: string | number | null;
  status: string | null;
}

interface ToolProps {
  projectId: number;
}

function statusFor(pct: number): { label: string; cls: string } {
  if (pct > 100) return { label: "Over", cls: "bg-red-50 text-red-700" };
  if (pct < 60) return { label: "Under", cls: "bg-muted text-muted-foreground" };
  return { label: "Healthy", cls: "bg-emerald-50 text-emerald-700" };
}

export function PmResourceCapacityReportTool({ projectId }: ToolProps) {
  const [view, setView] = useState<"table" | "hierarchy">("table");
  const { data: allocations = [], isLoading } = useQuery<Allocation[]>({
    queryKey: [`/api/resources/allocations?projectId=${projectId}`],
  });

  const rows = useMemo(
    () =>
      allocations
        .filter((a) => (a.status || "active") !== "ended")
        .map((a) => ({ ...a, pct: Number(a.allocationPercentage) || 0 })),
    [allocations],
  );

  const kpis = useMemo(() => {
    const over = rows.filter((r) => r.pct > 100).length;
    const under = rows.filter((r) => r.pct < 60).length;
    const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.pct, 0) / rows.length) : 0;
    return { avg, over, under, total: rows.length };
  }, [rows]);

  const byRole = useMemo(() => {
    const groups = new Map<string, typeof rows>();
    rows.forEach((r) => {
      const key = r.role || "Unassigned role";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    });
    return Array.from(groups.entries());
  }, [rows]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "People allocated", value: kpis.total },
          { label: "Avg. allocation", value: `${kpis.avg}%` },
          { label: "Over-allocated", value: kpis.over, warn: kpis.over > 0 },
          { label: "Under-utilised (<60%)", value: kpis.under },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase">{k.label}</div>
              <div className={cn("text-2xl font-bold mt-1", k.warn && "text-red-600")}>{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
          <Button size="sm" variant={view === "table" ? "secondary" : "ghost"} className="h-7 text-xs" onClick={() => setView("table")}>Table</Button>
          <Button size="sm" variant={view === "hierarchy" ? "secondary" : "ghost"} className="h-7 text-xs" onClick={() => setView("hierarchy")}>By role</Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card><CardContent className="text-center text-muted-foreground py-12 text-sm">No resources allocated to this project yet.</CardContent></Card>
      ) : view === "table" ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Person</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Allocated (this project)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const s = statusFor(r.pct);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.resourceName || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.role || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-28 h-2.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full", r.pct > 100 ? "bg-red-500" : r.pct < 60 ? "bg-muted-foreground/40" : "bg-emerald-500")}
                              style={{ width: `${Math.min(100, r.pct)}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono">{r.pct}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", s.cls)}>{s.label}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Grouped by role — this project doesn't have a reporting hierarchy configured, so allocations
              are shown by role rather than an invented org tree.
            </p>
            {byRole.map(([role, members]) => (
              <div key={role}>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{role}</div>
                <div className="space-y-1.5 pl-3 border-l-2">
                  {members.map((m) => {
                    const s = statusFor(m.pct);
                    return (
                      <div key={m.id} className="flex items-center gap-2 text-sm">
                        <span className="flex-1">{m.resourceName}</span>
                        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", s.cls)}>{m.pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PmResourceCapacityReportTool;
