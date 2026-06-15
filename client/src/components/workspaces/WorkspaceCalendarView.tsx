import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { WorkspaceDatabaseColumn, WorkspaceDatabaseRow } from "@shared/schema";

export function WorkspaceCalendarView({
  columns,
  rows,
  onUpdateRow,
  onAddRow,
  onOpenRowDetail,
}: {
  columns: WorkspaceDatabaseColumn[];
  rows: WorkspaceDatabaseRow[];
  onUpdateRow: (rowId: number, data: Record<string, unknown>) => void | Promise<void>;
  onAddRow?: (dateColumnId: number, isoDate: string) => void;
  onOpenRowDetail?: (rowId: number) => void;
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [draggingRowId, setDraggingRowId] = useState<number | null>(null);

  const dateColumn = useMemo(() => columns.find((column) => column.type === "date") || null, [columns]);
  const titleColumn = columns[0] || null;

  const days = useMemo(() => buildMonthGrid(month), [month]);
  const rowByDate = useMemo(() => {
    const map = new Map<string, WorkspaceDatabaseRow[]>();
    if (!dateColumn) return map;
    for (const row of rows) {
      const raw = String((((row.data || {}) as Record<string, unknown>)[String(dateColumn.id)] as string) || "");
      const key = toIsoDay(raw);
      if (!key) continue;
      map.set(key, [...(map.get(key) || []), row]);
    }
    return map;
  }, [dateColumn, rows]);

  if (!dateColumn) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Add a `date` column to render calendar view.
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="workspace-calendar-view">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">
          {month.toLocaleString(undefined, { month: "long", year: "numeric" })}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(addMonths(month, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(startOfMonth(new Date()))}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMonth(addMonths(month, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayKey = formatDayKey(day.date);
          const dayRows = rowByDate.get(dayKey) || [];
          const isToday = dayKey === formatDayKey(new Date());
          const inMonth = day.date.getMonth() === month.getMonth();
          return (
            <div
              key={dayKey}
              className={cn(
                "min-h-[110px] rounded-md border p-2",
                inMonth ? "bg-card" : "bg-muted/30 text-muted-foreground",
                isToday && "border-primary/60",
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                if (!draggingRowId) return;
                const row = rows.find((item) => item.id === draggingRowId);
                if (!row) return;
                const data = ((row.data || {}) as Record<string, unknown>) ?? {};
                await onUpdateRow(row.id, { ...data, [String(dateColumn.id)]: dayKey });
                setDraggingRowId(null);
              }}
            >
              <div className="mb-1 flex items-center justify-between">
                <button
                  className="text-xs font-medium"
                  onClick={() => onAddRow?.(dateColumn.id, dayKey)}
                  title="Add row on this date"
                >
                  {day.date.getDate()}
                </button>
                <button
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted"
                  onClick={() => onAddRow?.(dateColumn.id, dayKey)}
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <div className="space-y-1">
                {dayRows.slice(0, 4).map((row) => {
                  const data = ((row.data || {}) as Record<string, unknown>) ?? {};
                  const title = titleColumn ? String(data[String(titleColumn.id)] || `Row #${row.id}`) : `Row #${row.id}`;
                  return (
                    <button
                      key={row.id}
                      draggable
                      onDragStart={() => setDraggingRowId(row.id)}
                      onDragEnd={() => setDraggingRowId(null)}
                      onClick={() => onOpenRowDetail?.(row.id)}
                      className="w-full truncate rounded bg-primary/10 px-1.5 py-1 text-left text-[11px] text-primary"
                    >
                      {title}
                    </button>
                  );
                })}
                {dayRows.length > 4 && (
                  <div className="text-[10px] text-muted-foreground">+{dayRows.length - 4} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function buildMonthGrid(month: Date): { date: Date }[] {
  const first = startOfMonth(month);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const cells: { date: Date }[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    cells.push({ date });
  }
  return cells;
}

function formatDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toIsoDay(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    return "";
  }
  return formatDayKey(parsed);
}
