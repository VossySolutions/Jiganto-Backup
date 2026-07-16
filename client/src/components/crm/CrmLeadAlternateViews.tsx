import { useEffect, useMemo, useState } from "react";
import { AppKanbanBoard } from "@/components/kanban";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { StatusOption } from "@/components/MondayTable";
import type { CrmLead } from "./types";
import { ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, GripVertical, Plus } from "lucide-react";

type OwnerInfo = { name: string; initials: string; color: string };

type SharedProps = {
  leads: CrmLead[];
  statusOptions: StatusOption[];
  resolveOwner: (userId: string | null | undefined) => OwnerInfo;
  onOpenLead: (lead: CrmLead) => void;
  onConvert?: (lead: CrmLead) => void;
  onAddLead?: () => void;
};

export function CrmLeadListView({
  leads,
  statusOptions,
  resolveOwner,
  onOpenLead,
  onConvert,
}: SharedProps) {
  const statusMap = useMemo(
    () => Object.fromEntries(statusOptions.map((o) => [o.value, o])),
    [statusOptions],
  );

  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-12 text-center text-muted-foreground text-sm">
        No leads yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card divide-y divide-border/40" data-testid="leads-list-view">
      {leads.map((lead) => {
        const company = lead.company || `${lead.firstName} ${lead.lastName}`;
        const status = statusMap[lead.status];
        const owner = resolveOwner(lead.ownerUserId);
        return (
          <div
            key={lead.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
            data-testid={`lead-list-item-${lead.id}`}
          >
            <button
              type="button"
              className="flex-1 min-w-0 text-left"
              onClick={() => onOpenLead(lead)}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm truncate">{company}</span>
                {status && (
                  <span className={cn(
                    "inline-flex items-center justify-center min-h-[22px] px-2 rounded-[4px] text-[11px] font-medium border-0",
                    status.color,
                  )}>
                    {status.label}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {lead.firstName} {lead.lastName}
                {lead.title ? ` · ${lead.title}` : ""}
                {lead.email ? ` · ${lead.email}` : ""}
              </p>
            </button>
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0"
              style={{ backgroundColor: owner.color }}
              title={owner.name}
            >
              {owner.initials}
            </div>
            {onConvert && lead.status !== "converted" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[#0073ea]"
                onClick={() => onConvert(lead)}
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CrmLeadBoardView({
  leads,
  statusOptions,
  resolveOwner,
  onOpenLead,
  onConvert,
  onAddLead,
  onStatusChange,
}: SharedProps & {
  onStatusChange: (leadId: number, status: string) => Promise<void>;
}) {
  /** Optimistic status overrides so dropdown changes move cards immediately */
  const [statusOverride, setStatusOverride] = useState<Record<number, string>>({});

  useEffect(() => {
    setStatusOverride((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [idStr, status] of Object.entries(prev)) {
        const id = Number(idStr);
        const lead = leads.find((l) => l.id === id);
        if (!lead || lead.status === status) {
          delete next[id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [leads]);

  const boardLeads = useMemo(
    () =>
      leads.map((l) =>
        statusOverride[l.id] ? { ...l, status: statusOverride[l.id] } : l,
      ),
    [leads, statusOverride],
  );

  const statusMap = useMemo(
    () => Object.fromEntries(statusOptions.map((o) => [o.value, o])),
    [statusOptions],
  );

  const changeStatus = async (lead: CrmLead, nextStatus: string) => {
    if (lead.status === nextStatus || lead.status === "converted") return;
    setStatusOverride((prev) => ({ ...prev, [lead.id]: nextStatus }));
    try {
      await onStatusChange(lead.id, nextStatus);
    } catch {
      setStatusOverride((prev) => {
        const next = { ...prev };
        delete next[lead.id];
        return next;
      });
      throw new Error("status update failed");
    }
  };

  const columns = useMemo(
    () =>
      statusOptions.map((opt) => ({
        id: opt.value,
        title: (
          <div className="flex items-center gap-2">
            <span className={cn(
              "min-h-[22px] px-2 rounded-[4px] text-[12px] font-medium inline-flex items-center",
              opt.color,
            )}>
              {opt.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {boardLeads.filter((l) => l.status === opt.value).length}
            </span>
          </div>
        ),
        accentColor: undefined as string | undefined,
        footer: onAddLead ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground h-8"
            onClick={onAddLead}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add lead
          </Button>
        ) : undefined,
      })),
    [statusOptions, boardLeads, onAddLead],
  );

  return (
    <AppKanbanBoard
      columns={columns}
      items={boardLeads}
      getItemId={(l) => String(l.id)}
      getColumnId={(l) => l.status}
      setColumnIdOnItem={(l, colId) => ({ ...l, status: colId })}
      onMove={async (move) => {
        await onStatusChange(move.item.id, move.toColumnId);
      }}
      isMoveAllowed={(move) => move.item.status !== "converted"}
      testIdPrefix="leads-board"
      renderCard={(lead, { isDragging, dragHandleProps }) => {
        const company = lead.company || `${lead.firstName} ${lead.lastName}`;
        const owner = resolveOwner(lead.ownerUserId);
        const status = statusMap[lead.status];
        const canEditStatus = lead.status !== "converted";
        return (
          <div
            className={cn(
              "bg-card border border-border/50 rounded-lg shadow-sm overflow-hidden",
              isDragging && "ring-2 ring-[#0073ea]/30 shadow-md",
            )}
            data-testid={`lead-board-card-${lead.id}`}
          >
            <div className="flex">
              <div
                {...(dragHandleProps ?? {})}
                className="flex items-start pt-3 pl-1.5 cursor-grab active:cursor-grabbing text-muted-foreground/50"
                title="Drag to change status"
              >
                <GripVertical className="h-4 w-4" />
              </div>
              <div className="flex-1 p-3 pl-1 text-left min-w-0">
                <button
                  type="button"
                  className="w-full text-left min-w-0"
                  onClick={() => onOpenLead(lead)}
                >
                  <p className="font-semibold text-sm truncate">{company}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {lead.firstName} {lead.lastName}
                  </p>
                </button>

                <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                  {canEditStatus ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "w-full min-h-[28px] px-2 rounded-[4px] text-[12px] font-medium",
                            "inline-flex items-center justify-center gap-1 capitalize transition-opacity hover:opacity-90",
                            status?.color || "bg-[#c4c4c4] text-white",
                          )}
                          data-testid={`lead-board-status-${lead.id}`}
                          title="Change status"
                        >
                          <span className="truncate">{status?.label || lead.status}</span>
                          <ChevronDown className="h-3 w-3 shrink-0 opacity-80" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="min-w-[160px] p-1">
                        {statusOptions
                          .filter((opt) => opt.value !== "converted")
                          .map((opt) => (
                            <DropdownMenuItem
                              key={opt.value}
                              onClick={() => void changeStatus(lead, opt.value)}
                              className="p-1 focus:bg-transparent"
                              data-testid={`lead-board-status-option-${lead.id}-${opt.value}`}
                            >
                              <span
                                className={cn(
                                  "w-full min-h-[28px] px-2 rounded-[4px] text-[12px] font-medium capitalize",
                                  "flex items-center justify-center",
                                  opt.color,
                                )}
                              >
                                {opt.label}
                              </span>
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span
                      className={cn(
                        "w-full min-h-[28px] px-2 rounded-[4px] text-[12px] font-medium",
                        "inline-flex items-center justify-center capitalize",
                        status?.color || "bg-[#c4c4c4] text-white",
                      )}
                    >
                      {status?.label || lead.status}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <div
                    className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[9px] font-semibold"
                    style={{ backgroundColor: owner.color }}
                  >
                    {owner.initials}
                  </div>
                  {lead.score != null && (
                    <span className="text-[10px] text-muted-foreground">Score {lead.score}</span>
                  )}
                </div>
              </div>
              {onConvert && lead.status !== "converted" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 m-1 text-[#0073ea]"
                  onClick={() => onConvert(lead)}
                  title="Convert lead"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        );
      }}
    />
  );
}

export function CrmLeadCalendarView({
  leads,
  statusOptions,
  onOpenLead,
  onAddLead,
}: SharedProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const statusMap = useMemo(
    () => Object.fromEntries(statusOptions.map((o) => [o.value, o])),
    [statusOptions],
  );

  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: Date[] = [];
    const startPadding = firstDay.getDay();
    for (let i = startPadding - 1; i >= 0; i--) {
      days.push(new Date(year, month, -i));
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    const endPadding = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= endPadding; i++) {
      days.push(new Date(year, month + 1, i));
    }
    return days;
  }, [currentDate]);

  const itemsByDate = useMemo(() => {
    const map: Record<string, CrmLead[]> = {};
    for (const lead of leads) {
      const key = new Date(lead.createdAt).toDateString();
      if (!map[key]) map[key] = [];
      map[key].push(lead);
    }
    return map;
  }, [leads]);

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthLabel = currentDate.toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden" data-testid="leads-calendar-view">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-sm font-semibold min-w-[160px] text-center">{monthLabel}</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {onAddLead && (
          <Button size="sm" variant="outline" onClick={onAddLead} className="gap-1">
            <Plus className="h-3.5 w-3.5" />
            New Lead
          </Button>
        )}
      </div>
      <div className="grid grid-cols-7 border-b border-border/40">
        {weekDays.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-[minmax(96px,1fr)]">
        {daysInMonth.map((date, idx) => {
          const inMonth = date.getMonth() === currentDate.getMonth();
          const today = new Date().toDateString() === date.toDateString();
          const dayLeads = itemsByDate[date.toDateString()] || [];
          return (
            <div
              key={`${date.toISOString()}-${idx}`}
              className={cn(
                "border-r border-b border-border/30 p-1.5 min-h-[96px]",
                !inMonth && "bg-muted/20",
              )}
            >
              <div
                className={cn(
                  "text-[11px] font-medium mb-1 h-5 w-5 flex items-center justify-center rounded-full",
                  today && "bg-primary text-primary-foreground",
                  !inMonth && "text-muted-foreground",
                )}
              >
                {date.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayLeads.slice(0, 3).map((lead) => {
                  const status = statusMap[lead.status];
                  return (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => onOpenLead(lead)}
                      className={cn(
                        "w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate",
                        status?.color || "bg-muted",
                      )}
                      title={`${lead.company || lead.firstName} — ${status?.label || lead.status}`}
                    >
                      {lead.company || `${lead.firstName} ${lead.lastName}`}
                    </button>
                  );
                })}
                {dayLeads.length > 3 && (
                  <p className="text-[10px] text-muted-foreground px-1">+{dayLeads.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
