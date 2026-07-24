import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialogShell } from "@/components/ui/form-dialog-shell";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Plus, X, Table2 } from "lucide-react";
import type { FilterConfig, SortConfig, ColumnConfig } from "./SavedViewsDropdown";

type SavedView = {
  id: number;
  name: string;
  filters: unknown;
  sorts: unknown;
  columns: unknown;
  isDefault: boolean | null;
};

export type LeadViewSnapshot = {
  filters: FilterConfig[];
  sorts: SortConfig[];
  columns: ColumnConfig[];
  viewMode?: string;
  groupBy?: string;
};

type CrmLeadSavedViewTabsProps = {
  entityType?: string;
  current: LeadViewSnapshot;
  onApply: (snapshot: LeadViewSnapshot) => void;
};

function snapshotFromSavedView(view: SavedView): LeadViewSnapshot {
  const filtersRaw = view.filters as any;
  let filters: FilterConfig[] = [];
  let viewMode = "table";
  let groupBy = "none";
  if (filtersRaw && typeof filtersRaw === "object" && !Array.isArray(filtersRaw) && filtersRaw.__leadViewV2) {
    filters = Array.isArray(filtersRaw.rules) ? filtersRaw.rules : [];
    viewMode = filtersRaw.viewMode || "table";
    groupBy = filtersRaw.groupBy || "none";
  } else if (Array.isArray(filtersRaw)) {
    filters = filtersRaw;
  }
  const sorts = Array.isArray(view.sorts) ? (view.sorts as SortConfig[]) : [];
  const columns = Array.isArray(view.columns) ? (view.columns as ColumnConfig[]) : [];
  return { filters, sorts, columns, viewMode, groupBy };
}

export function CrmLeadSavedViewTabs({
  entityType = "lead",
  current,
  onApply,
}: CrmLeadSavedViewTabsProps) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const { toast } = useToast();
  const defaultAppliedRef = useRef(false);

  const { data: savedViews = [] } = useQuery<SavedView[]>({
    queryKey: [`/api/crm/saved-views?entityType=${entityType}`],
  });

  // Auto-apply default view once on load (ignore onApply identity churn)
  useEffect(() => {
    if (defaultAppliedRef.current || !savedViews.length) return;
    const def = savedViews.find((v) => v.isDefault);
    defaultAppliedRef.current = true;
    if (!def) return;
    setActiveId(def.id);
    onApply(snapshotFromSavedView(def));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- apply once when views first load
  }, [savedViews]);

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/crm/saved-views", {
        entityType,
        name: name.trim(),
        filters: {
          __leadViewV2: true,
          rules: current.filters,
          viewMode: current.viewMode || "table",
          groupBy: current.groupBy || "none",
        },
        sorts: current.sorts,
        columns: current.columns,
        isDefault,
        isShared: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/saved-views?entityType=${entityType}`] });
      setSaveOpen(false);
      setName("");
      setIsDefault(false);
      toast({ title: "View tab saved" });
    },
    onError: () => toast({ title: "Failed to save view", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/crm/saved-views/${id}`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/saved-views?entityType=${entityType}`] });
      if (activeId === id) setActiveId(null);
      toast({ title: "View deleted" });
    },
  });

  const applyView = (view: SavedView) => {
    setActiveId(view.id);
    onApply(snapshotFromSavedView(view));
  };

  return (
    <>
      <div
        className="flex items-center gap-0.5 overflow-x-auto border-b border-border pb-0"
        data-testid="leads-saved-view-tabs"
      >
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 h-8 px-3 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
            activeId === null
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
          onClick={() => {
            setActiveId(null);
            onApply({
              filters: [],
              sorts: [{ columnId: "date", direction: "desc" }],
              columns: current.columns,
              viewMode: "table",
              groupBy: "none",
            });
          }}
          data-testid="leads-view-tab-main"
        >
          <Table2 className="h-3.5 w-3.5" />
          Main Table
        </button>
        {savedViews.map((view) => (
          <div
            key={view.id}
            className={cn(
              "group inline-flex items-center gap-0.5 h-8 border-b-2 -mb-px whitespace-nowrap",
              activeId === view.id ? "border-primary" : "border-transparent",
            )}
          >
            <button
              type="button"
              className={cn(
                "px-2.5 text-[13px] font-medium",
                activeId === view.id ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => applyView(view)}
              data-testid={`leads-view-tab-${view.id}`}
            >
              {view.name}
            </button>
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 h-5 w-5 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-muted"
              title="Delete view"
              onClick={(e) => {
                e.stopPropagation();
                deleteMutation.mutate(view.id);
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="inline-flex items-center gap-1 h-8 px-2.5 text-[13px] font-medium text-primary hover:bg-primary/10 rounded-md ml-1"
          onClick={() => setSaveOpen(true)}
          data-testid="button-add-view-tab"
        >
          <Plus className="h-3.5 w-3.5" />
          Add view
        </button>
      </div>

      <FormDialogShell
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title="Save view tab"
        subtitle="Saves filters, sorts, columns, group-by, and view mode"
        saveLabel="Save"
        onCancel={() => setSaveOpen(false)}
        onSubmit={() => {
          if (!name.trim()) {
            toast({ title: "Enter a view name", variant: "destructive" });
            return;
          }
          createMutation.mutate();
        }}
        saving={createMutation.isPending}
        disabled={!name.trim()}
        size="sm"
        saveTestId="button-confirm-save-view-tab"
      >
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hot leads board"
              data-testid="input-view-tab-name"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isDefault} onCheckedChange={(v) => setIsDefault(v === true)} />
            Set as default
          </label>
        </div>
      </FormDialogShell>
    </>
  );
}
