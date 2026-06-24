import type { DropResult } from "@hello-pangea/dnd";

export type KanbanDragMove<T> = {
  item: T;
  itemId: string;
  fromColumnId: string;
  toColumnId: string;
  fromIndex: number;
  toIndex: number;
  result: DropResult;
};

/**
 * Apply a drag result to a flat item list grouped by column id.
 * Returns null when the drag should be ignored.
 */
export function applyKanbanDrag<T>(
  items: T[],
  result: DropResult,
  columnIds: string[],
  getItemId: (item: T) => string,
  getColumnId: (item: T) => string,
  setColumnId: (item: T, columnId: string) => T,
  idPrefix = "item-",
): { nextItems: T[]; move: KanbanDragMove<T> } | null {
  const { source, destination, draggableId } = result;
  if (!destination) return null;
  if (source.droppableId === destination.droppableId && source.index === destination.index) {
    return null;
  }

  const rawId = draggableId.startsWith(idPrefix) ? draggableId.slice(idPrefix.length) : draggableId;
  const item = items.find((i) => getItemId(i) === rawId);
  if (!item) return null;

  const grouped = new Map<string, T[]>();
  for (const colId of columnIds) grouped.set(colId, []);
  for (const row of items) {
    const col = getColumnId(row);
    if (!grouped.has(col)) grouped.set(col, []);
    grouped.get(col)!.push(row);
  }

  const sourceList = grouped.get(source.droppableId);
  const destList = grouped.get(destination.droppableId);
  if (!sourceList || !destList) return null;

  const [removed] = sourceList.splice(source.index, 1);
  const updated = setColumnId(removed, destination.droppableId);
  destList.splice(destination.index, 0, updated);

  const nextItems = columnIds.flatMap((id) => grouped.get(id) ?? []);

  return {
    nextItems,
    move: {
      item: updated,
      itemId: rawId,
      fromColumnId: source.droppableId,
      toColumnId: destination.droppableId,
      fromIndex: source.index,
      toIndex: destination.index,
      result,
    },
  };
}
