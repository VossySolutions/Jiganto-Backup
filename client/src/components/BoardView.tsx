import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X, Save, Filter, Group, ArrowUpDown, Settings, Plus } from "lucide-react";
import { useColumns, useItems, useCreateItem, useUpdateItem, useCreateColumn } from "@/hooks/use-jiganto";
import { type Column, type Item } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ViewSwitcher,
  TableView,
  KanbanView,
  ListView,
  CalendarView,
  GanttView,
  FormView,
  DocumentView,
  ChartView,
  type ViewType
} from "@/components/views";
import { AddColumnDropdown, AttributeEditor } from "@/components/attributes";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { FilterPanel, type FilterCondition } from "@/components/FilterPanel";
import { ExportDropdown } from "@/components/ExportDropdown";
import { ImportDropdown } from "@/components/ImportDropdown";

interface BoardViewProps {
  boardId: number;
  boardName?: string;
}

interface SavedView {
  id: string;
  name: string;
  viewType: ViewType;
  filters: Record<string, string>;
  isMaster: boolean;
}

export function BoardView({ boardId, boardName = "Board" }: BoardViewProps) {
  const { data: columnsData, isLoading: loadingColumns } = useColumns(boardId);
  const { data: itemsData, isLoading: loadingItems } = useItems(boardId);
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const createColumn = useCreateColumn();
  
  const [savedViews, setSavedViews] = useState<SavedView[]>([
    { id: "master", name: "All Items", viewType: "table", filters: {}, isMaster: true }
  ]);
  const [activeViewId, setActiveViewId] = useState("master");
  const [currentView, setCurrentView] = useState<ViewType>("table");
  const [newItemValues, setNewItemValues] = useState<Record<string, unknown>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [newViewName, setNewViewName] = useState("");
  const [showSaveViewDialog, setShowSaveViewDialog] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<Record<string, string>>({});
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<FilterCondition[]>([]);

  const activeView = savedViews.find(v => v.id === activeViewId) || savedViews[0];

  const handleCreateItem = () => {
    createItem.mutate(
      { boardId, values: newItemValues },
      { 
        onSuccess: () => {
          setIsDialogOpen(false);
          setNewItemValues({});
        }
      }
    );
  };

  const handleAddEmptyRow = () => {
    createItem.mutate({ boardId, values: {} });
  };

  const handleFormSubmit = (values: Record<string, unknown>) => {
    createItem.mutate(
      { boardId, values },
      { onSuccess: () => {} }
    );
  };

  const handleAddColumn = (columnData: { title: string; key: string; type: string; options?: Record<string, unknown> }) => {
    const order = (columnsData?.length || 0) + 1;
    
    let key = columnData.key;
    const existingKeys = new Set((columnsData || []).map(c => c.key));
    let suffix = 1;
    while (existingKeys.has(key)) {
      key = `${columnData.key}_${suffix}`;
      suffix++;
    }
    
    createColumn.mutate({
      boardId,
      title: columnData.title,
      key,
      type: columnData.type,
      order,
      options: columnData.options,
    });
  };

  const handleFiltersChange = (filters: Record<string, string>) => {
    setCurrentFilters(filters);
    if (activeViewId !== "master") {
      setSavedViews(views => views.map(v => 
        v.id === activeViewId ? { ...v, filters } : v
      ));
    }
  };

  const handleItemClick = (item: Item) => {
    setSelectedItem(item);
  };

  const handleToggleComplete = (item: Item) => {
    const statusColumn = columnsData?.find(col => col.type === "status");
    if (!statusColumn) return;
    
    const currentStatus = (item.values as any)[statusColumn.key];
    const newStatus = currentStatus === "Done" ? "To Do" : "Done";
    
    updateItem.mutate({
      id: item.id,
      values: { ...(item.values as object), [statusColumn.key]: newStatus }
    });
  };

  const handleViewChange = (viewType: ViewType) => {
    setCurrentView(viewType);
    if (activeViewId !== "master") {
      setSavedViews(views => views.map(v => 
        v.id === activeViewId ? { ...v, viewType } : v
      ));
    }
  };

  const handleSaveView = () => {
    if (!newViewName.trim()) return;
    
    const newView: SavedView = {
      id: `view-${Date.now()}`,
      name: newViewName.trim(),
      viewType: currentView,
      filters: { ...currentFilters },
      isMaster: false,
    };
    
    setSavedViews([...savedViews, newView]);
    setActiveViewId(newView.id);
    setNewViewName("");
    setShowSaveViewDialog(false);
  };

  const handleCloseView = (viewId: string) => {
    if (viewId === "master") return;
    setSavedViews(views => views.filter(v => v.id !== viewId));
    if (activeViewId === viewId) {
      setActiveViewId("master");
      setCurrentView(savedViews[0].viewType);
    }
  };

  const handleTabChange = (viewId: string) => {
    setActiveViewId(viewId);
    const view = savedViews.find(v => v.id === viewId);
    if (view) {
      setCurrentView(view.viewType);
      setCurrentFilters(view.filters);
    }
  };

  if (loadingColumns || loadingItems) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm text-muted-foreground font-medium">Loading board data...</span>
        </div>
      </div>
    );
  }

  const columns = columnsData || [];
  const rawItems = itemsData || [];

  const applyAdvancedFilters = (items: Item[]): Item[] => {
    if (advancedFilters.length === 0) return items;
    
    return items.filter(item => {
      const values = item.values as Record<string, unknown>;
      
      return advancedFilters.every(filter => {
        const cellValue = String(values[filter.columnKey] ?? "").toLowerCase();
        const filterValue = filter.value.toLowerCase();
        
        switch (filter.operator) {
          case "contains":
            return cellValue.includes(filterValue);
          case "equals":
            return cellValue === filterValue;
          case "not_equals":
            return cellValue !== filterValue;
          case "starts_with":
            return cellValue.startsWith(filterValue);
          case "ends_with":
            return cellValue.endsWith(filterValue);
          case "is_empty":
            return cellValue === "";
          case "is_not_empty":
            return cellValue !== "";
          default:
            return true;
        }
      });
    });
  };

  const items = applyAdvancedFilters(rawItems);

  const renderView = () => {
    switch (currentView) {
      case "columns":
        return (
          <KanbanView 
            columns={columns} 
            items={items} 
            onItemClick={handleItemClick}
            onAddItem={() => setIsDialogOpen(true)}
          />
        );
      case "table":
        return (
          <TableView 
            columns={columns} 
            items={items} 
            onItemClick={handleItemClick}
            onAddRow={handleAddEmptyRow}
            onAddColumn={handleAddColumn}
            initialFilters={currentFilters}
            onFiltersChange={handleFiltersChange}
          />
        );
      case "calendar":
        return (
          <CalendarView 
            columns={columns} 
            items={items} 
            onItemClick={handleItemClick}
            onDateClick={() => setIsDialogOpen(true)}
          />
        );
      case "gantt":
        return (
          <GanttView 
            columns={columns} 
            items={items} 
            onItemClick={handleItemClick}
          />
        );
      case "list":
        return (
          <ListView 
            columns={columns} 
            items={items} 
            onItemClick={handleItemClick}
            onToggleComplete={handleToggleComplete}
          />
        );
      case "form":
        return (
          <FormView 
            columns={columns} 
            boardName={boardName}
            onSubmit={handleFormSubmit}
            isSubmitting={createItem.isPending}
          />
        );
      case "document":
        return (
          <DocumentView 
            columns={columns} 
            items={items} 
            onItemClick={handleItemClick}
            onCreateDocument={() => setIsDialogOpen(true)}
          />
        );
      case "chart":
        return (
          <ChartView 
            columns={columns} 
            items={items}
          />
        );
      default:
        return (
          <TableView 
            columns={columns} 
            items={items} 
            onItemClick={handleItemClick}
            onAddRow={handleAddEmptyRow}
            onAddColumn={handleAddColumn}
            initialFilters={currentFilters}
            onFiltersChange={handleFiltersChange}
          />
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-border pb-2">
        <Tabs value={activeViewId} onValueChange={handleTabChange}>
          <div className="flex items-center gap-2">
            <TabsList className="h-9 bg-transparent p-0 gap-1">
              {savedViews.map((view) => (
                <TabsTrigger
                  key={view.id}
                  value={view.id}
                  className="relative h-8 px-3 data-[state=active]:bg-muted rounded-lg gap-2"
                  data-testid={`view-tab-${view.id}`}
                >
                  <span className="text-sm">{view.name}</span>
                  {!view.isMaster && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseView(view.id);
                      }}
                      className="h-4 w-4 rounded-full hover:bg-muted-foreground/20 flex items-center justify-center"
                      data-testid={`close-tab-${view.id}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-muted-foreground"
              onClick={() => setShowSaveViewDialog(true)}
              data-testid="save-view-btn"
            >
              <Plus className="h-4 w-4 mr-1" />
              Save View
            </Button>
          </div>
        </Tabs>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ViewSwitcher currentView={currentView} onViewChange={handleViewChange} />
          
          <Button 
            variant="ghost" 
            size="sm" 
            className={`h-8 gap-1.5 ${advancedFilters.length > 0 ? 'text-primary' : ''}`}
            onClick={() => setIsFilterPanelOpen(true)}
            data-testid="filter-btn"
          >
            <Filter className="h-4 w-4" />
            Filter
            {advancedFilters.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                {advancedFilters.length}
              </span>
            )}
          </Button>
          
          <Button variant="ghost" size="sm" className="h-8 gap-1.5" data-testid="group-btn">
            <Group className="h-4 w-4" />
            Group
          </Button>
          
          <Button variant="ghost" size="sm" className="h-8 gap-1.5" data-testid="sort-btn">
            <ArrowUpDown className="h-4 w-4" />
            Sort
          </Button>
          
          <div className="relative flex-1 min-w-[150px] max-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Search items..." 
              className="h-8 pl-8 text-sm bg-background/50 border-transparent focus:bg-background focus:border-primary transition-all"
              data-testid="board-search"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ImportDropdown 
            columns={columns}
            onImport={(importedItems) => {
              importedItems.forEach(itemValues => {
                createItem.mutate({ boardId, values: itemValues });
              });
            }}
          />
          
          <Button variant="ghost" size="sm" className="h-8 gap-1.5" data-testid="customize-btn">
            <Settings className="h-4 w-4" />
            Customize
          </Button>
          
          <ExportDropdown 
            columns={columns} 
            items={items} 
            boardName={boardName} 
          />
        </div>
      </div>

      {renderView()}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Item</DialogTitle>
            <DialogDescription>Create a new item for this board</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {columns.map((col) => (
              <div key={col.id} className="space-y-2">
                <Label htmlFor={col.key} className="text-xs uppercase font-semibold text-muted-foreground">
                  {col.title}
                </Label>
                <AttributeEditor
                  type={col.type}
                  value={newItemValues[col.key]}
                  options={col.options as Record<string, unknown>}
                  onChange={(value) => setNewItemValues({...newItemValues, [col.key]: value})}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateItem} disabled={createItem.isPending} data-testid="create-item-btn">
              {createItem.isPending ? "Creating..." : "Create Item"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSaveViewDialog} onOpenChange={setShowSaveViewDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Save Current View</DialogTitle>
            <DialogDescription>
              Save your current view settings as a new tab. This preserves the view type and any active filters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>View Name</Label>
              <Input
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="e.g., Active Tasks, High Priority"
                data-testid="view-name-input"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <p>View Type: <strong>{currentView}</strong></p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSaveViewDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveView} disabled={!newViewName.trim()} data-testid="confirm-save-view-btn">
              <Save className="h-4 w-4 mr-2" />
              Save View
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <FilterPanel
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
        columns={columns}
        filters={advancedFilters}
        onFiltersChange={setAdvancedFilters}
      />
    </div>
  );
}
