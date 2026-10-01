import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PmTask } from "@shared/models/projects";

/**
 * Plan health — rule-based warnings over the current schedule, read-only.
 * Nothing equivalent exists in the current Gantt engine (confirmed by
 * grepping it for "warning"/"validat"/"healthCheck" — no matches).
 *
 * Dependency-type-aware as of the `dep_type` column fix: the conflict check
 * used to be hardcoded as FS-only because depType was never sent to the
 * server on save (verified against persistSave in gantt-v4-engine.js — it
 * included predecessorIds but no type field at all, so anything read back
 * from the database was always FS-shaped regardless of what was picked
 * before a reload). Now that persistSave/persistCreate send depType and the
 * column exists, this reads the real value and checks each type correctly:
 * FS = successor starts after predecessor finishes, SS = starts after
 * predecessor starts, FF = finishes after predecessor finishes, SF =
 * finishes after predecessor starts.
 */

interface Warning {
  id: string;
  taskId: number;
  severity: "warn" | "info";
  message: string;
}

function parseISO(d: string | null | undefined): number | null {
  if (!d) return null;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? null : t;
}

const DONE_STATUSES = new Set(["done", "completed"]);

export function PmPlanHealthTool({ projectId }: { projectId: number }) {
  const { data: tasks = [], isLoading } = useQuery<PmTask[]>({
    queryKey: ["/api/pm/projects", projectId, "tasks"],
  });

  const warnings = useMemo(() => {
    const byId = new Map<number, PmTask>(tasks.map((t) => [t.id, t]));
    const hasChildren = new Set<number>();
    tasks.forEach((t) => {
      if (t.parentTaskId != null) hasChildren.add(t.parentTaskId);
    });
    const today = Date.now();
    const out: Warning[] = [];

    tasks.forEach((t) => {
      const type = t.ganttType || "task";
      const isMilestone = type === "milestone";
      const isPhaseOrWorkstream = type === "phase" || type === "workstream";
      const isLeaf = !hasChildren.has(t.id);
      const start = parseISO(t.plannedStartDate as unknown as string);
      const end = parseISO(t.plannedEndDate as unknown as string);
      const label = `"${t.name}"`;

      // Missing owner — only meaningful for leaf work items, not containers/milestones
      if (isLeaf && !isMilestone && !isPhaseOrWorkstream && !t.assigneeId) {
        out.push({ id: `owner-${t.id}`, taskId: t.id, severity: "warn", message: `${label} has no owner assigned.` });
      }

      // Missing dates
      if (isMilestone) {
        if (start == null) {
          out.push({ id: `date-${t.id}`, taskId: t.id, severity: "warn", message: `Milestone ${label} has no date set.` });
        }
      } else if (isLeaf && (start == null || end == null)) {
        out.push({ id: `date-${t.id}`, taskId: t.id, severity: "warn", message: `${label} is missing a start or end date.` });
      }

      // End before start
      if (start != null && end != null && end < start) {
        out.push({ id: `order-${t.id}`, taskId: t.id, severity: "warn", message: `${label} ends before it starts.` });
      }

      // Outside parent's date range
      if (t.parentTaskId != null && start != null && end != null) {
        const parent = byId.get(t.parentTaskId);
        const pStart = parent ? parseISO(parent.plannedStartDate as unknown as string) : null;
        const pEnd = parent ? parseISO(parent.plannedEndDate as unknown as string) : null;
        if (pStart != null && pEnd != null && (start < pStart || end > pEnd)) {
          out.push({
            id: `parent-${t.id}`,
            taskId: t.id,
            severity: "warn",
            message: `${label} falls outside "${parent?.name}"'s dates.`,
          });
        }
      }

      // Overdue
      if (isMilestone) {
        if (start != null && start < today && !DONE_STATUSES.has(t.status || "")) {
          out.push({ id: `overdue-${t.id}`, taskId: t.id, severity: "warn", message: `Milestone ${label} has passed without being marked complete.` });
        }
      } else if (isLeaf && end != null && end < today && !DONE_STATUSES.has(t.status || "") && t.status !== "blocked") {
        out.push({ id: `overdue-${t.id}`, taskId: t.id, severity: "info", message: `${label} is overdue (was due ${new Date(end).toLocaleDateString("en-GB")}).` });
      }

      // Dependency conflict — type-aware (FS/SS/FF/SF), see file header
      const predIds = (t.predecessorIds || []) as number[];
      const predId = predIds.length > 0 ? predIds[0] : null;
      if (predId != null) {
        const pred = byId.get(predId);
        const predStart = pred ? parseISO(pred.plannedStartDate as unknown as string) : null;
        const predEnd = pred ? parseISO(pred.plannedEndDate as unknown as string) : null;
        const depType = t.depType || "FS";
        if (pred) {
          if (depType === "SS" && start != null && predStart != null && start < predStart) {
            out.push({ id: `dep-${t.id}`, taskId: t.id, severity: "warn", message: `${label} starts before its predecessor "${pred.name}" starts (SS dependency).` });
          } else if (depType === "FF" && end != null && predEnd != null && end < predEnd) {
            out.push({ id: `dep-${t.id}`, taskId: t.id, severity: "warn", message: `${label} finishes before its predecessor "${pred.name}" finishes (FF dependency).` });
          } else if (depType === "SF" && end != null && predStart != null && end < predStart) {
            out.push({ id: `dep-${t.id}`, taskId: t.id, severity: "warn", message: `${label} finishes before its predecessor "${pred.name}" starts (SF dependency).` });
          } else if ((depType === "FS" || !["SS", "FF", "SF"].includes(depType)) && start != null && predEnd != null && start < predEnd) {
            out.push({ id: `dep-${t.id}`, taskId: t.id, severity: "warn", message: `${label} starts before its predecessor "${pred.name}" finishes.` });
          }
        }
      }
    });

    return out;
  }, [tasks]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">Plan health</h3>
          <p className="text-xs text-muted-foreground">
            {warnings.length ? `${warnings.length} item${warnings.length === 1 ? "" : "s"} to review` : "No issues found"}
          </p>
        </div>
        {warnings.length === 0 ? (
          <div className="flex items-center gap-2 px-4 py-8 justify-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Every item has dates, owners are assigned where needed, and no dependency conflicts were found.
          </div>
        ) : (
          <ul className="divide-y">
            {warnings.map((w) => (
              <li key={w.id} className="flex items-start gap-2.5 px-4 py-2.5 text-sm">
                <AlertTriangle
                  className={cn("h-4 w-4 shrink-0 mt-0.5", w.severity === "warn" ? "text-amber-500" : "text-muted-foreground")}
                />
                <span>{w.message}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default PmPlanHealthTool;
