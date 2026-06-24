import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Column, type Item } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon, GripVertical, Plus, User } from "lucide-react";
import { AppKanbanBoard } from "@/components/kanban";

interface KanbanViewProps {
  columns: Column[];
  items: Item[];
  onItemClick?: (item: Item) => void;
  onAddItem?: (status: string) => void;
  onItemStatusChange?: (item: Item, status: string) => void | Promise<void>;
}

const statusColors: Record<string, string> = {
  "To Do": "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  "In Progress": "bg-status-blue text-status-blue-foreground",
  Done: "bg-status-green text-status-green-foreground",
  Blocked: "bg-status-red text-status-red-foreground",
};

export function KanbanView({ columns: columnsData, items, onItemClick, onAddItem, onItemStatusChange }: KanbanViewProps) {
  const statusColumn = columnsData.find((col) => col.type === "status");
  const titleColumn = columnsData.find((col) => col.key === "title" || col.type === "text");
  const dateColumn = columnsData.find((col) => col.type === "date");
  const ownerColumn = columnsData.find((col) => col.type === "person" || col.key === "owner");

  const statuses = useMemo(() => {
    if (statusColumn?.options && Array.isArray(statusColumn.options)) {
      return statusColumn.options as string[];
    }
    return ["To Do", "In Progress", "Done"];
  }, [statusColumn]);

  const getItemStatus = (item: Item) => {
    const values = item.values as Record<string, unknown>;
    return statusColumn ? String(values[statusColumn.key] ?? statuses[0]) : statuses[0];
  };

  const kanbanColumns = statuses.map((status) => ({
    id: status,
    title: status,
    accentColor: undefined,
    header: (
      <div className="rounded-t-2xl border border-b-0 border-border/50 bg-muted/30 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="outline" className={cn("rounded-lg px-2.5 py-0.5 truncate", statusColors[status] || "bg-muted")}>
              {status}
            </Badge>
            <span className="text-xs text-muted-foreground tabular-nums">
              {items.filter((item) => getItemStatus(item) === status).length}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            onClick={() => onAddItem?.(status)}
            data-testid={`add-item-${status.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    ),
    className: "w-[300px]",
  }));

  if (!statusColumn || !onItemStatusChange) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Kanban view requires a status column and status update handler.
      </div>
    );
  }

  const statusKey = statusColumn.key;

  return (
    <AppKanbanBoard
      columns={kanbanColumns}
      items={items}
      getItemId={(item) => String(item.id)}
      getColumnId={getItemStatus}
      setColumnIdOnItem={(item, columnId) => ({
        ...item,
        values: { ...(item.values as object), [statusKey]: columnId },
      })}
      onMove={(move) => Promise.resolve(onItemStatusChange(move.item, move.toColumnId))}
      testIdPrefix="jiganto-kanban"
      idPrefix="item-"
      emptyColumnLabel="No items"
      className="min-h-[600px]"
      columnWidthClass="w-[300px]"
      renderCard={(item, { dragHandleProps, isDragging, isSaving }) => {
        const values = item.values as Record<string, unknown>;
        const title = titleColumn ? String(values[titleColumn.key] ?? "") : `Item ${item.id}`;
        const dueDate = dateColumn ? values[dateColumn.key] : null;
        const owner = ownerColumn ? values[ownerColumn.key] : null;

        return (
          <Card
            className={cn(
              "rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer border-border/50 bg-card",
              isDragging && "shadow-lg ring-2 ring-primary/20",
              isSaving && "opacity-70",
            )}
            onClick={() => onItemClick?.(item)}
            data-testid={`kanban-card-${item.id}`}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-2">
                <div
                  {...(dragHandleProps ?? {})}
                  className="shrink-0 cursor-grab active:cursor-grabbing touch-none text-muted-foreground mt-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <GripVertical className="h-4 w-4" />
                </div>
                <h4 className="font-medium text-sm text-foreground line-clamp-2 flex-1">{title || `Item ${item.id}`}</h4>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground pl-6">
                {dueDate != null && dueDate !== "" && (
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3" />
                    <span>{new Date(String(dueDate)).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  </div>
                )}
                {owner != null && owner !== "" && (
                  <div className="flex items-center gap-1">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-3 w-3 text-primary" />
                    </div>
                    <span className="truncate max-w-[80px]">{String(owner)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      }}
    />
  );
}
