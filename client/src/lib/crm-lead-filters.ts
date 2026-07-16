/** Infinity-style lead filter field matching */

export type LeadFilterField =
  | "status"
  | "source"
  | "rating"
  | "temperature"
  | "industry"
  | "title"
  | "company"
  | "owner"
  | "score";

export type LeadFilterOperator =
  | "is"
  | "is_not"
  | "contains"
  | "not_contains"
  | "is_empty"
  | "is_not_empty"
  | "gt"
  | "lt";

export interface LeadFilterRule {
  id: string;
  field: LeadFilterField;
  operator: LeadFilterOperator;
  value: string;
}

export const FILTER_FIELDS: { field: LeadFilterField; label: string }[] = [
  { field: "status", label: "Status" },
  { field: "source", label: "Source" },
  { field: "rating", label: "Rating" },
  { field: "temperature", label: "Temperature" },
  { field: "industry", label: "Industry" },
  { field: "title", label: "Title" },
  { field: "company", label: "Company" },
  { field: "owner", label: "Owner" },
  { field: "score", label: "Score" },
];

export const FILTER_OPERATORS: { value: LeadFilterOperator; label: string; needsValue: boolean }[] = [
  { value: "is", label: "is", needsValue: true },
  { value: "is_not", label: "is not", needsValue: true },
  { value: "contains", label: "contains", needsValue: true },
  { value: "not_contains", label: "does not contain", needsValue: true },
  { value: "is_empty", label: "is empty", needsValue: false },
  { value: "is_not_empty", label: "is not empty", needsValue: false },
  { value: "gt", label: ">", needsValue: true },
  { value: "lt", label: "<", needsValue: true },
];

export function matchLeadFilterValue(
  fieldValue: string,
  operator: LeadFilterOperator,
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
