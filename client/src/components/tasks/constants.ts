import type { AggregatedTask, TaskSource, TaskStatus, TaskPriority } from "@shared/models/tasks";

export type { AggregatedTask, TaskSource, TaskStatus, TaskPriority };

export const TASK_SOURCES: { value: TaskSource | "all"; label: string }[] = [
  { value: "all", label: "All Sources" },
  { value: "project", label: "Project" },
  { value: "team", label: "Team" },
  { value: "meeting", label: "Meeting" },
  { value: "personal", label: "Personal" },
  { value: "helpdesk", label: "Helpdesk" },
  { value: "approval", label: "Approval" },
];

export const TASK_STATUSES: { value: TaskStatus | "all" | "overdue"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "overdue", label: "Overdue" },
];

export const TASK_PRIORITIES: { value: TaskPriority | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export const DUE_DATE_PRESETS = [
  { value: "all", label: "All dates" },
  { value: "today", label: "Due today" },
  { value: "this_week", label: "Due this week" },
  { value: "this_month", label: "Due this month" },
  { value: "overdue", label: "Overdue" },
  { value: "no_due", label: "No due date" },
];

export const GROUP_OPTIONS = [
  { value: "source", label: "Source" },
  { value: "projectName", label: "Project" },
  { value: "workspaceName", label: "Client / Workspace" },
  { value: "priority", label: "Priority" },
  { value: "dueGroup", label: "Due Date" },
  { value: "status", label: "Status" },
];

export const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  in_progress: "bg-status-green text-status-green-foreground",
  completed: "bg-status-blue text-status-blue-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

export const SOURCE_COLORS: Record<TaskSource, string> = {
  project: "bg-status-teal/20 text-status-teal-foreground",
  team: "bg-status-amber/20 text-status-amber-foreground",
  meeting: "bg-status-purple/20 text-status-purple-foreground",
  personal: "bg-status-blue/20 text-status-blue-foreground",
  helpdesk: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  approval: "bg-status-red/20 text-status-red-foreground",
};

export interface TaskFilters {
  source: string;
  status: string;
  priority: string;
  dueDatePreset: string;
  workspaceId: string;
  projectId: string;
  search: string;
}

export const DEFAULT_FILTERS: TaskFilters = {
  source: "all",
  status: "all",
  priority: "all",
  dueDatePreset: "all",
  workspaceId: "all",
  projectId: "all",
  search: "",
};

export function filtersToQuery(filters: TaskFilters): string {
  const params = new URLSearchParams();
  if (filters.source !== "all") params.set("source", filters.source);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.priority !== "all") params.set("priority", filters.priority);
  if (filters.dueDatePreset !== "all") params.set("dueDatePreset", filters.dueDatePreset);
  if (filters.workspaceId !== "all") params.set("workspaceId", filters.workspaceId);
  if (filters.projectId !== "all") params.set("projectId", filters.projectId);
  if (filters.search) params.set("search", filters.search);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function buildTasksQueryKey(filters: TaskFilters) {
  return [`/api/tasks${filtersToQuery(filters)}`];
}

export function dueGroupLabel(dueDate: string | null | undefined, isOverdue?: boolean): string {
  if (!dueDate) return "No due date";
  if (isOverdue) return "Overdue";
  const today = new Date().toISOString().slice(0, 10);
  if (dueDate === today) return "Today";
  const endWeek = new Date();
  endWeek.setDate(endWeek.getDate() + (7 - endWeek.getDay()));
  if (dueDate <= endWeek.toISOString().slice(0, 10)) return "This week";
  const endMonth = new Date();
  endMonth.setMonth(endMonth.getMonth() + 1, 0);
  if (dueDate <= endMonth.toISOString().slice(0, 10)) return "This month";
  return "Later";
}
