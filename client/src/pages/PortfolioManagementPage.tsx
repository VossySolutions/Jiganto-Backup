import { useState, useMemo } from "react";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { TablePagination } from "@/components/TablePagination";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sidebar } from "@/components/Sidebar";
import { useShellLayout } from "@/hooks/use-shell-layout";
import { cn } from "@/lib/utils";
import { ModuleHeader } from "@/components/ModuleHeader";
import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";
import {
  ChevronRight, ChevronDown, Loader2, Search, AlertTriangle, Clock,
  Calendar, Target, Users, BarChart3, Eye, Briefcase,
  Layers, FolderKanban, Activity,
  ArrowUpRight, CircleDot,
} from "lucide-react";
import {
  PfDashboardIcon,
  PfPortfoliosIcon,
  PfProgrammesIcon,
  PfRoadmapIcon,
  PfHealthIcon,
  PfReportsIcon,
  PortfolioIcon,
  PmMilestonePlanIcon,
} from "@/components/icons/ModuleIcons";
import MilestoneTracker from "@/components/projects/MilestoneTracker";

type PfPortfolio = {
  id: number;
  tenantId: number;
  name: string;
  description: string | null;
  ownerId: string | null;
  status: string | null;
  ragStatus: string | null;
  budget: string | null;
  spentBudget: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
};

type PfProgram = {
  id: number;
  tenantId: number;
  portfolioId: number | null;
  name: string;
  description: string | null;
  ownerId: string | null;
  status: string | null;
  ragStatus: string | null;
  budget: string | null;
  spentBudget: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
};

type PfProject = {
  id: number;
  tenantId: number;
  portfolioId: number | null;
  programId: number | null;
  initiativeId: number | null;
  parentProjectId: number | null;
  code: string | null;
  name: string;
  description: string | null;
  projectType: string | null;
  methodology: string | null;
  ownerId: string | null;
  managerId: string | null;
  status: string | null;
  ragStatus: string | null;
  priority: string | null;
  progress: number | null;
  budget: string | null;
  spentBudget: string | null;
  startDate: string | null;
  endDate: string | null;
  ragSchedule: string | null;
  ragBudget: string | null;
  ragScope: string | null;
  ragQuality: string | null;
  ragResources: string | null;
  ragRisks: string | null;
};

type WorkItem = {
  id: string;
  name: string;
  description: string | null;
  type: "portfolio" | "programme" | "project";
  status: string | null;
  ragStatus: string | null;
  progress: number;
  budget: number;
  spentBudget: number;
  startDate: string | null;
  endDate: string | null;
  children?: WorkItem[];
  isParent?: boolean;
};

const ragConfig: Record<string, { dot: string; label: string; color: string }> = {
  green: { dot: "bg-brand-green", label: "On Track", color: "text-brand-green" },
  amber: { dot: "bg-brand-orange", label: "At Risk", color: "text-brand-orange" },
  red: { dot: "bg-destructive", label: "Critical", color: "text-destructive" },
  blue: { dot: "bg-primary", label: "Complete", color: "text-primary" },
};

const statusConfig: Record<string, { bg: string; text: string }> = {
  active: { bg: "bg-status-green", text: "text-status-green-foreground" },
  planning: { bg: "bg-status-amber", text: "text-status-amber-foreground" },
  on_hold: { bg: "bg-status-blue", text: "text-status-blue-foreground" },
  completed: { bg: "bg-status-green", text: "text-status-green-foreground" },
  draft: { bg: "bg-muted", text: "text-muted-foreground" },
  cancelled: { bg: "bg-status-red", text: "text-status-red-foreground" },
};

const typeColors: Record<string, { bg: string; text: string }> = {
  portfolio: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300" },
  programme: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300" },
  project: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300" },
};

const barColors: Record<string, string> = {
  green: "#22C55E",
  amber: "#F59E0B",
  red: "#EF4444",
  blue: "#3B82F6",
};

function RagDot({ status, showLabel = false }: { status: string | null; showLabel?: boolean }) {
  const config = ragConfig[status || "green"] || ragConfig.green;
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("h-2.5 w-2.5 rounded-full shrink-0", config.dot)} />
      {showLabel && <span className={cn("text-xs font-medium", config.color)}>{config.label}</span>}
    </div>
  );
}

function StatCard({ 
  title, value, subtitle, trend, trendLabel, color, segments, onClick 
}: { 
  title: string; value: string | number; subtitle: string; trend?: "up" | "down" | "flat"; 
  trendLabel?: string; color: string; segments?: { width: number; color: string }[];
  onClick?: () => void;
}) {
  return (
    <Card 
      className={cn("border-border/30 cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5 overflow-hidden relative", `border-t-2`)}
      style={{ borderTopColor: color }}
      onClick={onClick}
      data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</span>
          {trend && trendLabel && (
            <Badge variant="outline" className={cn("text-[10px] font-mono px-1.5 py-0",
              trend === "up" ? "text-brand-green border-brand-green/30 bg-brand-green/10" :
              trend === "down" ? "text-destructive border-destructive/30 bg-destructive/10" :
              "text-muted-foreground border-border bg-muted/50"
            )}>
              {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {trendLabel}
            </Badge>
          )}
        </div>
        <div className="text-2xl font-extrabold tracking-tight mb-1" style={{ color }}>{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
        {segments && segments.length > 0 && (
          <div className="flex gap-0.5 mt-3 h-1 rounded-full overflow-hidden">
            {segments.map((seg, i) => (
              <div key={i} className="h-full rounded-full" style={{ width: `${seg.width}%`, background: seg.color }} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RagSummaryCard({ counts }: { counts: { green: number; amber: number; red: number; other: number } }) {
  const total = counts.green + counts.amber + counts.red + counts.other;
  return (
    <Card className="border-border/30 min-w-[155px]" data-testid="stat-card-rag-summary">
      <CardContent className="p-4">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-3">Portfolio RAG</span>
        <div className="space-y-2.5">
          {[
            { label: "On Track", count: counts.green, dot: "bg-brand-green", bar: "#22C55E" },
            { label: "At Risk", count: counts.amber, dot: "bg-brand-orange", bar: "#F59E0B" },
            { label: "Critical", count: counts.red, dot: "bg-destructive", bar: "#EF4444" },
            { label: "Other", count: counts.other, dot: "bg-muted-foreground", bar: "#6B7280" },
          ].map(row => (
            <div key={row.label} className="flex items-center gap-2">
              <div className={cn("h-2 w-2 rounded-full shrink-0", row.dot)} />
              <span className="font-mono text-sm font-semibold min-w-[18px]">{row.count}</span>
              <span className="text-xs text-muted-foreground flex-1">{row.label}</span>
              <div className="h-1 w-12 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full" style={{ width: total > 0 ? `${(row.count / total) * 100}%` : "0%", background: row.bar }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineStrip({ items }: { items: WorkItem[] }) {
  const today = new Date();
  const rangeStart = new Date(today);
  rangeStart.setDate(rangeStart.getDate() - 15);
  const rangeEnd = new Date(today);
  rangeEnd.setDate(rangeEnd.getDate() + 75);
  const span = rangeEnd.getTime() - rangeStart.getTime();

  const pct = (date: Date) => Math.max(0, Math.min(100, ((date.getTime() - rangeStart.getTime()) / span) * 100));
  const todayPct = pct(today);

  const months: { label: string; pct: number }[] = [];
  const mStart = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  while (mStart <= rangeEnd) {
    const p = pct(mStart);
    if (p >= 0 && p <= 100) {
      months.push({ label: mStart.toLocaleString("en", { month: "short", year: "2-digit" }), pct: p });
    }
    mStart.setMonth(mStart.getMonth() + 1);
  }

  const tracks = items.filter(i => i.startDate && i.endDate).slice(0, 8);

  return (
    <Card className="border-border/30 overflow-hidden" data-testid="timeline-strip">
      <CardHeader className="py-3 px-4 border-b border-border/30 flex-row items-center gap-2">
        <Calendar className="h-4 w-4 text-primary" />
        <CardTitle className="text-sm font-bold flex-1">Critical Dates — Next 90 Days</CardTitle>
        <Badge variant="outline" className="text-xs font-mono">{tracks.length} items</Badge>
      </CardHeader>
      <CardContent className="p-4 overflow-x-auto">
        <div className="min-w-[500px] relative">
          <div className="flex border-b border-border/30 pb-2 mb-3 relative">
            {months.map((m, i) => (
              <div key={i} className="flex-1 text-[9px] font-bold text-muted-foreground uppercase tracking-wider text-center relative">
                {i > 0 && <div className="absolute left-0 top-0 bottom-[-8px] w-px bg-border/30" />}
                {m.label}
              </div>
            ))}
          </div>
          <div className="absolute top-0 bottom-0 w-px bg-teal-500 z-10" style={{ left: `${todayPct}%` }}>
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[7px] font-bold text-teal-500 font-mono tracking-wider">NOW</span>
          </div>
          <div className="space-y-2">
            {tracks.map(item => {
              const start = item.startDate ? new Date(item.startDate) : today;
              const end = item.endDate ? new Date(item.endDate) : today;
              const left = pct(start);
              const right = pct(end);
              const width = Math.max(right - left, 2);
              const color = barColors[item.ragStatus || "blue"] || barColors.blue;

              return (
                <div key={item.id} className="flex items-center gap-2">
                  <div className="w-28 shrink-0 text-[10.5px] font-semibold text-muted-foreground text-right pr-2 truncate">
                    {item.name}
                  </div>
                  <div className="flex-1 relative h-5">
                    <div
                      className="absolute h-4 top-0.5 rounded flex items-center px-1.5 text-[9px] font-bold text-white/90 whitespace-nowrap overflow-hidden text-ellipsis cursor-pointer hover:brightness-110 transition-all"
                      style={{ left: `${left}%`, width: `${width}%`, background: color, opacity: 0.85 }}
                      title={`${item.name}: ${item.startDate || "?"} → ${item.endDate || "?"}`}
                    >
                      {width > 10 ? `${item.progress}%` : ""}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {tracks.length === 0 && (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              <Calendar className="h-5 w-5 mr-2" />
              No items with date ranges to display
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PortfolioTableRow({
  item,
  isChild,
  isOpen,
  onToggle,
}: {
  item: WorkItem;
  isChild?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
}) {
  const rag = ragConfig[item.ragStatus || "green"] || ragConfig.green;
  const sConfig = statusConfig[item.status || "active"] || statusConfig.active;
  const tConfig = typeColors[item.type] || typeColors.project;
  const progressColor = item.ragStatus === "red" ? "#EF4444" : item.ragStatus === "amber" ? "#F59E0B" : "#22C55E";

  return (
    <tr
      className={cn(
        "group cursor-pointer transition-colors",
        isChild ? "hover:bg-muted/30" : "hover:bg-muted/50",
        !isChild && "border-l-2",
      )}
      style={!isChild ? { borderLeftColor: barColors[item.ragStatus || "blue"] || "#3B82F6" } : undefined}
      data-testid={`portfolio-row-${item.id}`}
    >
      <td className="w-8 text-center py-2 px-1">
        {item.isParent ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
            className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
            data-testid={`toggle-${item.id}`}
          >
            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <div className={cn("h-1.5 w-1.5 rounded-full mx-auto", isChild ? "bg-border" : "bg-muted-foreground/30")} />
        )}
      </td>
      <td className={cn("py-2 px-3", isChild && "pl-8")}>
        <div className="flex items-center gap-2">
          <div className="min-w-0">
            <div className={cn("font-semibold text-sm truncate max-w-[220px]", isChild && "font-medium text-muted-foreground")}>
              {item.name}
            </div>
            {item.description && (
              <div className="text-[10.5px] text-muted-foreground truncate max-w-[220px]">{item.description}</div>
            )}
          </div>
        </div>
      </td>
      <td className="py-2 px-3">
        <Badge variant="outline" className={cn("text-[10px] font-bold", tConfig.bg, tConfig.text)}>
          {item.type === "programme" ? "Programme" : item.type === "portfolio" ? "Portfolio" : "Project"}
        </Badge>
      </td>
      <td className="py-2 px-3">
        <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-bold", sConfig.bg)}>
          <div className={cn("h-1.5 w-1.5 rounded-full",
            item.status === "active" ? "bg-brand-green" : item.status === "planning" ? "bg-brand-orange" : "bg-muted-foreground"
          )} />
          <span className={sConfig.text}>{(item.status || "active").replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</span>
        </div>
      </td>
      <td className="py-2 px-3">
        <div className="flex items-center gap-1.5">
          <RagDot status={item.ragStatus} />
          <span className={cn("text-xs font-bold", rag.color)}>{rag.label}</span>
        </div>
      </td>
      <td className="py-2 px-3">
        <div className="flex items-center gap-2 min-w-[90px]">
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${item.progress}%`, background: progressColor }} />
          </div>
          <span className="font-mono text-[10.5px] text-muted-foreground min-w-[27px] text-right">{item.progress}%</span>
        </div>
      </td>
      <td className="py-2 px-3">
        {item.endDate ? (
          <span className={cn("font-mono text-[10.5px]",
            item.ragStatus === "red" ? "text-destructive" :
            item.ragStatus === "amber" ? "text-brand-orange" : "text-muted-foreground"
          )}>
            {new Date(item.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
          </span>
        ) : (
          <span className="text-muted-foreground text-[10.5px]">—</span>
        )}
      </td>
      <td className="py-2 px-3">
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] font-semibold text-muted-foreground hover:text-primary" data-testid={`open-${item.id}`}>
          Open <ArrowUpRight className="h-3 w-3 ml-0.5" />
        </Button>
      </td>
    </tr>
  );
}

function ActivePortfolioTable({ items, searchQuery, filter }: { items: WorkItem[]; searchQuery: string; filter: string }) {
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setOpenMap(prev => ({ ...prev, [id]: !prev[id] }));

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (filter === "programme" && item.type !== "programme") return false;
      if (filter === "project" && item.type === "programme") return false;
      if (filter === "risk" && item.ragStatus !== "amber") return false;
      if (filter === "critical" && item.ragStatus !== "red") return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatch = item.name.toLowerCase().includes(q);
        const descMatch = item.description?.toLowerCase().includes(q);
        const childMatch = item.children?.some(c => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q));
        if (!nameMatch && !descMatch && !childMatch) return false;
      }
      return true;
    });
  }, [items, filter, searchQuery]);

  const pagination = useTablePagination(filteredItems, {
    resetKey: `${filter}-${searchQuery}`,
  });

  const visibleCount = filteredItems.reduce((acc, item) => {
    let count = 1;
    if (item.isParent && item.children && openMap[item.id]) {
      count += item.children.length;
    }
    return acc + count;
  }, 0);

  return (
    <Card className="border-border/30 overflow-hidden" data-testid="active-portfolio-table">
      <CardHeader className="py-3 px-4 border-b border-border/30 flex-row items-center gap-2">
        <FolderKanban className="h-4 w-4 text-primary" />
        <CardTitle className="text-sm font-bold flex-1">Active Portfolio</CardTitle>
        <Badge variant="outline" className="text-xs font-mono" data-testid="portfolio-count">{visibleCount} items</Badge>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-border/30">
              <th className="w-8" />
              <th className="text-left py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground min-w-[200px]">Name</th>
              <th className="text-left py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-[88px]">Type</th>
              <th className="text-left py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-[88px]">Status</th>
              <th className="text-left py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-[90px]">Health</th>
              <th className="text-left py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-[115px]">Progress</th>
              <th className="text-left py-2 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-[80px]">Due</th>
              <th className="w-[56px]" />
            </tr>
          </thead>
          <tbody>
            {pagination.paginatedItems.map(item => (
              <PortfolioTableGroup key={item.id} item={item} isOpen={!!openMap[item.id]} onToggle={() => toggle(item.id)} />
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-muted-foreground">
                  <FolderKanban className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No work items match your filters</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        startIndex={pagination.startIndex}
        endIndex={pagination.endIndex}
        pageSize={pagination.pageSize}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        extra={
          <span className="text-xs font-mono" data-testid="portfolio-info">
            ({visibleCount} visible with expanded children)
          </span>
        }
      />
    </Card>
  );
}

function PortfolioTableGroup({ item, isOpen, onToggle }: { item: WorkItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <>
      <PortfolioTableRow item={item} isOpen={isOpen} onToggle={onToggle} />
      {item.isParent && item.children && isOpen && (
        item.children.map(child => (
          <PortfolioTableRow key={child.id} item={child} isChild />
        ))
      )}
    </>
  );
}

function AttentionQueue() {
  const items = [
    { id: 1, title: "Budget forecast exceeding target", tag: "WARNING", tagColor: "bg-brand-orange/10 text-brand-orange", project: "Digital Transformation", time: "2h ago", icon: AlertTriangle, iconBg: "bg-brand-orange/10" },
    { id: 2, title: "Resource conflict detected", tag: "RESOURCE", tagColor: "bg-brand-orange/10 text-brand-orange", project: "ERP Migration", time: "4h ago", icon: Users, iconBg: "bg-brand-orange/10" },
    { id: 3, title: "Milestone overdue by 5 days", tag: "OVERDUE", tagColor: "bg-destructive/10 text-destructive", project: "Cloud Migration", time: "1d ago", icon: Clock, iconBg: "bg-destructive/10" },
    { id: 4, title: "Approval pending for change request", tag: "APPROVAL", tagColor: "bg-primary/10 text-primary", project: "Customer Portal", time: "2d ago", icon: Eye, iconBg: "bg-primary/10" },
  ];

  return (
    <Card className="border-border/30 overflow-hidden" data-testid="attention-queue">
      <CardHeader className="py-3 px-4 border-b border-border/30 flex-row items-center gap-2">
        <Target className="h-4 w-4 text-brand-orange" />
        <CardTitle className="text-sm font-bold flex-1">Your Attention Queue</CardTitle>
        <Badge variant="outline" className="text-xs font-mono text-brand-orange border-brand-orange/30 bg-brand-orange/10">{items.length} items</Badge>
      </CardHeader>
      <div>
        {items.map(item => {
          const Icon = item.icon;
          return (
            <div key={item.id} className="flex items-start gap-3 px-4 py-3 border-b border-border/30 last:border-b-0 cursor-pointer hover:bg-muted/30 transition-colors" data-testid={`attention-item-${item.id}`}>
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5", item.iconBg)}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{item.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="outline" className={cn("text-[9px] font-bold px-1.5 py-0", item.tagColor)}>{item.tag}</Badge>
                  <span className="text-[10.5px] text-muted-foreground">{item.project}</span>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono shrink-0 mt-1">{item.time}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ResourceUtilisation() {
  const resources = [
    { initials: "SA", name: "Sarah Ahmed", role: "Portfolio Director", utilisation: 85, color: "linear-gradient(135deg, #3B82F6, #8B5CF6)" },
    { initials: "DK", name: "Dan Kowalski", role: "Programme Lead", utilisation: 110, color: "linear-gradient(135deg, #EF4444, #F97316)" },
    { initials: "PV", name: "Priya Venkat", role: "Tech Lead", utilisation: 95, color: "linear-gradient(135deg, #14B8A6, #3B82F6)" },
    { initials: "ML", name: "Marcus Lee", role: "Project Manager", utilisation: 70, color: "linear-gradient(135deg, #10B981, #14B8A6)" },
  ];

  return (
    <Card className="border-border/30 overflow-hidden" data-testid="resource-utilisation">
      <CardHeader className="py-3 px-4 border-b border-border/30 flex-row items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <CardTitle className="text-sm font-bold flex-1">Resource Utilisation</CardTitle>
        <Badge variant="outline" className="text-xs font-mono text-destructive border-destructive/30 bg-destructive/10">
          {resources.filter(r => r.utilisation > 90).length} overloaded
        </Badge>
      </CardHeader>
      <div>
        {resources.map(r => {
          const barColor = r.utilisation > 90 ? "#EF4444" : r.utilisation > 75 ? "#F59E0B" : "#22C55E";
          const textColor = r.utilisation > 90 ? "text-destructive" : r.utilisation > 75 ? "text-brand-orange" : "text-brand-green";
          return (
            <div key={r.initials} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/30 last:border-b-0 cursor-pointer hover:bg-muted/30 transition-colors" data-testid={`resource-${r.initials}`}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ background: r.color }}>
                {r.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11.5px] font-semibold">{r.name}</p>
                <p className="text-[10px] text-muted-foreground">{r.role}</p>
              </div>
              <div className="w-14 shrink-0">
                <div className="h-1 bg-muted rounded-full overflow-hidden mb-0.5">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(r.utilisation, 100)}%`, background: barColor }} />
                </div>
                <p className={cn("font-mono text-[10px] text-right font-semibold", textColor)}>{r.utilisation}%</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ActivityFeed() {
  const activities = [
    { id: 1, user: "Dan Kowalski", action: "updated risk log on", target: "CRM Phase 2", time: "14:18 today", dot: "bg-brand-green" },
    { id: 2, user: "Priya Venkat", action: "raised new issue on", target: "Digital Transformation", time: "11:42 today", dot: "bg-brand-orange" },
    { id: 3, user: "Marcus Lee", action: "completed milestone", target: "Phase 1 Sign-off", time: "09:05 today", dot: "bg-primary" },
    { id: 4, user: "Sarah Ahmed", action: "created", target: "ERP Pilot Programme", time: "Yesterday", dot: "bg-muted-foreground" },
  ];

  return (
    <Card className="border-border/30 overflow-hidden" data-testid="activity-feed">
      <CardHeader className="py-3 px-4 border-b border-border/30 flex-row items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <CardTitle className="text-sm font-bold flex-1">Portfolio Activity</CardTitle>
      </CardHeader>
      <div>
        {activities.map((a, i) => (
          <div key={a.id} className="flex gap-2.5 px-4 py-2.5 border-b border-border/30 last:border-b-0 cursor-pointer hover:bg-muted/30 transition-colors" data-testid={`activity-${a.id}`}>
            <div className="flex flex-col items-center pt-1">
              <div className={cn("h-2 w-2 rounded-full shrink-0", a.dot)} />
              {i < activities.length - 1 && <div className="w-px flex-1 bg-border/50 mt-1" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11.5px] text-muted-foreground leading-relaxed">
                <strong className="text-foreground font-semibold">{a.user}</strong> {a.action} <strong className="text-foreground font-semibold">{a.target}</strong>
              </p>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{a.time}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PlaceholderTab({ title, description, icon: Icon, features }: { title: string; description: string; icon: typeof Briefcase; features: string[] }) {
  return (
    <Card className="border-border/30 border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Icon className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-lg font-bold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md mb-6">{description}</p>
        <div className="grid grid-cols-2 gap-3 max-w-sm">
          {features.map(f => (
            <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
              <CircleDot className="h-3 w-3 text-primary shrink-0" />
              {f}
            </div>
          ))}
        </div>
        <Badge variant="outline" className="mt-6 text-xs">Phase 2 — Coming Soon</Badge>
      </CardContent>
    </Card>
  );
}

function DashboardTab({ portfolios, programs, projects }: { portfolios: PfPortfolio[]; programs: PfProgram[]; projects: PfProject[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const workItems: WorkItem[] = useMemo(() => {
    const items: WorkItem[] = [];

    programs.forEach(prog => {
      const childProjects = projects.filter(p => p.programId === prog.id);
      const avgProgress = childProjects.length > 0
        ? Math.round(childProjects.reduce((s, p) => s + (p.progress || 0), 0) / childProjects.length)
        : 0;

      items.push({
        id: `prog-${prog.id}`,
        name: prog.name,
        description: prog.description,
        type: "programme",
        status: prog.status,
        ragStatus: prog.ragStatus,
        progress: avgProgress,
        budget: parseFloat(prog.budget || "0"),
        spentBudget: parseFloat(prog.spentBudget || "0"),
        startDate: prog.startDate,
        endDate: prog.endDate,
        isParent: childProjects.length > 0,
        children: childProjects.map(p => ({
          id: `proj-${p.id}`,
          name: p.name,
          description: p.description,
          type: "project" as const,
          status: p.status,
          ragStatus: p.ragStatus,
          progress: p.progress || 0,
          budget: parseFloat(p.budget || "0"),
          spentBudget: parseFloat(p.spentBudget || "0"),
          startDate: p.startDate,
          endDate: p.endDate,
        })),
      });
    });

    const orphanProjects = projects.filter(p => !p.programId);
    orphanProjects.forEach(p => {
      items.push({
        id: `proj-${p.id}`,
        name: p.name,
        description: p.description,
        type: "project",
        status: p.status,
        ragStatus: p.ragStatus,
        progress: p.progress || 0,
        budget: parseFloat(p.budget || "0"),
        spentBudget: parseFloat(p.spentBudget || "0"),
        startDate: p.startDate,
        endDate: p.endDate,
      });
    });

    return items;
  }, [programs, projects]);

  const allFlatItems = useMemo(() => {
    const flat: WorkItem[] = [];
    workItems.forEach(item => {
      flat.push(item);
      if (item.children) flat.push(...item.children);
    });
    return flat;
  }, [workItems]);

  const activeItems = allFlatItems.filter(i => i.status === "active" || i.status === "planning");
  const totalBudget = allFlatItems.reduce((s, i) => s + i.budget, 0);
  const totalSpent = allFlatItems.reduce((s, i) => s + i.spentBudget, 0);
  const greenCount = allFlatItems.filter(i => i.ragStatus === "green").length;
  const amberCount = allFlatItems.filter(i => i.ragStatus === "amber").length;
  const redCount = allFlatItems.filter(i => i.ragStatus === "red").length;
  const otherCount = allFlatItems.length - greenCount - amberCount - redCount;
  const needsAttention = amberCount + redCount;

  const formatBudget = (val: number) => {
    if (val >= 1000000) return `£${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `£${(val / 1000).toFixed(0)}K`;
    return `£${val.toFixed(0)}`;
  };

  const filters = [
    { key: "all", label: "All Types" },
    { key: "programme", label: "Programmes" },
    { key: "project", label: "Projects" },
    { key: "risk", label: "At Risk" },
    { key: "critical", label: "Critical" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 xl:grid-cols-5 gap-3">
        <StatCard
          title="Active Work Items"
          value={activeItems.length}
          subtitle={`${greenCount} on track · ${amberCount} at risk · ${redCount} critical`}
          trend={activeItems.length > 0 ? "up" : "flat"}
          trendLabel={`${allFlatItems.length} total`}
          color="#22C55E"
          segments={[
            { width: allFlatItems.length > 0 ? (greenCount / allFlatItems.length) * 100 : 0, color: "#22C55E" },
            { width: allFlatItems.length > 0 ? (amberCount / allFlatItems.length) * 100 : 0, color: "#F59E0B" },
            { width: allFlatItems.length > 0 ? (redCount / allFlatItems.length) * 100 : 0, color: "#EF4444" },
          ]}
        />
        <StatCard
          title="Portfolio Budget"
          value={formatBudget(totalBudget)}
          subtitle={`${formatBudget(totalSpent)} spent · ${formatBudget(Math.max(0, totalBudget - totalSpent))} remaining`}
          trend={totalSpent > totalBudget * 0.8 ? "down" : "flat"}
          trendLabel={totalBudget > 0 ? `${Math.round((totalSpent / totalBudget) * 100)}% used` : "No budget"}
          color="#3B82F6"
          segments={[
            { width: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0, color: "#3B82F6" },
            { width: totalBudget > 0 ? Math.max(0, ((totalBudget - totalSpent) / totalBudget) * 100) : 100, color: "#E5E7EB" },
          ]}
        />
        <StatCard
          title="Programmes"
          value={programs.length}
          subtitle={`${programs.filter(p => p.status === "active").length} active · ${projects.length} projects`}
          color="#7C3AED"
        />
        <StatCard
          title="Needs Attention"
          value={needsAttention}
          subtitle={`${redCount} critical · ${amberCount} at risk`}
          trend={redCount > 0 ? "down" : "flat"}
          trendLabel={redCount > 0 ? `${redCount} critical` : "All clear"}
          color="#EF4444"
          segments={[
            { width: needsAttention > 0 ? (redCount / needsAttention) * 100 : 0, color: "#EF4444" },
            { width: needsAttention > 0 ? (amberCount / needsAttention) * 100 : 0, color: "#F59E0B" },
          ]}
        />
        <div className="hidden xl:block">
          <RagSummaryCard counts={{ green: greenCount, amber: amberCount, red: redCount, other: otherCount }} />
        </div>
      </div>

      <TimelineStrip items={allFlatItems} />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_296px] gap-4">
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            {filters.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                  filter === f.key
                    ? f.key === "risk" ? "bg-brand-orange/10 border-brand-orange/30 text-brand-orange"
                      : f.key === "critical" ? "bg-destructive/10 border-destructive/30 text-destructive"
                      : "bg-primary/10 border-primary/30 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                )}
                data-testid={`filter-${f.key}`}
              >
                {f.label}
              </button>
            ))}
            <div className="flex-1" />
            <div className="flex items-center gap-1.5 bg-muted/50 border border-border/30 rounded-lg px-3 py-1.5 min-w-[180px]">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search portfolio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-xs flex-1 placeholder:text-muted-foreground"
                data-testid="input-portfolio-search"
              />
            </div>
          </div>
          <ActivePortfolioTable items={workItems} searchQuery={searchQuery} filter={filter} />
        </div>

        <div className="space-y-4">
          <AttentionQueue />
          <ResourceUtilisation />
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}

export default function PortfolioManagementPage() {
  const { mainOffset, mobileTopOffset } = useShellLayout();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: portfolios = [], isLoading: portfoliosLoading } = useQuery<PfPortfolio[]>({
    queryKey: ["/api/pm/portfolios?tenantId=1"],
  });

  const { data: programs = [], isLoading: programsLoading } = useQuery<PfProgram[]>({
    queryKey: ["/api/pm/programs?tenantId=1"],
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<PfProject[]>({
    queryKey: ["/api/pm/projects?tenantId=1"],
  });

  const isLoading = portfoliosLoading || programsLoading || projectsLoading;

  if (isLoading) {
    return (
      <div className="h-screen overflow-hidden bg-background">
        <Sidebar />
        <main className={cn("transition-all duration-300 h-full flex items-center justify-center overflow-hidden", mainOffset, mobileTopOffset)}>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className={cn("transition-all duration-300 h-full flex flex-col overflow-hidden", mainOffset, mobileTopOffset)}>
        <div className="px-4 pt-4">
          <ModuleWelcomeBanner moduleKey="portfolio" features={["Command centre dashboard", "Portfolio & programme tracking", "RAG health matrix", "Timeline roadmap"]} />
        </div>
        <div className="border-b border-border/30 bg-card backdrop-blur-sm sticky top-0 z-50">
          <ModuleHeader
            icon={Briefcase}
            title="Portfolio Command Centre"
            subtitle="Strategic oversight across all programmes and projects"
            searchPlaceholder="Search portfolio..."
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchTestId="input-portfolio-header-search"
            titleTestId="text-portfolio-title"
          />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="px-4">
            <TabsList className="h-12 bg-transparent border-0 gap-1">
              <TabsTrigger value="dashboard" className="gap-2 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-dashboard">
                <PfDashboardIcon className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="portfolios" className="gap-2 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-portfolios">
                <PfPortfoliosIcon className="h-4 w-4" />
                Portfolios
              </TabsTrigger>
              <TabsTrigger value="programmes" className="gap-2 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-programmes">
                <PfProgrammesIcon className="h-4 w-4" />
                Programmes
              </TabsTrigger>
              <TabsTrigger value="roadmap" className="gap-2 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-roadmap">
                <PfRoadmapIcon className="h-4 w-4" />
                Roadmap
              </TabsTrigger>
              <TabsTrigger value="health" className="gap-2 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-health">
                <PfHealthIcon className="h-4 w-4" />
                Health Matrix
              </TabsTrigger>
              <TabsTrigger value="reports" className="gap-2 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-reports">
                <PfReportsIcon className="h-4 w-4" />
                Reports
              </TabsTrigger>
              <TabsTrigger value="milestones" className="gap-2 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary" data-testid="tab-milestones">
                <PmMilestonePlanIcon className="h-4 w-4" />
                Milestones
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <Tabs value={activeTab} className="space-y-0">
            <TabsContent value="dashboard" className="mt-0">
              <DashboardTab portfolios={portfolios} programs={programs} projects={projects} />
            </TabsContent>

            <TabsContent value="portfolios" className="mt-0">
              <PlaceholderTab
                title="Portfolios"
                description="Dedicated portfolio management with drill-down into programmes and projects. Create, edit, and track portfolios with aggregate RAG status, budget rollup, and timeline views."
                icon={Briefcase}
                features={["Portfolio CRUD", "Budget rollup", "Programme drill-down", "RAG aggregation", "Owner assignment", "Timeline tracking"]}
              />
            </TabsContent>

            <TabsContent value="programmes" className="mt-0">
              <PlaceholderTab
                title="Programmes"
                description="All programmes across portfolios in a focused table view. Manage programme-level planning, track constituent projects, and monitor cross-programme dependencies."
                icon={Layers}
                features={["Programme listing", "Project grouping", "Dependency tracking", "Status management", "Resource allocation", "Milestone tracking"]}
              />
            </TabsContent>

            <TabsContent value="roadmap" className="mt-0">
              <PlaceholderTab
                title="Roadmap"
                description="Full timeline and Gantt view across all portfolios, programmes, and projects. Visualise how work sequences across the organisation with drag-to-adjust scheduling."
                icon={Calendar}
                features={["Full Gantt timeline", "Drag-to-reschedule", "Milestone markers", "Dependency arrows", "Zoom controls", "Export to PDF"]}
              />
            </TabsContent>

            <TabsContent value="health" className="mt-0">
              <PlaceholderTab
                title="Health Matrix"
                description="Heat-map style RAG grid showing health across all dimensions (Schedule, Budget, Scope, Quality, Resources, Risks) for every portfolio and programme. The classic PMO status report at a glance."
                icon={BarChart3}
                features={["RAG heat map", "6 health dimensions", "Portfolio grouping", "Trend indicators", "Drill-down detail", "Export reports"]}
              />
            </TabsContent>

            <TabsContent value="reports" className="mt-0">
              <PlaceholderTab
                title="Reports"
                description="Pre-built report views for executive-level portfolio analysis. Budget vs. actual trending, resource demand forecasting, milestone tracking, and portfolio performance over time."
                icon={BarChart3}
                features={["Budget analysis", "Resource forecasting", "Milestone tracking", "Performance trends", "Custom report builder", "Scheduled exports"]}
              />
            </TabsContent>

            <TabsContent value="milestones" className="mt-0">
              <MilestoneTracker mode="portfolio" />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}