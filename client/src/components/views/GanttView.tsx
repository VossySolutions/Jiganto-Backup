import { useMemo, useState } from "react";
import { type Column, type Item } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface GanttViewProps {
  columns: Column[];
  items: Item[];
  onItemClick?: (item: Item) => void;
}

const statusColors: Record<string, string> = {
  "Done": "bg-emerald-500",
  "In Progress": "bg-blue-500",
  "To Do": "bg-slate-400",
  "Blocked": "bg-red-500",
};

export function GanttView({ columns: columnsData, items, onItemClick }: GanttViewProps) {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1);
    return date;
  });

  const titleColumn = columnsData.find(col => col.key === "title" || col.type === "text");
  const dateColumn = columnsData.find(col => col.type === "date");
  const statusColumn = columnsData.find(col => col.type === "status");

  const daysInView = useMemo(() => {
    const days: Date[] = [];
    const current = new Date(startDate);
    for (let i = 0; i < 30; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  }, [startDate]);

  const getItemPosition = (item: Item) => {
    if (!dateColumn) return null;
    
    const values = item.values as Record<string, any>;
    const itemDate = values[dateColumn.key];
    if (!itemDate) return null;
    
    const date = new Date(itemDate);
    const startMs = startDate.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    const dayIndex = Math.floor((date.getTime() - startMs) / dayMs);
    
    if (dayIndex < 0 || dayIndex >= 30) return null;
    
    return {
      left: `${(dayIndex / 30) * 100}%`,
      width: `${(3 / 30) * 100}%`,
    };
  };

  const prevPeriod = () => {
    const newDate = new Date(startDate);
    newDate.setDate(newDate.getDate() - 30);
    setStartDate(newDate);
  };

  const nextPeriod = () => {
    const newDate = new Date(startDate);
    newDate.setDate(newDate.getDate() + 30);
    setStartDate(newDate);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-lg">
          {startDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevPeriod} data-testid="gantt-prev">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              const today = new Date();
              today.setDate(1);
              setStartDate(today);
            }}
            data-testid="gantt-today"
          >
            This Month
          </Button>
          <Button variant="outline" size="icon" onClick={nextPeriod} data-testid="gantt-next">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex">
        <div className="w-[200px] flex-shrink-0 border-r">
          <div className="h-10 border-b bg-muted/30 p-2 text-xs font-semibold text-muted-foreground">
            Task Name
          </div>
          {items.map(item => {
            const values = item.values as Record<string, any>;
            const title = titleColumn ? values[titleColumn.key] : `Item ${item.id}`;
            
            return (
              <div 
                key={item.id}
                className="h-12 border-b px-3 flex items-center cursor-pointer hover:bg-muted/30"
                onClick={() => onItemClick?.(item)}
                data-testid={`gantt-row-${item.id}`}
              >
                <span className="text-sm truncate">{title}</span>
              </div>
            );
          })}
        </div>

        <div className="flex-1 overflow-x-auto">
          <div className="flex h-10 border-b bg-muted/30">
            {daysInView.map((date, i) => (
              <div 
                key={i} 
                className={cn(
                  "flex-1 min-w-[30px] text-center border-r text-xs p-1",
                  isToday(date) && "bg-primary/10 font-semibold"
                )}
              >
                <div className="text-muted-foreground">{date.getDate()}</div>
              </div>
            ))}
          </div>

          {items.map(item => {
            const values = item.values as Record<string, any>;
            const status = statusColumn ? values[statusColumn.key] : "To Do";
            const position = getItemPosition(item);
            
            return (
              <div key={item.id} className="h-12 border-b relative">
                <div className="absolute inset-0 flex">
                  {daysInView.map((date, i) => (
                    <div 
                      key={i} 
                      className={cn(
                        "flex-1 min-w-[30px] border-r",
                        isToday(date) && "bg-primary/5"
                      )}
                    />
                  ))}
                </div>
                
                {position && (
                  <div
                    className={cn(
                      "absolute top-2 bottom-2 rounded-md cursor-pointer transition-all hover:opacity-80",
                      statusColors[status] || "bg-blue-500"
                    )}
                    style={{ left: position.left, width: position.width }}
                    onClick={() => onItemClick?.(item)}
                    data-testid={`gantt-bar-${item.id}`}
                  />
                )}
              </div>
            );
          })}

          {items.length === 0 && (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
              No items to display. Create one to see the timeline.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
