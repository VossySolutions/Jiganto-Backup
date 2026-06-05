/**
 * GanttChart.tsx — v11 React 18 + TypeScript 5 + Tailwind CSS
 *
 * Drop-in controlled component for Jiganto.
 * All rendering logic ported 1-to-1 from GanttPro v11 HTML.
 *
 * Usage:
 *   <GanttChart
 *     tasks={tasks}
 *     resources={resources}
 *     dependencies={deps}
 *     onTaskUpdate={handleUpdate}
 *     onTaskAdd={handleAdd}
 *     onTaskDelete={handleDelete}
 *     onDependencyChange={handleDeps}
 *     onResourceChange={handleResources}
 *   />
 */

'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import type {
  GanttBarStyle,
  GanttChartProps,
  GanttColumn,
  GanttDependency,
  GanttDepType,
  GanttFilters,
  GanttPriority,
  GanttResource,
  GanttStatus,
  GanttTask,
  GanttTaskType,
  GanttVersion,
  GanttView,
  HistogramPeriod,
} from './gantt.types';

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const ROW_H = 36;
const HDR_H = 88;

const TYPE_COLORS: Record<GanttTaskType, string> = {
  project:    '#1f6feb',
  release:    '#f0883e',
  phase:      '#bc8cff',
  workstream: '#39d353',
  activity:   '#3fb950',
  task:       '#e3b341',
  subtask:    '#ff7b72',
  milestone:  '#58a6ff',
};

const TYPE_SHORT: Record<GanttTaskType, string> = {
  project:'Proj', release:'Rel', phase:'Phase', workstream:'WS',
  activity:'Act', task:'Task', subtask:'Sub', milestone:'Mile',
};

const STATUS_LABELS: Record<GanttStatus, string> = {
  notstarted:'Not Started', inprogress:'In Progress',
  completed:'Completed', onhold:'On Hold', atrisk:'At Risk',
};

const PRIO_LABELS: Record<GanttPriority, string> = {
  critical:'Critical', high:'High', medium:'Medium', low:'Low',
};

const ALL_TYPES:  GanttTaskType[] = ['project','release','phase','workstream','activity','task','subtask','milestone'];
const ALL_PRIOS:  GanttPriority[] = ['critical','high','medium','low'];
const ALL_STATUSES: GanttStatus[] = ['notstarted','inprogress','completed','onhold','atrisk'];

const PRESETS = ['#1f6feb','#58a6ff','#bc8cff','#3fb950','#39d353','#e3b341','#f0883e','#ff7b72','#f85149','#8b949e'];

const BASE_CELL: Record<GanttView, number> = { day:32, week:90, month:130, year:110 };

const DEFAULT_COLS: GanttColumn[] = [
  { id:'name',     label:'Task / Name',  w:220 },
  { id:'wbs',      label:'WBS',          w:58  },
  { id:'type',     label:'Type',         w:80  },
  { id:'dur',      label:'Dur',          w:44  },
  { id:'start',    label:'Start',        w:82  },
  { id:'end',      label:'End',          w:82  },
  { id:'resource', label:'Resource',     w:84  },
  { id:'progress', label:'%',            w:62  },
  { id:'status',   label:'Status',       w:98  },
  { id:'priority', label:'Priority',     w:72  },
  { id:'deps',     label:'Dependencies', w:130 },
];

const SYS_COLS_ALL = [
  { id:'type',     label:'Type'         },
  { id:'wbs',      label:'WBS'          },
  { id:'dur',      label:'Duration'     },
  { id:'start',    label:'Start Date'   },
  { id:'end',      label:'End Date'     },
  { id:'resource', label:'Resource'     },
  { id:'progress', label:'Progress %'   },
  { id:'status',   label:'Status'       },
  { id:'priority', label:'Priority'     },
  { id:'deps',     label:'Dependencies' },
];

const UNDO_LIMIT = 30;

// ─────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────

function mkId(): string { return 'i' + Date.now() + Math.random().toString(36).slice(2, 6); }
function ds(d: Date): string { return d.toISOString().split('T')[0]; }
function pd(s: string): Date { return new Date(s + 'T00:00:00'); }
function dBetween(a: Date, b: Date): number { return Math.round((b.getTime() - a.getTime()) / 86400000); }
function clamp(v: number, mn: number, mx: number): number { return Math.max(mn, Math.min(mx, v)); }

function getItemResources(item: GanttTask): string[] {
  if (Array.isArray(item.resources)) return item.resources;
  if (item.resource) return [item.resource];
  return [];
}

function durFromDates(item: GanttTask): number {
  if (item.durDays !== undefined && item.durDays !== null) return item.durDays;
  const ms = pd(item.end).getTime() - pd(item.start).getTime();
  return Math.max(0, ms / 86400000);
}

function endFromDur(startStr: string, durDays: number): string {
  const d = pd(startStr);
  d.setDate(d.getDate() + Math.max(0, Math.floor(durDays)));
  return ds(d);
}

function durLabel(d: number): string {
  if (d === 0) return '0d';
  if (d < 1) { const h = Math.round(d * 24); return h + 'h'; }
  return Number.isInteger(d) ? d + 'd' : (+d.toFixed(1)) + 'd';
}

function parseDur(str: string): number | null {
  if (!str) return null;
  str = str.trim().toLowerCase();
  if (str.endsWith('h')) { const h = parseFloat(str); return isNaN(h) ? null : h / 24; }
  const d = parseFloat(str.replace('d', ''));
  return isNaN(d) ? null : Math.max(0, d);
}

function getWN(d: Date): number {
  const d2 = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d2.setUTCDate(d2.getUTCDate() + 4 - (d2.getUTCDay() || 7));
  const y = new Date(Date.UTC(d2.getUTCFullYear(), 0, 1));
  return Math.ceil(((d2.getTime() - y.getTime()) / 86400000 + 1) / 7);
}

function calcWBS(items: GanttTask[]): Map<string, string> {
  const map = new Map<string, string>();
  function walk(parentId: string | null | undefined, prefix: string) {
    items.filter(i => (i.parent ?? null) === (parentId ?? null)).forEach((item, idx) => {
      const code = prefix ? `${prefix}.${idx + 1}` : `${idx + 1}`;
      map.set(item.id, code);
      walk(item.id, code);
    });
  }
  walk(null, '');
  return map;
}

function getDepth(id: string, items: GanttTask[]): number {
  let d = 0;
  let item: GanttTask | undefined = items.find(i => i.id === id);
  while (item && item.parent) {
    d++;
    item = items.find(i => i.id === item!.parent);
  }
  return d;
}

// ─────────────────────────────────────────────────────────────
// INTERNAL STATE TYPES
// ─────────────────────────────────────────────────────────────

interface GanttState {
  tasks: GanttTask[];
  resources: GanttResource[];
  deps: GanttDependency[];
  versions: GanttVersion[];
  undoStack: Array<{ tasks: GanttTask[]; deps: GanttDependency[] }>;
  cols: GanttColumn[];
  view: GanttView;
  zoom: number;
  collapsed: Set<string>;
  collapsedAll: boolean;
  filters: GanttFilters;
  selId: string | null;
  gridW: number;
  resPanelOpen: boolean;
  resGridOpen: boolean;
  resGridH: number;
  sidebarVisible: boolean;
  theme: 'dark' | 'light';
  // Inline edit
  inlineEditId: string | null;
  inlineNewParentId: string | null;
  // Modals
  addEditOpen: boolean;
  addEditId: string | null;   // null = add, string = edit id
  addEditParentId: string | null;
  depPanelOpen: boolean;
  colourPanelId: string | null;
  versionPanelOpen: boolean;
  colPickerOpen: boolean;
  schedPanelOpen: boolean;
}

type Action =
  | { type: 'SET_TASKS'; tasks: GanttTask[] }
  | { type: 'SET_RESOURCES'; resources: GanttResource[] }
  | { type: 'SET_DEPS'; deps: GanttDependency[] }
  | { type: 'SAVE_HISTORY' }
  | { type: 'UNDO' }
  | { type: 'SET_VIEW'; view: GanttView }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'TOGGLE_COLLAPSE'; id: string }
  | { type: 'COLLAPSE_ALL' }
  | { type: 'EXPAND_ALL' }
  | { type: 'SET_FILTERS'; filters: Partial<GanttFilters> }
  | { type: 'SET_SEL'; id: string | null }
  | { type: 'SET_GRID_W'; w: number }
  | { type: 'TOGGLE_RES_PANEL' }
  | { type: 'TOGGLE_RES_GRID' }
  | { type: 'SET_RES_GRID_H'; h: number }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_THEME'; theme: 'dark' | 'light' }
  | { type: 'START_INLINE_EDIT'; id: string }
  | { type: 'START_INLINE_NEW'; parentId: string | null }
  | { type: 'CANCEL_INLINE' }
  | { type: 'OPEN_ADD'; parentId: string | null }
  | { type: 'OPEN_EDIT'; id: string }
  | { type: 'CLOSE_ADD_EDIT' }
  | { type: 'OPEN_DEP_PANEL' }
  | { type: 'CLOSE_DEP_PANEL' }
  | { type: 'OPEN_COLOUR_PANEL'; id: string }
  | { type: 'CLOSE_COLOUR_PANEL' }
  | { type: 'OPEN_VERSION_PANEL' }
  | { type: 'CLOSE_VERSION_PANEL' }
  | { type: 'TOGGLE_COL_PICKER' }
  | { type: 'CLOSE_COL_PICKER' }
  | { type: 'TOGGLE_COL'; id: string; on: boolean }
  | { type: 'ADD_CUSTOM_COL'; label: string; dataType: string }
  | { type: 'REMOVE_CUSTOM_COL'; id: string }
  | { type: 'RESIZE_COL'; id: string; w: number }
  | { type: 'SAVE_VERSION'; name: string }
  | { type: 'RESTORE_VERSION'; id: string }
  | { type: 'OPEN_SCHED_PANEL' }
  | { type: 'CLOSE_SCHED_PANEL' };

function initState(props: GanttChartProps): GanttState {
  const prefersDark = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : true;
  const theme = props.theme ?? (prefersDark ? 'dark' : 'light');

  const cols = [...DEFAULT_COLS];
  if (props.customColumns) {
    props.customColumns.forEach(cc => {
      if (!cols.find(c => c.id === cc.id)) cols.push(cc);
    });
  }

  return {
    tasks:          props.tasks,
    resources:      props.resources,
    deps:           props.dependencies,
    versions:       [],
    undoStack:      [],
    cols,
    view:           props.defaultView ?? 'week',
    zoom:           props.defaultZoom ?? 100,
    collapsed:      new Set(),
    collapsedAll:   false,
    filters:        { types: new Set(), priorities: new Set(), statuses: new Set(), resources: new Set(), search: '' },
    selId:          null,
    gridW:          820,
    resPanelOpen:   false,
    resGridOpen:    false,
    resGridH:       180,
    sidebarVisible: true,
    theme,
    inlineEditId:   null,
    inlineNewParentId: null,
    addEditOpen:    false,
    addEditId:      null,
    addEditParentId: null,
    depPanelOpen:   false,
    colourPanelId:  null,
    versionPanelOpen: false,
    colPickerOpen:  false,
    schedPanelOpen: false,
  };
}

function reducer(state: GanttState, action: Action): GanttState {
  switch (action.type) {
    case 'SET_TASKS':    return { ...state, tasks: action.tasks };
    case 'SET_RESOURCES': return { ...state, resources: action.resources };
    case 'SET_DEPS':     return { ...state, deps: action.deps };

    case 'SAVE_HISTORY': {
      const stack = [
        ...state.undoStack.slice(-UNDO_LIMIT + 1),
        { tasks: JSON.parse(JSON.stringify(state.tasks)), deps: JSON.parse(JSON.stringify(state.deps)) },
      ];
      return { ...state, undoStack: stack };
    }

    case 'UNDO': {
      if (!state.undoStack.length) return state;
      const stack = [...state.undoStack];
      const snap  = stack.pop()!;
      return { ...state, tasks: snap.tasks, deps: snap.deps, undoStack: stack };
    }

    case 'SET_VIEW':   return { ...state, view: action.view };
    case 'SET_ZOOM':   return { ...state, zoom: clamp(action.zoom, 40, 300) };

    case 'TOGGLE_COLLAPSE': {
      const c = new Set(state.collapsed);
      c.has(action.id) ? c.delete(action.id) : c.add(action.id);
      return { ...state, collapsed: c };
    }
    case 'COLLAPSE_ALL': {
      const c = new Set<string>();
      state.tasks.filter(t => state.tasks.some(c => c.parent === t.id)).forEach(t => c.add(t.id));
      return { ...state, collapsed: c, collapsedAll: true };
    }
    case 'EXPAND_ALL':
      return { ...state, collapsed: new Set(), collapsedAll: false };

    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.filters } };

    case 'SET_SEL': return { ...state, selId: action.id };
    case 'SET_GRID_W': return { ...state, gridW: clamp(action.w, 300, 1200) };

    case 'TOGGLE_RES_PANEL':
      return {
        ...state,
        resPanelOpen: !state.resPanelOpen && !state.resGridOpen,
        resGridOpen:  state.resPanelOpen ? true : (state.resGridOpen ? false : false),
        // cycle: neither → side-panel → bottom-grid → neither
        ...(state.resPanelOpen && !state.resGridOpen ? { resPanelOpen: false, resGridOpen: true } : {}),
        ...(state.resGridOpen ? { resPanelOpen: false, resGridOpen: false } : {}),
        ...(!state.resPanelOpen && !state.resGridOpen ? { resPanelOpen: true } : {}),
      };
    case 'TOGGLE_RES_GRID':
      return { ...state, resGridOpen: false };
    case 'SET_RES_GRID_H':
      return { ...state, resGridH: clamp(action.h, 120, 400) };

    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarVisible: !state.sidebarVisible };
    case 'SET_THEME':
      return { ...state, theme: action.theme };

    case 'START_INLINE_EDIT':
      return { ...state, inlineEditId: action.id, inlineNewParentId: null };
    case 'START_INLINE_NEW':
      return { ...state, inlineEditId: '__new__', inlineNewParentId: action.parentId };
    case 'CANCEL_INLINE':
      return { ...state, inlineEditId: null, inlineNewParentId: null };

    case 'OPEN_ADD':
      return { ...state, addEditOpen: true, addEditId: null, addEditParentId: action.parentId };
    case 'OPEN_EDIT':
      return { ...state, addEditOpen: true, addEditId: action.id };
    case 'CLOSE_ADD_EDIT':
      return { ...state, addEditOpen: false, addEditId: null, addEditParentId: null };

    case 'OPEN_DEP_PANEL':   return { ...state, depPanelOpen: true };
    case 'CLOSE_DEP_PANEL':  return { ...state, depPanelOpen: false };
    case 'OPEN_COLOUR_PANEL': return { ...state, colourPanelId: action.id };
    case 'CLOSE_COLOUR_PANEL': return { ...state, colourPanelId: null };
    case 'OPEN_VERSION_PANEL':  return { ...state, versionPanelOpen: true };
    case 'CLOSE_VERSION_PANEL': return { ...state, versionPanelOpen: false };
    case 'TOGGLE_COL_PICKER': return { ...state, colPickerOpen: !state.colPickerOpen };
    case 'CLOSE_COL_PICKER':  return { ...state, colPickerOpen: false };

    case 'TOGGLE_COL': {
      const cols = state.cols.map(c => c.id === action.id ? { ...c, visible: action.on } : c);
      if (action.on && !cols.find(c => c.id === action.id)) {
        const sc = SYS_COLS_ALL.find(s => s.id === action.id);
        if (sc) cols.push({ id: sc.id, label: sc.label, w: 85, visible: true });
      }
      return { ...state, cols };
    }
    case 'ADD_CUSTOM_COL': {
      const id = 'cust_' + Date.now();
      return { ...state, cols: [...state.cols, { id, label: action.label, w: 100, visible: true, custom: true, dataType: action.dataType as 'text' | 'number' | 'date' }] };
    }
    case 'REMOVE_CUSTOM_COL':
      return { ...state, cols: state.cols.filter(c => c.id !== action.id) };
    case 'RESIZE_COL':
      return { ...state, cols: state.cols.map(c => c.id === action.id ? { ...c, w: clamp(action.w, 40, 500) } : c) };

    case 'SAVE_VERSION': {
      const v: GanttVersion = { id: 'v' + Date.now(), name: action.name, date: ds(new Date()), data: JSON.stringify(state.tasks) };
      return { ...state, versions: [...state.versions, v] };
    }
    case 'RESTORE_VERSION': {
      const v = state.versions.find(v => v.id === action.id);
      if (!v) return state;
      return { ...state, tasks: JSON.parse(v.data) };
    }

    case 'OPEN_SCHED_PANEL':  return { ...state, schedPanelOpen: true };
    case 'CLOSE_SCHED_PANEL': return { ...state, schedPanelOpen: false };

    default: return state;
  }
}

// ─────────────────────────────────────────────────────────────
// USEGANTTVIEWPORT — date ↔ pixel math
// ─────────────────────────────────────────────────────────────

function useViewport(view: GanttView, zoom: number) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const cw = useMemo(() => Math.round(BASE_CELL[view] * zoom / 100), [view, zoom]);

  const { viewStart, viewEnd } = useMemo(() => {
    const s = new Date(today), e = new Date(today);
    if (view === 'day')   { s.setDate(s.getDate() - 10); e.setDate(e.getDate() + 60); }
    else if (view === 'week')  { s.setDate(s.getDate() - 21); e.setDate(e.getDate() + 90); }
    else if (view === 'month') { s.setMonth(s.getMonth() - 2); e.setMonth(e.getMonth() + 8); }
    else { s.setFullYear(s.getFullYear() - 1); s.setMonth(0); s.setDate(1); e.setFullYear(e.getFullYear() + 3); e.setMonth(11); e.setDate(31); }
    return { viewStart: s, viewEnd: e };
  }, [view, today]);

  const dateToX = useCallback((date: string | Date): number => {
    const d = typeof date === 'string' ? pd(date) : date;
    if (view === 'day')   return dBetween(viewStart, d) * cw;
    if (view === 'week')  return (dBetween(viewStart, d) / 7) * cw;
    if (view === 'month') return (dBetween(viewStart, d) / 30.44) * cw;
    return (dBetween(viewStart, d) / 365.25) * cw;
  }, [view, viewStart, cw]);

  const xToDate = useCallback((x: number): Date => {
    let days: number;
    if (view === 'day')   days = x / cw;
    else if (view === 'week')  days = (x / cw) * 7;
    else if (view === 'month') days = (x / cw) * 30.44;
    else days = (x / cw) * 365.25;
    const d = new Date(viewStart);
    d.setDate(d.getDate() + Math.round(days));
    return d;
  }, [view, viewStart, cw]);

  return { today, viewStart, viewEnd, cw, dateToX, xToDate };
}

// ─────────────────────────────────────────────────────────────
// USENOTIFY
// ─────────────────────────────────────────────────────────────

function useNotify() {
  const [notif, setNotif] = useState<{ msg: string; type: 'success' | 'info' | 'error'; key: number } | null>(null);
  const notify = useCallback((msg: string, type: 'success' | 'info' | 'error' = 'info') => {
    setNotif({ msg, type, key: Date.now() });
  }, []);
  useEffect(() => {
    if (!notif) return;
    const t = setTimeout(() => setNotif(null), 2500);
    return () => clearTimeout(t);
  }, [notif?.key]);
  return { notif, notify };
}

// ─────────────────────────────────────────────────────────────
// CSS-IN-JS STYLES (scoped, doesn't leak into Tailwind)
// We inject once and reuse via a style tag
// ─────────────────────────────────────────────────────────────

const GANTT_STYLE = `
.gp-root{--gp-bg:#0d1117;--gp-surface:#161b22;--gp-surface2:#1c2330;--gp-surface3:#21262d;
  --gp-border:#30363d;--gp-border2:#3d444d;--gp-text:#e6edf3;--gp-text2:#8b949e;--gp-text3:#484f58;
  --gp-accent:#58a6ff;--gp-accent2:#1f6feb;--gp-green:#3fb950;--gp-orange:#f0883e;
  --gp-red:#f85149;--gp-purple:#bc8cff;--gp-yellow:#e3b341;--gp-pink:#ff7b72;
  color:var(--gp-text);background:var(--gp-bg);font-family:'DM Sans',ui-sans-serif,sans-serif;font-size:12px;}
.gp-root.light{--gp-bg:#f6f8fa;--gp-surface:#ffffff;--gp-surface2:#f0f2f5;--gp-surface3:#e8ebf0;
  --gp-border:#d0d7de;--gp-border2:#b8c0cc;--gp-text:#1f2328;--gp-text2:#57606a;--gp-text3:#9aa3ad;
  --gp-accent:#0969da;--gp-accent2:#0550ae;--gp-green:#1a7f37;--gp-orange:#bc4c00;
  --gp-red:#cf222e;--gp-purple:#8250df;--gp-yellow:#7d4e00;--gp-pink:#a40e26;}
/* No transition on bar / chart cells for perf */
.gp-bar-wrap,.gp-bar-wrap *,.gp-dep-svg *,.gp-crow,.gp-crow *{transition:none!important;}

/* Scrollbar */
.gp-scrollbar::-webkit-scrollbar{width:4px;height:4px;}
.gp-scrollbar::-webkit-scrollbar-thumb{background:var(--gp-border2);border-radius:2px;}
.gp-scrollbar6::-webkit-scrollbar{width:6px;height:6px;}
.gp-scrollbar6::-webkit-scrollbar-thumb{background:var(--gp-border2);border-radius:3px;}

/* Badge helpers */
.gp-badge{display:inline-flex;align-items:center;padding:1px 6px;border-radius:10px;font-size:10px;font-weight:600;white-space:nowrap;}
.gp-prio-critical{background:rgba(248,81,73,.2);color:#f85149;}
.gp-prio-high{background:rgba(240,136,62,.2);color:#f0883e;}
.gp-prio-medium{background:rgba(227,179,65,.2);color:#e3b341;}
.gp-prio-low{background:rgba(63,185,80,.2);color:#3fb950;}
.gp-status-notstarted{background:rgba(139,148,158,.15);color:#8b949e;}
.gp-status-inprogress{background:rgba(88,166,255,.2);color:#58a6ff;}
.gp-status-completed{background:rgba(63,185,80,.2);color:#3fb950;}
.gp-status-onhold{background:rgba(240,136,62,.2);color:#f0883e;}
.gp-status-atrisk{background:rgba(248,81,73,.2);color:#f85149;}
.light .gp-prio-critical{background:rgba(207,34,46,.12);color:#a40e26;}
.light .gp-prio-high{background:rgba(188,76,0,.12);color:#953800;}
.light .gp-status-inprogress{background:rgba(9,105,218,.12);color:#0550ae;}
.light .gp-status-completed{background:rgba(26,127,55,.12);color:#1a7f37;}

/* Bar */
.gp-bar-wrap{position:absolute;top:5px;height:26px;z-index:4;}
.gp-bar-wrap:hover{filter:brightness(1.12);z-index:7;}
.gp-bar-wrap.dragging{opacity:.8;z-index:20;cursor:grabbing!important;}
.gp-bar{width:100%;height:100%;border-radius:5px;display:flex;align-items:center;
  padding:0 8px;font-size:11px;font-weight:600;color:rgba(255,255,255,.9);
  overflow:hidden;position:relative;user-select:none;
  box-shadow:0 2px 6px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.1);}
.gp-bar.outline{background:transparent!important;border:2px solid currentColor;box-shadow:none;}
.gp-bar-prog{position:absolute;top:0;left:0;height:100%;border-radius:5px;background:rgba(0,0,0,.25);pointer-events:none;}
.gp-bar-pct{position:absolute;right:20px;font-size:9px;font-weight:700;color:rgba(255,255,255,.7);pointer-events:none;z-index:2;}
.gp-bar-lbl{overflow:hidden;text-overflow:clip;white-space:nowrap;flex:1;position:relative;z-index:1;min-width:0;}
.gp-resize-l,.gp-resize-r{position:absolute;top:0;width:6px;height:100%;cursor:ew-resize;z-index:5;
  background:rgba(255,255,255,.12);opacity:0;}
.gp-resize-l{left:0;border-radius:5px 0 0 5px;}
.gp-resize-r{right:0;border-radius:0 5px 5px 0;}
.gp-bar-wrap:hover .gp-resize-l,.gp-bar-wrap:hover .gp-resize-r{opacity:1;}

/* Milestone */
.gp-milestone{position:absolute;width:16px;height:16px;transform:rotate(45deg);cursor:pointer;
  z-index:5;top:10px;border-radius:2px;box-shadow:0 2px 8px rgba(0,0,0,.5);}
.gp-milestone:hover{transform:rotate(45deg) scale(1.25);}
.gp-m-label{position:absolute;white-space:nowrap;font-size:11px;font-weight:600;
  color:var(--gp-text);pointer-events:none;}

/* Dep handles */
.gp-dep-handle{position:absolute;width:14px;height:14px;border-radius:50%;
  background:var(--gp-surface3);border:2px solid var(--gp-border2);
  cursor:crosshair;z-index:8;opacity:0;}
.gp-dep-handle:hover{opacity:1!important;background:var(--gp-accent)!important;
  border-color:var(--gp-accent)!important;transform:scale(1.25);}
.gp-bar-wrap:hover~.gp-dep-handle,.gp-chart-body:hover .gp-dep-handle{opacity:.55;}
.gp-dep-handle.drop-hover{opacity:1!important;background:var(--gp-accent)!important;
  border-color:var(--gp-accent)!important;transform:scale(1.5);box-shadow:0 0 10px rgba(88,166,255,.7);}

/* Dep SVG lines */
.gp-dep-line{fill:none;stroke:#484f58;stroke-width:1.5;pointer-events:stroke;cursor:pointer;}
.gp-dep-line:hover{stroke:var(--gp-accent)!important;stroke-width:2!important;}
.gp-dep-drawing{fill:none;stroke:var(--gp-accent);stroke-width:1.5;stroke-dasharray:5 3;pointer-events:none;}

/* Today line */
.gp-today-line{position:absolute;top:0;bottom:0;width:2px;background:var(--gp-accent);
  pointer-events:none;z-index:6;box-shadow:0 0 10px rgba(88,166,255,.35);}
.gp-today-line::before{content:'';position:absolute;top:0;left:50%;transform:translateX(-50%);
  width:7px;height:7px;border-radius:50%;background:var(--gp-accent);}

/* Grid cell col resize grip */
.gp-col-grip{position:absolute;right:-3px;top:0;bottom:0;width:6px;cursor:col-resize;z-index:5;}
.gp-col-grip:hover{background:var(--gp-accent2);opacity:.7;border-radius:2px;}

/* Inline input */
.gp-inline-inp{width:100%;height:22px;background:var(--gp-bg);border:1px solid var(--gp-accent2);
  border-radius:3px;color:var(--gp-text);padding:0 5px;font-size:11px;outline:none;
  box-shadow:0 0 0 2px rgba(31,111,235,.2);}
.gp-inline-sel{width:100%;height:22px;background:var(--gp-surface2);border:1px solid var(--gp-accent2);
  border-radius:3px;color:var(--gp-text);padding:0 3px;font-size:10px;outline:none;}

/* Histogram */
.rh-cell{display:flex;align-items:center;justify-content:center;position:relative;
  font-size:10px;font-weight:600;border-right:1px solid var(--gp-border);overflow:hidden;flex-shrink:0;}
.rh-empty{color:var(--gp-text3);}
.rh-ok{color:var(--gp-green);background:rgba(63,185,80,.07);}
.rh-warn{color:var(--gp-yellow);background:rgba(227,179,65,.1);}
.rh-over{color:var(--gp-red);background:rgba(248,81,73,.12);}
.rh-bar{position:absolute;bottom:0;left:0;right:0;}

/* Resource cap bar */
.gp-cap-bar-w{height:5px;background:var(--gp-bg);border-radius:3px;overflow:hidden;}
.gp-cap-bar{height:100%;border-radius:3px;}
`;

// ─────────────────────────────────────────────────────────────
// SMALL SHARED UI COMPONENTS
// ─────────────────────────────────────────────────────────────

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger' | 'active';
  size?: 'sm' | 'xs';
}
const Btn: React.FC<BtnProps> = ({ variant = 'default', size, className = '', children, ...rest }) => {
  const base = 'inline-flex items-center gap-1 rounded border cursor-pointer font-medium whitespace-nowrap select-none transition-all duration-100';
  const pad  = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]';
  const vars: Record<string, string> = {
    default: 'border-[var(--gp-border2)] bg-[var(--gp-surface3)] text-[var(--gp-text2)] hover:bg-[var(--gp-surface2)] hover:text-[var(--gp-text)] hover:border-[var(--gp-accent2)]',
    primary: 'border-transparent bg-[var(--gp-accent2)] text-white hover:bg-[var(--gp-accent)]',
    danger:  'border-[rgba(248,81,73,.3)] bg-[rgba(248,81,73,.15)] text-[var(--gp-red)]',
    active:  'border-transparent bg-[var(--gp-accent2)] text-white',
  };
  return (
    <button className={`${base} ${pad} ${vars[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
};

const Sep: React.FC = () => (
  <div className="w-px h-[22px] bg-[var(--gp-border)] flex-shrink-0" />
);

const Badge: React.FC<{ cls: string; children: React.ReactNode }> = ({ cls, children }) => (
  <span className={`gp-badge ${cls}`}>{children}</span>
);

const Overlay: React.FC<{ open: boolean; onClose: () => void; children: React.ReactNode }> = ({ open, onClose, children }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/55 z-[500] flex items-center justify-center"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
};

const Panel: React.FC<{ children: React.ReactNode; width?: number }> = ({ children, width = 500 }) => (
  <div
    className="bg-[var(--gp-surface)] border border-[var(--gp-border)] rounded-xl p-6 overflow-y-auto max-h-[85vh] shadow-2xl"
    style={{ width }}
    onMouseDown={(e) => e.stopPropagation()}
  >
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────
// FILTER CHIP
// ─────────────────────────────────────────────────────────────
interface FilterChipProps {
  label: string; on: boolean; color?: string;
  onClick: () => void;
}
const FilterChip: React.FC<FilterChipProps> = ({ label, on, color, onClick }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium cursor-pointer transition-all"
    style={{
      borderColor: on && color ? color : 'var(--gp-border2)',
      background:  on && color ? color + '33' : 'var(--gp-surface3)',
      color:       on && color ? color : 'var(--gp-text2)',
    }}
  >
    {label}
  </button>
);

// ─────────────────────────────────────────────────────────────
// PROGRESS BAR
// ─────────────────────────────────────────────────────────────
const ProgressBar: React.FC<{ pct: number; onClick?: () => void }> = ({ pct, onClick }) => {
  const col = pct === 100 ? 'var(--gp-green)' : pct > 60 ? 'var(--gp-accent)' : 'var(--gp-yellow)';
  return (
    <div className="flex flex-col gap-0.5 w-full cursor-pointer" onClick={onClick} title="Click to edit progress">
      <div className="h-[5px] rounded-sm overflow-hidden bg-[var(--gp-border)]">
        <div className="h-full rounded-sm" style={{ width: pct + '%', background: col }} />
      </div>
      <span className="text-[9px] text-[var(--gp-text3)]">{pct}%</span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// RESOURCE AVATAR CHIP
// ─────────────────────────────────────────────────────────────
const ResAvatar: React.FC<{ res: GanttResource; size?: number }> = ({ res, size = 18 }) => {
  const init = res.name.split(' ').map(n => n[0]).join('');
  return (
    <div
      title={res.name}
      style={{ width: size, height: size, background: res.color, fontSize: size * 0.45, flexShrink: 0 }}
      className="rounded-full flex items-center justify-center font-bold text-white"
    >
      {init}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// INLINE INPUT
// ─────────────────────────────────────────────────────────────
interface InlineInputProps {
  value: string; type?: string;
  onCommit: (v: string) => void; onCancel: () => void;
  style?: React.CSSProperties;
}
const InlineInput: React.FC<InlineInputProps> = ({ value, type = 'text', onCommit, onCancel, style }) => {
  const [v, setV] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <input
      ref={ref} className="gp-inline-inp" type={type} value={v}
      style={style}
      onChange={e => setV(e.target.value)}
      onBlur={() => onCommit(v)}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); onCommit(v); }
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      }}
    />
  );
};

// ─────────────────────────────────────────────────────────────
// COLOUR PICKER PANEL
// ─────────────────────────────────────────────────────────────
interface ColourPanelProps {
  task: GanttTask;
  onApply: (color: string, style: GanttBarStyle, labelColor?: string) => void;
  onClose: () => void;
}
const ColourPanel: React.FC<ColourPanelProps> = ({ task, onApply, onClose }) => {
  const [color, setColor]  = useState(task.color || '#e3b341');
  const [bStyle, setBStyle] = useState<GanttBarStyle>(task.style || 'solid');
  const [lblCol, setLblCol] = useState(task.labelColor || '');

  return (
    <Overlay open onClose={onClose}>
      <Panel width={420}>
        <h2 className="font-bold text-[17px] mb-4 flex items-center gap-2" style={{ fontFamily: 'Syne, sans-serif' }}>
          🎨 Colour Settings
        </h2>
        <div className="mb-3">
          <label className="block text-[10px] font-bold text-[var(--gp-text2)] uppercase tracking-wide mb-1">Bar Colour</label>
          <div className="flex gap-2 flex-wrap items-center">
            <input type="color" value={color} onChange={e => setColor(e.target.value)}
              className="w-12 h-8 cursor-pointer rounded border border-[var(--gp-border2)] bg-[var(--gp-bg)]" style={{ padding: 3 }} />
            <div className="flex gap-1 flex-wrap">
              {PRESETS.map(c => (
                <div key={c} onClick={() => setColor(c)}
                  className="w-6 h-6 rounded cursor-pointer border border-white/10"
                  style={{ background: c, outline: c === color ? '2px solid white' : 'none', outlineOffset: 2 }} />
              ))}
            </div>
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-[10px] font-bold text-[var(--gp-text2)] uppercase tracking-wide mb-1">Label Colour</label>
          <div className="flex gap-2 items-center">
            <input type="color" value={lblCol || '#ffffff'} onChange={e => setLblCol(e.target.value)}
              className="w-12 h-8 cursor-pointer rounded border border-[var(--gp-border2)] bg-[var(--gp-bg)]" style={{ padding: 3 }} />
            <span className="text-[10px] text-[var(--gp-text3)]">Leave default for auto-contrast</span>
            {lblCol && <button className="text-[10px] text-[var(--gp-text3)] underline" onClick={() => setLblCol('')}>Reset</button>}
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-[10px] font-bold text-[var(--gp-text2)] uppercase tracking-wide mb-1">Bar Style</label>
          <div className="flex gap-2">
            {(['solid', 'outline'] as GanttBarStyle[]).map(s => (
              <button key={s} onClick={() => setBStyle(s)}
                className={`px-3 py-1 rounded border text-[11px] font-medium cursor-pointer ${bStyle === s ? 'bg-[var(--gp-accent2)] border-transparent text-white' : 'border-[var(--gp-border2)] bg-[var(--gp-surface3)] text-[var(--gp-text2)]'}`}>
                {s === 'solid' ? 'Solid Fill' : 'Outline Only'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={() => onApply(color, bStyle, lblCol || undefined)}>Apply</Btn>
        </div>
      </Panel>
    </Overlay>
  );
};

// ─────────────────────────────────────────────────────────────
// RESOURCE PICKER POPUP (multi-select + add person)
// ─────────────────────────────────────────────────────────────
interface ResourcePickerProps {
  task: GanttTask;
  resources: GanttResource[];
  onUpdate: (taskId: string, resourceIds: string[]) => void;
  onAddResource: (r: GanttResource) => void;
  anchorRect: DOMRect;
  onClose: () => void;
}
const ResourcePicker: React.FC<ResourcePickerProps> = ({ task, resources, onUpdate, onAddResource, anchorRect, onClose }) => {
  const [selected, setSelected] = useState(new Set(getItemResources(task)));
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#58a6ff');
  const [newCap, setNewCap] = useState(7.5);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', handle), 100);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
    onUpdate(task.id, [...s]);
  };

  const addPerson = () => {
    const name = newName.trim();
    if (!name) return;
    if (resources.find(r => r.name.toLowerCase() === name.toLowerCase())) return;
    const r: GanttResource = { id: 'r' + Date.now(), name, color: newColor, capacity: newCap };
    onAddResource(r);
    setNewName('');
  };

  const top = Math.min(anchorRect.bottom + 6, window.innerHeight - 440);

  return (
    <div ref={ref} className="fixed z-[900] rounded-xl border shadow-2xl overflow-y-auto"
      style={{ top, left: anchorRect.left, minWidth: 220, maxHeight: 420,
        background: 'var(--gp-surface2)', borderColor: 'var(--gp-border2)' }}>
      <div className="flex items-center justify-between p-2.5 pb-0">
        <span className="text-[10px] font-bold text-[var(--gp-text3)] uppercase tracking-wide">Assign Resources</span>
        <button onClick={onClose} className="text-[var(--gp-text3)] text-base leading-none">✕</button>
      </div>
      <div className="p-2">
        {resources.map(res => (
          <label key={res.id} className="flex items-center gap-2 px-1.5 py-1.5 rounded cursor-pointer hover:bg-[var(--gp-surface3)]">
            <input type="checkbox" checked={selected.has(res.id)} onChange={() => toggle(res.id)}
              className="w-3 h-3 flex-shrink-0" style={{ accentColor: res.color }} />
            <ResAvatar res={res} size={20} />
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[12px] truncate">{res.name}</span>
              <span className="text-[9px] text-[var(--gp-text3)]">{res.capacity}h/day</span>
            </div>
          </label>
        ))}
      </div>
      <div className="border-t border-[var(--gp-border)] mx-2 my-1" />
      <div className="p-2">
        <div className="text-[10px] font-bold text-[var(--gp-text3)] uppercase tracking-wide mb-1.5">+ Add New Person</div>
        <input className="gp-inline-inp mb-1.5 w-full" placeholder="Full name…" value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addPerson()} />
        <div className="flex gap-2 items-center mb-2">
          <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
            className="w-8 h-6 rounded border border-[var(--gp-border2)] cursor-pointer" style={{ padding: 2 }} />
          <input type="number" className="gp-inline-inp" value={newCap} min={0.5} max={24} step={0.5}
            onChange={e => setNewCap(parseFloat(e.target.value) || 7.5)}
            style={{ width: 52 }} title="h/day" />
          <span className="text-[10px] text-[var(--gp-text3)]">h/day</span>
        </div>
        <Btn variant="primary" className="w-full justify-center text-[11px]" onClick={addPerson}>Add Person</Btn>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// COLUMN PICKER DROPDOWN
// ─────────────────────────────────────────────────────────────
interface ColPickerProps {
  cols: GanttColumn[];
  onToggle: (id: string, on: boolean) => void;
  onAddCustom: (label: string, dataType: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement>;
}
const ColPicker: React.FC<ColPickerProps> = ({ cols, onToggle, onAddCustom, onClose, anchorRef }) => {
  const [customName, setCustomName] = useState('');
  const [customType, setCustomType] = useState('text');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener('click', h), 100);
    return () => document.removeEventListener('click', h);
  }, [onClose, anchorRef]);

  const rect = anchorRef.current?.getBoundingClientRect();
  const style: React.CSSProperties = rect
    ? { position: 'fixed', top: rect.bottom + 6, right: window.innerWidth - rect.right }
    : {};

  return (
    <div ref={ref} className="z-[700] rounded-lg border shadow-2xl p-1.5 min-w-[220px]"
      style={{ ...style, background: 'var(--gp-surface2)', borderColor: 'var(--gp-border2)' }}>
      <div className="text-[10px] font-bold text-[var(--gp-text3)] uppercase tracking-wide px-2 py-1.5">Toggle Columns</div>
      {SYS_COLS_ALL.map(sc => {
        const col = cols.find(c => c.id === sc.id);
        const on = col ? col.visible !== false : false;
        return (
          <label key={sc.id} className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[var(--gp-surface3)] text-[12px] text-[var(--gp-text2)]">
            <input type="checkbox" checked={on} onChange={e => onToggle(sc.id, e.target.checked)}
              className="accent-[var(--gp-accent2)] w-3 h-3 cursor-pointer" />
            {sc.label}
          </label>
        );
      })}
      <div className="border-t border-[var(--gp-border)] my-1" />
      <div className="text-[10px] font-bold text-[var(--gp-text3)] uppercase tracking-wide px-2 py-1.5">Add Custom Column</div>
      <div className="flex gap-1.5 px-2 pb-2">
        <input className="gp-inline-inp flex-1" placeholder="Column name…" value={customName}
          onChange={e => setCustomName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && customName.trim() && (onAddCustom(customName.trim(), customType), setCustomName(''))} />
        <select className="gp-inline-sel" value={customType} onChange={e => setCustomType(e.target.value)}
          style={{ width: 70 }}>
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="date">Date</option>
        </select>
        <Btn variant="primary" size="xs" onClick={() => { if (customName.trim()) { onAddCustom(customName.trim(), customType); setCustomName(''); }}}>Add</Btn>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// ADD / EDIT ITEM MODAL
// ─────────────────────────────────────────────────────────────
interface AddEditPanelProps {
  task: GanttTask | null;   // null = add
  resources: GanttResource[];
  tasks: GanttTask[];
  parentId?: string | null;
  onSave: (task: GanttTask) => void;
  onClose: () => void;
}
const AddEditPanel: React.FC<AddEditPanelProps> = ({ task, resources, tasks, parentId, onSave, onClose }) => {
  const today = useMemo(() => ds(new Date()), []);
  const defEnd = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 7); return ds(d); }, []);

  const [name, setName]     = useState(task?.name ?? '');
  const [type, setType]     = useState<GanttTaskType>(task?.type ?? 'task');
  const [status, setStatus] = useState<GanttStatus>(task?.status ?? 'notstarted');
  const [prio, setPrio]     = useState<GanttPriority>(task?.priority ?? 'medium');
  const [start, setStart]   = useState(task?.start ?? today);
  const [end, setEnd]       = useState(task?.end ?? defEnd);
  const [prog, setProg]     = useState(task?.progress ?? 0);
  const [color, setColor]   = useState(task?.color ?? TYPE_COLORS['task']);
  const [bStyle, setBStyle] = useState<GanttBarStyle>(task?.style ?? 'solid');
  const [parent, setParent] = useState(task?.parent ?? parentId ?? '');
  const [resIds, setResIds] = useState<string[]>(getItemResources(task ?? {}));

  const isMil = type === 'milestone';
  const handleSave = () => {
    if (!name.trim()) return;
    const newTask: GanttTask = {
      id: task?.id ?? mkId(),
      name: name.trim(), type, status, priority: prio,
      start, end: isMil ? start : end,
      progress: isMil ? 0 : prog,
      color, style: bStyle,
      resources: resIds,
      parent: parent || null,
      custom: task?.custom ?? {},
    };
    onSave(newTask);
    onClose();
  };

  return (
    <Overlay open onClose={onClose}>
      <Panel>
        <h2 className="font-extrabold text-[17px] mb-4 flex items-center gap-2" style={{ fontFamily: 'Syne, sans-serif' }}>
          {task ? '✏️ Edit Item' : '➕ Add Item'}
        </h2>
        <div className="flex gap-2.5 mb-3">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-[var(--gp-text2)] uppercase tracking-wide mb-1">Type</label>
            <select className="w-full rounded border border-[var(--gp-border2)] bg-[var(--gp-bg)] text-[var(--gp-text)] p-1.5 text-[12px]"
              value={type} onChange={e => setType(e.target.value as GanttTaskType)}>
              {ALL_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-[var(--gp-text2)] uppercase tracking-wide mb-1">Priority</label>
            <select className="w-full rounded border border-[var(--gp-border2)] bg-[var(--gp-bg)] text-[var(--gp-text)] p-1.5 text-[12px]"
              value={prio} onChange={e => setPrio(e.target.value as GanttPriority)}>
              {ALL_PRIOS.map(p => <option key={p} value={p}>{PRIO_LABELS[p]}</option>)}
            </select>
          </div>
        </div>
        <div className="mb-3">
          <label className="block text-[10px] font-bold text-[var(--gp-text2)] uppercase tracking-wide mb-1">Name</label>
          <input className="w-full rounded border border-[var(--gp-border2)] bg-[var(--gp-bg)] text-[var(--gp-text)] p-2 text-[12px] outline-none focus:border-[var(--gp-accent2)]"
            value={name} onChange={e => setName(e.target.value)}
            placeholder="Enter name…" autoFocus />
        </div>
        <div className="flex gap-2.5 mb-3">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-[var(--gp-text2)] uppercase tracking-wide mb-1">Parent</label>
            <select className="w-full rounded border border-[var(--gp-border2)] bg-[var(--gp-bg)] text-[var(--gp-text)] p-1.5 text-[12px]"
              value={parent} onChange={e => setParent(e.target.value)}>
              <option value="">— Top Level —</option>
              {tasks.filter(t => t.id !== task?.id).map(t => (
                <option key={t.id} value={t.id}>{'\u00a0'.repeat(getDepth(t.id, tasks) * 2)}{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-[var(--gp-text2)] uppercase tracking-wide mb-1">Status</label>
            <select className="w-full rounded border border-[var(--gp-border2)] bg-[var(--gp-bg)] text-[var(--gp-text)] p-1.5 text-[12px]"
              value={status} onChange={e => setStatus(e.target.value as GanttStatus)}>
              {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
        </div>
        {!isMil && (
          <div className="flex gap-2.5 mb-3">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-[var(--gp-text2)] uppercase tracking-wide mb-1">Start Date</label>
              <input type="date" className="w-full rounded border border-[var(--gp-border2)] bg-[var(--gp-bg)] text-[var(--gp-text)] p-1.5 text-[12px] outline-none focus:border-[var(--gp-accent2)]"
                value={start} onChange={e => setStart(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-[var(--gp-text2)] uppercase tracking-wide mb-1">End Date</label>
              <input type="date" className="w-full rounded border border-[var(--gp-border2)] bg-[var(--gp-bg)] text-[var(--gp-text)] p-1.5 text-[12px] outline-none focus:border-[var(--gp-accent2)]"
                value={end} onChange={e => setEnd(e.target.value)} />
            </div>
          </div>
        )}
        {isMil && (
          <div className="mb-3">
            <label className="block text-[10px] font-bold text-[var(--gp-text2)] uppercase tracking-wide mb-1">Date</label>
            <input type="date" className="w-full rounded border border-[var(--gp-border2)] bg-[var(--gp-bg)] text-[var(--gp-text)] p-1.5 text-[12px] outline-none focus:border-[var(--gp-accent2)]"
              value={start} onChange={e => setStart(e.target.value)} />
          </div>
        )}
        {!isMil && (
          <div className="flex gap-2.5 mb-3">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-[var(--gp-text2)] uppercase tracking-wide mb-1">Progress (%)</label>
              <input type="number" min={0} max={100} className="w-full rounded border border-[var(--gp-border2)] bg-[var(--gp-bg)] text-[var(--gp-text)] p-1.5 text-[12px] outline-none focus:border-[var(--gp-accent2)]"
                value={prog} onChange={e => setProg(clamp(parseInt(e.target.value) || 0, 0, 100))} />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-[var(--gp-text2)] uppercase tracking-wide mb-1">Resource(s)</label>
              <select multiple size={3} className="w-full rounded border border-[var(--gp-border2)] bg-[var(--gp-bg)] text-[var(--gp-text)] p-1 text-[12px] outline-none focus:border-[var(--gp-accent2)]"
                value={resIds}
                onChange={e => setResIds(Array.from(e.target.selectedOptions).map(o => o.value).filter(Boolean))}>
                <option value="">— Unassigned —</option>
                {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>
        )}
        <div className="mb-3">
          <label className="block text-[10px] font-bold text-[var(--gp-text2)] uppercase tracking-wide mb-1">Bar Style</label>
          <div className="flex gap-2.5 items-center flex-wrap">
            <div className="flex gap-1">
              {(['solid', 'outline'] as GanttBarStyle[]).map(s => (
                <button key={s} onClick={() => setBStyle(s)}
                  className={`px-2.5 py-1 rounded border text-[11px] font-medium cursor-pointer ${bStyle === s ? 'bg-[var(--gp-accent2)] border-transparent text-white' : 'border-[var(--gp-border2)] bg-[var(--gp-surface3)] text-[var(--gp-text2)]'}`}>
                  {s}
                </button>
              ))}
            </div>
            <input type="color" value={color} onChange={e => setColor(e.target.value)}
              className="w-12 h-8 rounded border border-[var(--gp-border2)] bg-[var(--gp-bg)] cursor-pointer" style={{ padding: 3 }} />
            <div className="flex gap-1 flex-wrap">
              {PRESETS.map(c => (
                <div key={c} onClick={() => setColor(c)}
                  className="w-7 h-7 rounded cursor-pointer border border-white/10"
                  style={{ background: c, outline: c === color ? '2px solid white' : 'none', outlineOffset: 2 }} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4 pt-2 border-t border-[var(--gp-border)]">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSave}>Save Item</Btn>
        </div>
      </Panel>
    </Overlay>
  );
};

// ─────────────────────────────────────────────────────────────
// DEP PANEL
// ─────────────────────────────────────────────────────────────
interface DepPanelProps {
  tasks: GanttTask[]; deps: GanttDependency[];
  onChange: (deps: GanttDependency[]) => void; onClose: () => void;
}
const DepPanel: React.FC<DepPanelProps> = ({ tasks, deps, onChange, onClose }) => {
  const [from, setFrom] = useState(tasks[0]?.id ?? '');
  const [to,   setTo]   = useState(tasks[1]?.id ?? '');
  const [type, setType] = useState<GanttDepType>('FS');
  const wbs = useMemo(() => calcWBS(tasks), [tasks]);

  const add = () => {
    if (!from || !to || from === to) return;
    if (deps.find(d => d.from === from && d.to === to)) return;
    onChange([...deps, { from, to, type }]);
  };
  const remove = (idx: number) => onChange(deps.filter((_, i) => i !== idx));

  return (
    <Overlay open onClose={onClose}>
      <Panel>
        <h2 className="font-extrabold text-[17px] mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>⛓ Dependencies</h2>
        <div className="flex gap-2.5 mb-4">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-[var(--gp-text2)] uppercase tracking-wide mb-1">From</label>
            <select className="w-full rounded border border-[var(--gp-border2)] bg-[var(--gp-bg)] text-[var(--gp-text)] p-1.5 text-[12px]"
              value={from} onChange={e => setFrom(e.target.value)}>
              {tasks.filter(t => t.type !== 'milestone').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-[var(--gp-text2)] uppercase tracking-wide mb-1">→ To</label>
            <select className="w-full rounded border border-[var(--gp-border2)] bg-[var(--gp-bg)] text-[var(--gp-text)] p-1.5 text-[12px]"
              value={to} onChange={e => setTo(e.target.value)}>
              {tasks.filter(t => t.type !== 'milestone').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div style={{ maxWidth: 150 }}>
            <label className="block text-[10px] font-bold text-[var(--gp-text2)] uppercase tracking-wide mb-1">Type</label>
            <select className="w-full rounded border border-[var(--gp-border2)] bg-[var(--gp-bg)] text-[var(--gp-text)] p-1.5 text-[12px]"
              value={type} onChange={e => setType(e.target.value as GanttDepType)}>
              <option value="FS">FS — Finish→Start</option>
              <option value="SS">SS — Start→Start</option>
              <option value="FF">FF — Finish→Finish</option>
            </select>
          </div>
        </div>
        <div className="border-t border-[var(--gp-border)] pt-3">
          <div className="text-[10px] font-bold text-[var(--gp-text2)] uppercase tracking-wide mb-2">Existing</div>
          <div className="max-h-[180px] overflow-y-auto">
            {deps.length === 0 && <div className="text-[11px] text-[var(--gp-text3)]">No dependencies yet. Drag from the handle on a bar, or add above.</div>}
            {deps.map((dep, idx) => {
              const fn = tasks.find(t => t.id === dep.from)?.name ?? '?';
              const tn = tasks.find(t => t.id === dep.to)?.name ?? '?';
              const fw = wbs.get(dep.from) ?? '';
              const tw = wbs.get(dep.to)   ?? '';
              return (
                <div key={idx} className="flex items-center gap-2 mb-1.5 px-2 py-1.5 rounded border border-[var(--gp-border)] text-[11px]">
                  <span className="flex-1 text-[var(--gp-text2)]">
                    {fw && <span className="font-mono text-[10px] text-[var(--gp-text3)] mr-1">{fw}</span>}
                    {fn} <span className="text-[var(--gp-accent)]">→</span>
                    {tw && <span className="font-mono text-[10px] text-[var(--gp-text3)] mx-1">{tw}</span>}
                    {tn}
                  </span>
                  <span className="text-[var(--gp-text3)]">[{dep.type}]</span>
                  <button onClick={() => remove(idx)} className="text-[var(--gp-red)] text-base leading-none bg-transparent border-0 cursor-pointer">×</button>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <Btn onClick={onClose}>Close</Btn>
          <Btn variant="primary" onClick={add}>Add</Btn>
        </div>
      </Panel>
    </Overlay>
  );
};

// ─────────────────────────────────────────────────────────────
// VERSION PANEL
// ─────────────────────────────────────────────────────────────
interface VersionPanelProps {
  versions: GanttVersion[];
  onSave: (name: string) => void;
  onRestore: (id: string) => void;
  onClose: () => void;
}
const VersionPanel: React.FC<VersionPanelProps> = ({ versions, onSave, onRestore, onClose }) => {
  const [name, setName] = useState('');
  return (
    <Overlay open onClose={onClose}>
      <Panel>
        <h2 className="font-extrabold text-[17px] mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>📋 Versions & Snapshots</h2>
        <div className="max-h-[200px] overflow-y-auto mb-4">
          {versions.length === 0 && <div className="text-[11px] text-[var(--gp-text3)]">No saved versions yet.</div>}
          {versions.map((v, i) => (
            <div key={v.id} className={`flex items-center gap-2 px-2.5 py-2 rounded border mb-1.5 cursor-pointer ${i === versions.length - 1 ? 'border-[var(--gp-accent2)] bg-[rgba(88,166,255,.07)]' : 'border-[var(--gp-border)]'}`}>
              <span className="font-semibold text-[12px] flex-1">{v.name}</span>
              <span className="text-[10px] text-[var(--gp-text3)]">{v.date}</span>
              <Btn size="xs" onClick={() => { if (confirm('Restore this version? Current plan will be replaced.')) { onRestore(v.id); onClose(); }}}>Restore</Btn>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mb-3">
          <input className="flex-1 rounded border border-[var(--gp-border2)] bg-[var(--gp-bg)] text-[var(--gp-text)] p-1.5 text-[12px] outline-none focus:border-[var(--gp-accent2)]"
            value={name} onChange={e => setName(e.target.value)} placeholder="e.g. v1.1 – Sprint 3" />
        </div>
        <div className="flex gap-2 justify-end">
          <Btn onClick={onClose}>Close</Btn>
          <Btn variant="primary" onClick={() => { if (name.trim()) { onSave(name.trim()); setName(''); }}}>Save Snapshot</Btn>
        </div>
      </Panel>
    </Overlay>
  );
};

// ─────────────────────────────────────────────────────────────
// SCHEDULE PANEL
// ─────────────────────────────────────────────────────────────
interface SchedPanelProps {
  tasks: GanttTask[]; deps: GanttDependency[];
  onApply: () => void; onClose: () => void;
}
const SchedPanel: React.FC<SchedPanelProps> = ({ tasks, deps, onApply, onClose }) => {
  const preview = useMemo(() => {
    const changes: string[] = [];
    const visited = new Set<string>();
    function check(itemId: string) {
      if (visited.has(itemId)) return;
      visited.add(itemId);
      deps.filter(d => d.to === itemId && d.type === 'FS').forEach(dep => {
        check(dep.from);
        const pred = tasks.find(i => i.id === dep.from);
        const succ = tasks.find(i => i.id === dep.to);
        if (!pred || !succ) return;
        if (pd(succ.start) <= pd(pred.end))
          changes.push(`"${succ.name}" → moves to ${ds(new Date(pd(pred.end).getTime() + 86400000))}`);
      });
    }
    tasks.forEach(i => check(i.id));
    return changes;
  }, [tasks, deps]);

  return (
    <Overlay open onClose={onClose}>
      <Panel>
        <h2 className="font-extrabold text-[17px] mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>⚡ Schedule from Dependencies</h2>
        <p className="text-[12px] text-[var(--gp-text2)] leading-relaxed mb-3">
          Pushes tasks forward so each dependent task starts the day after its predecessor finishes (FS chains only).
          SS and FF dependencies are displayed but not rescheduled.
        </p>
        <div className="rounded-lg p-3 mb-4 text-[11px] text-[var(--gp-text2)] max-h-[160px] overflow-y-auto bg-[var(--gp-surface3)]">
          <div className="font-bold text-[var(--gp-text)] mb-1.5">Preview changes:</div>
          {preview.length === 0
            ? <div className="text-[var(--gp-green)]">✓ No conflicts — plan is already consistent with all FS dependencies.</div>
            : preview.slice(0, 8).map((p, i) => <div key={i} className="mb-1">• {p}</div>)}
          {preview.length > 8 && <div className="text-[var(--gp-text3)] mt-1">…and {preview.length - 8} more tasks</div>}
        </div>
        <div className="flex gap-2 justify-end">
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" disabled={!preview.length} onClick={() => { onApply(); onClose(); }}
            className={!preview.length ? 'opacity-50' : ''}>Apply to Entire Plan</Btn>
        </div>
      </Panel>
    </Overlay>
  );
};

// ─────────────────────────────────────────────────────────────
// RESOURCE HISTOGRAM BOTTOM PANEL
// ─────────────────────────────────────────────────────────────
interface ResHistogramProps {
  resources: GanttResource[]; tasks: GanttTask[];
  view: GanttView; viewStart: Date; viewEnd: Date;
  height: number;
  onResize: (h: number) => void; onClose: () => void;
}
const ResHistogram: React.FC<ResHistogramProps> = ({ resources, tasks, view, viewStart, viewEnd, height, onResize, onClose }) => {
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const periods = useMemo<HistogramPeriod[]>(() => {
    const ps: HistogramPeriod[] = [];
    if (view === 'day') {
      let c = new Date(viewStart);
      while (c <= viewEnd) { ps.push({ label: c.getDate() + '/' + String(c.getMonth() + 1).padStart(2,'0'), start: new Date(c), end: new Date(c) }); c.setDate(c.getDate() + 1); }
    } else if (view === 'week') {
      let c = new Date(viewStart); while (c.getDay() !== 1) c.setDate(c.getDate() - 1);
      while (c <= viewEnd) {
        const we = new Date(c); we.setDate(we.getDate() + 6);
        ps.push({ label: 'W' + getWN(c), start: new Date(c), end: new Date(we) });
        c.setDate(c.getDate() + 7);
      }
    } else if (view === 'month') {
      let c = new Date(viewStart.getFullYear(), viewStart.getMonth(), 1);
      while (c <= viewEnd) {
        const me = new Date(c.getFullYear(), c.getMonth() + 1, 0);
        ps.push({ label: c.toLocaleDateString('en-GB', { month: 'short' }), start: new Date(c), end: new Date(me) });
        c.setMonth(c.getMonth() + 1);
      }
    } else {
      let c = new Date(viewStart.getFullYear(), 0, 1);
      while (c <= viewEnd) {
        ps.push({ label: c.getFullYear() + '', start: new Date(c), end: new Date(c.getFullYear(), 11, 31) });
        c.setFullYear(c.getFullYear() + 1);
      }
    }
    return ps;
  }, [view, viewStart, viewEnd]);

  const cellW = Math.max(32, Math.min(70, 80));

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startH: height };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      onResize(Math.max(120, Math.min(400, dragRef.current.startH - (ev.clientY - dragRef.current.startY))));
    };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div className="border-t border-[var(--gp-border)] bg-[var(--gp-surface)] flex flex-col flex-shrink-0"
      style={{ height }}>
      {/* Drag handle */}
      <div className="h-1.5 cursor-row-resize bg-[var(--gp-border)] hover:bg-[var(--gp-accent2)] flex-shrink-0"
        onMouseDown={startDrag} />
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--gp-border)] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[13px]" style={{ fontFamily: 'Syne, sans-serif' }}>👥 Resource Capacity</span>
          <span className="text-[10px] text-[var(--gp-text3)]">({view} view · {periods.length} periods)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-[10px] text-[var(--gp-text2)]">
            <span className="inline-block w-2 h-2 rounded-sm bg-[var(--gp-green)]" /> OK
            <span className="inline-block w-2 h-2 rounded-sm bg-[var(--gp-yellow)] ml-1" /> &gt;80%
            <span className="inline-block w-2 h-2 rounded-sm bg-[var(--gp-red)] ml-1" /> Over
          </div>
          <button onClick={onClose} className="text-[var(--gp-text3)] hover:text-[var(--gp-text)] text-base leading-none">✕</button>
        </div>
      </div>
      {/* Grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* Name col */}
        <div className="flex flex-col flex-shrink-0 border-r border-[var(--gp-border)]" style={{ minWidth: 120 }}>
          <div className="h-8 flex items-center px-2.5 text-[10px] font-bold text-[var(--gp-text3)] uppercase tracking-wide border-b border-[var(--gp-border)]">
            Resource
          </div>
          {resources.map(res => (
            <div key={res.id} className="h-8 flex items-center gap-1.5 px-2.5 border-b border-[var(--gp-border)]">
              <ResAvatar res={res} size={16} />
              <span className="text-[11px] overflow-hidden text-ellipsis whitespace-nowrap">{res.name.split(' ')[0]}</span>
            </div>
          ))}
        </div>
        {/* Scroll area */}
        <div className="flex-1 overflow-x-auto gp-scrollbar6">
          {/* Period headers */}
          <div className="flex border-b border-[var(--gp-border)] h-8">
            {periods.map(p => (
              <div key={p.label} className="rh-cell h-8 text-[10px] font-bold text-[var(--gp-text3)]"
                style={{ width: cellW }}>{p.label}</div>
            ))}
          </div>
          {/* Data rows */}
          {resources.map(res => {
            const capHrs = res.capacity || 7.5;
            return (
              <div key={res.id} className="flex h-8 border-b border-[var(--gp-border)]">
                {periods.map(p => {
                  const asgn = tasks.filter(i => {
                    if (i.type === 'milestone') return false;
                    if (!getItemResources(i).includes(res.id)) return false;
                    return pd(i.start) <= p.end && pd(i.end) >= p.start;
                  });
                  const periodDays = Math.max(1, dBetween(p.start, p.end) + 1);
                  let totalHrs = 0;
                  asgn.forEach(i => {
                    const os = pd(i.start) > p.start ? pd(i.start) : p.start;
                    const oe = pd(i.end)   < p.end   ? pd(i.end)   : p.end;
                    totalHrs += Math.max(1, dBetween(os, oe) + 1) * capHrs;
                  });
                  const capTotal = periodDays * capHrs;
                  const pct = capTotal > 0 ? Math.round((totalHrs / capTotal) * 100) : 0;
                  const cls = pct === 0 ? 'rh-empty' : pct > 100 ? 'rh-over' : pct > 80 ? 'rh-warn' : 'rh-ok';
                  const barBg = pct > 100 ? 'var(--gp-red)' : pct > 80 ? 'var(--gp-yellow)' : 'var(--gp-green)';
                  return (
                    <div key={p.label} className={`rh-cell h-8 ${cls}`} style={{ width: cellW }}
                      title={`${res.name} · ${p.label}\n${asgn.length} task(s) · ${Math.round(totalHrs)}h alloc · ${Math.round(capTotal)}h cap (${pct}%)`}>
                      {pct > 0 && (
                        <>
                          <div className="rh-bar" style={{ height: Math.min(100, pct) * 0.7 + '%', background: barBg, opacity: .35 }} />
                          {pct + '%'}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// RESOURCE SIDE PANEL
// ─────────────────────────────────────────────────────────────
interface ResSidePanelProps {
  resources: GanttResource[]; tasks: GanttTask[];
  open: boolean; onClose: () => void;
}
const ResSidePanel: React.FC<ResSidePanelProps> = ({ resources, tasks, open, onClose }) => (
  <div className={`fixed right-0 top-[52px] bottom-0 w-[300px] border-l flex flex-col overflow-hidden z-[100] transition-transform duration-[220ms]
    bg-[var(--gp-surface)] border-[var(--gp-border)] ${open ? 'translate-x-0' : 'translate-x-full'}`}>
    <div className="flex items-center justify-between px-3.5 py-3 border-b border-[var(--gp-border)]">
      <h3 className="font-bold text-[14px]" style={{ fontFamily: 'Syne, sans-serif' }}>👥 Resources</h3>
      <button onClick={onClose} className="text-[var(--gp-text3)] hover:text-[var(--gp-text)]">✕</button>
    </div>
    <div className="flex-1 overflow-y-auto p-2.5 gp-scrollbar">
      {resources.map(res => {
        const asgn = tasks.filter(i => getItemResources(i).includes(res.id) && i.type !== 'milestone');
        const totalDays = asgn.reduce((s, i) => s + Math.max(1, dBetween(pd(i.start), pd(i.end))), 0);
        const capHrs = res.capacity || 7.5;
        const allocHrs = totalDays * capHrs;
        const capTotal = capHrs * 30;
        const load = Math.min(200, Math.round((allocHrs / capTotal) * 100));
        const isOver = load > 100, isWarn = load > 80 && !isOver;
        const col = isOver ? 'var(--gp-red)' : isWarn ? 'var(--gp-yellow)' : 'var(--gp-green)';
        const init = res.name.split(' ').map(n => n[0]).join('');
        return (
          <div key={res.id} className="rounded-lg border p-2.5 mb-2 bg-[var(--gp-surface2)] border-[var(--gp-border)]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                style={{ background: res.color }}>{init}</div>
              <div className="flex-1">
                <div className="font-semibold text-[12px]">{res.name}</div>
                <div className="text-[10px] text-[var(--gp-text3)]">{asgn.length} task{asgn.length !== 1 ? 's' : ''} · {totalDays}d allocated</div>
              </div>
              {isOver && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[rgba(248,81,73,.2)] text-[var(--gp-red)]">⚠ Over</span>}
            </div>
            <div className="gp-cap-bar-w">
              <div className="gp-cap-bar" style={{ width: Math.min(100, load) + '%', background: col }} />
            </div>
            <div className="flex justify-between text-[10px] text-[var(--gp-text2)] mt-1">
              <span>{capHrs}h/day capacity</span>
              <span style={{ color: col }}>{load}%</span>
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// CHART HEADER (date columns)
// ─────────────────────────────────────────────────────────────
interface ChartHeaderProps {
  view: GanttView; cw: number; viewStart: Date; viewEnd: Date; today: Date;
  scrollLeft: number;
}
const ChartHeader: React.FC<ChartHeaderProps> = ({ view, cw, viewStart, viewEnd, today }) => {
  const rows = useMemo(() => {
    const top: Array<{ label: string; w: number }> = [];
    const bot: Array<{ label: string; sub?: string; w: number; isToday?: boolean; isWe?: boolean }> = [];

    if (view === 'day') {
      let cur = new Date(viewStart), curM = -1, mW = 0, mIdx = -1;
      while (cur <= viewEnd) {
        if (cur.getMonth() !== curM) {
          if (mIdx >= 0 && top[mIdx]) top[mIdx].w = mW;
          top.push({ label: cur.toLocaleDateString('en', { month: 'long', year: 'numeric' }), w: 0 });
          mIdx = top.length - 1; curM = cur.getMonth(); mW = 0;
        }
        mW += cw;
        const we = cur.getDay() === 0 || cur.getDay() === 6;
        const isTd = cur.getTime() === today.getTime();
        bot.push({ label: String(cur.getDate()), sub: cur.toLocaleDateString('en', { weekday: 'short' }).slice(0, 2), w: cw, isToday: isTd, isWe: we });
        cur.setDate(cur.getDate() + 1);
      }
      if (mIdx >= 0 && top[mIdx]) top[mIdx].w = mW;
    } else if (view === 'week') {
      let cur = new Date(viewStart); while (cur.getDay() !== 1) cur.setDate(cur.getDate() - 1);
      let curM = -1, mW = 0, mIdx = -1;
      while (cur <= viewEnd) {
        if (cur.getMonth() !== curM) {
          if (mIdx >= 0 && top[mIdx]) top[mIdx].w = mW;
          top.push({ label: cur.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }), w: 0 });
          mIdx = top.length - 1; curM = cur.getMonth(); mW = 0;
        }
        mW += cw;
        const wn = getWN(cur);
        bot.push({ label: 'W' + wn, sub: cur.getDate() + ' ' + cur.toLocaleDateString('en-GB', { month: 'short' }), w: cw });
        cur.setDate(cur.getDate() + 7);
      }
      if (mIdx >= 0 && top[mIdx]) top[mIdx].w = mW;
    } else if (view === 'month') {
      let cur = new Date(viewStart.getFullYear(), viewStart.getMonth(), 1);
      let curY = -1, yW = 0, yIdx = -1;
      while (cur <= viewEnd) {
        if (cur.getFullYear() !== curY) {
          if (yIdx >= 0 && top[yIdx]) top[yIdx].w = yW;
          top.push({ label: String(cur.getFullYear()), w: 0 });
          yIdx = top.length - 1; curY = cur.getFullYear(); yW = 0;
        }
        yW += cw;
        bot.push({ label: cur.toLocaleDateString('en', { month: 'short' }), w: cw });
        cur.setMonth(cur.getMonth() + 1);
      }
      if (yIdx >= 0 && top[yIdx]) top[yIdx].w = yW;
    } else {
      let cur = new Date(viewStart.getFullYear(), 0, 1);
      while (cur <= viewEnd) {
        top.push({ label: String(cur.getFullYear()), w: cw });
        bot.push({ label: String(cur.getFullYear()), w: cw });
        cur.setFullYear(cur.getFullYear() + 1);
      }
    }
    return { top, bot };
  }, [view, cw, viewStart, viewEnd, today]);

  return (
    <div className="flex flex-col" style={{ height: HDR_H }}>
      <div className="flex items-center h-10 border-b border-[var(--gp-border)]">
        {rows.top.map((cell, i) => (
          <div key={i} className="flex items-center px-2.5 font-bold text-[12px] text-[var(--gp-text)] border-r border-[var(--gp-border)] flex-shrink-0 whitespace-nowrap h-full"
            style={{ width: cell.w, fontFamily: 'Syne, sans-serif' }}>{cell.label}</div>
        ))}
      </div>
      <div className="flex items-center h-12">
        {rows.bot.map((cell, i) => (
          <div key={i} className={`flex flex-col items-center justify-center gap-px border-r border-[var(--gp-border)] flex-shrink-0 h-full
            ${cell.isToday ? 'bg-[rgba(88,166,255,.06)]' : ''} ${cell.isWe ? 'opacity-50' : ''}`}
            style={{ width: cell.w }}>
            <span className="font-bold text-[13px] text-[var(--gp-text)]" style={{ fontFamily: 'Syne, sans-serif' }}>{cell.label}</span>
            {cell.sub && <span className="text-[9px] font-semibold text-[var(--gp-text3)] uppercase tracking-wide">{cell.sub}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// SVG DEPENDENCY LINES
// ─────────────────────────────────────────────────────────────
function orthogonalPath(x1: number, y1: number, x2: number, y2: number, type: GanttDepType): string {
  const arm = 18;
  x1 = Math.round(x1); y1 = Math.round(y1); x2 = Math.round(x2); y2 = Math.round(y2);
  if (y1 === y2 && type === 'FS') {
    if (x2 > x1) return `M${x1},${y1} L${x2},${y2}`;
    const bypass = Math.round(y1 + 24), out = x1 + arm, inn = x2 - arm;
    return `M${x1},${y1} L${out},${y1} L${out},${bypass} L${inn},${bypass} L${inn},${y2} L${x2},${y2}`;
  }
  if (y1 === y2) return `M${x1},${y1} L${x2},${y2}`;
  let ex: number, nx: number;
  if (type === 'SS') { const lx = Math.min(x1, x2) - arm; ex = lx; nx = lx; }
  else if (type === 'FF') { const rx = Math.max(x1, x2) + arm; ex = rx; nx = rx; }
  else { ex = x1 + arm; nx = x2 - arm; if (nx < ex) { ex = Math.max(x1, x2) + arm; nx = x2 - arm; } }
  ex = Math.round(ex); nx = Math.round(nx);
  const midY = Math.round((y1 + y2) / 2);
  if (Math.abs(ex - nx) < 4) return `M${x1},${y1} L${ex},${y1} L${ex},${y2} L${x2},${y2}`;
  return `M${x1},${y1} L${ex},${y1} L${ex},${midY} L${nx},${midY} L${nx},${y2} L${x2},${y2}`;
}

interface DepLinesProps {
  deps: GanttDependency[]; tasks: GanttTask[];
  visibleIds: string[]; idxMap: Map<string, number>;
  dateToX: (d: string | Date) => number; cw: number;
  totalW: number; totalH: number;
  onRemove: (idx: number) => void;
  drawingDep: { fromId: string; x: number; y: number } | null;
}
const DepLines: React.FC<DepLinesProps> = ({ deps, tasks, visibleIds, idxMap, dateToX, cw, totalW, totalH, onRemove, drawingDep }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <svg className="gp-dep-svg absolute top-0 left-0 overflow-visible pointer-events-none z-[3]"
      width={totalW} height={totalH}>
      <defs>
        <marker id="dep-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 Z" fill="var(--gp-accent)" />
        </marker>
        <marker id="dep-arrow-dim" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 Z" fill="#484f58" />
        </marker>
      </defs>
      {deps.map((dep, idx) => {
        const fi = idxMap.get(dep.from), ti = idxMap.get(dep.to);
        if (fi === undefined || ti === undefined) return null;
        const fromTask = tasks.find(t => t.id === dep.from), toTask = tasks.find(t => t.id === dep.to);
        if (!fromTask || !toTask) return null;
        if (!visibleIds.includes(dep.from) || !visibleIds.includes(dep.to)) return null;
        let x1: number, y1: number, x2: number, y2: number;
        if (dep.type === 'FS') { x1 = dateToX(fromTask.end) + cw; y1 = fi * ROW_H + 18; x2 = dateToX(toTask.start); y2 = ti * ROW_H + 18; }
        else if (dep.type === 'SS') { x1 = dateToX(fromTask.start); y1 = fi * ROW_H + 18; x2 = dateToX(toTask.start); y2 = ti * ROW_H + 18; }
        else { x1 = dateToX(fromTask.end) + cw; y1 = fi * ROW_H + 18; x2 = dateToX(toTask.end) + cw; y2 = ti * ROW_H + 18; }
        const d = orthogonalPath(x1, y1, x2, y2, dep.type);
        const hl = hoveredIdx === idx;
        return (
          <path key={idx} d={d}
            className="gp-dep-line"
            style={{ stroke: hl ? 'var(--gp-accent)' : '#484f58', strokeWidth: hl ? 2 : 1.5, pointerEvents: 'stroke', cursor: 'pointer' }}
            markerEnd={hl ? 'url(#dep-arrow)' : 'url(#dep-arrow-dim)'}
            onMouseEnter={() => setHoveredIdx(idx)} onMouseLeave={() => setHoveredIdx(null)}
            onClick={() => {
              if (confirm(`Remove dependency: ${fromTask.name} → ${toTask.name}?`)) onRemove(idx);
            }}
          />
        );
      })}
      {drawingDep && (
        <path d={`M${Math.round(drawingDep.x)},${Math.round(drawingDep.y - 0)} L${Math.round(drawingDep.x)},${Math.round(drawingDep.y)}`}
          className="gp-dep-drawing" />
      )}
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────
// CONTEXT MENU
// ─────────────────────────────────────────────────────────────
interface CtxMenuProps {
  pos: { x: number; y: number }; id: string;
  onEdit: () => void; onAddChild: () => void; onColour: () => void;
  onDup: () => void; onMoveUp: () => void; onMoveDown: () => void; onDelete: () => void;
  onClose: () => void;
}
const CtxMenu: React.FC<CtxMenuProps> = ({ pos, onEdit, onAddChild, onColour, onDup, onMoveUp, onMoveDown, onDelete, onClose }) => {
  useEffect(() => {
    const h = () => onClose();
    setTimeout(() => document.addEventListener('click', h), 50);
    return () => document.removeEventListener('click', h);
  }, [onClose]);

  const items = [
    { label: '✏️ Edit', action: onEdit },
    { label: '➕ Add Child', action: onAddChild },
    { label: '🎨 Colour / Style', action: onColour },
    null,
    { label: '⧉ Duplicate', action: onDup },
    { label: '⬆ Move Up', action: onMoveUp },
    { label: '⬇ Move Down', action: onMoveDown },
    null,
    { label: '🗑 Delete', action: onDelete, danger: true },
  ];

  return (
    <div className="fixed rounded-lg border shadow-2xl p-1 z-[600] min-w-[160px]"
      style={{ left: pos.x, top: pos.y, background: 'var(--gp-surface2)', borderColor: 'var(--gp-border2)' }}
      onClick={e => e.stopPropagation()}>
      {items.map((item, i) =>
        item === null
          ? <div key={i} className="h-px my-0.5 bg-[var(--gp-border)]" />
          : <div key={i} onClick={item.action}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded cursor-pointer text-[11px] hover:bg-[var(--gp-surface3)]
                ${item.danger ? 'text-[var(--gp-red)]' : 'text-[var(--gp-text2)] hover:text-[var(--gp-text)]'}`}>
              {item.label}
            </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// GRID HEADER ROW
// ─────────────────────────────────────────────────────────────
interface GridHeaderProps {
  cols: GanttColumn[];
  onResizeCol: (id: string, newW: number) => void;
  onOpenColPicker: (e: React.MouseEvent) => void;
  colPickerRef: React.RefObject<HTMLButtonElement>;
}
const GridHeader: React.FC<GridHeaderProps> = ({ cols, onResizeCol, onOpenColPicker, colPickerRef }) => {
  const activeCols = cols.filter(c => c.visible !== false);
  const dragRef = useRef<{ colId: string; startX: number; startW: number } | null>(null);

  const startColResize = (colId: string, startW: number, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragRef.current = { colId, startX: e.clientX, startW };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      onResizeCol(dragRef.current.colId, dragRef.current.startW + ev.clientX - dragRef.current.startX);
    };
    const onUp = () => { dragRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div className="flex items-stretch h-full">
      {activeCols.map(col => (
        <div key={col.id}
          className="relative border-r border-[var(--gp-border)] flex items-end px-2 pb-2 text-[10px] font-bold text-[var(--gp-text3)] uppercase tracking-wider flex-shrink-0 select-none whitespace-nowrap overflow-visible"
          style={{ width: col.w }}>
          {col.custom
            ? <span className="text-[var(--gp-purple)]">{col.label}</span>
            : col.label}
          <div className="gp-col-grip" onMouseDown={e => startColResize(col.id, col.w, e)} />
        </div>
      ))}
      <div className="flex items-end pb-2 px-1 min-w-[36px]">
        <button ref={colPickerRef} onClick={onOpenColPicker}
          className="w-5 h-5 rounded border border-[var(--gp-border2)] bg-[var(--gp-surface3)] text-[var(--gp-text3)] flex items-center justify-center text-[10px] hover:bg-[var(--gp-accent2)] hover:text-white hover:border-transparent cursor-pointer">
          +
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// GRID ROW (read-only display mode)
// ─────────────────────────────────────────────────────────────
interface GridRowProps {
  item: GanttTask & { depth: number; visible: boolean };
  cols: GanttColumn[]; wbs: Map<string, string>;
  resources: GanttResource[]; tasks: GanttTask[]; deps: GanttDependency[];
  selected: boolean; hasKids: boolean; isCollapsed: boolean;
  onSelect: () => void; onToggleCollapse: () => void;
  onCtx: (e: React.MouseEvent) => void;
  onInlineEdit: () => void; onAddChild: () => void; onColour: () => void;
  onTaskUpdate: (t: GanttTask) => void;
  onResPickerOpen: (id: string, rect: DOMRect) => void;
  onDepPickerOpen: (id: string) => void;
}
const GridRow: React.FC<GridRowProps> = ({
  item, cols, wbs, resources, tasks, deps,
  selected, hasKids, isCollapsed,
  onSelect, onToggleCollapse, onCtx, onInlineEdit, onAddChild, onColour,
  onTaskUpdate, onResPickerOpen, onDepPickerOpen,
}) => {
  const activeCols = cols.filter(c => c.visible !== false);
  const isBold = ['project','release','phase','workstream'].includes(item.type);
  const wbsCode = wbs.get(item.id) ?? '';

  const [editingCell, setEditingCell] = useState<string | null>(null);

  if (!item.visible) return null;

  return (
    <div
      className={`flex items-center border-b border-[var(--gp-border)] cursor-pointer relative
        hover:bg-[var(--gp-surface2)] ${selected ? 'bg-[rgba(88,166,255,.07)]' : ''}`}
      style={{ height: ROW_H }}
      onClick={onSelect}
      onContextMenu={e => { e.preventDefault(); onCtx(e); }}
    >
      {activeCols.map(col => {
        const isEditing = editingCell === col.id;

        return (
          <div key={col.id}
            className="flex items-center px-1.5 flex-shrink-0 overflow-hidden border-r border-[var(--gp-border)] h-full"
            style={{ width: col.w }}>

            {col.id === 'name' && (
              <div className="flex items-center gap-1 w-full overflow-hidden">
                <span className="flex-shrink-0" style={{ width: item.depth * 14 }} />
                <span className={`w-3 h-3 flex-shrink-0 flex items-center justify-center text-[var(--gp-text3)] cursor-pointer
                  ${hasKids ? 'opacity-100' : 'opacity-0 pointer-events-none'}
                  ${!isCollapsed && hasKids ? 'rotate-90' : ''}`}
                  style={{ transition: 'transform .13s' }}
                  onClick={e => { e.stopPropagation(); if (hasKids) onToggleCollapse(); }}>
                  <svg width="7" height="7" viewBox="0 0 8 8"><path d="M2 1l4 3-4 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: item.color || TYPE_COLORS[item.type] }} />
                <span className={`overflow-hidden text-ellipsis whitespace-nowrap flex-1 text-[12px] ${isBold ? 'font-semibold text-[var(--gp-text)]' : 'text-[var(--gp-text2)]'}`}
                  title={item.name}
                  onDoubleClick={e => { e.stopPropagation(); onInlineEdit(); }}>
                  {item.name}
                </span>
                {/* Row action buttons (show on hover) */}
                <div className="row-actions hidden gap-0.5 ml-0.5">
                  <button className="w-[18px] h-[18px] rounded bg-transparent border-none text-[var(--gp-text3)] flex items-center justify-center cursor-pointer hover:bg-[var(--gp-surface3)] hover:text-[var(--gp-text)]"
                    title="Edit" onClick={e => { e.stopPropagation(); onInlineEdit(); }}>
                    <svg width="9" height="9" viewBox="0 0 9 9"><path d="M6 1l2 2-5 5H1V6l5-5z" fill="none" stroke="currentColor" strokeWidth="1.1"/></svg>
                  </button>
                  <button className="w-[18px] h-[18px] rounded bg-transparent border-none text-[var(--gp-text3)] flex items-center justify-center cursor-pointer hover:bg-[var(--gp-surface3)] hover:text-[var(--gp-text)]"
                    title="Add child" onClick={e => { e.stopPropagation(); onAddChild(); }}>
                    <svg width="9" height="9" viewBox="0 0 9 9"><path d="M4.5 1v7M1 4.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </button>
                  <button className="w-[18px] h-[18px] rounded bg-transparent border-none text-[var(--gp-text3)] flex items-center justify-center cursor-pointer hover:bg-[var(--gp-surface3)] hover:text-[var(--gp-text)]"
                    title="Colour & Style" onClick={e => { e.stopPropagation(); onColour(); }}>
                    🎨
                  </button>
                </div>
              </div>
            )}

            {col.id === 'wbs' && (
              <span className="text-[10px] font-semibold text-[var(--gp-text3)] font-mono whitespace-nowrap overflow-hidden text-ellipsis w-full" title={wbsCode}>
                {wbsCode}
              </span>
            )}

            {col.id === 'type' && (
              isEditing
                ? <select className="gp-inline-sel" style={{ width: col.w - 14 }}
                    defaultValue={item.type}
                    autoFocus
                    onBlur={e => { onTaskUpdate({ ...item, type: e.target.value as GanttTaskType }); setEditingCell(null); }}
                    onChange={e => { onTaskUpdate({ ...item, type: e.target.value as GanttTaskType }); setEditingCell(null); }}
                    onClick={e => e.stopPropagation()}>
                    {ALL_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                : <span className="gp-badge cursor-pointer"
                    style={{ background: TYPE_COLORS[item.type] + '22', color: TYPE_COLORS[item.type], border: `1px solid ${TYPE_COLORS[item.type]}55`, fontSize: 10 }}
                    title="Click to change type"
                    onClick={e => { e.stopPropagation(); setEditingCell('type'); }}>
                    {TYPE_SHORT[item.type]}
                  </span>
            )}

            {col.id === 'dur' && item.type !== 'milestone' && (
              isEditing
                ? <InlineInput value={durLabel(durFromDates(item))} style={{ width: 52, fontSize: 10 }}
                    onCommit={v => {
                      const parsed = parseDur(v);
                      if (parsed !== null && parsed >= 0) {
                        const updated = { ...item, end: endFromDur(item.start, parsed) };
                        if (parsed < 1) updated.durDays = parsed; else delete (updated as GanttTask).durDays;
                        onTaskUpdate(updated);
                      }
                      setEditingCell(null);
                    }}
                    onCancel={() => setEditingCell(null)} />
                : <span className="text-[11px] text-[var(--gp-text2)] w-full cursor-text"
                    title="Click to edit duration (e.g. 5d, 0.5d, 6h)"
                    onClick={e => { e.stopPropagation(); setEditingCell('dur'); }}>
                    {durLabel(durFromDates(item))}
                  </span>
            )}

            {col.id === 'start' && (
              isEditing
                ? <InlineInput value={item.start} type="date" style={{ fontSize: 10 }}
                    onCommit={v => {
                      if (v) {
                        const dur = durFromDates(item);
                        onTaskUpdate({ ...item, start: v, end: item.type !== 'milestone' ? endFromDur(v, item.durDays ?? dur) : v });
                      }
                      setEditingCell(null);
                    }}
                    onCancel={() => setEditingCell(null)} />
                : <span className="text-[11px] text-[var(--gp-text2)] w-full cursor-text"
                    title="Double-click to edit" onDoubleClick={e => { e.stopPropagation(); setEditingCell('start'); }}>
                    {item.start}
                  </span>
            )}

            {col.id === 'end' && item.type !== 'milestone' && (
              isEditing
                ? <InlineInput value={item.end} type="date" style={{ fontSize: 10 }}
                    onCommit={v => { if (v) { const u = { ...item, end: v }; delete (u as GanttTask).durDays; onTaskUpdate(u); } setEditingCell(null); }}
                    onCancel={() => setEditingCell(null)} />
                : <span className="text-[11px] text-[var(--gp-text2)] w-full cursor-text"
                    title="Double-click to edit" onDoubleClick={e => { e.stopPropagation(); setEditingCell('end'); }}>
                    {item.end}
                  </span>
            )}

            {col.id === 'resource' && (
              <div className="flex items-center gap-1 flex-wrap cursor-pointer w-full" title="Click to assign resources"
                onClick={e => {
                  e.stopPropagation();
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  onResPickerOpen(item.id, rect);
                }}>
                {getItemResources(item).map(rid => {
                  const res = resources.find(r => r.id === rid);
                  return res ? <ResAvatar key={rid} res={res} size={18} /> : null;
                })}
                {getItemResources(item).length > 1 &&
                  <span className="text-[9px] text-[var(--gp-text3)]">{getItemResources(item).length}</span>}
                {getItemResources(item).length === 0 &&
                  <span className="text-[10px] text-[var(--gp-text3)]">—</span>}
              </div>
            )}

            {col.id === 'progress' && item.type !== 'milestone' && (
              isEditing
                ? <InlineInput value={String(item.progress ?? 0)} type="number" style={{ width: 52 }}
                    onCommit={v => { onTaskUpdate({ ...item, progress: clamp(parseInt(v) || 0, 0, 100) }); setEditingCell(null); }}
                    onCancel={() => setEditingCell(null)} />
                : <ProgressBar pct={item.progress ?? 0}
                    onClick={e => { (e as any).stopPropagation(); setEditingCell('progress'); }} />
            )}

            {col.id === 'status' && (
              isEditing
                ? <select className="gp-inline-sel" style={{ width: 92 }}
                    defaultValue={item.status} autoFocus
                    onBlur={e => { onTaskUpdate({ ...item, status: e.target.value as GanttStatus }); setEditingCell(null); }}
                    onChange={e => { onTaskUpdate({ ...item, status: e.target.value as GanttStatus }); setEditingCell(null); }}
                    onClick={e => e.stopPropagation()}>
                    {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                : <Badge cls={`gp-status-${item.status} cursor-pointer`}
                    onClick={e => { (e as any).stopPropagation(); setEditingCell('status'); }}>
                    {STATUS_LABELS[item.status]}
                  </Badge>
            )}

            {col.id === 'priority' && (
              isEditing
                ? <select className="gp-inline-sel" style={{ width: 70 }}
                    defaultValue={item.priority} autoFocus
                    onBlur={e => { onTaskUpdate({ ...item, priority: e.target.value as GanttPriority }); setEditingCell(null); }}
                    onChange={e => { onTaskUpdate({ ...item, priority: e.target.value as GanttPriority }); setEditingCell(null); }}
                    onClick={e => e.stopPropagation()}>
                    {ALL_PRIOS.map(p => <option key={p} value={p}>{PRIO_LABELS[p]}</option>)}
                  </select>
                : <Badge cls={`gp-prio-${item.priority} cursor-pointer`}
                    onClick={e => { (e as any).stopPropagation(); setEditingCell('priority'); }}>
                    {PRIO_LABELS[item.priority]}
                  </Badge>
            )}

            {col.id === 'deps' && (
              <div className="flex flex-col gap-0.5 w-full overflow-hidden" onClick={e => e.stopPropagation()}>
                {deps.filter(d => d.from === item.id || d.to === item.id).map((dep, i) => {
                  const isFrom = dep.from === item.id;
                  const other = tasks.find(t => t.id === (isFrom ? dep.to : dep.from));
                  if (!other) return null;
                  const otherWbs = wbs.get(other.id) ?? '';
                  return (
                    <div key={i} className="flex items-center gap-1 text-[10px] cursor-pointer"
                      title={`${dep.type}: click to remove`}
                      onClick={() => { /* handled via dep panel */ }}>
                      <span className="text-[9px] font-bold px-1 rounded-sm"
                        style={{ background: (TYPE_COLORS[other.type] ?? '#484f58') + '22', color: TYPE_COLORS[other.type] ?? '#8b949e' }}>
                        {dep.type}
                      </span>
                      <span className="text-[var(--gp-text2)] overflow-hidden text-ellipsis whitespace-nowrap font-mono">
                        {isFrom ? '→' : '←'}{otherWbs || other.name}
                      </span>
                    </div>
                  );
                })}
                <button className="text-[10px] text-[var(--gp-text3)] bg-transparent border-none cursor-pointer text-left flex items-center gap-1 p-0"
                  onClick={e => { e.stopPropagation(); onDepPickerOpen(item.id); }}>
                  <svg width="8" height="8" viewBox="0 0 8 8"><path d="M4 1v6M1 4h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg> add
                </button>
              </div>
            )}

            {col.custom && (
              isEditing
                ? <InlineInput value={item.custom?.[col.id] ?? ''}
                    onCommit={v => { onTaskUpdate({ ...item, custom: { ...(item.custom ?? {}), [col.id]: v } }); setEditingCell(null); }}
                    onCancel={() => setEditingCell(null)} />
                : <span className="text-[11px] text-[var(--gp-text2)] overflow-hidden text-ellipsis whitespace-nowrap flex-1 cursor-text"
                    onDoubleClick={e => { e.stopPropagation(); setEditingCell(col.id); }}>
                    {item.custom?.[col.id] ?? ''}
                  </span>
            )}

          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// INLINE NEW / EDIT ROW
// ─────────────────────────────────────────────────────────────
interface InlineRowProps {
  item: GanttTask | null; // null = new
  cols: GanttColumn[]; tasks: GanttTask[]; resources: GanttResource[];
  parentId: string | null; depth: number;
  onCommit: (t: GanttTask) => void; onCancel: () => void;
}
const InlineRow: React.FC<InlineRowProps> = ({ item, cols, tasks, resources, parentId, depth, onCommit, onCancel }) => {
  const today = ds(new Date());
  const defEnd = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 7); return ds(d); }, []);

  const [name, setName] = useState(item?.name ?? '');
  const [type, setType] = useState<GanttTaskType>(item?.type ?? 'task');
  const [start, setStart] = useState(item?.start ?? today);
  const [end, setEnd]     = useState(item?.end ?? defEnd);
  const [prog, setProg]   = useState(item?.progress ?? 0);
  const [status, setStatus] = useState<GanttStatus>(item?.status ?? 'notstarted');
  const [prio, setPrio]   = useState<GanttPriority>(item?.priority ?? 'medium');
  const [resId, setResId] = useState(getItemResources(item ?? {})[0] ?? '');

  const activeCols = cols.filter(c => c.visible !== false);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  const commit = () => {
    if (!name.trim()) { nameRef.current?.focus(); return; }
    const t: GanttTask = {
      id: item?.id ?? mkId(), name: name.trim(), type, start,
      end: type === 'milestone' ? start : end,
      progress: type === 'milestone' ? 0 : prog,
      status, priority: prio, color: item?.color ?? TYPE_COLORS[type],
      style: item?.style ?? 'solid',
      resources: resId ? [resId] : [],
      parent: item?.parent ?? parentId ?? null,
      custom: item?.custom ?? {},
    };
    onCommit(t);
  };

  return (
    <div className="flex items-center border border-dashed border-[var(--gp-accent2)] rounded bg-[rgba(88,166,255,.04)] z-30 relative"
      style={{ height: ROW_H }} onClick={e => e.stopPropagation()}>
      {activeCols.map(col => (
        <div key={col.id}
          className="flex items-center px-1.5 flex-shrink-0 overflow-hidden border-r border-[var(--gp-border)] h-full"
          style={{ width: col.w }}>
          {col.id === 'name' && (
            <div className="flex items-center gap-1 w-full overflow-hidden">
              <span style={{ width: depth * 14 }} />
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: TYPE_COLORS[type] }} />
              <select className="gp-inline-sel mr-1" style={{ width: 70 }}
                value={type} onChange={e => setType(e.target.value as GanttTaskType)}>
                {ALL_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
              <input ref={nameRef} className="gp-inline-inp flex-1" placeholder="Task name…" value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') { e.preventDefault(); onCancel(); } }} />
              <button className="w-5 h-5 rounded bg-[var(--gp-accent2)] text-white border-none text-[12px] cursor-pointer ml-1 flex-shrink-0" onClick={commit} title="Save (Enter)">✓</button>
              <button className="w-5 h-5 rounded border-none text-[var(--gp-red)] text-[12px] cursor-pointer flex-shrink-0" onClick={onCancel} title="Cancel (Esc)">✕</button>
            </div>
          )}
          {col.id === 'start' && <input type="date" className="gp-inline-inp" value={start} style={{ fontSize: 10 }} onChange={e => setStart(e.target.value)} />}
          {col.id === 'end' && type !== 'milestone' && <input type="date" className="gp-inline-inp" value={end} style={{ fontSize: 10 }} onChange={e => setEnd(e.target.value)} />}
          {col.id === 'progress' && <input type="number" className="gp-inline-inp" min={0} max={100} value={prog} style={{ width: 50 }} onChange={e => setProg(clamp(parseInt(e.target.value) || 0, 0, 100))} />}
          {col.id === 'status' && (
            <select className="gp-inline-sel w-full" value={status} onChange={e => setStatus(e.target.value as GanttStatus)}>
              {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          )}
          {col.id === 'priority' && (
            <select className="gp-inline-sel w-full" value={prio} onChange={e => setPrio(e.target.value as GanttPriority)}>
              {ALL_PRIOS.map(p => <option key={p} value={p}>{PRIO_LABELS[p]}</option>)}
            </select>
          )}
          {col.id === 'resource' && (
            <select className="gp-inline-sel w-full" value={resId} onChange={e => setResId(e.target.value)}>
              <option value="">—</option>
              {resources.map(r => <option key={r.id} value={r.id}>{r.name.split(' ')[0]}</option>)}
            </select>
          )}
          {col.id === 'dur' && <span className="text-[var(--gp-text3)] text-[10px]">auto</span>}
          {col.id === 'wbs' && null}
          {col.id === 'type' && null}
          {col.id === 'deps' && null}
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MAIN GANTTCHART COMPONENT
// ─────────────────────────────────────────────────────────────

export const GanttChart: React.FC<GanttChartProps> = (props) => {
  const [state, dispatch] = useReducer(reducer, props, initState);
  const { notif, notify } = useNotify();

  // Keep internal tasks/resources/deps in sync with controlled props
  useEffect(() => { dispatch({ type: 'SET_TASKS', tasks: props.tasks }); }, [props.tasks]);
  useEffect(() => { dispatch({ type: 'SET_RESOURCES', resources: props.resources }); }, [props.resources]);
  useEffect(() => { dispatch({ type: 'SET_DEPS', deps: props.dependencies }); }, [props.dependencies]);

  const editable = props.editable !== false;
  const { today, viewStart, viewEnd, cw, dateToX, xToDate } = useViewport(state.view, state.zoom);

  // WBS cache (recomputed on tasks change)
  const wbs = useMemo(() => calcWBS(state.tasks), [state.tasks]);

  // Visible items (filter + collapse)
  const visibleItems = useMemo(() => {
    const result: Array<GanttTask & { depth: number; visible: boolean }> = [];
    function walk(parentId: string | null | undefined, depth: number) {
      state.tasks.filter(t => (t.parent ?? null) === (parentId ?? null)).forEach(task => {
        const visible = passesFilter(task, state.filters);
        result.push({ ...task, depth, visible });
        if (!state.collapsed.has(task.id)) walk(task.id, depth + 1);
      });
    }
    walk(null, 0);
    return result;
  }, [state.tasks, state.collapsed, state.filters]);

  const idxMap = useMemo(() => {
    const m = new Map<string, number>();
    visibleItems.forEach((it, i) => m.set(it.id, i));
    return m;
  }, [visibleItems]);

  // Chart dimensions
  const totalW = dateToX(viewEnd) + cw * 5;
  const totalH = visibleItems.length * ROW_H + 40;

  // Refs
  const gridBodyRef  = useRef<HTMLDivElement>(null);
  const chartScrollRef = useRef<HTMLDivElement>(null);
  const chartHdrInnerRef = useRef<HTMLDivElement>(null);
  const colPickerBtnRef = useRef<HTMLButtonElement>(null);
  const resPicker = useRef<{ taskId: string; rect: DOMRect } | null>(null);
  const [resPickerState, setResPickerState] = useState<{ taskId: string; rect: DOMRect } | null>(null);

  // Scroll sync
  useEffect(() => {
    const grid = gridBodyRef.current, chart = chartScrollRef.current, inner = chartHdrInnerRef.current;
    if (!grid || !chart) return;
    let syncing = false;
    const onGrid = () => { if (syncing) return; syncing = true; chart.scrollTop = grid.scrollTop; syncing = false; };
    const onChart = () => { if (syncing) return; syncing = true; grid.scrollTop = chart.scrollTop; if (inner) inner.style.left = -chart.scrollLeft + 'px'; syncing = false; };
    grid.addEventListener('scroll', onGrid);
    chart.addEventListener('scroll', onChart);
    return () => { grid.removeEventListener('scroll', onGrid); chart.removeEventListener('scroll', onChart); };
  }, []);

  // Scroll to today on view change
  useLayoutEffect(() => {
    const scroll = chartScrollRef.current;
    if (!scroll) return;
    setTimeout(() => { scroll.scrollLeft = Math.max(0, dateToX(today) - 200); }, 60);
  }, [state.view, state.zoom, dateToX, today]);

  // Inject scoped styles once
  useEffect(() => {
    if (document.getElementById('gp-styles')) return;
    const el = document.createElement('style');
    el.id = 'gp-styles';
    el.textContent = GANTT_STYLE;
    document.head.appendChild(el);
    return () => { document.getElementById('gp-styles')?.remove(); };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        const el = document.activeElement;
        if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT') return;
        e.preventDefault();
        dispatch({ type: 'UNDO' });
        notify('Undo', 'info');
      }
      if (e.key === 'Escape') {
        dispatch({ type: 'CANCEL_INLINE' });
        dispatch({ type: 'CLOSE_ADD_EDIT' });
        dispatch({ type: 'CLOSE_DEP_PANEL' });
        dispatch({ type: 'CLOSE_COLOUR_PANEL' });
        dispatch({ type: 'CLOSE_VERSION_PANEL' });
        dispatch({ type: 'CLOSE_COL_PICKER' });
        dispatch({ type: 'CLOSE_SCHED_PANEL' });
      }
      if (e.key === 'F11') { e.preventDefault(); toggleFS(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [notify]);

  // ── TASK MUTATION HELPERS ──────────────────────────────────

  const updateTask = useCallback((updated: GanttTask) => {
    dispatch({ type: 'SAVE_HISTORY' });
    const newTasks = state.tasks.map(t => t.id === updated.id ? updated : t);
    dispatch({ type: 'SET_TASKS', tasks: newTasks });
    props.onTaskUpdate?.(updated);
  }, [state.tasks, props]);

  const addTask = useCallback((task: GanttTask) => {
    dispatch({ type: 'SAVE_HISTORY' });
    const newTasks = [...state.tasks, task];
    dispatch({ type: 'SET_TASKS', tasks: newTasks });
    props.onTaskAdd?.(task);
  }, [state.tasks, props]);

  const deleteTask = useCallback((id: string) => {
    dispatch({ type: 'SAVE_HISTORY' });
    const toDelete = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      state.tasks.forEach(t => { if (t.parent && toDelete.has(t.parent) && !toDelete.has(t.id)) { toDelete.add(t.id); changed = true; } });
    }
    const newTasks = state.tasks.filter(t => !toDelete.has(t.id));
    const newDeps  = state.deps.filter(d => !toDelete.has(d.from) && !toDelete.has(d.to));
    dispatch({ type: 'SET_TASKS', tasks: newTasks });
    dispatch({ type: 'SET_DEPS',  deps: newDeps });
    [...toDelete].forEach(tid => props.onTaskDelete?.(tid));
    props.onDependencyChange?.(newDeps);
  }, [state.tasks, state.deps, props]);

  const updateDeps = useCallback((newDeps: GanttDependency[]) => {
    dispatch({ type: 'SET_DEPS', deps: newDeps });
    props.onDependencyChange?.(newDeps);
  }, [props]);

  const updateResources = useCallback((newResources: GanttResource[]) => {
    dispatch({ type: 'SET_RESOURCES', resources: newResources });
    props.onResourceChange?.(newResources);
  }, [props]);

  // ── DRAG STATE ────────────────────────────────────────────
  const [drawingDep, setDrawingDep] = useState<{ x: number; y: number } | null>(null);

  // ── CTX MENU STATE ────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{ pos: { x: number; y: number }; id: string } | null>(null);

  // ── DEP PICKER FOR ROW ────────────────────────────────────
  const [depPickerFor, setDepPickerFor] = useState<string | null>(null);

  // ── BAR DRAG ─────────────────────────────────────────────
  const startBarDrag = useCallback((e: React.MouseEvent, id: string) => {
    if (!editable || e.button !== 0) return;
    e.preventDefault();
    const item = state.tasks.find(t => t.id === id);
    if (!item) return;
    const startX = e.clientX;
    const origStart = pd(item.start), origEnd = pd(item.end);
    const dur = dBetween(origStart, origEnd);
    let historySaved = false;

    const onMove = (ev: MouseEvent) => {
      if (!historySaved) { dispatch({ type: 'SAVE_HISTORY' }); historySaved = true; }
      const dx = ev.clientX - startX;
      const newStart = xToDate(dateToX(origStart) + dx);
      const diffDays = dBetween(origStart, newStart);
      const ns = new Date(origStart); ns.setDate(ns.getDate() + diffDays);
      const ne = new Date(ns); ne.setDate(ne.getDate() + dur);
      const updated = { ...item, start: ds(ns), end: ds(ne) };
      const newTasks = state.tasks.map(t => t.id === id ? updated : t);
      dispatch({ type: 'SET_TASKS', tasks: newTasks });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const finalTask = state.tasks.find(t => t.id === id);
      if (finalTask) props.onTaskUpdate?.(finalTask);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [editable, state.tasks, xToDate, dateToX, props]);

  const startResize = useCallback((e: React.MouseEvent, id: string, side: 'left' | 'right') => {
    if (!editable) return;
    e.preventDefault(); e.stopPropagation();
    const item = state.tasks.find(t => t.id === id);
    if (!item) return;
    const startX = e.clientX;
    const origStart = pd(item.start), origEnd = pd(item.end);
    dispatch({ type: 'SAVE_HISTORY' });

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      let updated: GanttTask;
      if (side === 'right') {
        const ne = xToDate(dateToX(origEnd) + dx);
        if (ne > pd(item.start)) { updated = { ...item, end: ds(ne) }; delete (updated as GanttTask).durDays; }
        else return;
      } else {
        const ns = xToDate(dateToX(origStart) + dx);
        if (ns < pd(item.end)) updated = { ...item, start: ds(ns) };
        else return;
      }
      const newTasks = state.tasks.map(t => t.id === id ? updated : t);
      dispatch({ type: 'SET_TASKS', tasks: newTasks });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const finalTask = state.tasks.find(t => t.id === id);
      if (finalTask) props.onTaskUpdate?.(finalTask);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [editable, state.tasks, xToDate, dateToX, props]);

  // ── FORWARD SCHEDULING ────────────────────────────────────
  const scheduleFromDeps = useCallback(() => {
    dispatch({ type: 'SAVE_HISTORY' });
    let tasks = [...state.tasks];
    for (let pass = 0; pass < 20; pass++) {
      let changed = false;
      state.deps.filter(d => d.type === 'FS').forEach(dep => {
        const pred = tasks.find(t => t.id === dep.from);
        const succ = tasks.find(t => t.id === dep.to);
        if (!pred || !succ || succ.type === 'milestone') return;
        if (pd(succ.start) <= pd(pred.end)) {
          const dur = Math.max(1, dBetween(pd(succ.start), pd(succ.end)));
          const newStart = new Date(pd(pred.end).getTime() + 86400000);
          const newEnd = new Date(newStart); newEnd.setDate(newEnd.getDate() + dur);
          tasks = tasks.map(t => t.id === succ.id ? { ...t, start: ds(newStart), end: ds(newEnd), durDays: undefined } : t);
          changed = true;
        }
      });
      if (!changed) break;
    }
    dispatch({ type: 'SET_TASKS', tasks });
    tasks.forEach(t => props.onTaskUpdate?.(t));
    notify('Plan rescheduled from dependencies', 'success');
  }, [state.tasks, state.deps, props, notify]);

  // ── EXCEL EXPORT ──────────────────────────────────────────
  const exportXLSX = useCallback(async () => {
    try {
      const XLSX = await import('xlsx');
      const wsData = [['WBS','ID','Parent','Type','Name','Start','End','Duration (days)','Progress %','Status','Priority','Resources','Color','Style']];
      state.tasks.forEach(t => {
        const resNames = getItemResources(t).map(id => state.resources.find(r => r.id === id)?.name).filter(Boolean).join(', ');
        const dur = t.type !== 'milestone' ? dBetween(pd(t.start), pd(t.end)) : 0;
        wsData.push([wbs.get(t.id) ?? '', t.id, t.parent ?? '', t.type, t.name, t.start, t.end ?? t.start,
          dur, t.progress ?? 0, STATUS_LABELS[t.status], PRIO_LABELS[t.priority], resNames, t.color ?? '', t.style ?? 'solid']);
      });
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Gantt Plan');
      const depData = [['WBS From','Task From','WBS To','Task To','Type']];
      state.deps.forEach(d => {
        const ft = state.tasks.find(t => t.id === d.from), tt = state.tasks.find(t => t.id === d.to);
        depData.push([wbs.get(d.from) ?? d.from, ft?.name ?? '', wbs.get(d.to) ?? d.to, tt?.name ?? '', d.type]);
      });
      const ws2 = XLSX.utils.aoa_to_sheet(depData);
      XLSX.utils.book_append_sheet(wb, ws2, 'Dependencies');
      XLSX.writeFile(wb, 'GanttPro_Export.xlsx');
      notify('Exported to Excel', 'success');
    } catch { notify('xlsx library not available — install with: npm i xlsx', 'info'); }
  }, [state.tasks, state.deps, state.resources, wbs, notify]);

  const importXLSX = useCallback((file: File) => {
    import('xlsx').then(XLSX => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const wb = XLSX.read(e.target!.result as string, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][];
          if (rows.length < 2) { notify('Empty file', 'info'); return; }
          const h = rows[0];
          const idx = (n: string) => h.indexOf(n);
          const sm: Record<string, GanttStatus> = {'Not Started':'notstarted','In Progress':'inprogress','Completed':'completed','On Hold':'onhold','At Risk':'atrisk'};
          const pm: Record<string, GanttPriority> = {'Critical':'critical','High':'high','Medium':'medium','Low':'low'};
          const newTasks: GanttTask[] = rows.slice(1).filter(r => r[idx('Name')]).map(r => ({
            id: String(r[idx('ID')] || mkId()),
            parent: r[idx('Parent')] ? String(r[idx('Parent')]) : null,
            type: (r[idx('Type')] as GanttTaskType) || 'task',
            name: String(r[idx('Name')]),
            start: String(r[idx('Start')] || ds(new Date())),
            end:   String(r[idx('End')]   || ds(new Date())),
            progress: parseInt(String(r[idx('Progress %')])) || 0,
            status: sm[r[idx('Status')]] ?? 'notstarted',
            priority: pm[r[idx('Priority')]] ?? 'medium',
            color: r[idx('Color')] || '#e3b341',
            style: (r[idx('Style')] as GanttBarStyle) || 'solid',
            resources: [],
          }));
          dispatch({ type: 'SAVE_HISTORY' });
          dispatch({ type: 'SET_TASKS', tasks: newTasks });
          notify(`Imported ${newTasks.length} items`, 'success');
        } catch (err) { notify('Import failed: ' + (err as Error).message, 'info'); }
      };
      reader.readAsBinaryString(file);
    }).catch(() => notify('xlsx library not available', 'info'));
  }, [notify]);

  // ── FULLSCREEN ────────────────────────────────────────────
  const toggleFS = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  // ── DIVIDER RESIZE ────────────────────────────────────────
  const startDivider = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX, startW = state.gridW;
    const onMove = (ev: MouseEvent) => dispatch({ type: 'SET_GRID_W', w: startW + (ev.clientX - startX) });
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [state.gridW]);

  // ── TOOLTIP ───────────────────────────────────────────────
  const [tip, setTip] = useState<{ task: GanttTask; x: number; y: number } | null>(null);

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────

  return (
    <div
      className={`gp-root flex flex-col overflow-hidden ${state.theme === 'light' ? 'light' : ''} ${props.className ?? ''}`}
      style={{ height: '100vh' }}
    >
      {/* ── TOPBAR ───────────────────────────────────────────── */}
      <div className="flex items-center h-[52px] bg-[var(--gp-surface)] border-b border-[var(--gp-border)] px-3 gap-2 flex-shrink-0 z-[200]">
        <div className="flex items-center gap-1.5 mr-1.5 font-extrabold text-[17px]" style={{ fontFamily: 'Syne, sans-serif' }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect x="2" y="5" width="12" height="4" rx="2" fill="#58a6ff"/>
            <rect x="5" y="11" width="14" height="4" rx="2" fill="#bc8cff"/>
            <rect x="1" y="17" width="8" height="3" rx="1.5" fill="#3fb950"/>
            <polygon points="19,4 22,8 19,12 16,8" fill="#e3b341"/>
          </svg>
          <span style={{ background: 'linear-gradient(135deg,#58a6ff,#bc8cff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Gantt</span>Pro
        </div>
        <Sep />

        {/* View switcher */}
        <div className="flex border border-[var(--gp-border)] rounded overflow-hidden">
          {(['day','week','month','year'] as GanttView[]).map(v => (
            <button key={v} onClick={() => dispatch({ type: 'SET_VIEW', view: v })}
              className={`px-2.5 py-1 text-[11px] font-medium cursor-pointer border-r border-[var(--gp-border)] last:border-r-0
                ${state.view === v ? 'bg-[var(--gp-accent2)] text-white' : 'bg-[var(--gp-surface3)] text-[var(--gp-text2)] hover:bg-[var(--gp-surface2)] hover:text-[var(--gp-text)]'}`}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        <Sep />

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button onClick={() => dispatch({ type: 'SET_ZOOM', zoom: state.zoom - 20 })}
            className="w-[26px] h-[26px] rounded border border-[var(--gp-border2)] bg-[var(--gp-surface3)] text-[var(--gp-text2)] cursor-pointer flex items-center justify-center text-[14px] font-bold hover:bg-[var(--gp-surface2)] hover:text-[var(--gp-text)]">−</button>
          <span className="text-[11px] text-[var(--gp-text2)] min-w-[34px] text-center">{state.zoom}%</span>
          <button onClick={() => dispatch({ type: 'SET_ZOOM', zoom: state.zoom + 20 })}
            className="w-[26px] h-[26px] rounded border border-[var(--gp-border2)] bg-[var(--gp-surface3)] text-[var(--gp-text2)] cursor-pointer flex items-center justify-center text-[14px] font-bold hover:bg-[var(--gp-surface2)] hover:text-[var(--gp-text)]">+</button>
        </div>

        <Sep />

        {editable && (
          <>
            <Btn variant="primary" onClick={() => dispatch({ type: 'START_INLINE_NEW', parentId: null })}>
              <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
              Add Row
            </Btn>
            <Btn onClick={() => dispatch({ type: 'OPEN_DEP_PANEL' })}>⛓ Dependencies</Btn>
          </>
        )}
        <Btn onClick={() => {
          const p = state.resPanelOpen, g = state.resGridOpen;
          if (!p && !g) dispatch({ type: 'TOGGLE_RES_PANEL' });
          else if (p) { dispatch({ type: 'TOGGLE_RES_PANEL' }); /* becomes grid */ }
          else dispatch({ type: 'TOGGLE_RES_GRID' });
        }}>👤 Resources</Btn>
        <Btn onClick={() => dispatch({ type: 'OPEN_VERSION_PANEL' })}>📋 Versions</Btn>
        {editable && <Btn onClick={() => dispatch({ type: 'OPEN_SCHED_PANEL' })}>⚡ Schedule</Btn>}

        <Sep />

        <Btn onClick={exportXLSX}>⬇ Excel</Btn>
        <label>
          <Btn as="span">⬆ Import</Btn>
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importXLSX(f); e.target.value = ''; }} />
        </label>

        <div className="flex-1" />

        {/* Undo */}
        <Btn id="undo-btn" onClick={() => { dispatch({ type: 'UNDO' }); notify('Undo', 'info'); }}
          disabled={state.undoStack.length === 0}
          className={state.undoStack.length === 0 ? 'opacity-40' : ''}>
          ↩ Undo
        </Btn>

        {/* Theme toggle */}
        <button onClick={() => dispatch({ type: 'SET_THEME', theme: state.theme === 'dark' ? 'light' : 'dark' })}
          className="flex items-center gap-1.5 cursor-pointer select-none px-2 py-1 rounded-full border border-[var(--gp-border2)] bg-[var(--gp-surface3)] hover:border-[var(--gp-accent2)]">
          <span className="text-[12px]">{state.theme === 'dark' ? '🌙' : '☀️'}</span>
          <div className="relative w-8 h-[18px] rounded-full flex-shrink-0" style={{ background: state.theme === 'light' ? 'var(--gp-accent2)' : 'var(--gp-border2)' }}>
            <div className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-[left]"
              style={{ left: state.theme === 'light' ? 16 : 2 }} />
          </div>
        </button>

        {/* Fullscreen */}
        <Btn onClick={toggleFS}>⛶</Btn>

        {/* Collapse all */}
        <Btn onClick={() => { state.collapsedAll ? dispatch({ type: 'EXPAND_ALL' }) : dispatch({ type: 'COLLAPSE_ALL' }); }}>
          {state.collapsedAll ? 'Expand All' : 'Collapse All'}
        </Btn>

        {/* Today */}
        <Btn onClick={() => { const s = chartScrollRef.current; if (s) s.scrollLeft = Math.max(0, dateToX(today) - 200); }}>Today</Btn>

        {/* Sidebar toggle */}
        <Btn onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })} title="Hide/show attribute columns">⇄</Btn>
      </div>

      {/* ── FILTER BAR ───────────────────────────────────────── */}
      <div className="flex items-center h-[38px] bg-[var(--gp-surface2)] border-b border-[var(--gp-border)] px-3 gap-1.5 flex-shrink-0 z-[150] overflow-x-auto">
        <span className="text-[10px] font-bold text-[var(--gp-text3)] uppercase tracking-wide mr-1">Show:</span>
        {ALL_TYPES.map(t => (
          <FilterChip key={t} label={t.charAt(0).toUpperCase() + t.slice(1)} on={state.filters.types.has(t)}
            color={TYPE_COLORS[t]}
            onClick={() => {
              const s = new Set(state.filters.types);
              s.has(t) ? s.delete(t) : s.add(t);
              dispatch({ type: 'SET_FILTERS', filters: { types: s } });
            }} />
        ))}
        <div className="w-px h-[18px] bg-[var(--gp-border)] mx-1" />
        <span className="text-[10px] font-bold text-[var(--gp-text3)] uppercase tracking-wide mr-1">Priority:</span>
        {ALL_PRIOS.map(p => (
          <FilterChip key={p} label={PRIO_LABELS[p]} on={state.filters.priorities.has(p)}
            onClick={() => {
              const s = new Set(state.filters.priorities);
              s.has(p) ? s.delete(p) : s.add(p);
              dispatch({ type: 'SET_FILTERS', filters: { priorities: s } });
            }} />
        ))}
        <div className="w-px h-[18px] bg-[var(--gp-border)] mx-1" />
        <span className="text-[10px] font-bold text-[var(--gp-text3)] uppercase tracking-wide mr-1">Status:</span>
        {ALL_STATUSES.map(s => (
          <FilterChip key={s} label={STATUS_LABELS[s]} on={state.filters.statuses.has(s)}
            onClick={() => {
              const ns = new Set(state.filters.statuses);
              ns.has(s) ? ns.delete(s) : ns.add(s);
              dispatch({ type: 'SET_FILTERS', filters: { statuses: ns } });
            }} />
        ))}
        <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="5" cy="5" r="3.5" stroke="#8b949e" strokeWidth="1.2"/><path d="M8 8l2.5 2.5" stroke="#8b949e" strokeWidth="1.2" strokeLinecap="round"/></svg>
          <input
            className="bg-[var(--gp-surface3)] border border-[var(--gp-border2)] rounded text-[var(--gp-text)] px-2 py-1 text-[11px] w-[160px] outline-none focus:border-[var(--gp-accent2)]"
            placeholder="Search tasks…"
            value={state.filters.search}
            onChange={e => dispatch({ type: 'SET_FILTERS', filters: { search: e.target.value } })}
          />
        </div>
      </div>

      {/* ── MAIN AREA ─────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* ── GRID PANE ─────────────────────────────────────── */}
        {state.sidebarVisible && (
          <>
            <div className="flex-shrink-0 flex flex-col overflow-hidden bg-[var(--gp-surface)] border-r border-[var(--gp-border)] relative z-10"
              style={{ width: state.gridW }}>
              {/* Grid header */}
              <div className="flex-shrink-0 border-b border-[var(--gp-border)] bg-[var(--gp-surface)]" style={{ height: HDR_H }}>
                <GridHeader
                  cols={state.cols}
                  onResizeCol={(id, w) => dispatch({ type: 'RESIZE_COL', id, w })}
                  onOpenColPicker={e => { e.stopPropagation(); dispatch({ type: 'TOGGLE_COL_PICKER' }); }}
                  colPickerRef={colPickerBtnRef}
                />
              </div>
              {/* Grid body */}
              <div ref={gridBodyRef} className="flex-1 overflow-y-auto overflow-x-auto gp-scrollbar" style={{ minWidth: 0 }}>
                <div style={{ width: 'max-content', minWidth: '100%' }}>
                  {visibleItems.map((item, _i) =>
                    state.inlineEditId === item.id
                      ? <InlineRow key={item.id} item={item} cols={state.cols}
                          tasks={state.tasks} resources={state.resources}
                          parentId={state.inlineNewParentId} depth={item.depth}
                          onCommit={t => { updateTask(t); dispatch({ type: 'CANCEL_INLINE' }); notify('Row updated', 'success'); }}
                          onCancel={() => dispatch({ type: 'CANCEL_INLINE' })} />
                      : <GridRow key={item.id} item={item} cols={state.cols}
                          wbs={wbs} resources={state.resources} tasks={state.tasks} deps={state.deps}
                          selected={state.selId === item.id}
                          hasKids={state.tasks.some(c => c.parent === item.id)}
                          isCollapsed={state.collapsed.has(item.id)}
                          onSelect={() => dispatch({ type: 'SET_SEL', id: item.id })}
                          onToggleCollapse={() => dispatch({ type: 'TOGGLE_COLLAPSE', id: item.id })}
                          onCtx={e => setCtxMenu({ pos: { x: e.clientX, y: e.clientY }, id: item.id })}
                          onInlineEdit={() => editable && dispatch({ type: 'START_INLINE_EDIT', id: item.id })}
                          onAddChild={() => editable && dispatch({ type: 'START_INLINE_NEW', parentId: item.id })}
                          onColour={() => editable && dispatch({ type: 'OPEN_COLOUR_PANEL', id: item.id })}
                          onTaskUpdate={updateTask}
                          onResPickerOpen={(id, rect) => setResPickerState({ taskId: id, rect })}
                          onDepPickerOpen={id => setDepPickerFor(id)}
                        />
                  )}

                  {state.inlineEditId === '__new__' && (
                    <InlineRow item={null} cols={state.cols}
                      tasks={state.tasks} resources={state.resources}
                      parentId={state.inlineNewParentId} depth={state.inlineNewParentId ? getDepth(state.inlineNewParentId, state.tasks) + 1 : 0}
                      onCommit={t => { addTask(t); dispatch({ type: 'CANCEL_INLINE' }); notify('Row added', 'success'); }}
                      onCancel={() => dispatch({ type: 'CANCEL_INLINE' })} />
                  )}

                  {/* Add row strip */}
                  {editable && (
                    <div onClick={() => dispatch({ type: 'START_INLINE_NEW', parentId: null })}
                      className="h-8 flex items-center px-2.5 gap-1.5 border-b border-[var(--gp-border)] cursor-pointer text-[11px] text-[var(--gp-text3)] font-medium sticky bottom-0 bg-[var(--gp-surface)] z-20 hover:bg-[var(--gp-surface2)] hover:text-[var(--gp-accent)]">
                      <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
                      Add row…
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="w-1 bg-[var(--gp-border)] cursor-col-resize flex-shrink-0 hover:bg-[var(--gp-accent2)] z-10"
              onMouseDown={startDivider} />
          </>
        )}

        {/* ── CHART PANE ────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Chart header */}
          <div className="flex-shrink-0 border-b border-[var(--gp-border)] overflow-hidden relative bg-[var(--gp-surface)]" style={{ height: HDR_H }}>
            <div ref={chartHdrInnerRef} className="absolute top-0 left-0 h-full" style={{ display: 'flex' }}>
              <ChartHeader view={state.view} cw={cw} viewStart={viewStart} viewEnd={viewEnd} today={today} scrollLeft={0} />
            </div>
          </div>

          {/* Chart scroll */}
          <div ref={chartScrollRef} className="flex-1 overflow-auto relative gp-scrollbar6 gp-chart-body">
            <div className="relative" style={{ width: totalW, minHeight: totalH }}>
              {/* Background grid rows */}
              {visibleItems.map((item, i) => {
                if (!item.visible) return null;
                const isPhase = ['phase','project','release','workstream'].includes(item.type);
                return (
                  <div key={item.id}
                    className={`absolute w-full border-b border-[var(--gp-border)] ${state.selId === item.id ? 'bg-[rgba(88,166,255,.04)]' : ''} ${isPhase ? 'bg-[rgba(255,255,255,.012)]' : ''}`}
                    style={{ top: i * ROW_H, height: ROW_H, width: totalW }} />
                );
              })}

              {/* Bars */}
              {visibleItems.map((item, i) => {
                if (!item.visible || item.type === 'milestone') return null;
                const x1 = dateToX(item.start);
                const x2 = dateToX(item.end) + cw;
                const w = Math.max(x2 - x1, 10);
                const isOutline = item.style === 'outline';
                const col = item.color || TYPE_COLORS[item.type];
                const y = i * ROW_H;

                return (
                  <div key={item.id}
                    className="gp-bar-wrap"
                    data-id={item.id}
                    style={{ left: x1, top: y, width: w, cursor: editable ? 'grab' : 'default' }}
                    onMouseDown={e => editable && startBarDrag(e, item.id)}
                    onMouseEnter={e => setTip({ task: item, x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setTip(null)}
                    onDoubleClick={() => editable && dispatch({ type: 'START_INLINE_EDIT', id: item.id })}>
                    <div className={`gp-bar ${isOutline ? 'outline' : ''}`}
                      style={{
                        background: isOutline ? 'transparent' : col,
                        borderColor: isOutline ? col : undefined,
                        color: item.labelColor ?? (isOutline ? col : 'rgba(255,255,255,.9)'),
                      }}>
                      {!isOutline && (item.progress ?? 0) > 0 && (
                        <div className="gp-bar-prog" style={{ width: (item.progress ?? 0) + '%' }} />
                      )}
                      {!isOutline && (item.progress ?? 0) > 0 && (
                        <span className="gp-bar-pct">{item.progress}%</span>
                      )}
                      <span className="gp-bar-lbl">{item.name}</span>
                      {editable && (
                        <>
                          <div className="gp-resize-l" onMouseDown={e => startResize(e, item.id, 'left')} />
                          <div className="gp-resize-r" onMouseDown={e => startResize(e, item.id, 'right')} />
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Milestones */}
              {visibleItems.map((item, i) => {
                if (!item.visible || item.type !== 'milestone') return null;
                const x = dateToX(item.start) + cw / 2;
                const y = i * ROW_H;
                return (
                  <div key={item.id}>
                    <div className="gp-milestone" style={{ left: x - 8, top: y, background: item.color || '#e3b341' }}
                      onDoubleClick={() => editable && dispatch({ type: 'OPEN_EDIT', id: item.id })}
                      onMouseEnter={e => setTip({ task: item, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setTip(null)} />
                    <div className="gp-m-label" style={{ left: x + 14, top: y + 10 }}>{item.name}</div>
                  </div>
                );
              })}

              {/* Today line */}
              <div className="gp-today-line" style={{ left: dateToX(today) + cw / 2, height: totalH }} />

              {/* Dep handles */}
              {editable && visibleItems.map((item, i) => {
                if (!item.visible || item.type === 'milestone') return null;
                const x1 = dateToX(item.start);
                const x2 = dateToX(item.end) + cw;
                const y = i * ROW_H;
                return (
                  <React.Fragment key={item.id}>
                    <div className="gp-dep-handle" data-bar-id={item.id} data-side="end"
                      style={{ left: x2 + 3, top: y + 6 }}
                      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); /* dep draw handled via SVG */ }} />
                    <div className="gp-dep-handle" data-bar-id={item.id} data-side="start"
                      style={{ left: x1 - 16, top: y + 6 }}
                      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }} />
                  </React.Fragment>
                );
              })}

              {/* Dependency lines */}
              <DepLines
                deps={state.deps} tasks={state.tasks}
                visibleIds={visibleItems.filter(i => i.visible).map(i => i.id)}
                idxMap={idxMap}
                dateToX={dateToX} cw={cw}
                totalW={totalW} totalH={totalH}
                onRemove={idx => {
                  dispatch({ type: 'SAVE_HISTORY' });
                  const newDeps = state.deps.filter((_, i) => i !== idx);
                  updateDeps(newDeps);
                }}
                drawingDep={drawingDep}
              />
            </div>
          </div>
        </div>

        {/* Resource side panel */}
        <ResSidePanel resources={state.resources} tasks={state.tasks} open={state.resPanelOpen}
          onClose={() => dispatch({ type: 'TOGGLE_RES_PANEL' })} />
      </div>

      {/* ── RESOURCE HISTOGRAM BOTTOM PANEL ──────────────────── */}
      {state.resGridOpen && (
        <ResHistogram
          resources={state.resources} tasks={state.tasks}
          view={state.view} viewStart={viewStart} viewEnd={viewEnd}
          height={state.resGridH}
          onResize={h => dispatch({ type: 'SET_RES_GRID_H', h })}
          onClose={() => dispatch({ type: 'TOGGLE_RES_GRID' })}
        />
      )}

      {/* ── TOOLTIP ──────────────────────────────────────────── */}
      {tip && (
        <div className="fixed z-[1000] rounded-lg border p-2.5 text-[11px] min-w-[170px] shadow-2xl pointer-events-none"
          style={{ left: tip.x + 14, top: tip.y - 10, background: 'var(--gp-surface2)', borderColor: 'var(--gp-border2)' }}>
          <div className="font-bold text-[12px] mb-1.5" style={{ fontFamily: 'Syne, sans-serif' }}>{tip.task.name}</div>
          {(() => {
            const wbsCode = wbs.get(tip.task.id);
            const res = state.resources.filter(r => getItemResources(tip.task).includes(r.id));
            const dur = tip.task.type !== 'milestone' ? durLabel(durFromDates(tip.task)) : '—';
            return (
              <>
                {wbsCode && <div className="flex gap-1.5 text-[var(--gp-text2)] mb-0.5"><span>WBS:</span><strong className="font-mono text-[var(--gp-text)]">{wbsCode}</strong></div>}
                <div className="flex gap-1.5 text-[var(--gp-text2)] mb-0.5"><span>Type:</span><strong className="text-[var(--gp-text)]">{tip.task.type}</strong></div>
                <div className="flex gap-1.5 text-[var(--gp-text2)] mb-0.5"><span>Start:</span><strong className="text-[var(--gp-text)]">{tip.task.start}</strong></div>
                {tip.task.type !== 'milestone' && <>
                  <div className="flex gap-1.5 text-[var(--gp-text2)] mb-0.5"><span>End:</span><strong className="text-[var(--gp-text)]">{tip.task.end}</strong></div>
                  <div className="flex gap-1.5 text-[var(--gp-text2)] mb-0.5"><span>Duration:</span><strong className="text-[var(--gp-text)]">{dur}</strong></div>
                  <div className="flex gap-1.5 text-[var(--gp-text2)] mb-0.5"><span>Progress:</span><strong className="text-[var(--gp-text)]">{tip.task.progress ?? 0}%</strong></div>
                </>}
                <div className="flex gap-1.5 text-[var(--gp-text2)] mb-0.5"><span>Status:</span><strong className="text-[var(--gp-text)]">{STATUS_LABELS[tip.task.status]}</strong></div>
                <div className="flex gap-1.5 text-[var(--gp-text2)] mb-0.5"><span>Priority:</span><strong className="text-[var(--gp-text)]">{PRIO_LABELS[tip.task.priority]}</strong></div>
                {res.length > 0 && <div className="flex gap-1.5 text-[var(--gp-text2)]"><span>Resources:</span><strong className="text-[var(--gp-text)]">{res.map(r => r.name).join(', ')}</strong></div>}
              </>
            );
          })()}
        </div>
      )}

      {/* ── CONTEXT MENU ─────────────────────────────────────── */}
      {ctxMenu && editable && (
        <CtxMenu pos={ctxMenu.pos} id={ctxMenu.id}
          onEdit={() => { setCtxMenu(null); dispatch({ type: 'START_INLINE_EDIT', id: ctxMenu.id }); }}
          onAddChild={() => { setCtxMenu(null); dispatch({ type: 'START_INLINE_NEW', parentId: ctxMenu.id }); }}
          onColour={() => { setCtxMenu(null); dispatch({ type: 'OPEN_COLOUR_PANEL', id: ctxMenu.id }); }}
          onDup={() => {
            setCtxMenu(null);
            const t = state.tasks.find(t => t.id === ctxMenu.id);
            if (t) { dispatch({ type: 'SAVE_HISTORY' }); const copy = { ...t, id: mkId(), name: t.name + ' (copy)' }; dispatch({ type: 'SET_TASKS', tasks: [...state.tasks, copy] }); props.onTaskAdd?.(copy); }
          }}
          onMoveUp={() => {
            setCtxMenu(null);
            const i = state.tasks.findIndex(t => t.id === ctxMenu.id);
            if (i > 0) { dispatch({ type: 'SAVE_HISTORY' }); const t = [...state.tasks]; [t[i], t[i-1]] = [t[i-1], t[i]]; dispatch({ type: 'SET_TASKS', tasks: t }); }
          }}
          onMoveDown={() => {
            setCtxMenu(null);
            const i = state.tasks.findIndex(t => t.id === ctxMenu.id);
            if (i < state.tasks.length - 1) { dispatch({ type: 'SAVE_HISTORY' }); const t = [...state.tasks]; [t[i], t[i+1]] = [t[i+1], t[i]]; dispatch({ type: 'SET_TASKS', tasks: t }); }
          }}
          onDelete={() => { setCtxMenu(null); if (confirm('Delete this item and all children?')) deleteTask(ctxMenu.id); }}
          onClose={() => setCtxMenu(null)}
        />
      )}

      {/* ── COLUMN PICKER ────────────────────────────────────── */}
      {state.colPickerOpen && (
        <ColPicker cols={state.cols}
          onToggle={(id, on) => dispatch({ type: 'TOGGLE_COL', id, on })}
          onAddCustom={(label, dataType) => { dispatch({ type: 'ADD_CUSTOM_COL', label, dataType }); dispatch({ type: 'CLOSE_COL_PICKER' }); notify('Column "' + label + '" added', 'success'); }}
          onClose={() => dispatch({ type: 'CLOSE_COL_PICKER' })}
          anchorRef={colPickerBtnRef}
        />
      )}

      {/* ── RESOURCE PICKER POPUP ────────────────────────────── */}
      {resPickerState && (
        <ResourcePicker
          task={state.tasks.find(t => t.id === resPickerState.taskId)!}
          resources={state.resources}
          anchorRect={resPickerState.rect}
          onUpdate={(taskId, resourceIds) => {
            const t = state.tasks.find(t => t.id === taskId);
            if (t) updateTask({ ...t, resources: resourceIds });
          }}
          onAddResource={r => updateResources([...state.resources, r])}
          onClose={() => setResPickerState(null)}
        />
      )}

      {/* ── DEP PICKER FOR ROW ────────────────────────────────── */}
      {depPickerFor && (
        <div className="fixed inset-0 z-[800]" onClick={() => setDepPickerFor(null)}>
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border p-3 shadow-2xl min-w-[260px]"
            style={{ background: 'var(--gp-surface2)', borderColor: 'var(--gp-border2)' }}
            onClick={e => e.stopPropagation()}>
            <div className="text-[10px] font-bold text-[var(--gp-text3)] uppercase tracking-wide mb-2">
              Add Dep from "{state.tasks.find(t => t.id === depPickerFor)?.name ?? ''}"
            </div>
            <div className="flex gap-1.5 mb-2">
              <select id="drp-type" className="gp-inline-sel" style={{ width: 60 }}>
                <option value="FS">FS</option><option value="SS">SS</option><option value="FF">FF</option>
              </select>
              <select id="drp-to" className="gp-inline-sel flex-1">
                {state.tasks.filter(t => t.id !== depPickerFor && t.type !== 'milestone').map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-1.5 justify-end">
              <Btn onClick={() => setDepPickerFor(null)}>Cancel</Btn>
              <Btn variant="primary" onClick={() => {
                const toId = (document.getElementById('drp-to') as HTMLSelectElement)?.value;
                const type = (document.getElementById('drp-type') as HTMLSelectElement)?.value as GanttDepType;
                setDepPickerFor(null);
                if (!toId || toId === depPickerFor) return;
                dispatch({ type: 'SAVE_HISTORY' });
                const filtered = state.deps.filter(d => d.from !== depPickerFor);
                updateDeps([...filtered, { from: depPickerFor, to: toId, type }]);
                notify('Dependency set', 'success');
              }}>Connect</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD / EDIT PANEL ─────────────────────────────────── */}
      {state.addEditOpen && (
        <AddEditPanel
          task={state.addEditId ? state.tasks.find(t => t.id === state.addEditId) ?? null : null}
          resources={state.resources} tasks={state.tasks}
          parentId={state.addEditParentId}
          onSave={t => {
            if (state.addEditId) updateTask(t);
            else addTask(t);
            notify(state.addEditId ? 'Item updated' : 'Item added', 'success');
          }}
          onClose={() => dispatch({ type: 'CLOSE_ADD_EDIT' })}
        />
      )}

      {/* ── COLOUR PANEL ─────────────────────────────────────── */}
      {state.colourPanelId && (
        <ColourPanel
          task={state.tasks.find(t => t.id === state.colourPanelId)!}
          onApply={(color, bStyle, labelColor) => {
            const t = state.tasks.find(t => t.id === state.colourPanelId);
            if (t) updateTask({ ...t, color, style: bStyle, labelColor });
            dispatch({ type: 'CLOSE_COLOUR_PANEL' });
          }}
          onClose={() => dispatch({ type: 'CLOSE_COLOUR_PANEL' })}
        />
      )}

      {/* ── DEP PANEL ────────────────────────────────────────── */}
      {state.depPanelOpen && (
        <DepPanel tasks={state.tasks} deps={state.deps}
          onChange={d => { dispatch({ type: 'SAVE_HISTORY' }); updateDeps(d); }}
          onClose={() => dispatch({ type: 'CLOSE_DEP_PANEL' })} />
      )}

      {/* ── VERSION PANEL ────────────────────────────────────── */}
      {state.versionPanelOpen && (
        <VersionPanel versions={state.versions}
          onSave={name => { dispatch({ type: 'SAVE_VERSION', name }); notify('Version saved: ' + name, 'success'); }}
          onRestore={id => { dispatch({ type: 'RESTORE_VERSION', id }); notify('Version restored', 'info'); }}
          onClose={() => dispatch({ type: 'CLOSE_VERSION_PANEL' })} />
      )}

      {/* ── SCHEDULE PANEL ───────────────────────────────────── */}
      {state.schedPanelOpen && (
        <SchedPanel tasks={state.tasks} deps={state.deps}
          onApply={() => { scheduleFromDeps(); }}
          onClose={() => dispatch({ type: 'CLOSE_SCHED_PANEL' })} />
      )}

      {/* ── NOTIFICATION ─────────────────────────────────────── */}
      {notif && (
        <div className={`fixed bottom-5 right-5 rounded-lg border px-4 py-3 text-[12px] z-[2000] shadow-2xl transition-all
          ${notif.type === 'success' ? 'border-[rgba(63,185,80,.5)] text-[var(--gp-green)]' : 'border-[var(--gp-accent2)] text-[var(--gp-accent)]'}`}
          style={{ background: 'var(--gp-surface2)' }}>
          {notif.msg}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// FILTER HELPER
// ─────────────────────────────────────────────────────────────
function passesFilter(task: GanttTask, filters: GanttFilters): boolean {
  if (filters.types.size > 0     && !filters.types.has(task.type))         return false;
  if (filters.priorities.size > 0 && !filters.priorities.has(task.priority)) return false;
  if (filters.statuses.size > 0  && !filters.statuses.has(task.status))    return false;
  if (filters.resources.size > 0 && !getItemResources(task).some(r => filters.resources.has(r))) return false;
  if (filters.search && !task.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
  return true;
}

export default GanttChart;
