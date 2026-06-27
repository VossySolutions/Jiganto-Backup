import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  PlayCircle, Bug, Plus, Settings, CheckCircle2,
  XCircle, MinusCircle, Clock, Filter, Search, Download
} from "lucide-react";
import { useTmFetch } from "@/hooks/use-tm-fetch";
import { TmScreenShell } from "@/components/testmgmt/TmScreenShell";

type AuditEvent = {
  id: string;
  eventType: "execution" | "defect_raised" | "defect_updated" | "case_created" | "run_created" | "defect_resolved";
  actor: string;
  entity: string;
  detail: string;
  timestamp: string;
  metadata?: Record<string, any>;
};

const EVENT_CONFIG: Record<string, { icon: JSX.Element; label: string; cls: string }> = {
  execution:       { icon: <PlayCircle className="h-3.5 w-3.5" />,   label: "Execution",       cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  defect_raised:   { icon: <Bug className="h-3.5 w-3.5" />,          label: "Defect Raised",   cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  defect_updated:  { icon: <Settings className="h-3.5 w-3.5" />,     label: "Defect Updated",  cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  defect_resolved: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: "Defect Resolved", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  case_created:    { icon: <Plus className="h-3.5 w-3.5" />,         label: "Case Created",    cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  run_created:     { icon: <PlayCircle className="h-3.5 w-3.5" />,   label: "Run Created",     cls: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
};

const STATUS_ICON: Record<string, JSX.Element> = {
  pass:    <CheckCircle2 className="h-3 w-3 text-green-500" />,
  fail:    <XCircle className="h-3 w-3 text-red-500" />,
  blocked: <MinusCircle className="h-3 w-3 text-orange-500" />,
  not_run: <Clock className="h-3 w-3 text-muted-foreground" />,
};

export function AuditTrailScreen() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterActor, setFilterActor] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const {
    data: events = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useTmFetch<AuditEvent[]>(["/api/tm/audit"], "/api/tm/audit");

  const actors = Array.from(new Set(events.map(e => e.actor).filter(Boolean)));
  const eventTypes = Array.from(new Set(events.map(e => e.eventType)));

  const filtered = events.filter(e => {
    if (filterType !== "all" && e.eventType !== filterType) return false;
    if (filterActor !== "all" && e.actor !== filterActor) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.entity.toLowerCase().includes(q) && !e.detail.toLowerCase().includes(q) && !e.actor.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function exportCSV() {
    const rows = [
      ["Timestamp", "Event Type", "Actor", "Entity", "Detail"],
      ...filtered.map(e => [e.timestamp, e.eventType, e.actor, e.entity, e.detail]),
    ];
    const csv = rows.map(r => r.map(c => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "audit_trail.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  // Summary stats
  const execs = events.filter(e => e.eventType === "execution").length;
  const defects = events.filter(e => e.eventType === "defect_raised").length;
  const resolved = events.filter(e => e.eventType === "defect_resolved").length;
  const today = new Date().toDateString();
  const todayCount = events.filter(e => e.timestamp && new Date(e.timestamp).toDateString() === today).length;

  return (
    <TmScreenShell
      loading={isLoading}
      error={isError ? error : null}
      onRetry={() => refetch()}
      label="Loading audit trail..."
    >
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-1">Audit Trail</h2>
            <p className="text-sm text-muted-foreground">Complete history of test executions, defect activity, and system events.</p>
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 text-xs border border-border rounded-lg px-3 py-1.5 hover:bg-muted/50 transition-colors"
            data-testid="btn-export-audit"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Events", val: events.length, cls: "text-primary" },
          { label: "Executions", val: execs, cls: "text-blue-600" },
          { label: "Defects Raised", val: defects, cls: "text-red-600" },
          { label: "Today", val: todayCount, cls: "text-green-600" },
        ].map(({ label, val, cls }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className={cn("text-2xl font-bold font-mono", cls)}>{val}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
          <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <input
            className="flex-1 border border-border rounded-lg px-3 py-1.5 text-xs bg-background"
            placeholder="Search events, actors, entities..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            data-testid="input-audit-search"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            className="border border-border rounded-lg px-2 py-1.5 text-xs bg-background"
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setPage(1); }}
            data-testid="filter-audit-type"
          >
            <option value="all">All Types</option>
            {eventTypes.map(t => <option key={t} value={t}>{EVENT_CONFIG[t]?.label ?? t}</option>)}
          </select>
          <select
            className="border border-border rounded-lg px-2 py-1.5 text-xs bg-background"
            value={filterActor}
            onChange={e => { setFilterActor(e.target.value); setPage(1); }}
            data-testid="filter-audit-actor"
          >
            <option value="all">All Actors</option>
            {actors.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        {(search || filterType !== "all" || filterActor !== "all") && (
          <button
            className="text-xs text-muted-foreground underline"
            onClick={() => { setSearch(""); setFilterType("all"); setFilterActor("all"); setPage(1); }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Event List */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground text-sm">
          {events.length === 0
            ? "No activity recorded yet. Activity appears here as you create and execute tests."
            : "No events match the current filters."}
        </div>
      ) : (
        <>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold w-36">Time</th>
                  <th className="text-left px-4 py-2.5 font-semibold w-32">Event</th>
                  <th className="text-left px-4 py-2.5 font-semibold w-28">Actor</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Entity</th>
                  <th className="text-left px-4 py-2.5 font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {paged.map(event => {
                  const cfg = EVENT_CONFIG[event.eventType];
                  return (
                    <tr key={event.id} className="hover:bg-muted/20 group" data-testid={`audit-row-${event.id}`}>
                      <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
                        {event.timestamp ? (
                          <>
                            <div>{new Date(event.timestamp).toLocaleDateString()}</div>
                            <div>{new Date(event.timestamp).toLocaleTimeString()}</div>
                          </>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold", cfg?.cls ?? "bg-muted text-muted-foreground")}>
                          {cfg?.icon}
                          {cfg?.label ?? event.eventType}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium">{event.actor || "System"}</td>
                      <td className="px-4 py-2.5 max-w-[200px] truncate">{event.entity}</td>
                      <td className="px-4 py-2.5 max-w-[280px] text-muted-foreground truncate">{event.detail}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} events</div>
              <div className="flex gap-1">
                {page > 1 && (
                  <button onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border border-border rounded hover:bg-muted/50">← Prev</button>
                )}
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p = page <= 4 ? i + 1 : page - 3 + i;
                  if (p < 1 || p > totalPages) return null;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={cn("px-2.5 py-1.5 border rounded", p === page ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted/50")}>
                      {p}
                    </button>
                  );
                })}
                {page < totalPages && (
                  <button onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border border-border rounded hover:bg-muted/50">Next →</button>
                )}
              </div>
            </div>
          )}
        </>
      )}
      </div>
    </TmScreenShell>
  );
}
