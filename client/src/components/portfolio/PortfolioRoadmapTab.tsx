import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Diamond, Image } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { RoadmapData } from "./types";
import { PortfolioToolbar, PortfolioMobileCard } from "./PortfolioUi";

const ZOOM_DAYS: Record<string, number> = { Month: 30, Quarter: 90, "Half-year": 180, Year: 365 };

export function PortfolioRoadmapTab() {
  const { toast } = useToast();
  const ganttExportRef = useRef<HTMLDivElement>(null);
  const mobileExportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [zoom, setZoom] = useState("Quarter");
  const [groupBy, setGroupBy] = useState("type");
  const [showMilestones, setShowMilestones] = useState(true);
  const [showToday, setShowToday] = useState(true);
  const [filterClient, setFilterClient] = useState("");
  const [filterRag, setFilterRag] = useState("");

  const { data, isLoading } = useQuery<RoadmapData>({ queryKey: ["/api/portfolio/roadmap"] });

  const spanDays = ZOOM_DAYS[zoom] || 90;
  const today = new Date();
  const rangeStart = new Date(today);
  rangeStart.setDate(rangeStart.getDate() - 7);
  const rangeEnd = new Date(today);
  rangeEnd.setDate(rangeEnd.getDate() + spanDays);
  const totalMs = rangeEnd.getTime() - rangeStart.getTime();
  const pct = (d: Date) => Math.max(0, Math.min(100, ((d.getTime() - rangeStart.getTime()) / totalMs) * 100));

  const items = useMemo(() => {
    if (!data) return [];
    let rows = data.items;
    if (filterClient) rows = rows.filter((i) => i.clientName?.includes(filterClient));
    if (filterRag) rows = rows.filter((i) => (i.ragStatus || "").toLowerCase() === filterRag);
    if (groupBy === "type") {
      const order = { internal: 0, programme: 1, project: 2 };
      rows = [...rows].sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9));
    }
    return rows;
  }, [data, filterClient, filterRag, groupBy]);

  const exportPng = () => {
    window.print();
  };

  if (isLoading || !data) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <PortfolioToolbar>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(ZOOM_DAYS).map((z) => (
            <Button key={z} variant={zoom === z ? "default" : "outline"} size="sm" onClick={() => setZoom(z)}>{z}</Button>
          ))}
        </div>
        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="text-xs border rounded-lg px-2 py-1.5 bg-background w-full sm:w-auto">
          <option value="type">Group: Type</option>
          <option value="portfolio">Group: Portfolio</option>
          <option value="client">Group: Client</option>
        </select>
        <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={showMilestones} onChange={(e) => setShowMilestones(e.target.checked)} /> Milestones</label>
        <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={showToday} onChange={(e) => setShowToday(e.target.checked)} /> Today</label>
        <Button variant="outline" size="sm" onClick={exportPng} disabled={exporting}>
          {exporting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Image className="h-3.5 w-3.5 mr-1" />}
          PNG
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Download className="h-3.5 w-3.5 mr-1" /> Print</Button>
      </PortfolioToolbar>

      <div ref={mobileExportRef} className="lg:hidden space-y-2 bg-background p-2 rounded-lg">
        {items.map((item) => {
          const rag = (item.ragStatus || "green").toLowerCase();
          const ragDot = rag === "red" ? "bg-red-500" : rag === "amber" ? "bg-amber-500" : "bg-emerald-500";
          return (
            <PortfolioMobileCard
              key={item.id}
              title={item.name}
              subtitle={`${item.clientName || "Internal"} · ${item.startDate || "?"} → ${item.endDate || "?"}`}
              badge={<Badge variant="outline" className="text-[9px] capitalize">{item.type}</Badge>}
            >
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, item.status === "completed" ? 100 : 60)}%`, background: item.colour }} />
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <div className={cn("h-2 w-2 rounded-full", ragDot)} />
                RAG {item.ragStatus || "green"}
              </div>
            </PortfolioMobileCard>
          );
        })}
      </div>

      <Card className="border-border/30 overflow-hidden hidden lg:block">
        <CardHeader className="py-3 px-4"><CardTitle className="text-sm font-bold">Portfolio Roadmap</CardTitle></CardHeader>
        <CardContent className="p-0" ref={ganttExportRef}>
          <div className="grid grid-cols-[minmax(180px,280px)_1fr] min-h-[400px] bg-background">
            <div className="border-r border-border/30 bg-muted/20">
              <div className="p-3 text-xs font-bold text-muted-foreground border-b">Name / Client / PM</div>
              {items.map((item) => (
                <div key={item.id} className="px-3 py-2.5 border-b border-border/20 text-sm">
                  <p className="font-semibold truncate">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground">{item.clientName || "Internal"} · {item.managerName || "—"}</p>
                  <Badge variant="outline" className="text-[9px] mt-1 capitalize">{item.type}</Badge>
                </div>
              ))}
            </div>
            <div className="relative overflow-x-auto p-4 min-w-[500px]">
              {showToday && (
                <div className="absolute top-0 bottom-0 w-px bg-teal-500 z-10" style={{ left: `${pct(today)}%` }}>
                  <span className="absolute -top-1 text-[8px] font-bold text-teal-600">TODAY</span>
                </div>
              )}
              <div className="space-y-0">
                {items.map((item) => {
                  const start = item.startDate ? new Date(item.startDate + "T00:00:00") : today;
                  const end = item.endDate ? new Date(item.endDate + "T00:00:00") : new Date(today.getTime() + 30 * 86400000);
                  const left = pct(start);
                  const width = Math.max(pct(end) - left, 3);
                  const rag = (item.ragStatus || "green").toLowerCase();
                  const ragDot = rag === "red" ? "#EF4444" : rag === "amber" ? "#F59E0B" : "#22C55E";
                  return (
                    <div key={item.id} className="relative h-12 border-b border-border/20 flex items-center">
                      <div
                        className={cn("absolute h-6 rounded-md flex items-center px-2 text-[10px] font-semibold text-white", item.provisional && "opacity-70")}
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          background: item.colour,
                          backgroundImage: item.provisional ? "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,.15) 4px, rgba(255,255,255,.15) 8px)" : undefined,
                        }}
                        title={`${item.name}\nPM: ${item.managerName}\nClient: ${item.clientName}\n${item.startDate} → ${item.endDate}\nRAG: ${item.ragStatus}`}
                      >
                        <span className="truncate">{item.name}</span>
                        <div className="absolute right-1 h-2 w-2 rounded-full" style={{ background: ragDot }} />
                      </div>
                      {showMilestones && data.milestoneMarkers.filter((m) => m.projectId && item.entityId === m.projectId).map((m) => {
                        if (!m.date) return null;
                        const mp = pct(new Date(m.date + "T00:00:00"));
                        return (
                          <span key={m.id} className="absolute z-20" style={{ left: `${mp}%`, top: "50%", transform: "translate(-50%, -50%)" }} title={m.name}>
                            <Diamond className="h-3 w-3 text-primary" />
                          </span>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
