import { useMemo, useState } from "react";
import { Filter, X, Star } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface WorkspaceLandingFilters {
  landingTab: "all" | "favorites" | "recent" | "shared" | "mine";
  statusFilter: string;
  sortBy: string;
  favoritesFirst: boolean;
  viewMode: "grid" | "list";
}

interface WorkspaceFilterBarProps {
  filters: WorkspaceLandingFilters;
  onChange: (patch: Partial<WorkspaceLandingFilters>) => void;
}

function countActiveFilters(filters: WorkspaceLandingFilters): number {
  let n = 0;
  if (filters.landingTab !== "all") n++;
  if (filters.statusFilter !== "all") n++;
  if (filters.sortBy !== "updated") n++;
  if (filters.favoritesFirst) n++;
  return n;
}

function FilterControls({ filters, onChange }: WorkspaceFilterBarProps) {
  return (
    <>
      <div className="flex items-center gap-1 rounded-md border p-0.5 w-fit">
        {[
          { key: "all", label: "All" },
          { key: "favorites", label: "Favorites" },
          { key: "recent", label: "Recent" },
          { key: "shared", label: "Shared" },
          { key: "mine", label: "Mine" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange({ landingTab: tab.key as WorkspaceLandingFilters["landingTab"] })}
            className={cn(
              "rounded px-2.5 py-1 text-xs whitespace-nowrap",
              filters.landingTab === tab.key ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60",
            )}
            data-testid={`landing-tab-${tab.key}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Select value={filters.statusFilter} onValueChange={(v) => onChange({ statusFilter: v })}>
        <SelectTrigger className="h-9 w-full sm:w-[130px]" data-testid="filter-status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="archived">Archived</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.sortBy} onValueChange={(v) => onChange({ sortBy: v })}>
        <SelectTrigger className="h-9 w-full sm:w-[150px]" data-testid="filter-sort">
          <SelectValue placeholder="Sort" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="updated">Last updated</SelectItem>
          <SelectItem value="name">Name (A–Z)</SelectItem>
          <SelectItem value="created">Recently created</SelectItem>
        </SelectContent>
      </Select>

      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none h-9 px-2">
        <input
          type="checkbox"
          checked={filters.favoritesFirst}
          onChange={(e) => onChange({ favoritesFirst: e.target.checked })}
          className="rounded border-input"
          data-testid="favorites-first-checkbox"
        />
        <Star className="h-3 w-3" />
        Favorites first
      </label>
    </>
  );
}

export function WorkspaceFilterBar({ filters, onChange }: WorkspaceFilterBarProps) {
  const [open, setOpen] = useState(false);
  const activeCount = useMemo(() => countActiveFilters(filters), [filters]);

  const clearAll = () =>
    onChange({
      landingTab: "all",
      statusFilter: "all",
      sortBy: "updated",
      favoritesFirst: false,
    });

  return (
    <div className="rounded-xl border border-border/40 bg-muted/20" data-testid="workspace-filter-bar">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center justify-between gap-2 p-3 md:hidden">
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-9">
              <Filter className="h-3.5 w-3.5" />
              Filters
              {activeCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {activeCount}
                </Badge>
              )}
            </Button>
          </CollapsibleTrigger>
          {activeCount > 0 && (
            <Button variant="ghost" size="sm" className="h-9 gap-1" onClick={clearAll}>
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
        <CollapsibleContent className="md:hidden px-3 pb-3">
          <div className="flex flex-col gap-2">
            <FilterControls filters={filters} onChange={onChange} />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="hidden md:flex flex-wrap items-center gap-2 p-3">
        <FilterControls filters={filters} onChange={onChange} />
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" className="h-9 gap-1 ml-auto" onClick={clearAll}>
            <X className="h-3.5 w-3.5" /> Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
