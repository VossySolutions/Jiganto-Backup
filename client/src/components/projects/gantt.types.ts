// ─────────────────────────────────────────────────────────────
// gantt.types.ts
// Full TypeScript interfaces for GanttChart v11 → React 18
// Designed to map cleanly to a pm_tasks / Jiganto schema
// ─────────────────────────────────────────────────────────────

// ─── Core enums ──────────────────────────────────────────────

export type GanttTaskType =
  | 'project'
  | 'release'
  | 'phase'
  | 'workstream'
  | 'activity'
  | 'task'
  | 'subtask'
  | 'milestone';

export type GanttStatus =
  | 'notstarted'
  | 'inprogress'
  | 'completed'
  | 'onhold'
  | 'atrisk';

export type GanttPriority = 'critical' | 'high' | 'medium' | 'low';

export type GanttDepType = 'FS' | 'SS' | 'FF';

export type GanttView = 'day' | 'week' | 'month' | 'year';

export type GanttBarStyle = 'solid' | 'outline';

// ─── Task ────────────────────────────────────────────────────

/**
 * GanttTask is the core data unit.
 *
 * Adapter note — map your pm_tasks row like this:
 *   id:         row.id (string — prefix with 'i' if numeric)
 *   name:       row.title
 *   status:     STATUS_MAP[row.status]
 *   priority:   PRIO_MAP[row.priority]
 *   resources:  [row.assignee]   ← convert to array
 *   start:      row.due_date     ← or row.start_date if you have one
 *   parent:     row.parent_id || null
 */
export interface GanttTask {
  /** Unique identifier — stable across renders */
  id: string;

  /** Display name */
  name: string;

  /** Hierarchical type — drives default colour and row weight */
  type: GanttTaskType;

  /** ISO date string YYYY-MM-DD */
  start: string;

  /** ISO date string YYYY-MM-DD. Same as start for milestones. */
  end: string;

  /**
   * Decimal days override for sub-day durations.
   * 0.25 = 6h, 0.5 = 12h, 1 = 1 full day.
   * When set, end is derived from start + floor(durDays).
   * Omit for whole-day tasks — duration is calculated from start/end.
   */
  durDays?: number;

  /** 0–100 */
  progress?: number;

  status: GanttStatus;
  priority: GanttPriority;

  /**
   * Array of resource IDs. Replaces legacy single `.resource` string.
   * Backwards-compat: if `.resource` (string) exists it is normalised to array.
   */
  resources?: string[];

  /** @deprecated Use resources[] instead */
  resource?: string;

  /** Parent task ID — null/undefined for top-level items */
  parent?: string | null;

  /** Hex colour for the bar, e.g. '#1f6feb' */
  color?: string;

  /** Bar fill style */
  style?: GanttBarStyle;

  /** Optional label font colour override */
  labelColor?: string;

  /** Arbitrary key-value bag for custom columns */
  custom?: Record<string, string>;
}

// ─── Resource ────────────────────────────────────────────────

export interface GanttResource {
  /** Unique identifier — match to your users table PK */
  id: string;

  /** Display name */
  name: string;

  /** Avatar / bar accent hex colour */
  color: string;

  /** Standard working hours per day — default 7.5 */
  capacity: number;
}

// ─── Dependency ──────────────────────────────────────────────

export interface GanttDependency {
  /** Source task ID */
  from: string;

  /** Target task ID */
  to: string;

  type: GanttDepType;
}

// ─── Version snapshot ────────────────────────────────────────

export interface GanttVersion {
  id: string;
  name: string;
  date: string;
  /** JSON.stringify of GanttTask[] */
  data: string;
}

// ─── Column definition ───────────────────────────────────────

export interface GanttColumn {
  /** Built-in column key, or custom column id like 'cust_1234' */
  id: string;
  label: string;
  /** Pixel width */
  w: number;
  /** False = hidden */
  visible?: boolean;
  /** True = user-created column */
  custom?: boolean;
  dataType?: 'text' | 'number' | 'date';
}

// ─── Filter state ────────────────────────────────────────────

export interface GanttFilters {
  types: Set<GanttTaskType>;
  priorities: Set<GanttPriority>;
  statuses: Set<GanttStatus>;
  resources: Set<string>;
  search: string;
}

// ─── Histogram period ────────────────────────────────────────

export interface HistogramPeriod {
  label: string;
  start: Date;
  end: Date;
}

export interface ResourceLoad {
  resourceId: string;
  periodLabel: string;
  allocatedHours: number;
  capacityHours: number;
  pct: number;
  taskCount: number;
}

// ─── Component props ─────────────────────────────────────────

export interface GanttChartProps {
  // ── Data (controlled) ──────────────────────────────────────
  tasks: GanttTask[];
  resources: GanttResource[];
  dependencies: GanttDependency[];

  // ── Callbacks — you own persistence ────────────────────────
  onTaskUpdate?: (task: GanttTask) => void;
  onTaskAdd?: (task: GanttTask) => void;
  onTaskDelete?: (id: string) => void;
  onClearAll?: () => Promise<void>;
  onBulkImport?: (tasks: GanttTask[]) => Promise<void>;
  onDependencyChange?: (deps: GanttDependency[]) => void;
  onResourceChange?: (resources: GanttResource[]) => void;

  // ── Optional initial UI state ──────────────────────────────
  defaultView?: GanttView;
  defaultZoom?: number;

  /**
   * If false, the component is purely read-only — no drags, no inline edits.
   * Default: true
   */
  editable?: boolean;

  /** Override theme — default follows system preference */
  theme?: 'dark' | 'light';

  /**
   * Custom column definitions to merge with built-in columns.
   * Use to pre-seed schema-driven columns from your database.
   */
  customColumns?: GanttColumn[];

  /** className applied to the outermost wrapper div */
  className?: string;
}

// ─── Adapter helpers (ship with component) ───────────────────

/** Maps your pm_tasks status strings to GanttStatus */
export const STATUS_MAP: Record<string, GanttStatus> = {
  'not_started':  'notstarted',
  'not started':  'notstarted',
  'todo':         'notstarted',
  'in_progress':  'inprogress',
  'in progress':  'inprogress',
  'active':       'inprogress',
  'completed':    'completed',
  'done':         'completed',
  'on_hold':      'onhold',
  'on hold':      'onhold',
  'blocked':      'onhold',
  'at_risk':      'atrisk',
  'at risk':      'atrisk',
};

/** Maps your pm_tasks priority strings to GanttPriority */
export const PRIORITY_MAP: Record<string, GanttPriority> = {
  'critical': 'critical',
  'urgent':   'critical',
  'high':     'high',
  'medium':   'medium',
  'normal':   'medium',
  'low':      'low',
};

/**
 * One-line adapter: converts a raw pm_tasks row to GanttTask.
 * Adjust field names to match your actual schema.
 */
export function pmTaskToGanttTask(row: {
  id: string | number;
  title: string;
  status?: string;
  priority?: string;
  assignee?: string;
  due_date?: string;
  start_date?: string;
  parent_id?: string | null;
  [key: string]: unknown;
}): GanttTask {
  const today = new Date().toISOString().split('T')[0];
  const start = (row.start_date as string) || (row.due_date as string) || today;
  const end   = (row.due_date   as string) || start;

  return {
    id:       String(row.id),
    name:     row.title,
    type:     'task',
    start,
    end,
    progress: 0,
    status:   STATUS_MAP[(row.status as string)?.toLowerCase() ?? ''] ?? 'notstarted',
    priority: PRIORITY_MAP[(row.priority as string)?.toLowerCase() ?? ''] ?? 'medium',
    resources: row.assignee ? [String(row.assignee)] : [],
    parent:   row.parent_id ? String(row.parent_id) : null,
  };
}
