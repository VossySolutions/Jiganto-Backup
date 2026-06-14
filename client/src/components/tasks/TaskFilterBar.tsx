import { useMemo, useState, useEffect } from "react";
import { Filter, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TASK_SOURCES, TASK_STATUSES, TASK_PRIORITIES, DUE_DATE_PRESETS, type TaskFilters } from "./constants";
import { cn } from "@/lib/utils";

interface TaskFilterBarProps {
  filters: TaskFilters;
  onChange: (patch: Partial<TaskFilters>) => void;
  workspaces: { id: number; name: string }[];
  projects: { id: number; name: string }[];
  loading?: boolean;
}

function countActiveFilters(filters: TaskFilters): number {
  let n = 0;
  if (filters.source !== "all") n++;
  if (filters.status !== "all") n++;
  if (filters.priority !== "all") n++;
  if (filters.dueDatePreset !== "all") n++;
  if (filters.workspaceId !== "all") n++;
  if (filters.projectId !== "all") n++;
  if (filters.search.trim()) n++;
  return n;
}

function FilterControls({
  filters,
  onChange,
  workspaces,
  projects,
  searchDraft,
  onSearchDraftChange,
}: Omit<TaskFilterBarProps, "loading"> & {
  searchDraft: string;
  onSearchDraftChange: (value: string) => void;
}) {
  return (
    <>
      <Select value={filters.source} onValueChange={(v) => onChange({ source: v })}>
        <SelectTrigger className="h-9 w-full sm:w-[130px]" data-testid="filter-source">
          <SelectValue placeholder="Source" />
        </SelectTrigger>
        <SelectContent>
          {TASK_SOURCES.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.status} onValueChange={(v) => onChange({ status: v })}>
        <SelectTrigger className="h-9 w-full sm:w-[120px]" data-testid="filter-status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {TASK_STATUSES.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.priority} onValueChange={(v) => onChange({ priority: v })}>
        <SelectTrigger className="h-9 w-full sm:w-[110px]" data-testid="filter-priority">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          {TASK_PRIORITIES.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.dueDatePreset} onValueChange={(v) => onChange({ dueDatePreset: v })}>
        <SelectTrigger className="h-9 w-full sm:w-[140px]" data-testid="filter-due">
          <SelectValue placeholder="Due date" />
        </SelectTrigger>
        <SelectContent>
          {DUE_DATE_PRESETS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.workspaceId} onValueChange={(v) => onChange({ workspaceId: v })}>
        <SelectTrigger className="h-9 w-full sm:w-[150px]" data-testid="filter-workspace">
          <SelectValue placeholder="Workspace" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All workspaces</SelectItem>
          {workspaces.map((w) => (
            <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.projectId} onValueChange={(v) => onChange({ projectId: v })}>
        <SelectTrigger className="h-9 w-full sm:w-[150px]" data-testid="filter-project">
          <SelectValue placeholder="Project" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All projects</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        className="h-9 w-full sm:w-44"
        placeholder="Search tasks..."
        value={searchDraft}
        onChange={(e) => onSearchDraftChange(e.target.value)}
        data-testid="filter-search"
      />
    </>
  );
}

export function TaskFilterBar({ filters, onChange, workspaces, projects, loading }: TaskFilterBarProps) {
  const [open, setOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState(filters.search);
  const activeCount = useMemo(() => countActiveFilters(filters), [filters]);

  useEffect(() => {
    setSearchDraft(filters.search);
  }, [filters.search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchDraft !== filters.search) onChange({ search: searchDraft });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchDraft, filters.search, onChange]);

  const clearFilters = () => {
    setSearchDraft("");
    onChange({
      source: "all",
      status: "all",
      priority: "all",
      dueDatePreset: "all",
      workspaceId: "all",
      projectId: "all",
      search: "",
    });
  };

  return (
    <div className="rounded-xl border border-border/40 bg-muted/20 overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center justify-between gap-2 p-3 md:hidden">
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-9 flex-1 justify-start">
              <Filter className="h-4 w-4" />
              Filters
              {activeCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{activeCount}</Badge>
              )}
            </Button>
          </CollapsibleTrigger>
          {activeCount > 0 && (
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={clearFilters} aria-label="Clear filters">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <CollapsibleContent className="md:hidden px-3 pb-3">
          <div className={cn("grid grid-cols-1 gap-2", loading && "opacity-60 pointer-events-none")}>
            <FilterControls filters={filters} onChange={onChange} workspaces={workspaces} projects={projects} searchDraft={searchDraft} onSearchDraftChange={setSearchDraft} />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className={cn("hidden md:flex flex-wrap items-center gap-2 p-3", loading && "opacity-60 pointer-events-none")}>
        <FilterControls filters={filters} onChange={onChange} workspaces={workspaces} projects={projects} searchDraft={searchDraft} onSearchDraftChange={setSearchDraft} />
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
