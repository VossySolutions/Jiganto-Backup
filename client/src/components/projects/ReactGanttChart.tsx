import { useEffect, useCallback, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { getSupabaseAccessToken } from "@/lib/supabase-session";
import { supabaseAuthEnabled } from "@/lib/supabase";
import { useTheme } from "@/hooks/use-theme";
import { useCurrentOrganisation } from "@/hooks/use-jiganto";
import type {
  PmProject,
  PmTask,
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
  /** Additional predecessors beyond predId — always FS-type (no per-extra
   * type picker in the UI yet). Optional/absent for every task that only
   * ever had one predecessor. */
  extraPredIds?: number[];
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

// Project root is synthetic id 1; all other rows use real pm_tasks.id
const PROJECT_ROW_ID = 1;

function ganttTypeToEngineType(ganttType?: string | null, isSummary?: boolean | null): number {
  const t = (ganttType || "").toLowerCase().trim();
  if (t === "program") return 0;
  if (t === "project") return 1;
  if (t === "phase") return 2;
  if (t === "workstream") return 3;
  if (t === "activity" || t === "summary") return 4;
  if (t === "milestone") return 6;
  if (t === "release") return 7;
  if (isSummary) return 4;
  return 5;
}

const VALID_DEP_TYPES = new Set(["FS", "SS", "FF", "SF"]);

// Default bar palette (unchanged) vs. Jiganto 2026 brand theme — see index.css's
// .theme-jiganto2026 block for the source tokens (chart-1..5, primary, status-amber).
const BAR_COLORS_DEFAULT: Record<number, string> = {
  0: "#4338ca",
  1: "#4f46e5",
  2: "#0891b2",
  3: "#059669",
  4: "#64748b",
  5: "#64748b",
  6: "#f59e0b",
  7: "#7c3aed",
};
const BAR_COLORS_JIGANTO2026: Record<number, string> = {
  0: "#3E5C76", // program — chart-1
  1: "#0E6E5C", // project — primary
  2: "#2B7A8A", // phase — chart-5
  3: "#3E8A74", // workstream — mid teal
  4: "#66788A", // activity — muted-foreground
  5: "#66788A", // task — muted-foreground
  6: "#B4560F", // milestone — status-amber-foreground
  7: "#5B4B8A", // release — chart-3
};

function buildGanttData(
  project: PmProject,
  tasks: PmTask[],
  team: TeamMember[],
  isBrandTheme = false
): GanttInitData {
  const barColors = isBrandTheme ? BAR_COLORS_JIGANTO2026 : BAR_COLORS_DEFAULT;
  const items: V4Task[] = [];
  const today = new Date().toISOString().split("T")[0];
  const oneYearLater = new Date(Date.now() + 365 * 864e5).toISOString().split("T")[0];

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

  const projRag = mapRag(project.ragStatus);
  const projBgt = mapRag((project as { financialRag?: string | null }).financialRag);
  const projSch = mapRag((project as { scheduleRag?: string | null }).scheduleRag);
  items.push({
    id: PROJECT_ROW_ID,
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
    color: barColors[1],
    wbs: "",
  });

  const idSet = new Set(tasks.map((t) => t.id));

  tasks.forEach((t) => {
    const type = ganttTypeToEngineType(t.ganttType, t.isSummary);
    let parentId: number | null = PROJECT_ROW_ID;
    if (t.parentTaskId && t.parentTaskId !== t.id && idSet.has(t.parentTaskId)) {
      parentId = t.parentTaskId;
    }
    const ownerName = t.assigneeId ? ownerMap.get(t.assigneeId) ?? "" : "";
    const predRaw = t.predecessorIds && t.predecessorIds.length > 0 ? t.predecessorIds[0] : null;
    const predId = predRaw && idSet.has(predRaw) ? predRaw : null;
    const extraPredIds = (t.predecessorIds || [])
      .slice(1)
      .filter((id) => idSet.has(id) && id !== predId);
    const start = safeDate(t.plannedStartDate, today);
    const end = type === 6 ? start : safeDate(t.plannedEndDate, start);
    const scopeRag =
      mapRag((t as { ragStatus?: string | null }).ragStatus) ||
      mapTaskVisualRag(t.status, t.progress ?? 0);
    const taskRags = deriveItemRags(scopeRag, t.progress ?? 0, t.status, start, end);
    items.push({
      id: t.id,
      name: t.name,
      type,
      owner: ownerName,
      start,
      end,
      prog: t.progress ?? 0,
      ...taskRags,
      parent: parentId,
      predId,
      extraPredIds: extraPredIds.length > 0 ? extraPredIds : undefined,
      depType: VALID_DEP_TYPES.has(t.depType || "") ? t.depType! : "FS",
      notes: t.description ?? "",
      color: barColors[type] || barColors[5],
      wbs: t.wbsCode || "",
    });
  });

  const ownerNamesFromTeam = team.map((m) => teamMemberDisplayName(m)).filter(Boolean);
  const owners = Array.from(
    new Set([...ownerNamesFromTeam, ...items.map((t) => t.owner).filter(Boolean)])
  );
  const maxId = tasks.reduce((m, t) => Math.max(m, t.id), PROJECT_ROW_ID);
  return {
    tasks: items,
    owners,
    ownerIdMap,
    nextId: Math.max(maxId + 1, 100000),
    projectId: project.id,
    tenantId: project.tenantId,
    projectName: project.name,
  };
}

// Jiganto 2026 brand theme override for the Gantt's DHTMLX-derived CSS custom
// properties (client/public/gantt-v4-engine.css). Scoped to light mode only —
// the engine's own .dark block already handles dark mode and the two aren't
// combined anywhere else in the app yet. Values sourced from index.css's
// .theme-jiganto2026 block so the two stay visually consistent.
const GANTT_BRAND_THEME_CSS = `
:root:not(.dark){
  --dhx-primary:#0E6E5C;
  --dhx-primary-dark:#0B5A49;
  --dhx-primary-light:#E3F1ED;
  --dhx-milestone:#B4560F;
  --dhx-milestone-border:#8f4409;
  --dhx-summary-l0:#0E6E5C;
  --dhx-summary-l0-dark:#0B5A49;
  --dhx-summary-l1:#4FA98F;
  --dhx-summary-l1-dark:#3E8A74;
  --dhx-summary-l2:#A9D9C9;
  --dhx-summary-l2-dark:#8AC4B0;
  --dhx-critical:#A03E52;
  --dhx-border:#DDE4EA;
  --dhx-border-light:#EAEEF2;
  --dhx-grid-header:#EAEEF2;
  --dhx-grid-odd:#F4F6F8;
  --dhx-grid-even:#ffffff;
  --dhx-weekend:#EAF3F0;
  --dhx-today:#FCF3E6;
  --dhx-today-line:#B4560F;
  --dhx-text:#182635;
  --dhx-text-muted:#66788A;
  --dhx-text-light:#8593A0;
  --dhx-surface:#ffffff;
  --dhx-page-bg:#EFF2F5;
  --dhx-elevated:#ffffff;
  --dhx-row-hover:#E3F1ED;
  --dhx-row-selected:#CFE8E1;
  --dhx-row-checked:#E3F1ED;
  --dhx-sel-bar-bg:#E3F1ED;
  --dhx-sel-bar-border:#8FC9BB;
  --dhx-sel-count:#0E6E5C;
  --dhx-scrollbar-track:#EAEEF2;
  --dhx-scrollbar-thumb:#C7D0D8;
  --dhx-scrollbar-thumb-hover:#AEB9C2;
  --dhx-critical-bg:#FBECEC;
  --dhx-critical-border:#D9A9AE;
  --dhx-green-bg:#E3F1ED;
  --dhx-green-border:#9FCBB9;
  --dhx-danger-bg:#FBECEC;
  --dhx-banner-hint-bg:#FCF3E6;
  --dhx-banner-hint-fg:#B4560F;
  --dhx-banner-warn-bg:#FCF3E6;
  --dhx-banner-warn-fg:#B4560F;
  --dhx-banner-on-bg:#FBECEC;
  --dhx-banner-on-fg:#A03E52;
  --g500:#66788A;
  --g600:#52606d;
  --g800:#182635;
  --amber:#B4560F;
  --green:#0E6E5C;
  --red:#A03E52;
}`;

function buildSrcDoc(data: GanttInitData, projectName: string, isDark = false, isBrandTheme = false): string {
  const dataJson = JSON.stringify(data);

  const toolbarHTML = `
<div class="gtb" id="ganttToolbar">
  <span class="zoom-to-label">Zoom:</span>
  <select class="tb-select zoom-to-select" id="zoomToSelect" onchange="setZoom(this.value)">
    <option value="day">Day</option>
    <option value="week" selected>Week</option>
    <option value="month">Month</option>
    <option value="quarter">Quarter</option>
    <option value="year">Year</option>
  </select>
  <div class="gtb-sep"></div>
  <span style="font-size:10px;color:var(--g500);font-weight:600;flex-shrink:0;">FILTER</span>
  <div class="tb-filter-wrap" id="typeFilterWrap">
    <button type="button" class="tb-select type-filter-btn" id="typeFilterBtn" onclick="toggleTypeFilterMenu(event)" title="Filter by type — tick one or more to show only those" aria-label="Filter by type" aria-haspopup="menu" aria-expanded="false">
      All types <span class="type-filter-caret" aria-hidden="true">▾</span>
    </button>
    <div class="tb-filter-menu type-filter-menu" id="typeFilterMenu" hidden role="menu"></div>
  </div>
  <input type="hidden" id="f-level" value="">
  <div class="tb-filter-wrap" id="ownerFilterWrap">
    <button type="button" class="tb-select type-filter-btn" id="ownerFilterBtn" onclick="toggleOwnerFilterMenu(event)" title="Filter by owner — tick one or more to show only those" aria-label="Filter by owner" aria-haspopup="menu" aria-expanded="false">
      All owners <span class="type-filter-caret" aria-hidden="true">▾</span>
    </button>
    <div class="tb-filter-menu type-filter-menu" id="ownerFilterMenu" hidden role="menu"></div>
  </div>
  <input type="hidden" id="f-owner" value="">
  <div class="tb-filter-wrap" id="ragFilterWrap">
    <button type="button" class="tb-filter-btn" id="ragFilterBtn" onclick="toggleRagFilterMenu(event)" title="Filter by Budget / Schedule / Scope RAG — tick one or more" aria-label="Filter by RAG" aria-haspopup="menu" aria-expanded="false">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
    </button>
    <div class="tb-filter-menu rag-filter-menu type-filter-menu" id="ragFilterMenu" hidden role="menu"></div>
  </div>
  <input type="hidden" id="f-rag-dim" value="">
  <input type="hidden" id="f-rag" value="">
  <input class="tb-search" id="f-search" placeholder="Search tasks…" oninput="onGanttSearchInput()" autocomplete="off">
  <div class="tb-filter-wrap" id="fieldsMenuWrap">
    <button type="button" class="tb-select type-filter-btn" id="fieldsMenuBtn" onclick="toggleFieldsMenu(event)" title="Choose which table columns are visible" aria-label="Columns" aria-haspopup="menu" aria-expanded="false">
      Columns <span class="type-filter-caret" aria-hidden="true">▾</span>
    </button>
    <div class="tb-filter-menu fields-menu" id="fieldsMenu" hidden role="menu"></div>
  </div>
  <div class="gtb-sep"></div>
  <div class="plan-chip" id="planChip" title="Click to manage plan versions" onclick="openVersionsModal()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openVersionsModal();}" role="button" tabindex="0">
    <span class="plan-chip-lbl">Plan</span>
    <span class="plan-chip-name" id="planChipName">Working</span>
    <span class="plan-chip-ver" id="planChipVer"></span>
    <svg class="plan-chip-caret" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
  </div>
  <div class="tb-filter-wrap" id="versionMenuWrap">
    <button type="button" class="tb-filter-btn" id="versionMenuBtn" onclick="toggleVersionMenu(event)" title="Save / plan versions" aria-label="Save plan versions" aria-haspopup="menu">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>
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
  <div class="cp-toggle" id="cpBtn" onclick="toggleCP()" title="Highlight the longest zero-slack chain. Hover a bar and drag the end dots to link tasks.">Critical path</div>
  <div class="gtb-actions">
    <button type="button" class="btn-icon" id="undoBtn" onclick="undo()" disabled title="Undo last change in this session (does not reverse a saved server write)" aria-label="Undo">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.7 3L3 13"/></svg>
    </button>
    <button type="button" class="btn-icon" id="redoBtn" onclick="redo()" disabled title="Redo (this session)" aria-label="Redo">
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
    <button type="button" class="btn-icon" onclick="collapseAll()" title="Collapse selected folder (and subfolders), or all if none selected" aria-label="Collapse">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12h8"/></svg>
    </button>
    <button type="button" class="btn-icon" onclick="expandAll()" title="Expand selected folder (and subfolders), or all if none selected" aria-label="Expand">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12h8"/></svg>
    </button>
    <div class="gtb-sep"></div>
    <button type="button" class="btn-icon btn-icon-export" onclick="openImportExport('export')" title="Export" aria-label="Export">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>
    </button>
    <button type="button" class="btn-icon btn-icon-import" onclick="openImportExport('import')" title="Import" aria-label="Import">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21V9"/><path d="M7 14l5-5 5 5"/><path d="M5 3h14"/></svg>
    </button>
    <div class="view-group" title="Click List or Gantt to show/hide each pane. Both on = side-by-side.">
      <button type="button" class="vb on" id="viewListBtn" onclick="toggleViewPane('list')" title="Task list — click to show or hide" aria-pressed="true">List</button>
      <button type="button" class="vb on" id="viewGanttBtn" onclick="toggleViewPane('gantt')" title="Timeline chart — click to show or hide" aria-pressed="true">Gantt</button>
    </div>
  </div>
</div>`;

  const ganttBodyHTML = `
<div class="gantt-body" id="ganttBody">
  <div class="gantt-view" id="ganttView">
    <div class="task-panel" id="taskPanel">
      <div class="tp-grid-x" id="tpGridX">
        <div class="tp-header" id="tpHeader">
          <div class="th-cell th-sel" data-field="sel" title="Select all visible rows">
            <input type="checkbox" class="th-sel-cb" id="selAllCb" onclick="event.stopPropagation();toggleSelectAllVisible(this.checked)" aria-label="Select all visible">
          </div>
          <div class="th-cell th-wbs" data-field="wbs">#</div>
          <div class="th-cell th-name" data-field="name">Task name</div>
          <div class="th-cell th-type" data-field="type" title="Line / field type (Phase, Task, Milestone…)">Type</div>
          <div class="th-cell th-owner" data-field="owner">Owner</div>
          <div class="th-cell th-date" data-field="start">Start</div>
          <div class="th-cell th-date" data-field="end">End</div>
          <div class="th-cell th-dur" data-field="duration">Duration</div>
          <div class="th-cell th-pred" data-field="pred" title="Predecessor links drive Critical path — click a cell to set">Pred</div>
          <div class="th-cell th-prog" data-field="prog">%</div>
          <div class="th-cell th-rag-col" data-field="budget">Budget</div>
          <div class="th-cell th-rag-col" data-field="sched">Sched</div>
          <div class="th-cell th-rag-col" data-field="scope">Scope</div>
          <div id="tpCustomHeaders" class="tp-custom-headers"></div>
          <div class="th-cell th-add-col" onclick="promptAddColumn()" title="Add a column" aria-label="Add column"><span class="th-add-plus">+</span></div>
          <div class="grid-filler"></div>
        </div>
        <div class="tp-scroll" id="taskScroll"></div>
      </div>
      <div class="panel-hscroll-pad" aria-hidden="true"></div>
    </div>
    <div class="panel-splitter" id="panelSplitter" title="Drag to resize columns"></div>
    <div class="timeline-panel">
      <div class="tl-header-wrap" id="tlHeaderWrap">
        <div class="tl-header" id="tlHeader"></div>
      </div>
      <div class="tl-scroll-wrap" id="tlWrap">
        <div class="tl-inner" id="tlInner">
          <div class="tl-rows" id="tlRows"></div>
          <div class="tl-bars" id="tlBars"></div>
          <div class="today-line" id="todayLine" style="display:none;">
            <div class="today-marker"></div>
          </div>
          <svg class="dep-svg" id="depSvg"></svg>
        </div>
      </div>
    </div>
  </div>
  <div class="list-view" id="listView" hidden></div>
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
          <label class="fl">Type <span class="fl-hint">change anytime (same item)</span></label>
          <select id="m-type" class="fi" title="Type changes how this row behaves; it stays the same work item">
            <option value="0">Program</option>
            <option value="1">Project</option>
            <option value="7">Release</option>
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
          <label class="fl">Predecessor <span class="fl-hint">links Critical path</span></label>
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
        <label class="fl">Additional predecessors <span class="fl-hint">optional — always Finish-to-Start</span></label>
        <div id="extraPredList" class="extra-pred-list"></div>
        <div class="extra-pred-add" id="extraPredAddRow">
          <select id="m-pred-extra" class="fi"></select>
          <button type="button" id="extraPredAddBtn" class="btn btn-ghost" onclick="addExtraPred()">+ Add</button>
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
</div>

<div class="modal-bg" id="modalAddColumn">
  <div class="modal" style="width:460px;" role="dialog" aria-labelledby="acTitle">
    <div class="mh">
      <h3 id="acTitle">Add column</h3>
      <button type="button" class="mc" id="acCloseBtn" aria-label="Close">✕</button>
    </div>
    <div class="mb">
      <div class="fg">
        <label class="fl" for="acName">Column name</label>
        <input id="acName" class="fi" type="text" maxlength="80" placeholder="e.g. Priority, Due date, Status" autocomplete="off">
      </div>
      <div class="fg">
        <span class="fl">Column type</span>
        <div class="ac-type-grid" id="acTypeGrid" role="radiogroup" aria-label="Column type">
          <button type="button" class="ac-type-btn sel" data-type="text">Text</button>
          <button type="button" class="ac-type-btn" data-type="number">Number</button>
          <button type="button" class="ac-type-btn" data-type="date">Date</button>
          <button type="button" class="ac-type-btn" data-type="select">Dropdown</button>
          <button type="button" class="ac-type-btn" data-type="checkbox">Checkbox</button>
        </div>
        <input type="hidden" id="acType" value="text">
      </div>
      <div class="fg" id="acOptsWrap">
        <label class="fl" for="acOpts">Dropdown options</label>
        <textarea id="acOpts" class="fi" rows="4" placeholder="One option per line&#10;Low&#10;Medium&#10;High"></textarea>
        <p class="versions-hint" style="margin:0;">Enter each choice on its own line (at least 2).</p>
      </div>
      <p class="vn-error" id="acError" hidden></p>
    </div>
    <div class="mf">
      <button type="button" class="btn btn-ghost" id="acCancelBtn">Cancel</button>
      <button type="button" class="btn btn-p" id="acConfirmBtn">Add column</button>
    </div>
  </div>
</div>`;

  return `<!DOCTYPE html>
<html lang="en"${isDark ? ' class="dark"' : ""}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${projectName.replace(/</g, "&lt;")} — Gantt</title>
<link rel="stylesheet" href="/gantt-v4-engine.css?v=20260724dark">
${isBrandTheme ? `<style>${GANTT_BRAND_THEME_CSS}</style>` : ""}
</head>
<body>
<div class="main">
${toolbarHTML}
<div class="gantt-sel-bar" id="ganttSelBar" role="toolbar" aria-label="Selection actions">
  <span class="gantt-sel-count" id="ganttSelCount">0 selected</span>
  <div class="gantt-sel-actions">
    <button type="button" class="gantt-sel-btn gantt-sel-delete" id="ganttSelDeleteBtn" onclick="deleteSelectedRows()" title="Delete selected lines">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
      Delete
    </button>
  </div>
  <button type="button" class="gantt-sel-clear" onclick="clearRowSelection()">Clear Selection</button>
</div>
${ganttBodyHTML}
</div>
${modalsHTML}
<script>window.GANTT_INIT_DATA = ${dataJson};</script>
<script src="/gantt-v4-engine.js?v=20260724dark"></script>
</body>
</html>`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ReactGanttChartProps {
  projectId: number;
}

export function ReactGanttChart({ projectId }: ReactGanttChartProps) {
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { data: organisation } = useCurrentOrganisation();
  // "jiganto2026" is now the default theme (see use-org-branding.tsx) — only
  // an explicit "legacy" opt-out should fall back to the old chart palette.
  const isBrandTheme = (organisation?.brandingConfig as { theme?: string } | null | undefined)?.theme !== "legacy";
  const [authToken, setAuthToken] = useState<string | undefined>(undefined);
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  const [versionReloadKey, setVersionReloadKey] = useState(0);
  const bootstrappedKeyRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
          s.includes(`/api/pm/projects/${projectId}/tasks`)
        );
      },
      refetchType: "none",
    });
  }, [queryClient, projectId]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "gantt-auth-token-request" && e.data?.requestId) {
        const requestId = String(e.data.requestId);
        const source = e.source as Window | null;
        void getSupabaseAccessToken().then((token) => {
          try {
            source?.postMessage(
              { type: "gantt-auth-token", requestId, token: token || "" },
              "*",
            );
          } catch {
            /* iframe may be gone */
          }
        });
        return;
      }
      if (e.data?.type === "gantt-saved" && e.data?.projectId === projectId) {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => {
          softInvalidateGantt();
        }, 800);
      }
      if (e.data?.type === "gantt-version-activated" && e.data?.projectId === projectId) {
        // Controlled remount only for plan version switch — refetch tasks then rebuild iframe
        setSrcDoc(null);
        bootstrappedKeyRef.current = null;
        void queryClient
          .refetchQueries({ queryKey: ["/api/pm/projects", projectId, "tasks"] })
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
    queryKey: ["/api/pm/projects", projectId],
    enabled: !!projectId,
  });
  const { data: dbTasks = [], isLoading: tkL } = useQuery<PmTask[]>({
    queryKey: ["/api/pm/projects", projectId, "tasks"],
    enabled: !!projectId,
  });
  const { data: team = [], isLoading: tmL } = useQuery<TeamMember[]>({
    queryKey: ["/api/pm/projects", projectId, "team"],
    enabled: !!projectId,
  });

  const authReady = authToken !== undefined;
  // When Supabase auth is on, wait for a real bearer token before mounting the iframe
  const authTokenReady = !supabaseAuthEnabled || Boolean(authToken);
  const isLoading = pjL || tkL || tmL || !authReady || !authTokenReady;

  // Reset bootstrap when switching projects
  useEffect(() => {
    bootstrappedKeyRef.current = null;
    setSrcDoc(null);
    setVersionReloadKey(0);
  }, [projectId]);

  // Build iframe once per project — later query updates must NOT rebuild srcDoc.
  // versionReloadKey forces a remount after activating a plan version.
  useEffect(() => {
    if (isLoading || !project || !authReady || !authTokenReady) return;
    const bootKey = `${projectId}:${versionReloadKey}:${isDark ? "dark" : "light"}:${isBrandTheme ? "brand" : "std"}`;
    if (bootstrappedKeyRef.current === bootKey) return;
    bootstrappedKeyRef.current = bootKey;
    const data: GanttInitData = {
      ...buildGanttData(project, dbTasks as PmTask[], team as TeamMember[], isBrandTheme),
      authToken: authToken || undefined,
    };
    setSrcDoc(buildSrcDoc(data, project.name, isDark, isBrandTheme));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot bootstrap per projectId (+ version/theme remount)
  }, [isLoading, authReady, authTokenReady, projectId, project, versionReloadKey, isDark, isBrandTheme]);

  // Keep iframe dark class in sync if theme flips without a full remount race
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.documentElement) return;
    doc.documentElement.classList.toggle("dark", isDark);
  }, [isDark, srcDoc]);

  if (isLoading || !srcDoc) {
    return (
      <div className="flex h-full flex-col gap-3 p-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="flex-1 w-full rounded-lg" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Project not found.
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      key={`gantt-${projectId}-v20260724dark-${versionReloadKey}-${isDark ? "d" : "l"}-${isBrandTheme ? "b" : "s"}`}
      title={`Gantt — ${project.name}`}
      srcDoc={srcDoc}
      className="block h-full w-full border-0"
      sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals"
      allow="fullscreen"
      allowFullScreen
    />
  );
}

export default ReactGanttChart;
