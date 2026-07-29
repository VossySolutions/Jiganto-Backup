import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  LEVEL1_STATUS_COLORS,
  R360,
  r360Chrome,
} from "./report-360-theme";
import { useTheme } from "@/hooks/use-theme";
import { Check, Plus, Trash2, X } from "lucide-react";

type PlanBarStatus = "not_started" | "in_progress" | "at_risk" | "delayed" | "completed";

export type Level1PlanRow =
  | {
      id: string;
      kind: "release";
      name: string;
      /** Inclusive week indexes 0..47 — editable span on the timeline */
      startWeek?: number;
      endWeek?: number;
    }
  | {
      id: string;
      kind: "phase";
      name: string;
      status: PlanBarStatus;
      /** Inclusive week indexes 0..47 (Jan W1 … Dec W4) */
      startWeek: number;
      endWeek: number;
      phaseId?: number;
    }
  | {
      id: string;
      kind: "milestone";
      name: string;
      week: number;
      done?: boolean;
      milestoneId?: number;
      parentPhaseRowId?: string;
      phaseId?: number;
    };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKS_PER_MONTH = 4;
const TOTAL_WEEKS = MONTHS.length * WEEKS_PER_MONTH;

const STATUS_META: Record<PlanBarStatus, { label: string; color: string; text?: string }> = {
  ...LEVEL1_STATUS_COLORS,
};

const STATUS_CYCLE: PlanBarStatus[] = [
  "not_started", "in_progress", "at_risk", "delayed", "completed",
];

type Props = {
  rows: Level1PlanRow[];
  onChange: (rows: Level1PlanRow[]) => void;
  year?: number;
};

function clampWeek(w: number) {
  return Math.max(0, Math.min(TOTAL_WEEKS - 1, w));
}

function insertIndexAfterPhase(rows: Level1PlanRow[], phaseRowId: string): number {
  const phaseIdx = rows.findIndex((r) => r.id === phaseRowId && r.kind === "phase");
  if (phaseIdx < 0) return rows.length;
  let i = phaseIdx + 1;
  while (i < rows.length && rows[i].kind === "milestone") {
    const m = rows[i];
    if (m.kind === "milestone" && m.parentPhaseRowId && m.parentPhaseRowId !== phaseRowId) break;
    i += 1;
  }
  return i;
}

function insertIndexAfterRelease(rows: Level1PlanRow[], releaseId: string): number {
  const releaseIdx = rows.findIndex((r) => r.id === releaseId && r.kind === "release");
  if (releaseIdx < 0) return rows.length;
  let i = releaseIdx + 1;
  while (i < rows.length && rows[i].kind !== "release") i += 1;
  return i;
}

function lastPhaseInRows(rows: Level1PlanRow[]): Extract<Level1PlanRow, { kind: "phase" }> | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].kind === "phase") return rows[i] as Extract<Level1PlanRow, { kind: "phase" }>;
  }
  return null;
}

function lastReleaseInRows(rows: Level1PlanRow[]): Extract<Level1PlanRow, { kind: "release" }> | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].kind === "release") return rows[i] as Extract<Level1PlanRow, { kind: "release" }>;
  }
  return null;
}

function isGoLive(name: string) {
  const n = name.toLowerCase();
  return n.includes("go-live") || n.includes("golive") || n.includes("go live");
}

/** Always ◆ — matches legend (no star icons). */
function milestoneAccent(row: Extract<Level1PlanRow, { kind: "milestone" }>): { color: string; text: string } {
  if (row.done) return { color: R360.teal, text: R360.tealD };
  if (isGoLive(row.name)) return { color: R360.blue, text: R360.blueD };
  const n = (row.name || "").toLowerCase();
  if (n.includes("review") || n.includes("risk") || n.includes("gap")) {
    return { color: R360.amber, text: R360.amberD };
  }
  return { color: R360.brand, text: R360.text3 };
}

function releaseSpan(row: Extract<Level1PlanRow, { kind: "release" }>) {
  return {
    startWeek: row.startWeek ?? 0,
    endWeek: row.endWeek ?? TOTAL_WEEKS - 1,
  };
}

function monthOverlapsPhase(mi: number, startWeek: number, endWeek: number) {
  const mStart = mi * WEEKS_PER_MONTH;
  const mEnd = mStart + WEEKS_PER_MONTH - 1;
  return endWeek >= mStart && startWeek <= mEnd;
}

function isFirstOverlapMonth(mi: number, startWeek: number, endWeek: number) {
  if (!monthOverlapsPhase(mi, startWeek, endWeek)) return false;
  return mi === 0 || !monthOverlapsPhase(mi - 1, startWeek, endWeek);
}

function milestoneHalfInMonth(week: number, mi: number): "first" | "second" | null {
  const mStart = mi * WEEKS_PER_MONTH;
  if (week < mStart || week >= mStart + WEEKS_PER_MONTH) return null;
  return week - mStart < 2 ? "first" : "second";
}

function weekToMonthLabel(week: number) {
  const mi = Math.floor(week / 4);
  const half = week % 4 < 2 ? "early" : "late";
  return `${half} ${MONTHS[mi] || "?"}`;
}

type AddMilestoneDraft = {
  phaseId: string;
  name: string;
  week: number;
};

export function Level1PlanGantt({ rows, onChange, year = new Date().getFullYear() }: Props) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const chrome = r360Chrome(dark);
  const releaseBands = [
    { bg: chrome.brandL, fg: chrome.brandFg, bar: R360.brandM, border: dark ? "rgba(129,140,248,0.35)" : "#C7D2FE" },
    { bg: chrome.tealL, fg: chrome.tealFg, bar: R360.teal, border: dark ? "rgba(45,212,191,0.35)" : "#99F6E4" },
  ];
  const phaseNameColor: Record<PlanBarStatus, string> = {
    not_started: chrome.text3,
    in_progress: chrome.brandFg,
    at_risk: chrome.amberFg,
    delayed: chrome.redFg,
    completed: chrome.tealFg,
  };
  const [showMilestones, setShowMilestones] = useState(true);
  const [view, setView] = useState<"monthly" | "quarterly">("monthly");
  const [fullscreen, setFullscreen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addMs, setAddMs] = useState<AddMilestoneDraft | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => (selectedId ? rows.find((r) => r.id === selectedId) ?? null : null),
    [rows, selectedId],
  );

  const phases = useMemo(
    () => rows.filter((r): r is Extract<Level1PlanRow, { kind: "phase" }> => r.kind === "phase"),
    [rows],
  );

  const nowPhaseId = useMemo(() => {
    const current = phases.find((p) => p.status === "in_progress");
    return current?.id ?? null;
  }, [phases]);

  const visible = useMemo(
    () => rows.filter((r) => showMilestones || r.kind !== "milestone"),
    [rows, showMilestones],
  );

  const releaseIndexById = useMemo(() => {
    const map = new Map<string, number>();
    let i = 0;
    for (const r of rows) {
      if (r.kind === "release") map.set(r.id, i++);
    }
    return map;
  }, [rows]);

  useEffect(() => {
    if (addMs) {
      const t = window.setTimeout(() => nameInputRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
  }, [addMs]);

  const updateRow = (id: string, patch: Partial<Level1PlanRow>) => {
    onChange(rows.map((r) => (r.id === id ? ({ ...r, ...patch } as Level1PlanRow) : r)));
  };

  const cycleStatus = (id: string) => {
    onChange(
      rows.map((r) => {
        if (r.id !== id || r.kind !== "phase") return r;
        const i = STATUS_CYCLE.indexOf(r.status);
        return { ...r, status: STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length] };
      }),
    );
  };

  const resolvePhaseTarget = (): Extract<Level1PlanRow, { kind: "phase" }> | null => {
    if (selected?.kind === "phase") return selected;
    if (selected?.kind === "milestone") {
      const parentId = selected.parentPhaseRowId;
      if (parentId) {
        const parent = rows.find((r) => r.id === parentId && r.kind === "phase");
        if (parent && parent.kind === "phase") return parent;
      }
      const idx = rows.findIndex((r) => r.id === selected.id);
      for (let i = idx - 1; i >= 0; i--) {
        if (rows[i].kind === "phase") return rows[i] as Extract<Level1PlanRow, { kind: "phase" }>;
      }
    }
    return lastPhaseInRows(rows);
  };

  const resolveReleaseTarget = (): Extract<Level1PlanRow, { kind: "release" }> | null => {
    if (selected?.kind === "release") return selected;
    if (selected?.kind === "phase" || selected?.kind === "milestone") {
      const idx = rows.findIndex((r) => r.id === selected.id);
      for (let i = idx; i >= 0; i--) {
        if (rows[i].kind === "release") return rows[i] as Extract<Level1PlanRow, { kind: "release" }>;
      }
    }
    return lastReleaseInRows(rows);
  };

  const addRelease = () => {
    const n = rows.filter((r) => r.kind === "release").length + 1;
    const releaseId = `r-${Date.now()}`;
    const phaseId = `p-${Date.now()}`;
    onChange([
      ...rows,
      {
        id: releaseId,
        kind: "release",
        name: n === 1 ? "Programme / Release" : `Release / Workstream ${n}`,
        startWeek: 0,
        endWeek: TOTAL_WEEKS - 1,
      },
      {
        id: phaseId,
        kind: "phase",
        name: "New phase",
        status: "not_started",
        startWeek: 0,
        endWeek: 3,
      },
    ]);
    setSelectedId(phaseId);
  };

  const addPhase = (underReleaseId?: string) => {
    const release = underReleaseId
      ? rows.find((r) => r.id === underReleaseId && r.kind === "release")
      : resolveReleaseTarget();

    if (!release || release.kind !== "release") {
      addRelease();
      return;
    }

    const lastPhase = (() => {
      const end = insertIndexAfterRelease(rows, release.id);
      for (let i = end - 1; i >= 0; i--) {
        if (rows[i].kind === "release") break;
        if (rows[i].kind === "phase") return rows[i] as Extract<Level1PlanRow, { kind: "phase" }>;
      }
      return null;
    })();

    const startWeek = lastPhase ? clampWeek(lastPhase.endWeek + 1) : 0;
    const endWeek = clampWeek(startWeek + 3);
    const id = `p-${Date.now()}`;
    const next: Level1PlanRow = {
      id,
      kind: "phase",
      name: "New phase",
      status: "not_started",
      startWeek,
      endWeek,
    };
    const at = insertIndexAfterRelease(rows, release.id);
    const copy = [...rows];
    copy.splice(at, 0, next);
    onChange(copy);
    setSelectedId(id);
  };

  const openAddMilestone = (underPhaseId?: string) => {
    const phase = underPhaseId
      ? (rows.find((r) => r.id === underPhaseId && r.kind === "phase") as Extract<Level1PlanRow, { kind: "phase" }> | undefined)
      : resolvePhaseTarget();

    if (!phase || phase.kind !== "phase") {
      if (phases.length === 0) {
        addRelease();
        return;
      }
      const fallback = phases[0];
      setAddMs({
        phaseId: fallback.id,
        name: "",
        week: clampWeek(Math.round((fallback.startWeek + fallback.endWeek) / 2)),
      });
      setSelectedId(fallback.id);
      return;
    }

    setSelectedId(phase.id);
    setAddMs({
      phaseId: phase.id,
      name: "",
      week: clampWeek(Math.round((phase.startWeek + phase.endWeek) / 2)),
    });
  };

  const confirmAddMilestone = () => {
    if (!addMs) return;
    const phase = rows.find((r) => r.id === addMs.phaseId && r.kind === "phase") as
      | Extract<Level1PlanRow, { kind: "phase" }>
      | undefined;
    if (!phase) return;
    const title = addMs.name.trim() || "New milestone";
    const id = `m-${Date.now()}`;
    const next: Level1PlanRow = {
      id,
      kind: "milestone",
      name: title,
      week: clampWeek(addMs.week),
      parentPhaseRowId: phase.id,
      phaseId: phase.phaseId,
    };
    const at = insertIndexAfterPhase(rows, phase.id);
    const copy = [...rows];
    copy.splice(at, 0, next);
    onChange(copy);
    setSelectedId(id);
    setAddMs(null);
    if (!showMilestones) setShowMilestones(true);
  };

  const removeSelected = () => {
    if (!selected) return;
    if (selected.kind === "phase") {
      onChange(
        rows.filter((r) => {
          if (r.id === selected.id) return false;
          if (r.kind === "milestone" && r.parentPhaseRowId === selected.id) return false;
          return true;
        }),
      );
    } else if (selected.kind === "release") {
      const start = rows.findIndex((r) => r.id === selected.id);
      const end = insertIndexAfterRelease(rows, selected.id);
      onChange([...rows.slice(0, start), ...rows.slice(end)]);
    } else {
      onChange(rows.filter((r) => r.id !== selected.id));
    }
    setSelectedId(null);
  };

  const setRowWeeks = (id: string, startWeek: number, endWeek: number) => {
    const s = clampWeek(Math.min(startWeek, endWeek));
    const e = clampWeek(Math.max(startWeek, endWeek));
    onChange(
      rows.map((r) => {
        if (r.id !== id) return r;
        if (r.kind === "phase" || r.kind === "release") return { ...r, startWeek: s, endWeek: e };
        return r;
      }),
    );
  };

  const border = `1px solid ${chrome.border2}`;
  const headerBorder = `1px solid ${chrome.border}`;
  const colSpanAll = 1 + (view === "quarterly" ? 12 : TOTAL_WEEKS);

  const selectedPhase = selected?.kind === "phase" ? selected : null;
  const selectedRelease = selected?.kind === "release" ? selected : null;
  const addMsPhase = addMs
    ? (rows.find((r) => r.id === addMs.phaseId && r.kind === "phase") as Extract<Level1PlanRow, { kind: "phase" }> | undefined)
    : undefined;

  return (
    <div className={cn("space-y-2.5", fullscreen && "fixed inset-0 z-50 bg-background p-4 overflow-auto")}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg p-0.5 shrink-0" style={{ background: chrome.border2 }}>
          {(["monthly", "quarterly"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "px-3 py-1 text-xs rounded-md capitalize",
                view === v ? "bg-card shadow-sm font-bold" : "text-muted-foreground font-semibold",
              )}
              style={view === v ? { color: R360.brand } : undefined}
            >
              {v}
            </button>
          ))}
        </div>
        <label
          className="flex items-center gap-1.5 text-xs font-semibold border rounded-md px-2.5 py-1.5 bg-card cursor-pointer shrink-0"
          style={{ borderColor: chrome.border }}
        >
          <input
            type="checkbox"
            checked={showMilestones}
            onChange={(e) => setShowMilestones(e.target.checked)}
            style={{ accentColor: R360.brand }}
          />
          Show milestones
        </label>
        <Button type="button" variant="outline" size="sm" className="h-[30px] text-xs shrink-0" onClick={addRelease}>
          + Add release
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-[30px] text-xs shrink-0" onClick={() => addPhase()}>
          + Add phase
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-[30px] text-xs shrink-0"
          onClick={() => openAddMilestone()}
          disabled={phases.length === 0 && rows.length === 0}
        >
          + Add milestone
        </Button>
        <div className="flex-1 min-w-[8px]" />
        <div className="hidden lg:flex flex-wrap gap-2.5 text-[10px] font-bold" style={{ color: chrome.text2 }}>
          {STATUS_CYCLE.map((s) => (
            <span key={s} className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-2.5 rounded-sm" style={{ background: STATUS_META[s].color }} />
              {STATUS_META[s].label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <span
              className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-black text-white"
              style={{ background: chrome.text }}
            >
              ◆
            </span>
            Milestone
          </span>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-[30px] text-xs shrink-0" onClick={() => setFullscreen((f) => !f)}>
          {fullscreen ? "Exit fullscreen" : "⤢ Fullscreen"}
        </Button>
      </div>

      {/* Selection inspector — only when a row is selected */}
      {selected && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-[11px]"
          style={{
            borderColor: resolvedTheme === "dark" ? "rgba(129,140,248,0.35)" : "#C7D2FE",
            background: chrome.brandL,
          }}
        >
          <span className="font-bold" style={{ color: R360.brandD }}>
            {selected.kind === "release" && "Release"}
            {selected.kind === "phase" && "Phase"}
            {selected.kind === "milestone" && "Milestone"}
          </span>
          <span className="font-semibold truncate max-w-[160px]" style={{ color: chrome.text }}>
            {selected.name || "Untitled"}
          </span>

          {selectedPhase && (
            <>
              <label className="flex items-center gap-1 font-semibold" style={{ color: chrome.text3 }}>
                Status
                <select
                  className="h-7 rounded-md border bg-card px-1.5 font-semibold"
                  style={{ borderColor: chrome.border, color: chrome.text }}
                  value={selectedPhase.status}
                  onChange={(e) => updateRow(selectedPhase.id, { status: e.target.value as PlanBarStatus })}
                >
                  {STATUS_CYCLE.map((s) => (
                    <option key={s} value={s}>{STATUS_META[s].label}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1 font-semibold" style={{ color: chrome.text3 }}>
                From
                <select
                  className="h-7 rounded-md border bg-card px-1.5 font-semibold"
                  style={{ borderColor: chrome.border, color: chrome.text }}
                  value={Math.floor(selectedPhase.startWeek / 4)}
                  onChange={(e) => {
                    const mi = Number(e.target.value);
                    const start = mi * 4;
                    const span = Math.max(3, selectedPhase.endWeek - selectedPhase.startWeek);
                    setRowWeeks(selectedPhase.id, start, start + span);
                  }}
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i}>{m}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1 font-semibold" style={{ color: chrome.text3 }}>
                To
                <select
                  className="h-7 rounded-md border bg-card px-1.5 font-semibold"
                  style={{ borderColor: chrome.border, color: chrome.text }}
                  value={Math.floor(selectedPhase.endWeek / 4)}
                  onChange={(e) => {
                    const mi = Number(e.target.value);
                    setRowWeeks(selectedPhase.id, selectedPhase.startWeek, mi * 4 + 3);
                  }}
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i}>{m}</option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                size="sm"
                className="h-7 text-[11px] gap-1"
                style={{ background: R360.brand, color: "#fff" }}
                onClick={() => openAddMilestone(selectedPhase.id)}
              >
                <Plus className="h-3 w-3" /> Milestone
              </Button>
            </>
          )}

          {selectedRelease && (() => {
            const span = releaseSpan(selectedRelease);
            return (
              <>
                <label className="flex items-center gap-1 font-semibold" style={{ color: chrome.text3 }}>
                  From
                  <select
                    className="h-7 rounded-md border bg-card px-1.5 font-semibold"
                    style={{ borderColor: chrome.border, color: chrome.text }}
                    value={Math.floor(span.startWeek / 4)}
                    onChange={(e) => {
                      const mi = Number(e.target.value);
                      const start = mi * 4;
                      const len = Math.max(3, span.endWeek - span.startWeek);
                      setRowWeeks(selectedRelease.id, start, start + len);
                    }}
                  >
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i}>{m}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1 font-semibold" style={{ color: chrome.text3 }}>
                  To
                  <select
                    className="h-7 rounded-md border bg-card px-1.5 font-semibold"
                    style={{ borderColor: chrome.border, color: chrome.text }}
                    value={Math.floor(span.endWeek / 4)}
                    onChange={(e) => {
                      const mi = Number(e.target.value);
                      setRowWeeks(selectedRelease.id, span.startWeek, mi * 4 + 3);
                    }}
                  >
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i}>{m}</option>
                    ))}
                  </select>
                </label>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-[11px] gap-1"
                  style={{ background: R360.brand, color: "#fff" }}
                  onClick={() => addPhase(selectedRelease.id)}
                >
                  <Plus className="h-3 w-3" /> Phase
                </Button>
              </>
            );
          })()}

          {selected.kind === "milestone" && (
            <>
              <label className="flex items-center gap-1 font-semibold" style={{ color: chrome.text3 }}>
                Month
                <select
                  className="h-7 rounded-md border bg-card px-1.5 font-semibold"
                  style={{ borderColor: chrome.border, color: chrome.text }}
                  value={Math.floor(selected.week / 4)}
                  onChange={(e) => {
                    const mi = Number(e.target.value);
                    const half = selected.week % 4 < 2 ? 1 : 3;
                    updateRow(selected.id, { week: clampWeek(mi * 4 + half) });
                  }}
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i}>{m}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="inline-flex items-center gap-1 h-7 px-2 rounded-md border text-[11px] font-semibold bg-card"
                style={{
                  borderColor: selected.done ? R360.teal : chrome.border,
                  color: selected.done ? R360.tealD : chrome.text3,
                }}
                onClick={() => updateRow(selected.id, { done: !selected.done })}
              >
                <Check className="h-3 w-3" />
                {selected.done ? "Complete" : "Mark complete"}
              </button>
            </>
          )}

          <div className="flex-1" />
          <Button type="button" variant="ghost" size="sm" className="h-7 text-[11px] text-destructive" onClick={removeSelected}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
          </Button>
          <button
            type="button"
            className="p-1 rounded hover:bg-card/80"
            style={{ color: chrome.text4 }}
            onClick={() => setSelectedId(null)}
            aria-label="Clear selection"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Add milestone dialog */}
      {addMs && (
        <div
          className="rounded-lg border px-3 py-3 space-y-2.5 shadow-sm"
          style={{ borderColor: chrome.border, background: chrome.surface }}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-extrabold" style={{ color: chrome.text }}>
              Add milestone under a phase
            </div>
            <button type="button" className="p-1 rounded hover:bg-muted" onClick={() => setAddMs(null)} aria-label="Cancel">
              <X className="h-3.5 w-3.5" style={{ color: chrome.text4 }} />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto] items-end">
            <label className="block space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: chrome.text4 }}>Parent phase</span>
              <select
                className="w-full h-8 rounded-md border bg-card px-2 text-xs font-semibold"
                style={{ borderColor: chrome.border, color: chrome.text }}
                value={addMs.phaseId}
                onChange={(e) => {
                  const phase = rows.find((r) => r.id === e.target.value && r.kind === "phase") as
                    | Extract<Level1PlanRow, { kind: "phase" }>
                    | undefined;
                  setAddMs({
                    phaseId: e.target.value,
                    name: addMs.name,
                    week: phase
                      ? clampWeek(Math.round((phase.startWeek + phase.endWeek) / 2))
                      : addMs.week,
                  });
                  setSelectedId(e.target.value);
                }}
              >
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>{p.name || "Untitled phase"}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: chrome.text4 }}>Milestone name</span>
              <Input
                ref={nameInputRef}
                value={addMs.name}
                onChange={(e) => setAddMs({ ...addMs, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmAddMilestone();
                  if (e.key === "Escape") setAddMs(null);
                }}
                placeholder="e.g. Business Blueprint approved"
                className="h-8 text-xs"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: chrome.text4 }}>Timing</span>
              <select
                className="w-full h-8 rounded-md border bg-card px-2 text-xs font-semibold"
                style={{ borderColor: chrome.border, color: chrome.text }}
                value={Math.floor(addMs.week / 4) * 2 + (addMs.week % 4 < 2 ? 0 : 1)}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  const mi = Math.floor(idx / 2);
                  const half = idx % 2;
                  setAddMs({ ...addMs, week: clampWeek(mi * 4 + (half === 0 ? 1 : 3)) });
                }}
              >
                {MONTHS.flatMap((m, mi) => [
                  <option key={`${m}-a`} value={mi * 2}>{`Early ${m}`}</option>,
                  <option key={`${m}-b`} value={mi * 2 + 1}>{`Late ${m}`}</option>,
                ])}
              </select>
            </label>
          </div>
          {addMsPhase && (
            <p className="text-[10px]" style={{ color: chrome.text4 }}>
              Will appear under <strong style={{ color: chrome.text2 }}>{addMsPhase.name || "phase"}</strong>
              {" · "}suggested {weekToMonthLabel(addMs.week)}
              {addMsPhase.status === "in_progress" ? " · current phase" : ""}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setAddMs(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              style={{ background: R360.brand, color: "#fff" }}
              onClick={confirmAddMilestone}
            >
              Add milestone
            </Button>
          </div>
        </div>
      )}

      {/* Gantt */}
      <div className="rounded-xl border overflow-auto bg-card shadow-sm" style={{ borderColor: chrome.border }}>
        <div className="min-w-[960px]">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-muted/40" style={{ color: chrome.text2 }}>
                <th
                  rowSpan={2}
                  className="sticky left-0 z-[2] text-left px-3.5 py-2 min-w-[240px] text-[10px] font-semibold uppercase tracking-wide bg-muted/40"
                  style={{ color: chrome.text3 }}
                >
                  Programme / Release / Phase / Milestone
                </th>
                {MONTHS.map((m) => (
                  <th
                    key={m}
                    colSpan={view === "quarterly" ? 1 : WEEKS_PER_MONTH}
                    className="text-center py-1.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ borderLeft: headerBorder, color: chrome.text3 }}
                  >
                    {m}{m === "Jan" ? ` ${year}` : ""}
                  </th>
                ))}
              </tr>
              {view === "monthly" && (
                <tr className="bg-muted/20" style={{ color: chrome.text4 }}>
                  {Array.from({ length: TOTAL_WEEKS }, (_, i) => (
                    <td
                      key={i}
                      className="text-center py-0.5 font-mono text-[9px]"
                      style={{
                        borderLeft: i % 4 === 0 ? headerBorder : undefined,
                        width: 22,
                        minWidth: 22,
                      }}
                    >
                      {(i % 4) + 1}
                    </td>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={colSpanAll} className="py-10 text-center text-xs" style={{ color: chrome.text4 }}>
                    No Level 1 plan yet. Use <strong>+ Add release</strong> or the dashed button below to start.
                  </td>
                </tr>
              )}

              {visible.map((row) => {
                const isSelected = selectedId === row.id;

                if (row.kind === "release") {
                  const ri = releaseIndexById.get(row.id) ?? 0;
                  const band = releaseBands[ri % releaseBands.length];
                  const span = releaseSpan(row);
                  return (
                    <tr
                      key={row.id}
                      className="cursor-pointer"
                      style={{ background: band.bg }}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <td
                        className="sticky left-0 z-[1] px-3.5 py-2"
                        style={{
                          background: band.bg,
                          borderBottom: `1px solid ${band.border}`,
                          boxShadow: isSelected ? `inset 3px 0 0 ${R360.brand}` : undefined,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Input
                            value={row.name}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateRow(row.id, { name: e.target.value })}
                            className="h-7 border-0 bg-transparent font-extrabold shadow-none px-0 text-xs flex-1"
                            style={{ color: band.fg }}
                            placeholder="Programme / release name..."
                          />
                          <button
                            type="button"
                            className="shrink-0 text-[10px] font-bold px-2 py-1 rounded border bg-card/80"
                            style={{ color: band.fg, borderColor: band.border }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(row.id);
                              addPhase(row.id);
                            }}
                          >
                            + Phase
                          </button>
                        </div>
                      </td>
                      {MONTHS.map((_, mi) => {
                        const overlaps = monthOverlapsPhase(mi, span.startWeek, span.endWeek);
                        return (
                          <td
                            key={mi}
                            colSpan={view === "quarterly" ? 1 : WEEKS_PER_MONTH}
                            className="p-1"
                            style={{
                              background: band.bg,
                              borderLeft: `1px solid ${band.border}`,
                              borderBottom: `1px solid ${band.border}`,
                            }}
                          >
                            {overlaps ? (
                              <button
                                type="button"
                                className="h-2.5 w-full rounded-sm"
                                style={{ background: band.bar }}
                                title="Release span — click empty months to extend, or set From/To above"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedId(row.id);
                                }}
                              />
                            ) : (
                              <button
                                type="button"
                                className="h-2.5 w-full rounded-sm opacity-0 hover:opacity-50 hover:bg-black/10"
                                title="Extend release into this month"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const mStart = mi * 4;
                                  const mEnd = mStart + 3;
                                  setRowWeeks(row.id, Math.min(span.startWeek, mStart), Math.max(span.endWeek, mEnd));
                                  setSelectedId(row.id);
                                }}
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                }

                if (row.kind === "milestone") {
                  const accent = milestoneAccent(row);
                  return (
                    <tr
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedId(row.id)}
                      style={{ background: isSelected ? chrome.brandL : chrome.surface }}
                    >
                      <td
                        className="sticky left-0 z-[1] py-1 pr-3 text-[10px] font-semibold"
                        style={{
                          paddingLeft: 36,
                          color: accent.text,
                          background: isSelected ? chrome.brandL : chrome.surface,
                          borderBottom: border,
                          boxShadow: isSelected ? `inset 3px 0 0 ${R360.brand}` : undefined,
                          fontWeight: accent.color === R360.amber ? 700 : 600,
                        }}
                      >
                        <span className="inline-flex items-center gap-1">
                          <span style={{ color: accent.color }}>◆</span>
                          <Input
                            value={row.name}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateRow(row.id, { name: e.target.value })}
                            className="inline-flex h-5 w-[200px] border-0 bg-transparent shadow-none px-1 text-[10px] font-semibold"
                            style={{ color: "inherit" }}
                            placeholder="Milestone name..."
                          />
                        </span>
                      </td>
                      {MONTHS.map((_, mi) => {
                        const half = milestoneHalfInMonth(row.week, mi);
                        if (view === "quarterly") {
                          return (
                            <td
                              key={mi}
                              className="text-center py-1 text-sm font-black"
                              style={{ borderLeft: border, color: half ? accent.color : undefined }}
                              onClick={(e) => {
                                e.stopPropagation();
                                updateRow(row.id, { week: clampWeek(mi * 4 + 1) });
                              }}
                            >
                              {half ? "◆" : ""}
                            </td>
                          );
                        }
                        return (
                          <td key={mi} colSpan={WEEKS_PER_MONTH} className="p-0" style={{ borderLeft: border }}>
                            <div className="grid grid-cols-2 h-full min-h-[22px]">
                              {(["first", "second"] as const).map((side, si) => (
                                <button
                                  key={side}
                                  type="button"
                                  className="text-center text-sm font-black leading-none hover:bg-muted/50"
                                  style={{
                                    color: half === side ? accent.color : "transparent",
                                    borderLeft: si === 1 ? border : undefined,
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateRow(row.id, { week: clampWeek(mi * 4 + (si === 0 ? 1 : 3)) });
                                  }}
                                  title="Click to move milestone here"
                                >
                                  ◆
                                </button>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                }

                // phase
                const meta = STATUS_META[row.status];
                const isNow = row.id === nowPhaseId;
                const nameColor = phaseNameColor[row.status];
                const rowBg = isNow ? chrome.brandL : isSelected ? chrome.softSelected : chrome.surface;
                const labelCellBg = isNow || isSelected ? rowBg : chrome.surface;

                return (
                  <tr
                    key={row.id}
                    className="cursor-pointer group"
                    style={{ background: rowBg }}
                    onClick={() => setSelectedId(row.id)}
                  >
                    <td
                      className="sticky left-0 z-[1] py-1.5 pr-2 font-bold"
                      style={{
                        paddingLeft: 24,
                        background: labelCellBg,
                        borderBottom: border,
                        boxShadow: isSelected ? `inset 3px 0 0 ${R360.brand}` : undefined,
                      }}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="shrink-0 text-[10px]" style={{ color: meta.color }}>■</span>
                        <Input
                          value={row.name}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateRow(row.id, { name: e.target.value })}
                          className="inline-flex h-6 min-w-0 flex-1 max-w-[140px] border-0 bg-transparent shadow-none px-0.5 font-bold text-[11px]"
                          style={{ color: nameColor, fontWeight: isNow ? 800 : 700 }}
                          placeholder="Phase..."
                        />
                        {isNow && (
                          <span
                            className="shrink-0 text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full leading-none"
                            style={{ background: R360.brand }}
                          >
                            ▶ NOW
                          </span>
                        )}
                        <button
                          type="button"
                          className={cn(
                            "shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded transition-opacity",
                            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                          )}
                          style={{ color: R360.brand, background: "hsl(var(--card))", border: `1px solid ${chrome.border}` }}
                          title="Add milestone under this phase"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddMilestone(row.id);
                          }}
                        >
                          + MS
                        </button>
                      </div>
                    </td>
                    {MONTHS.map((_, mi) => {
                      const overlaps = monthOverlapsPhase(mi, row.startWeek, row.endWeek);
                      const showLabel = isFirstOverlapMonth(mi, row.startWeek, row.endWeek);
                      return (
                        <td
                          key={mi}
                          colSpan={view === "quarterly" ? 1 : WEEKS_PER_MONTH}
                          className="p-1"
                          style={{ borderLeft: border, background: isNow ? chrome.brandL : undefined }}
                        >
                          {overlaps ? (
                            <button
                              type="button"
                              className="h-[18px] w-full rounded flex items-center justify-center text-[9px] font-bold text-white"
                              style={{ background: meta.color }}
                              onClick={(e) => {
                                e.stopPropagation();
                                cycleStatus(row.id);
                                setSelectedId(row.id);
                              }}
                              title="Click to cycle status (or use Status in the bar above)"
                            >
                              {showLabel ? meta.label : ""}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="h-[18px] w-full rounded opacity-0 hover:opacity-50 hover:bg-black/5"
                              title="Extend phase into this month"
                              onClick={(e) => {
                                e.stopPropagation();
                                const mStart = mi * 4;
                                const mEnd = mStart + 3;
                                setRowWeeks(row.id, Math.min(row.startWeek, mStart), Math.max(row.endWeek, mEnd));
                                setSelectedId(row.id);
                              }}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              <tr style={{ height: 6 }}>
                <td colSpan={colSpanAll} style={{ background: chrome.border2 }} />
              </tr>
              <tr>
                <td colSpan={colSpanAll} className="p-0">
                  <button
                    type="button"
                    className="w-full py-2.5 text-xs font-bold text-center border-2 border-dashed hover:bg-[rgba(67,56,202,.04)] transition-colors"
                    style={{ color: R360.brand, borderColor: chrome.border, background: "hsl(var(--primary) / 0.04)" }}
                    onClick={addRelease}
                  >
                    + Add release / project / workstream
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] lg:hidden flex flex-wrap gap-2 font-bold" style={{ color: chrome.text3 }}>
        {STATUS_CYCLE.map((s) => (
          <span key={s} className="inline-flex items-center gap-1">
            <span className="inline-block w-2.5 h-2 rounded-sm" style={{ background: STATUS_META[s].color }} />
            {STATUS_META[s].label}
          </span>
        ))}
      </p>
    </div>
  );
}
