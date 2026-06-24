import { useCallback, useEffect, useRef, useState } from "react";
import type { DropResult } from "@hello-pangea/dnd";
import { applyKanbanDrag, type KanbanDragMove } from "./kanban-utils";

export function useKanbanItems<T>({
  items,
  columnIds,
  getItemId,
  getColumnId,
  setColumnId,
  idPrefix = "item-",
  onMoveFailed,
}: {
  items: T[];
  columnIds: string[];
  getItemId: (item: T) => string;
  getColumnId: (item: T) => string;
  setColumnId: (item: T, columnId: string) => T;
  idPrefix?: string;
  onMoveFailed?: (move: KanbanDragMove<T>, error: unknown) => void;
}) {
  const [localItems, setLocalItems] = useState(items);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const dragPendingRef = useRef(false);

  useEffect(() => {
    if (!dragPendingRef.current) setLocalItems(items);
  }, [items]);

  const revert = useCallback(() => setLocalItems(items), [items]);

  const handleDragEnd = useCallback(
    (
      result: DropResult,
      onMove: (move: KanbanDragMove<T>) => void | Promise<void>,
      isAllowed?: (move: KanbanDragMove<T>) => boolean,
    ) => {
      const applied = applyKanbanDrag(
        localItems,
        result,
        columnIds,
        getItemId,
        getColumnId,
        setColumnId,
        idPrefix,
      );
      if (!applied) return;

      if (isAllowed && !isAllowed(applied.move)) return;

      const snapshot = localItems;
      dragPendingRef.current = true;
      setPendingItemId(applied.move.itemId);
      setLocalItems(applied.nextItems);

      void Promise.resolve(onMove(applied.move))
        .catch((error) => {
          setLocalItems(snapshot);
          onMoveFailed?.(applied.move, error);
        })
        .finally(() => {
          dragPendingRef.current = false;
          setPendingItemId(null);
        });
    },
    [localItems, columnIds, getItemId, getColumnId, setColumnId, idPrefix, onMoveFailed],
  );

  return { localItems, handleDragEnd, revert, setLocalItems, pendingItemId, isSaving: pendingItemId !== null };
}
