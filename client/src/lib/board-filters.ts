/** Generic Monday board filter field matching (extracted from CRM Leads). */

export type BoardFilterOperator =
  | "is"
  | "is_not"
  | "contains"
  | "not_contains"
  | "is_empty"
  | "is_not_empty"
  | "gt"
  | "lt";

export interface BoardFilterRule {
  id: string;
  field: string;
  operator: BoardFilterOperator;
  value: string;
}

export interface BoardFilterFieldDef {
  field: string;
  label: string;
  /** When true, value is free text (also forced for contains/gt/lt). */
  textInput?: boolean;
}

export interface BoardSortFieldDef {
  field: string;
  label: string;
}

export interface BoardSortRule {
  field: string;
  dir: "asc" | "desc";
}

export const BOARD_FILTER_OPERATORS: {
  value: BoardFilterOperator;
  label: string;
  needsValue: boolean;
}[] = [
  { value: "is", label: "is", needsValue: true },
  { value: "is_not", label: "is not", needsValue: true },
  { value: "contains", label: "contains", needsValue: true },
  { value: "not_contains", label: "does not contain", needsValue: true },
  { value: "is_empty", label: "is empty", needsValue: false },
  { value: "is_not_empty", label: "is not empty", needsValue: false },
  { value: "gt", label: ">", needsValue: true },
  { value: "lt", label: "<", needsValue: true },
];

export function matchBoardFilterValue(
  fieldValue: string,
  operator: BoardFilterOperator,
  ruleValue: string,
): boolean {
  const fv = fieldValue ?? "";
  const rv = ruleValue ?? "";
  switch (operator) {
    case "is":
      return fv === rv;
    case "is_not":
      return fv !== rv;
    case "contains":
      return fv.toLowerCase().includes(rv.toLowerCase());
    case "not_contains":
      return !fv.toLowerCase().includes(rv.toLowerCase());
    case "is_empty":
      return !fv.trim();
    case "is_not_empty":
      return !!fv.trim();
    case "gt":
      return Number(fv) > Number(rv);
    case "lt":
      return Number(fv) < Number(rv);
    default:
      return true;
  }
}

export function newBoardFilterRule(field: string): BoardFilterRule {
  return {
    id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    field,
    operator: "is",
    value: "",
  };
}

export type BoardViewMode =
  | "table"
  | "list"
  | "board"
  | "calendar"
  | "gantt"
  | "document"
  | "chart"
  | "form"
  | "dashboard"
  | "timesheet";

export const BOARD_VIEW_MODES: BoardViewMode[] = [
  "table",
  "list",
  "board",
  "calendar",
  "gantt",
  "document",
  "chart",
  "form",
  "dashboard",
  "timesheet",
];

/** API base for board saved views (aliases CRM storage). */
export const BOARD_SAVED_VIEWS_API = "/api/board-saved-views";

export type BoardViewSnapshot = {
  filters: BoardFilterRule[];
  sorts: BoardSortRule[];
  columns: { id: string; header: string; visible: boolean; order: number }[];
  viewMode?: string;
  groupBy?: string;
};

/** Encode snapshot into filters jsonb (backward-compatible with Leads __leadViewV2). */
export function encodeBoardViewFilters(snapshot: {
  rules: BoardFilterRule[];
  viewMode?: string;
  groupBy?: string;
  sorts?: BoardSortRule[];
}) {
  return {
    __boardViewV2: true,
    __leadViewV2: true,
    rules: snapshot.rules,
    viewMode: snapshot.viewMode || "table",
    groupBy: snapshot.groupBy || "none",
    sorts: snapshot.sorts || [],
  };
}

export function decodeBoardViewFilters(filtersRaw: unknown): {
  rules: BoardFilterRule[];
  viewMode: string;
  groupBy: string;
  sorts: BoardSortRule[];
} {
  if (
    filtersRaw &&
    typeof filtersRaw === "object" &&
    !Array.isArray(filtersRaw) &&
    ((filtersRaw as { __boardViewV2?: boolean }).__boardViewV2 ||
      (filtersRaw as { __leadViewV2?: boolean }).__leadViewV2)
  ) {
    const v = filtersRaw as {
      rules?: BoardFilterRule[];
      viewMode?: string;
      groupBy?: string;
      sorts?: BoardSortRule[];
    };
    return {
      rules: Array.isArray(v.rules) ? v.rules : [],
      viewMode: v.viewMode || "table",
      groupBy: v.groupBy || "none",
      sorts: Array.isArray(v.sorts) ? v.sorts : [],
    };
  }
  if (Array.isArray(filtersRaw)) {
    return {
      rules: filtersRaw as BoardFilterRule[],
      viewMode: "table",
      groupBy: "none",
      sorts: [],
    };
  }
  return { rules: [], viewMode: "table", groupBy: "none", sorts: [] };
}
