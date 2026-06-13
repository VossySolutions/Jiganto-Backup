/** Shared mappers and helpers for PM agile delivery boards */

export interface AgileWorkstream {
  id: string;
  name: string;
  color: string;
}

export interface AgileEpic {
  id: string;
  wsId: string;
  title: string;
  initiative: string;
  status: string;
  tshirt: string;
  priority: string;
  progress: number;
  owner: string;
  creator: string;
  createdAt: string;
  color: string;
  stories: number;
  storiesDone: number;
  tags: string[];
  description: string;
  startDate?: string | null;
  endDate?: string | null;
}

export interface AgileStory {
  id: string;
  epicId: string;
  wsId: string;
  title: string;
  status: string;
  points: number | null;
  tshirt: string;
  priority: string;
  assignee: string | null;
  creator: string;
  createdAt: string;
  sprint: string | null;
  sprintId: number | null;
  tags: string[];
  tasks: number;
  tasksDone: number;
  ac: string[];
}

export interface AgileSprint {
  id: string;
  wsId: string;
  name: string;
  status: string;
  start: string;
  end: string;
  points: number;
  done: number;
  goal?: string;
}

export interface AgileDefect {
  id: string;
  storyId: string;
  wsId: string;
  title: string;
  severity: string;
  priority: string;
  status: string;
  assignee: string | null;
  creator: string;
  createdAt: string;
  environment: string;
  sprint: string | null;
}

export interface BurndownPoint {
  day: string;
  ideal: number;
  actual: number | null;
}

export interface BurnUpPoint {
  week: string;
  completed: number;
  total: number;
}

export function isNumericId(id: string): boolean {
  return /^\d+$/.test(id);
}

function capitalizeStatus(s: string): string {
  if (!s) return "Planning";
  const lower = s.toLowerCase();
  const map: Record<string, string> = {
    planning: "Planning",
    active: "Active",
    done: "Done",
    cancelled: "Cancelled",
    closed: "Closed",
    planned: "Planned",
  };
  return map[lower] || s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(d?: string | null): string {
  if (!d) return "";
  if (typeof d === "string" && d.length >= 10) return d.slice(0, 10);
  return String(d);
}

export function dbWorkstreamToLocal(w: { id: number; name: string; color?: string | null }): AgileWorkstream {
  return { id: String(w.id), name: w.name, color: w.color || "#2563EB" };
}

export function dbSprintToLocal(s: {
  id: number;
  name: string;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  totalPoints?: number | null;
  donePoints?: number | null;
  goal?: string | null;
}, ws: { id: string }): AgileSprint {
  return {
    id: String(s.id),
    wsId: ws.id,
    name: s.name,
    status: capitalizeStatus(s.status || "Planned"),
    start: formatDate(s.startDate),
    end: formatDate(s.endDate),
    points: s.totalPoints ?? 0,
    done: s.donePoints ?? 0,
    goal: s.goal || undefined,
  };
}

export function dbStoryToLocal(
  s: {
    id: number;
    epicId?: number | null;
    title: string;
    status?: string | null;
    points?: number | null;
    tshirt?: string | null;
    priority?: string | null;
    assignee?: string | null;
    creator?: string | null;
    createdAt?: string | Date | null;
    sprintName?: string | null;
    sprintId?: number | null;
    tags?: string[] | null;
    acceptanceCriteria?: string[] | null;
  },
  ws: { id: string },
  sprintById: Map<number, AgileSprint>,
): AgileStory {
  let sprintName = s.sprintName || null;
  if (!sprintName && s.sprintId != null) {
    const sp = sprintById.get(s.sprintId);
    if (sp) sprintName = sp.name;
  }
  return {
    id: String(s.id),
    epicId: s.epicId != null ? String(s.epicId) : "",
    wsId: ws.id,
    title: s.title,
    status: s.status || "Backlog",
    points: s.points ?? null,
    tshirt: s.tshirt || "M",
    priority: s.priority || "Medium",
    assignee: s.assignee || null,
    creator: s.creator || "",
    createdAt: s.createdAt ? String(s.createdAt).slice(0, 10) : "",
    sprint: sprintName,
    sprintId: s.sprintId ?? null,
    tags: s.tags || [],
    tasks: 0,
    tasksDone: 0,
    ac: s.acceptanceCriteria || [],
  };
}

export function dbEpicToLocal(
  e: {
    id: number;
    code?: string | null;
    title: string;
    initiative?: string | null;
    status?: string | null;
    priority?: string | null;
    tshirt?: string | null;
    color?: string | null;
    owner?: string | null;
    description?: string | null;
    progress?: number | null;
    tags?: string[] | null;
    createdAt?: string | Date | null;
    startDate?: string | null;
    endDate?: string | null;
  },
  ws: { id: string },
  stories: AgileStory[] = [],
): AgileEpic {
  const epicStories = stories.filter((st) => st.epicId === String(e.id));
  const done = epicStories.filter((st) => st.status === "Done").length;
  const progress = epicStories.length > 0
    ? Math.round((done / epicStories.length) * 100)
    : (e.progress ?? 0);
  return {
    id: String(e.id),
    wsId: ws.id,
    title: e.title,
    initiative: e.initiative || "",
    status: capitalizeStatus(e.status || "planning"),
    tshirt: e.tshirt || "M",
    priority: capitalizeStatus(e.priority || "medium"),
    progress,
    owner: e.owner || "",
    creator: "",
    createdAt: e.createdAt ? String(e.createdAt).slice(0, 10) : "",
    color: e.color || "#2563EB",
    stories: epicStories.length,
    storiesDone: done,
    tags: e.tags || [],
    description: e.description || "",
    startDate: e.startDate,
    endDate: e.endDate,
  };
}

export function dbDefectToLocal(
  d: {
    id: number;
    code?: string | null;
    storyId?: number | null;
    title: string;
    severity?: string | null;
    priority?: string | null;
    status?: string | null;
    assignee?: string | null;
    reporter?: string | null;
    createdAt?: string | Date | null;
    environment?: string | null;
  },
  ws: { id: string },
): AgileDefect {
  return {
    id: String(d.id),
    wsId: ws.id,
    storyId: d.storyId != null ? String(d.storyId) : "",
    title: d.title,
    severity: d.severity || "Minor",
    priority: d.priority || "Medium",
    status: d.status || "New",
    assignee: d.assignee || null,
    creator: d.reporter || "",
    createdAt: d.createdAt ? String(d.createdAt).slice(0, 10) : "",
    environment: d.environment || "Dev",
    sprint: null,
  };
}

export function buildSprintMap(sprints: AgileSprint[]): Map<number, AgileSprint> {
  const map = new Map<number, AgileSprint>();
  for (const sp of sprints) {
    if (isNumericId(sp.id)) map.set(Number(sp.id), sp);
  }
  return map;
}

export function computeBurnUp(stories: AgileStory[], epicId: string): BurnUpPoint[] {
  const epicStories = stories.filter((s) => s.epicId === epicId);
  const total = epicStories.length;
  if (total === 0) return [];
  const sorted = [...epicStories].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const weeks: BurnUpPoint[] = [{ week: "W1", completed: 0, total }];
  let completed = 0;
  sorted.forEach((st, i) => {
    if (st.status === "Done") completed++;
    const weekNum = Math.min(Math.floor(i / Math.max(1, Math.ceil(total / 6))) + 1, 6);
    const label = `W${weekNum}`;
    const existing = weeks.find((w) => w.week === label);
    if (existing) {
      existing.completed = completed;
    } else {
      weeks.push({ week: label, completed, total });
    }
  });
  return weeks.length > 1 ? weeks : [{ week: "W1", completed: epicStories.filter((s) => s.status === "Done").length, total }];
}

export function computeBurndown(activeSprint: AgileSprint | undefined, stories: AgileStory[]): BurndownPoint[] {
  if (!activeSprint) return [];
  const sprintStories = stories.filter((s) => s.sprint === activeSprint.name);
  const total = activeSprint.points || sprintStories.reduce((a, s) => a + (s.points || 0), 0) || 1;
  const donePts = sprintStories.filter((s) => s.status === "Done").reduce((a, s) => a + (s.points || 0), 0);
  const remaining = Math.max(0, total - donePts);
  const days = 14;
  const points: BurndownPoint[] = [];
  for (let i = 0; i < days; i++) {
    const ideal = Math.max(0, total - (total / (days - 1)) * i);
    points.push({
      day: `Day ${i + 1}`,
      ideal: Math.round(ideal * 10) / 10,
      actual: i === 0 ? total : i < 9 ? remaining + (total - remaining) * (1 - i / 9) : (i === 9 ? remaining : null),
    });
  }
  if (points.length > 1) points[points.length - 1].actual = remaining;
  return points;
}

export function computeRoadmapTimeline(epics: AgileEpic[]): {
  months: { label: string; year: number; month: number }[];
  epicBars: Record<string, { start: number; width: number }>;
} {
  const dated = epics.filter((e) => e.startDate || e.endDate);
  const now = new Date();
  let min = new Date(now.getFullYear(), now.getMonth(), 1);
  let max = new Date(now.getFullYear(), now.getMonth() + 9, 1);

  for (const e of dated) {
    if (e.startDate) {
      const d = new Date(e.startDate);
      if (d < min) min = new Date(d.getFullYear(), d.getMonth(), 1);
    }
    if (e.endDate) {
      const d = new Date(e.endDate);
      if (d > max) max = new Date(d.getFullYear(), d.getMonth(), 1);
    }
  }

  const months: { label: string; year: number; month: number }[] = [];
  const cursor = new Date(min);
  while (cursor <= max && months.length < 12) {
    months.push({
      label: cursor.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
      year: cursor.getFullYear(),
      month: cursor.getMonth(),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  if (months.length === 0) {
    for (let i = 0; i < 10; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push({
        label: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
        year: d.getFullYear(),
        month: d.getMonth(),
      });
    }
  }

  const epicBars: Record<string, { start: number; width: number }> = {};
  for (const e of epics) {
    const start = e.startDate ? new Date(e.startDate) : new Date(min);
    const end = e.endDate ? new Date(e.endDate) : new Date(start.getFullYear(), start.getMonth() + 2, 1);
    let startIdx = months.findIndex((m) => m.year === start.getFullYear() && m.month === start.getMonth());
    if (startIdx < 0) startIdx = 0;
    let endIdx = months.findIndex((m) => m.year === end.getFullYear() && m.month === end.getMonth());
    if (endIdx < 0) endIdx = months.length - 1;
    epicBars[e.id] = { start: startIdx, width: Math.max(1, endIdx - startIdx + 1) };
  }
  return { months, epicBars };
}
