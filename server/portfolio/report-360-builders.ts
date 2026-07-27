/** Build Level-1 / Activity plan structures from live PM entities (no demo data). */

type PlanBarStatus = "not_started" | "in_progress" | "at_risk" | "delayed" | "completed";

type Level1PlanRow =
  | { id: string; kind: "release"; name: string; startWeek?: number; endWeek?: number }
  | {
      id: string;
      kind: "phase";
      name: string;
      status: PlanBarStatus;
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

type ActivityLane = {
  id: string;
  name: string;
  env?: "DEV" | "QAS" | "PRD" | "other";
  cells: string[];
  workstreamId?: number;
};

type ActivityRelease = {
  id: string;
  name: string;
  lanes: ActivityLane[];
  workstreamId?: number;
};

const TOTAL_WEEKS = 48;

function dateToWeekIndex(iso: string | null | undefined, fallbackYear?: number): number | null {
  if (!iso) return null;
  const d = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const year = fallbackYear ?? d.getFullYear();
  // Keep calendar month/week even if year differs so bars still render
  void year;
  const month = d.getMonth();
  const weekInMonth = Math.min(3, Math.floor((Math.max(1, d.getDate()) - 1) / 7));
  return Math.max(0, Math.min(TOTAL_WEEKS - 1, month * 4 + weekInMonth));
}

function phaseStatus(progress: number, rag: string | null | undefined, status: string | null | undefined): PlanBarStatus {
  const s = (status || "").toLowerCase();
  const r = (rag || "").toLowerCase();
  if (progress >= 100 || s === "completed" || s === "complete") return "completed";
  if (r.includes("red") || s === "delayed" || s === "blocked") return "delayed";
  if (r.includes("amber") || r.includes("yellow") || s === "at_risk") return "at_risk";
  if (progress > 0 || s === "in_progress" || s === "active") return "in_progress";
  return "not_started";
}

function emptyCells(): string[] {
  return Array.from({ length: TOTAL_WEEKS }, () => "");
}

function abbrevCode(name: string, wbs?: string | null): string {
  if (wbs && wbs.trim().length >= 2 && wbs.trim().length <= 5) return wbs.trim().slice(0, 4);
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 4);
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
}

function detectEnv(name: string): ActivityLane["env"] {
  const u = name.toUpperCase();
  if (u.includes("DEV") || u.includes("DEVELOP")) return "DEV";
  if (u.includes("QAS") || u.includes("QA") || u.includes("TEST")) return "QAS";
  if (u.includes("PRD") || u.includes("PROD") || u.includes("CUTOVER")) return "PRD";
  return "other";
}

type PhaseIn = {
  id: number;
  name: string;
  ragStatus?: string | null;
  status?: string | null;
  progress?: number | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  order?: number | null;
  phaseNumber?: number | null;
};

type MilestoneIn = {
  id: number;
  name: string;
  targetDate?: string | null;
  dueDate?: string | null;
  status?: string | null;
  phaseId?: number | null;
  order?: number | null;
};

type WorkstreamIn = {
  id: number;
  name: string;
  type?: string | null;
  parentWorkstreamId?: number | null;
  wbsCode?: string | null;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  order?: number | null;
};

type TaskIn = {
  id: number;
  name: string;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  wbsCode?: string | null;
  ganttType?: string | null;
  order?: number | null;
};

/** Level 1 Gantt rows from phases + milestones. Empty only if neither exists. */
export function buildLevel1PlanRows(
  projectName: string,
  phases: PhaseIn[],
  milestones: MilestoneIn[],
): Level1PlanRow[] {
  if (!phases.length && !milestones.length) return [];

  const rows: Level1PlanRow[] = [
    { id: `release-${projectName}`, kind: "release", name: projectName, startWeek: 0, endWeek: 47 },
  ];

  const sorted = [...phases].sort(
    (a, b) => (a.order ?? a.phaseNumber ?? 0) - (b.order ?? b.phaseNumber ?? 0) || a.id - b.id,
  );

  sorted.forEach((ph, i) => {
    const start =
      dateToWeekIndex(ph.plannedStartDate) ??
      Math.min(TOTAL_WEEKS - 4, i * 4);
    const endRaw = dateToWeekIndex(ph.plannedEndDate);
    const end = Math.max(start, endRaw ?? start + 3);
    rows.push({
      id: `phase-${ph.id}`,
      kind: "phase",
      name: ph.name,
      status: phaseStatus(ph.progress ?? 0, ph.ragStatus, ph.status),
      startWeek: start,
      endWeek: end,
      phaseId: ph.id,
    });

    const phaseMs = milestones
      .filter((m) => m.phaseId === ph.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id - b.id);
    for (const m of phaseMs) {
      const week = dateToWeekIndex(m.targetDate || m.dueDate) ?? end;
      rows.push({
        id: `ms-${m.id}`,
        kind: "milestone",
        name: m.name,
        week,
        done: (m.status || "").toLowerCase() === "completed",
        milestoneId: m.id,
        parentPhaseRowId: `phase-${ph.id}`,
        phaseId: ph.id,
      });
    }
  });

  // Orphan milestones (no phase) — still show when project has milestones but no phases
  const linked = new Set(milestones.filter((m) => m.phaseId != null).map((m) => m.id));
  for (const m of milestones.filter((x) => !linked.has(x.id))) {
    const week = dateToWeekIndex(m.targetDate || m.dueDate) ?? 0;
    rows.push({
      id: `ms-${m.id}`,
      kind: "milestone",
      name: m.name,
      week,
      done: (m.status || "").toLowerCase() === "completed",
      milestoneId: m.id,
    });
  }

  return rows;
}

/**
 * Activity matrix from workstreams:
 * - type=workstream → release header
 * - type=activity (or children) → lanes with codes across planned date weeks
 * Empty if no dated activities.
 */
export function buildActivityPlan(
  projectName: string,
  workstreams: WorkstreamIn[],
  tasks: TaskIn[] = [],
): ActivityRelease[] {
  const parents = workstreams
    .filter((w) => (w.type || "workstream") === "workstream")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id - b.id);

  const activities = workstreams.filter((w) => {
    const t = (w.type || "").toLowerCase();
    return t === "activity" || t === "sub_activity";
  });

  const releases: ActivityRelease[] = [];

  const attachLanes = (parentId: number | null, release: ActivityRelease) => {
    const lanes = activities
      .filter((a) => (parentId == null ? !a.parentWorkstreamId : a.parentWorkstreamId === parentId))
      .filter((a) => a.plannedStartDate || a.plannedEndDate)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id - b.id);

    for (const a of lanes) {
      const cells = emptyCells();
      const start = dateToWeekIndex(a.plannedStartDate) ?? dateToWeekIndex(a.plannedEndDate);
      const end = dateToWeekIndex(a.plannedEndDate) ?? start;
      if (start == null || end == null) continue;
      const code = abbrevCode(a.name, a.wbsCode);
      for (let w = Math.min(start, end); w <= Math.max(start, end); w++) {
        cells[w] = code;
      }
      release.lanes.push({
        id: `lane-${a.id}`,
        name: a.name,
        env: detectEnv(a.name),
        cells,
        workstreamId: a.id,
      });
    }
  };

  if (parents.length) {
    for (const p of parents) {
      const rel: ActivityRelease = {
        id: `rel-${p.id}`,
        name: p.name,
        lanes: [],
        workstreamId: p.id,
      };
      attachLanes(p.id, rel);
      // Also include activities with no parent under first release only once
      if (releases.length === 0) attachLanes(null, rel);
      if (rel.lanes.length) releases.push(rel);
    }
  } else if (activities.length) {
    const rel: ActivityRelease = {
      id: `rel-project`,
      name: projectName,
      lanes: [],
    };
    attachLanes(null, rel);
    // Treat top-level workstreams with dates as lanes if no typed activities
    if (!rel.lanes.length) {
      for (const w of workstreams.filter((x) => x.plannedStartDate || x.plannedEndDate)) {
        const cells = emptyCells();
        const start = dateToWeekIndex(w.plannedStartDate) ?? dateToWeekIndex(w.plannedEndDate);
        const end = dateToWeekIndex(w.plannedEndDate) ?? start;
        if (start == null || end == null) continue;
        const code = abbrevCode(w.name, w.wbsCode);
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) cells[i] = code;
        rel.lanes.push({
          id: `lane-${w.id}`,
          name: w.name,
          env: detectEnv(w.name),
          cells,
          workstreamId: w.id,
        });
      }
    }
    if (rel.lanes.length) releases.push(rel);
  }

  // Fallback: dated gantt tasks (excluding pure milestones/summary if desired)
  if (!releases.length && tasks.length) {
    const dated = tasks.filter((t) => t.plannedStartDate || t.plannedEndDate);
    if (dated.length) {
      const rel: ActivityRelease = {
        id: "rel-tasks",
        name: projectName,
        lanes: [],
      };
      for (const t of dated.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id - b.id)) {
        const cells = emptyCells();
        const start = dateToWeekIndex(t.plannedStartDate) ?? dateToWeekIndex(t.plannedEndDate);
        const end = dateToWeekIndex(t.plannedEndDate) ?? start;
        if (start == null || end == null) continue;
        const code = abbrevCode(t.name, t.wbsCode);
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) cells[i] = code;
        rel.lanes.push({
          id: `task-${t.id}`,
          name: t.name,
          env: detectEnv(t.name),
          cells,
        });
      }
      if (rel.lanes.length) releases.push(rel);
    }
  }

  return releases;
}
