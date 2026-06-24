import type { ReactNode } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult, type DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useKanbanItems } from "./use-kanban-items";
import type { KanbanDragMove } from "./kanban-utils";

export interface KanbanColumnDef {
  id: string;
  title: ReactNode;
  /** Optional top accent color (hex/css). */
  accentColor?: string;
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export interface AppKanbanBoardProps<T> {
  columns: KanbanColumnDef[];
  items: T[];
  getItemId: (item: T) => string;
  getColumnId: (item: T) => string;
  /** Update item when moved to a new column (e.g. set status field). */
  setColumnIdOnItem: (item: T, columnId: string) => T;
  /** Called after optimistic UI update. Reject to revert the card. */
  onMove: (move: KanbanDragMove<T>) => void | Promise<void>;
  renderCard: (
    item: T,
    ctx: {
      isDragging: boolean;
      isSaving: boolean;
      dragHandleProps: DraggableProvidedDragHandleProps | null;
    },
  ) => ReactNode;
  isMoveAllowed?: (move: KanbanDragMove<T>) => boolean;
  onMoveFailed?: (move: KanbanDragMove<T>, error: unknown) => void;
  idPrefix?: string;
  columnWidthClass?: string;
  columnBodyClass?: string;
  testIdPrefix?: string;
  emptyColumnLabel?: string;
  className?: string;
}

export function AppKanbanBoard<T>({
  columns,
  items,
  getItemId,
  getColumnId,
  setColumnIdOnItem,
  onMove,
  renderCard,
  isMoveAllowed,
  onMoveFailed,
  idPrefix = "item-",
  columnWidthClass = "w-[min(280px,85vw)] sm:w-72",
  columnBodyClass = "max-h-[min(70vh,640px)] overflow-y-auto overscroll-y-contain",
  testIdPrefix = "kanban",
  emptyColumnLabel = "Drop items here",
  className,
}: AppKanbanBoardProps<T>) {
  const { toast } = useToast();
  const columnIds = columns.map((c) => c.id);

  const handleMoveFailed = (move: KanbanDragMove<T>, error: unknown) => {
    if (onMoveFailed) {
      onMoveFailed(move, error);
      return;
    }
    const message = error instanceof Error ? error.message : "Could not save this change.";
    toast({ title: "Move failed", description: message, variant: "destructive" });
  };

  const { localItems, handleDragEnd, pendingItemId, isSaving } = useKanbanItems({
    items,
    columnIds,
    getItemId,
    getColumnId,
    setColumnId: setColumnIdOnItem,
    idPrefix,
    onMoveFailed: handleMoveFailed,
  });

  const onDragEnd = (result: DropResult) => {
    handleDragEnd(result, (move) => onMove(move), isMoveAllowed);
  };

  const itemsByColumn = (colId: string) =>
    localItems.filter((item) => getColumnId(item) === colId);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div
        className={cn("flex gap-3 sm:gap-4 overflow-x-auto pb-2 scroll-smooth", className)}
        data-testid={`${testIdPrefix}-board`}
      >
        {isSaving && (
          <div className="sr-only" aria-live="polite">
            Saving card move…
          </div>
        )}

        {columns.map((column) => {
          const colItems = itemsByColumn(column.id);
          return (
            <div
              key={column.id}
              className={cn("flex-shrink-0 flex flex-col", columnWidthClass, column.className)}
              data-testid={`${testIdPrefix}-column-${column.id}`}
            >
              {column.header ?? (
                <div
                  className="rounded-t-xl border border-b-0 border-border/40 bg-muted/30 px-3 py-2.5 shrink-0"
                  style={column.accentColor ? { borderTopColor: column.accentColor, borderTopWidth: 3 } : undefined}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold truncate">{column.title}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{colItems.length}</span>
                  </div>
                </div>
              )}

              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "flex-1 min-h-[160px] space-y-2 p-2 border border-t-0 border-border/40 rounded-b-xl bg-muted/10 transition-colors",
                      columnBodyClass,
                      snapshot.isDraggingOver && "bg-primary/5 border-primary/30 ring-1 ring-primary/20",
                    )}
                  >
                    {colItems.map((item, index) => {
                      const itemId = getItemId(item);
                      const dragId = `${idPrefix}${itemId}`;
                      const saving = pendingItemId === itemId;
                      return (
                        <Draggable key={dragId} draggableId={dragId} index={index}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              className={cn(
                                "relative transition-opacity",
                                dragSnapshot.isDragging && "z-50 rotate-[0.5deg] shadow-lg ring-2 ring-primary/25",
                                saving && !dragSnapshot.isDragging && "opacity-70",
                              )}
                              data-testid={`${testIdPrefix}-card-${itemId}`}
                            >
                              {saving && !dragSnapshot.isDragging && (
                                <div className="absolute top-2 right-2 z-10 rounded-full bg-background/90 p-0.5 shadow-sm">
                                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                </div>
                              )}
                              {renderCard(item, {
                                isDragging: dragSnapshot.isDragging,
                                isSaving: saving,
                                dragHandleProps: dragProvided.dragHandleProps,
                              })}
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {colItems.length === 0 && (
                      <div
                        className={cn(
                          "rounded-lg border border-dashed border-border/60 py-8 text-center text-xs text-muted-foreground",
                          snapshot.isDraggingOver && "border-primary/40 bg-primary/5 text-primary",
                        )}
                      >
                        {emptyColumnLabel}
                      </div>
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

              {column.footer}
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
