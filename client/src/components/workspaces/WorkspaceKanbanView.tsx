import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Plus, User, CalendarDays, GripVertical } from "lucide-react";
import type { WorkspaceDatabaseColumn, WorkspaceDatabaseRow } from "@shared/schema";
import { AppKanbanBoard } from "@/components/kanban";

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

  if (!statusColumn) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Add a `select` column (preferably named `Status`) to enable Kanban view.
      </div>
    );
  }

  const statusColId = String(statusColumn.id);

  const getRowStatus = (row: WorkspaceDatabaseRow) =>
    String(((row.data || {}) as Record<string, unknown>)[statusColId] || "Unassigned");

  return (
    <AppKanbanBoard
      columns={groupValues.map((value) => ({
        id: value,
        title: value,
        header: (
          <div className="rounded-t-md border border-b-0 border-border/40 bg-muted/20 px-2 py-2 mb-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium">{value}</h4>
                <Badge variant="secondary">{rows.filter((r) => getRowStatus(r) === value).length}</Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onAddRow(statusColumn.id, value)}
                data-testid={`kanban-add-row-${value}`}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ),
        className: "w-[290px]",
      }))}
      items={rows}
      getItemId={(row) => String(row.id)}
      getColumnId={getRowStatus}
      setColumnIdOnItem={(row, columnId) => ({
        ...row,
        data: { ...((row.data || {}) as Record<string, unknown>), [statusColId]: columnId },
      })}
      onMove={(move) => {
        const row = move.item;
        const rowData = ((row.data || {}) as Record<string, unknown>) ?? {};
        return Promise.resolve(onUpdateRow(row.id, { ...rowData, [statusColId]: move.toColumnId }));
      }}
      testIdPrefix="workspace-kanban"
      columnWidthClass="w-[290px]"
      renderCard={(row, { dragHandleProps, isDragging }) => {
        const data = ((row.data || {}) as Record<string, unknown>) ?? {};
        const title = titleColumn ? String(data[String(titleColumn.id)] || "Untitled") : `Row #${row.id}`;
        const assignee = assigneeColumn ? String(data[String(assigneeColumn.id)] || "") : "";
        const due = dueDateColumn ? String(data[String(dueDateColumn.id)] || "") : "";
        const priority = priorityColumn ? String(data[String(priorityColumn.id)] || "") : "";
        return (
          <Card
            className={cn(
              "cursor-pointer p-3 hover:shadow-sm transition-shadow",
              isDragging && "shadow-md ring-2 ring-primary/20",
            )}
            onClick={() => onOpenRowDetail(row.id)}
            data-testid={`kanban-card-${row.id}`}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="line-clamp-2 text-sm font-medium flex-1">{title}</p>
              <div {...(dragHandleProps ?? {})} className="shrink-0 cursor-grab text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                <GripVertical className="h-3.5 w-3.5" />
              </div>
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
      }}
    />
  );
}

function getSelectChoices(options: unknown): string[] {
  if (!options || typeof options !== "object") return [];
  const choices = (options as { choices?: unknown }).choices;
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
