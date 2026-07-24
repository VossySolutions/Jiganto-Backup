import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Loader2, FileDown, Printer, Save, Send, ExternalLink,
} from "lucide-react";
import { apiRequest, fetchWithAuth } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Report360Data, RagLevel } from "./types";
import { formatBudget, RAG_DOT } from "./rag-utils";
import { cn } from "@/lib/utils";
import {
  modulePageTabsListClass,
  modulePageTabsWrapClass,
  modulePageTabTriggerClass,
} from "@/components/ModulePageChrome";

type SectionId =
  | "rag" | "plan" | "exec" | "risks" | "issues" | "phases"
  | "ws" | "dec" | "del" | "dep" | "act" | "team" | "dl";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "rag", label: "RAG Status" },
  { id: "plan", label: "Project Plan" },
  { id: "exec", label: "Executive Summary" },
  { id: "risks", label: "Risks" },
  { id: "issues", label: "Issues" },
  { id: "phases", label: "Phases" },
  { id: "ws", label: "Workstreams" },
  { id: "dec", label: "Decisions" },
  { id: "del", label: "Deliverables" },
  { id: "dep", label: "Dependencies" },
  { id: "act", label: "Actions" },
  { id: "team", label: "Team & Budget" },
  { id: "dl", label: "Deadlines" },
];

const SECTION_IDS = new Set<string>(SECTIONS.map((s) => s.id));

const sectionTabClass = cn(
  modulePageTabTriggerClass,
  "data-[state=active]:bg-primary/10 data-[state=active]:text-primary",
);

function normRag(v?: string | null): RagLevel {
  const s = (v || "").toLowerCase();
  if (s.includes("red") || s === "r") return "red";
  if (s.includes("amber") || s.includes("yellow") || s === "a") return "amber";
  return "green";
}

function RagPill({ value, large }: { value?: string | null; large?: boolean }) {
  const rag = normRag(value);
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-bold capitalize",
        large ? "px-3.5 py-1.5 text-xs" : "px-2.5 py-0.5 text-[10px]",
        rag === "green" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
        rag === "amber" && "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
        rag === "red" && "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
      )}
    >
      {value || rag}
    </span>
  );
}

function RagBar({ pct, rag }: { pct: number; rag: RagLevel }) {
  const clamped = Math.min(120, Math.max(0, pct));
  return (
    <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden cursor-default">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          rag === "green" && "bg-emerald-500",
          rag === "amber" && "bg-amber-500",
          rag === "red" && "bg-red-500",
        )}
        style={{ width: `${Math.min(100, clamped)}%` }}
      />
    </div>
  );
}

function CardShell({ title, tip, children, action }: {
  title: string; tip?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border/60">
        <div>
          <div className="text-[12px] font-bold text-foreground">{title}</div>
          {tip && <div className="text-[10px] text-muted-foreground mt-0.5">{tip}</div>}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function EmptyRows({ label }: { label: string }) {
  return <p className="text-sm text-muted-foreground py-6 text-center">{label}</p>;
}

type HealthIndicator = { id: string; label: string; pct: number; rag: RagLevel };
type DecisionRow = { id: string; text: string; owner: string };
type ActionRow = { id: string; text: string; owner: string; due: string };

function buildDefaultIndicators(data: Report360Data): HealthIndicator[] {
  const health = data.healthDashboard;
  const fin = data.financialSummary;
  const budgetPct = fin.budget > 0 ? Math.round((fin.spent / fin.budget) * 100) : 0;
  const progressAvg =
    data.level1Plan.length > 0
      ? Math.round(data.level1Plan.reduce((s, p) => s + (p.progress || 0), 0) / data.level1Plan.length)
      : 0;
  return [
    { id: "time", label: "Time", pct: progressAvg, rag: normRag(health?.schedule) },
    { id: "cost", label: "Cost", pct: Math.min(100, budgetPct), rag: normRag(health?.budget) },
    { id: "quality", label: "Quality", pct: progressAvg, rag: normRag(health?.quality) },
    { id: "completion", label: "Completion", pct: progressAvg, rag: normRag(health?.delivery) },
    { id: "budget_util", label: "Budget Utilisation", pct: budgetPct, rag: budgetPct > 100 ? "red" : normRag(health?.budget) },
  ];
}

function periodSummary(data: Report360Data) {
  const start = data.executiveSummary.startDate ? new Date(data.executiveSummary.startDate) : null;
  const endRaw = data.executiveSummary.revisedEnd || data.executiveSummary.plannedEnd;
  const end = endRaw ? new Date(endRaw) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { elapsed: 0, remaining: 0, total: 0 };
  }
  const msDay = 86400000;
  const total = Math.max(1, Math.round((end.getTime() - start.getTime()) / msDay));
  const elapsed = Math.max(0, Math.min(total, Math.round((Date.now() - start.getTime()) / msDay)));
  return { elapsed, remaining: Math.max(0, total - elapsed), total };
}

export function Portfolio360ReportView({ projectId, onClose }: { projectId: number; onClose?: () => void }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const seededForProject = useRef<number | null>(null);

  const [activeSection, setActiveSection] = useState<SectionId>("rag");
  const [narrative, setNarrative] = useState("");
  const [ragCommentary, setRagCommentary] = useState("");
  const [indicators, setIndicators] = useState<HealthIndicator[]>([]);
  const [decisions, setDecisions] = useState<DecisionRow[]>([]);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [publishing, setPublishing] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery<Report360Data>({
    queryKey: [`/api/portfolio/reports/360/${projectId}`],
    staleTime: 30_000,
  });

  // Seed local editable state once per project (preserve edits across refetch)
  useEffect(() => {
    if (!data) return;
    if (seededForProject.current === projectId) return;
    seededForProject.current = projectId;

    const overrides = data.sectionOverrides;
    const narrativeText = overrides?.ragCommentary || data.executiveSummary?.narrative || "";
    setNarrative(narrativeText);
    setRagCommentary(narrativeText);

    if (overrides?.indicators?.length) {
      setIndicators(overrides.indicators.map((i) => ({ ...i, rag: normRag(i.rag) })));
    } else {
      setIndicators(buildDefaultIndicators(data));
    }

    if (overrides?.decisions?.length) {
      setDecisions(overrides.decisions);
    } else {
      setDecisions(
        (data.raidSummary?.openAssumptions || []).map((a, i) => ({
          id: a.ref || `D-${i + 1}`,
          text: a.assumption || "",
          owner: a.owner || "",
        })),
      );
    }

    if (overrides?.actions?.length) {
      setActions(overrides.actions);
    } else {
      setActions(
        (data.raidSummary?.topIssues || []).map((r, i) => ({
          id: r.ref || `A-${i + 1}`,
          text: r.description || "",
          owner: r.owner || "",
          due: r.targetResolution || "",
        })),
      );
    }

    if (overrides?.activeSection && SECTION_IDS.has(overrides.activeSection)) {
      setActiveSection(overrides.activeSection as SectionId);
    }
  }, [data, projectId]);

  const saveSnapshot = async (publish = false) => {
    try {
      setPublishing(true);
      await apiRequest("POST", `/api/portfolio/reports/360/${projectId}`, {
        narrative: narrative || ragCommentary,
        sectionOverrides: {
          ragCommentary,
          indicators,
          activeSection,
          decisions,
          actions,
        },
      });
      toast({ title: publish ? "Report published" : "Report snapshot saved" });
    } catch {
      toast({ title: publish ? "Publish failed" : "Failed to save report", variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  };

  const exportPptx = async () => {
    try {
      const params = new URLSearchParams();
      if (narrative || ragCommentary) params.set("narrative", narrative || ragCommentary);
      const res = await fetchWithAuth(`/api/portfolio/reports/360/${projectId}/pptx?${params}`);
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const safeName = (data?.executiveSummary.projectName || "report").replace(/[^a-z0-9]/gi, "_");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${safeName}_360_report.pptx`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ title: "PowerPoint exported" });
    } catch {
      toast({ title: "PowerPoint export failed", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-sm text-muted-foreground">
          {(error as Error)?.message || "Failed to load 360° report."}
        </p>
        <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  const { executiveSummary: ex, raidSummary: raid, healthDashboard: health } = data;
  const period = periodSummary(data);
  const reportDate = new Date(data.generatedAt || Date.now()).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });

  const go = (id: SectionId) => setActiveSection(id);

  const updateIndicatorPct = (id: string, raw: string) => {
    const pct = Number(raw);
    if (!Number.isFinite(pct)) return;
    setIndicators((prev) =>
      prev.map((ind) =>
        ind.id === id
          ? { ...ind, pct, rag: pct > 100 ? "red" : pct >= 80 ? "green" : pct >= 60 ? "amber" : "red" }
          : ind,
      ),
    );
  };

  const deadlines = [
    ...data.milestones
      .filter((m) => m.targetDate)
      .map((m) => ({ name: m.name, date: m.targetDate!, kind: "Milestone", rag: m.rag, overdue: m.overdue })),
    ...data.deliverablesTracker
      .filter((d) => d.dueDate)
      .map((d) => ({ name: d.name, date: d.dueDate!, kind: "Deliverable", rag: null as string | null, overdue: false })),
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return (
    <div className="flex h-full min-h-[560px] flex-col rounded-xl border border-border overflow-hidden bg-background">
      <div className="shrink-0 border-b border-border/30 bg-card print:border-0">
        <div className="h-12 px-3 sm:px-4 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold truncate">{ex.projectName} — 360° Project Report</div>
            <div className="text-[11px] text-muted-foreground">
              Report · {reportDate}
              {period.total > 0 && <> · {period.elapsed} of {period.total} days elapsed</>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 print:hidden">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5 mr-1" /> Export PDF
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportPptx}>
              <FileDown className="h-3.5 w-3.5 mr-1" /> PPTX
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" disabled={publishing} onClick={() => saveSnapshot(false)}>
              <Save className="h-3.5 w-3.5 mr-1" /> Save snapshot
            </Button>
            <Button size="sm" className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700" disabled={publishing} onClick={() => saveSnapshot(true)}>
              {publishing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
              Publish report
            </Button>
            {onClose && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose}>Close</Button>
            )}
          </div>
        </div>

        <div className={cn(modulePageTabsWrapClass, "print:hidden")}>
          <div className={modulePageTabsListClass} role="tablist">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={activeSection === s.id}
                data-state={activeSection === s.id ? "active" : "inactive"}
                onClick={() => go(s.id)}
                className={sectionTabClass}
                data-testid={`360-tab-${s.id}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5 bg-muted/20 print:bg-white print:overflow-visible">
          {activeSection === "rag" && (
            <>
              <div>
                <h2 className="text-sm font-bold">RAG Status</h2>
                <p className="text-[10px] text-muted-foreground italic">
                  Overall RAG and commentary on the left · Health indicators on the right
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                <div className="space-y-3.5">
                  <CardShell title="Overall RAG">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {([
                        ["Schedule", health?.schedule],
                        ["Budget", health?.budget],
                        ["Quality", health?.quality],
                        ["Resource", health?.resources],
                        ["Risk", health?.risk],
                        ["Overall", health?.overall || ex.overallRag],
                      ] as const).map(([label, val]) => (
                        <div key={label}>
                          <div className="text-[8px] uppercase text-muted-foreground mb-1 tracking-wide">{label}</div>
                          <RagPill value={val} large={label === "Overall"} />
                        </div>
                      ))}
                    </div>
                  </CardShell>
                  <CardShell title="Key RAG Commentary">
                    <Textarea
                      value={ragCommentary}
                      onChange={(e) => {
                        setRagCommentary(e.target.value);
                        setNarrative(e.target.value);
                      }}
                      className="min-h-[88px] text-[11px] leading-relaxed border-0 shadow-none focus-visible:ring-1 bg-transparent p-0"
                      placeholder="Key status commentary for this period…"
                    />
                  </CardShell>
                  <CardShell title="Period Summary">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="text-center rounded-md bg-emerald-50 dark:bg-emerald-950/40 p-2.5">
                        <div className="text-[22px] font-bold text-emerald-600 dark:text-emerald-400">{period.elapsed}</div>
                        <div className="text-[9px] text-emerald-800 dark:text-emerald-300 mt-0.5">Days elapsed</div>
                      </div>
                      <div className="text-center rounded-md bg-amber-50 dark:bg-amber-950/40 p-2.5">
                        <div className="text-[22px] font-bold text-amber-600 dark:text-amber-400">{period.remaining}</div>
                        <div className="text-[9px] text-amber-800 dark:text-amber-300 mt-0.5">Days remaining</div>
                      </div>
                    </div>
                  </CardShell>
                </div>
                <CardShell
                  title="Health Indicators"
                  tip="Click % to edit value"
                  action={
                    <button
                      type="button"
                      className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400"
                      onClick={() =>
                        setIndicators((prev) => [
                          ...prev,
                          { id: `ind_${Date.now()}`, label: "New indicator", pct: 50, rag: "amber" },
                        ])
                      }
                    >
                      + Add indicator
                    </button>
                  }
                >
                  <div className="space-y-2">
                    {indicators.map((ind) => (
                      <div key={ind.id} className="flex items-center gap-2 py-1.5 border-b border-border/40 last:border-0">
                        <div className={cn("h-2 w-2 rounded-full shrink-0", RAG_DOT[ind.rag])} />
                        <Input
                          value={ind.label}
                          onChange={(e) =>
                            setIndicators((prev) =>
                              prev.map((x) => (x.id === ind.id ? { ...x, label: e.target.value } : x)),
                            )
                          }
                          className="h-7 w-[130px] shrink-0 text-[11px] border-0 shadow-none px-1 bg-transparent"
                        />
                        <RagBar pct={ind.pct} rag={ind.rag} />
                        <Input
                          type="number"
                          value={ind.pct}
                          onChange={(e) => updateIndicatorPct(ind.id, e.target.value)}
                          className="h-7 w-14 text-right text-[11px] font-semibold border-0 shadow-none px-1 bg-transparent"
                        />
                        <span className="text-[10px] text-muted-foreground">%</span>
                      </div>
                    ))}
                  </div>
                </CardShell>
              </div>
            </>
          )}

          {activeSection === "plan" && (
            <CardShell title="Project Plan — Level 1">
              {data.level1Plan.length === 0 ? (
                <EmptyRows label="No plan phases yet." />
              ) : (
                <div className="space-y-2">
                  {data.level1Plan.map((ph, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm border-b border-border/30 pb-2">
                      <div className="flex-1 font-medium">{ph.name}</div>
                      <RagPill value={ph.rag} />
                      <span className="font-mono text-xs w-12 text-right">{ph.progress}%</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {ph.plannedStart || "—"} → {ph.plannedEnd || "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardShell>
          )}

          {activeSection === "exec" && (
            <CardShell title="Executive Summary">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-3">
                <p><span className="text-muted-foreground">Client:</span> <strong>{ex.client || "—"}</strong></p>
                <p><span className="text-muted-foreground">PM:</span> <strong>{ex.pm || "—"}</strong></p>
                <p className="flex items-center gap-2">
                  <span className="text-muted-foreground">Overall RAG:</span> <RagPill value={ex.overallRag} />
                </p>
                <p>
                  <span className="text-muted-foreground">Dates:</span>{" "}
                  <strong>{ex.startDate || "—"} → {ex.plannedEnd || "—"}</strong>
                  {ex.revisedEnd && ex.revisedEnd !== ex.plannedEnd && (
                    <span className="text-muted-foreground"> (revised {ex.revisedEnd})</span>
                  )}
                </p>
              </div>
              <Textarea
                value={narrative}
                onChange={(e) => {
                  setNarrative(e.target.value);
                  setRagCommentary(e.target.value);
                }}
                className="min-h-[140px] text-sm leading-relaxed"
                placeholder="Executive status narrative…"
              />
            </CardShell>
          )}

          {activeSection === "risks" && (
            <CardShell title="Top Risks">
              {raid.topRisks.length === 0 ? (
                <EmptyRows label="No open risks." />
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/60 text-muted-foreground text-left">
                      <th className="p-2 font-semibold">Ref</th>
                      <th className="p-2 font-semibold">Description</th>
                      <th className="p-2 font-semibold">Owner</th>
                      <th className="p-2 font-semibold">Severity</th>
                      <th className="p-2 font-semibold">Mitigation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {raid.topRisks.map((r, i) => (
                      <tr key={i} className="border-t border-border/40">
                        <td className="p-2 font-mono text-indigo-600 dark:text-indigo-400">{r.ref || "—"}</td>
                        <td className="p-2">{r.description}</td>
                        <td className="p-2">{r.owner || "—"}</td>
                        <td className="p-2"><RagPill value={r.severity} /></td>
                        <td className="p-2 text-muted-foreground">{r.mitigation || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <Button variant="ghost" size="sm" className="mt-2 text-indigo-600" onClick={() => setLocation(`/modules/projects/${projectId}`)}>
                View full RAID <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </CardShell>
          )}

          {activeSection === "issues" && (
            <CardShell title="Top Issues">
              {raid.topIssues.length === 0 ? (
                <EmptyRows label="No open issues." />
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/60 text-muted-foreground text-left">
                      <th className="p-2 font-semibold">Ref</th>
                      <th className="p-2 font-semibold">Description</th>
                      <th className="p-2 font-semibold">Owner</th>
                      <th className="p-2 font-semibold">Priority</th>
                      <th className="p-2 font-semibold">Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {raid.topIssues.map((r, i) => (
                      <tr key={i} className="border-t border-border/40">
                        <td className="p-2 font-mono text-indigo-600 dark:text-indigo-400">{r.ref || "—"}</td>
                        <td className="p-2">{r.description}</td>
                        <td className="p-2">{r.owner || "—"}</td>
                        <td className="p-2"><RagPill value={r.priority} /></td>
                        <td className="p-2">{r.targetResolution || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardShell>
          )}

          {activeSection === "phases" && (
            <CardShell title="Current & Next Phases" tip={data.nextPhasePreview || undefined}>
              {data.level1Plan.length === 0 ? (
                <EmptyRows label="No phases configured." />
              ) : (
                <div className="space-y-2">
                  {data.level1Plan.map((ph, i) => (
                    <div key={i} className="rounded-lg border border-border/50 p-3 flex items-center gap-3">
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{ph.name}</div>
                        <div className="text-[11px] text-muted-foreground">{ph.plannedStart || "—"} → {ph.plannedEnd || "—"}</div>
                      </div>
                      <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${ph.progress}%` }} />
                      </div>
                      <span className="text-xs font-mono w-10 text-right">{ph.progress}%</span>
                      <RagPill value={ph.rag} />
                    </div>
                  ))}
                </div>
              )}
            </CardShell>
          )}

          {activeSection === "ws" && (
            <CardShell title="Workstream Updates">
              {data.workstreamUpdates.length === 0 ? (
                <EmptyRows label="No workstreams yet." />
              ) : (
                <div className="grid gap-2.5 md:grid-cols-2">
                  {data.workstreamUpdates.map((w, i) => (
                    <div key={i} className="rounded-lg border border-border/50 p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="text-sm font-semibold">{w.name}</div>
                        <RagPill value={w.rag} />
                      </div>
                      <div className="text-[11px] text-muted-foreground mb-1.5">
                        {w.owner || "Unassigned"} · {w.progress}%
                      </div>
                      <p className="text-xs">{w.note || "No update this period."}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardShell>
          )}

          {activeSection === "dec" && (
            <CardShell
              title="Key Decisions"
              tip="Editable — saved with snapshot"
              action={
                <button
                  type="button"
                  className="text-[10px] font-semibold text-indigo-600"
                  onClick={() =>
                    setDecisions((prev) => [...prev, { id: `D-${prev.length + 1}`, text: "", owner: "" }])
                  }
                >
                  + Add
                </button>
              }
            >
              {decisions.length === 0 ? (
                <EmptyRows label="No decisions logged. Add one above." />
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/60 text-muted-foreground text-left">
                      <th className="p-2 font-semibold w-16">Ref</th>
                      <th className="p-2 font-semibold">Decision</th>
                      <th className="p-2 font-semibold w-28">Owner</th>
                      <th className="p-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {decisions.map((row, i) => (
                      <tr key={row.id + i} className="border-t border-border/40">
                        <td className="p-1">
                          <Input
                            value={row.id}
                            className="h-7 text-[10px] font-mono border-0 shadow-none"
                            onChange={(e) =>
                              setDecisions((prev) => prev.map((d, j) => (j === i ? { ...d, id: e.target.value } : d)))
                            }
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            value={row.text}
                            className="h-7 text-[11px] border-0 shadow-none"
                            onChange={(e) =>
                              setDecisions((prev) => prev.map((d, j) => (j === i ? { ...d, text: e.target.value } : d)))
                            }
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            value={row.owner}
                            className="h-7 text-[10px] border-0 shadow-none"
                            onChange={(e) =>
                              setDecisions((prev) => prev.map((d, j) => (j === i ? { ...d, owner: e.target.value } : d)))
                            }
                          />
                        </td>
                        <td className="p-1">
                          <button type="button" className="text-muted-foreground hover:text-red-600 px-1" onClick={() => setDecisions((prev) => prev.filter((_, j) => j !== i))}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardShell>
          )}

          {activeSection === "del" && (
            <CardShell title="Deliverables Tracker">
              {data.deliverablesTracker.length === 0 ? (
                <EmptyRows label="No deliverables due in the near term." />
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#1E1B4B] text-white/90 text-left">
                      <th className="p-2 font-semibold">Deliverable</th>
                      <th className="p-2 font-semibold">Owner</th>
                      <th className="p-2 font-semibold">Due</th>
                      <th className="p-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.deliverablesTracker.map((d, i) => (
                      <tr key={i} className="border-t border-border/40">
                        <td className="p-2 font-medium">{d.name}</td>
                        <td className="p-2">{d.owner || "—"}</td>
                        <td className="p-2 font-mono">{d.dueDate || "—"}</td>
                        <td className="p-2">{d.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardShell>
          )}

          {activeSection === "dep" && (
            <CardShell title="Dependencies">
              {raid.openDependencies.length === 0 ? (
                <EmptyRows label="No open dependencies." />
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/60 text-muted-foreground text-left">
                      <th className="p-2 font-semibold">Ref</th>
                      <th className="p-2 font-semibold">Description</th>
                      <th className="p-2 font-semibold">Direction</th>
                      <th className="p-2 font-semibold">Required by</th>
                      <th className="p-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {raid.openDependencies.map((r, i) => (
                      <tr key={i} className="border-t border-border/40">
                        <td className="p-2 font-mono">{r.ref || "—"}</td>
                        <td className="p-2">{r.description}</td>
                        <td className="p-2">{r.direction}</td>
                        <td className="p-2">{r.requiredBy || "—"}</td>
                        <td className="p-2">{r.status || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardShell>
          )}

          {activeSection === "act" && (
            <CardShell
              title="Actions"
              tip="Editable — saved with snapshot"
              action={
                <button
                  type="button"
                  className="text-[10px] font-semibold text-indigo-600"
                  onClick={() =>
                    setActions((prev) => [...prev, { id: `A-${prev.length + 1}`, text: "", owner: "", due: "" }])
                  }
                >
                  + Add
                </button>
              }
            >
              {actions.length === 0 ? (
                <EmptyRows label="No open actions. Add one above." />
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/60 text-muted-foreground text-left">
                      <th className="p-2 font-semibold w-14">ID</th>
                      <th className="p-2 font-semibold">Action</th>
                      <th className="p-2 font-semibold w-24">Owner</th>
                      <th className="p-2 font-semibold w-24">Due</th>
                      <th className="p-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {actions.map((row, i) => (
                      <tr key={row.id + i} className="border-t border-border/40">
                        <td className="p-1">
                          <Input
                            value={row.id}
                            className="h-7 text-[10px] font-mono border-0 shadow-none"
                            onChange={(e) =>
                              setActions((prev) => prev.map((a, j) => (j === i ? { ...a, id: e.target.value } : a)))
                            }
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            value={row.text}
                            className="h-7 text-[11px] border-0 shadow-none"
                            onChange={(e) =>
                              setActions((prev) => prev.map((a, j) => (j === i ? { ...a, text: e.target.value } : a)))
                            }
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            value={row.owner}
                            className="h-7 text-[10px] border-0 shadow-none"
                            onChange={(e) =>
                              setActions((prev) => prev.map((a, j) => (j === i ? { ...a, owner: e.target.value } : a)))
                            }
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            value={row.due}
                            className="h-7 text-[10px] border-0 shadow-none"
                            onChange={(e) =>
                              setActions((prev) => prev.map((a, j) => (j === i ? { ...a, due: e.target.value } : a)))
                            }
                          />
                        </td>
                        <td className="p-1">
                          <button type="button" className="text-muted-foreground hover:text-red-600 px-1" onClick={() => setActions((prev) => prev.filter((_, j) => j !== i))}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardShell>
          )}

          {activeSection === "team" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              <CardShell title="Financial Summary">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Budget</div>
                    <div className="text-lg font-bold">{formatBudget(data.financialSummary.budget)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Spent</div>
                    <div className="text-lg font-bold">{formatBudget(data.financialSummary.spent)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Remaining</div>
                    <div className="text-lg font-bold">{formatBudget(data.financialSummary.remaining)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground">Forecast</div>
                    <div className="text-lg font-bold">{formatBudget(data.financialSummary.forecast)}</div>
                  </div>
                </div>
              </CardShell>
              <CardShell title="Team & Resources">
                {data.resourceSummary.length === 0 ? (
                  <EmptyRows label="No team members listed." />
                ) : (
                  <ul className="space-y-2 text-sm">
                    {data.resourceSummary.map((r, i) => (
                      <li key={i} className="flex items-center justify-between border-b border-border/40 pb-1.5">
                        <span>
                          <strong>{r.name}</strong>
                          <span className="text-muted-foreground text-xs ml-1.5">{r.role || ""}</span>
                        </span>
                        <span className="font-mono text-xs">{r.allocation}%</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardShell>
            </div>
          )}

          {activeSection === "dl" && (
            <CardShell title="Upcoming Deadlines">
              {deadlines.length === 0 ? (
                <EmptyRows label="No upcoming deadlines." />
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/60 text-muted-foreground text-left">
                      <th className="p-2 font-semibold">Item</th>
                      <th className="p-2 font-semibold">Type</th>
                      <th className="p-2 font-semibold">Date</th>
                      <th className="p-2 font-semibold">RAG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deadlines.map((d, i) => (
                      <tr key={i} className={cn("border-t border-border/40", d.overdue && "text-red-600")}>
                        <td className="p-2 font-medium">{d.name}</td>
                        <td className="p-2">{d.kind}</td>
                        <td className="p-2 font-mono">{d.date}</td>
                        <td className="p-2">{d.rag ? <RagPill value={d.rag} /> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardShell>
          )}
      </div>
    </div>
  );
}
