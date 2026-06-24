/** Canonical Project & Task Tracker — single source of truth for column schema. */
export type TrackerColumnSpec = {
  name: string;
  type: string;
  sortOrder: number;
  options?: Record<string, unknown> | null;
  width?: number;
};

export const PROJECT_TASK_TRACKER_ID = "project-task-tracker";

export const PROJECT_TASK_TRACKER_COLUMNS: TrackerColumnSpec[] = [
  { name: "Task Title", type: "text", sortOrder: 0, options: { anchor: true }, width: 250 },
  { name: "Project", type: "text", sortOrder: 1, options: null, width: 180 },
  { name: "Description", type: "long_text", sortOrder: 2, options: null, width: 300 },
  {
    name: "Status",
    type: "select",
    sortOrder: 3,
    options: { choices: ["Not Started", "In Progress", "On Hold", "Completed"] },
    width: 140,
  },
  {
    name: "Priority",
    type: "select",
    sortOrder: 4,
    options: { choices: ["Critical", "High", "Medium", "Low"] },
    width: 120,
  },
  { name: "Owner", type: "person", sortOrder: 5, options: null, width: 150 },
  { name: "Due Date", type: "date", sortOrder: 6, options: null, width: 130 },
  { name: "Start Date", type: "date", sortOrder: 7, options: null, width: 130 },
  {
    name: "Tags",
    type: "multi_select",
    sortOrder: 8,
    options: { choices: ["Frontend", "Backend", "Design", "Testing", "Documentation"] },
    width: 200,
  },
  { name: "Dependencies", type: "text", sortOrder: 9, options: null, width: 200 },
  { name: "Effort Estimate", type: "number", sortOrder: 10, options: null, width: 130 },
  { name: "% Complete", type: "number", sortOrder: 11, options: null, width: 120 },
];

export const MODULE_TRACKER_PREFIX = "Module Task Tracker — ";

export function moduleTrackerBoardName(moduleKey: string, scopeId?: number | null, tenantId?: number | null): string {
  const tenantPrefix = tenantId != null && tenantId > 0 ? `[T${tenantId}] ` : "";
  if (scopeId != null && scopeId > 0) {
    return `${tenantPrefix}${MODULE_TRACKER_PREFIX}${moduleKey} (${scopeId})`;
  }
  return `${tenantPrefix}${MODULE_TRACKER_PREFIX}${moduleKey}`;
}
