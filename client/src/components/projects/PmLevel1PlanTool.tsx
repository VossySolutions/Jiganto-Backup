import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PmProject, PmTask } from "@shared/models/projects";

/**
 * Level 1 plan — a presentation-ready phase-band summary, read-only.
 *
 * Built from the same /api/pm/projects/:id/tasks source the detailed Gantt
 * uses (not the legacy phases endpoint), since ganttType is a plain property
 * on one unified pm_tasks row rather than a separate table — matching how
 * ReactGanttChart already interprets this data. Deliberately view-only for
 * this first cut: editing lives in the detailed Gantt, this tool exists to
 * answer "what does this plan look like at a glance," which the existing
 * detailed-only engine has no equivalent for.
 */

const PHASE_COLORS = [
  "#3E5C76", "#0E6E5C", "#8A5A2B", "#5B4B8A", "#A03E52",
  "#2B7A8A", "#6B7F2B", "#874E8E", "#996515", "#4A6B8A",
];

interface PlanNode {
  task: PmTask;
  children: PlanNode[];
}

function parseISO(d: string | null | undefined): number | null {
  if (!d) return null;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? null : t;
}

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function monthLabel(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

const DAY_MS = 86_400_000;

export function PmLevel1PlanTool({ projectId }: { projectId: number }) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const { data: project, isLoading: projectLoading } = useQuery<PmProject>({
    queryKey: ["/api/pm/projects", projectId],
  });
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<PmTask[]>({
    queryKey: ["/api/pm/projects", projectId, "tasks"],
  });

  const isLoading = projectLoading || tasksLoading;

  const { phaseRows, range } = useMemo(() => {
    const byId = new Map<number, PmTask>(tasks.map((t) => [t.id, t]));

    const buildNode = (t: PmTask): PlanNode => {
      const kids = tasks
        .filter((c) => c.parentTaskId === t.id)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return { task: t, children: kids.map(buildNode) };
    };

    // Phases are pm_tasks rows typed "phase" with no valid parent — i.e. direct
    // children of the synthetic project root, the top of the hierarchy.
    const phases = tasks
      .filter((t) => (t.ganttType || "") === "phase")
      .filter((t) => !t.parentTaskId || !byId.has(t.parentTaskId))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const rows: PlanNode[] = phases.map(buildNode);

    let minMs: number | null = null;
    let maxMs: number | null = null;
    tasks.forEach((t) => {
      const s = parseISO(t.plannedStartDate as unknown as string);
      const e = parseISO(t.plannedEndDate as unknown as string) ?? s;
      if (s != null) minMs = minMs == null ? s : Math.min(minMs, s);
      if (e != null) maxMs = maxMs == null ? e : Math.max(maxMs, e);
    });
    if (minMs == null || maxMs == null) {
      const ps = parseISO(project?.startDate as unknown as string) ?? Date.now();
      const pe = parseISO(project?.endDate as unknown as string) ?? ps + 90 * DAY_MS;
      minMs = ps;
      maxMs = pe;
    }
    // Pad a little so bars don't touch the edges
    minMs -= 7 * DAY_MS;
    maxMs += 14 * DAY_MS;

    return { phaseRows: rows, range: { start: minMs, end: Math.max(maxMs, minMs + DAY_MS) } };
  }, [tasks, project]);

  const totalMs = range.end - range.start;
  const pct = (ms: number) => Math.min(100, Math.max(0, ((ms - range.start) / totalMs) * 100));

  const months = useMemo(() => {
    const out: number[] = [];
    const d = new Date(range.start);
    d.setDate(1);
    while (d.getTime() < range.end) {
      out.push(d.getTime());
      d.setMonth(d.getMonth() + 1);
    }
    return out;
  }, [range]);

  const today = Date.now();
  const showToday = today >= range.start && today <= range.end;

  const toggle = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!phaseRows.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No phases defined yet — add phases in the detailed Gantt and they'll appear here as a
          presentation-ready summary.
        </CardContent>
      </Card>
    );
  }

  // Flatten visible rows (respecting collapse state) while keeping depth + phase colour.
  type FlatRow = { node: PlanNode; depth: number; color: string };
  const flat: FlatRow[] = [];
  phaseRows.forEach((phase, i) => {
    const color = PHASE_COLORS[i % PHASE_COLORS.length];
    const walk = (n: PlanNode, depth: number) => {
      flat.push({ node: n, depth, color });
      if (collapsed.has(n.task.id)) return;
      n.children.forEach((c) => walk(c, depth + 1));
    };
    walk(phase, 0);
  });

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h3 className="text-sm font-semibold">Level 1 Plan</h3>
            <p className="text-xs text-muted-foreground">
              Phase-level summary · {fmtDate(range.start)} – {fmtDate(range.end)} · view-only, edit in the detailed Gantt
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {/* month header */}
            <div className="flex border-b bg-muted/30 text-[11px] font-medium text-muted-foreground">
              <div className="w-[260px] shrink-0 px-3 py-2 border-r">Phase / Work stream / Activity</div>
              <div className="relative flex-1">
                <div className="flex h-full">
                  {months.map((m, i) => {
                    const next = i + 1 < months.length ? months[i + 1] : range.end;
                    const width = pct(next) - pct(m);
                    return (
                      <div
                        key={m}
                        className="border-r px-2 py-2 shrink-0"
                        style={{ width: `${width}%` }}
                      >
                        {monthLabel(m)}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* rows */}
            <div className="relative">
              {showToday && (
                <div
                  className="absolute top-0 bottom-0 w-px bg-red-500 z-10"
                  style={{ left: `calc(260px + ${pct(today)}% * (100% - 260px) / 100)` }}
                  title={`Today — ${fmtDate(today)}`}
                />
              )}
              {flat.map(({ node, depth, color }) => {
                const t = node.task;
                const isPhase = (t.ganttType || "") === "phase";
                const isMilestone = (t.ganttType || "") === "milestone";
                const s = parseISO(t.plannedStartDate as unknown as string);
                const e = parseISO(t.plannedEndDate as unknown as string) ?? s;
                const hasDates = s != null && e != null;
                const left = hasDates ? pct(s as number) : 0;
                const width = hasDates ? Math.max(0.6, pct(e as number) - left) : 0;
                const hasChildren = node.children.length > 0;

                return (
                  <div key={t.id} className={cn("flex border-b", isPhase && "bg-muted/10")}>
                    <div
                      className="w-[260px] shrink-0 px-3 py-2 border-r flex items-center gap-1 text-xs"
                      style={{ paddingLeft: `${12 + depth * 16}px` }}
                    >
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={() => toggle(t.id)}
                          className="text-muted-foreground hover:text-foreground shrink-0"
                          aria-label={collapsed.has(t.id) ? "Expand" : "Collapse"}
                        >
                          {collapsed.has(t.id) ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      ) : (
                        <span className="w-3.5 shrink-0" />
                      )}
                      <span
                        className={cn(
                          "truncate",
                          isPhase ? "font-semibold uppercase tracking-tight text-[11px]" : "font-medium",
                        )}
                        style={isPhase ? { color } : undefined}
                        title={t.name}
                      >
                        {isMilestone && "◆ "}
                        {t.name}
                      </span>
                    </div>
                    <div className="relative flex-1 py-2 px-1" style={{ minHeight: 34 }}>
                      {hasDates && !isMilestone && (
                        <div
                          className={cn(
                            "absolute rounded-md flex items-center overflow-hidden text-white text-[10px] font-semibold px-2",
                            isPhase ? "h-[22px] top-1/2 -translate-y-1/2" : "h-[16px] top-1/2 -translate-y-1/2 opacity-90",
                          )}
                          style={{ left: `${left}%`, width: `${width}%`, backgroundColor: color }}
                          title={`${t.name} · ${fmtDate(s as number)} – ${fmtDate(e as number)} · ${t.progress ?? 0}%`}
                        >
                          {(t.progress ?? 0) > 0 && (
                            <div
                              className="absolute inset-y-0 left-0 bg-black/25"
                              style={{ width: `${Math.min(100, t.progress ?? 0)}%` }}
                            />
                          )}
                          <span className="relative truncate">{t.name}</span>
                        </div>
                      )}
                      {isMilestone && hasDates && (
                        <div
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-3.5 rotate-45 border-2 border-white shadow"
                          style={{ left: `${left}%`, backgroundColor: color }}
                          title={`${t.name} · ${fmtDate(s as number)}`}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 border-t text-[11px] text-muted-foreground">
          {phaseRows.map((p, i) => (
            <span key={p.task.id} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: PHASE_COLORS[i % PHASE_COLORS.length] }}
              />
              {p.task.name}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rotate-45 border border-muted-foreground/40" />
            Milestone
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default PmLevel1PlanTool;
