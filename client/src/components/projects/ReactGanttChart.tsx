import { useMemo, useEffect, useCallback, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { getSupabaseAccessToken } from "@/lib/supabase-session";
import type {
  PmProject,
  PmProjectPhase,
  PmTask,
  PmWorkstream,
  PmMilestone,
} from "@shared/models/projects";

// ── helpers ───────────────────────────────────────────────────────────────────

function mapRag(rag?: string | null): "g" | "a" | "r" {
  if (!rag) return "g";
  const r = rag.toLowerCase();
  if (r === "red" || r === "r" || r === "blocked" || r === "behind") return "r";
  if (r === "amber" || r === "a" || r === "yellow" || r === "at_risk" || r === "atrisk") return "a";
  return "g";
}

function mapTaskVisualRag(status?: string | null, progress = 0): "g" | "a" | "r" {
  if (progress >= 100 || status === "done" || status === "completed") return "g";
  if (status === "blocked") return "r";
  if (status === "in_progress" || status === "in_review") return "a";
  return "g";
}

function safeDate(d?: string | Date | null, fallback = "2025-01-01"): string {
  if (!d) return fallback;
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const dt = new Date(d as string);
  if (isNaN(dt.getTime())) return fallback;
  return dt.toISOString().split("T")[0];
}

// ID namespacing: keep Jiganto DB IDs out of conflict
const PFX = { project: 1, phase: 1000, ws: 2000, task: 3000, ms: 4000 };

interface V4Task {
  id: number;
  name: string;
  type: number;
  owner: string;
  start: string;
  end: string;
  prog: number;
  rag: "g" | "a" | "r";
  parent: number | null;
  predId: number | null;
  depType: string;
  notes: string;
  color: string;
  wbs: string;
}

interface GanttInitData {
  tasks: V4Task[];
  owners: string[];
  ownerIdMap: Record<string, string>;
  nextId: number;
  projectId: number;
  tenantId: number;
  authToken?: string;
}

interface TeamMember {
  id?: number | string;
  userId?: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string;
  user?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
  };
}

function teamMemberUserId(m: TeamMember): string | null {
  return m.user?.id ?? (typeof m.userId === "string" ? m.userId : null);
}

function teamMemberDisplayName(m: TeamMember): string {
  return (
    m.name ||
    [m.user?.firstName ?? m.firstName, m.user?.lastName ?? m.lastName].filter(Boolean).join(" ").trim()
  );
}

function buildGanttData(
  project: PmProject,
  phases: PmProjectPhase[],
  workstreams: PmWorkstream[],
  tasks: PmTask[],
  milestones: PmMilestone[],
  team: TeamMember[]
): GanttInitData {
  const items: V4Task[] = [];
  const today = new Date().toISOString().split("T")[0];
  const oneYearLater = new Date(Date.now() + 365 * 864e5).toISOString().split("T")[0];

  // Build owner name map
  const ownerMap = new Map<string, string>();
  const ownerIdMap: Record<string, string> = {};
  team.forEach((m) => {
    const userId = teamMemberUserId(m);
    if (!userId) return;
    const name = teamMemberDisplayName(m);
    if (name) {
      ownerMap.set(userId, name);
      ownerIdMap[name] = userId;
    }
  });

  // Project (type 1)
  items.push({
    id: PFX.project,
    name: project.name,
    type: 1,
    owner: "",
    start: safeDate(project.startDate, today),
    end: safeDate(project.endDate, oneYearLater),
    prog: project.progress ?? 0,
    rag: mapRag(project.ragStatus),
    parent: null,
    predId: null,
    depType: "FS",
    notes: project.description ?? "",
    color: "#4f46e5",
    wbs: "",
  });

  // Phases (type 2)
  phases.forEach((ph) => {
    items.push({
      id: PFX.phase + ph.id,
      name: ph.name,
      type: 2,
      owner: "",
      start: safeDate(ph.plannedStartDate, today),
      end: safeDate(ph.plannedEndDate, oneYearLater),
      prog: ph.progress ?? 0,
      rag: mapRag(ph.ragStatus),
      parent: PFX.project,
      predId: null,
      depType: "FS",
      notes: (ph as any).description ?? "",
      color: "#0891b2",
      wbs: (ph as { wbsCode?: string }).wbsCode || "",
    });
  });

  // Workstreams (type 3)
  workstreams.forEach((ws) => {
    const parentId = ws.phaseId ? PFX.phase + ws.phaseId : PFX.project;
    const phStart = ws.phaseId
      ? safeDate(phases.find((p) => p.id === ws.phaseId)?.plannedStartDate, today)
      : today;
    const phEnd = ws.phaseId
      ? safeDate(phases.find((p) => p.id === ws.phaseId)?.plannedEndDate, oneYearLater)
      : oneYearLater;
    items.push({
      id: PFX.ws + ws.id,
      name: ws.name,
      type: 3,
      owner: "",
      start: safeDate(ws.plannedStartDate, phStart),
      end: safeDate(ws.plannedEndDate, phEnd),
      prog: ws.progress ?? 0,
      rag: mapRag(ws.ragStatus),
      parent: parentId,
      predId: null,
      depType: "FS",
      notes: (ws as any).description ?? "",
      color: "#059669",
      wbs: ws.wbsCode || "",
    });
  });

  // Tasks & sub-tasks (type 4 = summary, 5 = task) — skip milestone-type rows (milestones table below)
  tasks.filter((t) => t.ganttType !== "milestone").forEach((t) => {
    const type = t.isSummary ? 4 : 5;

    let parentId: number;
    if (t.parentTaskId) {
      parentId = PFX.task + t.parentTaskId;
    } else if (t.phaseId) {
      parentId = PFX.phase + t.phaseId;
    } else {
      parentId = PFX.project;
    }

    const ownerName = t.assigneeId ? ownerMap.get(t.assigneeId) ?? "" : "";
    const predId =
      t.predecessorIds && t.predecessorIds.length > 0
        ? PFX.task + t.predecessorIds[0]
        : null;

    const start = safeDate(t.plannedStartDate, today);
    const end = safeDate(t.plannedEndDate, start);

    items.push({
      id: PFX.task + t.id,
      name: t.name,
      type,
      owner: ownerName,
      start,
      end,
      prog: t.progress ?? 0,
      rag: mapTaskVisualRag(t.status, t.progress ?? 0),
      parent: parentId,
      predId,
      depType: "FS",
      notes: t.description ?? "",
      color: "#64748b",
      wbs: t.wbsCode || "",
    });
  });

  // Milestones from the milestones table (type 6)
  milestones.forEach((ms) => {
    const parentId = ms.phaseId ? PFX.phase + ms.phaseId : PFX.project;
    const d = safeDate(ms.dueDate, today);
    items.push({
      id: PFX.ms + ms.id,
      name: ms.name,
      type: 6,
      owner: "",
      start: d,
      end: d,
      prog: ms.status === "completed" ? 100 : 0,
      rag: mapRag(ms.ragStatus),
      parent: parentId,
      predId: null,
      depType: "FS",
      notes: (ms as any).notes ?? "",
      color: "#f59e0b",
      wbs: (ms as any).wbsCode || "",
    });
  });

  const ownerNamesFromTeam = team
    .map((m) => teamMemberDisplayName(m))
    .filter(Boolean);
  const owners = Array.from(new Set([...ownerNamesFromTeam, ...items.map((t) => t.owner).filter(Boolean)]));
  return {
    tasks: items,
    owners,
    ownerIdMap,
    nextId: 5000,
    projectId: project.id,
    tenantId: project.tenantId,
  };
}

// ── Build the srcdoc HTML (links to public/ files, injects data JSON) ─────────
function buildSrcDoc(data: GanttInitData, projectName: string): string {
  const dataJson = JSON.stringify(data);

  const toolbarHTML = `
<div class="gtb" id="ganttToolbar">
  <span style="font-size:10px;color:var(--g500);font-weight:600;flex-shrink:0;">ZOOM</span>
  <div class="zoom-group">
    <div class="zb" onclick="setZoom('day',this)">Day</div>
    <div class="zb on" onclick="setZoom('week',this)">Week</div>
    <div class="zb" onclick="setZoom('month',this)">Month</div>
    <div class="zb" onclick="setZoom('quarter',this)">Quarter</div>
  </div>
  <div class="gtb-sep"></div>
  <span style="font-size:10px;color:var(--g500);font-weight:600;flex-shrink:0;">FILTER</span>
  <select class="tb-select" id="f-level" onchange="renderAll()">
    <option value="">All types</option>
    <option value="1">Project</option>
    <option value="2">Phase</option>
    <option value="3">Workstream</option>
    <option value="4">Activity</option>
    <option value="5">Task</option>
    <option value="6">Milestone</option>
  </select>
  <select class="tb-select" id="f-owner" onchange="renderAll()">
    <option value="">All owners</option>
  </select>
  <select class="tb-select" id="f-rag" onchange="renderAll()">
    <option value="">All RAG</option>
    <option value="g">🟢 Green</option>
    <option value="a">🟡 Amber</option>
    <option value="r">🔴 Red</option>
  </select>
  <div class="gtb-sep"></div>
  <div class="cp-toggle" id="cpBtn" onclick="toggleCP()" title="Highlight critical path">⚡ Critical Path</div>
  <div class="dep-draw-btn" id="depDrawBtn" onclick="toggleDepDraw()" title="Click two bars to draw a dependency">🔗 Draw Dep</div>
  <div style="margin-left:auto;display:flex;gap:5px;align-items:center;flex-shrink:0;">
    <button class="btn btn-ghost" onclick="jumpToToday()" title="Scroll to today">📍 Today</button>
    <button class="btn btn-ghost" onclick="indentTask()" title="Indent selected row">→ Indent</button>
    <button class="btn btn-ghost" onclick="outdentTask()" title="Outdent selected row">← Outdent</button>
    <button class="btn btn-ghost" onclick="collapseAll()" title="Collapse all groups">⊟ Collapse</button>
    <button class="btn btn-ghost" onclick="expandAll()" title="Expand all groups">⊞ Expand</button>
    <button class="btn btn-ghost" onclick="resetPanelLayout()" title="Reset task panel width">↺ Reset layout</button>
    <div style="width:1px;height:16px;background:var(--g200);"></div>
    <button class="btn btn-excel" onclick="openImportExport('export')">↓ Export</button>
    <button class="btn btn-green" onclick="openImportExport('import')">↑ Import</button>
    <button class="btn btn-p" onclick="addItemAfterSelected()">＋ Add</button>
    <div class="view-group">
      <div class="vb on" onclick="setView('gantt',this)">📅 Gantt</div>
      <div class="vb" onclick="setView('list',this)">≡ List</div>
    </div>
  </div>
</div>`;

  const ganttBodyHTML = `
<div class="gantt-body" id="ganttBody">
  <div class="task-panel" id="taskPanel">
    <div class="tp-header">
      <div class="th-cell th-wbs">WBS</div>
      <div class="th-cell th-name">Task / Work Item</div>
      <div class="th-cell th-owner">Owner</div>
      <div class="th-cell" style="width:58px;font-size:9px;border-right:1px solid var(--g200);">Start</div>
      <div class="th-cell" style="width:58px;font-size:9px;border-right:1px solid var(--g200);">End</div>
      <div class="th-cell th-prog">%</div>
      <div class="th-cell th-rag">RAG</div>
    </div>
    <div class="tp-scroll" id="taskScroll"></div>
    <div class="add-row">
      <button class="add-btn-mini" onclick="addItemAfterSelected()">＋ Task</button>
      <button class="add-btn-mini" onclick="addItemOfTypeAfterSelected('phase')">＋ Phase</button>
      <button class="add-btn-mini" onclick="addItemOfTypeAfterSelected('milestone')">◆ Milestone</button>
    </div>
  </div>
  <div class="panel-splitter" id="panelSplitter" title="Drag to resize columns"></div>
  <div class="timeline-panel">
    <div class="tl-scroll-wrap" id="tlWrap">
      <div class="tl-inner" id="tlInner">
        <div class="tl-header" id="tlHeader"></div>
        <div class="tl-rows" id="tlRows" style="position:relative;"></div>
        <div class="today-line" id="todayLine" style="display:none;">
          <div class="today-marker"></div>
        </div>
        <svg class="dep-svg" id="depSvg" style="position:absolute;top:0;left:0;pointer-events:none;z-index:8;overflow:visible;"></svg>
      </div>
    </div>
  </div>
</div>`;

  const modalsHTML = `
<div class="modal-bg" id="modalEdit">
  <div class="modal">
    <div class="mh">
      <h3 id="editTitle">Edit Item</h3>
      <button class="mc" onclick="closeModal('modalEdit')">✕</button>
    </div>
    <div class="mb">
      <div class="fg">
        <label class="fl">Name *</label>
        <input id="m-name" class="fi" placeholder="Work item name…">
      </div>
      <div class="fr">
        <div class="fg">
          <label class="fl">Type</label>
          <select id="m-type" class="fi">
            <option value="1">Project</option>
            <option value="2">Phase</option>
            <option value="3">Workstream</option>
            <option value="4">Activity</option>
            <option value="5" selected>Task</option>
            <option value="6">Milestone</option>
          </select>
        </div>
        <div class="fg">
          <label class="fl">Owner</label>
          <select id="m-owner" class="fi"></select>
        </div>
      </div>
      <div class="fr">
        <div class="fg">
          <label class="fl">Start *</label>
          <input id="m-start" class="fi" type="date">
        </div>
        <div class="fg">
          <label class="fl">End *</label>
          <input id="m-end" class="fi" type="date">
        </div>
      </div>
      <div class="fg">
        <label class="fl">Progress: <span id="m-prog-lbl">0%</span></label>
        <input id="m-prog" type="range" min="0" max="100" step="5" value="0" oninput="document.getElementById('m-prog-lbl').textContent=this.value+'%'">
      </div>
      <div class="fg">
        <label class="fl">RAG Status</label>
        <div class="rag-picker">
          <div class="rag-opt sel-g" data-rag="g" onclick="selRag(this,'g')">🟢 Green</div>
          <div class="rag-opt" data-rag="a" onclick="selRag(this,'a')">🟡 Amber</div>
          <div class="rag-opt" data-rag="r" onclick="selRag(this,'r')">🔴 Red</div>
        </div>
      </div>
      <div class="fr">
        <div class="fg">
          <label class="fl">Parent</label>
          <select id="m-parent" class="fi"></select>
        </div>
        <div class="fg">
          <label class="fl">Predecessor</label>
          <select id="m-pred" class="fi"></select>
        </div>
      </div>
      <div class="fg">
        <label class="fl">Dependency Type</label>
        <div class="dep-type-group">
          <div class="dep-opt sel" data-dep="FS" onclick="selDep(this,'FS')">FS</div>
          <div class="dep-opt" data-dep="SS" onclick="selDep(this,'SS')">SS</div>
          <div class="dep-opt" data-dep="EE" onclick="selDep(this,'EE')">EE</div>
        </div>
      </div>
      <div class="fg">
        <label class="fl">Notes</label>
        <textarea id="m-notes" class="fi" rows="2" placeholder="Notes…" style="resize:vertical;"></textarea>
      </div>
    </div>
    <div class="mf">
      <button class="btn btn-danger" id="delBtn" onclick="deleteItem()" style="display:none;">🗑 Delete</button>
      <div style="display:flex;gap:7px;margin-left:auto;">
        <button class="btn btn-ghost" onclick="closeModal('modalEdit')">Cancel</button>
        <button class="btn btn-p" onclick="saveItem()">Save</button>
      </div>
    </div>
  </div>
</div>

<div class="modal-bg" id="modalIE">
  <div class="modal" style="width:540px;">
    <div class="mh">
      <h3 id="ieTitle">Import / Export</h3>
      <button class="mc" onclick="closeModal('modalIE')">✕</button>
    </div>
    <div class="mb" id="iebody"></div>
    <div class="mf">
      <button class="btn btn-ghost" onclick="closeModal('modalIE')">Close</button>
    </div>
  </div>
</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${projectName.replace(/</g, "&lt;")} — Gantt</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/gantt-v4-engine.css">
</head>
<body>
<div class="main">
${toolbarHTML}
${ganttBodyHTML}
</div>
${modalsHTML}
<script>window.GANTT_INIT_DATA = ${dataJson};</script>
<script src="/gantt-v4-engine.js"></script>
</body>
</html>`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ReactGanttChartProps {
  projectId: number;
}

export function ReactGanttChart({ projectId }: ReactGanttChartProps) {
  const queryClient = useQueryClient();
  const [refreshKey, setRefreshKey] = useState(0);
  const [authToken, setAuthToken] = useState<string | undefined>(undefined);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getSupabaseAccessToken().then((token) => {
      if (!cancelled) setAuthToken(token ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const invalidateGantt = useCallback(async () => {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: [`/api/pm/projects/${projectId}`] }),
      queryClient.refetchQueries({ queryKey: [`/api/pm/projects/${projectId}/phases`] }),
      queryClient.refetchQueries({ queryKey: ["/api/pm/projects", projectId, "phases"] }),
      queryClient.refetchQueries({ queryKey: [`/api/pm/workstreams?projectId=${projectId}`] }),
      queryClient.refetchQueries({ queryKey: [`/api/pm/projects/${projectId}/tasks`] }),
      queryClient.refetchQueries({ queryKey: ["/api/pm/projects", projectId, "tasks"] }),
      queryClient.refetchQueries({ queryKey: [`/api/pm/projects/${projectId}/milestones`] }),
      queryClient.refetchQueries({ queryKey: [`/api/pm/projects/${projectId}/team`] }),
    ]);
    setRefreshKey((k) => k + 1);
  }, [queryClient, projectId]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "gantt-saved" && e.data?.projectId === projectId) {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => {
          void invalidateGantt();
        }, 600);
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [projectId, invalidateGantt]);
  const { data: project, isLoading: pjL } = useQuery<PmProject>({
    queryKey: [`/api/pm/projects/${projectId}`],
    enabled: !!projectId,
    staleTime: 30_000,
  });
  const { data: phases = [], isLoading: phL } = useQuery<PmProjectPhase[]>({
    queryKey: [`/api/pm/projects/${projectId}/phases`],
    enabled: !!projectId,
    staleTime: 30_000,
  });
  const { data: workstreams = [], isLoading: wsL } = useQuery<PmWorkstream[]>({
    queryKey: [`/api/pm/workstreams?projectId=${projectId}`],
    enabled: !!projectId,
    staleTime: 30_000,
  });
  const { data: dbTasks = [], isLoading: tkL } = useQuery<PmTask[]>({
    queryKey: [`/api/pm/projects/${projectId}/tasks`],
    enabled: !!projectId,
    staleTime: 30_000,
  });
  const { data: milestones = [], isLoading: msL } = useQuery<PmMilestone[]>({
    queryKey: [`/api/pm/projects/${projectId}/milestones`],
    enabled: !!projectId,
    staleTime: 30_000,
  });
  const { data: team = [], isLoading: tmL } = useQuery<TeamMember[]>({
    queryKey: [`/api/pm/projects/${projectId}/team`],
    enabled: !!projectId,
    staleTime: 30_000,
  });

  const authReady = authToken !== undefined;
  const isLoading = pjL || phL || wsL || tkL || msL || tmL || !authReady;

  const srcDoc = useMemo(() => {
    if (!project || !authReady) return null;
    const data: GanttInitData = {
      ...buildGanttData(
        project,
        phases as PmProjectPhase[],
        workstreams as PmWorkstream[],
        dbTasks as PmTask[],
        milestones as PmMilestone[],
        team as TeamMember[]
      ),
      authToken: authToken || undefined,
    };
    return buildSrcDoc(data, project.name);
  }, [project, phases, workstreams, dbTasks, milestones, team, authToken, authReady]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16, height: "100%" }}>
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="flex-1 w-full rounded-lg" />
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 14, color: "#64748b" }}>
        Project not found.
      </div>
    );
  }

  return (
    <iframe
      key={`${projectId}-${refreshKey}`}
      title={`Gantt — ${project.name}`}
      srcDoc={srcDoc ?? undefined}
      style={{ width: "100%", height: "100%", minHeight: 400, border: "none", display: "block" }}
      sandbox="allow-scripts allow-same-origin allow-forms allow-downloads"
    />
  );
}

export default ReactGanttChart;
