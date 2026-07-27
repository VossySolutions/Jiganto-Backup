import { R360, r360Chrome } from "./report-360-theme";
import { useTheme } from "@/hooks/use-theme";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Plus, Trash2, X } from "lucide-react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const TOTAL_WEEKS = 48;

export type ActivityCode = { code: string; name: string; color: string };

/** Default activity library from client Excel Tab 2 / HTML pack */
export const ACTIVITY_LIBRARY: ActivityCode[] = [
  { code: "INST", name: "Install / Setup", color: R360.brand },
  { code: "HLD", name: "High Level Design", color: R360.brand },
  { code: "LLD", name: "Low Level Design", color: R360.brand },
  { code: "Bld", name: "Build / Config", color: R360.brandM },
  { code: "UT", name: "Unit Test", color: "#818CF8" },
  { code: "Data", name: "Data Migration", color: R360.amber },
  { code: "SIT", name: "System Integration Test", color: "#B45309" },
  { code: "UAT", name: "User Acceptance Test", color: R360.green },
  { code: "Train", name: "Training", color: R360.teal },
  { code: "Cut", name: "Cutover", color: "#0F766E" },
  { code: "HC", name: "Hypercare", color: "#64748B" },
  { code: "Supp", name: "Support", color: "#94A3B8" },
];

/** Preset colours for the add/edit code picker */
const ACTIVITY_COLOR_PRESETS = [
  R360.brand,
  R360.brandM,
  "#818CF8",
  R360.violet,
  R360.teal,
  "#0F766E",
  R360.green,
  R360.amber,
  "#B45309",
  R360.red,
  R360.blue,
  R360.pink,
  "#64748B",
  "#94A3B8",
] as const;

type ActivityLane = {
  id: string;
  name: string;
  env?: "DEV" | "QAS" | "PRD" | "other";
  cells: string[];
  workstreamId?: number;
};

export type ActivityRelease = {
  id: string;
  name: string;
  lanes: ActivityLane[];
  workstreamId?: number;
};

function emptyCells(): string[] {
  return Array.from({ length: TOTAL_WEEKS }, () => "");
}

function padCells(cells: string[] | undefined | null): string[] {
  const src = Array.isArray(cells) ? cells : [];
  return Array.from({ length: TOTAL_WEEKS }, (_, i) => src[i] || "");
}

function normalizeReleases(releases: ActivityRelease[]): ActivityRelease[] {
  return releases.map((rel) => ({
    ...rel,
    lanes: (rel.lanes || []).map((lane) => ({ ...lane, cells: padCells(lane.cells) })),
  }));
}

type Props = {
  releases: ActivityRelease[];
  onChange: (releases: ActivityRelease[]) => void;
  library?: ActivityCode[];
  onLibraryChange?: (library: ActivityCode[]) => void;
  year?: number;
  onYearChange?: (year: number) => void;
  /** Optional save control rendered in the toolbar (right side). */
  onSave?: () => void;
  saving?: boolean;
};

const ENV_CHIP: Record<string, string> = {
  DEV: R360.brand,
  QAS: R360.amber,
  PRD: R360.teal,
  other: "#64748B",
};

function pastelFrom(hex: string): string {
  // Soft card background from solid chip colour
  const h = hex.replace("#", "");
  if (h.length !== 6) return R360.brandL;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},0.14)`;
}

type CellPicker = { relId: string; laneId: string; week: number };
type Selection =
  | { kind: "release"; relId: string }
  | { kind: "lane"; relId: string; laneId: string }
  | null;

function standardLanes(ts = Date.now()): ActivityLane[] {
  return [
    { id: `l-${ts}-d`, name: "DEV (Development)", env: "DEV", cells: emptyCells() },
    { id: `l-${ts}-q`, name: "QAS (Quality Assurance)", env: "QAS", cells: emptyCells() },
    { id: `l-${ts}-p`, name: "PRD (Production)", env: "PRD", cells: emptyCells() },
  ];
}

/** Seed used by empty-state “Start activity plan” — Release + DEV / QAS / PRD. */
export function createEmptyActivityRelease(name = "Release 1"): ActivityRelease {
  const ts = Date.now();
  return {
    id: `rel-${ts}`,
    name,
    lanes: standardLanes(ts),
  };
}

export function ActivityPlanMatrix({
  releases: releasesProp,
  onChange,
  library = ACTIVITY_LIBRARY,
  onLibraryChange,
  year: yearProp = new Date().getFullYear(),
  onYearChange,
  onSave,
  saving = false,
}: Props) {
  const { resolvedTheme } = useTheme();
  const chrome = r360Chrome(resolvedTheme === "dark");
  const releases = useMemo(() => normalizeReleases(releasesProp), [releasesProp]);
  const [year, setYear] = useState(yearProp);
  const [colourMode, setColourMode] = useState<"env" | "code">("code");
  const [fullscreen, setFullscreen] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [cellPicker, setCellPicker] = useState<CellPicker | null>(null);
  const [showAddCode, setShowAddCode] = useState(false);
  const [draftCode, setDraftCode] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState<string>(ACTIVITY_COLOR_PRESETS[0]);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const addBusyRef = useRef(false);

  const codeColor = useMemo(
    () => Object.fromEntries(library.map((a) => [a.code, a.color])),
    [library],
  );

  const selectedRelease = useMemo(() => {
    if (!selection) return null;
    return releases.find((r) => r.id === selection.relId) ?? null;
  }, [releases, selection]);

  const selectedLane = useMemo(() => {
    if (!selection || selection.kind !== "lane" || !selectedRelease) return null;
    return selectedRelease.lanes.find((l) => l.id === selection.laneId) ?? null;
  }, [selection, selectedRelease]);

  useEffect(() => {
    setYear(yearProp);
  }, [yearProp]);

  useEffect(() => {
    if (showAddCode) {
      const t = window.setTimeout(() => codeInputRef.current?.focus(), 40);
      return () => window.clearTimeout(t);
    }
  }, [showAddCode]);

  useEffect(() => {
    if (!cellPicker) return;
    const onDoc = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setCellPicker(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [cellPicker]);

  // Drop selection if the target row was removed
  useEffect(() => {
    if (!selection) return;
    const rel = releases.find((r) => r.id === selection.relId);
    if (!rel) {
      setSelection(null);
      return;
    }
    if (selection.kind === "lane" && !rel.lanes.some((l) => l.id === selection.laneId)) {
      setSelection({ kind: "release", relId: rel.id });
    }
  }, [releases, selection]);

  const withBusy = (fn: () => void) => {
    if (addBusyRef.current) return;
    addBusyRef.current = true;
    try {
      fn();
    } finally {
      window.setTimeout(() => {
        addBusyRef.current = false;
      }, 350);
    }
  };

  const setCell = (relId: string, laneId: string, week: number, code: string) => {
    onChange(
      normalizeReleases(releases).map((rel) => {
        if (rel.id !== relId) return rel;
        return {
          ...rel,
          lanes: rel.lanes.map((lane) => {
            if (lane.id !== laneId) return lane;
            const cells = padCells(lane.cells);
            cells[week] = code;
            return { ...lane, cells };
          }),
        };
      }),
    );
    setCellPicker(null);
  };

  /** Always creates one release with DEV / QAS / PRD (client pack structure). */
  const addRelease = () => {
    withBusy(() => {
      const n = releases.length + 1;
      const id = `rel-${Date.now()}`;
      onChange([
        ...releases,
        {
          id,
          name: `Release ${n}`,
          lanes: standardLanes(),
        },
      ]);
      setSelection({ kind: "release", relId: id });
      setCellPicker(null);
    });
  };

  /** Adds one environment lane under the selected (or last) release. */
  const addEnvironment = (relId?: string) => {
    withBusy(() => {
      const targetId = relId || selectedRelease?.id || releases[releases.length - 1]?.id;
      if (!targetId) {
        // No release yet — create the standard Release + DEV/QAS/PRD structure
        const id = `rel-${Date.now()}`;
        onChange([{ id, name: "Release 1", lanes: standardLanes() }]);
        setSelection({ kind: "release", relId: id });
        setCellPicker(null);
        return;
      }
      const laneId = `l-${Date.now()}`;
      onChange(
        releases.map((r) =>
          r.id !== targetId
            ? r
            : {
                ...r,
                lanes: [
                  ...r.lanes,
                  {
                    id: laneId,
                    name: "Environment / lane",
                    env: "other" as const,
                    cells: emptyCells(),
                  },
                ],
              },
        ),
      );
      setSelection({ kind: "lane", relId: targetId, laneId });
      setCellPicker(null);
    });
  };

  const removeRelease = (relId: string) => {
    onChange(releases.filter((r) => r.id !== relId));
    setSelection(null);
  };

  const removeLane = (relId: string, laneId: string) => {
    onChange(
      releases.map((r) =>
        r.id !== relId ? r : { ...r, lanes: r.lanes.filter((l) => l.id !== laneId) },
      ),
    );
    setSelection({ kind: "release", relId });
  };

  const renameRelease = (relId: string, name: string) => {
    onChange(releases.map((r) => (r.id === relId ? { ...r, name } : r)));
  };

  const patchLane = (relId: string, laneId: string, patch: Partial<ActivityLane>) => {
    onChange(
      releases.map((r) =>
        r.id !== relId
          ? r
          : {
              ...r,
              lanes: r.lanes.map((l) => (l.id === laneId ? { ...l, ...patch } : l)),
            },
      ),
    );
  };

  const openAddCode = () => {
    setDraftCode("");
    setDraftName("");
    setDraftColor(ACTIVITY_COLOR_PRESETS[Math.floor(Math.random() * ACTIVITY_COLOR_PRESETS.length)]);
    setShowAddCode(true);
  };

  const confirmAddCode = () => {
    if (!onLibraryChange || addBusyRef.current) return;
    addBusyRef.current = true;
    const code = (draftCode.trim() || "NEW").slice(0, 4);
    const name = draftName.trim() || "New activity";
    onLibraryChange([...library, { code, name, color: draftColor }]);
    setShowAddCode(false);
    window.setTimeout(() => {
      addBusyRef.current = false;
    }, 300);
  };

  const updateLibraryColor = (index: number, color: string) => {
    if (!onLibraryChange) return;
    onLibraryChange(library.map((x, j) => (j === index ? { ...x, color } : x)));
  };

  const commitLibraryCodeRename = (index: number, oldCode: string, nextCodeRaw: string) => {
    if (!onLibraryChange) return;
    const nextCode = (nextCodeRaw.trim() || oldCode).slice(0, 4);
    if (nextCode === oldCode) return;
    onLibraryChange(library.map((x, j) => (j === index ? { ...x, code: nextCode } : x)));
    onChange(
      releases.map((rel) => ({
        ...rel,
        lanes: rel.lanes.map((lane) => ({
          ...lane,
          cells: lane.cells.map((c) => (c === oldCode ? nextCode : c)),
        })),
      })),
    );
  };

  const releaseBands = [
    { bg: chrome.brandL, fg: chrome.brandFg, bar: R360.brandM, border: resolvedTheme === "dark" ? "rgba(129,140,248,0.35)" : "#C7D2FE" },
    { bg: chrome.tealL, fg: chrome.tealFg, bar: R360.teal, border: resolvedTheme === "dark" ? "rgba(45,212,191,0.35)" : "#99F6E4" },
  ] as const;

  const headerBorder = `1px solid ${chrome.border}`;
  const cellBorder = `1px solid ${chrome.border2}`;

  return (
    <div className={cn("space-y-2.5", fullscreen && "fixed inset-0 z-50 bg-background p-4 overflow-auto")}>
      {/* Toolbar — matches Level 1: add actions left, view controls right */}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="h-[30px] text-xs shrink-0" onClick={addRelease}>
          + Add release
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-[30px] text-xs shrink-0"
          onClick={() => addEnvironment()}
          disabled={releases.length === 0}
          title={releases.length === 0 ? "Add a release first" : "Add an environment under the selected release"}
        >
          + Add environment
        </Button>
        <div className="flex-1 min-w-[8px]" />
        <label
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground shrink-0"
          style={{ borderColor: chrome.border }}
        >
          Year
          <select
            className="border-0 bg-transparent text-[11px] font-bold outline-none text-foreground"
            value={year}
            onChange={(e) => {
              const y = Number(e.target.value);
              setYear(y);
              onYearChange?.(y);
            }}
          >
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
        <label
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground shrink-0"
          style={{ borderColor: chrome.border }}
        >
          Colour
          <select
            className="border-0 bg-transparent text-[11px] font-bold outline-none text-foreground"
            value={colourMode}
            onChange={(e) => setColourMode(e.target.value as "env" | "code")}
          >
            <option value="code">By activity code</option>
            <option value="env">By environment</option>
          </select>
        </label>
        {onSave && (
          <Button
            type="button"
            size="sm"
            className="h-[30px] text-xs shrink-0"
            style={{ background: R360.brand, color: "#fff" }}
            disabled={saving}
            onClick={onSave}
          >
            {saving ? "Saving…" : "Save activity plan"}
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" className="h-[30px] text-xs shrink-0" onClick={() => setFullscreen((f) => !f)}>
          {fullscreen ? "Exit fullscreen" : "⤢ Fullscreen"}
        </Button>
      </div>

      {/* Selection inspector */}
      {selection && selectedRelease && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-[11px]"
          style={{ borderColor: resolvedTheme === "dark" ? "rgba(129,140,248,0.35)" : "#C7D2FE", background: chrome.brandL }}
        >
          <span className="font-bold" style={{ color: chrome.brandFg }}>
            {selection.kind === "release" ? "Release" : "Environment"}
          </span>

          {selection.kind === "release" && (
            <>
              <Input
                value={selectedRelease.name}
                onChange={(e) => renameRelease(selectedRelease.id, e.target.value)}
                className="h-7 w-[200px] text-[11px] font-semibold bg-card"
                placeholder="Release name…"
              />
              <Button type="button" size="sm" className="h-7 text-[11px] gap-1" style={{ background: R360.brand, color: "#fff" }} onClick={() => addEnvironment(selectedRelease.id)}>
                <Plus className="h-3 w-3" /> Add environment
              </Button>
              <div className="flex-1" />
              <Button type="button" variant="ghost" size="sm" className="h-7 text-[11px] text-destructive" onClick={() => removeRelease(selectedRelease.id)}>
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove release
              </Button>
            </>
          )}

          {selection.kind === "lane" && selectedLane && (
            <>
              <Input
                value={selectedLane.name}
                onChange={(e) => patchLane(selection.relId, selection.laneId, { name: e.target.value })}
                className="h-7 w-[200px] text-[11px] font-semibold bg-card"
                placeholder="Environment name…"
              />
              <label className="flex items-center gap-1 font-semibold text-muted-foreground">
                Type
                <select
                  className="h-7 rounded-md border bg-card px-1.5 font-semibold text-foreground"
                  style={{ borderColor: chrome.border }}
                  value={selectedLane.env || "other"}
                  onChange={(e) =>
                    patchLane(selection.relId, selection.laneId, {
                      env: e.target.value as ActivityLane["env"],
                    })
                  }
                >
                  <option value="DEV">DEV</option>
                  <option value="QAS">QAS</option>
                  <option value="PRD">PRD</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <span className="text-muted-foreground truncate max-w-[140px]">
                in {selectedRelease.name || "release"}
              </span>
              <div className="flex-1" />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] text-destructive"
                onClick={() => removeLane(selection.relId, selection.laneId)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove environment
              </Button>
            </>
          )}

          <button type="button" className="p-1 rounded hover:bg-card/80" onClick={() => setSelection(null)} aria-label="Clear selection">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Matrix */}
      <div className="rounded-xl border overflow-auto bg-card shadow-sm" style={{ borderColor: chrome.border }}>
        <div className="min-w-[1100px]">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-muted/40">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-[2] bg-muted/40 text-left px-3.5 py-2 min-w-[210px] text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Project / Release / Environment · {year}
                </th>
                {MONTHS.map((m) => (
                  <th
                    key={m}
                    colSpan={4}
                    className="text-center py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                    style={{ borderLeft: headerBorder }}
                  >
                    {m}
                  </th>
                ))}
              </tr>
              <tr className="bg-muted/20">
                {Array.from({ length: TOTAL_WEEKS }, (_, i) => (
                  <td
                    key={i}
                    className="text-center py-0.5 font-mono text-[9px] text-muted-foreground"
                    style={{
                      borderLeft: i % 4 === 0 ? headerBorder : undefined,
                      width: 20,
                      minWidth: 20,
                    }}
                  >
                    W{(i % 4) + 1}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {releases.length === 0 && (
                <tr>
                  <td colSpan={1 + TOTAL_WEEKS} className="py-12 text-center">
                    <div className="text-sm font-semibold text-foreground mb-1">No releases yet</div>
                    <div className="text-xs text-muted-foreground mb-3">
                      Add a release to create DEV / QAS / PRD environment rows, then click week cells to place activity codes.
                    </div>
                    <Button type="button" size="sm" className="h-8 text-xs" style={{ background: R360.brand, color: "#fff" }} onClick={addRelease}>
                      + Add release
                    </Button>
                  </td>
                </tr>
              )}

              {releases.map((rel, ri) => {
                const band = releaseBands[ri % releaseBands.length];
                const releaseSelected = selection?.kind === "release" && selection.relId === rel.id;
                return (
                  <Fragment key={rel.id}>
                    <tr
                      className="cursor-pointer"
                      style={{ background: band.bg }}
                      onClick={() => setSelection({ kind: "release", relId: rel.id })}
                    >
                      <td
                        className="sticky left-0 z-[1] px-3.5 py-2"
                        style={{
                          background: band.bg,
                          borderBottom: `1px solid ${band.border}`,
                          boxShadow: releaseSelected ? `inset 3px 0 0 ${R360.brand}` : undefined,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <Input
                            value={rel.name}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelection({ kind: "release", relId: rel.id });
                            }}
                            onChange={(e) => renameRelease(rel.id, e.target.value)}
                            className="h-7 border-0 bg-transparent font-extrabold shadow-none px-0 text-xs flex-1"
                            style={{ color: band.fg }}
                            placeholder="Release / project name..."
                          />
                          <button
                            type="button"
                            className="shrink-0 text-[10px] font-bold px-2 py-1 rounded border bg-card/80"
                            style={{ color: band.fg, borderColor: band.border }}
                            title="Add environment under this release"
                            onClick={(e) => {
                              e.stopPropagation();
                              addEnvironment(rel.id);
                            }}
                          >
                            + Env
                          </button>
                        </div>
                      </td>
                      <td
                        colSpan={TOTAL_WEEKS}
                        style={{ background: band.bg, borderLeft: `1px solid ${band.border}`, borderBottom: `1px solid ${band.border}` }}
                      >
                        <div className="h-2 rounded-sm mx-1 my-2" style={{ background: band.bar, opacity: 0.5 }} />
                      </td>
                    </tr>

                    {rel.lanes.map((lane) => {
                      const laneSelected = selection?.kind === "lane" && selection.laneId === lane.id;
                      const laneBg = laneSelected
                        ? chrome.brandL
                        : lane.env === "QAS"
                          ? chrome.border2
                          : chrome.surface;
                      return (
                        <tr
                          key={lane.id}
                          style={{
                            background: laneBg,
                            borderBottom: cellBorder,
                            boxShadow: laneSelected ? `inset 3px 0 0 ${R360.brand}` : undefined,
                          }}
                        >
                          <td
                            className="sticky left-0 z-[1] pl-5 pr-3 py-1.5 font-semibold cursor-pointer"
                            style={{ background: laneBg, color: chrome.text2 }}
                            onClick={() => setSelection({ kind: "lane", relId: rel.id, laneId: lane.id })}
                          >
                            <div className="flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ background: ENV_CHIP[lane.env || "other"] }}
                                title={lane.env || "other"}
                              />
                              <Input
                                value={lane.name}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelection({ kind: "lane", relId: rel.id, laneId: lane.id });
                                }}
                                onChange={(e) => patchLane(rel.id, lane.id, { name: e.target.value })}
                                className="h-7 border-0 bg-transparent shadow-none px-0 text-[11px] font-semibold"
                                style={{ color: chrome.text2 }}
                                placeholder="Environment / lane..."
                              />
                            </div>
                          </td>
                          {lane.cells.map((code, w) => {
                            const envColor = ENV_CHIP[lane.env || "other"];
                            const bg = code
                              ? colourMode === "code"
                                ? codeColor[code] || envColor
                                : envColor
                              : undefined;
                            const isOpen =
                              cellPicker?.relId === rel.id &&
                              cellPicker.laneId === lane.id &&
                              cellPicker.week === w;
                            return (
                              <td
                                key={w}
                                className="p-0.5 text-center relative"
                                style={{
                                  width: 20,
                                  minWidth: 20,
                                  borderLeft: w % 4 === 0 ? headerBorder : cellBorder,
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelection({ kind: "lane", relId: rel.id, laneId: lane.id });
                                    setCellPicker(isOpen ? null : { relId: rel.id, laneId: lane.id, week: w });
                                  }}
                                  className={cn(
                                    "w-full min-h-[22px] rounded text-[8px] font-bold leading-none px-0.5",
                                    !code && "hover:bg-black/5 dark:hover:bg-white/5",
                                  )}
                                  style={code ? { background: bg, color: "#fff" } : undefined}
                                  title={code ? `${code} — click to change` : "Click to set activity code"}
                                >
                                  {code || ""}
                                </button>
                                {isOpen && (
                                  <div
                                    ref={pickerRef}
                                    className="absolute z-20 left-0 top-full mt-1 w-[220px] rounded-lg border bg-card p-2 shadow-lg"
                                    style={{ borderColor: chrome.border }}
                                  >
                                    <div className="text-[10px] font-bold mb-1 text-muted-foreground">
                                      Set code · {MONTHS[Math.floor(w / 4)]} W{(w % 4) + 1}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground mb-1.5 truncate">
                                      {lane.name || "Environment"}
                                    </div>
                                    <div className="flex flex-wrap gap-1 max-h-36 overflow-auto">
                                      <button
                                        type="button"
                                        className="h-6 px-1.5 rounded text-[9px] font-bold border text-muted-foreground"
                                        style={{ borderColor: chrome.border }}
                                        onClick={() => setCell(rel.id, lane.id, w, "")}
                                      >
                                        Clear
                                      </button>
                                      {library.map((a) => (
                                        <button
                                          key={a.code}
                                          type="button"
                                          className="h-6 min-w-[36px] px-1 rounded text-[9px] font-bold text-white"
                                          style={{ background: a.color }}
                                          onClick={() => setCell(rel.id, lane.id, w, a.code)}
                                          title={a.name}
                                        >
                                          {a.code}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}

              {releases.length > 0 && (
                <>
                  <tr style={{ height: 6 }}>
                    <td colSpan={1 + TOTAL_WEEKS} style={{ background: chrome.border2 }} />
                  </tr>
                  <tr>
                    <td colSpan={1 + TOTAL_WEEKS} className="p-0">
                      <button
                        type="button"
                        className="w-full py-2.5 text-xs font-bold text-center border-2 border-dashed hover:bg-primary/5 transition-colors"
                        style={{ color: R360.brand, borderColor: chrome.border, background: "hsl(var(--primary) / 0.04)" }}
                        onClick={addRelease}
                      >
                        + Add release
                      </button>
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity library */}
      <div className="rounded-xl border bg-card shadow-sm p-3.5" style={{ borderColor: chrome.border }}>
        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
          <div>
            <div className="text-sm font-extrabold text-foreground">Activity library / key</div>
            <div className="text-[11px] mt-0.5 text-muted-foreground">
              Codes used in week cells · Add codes here, then click a cell to apply them
            </div>
          </div>
          {onLibraryChange && (
            <Button type="button" variant="outline" size="sm" className="h-[26px] text-[10px]" onClick={openAddCode}>
              + Add code
            </Button>
          )}
        </div>

        {showAddCode && onLibraryChange && (
          <div
            className="mb-3 rounded-lg border p-3 space-y-2.5"
            style={{ borderColor: chrome.border, background: chrome.bg }}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-extrabold" style={{ color: chrome.text }}>New activity code</div>
              <button type="button" className="p-1 rounded hover:bg-muted" onClick={() => setShowAddCode(false)} aria-label="Cancel">
                <X className="h-3.5 w-3.5" style={{ color: chrome.text4 }} />
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-[100px_1fr] items-end">
              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: chrome.text4 }}>Code</span>
                <Input
                  ref={codeInputRef}
                  value={draftCode}
                  onChange={(e) => setDraftCode(e.target.value.slice(0, 4))}
                  placeholder="e.g. UAT"
                  className="h-8 text-xs font-bold uppercase"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmAddCode();
                    if (e.key === "Escape") setShowAddCode(false);
                  }}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: chrome.text4 }}>Name</span>
                <Input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  placeholder="e.g. User Acceptance Testing"
                  className="h-8 text-xs"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmAddCode();
                    if (e.key === "Escape") setShowAddCode(false);
                  }}
                />
              </label>
            </div>
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: chrome.text4 }}>
                Colour
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {ACTIVITY_COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn(
                      "h-7 w-7 rounded-md border-2 transition-transform",
                      draftColor.toLowerCase() === c.toLowerCase() ? "scale-110" : "border-transparent",
                    )}
                    style={{
                      background: c,
                      borderColor: draftColor.toLowerCase() === c.toLowerCase() ? chrome.text : "transparent",
                      boxShadow: draftColor.toLowerCase() === c.toLowerCase() ? `0 0 0 2px ${chrome.brandL}` : undefined,
                    }}
                    title={c}
                    onClick={() => setDraftColor(c)}
                  />
                ))}
                <label className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md border bg-card text-[10px] font-semibold cursor-pointer"
                  style={{ borderColor: chrome.border, color: chrome.text3 }}
                >
                  Custom
                  <input
                    type="color"
                    value={/^#[0-9A-Fa-f]{6}$/.test(draftColor) ? draftColor : "#4338CA"}
                    onChange={(e) => setDraftColor(e.target.value)}
                    className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
                  />
                </label>
                <span
                  className="inline-flex h-7 min-w-[44px] items-center justify-center rounded px-2 text-[10px] font-bold text-white"
                  style={{ background: draftColor }}
                >
                  {(draftCode || "NEW").slice(0, 4).toUpperCase() || "NEW"}
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowAddCode(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs"
                style={{ background: R360.brand, color: "#fff" }}
                onClick={confirmAddCode}
              >
                Add code
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {library.map((a, i) => (
            <div
              key={`${a.code}-${i}`}
              className="rounded-lg border px-2.5 py-2 flex items-start gap-2"
              style={{ borderColor: chrome.border, background: pastelFrom(a.color) }}
            >
              {onLibraryChange ? (
                <>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Input
                        defaultValue={a.code}
                        key={`code-${a.code}-${i}`}
                        onBlur={(e) => commitLibraryCodeRename(i, a.code, e.target.value)}
                        className="h-6 w-14 text-[10px] font-bold text-white border-0 px-1.5"
                        style={{ background: a.color }}
                      />
                      <label className="shrink-0" title="Set colour">
                        <input
                          type="color"
                          value={/^#[0-9A-Fa-f]{6}$/.test(a.color) ? a.color : "#4338CA"}
                          onChange={(e) => updateLibraryColor(i, e.target.value)}
                          className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                        />
                      </label>
                      <button
                        type="button"
                        className="ml-auto text-[12px] px-1"
                        style={{ color: chrome.text4 }}
                        onClick={() => onLibraryChange(library.filter((_, j) => j !== i))}
                        aria-label="Remove code"
                      >
                        ×
                      </button>
                    </div>
                    <Input
                      value={a.name}
                      onChange={(e) =>
                        onLibraryChange(library.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
                      }
                      className="h-6 text-[10px] border-0 bg-transparent shadow-none px-0 font-semibold"
                      style={{ color: chrome.text2 }}
                    />
                    <div className="flex flex-wrap gap-1">
                      {ACTIVITY_COLOR_PRESETS.slice(0, 8).map((c) => (
                        <button
                          key={c}
                          type="button"
                          className="h-3.5 w-3.5 rounded-sm border"
                          style={{
                            background: c,
                            borderColor: a.color.toLowerCase() === c.toLowerCase() ? chrome.text : "transparent",
                          }}
                          onClick={() => updateLibraryColor(i, c)}
                          title={c}
                        />
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <span
                    className="inline-flex h-6 min-w-[40px] items-center justify-center rounded px-1.5 text-[10px] font-bold text-white shrink-0"
                    style={{ background: a.color }}
                  >
                    {a.code}
                  </span>
                  <span className="text-[11px] font-semibold" style={{ color: chrome.text2 }}>{a.name}</span>
                </>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2.5 text-[10px]" style={{ color: chrome.text4 }}>
          Click a week cell to pick an activity code · Save snapshot writes the matrix back to workstreams
        </p>
      </div>
    </div>
  );
}
