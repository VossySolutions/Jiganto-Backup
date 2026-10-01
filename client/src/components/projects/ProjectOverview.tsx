import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { ProjectToolBadges } from "@/components/projects/ProjectWorkspaceSidebar";
import { findToolDefinition, getPickerToolIds } from "@/components/projects/CreateWorkItemWizard";

type ProjectLike = {
  id: number;
  name?: string | null;
  code?: string | null;
  description?: string | null;
  strategicObjective?: string | null;
  customer?: string | null;
  methodology?: string | null;
  phase?: string | null;
  endDate?: string | null;
  progress?: number | null;
  actualBudget?: number | null;
  forecastBudget?: number | null;
  budget?: number | null;
  financialRag?: string | null;
  scheduleRag?: string | null;
  ragStatus?: string | null;
  projectManagerName?: string | null;
  pmoName?: string | null;
  leadName?: string | null;
};

function fmtMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  const v = Number(n);
  if (Math.abs(v) >= 1_000_000) return `£${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `£${(v / 1_000).toFixed(0)}K`;
  return `£${v.toLocaleString()}`;
}

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function ragClass(rag?: string | null): string {
  const v = (rag || "").toLowerCase();
  if (v === "red" || v === "r") return "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300";
  if (v === "amber" || v === "a" || v === "yellow")
    return "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300";
  return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300";
}

function ragDot(rag?: string | null): string {
  const v = (rag || "").toLowerCase();
  if (v === "red" || v === "r") return "bg-red-500";
  if (v === "amber" || v === "a" || v === "yellow") return "bg-amber-500";
  return "bg-emerald-500";
}

function safePct(n: number | null | undefined): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

export default function ProjectOverview({
  project,
  onNavigateTool,
  enabledTools,
  onAddTool,
}: {
  project: ProjectLike;
  onNavigateTool?: (toolId: string) => void;
  enabledTools?: Array<{ toolType: string; label?: string | null }>;
  onAddTool?: (toolId: string) => void;
}) {
  const projectId = project.id;

  const { data: badges } = useQuery<ProjectToolBadges>({
    queryKey: ["/api/pm/projects", projectId, "tool-badges"],
    enabled: !!projectId,
  });

  const { data: milestones = [] } = useQuery<any[]>({
    queryKey: ["/api/pm/projects", projectId, "milestones"],
    enabled: !!projectId,
  });

  const { data: raidd = [] } = useQuery<any[]>({
    queryKey: ["/api/pm/projects", projectId, "raidd"],
    enabled: !!projectId,
  });

  const { data: team = [] } = useQuery<any[]>({
    queryKey: ["/api/pm/projects", projectId, "team"],
    enabled: !!projectId,
  });

  const progress = safePct(badges?.progress ?? project.progress);
  const budgetTotal = Number(project.forecastBudget ?? project.budget ?? 0) || 0;
  const budgetSpent = Number(project.actualBudget ?? 0) || 0;
  const budgetPct =
    budgetTotal > 0 && Number.isFinite(budgetSpent)
      ? safePct((budgetSpent / budgetTotal) * 100)
      : 0;

  const openRaidd = (Array.isArray(raidd) ? raidd : []).filter((r) => {
    const s = String(r.status || "").toLowerCase();
    return s !== "closed" && s !== "resolved" && s !== "done" && s !== "mitigated";
  });
  const criticalRaidd = openRaidd
    .filter((r) => {
      const p = String(r.priority || r.severity || "").toLowerCase();
      return p === "critical" || p === "high" || p === "1" || p === "2";
    })
    .slice(0, 4);

  const upcomingMs = [...(Array.isArray(milestones) ? milestones : [])]
    .sort((a, b) => {
      const da = a.dueDate || a.targetDate || "";
      const db = b.dueDate || b.targetDate || "";
      return String(da).localeCompare(String(db));
    })
    .slice(0, 4);

  const scopeText =
    project.strategicObjective ||
    project.description ||
    "No objective / scope statement yet. Add one in project settings.";

  const lead =
    project.projectManagerName || project.leadName || "—";
  const pmo = project.pmoName || "—";

  const raidBadge = badges?.badges?.risk_log || badges?.badges?.issues_log;
  const openRaidCount =
    openRaidd.length ||
    (typeof raidBadge?.count === "number" ? raidBadge.count : 0);

  const finRag = badges?.financialRag ?? project.financialRag;
  const schRag = badges?.scheduleRag ?? project.scheduleRag;

  return (
    <div className="space-y-3.5" data-testid="project-overview">
      <div className="flex gap-5 rounded-xl border border-border bg-card p-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Objective / Scope
          </div>
          <p className="text-[13px] leading-relaxed text-foreground/80">{scopeText}</p>
        </div>
        <div className="hidden w-[180px] flex-shrink-0 border-l border-border pl-4 sm:block">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Project info
          </div>
          <dl className="space-y-1.5 text-[11px]">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Lead</dt>
              <dd className="font-bold text-right truncate">{lead}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">PMO</dt>
              <dd className="font-bold text-right truncate">{pmo}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Customer</dt>
              <dd className="font-bold text-right truncate">{project.customer || "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Methodology</dt>
              <dd className="font-bold text-right truncate">{project.methodology || "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Phase</dt>
              <dd className="font-bold text-right truncate text-indigo-900 dark:text-indigo-300">
                {project.phase || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">End date</dt>
              <dd className="font-bold text-right">{fmtDate(project.endDate)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard
          tone="amber"
          label="Budget consumed"
          value={fmtMoney(budgetSpent)}
          sub={budgetTotal ? `of ${fmtMoney(budgetTotal)} · ${budgetPct}%` : "No budget set"}
          delta={
            finRag
              ? { text: finRag === "green" ? "On track" : finRag === "amber" ? "Monitor" : "Off track", tone: finRag }
              : undefined
          }
        />
        <StatCard
          tone="blue"
          label="Progress"
          value={`${progress}%`}
          progress={progress}
          delta={
            schRag
              ? {
                  text: schRag === "green" ? "On track for schedule" : schRag === "amber" ? "Schedule at risk" : "Behind schedule",
                  tone: schRag,
                }
              : undefined
          }
        />
        <StatCard
          tone="red"
          label="Open RAID items"
          value={String(openRaidCount)}
          sub={criticalRaidd.length ? `${criticalRaidd.length} need attention` : "No critical items"}
          delta={
            openRaidCount > 0
              ? { text: `${openRaidCount} open`, tone: openRaidCount > 5 ? "red" : "amber" }
              : { text: "Clear", tone: "green" }
          }
        />
        <StatCard
          tone="green"
          label="Team"
          value={String(badges?.teamMembers ?? team.length ?? 0)}
          sub="Assigned members"
          delta={
            badges?.attention
              ? { text: "Needs attention", tone: "red" }
              : { text: "Healthy", tone: "green" }
          }
        />
      </div>

      {enabledTools && onNavigateTool && (
        <ToolsAttachedSection
          enabledTools={enabledTools}
          onNavigateTool={onNavigateTool}
          onAddTool={onAddTool}
          badges={badges}
        />
      )}

      <div className="grid gap-3.5 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div>
              <div className="text-[13px] font-extrabold">Upcoming milestones</div>
              <div className="text-[11px] text-muted-foreground">Next due dates</div>
            </div>
            {onNavigateTool && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => onNavigateTool("milestone_plan")}
              >
                View all →
              </Button>
            )}
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-muted/40 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Milestone</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {upcomingMs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                    No milestones yet
                  </td>
                </tr>
              ) : (
                upcomingMs.map((m) => (
                  <tr key={m.id} className="border-t border-border/50">
                    <td className="px-3 py-2.5 font-semibold">{m.name || m.title || "Milestone"}</td>
                    <td className="px-3 py-2.5 font-mono text-[11px]">
                      {fmtDate(m.dueDate || m.targetDate)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold",
                          ragClass(m.ragStatus || m.status),
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full", ragDot(m.ragStatus || m.status))} />
                        {String(m.status || "Upcoming").replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div>
              <div className="text-[13px] font-extrabold">Critical RAID items</div>
              <div className="text-[11px] text-muted-foreground">
                {criticalRaidd.length
                  ? `${criticalRaidd.length} item${criticalRaidd.length === 1 ? "" : "s"} require attention`
                  : "No critical open items"}
              </div>
            </div>
            {onNavigateTool && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => onNavigateTool("risk_log")}
              >
                RAID log →
              </Button>
            )}
          </div>
          <div className="divide-y divide-border/50">
            {criticalRaidd.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                {openRaidCount
                  ? "Open items exist but none flagged critical/high"
                  : "RAID log is clear"}
              </div>
            ) : (
              criticalRaidd.map((r) => (
                <div key={r.id} className="flex items-start gap-2.5 px-3 py-2.5">
                  <span
                    className={cn(
                      "mt-0.5 rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase",
                      String(r.itemType || r.type || "").toLowerCase().includes("issue")
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                        : "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
                    )}
                  >
                    {String(r.itemType || r.type || "Risk").slice(0, 4)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-semibold">{r.title || r.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {String(r.priority || r.severity || "—")} · {String(r.status || "Open")}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div>
            <div className="text-[13px] font-extrabold">Team snapshot</div>
            <div className="text-[11px] text-muted-foreground">Key people on this project</div>
          </div>
          {onNavigateTool && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => onNavigateTool("org_chart")}
            >
              Team →
            </Button>
          )}
        </div>
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-muted/40 text-left text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Allocation</th>
            </tr>
          </thead>
          <tbody>
            {(team as any[]).slice(0, 6).length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                  No team members assigned
                </td>
              </tr>
            ) : (
              (team as any[]).slice(0, 6).map((m) => (
                <tr key={m.id} className="border-t border-border/50">
                  <td className="px-3 py-2.5 font-semibold">
                    {m.name || m.userName || m.displayName || "Member"}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{m.role || m.title || "—"}</td>
                  <td className="px-3 py-2.5">
                    {m.allocation != null && Number.isFinite(Number(m.allocation))
                      ? `${safePct(m.allocation)}%`
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  tone,
  label,
  value,
  sub,
  progress,
  delta,
}: {
  tone: "amber" | "blue" | "red" | "green";
  label: string;
  value: string;
  sub?: string;
  progress?: number;
  delta?: { text: string; tone: string };
}) {
  const bar =
    tone === "amber"
      ? "bg-amber-500"
      : tone === "red"
        ? "bg-red-500"
        : tone === "green"
          ? "bg-emerald-500"
          : "bg-indigo-500";
  const valColor =
    tone === "amber"
      ? "text-amber-800 dark:text-amber-300"
      : tone === "red"
        ? "text-red-800 dark:text-red-300"
        : tone === "green"
          ? "text-emerald-800 dark:text-emerald-300"
          : "text-indigo-900 dark:text-indigo-300";

  const deltaTone = (delta?.tone || "").toLowerCase();
  const deltaCls =
    deltaTone === "red" || deltaTone === "r"
      ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300"
      : deltaTone === "amber" || deltaTone === "a" || deltaTone === "yellow"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300";

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-3.5">
      <div className={cn("absolute inset-y-0 left-0 w-[3px]", bar)} />
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-mono text-2xl font-black tracking-tight", valColor)}>{value}</div>
      {progress != null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full bg-indigo-400", bar)} style={{ width: `${safePct(progress)}%` }} />
        </div>
      )}
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
      {delta && (
        <span className={cn("mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold", deltaCls)}>
          {delta.text}
        </span>
      )}
    </div>
  );
}

/**
 * "Tools attached to this project" — the launcher grid from the Project
 * Workspace design (Main.dc.html), which calls this out as "the core UX
 * improvement": every attached tool as an open-able card, plus a quick way
 * to add more, right on the page you land on. The sidebar (ProjectWorkspace-
 * Sidebar) already has a mature nav + its own "Add tool" drawer — this
 * doesn't replace that, it surfaces the same information as a discoverable
 * launcher on the page most people see first, matching what the design
 * actually asks for without restructuring the already-confirmed Option B
 * nav pattern.
 */
const HIDDEN_FROM_TOOL_GRID = new Set(["project_dashboard", "360_report", "status_reporting"]);

function ToolsAttachedSection({
  enabledTools,
  onNavigateTool,
  onAddTool,
  badges,
}: {
  enabledTools: Array<{ toolType: string; label?: string | null }>;
  onNavigateTool: (toolId: string) => void;
  onAddTool?: (toolId: string) => void;
  badges?: ProjectToolBadges;
}) {
  const attached = enabledTools.filter((t) => !HIDDEN_FROM_TOOL_GRID.has(t.toolType));
  const enabledIds = new Set(enabledTools.map((t) => t.toolType));
  const suggestions = onAddTool
    ? getPickerToolIds()
        .filter((id) => !enabledIds.has(id) && !HIDDEN_FROM_TOOL_GRID.has(id))
        .slice(0, 5)
    : [];

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-extrabold">Tools attached to this project</h3>
        <span className="text-[11px] text-muted-foreground">
          {attached.length} tool{attached.length === 1 ? "" : "s"} in use
        </span>
      </div>

      {attached.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[12px] text-muted-foreground">
          No tools attached yet — add one below to get started.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
          {attached.map((t) => {
            const def = findToolDefinition(t.toolType);
            const Icon = def?.icon;
            const badge = badges?.badges?.[t.toolType];
            return (
              <div key={t.toolType} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                    {Icon ? <Icon className="h-4 w-4" /> : <span className="text-xs">•</span>}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-bold">
                    {def?.name || t.label || t.toolType}
                  </span>
                </div>
                {badge && (
                  <div className="text-[11px] text-muted-foreground">
                    {badge.count != null ? `${badge.count} ` : ""}
                    {badge.label}
                  </div>
                )}
                <Button
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={() => onNavigateTool(t.toolType)}
                  data-testid={`button-open-tool-${t.toolType}`}
                >
                  Open
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {suggestions.length > 0 && onAddTool && (
        <div className="rounded-xl border border-dashed border-border bg-card/60 p-3.5">
          <div className="mb-2 text-[12px] font-bold">Add a tool to this project</div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((id) => {
              const def = findToolDefinition(id);
              if (!def) return null;
              const Icon = def.icon;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onAddTool(id)}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11.5px] font-semibold hover:bg-muted"
                  data-testid={`button-quick-add-tool-${id}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {def.name}
                  <Plus className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
