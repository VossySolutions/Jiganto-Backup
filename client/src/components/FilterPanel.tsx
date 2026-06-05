import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import { type Column } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface FilterCondition {
  id: string;
  columnKey: string;
  operator: "contains" | "equals" | "not_equals" | "starts_with" | "ends_with" | "is_empty" | "is_not_empty";
  value: string;
}

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  columns: Column[];
  filters: FilterCondition[];
  onFiltersChange: (filters: FilterCondition[]) => void;
}

const OPERATORS = [
  { value: "contains", label: "Contains" },
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Does not equal" },
  { value: "starts_with", label: "Starts with" },
  { value: "ends_with", label: "Ends with" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
];

export function FilterPanel({ isOpen, onClose, columns, filters, onFiltersChange }: FilterPanelProps) {
  const addFilter = () => {
    const newFilter: FilterCondition = {
      id: `filter-${Date.now()}`,
      columnKey: columns[0]?.key || "",
      operator: "contains",
      value: "",
    };
    onFiltersChange([...filters, newFilter]);
  };

  const updateFilter = (id: string, updates: Partial<FilterCondition>) => {
    onFiltersChange(filters.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeFilter = (id: string) => {
    onFiltersChange(filters.filter(f => f.id !== id));
  };

  const clearAllFilters = () => {
    onFiltersChange([]);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-80 sm:w-80 p-0 flex flex-col">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {filters.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No filters applied</p>
              <p className="text-xs mt-1">Add a filter to narrow down your results</p>
            </div>
          ) : (
            filters.map((filter, index) => (
              <div key={filter.id} className="p-3 bg-muted/30 rounded-lg space-y-3 border border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    {index === 0 ? "Where" : "And"}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground"
                    onClick={() => removeFilter(filter.id)}
                    data-testid={`remove-filter-${filter.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Select
                    value={filter.columnKey}
                    onValueChange={(value) => updateFilter(filter.id, { columnKey: value })}
                  >
                    <SelectTrigger className="h-8 text-sm" data-testid={`filter-column-${filter.id}`}>
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {columns.map((col) => (
                        <SelectItem key={col.key} value={col.key}>
                          {col.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={filter.operator}
                    onValueChange={(value) => updateFilter(filter.id, { operator: value as FilterCondition["operator"] })}
                  >
                    <SelectTrigger className="h-8 text-sm" data-testid={`filter-operator-${filter.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {!["is_empty", "is_not_empty"].includes(filter.operator) && (
                    <Input
                      value={filter.value}
                      onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
                      placeholder="Enter value..."
                      className="h-8 text-sm"
                      data-testid={`filter-value-${filter.id}`}
                    />
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-border space-y-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={addFilter}
            data-testid="add-filter-btn"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Filter
          </Button>
          {filters.length > 0 && (
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={clearAllFilters}
              data-testid="clear-all-filters-btn"
            >
              Clear All Filters
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export type { FilterCondition };
