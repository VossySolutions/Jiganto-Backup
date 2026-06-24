import { PROJECT_TASK_TRACKER_COLUMNS } from "../../shared/workspace-task-tracker";

/** Project & module tracking boards use the canonical 12-column task tracker schema. */
export const SPEC_DEFAULT_COLUMNS = PROJECT_TASK_TRACKER_COLUMNS;

export const VALID_COLUMN_TYPES = [
  "text",
  "long_text",
  "number",
  "select",
  "multi_select",
  "date",
  "checkbox",
  "person",
  "url",
  "rating",
  "rag",
  "created_date",
] as const;

export type WorkspacePermission = "view" | "edit" | "admin";

export function normalizeMemberPermission(role?: string | null): WorkspacePermission {
  if (role === "view" || role === "viewer") return "view";
  if (role === "admin" || role === "owner") return "admin";
  return "edit";
}

/** Create spec default columns on a new board database. Returns column id map by name. */
export async function seedSpecDefaultBoard(
  createColumn: (col: {
    databaseId: number;
    name: string;
    type: string;
    sortOrder: number;
    options?: unknown;
    width?: number | null;
    isVisible?: boolean;
  }) => Promise<{ id: number; name: string }>,
  databaseId: number,
): Promise<Map<string, number>> {
  const idMap = new Map<string, number>();
  for (const col of SPEC_DEFAULT_COLUMNS) {
    const created = await createColumn({
      databaseId,
      name: col.name,
      type: col.type,
      sortOrder: col.sortOrder,
      options: col.options ?? null,
      width: col.width ?? null,
      isVisible: true,
    });
    idMap.set(col.name, created.id);
  }
  return idMap;
}
