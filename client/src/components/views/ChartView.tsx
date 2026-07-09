import { useMemo, useState } from "react";
import { type Column, type Item } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, PieChart, LineChart, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChartViewProps {
  columns: Column[];
  items: Item[];
}

type ChartType = "bar" | "pie" | "line";

const chartColors = [
  "bg-primary",
  "bg-brand-green",
  "bg-brand-purple",
  "bg-brand-orange",
  "bg-brand-pink",
  "bg-ai",
  "bg-chart-4",
  "bg-destructive",
];

export function ChartView({ columns: columnsData, items }: ChartViewProps) {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [groupByColumn, setGroupByColumn] = useState<string>("");

  const statusColumn = columnsData.find(col => col.type === "status");
  
  const groupableColumns = columnsData.filter(
    col => col.type === "status" || col.type === "person"
  );

  const selectedColumn = groupByColumn 
    ? columnsData.find(col => col.key === groupByColumn)
    : statusColumn;

  const chartData = useMemo(() => {
    if (!selectedColumn) return [];
    
    const counts: Record<string, number> = {};
    
    items.forEach(item => {
      const value = (item.values as any)[selectedColumn.key] || "Unassigned";
      counts[value] = (counts[value] || 0) + 1;
    });

    const entries = Object.entries(counts);
    const total = entries.reduce((sum, [_, count]) => sum + count, 0);
    
    return entries.map(([label, count], index) => ({
      label,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
      color: chartColors[index % chartColors.length],
    }));
  }, [items, selectedColumn]);

  const maxCount = Math.max(...chartData.map(d => d.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 p-1 bg-muted/50 rounded-xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setChartType("bar")}
            className={cn(
              "h-8 px-3 gap-2 rounded-lg",
              chartType === "bar" ? "bg-background shadow-sm" : ""
            )}
            data-testid="chart-type-bar"
          >
            <BarChart3 className="h-4 w-4" />
            Bar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setChartType("pie")}
            className={cn(
              "h-8 px-3 gap-2 rounded-lg",
              chartType === "pie" ? "bg-background shadow-sm" : ""
            )}
            data-testid="chart-type-pie"
          >
            <PieChart className="h-4 w-4" />
            Pie
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setChartType("line")}
            className={cn(
              "h-8 px-3 gap-2 rounded-lg",
              chartType === "line" ? "bg-background shadow-sm" : ""
            )}
            data-testid="chart-type-line"
          >
            <LineChart className="h-4 w-4" />
            Line
          </Button>
        </div>

        {groupableColumns.length > 0 && (
          <Select value={groupByColumn || statusColumn?.key || ""} onValueChange={setGroupByColumn}>
            <SelectTrigger className="w-[200px] rounded-lg" data-testid="chart-group-select">
              <SelectValue placeholder="Group by..." />
            </SelectTrigger>
            <SelectContent>
              {groupableColumns.map(col => (
                <SelectItem key={col.key} value={col.key}>
                  {col.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Card className="rounded-2xl border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {selectedColumn?.title || "Status"} Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              No data to display. Add items to see the chart.
            </div>
          ) : (
            <>
              {chartType === "bar" && (
                <div className="space-y-4">
                  {chartData.map((data, i) => (
                    <div key={data.label} className="space-y-2" data-testid={`chart-bar-${i}`}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{data.label}</span>
                        <span className="text-muted-foreground">{data.count} items</span>
                      </div>
                      <div className="h-8 bg-muted/30 rounded-lg overflow-hidden">
                        <div 
                          className={cn("h-full rounded-lg transition-all", data.color)}
                          style={{ width: `${(data.count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {chartType === "pie" && (
                <div className="flex items-center gap-8">
                  <div className="relative h-64 w-64 flex-shrink-0">
                    <svg viewBox="0 0 100 100" className="transform -rotate-90">
                      {chartData.reduce((acc, data, i) => {
                        const startAngle = acc.offset;
                        const angle = (data.percentage / 100) * 360;
                        const endAngle = startAngle + angle;
                        
                        const x1 = 50 + 40 * Math.cos((startAngle * Math.PI) / 180);
                        const y1 = 50 + 40 * Math.sin((startAngle * Math.PI) / 180);
                        const x2 = 50 + 40 * Math.cos((endAngle * Math.PI) / 180);
                        const y2 = 50 + 40 * Math.sin((endAngle * Math.PI) / 180);
                        const largeArc = angle > 180 ? 1 : 0;
                        
                        const colorClass = data.color.replace('bg-', '');
                        const colorMap: Record<string, string> = {
                          'primary': 'hsl(var(--primary))',
                          'brand-green': 'hsl(var(--accent-green))',
                          'brand-purple': 'hsl(var(--accent-purple))',
                          'brand-orange': 'hsl(var(--accent-orange))',
                          'brand-pink': 'hsl(var(--accent-pink))',
                          'ai': 'hsl(var(--ai-primary))',
                          'chart-4': 'hsl(var(--chart-4))',
                          'destructive': 'hsl(var(--destructive))',
                        };
                        
                        acc.elements.push(
                          <path
                            key={i}
                            d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
                            fill={colorMap[colorClass] || 'hsl(var(--primary))'}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                            data-testid={`chart-pie-${i}`}
                          />
                        );
                        
                        return { elements: acc.elements, offset: endAngle };
                      }, { elements: [] as React.ReactNode[], offset: 0 }).elements}
                    </svg>
                  </div>
                  
                  <div className="space-y-3">
                    {chartData.map((data) => (
                      <div key={data.label} className="flex items-center gap-3">
                        <div className={cn("h-4 w-4 rounded", data.color)} />
                        <span className="text-sm">{data.label}</span>
                        <span className="text-sm text-muted-foreground ml-auto">
                          {data.percentage.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {chartType === "line" && (
                <div className="h-64 flex items-end gap-2">
                  {chartData.map((data, i) => (
                    <div 
                      key={data.label} 
                      className="flex-1 flex flex-col items-center gap-2"
                      data-testid={`chart-line-${i}`}
                    >
                      <div className="w-full flex items-end justify-center h-48">
                        <div 
                          className={cn("w-full max-w-[40px] rounded-t-lg transition-all", data.color)}
                          style={{ height: `${(data.count / maxCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-center text-muted-foreground truncate w-full">
                        {data.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-xl">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{items.length}</p>
            <p className="text-sm text-muted-foreground">Total Items</p>
          </CardContent>
        </Card>
        {chartData.slice(0, 3).map((data) => (
          <Card key={data.label} className="rounded-xl">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{data.count}</p>
              <p className="text-sm text-muted-foreground">{data.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
