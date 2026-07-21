import { useEffect, useCallback, useState, useRef } from "react";
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

function deriveScheduleRag(
  status?: string | null,
  progress = 0,
  start?: string | null,
  end?: string | null
): "g" | "a" | "r" {
  const base = mapTaskVisualRag(status, progress);
  if (base !== "g" || progress >= 100) return base;
  const today = new Date().toISOString().slice(0, 10);
  const endDate = end ? safeDate(end, today) : today;
  const startDate = start ? safeDate(start, endDate) : endDate;
  if (endDate < today) return "r";
  const total = new Date(endDate).getTime() - new Date(startDate).getTime();
  const elapsed = new Date(today).getTime() - new Date(startDate).getTime();
  if (total > 0 && elapsed / total > 0.75 && progress < 60) return "a";
  return "g";
}

function deriveBudgetRag(progress: number, scheduleRag: "g" | "a" | "r"): "g" | "a" | "r" {
  if (scheduleRag === "r") return "a";
  if (progress >= 90) return "g";
  if (progress < 25) return "a";
  return "g";
}

function deriveItemRags(
  scopeRag: "g" | "a" | "r",
  progress: number,
  status?: string | null,
  start?: string | null,
  end?: string | null
) {
  const ragSch = deriveScheduleRag(status, progress, start, end);
  const ragBgt = deriveBudgetRag(progress, ragSch);
  return { rag: scopeRag, ragBgt, ragSch, ragScp: scopeRag };
}

function safeDate(d?: string | Date | null, fallback = "2025-01-01"): string {
  if (!d) return fallback;
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const dt = new Date(d as string);
  if (isNaN(dt.getTime())) return fallback;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  ragBgt?: "g" | "a" | "r";
  ragSch?: "g" | "a" | "r";
  ragScp?: "g" | "a" | "r";
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
  projectName?: string;
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
  const projRag = mapRag(project.ragStatus);
  const projBgt = mapRag((project as { financialRag?: string | null }).financialRag);
  const projSch = mapRag((project as { scheduleRag?: string | null }).scheduleRag);
  items.push({
    id: PFX.project,
    name: project.name,
    type: 1,
    owner: "",
    start: safeDate(project.startDate, today),
    end: safeDate(project.endDate, oneYearLater),
    prog: project.progress ?? 0,
    rag: projRag,
    ragBgt: projBgt,
    ragSch: projSch,
    ragScp: projRag,
    parent: null,
    predId: null,
    depType: "FS",
    notes: project.description ?? "",
    color: "#4f46e5",
    wbs: "",
  });

  // Phases (type 2)
  phases.forEach((ph) => {
    const phRags = deriveItemRags(
      mapRag(ph.ragStatus),
      ph.progress ?? 0,
      ph.status,
      ph.plannedStartDate,
      ph.plannedEndDate
    );
    items.push({
      id: PFX.phase + ph.id,
      name: ph.name,
      type: 2,
      owner: "",
      start: safeDate(ph.plannedStartDate, today),
      end: safeDate(ph.plannedEndDate, oneYearLater),
      prog: ph.progress ?? 0,
      ...phRags,
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
    const wsRags = deriveItemRags(
      mapRag(ws.ragStatus),
      ws.progress ?? 0,
      ws.status,
      ws.plannedStartDate ?? phStart,
      ws.plannedEndDate ?? phEnd
    );
    items.push({
      id: PFX.ws + ws.id,
      name: ws.name,
      type: 3,
      owner: "",
      start: safeDate(ws.plannedStartDate, phStart),
      end: safeDate(ws.plannedEndDate, phEnd),
      prog: ws.progress ?? 0,
      ...wsRags,
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

    const scopeRag = mapRag((t as { ragStatus?: string | null }).ragStatus) || mapTaskVisualRag(t.status, t.progress ?? 0);
    const taskRags = deriveItemRags(scopeRag, t.progress ?? 0, t.status, start, end);
    items.push({
      id: PFX.task + t.id,
      name: t.name,
      type,
      owner: ownerName,
      start,
      end,
      prog: t.progress ?? 0,
      ...taskRags,
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
    const msScope = mapRag(ms.ragStatus);
    const msProg = ms.status === "completed" ? 100 : 0;
    const msRags = deriveItemRags(msScope, msProg, ms.status, d, d);
    items.push({
      id: PFX.ms + ms.id,
      name: ms.name,
      type: 6,
      owner: "",
      start: d,
      end: d,
      prog: msProg,
      ...msRags,
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
    projectName: project.name,
  };
}

// ── Build the srcdoc HTML (links to public/ files, injects data JSON) ─────────
function buildSrcDoc(data: GanttInitData, projectName: string): string {
  const dataJson = JSON.stringify(data);

  const toolbarHTML = `
<div class="gtb" id="ganttToolbar">
  <span class="zoom-to-label">Zoom to:</span>
  <select class="tb-select zoom-to-select" id="zoomToSelect" onchange="setZoom(this.value)">
    <option value="day">Day</option>
    <option value="week" selected>Week</option>
    <option value="month">Month</option>
    <option value="quarter">Quarter</option>
    <option value="year">Year</option>
  </select>
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
  <div class="tb-filter-wrap" id="ragFilterWrap">
    <button type="button" class="tb-filter-btn" id="ragFilterBtn" onclick="toggleRagFilterMenu(event)" title="Filter by RAG" aria-label="Filter by RAG">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
    </button>
    <div class="tb-filter-menu" id="ragFilterMenu" hidden>
      <button type="button" class="tb-filter-opt on" data-rag="" onclick="setRagFilter('',this)">All RAG</button>
      <button type="button" class="tb-filter-opt" data-rag="g" onclick="setRagFilter('g',this)">🟢 Green</button>
      <button type="button" class="tb-filter-opt" data-rag="a" onclick="setRagFilter('a',this)">🟡 Amber</button>
      <button type="button" class="tb-filter-opt" data-rag="r" onclick="setRagFilter('r',this)">🔴 Red</button>
    </div>
  </div>
  <input type="hidden" id="f-rag" value="">
  <input class="tb-search" id="f-search" placeholder="Search tasks…" oninput="renderAll()">
  <div class="gtb-sep"></div>
  <div class="plan-chip" id="planChip" title="Click to manage plan versions" onclick="openVersionsModal()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openVersionsModal();}" role="button" tabindex="0">
    <span class="plan-chip-lbl">Plan</span>
    <span class="plan-chip-name" id="planChipName">Working</span>
    <span class="plan-chip-ver" id="planChipVer"></span>
    <svg class="plan-chip-caret" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
  </div>
  <div class="tb-filter-wrap" id="versionMenuWrap">
    <button type="button" class="tb-filter-btn" id="versionMenuBtn" onclick="toggleVersionMenu(event)" title="Plan versions" aria-label="Plan versions" aria-haspopup="menu">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/></svg>
    </button>
    <div class="tb-filter-menu version-menu" id="versionMenu" hidden role="menu">
      <button type="button" class="tb-filter-opt" role="menuitem" onclick="promptSaveVersion('update')">
        <span class="vm-title">Save version</span>
        <span class="vm-desc">Overwrite active schedule snapshot</span>
      </button>
      <button type="button" class="tb-filter-opt" role="menuitem" onclick="promptSaveVersion('new')">
        <span class="vm-title">Save as new version…</span>
        <span class="vm-desc">New active version; keep old one</span>
      </button>
      <button type="button" class="tb-filter-opt" role="menuitem" onclick="promptSaveVersion('copy')">
        <span class="vm-title">Save as copy…</span>
        <span class="vm-desc">Named backup; stay on current</span>
      </button>
      <div class="vm-sep" role="separator"></div>
      <button type="button" class="tb-filter-opt" role="menuitem" onclick="openVersionsModal()">
        <span class="vm-title">Manage versions…</span>
        <span class="vm-desc">Activate, rename, or delete</span>
      </button>
    </div>
  </div>
  <div class="gtb-sep"></div>
  <div class="cp-toggle" id="cpBtn" onclick="toggleCP()" title="Highlight critical path">Critical path</div>
  <div class="dep-draw-btn" id="depDrawBtn" onclick="toggleDepDraw()" title="Click two bars to draw a dependency">🔗 Draw Dep</div>
  <div class="dep-draw-types" id="depDrawTypes" hidden>
    <button type="button" class="dep-opt sel" data-dep="FS" onclick="selDep(this,'FS')" title="Finish-to-Start">FS</button>
    <button type="button" class="dep-opt" data-dep="SS" onclick="selDep(this,'SS')" title="Start-to-Start">SS</button>
    <button type="button" class="dep-opt" data-dep="EE" onclick="selDep(this,'EE')" title="Finish-to-Finish">FF</button>
  </div>
  <div class="gtb-actions">
    <button type="button" class="btn-icon" id="undoBtn" onclick="undo()" disabled title="Undo (Ctrl+Z)" aria-label="Undo">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.7 3L3 13"/></svg>
    </button>
    <button type="button" class="btn-icon" id="redoBtn" onclick="redo()" disabled title="Redo (Ctrl+Y)" aria-label="Redo">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6.7 3L21 13"/></svg>
    </button>
    <div class="gtb-sep"></div>
    <button type="button" class="btn-icon" onclick="jumpToToday()" title="Scroll to today" aria-label="Today">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none"/></svg>
    </button>
    <button type="button" class="btn-icon" onclick="indentTask()" title="Indent — nest under the row above (like Excel)" aria-label="Indent">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M3 12h6M13 10l4 2-4 2M3 18h18"/></svg>
    </button>
    <button type="button" class="btn-icon" onclick="outdentTask()" title="Outdent — move up one level (like Excel)" aria-label="Outdent">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M11 12h10M7 10L3 12l4 2M3 18h18"/></svg>
    </button>
    <button type="button" class="btn-icon" onclick="collapseAll()" title="Collapse all" aria-label="Collapse all">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12h8"/></svg>
    </button>
    <button type="button" class="btn-icon" onclick="expandAll()" title="Expand all" aria-label="Expand all">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12h8"/></svg>
    </button>
    <div class="gtb-sep"></div>
    <button type="button" class="btn-icon btn-icon-export" onclick="openImportExport('export')" title="Export" aria-label="Export">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>
    </button>
    <button type="button" class="btn-icon btn-icon-import" onclick="openImportExport('import')" title="Import" aria-label="Import">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21V9"/><path d="M7 14l5-5 5 5"/><path d="M5 3h14"/></svg>
    </button>
    <div class="view-group">
      <button type="button" class="vb on" id="viewGanttBtn" onclick="setView('gantt',this)">📅 Gantt</button>
      <button type="button" class="vb" id="viewListBtn" onclick="setView('list',this)">≡ List</button>
    </div>
  </div>
</div>`;

  const ganttBodyHTML = `
<div class="gantt-body" id="ganttBody">
  <div class="gantt-view" id="ganttView">
    <div class="task-panel" id="taskPanel">
      <div class="tp-grid-x" id="tpGridX">
        <div class="tp-header" id="tpHeader">
          <div class="th-cell th-wbs">#</div>
          <div class="th-cell th-name">Task name</div>
          <div class="th-cell th-owner">Owner</div>
          <div class="th-cell th-date">Start time</div>
          <div class="th-cell th-date">End</div>
          <div class="th-cell th-dur">Duration</div>
          <div class="th-cell th-pred">Predecessors</div>
          <div class="th-cell th-prog">%</div>
          <div class="th-cell th-rag-col">Budget</div>
          <div class="th-cell th-rag-col">Sched</div>
          <div class="th-cell th-rag-col">Scope</div>
          <div id="tpCustomHeaders" class="tp-custom-headers"></div>
          <div class="th-cell th-add-col" onclick="promptAddColumn()" title="Add a Column">Add a Column</div>
          <div class="grid-filler"></div>
        </div>
        <div class="tp-scroll" id="taskScroll"></div>
      </div>
      <div class="add-row">
        <button class="add-new-item-btn" onclick="addNewItem()" title="Add a new work item">+ Add a New Item</button>
        <button class="add-btn-mini" onclick="addItemOfTypeAfterSelected('phase')">＋ Phase</button>
        <button class="add-btn-mini" onclick="addItemOfTypeAfterSelected('milestone')">◆ Milestone</button>
      </div>
    </div>
    <div class="panel-splitter" id="panelSplitter" title="Drag to resize columns"></div>
    <div class="timeline-panel">
      <div class="tl-header-wrap" id="tlHeaderWrap">
        <div class="tl-header" id="tlHeader"></div>
      </div>
      <div class="tl-scroll-wrap" id="tlWrap">
        <div class="tl-inner" id="tlInner">
          <div class="tl-rows" id="tlRows"></div>
          <div class="today-line" id="todayLine" style="display:none;">
            <div class="today-marker"></div>
          </div>
          <svg class="dep-svg" id="depSvg"></svg>
        </div>
      </div>
      <div class="tl-panel-footer" aria-hidden="true"></div>
    </div>
  </div>
  <div class="list-view" id="listView" hidden></div>
</div>
<div class="gantt-bottom-bar" id="ganttBottomBar">
  <label class="dhx-switch"><input type="checkbox" id="switchCollapse" onchange="toggleCollapseRows(true)"><span class="slider"></span>Collapse rows</label>
  <label class="dhx-switch"><input type="checkbox" id="switchAutoSched" onchange="toggleAutoSchedule(true)"><span class="slider"></span>Auto scheduling</label>
  <label class="dhx-switch"><input type="checkbox" id="switchCP" onchange="toggleCP(true)"><span class="slider"></span>Critical path</label>
  <label class="dhx-switch"><input type="checkbox" id="switchZoomFit" onchange="toggleZoomFit(true)"><span class="slider"></span>Zoom to fit</label>
  <div class="bottom-exports">
    <button class="btn btn-export-outline" onclick="exportGanttPDF(event)">Export to PDF</button>
    <button class="btn btn-export-outline" onclick="exportGanttPNG(event)">Export to PNG</button>
    <button class="btn btn-export-outline" onclick="downloadCurrentPlan(event)">Export to Excel</button>
    <button class="btn btn-export-outline" onclick="downloadMSProject(event)">Export to MS Project</button>
  </div>
  <button class="btn btn-p btn-fullscreen" onclick="toggleFullscreen()" title="Fullscreen">FULLSCREEN</button>
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
          <select id="m-pred" class="fi" onchange="onPredChange()"></select>
        </div>
      </div>
      <div class="fg">
        <label class="fl">Dependency Type <span id="depTypeHint" class="fl-hint"></span></label>
        <div class="dep-type-group" id="depTypeGroup">
          <button type="button" class="dep-opt sel" data-dep="FS" onclick="selDep(this,'FS')" title="Finish-to-Start: successor starts after predecessor finishes">FS</button>
          <button type="button" class="dep-opt" data-dep="SS" onclick="selDep(this,'SS')" title="Start-to-Start: successor starts with predecessor">SS</button>
          <button type="button" class="dep-opt" data-dep="EE" onclick="selDep(this,'EE')" title="Finish-to-Finish: successor finishes with predecessor">FF</button>
        </div>
        <div class="dep-type-legend">FS Finish→Start · SS Start→Start · FF Finish→Finish</div>
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
</div>

<div class="modal-bg" id="modalVersions">
  <div class="modal modal-versions" style="width:580px;">
    <div class="mh">
      <h3>Plan versions</h3>
      <button class="mc" onclick="closeModal('modalVersions')" aria-label="Close">✕</button>
    </div>
    <div class="mb">
      <p class="versions-hint">Snapshots of this project's Gantt schedule. <strong>Activate</strong> replaces the live plan and reloads the chart.</p>
      <div class="versions-actions">
        <button type="button" class="btn btn-p" onclick="promptSaveVersion('update')">Save version</button>
        <button type="button" class="btn btn-ghost" onclick="promptSaveVersion('new')">Save as new…</button>
        <button type="button" class="btn btn-ghost" onclick="promptSaveVersion('copy')">Save as copy…</button>
      </div>
      <div id="versionsList" class="versions-list"></div>
    </div>
    <div class="mf">
      <button class="btn btn-ghost" onclick="closeModal('modalVersions')">Close</button>
    </div>
  </div>
</div>

<div class="modal-bg" id="modalVersionName">
  <div class="modal" style="width:420px;">
    <div class="mh">
      <h3 id="vnTitle">Save version</h3>
      <button class="mc" onclick="closeModal('modalVersionName')" aria-label="Close">✕</button>
    </div>
    <div class="mb">
      <p class="versions-hint" id="vnHint"></p>
      <div class="fg">
        <label class="fl" for="vnName">Version name</label>
        <input id="vnName" class="fi" type="text" maxlength="120" placeholder="e.g. Baseline v1" autocomplete="off">
      </div>
      <p class="vn-error" id="vnError" hidden></p>
    </div>
    <div class="mf">
      <button class="btn btn-ghost" onclick="closeModal('modalVersionName')">Cancel</button>
      <button class="btn btn-p" id="vnConfirmBtn" onclick="confirmVersionNameModal()">Save</button>
    </div>
  </div>
</div>

<div class="modal-bg" id="modalVersionConfirm">
  <div class="modal" style="width:420px;">
    <div class="mh">
      <h3 id="vcTitle">Confirm</h3>
      <button class="mc" onclick="closeModal('modalVersionConfirm')" aria-label="Close">✕</button>
    </div>
    <div class="mb">
      <p class="versions-hint" id="vcMessage" style="white-space:pre-line;"></p>
    </div>
    <div class="mf">
      <button class="btn btn-ghost" onclick="closeModal('modalVersionConfirm')">Cancel</button>
      <button class="btn btn-p" id="vcConfirmBtn" onclick="confirmVersionConfirmModal()">Confirm</button>
    </div>
  </div>
</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${projectName.replace(/</g, "&lt;")} — Gantt</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/gantt-v4-engine.css?v=20260721q">
</head>
<body>
<div class="main">
${toolbarHTML}
${ganttBodyHTML}
</div>
${modalsHTML}
<script>window.GANTT_INIT_DATA = ${dataJson};</script>
<script src="/gantt-v4-engine.js?v=20260721q"></script>
</body>
</html>`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ReactGanttChartProps {
  projectId: number;
}

export function ReactGanttChart({ projectId }: ReactGanttChartProps) {
  const queryClient = useQueryClient();
  const [authToken, setAuthToken] = useState<string | undefined>(undefined);
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  const [versionReloadKey, setVersionReloadKey] = useState(0);
  const bootstrappedKeyRef = useRef<string | null>(null);
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

  // Soft-sync React Query cache for other views — never remount the live Gantt iframe
  const softInvalidateGantt = useCallback(() => {
    void queryClient.invalidateQueries({
      predicate: (q) => {
        const key = q.queryKey;
        if (!Array.isArray(key) || key.length === 0) return false;
        const s = key.map(String).join("|");
        return (
          s.includes(`/api/pm/projects/${projectId}`) ||
          s.includes(`/api/pm/projects|${projectId}`) ||
          s.includes(`workstreams?projectId=${projectId}`)
        );
      },
      refetchType: "none",
    });
  }, [queryClient, projectId]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "gantt-saved" && e.data?.projectId === projectId) {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => {
          softInvalidateGantt();
        }, 800);
      }
      if (e.data?.type === "gantt-version-activated" && e.data?.projectId === projectId) {
        // Controlled remount only for plan version switch — refetch then rebuild iframe
        setSrcDoc(null);
        bootstrappedKeyRef.current = null;
        void queryClient
          .refetchQueries({
            predicate: (q) => {
              const key = q.queryKey;
              if (!Array.isArray(key) || key.length === 0) return false;
              const s = key.map(String).join("|");
              return (
                s.includes(`/api/pm/projects/${projectId}`) ||
                s.includes(`/api/pm/projects|${projectId}`) ||
                s.includes(`workstreams?projectId=${projectId}`)
              );
            },
          })
          .then(() => {
            setVersionReloadKey((k) => k + 1);
          });
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [projectId, softInvalidateGantt, queryClient]);

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

  // Reset bootstrap when switching projects
  useEffect(() => {
    bootstrappedKeyRef.current = null;
    setSrcDoc(null);
    setVersionReloadKey(0);
  }, [projectId]);

  // Build iframe once per project — later query updates must NOT rebuild srcDoc.
  // versionReloadKey forces a remount after activating a plan version.
  useEffect(() => {
    if (isLoading || !project || !authReady) return;
    const bootKey = `${projectId}:${versionReloadKey}`;
    if (bootstrappedKeyRef.current === bootKey) return;
    bootstrappedKeyRef.current = bootKey;
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
    setSrcDoc(buildSrcDoc(data, project.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot bootstrap per projectId (+ version remount)
  }, [isLoading, authReady, projectId, project, versionReloadKey]);

  if (isLoading || !srcDoc) {
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
      key={`gantt-${projectId}-v20260721q-${versionReloadKey}`}
      title={`Gantt — ${project.name}`}
      srcDoc={srcDoc}
      style={{ width: "100%", height: "100%", minHeight: 400, border: "none", display: "block" }}
      sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals"
      allow="fullscreen"
      allowFullScreen
    />
  );
}

export default ReactGanttChart;
