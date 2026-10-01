import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PmTask } from "@shared/models/projects";

/**
 * Milestone Status Report — read-only rollup of the milestones already in the
 * Gantt/Milestone Plan data, per the design's own framing ("read-only rollup
 * of the Gantt/Milestone Plan data — grouped however the audience needs it").
 * Table + Gantt-diamond toggle, same source as the detailed Gantt so it can
 * never drift out of sync. No "forecast date" column — the task model only
 * has planned + actual dates, no separate forecast field, so this shows
 * what's actually there rather than inventing a forecast.
 */

interface ToolProps {
  projectId: number;
}

function ragColor(rag: string | null | undefined) {
  const r = (rag || "green").toLowerCase();
  if (r === "red") return "#A03E52";
  if (r === "amber" || r === "yellow") return "#B4560F";
  return "#0E6E5C";
}

function ragPillClass(rag: string | null | undefined) {
  const r = (rag || "green").toLowerCase();
  if (r === "red") return "bg-red-50 text-red-700";
  if (r === "amber" || r === "yellow") return "bg-amber-50 text-amber-700";
  return "bg-emerald-50 text-emerald-700";
}

export function PmMilestoneStatusReportTool({ projectId }: ToolProps) {
  const [view, setView] = useState<"table" | "gantt">("table");
  const { data: tasks = [], isLoading } = useQuery<PmTask[]>({
    queryKey: ["/api/pm/projects", projectId, "tasks"],
  });

  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const milestones = useMemo(
    () =>
      tasks
        .filter((t) => (t.ganttType || "") === "milestone")
        .sort((a, b) => (a.plannedStartDate || "").localeCompare(b.plannedStartDate || "")),
    [tasks],
  );

  const range = useMemo(() => {
    const dates = milestones
      .map((m) => m.plannedStartDate)
      .filter(Boolean) as string[];
    if (dates.length === 0) return null;
    const min = dates.reduce((a, b) => (a < b ? a : b));
    const max = dates.reduce((a, b) => (a > b ? a : b));
    const minT = new Date(min).getTime();
    const maxT = new Date(max).getTime();
    return { minT, maxT: maxT > minT ? maxT : minT + 86400000 };
  }, [milestones]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
          <Button
            size="sm"
            variant={view === "table" ? "secondary" : "ghost"}
            className="h-7 text-xs"
            onClick={() => setView("table")}
          >
            Table
          </Button>
          <Button
            size="sm"
            variant={view === "gantt" ? "secondary" : "ghost"}
            className="h-7 text-xs"
            onClick={() => setView("gantt")}
          >
            Gantt
          </Button>
        </div>
      </div>

      {milestones.length === 0 ? (
        <Card><CardContent className="text-center text-muted-foreground py-12 text-sm">No milestones set for this project.</CardContent></Card>
      ) : view === "table" ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Milestone</TableHead>
                  <TableHead>Planned date</TableHead>
                  <TableHead>Completed date</TableHead>
                  <TableHead>Variance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {milestones.map((m) => {
                  const parent = m.parentTaskId ? byId.get(m.parentTaskId) : null;
                  const planned = m.plannedStartDate ? new Date(m.plannedStartDate) : null;
                  const done = (m.status || "") === "done" || (m.status || "") === "completed";
                  const actual = done && m.actualEndDate ? new Date(m.actualEndDate) : null;
                  const varianceDays = planned && actual ? Math.round((actual.getTime() - planned.getTime()) / 86400000) : null;
                  return (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="font-medium">{m.name}</div>
                        {parent && <div className="text-xs text-muted-foreground">{parent.name}</div>}
                      </TableCell>
                      <TableCell className="text-xs">{planned ? planned.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—"}</TableCell>
                      <TableCell className="text-xs">{actual ? actual.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—"}</TableCell>
                      <TableCell className="text-xs">
                        {varianceDays == null ? "—" : varianceDays === 0 ? "On time" : varianceDays > 0 ? `+${varianceDays} days` : `${varianceDays} days`}
                      </TableCell>
                      <TableCell>
                        <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", ragPillClass(m.ragStatus))}>
                          {done ? "Complete" : m.ragStatus === "red" ? "At risk" : "Upcoming"}
                        </span>
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
          <CardContent className="p-4 space-y-2.5">
            {milestones.map((m) => {
              if (!range || !m.plannedStartDate) return null;
              const t = new Date(m.plannedStartDate).getTime();
              const pct = Math.round(((t - range.minT) / (range.maxT - range.minT)) * 100);
              return (
                <div key={m.id} className="flex items-center gap-3">
                  <div className="w-40 shrink-0 text-xs font-medium truncate">{m.name}</div>
                  <div className="flex-1 relative h-5 bg-muted/40 rounded">
                    <div
                      className="absolute top-0.5 w-3 h-3 rotate-45 rounded-sm"
                      style={{ left: `calc(${Math.min(98, Math.max(0, pct))}% - 6px)`, background: ragColor(m.ragStatus) }}
                    />
                  </div>
                </div>
              );
            })}
            <div className="flex items-center gap-4 pt-3 mt-2 border-t text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rotate-45 rounded-sm inline-block" style={{ background: "#0E6E5C" }} />On track / complete</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rotate-45 rounded-sm inline-block" style={{ background: "#B4560F" }} />At risk</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rotate-45 rounded-sm inline-block" style={{ background: "#A03E52" }} />Off track</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PmMilestoneStatusReportTool;
