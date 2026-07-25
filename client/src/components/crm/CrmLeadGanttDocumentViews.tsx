import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { StatusOption } from "@/components/MondayTable";
import type { CrmLead } from "./types";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Paperclip,
  Plus,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

type OwnerInfo = { name: string; initials: string; color: string };

export type SharedLeadViewProps = {
  leads: CrmLead[];
  statusOptions: StatusOption[];
  resolveOwner: (userId: string | null | undefined) => OwnerInfo;
  onOpenLead: (lead: CrmLead) => void;
  onConvert?: (lead: CrmLead) => void;
  onAddLead?: () => void;
};

function getFollowUpDate(lead: CrmLead): Date | null {
  const raw =
    lead.customData && typeof lead.customData === "object"
      ? (lead.customData as Record<string, unknown>)["_followUpDate"]
      : undefined;
  if (typeof raw === "string" && raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function getBarStart(lead: CrmLead): Date | null {
  return getFollowUpDate(lead) || (lead.createdAt ? new Date(lead.createdAt) : null);
}

function leadTitle(lead: CrmLead): string {
  return lead.company || `${lead.firstName} ${lead.lastName}`.trim() || `Lead ${lead.id}`;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function extractBg(colorClass?: string): string {
  return colorClass?.match(/bg-\[([^\]]+)\]/)?.[1] || "#0073ea";
}

/** Full Infinity-style Gantt: zoom, drag to set follow-up, duration bars. */
export function CrmLeadGanttView({
  leads,
  statusOptions,
  onOpenLead,
  onAddLead,
  onFollowUpChange,
}: SharedLeadViewProps & {
  onFollowUpChange?: (leadId: number, isoDate: string) => Promise<void>;
}) {
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 7);
    return d;
  });
  const [dayWidth, setDayWidth] = useState(28);
  const [dayCount, setDayCount] = useState(56);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOffsetDays, setDragOffsetDays] = useState(0);
  const dragStartX = useRef(0);
  const dragOffsetRef = useRef(0);

  const dayMs = 86400000;
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => new Date(anchor.getTime() + i * dayMs)),
    [anchor, dayCount],
  );

  const statusMap = useMemo(
    () => Object.fromEntries(statusOptions.map((o) => [o.value, o])),
    [statusOptions],
  );

  const sorted = useMemo(() => {
    return [...leads].sort((a, b) => {
      const da = getBarStart(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const db = getBarStart(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return da - db;
    });
  }, [leads]);

  const shiftWeeks = (delta: number) => {
    setAnchor((prev) => new Date(prev.getTime() + delta * 7 * dayMs));
  };

  const zoom = (dir: 1 | -1) => {
    setDayWidth((w) => Math.min(48, Math.max(16, w + dir * 4)));
    setDayCount((c) => Math.min(120, Math.max(28, c - dir * 7)));
  };

  const monthLabel = `${anchor.toLocaleString("en-US", { month: "short", day: "numeric" })} – ${
    days[days.length - 1]?.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }`;

  const indexForDate = (d: Date | null) => {
    if (!d) return -1;
    return Math.floor((d.getTime() - anchor.getTime()) / dayMs);
  };

  const finishDrag = async (lead: CrmLead) => {
    const offset = dragOffsetRef.current;
    setDraggingId(null);
    setDragOffsetDays(0);
    dragOffsetRef.current = 0;
    if (!onFollowUpChange || offset === 0) return;
    const base = getBarStart(lead) || new Date();
    const next = new Date(base.getTime() + offset * dayMs);
    await onFollowUpChange(lead.id, toIsoDate(next));
  };

  return (
    <div className="rounded-xl border border-[#d0d4e4] dark:border-border bg-white dark:bg-card overflow-hidden" data-testid="leads-gantt-view">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-[#d0d4e4] dark:border-border bg-[#f5f6f8] dark:bg-muted/40">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shiftWeeks(-2)} aria-label="Earlier">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-[13px] font-medium text-[#323338] dark:text-foreground min-w-[180px] text-center">{monthLabel}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shiftWeeks(2)} aria-label="Later">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => zoom(-1)} title="Zoom out">
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => zoom(1)} title="Zoom in">
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#676879] dark:text-muted-foreground">Drag bars to set follow-up date</span>
          {onAddLead && (
            <Button size="sm" className="h-7 bg-[#0073ea] hover:bg-[#0060b9] text-white gap-1" onClick={onAddLead}>
              <Plus className="h-3.5 w-3.5" />
              New Lead
            </Button>
          )}
        </div>
      </div>
      {sorted.length === 0 ? (
        <div className="p-10 text-center text-sm text-[#676879] dark:text-muted-foreground">No leads to show on the timeline.</div>
      ) : (
        <div className="flex overflow-auto max-h-[min(72vh,680px)]">
          <div className="w-56 shrink-0 sticky left-0 z-10 bg-white dark:bg-card border-r border-[#d0d4e4] dark:border-border">
            <div className="h-10 px-3 flex items-center text-[12px] font-medium text-[#676879] dark:text-muted-foreground bg-[#f5f6f8] dark:bg-muted/40 border-b border-[#d0d4e4] dark:border-border">
              Lead
            </div>
            {sorted.map((lead) => (
              <button
                key={lead.id}
                type="button"
                className="h-10 w-full px-3 text-left text-[13px] truncate border-b border-[#d0d4e4]/80 dark:border-border/80 hover:bg-[#cce5ff]/30 dark:hover:bg-primary/20 text-[#323338] dark:text-foreground"
                onClick={() => onOpenLead(lead)}
              >
                {leadTitle(lead)}
              </button>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex h-10 bg-[#f5f6f8] dark:bg-muted/40 border-b border-[#d0d4e4] dark:border-border sticky top-0 z-[5]">
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "shrink-0 text-center text-[10px] py-1.5 border-r border-[#d0d4e4]/60 dark:border-border/60 text-[#676879] dark:text-muted-foreground",
                    day.getDay() === 0 || day.getDay() === 6 ? "bg-[#f0f1f5] dark:bg-muted/70" : "",
                    day.toDateString() === new Date().toDateString() &&
                      "bg-[#cce5ff]/50 dark:bg-primary/25 font-semibold text-[#0073ea] dark:text-primary",
                  )}
                  style={{ width: dayWidth }}
                >
                  <div>{day.getDate()}</div>
                  <div className="opacity-70">{day.toLocaleString("en-US", { weekday: "narrow" })}</div>
                </div>
              ))}
            </div>
            {sorted.map((lead) => {
              const start = getBarStart(lead);
              let dayIndex = indexForDate(start);
              if (draggingId === lead.id) dayIndex += dragOffsetDays;
              const durationDays = 3;
              const status = statusMap[lead.status];
              const barColor = extractBg(status?.color);
              const visible = dayIndex > -durationDays && dayIndex < dayCount;
              return (
                <div key={lead.id} className="relative flex h-10 border-b border-[#d0d4e4]/80 dark:border-border/80">
                  {days.map((_, idx) => (
                    <div
                      key={idx}
                      className="shrink-0 border-r border-[#d0d4e4]/40 dark:border-border/40"
                      style={{ width: dayWidth }}
                    />
                  ))}
                  {visible && (
                    <button
                      type="button"
                      className={cn(
                        "absolute top-2 h-6 rounded-[4px] text-white text-[10px] font-medium px-2 truncate cursor-grab active:cursor-grabbing shadow-sm",
                        draggingId === lead.id && "ring-2 ring-[#0073ea] z-10",
                      )}
                      style={{
                        left: Math.max(0, dayIndex) * dayWidth,
                        width: durationDays * dayWidth,
                        backgroundColor: barColor,
                      }}
                      title={`${leadTitle(lead)} — drag to change follow-up`}
                      onClick={(e) => {
                        if (Math.abs(dragOffsetDays) > 0) return;
                        e.stopPropagation();
                        onOpenLead(lead);
                      }}
                      onMouseDown={(e) => {
                        if (!onFollowUpChange) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setDraggingId(lead.id);
                        dragStartX.current = e.clientX;
                        dragOffsetRef.current = 0;
                        setDragOffsetDays(0);
                        const onMove = (ev: MouseEvent) => {
                          const dx = ev.clientX - dragStartX.current;
                          const daysDelta = Math.round(dx / dayWidth);
                          dragOffsetRef.current = daysDelta;
                          setDragOffsetDays(daysDelta);
                        };
                        const onUp = () => {
                          window.removeEventListener("mousemove", onMove);
                          window.removeEventListener("mouseup", onUp);
                          void finishDrag(lead);
                        };
                        window.addEventListener("mousemove", onMove);
                        window.addEventListener("mouseup", onUp);
                      }}
                    >
                      {leadTitle(lead)}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

type AttachmentRow = { id: number; entityId: number; fileName: string; fileUrl?: string };

/** Document view with description + linked files. */
export function CrmLeadDocumentView({
  leads,
  onOpenLead,
  onAddLead,
  onSaveDescription,
}: SharedLeadViewProps & {
  onSaveDescription?: (leadId: number, description: string) => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(leads[0]?.id ?? null);
  const selected = leads.find((l) => l.id === selectedId) || null;
  const [draft, setDraft] = useState(selected?.description || "");
  const [titleDraft, setTitleDraft] = useState(selected ? leadTitle(selected) : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selected) return;
    setDraft(selected.description || "");
    setTitleDraft(leadTitle(selected));
  }, [selected?.id, selected?.description, selected?.company, selected?.firstName, selected?.lastName]);

  const { data: attachments = [] } = useQuery<AttachmentRow[]>({
    queryKey: selected
      ? [`/api/crm/attachments?entityType=lead&entityId=${selected.id}`]
      : ["__skip_attachments"],
    enabled: !!selected,
  });

  const selectLead = (lead: CrmLead) => {
    setSelectedId(lead.id);
  };

  const handleSave = async () => {
    if (!selected || !onSaveDescription) return;
    setSaving(true);
    try {
      await onSaveDescription(selected.id, draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-xl border border-[#d0d4e4] dark:border-border bg-white dark:bg-card overflow-hidden grid grid-cols-1 md:grid-cols-[260px_1fr] min-h-[480px]"
      data-testid="leads-document-view"
    >
      <div className="border-r border-[#d0d4e4] dark:border-border bg-[#f5f6f8] dark:bg-muted/40">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#d0d4e4] dark:border-border">
          <span className="text-[12px] font-semibold text-[#676879] dark:text-muted-foreground flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            Documents
          </span>
          {onAddLead && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAddLead}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div className="max-h-[520px] overflow-y-auto">
          {leads.length === 0 ? (
            <p className="p-4 text-xs text-[#676879] dark:text-muted-foreground">No leads yet.</p>
          ) : (
            leads.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => selectLead(lead)}
                className={cn(
                  "w-full text-left px-3 py-2.5 text-[13px] border-b border-[#d0d4e4]/60 dark:border-border/60",
                  selectedId === lead.id
                    ? "bg-[#cce5ff] dark:bg-primary/25 text-[#0073ea] dark:text-primary"
                    : "hover:bg-white dark:hover:bg-card text-[#323338] dark:text-foreground",
                )}
              >
                <div className="truncate font-medium">{leadTitle(lead)}</div>
                <div className="text-[11px] text-[#676879] dark:text-muted-foreground truncate mt-0.5">
                  {(lead.description || "").slice(0, 60) || "Empty document"}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
      <div className="flex flex-col p-4 gap-3 bg-[#fafbfc] dark:bg-background">
        {selected ? (
          <>
            <Input
              value={titleDraft}
              readOnly
              className="text-[18px] font-semibold border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 h-auto"
              onClick={() => onOpenLead(selected)}
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-[#676879] dark:text-muted-foreground">
                Updated {selected.updatedAt ? new Date(selected.updatedAt).toLocaleString() : "—"}
              </p>
              {onSaveDescription && (
                <Button
                  size="sm"
                  className="h-8 bg-[#0073ea] hover:bg-[#0060b9] text-white"
                  disabled={saving}
                  onClick={handleSave}
                  data-testid="button-save-lead-doc"
                >
                  {saving ? "Saving…" : "Save document"}
                </Button>
              )}
            </div>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="# Meeting notes&#10;&#10;- Next steps&#10;- Decisions&#10;- Risks"
              className="flex-1 min-h-[300px] text-[14px] leading-relaxed border-[#c5c7d0] dark:border-border bg-white dark:bg-card resize-none font-sans"
              data-testid="input-lead-doc-body"
            />
            <div className="border-t border-[#d0d4e4] dark:border-border pt-3">
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#676879] dark:text-muted-foreground mb-2">
                <Paperclip className="h-3.5 w-3.5" />
                Attachments ({attachments.length})
              </div>
              {attachments.length === 0 ? (
                <p className="text-[12px] text-[#676879] dark:text-muted-foreground">Drop files on a table row, or open the lead to attach files.</p>
              ) : (
                <ul className="space-y-1">
                  {attachments.map((a) => (
                    <li key={a.id}>
                      <a
                        href={a.fileUrl || "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[13px] text-[#0073ea] hover:underline"
                      >
                        {a.fileName}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-[#676879] dark:text-muted-foreground">
            Select a lead to open its document.
          </div>
        )}
      </div>
    </div>
  );
}
