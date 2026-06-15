import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Plus, User, CalendarDays, GripVertical } from "lucide-react";
import type { WorkspaceDatabaseColumn, WorkspaceDatabaseRow } from "@shared/schema";

interface KanbanGroup {
  value: string;
  rows: WorkspaceDatabaseRow[];
}

export function WorkspaceKanbanView({
  columns,
  rows,
  onUpdateRow,
  onAddRow,
  onOpenRowDetail,
}: {
  columns: WorkspaceDatabaseColumn[];
  rows: WorkspaceDatabaseRow[];
  onUpdateRow: (rowId: number, data: Record<string, unknown>) => void | Promise<void>;
  onAddRow: (statusColId: number, statusValue: string) => void;
  onOpenRowDetail: (rowId: number) => void;
}) {
  const [draggingRowId, setDraggingRowId] = useState<number | null>(null);
  const [dragOverValue, setDragOverValue] = useState<string | null>(null);

  const statusColumn = useMemo(() => {
    const byName = columns.find(
      (column) => column.type === "select" && column.name.trim().toLowerCase() === "status",
    );
    return byName || columns.find((column) => column.type === "select") || null;
  }, [columns]);

  const titleColumn = columns[0] || null;
  const assigneeColumn = columns.find((column) => {
    const name = column.name.toLowerCase();
    return name.includes("assignee") || name.includes("owner");
  });
  const dueDateColumn = columns.find((column) => {
    const name = column.name.toLowerCase();
    return column.type === "date" && (name.includes("due") || name.includes("deadline"));
  });
  const priorityColumn = columns.find((column) => {
    const name = column.name.toLowerCase();
    return name.includes("priority");
  });

  const groupValues = useMemo(() => {
    if (!statusColumn) return [];
    const options = getSelectChoices(statusColumn.options);
    const fromRows = rows
      .map((row) => String(((row.data || {}) as Record<string, unknown>)[String(statusColumn.id)] || "Unassigned"))
      .filter(Boolean);
    return Array.from(new Set([...options, ...fromRows]));
  }, [rows, statusColumn]);

  const groups = useMemo<KanbanGroup[]>(() => {
    if (!statusColumn) return [];
    return groupValues.map((value) => ({
      value,
      rows: rows.filter((row) => {
        const data = (row.data || {}) as Record<string, unknown>;
        const current = String(data[String(statusColumn.id)] || "Unassigned");
        return current === value;
      }),
    }));
  }, [groupValues, rows, statusColumn]);

  if (!statusColumn) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Add a `select` column (preferably named `Status`) to enable Kanban view.
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-3" data-testid="workspace-kanban-view">
      {groups.map((group) => (
        <div
          key={group.value}
          className={cn(
            "w-[290px] flex-shrink-0 rounded-md border bg-muted/20 p-2",
            dragOverValue === group.value && "border-primary/50 bg-primary/5",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverValue(group.value);
          }}
          onDragLeave={() => setDragOverValue((prev) => (prev === group.value ? null : prev))}
          onDrop={async (e) => {
            e.preventDefault();
            if (!draggingRowId || draggingRowId <= 0) return;
            const row = rows.find((item) => item.id === draggingRowId);
            if (!row) return;
            const rowData = ((row.data || {}) as Record<string, unknown>) ?? {};
            await onUpdateRow(row.id, { ...rowData, [String(statusColumn.id)]: group.value });
            setDraggingRowId(null);
            setDragOverValue(null);
          }}
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium">{group.value}</h4>
              <Badge variant="secondary">{group.rows.length}</Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onAddRow(statusColumn.id, group.value)}
              data-testid={`kanban-add-row-${group.value}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="space-y-2">
            {group.rows.map((row) => {
              const data = ((row.data || {}) as Record<string, unknown>) ?? {};
              const title = titleColumn ? String(data[String(titleColumn.id)] || "Untitled") : `Row #${row.id}`;
              const assignee = assigneeColumn ? String(data[String(assigneeColumn.id)] || "") : "";
              const due = dueDateColumn ? String(data[String(dueDateColumn.id)] || "") : "";
              const priority = priorityColumn ? String(data[String(priorityColumn.id)] || "") : "";
              return (
                <Card
                  key={row.id}
                  draggable
                  onDragStart={() => setDraggingRowId(row.id)}
                  onDragEnd={() => {
                    setDraggingRowId(null);
                    setDragOverValue(null);
                  }}
                  className="cursor-pointer p-3 hover:shadow-sm"
                  onClick={() => onOpenRowDetail(row.id)}
                  data-testid={`kanban-card-${row.id}`}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-medium">{title}</p>
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    {assignee && (
                      <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3" />
                        <span className="truncate">{assignee}</span>
                      </div>
                    )}
                    {due && (
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="h-3 w-3" />
                        <span>{formatDate(due)}</span>
                      </div>
                    )}
                    {priority && (
                      <Badge variant="secondary" className={cn("text-[10px]", getPriorityClasses(priority))}>
                        {priority}
                      </Badge>
                    )}
                  </div>
                </Card>
              );
            })}
            {group.rows.length === 0 && (
              <div className="rounded-md border border-dashed bg-background/60 px-3 py-5 text-center text-xs text-muted-foreground">
                Drop cards here
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function getSelectChoices(options: unknown): string[] {
  if (!options || typeof options !== "object") return [];
  const choices = (options as any).choices;
  if (!Array.isArray(choices)) return [];
  return choices.map((choice) => String(choice));
}

function formatDate(input: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return input;
  return parsed.toLocaleDateString();
}

function getPriorityClasses(priority: string): string {
  const normalized = priority.toLowerCase();
  if (normalized.includes("critical") || normalized === "p1") return "bg-red-500/10 text-red-600";
  if (normalized.includes("high") || normalized === "p2") return "bg-amber-500/10 text-amber-600";
  if (normalized.includes("medium") || normalized === "p3") return "bg-blue-500/10 text-blue-600";
  return "bg-emerald-500/10 text-emerald-600";
}
