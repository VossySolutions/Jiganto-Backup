export type CrmCustomFieldDef = {
  id: number;
  entityType: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  options?: unknown;
  position?: number;
  isRequired: boolean;
};

export const DEFAULT_FIELD_OPTIONS = ["Option A", "Option B", "Option C"];

export function parseFieldOptions(options: unknown): string[] {
  if (!options) return DEFAULT_FIELD_OPTIONS;
  if (Array.isArray(options)) return options.map(String).filter(Boolean);
  if (typeof options === "string") {
    return options.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
  }
  return DEFAULT_FIELD_OPTIONS;
}

export function parseOptionsInput(text: string): string[] {
  return text.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
}

export function normalizeMultiSelectValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value) return value.split(",").map(s => s.trim()).filter(Boolean);
  return [];
}

type OwnerResolver = (id: string | null | undefined) => { name: string };

export function formatCustomFieldDisplayValue(
  field: CrmCustomFieldDef,
  value: unknown,
  resolveOwner?: OwnerResolver,
): string {
  if (value == null || value === "") return "—";

  if (field.fieldType === "checkbox") return value ? "Yes" : "No";

  if (field.fieldType === "multi-select") {
    const items = normalizeMultiSelectValue(value);
    return items.length ? items.join(", ") : "—";
  }

  if (field.fieldType === "person" && resolveOwner) {
    return resolveOwner(String(value)).name;
  }

  if (field.fieldType === "date" && typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
  }

  return String(value);
}
