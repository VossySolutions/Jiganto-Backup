import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { FormDialogShell } from "@/components/ui/form-dialog-shell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Bookmark, Plus, Trash2, Star, ChevronDown } from "lucide-react";

type SavedView = {
  id: number;
  tenantId: number;
  userId: string;
  entityType: string;
  name: string;
  filters: unknown;
  sorts: unknown;
  columns: unknown;
  isDefault: boolean | null;
  isShared: boolean | null;
  createdAt: string;
  updatedAt: string;
};

export interface ColumnConfig {
  id: string;
  header: string;
  visible: boolean;
  order: number;
}

export interface SortConfig {
  columnId: string;
  direction: "asc" | "desc";
}

export interface FilterConfig {
  columnId: string;
  operator: "equals" | "contains" | "startsWith" | "endsWith" | "greaterThan" | "lessThan";
  value: string;
}

interface SavedViewsDropdownProps {
  entityType: string;
  currentFilters: FilterConfig[];
  currentSorts?: SortConfig[];
  columns?: ColumnConfig[];
  onApplyView: (
    filters: FilterConfig[],
    sorts?: SortConfig[],
    columns?: ColumnConfig[],
    extras?: { viewMode?: string; groupBy?: string },
  ) => void;
  /** Optional trigger button class (defaults to outline sm). */
  triggerClassName?: string;
}

export function SavedViewsDropdown({
  entityType,
  currentFilters,
  currentSorts,
  columns = [],
  onApplyView,
  triggerClassName,
}: SavedViewsDropdownProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const { toast } = useToast();

  const { data: savedViews = [] } = useQuery<SavedView[]>({
    queryKey: [`/api/board-saved-views?entityType=${entityType}`],
  });

  const createViewMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      filters: unknown;
      sorts: unknown;
      columns: unknown;
      isDefault: boolean;
      isShared: boolean;
    }) => {
      return apiRequest("POST", "/api/board-saved-views", {
        entityType,
        name: data.name,
        filters: data.filters,
        sorts: data.sorts,
        columns: data.columns,
        isDefault: data.isDefault,
        isShared: data.isShared,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/board-saved-views?entityType=${entityType}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/crm/saved-views?entityType=${entityType}`] });
      toast({ title: "View saved successfully" });
      setSaveDialogOpen(false);
      setViewName("");
      setIsDefault(false);
      setIsShared(false);
    },
    onError: () => {
      toast({ title: "Failed to save view", variant: "destructive" });
    },
  });

  const deleteViewMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/board-saved-views/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/board-saved-views?entityType=${entityType}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/crm/saved-views?entityType=${entityType}`] });
      toast({ title: "View deleted" });
    },
  });

  const handleSaveView = () => {
    if (!viewName.trim()) {
      toast({ title: "Please enter a view name", variant: "destructive" });
      return;
    }
    createViewMutation.mutate({
      name: viewName,
      filters: currentFilters,
      sorts: currentSorts || [],
      columns,
      isDefault,
      isShared,
    });
  };

  const handleApplyView = (view: SavedView) => {
    const filtersRaw = view.filters as unknown;
    let filters: FilterConfig[] = [];
    let viewMode: string | undefined;
    let groupBy: string | undefined;
    if (
      filtersRaw &&
      typeof filtersRaw === "object" &&
      !Array.isArray(filtersRaw) &&
      (filtersRaw as { __leadViewV2?: boolean }).__leadViewV2
    ) {
      const v2 = filtersRaw as { rules?: FilterConfig[]; viewMode?: string; groupBy?: string };
      filters = Array.isArray(v2.rules) ? v2.rules : [];
      viewMode = v2.viewMode;
      groupBy = v2.groupBy;
    } else if (Array.isArray(filtersRaw)) {
      filters = filtersRaw as FilterConfig[];
    }
    const sorts = Array.isArray(view.sorts) ? (view.sorts as SortConfig[]) : [];
    const cols = Array.isArray(view.columns) ? (view.columns as ColumnConfig[]) : undefined;
    onApplyView(filters, sorts, cols, { viewMode, groupBy });
    toast({ title: `Applied view: ${view.name}` });
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn("gap-1 h-8", triggerClassName)}
              data-testid="dropdown-saved-views"
            >
              <Bookmark className="h-3.5 w-3.5" />
              Views
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {savedViews.length > 0 ? (
              <>
                {savedViews.map((view) => (
                  <DropdownMenuItem
                    key={view.id}
                    className="flex items-center justify-between group cursor-pointer"
                    onClick={() => handleApplyView(view)}
                    data-testid={`menu-item-view-${view.id}`}
                  >
                    <div className="flex items-center gap-2">
                      {view.isDefault && <Star className="h-3 w-3 text-yellow-500" />}
                      <span>{view.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteViewMutation.mutate(view.id);
                      }}
                      data-testid={`button-delete-view-${view.id}`}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            ) : (
              <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                No saved views yet
              </div>
            )}
            <DropdownMenuItem
              onClick={() => setSaveDialogOpen(true)}
              className="cursor-pointer"
              data-testid="menu-item-save-current-view"
            >
              <Plus className="h-4 w-4 mr-2" />
              Save current view
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <FormDialogShell
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        title="Save view"
        subtitle="Save your current filters, sorts, and columns"
        saveLabel="Save view"
        onCancel={() => setSaveDialogOpen(false)}
        onSubmit={handleSaveView}
        saving={createViewMutation.isPending}
        disabled={!viewName.trim()}
        size="sm"
        saveTestId="button-confirm-save-view"
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>View name</Label>
            <Input
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              placeholder="e.g. My pipeline"
              data-testid="input-view-name"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isDefault} onCheckedChange={(v) => setIsDefault(v === true)} />
            Set as default
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isShared} onCheckedChange={(v) => setIsShared(v === true)} />
            Share with team
          </label>
        </div>
      </FormDialogShell>
    </>
  );
}
