import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Printer, Save, Send } from "lucide-react";
import {
  modulePageTabsListClass,
  modulePageTabsWrapClass,
  modulePageTabTriggerClass,
} from "@/components/ModulePageChrome";
import { printWeeklyStatusReport } from "@/lib/print-weekly-status";

type Rag = "green" | "amber" | "red" | "blue";
type VariantId = "standard" | "expanded" | "exec" | "financial" | "agile";

type WeeklyStatusReport = {
  id: string;
  title?: string;
  weekCommencing: string;
  status: "draft" | "submitted";
  summary?: string;
  date?: string;
  overallRag: Rag;
  lastWeekOverallRag: Rag;
  ragByType: { budget: Rag; resource: Rag; schedule: Rag; quality: Rag };
  lastWeekRagByType: { budget: Rag; resource: Rag; schedule: Rag; quality: Rag };
  commentary: string;
  achievements: string[];
  plannedNext: string[];
  notAchieved: string[];
  gates: { name: string; forecast: string; actual: string }[];
  lastGatesPassed: { name: string; date: string }[];
  nextGates: { name: string; date: string }[];
  riskIssues: { id: string; text: string; owner: string; rag: Rag; kind: "R" | "I" }[];
  financials: {
    baseline: number;
    costToDate: number;
    costToComplete: number;
    forecast: number;
    variance: number;
  };
  periodStrip: { date: string; rag: Rag }[];
  progressPct: number;
};

const VARIANTS: { id: VariantId; label: string; desc: string }[] = [
  { id: "standard", label: "Standard", desc: "Excel parity weekly layout" },
  { id: "expanded", label: "Expanded RAID", desc: "More RAID + decisions rows" },
  { id: "exec", label: "Executive", desc: "Summary-focused view" },
  { id: "financial", label: "Financial", desc: "Finance-forward layout" },
  { id: "agile", label: "Agile / Sprint", desc: "Sprint-oriented sections" },
];

const variantTabClass = cn(
  modulePageTabTriggerClass,
  "data-[state=active]:bg-primary/10 data-[state=active]:text-primary",
);

const RAG_CYCLE: Rag[] = ["green", "amber", "red", "blue"];

function nextRag(r: Rag): Rag {
  const i = RAG_CYCLE.indexOf(r);
  return RAG_CYCLE[(i + 1) % RAG_CYCLE.length];
}

function ragLetter(r: Rag) {
  return r === "green" ? "G" : r === "amber" ? "A" : r === "red" ? "R" : "B";
}

function ragBox(r: Rag, size: "lg" | "sm" = "sm") {
  return cn(
    "inline-flex items-center justify-center font-extrabold text-white cursor-pointer select-none",
    size === "lg" ? "h-14 w-14 rounded-lg text-lg" : "h-5 w-7 rounded text-[9px]",
    r === "green" && "bg-emerald-600",
    r === "amber" && "bg-amber-500",
    r === "red" && "bg-red-600",
    r === "blue" && "bg-slate-600",
  );
}

function localIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mondayOf(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return localIsoDate(x);
}

function fmtWeek(iso: string) {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return iso;
  }
}

function emptyReport(project: any, raidd: any[], milestones: any[]): WeeklyStatusReport {
  const budget = Number(project?.budget || 0);
  const spent = Number(project?.spentBudget || 0);
  const forecast = Number(project?.forecastBudget || budget || 0);
  const ctc = Math.max(0, forecast - spent);
  const variance = budget - forecast;
  const overall = (String(project?.ragStatus || "green").toLowerCase().includes("red")
    ? "red"
    : String(project?.ragStatus || "").toLowerCase().includes("amber")
      ? "amber"
      : "green") as Rag;

  const gatesFromMs = (milestones || []).slice(0, 8).map((m: any) => ({
    name: m.name || m.title || "Milestone",
    forecast: m.targetDate ? String(m.targetDate).slice(0, 10) : "TBC",
    actual: m.status === "complete" || m.status === "completed" ? String(m.targetDate || "").slice(0, 10) : "Draft",
  }));

  const riskIssues = (raidd || [])
    .filter((r: any) => r.type === "risk" || r.type === "issue")
    .slice(0, 8)
    .map((r: any, i: number) => ({
      id: r.ref || `${r.type === "issue" ? "I" : "R"}-${i + 1}`,
      text: r.title || r.description || "",
      owner: r.ownerName || r.owner || "—",
      rag: (String(r.ragStatus || r.severity || r.priority || "green").toLowerCase().includes("red")
        ? "red"
        : String(r.ragStatus || r.severity || "").toLowerCase().includes("amber")
          ? "amber"
          : "green") as Rag,
      kind: (r.type === "issue" ? "I" : "R") as "R" | "I",
    }));

  const wc = mondayOf();
  const strip: WeeklyStatusReport["periodStrip"] = [];
  for (let i = 0; i < 8; i++) {
    const d = new Date(wc + "T00:00:00");
    d.setDate(d.getDate() + i * 7);
    strip.push({ date: localIsoDate(d), rag: i === 0 ? overall : "green" });
  }

  return {
    id: String(Date.now()),
    title: `Week of ${fmtWeek(wc)}`,
    weekCommencing: wc,
    status: "draft",
    date: new Date().toISOString().slice(0, 10),
    summary: "",
    overallRag: overall,
    lastWeekOverallRag: "green",
    ragByType: { budget: "amber", resource: "green", schedule: "green", quality: "amber" },
    lastWeekRagByType: { budget: "green", resource: "green", schedule: "green", quality: "green" },
    commentary: "Scope:\nBudget:\nResources:\nSchedule:\nQuality:",
    achievements: [""],
    plannedNext: ["", "", "", ""],
    notAchieved: [""],
    gates: gatesFromMs.length
      ? gatesFromMs
      : ["Discover", "Prepare", "Explore", "Realise", "Deploy", "Run", "Service Transition", "Close"].map((name) => ({
          name, forecast: "TBC", actual: "Draft",
        })),
    lastGatesPassed: (gatesFromMs.length ? gatesFromMs.slice(0, 3) : [
      { name: "", forecast: "", actual: "" },
      { name: "", forecast: "", actual: "" },
      { name: "", forecast: "", actual: "" },
    ]).map((g) => ({
      name: g.name, date: g.actual && g.actual !== "Draft" ? g.actual : "",
    })),
    nextGates: (gatesFromMs.length ? gatesFromMs.slice(0, 3) : [
      { name: "", forecast: "TBC", actual: "" },
      { name: "", forecast: "TBC", actual: "" },
      { name: "", forecast: "TBC", actual: "" },
    ]).map((g, i) => ({
      name: g.name, date: i === 0 ? (g.forecast === "TBC" ? "" : g.forecast) : "",
    })),
    riskIssues: riskIssues.length
      ? riskIssues
      : [
          { id: "I-1", text: "", owner: "", rag: "amber", kind: "I" },
          { id: "R-1", text: "", owner: "", rag: "green", kind: "R" },
        ],
    financials: {
      baseline: budget,
      costToDate: spent,
      costToComplete: ctc,
      forecast,
      variance,
    },
    periodStrip: strip,
    progressPct: Number(project?.progress || 0),
  };
}

function BulletEditor({
  items, onChange, placeholder,
}: {
  items: string[]; onChange: (next: string[]) => void; placeholder?: string;
}) {
  const rows = items.length ? items : [""];
  return (
    <div className="space-y-1.5">
      {rows.map((item, idx) => (
        <div key={idx} className="group flex items-center gap-1.5">
          <span className="text-indigo-600 font-bold text-xs w-3 shrink-0">•</span>
          <Input
            value={item}
            placeholder={placeholder || `Item ${idx + 1}`}
            className="h-8 text-[12px] bg-muted/30 border-border/60 focus-visible:bg-background"
            onChange={(e) => {
              const next = [...rows];
              next[idx] = e.target.value;
              onChange(next);
            }}
          />
          <button
            type="button"
            className="shrink-0 h-7 w-7 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground"
            title="Remove"
            onClick={() => onChange(rows.filter((_, i) => i !== idx))}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-[11px] text-primary hover:underline px-1"
        onClick={() => onChange([...rows, ""])}
      >
        + Add line
      </button>
    </div>
  );
}

const cellInputClass =
  "h-8 text-[12px] bg-muted/25 border-border/50 shadow-none focus-visible:bg-background focus-visible:ring-1";

function CellInput({
  value, onChange, className, type = "text", placeholder, readOnly,
}: {
  value: string | number;
  onChange: (v: string) => void;
  className?: string;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <Input
      type={type}
      value={value}
      readOnly={readOnly}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        cellInputClass,
        type === "number" && "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
        className,
      )}
    />
  );
}

export function PmWeeklyStatusReport({ projectId, project }: { projectId: number; project?: any }) {
  const { toast } = useToast();
  const meta = (project?.metadata as Record<string, unknown>) || {};
  const saved = (meta.statusReports as WeeklyStatusReport[]) || [];

  const [variant, setVariant] = useState<VariantId>("standard");
  const [activeId, setActiveId] = useState<string | null>(saved[0]?.id || null);
  const [draft, setDraft] = useState<WeeklyStatusReport | null>(null);

  const { data: milestones = [] } = useQuery<any[]>({
    queryKey: ["/api/pm/projects", projectId, "milestones"],
  });
  const { data: raidd = [] } = useQuery<any[]>({
    queryKey: [`/api/pm/projects/${projectId}/raidd`],
  });

  const reports = useMemo(() => {
    // migrate legacy {title,summary} stubs
    return (saved || []).map((r: any) => {
      if (r.weekCommencing && r.ragByType) return r as WeeklyStatusReport;
      return {
        ...emptyReport(project, raidd, milestones),
        id: r.id || String(Date.now()),
        title: r.title,
        summary: r.summary,
        date: r.date,
        commentary: r.summary || "",
        weekCommencing: r.date || mondayOf(),
        status: "submitted" as const,
      };
    });
  }, [saved, project, raidd, milestones]);

  useEffect(() => {
    if (draft) return;
    if (activeId) {
      const found = reports.find((r) => r.id === activeId);
      if (found) setDraft({ ...found });
      else if (reports[0]) {
        setActiveId(reports[0].id);
        setDraft({ ...reports[0] });
      }
    } else if (reports[0]) {
      setActiveId(reports[0].id);
      setDraft({ ...reports[0] });
    }
  }, [reports, activeId, draft]);

  const persist = useMutation({
    mutationFn: async (nextList: WeeklyStatusReport[]) => {
      const res = await apiRequest("PUT", `/api/pm/projects/${projectId}`, {
        metadata: { ...meta, statusReports: nextList },
      });
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId] });
      toast({ title: "Status report saved" });
    },
    onError: (err) =>
      toast({
        title: "Failed to save report",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      }),
  });

  const startNew = () => {
    if (draft && !reports.some((r) => r.id === draft.id)) {
      const ok = window.confirm("Discard the unsaved week and start a new one?");
      if (!ok) return;
    }
    const r = emptyReport(project, raidd, milestones);
    setDraft(r);
    setActiveId(r.id);
  };

  const selectWeek = (id: string) => {
    const found = reports.find((r) => r.id === id);
    if (found) {
      if (draft && !reports.some((r) => r.id === draft.id) && draft.id !== id) {
        const ok = window.confirm("You have an unsaved week. Switch anyway?");
        if (!ok) return;
      }
      setActiveId(found.id);
      setDraft({ ...found });
      return;
    }
    if (draft && draft.id === id) setActiveId(draft.id);
  };

  const saveDraft = (status: "draft" | "submitted" = "draft") => {
    if (!draft) return;
    const nextReport: WeeklyStatusReport = {
      ...draft,
      status,
      title: draft.title || `Week of ${fmtWeek(draft.weekCommencing)}`,
      summary: (draft.commentary || "").slice(0, 180),
      date: draft.weekCommencing,
    };
    const others = reports.filter((r) => r.id !== nextReport.id);
    setDraft(nextReport);
    setActiveId(nextReport.id);
    persist.mutate([nextReport, ...others]);
  };

  if (!draft) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <p className="text-sm text-muted-foreground">No weekly status reports yet.</p>
        <Button size="sm" onClick={startNew}><Plus className="h-3.5 w-3.5 mr-1" /> Create first report</Button>
      </div>
    );
  }

  const showExpandedRaid = variant === "expanded";
  const showFinanceEmphasis = variant === "financial" || variant === "standard" || variant === "expanded";
  const showExecCompact = variant === "exec";
  const showAgile = variant === "agile";

  const patch = (partial: Partial<WeeklyStatusReport>) => setDraft((d) => (d ? { ...d, ...partial } : d));

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border overflow-hidden bg-background">
      <div className="shrink-0 border-b border-border/30 bg-card">
        <div className="px-3 sm:px-4 py-2.5 flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold truncate">
              {VARIANTS.find((v) => v.id === variant)?.label} Weekly Status Report
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              {project?.name || "Project"} · W/C {fmtWeek(draft.weekCommencing)}
            </div>
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <Select
              value={activeId || draft?.id || undefined}
              onValueChange={selectWeek}
            >
              <SelectTrigger
                className="h-8 w-[200px] sm:w-[220px] text-xs gap-2 shrink-0 [&>span]:min-w-0 [&>span]:flex-1 [&>span]:truncate [&>span]:text-left"
                data-testid="status-report-week-select"
              >
                <SelectValue placeholder="Select week">
                  {draft
                    ? (draft.title || `Week of ${fmtWeek(draft.weekCommencing)}`)
                    : "Select week"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {reports.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="text-xs">
                    <span className="truncate">{r.title || `Week of ${fmtWeek(r.weekCommencing)}`}</span>
                    <span className="ml-1.5 text-muted-foreground capitalize">· {r.status}</span>
                  </SelectItem>
                ))}
                {draft && !reports.some((r) => r.id === draft.id) && (
                  <SelectItem value={draft.id} className="text-xs">
                    <span className="truncate">{draft.title || `Week of ${fmtWeek(draft.weekCommencing)}`}</span>
                    <span className="ml-1.5 text-muted-foreground">· unsaved</span>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {draft && (
              <span
                className={cn(
                  "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  draft.status === "submitted"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : reports.some((r) => r.id === draft.id)
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {reports.some((r) => r.id === draft.id) ? draft.status : "unsaved"}
              </span>
            )}
          </div>
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={startNew}>
            <Plus className="h-3.5 w-3.5 mr-1" /> New week
          </Button>
          <Input
            type="date"
            value={draft.weekCommencing}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              patch({ weekCommencing: v, title: `Week of ${fmtWeek(v)}` });
            }}
            className="h-8 w-[150px] text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() =>
              printWeeklyStatusReport({
                projectName: project?.name || "Project",
                projectCode: project?.code || `PRJ-${projectId}`,
                manager: project?.managerName || project?.ownerName || "",
                portfolio: project?.portfolioName || project?.customer || "",
                variantLabel: VARIANTS.find((v) => v.id === variant)?.label || "Standard",
                draft,
              })
            }
          >
            <Printer className="h-3.5 w-3.5 mr-1" /> Print / PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={persist.isPending}
            onClick={() => saveDraft("draft")}
          >
            {persist.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            Save draft
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={persist.isPending}
            onClick={() => saveDraft("submitted")}
          >
            <Send className="h-3.5 w-3.5 mr-1" /> Submit
          </Button>
        </div>

        <div className={modulePageTabsWrapClass}>
          <div className={modulePageTabsListClass} role="tablist">
            {VARIANTS.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                title={v.desc}
                aria-selected={variant === v.id}
                data-state={variant === v.id ? "active" : "inactive"}
                onClick={() => setVariant(v.id)}
                className={variantTabClass}
                data-testid={`status-variant-${v.id}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 bg-muted/20">
          <div className="w-full rounded-xl border border-border overflow-hidden bg-card shadow-sm">
            {/* Dark header */}
            <div className="bg-[#1E1B4B] text-white">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-2.5 border-b border-white/10">
                <div className="flex items-center gap-2 font-extrabold text-[13px]">
                  <span className="h-7 w-7 rounded-md bg-indigo-600 inline-flex items-center justify-center text-[11px]">Ji</span>
                  Jiganto
                </div>
                <div className="text-center">
                  <div className="text-[13px] font-bold tracking-wide">WEEKLY PROJECT STATUS REPORT</div>
                  <div className="text-[10px] text-white/50">
                    {VARIANTS.find((v) => v.id === variant)?.label} variant
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-wide text-white/40">Week commencing</div>
                  <div className="text-sm font-bold">{fmtWeek(draft.weekCommencing)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 border-b border-white/10">
                {[
                  ["Project name", project?.name || "—"],
                  ["Project ID", project?.code || `PRJ-${projectId}`],
                  ["Programme manager", project?.managerName || project?.ownerName || "—"],
                  ["Portfolio", project?.portfolioName || project?.customer || "—"],
                ].map(([label, value]) => (
                  <div key={label} className="px-3.5 py-2 border-r border-white/10 last:border-0">
                    <div className="text-[9px] uppercase tracking-wide text-white/40">{label}</div>
                    <div className="text-[12px] font-semibold text-indigo-200 mt-0.5 truncate">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Milestones / gates row (Excel) */}
            {!showExecCompact && (
              <div className="border-b border-border overflow-x-auto">
                <table className="w-full text-[10px] min-w-[720px]">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-2 font-bold w-24">Milestones</th>
                      {draft.gates.map((g, i) => (
                        <th key={`gate-h-${i}`} className="p-2 font-bold text-center">{g.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border/60 bg-sky-50/50 dark:bg-sky-950/20">
                      <td className="p-2 font-semibold">Forecast</td>
                      {draft.gates.map((g, i) => (
                        <td key={`gate-f-${i}`} className="p-1">
                          <CellInput
                            value={g.forecast}
                            placeholder="TBC"
                            onChange={(v) => {
                              const gates = [...draft.gates];
                              gates[i] = { ...gates[i], forecast: v };
                              patch({ gates });
                            }}
                            className="text-center"
                          />
                        </td>
                      ))}
                    </tr>
                    <tr className="border-t border-border/60">
                      <td className="p-2 font-semibold">Actual</td>
                      {draft.gates.map((g, i) => (
                        <td key={`gate-a-${i}`} className="p-1">
                          <CellInput
                            value={g.actual}
                            placeholder="Draft"
                            onChange={(v) => {
                              const gates = [...draft.gates];
                              gates[i] = { ...gates[i], actual: v };
                              patch({ gates });
                            }}
                            className="text-center text-red-600 dark:text-red-400"
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <div className={cn("grid", showExecCompact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2")}>
              {/* LEFT */}
              <div className="border-r border-border">
                {/* RAG */}
                <section className="border-b border-border">
                  <div className="bg-muted/40 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wide">RAG Status</div>
                  <div className="p-2">
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-1 items-stretch">
                      <div className="text-center p-2">
                        <div className="text-[9px] font-bold uppercase text-muted-foreground mb-1.5 leading-tight">This week<br />overall</div>
                        <button type="button" className={ragBox(draft.overallRag, "lg")} onClick={() => patch({ overallRag: nextRag(draft.overallRag) })}>
                          {ragLetter(draft.overallRag)}
                        </button>
                      </div>
                      <div className="border-x border-border">
                        {(["budget", "resource", "schedule", "quality"] as const).map((key) => (
                          <div key={key} className="grid grid-cols-[1fr_70px_1fr] items-center border-b border-border/60 last:border-0">
                            <div className="flex justify-center py-1">
                              <button type="button" className={ragBox(draft.ragByType[key])} onClick={() => patch({ ragByType: { ...draft.ragByType, [key]: nextRag(draft.ragByType[key]) } })}>
                                {ragLetter(draft.ragByType[key])}
                              </button>
                            </div>
                            <div className="text-center text-[11px] font-semibold capitalize bg-muted/40 py-1">{key}</div>
                            <div className="flex justify-center py-1">
                              <button type="button" className={ragBox(draft.lastWeekRagByType[key])} onClick={() => patch({ lastWeekRagByType: { ...draft.lastWeekRagByType, [key]: nextRag(draft.lastWeekRagByType[key]) } })}>
                                {ragLetter(draft.lastWeekRagByType[key])}
                              </button>
                            </div>
                          </div>
                        ))}
                        <div className="grid grid-cols-[1fr_70px_1fr] text-[8px] text-muted-foreground text-center py-0.5 bg-indigo-500/5">
                          <span>This week</span><span /><span>Last week</span>
                        </div>
                      </div>
                      <div className="text-center p-2">
                        <div className="text-[9px] font-bold uppercase text-muted-foreground mb-1.5 leading-tight">Last week<br />overall</div>
                        <button type="button" className={ragBox(draft.lastWeekOverallRag, "lg")} onClick={() => patch({ lastWeekOverallRag: nextRag(draft.lastWeekOverallRag) })}>
                          {ragLetter(draft.lastWeekOverallRag)}
                        </button>
                      </div>
                    </div>
                    <div className="px-2 pt-2 border-t border-border/60 mt-1">
                      <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
                        <span>Overall project completion</span>
                        <span className="font-bold text-emerald-600">{draft.progressPct}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.min(100, Math.max(0, draft.progressPct))}
                          onChange={(e) => patch({ progressPct: Number(e.target.value) })}
                          className="flex-1 accent-emerald-600"
                        />
                        <div className="relative w-16 shrink-0">
                          <CellInput
                            type="number"
                            value={draft.progressPct}
                            onChange={(v) => patch({ progressPct: Math.min(100, Math.max(0, Number(v) || 0)) })}
                            className="pr-5 text-right"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {!showAgile && (
                  <section className="border-b border-border">
                    <div className="bg-muted/40 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wide">Project summary / RAG commentary</div>
                    <div className="p-3">
                      <Textarea
                        value={draft.commentary}
                        onChange={(e) => patch({ commentary: e.target.value })}
                        className="min-h-[110px] text-[12px] leading-relaxed bg-muted/25 border-border/50 focus-visible:bg-background"
                        placeholder={"Scope:\nBudget:\nResources:\nSchedule:\nQuality:"}
                      />
                    </div>
                  </section>
                )}

                <section className="border-b border-border">
                  <div className="bg-muted/40 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wide">
                    {showAgile ? "Sprint completed" : "Achievements this period"}
                  </div>
                  <div className="p-3">
                    <BulletEditor items={draft.achievements} onChange={(achievements) => patch({ achievements })} />
                  </div>
                </section>

                {!showExecCompact && (
                  <section className="border-b border-border last:border-0">
                    <div className="bg-muted/40 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wide">
                      Achievements planned but not achieved
                    </div>
                    <div className="p-3">
                      <BulletEditor items={draft.notAchieved} onChange={(notAchieved) => patch({ notAchieved })} />
                    </div>
                  </section>
                )}
              </div>

              {/* RIGHT */}
              <div>
                <section className="border-b border-border">
                  <div className="bg-muted/40 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wide">
                    {showAgile ? "Next sprint plan" : "Achievements planned for next period"}
                  </div>
                  <div className="p-3">
                    <BulletEditor items={draft.plannedNext} onChange={(plannedNext) => patch({ plannedNext })} />
                  </div>
                </section>

                {!showExecCompact && (
                  <section className="border-b border-border">
                    <div className="bg-muted/40 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wide">Gate tracking</div>
                    <div className="grid grid-cols-2 text-[11px]">
                      <div className="border-r border-border p-2 space-y-1.5">
                        <div className="text-[9px] font-bold text-muted-foreground">Last gate passed / date</div>
                        {(draft.lastGatesPassed.length ? draft.lastGatesPassed : [{ name: "", date: "" }]).map((g, i) => (
                          <div key={i} className="flex gap-1.5">
                            <CellInput
                              value={g.name}
                              placeholder="Gate name"
                              className="flex-1"
                              onChange={(v) => {
                                const lastGatesPassed = [...(draft.lastGatesPassed.length ? draft.lastGatesPassed : [{ name: "", date: "" }])];
                                lastGatesPassed[i] = { ...lastGatesPassed[i], name: v };
                                patch({ lastGatesPassed });
                              }}
                            />
                            <CellInput
                              value={g.date}
                              placeholder="Date"
                              className="w-[110px]"
                              onChange={(v) => {
                                const lastGatesPassed = [...(draft.lastGatesPassed.length ? draft.lastGatesPassed : [{ name: "", date: "" }])];
                                lastGatesPassed[i] = { ...lastGatesPassed[i], date: v };
                                patch({ lastGatesPassed });
                              }}
                            />
                          </div>
                        ))}
                        <button
                          type="button"
                          className="text-[11px] text-primary hover:underline"
                          onClick={() => patch({ lastGatesPassed: [...draft.lastGatesPassed, { name: "", date: "" }] })}
                        >
                          + Add gate
                        </button>
                      </div>
                      <div className="p-2 space-y-1.5">
                        <div className="text-[9px] font-bold text-muted-foreground">Next gate(s) / date</div>
                        {(draft.nextGates.length ? draft.nextGates : [{ name: "", date: "" }]).map((g, i) => (
                          <div key={i} className="flex gap-1.5">
                            <CellInput
                              value={g.name}
                              placeholder="Gate name"
                              className="flex-1"
                              onChange={(v) => {
                                const nextGates = [...(draft.nextGates.length ? draft.nextGates : [{ name: "", date: "" }])];
                                nextGates[i] = { ...nextGates[i], name: v };
                                patch({ nextGates });
                              }}
                            />
                            <CellInput
                              value={g.date}
                              placeholder="Date"
                              className="w-[110px]"
                              onChange={(v) => {
                                const nextGates = [...(draft.nextGates.length ? draft.nextGates : [{ name: "", date: "" }])];
                                nextGates[i] = { ...nextGates[i], date: v };
                                patch({ nextGates });
                              }}
                            />
                          </div>
                        ))}
                        <button
                          type="button"
                          className="text-[11px] text-primary hover:underline"
                          onClick={() => patch({ nextGates: [...draft.nextGates, { name: "", date: "" }] })}
                        >
                          + Add gate
                        </button>
                      </div>
                    </div>
                  </section>
                )}

                <section className="border-b border-border">
                  <div className="bg-muted/40 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wide">
                    {showExpandedRaid ? "Risks / Issues (Expanded)" : "Risks / Issues"}
                  </div>
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-muted/30 text-muted-foreground text-left">
                        <th className="p-2 font-semibold w-14">ID</th>
                        <th className="p-2 font-semibold">Risk / Issue</th>
                        <th className="p-2 font-semibold w-24">Owner</th>
                        <th className="p-2 font-semibold w-12 text-center">RAG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.riskIssues
                        .map((row, i) => ({ row, i }))
                        .filter(({ i }) => showExpandedRaid || i < 5)
                        .map(({ row, i }) => (
                        <tr key={`ri-${i}`} className="border-t border-border/50">
                          <td className="p-1">
                            <CellInput
                              value={row.id}
                              className="font-mono w-14"
                              onChange={(v) => {
                                const riskIssues = [...draft.riskIssues];
                                riskIssues[i] = { ...riskIssues[i], id: v };
                                patch({ riskIssues });
                              }}
                            />
                          </td>
                          <td className="p-1">
                            <CellInput
                              value={row.text}
                              placeholder="Describe risk or issue…"
                              onChange={(v) => {
                                const riskIssues = [...draft.riskIssues];
                                riskIssues[i] = { ...riskIssues[i], text: v };
                                patch({ riskIssues });
                              }}
                            />
                          </td>
                          <td className="p-1">
                            <CellInput
                              value={row.owner}
                              placeholder="Owner"
                              className="w-24"
                              onChange={(v) => {
                                const riskIssues = [...draft.riskIssues];
                                riskIssues[i] = { ...riskIssues[i], owner: v };
                                patch({ riskIssues });
                              }}
                            />
                          </td>
                          <td className="p-1 text-center">
                            <button
                              type="button"
                              title="Click to cycle RAG"
                              className={ragBox(row.rag)}
                              onClick={() => {
                                const riskIssues = [...draft.riskIssues];
                                riskIssues[i] = { ...riskIssues[i], rag: nextRag(row.rag) };
                                patch({ riskIssues });
                              }}
                            >
                              {ragLetter(row.rag)}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button
                    type="button"
                    className="w-full text-center text-[11px] text-primary py-1.5 border-t border-dashed border-border hover:underline"
                    onClick={() =>
                      patch({
                        riskIssues: [
                          ...draft.riskIssues,
                          { id: `R-${draft.riskIssues.length + 1}`, text: "", owner: "", rag: "green", kind: "R" },
                        ],
                      })
                    }
                  >
                    + Add risk / issue
                  </button>
                </section>

                {showFinanceEmphasis && (
                  <section className="border-b border-border">
                    <div className="bg-muted/40 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wide">Financial summary</div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 text-center text-[11px]">
                      {([
                        ["Baseline Budget (A)", "baseline"],
                        ["Cost To Date (B)", "costToDate"],
                        ["Cost to Complete (C)", "costToComplete"],
                        ["Forecast Total Cost", "forecast"],
                        ["Variance to Baseline", "variance"],
                      ] as const).map(([label, key]) => (
                        <div key={key} className="p-2 border-r border-border last:border-0">
                          <div className="text-[9px] font-semibold uppercase text-muted-foreground mb-1.5 leading-tight">{label}</div>
                          <CellInput
                            type="number"
                            value={draft.financials[key]}
                            readOnly={key === "variance"}
                            onChange={(v) => {
                              if (key === "variance") return;
                              const financials = { ...draft.financials, [key]: Number(v) || 0 };
                              financials.variance = financials.baseline - financials.forecast;
                              patch({ financials });
                            }}
                            className={cn(
                              "text-center text-sm font-bold",
                              key === "variance" && "cursor-default",
                              key === "variance" && draft.financials.variance < 0 && "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
                              key === "variance" && draft.financials.variance > 0 && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
                            )}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>

            {/* Period RAG strip */}
            {!showExecCompact && (
              <div className="border-t border-border overflow-x-auto">
                <div className="bg-muted/40 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-wide">Reporting period</div>
                <div className="flex min-w-[640px]">
                  {draft.periodStrip.map((p, i) => (
                    <div key={i} className="flex-1 border-r border-border last:border-0 text-center">
                      <div className="text-[10px] py-1 border-b border-border/60">{fmtWeek(p.date)}</div>
                      <button
                        type="button"
                        className={cn("w-full h-8", ragBox(p.rag).replace("inline-flex", "flex").replace("h-5 w-7", "h-8 w-full rounded-none"))}
                        onClick={() => {
                          const periodStrip = [...draft.periodStrip];
                          periodStrip[i] = { ...periodStrip[i], rag: nextRag(p.rag) };
                          patch({ periodStrip });
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="text-[9px] text-muted-foreground px-3 py-1">Overall RAG by week — click a cell to cycle</div>
              </div>
            )}
          </div>
        </div>
    </div>
  );
}

