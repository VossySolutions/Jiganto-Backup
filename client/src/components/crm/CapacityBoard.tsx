import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Search, ChevronRight, ChevronDown, ChevronsUpDown,
  Users, Filter, Percent, Hash, Loader2
} from "lucide-react";

type ResourceEntry = {
  id: number;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  department?: string | null;
  status: string;
  photoUrl?: string | null;
  weeklyCapacityHours?: string | null;
};

type Allocation = {
  id: number;
  resourceId: number;
  projectId: number | null;
  projectName: string | null;
  allocationType: string;
  allocationPercentage: string;
  hoursPerWeek: string | null;
  role: string | null;
  startDate: string;
  endDate: string;
  status: string;
};

type OppResourceRow = {
  id: number;
  planId: number;
  phase: string;
  roleName: string;
  resourceId: number | null;
  namedResourceLabel: string;
  startDate: string;
  endDate: string;
  daysPerWeek: number;
  dailyRate: number;
  status: string;
  breaks: Array<{ start: string; end: string; reason: string; notes: string }>;
};

type OppPlan = {
  id: number;
  opportunityId: number;
  opportunityName?: string;
  rows: OppResourceRow[];
};

const DAYS_PER_WEEK = 5;

function getWeekStarts(startDate: Date, weeks: number): Date[] {
  const result: Date[] = [];
  const d = new Date(startDate);
  const dayOfWeek = d.getDay();
  d.setDate(d.getDate() - ((dayOfWeek + 6) % 7));
  for (let i = 0; i < weeks; i++) {
    result.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return result;
}

function weekKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isDateInRange(ws: Date, startStr: string, endStr: string): boolean {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const we = new Date(ws);
  we.setDate(we.getDate() + 6);
  return ws <= end && we >= start;
}

function isInBreak(ws: Date, breaks: Array<{ start: string; end: string }>): boolean {
  const we = new Date(ws);
  we.setDate(we.getDate() + 6);
  return breaks.some(b => {
    const bs = new Date(b.start), be = new Date(b.end);
    return ws.getTime() <= be.getTime() && we.getTime() >= bs.getTime();
  });
}

type WeekAlloc = {
  confirmed: number;
  tentative: number;
  breakDays: number;
  total: number;
  projects: Array<{ name: string; days: number; status: string }>;
  breakReasons: string[];
};

function buildResourceWeekMap(
  resourceId: number,
  allocations: Allocation[],
  oppRows: OppResourceRow[],
  weekStarts: Date[]
): Map<string, WeekAlloc> {
  const map = new Map<string, WeekAlloc>();
  for (const ws of weekStarts) {
    const key = weekKey(ws);
    const alloc: WeekAlloc = { confirmed: 0, tentative: 0, breakDays: 0, total: 0, projects: [], breakReasons: [] };

    const myAllocations = allocations.filter(a => a.resourceId === resourceId);
    for (const a of myAllocations) {
      if (isDateInRange(ws, a.startDate, a.endDate)) {
        const pct = parseFloat(a.allocationPercentage) || 0;
        const days = (pct / 100) * DAYS_PER_WEEK;
        alloc.confirmed += days;
        alloc.total += days;
        alloc.projects.push({ name: a.projectName || `Project #${a.projectId}`, days, status: "Confirmed" });
      }
    }

    const myRows = oppRows.filter(r => r.resourceId === resourceId);
    for (const r of myRows) {
      if (isDateInRange(ws, r.startDate, r.endDate)) {
        if (isInBreak(ws, r.breaks || [])) {
          alloc.breakDays += r.daysPerWeek;
          const brk = (r.breaks || []).find(b => {
            const bs = new Date(b.start), be = new Date(b.end);
            return ws.getTime() <= be.getTime() && new Date(ws.getTime() + 6 * 86400000).getTime() >= bs.getTime();
          });
          if (brk) alloc.breakReasons.push(brk.reason);
        } else {
          const days = r.daysPerWeek;
          if (r.status === "Confirmed") {
            alloc.confirmed += days;
          } else {
            alloc.tentative += days;
          }
          alloc.total += days;
          alloc.projects.push({ name: r.namedResourceLabel || r.roleName, days, status: r.status });
        }
      }
    }

    map.set(key, alloc);
  }
  return map;
}

function getUtilColor(pct: number, hasBreak: boolean): string {
  if (hasBreak) return "bg-amber-200 dark:bg-amber-800/40";
  if (pct > 100) return "bg-red-700 dark:bg-red-800";
  if (pct >= 80) return "bg-emerald-500 dark:bg-emerald-600";
  if (pct >= 50) return "bg-amber-400 dark:bg-amber-500";
  if (pct > 0) return "bg-slate-300 dark:bg-slate-600";
  return "bg-slate-100 dark:bg-slate-800";
}

function getUtilTextColor(pct: number): string {
  if (pct > 100) return "text-red-600 dark:text-red-400 font-bold";
  if (pct >= 80) return "text-emerald-700 dark:text-emerald-400";
  if (pct > 0) return "text-muted-foreground";
  return "text-muted-foreground/50";
}

type AllocationLine = {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
  breaks?: Array<{ start: string; end: string; reason: string }>;
};

function buildAllocationLines(
  resourceId: number,
  allocations: Allocation[],
  oppRows: OppResourceRow[]
): AllocationLine[] {
  const lines: AllocationLine[] = [];
  for (const a of allocations.filter(x => x.resourceId === resourceId)) {
    lines.push({
      id: `alloc-${a.id}`,
      name: a.projectName || `Project #${a.projectId}`,
      status: "Confirmed",
      startDate: a.startDate,
      endDate: a.endDate,
    });
  }
  for (const r of oppRows.filter(x => x.resourceId === resourceId)) {
    lines.push({
      id: `opp-${r.id}`,
      name: r.namedResourceLabel || r.roleName,
      status: r.status,
      startDate: r.startDate,
      endDate: r.endDate,
      breaks: r.breaks,
    });
  }
  return lines;
}

function buildLineWeekActiveMap(line: AllocationLine, weekStarts: Date[]): Set<string> {
  const weeks = new Set<string>();
  for (const ws of weekStarts) {
    if (!isDateInRange(ws, line.startDate, line.endDate)) continue;
    if (line.breaks?.length && isInBreak(ws, line.breaks)) continue;
    weeks.add(weekKey(ws));
  }
  return weeks;
}

export type CapacityBoardProps = {
  scope?: "org" | "crm";
  weeks?: number;
  pageSize?: number;
  onNewAllocation?: () => void;
};

export function CapacityBoard({ scope = "org", weeks = 12, pageSize = 50, onNewAllocation }: CapacityBoardProps = {}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [showConfirmed, setShowConfirmed] = useState(true);
  const [showPipeline, setShowPipeline] = useState(true);
  const [showLeave, setShowLeave] = useState(true);
  const [page, setPage] = useState(0);
  const [displayMode, setDisplayMode] = useState<"percent" | "days">("percent");
  const [expandedResources, setExpandedResources] = useState<Set<number>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  const { data: resources = [], isLoading: resourcesLoading } = useQuery<ResourceEntry[]>({
    queryKey: ["/api/resources"],
  });

  const { data: allocations = [], isLoading: allocationsLoading } = useQuery<Allocation[]>({
    queryKey: ["/api/resources/allocations"],
  });

  const { data: opportunities = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/crm/opportunities"],
  });

  const { data: allPlanRows = [], isLoading: planRowsLoading } = useQuery<Array<OppResourceRow & { opportunityId: number; opportunityName?: string }>>({
    queryKey: ["/api/crm/resource-plans/all-rows"],
  });

  const oppRows: OppResourceRow[] = allPlanRows.map(r => ({
    ...r,
    namedResourceLabel: r.namedResourceLabel || r.opportunityName || r.roleName,
  }));

  const today = new Date();
  const TOTAL_WEEKS = weeks;
  const weekStarts = useMemo(() => getWeekStarts(today, TOTAL_WEEKS), [TOTAL_WEEKS]);

  const monthGroups = useMemo(() => {
    const groups: Array<{ label: string; span: number }> = [];
    let cur: { label: string; span: number } | null = null;
    weekStarts.forEach(ws => {
      const label = ws.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      if (cur && cur.label === label) { cur.span++; } else { if (cur) groups.push(cur); cur = { label, span: 1 }; }
    });
    if (cur) groups.push(cur);
    return groups;
  }, [weekStarts]);

  const uniqueRoles = useMemo(() => {
    const roles = new Set<string>();
    resources.forEach(r => { if (r.jobTitle) roles.add(r.jobTitle); });
    return Array.from(roles).sort();
  }, [resources]);

  const departments = useMemo(() => {
    const d = new Set<string>();
    resources.forEach((r) => { if (r.department) d.add(r.department); });
    return Array.from(d).sort();
  }, [resources]);

  const filteredResources = useMemo(() => {
    let filtered = resources;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) ||
        (r.jobTitle || "").toLowerCase().includes(q)
      );
    }
    if (roleFilter !== "all") {
      filtered = filtered.filter(r => r.jobTitle === roleFilter);
    }
    if (deptFilter !== "all") {
      filtered = filtered.filter(r => r.department === deptFilter);
    }
    if (availableOnly) {
      filtered = filtered.filter((r) => {
        const wm = buildResourceWeekMap(r.id, allocations, showPipeline ? oppRows : [], weekStarts);
        const firstWeek = weekStarts[0] ? weekKey(weekStarts[0]) : "";
        const alloc = wm.get(firstWeek);
        return (alloc?.total ?? 0) < 5;
      });
    }
    return filtered;
  }, [resources, searchQuery, roleFilter, deptFilter, availableOnly, allocations, oppRows, weekStarts, showPipeline]);

  const pagedResources = useMemo(() => {
    const start = page * pageSize;
    return filteredResources.slice(start, start + pageSize);
  }, [filteredResources, page, pageSize]);

  const hasMore = (page + 1) * pageSize < filteredResources.length;

  const weekMaps = useMemo(() => {
    const maps = new Map<number, Map<string, WeekAlloc>>();
    const rows = showPipeline ? oppRows : [];
    pagedResources.forEach(r => {
      maps.set(r.id, buildResourceWeekMap(r.id, allocations, rows, weekStarts));
    });
    return maps;
  }, [pagedResources, allocations, oppRows, weekStarts, showPipeline]);

  const toggleExpand = useCallback((id: number) => {
    setExpandedResources(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allExpanded) {
      setExpandedResources(new Set());
      setAllExpanded(false);
    } else {
      setExpandedResources(new Set(filteredResources.map(r => r.id)));
      setAllExpanded(true);
    }
  }, [allExpanded, filteredResources]);

  const isLoading = resourcesLoading || allocationsLoading || planRowsLoading;

  if (isLoading) {
    return (
      <div className="border rounded-xl bg-card p-12 text-center" data-testid="capacity-board-loading">
        <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading capacity data...</p>
      </div>
    );
  }

  const CELL_W = 44;

  return (
    <div className="border rounded-xl overflow-hidden bg-card shadow-sm" data-testid="capacity-board">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[#0ea5e9]" />
          <h3 className="text-sm font-bold">Capacity Board</h3>
          <Badge variant="outline" className="text-[10px]">{filteredResources.length} resources</Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search name..."
              className="pl-8 h-8 text-xs w-40"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              data-testid="input-capacity-search"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-8 text-xs w-36" data-testid="select-role-filter">
              <Filter className="h-3 w-3 mr-1" />
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {uniqueRoles.map(r => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {departments.length > 0 && (
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="h-8 text-xs w-36"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button variant={availableOnly ? "default" : "outline"} size="sm" className="h-8 text-xs" onClick={() => setAvailableOnly(!availableOnly)}>
            Available only
          </Button>
          {onNewAllocation && (
            <Button size="sm" className="h-8 text-xs" onClick={onNewAllocation}>+ New allocation</Button>
          )}
          <div className="flex border rounded-md overflow-hidden">
            <button
              onClick={() => setDisplayMode("percent")}
              className={cn("flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold transition-colors",
                displayMode === "percent" ? "bg-[#0ea5e9] text-white" : "bg-card text-muted-foreground hover:bg-muted")}
              data-testid="toggle-percent"
            >
              <Percent className="h-3 w-3" /> %
            </button>
            <button
              onClick={() => setDisplayMode("days")}
              className={cn("flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold transition-colors border-l",
                displayMode === "days" ? "bg-[#0ea5e9] text-white" : "bg-card text-muted-foreground hover:bg-muted")}
              data-testid="toggle-days"
            >
              <Hash className="h-3 w-3" /> Days
            </button>
          </div>
          <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={toggleAll}
            data-testid="button-toggle-all">
            <ChevronsUpDown className="h-3.5 w-3.5" />
            {allExpanded ? "Collapse All" : "Expand All"}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30 flex-wrap">
        <span className="text-[10px] font-bold text-muted-foreground uppercase">Legend:</span>
        <span className="flex items-center gap-1.5 text-[10px]">
          <span className="w-3 h-3 rounded-sm bg-emerald-500 dark:bg-emerald-600 inline-block" /> Confirmed
        </span>
        <span className="flex items-center gap-1.5 text-[10px]">
          <span className="w-3 h-3 rounded-sm bg-amber-400 dark:bg-amber-500 inline-block" /> Tentative
        </span>
        <span className="flex items-center gap-1.5 text-[10px]">
          <span className="w-3 h-3 rounded-sm bg-amber-200 dark:bg-amber-800/40 inline-block border border-dashed border-amber-400" /> Break/Leave
        </span>
        <span className="flex items-center gap-1.5 text-[10px]">
          <span className="w-3 h-3 rounded-sm bg-red-700 dark:bg-red-800 inline-block" /> Over-allocated
        </span>
        <span className="flex items-center gap-1.5 text-[10px]">
          <span className="w-3 h-3 rounded-sm bg-slate-100 dark:bg-slate-800 border inline-block" /> Available
        </span>
      </div>

      <ScrollArea className="w-full" data-testid="capacity-scroll-area">
        <div className="min-w-max">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="sticky left-0 z-20 bg-muted/80 backdrop-blur-sm px-3 py-1.5 text-left text-[10px] font-bold text-muted-foreground uppercase w-[220px] min-w-[220px]">
                  Resource
                </th>
                {monthGroups.map((mg, i) => (
                  <th
                    key={i}
                    colSpan={mg.span}
                    className="px-1 py-1 text-center text-[10px] font-bold text-muted-foreground uppercase border-l"
                  >
                    {mg.label}
                  </th>
                ))}
              </tr>
              <tr className="bg-muted/30">
                <th className="sticky left-0 z-20 bg-muted/60 backdrop-blur-sm px-3 py-1 text-left text-[9px] text-muted-foreground">
                  Name / Role
                </th>
                {weekStarts.map((ws, i) => (
                  <th
                    key={i}
                    className="px-0.5 py-1 text-center text-[9px] text-muted-foreground font-normal border-l"
                    style={{ width: CELL_W, minWidth: CELL_W }}
                  >
                    {ws.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredResources.length === 0 ? (
                <tr>
                  <td colSpan={weekStarts.length + 1} className="text-center py-12 text-sm text-muted-foreground">
                    No resources found
                  </td>
                </tr>
              ) : (
                pagedResources.map(resource => {
                  const wm = weekMaps.get(resource.id);
                  const isExpanded = expandedResources.has(resource.id);
                  const initials = `${resource.firstName?.[0] || ""}${resource.lastName?.[0] || ""}`.toUpperCase();

                  const allocationLines = buildAllocationLines(resource.id, allocations, oppRows);
                  const breakWeeks: Array<{ weekKey: string; reasons: string[] }> = [];
                  if (wm) {
                    wm.forEach((wa, wk) => {
                      if (wa.breakDays > 0) {
                        breakWeeks.push({ weekKey: wk, reasons: wa.breakReasons });
                      }
                    });
                  }

                  return (
                    <ResourceRows
                      key={resource.id}
                      resource={resource}
                      initials={initials}
                      isExpanded={isExpanded}
                      onToggle={() => toggleExpand(resource.id)}
                      weekStarts={weekStarts}
                      weekMap={wm}
                      displayMode={displayMode}
                      allocationLines={allocationLines}
                      breakWeeks={breakWeeks}
                      cellW={CELL_W}
                    />
                  );
                })
              )}
              <TotalsRow
                weekStarts={weekStarts}
                filteredResources={pagedResources}
                weekMaps={weekMaps}
                displayMode={displayMode}
                cellW={CELL_W}
              />
            </tbody>
          </table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {filteredResources.length > 0 && (
        <div className="flex items-center gap-4 px-4 py-2.5 border-t bg-muted/20 flex-wrap">
          <span className="text-[11px] font-semibold text-muted-foreground">
            Showing {pagedResources.length} of {filteredResources.length} resources
          </span>
          <span className="text-[11px] text-muted-foreground">
            {allocations.length} active allocation{allocations.length !== 1 ? "s" : ""}
          </span>
          {hasMore && (
            <Button variant="outline" size="sm" className="ml-auto h-8 text-xs" onClick={() => setPage((p) => p + 1)}>
              Load more ({filteredResources.length - (page + 1) * pageSize} remaining)
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ResourceRows({
  resource, initials, isExpanded, onToggle, weekStarts, weekMap,
  displayMode, allocationLines, breakWeeks, cellW,
}: {
  resource: ResourceEntry;
  initials: string;
  isExpanded: boolean;
  onToggle: () => void;
  weekStarts: Date[];
  weekMap: Map<string, WeekAlloc> | undefined;
  displayMode: "percent" | "days";
  allocationLines: AllocationLine[];
  breakWeeks: Array<{ weekKey: string; reasons: string[] }>;
  cellW: number;
}) {
  const hasChildren = allocationLines.length > 0 || breakWeeks.length > 0;

  return (
    <>
      <tr className="border-t hover:bg-muted/20 transition-colors" data-testid={`capacity-row-${resource.id}`}>
        <td className="sticky left-0 z-10 bg-card px-3 py-2 min-w-[220px]">
          <div className="flex items-center gap-2">
            <button onClick={onToggle} className="shrink-0" data-testid={`expand-${resource.id}`}>
              {hasChildren ? (
                isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <span className="w-3.5" />
              )}
            </button>
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarFallback className="text-[9px] font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate" data-testid={`text-resource-name-${resource.id}`}>
                {resource.firstName} {resource.lastName}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">{resource.jobTitle || "—"}</div>
            </div>
          </div>
        </td>
        {weekStarts.map((ws, wi) => {
          const key = weekKey(ws);
          const wa = weekMap?.get(key);
          const totalDays = wa ? wa.confirmed + wa.tentative : 0;
          const pct = Math.round((totalDays / DAYS_PER_WEEK) * 100);
          const hasBreak = (wa?.breakDays || 0) > 0;
          const freeDays = DAYS_PER_WEEK - totalDays - (wa?.breakDays || 0);

          let cellContent = "";
          let cellColor = getUtilColor(pct, hasBreak);
          let cellTextColor = getUtilTextColor(pct);

          if (displayMode === "percent") {
            cellContent = totalDays > 0 || hasBreak ? `${pct}%` : "";
          } else {
            if (freeDays < 0) {
              cellContent = String(Math.round(freeDays));
              cellTextColor = "text-red-600 dark:text-red-400 font-bold";
            } else if (freeDays === 0 && totalDays > 0) {
              cellContent = "—";
            } else if (totalDays > 0 || hasBreak) {
              cellContent = String(Math.round(freeDays));
            }
          }

          const barHeight = Math.min(100, pct);
          const confirmedPct = wa ? Math.round((wa.confirmed / DAYS_PER_WEEK) * 100) : 0;
          const tentativePct = wa ? Math.round((wa.tentative / DAYS_PER_WEEK) * 100) : 0;

          return (
            <td key={wi} className="border-l p-0" style={{ width: cellW, minWidth: cellW }}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative h-8 flex items-end justify-center cursor-default" data-testid={`cell-${resource.id}-${key}`}>
                    {barHeight > 0 && (
                      <div className="absolute bottom-0 left-0.5 right-0.5 flex flex-col-reverse">
                        {confirmedPct > 0 && (
                          <div
                            className="bg-emerald-500 dark:bg-emerald-600 rounded-t-sm"
                            style={{ height: `${Math.min(32, Math.round((confirmedPct / 100) * 32))}px` }}
                          />
                        )}
                        {tentativePct > 0 && (
                          <div
                            className="bg-amber-400 dark:bg-amber-500 rounded-t-sm"
                            style={{ height: `${Math.min(32 - Math.round((confirmedPct / 100) * 32), Math.round((tentativePct / 100) * 32))}px` }}
                          />
                        )}
                      </div>
                    )}
                    {hasBreak && (
                      <div
                        className="absolute bottom-0 left-0.5 right-0.5 h-1.5 bg-amber-200 dark:bg-amber-800/60 border-t border-dashed border-amber-400"
                      />
                    )}
                    {pct > 100 && (
                      <div className="absolute inset-0 bg-red-700/20 dark:bg-red-800/30 rounded-sm" />
                    )}
                    <span className={cn("relative z-10 text-[9px] leading-none pb-0.5", cellTextColor)}>
                      {cellContent}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[11px] max-w-[200px]">
                  <div className="font-semibold mb-1">{ws.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
                  {wa && (wa.confirmed > 0 || wa.tentative > 0) ? (
                    <>
                      {wa.confirmed > 0 && <div>Confirmed: {wa.confirmed.toFixed(1)}d</div>}
                      {wa.tentative > 0 && <div>Tentative: {wa.tentative.toFixed(1)}d</div>}
                      {wa.breakDays > 0 && <div>Break: {wa.breakDays.toFixed(1)}d</div>}
                      <div className="mt-1 pt-1 border-t">Free: {Math.max(0, freeDays).toFixed(1)}d | {pct}% util</div>
                    </>
                  ) : hasBreak ? (
                    <div>Break: {wa?.breakDays.toFixed(1)}d ({wa?.breakReasons.join(", ")})</div>
                  ) : (
                    <div>Available ({DAYS_PER_WEEK}d free)</div>
                  )}
                </TooltipContent>
              </Tooltip>
            </td>
          );
        })}
      </tr>

      {allocationLines.map(line => {
        const activeWeeks = buildLineWeekActiveMap(line, weekStarts);
        return (
          <tr key={`${resource.id}-${line.id}`} className="bg-muted/10" data-testid={`subrow-allocation-${line.id}`}>
            <td className="sticky left-0 z-10 bg-muted/10 pl-12 pr-3 py-1 min-w-[220px]">
              <div className="flex items-center gap-1.5">
                <div className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                  line.status === "Confirmed" ? "bg-emerald-500" : "bg-amber-400")} />
                <span className="text-[10px] text-muted-foreground truncate">{line.name}</span>
              </div>
            </td>
            {weekStarts.map((ws, wi) => {
              const key = weekKey(ws);
              const isActive = activeWeeks.has(key);
              return (
                <td key={wi} className="border-l p-0" style={{ width: cellW, minWidth: cellW }}>
                  <div className="h-5 flex items-center justify-center">
                    {isActive && (
                      <div className={cn("h-2.5 mx-0.5 rounded-sm w-full",
                        line.status === "Confirmed" ? "bg-emerald-400/60 dark:bg-emerald-600/40" : "bg-amber-300/60 dark:bg-amber-500/40"
                      )} />
                    )}
                  </div>
                </td>
              );
            })}
          </tr>
        );
      })}

      {breakWeeks.length > 0 && (
        <tr className="bg-muted/10" data-testid={`subrow-break-${resource.id}`}>
          <td className="sticky left-0 z-10 bg-muted/10 pl-12 pr-3 py-1 min-w-[220px]">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-300 shrink-0 border border-dashed border-amber-500" />
              <span className="text-[10px] text-muted-foreground">Breaks / Leave</span>
            </div>
          </td>
          {weekStarts.map((ws, wi) => {
            const key = weekKey(ws);
            const brk = breakWeeks.find(b => b.weekKey === key);
            return (
              <td key={wi} className="border-l p-0" style={{ width: cellW, minWidth: cellW }}>
                <div className="h-5 flex items-center justify-center">
                  {brk && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="h-2.5 mx-0.5 rounded-sm w-full bg-amber-200 dark:bg-amber-800/50 border border-dashed border-amber-400 cursor-default" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-[11px]">
                        {brk.reasons.join(", ") || "Break"}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </td>
            );
          })}
        </tr>
      )}
    </>
  );
}

function TotalsRow({
  weekStarts, filteredResources, weekMaps, displayMode, cellW,
}: {
  weekStarts: Date[];
  filteredResources: ResourceEntry[];
  weekMaps: Map<number, Map<string, WeekAlloc>>;
  displayMode: "percent" | "days";
  cellW: number;
}) {
  if (filteredResources.length === 0) return null;

  return (
    <tr className="border-t-2 bg-muted/40 font-bold" data-testid="capacity-totals-row">
      <td className="sticky left-0 z-10 bg-muted/60 px-3 py-2 text-[11px] uppercase text-muted-foreground min-w-[220px]">
        Totals
      </td>
      {weekStarts.map((ws, wi) => {
        const key = weekKey(ws);
        let totalDays = 0;
        let totalCapacity = filteredResources.length * DAYS_PER_WEEK;
        filteredResources.forEach(r => {
          const wm = weekMaps.get(r.id);
          const wa = wm?.get(key);
          if (wa) totalDays += wa.confirmed + wa.tentative;
        });
        const pct = totalCapacity > 0 ? Math.round((totalDays / totalCapacity) * 100) : 0;
        const freeDays = totalCapacity - totalDays;

        let cellContent = "";
        if (displayMode === "percent") {
          cellContent = `${pct}%`;
        } else {
          cellContent = freeDays < 0 ? String(Math.round(freeDays)) : String(Math.round(freeDays));
        }

        return (
          <td key={wi} className="border-l p-0" style={{ width: cellW, minWidth: cellW }}>
            <div className="h-8 flex items-center justify-center">
              <span className={cn("text-[9px]",
                displayMode === "days" && freeDays < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
              )}>
                {cellContent}
              </span>
            </div>
          </td>
        );
      })}
    </tr>
  );
}
