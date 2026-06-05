import type { ColumnDef } from "@/components/MondayTable";

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "less_than"
  | "greater_equal"
  | "less_equal"
  | "between"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty";

export type FormatScope = "cell" | "row";

export interface ConditionalFormatStyle {
  bgColor?: string;
  textColor?: string;
  bold?: boolean;
  italic?: boolean;
}

export interface ConditionalFormatRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  scope: FormatScope;
  columnId: string;
  operator: ConditionOperator;
  value?: string | number;
  value2?: string | number;
  style: ConditionalFormatStyle;
}

export interface CellFormatMap {
  [rowId: string]: {
    row?: ConditionalFormatStyle;
    cells?: { [columnId: string]: ConditionalFormatStyle };
  };
}

export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  rules: Omit<ConditionalFormatRule, "id">[];
}

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: "Equals",
  not_equals: "Does not equal",
  greater_than: "Greater than",
  less_than: "Less than",
  greater_equal: "Greater or equal",
  less_equal: "Less or equal",
  between: "Between",
  contains: "Contains",
  not_contains: "Does not contain",
  starts_with: "Starts with",
  ends_with: "Ends with",
  is_empty: "Is empty",
  is_not_empty: "Is not empty",
};

export function getOperatorLabel(op: ConditionOperator): string {
  return OPERATOR_LABELS[op] || op;
}

export function getOperatorsForColumnType(type: string): ConditionOperator[] {
  switch (type) {
    case "number":
    case "currency":
    case "progress":
      return [
        "equals", "not_equals",
        "greater_than", "less_than",
        "greater_equal", "less_equal",
        "between",
        "is_empty", "is_not_empty",
      ];
    case "text":
    case "link":
      return [
        "equals", "not_equals",
        "contains", "not_contains",
        "starts_with", "ends_with",
        "is_empty", "is_not_empty",
      ];
    case "status":
    case "priority":
    case "rag":
    case "tags":
      return [
        "equals", "not_equals",
        "contains", "not_contains",
        "is_empty", "is_not_empty",
      ];
    case "date":
    case "timeline":
      return [
        "equals", "not_equals",
        "greater_than", "less_than",
        "between",
        "is_empty", "is_not_empty",
      ];
    case "checkbox":
      return ["equals", "not_equals"];
    case "person":
      return ["is_empty", "is_not_empty", "contains"];
    default:
      return [
        "equals", "not_equals",
        "contains", "not_contains",
        "is_empty", "is_not_empty",
      ];
  }
}

export function operatorNeedsValue(op: ConditionOperator): boolean {
  return op !== "is_empty" && op !== "is_not_empty";
}

export function operatorNeedsSecondValue(op: ConditionOperator): boolean {
  return op === "between";
}

function coerceToNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (val instanceof Date) return val.getTime();
  if (typeof val === "string") {
    const n = Number(val);
    if (!isNaN(n)) return n;
    const d = Date.parse(val);
    if (!isNaN(d)) return d;
    return null;
  }
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function coerceToString(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") {
    if (Array.isArray(val)) return val.join(", ");
    return JSON.stringify(val);
  }
  return String(val);
}

function isEmpty(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === "string" && val.trim() === "") return true;
  if (Array.isArray(val) && val.length === 0) return true;
  return false;
}

function evaluateCondition(
  cellValue: unknown,
  operator: ConditionOperator,
  ruleValue?: string | number,
  ruleValue2?: string | number
): boolean {
  switch (operator) {
    case "is_empty":
      return isEmpty(cellValue);
    case "is_not_empty":
      return !isEmpty(cellValue);
    case "equals": {
      const cv = coerceToString(cellValue).toLowerCase();
      const rv = coerceToString(ruleValue).toLowerCase();
      return cv === rv;
    }
    case "not_equals": {
      const cv = coerceToString(cellValue).toLowerCase();
      const rv = coerceToString(ruleValue).toLowerCase();
      return cv !== rv;
    }
    case "contains": {
      const cv = coerceToString(cellValue).toLowerCase();
      const rv = coerceToString(ruleValue).toLowerCase();
      return cv.includes(rv);
    }
    case "not_contains": {
      const cv = coerceToString(cellValue).toLowerCase();
      const rv = coerceToString(ruleValue).toLowerCase();
      return !cv.includes(rv);
    }
    case "starts_with": {
      const cv = coerceToString(cellValue).toLowerCase();
      const rv = coerceToString(ruleValue).toLowerCase();
      return cv.startsWith(rv);
    }
    case "ends_with": {
      const cv = coerceToString(cellValue).toLowerCase();
      const rv = coerceToString(ruleValue).toLowerCase();
      return cv.endsWith(rv);
    }
    case "greater_than": {
      const cn = coerceToNumber(cellValue);
      const rn = coerceToNumber(ruleValue);
      if (cn === null || rn === null) return false;
      return cn > rn;
    }
    case "less_than": {
      const cn = coerceToNumber(cellValue);
      const rn = coerceToNumber(ruleValue);
      if (cn === null || rn === null) return false;
      return cn < rn;
    }
    case "greater_equal": {
      const cn = coerceToNumber(cellValue);
      const rn = coerceToNumber(ruleValue);
      if (cn === null || rn === null) return false;
      return cn >= rn;
    }
    case "less_equal": {
      const cn = coerceToNumber(cellValue);
      const rn = coerceToNumber(ruleValue);
      if (cn === null || rn === null) return false;
      return cn <= rn;
    }
    case "between": {
      const cn = coerceToNumber(cellValue);
      const rn1 = coerceToNumber(ruleValue);
      const rn2 = coerceToNumber(ruleValue2);
      if (cn === null || rn1 === null || rn2 === null) return false;
      return cn >= rn1 && cn <= rn2;
    }
    default:
      return false;
  }
}

function getCellValueByColumnId<T>(
  row: T,
  columnId: string,
  columns: ColumnDef<T>[]
): unknown {
  const col = columns.find(c => c.id === columnId);
  if (!col) return undefined;
  if (typeof col.accessor === "function") return col.accessor(row);
  return (row as Record<string, unknown>)[col.accessor as string];
}

export function evaluateConditionalFormatting<T extends { id: number | string }>(
  rows: T[],
  columns: ColumnDef<T>[],
  rules: ConditionalFormatRule[]
): CellFormatMap {
  const enabledRules = rules
    .filter(r => r.enabled)
    .sort((a, b) => a.priority - b.priority || rules.indexOf(a) - rules.indexOf(b));

  if (enabledRules.length === 0) return {};

  const result: CellFormatMap = {};

  for (const row of rows) {
    const rowId = String(row.id);

    for (const rule of enabledRules) {
      const cellValue = getCellValueByColumnId(row, rule.columnId, columns);
      const matches = evaluateCondition(cellValue, rule.operator, rule.value, rule.value2);

      if (!matches) continue;

      if (!result[rowId]) result[rowId] = {};

      if (rule.scope === "row") {
        if (!result[rowId].row) {
          result[rowId].row = { ...rule.style };
        }
      } else {
        if (!result[rowId].cells) result[rowId].cells = {};
        if (!result[rowId].cells![rule.columnId]) {
          result[rowId].cells![rule.columnId] = { ...rule.style };
        }
      }
    }
  }

  return result;
}

export function styleToClassAndInline(style: ConditionalFormatStyle): {
  className: string;
  inlineStyle: React.CSSProperties;
} {
  const classes: string[] = [];
  const inline: React.CSSProperties = {};

  if (style.bold) classes.push("font-bold");
  if (style.italic) classes.push("italic");
  if (style.bgColor) inline.backgroundColor = style.bgColor;
  if (style.textColor) inline.color = style.textColor;

  return { className: classes.join(" "), inlineStyle: inline };
}

export function generateRuleId(): string {
  return `cf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createDefaultRule(columnId?: string, nextPriority: number = 1): ConditionalFormatRule {
  return {
    id: generateRuleId(),
    name: "New Rule",
    enabled: true,
    priority: nextPriority,
    scope: "cell",
    columnId: columnId || "",
    operator: "equals",
    value: "",
    style: {
      bgColor: "#FFE0E0",
      textColor: "#B00020",
      bold: false,
      italic: false,
    },
  };
}

export const PRESET_COLORS = [
  { label: "Red", bg: "#FFE0E0", text: "#B00020" },
  { label: "Orange", bg: "#FFF3E0", text: "#E65100" },
  { label: "Yellow", bg: "#FFF9C4", text: "#F57F17" },
  { label: "Green", bg: "#E8F5E9", text: "#1B5E20" },
  { label: "Blue", bg: "#E3F2FD", text: "#0D47A1" },
  { label: "Purple", bg: "#F3E5F5", text: "#4A148C" },
  { label: "Grey", bg: "#F5F5F5", text: "#424242" },
  { label: "Teal", bg: "#E0F2F1", text: "#004D40" },
];

export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    id: "rag-status",
    name: "RAG Status Colors",
    description: "Red/Amber/Green colors based on a status field",
    rules: [
      {
        name: "RAG - Red",
        enabled: true,
        priority: 1,
        scope: "row",
        columnId: "",
        operator: "equals",
        value: "red",
        style: { bgColor: "#FFE0E0", textColor: "#B00020" },
      },
      {
        name: "RAG - Amber",
        enabled: true,
        priority: 2,
        scope: "row",
        columnId: "",
        operator: "equals",
        value: "amber",
        style: { bgColor: "#FFF3E0", textColor: "#E65100" },
      },
      {
        name: "RAG - Green",
        enabled: true,
        priority: 3,
        scope: "row",
        columnId: "",
        operator: "equals",
        value: "green",
        style: { bgColor: "#E8F5E9", textColor: "#1B5E20" },
      },
    ],
  },
  {
    id: "high-value",
    name: "High Value Alert",
    description: "Highlight cells with values above a threshold",
    rules: [
      {
        name: "High Value",
        enabled: true,
        priority: 1,
        scope: "cell",
        columnId: "",
        operator: "greater_than",
        value: 10000,
        style: { bgColor: "#FFE0E0", textColor: "#B00020", bold: true },
      },
    ],
  },
  {
    id: "status-colors",
    name: "Status Color Mapping",
    description: "Color rows by common status values",
    rules: [
      {
        name: "Status - Done",
        enabled: true,
        priority: 1,
        scope: "row",
        columnId: "",
        operator: "equals",
        value: "done",
        style: { bgColor: "#E8F5E9", textColor: "#1B5E20" },
      },
      {
        name: "Status - In Progress",
        enabled: true,
        priority: 2,
        scope: "row",
        columnId: "",
        operator: "equals",
        value: "in_progress",
        style: { bgColor: "#E3F2FD", textColor: "#0D47A1" },
      },
      {
        name: "Status - Stuck",
        enabled: true,
        priority: 3,
        scope: "row",
        columnId: "",
        operator: "equals",
        value: "stuck",
        style: { bgColor: "#FFE0E0", textColor: "#B00020" },
      },
    ],
  },
  {
    id: "empty-fields",
    name: "Highlight Empty Fields",
    description: "Flag cells that have no value",
    rules: [
      {
        name: "Empty Field",
        enabled: true,
        priority: 1,
        scope: "cell",
        columnId: "",
        operator: "is_empty",
        style: { bgColor: "#FFF9C4", textColor: "#F57F17", italic: true },
      },
    ],
  },
];
