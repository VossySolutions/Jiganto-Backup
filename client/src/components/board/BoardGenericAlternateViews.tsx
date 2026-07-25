import { useMemo, useState, useEffect, type CSSProperties } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AppKanbanBoard } from "@/components/kanban";
import type { ColumnDef, StatusOption } from "@/components/MondayTable";
import type { BoardViewMode } from "@/lib/board-filters";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  LayoutDashboard,
  Plus,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

export type BoardViewItem = {
  id: number | string;
  title: string;
  subtitle?: string;
  status?: string;
  statusLabel?: string;
  statusColor?: string;
  ownerName?: string;
  ownerInitials?: string;
  ownerColor?: string;
  /** Primary date for calendar / gantt */
  date?: string | null;
  endDate?: string | null;
  description?: string;
  meta?: Record<string, string>;
};

const CHART_COLORS = ["#0073ea", "#00c875", "#fdab3d", "#e2445c", "#a25ddc", "#579bfc", "#c4c4c4", "#0086c0"];

/** Recharts renders the tooltip with inline light-only styles, so re-map it onto theme tokens. */
const CHART_TOOLTIP_STYLE: CSSProperties = {
  backgroundColor: "hsl(var(--popover))",
  borderColor: "hsl(var(--border))",
  borderRadius: 8,
  color: "hsl(var(--popover-foreground))",
  fontSize: 12,
};
const STATUS_FALLBACK_COLORS = [
  "bg-[#0073ea] text-white",
  "bg-[#00c875] text-white",
  "bg-[#fdab3d] text-white",
  "bg-[#e2445c] text-white",
  "bg-[#a25ddc] text-white",
  "bg-[#579bfc] text-white",
  "bg-[#c4c4c4] text-white",
];

function cellValue<T>(row: T, col?: ColumnDef<T>): unknown {
  if (!col) return undefined;
  if (typeof col.accessor === "function") return col.accessor(row);
  if (typeof col.accessor === "string") return (row as Record<string, unknown>)[col.accessor];
  return undefined;
}

function asString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function asDateIso(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

/** Map MondayTable rows → generic board items using column types. */
export function rowsToBoardItems<T extends { id: number | string }>(
  rows: T[],
  columns: ColumnDef<T>[],
): BoardViewItem[] {
  const visible = columns.filter((c) => !c.hidden);
  const titleCol =
    visible.find((c) => c.id === "name" || c.id === "title" || c.header === "Name") ||
    visible.find((c) => c.type === "text") ||
    visible[0];
  const statusCol = visible.find((c) => c.type === "status");
  const dateCols = visible.filter((c) => c.type === "date");
  const dateCol = dateCols[0];
  const endDateCol = dateCols[1];
  const personCol = visible.find((c) => c.type === "person" || c.id === "owner");
  const descCol = visible.find((c) => c.id === "description" || c.id === "notes");

  return rows.map((row) => {
    const title = asString(cellValue(row, titleCol)) || `#${row.id}`;
    const statusRaw = asString(cellValue(row, statusCol));
    const ownerRaw = cellValue(row, personCol);
    let ownerName = "";
    let ownerInitials = "";
    let ownerColor = "#676879";
    if (ownerRaw && typeof ownerRaw === "object") {
      const o = ownerRaw as Record<string, unknown>;
      ownerName = asString(o.name) || asString(o.label);
      ownerInitials = asString(o.initials) || ownerName.slice(0, 2).toUpperCase();
      ownerColor = asString(o.color) || "#676879";
    } else if (ownerRaw) {
      ownerName = asString(ownerRaw);
      ownerInitials = ownerName.slice(0, 2).toUpperCase() || "—";
    }

    const subtitleParts: string[] = [];
    for (const col of visible.slice(0, 6)) {
      if (col === titleCol || col === statusCol) continue;
      if (col.type === "files" || col.type === "checklist") continue;
      const v = asString(cellValue(row, col));
      if (v) subtitleParts.push(v);
      if (subtitleParts.length >= 2) break;
    }

    return {
      id: row.id,
      title,
      subtitle: subtitleParts.join(" · ") || undefined,
      status: statusRaw || undefined,
      statusLabel: statusRaw ? statusRaw.replace(/_/g, " ") : undefined,
      ownerName: ownerName || undefined,
      ownerInitials: ownerInitials || undefined,
      ownerColor,
      date: asDateIso(cellValue(row, dateCol)) || asDateIso((row as any).createdAt) || asDateIso((row as any).updatedAt),
      endDate: asDateIso(cellValue(row, endDateCol)),
      description: asString(cellValue(row, descCol)) || undefined,
    };
  });
}

function buildStatusOptions(items: BoardViewItem[]): StatusOption[] {
  const seen = new Map<string, StatusOption>();
  let i = 0;
  for (const item of items) {
    const key = item.status || "unset";
    if (seen.has(key)) continue;
    seen.set(key, {
      value: key,
      label: item.statusLabel || (key === "unset" ? "No status" : key.replace(/_/g, " ")),
      color: item.statusColor || STATUS_FALLBACK_COLORS[i % STATUS_FALLBACK_COLORS.length],
    });
    i++;
  }
  if (seen.size === 0) {
    seen.set("unset", { value: "unset", label: "All", color: "bg-[#c4c4c4] text-white" });
  }
  return Array.from(seen.values());
}

type GenericViewsProps = {
  mode: BoardViewMode;
  items: BoardViewItem[];
  entityLabel?: string;
  onOpenItem?: (id: number | string) => void;
  onAdd?: () => void;
  onStatusChange?: (id: number | string, status: string) => Promise<void> | void;
};

function BoardListView({ items, onOpenItem }: GenericViewsProps) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-12 text-center text-muted-foreground text-sm">
        No items yet.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border/60 bg-card divide-y divide-border/40" data-testid="board-list-view">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="flex w-full items-center gap-3 px-4 py-3 hover:bg-muted/30 text-left transition-colors"
          onClick={() => onOpenItem?.(item.id)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm truncate">{item.title}</span>
              {item.status && (
                <span
                  className={cn(
                    "inline-flex items-center min-h-[22px] px-2 rounded-[4px] text-[11px] font-medium",
                    item.statusColor || "bg-muted text-foreground",
                  )}
                >
                  {item.statusLabel || item.status}
                </span>
              )}
            </div>
            {item.subtitle && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{item.subtitle}</p>
            )}
          </div>
          {item.ownerInitials && (
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0"
              style={{ backgroundColor: item.ownerColor || "#676879" }}
              title={item.ownerName}
            >
              {item.ownerInitials}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

function BoardKanbanView({ items, onOpenItem, onAdd, onStatusChange }: GenericViewsProps) {
  const statusOptions = useMemo(() => buildStatusOptions(items), [items]);
  const [override, setOverride] = useState<Record<string, string>>({});

  useEffect(() => {
    setOverride({});
  }, [items]);

  const boardItems = useMemo(
    () =>
      items.map((it) => {
        const key = String(it.id);
        return override[key] ? { ...it, status: override[key] } : { ...it, status: it.status || "unset" };
      }),
    [items, override],
  );

  const columns = useMemo(
    () =>
      statusOptions.map((opt) => ({
        id: opt.value,
        title: (
          <div className="flex items-center gap-2">
            <span className={cn("min-h-[22px] px-2 rounded-[4px] text-[12px] font-medium inline-flex items-center", opt.color)}>
              {opt.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {boardItems.filter((l) => (l.status || "unset") === opt.value).length}
            </span>
          </div>
        ),
        footer: onAdd ? (
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground h-8" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add item
          </Button>
        ) : undefined,
      })),
    [statusOptions, boardItems, onAdd],
  );

  return (
    <AppKanbanBoard
      columns={columns}
      items={boardItems}
      getItemId={(l) => String(l.id)}
      getColumnId={(l) => l.status || "unset"}
      setColumnIdOnItem={(l, colId) => ({ ...l, status: colId })}
      onMove={async (move) => {
        setOverride((prev) => ({ ...prev, [String(move.item.id)]: move.toColumnId }));
        await onStatusChange?.(move.item.id, move.toColumnId);
      }}
      testIdPrefix="board-kanban"
      renderCard={(item, { dragHandleProps }) => (
        <div
          className="rounded-lg border border-border/60 bg-card p-3 shadow-sm space-y-2"
          {...dragHandleProps}
        >
          <button type="button" className="text-left w-full" onClick={() => onOpenItem?.(item.id)}>
            <p className="text-sm font-medium truncate">{item.title}</p>
            {item.subtitle && <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>}
          </button>
          {item.ownerInitials && (
            <div
              className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[9px] font-semibold"
              style={{ backgroundColor: item.ownerColor || "#676879" }}
            >
              {item.ownerInitials}
            </div>
          )}
        </div>
      )}
    />
  );
}

function BoardCalendarView({ items, onOpenItem, onAdd }: GenericViewsProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];
    const startPadding = firstDay.getDay();
    for (let i = startPadding - 1; i >= 0; i--) days.push(new Date(year, month, -i));
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
    const endPadding = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= endPadding; i++) days.push(new Date(year, month + 1, i));
    return days;
  }, [currentDate]);

  const itemsByDate = useMemo(() => {
    const map: Record<string, BoardViewItem[]> = {};
    for (const item of items) {
      if (!item.date) continue;
      const key = new Date(item.date).toDateString();
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return map;
  }, [items]);

  const monthLabel = currentDate.toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-3" data-testid="board-calendar-view">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-sm font-semibold min-w-[140px] text-center">{monthLabel}</h3>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {onAdd && (
          <Button size="sm" className="h-8" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        )}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-muted/50 text-[11px] font-medium text-center py-1.5 text-muted-foreground">
            {d}
          </div>
        ))}
        {daysInMonth.map((day, idx) => {
          const inMonth = day.getMonth() === currentDate.getMonth();
          const dayItems = itemsByDate[day.toDateString()] || [];
          return (
            <div
              key={idx}
              className={cn("bg-card min-h-[88px] p-1.5", !inMonth && "opacity-40")}
            >
              <div className="text-[11px] font-medium text-muted-foreground mb-1">{day.getDate()}</div>
              <div className="space-y-0.5">
                {dayItems.slice(0, 3).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full text-left text-[10px] truncate px-1 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20"
                    onClick={() => onOpenItem?.(item.id)}
                  >
                    {item.title}
                  </button>
                ))}
                {dayItems.length > 3 && (
                  <span className="text-[10px] text-muted-foreground px-1">+{dayItems.length - 3}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {items.every((i) => !i.date) && (
        <p className="text-xs text-muted-foreground text-center">No dated items — add a date column to place rows on the calendar.</p>
      )}
    </div>
  );
}

function BoardGanttView({ items, onOpenItem }: GenericViewsProps) {
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 7);
    return d;
  });
  const [dayWidth, setDayWidth] = useState(28);
  const dayCount = 42;
  const dayMs = 86400000;
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => new Date(anchor.getTime() + i * dayMs)),
    [anchor],
  );

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER;
      const db = b.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER;
      return da - db;
    });
  }, [items]);

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden" data-testid="board-gantt-view">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAnchor(new Date(anchor.getTime() - 7 * dayMs))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAnchor(new Date(anchor.getTime() + 7 * dayMs))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDayWidth((w) => Math.min(48, w + 4))}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDayWidth((w) => Math.max(16, w - 4))}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
        </div>
        <span className="text-xs text-muted-foreground">
          {anchor.toLocaleDateString()} – {days[days.length - 1]?.toLocaleDateString()}
        </span>
      </div>
      <div className="overflow-x-auto">
        <div style={{ minWidth: 200 + dayCount * dayWidth }}>
          <div className="flex border-b border-border sticky top-0 bg-muted/40">
            <div className="w-[200px] shrink-0 px-3 py-1.5 text-xs font-medium">Item</div>
            {days.map((d, i) => (
              <div
                key={i}
                className="shrink-0 text-[10px] text-center text-muted-foreground border-l border-border/50 py-1"
                style={{ width: dayWidth }}
              >
                {d.getDate()}
              </div>
            ))}
          </div>
          {sorted.map((item) => {
            const start = item.date ? new Date(item.date) : null;
            const end = item.endDate ? new Date(item.endDate) : start ? new Date(start.getTime() + 3 * dayMs) : null;
            let left = 0;
            let width = dayWidth;
            if (start) {
              const offset = Math.round((start.getTime() - anchor.getTime()) / dayMs);
              const span = end ? Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs) + 1) : 3;
              left = offset * dayWidth;
              width = span * dayWidth;
            }
            return (
              <div key={item.id} className="flex items-center border-b border-border/40 h-10">
                <button
                  type="button"
                  className="w-[200px] shrink-0 px-3 text-left text-xs font-medium truncate hover:text-primary"
                  onClick={() => onOpenItem?.(item.id)}
                >
                  {item.title}
                </button>
                <div className="relative h-full flex-1">
                  {start && (
                    <div
                      className="absolute top-2 h-5 rounded bg-primary/80 text-white text-[10px] px-1.5 flex items-center truncate"
                      style={{ left: Math.max(0, left), width: Math.max(dayWidth, width) }}
                    >
                      {item.title}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {!sorted.some((i) => i.date) && (
        <p className="text-xs text-muted-foreground text-center py-6">No dated items — date fields appear as Gantt bars.</p>
      )}
    </div>
  );
}

function BoardDocumentView({ items, onOpenItem, onAdd }: GenericViewsProps) {
  const [selectedId, setSelectedId] = useState<number | string | null>(items[0]?.id ?? null);
  const selected = items.find((i) => i.id === selectedId) || items[0];

  useEffect(() => {
    if (!selected && items[0]) setSelectedId(items[0].id);
  }, [items, selected]);

  return (
    <div className="rounded-xl border border-border/60 bg-card grid grid-cols-1 md:grid-cols-[240px_1fr] min-h-[360px]" data-testid="board-document-view">
      <div className="border-r border-border p-2 space-y-1 overflow-y-auto max-h-[480px]">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" /> Documents
          </span>
          {onAdd && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onAdd}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "w-full text-left px-2 py-1.5 rounded-md text-sm truncate",
              selected?.id === item.id ? "bg-primary/10 text-primary" : "hover:bg-muted",
            )}
            onClick={() => setSelectedId(item.id)}
          >
            {item.title}
          </button>
        ))}
      </div>
      <div className="p-4 space-y-3">
        {selected ? (
          <>
            <button type="button" className="text-lg font-semibold hover:text-primary text-left" onClick={() => onOpenItem?.(selected.id)}>
              {selected.title}
            </button>
            {selected.status && (
              <span className={cn("inline-flex px-2 py-0.5 rounded text-xs", selected.statusColor || "bg-muted")}>
                {selected.statusLabel || selected.status}
              </span>
            )}
            <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
              {selected.description || selected.subtitle || "No description for this item."}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Select an item.</p>
        )}
      </div>
    </div>
  );
}

function BoardChartView({ items, entityLabel }: GenericViewsProps) {
  const data = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const key = item.statusLabel || item.status || "Uncategorized";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [items]);

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 space-y-4" data-testid="board-chart-view">
      <h3 className="text-sm font-semibold">{entityLabel || "Items"} by status</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">No data to chart.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="name"
                  className="text-muted-foreground"
                  stroke="currentColor"
                  tick={{ fontSize: 11, fill: "currentColor" }}
                />
                <YAxis
                  allowDecimals={false}
                  className="text-muted-foreground"
                  stroke="currentColor"
                  tick={{ fontSize: 11, fill: "currentColor" }}
                />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" outerRadius={100} label>
                  {data.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

function BoardDashboardView({ items, entityLabel, onOpenItem, onAdd }: GenericViewsProps) {
  const statusOptions = buildStatusOptions(items);
  const byStatus = statusOptions.map((o) => ({
    label: o.label,
    count: items.filter((i) => (i.status || "unset") === o.value).length,
    color: o.color,
  }));
  const withDate = items.filter((i) => i.date).length;
  const recent = [...items].slice(0, 8);

  return (
    <div className="space-y-4" data-testid="board-dashboard-view">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <LayoutDashboard className="h-4 w-4 text-primary" />
          {entityLabel || "Board"} dashboard
        </h3>
        {onAdd && (
          <Button size="sm" className="h-8 gap-1" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/60 p-4">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-semibold">{items.length}</p>
        </div>
        <div className="rounded-xl border border-border/60 p-4">
          <p className="text-xs text-muted-foreground">With dates</p>
          <p className="text-2xl font-semibold">{withDate}</p>
        </div>
        <div className="rounded-xl border border-border/60 p-4">
          <p className="text-xs text-muted-foreground">Statuses</p>
          <p className="text-2xl font-semibold">{statusOptions.length}</p>
        </div>
        <div className="rounded-xl border border-border/60 p-4">
          <p className="text-xs text-muted-foreground">Owners</p>
          <p className="text-2xl font-semibold">{new Set(items.map((i) => i.ownerName).filter(Boolean)).size}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/60 p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">By status</p>
          {byStatus.map((s) => (
            <div key={s.label} className="flex items-center justify-between text-sm">
              <span className={cn("px-2 py-0.5 rounded text-xs", s.color)}>{s.label}</span>
              <span className="font-medium">{s.count}</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border/60 p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Recent</p>
          {recent.map((item) => (
            <button
              key={item.id}
              type="button"
              className="block w-full text-left text-sm truncate hover:text-primary"
              onClick={() => onOpenItem?.(item.id)}
            >
              {item.title}
            </button>
          ))}
          {!recent.length && <p className="text-sm text-muted-foreground">No items.</p>}
        </div>
      </div>
    </div>
  );
}

function BoardFormView({ items, entityLabel, onAdd }: GenericViewsProps) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <div className="rounded-xl border border-border/60 bg-card p-6 max-w-lg mx-auto space-y-4" data-testid="board-form-view">
      <h3 className="text-sm font-semibold">New {entityLabel?.replace(/s$/, "") || "item"}</h3>
      <p className="text-xs text-muted-foreground">
        Quick capture form — {items.length} existing {entityLabel || "items"} on this board.
      </p>
      <div className="space-y-1.5">
        <Label className="text-xs">Title</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title…" className="h-9" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes…" rows={4} />
      </div>
      <Button
        className="w-full h-9"
        onClick={() => {
          setTitle("");
          setNotes("");
          onAdd?.();
        }}
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        Open create form
      </Button>
    </div>
  );
}

function BoardTimesheetView({ items, entityLabel }: GenericViewsProps) {
  const weekDays = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - start.getDay() + 1);
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * 86400000));
  }, []);

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden" data-testid="board-timesheet-view">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Clock className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">{entityLabel || "Items"} timesheet</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-xs text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium">Item</th>
              {weekDays.map((d) => (
                <th key={d.toISOString()} className="px-2 py-2 font-medium text-center min-w-[56px]">
                  {d.toLocaleDateString("en-US", { weekday: "short" })}
                  <div className="font-normal">{d.getDate()}</div>
                </th>
              ))}
              <th className="px-3 py-2 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 25).map((item) => (
              <tr key={item.id} className="border-t border-border/40">
                <td className="px-3 py-2 truncate max-w-[200px]">{item.title}</td>
                {weekDays.map((d) => (
                  <td key={d.toISOString()} className="px-2 py-1 text-center">
                    <Input className="h-7 w-12 mx-auto text-center text-xs px-1" placeholder="—" readOnly title="Tracking UI — wire hours per module if needed" />
                  </td>
                ))}
                <td className="px-3 py-2 text-right text-muted-foreground">—</td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground text-sm">
                  No rows for timesheet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Shared alternate views for every MondayBoardShell table.
 * Implements the full view switcher set from Leads (screenshot parity).
 */
export function BoardGenericAlternateViews(props: GenericViewsProps) {
  switch (props.mode) {
    case "list":
      return <BoardListView {...props} />;
    case "board":
      return <BoardKanbanView {...props} />;
    case "calendar":
      return <BoardCalendarView {...props} />;
    case "gantt":
      return <BoardGanttView {...props} />;
    case "document":
      return <BoardDocumentView {...props} />;
    case "chart":
      return <BoardChartView {...props} />;
    case "dashboard":
      return <BoardDashboardView {...props} />;
    case "form":
      return <BoardFormView {...props} />;
    case "timesheet":
      return <BoardTimesheetView {...props} />;
    default:
      return <BoardListView {...props} />;
  }
}
