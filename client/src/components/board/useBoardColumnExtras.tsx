import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Plus, Settings2 } from "lucide-react";
import type { ColumnDef, StatusOption } from "@/components/MondayTable";
import type { BoardColumnMenuItem } from "@/components/board/BoardColumnsMenu";
import { BoardAddColumnDialog } from "@/components/board/BoardAddColumnDialog";
import { BoardCustomFieldsDialog } from "@/components/board/BoardCustomFieldsDialog";
import { BoardLabelEditorDialog } from "@/components/board/BoardLabelEditorDialog";
import {
  useBoardCustomFields,
  useBoardFieldValues,
} from "@/hooks/use-board-custom-fields";
import { parseFieldOptions } from "@/lib/crm-custom-fields";
import {
  LABEL_COLOR_PRESETS,
  defaultLabelOptionsFromValues,
  humanizeLabelValue,
  loadBoardLabels,
  mergeBoardLabels,
  saveBoardLabels,
} from "@/lib/board-labels";

type AnyRow = { id: number | string };

const LABEL_COLUMN_TYPES = new Set(["status", "select"]);

function readValue<T extends AnyRow>(column: ColumnDef<T>, row: T): unknown {
  if (typeof column.accessor === "function") return column.accessor(row);
  if (typeof column.accessor === "string") return (row as Record<string, unknown>)[column.accessor];
  return (row as Record<string, unknown>)[column.id];
}

function customFieldColumnType(fieldType: string) {
  const ft = (fieldType || "text").toLowerCase();
  if (ft === "number" || ft === "currency" || ft === "percent") return "number" as const;
  if (ft === "date" || ft === "datetime") return "date" as const;
  if (ft === "dropdown" || ft === "select" || ft === "status") return "status" as const;
  // No generic multi-value editor in MondayTable; a single-pick select still honors options
  if (ft === "multi-select" || ft === "multi_select" || ft === "multiselect") return "select" as const;
  if (ft === "url" || ft === "link") return "link" as const;
  if (ft === "checkbox") return "checkbox" as const;
  return "text" as const;
}

/** Coerce text storage back into the type MondayTable cells expect. */
function coerceStoredValue(type: ReturnType<typeof customFieldColumnType>, raw: string | null) {
  if (raw == null || raw === "") return type === "checkbox" ? false : null;
  if (type === "checkbox") return raw === "true" || raw === "1";
  if (type === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return raw;
}

function optionsFromStrings(values: string[]): StatusOption[] {
  return values.map((value, index) => ({
    value,
    label: humanizeLabelValue(value),
    color: LABEL_COLOR_PRESETS[index % LABEL_COLOR_PRESETS.length].className,
  }));
}

export type BoardColumnExtras<T extends AnyRow> = {
  /** Columns-menu items above the visibility list (Add column, custom fields, labels). */
  headerActions: ReactNode;
  /** Dialogs the menu items open — must be mounted outside the dropdown. */
  dialogs: ReactNode;
  /** Custom columns to append to the Columns menu visibility list. */
  customMenuItems: BoardColumnMenuItem[];
  isCustomColumn: (id: string) => boolean;
  setCustomColumnVisible: (id: string, visible: boolean) => void;
  moveCustomColumn: (id: string, direction: -1 | 1) => void;
  /** Adds label options / Edit labels, then appends the board's custom columns. */
  decorateColumns: (columns: ColumnDef<T>[], data?: T[]) => ColumnDef<T>[];
  /** Returns true when the edit targeted a custom column and was persisted here. */
  interceptCellEdit: (rowId: number | string, columnId: string, value: unknown) => boolean;
};

/**
 * Everything the CRM Leads Columns menu offers, for any board: add column,
 * manage custom fields, per-column label editors and generic custom columns.
 */
export function useBoardColumnExtras<T extends AnyRow>({
  entityType,
  storageKey,
  entityLabel,
  columns,
  ownsCustomColumns = false,
  isHostColumnVisible,
  onHostColumnVisible,
}: {
  entityType: string;
  storageKey: string;
  entityLabel?: string;
  columns: ColumnDef<T>[];
  /** True when the screen already renders its own `custom_*` columns (CRM tabs). */
  ownsCustomColumns?: boolean;
  /** Host visibility for owned custom columns (CRM tabs). */
  isHostColumnVisible?: (id: string) => boolean;
  onHostColumnVisible?: (id: string, visible: boolean) => void;
}): BoardColumnExtras<T> {
  const { fields } = useBoardCustomFields(entityType);
  const { getValue, setValue } = useBoardFieldValues(entityType, !ownsCustomColumns);

  const [addOpen, setAddOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [labelEditor, setLabelEditor] = useState<{
    columnId: string;
    title: string;
    options: StatusOption[];
  } | null>(null);
  const [labelVersion, setLabelVersion] = useState(0);
  const [hiddenCustom, setHiddenCustom] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(`${storageKey}-custom-cols-hidden`);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  });
  const [customOrder, setCustomOrder] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(`${storageKey}-custom-cols-order`);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  });

  const labelColumns = useMemo(
    () => columns.filter((column) => LABEL_COLUMN_TYPES.has(column.type)),
    [columns],
  );

  // Rows only feed label suggestions, so they stay in a ref: putting inline
  // filtered arrays in state would re-render the board on every pass.
  const dataRef = useRef<T[]>([]);

  const optionsForColumn = useCallback(
    (column: ColumnDef<T>): StatusOption[] => {
      const fallback =
        column.options && column.options.length
          ? column.options
          : defaultLabelOptionsFromValues(
              dataRef.current.map((row) => String(readValue(column, row) ?? "")).filter(Boolean),
            );
      return mergeBoardLabels(loadBoardLabels(storageKey, column.id), fallback);
    },
    // labelVersion re-reads localStorage after the editor saves
    [storageKey, labelVersion],
  );

  const customColumns = useMemo<ColumnDef<T>[]>(() => {
    if (ownsCustomColumns) return [];
    const built = fields.map((field) => {
      const type = customFieldColumnType(field.fieldType);
      const saved = loadBoardLabels(storageKey, `custom_${field.fieldName}`);
      const base =
        type === "status" || type === "select"
          ? optionsFromStrings(parseFieldOptions(field.options))
          : undefined;
      return {
        id: `custom_${field.fieldName}`,
        header: field.fieldLabel,
        type,
        accessor: (row: T) => coerceStoredValue(type, getValue(row.id, field.fieldName)),
        width: "140px",
        editable: true,
        options: base ? mergeBoardLabels(saved, base) : undefined,
        hidden: hiddenCustom.includes(`custom_${field.fieldName}`),
      } as ColumnDef<T>;
    });
    if (!customOrder.length) return built;
    const byId = new Map(built.map((column) => [column.id, column]));
    const ordered = customOrder.map((id) => byId.get(id)).filter(Boolean) as ColumnDef<T>[];
    for (const column of built) {
      if (!customOrder.includes(column.id)) ordered.push(column);
    }
    return ordered;
  }, [fields, ownsCustomColumns, getValue, hiddenCustom, customOrder, storageKey, labelVersion]);

  const setCustomColumnVisible = useCallback(
    (id: string, visible: boolean) => {
      setHiddenCustom((prev) => {
        const next = visible ? prev.filter((c) => c !== id) : Array.from(new Set([...prev, id]));
        if (typeof window !== "undefined") {
          localStorage.setItem(`${storageKey}-custom-cols-hidden`, JSON.stringify(next));
        }
        return next;
      });
    },
    [storageKey],
  );

  const moveCustomColumn = useCallback(
    (id: string, direction: -1 | 1) => {
      setCustomOrder((prev) => {
        const ids = prev.length
          ? [...prev]
          : fields.map((field) => `custom_${field.fieldName}`);
        // Keep newly added fields that aren't in the saved order yet
        for (const field of fields) {
          const colId = `custom_${field.fieldName}`;
          if (!ids.includes(colId)) ids.push(colId);
        }
        const idx = ids.indexOf(id);
        if (idx < 0) return ids;
        const nextIdx = idx + direction;
        if (nextIdx < 0 || nextIdx >= ids.length) return ids;
        const tmp = ids[idx];
        ids[idx] = ids[nextIdx];
        ids[nextIdx] = tmp;
        if (typeof window !== "undefined") {
          localStorage.setItem(`${storageKey}-custom-cols-order`, JSON.stringify(ids));
        }
        return ids;
      });
    },
    [fields, storageKey],
  );

  const decorateColumns = useCallback(
    (input: ColumnDef<T>[], data?: T[]): ColumnDef<T>[] => {
      if (data) dataRef.current = data;
      const decorated = input.map((column) => {
        if (!LABEL_COLUMN_TYPES.has(column.type)) return column;
        const saved = loadBoardLabels(storageKey, column.id);
        const fallback =
          column.options && column.options.length
            ? column.options
            : defaultLabelOptionsFromValues(
                dataRef.current.map((row) => String(readValue(column, row) ?? "")).filter(Boolean),
              );
        const options = saved ? mergeBoardLabels(saved, fallback) : fallback;
        return {
          ...column,
          options,
          onEditLabels:
            column.onEditLabels ??
            (() =>
              setLabelEditor({
                columnId: column.id,
                title: `Edit ${String(column.header).toLowerCase()} labels`,
                options,
              })),
        };
      });
      return [...decorated, ...customColumns];
    },
    [customColumns, storageKey, labelVersion],
  );

  const interceptCellEdit = useCallback(
    (rowId: number | string, columnId: string, value: unknown) => {
      if (ownsCustomColumns || !columnId.startsWith("custom_")) return false;
      const fieldName = columnId.slice("custom_".length);
      if (!fields.some((field) => field.fieldName === fieldName)) return false;
      void setValue(rowId, fieldName, value);
      return true;
    },
    [fields, ownsCustomColumns, setValue],
  );

  const headerActions = (
    <>
      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Add column</div>
      <DropdownMenuItem onClick={() => setAddOpen(true)} data-testid="button-add-column-type">
        <Plus className="h-3.5 w-3.5 mr-2" />
        Add column (choose type)…
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setManageOpen(true)} data-testid="button-manage-custom-fields">
        <Settings2 className="h-3.5 w-3.5 mr-2" />
        Manage custom fields…
      </DropdownMenuItem>
      {labelColumns
        .filter((column) => !column.onEditLabels)
        .map((column) => (
        <DropdownMenuItem
          key={`labels-${column.id}`}
          onClick={() =>
            setLabelEditor({
              columnId: column.id,
              title: `Edit ${String(column.header).toLowerCase()} labels`,
              options: optionsForColumn(column),
            })
          }
          data-testid={`button-edit-labels-${column.id}`}
        >
          Edit {String(column.header).toLowerCase()} labels…
        </DropdownMenuItem>
      ))}
    </>
  );

  const dialogs = (
    <>
      <BoardAddColumnDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        entityType={entityType}
        entityLabel={entityLabel}
        existingCount={fields.length}
        onCreated={(fieldName) => {
          const id = `custom_${fieldName}`;
          if (ownsCustomColumns) onHostColumnVisible?.(id, true);
          else setCustomColumnVisible(id, true);
        }}
      />
      <BoardCustomFieldsDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        entityType={entityType}
        entityLabel={entityLabel}
      />
      {labelEditor && (
        <BoardLabelEditorDialog
          open
          onOpenChange={(open) => {
            if (!open) setLabelEditor(null);
          }}
          title={labelEditor.title}
          options={labelEditor.options}
          onSave={(options) => {
            saveBoardLabels(storageKey, labelEditor.columnId, options);
            setLabelVersion((v) => v + 1);
            setLabelEditor(null);
          }}
        />
      )}
    </>
  );

  return {
    headerActions,
    dialogs,
    customMenuItems: ownsCustomColumns
      ? fields.map((field) => {
          const id = `custom_${field.fieldName}`;
          return {
            id,
            label: field.fieldLabel,
            kind: "custom" as const,
            visible: isHostColumnVisible?.(id) !== false,
          };
        })
      : customColumns.map((column) => ({
          id: column.id,
          label: String(column.header),
          kind: "custom" as const,
          visible: !hiddenCustom.includes(column.id),
        })),
    isCustomColumn: (id: string) =>
      ownsCustomColumns ? false : customColumns.some((column) => column.id === id),
    setCustomColumnVisible,
    moveCustomColumn,
    decorateColumns,
    interceptCellEdit,
  };
}
