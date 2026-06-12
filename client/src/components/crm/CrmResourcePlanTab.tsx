import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SubmitForm } from "@/components/ui/submit-form";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Plus, Download, Upload, Bell, X, Trash2, Calendar, Clock,
  LayoutList, CalendarDays, ChevronRight, Users, Briefcase,
  DollarSign, Target, TrendingUp, CheckCircle2, AlertTriangle,
  Scissors, MoreHorizontal, GripVertical, Loader2, FileText,
  CreditCard, ArrowLeft, Filter, Save, Building2, GitCompare, Copy
} from "lucide-react";
import { RateCardManager } from "./RateCardManager";
import { CapacityBoard } from "./CapacityBoard";
import { useCrmUsers } from "./CrmUsersProvider";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { TablePagination } from "@/components/TablePagination";

const PHASE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Discovery: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300", border: "border-blue-300 dark:border-blue-700" },
  Design: { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-800 dark:text-violet-300", border: "border-violet-300 dark:border-violet-700" },
  Build: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-800 dark:text-emerald-300", border: "border-emerald-300 dark:border-emerald-700" },
  UAT: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300", border: "border-amber-300 dark:border-amber-700" },
  "Go Live": { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-800 dark:text-red-300", border: "border-red-300 dark:border-red-700" },
  Hypercare: { bg: "bg-pink-100 dark:bg-pink-900/30", text: "text-pink-800 dark:text-pink-300", border: "border-pink-300 dark:border-pink-700" },
};

const EXTRA_PHASE_PALETTES = [
  { bg: "bg-cyan-100 dark:bg-cyan-900/30", text: "text-cyan-800 dark:text-cyan-300", border: "border-cyan-300 dark:border-cyan-700" },
  { bg: "bg-teal-100 dark:bg-teal-900/30", text: "text-teal-800 dark:text-teal-300", border: "border-teal-300 dark:border-teal-700" },
  { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-800 dark:text-orange-300", border: "border-orange-300 dark:border-orange-700" },
  { bg: "bg-lime-100 dark:bg-lime-900/30", text: "text-lime-800 dark:text-lime-300", border: "border-lime-300 dark:border-lime-700" },
  { bg: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-800 dark:text-indigo-300", border: "border-indigo-300 dark:border-indigo-700" },
  { bg: "bg-fuchsia-100 dark:bg-fuchsia-900/30", text: "text-fuchsia-800 dark:text-fuchsia-300", border: "border-fuchsia-300 dark:border-fuchsia-700" },
  { bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-800 dark:text-rose-300", border: "border-rose-300 dark:border-rose-700" },
  { bg: "bg-sky-100 dark:bg-sky-900/30", text: "text-sky-800 dark:text-sky-300", border: "border-sky-300 dark:border-sky-700" },
  { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-800 dark:text-yellow-300", border: "border-yellow-300 dark:border-yellow-700" },
  { bg: "bg-stone-100 dark:bg-stone-900/30", text: "text-stone-800 dark:text-stone-300", border: "border-stone-300 dark:border-stone-700" },
];

const dynamicPhaseColorMap: Record<string, { bg: string; text: string; border: string }> = {};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Open: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400" },
  Proposed: { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-400" },
  Tentative: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400" },
  Confirmed: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400" },
};

const DEFAULT_PHASES = ["Discovery", "Design", "Build", "UAT", "Go Live", "Hypercare"];
const STATUSES = ["Open", "Proposed", "Tentative", "Confirmed"];

function getPhaseColor(phase: string) {
  if (PHASE_COLORS[phase]) return PHASE_COLORS[phase];
  if (!dynamicPhaseColorMap[phase]) {
    const idx = Object.keys(dynamicPhaseColorMap).length % EXTRA_PHASE_PALETTES.length;
    dynamicPhaseColorMap[phase] = EXTRA_PHASE_PALETTES[idx];
  }
  return dynamicPhaseColorMap[phase];
}

function getBreakForWeek(r: ResourceRow, ws: Date): ResourceRow["breaks"][number] | null {
  const we = new Date(ws); we.setDate(we.getDate() + 6);
  return (r.breaks || []).find(b => {
    const bs = new Date(b.start), be = new Date(b.end);
    return ws.getTime() <= be.getTime() && we.getTime() >= bs.getTime();
  }) || null;
}

function normalizeDate(val: unknown): string {
  if (!val) return "";
  const s = String(val);
  const match = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function InlinePhaseEditor({ value, phases, onChange, testId }: {
  value: string; phases: string[]; onChange: (v: string) => void; testId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [custom, setCustom] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={custom}
        onChange={e => setCustom(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" && custom.trim()) {
            onChange(custom.trim());
            setEditing(false);
            setCustom("");
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setEditing(false);
            setCustom("");
            (e.target as HTMLInputElement).blur();
          }
        }}
        onBlur={() => {
          if (editing && custom.trim()) onChange(custom.trim());
          setEditing(false);
          setCustom("");
        }}
        placeholder="Type phase name, Enter to confirm"
        className="w-full px-2 py-1.5 text-xs font-semibold rounded border border-[#0ea5e9] bg-transparent outline-none"
        data-testid={`${testId}-custom`}
      />
    );
  }

  return (
    <select
      value={phases.includes(value) ? value : "__other__"}
      onChange={e => {
        if (e.target.value === "__other__") {
          setCustom(phases.includes(value) ? "" : value);
          setEditing(true);
        } else {
          onChange(e.target.value);
        }
      }}
      className="w-full px-2 py-1.5 text-xs font-semibold rounded border-transparent hover:border-border focus:border-[#0ea5e9] bg-transparent transition-colors outline-none"
      data-testid={testId}
    >
      {phases.map(p => <option key={p} value={p}>{p}</option>)}
      {!phases.includes(value) && <option value={value}>{value}</option>}
      <option value="__other__">Other (custom)...</option>
    </select>
  );
}

type ResourceRow = {
  id?: number;
  planId?: number;
  phase: string;
  roleName: string;
  resourceId: number | null;
  namedResourceLabel: string;
  startDate: string;
  endDate: string;
  daysPerWeek: number;
  dailyRate: number;
  discountPercent: number;
  status: string;
  sortOrder: number;
  breaks: Array<{ start: string; end: string; reason: string; notes: string }>;
  weekOverrides: Record<string, number>;
};

type Opportunity = {
  id: number;
  name: string;
  amount: string | null;
  probability: number | null;
  expectedCloseDate: string | null;
  ownerUserId: string | null;
  accountId: number | null;
  stageId: number | null;
};

type ResourcePlan = {
  id: number;
  opportunityId: number;
  planName: string | null;
  templateName: string | null;
  rateCardId: number | null;
  currency: string;
  notes: string | null;
  rows: ResourceRow[];
};

type RateCard = {
  id: number;
  name: string;
  currency: string;
  items: Array<{ id: number; roleName: string; dailyRate: string }>;
};

type Template = {
  id: number;
  name: string;
  phases: string[];
  rows: Array<{ phase: string; roleName: string; daysPerWeek: string; dailyRate: string | null; defaultDurationWeeks: number }>;
};

type ResourceEntry = {
  id: number;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  status: string;
};

type Account = {
  id: number;
  name: string;
};

type Stage = {
  id: number;
  name: string;
  color: string | null;
};

interface CrmResourcePlanTabProps {
  opportunities: Opportunity[];
  accounts?: Account[];
  stages?: Stage[];
}

function wksBetween(s: string, e: string): number {
  return Math.max(0, Math.round((new Date(e).getTime() - new Date(s).getTime()) / (7 * 86400000)));
}

function calcBreakDays(r: ResourceRow): number {
  let lost = 0;
  (r.breaks || []).forEach(b => {
    const bs = new Date(b.start), be = new Date(b.end), rs = new Date(r.startDate), re = new Date(r.endDate);
    const os = bs < rs ? rs : bs, oe = be > re ? re : be;
    if (os <= oe) lost += wksBetween(os.toISOString().slice(0, 10), oe.toISOString().slice(0, 10)) * r.daysPerWeek;
  });
  Object.values(r.weekOverrides || {}).forEach(v => { if (v === 0) lost += r.daysPerWeek; });
  return Math.round(lost);
}

function calcDays(r: ResourceRow): number {
  return Math.max(0, Math.round(wksBetween(r.startDate, r.endDate) * r.daysPerWeek) - calcBreakDays(r));
}

function calcCost(r: ResourceRow): number {
  return Math.round(calcDays(r) * r.dailyRate * (1 - (r.discountPercent || 0) / 100));
}

function fmtCurrency(n: number, currency = "GBP"): string {
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : "£";
  return sym + n.toLocaleString("en-GB");
}

function isInBreak(r: ResourceRow, ws: Date): boolean {
  const we = new Date(ws); we.setDate(we.getDate() + 6);
  return (r.breaks || []).some(b => {
    const bs = new Date(b.start), be = new Date(b.end);
    return ws.getTime() <= be.getTime() && we.getTime() >= bs.getTime();
  });
}

function getWeekStarts(startDate: string, endDate: string): Date[] {
  const weeks: Date[] = [];
  const sd = new Date(startDate);
  const dayOfWeek = sd.getDay();
  const firstMon = new Date(sd);
  firstMon.setDate(sd.getDate() - ((dayOfWeek + 6) % 7));
  const ed = new Date(endDate);
  ed.setDate(ed.getDate() + 7);
  for (let d = new Date(firstMon); d <= ed; d.setDate(d.getDate() + 7)) {
    weeks.push(new Date(d));
  }
  return weeks;
}

export function CrmResourcePlanTab({ opportunities, accounts = [], stages = [] }: CrmResourcePlanTabProps) {
  const { toast } = useToast();
  const { users, resolveOwner } = useCrmUsers();
  const [selectedOppId, setSelectedOppId] = useState<number | null>(null);
  const [planView, setPlanView] = useState<"table" | "timeline">("table");
  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [addRowOpen, setAddRowOpen] = useState(false);
  const [breakModalOpen, setBreakModalOpen] = useState(false);
  const [breakRowIdx, setBreakRowIdx] = useState(-1);
  const [rateCardOpen, setRateCardOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<"plan" | "capacity">("plan");
  const [selectedRateCardId, setSelectedRateCardId] = useState<number | null>(null);
  const [popoverState, setPopoverState] = useState<{
    open: boolean; rowIdx: number; weekKey: string; defaultDpw: number; x: number; y: number;
  }>({ open: false, rowIdx: -1, weekKey: "", defaultDpw: 5, x: 0, y: 0 });
  const [oppSearch, setOppSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [saveAsNewOpen, setSaveAsNewOpen] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");

  const selectedOpp = opportunities.find(o => o.id === selectedOppId);
  const selectedAccount = selectedOpp?.accountId ? accounts.find(a => a.id === selectedOpp.accountId) : null;
  const selectedStage = selectedOpp?.stageId ? stages.find(s => s.id === selectedOpp.stageId) : null;

  const { data: allPlans = [] } = useQuery<ResourcePlan[]>({
    queryKey: selectedOppId
      ? [`/api/crm/opportunities/${selectedOppId}/resource-plans`]
      : ["/api/crm/opportunities/0/resource-plans?disabled=1"],
    enabled: !!selectedOppId,
  });

  const { data: planData, isLoading: planLoading } = useQuery<ResourcePlan | null>({
    queryKey: selectedPlanId
      ? [`/api/crm/resource-plans/${selectedPlanId}`]
      : ["/api/crm/resource-plans/0?disabled=1"],
    enabled: !!selectedPlanId,
  });

  useEffect(() => {
    if (allPlans.length > 0 && !selectedPlanId) {
      setSelectedPlanId(allPlans[0].id);
    } else if (allPlans.length === 0) {
      setSelectedPlanId(null);
    }
  }, [allPlans, selectedPlanId]);

  useEffect(() => {
    setSelectedPlanId(null);
  }, [selectedOppId]);

  const { data: rateCards = [] } = useQuery<RateCard[]>({
    queryKey: ["/api/resources/rate-cards"],
  });

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ["/api/crm/resource-plan-templates"],
  });

  const { data: resourcesList = [] } = useQuery<ResourceEntry[]>({
    queryKey: ["/api/resources"],
  });

  const { data: skillsList = [] } = useQuery<Array<{ id: number; name: string }>>({
    queryKey: ["/api/resources/skills"],
  });

  useEffect(() => {
    if (planData?.rows) {
      setRows(planData.rows.map(r => ({
        ...r,
        startDate: normalizeDate(r.startDate),
        endDate: normalizeDate(r.endDate),
        daysPerWeek: Number(r.daysPerWeek) || 5,
        dailyRate: Number(r.dailyRate) || 0,
        discountPercent: Number(r.discountPercent) || 0,
        breaks: (r.breaks as any) || [],
        weekOverrides: (r.weekOverrides as any) || {},
      })));
      if (planData.rateCardId) setSelectedRateCardId(planData.rateCardId);
    } else {
      setRows([]);
    }
  }, [planData]);

  const savePlanMutation = useMutation({
    mutationFn: async (data: { rows: ResourceRow[]; createNew?: boolean; planName?: string }) => {
      if (!selectedOppId) throw new Error("No opportunity selected");
      const res = await apiRequest("POST", `/api/crm/opportunities/${selectedOppId}/resource-plan`, {
        planId: data.createNew ? undefined : selectedPlanId,
        createNew: data.createNew,
        planName: data.planName,
        rateCardId: selectedRateCardId,
        rows: data.rows,
      });
      return res.json() as Promise<ResourcePlan>;
    },
    onSuccess: (result: ResourcePlan) => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/opportunities/${selectedOppId}/resource-plans`] });
      if (result?.id) setSelectedPlanId(result.id);
      toast({ title: "Resource plan saved" });
    },
    onError: () => {
      toast({ title: "Failed to save plan", variant: "destructive" });
    },
  });

  const clonePlanMutation = useMutation({
    mutationFn: async (planId: number) => {
      const res = await apiRequest("POST", `/api/crm/resource-plans/${planId}/clone`, { planName: `${allPlans.find(p => p.id === planId)?.planName || "Plan"} (Copy)` });
      return res.json() as Promise<ResourcePlan>;
    },
    onSuccess: (result: ResourcePlan) => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/opportunities/${selectedOppId}/resource-plans`] });
      if (result?.id) setSelectedPlanId(result.id);
      toast({ title: "Plan cloned" });
    },
    onError: () => toast({ title: "Failed to clone plan", variant: "destructive" }),
  });

  const notifyMutation = useMutation({
    mutationFn: async () => {
      if (!planData?.id) throw new Error("No plan to notify");
      return apiRequest("POST", `/api/crm/resource-plans/${planData.id}/notify`);
    },
    onSuccess: () => {
      toast({ title: "Resource Manager notified" });
    },
  });

  const updateRow = useCallback((idx: number, field: string, value: unknown) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }, []);

  const deleteRow = useCallback((idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
    toast({ title: "Row removed" });
  }, [toast]);

  const handleSave = () => {
    savePlanMutation.mutate({ rows });
  };

  const handleLoadTemplate = (tmpl: Template) => {
    const today = new Date();
    const newRows: ResourceRow[] = tmpl.rows.map((tr, i) => {
      const start = new Date(today);
      const end = new Date(today);
      end.setDate(end.getDate() + (tr.defaultDurationWeeks ?? 12) * 7);
      const rateCard = selectedRateCardId ? rateCards.find(rc => rc.id === selectedRateCardId) : null;
      const rateItem = rateCard?.items?.find(item => item.roleName === tr.roleName);
      return {
        phase: tr.phase,
        roleName: tr.roleName,
        resourceId: null,
        namedResourceLabel: "",
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        daysPerWeek: Number(tr.daysPerWeek) || 5,
        dailyRate: rateItem ? Number(rateItem.dailyRate) : (Number(tr.dailyRate) || 900),
        discountPercent: 0,
        status: "Open",
        sortOrder: i,
        breaks: [],
        weekOverrides: {},
      };
    });
    setRows(newRows);
    toast({ title: `Template "${tmpl.name}" loaded` });
  };

  const handleRateCardSelect = (rcId: number) => {
    setSelectedRateCardId(rcId);
    const rc = rateCards.find(r => r.id === rcId);
    if (rc?.items) {
      setRows(prev => prev.map(row => {
        const item = rc.items.find(i => i.roleName === row.roleName);
        return item ? { ...row, dailyRate: Number(item.dailyRate) } : row;
      }));
      toast({ title: `Rate card "${rc.name}" applied` });
    }
  };

  const exportPlanCSV = useCallback(() => {
    if (rows.length === 0) return;
    const headers = ["Phase", "Role", "Named Resource", "Start Date", "End Date", "Days/Week", "Daily Rate", "Discount %", "Status", "Breaks"];
    const csvRows = rows.map(r => [
      r.phase, r.roleName, r.namedResourceLabel || "TBA", r.startDate, r.endDate,
      r.daysPerWeek, r.dailyRate, r.discountPercent, r.status,
      (r.breaks || []).map(b => `${b.start}~${b.end}~${b.reason}`).join("; ")
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `resource-plan-${selectedOpp?.name || "export"}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast({ title: `Exported ${rows.length} rows to CSV` });
  }, [rows, selectedOpp, toast]);

  const importPlanCSV = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) { toast({ title: "CSV file is empty", variant: "destructive" }); return; }
      const imported: ResourceRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].match(/("(?:[^"]|"")*"|[^,]*)/g)?.map(c => c.replace(/^"|"$/g, "").replace(/""/g, '"')) || [];
        if (cols.length < 6) continue;
        const breaks: ResourceRow["breaks"] = [];
        if (cols[9]) {
          cols[9].split("; ").forEach(bs => {
            const [start, end, reason] = bs.split("~");
            if (start && end) breaks.push({ start, end, reason: reason || "", notes: "" });
          });
        }
        imported.push({
          phase: cols[0] || "Build",
          roleName: cols[1] || "Resource",
          resourceId: null,
          namedResourceLabel: cols[2] === "TBA" ? "" : (cols[2] || ""),
          startDate: normalizeDate(cols[3]) || new Date().toISOString().slice(0, 10),
          endDate: normalizeDate(cols[4]) || new Date().toISOString().slice(0, 10),
          daysPerWeek: Number(cols[5]) || 5,
          dailyRate: Number(cols[6]) || 0,
          discountPercent: Number(cols[7]) || 0,
          status: cols[8] || "Open",
          sortOrder: i - 1,
          breaks,
          weekOverrides: {},
        });
      }
      if (imported.length > 0) {
        if (rows.length > 0 && !window.confirm(`Import ${imported.length} rows? This will replace your current ${rows.length} rows.`)) return;
        setRows(imported);
        toast({ title: `Imported ${imported.length} rows from CSV` });
      } else {
        toast({ title: "No valid rows found in CSV", variant: "destructive" });
      }
    };
    reader.readAsText(file);
  }, [rows.length, toast]);

  const planImportRef = useRef<HTMLInputElement>(null);

  const probability = selectedOpp?.probability || 0;
  const currency = planData?.currency || "GBP";
  const totalDays = rows.reduce((s, r) => s + calcDays(r), 0);
  const totalCost = rows.reduce((s, r) => s + calcCost(r), 0);
  const confirmedCount = rows.filter(r => r.status === "Confirmed").length;
  const uniqueOwners = useMemo(() => {
    const ownerIds = Array.from(new Set(opportunities.map(o => o.ownerUserId).filter(Boolean))) as string[];
    if (ownerIds.length > 0) return ownerIds;
    return users.map(u => u.id);
  }, [opportunities, users]);

  const filteredOpps = useMemo(() => {
    let list = [...opportunities];
    if (oppSearch) list = list.filter(o => o.name.toLowerCase().includes(oppSearch.toLowerCase()));
    if (stageFilter !== "all") {
      const stageId = parseInt(stageFilter);
      list = list.filter(o => o.stageId === stageId);
    }
    if (ownerFilter !== "all") list = list.filter(o => o.ownerUserId === ownerFilter);
    return list;
  }, [opportunities, oppSearch, stageFilter, ownerFilter]);

  const allTablePhases = useMemo(() => {
    const set = new Set(DEFAULT_PHASES);
    rows.forEach(r => { if (r.phase) set.add(r.phase); });
    return Array.from(set);
  }, [rows]);

  const indexedRows = useMemo(() => rows.map((row, idx) => ({ row, idx })), [rows]);
  const planRowsPagination = useTablePagination(indexedRows, {
    resetKey: `${selectedPlanId ?? "none"}|${planView}`,
  });

  const timelineRange = useMemo(() => {
    if (rows.length === 0) return { weekStarts: [], monthGroups: [] as Array<{ label: string; span: number }> };
    const allDates = rows.flatMap(r => [r.startDate, r.endDate]).filter(Boolean);
    const minDate = allDates.sort()[0];
    const maxDate = allDates.sort()[allDates.length - 1];
    const weekStarts = getWeekStarts(minDate, maxDate);
    const monthGroups: Array<{ label: string; span: number }> = [];
    let cur: { label: string; span: number } | null = null;
    weekStarts.forEach(ws => {
      const label = ws.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      if (cur && cur.label === label) { cur.span++; } else { if (cur) monthGroups.push(cur); cur = { label, span: 1 }; }
    });
    if (cur) monthGroups.push(cur);
    return { weekStarts, monthGroups };
  }, [rows]);

  if (!selectedOppId) {
    return (
      <div className="space-y-5" data-testid="resource-plan-opp-selector">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Briefcase className="h-5 w-5 text-[#0ea5e9]" />
            <h3 className="text-lg font-bold">Opportunity Resource Plan</h3>
          </div>
          <div className="text-sm text-muted-foreground">
            {filteredOpps.length} of {opportunities.length} opportunities
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-[340px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search opportunities..."
              className="pl-9"
              value={oppSearch}
              onChange={e => setOppSearch(e.target.value)}
              data-testid="input-opp-search"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value)}
              className="px-3 py-2 border rounded-md text-xs font-semibold outline-none focus:border-[#0ea5e9] bg-card"
              data-testid="select-stage-filter"
            >
              <option value="all">All Stages</option>
              {stages.map(s => (
                <option key={s.id} value={s.id.toString()}>{s.name}</option>
              ))}
            </select>
            <select
              value={ownerFilter}
              onChange={e => setOwnerFilter(e.target.value)}
              className="px-3 py-2 border rounded-md text-xs font-semibold outline-none focus:border-[#0ea5e9] bg-card"
              data-testid="select-owner-filter"
            >
              <option value="all">All Owners</option>
              {uniqueOwners.map(o => (
                <option key={o} value={o}>{resolveOwner(o).name}</option>
              ))}
            </select>
          </div>
          {(stageFilter !== "all" || ownerFilter !== "all" || oppSearch) && (
            <button
              onClick={() => { setStageFilter("all"); setOwnerFilter("all"); setOppSearch(""); }}
              className="text-xs text-[#0ea5e9] hover:underline font-semibold flex items-center gap-1"
              data-testid="button-clear-filters"
            >
              <X className="h-3 w-3" /> Clear filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[calc(100vh-340px)] overflow-auto pr-1">
          {filteredOpps.map(opp => {
            const acct = opp.accountId ? accounts.find(a => a.id === opp.accountId) : null;
            const stg = opp.stageId ? stages.find(s => s.id === opp.stageId) : null;
            return (
              <button
                key={opp.id}
                onClick={() => setSelectedOppId(opp.id)}
                className="text-left border rounded-lg p-4 hover:border-[#0ea5e9] hover:shadow-md transition-all bg-card group"
                data-testid={`opp-select-${opp.id}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="text-sm font-bold truncate group-hover:text-[#0ea5e9] transition-colors">{opp.name}</div>
                  {opp.probability !== null && (
                    <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded shrink-0">
                      {opp.probability}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <Building2 className="h-3 w-3" />
                  <span className="truncate">{acct?.name || "No account"}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  {stg && (
                    <Badge variant="outline" className="text-[10px]" style={{ borderColor: stg.color || undefined, color: stg.color || undefined }}>
                      {stg.name}
                    </Badge>
                  )}
                  {opp.amount && (
                    <span className="text-xs font-mono font-semibold text-muted-foreground">
                      {fmtCurrency(Number(opp.amount))}
                    </span>
                  )}
                </div>
                {opp.ownerUserId && (
                  <div className="mt-2 text-[10px] text-muted-foreground truncate">
                    Owner: {resolveOwner(opp.ownerUserId).name}
                  </div>
                )}
              </button>
            );
          })}
          {filteredOpps.length === 0 && (
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">
              No opportunities match the current filters
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="resource-plan-view">
      {/* Panel Tabs */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex border border-border rounded-lg overflow-hidden">
          <button
            onClick={() => setActivePanel("plan")}
            className={cn("flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors",
              activePanel === "plan" ? "bg-[#0ea5e9] text-white" : "bg-card text-muted-foreground hover:bg-muted")}
            data-testid="panel-tab-plan"
          >
            <FileText className="h-4 w-4" />
            Opportunity Resource Plan
          </button>
          <button
            onClick={() => setActivePanel("capacity")}
            className={cn("flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors border-l",
              activePanel === "capacity" ? "bg-[#0ea5e9] text-white" : "bg-card text-muted-foreground hover:bg-muted")}
            data-testid="panel-tab-capacity"
          >
            <Users className="h-4 w-4" />
            Capacity Board
          </button>
        </div>
        <div className="flex items-center gap-2">
          {allPlans.length > 1 && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCompareOpen(true)} data-testid="button-compare-plans">
              <GitCompare className="h-3.5 w-3.5" />
              Compare Plans
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRateCardOpen(true)}
            data-testid="button-manage-rate-cards">
            <CreditCard className="h-3.5 w-3.5" />
            Rate Cards
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => notifyMutation.mutate()} disabled={!planData?.id}
            data-testid="button-notify-rm">
            <Bell className="h-3.5 w-3.5" />
            Notify RM
          </Button>
          <Button size="sm" className="gap-1.5 bg-[#0ea5e9] hover:bg-[#0284c7]" onClick={() => setAddRowOpen(true)}
            data-testid="button-add-row">
            <Plus className="h-3.5 w-3.5" />
            New Requirement
          </Button>
        </div>
      </div>

      {activePanel === "plan" && (
        <div className="border rounded-xl overflow-hidden bg-card shadow-sm" data-testid="resource-plan-card">
          {/* Opportunity Header Strip */}
          <div className="flex items-center gap-px bg-border/50">
            <button
              onClick={() => setSelectedOppId(null)}
              className="flex items-center gap-1.5 px-3 py-4 bg-muted/40 hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground shrink-0"
              title="Change Opportunity"
              data-testid="button-change-opp"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 grid grid-cols-6 gap-px">
              <HeaderField label="Opportunity" value={selectedOpp?.name || ""} highlight />
              <HeaderField label="Customer" value={selectedAccount?.name || "—"} />
              <HeaderField label="Stage" value={selectedStage?.name || "—"} badge badgeColor={selectedStage?.color || undefined} />
              <HeaderField label="Win Probability" value={`${probability}%`} probBar={probability} />
              <HeaderField
                label="Rate Card"
                value={rateCards.find(rc => rc.id === selectedRateCardId)?.name || "Select..."}
                clickable
                onClick={() => setRateCardOpen(true)}
              />
              <HeaderField label="Owner" value={selectedOpp?.ownerUserId ? resolveOwner(selectedOpp.ownerUserId).name : "—"} />
            </div>
          </div>

          {/* Plan & Template Picker */}
          <div className="flex items-center gap-2 px-4 py-3 border-b flex-wrap">
            {allPlans.length > 0 && (
              <>
                <span className="text-xs font-semibold text-muted-foreground">Plan:</span>
                <select
                  value={selectedPlanId?.toString() || ""}
                  onChange={e => setSelectedPlanId(parseInt(e.target.value))}
                  className="px-3 py-1.5 rounded border text-xs font-semibold bg-card outline-none focus:border-[#0ea5e9] min-w-[160px]"
                  data-testid="select-resource-plan"
                >
                  {allPlans.map(p => (
                    <option key={p.id} value={p.id}>{p.planName || `Plan #${p.id}`}</option>
                  ))}
                </select>
                {selectedPlanId && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => clonePlanMutation.mutate(selectedPlanId)} disabled={clonePlanMutation.isPending}>
                    <Copy className="h-3 w-3" /> Clone
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setSaveAsNewOpen(true)}>
                  <Plus className="h-3 w-3" /> New Scenario
                </Button>
                <Separator orientation="vertical" className="h-5" />
              </>
            )}
            <span className="text-xs font-semibold text-muted-foreground">Template:</span>
            {templates.length > 0 ? (
              <select
                value=""
                onChange={(e) => {
                  const tmplId = e.target.value;
                  if (!tmplId) return;
                  const tmpl = templates.find(t => t.id.toString() === tmplId);
                  if (!tmpl) return;
                  if (rows.length > 0) {
                    if (!window.confirm(`Loading "${tmpl.name}" will replace your current ${rows.length} rows. Continue?`)) {
                      e.target.value = "";
                      return;
                    }
                  }
                  handleLoadTemplate(tmpl);
                  e.target.value = "";
                }}
                className="px-3 py-1.5 rounded border text-xs font-semibold bg-card transition-colors focus:border-[#0ea5e9] outline-none min-w-[180px]"
                data-testid="select-template"
              >
                <option value="">Select a template...</option>
                {templates.map(tmpl => (
                  <option key={tmpl.id} value={tmpl.id.toString()}>{tmpl.name} ({tmpl.rows.length} roles)</option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-muted-foreground italic" data-testid="no-templates-hint">
                No saved templates — use Start Fresh or save your first plan as a template
              </span>
            )}
            <button
              className="px-3 py-1 rounded-full border border-dashed text-xs font-semibold text-muted-foreground hover:border-[#0ea5e9] hover:text-[#0ea5e9]"
              onClick={() => {
                if (rows.length > 0 && !window.confirm(`This will clear your current ${rows.length} rows. Continue?`)) return;
                setRows([]);
                toast({ title: "Starting fresh — add rows manually" });
              }}
              data-testid="template-custom"
            >
              + Start Fresh
            </button>
            {rows.length > 0 && (
              <button
                className="px-3 py-1 rounded-full border border-dashed text-xs font-semibold text-[#0ea5e9] hover:bg-[#0ea5e9]/5 flex items-center gap-1"
                onClick={() => setSaveTemplateOpen(true)}
                data-testid="button-save-template"
              >
                <Save className="h-3 w-3" /> Save as Template
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => setAddRowOpen(true)}>
                <Plus className="h-3 w-3" /> Add Row
              </Button>
              {rows.length > 1 && rows[0]?.startDate && rows[0]?.endDate && (
                <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground"
                  onClick={() => {
                    const { startDate, endDate } = rows[0];
                    setRows(prev => prev.map(r => ({ ...r, startDate, endDate })));
                    toast({ title: `Dates copied from row 1 (${startDate} — ${endDate}) to all ${rows.length} rows` });
                  }}
                  data-testid="button-copy-dates"
                >
                  <Calendar className="h-3 w-3" /> Copy Dates ↓
                </Button>
              )}
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground"
                onClick={exportPlanCSV} disabled={rows.length === 0} data-testid="button-export-plan">
                <Download className="h-3 w-3" /> Export
              </Button>
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground"
                onClick={() => planImportRef.current?.click()} data-testid="button-import-plan">
                <Upload className="h-3 w-3" /> Import
              </Button>
              <input ref={planImportRef} type="file" accept=".csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) importPlanCSV(f); e.target.value = ""; }} />
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground"
                onClick={() => { setRows([]); toast({ title: "Rows cleared" }); }}>
                Clear
              </Button>
              <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={handleSave}
                disabled={savePlanMutation.isPending} data-testid="button-save-plan">
                {savePlanMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                Save Plan
              </Button>
            </div>
          </div>

          {/* View Toolbar */}
          <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground">View:</span>
            <div className="flex border rounded-md overflow-hidden">
              <button
                onClick={() => setPlanView("table")}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors",
                  planView === "table" ? "bg-[#0ea5e9] text-white" : "bg-card text-muted-foreground hover:bg-muted")}
                data-testid="view-table"
              >
                <LayoutList className="h-3.5 w-3.5" /> Table
              </button>
              <button
                onClick={() => setPlanView("timeline")}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors border-l",
                  planView === "timeline" ? "bg-[#0ea5e9] text-white" : "bg-card text-muted-foreground hover:bg-muted")}
                data-testid="view-timeline"
              >
                <CalendarDays className="h-3.5 w-3.5" /> Timeline
              </button>
            </div>
            {planView === "timeline" && (
              <>
                <span className="text-[11px] italic text-muted-foreground">
                  Scroll right to navigate → | Click any active week to edit days inline
                </span>
                <div className="flex gap-1.5 items-center ml-auto flex-wrap">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Phase:</span>
                  {DEFAULT_PHASES.map(ph => {
                    const pc = getPhaseColor(ph);
                    return (
                      <span key={ph} className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", pc.bg, pc.text)}>
                        {ph}
                      </span>
                    );
                  })}
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border border-dashed border-slate-300 dark:border-slate-600 font-semibold">
                    ⬚ Break
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Table View */}
          {planView === "table" && (
            <>
            <div className="overflow-x-auto" data-testid="table-view">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase w-8">#</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase w-[108px]">Phase</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase min-w-[140px]">Role / Skill</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase min-w-[140px]">Name</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase w-[100px]">Start</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold text-muted-foreground uppercase w-[100px]">End</th>
                    <th className="px-3 py-2 text-center text-[10px] font-bold text-muted-foreground uppercase w-[65px]">Days/Wk</th>
                    <th className="px-3 py-2 text-center text-[10px] font-bold text-muted-foreground uppercase w-[65px]">Days</th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold text-muted-foreground uppercase w-[80px]">Rate £</th>
                    <th className="px-3 py-2 text-center text-[10px] font-bold text-muted-foreground uppercase w-[60px]">Disc %</th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold text-muted-foreground uppercase w-[100px]">Cost £</th>
                    <th className="px-3 py-2 text-center text-[10px] font-bold text-muted-foreground uppercase w-[100px]">Status</th>
                    <th className="px-3 py-2 text-center text-[10px] font-bold text-muted-foreground uppercase w-[90px]">Breaks</th>
                    <th className="px-3 py-2 w-[36px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {planRowsPagination.paginatedItems.map(({ row, idx }) => {
                    const days = calcDays(row);
                    const cost = calcCost(row);
                    const breakCount = (row.breaks || []).length;
                    const lostDays = calcBreakDays(row);
                    return (
                      <tr key={idx} className="border-b hover:bg-muted/30 transition-colors" data-testid={`resource-row-${idx}`}>
                        <td className="px-3 py-2 text-center text-xs font-bold text-muted-foreground">{idx + 1}</td>
                        <td className="px-1 py-1">
                          <InlinePhaseEditor
                            value={row.phase}
                            phases={allTablePhases}
                            onChange={val => updateRow(idx, "phase", val)}
                            testId={`select-phase-${idx}`}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <input
                            value={row.roleName}
                            onChange={e => updateRow(idx, "roleName", e.target.value)}
                            className="w-full px-2 py-1.5 text-xs rounded border-transparent hover:border-border focus:border-[#0ea5e9] bg-transparent transition-colors outline-none"
                            placeholder="Role / Skill"
                            list={`skills-list-${idx}`}
                            data-testid={`input-role-${idx}`}
                          />
                          <datalist id={`skills-list-${idx}`}>
                            {skillsList.map(s => <option key={s.id} value={s.name} />)}
                          </datalist>
                        </td>
                        <td className="px-1 py-1">
                          <select
                            value={row.resourceId?.toString() || ""}
                            onChange={e => {
                              const resId = e.target.value ? parseInt(e.target.value) : null;
                              const res = resId ? resourcesList.find(r => r.id === resId) : null;
                              updateRow(idx, "resourceId", resId);
                              updateRow(idx, "namedResourceLabel", res ? `${res.firstName} ${res.lastName}` : "");
                            }}
                            className="w-full px-2 py-1.5 text-xs rounded border-transparent hover:border-border focus:border-[#0ea5e9] bg-transparent transition-colors outline-none"
                            title={resourcesList.length === 0 ? "No resources found. Add people in Resource Management first." : ""}
                            data-testid={`select-resource-${idx}`}
                          >
                            <option value="">— TBA —</option>
                            {resourcesList.length === 0 ? (
                              <>
                                <option value="" disabled>──────────────────</option>
                                <option value="" disabled>⚠ No resources found</option>
                                <option value="" disabled>Add people in Resource</option>
                                <option value="" disabled>Management module first</option>
                              </>
                            ) : null}
                            {resourcesList.map(r => (
                              <option key={r.id} value={r.id.toString()}>
                                {r.firstName} {r.lastName} · {r.jobTitle || "—"}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-1 py-1">
                          <input type="date" value={row.startDate} onChange={e => updateRow(idx, "startDate", e.target.value)}
                            className="w-full px-2 py-1.5 text-xs rounded border-transparent hover:border-border focus:border-[#0ea5e9] bg-transparent transition-colors outline-none"
                            data-testid={`input-start-${idx}`} />
                        </td>
                        <td className="px-1 py-1">
                          <input type="date" value={row.endDate} onChange={e => updateRow(idx, "endDate", e.target.value)}
                            className="w-full px-2 py-1.5 text-xs rounded border-transparent hover:border-border focus:border-[#0ea5e9] bg-transparent transition-colors outline-none"
                            data-testid={`input-end-${idx}`} />
                        </td>
                        <td className="px-1 py-1">
                          <input type="number" value={row.daysPerWeek} min={0.5} max={5} step={0.5}
                            onChange={e => updateRow(idx, "daysPerWeek", parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 text-xs text-center rounded border-transparent hover:border-border focus:border-[#0ea5e9] bg-transparent transition-colors outline-none font-mono"
                            data-testid={`input-dpw-${idx}`} />
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-xs font-semibold">
                          {days}
                          {lostDays > 0 && <div className="text-[10px] text-red-500 font-medium">−{lostDays}d</div>}
                        </td>
                        <td className="px-1 py-1">
                          <input type="number" value={row.dailyRate} onChange={e => updateRow(idx, "dailyRate", parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 text-xs text-right rounded border-transparent hover:border-border focus:border-[#0ea5e9] bg-transparent transition-colors outline-none font-mono"
                            data-testid={`input-rate-${idx}`} />
                        </td>
                        <td className="px-1 py-1">
                          <input type="number" value={row.discountPercent} min={0} max={100}
                            onChange={e => updateRow(idx, "discountPercent", parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 text-xs text-center rounded border-transparent hover:border-border focus:border-[#0ea5e9] bg-transparent transition-colors outline-none font-mono"
                            data-testid={`input-disc-${idx}`} />
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs font-semibold">{fmtCurrency(cost)}</td>
                        <td className="px-1 py-1">
                          <select value={row.status} onChange={e => updateRow(idx, "status", e.target.value)}
                            className={cn("w-full px-2 py-1 text-[11px] font-bold rounded-full text-center border outline-none",
                              STATUS_COLORS[row.status]?.bg, STATUS_COLORS[row.status]?.text)}
                            data-testid={`select-status-${idx}`}
                          >
                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1 text-center">
                          <button
                            onClick={() => { setBreakRowIdx(idx); setBreakModalOpen(true); }}
                            className={cn("inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 border transition-colors",
                              breakCount > 0
                                ? "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                                : "text-muted-foreground bg-transparent border-border hover:border-muted-foreground"
                            )}
                            data-testid={`button-breaks-${idx}`}
                          >
                            {breakCount > 0 ? (
                              <><Scissors className="h-3 w-3" /> {breakCount} break{breakCount > 1 ? "s" : ""} · {lostDays}d</>
                            ) : (
                              <><Plus className="h-3 w-3" /> Break</>
                            )}
                          </button>
                        </td>
                        <td className="px-1 py-1">
                          <button onClick={() => deleteRow(idx)} className="p-1 text-red-400 hover:text-red-600 transition-colors rounded"
                            data-testid={`button-delete-${idx}`}>
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={14} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        No resource requirements yet. Load a template or add a row.
                      </td>
                    </tr>
                  )}
                </tbody>
                {rows.length > 0 && (
                  <tfoot>
                    <tr className="bg-emerald-50 dark:bg-emerald-900/20 border-t-2 border-emerald-500 font-bold">
                      <td colSpan={7} className="px-3 py-2.5 text-xs uppercase tracking-wider">Total</td>
                      <td className="px-3 py-2.5 text-center font-mono text-xs">{totalDays}</td>
                      <td></td><td></td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs">{fmtCurrency(totalCost)}</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <TablePagination
              page={planRowsPagination.page}
              totalPages={planRowsPagination.totalPages}
              total={planRowsPagination.total}
              startIndex={planRowsPagination.startIndex}
              endIndex={planRowsPagination.endIndex}
              pageSize={planRowsPagination.pageSize}
              onPageChange={planRowsPagination.setPage}
              onPageSizeChange={planRowsPagination.setPageSize}
            />
            </>
          )}

          {/* Timeline View */}
          {planView === "timeline" && (
            <TimelineView
              rows={rows}
              weekStarts={timelineRange.weekStarts}
              monthGroups={timelineRange.monthGroups}
              onOpenPopover={(rowIdx, weekKey, dpw, x, y) =>
                setPopoverState({ open: true, rowIdx, weekKey, defaultDpw: dpw, x, y })}
              onOpenBreaks={(idx) => { setBreakRowIdx(idx); setBreakModalOpen(true); }}
              onExtendRow={(rowIdx, newEndDate) => {
                setRows(prev => prev.map((r, i) => {
                  if (i !== rowIdx) return r;
                  const currentEnd = new Date(r.endDate);
                  const proposedEnd = new Date(newEndDate);
                  const proposedStart = new Date(r.startDate);
                  if (proposedEnd > currentEnd) {
                    return { ...r, endDate: newEndDate };
                  } else if (proposedEnd < proposedStart) {
                    return { ...r, startDate: newEndDate };
                  }
                  return r;
                }));
                toast({ title: `Extended ${rows[rowIdx]?.roleName || "resource"} to week of ${newEndDate}` });
              }}
            />
          )}

          {/* Summary Strip */}
          <div className="grid grid-cols-5 gap-px bg-border/50 border-t-2 border-[#0ea5e9]">
            <SummaryStat label="Total Resources" value={rows.length.toString()} sub="roles planned" highlight />
            <SummaryStat label="Total Days" value={totalDays.toString()} sub="excl. breaks" />
            <SummaryStat label="Cost to Customer" value={fmtCurrency(totalCost)} sub="before tax" highlight />
            <SummaryStat label="Weighted Value" value={fmtCurrency(Math.round(totalCost * probability / 100))} sub={`at ${probability}% probability`} />
            <SummaryStat label="Confirmed" value={`${confirmedCount} / ${rows.length}`} sub="of total planned" />
          </div>
        </div>
      )}

      {activePanel === "capacity" && (
        <CapacityBoard />
      )}

      {/* Week Popover */}
      {popoverState.open && (
        <WeekPopover
          state={popoverState}
          onClose={() => setPopoverState(p => ({ ...p, open: false }))}
          onApply={(days) => {
            setRows(prev => prev.map((r, i) => {
              if (i !== popoverState.rowIdx) return r;
              return { ...r, weekOverrides: { ...r.weekOverrides, [popoverState.weekKey]: days } };
            }));
            setPopoverState(p => ({ ...p, open: false }));
            toast({ title: days === 0 ? "Week marked as off" : `Week override: ${days}d/wk` });
          }}
          onReset={() => {
            setRows(prev => prev.map((r, i) => {
              if (i !== popoverState.rowIdx) return r;
              const wo = { ...r.weekOverrides };
              delete wo[popoverState.weekKey];
              return { ...r, weekOverrides: wo };
            }));
            setPopoverState(p => ({ ...p, open: false }));
            toast({ title: "Week reset to default" });
          }}
          onAddBreak={() => {
            setBreakRowIdx(popoverState.rowIdx);
            setBreakModalOpen(true);
            setPopoverState(p => ({ ...p, open: false }));
          }}
        />
      )}

      {/* Add Row Modal */}
      <AddRowModal
        open={addRowOpen}
        onClose={() => setAddRowOpen(false)}
        skillsList={skillsList}
        resourcesList={resourcesList}
        rateCardItems={selectedRateCardId ? (rateCards.find(rc => rc.id === selectedRateCardId)?.items || []) : []}
        existingPhases={Array.from(new Set(rows.map(r => r.phase)))}
        onAdd={(row) => {
          setRows(prev => [...prev, { ...row, sortOrder: prev.length }]);
          setAddRowOpen(false);
          toast({ title: "Resource requirement added" });
        }}
      />

      {/* Break Modal */}
      {breakModalOpen && breakRowIdx >= 0 && breakRowIdx < rows.length && (
        <BreakModal
          row={rows[breakRowIdx]}
          onClose={() => setBreakModalOpen(false)}
          onUpdate={(breaks) => {
            const updatedRows = rows.map((r, i) => i === breakRowIdx ? { ...r, breaks } : r);
            setRows(updatedRows);
            setBreakModalOpen(false);
            toast({ title: "Breaks updated — saving plan..." });
            savePlanMutation.mutate({ rows: updatedRows });
          }}
        />
      )}

      {/* Rate Card Manager */}
      <RateCardManager
        open={rateCardOpen}
        onClose={() => setRateCardOpen(false)}
        selectedRateCardId={selectedRateCardId}
        onSelectRateCard={(id) => { handleRateCardSelect(id); }}
        readOnly
      />

      {/* Compare Plans Modal */}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-3xl" data-testid="compare-plans-modal">
          <DialogHeader>
            <DialogTitle>Compare Resource Plans</DialogTitle>
            <DialogDescription>Side-by-side comparison of all scenarios for {selectedOpp?.name}</DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 text-xs font-bold text-muted-foreground">Metric</th>
                  {allPlans.map(p => (
                    <th key={p.id} className="text-right py-2 px-3 text-xs font-bold">{p.planName || `Plan #${p.id}`}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Roles", fn: (p: ResourcePlan) => (p.rows?.length || 0).toString() },
                  { label: "Total Days", fn: (p: ResourcePlan) => (p.rows || []).reduce((s, r) => s + calcDays({ ...r, daysPerWeek: Number(r.daysPerWeek) || 5, dailyRate: Number(r.dailyRate) || 0, discountPercent: Number(r.discountPercent) || 0, breaks: r.breaks || [], weekOverrides: r.weekOverrides || {} }), 0).toString() },
                  { label: "Total Cost", fn: (p: ResourcePlan) => fmtCurrency((p.rows || []).reduce((s, r) => s + calcCost({ ...r, daysPerWeek: Number(r.daysPerWeek) || 5, dailyRate: Number(r.dailyRate) || 0, discountPercent: Number(r.discountPercent) || 0, breaks: r.breaks || [], weekOverrides: r.weekOverrides || {} }), 0)) },
                  { label: "Weighted Value", fn: (p: ResourcePlan) => {
                    const cost = (p.rows || []).reduce((s, r) => s + calcCost({ ...r, daysPerWeek: Number(r.daysPerWeek) || 5, dailyRate: Number(r.dailyRate) || 0, discountPercent: Number(r.discountPercent) || 0, breaks: r.breaks || [], weekOverrides: r.weekOverrides || {} }), 0);
                    return fmtCurrency(Math.round(cost * probability / 100));
                  }},
                  { label: "Confirmed", fn: (p: ResourcePlan) => `${(p.rows || []).filter(r => r.status === "Confirmed").length} / ${p.rows?.length || 0}` },
                ].map(row => (
                  <tr key={row.label} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium text-muted-foreground">{row.label}</td>
                    {allPlans.map(p => (
                      <td key={p.id} className="py-2 px-3 text-right font-mono text-xs">{row.fn(p)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompareOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save as New Scenario Modal */}
      <Dialog open={saveAsNewOpen} onOpenChange={setSaveAsNewOpen}>
        <DialogContent className="max-w-sm" data-testid="save-as-new-plan-modal">
          <SubmitForm onSubmit={() => {
            savePlanMutation.mutate({ rows, createNew: true, planName: newPlanName || `Scenario ${allPlans.length + 1}` });
            setSaveAsNewOpen(false);
            setNewPlanName("");
          }}>
            <DialogHeader><DialogTitle>Save as New Scenario</DialogTitle></DialogHeader>
            <div className="py-4">
              <Label>Scenario Name</Label>
              <Input value={newPlanName} onChange={e => setNewPlanName(e.target.value)} placeholder={`Scenario ${allPlans.length + 1}`} autoFocus />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSaveAsNewOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={savePlanMutation.isPending}>Save Scenario</Button>
            </DialogFooter>
          </SubmitForm>
        </DialogContent>
      </Dialog>

      {/* Save Template Modal */}
      <SaveTemplateModal
        open={saveTemplateOpen}
        onClose={() => setSaveTemplateOpen(false)}
        rows={rows}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/crm/resource-plan-templates"] });
          setSaveTemplateOpen(false);
          toast({ title: "Template saved" });
        }}
      />
    </div>
  );
}

function HeaderField({ label, value, highlight, badge, badgeColor, probBar, clickable, onClick }: {
  label: string; value: string; highlight?: boolean; badge?: boolean; badgeColor?: string;
  probBar?: number; clickable?: boolean; onClick?: () => void;
}) {
  return (
    <div className={cn("bg-muted/30 px-4 py-3 flex flex-col gap-1", clickable && "cursor-pointer hover:bg-muted/50")}
      onClick={onClick}>
      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
      {badge ? (
        <Badge variant="outline" className="text-[11px] w-fit" style={{ borderColor: badgeColor, color: badgeColor }}>{value}</Badge>
      ) : probBar !== undefined ? (
        <div className="flex items-center gap-2">
          <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${probBar}%` }} />
          </div>
          <span className="text-sm font-bold">{value}</span>
        </div>
      ) : (
        <span className={cn("text-sm font-semibold truncate", highlight && "text-[#0ea5e9]")}>{value}</span>
      )}
    </div>
  );
}

function SummaryStat({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className="bg-card px-4 py-3 flex flex-col gap-0.5">
      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className={cn("text-xl font-bold font-mono", highlight && "text-[#0ea5e9]")}>{value}</span>
      <span className="text-[10px] text-muted-foreground">{sub}</span>
    </div>
  );
}

function TimelineView({ rows, weekStarts, monthGroups, onOpenPopover, onOpenBreaks, onExtendRow }: {
  rows: ResourceRow[];
  weekStarts: Date[];
  monthGroups: Array<{ label: string; span: number }>;
  onOpenPopover: (rowIdx: number, weekKey: string, dpw: number, x: number, y: number) => void;
  onOpenBreaks: (idx: number) => void;
  onExtendRow: (rowIdx: number, newEndDate: string) => void;
}) {
  if (rows.length === 0 || weekStarts.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-muted-foreground">
        No resource requirements yet. Load a template or add a row.
      </div>
    );
  }

  return (
    <ScrollArea className="w-full">
      <div className="overflow-auto max-h-[600px]">
        <table className="text-xs border-collapse" style={{ minWidth: `${250 + weekStarts.length * 52}px` }}>
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 bg-muted/90 backdrop-blur text-left px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase border-r-2 border-border/50 min-w-[250px] w-[250px]">
                Resource / Role
              </th>
              {monthGroups.map((mg, mi) => (
                <th key={mi} colSpan={mg.span}
                  className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold px-1 py-2 border-l-2 border-emerald-400/30">
                  {mg.label}
                </th>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 z-20 bg-muted/90 backdrop-blur border-r-2 border-border/50 min-w-[250px] w-[250px]" />
              {weekStarts.map((ws, wi) => {
                const isMonthStart = wi > 0 && ws.getMonth() !== weekStarts[wi - 1].getMonth();
                return (
                  <th key={wi} className={cn("text-[9px] text-muted-foreground py-1 min-w-[50px] w-[50px]",
                    isMonthStart && "border-l-2 border-border")}>
                    {ws.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const rStart = new Date(row.startDate);
              const rEnd = new Date(row.endDate);
              const maxBreakEnd = (row.breaks || []).reduce((max, b) => {
                const be = new Date(b.end);
                return be > max ? be : max;
              }, rEnd);
              const effectiveEnd = maxBreakEnd > rEnd ? maxBreakEnd : rEnd;
              const pc = getPhaseColor(row.phase);
              const breakCount = (row.breaks || []).length;

              return (
                <tr key={ri} className="hover:bg-muted/20 transition-colors">
                  <td className="sticky left-0 z-[1] bg-card border-r-2 border-border/50 px-4 py-2.5 min-w-[250px] w-[250px]">
                    <div className="font-semibold text-[13px]">{row.roleName}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[11px] text-muted-foreground">{row.namedResourceLabel || "— TBA —"}</span>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-bold", pc.bg, pc.text)}>{row.phase}</span>
                      {breakCount > 0 && (
                        <button onClick={() => onOpenBreaks(ri)}
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-bold cursor-pointer">
                          ✂ {breakCount}
                        </button>
                      )}
                    </div>
                  </td>
                  {weekStarts.map((ws, wi) => {
                    const we = new Date(ws); we.setDate(we.getDate() + 6);
                    const isMonthStart = wi > 0 && ws.getMonth() !== weekStarts[wi - 1].getMonth();
                    const activeInRow = ws <= rEnd && we >= rStart;
                    const inBreak = isInBreak(row, ws) && (we >= rStart && ws <= effectiveEnd);
                    const wkKey = ws.toISOString().slice(0, 10);
                    const override = row.weekOverrides?.[wkKey];
                    const daysVal = override !== undefined ? override : row.daysPerWeek;
                    const breakInfo = inBreak ? getBreakForWeek(row, ws) : null;

                    return (
                      <td key={wi} className={cn("border-b border-border/30 min-w-[50px] w-[50px]",
                        isMonthStart && "border-l-2 border-border")}>
                        {inBreak ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="mx-0.5 my-0.5 h-7 rounded flex items-center justify-center text-xs border border-dashed border-amber-400 dark:border-amber-600 cursor-help"
                                style={{ background: "repeating-linear-gradient(45deg, #fef3c7, #fef3c7 3px, #fef9c3 3px, #fef9c3 8px)" }}>
                                ⏸
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[220px] text-xs">
                              <p className="font-bold">Break / Leave</p>
                              {breakInfo && (
                                <>
                                  <p>{breakInfo.start} → {breakInfo.end}</p>
                                  {breakInfo.reason && <p className="text-muted-foreground">{breakInfo.reason}</p>}
                                  {breakInfo.notes && <p className="text-muted-foreground italic">{breakInfo.notes}</p>}
                                </>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        ) : activeInRow ? (
                          <button
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              onOpenPopover(ri, wkKey, row.daysPerWeek, rect.left, rect.bottom + 4);
                            }}
                            className={cn("mx-0.5 my-0.5 h-7 rounded flex items-center justify-center text-[11px] font-bold font-mono transition-all cursor-pointer",
                              pc.bg, pc.text, "hover:brightness-90 hover:shadow-sm",
                              override !== undefined && "border-2 border-dashed opacity-80",
                              daysVal === 0 && "!bg-slate-100 dark:!bg-slate-800 !text-slate-400 border-2 border-dashed border-slate-300"
                            )}>
                            {daysVal === 0 ? "off" : `${daysVal}d`}
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              const weStr = we.toISOString().slice(0, 10);
                              onExtendRow(ri, weStr);
                            }}
                            className="mx-0.5 my-0.5 h-7 rounded flex items-center justify-center text-[11px] text-transparent hover:text-muted-foreground hover:bg-muted/40 hover:border hover:border-dashed hover:border-muted-foreground/30 transition-all cursor-pointer"
                            title="Click to extend this resource to this week"
                            data-testid={`extend-${ri}-${wi}`}
                          >
                            +
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {/* Totals row */}
            <tr className="bg-emerald-50 dark:bg-emerald-900/20 border-t-2 border-emerald-500">
              <td className="sticky left-0 z-[1] bg-emerald-50 dark:bg-emerald-900/20 border-r-2 border-border/50 px-4 py-2 font-bold text-xs text-emerald-800 dark:text-emerald-300 uppercase">
                Total Days / Week
              </td>
              {weekStarts.map((ws, wi) => {
                const we = new Date(ws); we.setDate(we.getDate() + 6);
                const isMonthStart = wi > 0 && ws.getMonth() !== weekStarts[wi - 1].getMonth();
                let tot = 0;
                rows.forEach(r => {
                  if (ws <= new Date(r.endDate) && we >= new Date(r.startDate) && !isInBreak(r, ws)) {
                    const wkKey = ws.toISOString().slice(0, 10);
                    const ov = r.weekOverrides?.[wkKey];
                    tot += ov !== undefined ? ov : r.daysPerWeek;
                  }
                });
                return (
                  <td key={wi} className={cn("text-center py-1 min-w-[50px]", isMonthStart && "border-l-2 border-border")}>
                    {tot > 0 && <span className="font-mono font-bold text-[13px] text-emerald-800 dark:text-emerald-300">{tot}</span>}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

function WeekPopover({ state, onClose, onApply, onReset, onAddBreak }: {
  state: { open: boolean; rowIdx: number; weekKey: string; defaultDpw: number; x: number; y: number };
  onClose: () => void; onApply: (days: number) => void; onReset: () => void; onAddBreak: () => void;
}) {
  const [days, setDays] = useState(state.defaultDpw);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div ref={ref} className="fixed z-[500] bg-card border rounded-lg shadow-xl p-3 w-[210px] animate-in fade-in-0 zoom-in-95"
      style={{ left: Math.min(state.x, window.innerWidth - 220), top: state.y }}>
      <button onClick={onClose} className="absolute top-1.5 right-2 text-muted-foreground text-sm hover:text-foreground">✕</button>
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Edit Week</div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-muted-foreground w-[70px]">Days/week</span>
        <input type="number" value={days} min={0} max={5} step={0.5}
          onChange={e => setDays(parseFloat(e.target.value) || 0)}
          className="w-[60px] px-2 py-1 border rounded text-center font-mono text-sm font-semibold outline-none focus:border-[#0ea5e9]" />
        <span className="text-xs text-muted-foreground">of 5</span>
      </div>
      <div className="text-[10px] text-muted-foreground mb-2">Set to 0 to mark week as unavailable</div>
      <div className="flex gap-1.5">
        <Button size="sm" className="text-xs bg-[#0ea5e9] hover:bg-[#0284c7]" onClick={() => onApply(days)}>Apply</Button>
        <Button variant="outline" size="sm" className="text-xs" onClick={onReset}>Reset</Button>
        <Button variant="ghost" size="sm" className="text-xs" onClick={onAddBreak}>+ Break</Button>
      </div>
    </div>
  );
}

function AddRowModal({ open, onClose, skillsList, resourcesList, rateCardItems, existingPhases, onAdd }: {
  open: boolean; onClose: () => void;
  skillsList: Array<{ id: number; name: string }>;
  resourcesList: ResourceEntry[];
  rateCardItems: Array<{ roleName: string; dailyRate: string }>;
  existingPhases: string[];
  onAdd: (row: ResourceRow) => void;
}) {
  const [phase, setPhase] = useState("Discovery");
  const [customPhase, setCustomPhase] = useState("");
  const [role, setRole] = useState("");
  const [resourceId, setResourceId] = useState<string>("");
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() + 6); return d.toISOString().slice(0, 10); });
  const [dpw, setDpw] = useState(5);
  const [rate, setRate] = useState(900);
  const [disc, setDisc] = useState(0);
  const [status, setStatus] = useState("Tentative");

  const allPhases = useMemo(() => {
    const set = new Set([...DEFAULT_PHASES, ...existingPhases]);
    return Array.from(set);
  }, [existingPhases]);

  const mergedRoles = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of rateCardItems) map.set(item.roleName, item.dailyRate);
    for (const s of skillsList) if (!map.has(s.name)) map.set(s.name, "");
    return Array.from(map.entries()).map(([name, dailyRate]) => ({ name, dailyRate }));
  }, [rateCardItems, skillsList]);

  const handleRoleSelect = (roleName: string) => {
    setRole(roleName);
    const rcItem = rateCardItems.find(i => i.roleName === roleName);
    if (rcItem) setRate(parseFloat(rcItem.dailyRate) || 900);
  };

  const effectivePhase = phase === "__custom__" ? customPhase : phase;

  const handleAdd = () => {
    const res = resourceId ? resourcesList.find(r => r.id === parseInt(resourceId)) : null;
    onAdd({
      phase: effectivePhase || "Discovery", roleName: role || "TBA",
      resourceId: resourceId ? parseInt(resourceId) : null,
      namedResourceLabel: res ? `${res.firstName} ${res.lastName}` : "",
      startDate: start, endDate: end,
      daysPerWeek: dpw, dailyRate: rate, discountPercent: disc,
      status, sortOrder: 0, breaks: [], weekOverrides: {},
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="add-row-modal">
        <SubmitForm onSubmit={handleAdd}>
        <DialogHeader>
          <DialogTitle>Add Resource Requirement</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">Phase</Label>
            <select value={phase} onChange={e => { setPhase(e.target.value); if (e.target.value !== "__custom__") setCustomPhase(""); }}
              className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:border-[#0ea5e9]"
              data-testid="modal-select-phase">
              {allPhases.map(p => <option key={p} value={p}>{p}</option>)}
              <option value="__custom__">Other (custom)...</option>
            </select>
            {phase === "__custom__" && (
              <Input value={customPhase} onChange={e => setCustomPhase(e.target.value)}
                placeholder="Enter custom phase name..."
                className="mt-1"
                autoFocus
                data-testid="modal-input-custom-phase" />
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">Role / Skill</Label>
            <select
              value={role}
              onChange={e => handleRoleSelect(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:border-[#0ea5e9]"
              data-testid="modal-select-role"
            >
              <option value="">— Select a role —</option>
              {rateCardItems.length > 0 && (
                <optgroup label="Rate Card Roles">
                  {rateCardItems.map(item => (
                    <option key={`rc-${item.roleName}`} value={item.roleName}>
                      {item.roleName} (£{item.dailyRate}/day)
                    </option>
                  ))}
                </optgroup>
              )}
              {skillsList.length > 0 && (
                <optgroup label="Skills Library">
                  {skillsList.filter(s => !rateCardItems.some(i => i.roleName === s.name)).map(s => (
                    <option key={`sk-${s.id}`} value={s.name}>{s.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <Input value={role} onChange={e => setRole(e.target.value)}
              placeholder="Or type a custom role name..."
              className="mt-1 text-xs"
              data-testid="modal-input-role" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">Named Resource (Optional)</Label>
            <select value={resourceId} onChange={e => setResourceId(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:border-[#0ea5e9]"
              data-testid="modal-select-resource">
              <option value="">— To be assigned —</option>
              {resourcesList.map(r => (
                <option key={r.id} value={r.id}>{r.firstName} {r.lastName} · {r.jobTitle || "—"}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">Start Date</Label>
              <Input type="date" value={start} onChange={e => setStart(e.target.value)} data-testid="modal-input-start" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">End Date</Label>
              <Input type="date" value={end} onChange={e => setEnd(e.target.value)} data-testid="modal-input-end" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">Days/Week</Label>
              <Input type="number" value={dpw} min={0.5} max={5} step={0.5} onChange={e => setDpw(parseFloat(e.target.value) || 5)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">Daily Rate £</Label>
              <Input type="number" value={rate} onChange={e => setRate(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">Discount %</Label>
              <Input type="number" value={disc} min={0} max={100} onChange={e => setDisc(parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">Status</Label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm outline-none focus:border-[#0ea5e9]">
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="bg-[#0ea5e9] hover:bg-[#0284c7]" data-testid="button-confirm-add">
            Add Resource
          </Button>
        </DialogFooter>
        </SubmitForm>
      </DialogContent>
    </Dialog>
  );
}

function BreakModal({ row, onClose, onUpdate }: {
  row: ResourceRow; onClose: () => void;
  onUpdate: (breaks: ResourceRow["breaks"]) => void;
}) {
  const [breaks, setBreaks] = useState([...(row.breaks || [])]);
  const [bStart, setBStart] = useState(row.startDate);
  const [bEnd, setBEnd] = useState(row.endDate);
  const [bReason, setBReason] = useState("Holiday");
  const [bNotes, setBNotes] = useState("");
  const { toast } = useToast();

  const addBreak = () => {
    if (!bStart || !bEnd) { toast({ title: "Enter break dates", variant: "destructive" }); return; }
    if (new Date(bStart) > new Date(bEnd)) { toast({ title: "Start must be before end", variant: "destructive" }); return; }
    setBreaks([...breaks, { start: bStart, end: bEnd, reason: bReason, notes: bNotes }]);
    setBNotes("");
  };

  const removeBreak = (idx: number) => {
    setBreaks(breaks.filter((_, i) => i !== idx));
  };

  const reasonIcon: Record<string, string> = { Holiday: "🏖", Training: "📚", "Business Travel": "✈", Bench: "⏸", Other: "📌" };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="break-modal">
        <SubmitForm onSubmit={() => onUpdate(breaks)}>
        <DialogHeader>
          <DialogTitle>Breaks — {row.roleName}{row.namedResourceLabel ? ` (${row.namedResourceLabel})` : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 pb-1 border-b">
              Existing Breaks
            </div>
            {breaks.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2">No breaks added yet.</div>
            ) : (
              <div className="space-y-1.5">
                {breaks.map((b, bi) => {
                  const lostD = Math.round(wksBetween(b.start, b.end) * row.daysPerWeek);
                  return (
                    <div key={bi} className="flex items-center gap-2 p-2 bg-muted/50 border rounded text-xs">
                      <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 font-bold text-[10px]">
                        {reasonIcon[b.reason] || "⏸"} {b.reason}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground flex-1">
                        {new Date(b.start).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} →{" "}
                        {new Date(b.end).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                      {b.notes && <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{b.notes}</span>}
                      <span className="font-mono text-red-500 font-semibold text-[10px]">−{lostD}d</span>
                      <button onClick={() => removeBreak(bi)} className="text-red-400 hover:text-red-600"><X className="h-3 w-3" /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="border border-dashed rounded-lg p-3 space-y-2 bg-muted/20">
            <div className="text-xs font-bold text-[#0ea5e9]">+ Add New Break</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Break Start</Label>
                <Input type="date" value={bStart} onChange={e => setBStart(e.target.value)} className="text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">Break End</Label>
                <Input type="date" value={bEnd} onChange={e => setBEnd(e.target.value)} className="text-xs" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Reason</Label>
              <select value={bReason} onChange={e => setBReason(e.target.value)}
                className="w-full px-3 py-1.5 border rounded text-xs outline-none focus:border-[#0ea5e9]">
                {["Holiday", "Training", "Business Travel", "Bench", "Other"].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Notes (Optional)</Label>
              <Input value={bNotes} onChange={e => setBNotes(e.target.value)} placeholder="e.g. Annual leave" className="text-xs" />
            </div>
            <Button type="button" size="sm" className="text-xs bg-[#0ea5e9] hover:bg-[#0284c7]" onClick={addBreak}>Add Break</Button>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="bg-[#0ea5e9] hover:bg-[#0284c7]">Save Breaks</Button>
        </DialogFooter>
        </SubmitForm>
      </DialogContent>
    </Dialog>
  );
}

function RateCardPicker({ open, onClose, rateCards, selectedId, onSelect }: {
  open: boolean; onClose: () => void; rateCards: RateCard[];
  selectedId: number | null; onSelect: (id: number) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm" data-testid="rate-card-picker">
        <DialogHeader>
          <DialogTitle>Select Rate Card</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {rateCards.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">
              No rate cards available. Create one in Rate Card Management.
            </div>
          ) : (
            rateCards.map(rc => (
              <button
                key={rc.id}
                onClick={() => onSelect(rc.id)}
                className={cn("w-full text-left p-3 border rounded-lg transition-colors",
                  selectedId === rc.id ? "border-[#0ea5e9] bg-[#0ea5e9]/5" : "hover:bg-muted/50")}
                data-testid={`rate-card-${rc.id}`}
              >
                <div className="text-sm font-semibold">{rc.name}</div>
                <div className="text-xs text-muted-foreground">
                  {rc.currency} · {rc.items?.length || 0} roles defined
                </div>
              </button>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SaveTemplateModal({ open, onClose, rows, onSaved }: {
  open: boolean;
  onClose: () => void;
  rows: ResourceRow[];
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await apiRequest("POST", "/api/crm/resource-plan-templates", {
        name: name.trim(),
        rows: rows.map((r, i) => ({
          phase: r.phase,
          roleName: r.roleName,
          startDate: r.startDate,
          endDate: r.endDate,
          daysPerWeek: r.daysPerWeek,
          dailyRate: r.dailyRate,
          sortOrder: i,
        })),
      });
      setName("");
      onSaved();
    } catch (err: any) {
      console.error("Failed to save template", err);
      toast({ title: "Failed to save template", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md" data-testid="save-template-modal">
        <SubmitForm onSubmit={handleSave} disabled={!name.trim() || saving}>
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
          <DialogDescription>
            Save the current {rows.length} resource rows as a reusable template.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <label className="text-sm font-medium">Template Name</label>
          <Input
            placeholder="e.g. SAP Implementation"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            data-testid="input-template-name"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!name.trim() || saving} data-testid="button-save-template-confirm">
            {saving ? "Saving..." : "Save Template"}
          </Button>
        </DialogFooter>
        </SubmitForm>
      </DialogContent>
    </Dialog>
  );
}

