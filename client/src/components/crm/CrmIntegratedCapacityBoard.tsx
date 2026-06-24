import { useState } from "react";
import { Link } from "wouter";
import { CalendarDays, CalendarRange, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { RpPersonaProvider } from "@/components/resource-planning/persona-context";
import { HeatMapTab, SchedulerTab } from "@/components/resource-planning/tab-views";

type CapacityView = "heatmap" | "scheduler";

function CrmIntegratedCapacityBoardInner() {
  const [view, setView] = useState<CapacityView>("heatmap");

  return (
    <div className="space-y-4" data-testid="crm-capacity-board-integrated">
      <div className="flex items-center justify-between gap-4 flex-wrap rounded-lg border border-border/40 bg-muted/15 px-4 py-3">
        <p className="text-xs text-muted-foreground max-w-2xl">
          This board uses the same data as the Resource Planning module — project bookings, leave, and CRM opportunity resource plans are combined here.
        </p>
        <Link
          href="/modules/resource-planning?tab=heatmap"
          className="text-xs font-medium text-[#0ea5e9] hover:underline inline-flex items-center gap-1.5 shrink-0"
          data-testid="link-open-resource-planning"
        >
          Open Resource Planning
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="flex border border-border rounded-lg overflow-hidden w-fit">
        <button
          type="button"
          onClick={() => setView("heatmap")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors",
            view === "heatmap" ? "bg-[#0ea5e9] text-white" : "bg-card text-muted-foreground hover:bg-muted",
          )}
          data-testid="crm-capacity-view-heatmap"
        >
          <CalendarDays className="h-4 w-4" />
          Resource Heat Map
        </button>
        <button
          type="button"
          onClick={() => setView("scheduler")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors border-l",
            view === "scheduler" ? "bg-[#0ea5e9] text-white" : "bg-card text-muted-foreground hover:bg-muted",
          )}
          data-testid="crm-capacity-view-scheduler"
        >
          <CalendarRange className="h-4 w-4" />
          Resource Scheduler
        </button>
      </div>

      {view === "heatmap" ? <HeatMapTab /> : <SchedulerTab />}
    </div>
  );
}

export function CrmIntegratedCapacityBoard() {
  return (
    <RpPersonaProvider persona="res-mgr">
      <CrmIntegratedCapacityBoardInner />
    </RpPersonaProvider>
  );
}
