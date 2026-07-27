import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, FileDown, Printer, Save, Send, ExternalLink, Eye } from "lucide-react";
import { apiRequest, fetchWithAuth, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Report360Data, RagLevel } from "./types";
import { formatBudget } from "./rag-utils";
import { cn } from "@/lib/utils";
import { print360Report } from "@/lib/print-360-report";
import {
  R360,
  ragPillStyle,
  ragBarColor,
  statusPillStyle,
  PUBLISH_GRADIENT,
  normR360Rag,
  r360Chrome,
  type R360Rag,
} from "./report-360-theme";
import { TABLE_HEAD } from "@/lib/crm-360-layout";
import { Level1PlanGantt, type Level1PlanRow } from "./Level1PlanGantt";
import {
  ActivityPlanMatrix,
  ACTIVITY_LIBRARY,
  createEmptyActivityRelease,
  type ActivityCode,
  type ActivityRelease,
} from "./ActivityPlanMatrix";
import { useTheme } from "@/hooks/use-theme";

/** Matches client pack: jiganto-360-report (3).html */
type SectionId =
  | "exec" | "gantt" | "activity" | "risks" | "issues"
  | "ws" | "dec" | "del" | "dep" | "act" | "team" | "budget" | "readiness";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "exec", label: "Executive Summary" },
  { id: "gantt", label: "Level 1 Plan" },
  { id: "activity", label: "Activity Plan" },
  { id: "risks", label: "Risks" },
  { id: "issues", label: "Issues" },
  { id: "ws", label: "Workstreams" },
  { id: "dec", label: "Decisions" },
  { id: "del", label: "Deliverables" },
  { id: "dep", label: "Dependencies" },
  { id: "act", label: "Actions" },
  { id: "team", label: "Project Team" },
  { id: "budget", label: "Budget" },
  { id: "readiness", label: "Readiness Board" },
];

const SECTION_IDS = new Set<string>(SECTIONS.map((s) => s.id));

type HealthIndicator = { id: string; label: string; pct: number; rag: RagLevel };
type DecisionRow = {
  dbId?: number;
  id: string;
  text: string;
  owner: string;
  impact?: string;
  requiredBy?: string;
  status?: string;
  forum?: string;
};
type ActionRow = {
  dbId?: number;
  id: string;
  text: string;
  owner: string;
  due: string;
  status?: string;
  raisedFrom?: string;
  raised?: string;
};

const isOpenRaiddStatus = (status: string | null | undefined) => {
  const s = (status || "open").toLowerCase();
  return !["closed", "resolved", "cancelled", "done", "complete", "completed"].includes(s);
};

function mapRaidDecisions(raid: Report360Data["raidSummary"] | undefined): DecisionRow[] {
  return (raid?.decisions || []).map((d, i) => ({
    dbId: d.id,
    id: d.ref || `D-${d.id ?? i + 1}`,
    text: d.text || "",
    owner: d.owner || "",
    impact: d.impact || "",
    requiredBy: d.decisionDate || "",
    status: d.status || "",
    forum: d.forum || "",
  }));
}

function mapRaidActions(raid: Report360Data["raidSummary"] | undefined): ActionRow[] {
  return (raid?.actions || []).map((a, i) => ({
    dbId: a.id,
    id: a.ref || `A-${a.id ?? i + 1}`,
    text: a.text || "",
    owner: a.owner || "",
    due: a.due || "",
    status: a.status || "",
    raisedFrom: a.raisedFrom || "",
    raised: a.raised || "",
  }));
}
type ReadinessItem = {
  id: string;
  phase: string;
  activity: string;
  criteria: string;
  rag: string;
  owner: string;
  commentary: string;
};
type RagComments = { schedule: string; cost: string; qualityRisk: string };
type TeamView = "list" | "org";
type RiskView = "top5" | "all";

function normRag(v?: string | null): RagLevel {
  const s = (v || "").toLowerCase();
  if (s.includes("red") || s === "r") return "red";
  if (s.includes("amber") || s.includes("yellow") || s === "a") return "amber";
  return "green";
}

function ragTextColor(rag: R360Rag): string {
  switch (rag) {
    case "amber": return R360.amberD;
    case "red": return R360.redD;
    case "blue": return R360.blueD;
    case "complete": return R360.tealD;
    case "neutral": return R360.text4;
    default: return R360.greenD;
  }
}

function fmtDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v.length <= 10 ? `${v}T00:00:00` : v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Normalize any date-like string for <input type="date">. */
function toDateInput(v?: string | null): string {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

const AVATAR_PALETTE = [R360.brand, R360.green, R360.violet, R360.amber, R360.teal, R360.blue, R360.pink, R360.redD];
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function avatarColor(name: string): string {
  return AVATAR_PALETTE[hashStr(name) % AVATAR_PALETTE.length];
}
function initialsOf(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const CHIP_PALETTE_LIGHT: { bg: string; fg: string }[] = [
  { bg: R360.amberL, fg: R360.amberD },
  { bg: R360.violetL, fg: R360.violetD },
  { bg: R360.tealL, fg: R360.tealD },
  { bg: R360.brandL, fg: R360.brandD },
  { bg: R360.pinkL, fg: R360.pinkD },
  { bg: R360.blueL, fg: R360.blueD },
];
function chipColor(text: string, dark = false) {
  const c = r360Chrome(dark);
  if (dark) {
    const darkPalette = [
      { bg: c.amberL, fg: c.amberFg },
      { bg: c.violetL, fg: c.violetFg },
      { bg: c.tealL, fg: c.tealFg },
      { bg: c.brandL, fg: c.brandFg },
      { bg: c.pinkL, fg: c.violetFg },
      { bg: c.blueL, fg: c.blueFg },
    ];
    return darkPalette[hashStr(text) % darkPalette.length];
  }
  return CHIP_PALETTE_LIGHT[hashStr(text) % CHIP_PALETTE_LIGHT.length];
}

const rowBorder: CSSProperties = { borderBottom: "1px solid hsl(var(--border) / 0.4)" };
const monoCell: CSSProperties = { fontFamily: "ui-monospace, SFMono-Regular, monospace" };
const monoMuted: CSSProperties = { ...monoCell, fontSize: 10 };
const editInputCls = "h-8 text-xs border-0 shadow-none px-1 bg-transparent text-foreground";
const selectCls = "h-8 rounded-md px-2 text-xs bg-background border border-border text-foreground";

/* ── CRM-aligned chrome; HTML hex only for RAG / status accents ── */

function Avatar({ name, size = 22 }: { name?: string | null; size?: number }) {
  const label = name || "Unassigned";
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold text-white shrink-0 text-[10px]"
      style={{ width: size, height: size, background: avatarColor(label), fontSize: Math.max(8, Math.round(size * 0.36)) }}
    >
      {initialsOf(name)}
    </span>
  );
}

function Rag({ value, size = "sm", dark = false }: { value?: string | null; size?: "sm" | "lg"; dark?: boolean }) {
  const rag = normR360Rag(value);
  const s = ragPillStyle(rag, dark);
  const label = value || (rag === "neutral" ? "—" : rag);
  if (size === "lg") {
    return (
      <span
        className="inline-flex items-center justify-center rounded-lg px-3.5 py-1.5 text-xs font-bold min-w-[72px] capitalize"
        style={{ background: s.background, color: s.color }}
      >
        {label}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold capitalize whitespace-nowrap"
      style={{ background: s.background, color: s.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
      {label}
    </span>
  );
}

function StatusBadge({ value, dark = false }: { value?: string | null; dark?: boolean }) {
  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  const s = statusPillStyle(value, dark);
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold whitespace-nowrap" style={{ background: s.background, color: s.color }}>
      {value}
    </span>
  );
}

function Chip({ label, dark = false }: { label?: string | null; dark?: boolean }) {
  if (!label) return <span className="text-xs text-muted-foreground">—</span>;
  const c = chipColor(label, dark);
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap" style={{ background: c.bg, color: c.fg }}>
      {label}
    </span>
  );
}

function Kpi({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div className="rounded-xl text-center p-3 bg-card border border-border/40 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wide mb-1 text-muted-foreground">{label}</div>
      <div className="text-xl font-bold tabular-nums text-foreground" style={{ color: color || undefined }}>{value}</div>
    </div>
  );
}

function Card({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={cn("rounded-xl overflow-hidden bg-card border border-border/40 shadow-sm", className)} style={style}>
      {children}
    </div>
  );
}

function CardHead({
  title, subtitle, action, bg, fg, subFg,
}: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; bg?: string; fg?: string; subFg?: string }) {
  // Light mode: ignore dark header fills (brandD / navy). Use CRM muted chrome unless a light accent bg is passed.
  const isDarkFill = bg && [R360.brandD, "#1E1B4B", "#1e1458"].includes(bg);
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border/30",
        !bg || isDarkFill ? "bg-muted/15" : undefined,
      )}
      style={!isDarkFill && bg ? { background: bg } : undefined}
    >
      <div className="min-w-0">
        <div className={cn("text-sm font-semibold", isDarkFill || !fg ? "text-foreground" : undefined)} style={!isDarkFill && fg ? { color: fg } : undefined}>
          {title}
        </div>
        {subtitle && (
          <div className={cn("text-xs mt-0.5", isDarkFill || !subFg ? "text-muted-foreground" : undefined)} style={!isDarkFill && subFg ? { color: subFg } : undefined}>
            {subtitle}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}

function Th({ children, align }: { children?: ReactNode; align?: "left" | "right" | "center" }) {
  return (
    <th className={cn(TABLE_HEAD, align === "right" && "text-right", align === "center" && "text-center")}>
      {children}
    </th>
  );
}

function Td({ children, align, style, className, colSpan }: { children?: ReactNode; align?: "left" | "right" | "center"; style?: CSSProperties; className?: string; colSpan?: number }) {
  return (
    <td
      className={cn("px-4 py-3 text-sm align-middle", align === "right" && "text-right", align === "center" && "text-center", className)}
      colSpan={colSpan}
      style={style}
    >
      {children}
    </td>
  );
}

function DataTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">{children}</table>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <p className="text-sm text-muted-foreground py-10 text-center px-5">{label}</p>
  );
}

function SectionHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <div className="text-sm font-semibold text-foreground">{title}</div>
        {subtitle && <div className="text-xs mt-0.5 text-muted-foreground">{subtitle}</div>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

function SharedDataNotice({ children, action }: { children: ReactNode; action?: ReactNode }) {
  const chrome = r360Chrome();
  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-medium"
      style={{ background: chrome.noticeBg, border: `1px solid ${chrome.noticeBorder}`, color: chrome.noticeFg }}
    >
      <Eye className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 min-w-[200px]">{children}</span>
      {action}
    </div>
  );
}

type EditSize = "sm" | "md" | "lg" | "xl";

/** Starting height (px) — drag the bottom edge to resize. */
const EDIT_FIELD_START_H: Record<EditSize, number> = {
  sm: 72,
  md: 96,
  lg: 168,
  xl: 220,
};

function EditField({
  value,
  onChange,
  onBlurCommit,
  placeholder,
  size = "md",
  borderColor,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Optional persist when leaving the field (e.g. workstream notes). */
  onBlurCommit?: (v: string) => void;
  placeholder?: string;
  size?: EditSize;
  borderColor?: string;
  className?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [height, setHeight] = useState(EDIT_FIELD_START_H[size]);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const next = Math.min(Math.round(window.innerHeight * 0.7), Math.max(40, d.startH + (e.clientY - d.startY)));
      setHeight(next);
    };
    const onUp = () => {
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  const startDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startY: e.clientY, startH: height };
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div className={cn("relative w-full", className)}>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onBlurCommit?.(value);
        }}
        className={cn(
          "w-full rounded-md rounded-b-none p-2.5 text-xs bg-background text-foreground",
          "resize-none overflow-y-auto !min-h-0",
        )}
        style={{
          height,
          border: focused ? `1px solid ${R360.brand}` : `1px dashed ${borderColor || "hsl(var(--border))"}`,
          borderBottom: "none",
          boxShadow: focused ? `0 0 0 2px ${R360.brandL}` : undefined,
        }}
      />
      {/* Bottom-edge resize bar (not corner grip) */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize text area"
        title="Drag up or down to resize"
        onPointerDown={startDrag}
        className={cn(
          "group flex h-3 w-full cursor-ns-resize items-center justify-center rounded-b-md",
          "border border-t-0 bg-muted/30 hover:bg-muted/50",
          focused ? "border-solid" : "border-dashed",
        )}
        style={{
          borderColor: focused ? R360.brand : borderColor || "hsl(var(--border))",
        }}
      >
        <span className="h-0.5 w-8 rounded-full bg-muted-foreground/35 group-hover:bg-muted-foreground/60" />
      </div>
    </div>
  );
}

function WorkstreamNoteField({
  note,
  onCommit,
}: {
  note: string;
  onCommit: (v: string) => void;
}) {
  const [draft, setDraft] = useState(note);
  useEffect(() => { setDraft(note); }, [note]);
  return (
    <EditField
      value={draft}
      onChange={setDraft}
      onBlurCommit={(v) => { if (v !== note) onCommit(v); }}
      size="sm"
      placeholder="Add workstream update for this period..."
    />
  );
}

function SegToggle<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg p-0.5 shrink-0 bg-muted/40">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap",
            value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
          )}
          style={value === o.value ? { color: R360.brand } : undefined}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ToggleLabel({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs font-medium whitespace-nowrap text-muted-foreground">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: R360.brand }} />
      {children}
    </label>
  );
}

function PrimaryBtn({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <Button
      type="button"
      size="sm"
      className="h-8 text-xs gap-1.5 border-0 text-white hover:opacity-90"
      style={{ background: R360.brand }}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}

function RagBar({ pct, rag }: { pct: number; rag: RagLevel }) {
  const chrome = r360Chrome();
  const clamped = Math.min(120, Math.max(0, pct));
  const color = ragBarColor(normR360Rag(rag));
  return (
    <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: chrome.border2 }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, clamped)}%`, background: color }} />
    </div>
  );
}

function buildDefaultIndicators(data: Report360Data): HealthIndicator[] {
  const health = data.healthDashboard;
  const fin = data.financialSummary;
  const budgetPct = fin.budget > 0 ? Math.round((fin.spent / fin.budget) * 100) : 0;
  const progressAvg =
    data.level1Plan.length > 0
      ? Math.round(data.level1Plan.reduce((s, p) => s + (p.progress || 0), 0) / data.level1Plan.length)
      : 0;
  return [
    { id: "time", label: "Schedule", pct: progressAvg, rag: normRag(health?.schedule) },
    { id: "cost", label: "Cost", pct: Math.min(100, budgetPct), rag: normRag(health?.budget) },
    { id: "quality", label: "Quality", pct: progressAvg, rag: normRag(health?.quality) },
    { id: "completion", label: "Completion", pct: progressAvg, rag: normRag(health?.delivery) },
    { id: "budget_util", label: "Budget utilisation", pct: budgetPct, rag: budgetPct > 100 ? "red" : normRag(health?.budget) },
  ];
}

function periodSummary(data: Report360Data) {
  const start = data.executiveSummary.startDate ? new Date(data.executiveSummary.startDate) : null;
  const endRaw = data.executiveSummary.revisedEnd || data.executiveSummary.plannedEnd;
  const end = endRaw ? new Date(endRaw) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { elapsed: 0, remaining: 0, total: 0, progress: 0 };
  }
  const msDay = 86400000;
  const total = Math.max(1, Math.round((end.getTime() - start.getTime()) / msDay));
  const elapsed = Math.max(0, Math.min(total, Math.round((Date.now() - start.getTime()) / msDay)));
  return { elapsed, remaining: Math.max(0, total - elapsed), total, progress: Math.round((elapsed / total) * 100) };
}

function isLevel1Rows(v: unknown): v is Level1PlanRow[] {
  return Array.isArray(v) && v.every((r) => r && typeof r === "object" && "kind" in r && "id" in r);
}

function isActivityPlan(v: unknown): v is ActivityRelease[] {
  return Array.isArray(v) && v.every((r) => r && typeof r === "object" && "lanes" in r && "id" in r);
}

type TeamMember = Report360Data["resourceSummary"][number];

function buildOrgChart(team: TeamMember[]) {
  const norm = (s?: string | null) => (s || "").toLowerCase();
  const progMgr = team.find((t) => norm(t.role).includes("programme manager") || norm(t.role).includes("program manager"));
  const pm = team.find((t) => t !== progMgr && norm(t.role).includes("project manager"));
  const pmo = team.find((t) => norm(t.role).includes("pmo"));
  const sponsor = team.find(
    (t) => t.memberType === "Customer" && (norm(t.role).includes("sponsor") || norm(t.role).includes("director") || norm(t.role).includes("officer")),
  );
  const top = progMgr || pm;
  const level2Candidates = [pm, pmo, sponsor].filter((t): t is TeamMember => !!t && t !== top);
  const level2 = level2Candidates.filter((t, i) => level2Candidates.findIndex((x) => x.id === t.id) === i);
  const usedIds = new Set([top, ...level2].filter(Boolean).map((t) => (t as TeamMember).id));
  const leads = team.filter((t) => !usedIds.has(t.id) && norm(t.role).includes("lead"));
  return { top, level2, leads };
}

const ORG_PALETTE = [
  { bg: R360.brandL, border: R360.brandM, fg: R360.brandD },
  { bg: R360.violetL, border: "#A78BFA", fg: R360.violetD },
  { bg: R360.greenL, border: R360.green, fg: R360.greenD },
  { bg: R360.amberL, border: "#FDE68A", fg: R360.amberD },
  { bg: R360.tealL, border: R360.teal, fg: R360.tealD },
];

function OrgNode({ title, name, org, big, colorIndex = 0 }: { title: string; name: string; org?: string | null; big?: boolean; colorIndex?: number }) {
  const chrome = r360Chrome();
  const dark = chrome.surface !== R360.surface;
  const palette = dark
    ? [
        { bg: chrome.brandL, border: R360.brandM, fg: chrome.brandFg },
        { bg: chrome.violetL, border: "#A78BFA", fg: chrome.violetFg },
        { bg: chrome.greenL, border: R360.green, fg: chrome.greenFg },
        { bg: chrome.amberL, border: R360.amber, fg: chrome.amberFg },
        { bg: chrome.tealL, border: R360.teal, fg: chrome.tealFg },
      ]
    : ORG_PALETTE;
  const c = big ? { bg: R360.brand, border: R360.brand, fg: "#fff" } : palette[colorIndex % palette.length];
  return (
    <div
      className="rounded-lg text-center"
      style={{ background: c.bg, border: big ? "none" : `1.5px solid ${c.border}`, padding: big ? "12px 20px" : "10px 16px", minWidth: big ? 180 : 150 }}
    >
      <div className="text-[9px] font-bold uppercase tracking-wide mb-1" style={{ color: big ? "rgba(255,255,255,.7)" : chrome.text4 }}>{title}</div>
      <div className="text-[13px] font-black" style={{ color: big ? "#fff" : c.fg }}>{name}</div>
      {org && <div className="text-[10px] mt-0.5" style={{ color: big ? "rgba(255,255,255,.65)" : chrome.text3 }}>{org}</div>}
    </div>
  );
}

function OrgChartView({ team }: { team: TeamMember[] }) {
  if (!team.length) {
    return (
      <Card style={{ padding: 24 }}>
        <EmptyState label="No team members listed. Add people under Team / Resources to generate an org chart." />
      </Card>
    );
  }
  const { top, level2, leads } = buildOrgChart(team);
  if (!top) {
    return (
      <Card style={{ padding: 24 }}>
        <EmptyState label="Add a Programme Manager or Project Manager role to generate an org chart." />
      </Card>
    );
  }
  return (
    <Card>
      <div className="p-6 flex flex-col items-center gap-4">
        <OrgNode title={top.role || "Lead"} name={top.name} org={top.organisation} big />
        {(level2.length > 0 || leads.length > 0) && <div style={{ width: 2, height: 20, background: R360.border }} />}
        {level2.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3">
            {level2.map((m, i) => <OrgNode key={m.id ?? m.name} title={m.role || "Team"} name={m.name} org={m.organisation} colorIndex={i} />)}
          </div>
        )}
        {leads.length > 0 && (
          <>
            <div style={{ width: 2, height: 20, background: R360.border }} />
            <div className="flex flex-wrap justify-center gap-2.5">
              {leads.map((m, i) => <OrgNode key={m.id ?? m.name} title={m.role || "Lead"} name={m.name} colorIndex={i + level2.length} />)}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

function TeamRow({
  r, onPatchRole, onPatchAllocation,
}: {
  r: TeamMember;
  onPatchRole: (r: TeamMember, role: string) => void;
  onPatchAllocation: (r: TeamMember, allocation: number) => void;
}) {
  return (
    <tr style={rowBorder}>
      <Td>
        <div className="flex items-center gap-2">
          <Avatar name={r.name} size={26} />
          <div className="text-[12px] font-extrabold text-foreground">{r.name}</div>
        </div>
      </Td>
      <Td className="text-[11px] text-muted-foreground">{r.organisation || "—"}</Td>
      <Td><Chip label={r.memberType || undefined} /></Td>
      <Td>
        <Input defaultValue={r.role || ""} className={editInputCls} onBlur={(e) => { if (e.target.value !== (r.role || "")) onPatchRole(r, e.target.value); }} />
      </Td>
      <Td className="text-[11px] text-muted-foreground">{r.workstream || "—"}</Td>
      <Td style={monoCell}>{fmtDate(r.startDate)}</Td>
      <Td style={monoCell}>{fmtDate(r.endDate)}</Td>
      <Td>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            defaultValue={r.allocation}
            className="h-7 w-14 text-[11px] font-mono border-0 shadow-none px-1 bg-transparent"
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v !== r.allocation) onPatchAllocation(r, v);
            }}
          />
          <span className="text-[10px] text-muted-foreground">%</span>
        </div>
      </Td>
      <Td>
        <StatusBadge value={r.isActive !== false ? "Active" : "Inactive"} />
      </Td>
    </tr>
  );
}

function BudgetCard({ label, value, sub, accent, valueColor, subColor }: { label: string; value: string; sub?: string; accent: string; valueColor?: string; subColor?: string }) {
  return (
    <div className="rounded-xl px-4 py-3.5 bg-card border border-border/40 shadow-sm" style={{ borderLeft: `4px solid ${accent}` }}>
      <div className="text-[10px] font-semibold uppercase tracking-wide mb-1 text-muted-foreground">{label}</div>
      <div className="text-xl font-bold tabular-nums text-foreground" style={{ color: valueColor }}>{value}</div>
      {sub && <div className="text-xs mt-1 text-muted-foreground" style={{ color: subColor }}>{sub}</div>}
    </div>
  );
}

export function Portfolio360ReportView({ projectId, onClose }: { projectId: number; onClose?: () => void }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const chrome = r360Chrome(dark);
  const seededForProject = useRef<number | null>(null);

  const [activeSection, setActiveSection] = useState<SectionId>("exec");
  const [narrative, setNarrative] = useState("");
  const [ragCommentary, setRagCommentary] = useState("");
  const [ragComments, setRagComments] = useState<RagComments>({ schedule: "", cost: "", qualityRisk: "" });
  const [indicators, setIndicators] = useState<HealthIndicator[]>([]);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [lowlights, setLowlights] = useState<string[]>([]);
  const [lastWeekRag, setLastWeekRag] = useState<Record<string, string>>({});
  const [level1Rows, setLevel1Rows] = useState<Level1PlanRow[]>([]);
  const [activityReleases, setActivityReleases] = useState<ActivityRelease[]>([]);
  const [activityLibrary, setActivityLibrary] = useState<ActivityCode[]>(ACTIVITY_LIBRARY);
  const [readinessItems, setReadinessItems] = useState<ReadinessItem[]>([]);
  const [readinessPhaseFilter, setReadinessPhaseFilter] = useState<string>("all");
  const [publishing, setPublishing] = useState(false);
  const [showResources, setShowResources] = useState(true);
  const [showRisk, setShowRisk] = useState(true);
  const [teamView, setTeamView] = useState<TeamView>("list");

  const [riskView, setRiskView] = useState<RiskView>("top5");
  const [riskPriorityFilter, setRiskPriorityFilter] = useState("all");
  const [riskCols, setRiskCols] = useState({ mitigation: true, likelihood: true, contingency: false, dateRaised: false });
  const [issueView, setIssueView] = useState<RiskView>("top5");
  const [issueCols, setIssueCols] = useState({ resolution: true, targetResolution: true, dateRaised: false });
  const [actionOwnerFilter, setActionOwnerFilter] = useState("all");
  const [actionStatusFilter, setActionStatusFilter] = useState("all");
  const [creatingKind, setCreatingKind] = useState<string | null>(null);
  const creatingLockRef = useRef(false);
  const readinessAddLockRef = useRef(false);
  const [activityYear, setActivityYear] = useState(() => new Date().getFullYear());

  const { data, isLoading, isError, error, refetch } = useQuery<Report360Data>({
    queryKey: [`/api/portfolio/reports/360/${projectId}`],
    staleTime: 30_000,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveSection("exec");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!data) return;
    if (seededForProject.current !== projectId) {
      seededForProject.current = null;
    }
    if (seededForProject.current === projectId) return;
    seededForProject.current = projectId;

    const overrides = data.sectionOverrides;
    const r360 = data.report360;
    const narrativeText =
      overrides?.ragCommentary ||
      r360?.ragCommentary ||
      data.executiveSummary?.narrative ||
      "";
    setNarrative(data.executiveSummary?.narrative || narrativeText);
    setRagCommentary(overrides?.ragCommentary || r360?.ragCommentary || "");
    setRagComments({
      schedule: overrides?.ragComments?.schedule || r360?.ragComments?.schedule || "",
      cost: overrides?.ragComments?.cost || r360?.ragComments?.cost || "",
      qualityRisk: overrides?.ragComments?.qualityRisk || r360?.ragComments?.qualityRisk || "",
    });

    if (overrides?.indicators?.length) {
      setIndicators(overrides.indicators.map((i) => ({ ...i, rag: normRag(i.rag) })));
    } else if (r360?.indicators?.length) {
      setIndicators(r360.indicators.map((i) => ({ ...i, rag: normRag(i.rag) })));
    } else {
      setIndicators(buildDefaultIndicators(data));
    }

    // Decisions / actions always come from live RAIDD (same DB as Decisions Log) — never snapshot overrides.
    setHighlights(overrides?.highlights?.length ? overrides.highlights : (r360?.highlights || []));
    setLowlights(overrides?.lowlights?.length ? overrides.lowlights : (r360?.lowlights || []));
    setLastWeekRag(
      overrides?.lastWeekRag ||
        r360?.lastWeekRagOverride ||
        (data.lastWeekRag as Record<string, string> | null) ||
        {},
    );

    if (isLevel1Rows(overrides?.level1PlanRows)) {
      setLevel1Rows(overrides.level1PlanRows);
    } else if (isLevel1Rows(data.level1PlanRows)) {
      setLevel1Rows(data.level1PlanRows);
    } else {
      setLevel1Rows([]);
    }

    if (isActivityPlan(overrides?.activityPlan)) {
      setActivityReleases(overrides.activityPlan);
    } else if (isActivityPlan(data.activityPlan)) {
      setActivityReleases(data.activityPlan);
    } else {
      setActivityReleases([]);
    }

    setReadinessItems(
      overrides?.readinessItems?.length
        ? overrides.readinessItems
        : (r360?.readinessItems || []),
    );

    if (Array.isArray(overrides?.activityLibrary) && overrides.activityLibrary.length) {
      setActivityLibrary(overrides.activityLibrary as ActivityCode[]);
    }

    const y = Number((overrides as { activityYear?: number } | undefined)?.activityYear);
    if (Number.isFinite(y) && y >= 2000 && y <= 2100) setActivityYear(y);

    setShowResources(overrides?.showResources ?? true);
    setShowRisk(overrides?.showRisk ?? true);
    setTeamView((overrides?.teamView as TeamView) || "list");

    if (overrides?.activeSection && SECTION_IDS.has(overrides.activeSection)) {
      setActiveSection(overrides.activeSection as SectionId);
    }
  }, [data, projectId]);

  const saveSnapshot = async (publish = false) => {
    try {
      setPublishing(true);
      const res = await apiRequest("POST", `/api/portfolio/reports/360/${projectId}`, {
        narrative: narrative || ragCommentary,
        sectionOverrides: {
          ragCommentary,
          ragComments,
          indicators,
          activeSection,
          highlights: highlights.filter(Boolean),
          lowlights: lowlights.filter(Boolean),
          lastWeekRag,
          level1PlanRows: level1Rows,
          activityPlan: activityReleases,
          activityLibrary,
          activityYear,
          readinessItems,
          showResources,
          showRisk,
          teamView,
        },
      });
      try {
        const body = await res.json() as {
          report?: { sectionOverrides?: { activityPlan?: ActivityRelease[] } };
        };
        const syncedPlan = body?.report?.sectionOverrides?.activityPlan;
        if (isActivityPlan(syncedPlan)) setActivityReleases(syncedPlan);
      } catch {
        /* response body optional */
      }
      seededForProject.current = null;
      await refetch();
      toast({ title: publish ? "Report published" : "Report snapshot saved" });
    } catch (err) {
      toast({
        title: publish ? "Publish failed" : "Failed to save report",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setPublishing(false);
    }
  };

  const exportPptx = async () => {
    try {
      const params = new URLSearchParams();
      if (narrative || ragCommentary) params.set("narrative", narrative || ragCommentary);
      const res = await fetchWithAuth(`/api/portfolio/reports/360/${projectId}/pptx?${params}`);
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const safeName = (data?.executiveSummary.projectName || "report").replace(/[^a-z0-9]+/gi, "_");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}_360_report.pptx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "PowerPoint exported" });
    } catch (err) {
      toast({
        title: "PowerPoint export failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  const handlePrint = () => {
    if (!data) return;
    print360Report({
      data,
      narrative,
      ragCommentary,
      indicators,
      decisions: mapRaidDecisions(data.raidSummary),
      actions: mapRaidActions(data.raidSummary),
      highlights,
      lowlights,
      readinessItems,
      level1Rows,
      activityReleases,
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: R360.brand }} />
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
  const decisions = mapRaidDecisions(raid);
  const actions = mapRaidActions(raid);
  const period = periodSummary(data);
  const reportDate = new Date(data.generatedAt || Date.now()).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
  const progressAvg =
    typeof ex.progress === "number"
      ? ex.progress
      : data.level1Plan.length > 0
        ? Math.round(data.level1Plan.reduce((s, p) => s + (p.progress || 0), 0) / data.level1Plan.length)
        : period.progress;
  const todayStr = new Date().toISOString().slice(0, 10);

  const invalidateSharedSources = () => {
    void queryClient.invalidateQueries({ queryKey: [`/api/portfolio/reports/360/${projectId}`] });
    void queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "raidd"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "deliverables"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId, "team"] });
    void queryClient.invalidateQueries({
      predicate: (q) => {
        const key = q.queryKey;
        if (!Array.isArray(key) || key.length === 0) return false;
        const head = String(key[0] || "");
        return head.includes("/api/pm/workstreams") || (head.includes("/api/pm/projects") && key.includes(projectId) && key.includes("workstreams"));
      },
    });
    void queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId] });
  };

  const openWorkspaceTool = (toolId: string) => {
    try {
      localStorage.setItem(`pm-last-tool-${projectId}`, toolId);
    } catch {
      /* ignore */
    }
    setLocation(`/modules/projects/${projectId}?tool=${encodeURIComponent(toolId)}`);
  };

  const RAIDD_CODE_PREFIX: Record<string, string> = {
    risk: "R",
    issue: "I",
    dependency: "D",
    decision: "DC",
    action: "A",
    assumption: "A",
  };

  const RAIDD_DEFAULT_STATUS: Record<string, string> = {
    risk: "Open",
    issue: "Open",
    dependency: "Identified",
    decision: "Proposed",
    action: "Open",
    assumption: "Unvalidated",
  };

  const createRaidd = async (type: string, title: string, extra: Record<string, unknown> = {}) => {
    if (creatingLockRef.current || creatingKind) return;
    creatingLockRef.current = true;
    const prefix = RAIDD_CODE_PREFIX[type] || type.slice(0, 1).toUpperCase();
    setCreatingKind(type);
    try {
      await apiRequest("POST", "/api/pm/raidd", {
        projectId,
        type,
        code: `${prefix}-${String(Date.now()).slice(-4)}`,
        title,
        status: RAIDD_DEFAULT_STATUS[type] || "Open",
        priority: "Medium",
        archived: false,
        closed: false,
        ...extra,
      });
      invalidateSharedSources();
      await refetch();
      toast({ title: `${type.charAt(0).toUpperCase()}${type.slice(1)} created` });
    } catch (err) {
      toast({
        title: `Failed to create ${type}`,
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      creatingLockRef.current = false;
      setCreatingKind(null);
    }
  };

  const patchAndRefetch = async (url: string, body: Record<string, unknown>, successTitle?: string, errTitle?: string) => {
    try {
      await apiRequest("PUT", url, body);
      // Keep local snapshot overlays (activity/readiness/narrative); only refresh live entity data.
      invalidateSharedSources();
      await refetch();
      if (successTitle) toast({ title: successTitle });
    } catch (err) {
      toast({ title: errTitle || "Update failed", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  };

  const postAndRefetch = async (url: string, body: Record<string, unknown>, successTitle?: string, errTitle?: string) => {
    if (creatingLockRef.current || creatingKind) return;
    creatingLockRef.current = true;
    setCreatingKind(url);
    try {
      await apiRequest("POST", url, body);
      invalidateSharedSources();
      await refetch();
      if (successTitle) toast({ title: successTitle });
    } catch (err) {
      toast({ title: errTitle || "Failed to create", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      creatingLockRef.current = false;
      setCreatingKind(null);
    }
  };

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

  const patchRaidd = (dbId: number | undefined, patch: Record<string, unknown>) => {
    if (!dbId) return;
    void patchAndRefetch(`/api/pm/raidd/${dbId}`, patch);
  };

  const archiveRaidd = (dbId: number | undefined) => {
    if (!dbId) return;
    void patchAndRefetch(`/api/pm/raidd/${dbId}`, { archived: true }, "Archived");
  };

  const patchDeliverable = (d: Report360Data["deliverablesTracker"][number], patch: Record<string, unknown>) => {
    if (!d.id) return;
    void patchAndRefetch(`/api/pm/deliverables/${d.id}`, patch);
  };
  const patchTeam = (t: TeamMember, patch: Record<string, unknown>) => {
    if (!t.id) return;
    void patchAndRefetch(`/api/pm/team/${t.id}`, patch);
  };
  const patchWorkstream = (w: Report360Data["workstreamUpdates"][number], patch: Record<string, unknown>) => {
    if (!w.id) return;
    void patchAndRefetch(`/api/pm/workstreams/${w.id}`, patch);
  };

  const deleteWorkstream = async (w: Report360Data["workstreamUpdates"][number]) => {
    if (!w.id || creatingLockRef.current || creatingKind) return;
    creatingLockRef.current = true;
    setCreatingKind(`delete-ws-${w.id}`);
    try {
      await apiRequest("DELETE", `/api/pm/workstreams/${w.id}`);
      invalidateSharedSources();
      await refetch();
      toast({ title: "Workstream removed" });
    } catch (err) {
      toast({ title: "Failed to remove workstream", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      creatingLockRef.current = false;
      setCreatingKind(null);
    }
  };

  const cycleReadinessRag = (id: string) => {
    const cycle = ["green", "amber", "red", "complete", "not_started"];
    setReadinessItems((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const i = cycle.indexOf((r.rag || "green").toLowerCase());
        return { ...r, rag: cycle[(i + 1) % cycle.length] };
      }),
    );
  };

  const cycleWorkstreamRag = (w: Report360Data["workstreamUpdates"][number]) => {
    const cycle = ["green", "amber", "red"];
    const cur = normRag(w.rag);
    const next = cycle[(cycle.indexOf(cur) + 1) % cycle.length];
    patchWorkstream(w, { ragStatus: next });
  };

  /* ── Exec tab derived data ── */
  const allDims: { key: string; label: string; value?: string | null }[] = [
    { key: "schedule", label: "Schedule", value: health?.schedule },
    { key: "cost", label: "Cost", value: health?.budget },
    { key: "quality", label: "Quality", value: health?.quality },
    { key: "resources", label: "Resources", value: health?.resources },
    { key: "risk", label: "Risk", value: health?.risk },
    { key: "overall", label: "Overall", value: health?.overall || ex.overallRag },
  ];
  const visibleDims = allDims.filter((d) => (d.key !== "resources" || showResources) && (d.key !== "risk" || showRisk));
  const ragChanges = allDims
    .filter((d) => d.key !== "overall")
    .map((d) => {
      const thisRag = normR360Rag(d.value);
      const lastRag = normR360Rag(lastWeekRag[d.key] ?? d.value);
      return thisRag !== lastRag ? { label: d.label, from: lastRag, to: thisRag } : null;
    })
    .filter((c): c is { label: string; from: R360Rag; to: R360Rag } => !!c);

  const scheduleRag = normR360Rag(health?.schedule);
  const costRag = normR360Rag(health?.budget);

  const bannerChips: { label: string; value: string; accent?: string }[] = [];
  if (ex.programmeManager) bannerChips.push({ label: "Programme Manager", value: ex.programmeManager });
  if (ex.pm) bannerChips.push({ label: "Project Manager", value: ex.pm });
  if (ex.pmo) bannerChips.push({ label: "Lead PMO", value: ex.pmo });
  if (ex.client) bannerChips.push({ label: "Customer", value: ex.client });
  if (ex.startDate) bannerChips.push({ label: "Start", value: fmtDate(ex.startDate) });
  if (ex.plannedEnd) bannerChips.push({ label: "Target end", value: fmtDate(ex.plannedEnd) });
  if (ex.currentPhase) bannerChips.push({ label: "Phase", value: ex.currentPhase, accent: R360.brandM });
  if (ex.methodology) bannerChips.push({ label: "Methodology", value: ex.methodology });

  const metaItems: { label: string; value: string; person?: boolean; mono?: boolean; color?: string }[] = [];
  if (ex.programmeManager) metaItems.push({ label: "Programme Manager", value: ex.programmeManager, person: true });
  if (ex.pm) metaItems.push({ label: "Project Manager", value: ex.pm, person: true });
  if (ex.pmo) metaItems.push({ label: "Lead PMO", value: ex.pmo, person: true });
  metaItems.push({ label: "Customer", value: ex.client || "—" });
  if (ex.methodology) metaItems.push({ label: "Methodology", value: ex.methodology });
  metaItems.push({ label: "Start date", value: fmtDate(ex.startDate), mono: true });
  metaItems.push({ label: "Target end date", value: fmtDate(ex.plannedEnd), mono: true });
  if (ex.currentPhase) metaItems.push({ label: "Current phase", value: ex.currentPhase, color: R360.brand });
  if (typeof ex.healthScore === "number") metaItems.push({ label: "Health score", value: `${ex.healthScore} / 100`, color: R360.amberD });

  const healthColor =
    typeof ex.healthScore === "number"
      ? ex.healthScore >= 80 ? R360.green : ex.healthScore >= 60 ? R360.amber : R360.red
      : R360.amber;

  /* ── Risks tab derived data ── */
  const risksAll = raid.topRisks;
  const risksFiltered = risksAll.filter((r) => riskPriorityFilter === "all" || (r.severity || "").toLowerCase() === riskPriorityFilter);
  const risksVisible = riskView === "top5" ? risksFiltered.slice(0, 5) : risksFiltered;
  const riskKpis = {
    total: risksAll.filter((r) => isOpenRaiddStatus(r.status)).length,
    critical: risksAll.filter((r) => (r.severity || "").toLowerCase() === "critical" && isOpenRaiddStatus(r.status)).length,
    high: risksAll.filter((r) => (r.severity || "").toLowerCase() === "high" && isOpenRaiddStatus(r.status)).length,
    escalated: risksAll.filter((r) => r.escalated && isOpenRaiddStatus(r.status)).length,
  };

  /* ── Issues tab derived data ── */
  const issuesAll = raid.topIssues;
  const issuesVisible = issueView === "top5" ? issuesAll.slice(0, 5) : issuesAll;
  const issueKpis = {
    total: issuesAll.filter((i) => isOpenRaiddStatus(i.status)).length,
    high: issuesAll.filter((i) => ["critical", "high"].includes((i.priority || "").toLowerCase()) && isOpenRaiddStatus(i.status)).length,
    inProgress: issuesAll.filter((i) => (i.status || "").toLowerCase().includes("progress")).length,
    overdue: issuesAll.filter((i) => {
      const d = i.targetResolution;
      const s = (i.status || "").toLowerCase();
      return !!d && d < todayStr && !s.includes("resolv") && !s.includes("clos") && !s.includes("complet");
    }).length,
  };

  /* ── Deliverables derived data ── */
  const delivAll = data.deliverablesTracker;
  const delivKpis = {
    total: delivAll.length,
    approved: delivAll.filter((d) => normR360Rag(d.status) === "complete").length,
    inProgress: delivAll.filter((d) => (d.status || "").toLowerCase().includes("progress") || (d.status || "").toLowerCase().includes("review")).length,
    notStarted: delivAll.filter((d) => (d.status || "").toLowerCase().includes("not")).length,
  };

  /* ── Actions derived data ── */
  const actionOwners = [...new Set(actions.map((a) => a.owner).filter(Boolean))];
  const actionStatuses = [...new Set(actions.map((a) => a.status).filter(Boolean))];
  const actionsFiltered = actions.filter(
    (a) => (actionOwnerFilter === "all" || a.owner === actionOwnerFilter) && (actionStatusFilter === "all" || a.status === actionStatusFilter),
  );
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const actionKpis = {
    open: actions.filter((a) => isOpenRaiddStatus(a.status)).length,
    overdue: actions.filter((a) => a.due && a.due < todayStr && !(a.status || "").toLowerCase().includes("complet")).length,
    dueThisWeek: actions.filter((a) => a.due && a.due >= todayStr && a.due <= in7Days).length,
    completed: actions.filter((a) => (a.status || "").toLowerCase().includes("complet")).length,
  };

  /* ── Readiness derived data ── */
  const readinessCounts = {
    green: readinessItems.filter((r) => ["green", "complete", "on track"].some((x) => (r.rag || "").toLowerCase().includes(x))).length,
    amber: readinessItems.filter((r) => (r.rag || "").toLowerCase().includes("amber") || (r.rag || "").toLowerCase().includes("risk")).length,
    red: readinessItems.filter((r) => (r.rag || "").toLowerCase().includes("red") || (r.rag || "").toLowerCase().includes("block")).length,
    notStarted: readinessItems.filter((r) => (r.rag || "").toLowerCase().includes("not") || !r.rag).length,
  };
  const readinessVerdict =
    readinessItems.length === 0
      ? null
      : readinessCounts.red > 0
        ? { label: "NO-GO", color: R360.red, bg: chrome.redL, fg: chrome.redFg, msg: `${readinessCounts.red} blocking item${readinessCounts.red === 1 ? "" : "s"} must be resolved before proceeding.` }
        : readinessCounts.amber > 0
          ? { label: "CONDITIONAL GO", color: R360.amber, bg: chrome.amberL, fg: chrome.amberFg, msg: `${readinessCounts.amber} item${readinessCounts.amber === 1 ? "" : "s"} at risk — review before proceeding.` }
          : { label: "GO", color: R360.green, bg: chrome.greenL, fg: chrome.greenFg, msg: "All readiness criteria are on track or complete." };

  /* ── Team derived data ── */
  const team = data.resourceSummary;
  const supplierTeam = team.filter((t) => t.memberType !== "Customer");
  const customerTeam = team.filter((t) => t.memberType === "Customer");
  const teamNameByUserId = new Map(team.filter((t) => t.userId).map((t) => [t.userId as string, t.name]));

  /* ── Budget derived data ── */
  const fin = data.financialSummary;
  const consumedPct = fin.budget > 0 ? Math.round((fin.spent / fin.budget) * 100) : 0;
  const eac = fin.forecast > 0 ? fin.forecast : fin.spent + fin.remaining;
  const eacVariance = eac - fin.budget;
  const breakdown = data.budgetBreakdown || [];
  const totalBudgeted = breakdown.reduce((s, r) => s + r.budgeted, 0);
  const totalActual = breakdown.reduce((s, r) => s + r.actual, 0);
  const totalVariance = totalActual - totalBudgeted;

  /* ── Tab badges ── */
  const tabBadges: Partial<Record<SectionId, number>> = {
    risks: raid.topRisks.length,
    issues: raid.topIssues.length,
    dec: decisions.length,
    del: data.deliverablesTracker.length,
    dep: raid.openDependencies.length,
    act: actions.length,
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl overflow-hidden border border-border bg-background">
      {/* ── HEADER ── */}
      <div className="shrink-0 px-4 sm:px-5 pt-3 pb-2.5 bg-card border-b border-border/30">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
          <div className="min-w-0">
            <div className="text-sm sm:text-base font-semibold tracking-tight truncate text-foreground">
              {ex.projectName} — 360° Project Report
            </div>
            <div className="text-xs mt-0.5 text-muted-foreground">
              Report · {reportDate}
              {period.total > 0 && <> · {period.elapsed} of {period.total} days elapsed</>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handlePrint}>
              <Printer className="h-3.5 w-3.5" /> Export PDF
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => void exportPptx()}>
              <FileDown className="h-3.5 w-3.5" /> PPTX
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1.5" disabled={publishing} onClick={() => void saveSnapshot(false)}>
              <Save className="h-3.5 w-3.5" /> Save snapshot
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs gap-1.5 border-0 hover:opacity-90"
              style={{ background: PUBLISH_GRADIENT, color: "#fff" }}
              disabled={publishing}
              onClick={() => void saveSnapshot(true)}
            >
              {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Publish report
            </Button>
            {onClose && (
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose}>Close</Button>
            )}
          </div>
        </div>

        {metaItems.length > 0 && (
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
                  <div className="text-xs font-semibold text-foreground" style={{ color: m.color, fontFamily: m.mono ? monoCell.fontFamily : undefined }}>
                    {m.value}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── TAB BAR ── */}
      <div className="shrink-0 flex overflow-x-auto bg-card border-b border-border" style={{ scrollbarWidth: "none" }}>
        {SECTIONS.map((s) => {
          const active = activeSection === s.id;
          const badge = tabBadges[s.id];
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active}
              data-state={active ? "active" : "inactive"}
              data-testid={`360-tab-${s.id}`}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 h-10 whitespace-nowrap text-xs shrink-0 border-b-2 -mb-px",
                active ? "font-semibold border-primary text-primary" : "font-medium border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
              {typeof badge === "number" && badge > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── WORKSPACE ── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-3.5 bg-muted/20">

        {activeSection === "exec" && (
          <>
            {/* Project info banner — CRM light card (no navy fill in bright mode) */}
            <div className="rounded-xl p-4 sm:p-5 flex flex-wrap items-center gap-5 bg-card border border-border/40 shadow-sm">
              <div className="flex-1 min-w-[240px]">
                <div className="text-sm font-semibold text-foreground mb-1">{ex.projectName}</div>
                {bannerChips.length > 0 && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                    {bannerChips.map((c) => (
                      <div key={c.label} className="text-xs text-muted-foreground">
                        {c.label}{" "}
                        <span className="font-semibold text-foreground ml-1" style={c.accent ? { color: c.accent } : undefined}>{c.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <div className="text-center rounded-lg px-3.5 py-2.5 bg-muted/40 min-w-[72px]">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Health</div>
                  <div className="text-xl font-bold tabular-nums" style={{ color: healthColor }}>
                    {typeof ex.healthScore === "number" ? ex.healthScore : "—"}
                  </div>
                </div>
                <div className="text-center rounded-lg px-3.5 py-2.5 bg-muted/40 min-w-[72px]">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Progress</div>
                  <div className="text-xl font-bold tabular-nums text-foreground">{progressAvg}%</div>
                </div>
                <div className="text-center rounded-lg px-3.5 py-2.5 bg-muted/40 min-w-[72px]">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Days left</div>
                  <div className="text-xl font-bold tabular-nums" style={{ color: R360.amber }}>{period.remaining || "—"}</div>
                </div>
              </div>
            </div>

            {/* RAG grid + health indicators */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              <Card>
                <CardHead
                  title="RAG status — this week vs last week"
                  subtitle="Overall from live project health · Last week editable"
                  action={
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-semibold text-muted-foreground">Show:</span>
                      <ToggleLabel checked={showResources} onChange={setShowResources}>Resources</ToggleLabel>
                      <ToggleLabel checked={showRisk} onChange={setShowRisk}>Risk</ToggleLabel>
                    </div>
                  }
                />
                <div className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide mb-2 text-muted-foreground">This week</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {visibleDims.map((item) => {
                          const isOverall = item.key === "overall";
                          return (
                            <div
                              key={item.key}
                              className={cn("rounded-lg p-2.5 text-center", isOverall ? "bg-primary/10 ring-1 ring-primary/20" : "bg-muted/50")}
                            >
                              <div className={cn("text-[10px] font-semibold uppercase tracking-wide mb-1", isOverall ? "text-primary" : "text-muted-foreground")}>
                                {item.label}
                              </div>
                              <Rag value={item.value} size="lg" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide mb-2 text-muted-foreground">Last week</div>
                      <div className="grid grid-cols-2 gap-1.5 opacity-80">
                        {visibleDims.map((item) => {
                          const val = lastWeekRag[item.key] || item.value || "green";
                          const isOverall = item.key === "overall";
                          return (
                            <button
                              key={item.key}
                              type="button"
                              className={cn("rounded-lg p-2.5 text-center", isOverall ? "bg-primary/10 ring-1 ring-primary/20" : "bg-muted/50")}
                              title="Click to cycle last-week RAG"
                              onClick={() => {
                                const cycle: RagLevel[] = ["green", "amber", "red"];
                                const cur = normRag(val);
                                const next = cycle[(cycle.indexOf(cur) + 1) % cycle.length];
                                setLastWeekRag((prev) => ({ ...prev, [item.key]: next }));
                              }}
                            >
                              <div className={cn("text-[10px] font-semibold uppercase tracking-wide mb-1", isOverall ? "text-primary" : "text-muted-foreground")}>
                                {item.label}
                              </div>
                              <Rag value={val} size="lg" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  {ragChanges.length > 0 && (
                    <div
                      className="rounded-lg px-3 py-2 flex flex-wrap items-center gap-2 text-[11px]"
                      style={{ background: chrome.amberL, border: `1px solid ${dark ? "rgba(251,191,36,0.35)" : "#FDE68A"}` }}
                    >
                      <span>⚠</span>
                      {ragChanges.map((c) => (
                        <span key={c.label} style={{ color: R360.amberD, fontWeight: 700 }}>
                          {c.label} moved {c.from} → {c.to} this week.
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Card>

              <Card>
                <CardHead
                  title="Health indicators"
                  subtitle="Click % to edit"
                  action={
                    <button
                      type="button"
                      className="text-[10px] font-semibold"
                      style={{ color: R360.brand }}
                      onClick={() =>
                        setIndicators((prev) => [...prev, { id: `ind_${Date.now()}`, label: "New indicator", pct: 50, rag: "amber" }])
                      }
                    >
                      + Add indicator
                    </button>
                  }
                />
                <div className="p-1">
                  {indicators.length === 0 ? (
                    <EmptyState label="No health indicators yet." />
                  ) : (
                    indicators.map((ind) => (
                      <div key={ind.id} className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${chrome.border2}` }}>
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ background: ragBarColor(normR360Rag(ind.rag)) }} />
                        <Input
                          value={ind.label}
                          onChange={(e) => setIndicators((prev) => prev.map((x) => (x.id === ind.id ? { ...x, label: e.target.value } : x)))}
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
                    ))
                  )}
                </div>
              </Card>
            </div>

            {/* Key RAG commentary */}
            <Card>
              <CardHead title="Key RAG commentary" subtitle="Schedule · Cost · Quality / Risk" />
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] font-extrabold uppercase mb-1.5" style={{ color: ragTextColor(scheduleRag) }}>Schedule</div>
                  <EditField
                    value={ragComments.schedule}
                    onChange={(v) => setRagComments((p) => ({ ...p, schedule: v }))}
                    borderColor={scheduleRag !== "green" ? ragBarColor(scheduleRag) : undefined}
                    size="md"
                    placeholder="Add schedule commentary..."
                  />
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase mb-1.5" style={{ color: ragTextColor(costRag) }}>Cost</div>
                  <EditField
                    value={ragComments.cost}
                    onChange={(v) => setRagComments((p) => ({ ...p, cost: v }))}
                    borderColor={costRag !== "green" ? ragBarColor(costRag) : undefined}
                    size="md"
                    placeholder="Add cost commentary..."
                  />
                </div>
                <div>
                  <div className="text-[10px] font-extrabold uppercase mb-1.5 text-muted-foreground">Quality / Risk</div>
                  <EditField
                    value={ragComments.qualityRisk}
                    onChange={(v) => setRagComments((p) => ({ ...p, qualityRisk: v }))}
                    size="md"
                    placeholder="Add quality or risk commentary..."
                  />
                </div>
              </div>
              <div className="px-4 pb-4">
                <EditField value={ragCommentary} onChange={setRagCommentary} size="sm" placeholder="Optional overall RAG commentary..." />
              </div>
            </Card>

            {/* Executive summary + highlights/lowlights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              <Card>
                <CardHead title="Executive summary" subtitle="For steering committee" />
                <div className="p-4">
                  <EditField
                    value={narrative}
                    onChange={setNarrative}
                    size="lg"
                    placeholder="Write the executive summary for steering committee..."
                  />
                </div>
              </Card>
              <div className="space-y-2.5">
                <Card>
                  <CardHead title="✅ Highlights" bg={chrome.greenL} fg={chrome.greenFg} />
                  <div className="px-3.5 py-3 space-y-1.5">
                    {highlights.length === 0 && <div className="text-[11px] text-muted-foreground">No highlights added yet.</div>}
                    {highlights.map((h, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <span className="font-bold text-xs mt-1.5" style={{ color: R360.green }}>✓</span>
                        <Input
                          value={h}
                          onChange={(e) => setHighlights((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                          className="h-8 text-xs"
                          placeholder="Add a highlight..."
                        />
                        <button type="button" className="px-1" style={{ color: chrome.text4 }} onClick={() => setHighlights((prev) => prev.filter((_, j) => j !== i))}>×</button>
                      </div>
                    ))}
                    <button type="button" className="text-[10px] text-muted-foreground" onClick={() => setHighlights((p) => [...p, ""])}>+ Add highlight</button>
                  </div>
                </Card>
                <Card>
                  <CardHead title="⚠ Lowlights & concerns" bg={chrome.redL} fg={chrome.redFg} />
                  <div className="px-3.5 py-3 space-y-1.5">
                    {lowlights.length === 0 && <div className="text-[11px] text-muted-foreground">No concerns added yet.</div>}
                    {lowlights.map((h, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <span className="font-bold text-xs mt-1.5" style={{ color: R360.red }}>✗</span>
                        <Input
                          value={h}
                          onChange={(e) => setLowlights((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                          className="h-8 text-xs"
                          placeholder="Add a concern..."
                        />
                        <button type="button" className="px-1" style={{ color: chrome.text4 }} onClick={() => setLowlights((prev) => prev.filter((_, j) => j !== i))}>×</button>
                      </div>
                    ))}
                    <button type="button" className="text-[10px] text-muted-foreground" onClick={() => setLowlights((p) => [...p, ""])}>+ Add concern</button>
                  </div>
                </Card>
              </div>
            </div>

            {/* Steering committee decisions — live Decisions Log (pm_raidd_items) */}
            <Card>
              <CardHead
                title="Decisions required from steering committee"
                subtitle="Same data as Decisions Log · open or pending items"
                action={
                  <button
                    type="button"
                    className="text-xs font-semibold text-primary"
                    onClick={() => void createRaidd("decision", "New decision required")}
                  >
                    + Add item
                  </button>
                }
              />
              {decisions.filter((d) => isOpenRaiddStatus(d.status)).length === 0 ? (
                <EmptyState label="No decisions required at this time." />
              ) : (
                <DataTable>
                  <thead><tr><Th>#</Th><Th>Decision required</Th><Th>Impact</Th><Th>Owner</Th><Th>Required by</Th><Th>Status</Th><Th /></tr></thead>
                  <tbody>
                    {decisions.filter((d) => isOpenRaiddStatus(d.status)).map((row) => (
                      <tr key={row.dbId ?? row.id} style={rowBorder}>
                        <Td className="font-mono text-[11px]">{row.id}</Td>
                        <Td>
                          <Input
                            defaultValue={row.text}
                            className={editInputCls}
                            onBlur={(e) => { if (e.target.value !== row.text) patchRaidd(row.dbId, { title: e.target.value }); }}
                          />
                        </Td>
                        <Td>
                          <Input
                            defaultValue={row.impact || ""}
                            className={editInputCls}
                            onBlur={(e) => { if (e.target.value !== (row.impact || "")) patchRaidd(row.dbId, { impact: e.target.value }); }}
                          />
                        </Td>
                        <Td>
                          <Input
                            defaultValue={row.owner}
                            className={editInputCls}
                            onBlur={(e) => { if (e.target.value !== row.owner) patchRaidd(row.dbId, { ownerName: e.target.value }); }}
                          />
                        </Td>
                        <Td>
                          <Input
                            type="date"
                            defaultValue={row.requiredBy || ""}
                            className={cn(editInputCls, "font-mono")}
                            onBlur={(e) => { if (e.target.value !== (row.requiredBy || "")) patchRaidd(row.dbId, { decisionDate: e.target.value || null }); }}
                          />
                        </Td>
                        <Td>
                          <Input
                            defaultValue={row.status || ""}
                            className={editInputCls}
                            onBlur={(e) => { if (e.target.value !== (row.status || "")) patchRaidd(row.dbId, { status: e.target.value }); }}
                          />
                        </Td>
                        <Td><button type="button" className="px-1" style={{ color: chrome.text4 }} onClick={() => archiveRaidd(row.dbId)}>×</button></Td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </Card>
          </>
        )}

        {activeSection === "gantt" && (
          level1Rows.length === 0 ? (
            <Card>
              <CardHead title="Level 1 Plan" subtitle="Built from project phases and milestones" />
              <div className="p-4">
                <EmptyState label="No phases or milestones in the database for this project yet. Start a Level 1 plan, then select a phase and add milestones under it." />
                <div className="mt-3 flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const releaseId = `release-${Date.now()}`;
                      const phaseId = `phase-${Date.now()}`;
                      setLevel1Rows([
                        { id: releaseId, kind: "release", name: ex.projectName || "Project", startWeek: 0, endWeek: 47 },
                        {
                          id: phaseId,
                          kind: "phase",
                          name: "Discovery",
                          status: "not_started",
                          startWeek: 0,
                          endWeek: 3,
                        },
                      ]);
                    }}
                  >
                    + Start Level 1 plan
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Level1PlanGantt rows={level1Rows} onChange={setLevel1Rows} />
          )
        )}

        {activeSection === "activity" && (
          activityReleases.length === 0 ? (
            <Card>
              <CardHead title="Activity Plan" subtitle="Release → DEV / QAS / PRD environments → weekly activity codes" />
              <div className="p-4">
                <EmptyState label="No dated workstream activities in the database. Start a release with DEV / QAS / PRD rows, then click week cells to place codes and Save snapshot." />
                <div className="mt-3 flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActivityReleases([createEmptyActivityRelease(ex.projectName || "Release 1")])}
                  >
                    + Start activity plan
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <ActivityPlanMatrix
              releases={activityReleases}
              onChange={setActivityReleases}
              library={activityLibrary}
              onLibraryChange={setActivityLibrary}
              year={activityYear}
              onYearChange={setActivityYear}
              saving={publishing}
              onSave={() => void saveSnapshot(false)}
            />
          )
        )}

        {activeSection === "risks" && (
          <div className="space-y-3">
            <SharedDataNotice
              action={
                <div className="flex items-center gap-2">
                  <PrimaryBtn
                    disabled={!!creatingKind}
                    onClick={() => void createRaidd("risk", "New risk", { category: "Operational", likelihood: "Medium", impact: "Medium" })}
                  >
                    {creatingKind === "risk" ? "Creating…" : "+ Log risk"}
                  </PrimaryBtn>
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" style={{ color: chrome.blueFg }} onClick={() => openWorkspaceTool("risk_log")}>
                    Open Risk Log <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              }
            >
              Same database as the project Risk Log. Quick-add here, or open the Risk Log for full editing.
              {" "}Showing {riskView === "top5" ? `top ${Math.min(5, risksFiltered.length)}` : "all"} by priority.
            </SharedDataNotice>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <SegToggle
                  value={riskView}
                  onChange={setRiskView}
                  options={[{ value: "top5", label: "Top 5 risks" }, { value: "all", label: `All risks (${risksAll.length})` }]}
                />
                <select value={riskPriorityFilter} onChange={(e) => setRiskPriorityFilter(e.target.value)} className={selectCls}>
                  <option value="all">All priorities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[11px] font-semibold text-muted-foreground">Columns:</span>
                <ToggleLabel checked={riskCols.mitigation} onChange={(v) => setRiskCols((p) => ({ ...p, mitigation: v }))}>Mitigation</ToggleLabel>
                <ToggleLabel checked={riskCols.likelihood} onChange={(v) => setRiskCols((p) => ({ ...p, likelihood: v }))}>Likelihood</ToggleLabel>
                <ToggleLabel checked={riskCols.contingency} onChange={(v) => setRiskCols((p) => ({ ...p, contingency: v }))}>Contingency</ToggleLabel>
                <ToggleLabel checked={riskCols.dateRaised} onChange={(v) => setRiskCols((p) => ({ ...p, dateRaised: v }))}>Date raised</ToggleLabel>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <Kpi label="Total open" value={riskKpis.total} color={R360.redD} />
              <Kpi label="Critical" value={riskKpis.critical} color={R360.redD} />
              <Kpi label="High" value={riskKpis.high} color={R360.amberD} />
              <Kpi label="Escalated" value={riskKpis.escalated} color={R360.violetD} />
            </div>
            <Card>
              {risksVisible.length === 0 ? (
                <EmptyState label="No risks recorded in the Risk Log." />
              ) : (
                <DataTable>
                  <thead>
                    <tr>
                      <Th>ID</Th><Th>Risk description</Th><Th>Category</Th>
                      {riskCols.likelihood && <Th>Likelihood</Th>}
                      <Th>Impact</Th><Th>Priority</Th>
                      {riskCols.mitigation && <Th>Mitigation strategy</Th>}
                      {riskCols.contingency && <Th>Contingency</Th>}
                      <Th>Owner</Th><Th>Due</Th>
                      {riskCols.dateRaised && <Th>Date raised</Th>}
                      <Th>Status</Th><Th />
                    </tr>
                  </thead>
                  <tbody>
                    {risksVisible.map((r, i) => (
                      <tr key={r.id ?? i} style={rowBorder}>
                        <Td style={monoMuted}>{r.ref || "—"}</Td>
                        <Td>
                          <Input
                            defaultValue={r.description}
                            className={cn(editInputCls, "font-semibold")}
                            onBlur={(e) => { if (e.target.value !== r.description) patchRaidd(r.id, { title: e.target.value }); }}
                          />
                        </Td>
                        <Td>
                          <Input
                            defaultValue={r.category || ""}
                            className={editInputCls}
                            onBlur={(e) => { if (e.target.value !== (r.category || "")) patchRaidd(r.id, { category: e.target.value }); }}
                          />
                        </Td>
                        {riskCols.likelihood && (
                          <Td>
                            <Input
                              defaultValue={r.likelihood || ""}
                              className={editInputCls}
                              onBlur={(e) => { if (e.target.value !== (r.likelihood || "")) patchRaidd(r.id, { likelihood: e.target.value }); }}
                            />
                          </Td>
                        )}
                        <Td>
                          <Input
                            defaultValue={r.impact || ""}
                            className={editInputCls}
                            onBlur={(e) => { if (e.target.value !== (r.impact || "")) patchRaidd(r.id, { impact: e.target.value }); }}
                          />
                        </Td>
                        <Td>
                          <Input
                            defaultValue={r.severity || ""}
                            className={editInputCls}
                            onBlur={(e) => { if (e.target.value !== (r.severity || "")) patchRaidd(r.id, { priority: e.target.value }); }}
                          />
                        </Td>
                        {riskCols.mitigation && (
                          <Td>
                            <Input
                              defaultValue={r.mitigation || ""}
                              className={editInputCls}
                              onBlur={(e) => { if (e.target.value !== (r.mitigation || "")) patchRaidd(r.id, { mitigation: e.target.value }); }}
                            />
                          </Td>
                        )}
                        {riskCols.contingency && (
                          <Td>
                            <Input
                              defaultValue={r.contingency || ""}
                              className={editInputCls}
                              onBlur={(e) => { if (e.target.value !== (r.contingency || "")) patchRaidd(r.id, { contingency: e.target.value }); }}
                            />
                          </Td>
                        )}
                        <Td>
                          <Input
                            defaultValue={r.owner || ""}
                            className={editInputCls}
                            onBlur={(e) => { if (e.target.value !== (r.owner || "")) patchRaidd(r.id, { ownerName: e.target.value }); }}
                          />
                        </Td>
                        <Td>
                          <Input
                            type="date"
                            defaultValue={toDateInput(r.due)}
                            className={cn(editInputCls, "font-mono")}
                            onBlur={(e) => { if (e.target.value !== toDateInput(r.due)) patchRaidd(r.id, { dueDate: e.target.value || null }); }}
                          />
                        </Td>
                        {riskCols.dateRaised && <Td style={monoCell}>{fmtDate(r.dateRaised)}</Td>}
                        <Td>
                          <Input
                            defaultValue={r.status || ""}
                            className={editInputCls}
                            onBlur={(e) => { if (e.target.value !== (r.status || "")) patchRaidd(r.id, { status: e.target.value }); }}
                          />
                        </Td>
                        <Td><button type="button" className="px-1" style={{ color: chrome.text4 }} title="Archive" onClick={() => archiveRaidd(r.id)}>×</button></Td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </Card>
          </div>
        )}

        {activeSection === "issues" && (
          <div className="space-y-3">
            <SharedDataNotice
              action={
                <div className="flex items-center gap-2">
                  <PrimaryBtn
                    disabled={!!creatingKind}
                    onClick={() => void createRaidd("issue", "New issue", { category: "Delivery" })}
                  >
                    {creatingKind === "issue" ? "Creating…" : "+ Log issue"}
                  </PrimaryBtn>
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" style={{ color: chrome.blueFg }} onClick={() => openWorkspaceTool("issues_log")}>
                    Open Issues Log <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              }
            >
              Same database as the project Issues Log. Quick-add here, or open the Issues Log for full editing.
              {" "}Showing {issueView === "top5" ? `top ${Math.min(5, issuesAll.length)}` : "all"} by priority.
            </SharedDataNotice>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SegToggle
                value={issueView}
                onChange={setIssueView}
                options={[{ value: "top5", label: "Top 5 issues" }, { value: "all", label: `All issues (${issuesAll.length})` }]}
              />
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[11px] font-semibold text-muted-foreground">Columns:</span>
                <ToggleLabel checked={issueCols.resolution} onChange={(v) => setIssueCols((p) => ({ ...p, resolution: v }))}>Resolution action</ToggleLabel>
                <ToggleLabel checked={issueCols.targetResolution} onChange={(v) => setIssueCols((p) => ({ ...p, targetResolution: v }))}>Target resolution</ToggleLabel>
                <ToggleLabel checked={issueCols.dateRaised} onChange={(v) => setIssueCols((p) => ({ ...p, dateRaised: v }))}>Date raised</ToggleLabel>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <Kpi label="Total open" value={issueKpis.total} color={R360.amberD} />
              <Kpi label="High priority" value={issueKpis.high} color={R360.redD} />
              <Kpi label="In progress" value={issueKpis.inProgress} color={R360.brand} />
              <Kpi label="Overdue" value={issueKpis.overdue} color={R360.redD} />
            </div>
            <Card>
              {issuesVisible.length === 0 ? (
                <EmptyState label="No issues recorded in the Issues Log." />
              ) : (
                <DataTable>
                  <thead>
                    <tr>
                      <Th>ID</Th><Th>Issue description</Th><Th>Impact</Th><Th>Priority</Th>
                      {issueCols.resolution && <Th>Resolution action</Th>}
                      <Th>Owner</Th>
                      {issueCols.targetResolution && <Th>Resolve by</Th>}
                      {issueCols.dateRaised && <Th>Date raised</Th>}
                      <Th>Status</Th><Th />
                    </tr>
                  </thead>
                  <tbody>
                    {issuesVisible.map((r, i) => (
                      <tr key={r.id ?? i} style={rowBorder}>
                        <Td style={monoMuted}>{r.ref || "—"}</Td>
                        <Td>
                          <Input
                            defaultValue={r.description}
                            className={cn(editInputCls, "font-semibold")}
                            onBlur={(e) => { if (e.target.value !== r.description) patchRaidd(r.id, { title: e.target.value }); }}
                          />
                        </Td>
                        <Td>
                          <Input
                            defaultValue={r.impact || ""}
                            className={editInputCls}
                            onBlur={(e) => { if (e.target.value !== (r.impact || "")) patchRaidd(r.id, { impact: e.target.value }); }}
                          />
                        </Td>
                        <Td>
                          <Input
                            defaultValue={r.priority || ""}
                            className={editInputCls}
                            onBlur={(e) => { if (e.target.value !== (r.priority || "")) patchRaidd(r.id, { priority: e.target.value }); }}
                          />
                        </Td>
                        {issueCols.resolution && (
                          <Td>
                            <Input
                              defaultValue={r.resolution || ""}
                              className={editInputCls}
                              onBlur={(e) => { if (e.target.value !== (r.resolution || "")) patchRaidd(r.id, { resolution: e.target.value }); }}
                            />
                          </Td>
                        )}
                        <Td>
                          <Input
                            defaultValue={r.owner || ""}
                            className={editInputCls}
                            onBlur={(e) => { if (e.target.value !== (r.owner || "")) patchRaidd(r.id, { ownerName: e.target.value }); }}
                          />
                        </Td>
                        {issueCols.targetResolution && (
                          <Td>
                            <Input
                              type="date"
                              defaultValue={toDateInput(r.targetResolution)}
                              className={cn(editInputCls, "font-mono")}
                              onBlur={(e) => { if (e.target.value !== toDateInput(r.targetResolution)) patchRaidd(r.id, { resolutionTarget: e.target.value || null, dueDate: e.target.value || null }); }}
                            />
                          </Td>
                        )}
                        {issueCols.dateRaised && <Td style={monoCell}>{fmtDate(r.dateRaised)}</Td>}
                        <Td>
                          <Input
                            defaultValue={r.status || ""}
                            className={editInputCls}
                            onBlur={(e) => { if (e.target.value !== (r.status || "")) patchRaidd(r.id, { status: e.target.value }); }}
                          />
                        </Td>
                        <Td><button type="button" className="px-1" style={{ color: chrome.text4 }} title="Archive" onClick={() => archiveRaidd(r.id)}>×</button></Td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </Card>
          </div>
        )}

        {activeSection === "ws" && (
          <div className="space-y-3">
            <SectionHeading
              title="Workstream status"
              subtitle={`${data.workstreamUpdates.length} workstream${data.workstreamUpdates.length === 1 ? "" : "s"} · One line per stream · PMO-maintained`}
              action={
                <PrimaryBtn
                  disabled={!!creatingKind}
                  onClick={() => void postAndRefetch("/api/pm/workstreams", { projectId, type: "workstream", name: "New workstream", status: "not_started", ragStatus: "green", progress: 0 }, "Workstream created", "Failed to add workstream")}
                >
                  {creatingKind?.includes("workstreams") ? "Creating…" : "+ Add workstream"}
                </PrimaryBtn>
              }
            />
            <Card>
              {data.workstreamUpdates.length === 0 ? (
                <EmptyState label="No workstreams yet. Add one to start tracking status." />
              ) : (
                <div>
                  <div
                    className="hidden lg:grid px-3.5 py-2"
                    style={{ gridTemplateColumns: "1fr 170px 120px 1.4fr 90px 36px", background: chrome.border2, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: chrome.text4 }}
                  >
                    <div>Workstream</div><div>Owner</div><div>RAG</div><div>Note</div><div>Last updated</div><div />
                  </div>
                  {data.workstreamUpdates.map((w, i) => {
                    const rag = normR360Rag(w.rag);
                    const color = ragBarColor(rag);
                    const tint = rag === "amber" ? `${R360.amber}0D` : rag === "red" ? `${R360.red}0D` : undefined;
                    const ownerName = teamNameByUserId.get(w.owner || "") || "";
                    return (
                      <div
                        key={w.id ?? i}
                        className="grid grid-cols-1 lg:grid-cols-[1fr_170px_120px_1.4fr_90px_36px] gap-2 lg:gap-3 items-center px-3.5 py-2.5"
                        style={{ borderLeft: `3px solid ${color}`, borderBottom: `1px solid ${chrome.border2}`, background: tint }}
                      >
                        <Input
                          defaultValue={w.name}
                          className="h-8 text-sm font-bold border-0 shadow-none px-1 bg-transparent"
                          onBlur={(e) => { if (e.target.value !== w.name) patchWorkstream(w, { name: e.target.value }); }}
                        />
                        <select
                          key={`ws-owner-${w.id}-${w.owner || ""}`}
                          defaultValue={w.owner || ""}
                          onChange={(e) => patchWorkstream(w, { ownerId: e.target.value || null })}
                          className="h-7 rounded-md text-[11px] px-1.5 bg-transparent"
                         
                        >
                          <option value="">Unassigned</option>
                          {w.owner && !team.some((t) => t.userId === w.owner) && (
                            <option value={w.owner}>{ownerName || w.owner}</option>
                          )}
                          {team.filter((t) => t.userId).map((t) => (
                            <option key={t.userId} value={t.userId!}>{t.name}</option>
                          ))}
                        </select>
                        <button type="button" onClick={() => cycleWorkstreamRag(w)} className="justify-self-start">
                          <Rag value={w.rag} />
                        </button>
                        <WorkstreamNoteField
                          note={w.note || ""}
                          onCommit={(v) => patchWorkstream(w, { description: v })}
                        />
                        <div className="text-[10px] text-muted-foreground">{w.updatedAt ? fmtDate(w.updatedAt) : "—"}</div>
                        <button
                          type="button"
                          className="px-1 justify-self-center"
                          style={{ color: chrome.text4 }}
                          title="Remove workstream"
                          disabled={!!creatingKind}
                          onClick={() => void deleteWorkstream(w)}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        {activeSection === "dec" && (
          <div className="space-y-3">
            <SectionHeading
              title="Decisions log"
              subtitle={`${decisions.length} decision${decisions.length === 1 ? "" : "s"} · Same data as Decisions Log`}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" style={{ color: chrome.blueFg }} onClick={() => openWorkspaceTool("decisions_log")}>
                    Open Decisions Log <ExternalLink className="h-3 w-3" />
                  </Button>
                  <PrimaryBtn disabled={!!creatingKind} onClick={() => void createRaidd("decision", "New decision")}>
                    {creatingKind === "decision" ? "Creating…" : "+ Log decision"}
                  </PrimaryBtn>
                </div>
              }
            />
            <Card>
              {decisions.length === 0 ? (
                <EmptyState label="No decisions logged yet." />
              ) : (
                <DataTable>
                  <thead><tr><Th>ID</Th><Th>Decision</Th><Th>Forum / meeting</Th><Th>Date</Th><Th>Agreed by</Th><Th>Impact</Th><Th>Status</Th><Th /></tr></thead>
                  <tbody>
                    {decisions.map((d) => (
                      <tr key={d.dbId ?? d.id} style={rowBorder}>
                        <Td className="font-mono text-[11px]">{d.id}</Td>
                        <Td>
                          <Input
                            defaultValue={d.text}
                            className={cn(editInputCls, "font-semibold")}
                            onBlur={(e) => { if (e.target.value !== d.text) patchRaidd(d.dbId, { title: e.target.value }); }}
                          />
                        </Td>
                        <Td>
                          <Input
                            defaultValue={d.forum || ""}
                            className={editInputCls}
                            onBlur={(e) => { if (e.target.value !== (d.forum || "")) patchRaidd(d.dbId, { decisionBody: e.target.value }); }}
                          />
                        </Td>
                        <Td>
                          <Input
                            type="date"
                            defaultValue={toDateInput(d.requiredBy)}
                            className={cn(editInputCls, "font-mono")}
                            onBlur={(e) => { if (e.target.value !== toDateInput(d.requiredBy)) patchRaidd(d.dbId, { decisionDate: e.target.value || null }); }}
                          />
                        </Td>
                        <Td>
                          <Input
                            defaultValue={d.owner}
                            className={editInputCls}
                            onBlur={(e) => { if (e.target.value !== d.owner) patchRaidd(d.dbId, { ownerName: e.target.value }); }}
                          />
                        </Td>
                        <Td>
                          <Input
                            defaultValue={d.impact || ""}
                            className={editInputCls}
                            onBlur={(e) => { if (e.target.value !== (d.impact || "")) patchRaidd(d.dbId, { impact: e.target.value }); }}
                          />
                        </Td>
                        <Td>
                          <Input
                            defaultValue={d.status || ""}
                            className={editInputCls}
                            onBlur={(e) => { if (e.target.value !== (d.status || "")) patchRaidd(d.dbId, { status: e.target.value }); }}
                          />
                        </Td>
                        <Td><button type="button" className="px-1" style={{ color: chrome.text4 }} onClick={() => archiveRaidd(d.dbId)}>×</button></Td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </Card>
          </div>
        )}

        {activeSection === "del" && (
          <div className="space-y-3">
            <SectionHeading
              title="Deliverables tracker"
              subtitle={`${delivAll.length} deliverable${delivAll.length === 1 ? "" : "s"} · Same data as Deliverables Tracker`}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" style={{ color: chrome.blueFg }} onClick={() => openWorkspaceTool("deliverables_tracker")}>
                    Open Deliverables Tracker <ExternalLink className="h-3 w-3" />
                  </Button>
                  <PrimaryBtn
                    disabled={!!creatingKind}
                    onClick={() => void postAndRefetch("/api/pm/deliverables", { projectId, name: "New deliverable", status: "Not Started", type: "Document", ragStatus: "Green", progress: 0 }, "Deliverable created", "Failed to add deliverable")}
                  >
                    {creatingKind?.includes("deliverables") ? "Creating…" : "+ Add deliverable"}
                  </PrimaryBtn>
                </div>
              }
            />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <Kpi label="Total" value={delivKpis.total} />
              <Kpi label="Approved" value={delivKpis.approved} color={R360.tealD} />
              <Kpi label="In progress" value={delivKpis.inProgress} color={R360.brand} />
              <Kpi label="Not started" value={delivKpis.notStarted} color={chrome.text3} />
            </div>
            <Card>
              {delivAll.length === 0 ? (
                <EmptyState label="No deliverables tracked yet." />
              ) : (
                <DataTable>
                  <thead><tr><Th>Deliverable</Th><Th>Phase</Th><Th>Type</Th><Th>Owner</Th><Th>Due date</Th><Th align="center">Approval</Th><Th>Approver</Th><Th>Status</Th></tr></thead>
                  <tbody>
                    {delivAll.map((d) => (
                      <tr key={d.id ?? d.name} style={rowBorder}>
                        <Td><Input defaultValue={d.name} className={cn(editInputCls, "font-semibold")} onBlur={(e) => { if (e.target.value !== d.name) patchDeliverable(d, { name: e.target.value }); }} /></Td>
                        <Td><Input defaultValue={d.phase || ""} className={editInputCls} onBlur={(e) => { if (e.target.value !== (d.phase || "")) patchDeliverable(d, { phaseName: e.target.value }); }} /></Td>
                        <Td><Input defaultValue={d.type || ""} className={editInputCls} onBlur={(e) => { if (e.target.value !== (d.type || "")) patchDeliverable(d, { type: e.target.value }); }} /></Td>
                        <Td>
                          <Input
                            defaultValue={d.owner || ""}
                            className={editInputCls}
                            onBlur={(e) => {
                              if (e.target.value !== (d.owner || "")) {
                                const rest = (d.owners || []).slice(1);
                                const next = e.target.value.trim() ? [e.target.value.trim(), ...rest] : rest;
                                patchDeliverable(d, { owners: next });
                              }
                            }}
                          />
                        </Td>
                        <Td><Input type="date" defaultValue={toDateInput(d.dueDate)} className={cn(editInputCls, "font-mono")} onBlur={(e) => { if (e.target.value !== toDateInput(d.dueDate)) patchDeliverable(d, { dueDate: e.target.value || null }); }} /></Td>
                        <Td align="center" style={{ fontSize: 11 }}>{d.approvalRequired ? "✅ Yes" : "— No"}</Td>
                        <Td>
                          <Input
                            defaultValue={d.approver || ""}
                            className={editInputCls}
                            onBlur={(e) => {
                              if (e.target.value !== (d.approver || "")) {
                                const rest = (d.approvers || []).slice(1);
                                const next = e.target.value.trim() ? [e.target.value.trim(), ...rest] : rest;
                                patchDeliverable(d, { approvers: next });
                              }
                            }}
                          />
                        </Td>
                        <Td><Input defaultValue={d.status} className={editInputCls} onBlur={(e) => { if (e.target.value !== d.status) patchDeliverable(d, { status: e.target.value }); }} /></Td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </Card>
          </div>
        )}

        {activeSection === "dep" && (
          <div className="space-y-3">
            <SectionHeading
              title="Dependencies log"
              subtitle={`${raid.openDependencies.length} dependenc${raid.openDependencies.length === 1 ? "y" : "ies"} · Same data as Dependencies Log`}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" style={{ color: chrome.blueFg }} onClick={() => openWorkspaceTool("dependencies_log")}>
                    Open Dependencies Log <ExternalLink className="h-3 w-3" />
                  </Button>
                  <PrimaryBtn disabled={!!creatingKind} onClick={() => void createRaidd("dependency", "New dependency", { issueType: "Internal", dependentOn: "Inbound", category: "Internal" })}>
                    {creatingKind === "dependency" ? "Creating…" : "+ Add dependency"}
                  </PrimaryBtn>
                </div>
              }
            />
            <Card>
              {raid.openDependencies.length === 0 ? (
                <EmptyState label="No open dependencies." />
              ) : (
                <DataTable>
                  <thead><tr><Th>ID</Th><Th>Dependency description</Th><Th>Type</Th><Th>Dependent on</Th><Th>Date identified</Th><Th>Impact if unmet</Th><Th>Owner</Th><Th>Due by</Th><Th>Status</Th><Th /></tr></thead>
                  <tbody>
                    {raid.openDependencies.map((d, i) => (
                      <tr key={d.id ?? i} style={rowBorder}>
                        <Td style={monoMuted}>{d.ref || "—"}</Td>
                        <Td>
                          <Input
                            defaultValue={d.description}
                            className={cn(editInputCls, "font-semibold")}
                            onBlur={(e) => { if (e.target.value !== d.description) patchRaidd(d.id, { title: e.target.value }); }}
                          />
                        </Td>
                        <Td>
                          <Input
                            defaultValue={d.type || ""}
                            className={editInputCls}
                            placeholder="Internal / External…"
                            onBlur={(e) => {
                              const v = e.target.value;
                              if (v !== (d.type || "")) patchRaidd(d.id, { issueType: v, category: v });
                            }}
                          />
                        </Td>
                        <Td>
                          <Input
                            defaultValue={d.direction || ""}
                            className={editInputCls}
                            placeholder="Inbound / party…"
                            onBlur={(e) => {
                              const v = e.target.value;
                              if (v !== (d.direction || "")) patchRaidd(d.id, { dependentOn: v });
                            }}
                          />
                        </Td>
                        <Td style={monoCell}>{fmtDate(d.dateIdentified)}</Td>
                        <Td>
                          <Input
                            defaultValue={d.impact || ""}
                            className={editInputCls}
                            onBlur={(e) => { if (e.target.value !== (d.impact || "")) patchRaidd(d.id, { impact: e.target.value }); }}
                          />
                        </Td>
                        <Td>
                          <Input
                            defaultValue={d.owner || ""}
                            className={editInputCls}
                            onBlur={(e) => { if (e.target.value !== (d.owner || "")) patchRaidd(d.id, { ownerName: e.target.value }); }}
                          />
                        </Td>
                        <Td>
                          <Input
                            type="date"
                            defaultValue={toDateInput(d.requiredBy)}
                            className={cn(editInputCls, "font-mono")}
                            onBlur={(e) => { if (e.target.value !== toDateInput(d.requiredBy)) patchRaidd(d.id, { requiredByDate: e.target.value || null }); }}
                          />
                        </Td>
                        <Td>
                          <Input
                            defaultValue={d.status || ""}
                            className={editInputCls}
                            onBlur={(e) => { if (e.target.value !== (d.status || "")) patchRaidd(d.id, { status: e.target.value }); }}
                          />
                        </Td>
                        <Td><button type="button" className="px-1" style={{ color: chrome.text4 }} title="Archive" onClick={() => archiveRaidd(d.id)}>×</button></Td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </Card>
          </div>
        )}

        {activeSection === "act" && (
          <div className="space-y-3">
            <SectionHeading
              title="Actions log"
              subtitle={`Programme / PMO actions from RAIDD · ${actionKpis.open} open`}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <select value={actionOwnerFilter} onChange={(e) => setActionOwnerFilter(e.target.value)} className={selectCls}>
                    <option value="all">All owners</option>
                    {actionOwners.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select value={actionStatusFilter} onChange={(e) => setActionStatusFilter(e.target.value)} className={selectCls}>
                    <option value="all">All statuses</option>
                    {actionStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <PrimaryBtn disabled={!!creatingKind} onClick={() => void createRaidd("action", "New action")}>
                    {creatingKind === "action" ? "Creating…" : "+ Add action"}
                  </PrimaryBtn>
                </div>
              }
            />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <Kpi label="Open" value={actionKpis.open} color={R360.brand} />
              <Kpi label="Overdue" value={actionKpis.overdue} color={R360.redD} />
              <Kpi label="Due this week" value={actionKpis.dueThisWeek} color={R360.amberD} />
              <Kpi label="Completed" value={actionKpis.completed} color={R360.greenD} />
            </div>
            <Card>
              {actionsFiltered.length === 0 ? (
                <EmptyState label="No actions match the current filters." />
              ) : (
                <DataTable>
                  <thead><tr><Th>ID</Th><Th>Action</Th><Th>Raised from</Th><Th>Owner</Th><Th>Raised</Th><Th>Due</Th><Th>Status</Th><Th /></tr></thead>
                  <tbody>
                    {actionsFiltered.map((a) => (
                      <tr key={a.dbId ?? a.id} style={rowBorder}>
                        <Td className="font-mono text-[11px]">{a.id}</Td>
                        <Td>
                          <Input
                            defaultValue={a.text}
                            className={editInputCls}
                            onBlur={(e) => { if (e.target.value !== a.text) patchRaidd(a.dbId, { title: e.target.value }); }}
                          />
                        </Td>
                        <Td>
                          <Input
                            defaultValue={a.raisedFrom || ""}
                            className={editInputCls}
                            onBlur={(e) => { if (e.target.value !== (a.raisedFrom || "")) patchRaidd(a.dbId, { linkedItemType: e.target.value }); }}
                          />
                        </Td>
                        <Td>
                          <Input
                            defaultValue={a.owner}
                            className={editInputCls}
                            onBlur={(e) => { if (e.target.value !== a.owner) patchRaidd(a.dbId, { ownerName: e.target.value }); }}
                          />
                        </Td>
                        <Td className="font-mono text-[11px]">{fmtDate(a.raised)}</Td>
                        <Td>
                          <Input
                            type="date"
                            defaultValue={toDateInput(a.due)}
                            className={cn(editInputCls, "font-mono")}
                            onBlur={(e) => { if (e.target.value !== toDateInput(a.due)) patchRaidd(a.dbId, { dueDate: e.target.value || null }); }}
                          />
                        </Td>
                        <Td>
                          <Input
                            defaultValue={a.status || ""}
                            className={editInputCls}
                            onBlur={(e) => { if (e.target.value !== (a.status || "")) patchRaidd(a.dbId, { status: e.target.value }); }}
                          />
                        </Td>
                        <Td><button type="button" className="px-1" style={{ color: chrome.text4 }} onClick={() => archiveRaidd(a.dbId)}>×</button></Td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </Card>
          </div>
        )}

        {activeSection === "team" && (
          <div className="space-y-3">
            <SectionHeading
              title="Project team"
              subtitle={`${team.length} people · Same data as Org Chart / Resource Tracker team`}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" style={{ color: chrome.blueFg }} onClick={() => openWorkspaceTool("org_chart")}>
                    Open Org Chart <ExternalLink className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" style={{ color: chrome.blueFg }} onClick={() => openWorkspaceTool("resource_tracker")}>
                    Open Resource Tracker <ExternalLink className="h-3 w-3" />
                  </Button>
                  <SegToggle
                    value={teamView}
                    onChange={setTeamView}
                    options={[{ value: "list", label: "☰ List" }, { value: "org", label: "🏢 Org chart" }]}
                  />
                </div>
              }
            />
            {teamView === "list" ? (
              <Card>
                {team.length === 0 ? (
                  <EmptyState label="No team members listed. Add people in Org Chart or Resource Tracker (team members must be linked to a user)." />
                ) : (
                  <DataTable>
                    <thead><tr><Th>Name</Th><Th>Organisation</Th><Th>Type</Th><Th>Role</Th><Th>Workstream</Th><Th>Start date</Th><Th>Planned end</Th><Th>Allocation</Th><Th>Status</Th></tr></thead>
                    <tbody>
                      {supplierTeam.length > 0 && (
                        <tr className="bg-muted/30">
                          <Td colSpan={9} className="!py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Supplier team
                          </Td>
                        </tr>
                      )}
                      {supplierTeam.map((r) => <TeamRow key={r.id ?? r.name} r={r} onPatchRole={(t, role) => patchTeam(t, { role })} onPatchAllocation={(t, allocation) => patchTeam(t, { allocation })} />)}
                      {customerTeam.length > 0 && (
                        <tr style={{ background: chrome.border2 }}>
                          <Td colSpan={9} style={{ padding: "6px 12px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: chrome.text4 }}>
                            Customer team{ex.client ? ` — ${ex.client}` : ""}
                          </Td>
                        </tr>
                      )}
                      {customerTeam.map((r) => <TeamRow key={r.id ?? r.name} r={r} onPatchRole={(t, role) => patchTeam(t, { role })} onPatchAllocation={(t, allocation) => patchTeam(t, { allocation })} />)}
                    </tbody>
                  </DataTable>
                )}
              </Card>
            ) : (
              <OrgChartView team={team} />
            )}
          </div>
        )}

        {activeSection === "budget" && (
          <div className="space-y-3.5">
            <div className="rounded-xl px-3.5 py-2.5 flex flex-wrap items-center gap-2 text-xs font-semibold" style={{ background: chrome.noticeBg, border: `1px solid ${chrome.noticeBorder}`, color: chrome.noticeFg }}>
              <span className="flex-1 min-w-[200px]">
                Budget totals use the same project finance fields as Finance Tracker.
              </span>
              <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => openWorkspaceTool("finance_tracker")}>
                Open Finance Tracker →
              </Button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <BudgetCard label="Original budget" value={formatBudget(fin.budget)} accent={R360.brand} sub="Approved baseline" />
              <BudgetCard
                label="Actual cost to date"
                value={formatBudget(fin.spent)}
                accent={R360.amber}
                valueColor={R360.amberD}
                sub={fin.budget > 0 ? `${consumedPct}% consumed` : undefined}
              />
              <BudgetCard label="Forecast to complete" value={formatBudget(fin.remaining)} accent={R360.blue} sub="Remaining forecast" />
              <BudgetCard
                label="Forecast outturn (EAC)"
                value={formatBudget(eac)}
                accent={eacVariance > 0 ? R360.amber : R360.green}
                valueColor={eacVariance > 0 ? R360.amberD : undefined}
                sub={eacVariance !== 0 ? `${eacVariance > 0 ? "⚠ +" : "−"}${formatBudget(Math.abs(eacVariance))} vs budget` : undefined}
                subColor={eacVariance > 0 ? R360.amberD : R360.greenD}
              />
            </div>
            <Card>
              <CardHead title="Budget breakdown by category" subtitle="From Finance Tracker (project budgets)" />
              {breakdown.length === 0 ? (
                <EmptyState label="No finance budget lines for this project yet." />
              ) : (
                <DataTable>
                  <thead><tr><Th>Category</Th><Th align="right">Budgeted</Th><Th align="right">Actual</Th><Th align="right">Variance £</Th><Th align="right">Variance %</Th><Th>Status</Th></tr></thead>
                  <tbody>
                    {breakdown.map((row, i) => {
                      const variance = row.actual - row.budgeted;
                      const pct = row.budgeted > 0 ? (variance / row.budgeted) * 100 : 0;
                      const rag: R360Rag = variance === 0 ? "green" : variance > 0 ? (pct > 5 ? "red" : "amber") : "green";
                      const varColor = variance > 0 ? R360.redD : variance < 0 ? R360.greenD : chrome.text3;
                      return (
                        <tr key={i} style={rowBorder}>
                          <Td style={{ fontWeight: 600 }}>{row.category}</Td>
                          <Td align="right" style={monoCell}>{formatBudget(row.budgeted)}</Td>
                          <Td align="right" style={monoCell}>{formatBudget(row.actual)}</Td>
                          <Td align="right" style={{ ...monoCell, color: varColor, fontWeight: 700 }}>
                            {variance === 0 ? "—" : `${variance > 0 ? "+" : "-"}${formatBudget(Math.abs(variance))}`}
                          </Td>
                          <Td align="right" style={{ fontSize: 11, color: varColor }}>
                            {variance === 0 ? "0%" : `${variance > 0 ? "+" : "-"}${Math.abs(pct).toFixed(1)}%`}
                          </Td>
                          <Td><Rag value={rag} /></Td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: chrome.border2 }}>
                      <Td style={{ fontWeight: 800, fontSize: 13 }}>TOTAL</Td>
                      <Td align="right" style={{ ...monoCell, fontWeight: 800 }}>{formatBudget(totalBudgeted)}</Td>
                      <Td align="right" style={{ ...monoCell, fontWeight: 800 }}>{formatBudget(totalActual)}</Td>
                      <Td align="right" style={{ ...monoCell, fontWeight: 800, color: totalVariance > 0 ? R360.redD : totalVariance < 0 ? R360.greenD : chrome.text }}>
                        {totalVariance === 0 ? "—" : `${totalVariance > 0 ? "+" : "-"}${formatBudget(Math.abs(totalVariance))}`}
                      </Td>
                      <Td align="right" style={{ fontWeight: 800, fontSize: 12, color: totalVariance > 0 ? R360.redD : totalVariance < 0 ? R360.greenD : chrome.text }}>
                        {totalBudgeted > 0 ? `${totalVariance > 0 ? "+" : "-"}${Math.abs((totalVariance / totalBudgeted) * 100).toFixed(1)}%` : "0%"}
                      </Td>
                      <Td><Rag value={totalVariance > 0 ? "amber" : "green"} /></Td>
                    </tr>
                  </tbody>
                </DataTable>
              )}
            </Card>
          </div>
        )}

        {activeSection === "readiness" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[15px] font-extrabold text-foreground">Readiness board</div>
                <div className="text-xs mt-0.5 text-muted-foreground">
                  Go/No-Go criteria by phase · Amber/Red items require commentary
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select className={selectCls} value={readinessPhaseFilter} onChange={(e) => setReadinessPhaseFilter(e.target.value)}>
                  <option value="all">All phases</option>
                  {[...new Set(readinessItems.map((r) => r.phase).filter(Boolean))].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    if (readinessAddLockRef.current) return;
                    readinessAddLockRef.current = true;
                    setReadinessItems((prev) => [
                      ...prev,
                      { id: `rd-${Date.now()}`, phase: readinessPhaseFilter !== "all" ? readinessPhaseFilter : "Current", activity: "New criteria", criteria: "", rag: "not_started", owner: "", commentary: "" },
                    ]);
                    window.setTimeout(() => {
                      readinessAddLockRef.current = false;
                    }, 400);
                  }}
                >
                  + Add criteria
                </Button>
                <PrimaryBtn disabled={publishing} onClick={() => void saveSnapshot(false)}>
                  {publishing ? "Saving…" : "Save board"}
                </PrimaryBtn>
              </div>
            </div>

            {readinessVerdict && (
              <div className="rounded-xl px-4 py-3 flex flex-wrap items-center gap-3" style={{ background: readinessVerdict.bg, border: `1px solid ${readinessVerdict.color}55` }}>
                <span className="rounded-lg px-3 py-1.5 text-sm font-black" style={{ background: readinessVerdict.color, color: "#fff" }}>{readinessVerdict.label}</span>
                <span className="text-xs font-semibold" style={{ color: readinessVerdict.fg }}>{readinessVerdict.msg}</span>
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              <Kpi label="On track / Complete" value={readinessCounts.green} color={R360.greenD} />
              <Kpi label="At risk (Amber)" value={readinessCounts.amber} color={R360.amberD} />
              <Kpi label="Blocked (Red)" value={readinessCounts.red} color={R360.redD} />
              <Kpi label="Not started" value={readinessCounts.notStarted} color={chrome.text3} />
            </div>

            <Card>
              {readinessItems.length === 0 ? (
                <EmptyState label="No readiness criteria yet. Add criteria to build the readiness board." />
              ) : (
                <>
                  <div
                    className="hidden lg:grid gap-0 px-3.5 py-2.5 bg-muted/20 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                    style={{ gridTemplateColumns: "90px 160px 1fr 100px 120px 220px 32px" }}
                  >
                    <div>Phase</div><div>Activity</div><div>Criteria</div><div>RAG</div><div>Owner</div><div>Commentary</div><div />
                  </div>
                  {readinessItems
                    .filter((item) => readinessPhaseFilter === "all" || item.phase === readinessPhaseFilter)
                    .map((item, i) => {
                      const rag = normR360Rag(item.rag);
                      const needsCommentary = rag === "amber" || rag === "red";
                      return (
                        <div
                          key={item.id}
                          className="grid grid-cols-1 lg:grid-cols-[90px_160px_1fr_100px_120px_220px_32px] gap-2 lg:gap-2 px-3.5 py-2.5 items-start"
                          style={{
                            borderBottom: `1px solid ${chrome.border2}`,
                            background: rag === "amber" ? `${R360.amber}0A` : rag === "red" ? `${R360.red}0A` : i % 2 === 1 ? chrome.border2 : undefined,
                          }}
                        >
                          <Input value={item.phase} className="h-7 text-[10px] bg-transparent" onChange={(e) => setReadinessItems((prev) => prev.map((r) => (r.id === item.id ? { ...r, phase: e.target.value } : r)))} />
                          <Input value={item.activity} className="h-7 text-[11px] font-semibold bg-transparent" onChange={(e) => setReadinessItems((prev) => prev.map((r) => (r.id === item.id ? { ...r, activity: e.target.value } : r)))} />
                          <Input value={item.criteria} className="h-7 text-[11px] bg-transparent" onChange={(e) => setReadinessItems((prev) => prev.map((r) => (r.id === item.id ? { ...r, criteria: e.target.value } : r)))} />
                          <button type="button" onClick={() => cycleReadinessRag(item.id)} className="justify-self-start">
                            <Rag value={item.rag} />
                          </button>
                          <Input value={item.owner} className="h-7 text-[11px] bg-transparent" onChange={(e) => setReadinessItems((prev) => prev.map((r) => (r.id === item.id ? { ...r, owner: e.target.value } : r)))} />
                          <EditField
                            value={item.commentary}
                            onChange={(v) => setReadinessItems((prev) => prev.map((r) => (r.id === item.id ? { ...r, commentary: v } : r)))}
                            size="sm"
                            borderColor={needsCommentary ? ragBarColor(rag) : undefined}
                            placeholder={needsCommentary ? "Commentary required for Amber/Red..." : "Optional commentary..."}
                          />
                          <button
                            type="button"
                            className="px-1 justify-self-center"
                            style={{ color: chrome.text4 }}
                            title="Remove criteria"
                            onClick={() => setReadinessItems((prev) => prev.filter((r) => r.id !== item.id))}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                </>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
