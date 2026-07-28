import { useMemo, useState, useEffect, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Printer, Save, Send } from "lucide-react";
import { printWeeklyStatusReport } from "@/lib/print-weekly-status";
import {
  R360,
  PUBLISH_GRADIENT,
  r360Chrome,
  ragPillStyle,
  normR360Rag,
} from "@/components/portfolio/report-360-theme";

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

const RAG_CYCLE: Rag[] = ["green", "amber", "red", "blue"];

function nextRag(r: Rag): Rag {
  const i = RAG_CYCLE.indexOf(r);
  return RAG_CYCLE[(i + 1) % RAG_CYCLE.length];
}

function ragLetter(r: Rag) {
  return r === "green" ? "G" : r === "amber" ? "A" : r === "red" ? "R" : "B";
}

function RagToggle({
  value,
  onCycle,
  size = "sm",
}: {
  value: Rag;
  onCycle: () => void;
  size?: "sm" | "lg";
}) {
  const { resolvedTheme } = useTheme();
  const style = ragPillStyle(normR360Rag(value), resolvedTheme === "dark");
  return (
    <button
      type="button"
      title="Click to cycle RAG"
      onClick={onCycle}
      className={cn(
        "inline-flex items-center justify-center font-extrabold select-none transition-opacity hover:opacity-90",
        size === "lg"
          ? "h-12 min-w-[72px] rounded-lg px-3 text-sm"
          : "h-6 min-w-[36px] rounded-md px-2 text-[10px]",
      )}
      style={{ background: style.background, color: style.color }}
    >
      {ragLetter(value)}
    </button>
  );
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl overflow-hidden bg-card border border-border/40 shadow-sm", className)}>
      {children}
    </div>
  );
}

function CardHead({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-border/30 bg-muted/15">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        {subtitle && <div className="text-xs mt-0.5 text-muted-foreground">{subtitle}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function Avatar({ name, size = 20 }: { name?: string | null; size?: number }) {
  const label = name || "?";
  const parts = label.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : (parts[0] || "?").slice(0, 2).toUpperCase();
  const palette = [R360.brand, R360.green, R360.violet, R360.amber, R360.teal, R360.blue];
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold text-white shrink-0 text-[10px]"
      style={{ width: size, height: size, background: palette[h % palette.length], fontSize: Math.max(8, Math.round(size * 0.36)) }}
    >
      {initials}
    </span>
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
          <span className="font-bold text-xs w-3 shrink-0" style={{ color: R360.brand }}>•</span>
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

export function PmWeeklyStatusReport({
  projectId,
  project,
  onClose,
}: {
  projectId: number;
  project?: any;
  onClose?: () => void;
}) {
  const { toast } = useToast();
  const { resolvedTheme } = useTheme();
  const chrome = r360Chrome(resolvedTheme === "dark");
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
      <div className="flex h-full min-h-0 flex-col rounded-xl overflow-hidden border border-border bg-background">
        <div className="flex flex-col items-center justify-center py-16 gap-3 bg-muted/20 flex-1">
          <p className="text-sm text-muted-foreground">No weekly status reports yet.</p>
          <Button size="sm" style={{ background: R360.brand, color: "#fff" }} onClick={startNew}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Create first report
          </Button>
        </div>
      </div>
    );
  }

  const showExpandedRaid = variant === "expanded";
  const showFinanceEmphasis = variant === "financial" || variant === "standard" || variant === "expanded";
  const showExecCompact = variant === "exec";
  const showAgile = variant === "agile";
  const patch = (partial: Partial<WeeklyStatusReport>) => setDraft((d) => (d ? { ...d, ...partial } : d));
  const projectName = project?.name || "Project";
  const manager = project?.managerName || project?.ownerName || "";
  const portfolio = project?.portfolioName || project?.customer || "";
  const projectCode = project?.code || `PRJ-${projectId}`;
  const isPersisted = reports.some((r) => r.id === draft.id);
  const statusLabel = isPersisted ? draft.status : "unsaved";
  const overallStyle = ragPillStyle(normR360Rag(draft.overallRag), resolvedTheme === "dark");

  const metaItems: Array<{ label: string; value: string; person?: boolean; mono?: boolean }> = [
    { label: "Project ID", value: projectCode, mono: true },
    { label: "Programme manager", value: manager || "—", person: !!manager },
    { label: "Portfolio", value: portfolio || "—" },
    { label: "Week commencing", value: fmtWeek(draft.weekCommencing) },
    { label: "Status", value: statusLabel },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl overflow-hidden border border-border bg-background" data-testid="weekly-status-report">
      {/* Header — match 360 chrome */}
      <div className="shrink-0 px-4 sm:px-5 pt-3 pb-2.5 bg-card border-b border-border/30">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
          <div className="min-w-0">
            <div className="text-sm sm:text-base font-semibold tracking-tight truncate text-foreground">
              {projectName} — Weekly Status Report
            </div>
            <div className="text-xs mt-0.5 text-muted-foreground">
              {VARIANTS.find((v) => v.id === variant)?.label} · W/C {fmtWeek(draft.weekCommencing)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <Select value={activeId || draft.id} onValueChange={selectWeek}>
              <SelectTrigger
                className="h-8 w-[180px] sm:w-[210px] text-xs gap-2 shrink-0 [&>span]:min-w-0 [&>span]:flex-1 [&>span]:truncate [&>span]:text-left"
                data-testid="status-report-week-select"
              >
                <SelectValue placeholder="Select week">
                  {draft.title || `Week of ${fmtWeek(draft.weekCommencing)}`}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {reports.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="text-xs">
                    <span className="truncate">{r.title || `Week of ${fmtWeek(r.weekCommencing)}`}</span>
                    <span className="ml-1.5 text-muted-foreground capitalize">· {r.status}</span>
                  </SelectItem>
                ))}
                {!isPersisted && (
                  <SelectItem value={draft.id} className="text-xs">
                    <span className="truncate">{draft.title || `Week of ${fmtWeek(draft.weekCommencing)}`}</span>
                    <span className="ml-1.5 text-muted-foreground">· unsaved</span>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={draft.weekCommencing}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                patch({ weekCommencing: v, title: `Week of ${fmtWeek(v)}` });
              }}
              className="h-8 w-[140px] text-xs"
            />
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={startNew}>
              <Plus className="h-3.5 w-3.5" /> New week
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() =>
                printWeeklyStatusReport({
                  projectName,
                  projectCode,
                  manager,
                  portfolio,
                  variantLabel: VARIANTS.find((v) => v.id === variant)?.label || "Standard",
                  draft,
                })
              }
            >
              <Printer className="h-3.5 w-3.5" /> Export PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              disabled={persist.isPending}
              onClick={() => saveDraft("draft")}
            >
              {persist.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save draft
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs gap-1.5 border-0 hover:opacity-90"
              style={{ background: PUBLISH_GRADIENT, color: "#fff" }}
              disabled={persist.isPending}
              onClick={() => saveDraft("submitted")}
            >
              {persist.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Submit report
            </Button>
            {onClose && (
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose}>Close</Button>
            )}
          </div>
        </div>

        <div className="flex overflow-x-auto border-t border-border/30 pt-2.5" style={{ scrollbarWidth: "none" }}>
          {metaItems.map((m, i) => (
            <div
              key={m.label}
              className={cn("pr-4 mr-4 shrink-0", i < metaItems.length - 1 && "border-r border-border/30")}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide mb-0.5 text-muted-foreground">{m.label}</div>
              {m.person ? (
                <div className="flex items-center gap-1.5">
                  <Avatar name={m.value} size={20} />
                  <div className="text-xs font-semibold text-foreground">{m.value}</div>
                </div>
              ) : (
                <div
                  className="text-xs font-semibold text-foreground capitalize"
                  style={m.mono ? { fontFamily: "ui-monospace, SFMono-Regular, monospace" } : undefined}
                >
                  {m.value}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Variant tabs — same pattern as 360 section tabs */}
      <div className="shrink-0 flex overflow-x-auto bg-card border-b border-border" style={{ scrollbarWidth: "none" }} role="tablist">
        {VARIANTS.map((v) => {
          const active = variant === v.id;
          return (
            <button
              key={v.id}
              type="button"
              role="tab"
              title={v.desc}
              aria-selected={active}
              data-state={active ? "active" : "inactive"}
              data-testid={`status-variant-${v.id}`}
              onClick={() => setVariant(v.id)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 h-10 whitespace-nowrap text-xs shrink-0 border-b-2 -mb-px",
                active
                  ? "font-semibold border-primary text-primary"
                  : "font-medium border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {v.label}
            </button>
          );
        })}
      </div>

      {/* Workspace */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-3.5 bg-muted/20">
        <div className="rounded-xl p-4 sm:p-5 flex flex-wrap items-center gap-5 bg-card border border-border/40 shadow-sm">
          <div className="flex-1 min-w-[220px]">
            <div className="text-sm font-semibold text-foreground mb-1">{projectName}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
              <div>
                Code{" "}
                <span className="font-semibold text-foreground ml-1 font-mono">{projectCode}</span>
              </div>
              {manager && (
                <div>
                  Manager <span className="font-semibold text-foreground ml-1">{manager}</span>
                </div>
              )}
              {portfolio && (
                <div>
                  Portfolio <span className="font-semibold text-foreground ml-1">{portfolio}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <div className="text-center rounded-lg px-3.5 py-2.5 bg-muted/40 min-w-[72px]">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Overall</div>
              <div className="text-xl font-bold tabular-nums mt-0.5" style={{ color: overallStyle.color }}>
                {ragLetter(draft.overallRag)}
              </div>
            </div>
            <div className="text-center rounded-lg px-3.5 py-2.5 bg-muted/40 min-w-[72px]">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Progress</div>
              <div className="text-xl font-bold tabular-nums text-foreground">{draft.progressPct}%</div>
            </div>
            <div className="text-center rounded-lg px-3.5 py-2.5 bg-muted/40 min-w-[88px]">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Week</div>
              <div className="text-sm font-bold text-foreground mt-1">{fmtWeek(draft.weekCommencing)}</div>
            </div>
          </div>
        </div>

        {!showExecCompact && (
          <Card>
            <CardHead title="Milestones / gates" subtitle="Forecast vs actual by phase" />
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] min-w-[720px]">
                <thead>
                  <tr className="bg-muted/30 text-muted-foreground">
                    <th className="text-left p-2.5 font-semibold w-24">Milestones</th>
                    {draft.gates.map((g, i) => (
                      <th key={`gate-h-${i}`} className="p-2.5 font-semibold text-center">{g.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border/40" style={{ background: chrome.blueL }}>
                    <td className="p-2.5 font-semibold text-foreground">Forecast</td>
                    {draft.gates.map((g, i) => (
                      <td key={`gate-f-${i}`} className="p-1.5">
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
                  <tr className="border-t border-border/40">
                    <td className="p-2.5 font-semibold text-foreground">Actual</td>
                    {draft.gates.map((g, i) => (
                      <td key={`gate-a-${i}`} className="p-1.5">
                        <CellInput
                          value={g.actual}
                          placeholder="Draft"
                          onChange={(v) => {
                            const gates = [...draft.gates];
                            gates[i] = { ...gates[i], actual: v };
                            patch({ gates });
                          }}
                          className="text-center"
                        />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <div className={cn("grid gap-3.5", showExecCompact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2")}>
          <div className="space-y-3.5">
            <Card>
              <CardHead title="RAG status" subtitle="This week vs last week · click to cycle" />
              <div className="p-4">
                <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-stretch">
                  <div className="text-center rounded-lg p-3 bg-primary/10 ring-1 ring-primary/20">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-primary mb-2 leading-tight">
                      This week<br />overall
                    </div>
                    <RagToggle value={draft.overallRag} size="lg" onCycle={() => patch({ overallRag: nextRag(draft.overallRag) })} />
                  </div>
                  <div className="rounded-lg border border-border/40 overflow-hidden">
                    {(["budget", "resource", "schedule", "quality"] as const).map((key) => (
                      <div key={key} className="grid grid-cols-[1fr_70px_1fr] items-center border-b border-border/40 last:border-0 bg-muted/20">
                        <div className="flex justify-center py-1.5">
                          <RagToggle
                            value={draft.ragByType[key]}
                            onCycle={() => patch({ ragByType: { ...draft.ragByType, [key]: nextRag(draft.ragByType[key]) } })}
                          />
                        </div>
                        <div className="text-center text-[11px] font-semibold capitalize py-1.5 bg-muted/40">{key}</div>
                        <div className="flex justify-center py-1.5 opacity-80">
                          <RagToggle
                            value={draft.lastWeekRagByType[key]}
                            onCycle={() =>
                              patch({
                                lastWeekRagByType: {
                                  ...draft.lastWeekRagByType,
                                  [key]: nextRag(draft.lastWeekRagByType[key]),
                                },
                              })
                            }
                          />
                        </div>
                      </div>
                    ))}
                    <div className="grid grid-cols-[1fr_70px_1fr] text-[9px] text-muted-foreground text-center py-1 bg-muted/30">
                      <span>This week</span><span /><span>Last week</span>
                    </div>
                  </div>
                  <div className="text-center rounded-lg p-3 bg-muted/50">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 leading-tight">
                      Last week<br />overall
                    </div>
                    <RagToggle
                      value={draft.lastWeekOverallRag}
                      size="lg"
                      onCycle={() => patch({ lastWeekOverallRag: nextRag(draft.lastWeekOverallRag) })}
                    />
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border/40">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
                    <span className="font-semibold uppercase tracking-wide">Overall project completion</span>
                    <span className="font-bold tabular-nums" style={{ color: R360.teal }}>{draft.progressPct}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.min(100, Math.max(0, draft.progressPct))}
                      onChange={(e) => patch({ progressPct: Number(e.target.value) })}
                      className="flex-1"
                      style={{ accentColor: R360.brand }}
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
            </Card>

            {!showAgile && (
              <Card>
                <CardHead title="Project summary / RAG commentary" subtitle="Scope · Budget · Resources · Schedule · Quality" />
                <div className="p-4">
                  <Textarea
                    value={draft.commentary}
                    onChange={(e) => patch({ commentary: e.target.value })}
                    className="min-h-[110px] text-[12px] leading-relaxed bg-muted/25 border-border/50 focus-visible:bg-background"
                    placeholder={"Scope:\nBudget:\nResources:\nSchedule:\nQuality:"}
                  />
                </div>
              </Card>
            )}

            <Card>
              <CardHead title={showAgile ? "Sprint completed" : "Achievements this period"} />
              <div className="p-4">
                <BulletEditor items={draft.achievements} onChange={(achievements) => patch({ achievements })} />
              </div>
            </Card>

            {!showExecCompact && (
              <Card>
                <CardHead title="Achievements planned but not achieved" />
                <div className="p-4">
                  <BulletEditor items={draft.notAchieved} onChange={(notAchieved) => patch({ notAchieved })} />
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-3.5">
            <Card>
              <CardHead title={showAgile ? "Next sprint plan" : "Achievements planned for next period"} />
              <div className="p-4">
                <BulletEditor items={draft.plannedNext} onChange={(plannedNext) => patch({ plannedNext })} />
              </div>
            </Card>

            {!showExecCompact && (
              <Card>
                <CardHead title="Gate tracking" subtitle="Last passed and upcoming gates" />
                <div className="grid grid-cols-1 sm:grid-cols-2 text-[11px]">
                  <div className="border-b sm:border-b-0 sm:border-r border-border/40 p-4 space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Last gate passed / date</div>
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
                  <div className="p-4 space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Next gate(s) / date</div>
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
              </Card>
            )}

            <Card>
              <CardHead
                title={showExpandedRaid ? "Risks / Issues (Expanded)" : "Risks / Issues"}
                subtitle="Click RAG to cycle"
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px]"
                    onClick={() =>
                      patch({
                        riskIssues: [
                          ...draft.riskIssues,
                          { id: `R-${draft.riskIssues.length + 1}`, text: "", owner: "", rag: "green", kind: "R" },
                        ],
                      })
                    }
                  >
                    + Add
                  </Button>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-muted/30 text-muted-foreground text-left">
                      <th className="p-2.5 font-semibold w-14">ID</th>
                      <th className="p-2.5 font-semibold">Risk / Issue</th>
                      <th className="p-2.5 font-semibold w-24">Owner</th>
                      <th className="p-2.5 font-semibold w-14 text-center">RAG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.riskIssues
                      .map((row, i) => ({ row, i }))
                      .filter(({ i }) => showExpandedRaid || i < 5)
                      .map(({ row, i }) => (
                        <tr key={`ri-${i}`} className="border-t border-border/40">
                          <td className="p-1.5">
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
                          <td className="p-1.5">
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
                          <td className="p-1.5">
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
                          <td className="p-1.5 text-center">
                            <RagToggle
                              value={row.rag}
                              onCycle={() => {
                                const riskIssues = [...draft.riskIssues];
                                riskIssues[i] = { ...riskIssues[i], rag: nextRag(row.rag) };
                                patch({ riskIssues });
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {showFinanceEmphasis && (
              <Card>
                <CardHead title="Financial summary" subtitle="Baseline · cost to date · forecast · variance" />
                <div className="grid grid-cols-2 sm:grid-cols-5 text-center text-[11px]">
                  {([
                    ["Baseline Budget (A)", "baseline"],
                    ["Cost To Date (B)", "costToDate"],
                    ["Cost to Complete (C)", "costToComplete"],
                    ["Forecast Total Cost", "forecast"],
                    ["Variance to Baseline", "variance"],
                  ] as const).map(([label, key]) => (
                    <div key={key} className="p-3 border-r border-border/40 last:border-0">
                      <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 leading-tight">{label}</div>
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
                          key === "variance" && draft.financials.variance < 0 && "text-red-700 dark:text-red-300",
                          key === "variance" && draft.financials.variance > 0 && "text-emerald-700 dark:text-emerald-300",
                        )}
                      />
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>

        {!showExecCompact && (
          <Card>
            <CardHead title="Reporting period" subtitle="Overall RAG by week — click a cell to cycle" />
            <div className="overflow-x-auto p-3">
              <div className="flex min-w-[640px] rounded-lg overflow-hidden border border-border/40">
                {draft.periodStrip.map((p, i) => {
                  const s = ragPillStyle(normR360Rag(p.rag), resolvedTheme === "dark");
                  return (
                    <div key={i} className="flex-1 border-r border-border/40 last:border-0 text-center">
                      <div className="text-[10px] py-1.5 border-b border-border/40 bg-muted/20 font-semibold text-muted-foreground">
                        {fmtWeek(p.date)}
                      </div>
                      <button
                        type="button"
                        className="w-full h-9 font-extrabold text-[11px] transition-opacity hover:opacity-90"
                        style={{ background: s.background, color: s.color }}
                        onClick={() => {
                          const periodStrip = [...draft.periodStrip];
                          periodStrip[i] = { ...periodStrip[i], rag: nextRag(p.rag) };
                          patch({ periodStrip });
                        }}
                      >
                        {ragLetter(p.rag)}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
