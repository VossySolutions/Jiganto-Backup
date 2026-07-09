import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FormDialogShell } from "@/components/ui/form-dialog-shell";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Bookmark,
  Plus,
  Trash2,
  Star,
  ChevronDown,
  Columns3,
  Eye,
  EyeOff,
  ArrowUpDown,
  SortAsc,
  SortDesc
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

type SavedView = {
  id: number;
  tenantId: number;
  userId: string;
  entityType: string;
  name: string;
  filters: any;
  sorts: any;
  columns: any;
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
  onApplyView: (filters: FilterConfig[], sorts?: SortConfig[], columns?: ColumnConfig[]) => void;
  onColumnsChange?: (columns: ColumnConfig[]) => void;
  onSortChange?: (sorts: SortConfig[]) => void;
  onFilterChange?: (filters: FilterConfig[]) => void;
}

export function SavedViewsDropdown({ 
  entityType, 
  currentFilters, 
  currentSorts,
  columns = [],
  onApplyView,
  onColumnsChange,
  onSortChange,
}: SavedViewsDropdownProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [columnsDialogOpen, setColumnsDialogOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [localColumns, setLocalColumns] = useState<ColumnConfig[]>(columns);
  const { toast } = useToast();

  const { data: savedViews = [] } = useQuery<SavedView[]>({
    queryKey: [`/api/crm/saved-views?entityType=${entityType}`],
  });

  const createViewMutation = useMutation({
    mutationFn: async (data: { name: string; filters: any; sorts: any; columns: any; isDefault: boolean; isShared: boolean }) => {
      return apiRequest("POST", "/api/crm/saved-views", {
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
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/crm/saved-views/${id}`);
    },
    onSuccess: () => {
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
      columns: columns,
      isDefault,
      isShared,
    });
  };

  const handleApplyView = (view: SavedView) => {
    const filters = Array.isArray(view.filters) ? view.filters : [];
    const sorts = Array.isArray(view.sorts) ? view.sorts : [];
    const cols = Array.isArray(view.columns) ? view.columns : undefined;
    onApplyView(filters, sorts, cols);
    toast({ title: `Applied view: ${view.name}` });
  };

  const handleToggleColumn = (columnId: string) => {
    const updated = localColumns.map(col => 
      col.id === columnId ? { ...col, visible: !col.visible } : col
    );
    setLocalColumns(updated);
    onColumnsChange?.(updated);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(localColumns);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    
    const updated = items.map((col, idx) => ({ ...col, order: idx }));
    setLocalColumns(updated);
    onColumnsChange?.(updated);
  };

  const handleSort = (columnId: string, direction: "asc" | "desc") => {
    const newSort: SortConfig = { columnId, direction };
    const existingSorts = currentSorts?.filter(s => s.columnId !== columnId) || [];
    onSortChange?.([...existingSorts, newSort]);
    toast({ title: `Sorted by ${columnId} (${direction === "asc" ? "ascending" : "descending"})` });
  };

  const handleClearSorts = () => {
    onSortChange?.([]);
    toast({ title: "Sorting cleared" });
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1" data-testid="dropdown-saved-views">
              <Bookmark className="h-4 w-4" />
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

        {columns.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1" data-testid="button-columns">
                <Columns3 className="h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {columns.map((col) => (
                <DropdownMenuItem
                  key={col.id}
                  className="flex items-center justify-between cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    handleToggleColumn(col.id);
                  }}
                  data-testid={`column-toggle-${col.id}`}
                >
                  <span>{col.header}</span>
                  {col.visible ? (
                    <Eye className="h-4 w-4 text-primary" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setColumnsDialogOpen(true)}
                className="cursor-pointer"
              >
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Reorder columns
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {columns.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1" data-testid="button-sort">
                <ArrowUpDown className="h-4 w-4" />
                Sort
                {currentSorts && currentSorts.length > 0 && (
                  <span className="ml-1 bg-primary text-primary-foreground text-xs px-1.5 rounded-full">
                    {currentSorts.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {columns.filter(c => c.visible).map((col) => (
                <DropdownMenuSub key={col.id}>
                  <DropdownMenuSubTrigger className="cursor-pointer">
                    <span>{col.header}</span>
                    {currentSorts?.find(s => s.columnId === col.id) && (
                      currentSorts.find(s => s.columnId === col.id)?.direction === "asc" 
                        ? <SortAsc className="h-3 w-3 ml-auto text-primary" />
                        : <SortDesc className="h-3 w-3 ml-auto text-primary" />
                    )}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => handleSort(col.id, "asc")}>
                      <SortAsc className="h-4 w-4 mr-2" />
                      Ascending
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSort(col.id, "desc")}>
                      <SortDesc className="h-4 w-4 mr-2" />
                      Descending
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}
              {currentSorts && currentSorts.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleClearSorts} className="text-destructive cursor-pointer">
                    Clear all sorts
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <FormDialogShell
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        title="Save View"
        subtitle="Store current filters, sorts, and column setup for quick reuse."
        saveLabel="Save View"
        saveTestId="button-save-view"
        onCancel={() => setSaveDialogOpen(false)}
        onSubmit={handleSaveView}
        disabled={createViewMutation.isPending}
        saving={createViewMutation.isPending}
        size="sm"
      >
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="view-name">View Name</Label>
              <Input
                id="view-name"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="e.g., High Value Leads"
                data-testid="input-view-name"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is-default"
                checked={isDefault}
                onCheckedChange={(checked) => setIsDefault(checked === true)}
              />
              <Label htmlFor="is-default" className="text-sm font-normal">
                Set as default view
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is-shared"
                checked={isShared}
                onCheckedChange={(checked) => setIsShared(checked === true)}
              />
              <Label htmlFor="is-shared" className="text-sm font-normal">
                Share with team
              </Label>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>This view will save:</p>
              <ul className="list-disc list-inside text-xs">
                <li>Filters: {currentFilters.length || "None"}</li>
                <li>Sorts: {currentSorts?.length || "None"}</li>
                <li>Column visibility & order</li>
              </ul>
            </div>
          </div>
      </FormDialogShell>

      <Dialog open={columnsDialogOpen} onOpenChange={setColumnsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reorder Columns</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="columns">
                {(provided) => (
                  <div 
                    {...provided.droppableProps} 
                    ref={provided.innerRef}
                    className="space-y-2"
                  >
                    {localColumns.map((col, index) => (
                      <Draggable key={col.id} draggableId={col.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`flex items-center justify-between p-2 rounded-lg border ${
                              snapshot.isDragging ? "bg-accent shadow-lg" : "bg-background"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-6 bg-muted rounded" />
                              <span className="text-sm">{col.header}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleToggleColumn(col.id)}
                            >
                              {col.visible ? (
                                <Eye className="h-4 w-4 text-primary" />
                              ) : (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
          <DialogFooter>
            <Button onClick={() => setColumnsDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
