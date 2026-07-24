import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { ColumnDef, GroupDef } from "@/components/MondayTable";
import type { CrmCustomFieldDef } from "@/lib/crm-custom-fields";
import { CrmCustomFieldCell } from "@/components/crm/CrmCustomFieldCell";

/** monday.com board toolbar control — shared across CRM entity tabs */
export function crmToolBtn(active = false) {
  return cn(
    "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[13px] font-medium transition-colors whitespace-nowrap",
    "text-foreground hover:bg-muted",
    active && "bg-primary/15 text-primary hover:bg-primary/15",
  );
}

export function crmIconBtn(active = false) {
  return cn(
    "inline-flex items-center justify-center h-8 w-8 rounded-md transition-colors",
    "text-muted-foreground hover:bg-muted hover:text-foreground",
    active && "bg-primary/15 text-primary hover:bg-primary/15",
  );
}

export const CRM_TOOLBAR_CLASS =
  "flex items-center gap-1 min-w-0 overflow-x-auto overscroll-x-contain rounded-lg border border-border bg-muted/80 px-2 py-1.5 [-ms-overflow-style:none] [scrollbar-width:thin]";

export const CRM_SEARCH_INPUT_CLASS =
  "pl-8 h-8 w-[200px] rounded-md border-border text-[13px] bg-background shadow-none focus-visible:ring-primary";

/** Debounce a string for search/filter without changing the controlled input value. */
export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/** Build MondayTable columns for CRM custom fields with real column types (icons). */
export function buildCrmCustomFieldColumns<T extends { customData?: Record<string, unknown> | null }>(
  fields: CrmCustomFieldDef[],
  isVisible: (id: string) => boolean = () => true,
  opts?: { editable?: boolean },
): ColumnDef<T>[] {
  const editable = opts?.editable ?? false;
  return fields
    .filter((f) => isVisible(`custom_${f.fieldName}`))
    .map((f) => {
      const ft = (f.fieldType || "text").toLowerCase();
      const type =
        ft === "number" || ft === "currency" || ft === "percent"
          ? ("number" as const)
          : ft === "date" || ft === "datetime"
            ? ("date" as const)
            : ft === "dropdown" || ft === "select" || ft === "status"
              ? ("status" as const)
              : ft === "url" || ft === "link"
                ? ("link" as const)
                : ("text" as const);
      return {
        id: `custom_${f.fieldName}`,
        header: f.fieldLabel,
        type,
        accessor: (row: T) => {
          const data = row.customData && typeof row.customData === "object" ? row.customData : {};
          return data[f.fieldName];
        },
        width: "140px",
        editable,
        render: (row: T) => {
          const data = row.customData && typeof row.customData === "object" ? row.customData : {};
          return <CrmCustomFieldCell field={f} value={data[f.fieldName]} />;
        },
      };
    });
}

/** Convert a Record<groupName, items[]> into MondayTable GroupDef[]. */
export function recordToMondayGroups<T extends { id: number | string }>(
  grouped: Record<string, T[]> | null | undefined,
  colorByTitle?: Record<string, string>,
  summaryFn?: (items: T[]) => string | undefined,
): GroupDef<T>[] | undefined {
  if (!grouped) return undefined;
  return Object.entries(grouped).map(([title, items]) => ({
    id: title,
    title,
    color: colorByTitle?.[title] || "#579bfc",
    items,
    count: items.length,
    summary: summaryFn?.(items),
  }));
}

/** Standard MondayTable pagination props for CRM lists (always on, including grouped). */
export function crmMondayPagination(resetKey: string, defaultPageSize = 25) {
  return { defaultPageSize, resetKey };
}

/** Download a CSV file (export or import template) — same helper pattern as CRM Leads. */
export function downloadBoardCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (c: string) => `"${String(c ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Build and download an import template CSV with one example row (Leads parity). */
export function downloadImportTemplateCsv(
  filename: string,
  headers: string[],
  exampleRow: Record<string, string> | string[],
) {
  const example = Array.isArray(exampleRow)
    ? exampleRow
    : headers.map((h) => exampleRow[h] ?? "");
  downloadBoardCsv(filename, headers, [example]);
}
