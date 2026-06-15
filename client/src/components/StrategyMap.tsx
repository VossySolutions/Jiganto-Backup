import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EntityDetailPanel } from "@/components/EntityDetailPanel";
import { BusinessTableScroll } from "@/components/business/BusinessTableScroll";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { TablePagination } from "@/components/TablePagination";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { 
  Search, ArrowRight, ChevronDown, ChevronRight, X,
  Target, Flag, Crosshair, Zap, TrendingUp, BarChart3, ShieldCheck,
  Download, Upload, User, Calendar, FileText, LayoutList, GitBranch, Workflow, Building2, Table2, Layers, Loader2
} from "lucide-react";

interface StrategyEntity {
  id: number;
  title?: string;
  name?: string;
  description?: string | null;
  ragStatus?: string | null;
  status?: string | null;
  progress?: number | null;
  ownerId?: string | null;
  ownerName?: string | null;
  assigneeName?: string | null;
  departmentId?: number | null;
  departmentName?: string | null;
  targetDate?: string | null;
  dueDate?: string | null;
  endDate?: string | null;
  priority?: string | null;
}

interface StrategyMapRow {
  id: string;
  strategy: StrategyEntity | null;
  goal: StrategyEntity | null;
  objective: StrategyEntity | null;
  initiative: StrategyEntity | null;
  okr: StrategyEntity | null;
  kpi: StrategyEntity | null;
  governance: StrategyEntity | null;
  worstRag: string;
}

interface Department { id: number; name: string; }

interface StrategyMapData {
  rows: StrategyMapRow[];
  summary: {
    totalStrategies: number; totalGoals: number; totalObjectives: number;
    totalInitiatives: number; totalOkrs: number; totalKpis: number; totalGovernance: number;
  };
  departments: Department[];
}

interface StrategyMapProps {
  onCellClick?: (entityType: string, entity: unknown) => void;
}

type ViewMode = "cascade" | "focus" | "flow" | "table";
type RagFilter = "all" | "green" | "amber" | "red";

const STRATEGY_LAYERS = [
  { key: "strategy" as const, label: "Strategy", icon: Target, accent: "#a855f7",
    bg: "bg-purple-500/10 dark:bg-purple-500/15", border: "border-purple-500/30 dark:border-purple-400/30",
    text: "text-purple-600 dark:text-purple-400", summaryKey: "totalStrategies" as const },
  { key: "goal" as const, label: "Goals", icon: Flag, accent: "#38bdf8",
    bg: "bg-sky-500/10 dark:bg-sky-500/15", border: "border-sky-500/30 dark:border-sky-400/30",
    text: "text-sky-600 dark:text-sky-400", summaryKey: "totalGoals" as const },
  { key: "objective" as const, label: "Objectives", icon: Crosshair, accent: "#818cf8",
    bg: "bg-indigo-500/10 dark:bg-indigo-500/15", border: "border-indigo-500/30 dark:border-indigo-400/30",
    text: "text-indigo-600 dark:text-indigo-400", summaryKey: "totalObjectives" as const },
  { key: "initiative" as const, label: "Initiatives", icon: Zap, accent: "#34d399",
    bg: "bg-emerald-500/10 dark:bg-emerald-500/15", border: "border-emerald-500/30 dark:border-emerald-400/30",
    text: "text-emerald-600 dark:text-emerald-400", summaryKey: "totalInitiatives" as const },
  { key: "okr" as const, label: "OKRs", icon: TrendingUp, accent: "#fbbf24",
    bg: "bg-amber-500/10 dark:bg-amber-500/15", border: "border-amber-500/30 dark:border-amber-400/30",
    text: "text-amber-600 dark:text-amber-400", summaryKey: "totalOkrs" as const },
  { key: "kpi" as const, label: "KPIs", icon: BarChart3, accent: "#f472b6",
    bg: "bg-pink-500/10 dark:bg-pink-500/15", border: "border-pink-500/30 dark:border-pink-400/30",
    text: "text-pink-600 dark:text-pink-400", summaryKey: "totalKpis" as const },
  { key: "governance" as const, label: "Governance", icon: ShieldCheck, accent: "#8b5cf6",
    bg: "bg-violet-500/10 dark:bg-violet-500/15", border: "border-violet-500/30 dark:border-violet-400/30",
    text: "text-violet-600 dark:text-violet-400", summaryKey: "totalGovernance" as const },
] as const;

const SUB_LAYERS = STRATEGY_LAYERS.slice(1);

const ragColors: Record<string, string> = {
  green: "bg-green-500/15 border-green-500/30 text-green-700 dark:text-green-400",
  amber: "bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-400",
  red: "bg-red-500/15 border-red-500/30 text-red-700 dark:text-red-400",
};

const ragDots: Record<string, string> = {
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

function getEntityTitle(e: StrategyEntity | null): string {
  return e?.title || e?.name || "Untitled";
}

function getOwner(e: StrategyEntity | null): string | null {
  return e?.ownerName || e?.assigneeName || null;
}

function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return dateStr; }
}

function getRagLabel(rag: string) {
  return rag === "green" ? "On Track" : rag === "amber" ? "At Risk" : "Behind";
}

export function StrategyMap({ onCellClick }: StrategyMapProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [ragFilter, setRagFilter] = useState<RagFilter>("all");
  const [activeLayer, setActiveLayer] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [showIds, setShowIds] = useState(true);
  const [focusedStrategyId, setFocusedStrategyId] = useState<number | null>(null);
  const [collapsedLayers, setCollapsedLayers] = useState<Set<string>>(new Set());
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<{ type: string; entity: Record<string, unknown> | null }>({ type: "", entity: null });
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [tableGroupBy, setTableGroupBy] = useState<"none" | "rag" | "department" | "owner">("none");

  const { data, isLoading, isFetching } = useQuery<StrategyMapData>({ queryKey: ["/api/business/strategy-map"] });

  const { data: entityRefs } = useQuery<Record<string, number>>({
    queryKey: ["/api/business/entity-refs"],
    staleTime: 60_000,
  });

  const uniqueOwners = useMemo(() => {
    if (!data?.rows) return [];
    const names = new Set<string>();
    data.rows.forEach(row => {
      [row.strategy, row.goal, row.objective, row.initiative, row.okr, row.kpi, row.governance].forEach(e => {
        const owner = getOwner(e);
        if (owner) names.add(owner);
      });
    });
    return Array.from(names).sort();
  }, [data?.rows]);

  const uniqueStrategies = useMemo(() => {
    const seen = new Set<number>();
    const result: StrategyEntity[] = [];
    (data?.rows || []).forEach(row => {
      if (row.strategy && !seen.has(row.strategy.id)) {
        seen.add(row.strategy.id);
        result.push(row.strategy);
      }
    });
    return result;
  }, [data?.rows]);

  const filteredRows = useMemo(() => {
    return (data?.rows || []).filter(row => {
      if (searchTerm) {
        const sl = searchTerm.toLowerCase();
        const matches = [row.strategy, row.goal, row.objective, row.initiative, row.okr, row.kpi, row.governance]
          .some(e => e && getEntityTitle(e).toLowerCase().includes(sl));
        if (!matches) return false;
      }
      if (statusFilter && statusFilter !== "all") {
        const hasStatus = [row.strategy, row.goal, row.objective, row.initiative]
          .some(e => e?.status === statusFilter);
        if (!hasStatus) return false;
      }
      if (departmentFilter && departmentFilter !== "all") {
        const deptId = parseInt(departmentFilter, 10);
        const hasDept = [row.strategy, row.goal, row.objective, row.initiative]
          .some(e => e && (e as any).departmentId === deptId);
        if (!hasDept) return false;
      }
      if (ownerFilter && ownerFilter !== "all") {
        const hasOwner = [row.strategy, row.goal, row.objective, row.initiative, row.okr, row.kpi, row.governance]
          .some(e => getOwner(e) === ownerFilter);
        if (!hasOwner) return false;
      }
      if (ragFilter !== "all") {
        const hasRag = [row.strategy, row.goal, row.objective, row.initiative, row.okr, row.kpi, row.governance]
          .some(e => (e?.ragStatus || "green") === ragFilter);
        if (!hasRag) return false;
      }
      if (activeLayer) {
        const entity = row[activeLayer as keyof StrategyMapRow];
        if (!entity || entity === row.worstRag) return false;
      }
      return true;
    });
  }, [data?.rows, searchTerm, statusFilter, departmentFilter, ownerFilter, ragFilter, activeLayer]);

  const layerItems = useMemo(() => {
    const result: Record<string, StrategyEntity[]> = {};
    STRATEGY_LAYERS.forEach(l => { result[l.key] = []; });
    const seen: Record<string, Set<number>> = {};
    STRATEGY_LAYERS.forEach(l => { seen[l.key] = new Set(); });
    filteredRows.forEach(row => {
      STRATEGY_LAYERS.forEach(layer => {
        const entity = row[layer.key as keyof StrategyMapRow] as StrategyEntity | null;
        if (entity && !seen[layer.key].has(entity.id)) {
          seen[layer.key].add(entity.id);
          result[layer.key].push(entity);
        }
      });
    });
    return result;
  }, [filteredRows]);

  const focusedLayerItems = useMemo(() => {
    if (!focusedStrategyId) return {} as Record<string, StrategyEntity[]>;
    const result: Record<string, StrategyEntity[]> = {};
    SUB_LAYERS.forEach(l => { result[l.key] = []; });
    const seen: Record<string, Set<number>> = {};
    SUB_LAYERS.forEach(l => { seen[l.key] = new Set(); });
    filteredRows.filter(row => row.strategy?.id === focusedStrategyId).forEach(row => {
      SUB_LAYERS.forEach(layer => {
        const entity = row[layer.key as keyof StrategyMapRow] as StrategyEntity | null;
        if (entity && !seen[layer.key].has(entity.id)) {
          seen[layer.key].add(entity.id);
          result[layer.key].push(entity);
        }
      });
    });
    return result;
  }, [filteredRows, focusedStrategyId]);

  const focusedStrategy = useMemo(
    () => uniqueStrategies.find(s => s.id === focusedStrategyId) ?? null,
    [uniqueStrategies, focusedStrategyId]
  );

  const displaySummary = useMemo(() => {
    if (!focusedStrategyId || viewMode !== "focus") return data?.summary;
    return {
      totalStrategies: 1,
      totalGoals: focusedLayerItems.goal?.length ?? 0,
      totalObjectives: focusedLayerItems.objective?.length ?? 0,
      totalInitiatives: focusedLayerItems.initiative?.length ?? 0,
      totalOkrs: focusedLayerItems.okr?.length ?? 0,
      totalKpis: focusedLayerItems.kpi?.length ?? 0,
      totalGovernance: focusedLayerItems.governance?.length ?? 0,
    };
  }, [data?.summary, focusedStrategyId, focusedLayerItems, viewMode]);

  const handleCellClick = (entityType: string, entity: unknown) => {
    if (entity) {
      setSelectedEntity({ type: entityType, entity: entity as Record<string, unknown> });
      setDetailOpen(true);
      onCellClick?.(entityType, entity);
    }
  };

  const handleFocusStrategy = (strategyId: number) => {
    setFocusedStrategyId(strategyId);
    setViewMode("focus");
  };

  const toggleLayerCollapse = (key: string) => {
    setCollapsedLayers(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Jiganto Business Strategy — Import Template"],
      [""],
      ["INSTRUCTIONS"],
      ["1. Fill in each sheet with your data. Each row is one item."],
      ["2. Leave the Code column as-is in examples; on import use your own codes for cross-sheet linking."],
      ["3. Link child items to parents using the Code from the parent sheet (e.g. enter S01 in Strategy Code column of Goals)."],
      ["4. RAG Status valid values: On Track | At Risk | Behind"],
      ["5. Progress: integer 0–100"],
      ["6. Dates: YYYY-MM-DD (e.g. 2026-12-31)"],
      ["7. Priority (Initiatives/Governance): low | medium | high | critical"],
      [""],
      ["Sheets: Strategies → Goals → Objectives → Initiatives → OKRs → KPIs → Governance"],
    ]), "Instructions");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Code", "Title", "Description", "Owner Name", "Department", "RAG Status", "Progress %", "Target Date"],
      ["S01", "Market Leadership", "Grow market share to 25% by 2027", "Sarah Blackwell", "Sales & Marketing", "On Track", 55, "2027-12-31"],
      ["S02", "Delivery Excellence", "Achieve NPS > 70 across all clients", "Ayesha Nawaz", "Professional Services", "On Track", 68, "2026-12-31"],
    ]), "Strategies");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Code", "Strategy Code", "Title", "Description", "Owner Name", "Department", "RAG Status", "Progress %", "Target Date"],
      ["G01", "S01", "Revenue Growth", "Achieve £12M ARR by year-end", "James Cole", "Sales & Marketing", "On Track", 60, "2026-12-31"],
      ["G02", "S01", "Market Expansion", "Enter 3 new industry verticals", "Lisa Park", "Sales & Marketing", "At Risk", 40, "2026-06-30"],
    ]), "Goals");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Code", "Goal Code", "Title", "Description", "Owner Name", "RAG Status", "Progress %", "Target Date"],
      ["O01", "G01", "Close 20 new enterprise deals", "Win 20 deals > £50K in 2026", "Tom Hughes", "On Track", 55, "2026-12-31"],
      ["O02", "G01", "Reduce average sales cycle by 30%", "From 90 days to 63 days average", "Lisa Park", "At Risk", 30, "2026-09-30"],
    ]), "Objectives");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Code", "Objective Code", "Title", "Description", "Owner Name", "Department", "RAG Status", "Priority", "Progress %", "Start Date", "End Date"],
      ["I01", "O01", "Enterprise Sales Campaign", "Targeted outreach to F500 companies", "Tom Hughes", "Sales & Marketing", "On Track", "high", 65, "2026-01-01", "2026-12-31"],
      ["I02", "O02", "CRM Automation", "Implement Salesforce CPQ to reduce manual steps", "Lisa Park", "Technology", "At Risk", "medium", 30, "2026-03-01", "2026-09-30"],
    ]), "Initiatives");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Code", "Objective Code", "Title", "Key Result Description", "Owner Name", "RAG Status", "Target Date"],
      ["K01", "O01", "Win Rate OKR", "Increase win rate from 22% to 35%", "Tom Hughes", "On Track", "2026-12-31"],
      ["K02", "O02", "Sales Cycle OKR", "Reduce average sales cycle to 63 days", "Lisa Park", "At Risk", "2026-09-30"],
    ]), "OKRs");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Code", "Goal Code", "Name", "Description", "Owner Name", "KPI Type", "Current Value", "Target Value", "Unit", "RAG Status", "Target Date"],
      ["P01", "G01", "Monthly Recurring Revenue", "Track MRR growth month-on-month", "Sarah Blackwell", "Financial", "3.2", "4.2", "£M", "On Track", "2026-12-31"],
      ["P02", "G02", "New Verticals Entered", "Count of new industry verticals added", "James Cole", "Count", "1", "3", "verticals", "At Risk", "2026-12-31"],
    ]), "KPIs");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Code", "Strategy Code", "Title", "Type", "Description", "Owner Name", "RAG Status", "Status", "Progress %", "Target Date"],
      ["GV01", "S01", "Board Q1 Review", "board_decision", "Quarterly board strategy review", "Sarah Blackwell", "On Track", "active", 100, "2026-03-31"],
      ["GV02", "S02", "Compliance Audit", "policy", "Annual compliance policy review", "Ayesha Nawaz", "On Track", "active", 50, "2026-06-30"],
    ]), "Governance");

    XLSX.writeFile(wb, "Jiganto_Strategy_Template.xlsx");
    toast({ title: "Template downloaded", description: "Fill in each sheet and use Import to load your data." });
  };

  const handleExportCurrentData = () => {
    if (!data?.rows || data.rows.length === 0) {
      toast({ title: "No data to export", description: "Load some data first.", variant: "destructive" });
      return;
    }
    const wb = XLSX.utils.book_new();
    const ragLabel = (r: string) => r === "green" ? "On Track" : r === "amber" ? "At Risk" : r === "red" ? "Behind" : r || "";

    const stratsMap = new Map<number, StrategyEntity>();
    const goalsMap = new Map<number, StrategyEntity & { _sCode?: string }>();
    const objectivesMap = new Map<number, StrategyEntity & { _gCode?: string }>();
    const initiativesMap = new Map<number, StrategyEntity & { _oCode?: string }>();
    const okrsMap = new Map<number, StrategyEntity & { _oCode?: string }>();
    const kpisMap = new Map<number, StrategyEntity & { _gCode?: string }>();
    const govMap = new Map<number, StrategyEntity & { _sCode?: string }>();

    data.rows.forEach(row => {
      if (row.strategy) stratsMap.set(row.strategy.id, row.strategy);
      if (row.goal) goalsMap.set(row.goal.id, { ...row.goal, _sCode: row.strategy ? `S${String(row.strategy.id).padStart(2, "0")}` : "" });
      if (row.objective) objectivesMap.set(row.objective.id, { ...row.objective, _gCode: row.goal ? `G${String(row.goal.id).padStart(2, "0")}` : "" });
      if (row.initiative) initiativesMap.set(row.initiative.id, { ...row.initiative, _oCode: row.objective ? `O${String(row.objective.id).padStart(2, "0")}` : "" });
      if (row.okr) okrsMap.set(row.okr.id, { ...row.okr, _oCode: row.objective ? `O${String(row.objective.id).padStart(2, "0")}` : "" });
      if (row.kpi) kpisMap.set(row.kpi.id, { ...row.kpi, _gCode: row.goal ? `G${String(row.goal.id).padStart(2, "0")}` : "" });
      if (row.governance) govMap.set(row.governance.id, { ...row.governance, _sCode: row.strategy ? `S${String(row.strategy.id).padStart(2, "0")}` : "" });
    });

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Code", "Title", "Description", "Owner Name", "Department", "RAG Status", "Progress %", "Target Date"],
      ...[...stratsMap.values()].map((s, i) => [`S${String(i + 1).padStart(2, "0")}`, getEntityTitle(s), s.description || "", getOwner(s) || "", s.departmentName || "", ragLabel(s.ragStatus || ""), s.progress ?? "", s.targetDate || ""]),
    ]), "Strategies");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Code", "Strategy Code", "Title", "Description", "Owner Name", "Department", "RAG Status", "Progress %", "Target Date"],
      ...[...goalsMap.values()].map((g, i) => [`G${String(i + 1).padStart(2, "0")}`, (g as StrategyEntity & { _sCode?: string })._sCode || "", getEntityTitle(g), g.description || "", getOwner(g) || "", g.departmentName || "", ragLabel(g.ragStatus || ""), g.progress ?? "", g.targetDate || ""]),
    ]), "Goals");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Code", "Goal Code", "Title", "Description", "Owner Name", "RAG Status", "Progress %", "Target Date"],
      ...[...objectivesMap.values()].map((o, i) => [`O${String(i + 1).padStart(2, "0")}`, (o as StrategyEntity & { _gCode?: string })._gCode || "", getEntityTitle(o), o.description || "", getOwner(o) || "", ragLabel(o.ragStatus || ""), o.progress ?? "", o.targetDate || ""]),
    ]), "Objectives");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Code", "Objective Code", "Title", "Description", "Owner Name", "Department", "RAG Status", "Priority", "Progress %", "Start Date", "End Date"],
      ...[...initiativesMap.values()].map((ini, i) => [`I${String(i + 1).padStart(2, "0")}`, (ini as StrategyEntity & { _oCode?: string })._oCode || "", getEntityTitle(ini), ini.description || "", getOwner(ini) || "", ini.departmentName || "", ragLabel(ini.ragStatus || ""), ini.priority || "", ini.progress ?? "", (ini as StrategyEntity & { startDate?: string }).startDate || "", (ini as StrategyEntity & { dueDate?: string; endDate?: string }).dueDate || (ini as StrategyEntity & { endDate?: string }).endDate || ""]),
    ]), "Initiatives");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Code", "Objective Code", "Title", "Key Result Description", "Owner Name", "RAG Status", "Target Date"],
      ...[...okrsMap.values()].map((o, i) => [`K${String(i + 1).padStart(2, "0")}`, (o as StrategyEntity & { _oCode?: string })._oCode || "", getEntityTitle(o), o.description || "", getOwner(o) || "", ragLabel(o.ragStatus || ""), o.targetDate || ""]),
    ]), "OKRs");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Code", "Goal Code", "Name", "Description", "Owner Name", "KPI Type", "Current Value", "Target Value", "Unit", "RAG Status", "Target Date"],
      ...[...kpisMap.values()].map((k, i) => [`P${String(i + 1).padStart(2, "0")}`, (k as StrategyEntity & { _gCode?: string })._gCode || "", k.name || getEntityTitle(k), k.description || "", getOwner(k) || "", (k as StrategyEntity & { kpiType?: string }).kpiType || "", (k as StrategyEntity & { currentValue?: unknown }).currentValue ?? "", (k as StrategyEntity & { targetValue?: unknown }).targetValue ?? "", (k as StrategyEntity & { unit?: string }).unit || "", ragLabel(k.ragStatus || ""), k.targetDate || ""]),
    ]), "KPIs");

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Code", "Strategy Code", "Title", "Type", "Description", "Owner Name", "RAG Status", "Status", "Progress %", "Target Date"],
      ...[...govMap.values()].map((g, i) => [`GV${String(i + 1).padStart(2, "0")}`, (g as StrategyEntity & { _sCode?: string })._sCode || "", getEntityTitle(g), (g as StrategyEntity & { govType?: string }).govType || "", g.description || "", getOwner(g) || "", ragLabel(g.ragStatus || ""), g.status || "", g.progress ?? "", g.targetDate || ""]),
    ]), "Governance");

    XLSX.writeFile(wb, `strategy-map-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ title: "Export complete", description: `Exported data across 7 sheets.` });
  };

  const BUSINESS_IMPORT_QUERY_KEYS = [
    "/api/business/strategy-map",
    "/api/business/strategy",
    "/api/business/goals",
    "/api/business/objectives",
    "/api/business/initiatives",
    "/api/business/okrs",
    "/api/business/kpis",
    "/api/business/governance",
    "/api/business/entity-refs",
  ];

  const importMutation = useMutation({
    mutationFn: async (rows: Record<string, unknown>[]) => {
      const res = await apiRequest("POST", "/api/business/bulk-import", { rows });
      return res.json() as Promise<{ created?: Record<string, number>; skipped?: number }>;
    },
    onSuccess: (data: { created?: Record<string, number>; skipped?: number }) => {
      BUSINESS_IMPORT_QUERY_KEYS.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      const total = Object.values(data?.created ?? {}).reduce((a, b) => a + b, 0);
      toast({
        title: "Import complete",
        description: total > 0
          ? `Imported ${total} record(s)${data?.skipped ? ` (${data.skipped} skipped)` : ""}.`
          : "No records were imported. Check sheet names and required Title/Name columns.",
        variant: total > 0 ? "default" : "destructive",
      });
    },
    onError: () => toast({ title: "Import failed", description: "Could not persist rows. Check console for details.", variant: "destructive" }),
  });

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const allRows: Record<string, unknown>[] = [];
        for (const sheetName of wb.SheetNames) {
          if (sheetName.toLowerCase() === "instructions") continue;
          const sheet = wb.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
          for (const row of rows) {
            allRows.push({ _sheet: sheetName, ...row });
          }
        }
        if (allRows.length === 0) {
          toast({ title: "Empty file", description: "No data rows found in the file.", variant: "destructive" });
        } else {
          importMutation.mutate(allRows);
          toast({ title: `Importing ${allRows.length} rows…`, description: `Sheets: ${wb.SheetNames.join(", ")}` });
        }
      } catch {
        toast({ title: "Parse error", description: "Could not read the file. Please use .xlsx or .csv format.", variant: "destructive" });
      }
      if (importFileRef.current) importFileRef.current.value = "";
    };
    reader.readAsBinaryString(file);
    setImportDialogOpen(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="strategy-map-loading">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3">
          {STRATEGY_LAYERS.map(l => <Skeleton key={l.key} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-10 w-full" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    );
  }

  const RAG_PILLS: { value: RagFilter; label: string; dot: string }[] = [
    { value: "all", label: "All", dot: "" },
    { value: "green", label: "On Track", dot: "bg-green-500" },
    { value: "amber", label: "At Risk", dot: "bg-amber-500" },
    { value: "red", label: "Behind", dot: "bg-red-500" },
  ];

  return (
    <div className="space-y-3 sm:space-y-4 w-full min-w-0 max-w-full" data-testid="strategy-map">
      {isFetching && !isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Refreshing map…
        </div>
      )}

      {/* Stats Strip — dynamic when strategy is focused */}
      {displaySummary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-3" data-testid="stats-strip">
          {STRATEGY_LAYERS.map(layer => {
            const count = displaySummary[layer.summaryKey] ?? 0;
            const isActive = activeLayer === layer.key;
            const Icon = layer.icon;
            return (
              <button
                key={layer.key}
                onClick={() => setActiveLayer(isActive ? null : layer.key)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-all duration-200 cursor-pointer",
                  isActive
                    ? cn(layer.bg, layer.border, "shadow-sm scale-[1.02]")
                    : "bg-card border-border hover:bg-muted/50 hover:border-muted-foreground/20"
                )}
                data-testid={`stat-${layer.key}`}
              >
                <div className={cn("flex items-center gap-1.5 mb-1.5", layer.text)}>
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{layer.label}</span>
                </div>
                <div className="text-2xl font-extrabold text-foreground tracking-tight">{count}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {focusedStrategy && layer.key !== "strategy" ? "in focus" : "items"}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Strategy Focus Banner */}
      {focusedStrategy && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-700/30">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#a855f7" }}>
            <Target className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold text-purple-700 dark:text-purple-300">Strategy Focus: </span>
            <span className="text-xs text-purple-800 dark:text-purple-200 font-semibold truncate">{getEntityTitle(focusedStrategy)}</span>
            <span className="text-xs text-purple-500 dark:text-purple-400 ml-2">— showing all linked sub-components</span>
          </div>
          <button
            onClick={() => setFocusedStrategyId(null)}
            className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 border border-purple-300 dark:border-purple-600 rounded-full px-3 py-1 hover:bg-purple-100 dark:hover:bg-purple-800/30 transition-colors shrink-0"
            data-testid="button-clear-strategy-focus"
          >
            <X className="h-3 w-3" /> Clear filter
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-row items-center justify-between gap-2 overflow-x-auto flex-nowrap pb-1">
        <div className="flex items-center gap-2 flex-nowrap shrink-0">
          <div className="relative flex-1 sm:flex-none min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search across all layers..."
              className="pl-9 w-full sm:w-[220px] rounded-lg"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              data-testid="input-strategy-map-search"
            />
          </div>

          {/* RAG filter pills */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            {RAG_PILLS.map(p => (
              <button
                key={p.value}
                onClick={() => setRagFilter(p.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors border-r border-border last:border-r-0",
                  ragFilter === p.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                data-testid={`rag-filter-${p.value}`}
              >
                {p.dot && <span className={cn("w-2 h-2 rounded-full", p.dot)} />}
                {p.label}
              </button>
            ))}
          </div>

          {data?.departments && data.departments.length > 0 && (
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-department-filter">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {data.departments.map(d => (
                  <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {uniqueOwners.length > 0 && (
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-owner-filter">
                <User className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue placeholder="Owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Owners</SelectItem>
                {uniqueOwners.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 flex-nowrap">
          {viewMode === "table" && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={tableGroupBy !== "none" ? "secondary" : "outline"}
                    size="icon"
                    className={cn(
                      "h-8 w-8 shrink-0",
                      tableGroupBy !== "none" && "bg-[#0ea5e9]/10 border-[#0ea5e9]/30 text-[#0ea5e9] hover:bg-[#0ea5e9]/20"
                    )}
                    title={tableGroupBy === "none" ? "Group rows" :
                      tableGroupBy === "rag" ? "Grouped by RAG" :
                      tableGroupBy === "department" ? "Grouped by department" : "Grouped by owner"}
                    data-testid="button-table-group-by"
                  >
                    <Layers className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  <DropdownMenuItem onClick={() => setTableGroupBy("none")} data-testid="table-group-none">
                    None
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTableGroupBy("rag")} data-testid="table-group-rag">
                    RAG Status
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTableGroupBy("department")} data-testid="table-group-department">
                    Department
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTableGroupBy("owner")} data-testid="table-group-owner">
                    Owner
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="flex items-center gap-2 mr-1 border border-border/60 rounded-md px-2.5 py-1.5 bg-muted/30">
                <Switch
                  id="show-ids-toggle"
                  checked={showIds}
                  onCheckedChange={setShowIds}
                  className="scale-[0.8]"
                  data-testid="toggle-show-ids"
                />
                <Label htmlFor="show-ids-toggle" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap select-none">
                  Show Ref IDs
                </Label>
              </div>
            </>
          )}
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <SelectTrigger className="w-[160px] h-8 text-xs gap-1.5" data-testid="select-view-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="table">
                <span className="flex items-center gap-2"><Table2 className="h-3.5 w-3.5" /> Table</span>
              </SelectItem>
              <SelectItem value="cascade">
                <span className="flex items-center gap-2"><LayoutList className="h-3.5 w-3.5" /> Cascade</span>
              </SelectItem>
              <SelectItem value="focus">
                <span className="flex items-center gap-2"><Workflow className="h-3.5 w-3.5" /> Strategy Foci</span>
              </SelectItem>
              <SelectItem value="flow">
                <span className="flex items-center gap-2"><GitBranch className="h-3.5 w-3.5" /> Flow</span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            title="Import"
            onClick={() => setImportDialogOpen(true)}
            data-testid="button-import"
          >
            <Upload className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                title="Export"
                data-testid="button-export"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleDownloadTemplate} data-testid="menu-download-template">
                <Download className="h-3.5 w-3.5 mr-2" /> Download Template
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExportCurrentData} data-testid="menu-export-current">
                <FileText className="h-3.5 w-3.5 mr-2" /> Export Current Data
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Views */}
      {viewMode === "cascade" && (
        <CascadeView
          layers={STRATEGY_LAYERS}
          layerItems={layerItems}
          activeLayer={activeLayer}
          onCellClick={handleCellClick}
          onFocusStrategy={handleFocusStrategy}
        />
      )}
      {viewMode === "focus" && (
        <StrategyFocusView
          strategies={uniqueStrategies}
          focusedStrategy={focusedStrategy}
          focusedLayerItems={focusedLayerItems}
          subLayers={SUB_LAYERS}
          collapsedLayers={collapsedLayers}
          ragFilter={ragFilter}
          onSelectStrategy={(id) => setFocusedStrategyId(id)}
          onToggleLayer={toggleLayerCollapse}
          onCellClick={handleCellClick}
        />
      )}
      {viewMode === "flow" && (
        <FlowView
          strategies={uniqueStrategies}
          subLayers={SUB_LAYERS}
          focusedStrategyId={focusedStrategyId}
          focusedLayerItems={focusedLayerItems}
          ragFilter={ragFilter}
          onSelectStrategy={(id) => setFocusedStrategyId(id)}
          onCellClick={handleCellClick}
        />
      )}
      {viewMode === "table" && (
        <TableView rows={filteredRows} onCellClick={handleCellClick} showIds={showIds} groupBy={tableGroupBy} entityRefs={entityRefs} />
      )}

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Strategy Data</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Upload a CSV or Excel file to import strategy data. Download the template first to see the required format for each layer.
            </p>
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center space-y-3 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => importFileRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Click to upload or drag & drop</p>
                <p className="text-xs text-muted-foreground mt-1">Excel (.xlsx) or CSV files supported</p>
              </div>
              <input
                ref={importFileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleImportFile}
                data-testid="input-import-file"
              />
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
              <Download className="h-3.5 w-3.5 shrink-0" />
              <span>
                Don't have the template?{" "}
                <button
                  className="underline font-medium text-foreground"
                  onClick={() => { handleDownloadTemplate(); setImportDialogOpen(false); }}
                >
                  Download it here
                </button>
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EntityDetailPanel
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setSelectedEntity({ type: "", entity: null }); }}
        entityType={selectedEntity.type}
        entity={selectedEntity.entity}
      />
    </div>
  );
}

// ─── TABLE VIEW ───────────────────────────────────────────────────────────────

const TABLE_COLS = [
  { key: "strategy" as const, label: "Strategy", accent: "#a855f7" },
  { key: "goal" as const, label: "Goal", accent: "#3b82f6" },
  { key: "objective" as const, label: "Objective", accent: "#06b6d4" },
  { key: "initiative" as const, label: "Initiative", accent: "#f97316" },
  { key: "okr" as const, label: "OKR", accent: "#10b981" },
  { key: "kpi" as const, label: "KPI", accent: "#f59e0b" },
  { key: "governance" as const, label: "Governance", accent: "#8b5cf6" },
];

// Short reference code prefixes per layer  e.g. S-053, G-061
const REF_PREFIXES: Record<string, string> = {
  strategy:  "S",
  goal:      "G",
  objective: "OBJ",
  initiative:"INI",
  okr:       "OKR",
  kpi:       "KPI",
  governance: "GOV",
};
function refCode(colKey: string, id: number, entityRefs?: Record<string, number>): string {
  const prefix = REF_PREFIXES[colKey] ?? colKey.slice(0, 3).toUpperCase();
  const seq = entityRefs?.[`${colKey}-${id}`];
  return `${prefix}-${String(seq ?? id).padStart(3, "0")}`;
}

function TableView({ rows, onCellClick, showIds, groupBy = "none", entityRefs }: {
  rows: StrategyMapRow[];
  onCellClick: (entityType: string, entity: unknown) => void;
  showIds: boolean;
  groupBy?: "none" | "rag" | "department" | "owner";
  entityRefs?: Record<string, number>;
}) {
  type ColKey = "strategy" | "goal" | "objective" | "initiative" | "okr" | "kpi" | "governance";
  const colKeys: ColKey[] = ["strategy", "goal", "objective", "initiative", "okr", "kpi", "governance"];

  // Subtle alternating bg tints per strategy group
  const groupBgs = [
    { bg: "bg-purple-50/50 dark:bg-purple-950/25", stripe: "#a855f7" },
    { bg: "bg-sky-50/50 dark:bg-sky-950/25",       stripe: "#38bdf8" },
    { bg: "bg-indigo-50/50 dark:bg-indigo-950/25", stripe: "#818cf8" },
    { bg: "bg-emerald-50/50 dark:bg-emerald-950/25",stripe: "#34d399" },
    { bg: "bg-amber-50/50 dark:bg-amber-950/25",   stripe: "#fbbf24" },
    { bg: "bg-rose-50/50 dark:bg-rose-950/25",     stripe: "#fb7185" },
  ];

  const ragHeaderColors: Record<string, string> = {
    "🟢 On Track": "bg-green-50/80 dark:bg-green-950/30 border-green-300 dark:border-green-800 text-green-700 dark:text-green-400",
    "🟡 At Risk":  "bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400",
    "🔴 Behind":   "bg-red-50/80 dark:bg-red-950/30 border-red-300 dark:border-red-800 text-red-700 dark:text-red-400",
  };

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  useEffect(() => { setCollapsedGroups(new Set()); }, [groupBy]);
  const pagination = useTablePagination(rows, { resetKey: groupBy });

  const toggleGroup = (label: string) =>
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      return next;
    });

  const getGroupKey = (row: StrategyMapRow): string => {
    if (groupBy === "rag") {
      const rag = row.strategy?.ragStatus || row.worstRag;
      return rag === "green" ? "🟢 On Track" : rag === "amber" ? "🟡 At Risk" : rag === "red" ? "🔴 Behind" : "⚪ Unknown";
    }
    if (groupBy === "department") return row.strategy?.departmentName || "No Department";
    if (groupBy === "owner") return row.strategy?.ownerName || "Unassigned";
    return "";
  };

  type TableEntry =
    | { type: "header"; label: string; count: number; collapsed: boolean }
    | { type: "data"; row: StrategyMapRow; visIdx: number };

  // Build sorted rows + group metadata, then flat tableEntries respecting collapse
  const { tableEntries, visibleDataRows } = useMemo(() => {
    if (groupBy === "none") {
      const entries: TableEntry[] = pagination.paginatedItems.map((row, visIdx) => ({ type: "data", row, visIdx }));
      return { tableEntries: entries, visibleDataRows: pagination.paginatedItems };
    }
    const withKeys = pagination.paginatedItems.map(r => ({ row: r, key: getGroupKey(r) }));
    const groupOrder = Array.from(new Set(withKeys.map(x => x.key)));
    const counts = new Map<string, number>();
    groupOrder.forEach(k => counts.set(k, withKeys.filter(x => x.key === k).length));

    const entries: TableEntry[] = [];
    const visible: StrategyMapRow[] = [];
    for (const k of groupOrder) {
      const isCollapsed = collapsedGroups.has(k);
      entries.push({ type: "header", label: k, count: counts.get(k) ?? 0, collapsed: isCollapsed });
      if (!isCollapsed) {
        const groupRows = withKeys.filter(x => x.key === k).map(x => x.row);
        groupRows.forEach(row => {
          entries.push({ type: "data", row, visIdx: visible.length });
          visible.push(row);
        });
      }
    }
    return { tableEntries: entries, visibleDataRows: visible };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.paginatedItems, groupBy, collapsedGroups]);

  // Build ancestor key for span calculations on visible data rows only
  const ancestorKey = (row: StrategyMapRow, ci: number) =>
    colKeys.slice(0, ci + 1).map(k => String(row[k]?.id ?? "∅")).join("|");

  // Unique ordered strategy IDs for group index (based on visible rows)
  const strategyIds = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const r of visibleDataRows) {
      const k = String(r.strategy?.id ?? "∅");
      if (!seen.has(k)) { seen.add(k); order.push(k); }
    }
    return order;
  }, [visibleDataRows]);

  // Per-row/col: { show, span } — computed on visible data rows only
  const cellInfo = useMemo(() => visibleDataRows.map((row, i) =>
    colKeys.map((_, ci) => {
      const cur = ancestorKey(row, ci);
      const isGroupBoundary = groupBy !== "none" && i > 0
        && getGroupKey(visibleDataRows[i]) !== getGroupKey(visibleDataRows[i - 1]);
      const show = i === 0 || isGroupBoundary || cur !== ancestorKey(visibleDataRows[i - 1], ci);
      if (!show) return { show: false, span: 0 };
      let span = 1;
      for (let j = i + 1; j < visibleDataRows.length; j++) {
        if (groupBy !== "none" && getGroupKey(visibleDataRows[j]) !== getGroupKey(row)) break;
        if (ancestorKey(visibleDataRows[j], ci) === cur) span++; else break;
      }
      return { show: true, span };
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [visibleDataRows, groupBy]);

  return (
    <div className="rounded-xl border border-border bg-card w-full min-w-0 max-w-full" data-testid="table-view">
      <BusinessTableScroll minWidth={1200}>
        <table className="text-xs border-collapse w-max min-w-full table-auto">
          <thead>
            <tr className="border-b-2 border-border bg-muted/60">
              {TABLE_COLS.map(col => (
                <th
                  key={col.key}
                  className="px-3 py-2.5 text-left font-bold uppercase tracking-wider whitespace-nowrap"
                  style={{ color: col.accent }}
                >
                  {col.label}
                </th>
              ))}
              <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                RAG
              </th>
            </tr>
          </thead>
          <tbody>
            {tableEntries.length === 0 || (tableEntries.every(e => e.type === "header")) && visibleDataRows.length === 0 && rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  No data matches the current filters
                </td>
              </tr>
            ) : tableEntries.map((entry, ei) => {
              if (entry.type === "header") {
                return (
                  <tr key={`gh-${entry.label}`}>
                    <td
                      colSpan={8}
                      className={cn(
                        "px-4 py-0 border-b border-border/40 cursor-pointer select-none",
                        ei > 0 && "border-t-2 border-border",
                        ragHeaderColors[entry.label] ?? "bg-muted/60 text-muted-foreground"
                      )}
                      onClick={() => toggleGroup(entry.label)}
                      data-testid={`group-header-${entry.label}`}
                    >
                      <div className="flex items-center gap-2 py-2">
                        <span className="transition-transform duration-150" style={{ display: "inline-flex" }}>
                          {entry.collapsed
                            ? <ChevronRight className="h-3.5 w-3.5 opacity-70" />
                            : <ChevronDown className="h-3.5 w-3.5 opacity-70" />}
                        </span>
                        <Layers className="h-3.5 w-3.5 opacity-60" />
                        <span className="font-semibold text-xs uppercase tracking-wider">{entry.label}</span>
                        <span className="font-normal opacity-60 text-xs normal-case tracking-normal">
                          · {entry.count} item{entry.count !== 1 ? "s" : ""}
                          {entry.collapsed && <span className="ml-1 italic">(collapsed)</span>}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              }
              // data row
              const { row, visIdx } = entry;
              const prevDataEntry = tableEntries.slice(0, ei).reverse().find(e => e.type === "data");
              const prevRow = prevDataEntry?.type === "data" ? prevDataEntry.row : null;
              const isStrategyStart = !prevRow || prevRow.strategy?.id !== row.strategy?.id;
              const groupIdx = strategyIds.indexOf(String(row.strategy?.id ?? "∅"));
              const group = groupBgs[groupIdx % groupBgs.length];
              return (
                <tr
                  key={row.id}
                  className={cn(
                    group.bg,
                    "transition-colors hover:brightness-[0.97] dark:hover:brightness-110",
                    isStrategyStart ? "border-t border-border/40" : "border-t border-border/20"
                  )}
                >
                  {colKeys.map((key, ci) => {
                    const cell = cellInfo[visIdx]?.[ci];
                    if (!cell?.show) return null;
                    const entity = row[key] as StrategyEntity | null | undefined;
                    return (
                      <td
                        key={key}
                        rowSpan={cell.span > 1 ? cell.span : undefined}
                        className={cn(
                          "px-3 py-2 align-top min-w-[130px] max-w-[210px]",
                          ci < colKeys.length - 1 && "border-r border-border/20",
                          ci === 0 && "pl-[10px]"
                        )}
                        style={ci === 0 ? { borderLeft: `3px solid ${group.stripe}` } : undefined}
                      >
                        {entity ? (
                          <button
                            onClick={() => onCellClick(key, entity)}
                            className="text-left hover:underline font-medium text-foreground line-clamp-2 block w-full leading-snug"
                            data-testid={`table-cell-${key}-${entity.id}`}
                          >
                            {showIds && (
                              <span
                                className="block font-mono text-[9px] font-semibold tracking-widest mb-0.5 opacity-50"
                                style={{ color: TABLE_COLS[ci]?.accent }}
                              >
                                {refCode(key, entity.id, entityRefs)}
                              </span>
                            )}
                            {getEntityTitle(entity)}
                          </button>
                        ) : (
                          <span className="text-muted-foreground/25 select-none text-[10px]">—</span>
                        )}
                        {entity && getOwner(entity) && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className={cn(
                              "w-1.5 h-1.5 rounded-full inline-block shrink-0",
                              ragDots[(entity as StrategyEntity).ragStatus || ""] || "bg-muted-foreground/30"
                            )} />
                            <span className="text-[10px] text-muted-foreground truncate">{getOwner(entity)}</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 whitespace-nowrap align-top">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full",
                      row.worstRag === "green" ? "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400" :
                      row.worstRag === "amber" ? "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400" :
                      row.worstRag === "red"   ? "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400" :
                      "bg-muted text-muted-foreground"
                    )}>
                      <span className={cn("w-1.5 h-1.5 rounded-full inline-block", ragDots[row.worstRag] || "bg-muted-foreground")} />
                      {row.worstRag === "green" ? "On Track" : row.worstRag === "amber" ? "At Risk" : row.worstRag === "red" ? "Behind" : row.worstRag || "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </BusinessTableScroll>
      <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {strategyIds.length} strateg{strategyIds.length !== 1 ? "ies" : "y"} · {visibleDataRows.length} row{visibleDataRows.length !== 1 ? "s" : ""}
        </span>
        <span className="text-xs text-muted-foreground">Click any cell to open details</span>
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
      />
    </div>
  );
}

// ─── STRATEGY CARD ───────────────────────────────────────────────────────────

interface StrategyCardProps {
  entity: StrategyEntity;
  layer: typeof STRATEGY_LAYERS[number];
  onClick: () => void;
  onFocusStrategy?: () => void;
}

function StrategyCard({ entity, layer, onClick, onFocusStrategy }: StrategyCardProps) {
  const title = getEntityTitle(entity);
  const owner = getOwner(entity);
  const rag = entity.ragStatus || "green";
  const progress = entity.progress;
  const targetDate = entity.targetDate || entity.dueDate || entity.endDate;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "group relative rounded-lg border bg-card p-3 text-left transition-all duration-150 w-full",
            "hover:shadow-md hover:border-muted-foreground/30 hover:-translate-y-0.5 cursor-pointer",
            "active:translate-y-0 active:shadow-sm overflow-hidden"
          )}
          data-testid={`card-${layer.key}-${entity.id}`}
        >
          <div className="absolute top-0 left-0 bottom-0 w-[3px] rounded-l-lg" style={{ background: layer.accent }} />
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-semibold text-foreground line-clamp-2 flex-1">{title}</span>
            <div className={cn("w-2 h-2 rounded-full mt-1 shrink-0", ragDots[rag] || "bg-muted")} />
          </div>
          {(owner || (progress !== null && progress !== undefined)) && (
            <div className="flex items-center justify-between mt-2 gap-2">
              {owner && (
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                    style={{ background: layer.accent }}>
                    {getInitials(owner)}
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{owner}</span>
                </div>
              )}
              {progress !== null && progress !== undefined && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-12 bg-muted rounded-full h-1">
                    <div className={cn("h-1 rounded-full", ragDots[rag] || "bg-muted-foreground")}
                      style={{ width: `${Math.min(100, progress)}%` }} />
                  </div>
                  <span className="text-[9px] text-muted-foreground">{progress}%</span>
                </div>
              )}
            </div>
          )}
          {entity.departmentName && (
            <div className="flex items-center gap-1 mt-1.5">
              <Building2 className="h-2.5 w-2.5 text-muted-foreground/60 shrink-0" />
              <span className="text-[9px] text-muted-foreground/70 truncate">{entity.departmentName}</span>
            </div>
          )}
          {/* "View full cascade" link on strategy cards — div avoids nested <button> */}
          {onFocusStrategy && (
            <div className="mt-2 pt-2 border-t border-border/50">
              <div
                role="button"
                tabIndex={0}
                onClick={e => { e.stopPropagation(); onFocusStrategy(); }}
                onKeyDown={e => e.key === "Enter" && onFocusStrategy()}
                className="text-[10px] font-semibold flex items-center gap-1 hover:underline cursor-pointer w-fit"
                style={{ color: layer.accent }}
                data-testid={`link-focus-strategy-${entity.id}`}
              >
                View full cascade <ChevronRight className="h-3 w-3" />
              </div>
            </div>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[280px] p-3">
        <div className="space-y-1.5">
          <p className="font-semibold text-sm">{title}</p>
          <Badge variant="outline" className={cn("text-[10px]", ragColors[rag])}>{rag.toUpperCase()}</Badge>
          {entity.description && (
            <div className="flex items-start gap-1.5 text-xs">
              <FileText className="h-3 w-3 mt-0.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground line-clamp-2">{entity.description}</span>
            </div>
          )}
          {owner && (
            <div className="flex items-center gap-1.5 text-xs">
              <User className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Owner: <span className="text-foreground">{owner}</span></span>
            </div>
          )}
          {targetDate && (
            <div className="flex items-center gap-1.5 text-xs">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Target: <span className="text-foreground">{formatDate(targetDate)}</span></span>
            </div>
          )}
          {progress !== null && progress !== undefined && (
            <div className="flex items-center gap-2 text-xs">
              <div className="w-full bg-muted rounded-full h-1.5">
                <div className={cn("h-1.5 rounded-full", ragDots[rag] || "bg-muted-foreground")}
                  style={{ width: `${Math.min(100, progress)}%` }} />
              </div>
              <span className="text-muted-foreground shrink-0">{progress}%</span>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ─── CASCADE VIEW ─────────────────────────────────────────────────────────────

interface CascadeViewProps {
  layers: typeof STRATEGY_LAYERS;
  layerItems: Record<string, StrategyEntity[]>;
  activeLayer: string | null;
  onCellClick: (entityType: string, entity: unknown) => void;
  onFocusStrategy: (id: number) => void;
}

function CascadeView({ layers, layerItems, activeLayer, onCellClick, onFocusStrategy }: CascadeViewProps) {
  return (
    <div className="space-y-1" data-testid="cascade-view">
      {layers.map((layer, li) => {
        const items = layerItems[layer.key] || [];
        const isActive = !activeLayer || activeLayer === layer.key;
        const indent = li * 20;
        const Icon = layer.icon;

        return (
          <div
            key={layer.key}
            className="transition-opacity duration-200"
            style={{ marginLeft: indent, opacity: isActive ? 1 : 0.3 }}
            data-testid={`cascade-layer-${layer.key}`}
          >
            <div className="flex items-center gap-2.5 px-3 py-2 mb-1.5">
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", layer.bg, layer.border, "border")}>
                <Icon className={cn("h-3.5 w-3.5", layer.text)} />
              </div>
              <span className={cn("text-[10px] font-extrabold uppercase tracking-[0.1em]", layer.text)}>
                {layer.label}
              </span>
              <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${layer.accent}40, transparent)` }} />
              <span className="text-[10px] text-muted-foreground">{items.length} items</span>
            </div>

            {items.length === 0 ? (
              <div className="px-4 py-3 text-xs text-muted-foreground/60 italic">No items</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 px-2 pb-3">
                {items.map(item => (
                  <StrategyCard
                    key={item.id}
                    entity={item}
                    layer={layer}
                    onClick={() => onCellClick(layer.key, item)}
                    onFocusStrategy={layer.key === "strategy" ? () => onFocusStrategy(item.id) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── STRATEGY FOCUS VIEW ──────────────────────────────────────────────────────

interface StrategyFocusViewProps {
  strategies: StrategyEntity[];
  focusedStrategy: StrategyEntity | null;
  focusedLayerItems: Record<string, StrategyEntity[]>;
  subLayers: typeof SUB_LAYERS;
  collapsedLayers: Set<string>;
  ragFilter: RagFilter;
  onSelectStrategy: (id: number) => void;
  onToggleLayer: (key: string) => void;
  onCellClick: (entityType: string, entity: unknown) => void;
}

function StrategyFocusView({
  strategies, focusedStrategy, focusedLayerItems, subLayers,
  collapsedLayers, ragFilter, onSelectStrategy, onToggleLayer, onCellClick
}: StrategyFocusViewProps) {
  return (
    <div className="flex gap-0 rounded-xl border border-border overflow-hidden" style={{ minHeight: 520 }} data-testid="focus-view">
      {/* Left panel — strategy list */}
      <div className="w-64 shrink-0 border-r border-border bg-muted/20 flex flex-col">
        <div className="px-3 py-2.5 border-b border-border">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Strategies ({strategies.length})
          </p>
        </div>
        <ScrollArea className="flex-1">
          {strategies.map(s => {
            const rag = s.ragStatus || "green";
            const owner = getOwner(s);
            const progress = s.progress ?? 0;
            const isActive = s.id === focusedStrategy?.id;
            return (
              <button
                key={s.id}
                onClick={() => onSelectStrategy(s.id)}
                className={cn(
                  "w-full text-left px-3 py-3 border-b border-border/50 transition-colors relative",
                  isActive
                    ? "bg-purple-50 dark:bg-purple-900/20"
                    : "hover:bg-muted/50"
                )}
                data-testid={`focus-strategy-${s.id}`}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r" style={{ background: "#a855f7" }} />
                )}
                <div className={cn("text-xs font-semibold leading-tight mb-2", isActive ? "text-purple-800 dark:text-purple-200" : "text-foreground")}>
                  {getEntityTitle(s)}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  {owner && (
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0"
                        style={{ background: "#a855f7" }}>
                        {getInitials(owner)}
                      </div>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{owner}</span>
                    </div>
                  )}
                  <div className="ml-auto">
                    <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0", ragColors[rag])}>
                      {getRagLabel(rag)}
                    </Badge>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-muted rounded-full h-1">
                  <div
                    className={cn("h-1 rounded-full", ragDots[rag])}
                    style={{ width: `${Math.min(100, progress)}%` }}
                  />
                </div>
              </button>
            );
          })}
        </ScrollArea>
      </div>

      {/* Right panel — strategy detail */}
      <div className="flex-1 overflow-hidden">
        {!focusedStrategy ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-purple-50 dark:bg-purple-900/20">
              <Workflow className="h-8 w-8 text-purple-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">Select a strategy to see its full cascade</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Click any strategy in the list to drill into its Goals → Objectives → Initiatives → OKRs → KPIs → Governance
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="p-5">
              {/* Strategy header card */}
              <div className="rounded-xl border border-purple-200 dark:border-purple-700/30 bg-purple-50/50 dark:bg-purple-900/10 p-4 mb-5">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-purple-500">◎ Strategy</span>
                    </div>
                    <h3 className="text-base font-bold text-foreground mb-2 leading-tight">{getEntityTitle(focusedStrategy)}</h3>
                    <div className="flex items-center flex-wrap gap-3">
                      {getOwner(focusedStrategy) && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                            style={{ background: "#a855f7" }}>
                            {getInitials(getOwner(focusedStrategy)!)}
                          </div>
                          <span className="text-xs text-muted-foreground">{getOwner(focusedStrategy)}</span>
                        </div>
                      )}
                      <Badge variant="outline" className={cn("text-[10px]", ragColors[focusedStrategy.ragStatus || "green"])}>
                        {getRagLabel(focusedStrategy.ragStatus || "green")}
                      </Badge>
                      {focusedStrategy.progress !== null && focusedStrategy.progress !== undefined && (
                        <span className="text-[10px] text-muted-foreground font-semibold">{focusedStrategy.progress}% complete</span>
                      )}
                    </div>
                    {focusedStrategy.description && (
                      <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-2">{focusedStrategy.description}</p>
                    )}
                  </div>
                  {/* KPI summary */}
                  <div className="flex gap-2 shrink-0">
                    {(() => {
                      const allItems = Object.values(focusedLayerItems).flat();
                      const g = allItems.filter(i => (i.ragStatus || "green") === "green").length;
                      const a = allItems.filter(i => i.ragStatus === "amber").length;
                      const r = allItems.filter(i => i.ragStatus === "red").length;
                      return [
                        { label: "Linked", val: allItems.length, color: "text-foreground" },
                        { label: "On Track", val: g, color: "text-green-600 dark:text-green-400" },
                        { label: "At Risk", val: a, color: "text-amber-600 dark:text-amber-400" },
                        { label: "Behind", val: r, color: "text-red-600 dark:text-red-400" },
                      ].map(k => (
                        <div key={k.label} className="text-center bg-background border border-border rounded-lg px-3 py-2 min-w-[52px]">
                          <div className={cn("text-lg font-extrabold", k.color)}>{k.val}</div>
                          <div className="text-[9px] text-muted-foreground mt-0.5">{k.label}</div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>

              {/* Layer sections */}
              <div className="space-y-3">
                {subLayers.map((layer, li) => {
                  const items = focusedLayerItems[layer.key] || [];
                  const isCollapsed = collapsedLayers.has(layer.key);
                  const Icon = layer.icon;
                  const g = items.filter(i => (i.ragStatus || "green") === "green").length;
                  const a = items.filter(i => i.ragStatus === "amber").length;
                  const r = items.filter(i => i.ragStatus === "red").length;

                  return (
                    <div key={layer.key} data-testid={`focus-layer-${layer.key}`}>
                      {/* Connector */}
                      {li > 0 && (
                        <div className="flex items-center gap-2 px-2 py-1 text-[10px] text-muted-foreground/50">
                          <span>↓</span><span>feeds into</span>
                          <div className="flex-1 h-px bg-border/50" />
                        </div>
                      )}
                      {/* Layer header */}
                      <button
                        onClick={() => onToggleLayer(layer.key)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-colors cursor-pointer",
                          layer.bg, layer.border,
                          "hover:opacity-90"
                        )}
                        data-testid={`focus-layer-header-${layer.key}`}
                      >
                        <div className="w-6 h-6 rounded flex items-center justify-center shrink-0" style={{ background: layer.accent }}>
                          <Icon className="h-3.5 w-3.5 text-white" />
                        </div>
                        <span className={cn("text-[10px] font-extrabold uppercase tracking-wider", layer.text)}>
                          {layer.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{items.length} item{items.length !== 1 ? "s" : ""}</span>
                        <div className="flex items-center gap-1.5 ml-2">
                          {g > 0 && <span className="flex items-center gap-1 text-[9px] font-semibold bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full">✓ {g}</span>}
                          {a > 0 && <span className="flex items-center gap-1 text-[9px] font-semibold bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full">⚠ {a}</span>}
                          {r > 0 && <span className="flex items-center gap-1 text-[9px] font-semibold bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-1.5 py-0.5 rounded-full">✕ {r}</span>}
                        </div>
                        <div className="ml-auto">
                          {isCollapsed
                            ? <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          }
                        </div>
                      </button>

                      {/* Layer items */}
                      {!isCollapsed && (
                        <div className="mt-2 ml-4 space-y-1.5">
                          {items.length === 0 ? (
                            <p className="text-xs text-muted-foreground/60 italic px-2 py-1">
                              No items in this layer for this strategy
                              {ragFilter !== "all" ? ` (with current filter)` : ""}
                            </p>
                          ) : (
                            items.map(item => {
                              const rag = item.ragStatus || "green";
                              const owner = getOwner(item);
                              const progress = item.progress;
                              const date = item.targetDate || item.dueDate || item.endDate;
                              return (
                                <button
                                  key={item.id}
                                  onClick={() => onCellClick(layer.key, item)}
                                  className="w-full flex items-center gap-3 bg-card border border-border rounded-lg px-3 py-2.5 text-left hover:shadow-sm hover:border-muted-foreground/30 transition-all relative overflow-hidden cursor-pointer"
                                  data-testid={`focus-item-${layer.key}-${item.id}`}
                                >
                                  <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg" style={{ background: layer.accent }} />
                                  <div className="flex-1 min-w-0">
                                    <span className="text-xs font-medium text-foreground leading-tight line-clamp-1 block">
                                      {getEntityTitle(item)}
                                    </span>
                                    {item.departmentName && (
                                      <span className="flex items-center gap-1 mt-0.5">
                                        <Building2 className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0" />
                                        <span className="text-[9px] text-muted-foreground/60 truncate">{item.departmentName}</span>
                                      </span>
                                    )}
                                  </div>
                                  {owner && (
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0"
                                        style={{ background: layer.accent }}>
                                        {getInitials(owner)}
                                      </div>
                                      <span className="text-[10px] text-muted-foreground hidden sm:block">{owner}</span>
                                    </div>
                                  )}
                                  {date && (
                                    <span className="text-[10px] text-muted-foreground font-mono shrink-0 hidden md:block">
                                      {formatDate(date)}
                                    </span>
                                  )}
                                  {progress !== null && progress !== undefined && (
                                    <div className="flex items-center gap-1.5 shrink-0 w-20">
                                      <div className="flex-1 bg-muted rounded-full h-1">
                                        <div className={cn("h-1 rounded-full", ragDots[rag])}
                                          style={{ width: `${Math.min(100, progress)}%` }} />
                                      </div>
                                      <span className="text-[9px] text-muted-foreground w-7 text-right">{progress}%</span>
                                    </div>
                                  )}
                                  <div className={cn("w-2 h-2 rounded-full shrink-0", ragDots[rag] || "bg-muted")} />
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

// ─── FLOW VIEW ────────────────────────────────────────────────────────────────

interface FlowViewProps {
  strategies: StrategyEntity[];
  subLayers: typeof SUB_LAYERS;
  focusedStrategyId: number | null;
  focusedLayerItems: Record<string, StrategyEntity[]>;
  ragFilter: RagFilter;
  onSelectStrategy: (id: number) => void;
  onCellClick: (entityType: string, entity: unknown) => void;
}

function FlowView({
  strategies, subLayers, focusedStrategyId, focusedLayerItems,
  ragFilter, onSelectStrategy, onCellClick
}: FlowViewProps) {
  const strategyLayer = STRATEGY_LAYERS[0];
  const StrategyIcon = strategyLayer.icon;

  return (
    <div className="flex gap-0 rounded-xl border border-border overflow-hidden" style={{ minHeight: 520 }} data-testid="flow-view">

      {/* ── Left panel: strategy selector ─────────────────────────── */}
      <div className="w-56 shrink-0 border-r border-border bg-muted/20 flex flex-col">
        <div className="px-3 py-2.5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className={cn("w-6 h-6 rounded-md flex items-center justify-center", strategyLayer.bg)}>
              <StrategyIcon className={cn("h-3.5 w-3.5", strategyLayer.text)} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Strategies
            </span>
            <span className="ml-auto text-[10px] text-muted-foreground">{strategies.length}</span>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {strategies.length === 0 && (
              <p className="text-xs text-muted-foreground/60 italic text-center py-6">No strategies</p>
            )}
            {strategies.map(s => {
              const rag = s.ragStatus || "green";
              const owner = getOwner(s);
              const isSelected = s.id === focusedStrategyId;
              return (
                <button
                  key={s.id}
                  onClick={() => onSelectStrategy(s.id)}
                  className={cn(
                    "w-full text-left rounded-lg px-2.5 py-2 transition-all relative overflow-hidden border",
                    isSelected
                      ? "bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-600 shadow-sm"
                      : "bg-background border-border hover:bg-muted/50 hover:border-muted-foreground/20"
                  )}
                  data-testid={`flow-strategy-${s.id}`}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg"
                    style={{ background: isSelected ? strategyLayer.accent : "transparent" }} />
                  <div className="pl-1.5">
                    <div className="flex items-start gap-1.5 mb-1">
                      <span className="text-[11px] font-semibold text-foreground line-clamp-2 flex-1 leading-tight">
                        {getEntityTitle(s)}
                      </span>
                      <div className={cn("w-2 h-2 rounded-full mt-0.5 shrink-0", ragDots[rag] || "bg-muted")} />
                    </div>
                    {owner && (
                      <div className="flex items-center gap-1">
                        <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[6px] font-bold text-white shrink-0"
                          style={{ background: strategyLayer.accent }}>
                          {getInitials(owner)}
                        </div>
                        <span className="text-[9px] text-muted-foreground truncate">{owner}</span>
                      </div>
                    )}
                    {s.progress !== null && s.progress !== undefined && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <div className="flex-1 bg-muted rounded-full h-1">
                          <div className={cn("h-1 rounded-full", ragDots[rag] || "bg-muted-foreground")}
                            style={{ width: `${Math.min(100, s.progress)}%` }} />
                        </div>
                        <span className="text-[8px] text-muted-foreground">{s.progress}%</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* ── Right panel: sub-layer columns ────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!focusedStrategyId ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
              <GitBranch className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Select a strategy</p>
            <p className="text-xs text-muted-foreground/60 max-w-[220px]">
              Click any strategy on the left to see its sub-components laid out as columns
            </p>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="flex gap-0 p-3 min-w-fit items-stretch" style={{ minHeight: 490 }}>
              {subLayers.map((layer, li) => {
                const items = focusedLayerItems[layer.key] || [];
                const isLast = li === subLayers.length - 1;
                const Icon = layer.icon;
                return (
                  <div key={layer.key} className="flex items-stretch" data-testid={`flow-col-${layer.key}`}>
                    <div className={cn("w-48 rounded-xl border p-2 flex flex-col", layer.bg, layer.border)}>
                      {/* Column header */}
                      <div className={cn("rounded-lg border px-2.5 py-2 mb-2 text-center", layer.border)}
                        style={{ background: `${layer.accent}18` }}>
                        <Icon className={cn("h-3.5 w-3.5 mx-auto mb-0.5", layer.text)} />
                        <div className={cn("text-[9px] font-extrabold uppercase tracking-[0.08em]", layer.text)}>
                          {layer.label}
                        </div>
                        <div className="text-base font-bold text-foreground mt-0.5">{items.length}</div>
                      </div>
                      {/* Cards */}
                      <div className="flex flex-col gap-1.5 flex-1">
                        {items.length === 0 ? (
                          <div className="flex-1 flex items-center justify-center">
                            <p className="text-[10px] text-muted-foreground/50 italic text-center px-2">
                              {ragFilter !== "all" ? "None match filter" : "No items"}
                            </p>
                          </div>
                        ) : (
                          items.map(item => {
                            const rag = item.ragStatus || "green";
                            const owner = getOwner(item);
                            const progress = item.progress;
                            return (
                              <button
                                key={item.id}
                                onClick={() => onCellClick(layer.key, item)}
                                className="bg-background/80 dark:bg-background/40 border border-border/60 rounded-lg p-2 text-left cursor-pointer hover:shadow-sm hover:border-muted-foreground/30 transition-all relative overflow-hidden"
                                data-testid={`flow-card-${layer.key}-${item.id}`}
                              >
                                <div className="absolute top-0 left-0 bottom-0 w-[3px] rounded-l-lg"
                                  style={{ background: layer.accent }} />
                                <div className="pl-1.5">
                                  <div className="flex items-start gap-1.5 mb-1">
                                    <span className="text-[11px] font-medium text-foreground line-clamp-2 flex-1 leading-tight">
                                      {getEntityTitle(item)}
                                    </span>
                                    <div className={cn("w-1.5 h-1.5 rounded-full mt-0.5 shrink-0", ragDots[rag] || "bg-muted")} />
                                  </div>
                                  {owner && (
                                    <div className="flex items-center gap-1 mb-0.5">
                                      <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[6px] font-bold text-white shrink-0"
                                        style={{ background: layer.accent }}>
                                        {getInitials(owner)}
                                      </div>
                                      <span className="text-[9px] text-muted-foreground truncate">{owner}</span>
                                    </div>
                                  )}
                                  {item.departmentName && (
                                    <div className="flex items-center gap-1 mb-1">
                                      <Building2 className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0" />
                                      <span className="text-[9px] text-muted-foreground/60 truncate">{item.departmentName}</span>
                                    </div>
                                  )}
                                  {progress !== null && progress !== undefined && (
                                    <div className="flex items-center gap-1">
                                      <div className="flex-1 bg-muted rounded-full h-1">
                                        <div className={cn("h-1 rounded-full", ragDots[rag])}
                                          style={{ width: `${Math.min(100, progress)}%` }} />
                                      </div>
                                      <span className="text-[8px] text-muted-foreground w-6 text-right">{progress}%</span>
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                    {!isLast && (
                      <div className="w-5 flex items-center justify-center shrink-0">
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/35" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
