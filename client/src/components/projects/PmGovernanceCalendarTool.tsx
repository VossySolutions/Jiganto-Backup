import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Governance Calendar — recurring governance touchpoints (steering board,
 * status calls, gate reviews) for a project. Nothing equivalent exists
 * today; the closest tool (Status Reporting) is about producing a report,
 * not scheduling the cadence of governance events. Stored on the project's
 * metadata, same pattern as Action Log / Stakeholders / SoW.
 */

interface GovernanceEvent {
  id: string;
  title: string;
  eventType: string;
  date: string;
  recurrence: "none" | "weekly" | "fortnightly" | "monthly";
}

interface ToolProps {
  projectId: number;
  project?: any;
}

const EVENT_TYPES = ["Steering Board", "Status Call", "Gate Review", "Sponsor Review", "Retrospective", "Other"];
const RECURRENCE_LABEL: Record<GovernanceEvent["recurrence"], string> = {
  none: "One-off",
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
};

function nextOccurrences(ev: GovernanceEvent, count: number): Date[] {
  const base = new Date(ev.date);
  if (Number.isNaN(base.getTime())) return [];
  if (ev.recurrence === "none") return [base];
  const stepDays = ev.recurrence === "weekly" ? 7 : ev.recurrence === "fortnightly" ? 14 : 30;
  const out: Date[] = [];
  const cursor = new Date(base);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  while (out.length < count) {
    if (cursor.getTime() >= today.getTime() || cursor.getTime() === base.getTime()) {
      out.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + stepDays);
    if (cursor.getFullYear() > base.getFullYear() + 3) break;
  }
  return out;
}

export function PmGovernanceCalendarTool({ projectId, project }: ToolProps) {
  const { toast } = useToast();
  const meta = (project?.metadata as Record<string, unknown>) || {};
  const events = (meta.governanceEvents as GovernanceEvent[]) || [];
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [date, setDate] = useState("");
  const [recurrence, setRecurrence] = useState<GovernanceEvent["recurrence"]>("none");

  const isLoading = !project;

  const save = useMutation({
    mutationFn: (next: GovernanceEvent[]) => apiRequest("PUT", `/api/pm/projects/${projectId}`, { metadata: { ...meta, governanceEvents: next } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/pm/projects", projectId] }),
  });

  const addEvent = () => {
    const next: GovernanceEvent = { id: String(Date.now()), title, eventType, date, recurrence };
    save.mutate([...events, next]);
    setTitle("");
    setDate("");
    setRecurrence("none");
    toast({ title: "Governance event added" });
  };

  const removeEvent = (id: string) => save.mutate(events.filter((e) => e.id !== id));

  const upcoming = useMemo(() => {
    const rows: { event: GovernanceEvent; date: Date }[] = [];
    events.forEach((e) => {
      nextOccurrences(e, e.recurrence === "none" ? 1 : 4).forEach((d) => rows.push({ event: e, date: d }));
    });
    return rows.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 30);
  }, [events]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Event</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekly steering call" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">Type</label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="mt-1 w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">First date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase">Recurrence</label>
            <Select value={recurrence} onValueChange={(v) => setRecurrence(v as GovernanceEvent["recurrence"])}>
              <SelectTrigger className="mt-1 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(RECURRENCE_LABEL) as GovernanceEvent["recurrence"][]).map((r) => (
                  <SelectItem key={r} value={r}>{RECURRENCE_LABEL[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" disabled={!title.trim() || !date || save.isPending} onClick={addEvent}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Upcoming governance events</h3>
          </div>
          {upcoming.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">No governance events scheduled.</div>
          ) : (
            <ul className="divide-y">
              {upcoming.map(({ event, date: d }, idx) => {
                const isPast = d.getTime() < Date.now() - 86400000;
                return (
                  <li key={`${event.id}-${idx}`} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-14 text-xs font-semibold shrink-0", isPast ? "text-muted-foreground" : "text-primary")}>
                        {d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                      </div>
                      <div>
                        <div className="font-medium">{event.title}</div>
                        <div className="text-xs text-muted-foreground">{event.eventType} · {RECURRENCE_LABEL[event.recurrence]}</div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeEvent(event.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default PmGovernanceCalendarTool;
