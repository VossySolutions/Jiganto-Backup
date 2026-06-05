import { useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type Column, type Item } from "@shared/schema";
import { cn } from "@/lib/utils";
import { MoreHorizontal, Plus, Calendar as CalendarIcon, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface KanbanViewProps {
  columns: Column[];
  items: Item[];
  onItemClick?: (item: Item) => void;
  onAddItem?: (status: string) => void;
}

const statusColors: Record<string, string> = {
  "To Do": "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  "In Progress": "bg-status-blue text-status-blue-foreground",
  "Done": "bg-status-green text-status-green-foreground",
  "Blocked": "bg-status-red text-status-red-foreground",
};

export function KanbanView({ columns: columnsData, items, onItemClick, onAddItem }: KanbanViewProps) {
  const statusColumn = columnsData.find(col => col.type === "status");
  const titleColumn = columnsData.find(col => col.key === "title" || col.type === "text");
  const dateColumn = columnsData.find(col => col.type === "date");
  const ownerColumn = columnsData.find(col => col.type === "person" || col.key === "owner");
  
  const statuses = useMemo(() => {
    if (statusColumn?.options && Array.isArray(statusColumn.options)) {
      return statusColumn.options as string[];
    }
    return ["To Do", "In Progress", "Done"];
  }, [statusColumn]);

  const itemsByStatus = useMemo(() => {
    const groups: Record<string, Item[]> = {};
    statuses.forEach(status => {
      groups[status] = [];
    });
    
    items.forEach(item => {
      const itemStatus = statusColumn ? (item.values as any)[statusColumn.key] : "To Do";
      if (groups[itemStatus]) {
        groups[itemStatus].push(item);
      } else {
        groups["To Do"]?.push(item);
      }
    });
    
    return groups;
  }, [items, statuses, statusColumn]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[600px]">
      {statuses.map((status) => (
        <div
          key={status}
          className="flex-shrink-0 w-[300px] bg-muted/30 rounded-2xl p-3 border border-border/50"
          data-testid={`kanban-column-${status.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Badge 
                variant="outline" 
                className={cn("rounded-lg px-2.5 py-1", statusColors[status] || "bg-muted")}
              >
                {status}
              </Badge>
              <span className="text-sm text-muted-foreground font-medium">
                {itemsByStatus[status]?.length || 0}
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-muted-foreground"
              onClick={() => onAddItem?.(status)}
              data-testid={`add-item-${status.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-3">
            {itemsByStatus[status]?.map((item) => {
              const values = item.values as Record<string, any>;
              const title = titleColumn ? values[titleColumn.key] : `Item ${item.id}`;
              const dueDate = dateColumn ? values[dateColumn.key] : null;
              const owner = ownerColumn ? values[ownerColumn.key] : null;

              return (
                <Card 
                  key={item.id}
                  className="rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer border-border/50 bg-card"
                  onClick={() => onItemClick?.(item)}
                  data-testid={`kanban-card-${item.id}`}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm text-foreground line-clamp-2">
                        {title}
                      </h4>
                      <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2 -mt-1 flex-shrink-0 text-muted-foreground">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      {dueDate && (
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          <span>{new Date(dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        </div>
                      )}
                      {owner && (
                        <div className="flex items-center gap-1">
                          <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-3 w-3 text-primary" />
                          </div>
                          <span className="truncate max-w-[80px]">{owner}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {(!itemsByStatus[status] || itemsByStatus[status].length === 0) && (
              <div className="text-center py-8 text-muted-foreground/50 text-sm">
                No items
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
