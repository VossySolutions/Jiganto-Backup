import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { copyTextToClipboard, documentModuleUrl } from "@/lib/module-links";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { SubmitForm } from "@/components/ui/submit-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/Sidebar";
import { useShellLayout } from "@/hooks/use-shell-layout";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { 
  Target, TrendingUp, AlertTriangle, Building2, Settings, Briefcase, Crosshair,
  Plus, Search, ChevronRight, ChevronDown, Loader2, Sparkles, ArrowUpRight,
  Eye, Lightbulb, Shield, Users, Workflow, Wrench, CheckCircle2,
  BarChart3, PieChart, Activity, Clock, Calendar, Flag, Link2,
  FileText, ExternalLink, ShieldCheck, MessageSquarePlus, Trash2, History,
  Bell, Send, Upload, Brain, X, RefreshCw, CheckCircle, TriangleAlert, Info, Zap, Copy
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { BusinessLoadingState } from "@/components/business/BusinessLoadingState";
import { BusinessTableScroll } from "@/components/business/BusinessTableScroll";
import { useTablePagination } from "@/hooks/use-table-pagination";
import { TablePagination } from "@/components/TablePagination";
import {
  BizDashboardIcon,
  BizStrategyMapIcon,
  BizStrategyIcon,
  BizGoalsIcon,
  BizObjectivesIcon,
  BizInitiativesIcon,
  BizOKRsIcon,
  BizKPIsIcon,
  BizExecutionIcon,
  BizDocumentsIcon,
} from "@/components/icons/ModuleIcons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { StrategyMap } from "@/components/StrategyMap";
import { MondayTable, type ColumnDef, defaultStatusColors } from "@/components/MondayTable";
import type { Document, DocumentInitiativeLink } from "@shared/models/documents";
import { ModuleHeader } from "@/components/ModuleHeader";
import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";
import { useAIInsightsPanel } from "@/hooks/use-ai-insights-panel";
import {
  EnhancedStrategyTab, EnhancedGoalsTab, EnhancedObjectivesTab,
  EnhancedInitiativesTab, EnhancedOkrsTab, EnhancedKpisTab, EnhancedGovernanceTab,
  type StrategyItemEx, type GoalEx, type ObjectiveEx,
  type InitiativeEx, type OkrEx, type KpiEx, type GovernanceItemEx,
} from "@/components/BusinessManageLayerView";

type StrategyItem = {
  id: number;
  tenantId: number;
  templateType: string;
  title: string;
  description: string | null;
  content: Record<string, unknown> | null;
  ownerId: string | null;
  ownerName: string | null;
  departmentId: number | null;
  departmentName: string | null;
  status: string;
  ragStatus: string | null;
  progress: number | null;
  trend: string | null;
  targetDate: string | null;
  timeframe: string | null;
  fiscalYear: string | null;
  reviewCadence: string | null;
  lastReviewDate: string | null;
  nextReviewDate: string | null;
  notes: string | null;
  order: number | null;
  createdAt: string;
};

type Goal = {
  id: number;
  tenantId: number;
  strategyItemId: number | null;
  type: string;
  title: string;
  description: string | null;
  ownerId: string | null;
  ownerName: string | null;
  departmentId: number | null;
  departmentName: string | null;
  status: string;
  ragStatus: string | null;
  progress: number | null;
  trend: string | null;
  startDate: string | null;
  endDate: string | null;
  targetDate: string | null;
  reviewCadence: string | null;
  createdAt: string;
};

type KeyResult = {
  id: number;
  tenantId: number;
  goalId: number;
  title: string;
  description: string | null;
  targetValue: string | null;
  currentValue: string | null;
  unit: string | null;
  ownerId: string | null;
  status: string | null;
  createdAt: string;
};

type Kpi = {
  id: number;
  tenantId: number;
  goalId: number | null;
  name: string;
  description: string | null;
  targetValue: string | null;
  currentValue: string | null;
  unit: string | null;
  indicatorType: string | null;
  ownerId: string | null;
  ownerName: string | null;
  departmentId: number | null;
  departmentName: string | null;
  status: string | null;
  ragStatus: string | null;
  progress: number | null;
  trend: string | null;
  createdAt: string;
};

type Initiative = {
  id: number;
  tenantId: number;
  goalId: number | null;
  objectiveId: number | null;
  title: string;
  description: string | null;
  ownerId: string | null;
  ownerName: string | null;
  departmentId: number | null;
  departmentName: string | null;
  status: string;
  ragStatus: string | null;
  priority: string | null;
  progress: number | null;
  startDate: string | null;
  dueDate: string | null;
  targetDate: string | null;
  projectId: number | null;
  createdAt: string;
};

type Department = {
  id: number;
  tenantId: number;
  name: string;
  description: string | null;
  headId: string | null;
  parentId: number | null;
  createdAt: string;
};

type Process = {
  id: number;
  tenantId: number;
  departmentId: number | null;
  name: string;
  description: string | null;
  ownerId: string | null;
  status: string | null;
  isCritical: boolean | null;
  documentationUrl: string | null;
  createdAt: string;
};

type Tool = {
  id: number;
  tenantId: number;
  name: string;
  description: string | null;
  category: string | null;
  vendor: string | null;
  url: string | null;
  ownerId: string | null;
  status: string | null;
  cost: string | null;
  createdAt: string;
};

type Risk = {
  id: number;
  tenantId: number;
  strategyItemId: number | null;
  type: string;
  title: string;
  description: string | null;
  likelihood: string | null;
  impact: string | null;
  mitigation: string | null;
  ownerId: string | null;
  status: string | null;
  createdAt: string;
};

type Objective = {
  id: number;
  tenantId: number;
  goalId: number | null;
  title: string;
  description: string | null;
  ownerId: string | null;
  ownerName: string | null;
  status: string;
  ragStatus: string | null;
  progress: number | null;
  targetDate: string | null;
  createdAt: string;
};

type Okr = {
  id: number;
  tenantId: number;
  objectiveId: number | null;
  goalId: number | null;
  title: string;
  description: string | null;
  ownerId: string | null;
  ownerName: string | null;
  status: string;
  ragStatus: string | null;
  progress: number | null;
  targetDate: string | null;
  createdAt: string;
};

type BusinessTask = {
  id: number;
  tenantId: number;
  initiativeId: number | null;
  title: string;
  description: string | null;
  ownerName: string | null;
  ownerId: string | null;
  status: string;
  priority: string | null;
  ragStatus: string | null;
  progress: number | null;
  dueDate: string | null;
  targetDate: string | null;
  createdAt: string;
};

type BusinessStats = {
  strategyItems: number;
  goals: number;
  goalsOnTrack: number;
  goalsAtRisk: number;
  initiatives: number;
  initiativesInProgress: number;
  kpis: number;
  risks: number;
  openRisks: number;
};

const strategyTemplates = [
  { type: "vision", name: "Aspirations / Vision", icon: Eye, color: "bg-status-purple" },
  { type: "target_market", name: "Target Market", icon: Target, color: "bg-status-blue" },
  { type: "competitor", name: "Competitor Analysis", icon: Users, color: "bg-status-amber" },
  { type: "swot", name: "SWOT Analysis", icon: BarChart3, color: "bg-status-teal" },
  { type: "risk", name: "Strategic Risks", icon: AlertTriangle, color: "bg-status-red" },
  { type: "assumption", name: "Assumptions", icon: Lightbulb, color: "bg-status-green" },
];

const statusColors: Record<string, string> = {
  ...defaultStatusColors,
  on_track: "bg-status-green text-status-green-foreground",
  off_track: "bg-status-red text-status-red-foreground",
  open: "bg-status-amber text-status-amber-foreground",
};

export default function BusinessManagementPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const { open: openAiInsights } = useAIInsightsPanel();
  const { toast } = useToast();
  const { mainOffset, mobileTopOffset } = useShellLayout();
  const { isAuthenticated, sessionReady } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery<BusinessStats>({
    queryKey: ["/api/business/stats"],
  });

  const { data: strategyItems = [], isLoading: strategyLoading } = useQuery<StrategyItem[]>({
    queryKey: ["/api/business/strategy"],
  });

  const { data: goals = [], isLoading: goalsLoading } = useQuery<Goal[]>({
    queryKey: ["/api/business/goals"],
  });

  const { data: keyResults = [], isLoading: krLoading } = useQuery<KeyResult[]>({
    queryKey: ["/api/business/key-results"],
  });

  const { data: kpis = [], isLoading: kpisLoading } = useQuery<Kpi[]>({
    queryKey: ["/api/business/kpis"],
  });

  const { data: initiatives = [], isLoading: initiativesLoading } = useQuery<Initiative[]>({
    queryKey: ["/api/business/initiatives"],
  });

  const { data: departments = [], isLoading: deptsLoading } = useQuery<Department[]>({
    queryKey: ["/api/business/departments"],
  });

  const { data: processes = [], isLoading: processLoading } = useQuery<Process[]>({
    queryKey: ["/api/business/processes"],
  });

  const { data: tools = [], isLoading: toolsLoading } = useQuery<Tool[]>({
    queryKey: ["/api/business/tools"],
  });

  const { data: risks = [], isLoading: risksLoading } = useQuery<Risk[]>({
    queryKey: ["/api/business/risks"],
  });

  const { data: objectives = [], isLoading: objectivesLoading } = useQuery<Objective[]>({
    queryKey: ["/api/business/objectives"],
  });

  const { data: okrs = [], isLoading: okrsLoading } = useQuery<Okr[]>({
    queryKey: ["/api/business/okrs"],
  });

  const { data: businessTasks = [], isLoading: tasksLoading } = useQuery<BusinessTask[]>({
    queryKey: ["/api/business/tasks"],
  });

  const { data: governanceItems = [], isLoading: governanceLoading } = useQuery<GovernanceItemEx[]>({
    queryKey: ["/api/business/governance"],
  });

  const { data: entityRefs } = useQuery<Record<string, number>>({
    queryKey: ["/api/business/entity-refs"],
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!sessionReady || !isAuthenticated) return;
    void apiRequest("POST", "/api/business/entity-refs/backfill")
      .then(() => queryClient.invalidateQueries({ queryKey: ["/api/business/entity-refs"] }))
      .catch(() => {});
  }, [sessionReady, isAuthenticated]);

  const tabLoading: Record<string, boolean> = {
    dashboard: statsLoading,
    "strategy-map": false,
    strategy: strategyLoading,
    goals: goalsLoading,
    objectives: objectivesLoading,
    initiatives: initiativesLoading,
    okrs: okrsLoading,
    kpis: kpisLoading,
    governance: governanceLoading,
    reviews: false,
    documents: false,
    operations: deptsLoading || processLoading || toolsLoading,
  };

  const createStrategyMutation = useMutation({
    mutationFn: (data: { templateType: string; title: string; description?: string }) =>
      apiRequest("POST", "/api/business/strategy", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/strategy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/business/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/business/entity-refs"] });
      toast({ title: "Strategy item created" });
    },
  });

  const createGoalMutation = useMutation({
    mutationFn: (data: { title: string; type: string; description?: string; strategyItemId?: number }) =>
      apiRequest("POST", "/api/business/goals", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/business/stats"] });
      toast({ title: "Goal created" });
    },
  });

  const createInitiativeMutation = useMutation({
    mutationFn: (data: { title: string; description?: string; goalId?: number; priority?: string }) =>
      apiRequest("POST", "/api/business/initiatives", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/initiatives"] });
      queryClient.invalidateQueries({ queryKey: ["/api/business/stats"] });
      toast({ title: "Initiative created" });
    },
  });

  const createDepartmentMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      apiRequest("POST", "/api/business/departments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/departments"] });
      toast({ title: "Department created" });
    },
  });

  const primaryTabs = [
    { id: "dashboard", label: "Dashboard", icon: BizDashboardIcon },
    { id: "strategy-map", label: "Strategy Map", icon: BizStrategyMapIcon },
  ];

  const manageSubmenu = [
    { id: "strategy", label: "Strategy", icon: BizStrategyIcon },
    { id: "goals", label: "Goals", icon: BizGoalsIcon },
    { id: "objectives", label: "Objectives", icon: BizObjectivesIcon },
    { id: "initiatives", label: "Initiatives", icon: BizInitiativesIcon },
    { id: "okrs", label: "OKRs", icon: BizOKRsIcon },
    { id: "kpis", label: "KPIs", icon: BizKPIsIcon },
    { id: "governance", label: "Governance", icon: ShieldCheck },
  ];

  const isManageTab = manageSubmenu.some(item => item.id === activeTab);
  const currentManageItem = manageSubmenu.find(item => item.id === activeTab);

  return (
    <div className="h-screen overflow-hidden bg-background" data-testid="business-page">
      <Sidebar />
      <main className={cn("transition-all duration-300 h-full flex flex-col overflow-hidden", mainOffset, mobileTopOffset)}>
        <div className="px-3 sm:px-4 pt-3 sm:pt-4">
          <ModuleWelcomeBanner moduleKey="business-mgmt" features={["Strategy mapping", "Governance layer", "RAG status rollup", "AI insights"]} />
        </div>
        <div className="border-b border-border/30 bg-card/95 backdrop-blur-md sticky top-0 z-50 shadow-sm">
          <ModuleHeader
            icon={Briefcase}
            title="Business Management"
            subtitle="Strategy, goals, and operational execution"
            searchPlaceholder="Search..."
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchTestId="input-business-search"
            titleTestId="business-title"
            onAIInsightsClick={openAiInsights}
          />

          <ScrollArea className="w-full">
          <div className="px-3 sm:px-4 flex items-center gap-1 pb-3 min-w-max sm:min-w-0 flex-wrap sm:flex-nowrap">
            {primaryTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 sm:gap-2 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors hover-elevate shrink-0",
                  activeTab === tab.id 
                    ? "bg-primary/10 text-primary shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                data-testid={`tab-${tab.id}`}
              >
                <tab.icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "inline-flex items-center gap-1.5 sm:gap-2 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors hover-elevate shrink-0",
                    isManageTab 
                      ? "bg-primary/10 text-primary shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  data-testid="tab-manage"
                >
                  {currentManageItem ? <currentManageItem.icon className="h-4 w-4 shrink-0" /> : <BizStrategyIcon className="h-4 w-4 shrink-0" />}
                  <span className="max-w-[80px] sm:max-w-none truncate">{currentManageItem?.label || "Manage"}</span>
                  <ChevronDown className="h-3 w-3 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {manageSubmenu.map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "gap-2 cursor-pointer",
                      activeTab === item.id && "bg-accent"
                    )}
                    data-testid={`menu-${item.id}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={() => setActiveTab("reviews")}
              className={cn(
                "inline-flex items-center gap-1.5 sm:gap-2 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors hover-elevate shrink-0",
                activeTab === "reviews"
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid="tab-reviews"
            >
              <BizExecutionIcon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Reviews</span>
            </button>
            <button
              onClick={() => setActiveTab("documents")}
              className={cn(
                "inline-flex items-center gap-1.5 sm:gap-2 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors hover-elevate shrink-0",
                activeTab === "documents" 
                  ? "bg-primary/10 text-primary shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid="tab-documents"
            >
              <BizDocumentsIcon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Documents</span>
            </button>

          </div>
          </ScrollArea>
        </div>

        <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto w-full min-w-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsContent value="dashboard" className="m-0 w-full min-w-0 max-w-full overflow-x-hidden">
                {tabLoading.dashboard ? (
                  <BusinessLoadingState variant="dashboard" />
                ) : (
                  <DashboardTab 
                    stats={stats} 
                    goals={goals} 
                    initiatives={initiatives} 
                    risks={risks}
                    strategyItems={strategyItems}
                    onNavigate={setActiveTab}
                  />
                )}
              </TabsContent>

              <TabsContent value="strategy-map" className="m-0 w-full min-w-0 max-w-full overflow-x-hidden">
                <StrategyMap />
              </TabsContent>

              <TabsContent value="strategy" className="m-0 w-full min-w-0 max-w-full overflow-x-hidden">
                <EnhancedStrategyTab
                  strategyItems={strategyItems as unknown as StrategyItemEx[]}
                  loading={tabLoading.strategy}
                  addButton={<AddStrategyButton onSave={(d) => createStrategyMutation.mutate(d)} isCreating={createStrategyMutation.isPending} />}
                />
              </TabsContent>

              <TabsContent value="goals" className="m-0 w-full min-w-0 max-w-full overflow-x-hidden">
                <EnhancedGoalsTab
                  goals={goals as unknown as GoalEx[]}
                  strategyItems={strategyItems as unknown as StrategyItemEx[]}
                  loading={tabLoading.goals}
                  addButton={<AddGoalButton strategyItems={strategyItems} onSave={(d) => createGoalMutation.mutate(d)} isCreating={createGoalMutation.isPending} />}
                />
              </TabsContent>

              <TabsContent value="operations" className="m-0 w-full min-w-0 max-w-full overflow-x-hidden">
                <OperationsTab 
                  departments={departments} 
                  processes={processes}
                  tools={tools}
                  onCreateDepartment={(data) => createDepartmentMutation.mutate(data)}
                  isCreating={createDepartmentMutation.isPending}
                />
              </TabsContent>

              <TabsContent value="initiatives" className="m-0 w-full min-w-0 max-w-full overflow-x-hidden">
                <EnhancedInitiativesTab
                  initiatives={initiatives as unknown as InitiativeEx[]}
                  goals={goals as unknown as GoalEx[]}
                  loading={tabLoading.initiatives}
                  addButton={<AddInitiativeButton goals={goals} onSave={(d) => createInitiativeMutation.mutate(d)} isCreating={createInitiativeMutation.isPending} />}
                />
              </TabsContent>

              <TabsContent value="objectives" className="m-0 w-full min-w-0 max-w-full overflow-x-hidden">
                <EnhancedObjectivesTab
                  objectives={objectives as unknown as ObjectiveEx[]}
                  goals={goals as unknown as GoalEx[]}
                  loading={tabLoading.objectives}
                />
              </TabsContent>

              <TabsContent value="okrs" className="m-0 w-full min-w-0 max-w-full overflow-x-hidden">
                <EnhancedOkrsTab
                  okrs={okrs as unknown as OkrEx[]}
                  objectives={objectives as unknown as ObjectiveEx[]}
                  goals={goals as unknown as GoalEx[]}
                  loading={tabLoading.okrs}
                />
              </TabsContent>

              <TabsContent value="kpis" className="m-0 w-full min-w-0 max-w-full overflow-x-hidden">
                <EnhancedKpisTab
                  kpis={kpis as unknown as KpiEx[]}
                  goals={goals as unknown as GoalEx[]}
                  loading={tabLoading.kpis}
                />
              </TabsContent>

              <TabsContent value="governance" className="m-0 w-full min-w-0 max-w-full overflow-x-hidden">
                <EnhancedGovernanceTab items={governanceItems} loading={tabLoading.governance} />
              </TabsContent>

              <TabsContent value="reviews" className="m-0 w-full min-w-0 max-w-full overflow-x-hidden">
                <ReviewsTab
                  strategyItems={strategyItems} goals={goals} objectives={objectives}
                  initiatives={initiatives} okrs={okrs} kpis={kpis}
                  entityRefs={entityRefs}
                />
              </TabsContent>

              <TabsContent value="documents" className="m-0 w-full min-w-0 max-w-full overflow-x-hidden">
                <DocumentsTab initiatives={initiatives} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Compact Add-record dialogs (passed as addButton props) ───────────────────

function AddStrategyButton({ onSave, isCreating }: {
  onSave: (d: { templateType: string; title: string; description?: string }) => void;
  isCreating: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ templateType: "strategy", title: "", description: "" });
  const [aiLoading, setAiLoading] = useState(false);
  const { toast } = useToast();

  const save = () => {
    if (!form.title || !form.templateType) return;
    onSave(form);
    setForm({ templateType: "strategy", title: "", description: "" });
    setOpen(false);
  };

  const suggestWithAI = async () => {
    if (!form.title.trim()) {
      toast({ title: "Enter a title first", description: "The AI needs a title to generate a description.", variant: "destructive" });
      return;
    }
    setAiLoading(true);
    try {
      const res = await apiRequest("POST", "/api/business/ai-assist", {
        type: form.templateType,
        title: form.title.trim(),
        action: "describe",
      });
      const data = await res.json();
      if (data.description) {
        setForm(f => ({ ...f, description: data.description }));
        toast({ title: "AI suggestion applied" });
      }
    } catch {
      toast({ title: "AI assist failed", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 gap-1.5 text-xs rounded-lg" data-testid="button-add-strategy">
          <Plus className="h-3.5 w-3.5" /> Add Strategy
        </Button>
      </DialogTrigger>
      <DialogContent>
        <SubmitForm onSubmit={save} disabled={isCreating || !form.title}>
        <DialogHeader><DialogTitle>Add Strategy Item</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label className="text-xs font-semibold">Type</Label>
            <Select value={form.templateType} onValueChange={v => setForm(f => ({ ...f, templateType: v }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[["strategy","Strategy"],["vision","Vision"],["target_market","Target Market"],["competitor","Competitor Analysis"],["swot","SWOT"],["risk","Strategic Risks"],["assumption","Assumptions"]].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs font-semibold">Title</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="h-8 text-sm" data-testid="input-strategy-title" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Description</Label>
              <Button
                type="button" variant="ghost" size="sm" className="h-6 gap-1 text-[10px] text-violet-600 hover:text-violet-700 hover:bg-violet-50 px-2"
                onClick={suggestWithAI} disabled={aiLoading}
                data-testid="button-ai-assist-description"
              >
                {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                AI Suggest
              </Button>
            </div>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="text-sm" data-testid="input-strategy-description" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline" size="sm">Cancel</Button></DialogClose>
          <Button type="submit" size="sm" data-testid="button-save-strategy">
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
          </Button>
        </DialogFooter>
        </SubmitForm>
      </DialogContent>
    </Dialog>
  );
}

function AddGoalButton({ strategyItems, onSave, isCreating }: {
  strategyItems: StrategyItem[];
  onSave: (d: { title: string; type: string; description?: string; strategyItemId?: number }) => void;
  isCreating: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", type: "objective", description: "", strategyItemId: "" });
  const save = () => {
    if (!form.title) return;
    onSave({ ...form, strategyItemId: form.strategyItemId ? Number(form.strategyItemId) : undefined });
    setForm({ title: "", type: "objective", description: "", strategyItemId: "" });
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 gap-1.5 text-xs rounded-lg" data-testid="button-add-goal">
          <Plus className="h-3.5 w-3.5" /> Add Goal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <SubmitForm onSubmit={save} disabled={isCreating || !form.title}>
        <DialogHeader><DialogTitle>Add Goal</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label className="text-xs font-semibold">Title</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="h-8 text-sm" data-testid="input-goal-title" />
          </div>
          <div className="space-y-1.5"><Label className="text-xs font-semibold">Linked Strategy</Label>
            <Select value={form.strategyItemId} onValueChange={v => setForm(f => ({ ...f, strategyItemId: v }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                {strategyItems.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs font-semibold">Description</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="text-sm" data-testid="input-goal-description" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline" size="sm">Cancel</Button></DialogClose>
          <Button type="submit" size="sm" data-testid="button-save-goal">
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
          </Button>
        </DialogFooter>
        </SubmitForm>
      </DialogContent>
    </Dialog>
  );
}

function AddInitiativeButton({ goals, onSave, isCreating }: {
  goals: Goal[];
  onSave: (d: { title: string; description?: string; goalId?: number; priority?: string }) => void;
  isCreating: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", goalId: "", priority: "medium" });
  const save = () => {
    if (!form.title) return;
    onSave({ ...form, goalId: form.goalId ? Number(form.goalId) : undefined });
    setForm({ title: "", description: "", goalId: "", priority: "medium" });
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 gap-1.5 text-xs rounded-lg" data-testid="button-add-initiative">
          <Plus className="h-3.5 w-3.5" /> Add Initiative
        </Button>
      </DialogTrigger>
      <DialogContent>
        <SubmitForm onSubmit={save} disabled={isCreating || !form.title}>
        <DialogHeader><DialogTitle>Add Initiative</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label className="text-xs font-semibold">Title</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="h-8 text-sm" data-testid="input-initiative-title" />
          </div>
          <div className="space-y-1.5"><Label className="text-xs font-semibold">Priority</Label>
            <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["low","medium","high","critical"].map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs font-semibold">Linked Goal</Label>
            <Select value={form.goalId} onValueChange={v => setForm(f => ({ ...f, goalId: v }))}>
              <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                {goals.map(g => <SelectItem key={g.id} value={String(g.id)}>{g.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs font-semibold">Description</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="text-sm" data-testid="input-initiative-description" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline" size="sm">Cancel</Button></DialogClose>
          <Button type="submit" size="sm" data-testid="button-save-initiative">
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
          </Button>
        </DialogFooter>
        </SubmitForm>
      </DialogContent>
    </Dialog>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────

function DashboardTab({ stats, goals, initiatives, risks, strategyItems, onNavigate }: { 
  stats?: BusinessStats; 
  goals: Goal[]; 
  initiatives: Initiative[];
  risks: Risk[];
  strategyItems: StrategyItem[];
  onNavigate?: (tab: string) => void;
}) {
  const metrics = [
    { title: "Strategy Items", value: stats?.strategyItems || 0, icon: Target, color: "bg-status-purple", testId: "strategy" },
    { title: "Goals", value: stats?.goals || 0, icon: Flag, color: "bg-status-green", testId: "goals", subtitle: `${stats?.goalsOnTrack || 0} on track` },
    { title: "Initiatives", value: stats?.initiatives || 0, icon: TrendingUp, color: "bg-status-blue", testId: "initiatives", subtitle: `${stats?.initiativesInProgress || 0} in progress` },
    { title: "Open Risks", value: stats?.openRisks || 0, icon: AlertTriangle, color: "bg-status-red", testId: "risks" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Live summary from your strategy data. To add or edit goals, KPIs, and initiatives, use Strategy Map
          or the Manage tabs — this dashboard updates automatically.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={() => onNavigate?.("strategy-map")}
          data-testid="button-business-dashboard-configure"
        >
          <Settings className="h-4 w-4" />
          Configure data
        </Button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {metrics.map((metric, i) => (
          <motion.div
            key={metric.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="rounded-xl sm:rounded-2xl border-border/20 shadow-sm hover:shadow-md transition-all h-full" data-testid={`card-metric-${metric.testId}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2 p-4 sm:p-6">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">
                  {metric.title}
                </CardTitle>
                <div className={cn("p-1.5 sm:p-2 rounded-lg shrink-0", metric.color)}>
                  <metric.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
                <div className="text-2xl sm:text-3xl font-bold" data-testid={`stat-${metric.testId}`}>{metric.value}</div>
                <p className="text-xs text-muted-foreground mt-1 min-h-[1rem]">{metric.subtitle || "\u00A0"}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl border-border/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-status-green" />
              Goal Progress
            </CardTitle>
            <CardDescription>Track progress toward your objectives</CardDescription>
          </CardHeader>
          <CardContent>
            {goals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No goals defined yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {goals.slice(0, 5).map((goal) => (
                  <div key={goal.id} className="space-y-2" data-testid={`goal-progress-${goal.id}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{goal.title}</span>
                      <Badge className={cn("text-xs", statusColors[goal.status])}>
                        {goal.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <Progress value={goal.progress || 0} className="h-2" />
                    <p className="text-xs text-muted-foreground text-right">{goal.progress || 0}%</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Insights
            </CardTitle>
            <CardDescription>Smart suggestions for your strategy</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-card/80 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-status-green/10">
                    <CheckCircle2 className="h-4 w-4 text-status-green" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Strong alignment</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {goals.length > 0 ? `${((stats?.goalsOnTrack || 0) / goals.length * 100).toFixed(0)}%` : "0%"} of goals are on track
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-card/80 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-status-amber/10">
                    <AlertTriangle className="h-4 w-4 text-status-amber" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Risk attention needed</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {stats?.openRisks || 0} open risks require review
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-card/80 backdrop-blur-sm">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-status-blue/10">
                    <TrendingUp className="h-4 w-4 text-status-blue" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Initiative momentum</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {stats?.initiativesInProgress || 0} initiatives actively in progress
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-status-red" />
            Strategic Risks
          </CardTitle>
          <CardDescription>Key risks requiring attention</CardDescription>
        </CardHeader>
        <CardContent>
          {risks.filter(r => r.status === "open").length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No open risks</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {risks.filter(r => r.status === "open").slice(0, 6).map((risk) => (
                <div key={risk.id} className="p-4 rounded-xl bg-muted/30 hover-elevate" data-testid={`risk-card-${risk.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-sm">{risk.title}</h4>
                    <Badge variant="outline" className="text-xs">
                      {risk.likelihood || "unknown"}
                    </Badge>
                  </div>
                  {risk.description && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{risk.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StrategyTab({ strategyItems, risks, onCreateStrategy, isCreating }: { 
  strategyItems: StrategyItem[]; 
  risks: Risk[];
  onCreateStrategy: (data: { templateType: string; title: string; description?: string }) => void;
  isCreating: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newItem, setNewItem] = useState({ templateType: "", title: "", description: "" });

  const handleCreate = () => {
    if (!newItem.templateType || !newItem.title) return;
    onCreateStrategy(newItem);
    setNewItem({ templateType: "", title: "", description: "" });
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Strategy Framework</h2>
          <p className="text-sm text-muted-foreground">Define your company's strategic direction</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl gap-2" data-testid="button-add-strategy">
              <Plus className="h-4 w-4" />
              Add Strategy Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <SubmitForm onSubmit={handleCreate} disabled={isCreating || !newItem.title || !newItem.templateType}>
            <DialogHeader>
              <DialogTitle>Add Strategy Item</DialogTitle>
              <DialogDescription>Create a new strategic element for your organization</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Template Type</Label>
                <Select value={newItem.templateType} onValueChange={(v) => setNewItem({ ...newItem, templateType: v })}>
                  <SelectTrigger data-testid="select-strategy-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {strategyTemplates.map((t) => (
                      <SelectItem key={t.type} value={t.type}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input 
                  placeholder="Enter title" 
                  value={newItem.title}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  data-testid="input-strategy-title"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  placeholder="Enter description" 
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  data-testid="input-strategy-description"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" data-testid="button-save-strategy">
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
            </DialogFooter>
            </SubmitForm>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {strategyTemplates.map((template) => {
          const items = strategyItems.filter(s => s.templateType === template.type);
          return (
            <Card key={template.type} className="rounded-2xl hover:shadow-md transition-all" data-testid={`strategy-template-${template.type}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", template.color)}>
                    <template.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <CardDescription>{items.length} items</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No items yet</p>
                ) : (
                  <div className="space-y-2">
                    {items.slice(0, 3).map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                        <span className="text-sm truncate">{item.title}</span>
                        <Badge className={cn("text-xs", statusColors[item.status])}>
                          {item.status.replace("_", " ")}
                        </Badge>
                      </div>
                    ))}
                    {items.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">+{items.length - 3} more</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function GoalsTab({ goals, keyResults, kpis, strategyItems, onCreateGoal, isCreating }: {
  goals: Goal[];
  keyResults: KeyResult[];
  kpis: Kpi[];
  strategyItems: StrategyItem[];
  onCreateGoal: (data: { title: string; type: string; description?: string; strategyItemId?: number }) => void;
  isCreating: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newGoal, setNewGoal] = useState({ title: "", type: "objective", description: "", strategyItemId: "" });

  const handleCreate = () => {
    if (!newGoal.title) return;
    onCreateGoal({
      ...newGoal,
      strategyItemId: newGoal.strategyItemId ? Number(newGoal.strategyItemId) : undefined,
    });
    setNewGoal({ title: "", type: "objective", description: "", strategyItemId: "" });
    setDialogOpen(false);
  };

  const objectives = goals.filter(g => g.type === "objective");
  const okrGoals = goals.filter(g => g.type === "okr");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Goals & OKRs</h2>
          <p className="text-sm text-muted-foreground">Define measurable success metrics</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl gap-2" data-testid="button-add-goal">
              <Plus className="h-4 w-4" />
              Add Goal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <SubmitForm onSubmit={handleCreate} disabled={isCreating || !newGoal.title}>
            <DialogHeader>
              <DialogTitle>Add Goal</DialogTitle>
              <DialogDescription>Create a new objective or OKR</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={newGoal.type} onValueChange={(v) => setNewGoal({ ...newGoal, type: v })}>
                  <SelectTrigger data-testid="select-goal-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="objective">Objective</SelectItem>
                    <SelectItem value="okr">OKR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Title</Label>
                <Input 
                  placeholder="Enter goal title" 
                  value={newGoal.title}
                  onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                  data-testid="input-goal-title"
                />
              </div>
              <div className="space-y-2">
                <Label>Linked Strategy (Optional)</Label>
                <Select value={newGoal.strategyItemId} onValueChange={(v) => setNewGoal({ ...newGoal, strategyItemId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Link to strategy item" />
                  </SelectTrigger>
                  <SelectContent>
                    {strategyItems.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  placeholder="Enter description" 
                  value={newGoal.description}
                  onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                  data-testid="input-goal-description"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" data-testid="button-save-goal">
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
            </DialogFooter>
            </SubmitForm>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-status-green" />
              Objectives ({objectives.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {objectives.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No objectives defined</p>
            ) : (
              <div className="space-y-3">
                {objectives.map((goal) => (
                  <div key={goal.id} className="p-4 rounded-xl bg-muted/30 hover-elevate" data-testid={`objective-${goal.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium">{goal.title}</h4>
                      <Badge className={cn("text-xs", statusColors[goal.status])}>
                        {goal.status.replace("_", " ")}
                      </Badge>
                    </div>
                    {goal.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{goal.description}</p>
                    )}
                    <div className="mt-3">
                      <Progress value={goal.progress || 0} className="h-2" />
                      <p className="text-xs text-muted-foreground text-right mt-1">{goal.progress || 0}%</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-status-purple" />
              KPIs ({kpis.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kpis.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No KPIs defined</p>
            ) : (
              <div className="space-y-3">
                {kpis.map((kpi) => (
                  <div key={kpi.id} className="p-4 rounded-xl bg-muted/30" data-testid={`kpi-${kpi.id}`}>
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{kpi.name}</h4>
                      <Badge className={cn("text-xs", statusColors[kpi.status || "on_track"])}>
                        {(kpi.status || "on_track").replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-sm">
                      <span className="text-muted-foreground">Current: {kpi.currentValue || 0} {kpi.unit}</span>
                      <span className="font-medium">Target: {kpi.targetValue || 0} {kpi.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OperationsTab({ departments, processes, tools, onCreateDepartment, isCreating }: {
  departments: Department[];
  processes: Process[];
  tools: Tool[];
  onCreateDepartment: (data: { name: string; description?: string }) => void;
  isCreating: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newDept, setNewDept] = useState({ name: "", description: "" });

  const handleCreate = () => {
    if (!newDept.name) return;
    onCreateDepartment(newDept);
    setNewDept({ name: "", description: "" });
    setDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Operations</h2>
          <p className="text-sm text-muted-foreground">Manage departments, processes, and tools</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl gap-2" data-testid="button-add-department">
              <Plus className="h-4 w-4" />
              Add Department
            </Button>
          </DialogTrigger>
          <DialogContent>
            <SubmitForm onSubmit={handleCreate} disabled={isCreating || !newDept.name}>
            <DialogHeader>
              <DialogTitle>Add Department</DialogTitle>
              <DialogDescription>Create a new department for your organization</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input 
                  placeholder="Enter department name" 
                  value={newDept.name}
                  onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                  data-testid="input-department-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  placeholder="Enter description" 
                  value={newDept.description}
                  onChange={(e) => setNewDept({ ...newDept, description: e.target.value })}
                  data-testid="input-department-description"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" data-testid="button-save-department">
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
            </DialogFooter>
            </SubmitForm>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-status-purple" />
              Departments ({departments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {departments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No departments defined</p>
            ) : (
              <div className="space-y-2">
                {departments.map((dept) => (
                  <div key={dept.id} className="p-3 rounded-xl bg-muted/30 hover-elevate" data-testid={`department-${dept.id}`}>
                    <h4 className="font-medium">{dept.name}</h4>
                    {dept.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{dept.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Workflow className="h-5 w-5 text-status-blue" />
              Processes ({processes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {processes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No processes defined</p>
            ) : (
              <div className="space-y-2">
                {processes.map((process) => (
                  <div key={process.id} className="p-3 rounded-xl bg-muted/30 hover-elevate" data-testid={`process-${process.id}`}>
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{process.name}</h4>
                      {process.isCritical && (
                        <Badge variant="destructive" className="text-xs">Critical</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-status-amber" />
              Tools & Systems ({tools.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tools.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No tools defined</p>
            ) : (
              <div className="space-y-2">
                {tools.map((tool) => (
                  <div key={tool.id} className="p-3 rounded-xl bg-muted/30 hover-elevate" data-testid={`tool-${tool.id}`}>
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{tool.name}</h4>
                      <Badge variant="outline" className="text-xs">{tool.category || "Other"}</Badge>
                    </div>
                    {tool.vendor && (
                      <p className="text-xs text-muted-foreground mt-1">{tool.vendor}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InitiativesTab({ initiatives, goals, onCreateInitiative, isCreating }: {
  initiatives: Initiative[];
  goals: Goal[];
  onCreateInitiative: (data: { title: string; description?: string; goalId?: number; priority?: string }) => void;
  isCreating: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newInit, setNewInit] = useState({ title: "", description: "", goalId: "", priority: "medium" });

  const handleCreate = () => {
    if (!newInit.title) return;
    onCreateInitiative({
      ...newInit,
      goalId: newInit.goalId ? Number(newInit.goalId) : undefined,
    });
    setNewInit({ title: "", description: "", goalId: "", priority: "medium" });
    setDialogOpen(false);
  };

  const priorityColors: Record<string, string> = {
    low: "bg-muted text-muted-foreground",
    medium: "bg-status-amber text-status-amber-foreground",
    high: "bg-status-red text-status-red-foreground",
    critical: "bg-destructive text-destructive-foreground",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Initiatives & Execution</h2>
          <p className="text-sm text-muted-foreground">Track work that supports your goals</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl gap-2" data-testid="button-add-initiative">
              <Plus className="h-4 w-4" />
              Add Initiative
            </Button>
          </DialogTrigger>
          <DialogContent>
            <SubmitForm onSubmit={handleCreate} disabled={isCreating || !newInit.title}>
            <DialogHeader>
              <DialogTitle>Add Initiative</DialogTitle>
              <DialogDescription>Create a new initiative to support your goals</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input 
                  placeholder="Enter initiative title" 
                  value={newInit.title}
                  onChange={(e) => setNewInit({ ...newInit, title: e.target.value })}
                  data-testid="input-initiative-title"
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={newInit.priority} onValueChange={(v) => setNewInit({ ...newInit, priority: v })}>
                  <SelectTrigger data-testid="select-initiative-priority">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Linked Goal (Optional)</Label>
                <Select value={newInit.goalId} onValueChange={(v) => setNewInit({ ...newInit, goalId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Link to goal" />
                  </SelectTrigger>
                  <SelectContent>
                    {goals.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>{g.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  placeholder="Enter description" 
                  value={newInit.description}
                  onChange={(e) => setNewInit({ ...newInit, description: e.target.value })}
                  data-testid="input-initiative-description"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" data-testid="button-save-initiative">
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
              </Button>
            </DialogFooter>
            </SubmitForm>
          </DialogContent>
        </Dialog>
      </div>

      {initiatives.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center">
            <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">No initiatives yet. Create your first initiative to start tracking execution.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {initiatives.map((initiative) => {
            const linkedGoal = goals.find(g => g.id === initiative.goalId);
            return (
              <Card key={initiative.id} className="rounded-2xl hover:shadow-md transition-all" data-testid={`initiative-card-${initiative.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base line-clamp-2">{initiative.title}</CardTitle>
                    <Badge className={cn("text-xs shrink-0", priorityColors[initiative.priority || "medium"])}>
                      {initiative.priority || "medium"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {initiative.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{initiative.description}</p>
                  )}
                  <div className="space-y-3">
                    <div>
                      <Progress value={initiative.progress || 0} className="h-2" />
                      <div className="flex items-center justify-between mt-1">
                        <Badge className={cn("text-xs", statusColors[initiative.status])}>
                          {initiative.status.replace("_", " ")}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{initiative.progress || 0}%</span>
                      </div>
                    </div>
                    {linkedGoal && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Link2 className="h-3 w-3" />
                        <span className="truncate">{linkedGoal.title}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlaceholderTab({ title, description, icon: Icon }: { 
  title: string; 
  description: string;
  icon: typeof Target;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" data-testid={`title-${title.toLowerCase()}`}>{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button className="gap-2 whitespace-nowrap" data-testid={`button-add-${title.toLowerCase()}`}>
          <Plus className="h-4 w-4" />
          Add {title.endsWith('s') ? title.slice(0, -1) : title}
        </Button>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-12 text-center">
          <Icon className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground">No {title.toLowerCase()} yet. This feature is coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── OBJECTIVES TAB ──────────────────────────────────────────────────────────

function ObjectivesTab({ objectives, goals }: { objectives: Objective[]; goals: Goal[] }) {
  const ragBadge = (r: string | null) => {
    const label = r === "green" ? "On Track" : r === "amber" ? "At Risk" : r === "red" ? "Behind" : r || "—";
    const cls = r === "green" ? "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400" :
      r === "amber" ? "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400" :
      r === "red" ? "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400" : "bg-muted text-muted-foreground";
    return <Badge className={cn("text-[10px] font-semibold border-0", cls)}>{label}</Badge>;
  };

  const cols: ColumnDef<Objective>[] = [
    { key: "title", label: "Objective", width: "30%", render: (r) => <span className="font-medium text-sm">{r.title}</span> },
    { key: "goalId", label: "Parent Goal", width: "22%", render: (r) => { const g = goals.find(g => g.id === r.goalId); return g ? <span className="text-xs text-muted-foreground">{g.title}</span> : <span className="text-muted-foreground/40">—</span>; } },
    { key: "ownerName", label: "Owner", width: "13%", render: (r) => <span className="text-xs">{r.ownerName || "—"}</span> },
    { key: "ragStatus", label: "RAG", width: "10%", render: (r) => ragBadge(r.ragStatus) },
    { key: "progress", label: "Progress", width: "17%", render: (r) => (
      <div className="flex items-center gap-2">
        <Progress value={r.progress || 0} className="h-1.5 flex-1" />
        <span className="text-[10px] text-muted-foreground w-7 text-right">{r.progress || 0}%</span>
      </div>
    )},
    { key: "targetDate", label: "Target Date", width: "12%", render: (r) => <span className="text-xs text-muted-foreground">{r.targetDate || "—"}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Objectives</h2>
          <p className="text-sm text-muted-foreground">{objectives.length} objectives across all goals</p>
        </div>
      </div>
      {objectives.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center">
            <Crosshair className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">No objectives yet. Create them from the Strategy Map or Manage tabs.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="w-full max-w-full min-w-0 overflow-x-hidden">
          <MondayTable data={objectives} columns={cols} rowTestId="objective-row" />
        </div>
      )}
    </div>
  );
}

// ─── OKRs TAB ─────────────────────────────────────────────────────────────────

function OkrsTab({ okrs, goals, objectives }: { okrs: Okr[]; goals: Goal[]; objectives: Objective[] }) {
  const ragBadge = (r: string | null) => {
    const label = r === "green" ? "On Track" : r === "amber" ? "At Risk" : r === "red" ? "Behind" : r || "—";
    const cls = r === "green" ? "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400" :
      r === "amber" ? "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400" :
      r === "red" ? "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400" : "bg-muted text-muted-foreground";
    return <Badge className={cn("text-[10px] font-semibold border-0", cls)}>{label}</Badge>;
  };

  const cols: ColumnDef<Okr>[] = [
    { key: "title", label: "OKR Title", width: "28%", render: (r) => <span className="font-medium text-sm">{r.title}</span> },
    { key: "objectiveId", label: "Objective", width: "22%", render: (r) => { const o = objectives.find(o => o.id === r.objectiveId); return o ? <span className="text-xs text-muted-foreground">{o.title}</span> : <span className="text-muted-foreground/40">—</span>; } },
    { key: "goalId", label: "Goal", width: "18%", render: (r) => { const g = goals.find(g => g.id === r.goalId); return g ? <span className="text-xs text-muted-foreground">{g.title}</span> : <span className="text-muted-foreground/40">—</span>; } },
    { key: "ownerName", label: "Owner", width: "12%", render: (r) => <span className="text-xs">{r.ownerName || "—"}</span> },
    { key: "ragStatus", label: "RAG", width: "10%", render: (r) => ragBadge(r.ragStatus) },
    { key: "targetDate", label: "Target Date", width: "12%", render: (r) => <span className="text-xs text-muted-foreground">{r.targetDate || "—"}</span> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">OKRs</h2>
          <p className="text-sm text-muted-foreground">{okrs.length} Objectives and Key Results</p>
        </div>
      </div>
      {okrs.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">No OKRs yet. Define them in the Strategy Map or Manage tabs.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="w-full max-w-full min-w-0 overflow-x-hidden">
          <MondayTable data={okrs} columns={cols} rowTestId="okr-row" />
        </div>
      )}
    </div>
  );
}

// ─── KPIs TAB ─────────────────────────────────────────────────────────────────

function KpisTab({ kpis, goals }: { kpis: Kpi[]; goals: Goal[] }) {
  const statusBadge = (s: string | null) => {
    const label = s === "on_track" ? "On Track" : s === "at_risk" ? "At Risk" : s === "off_track" ? "Off Track" : s || "—";
    const cls = s === "on_track" ? "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400" :
      s === "at_risk" ? "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400" :
      s === "off_track" ? "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400" : "bg-muted text-muted-foreground";
    return <Badge className={cn("text-[10px] font-semibold border-0", cls)}>{label}</Badge>;
  };

  const cols: ColumnDef<Kpi>[] = [
    { key: "name", label: "KPI Name", width: "25%", render: (r) => <span className="font-medium text-sm">{r.name}</span> },
    { key: "goalId", label: "Linked Goal", width: "22%", render: (r) => { const g = goals.find(g => g.id === r.goalId); return g ? <span className="text-xs text-muted-foreground">{g.title}</span> : <span className="text-muted-foreground/40">—</span>; } },
    { key: "indicatorType", label: "Type", width: "10%", render: (r) => <span className="text-xs capitalize">{r.indicatorType || "—"}</span> },
    { key: "currentValue", label: "Current", width: "10%", render: (r) => <span className="text-xs font-mono">{r.currentValue ?? "—"}{r.unit ? ` ${r.unit}` : ""}</span> },
    { key: "targetValue", label: "Target", width: "10%", render: (r) => <span className="text-xs font-mono text-muted-foreground">{r.targetValue ?? "—"}{r.unit ? ` ${r.unit}` : ""}</span> },
    { key: "status", label: "Status", width: "11%", render: (r) => statusBadge(r.status) },
    { key: "trend", label: "Trend", width: "10%", render: (r) => (
      <span className={cn("text-xs font-semibold",
        r.trend === "up" ? "text-green-600" : r.trend === "down" ? "text-red-500" : "text-muted-foreground"
      )}>{r.trend === "up" ? "↑ Up" : r.trend === "down" ? "↓ Down" : r.trend || "—"}</span>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">KPIs</h2>
          <p className="text-sm text-muted-foreground">{kpis.length} Key Performance Indicators</p>
        </div>
      </div>
      {kpis.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">No KPIs yet. Add KPIs from the Manage tab or Strategy Map.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="w-full max-w-full min-w-0 overflow-x-hidden">
          <MondayTable data={kpis} columns={cols} rowTestId="kpi-row" />
        </div>
      )}
    </div>
  );
}

// ─── EXECUTION TAB ────────────────────────────────────────────────────────────

const ENTITY_BADGE_CLS: Record<string, string> = {
  strategy:   "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  goal:       "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  objective:  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  initiative: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  okr:        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  kpi:        "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  governance: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
};

const REVIEW_REF_PREFIX: Record<string, string> = {
  strategy: "S", goal: "G", objective: "OBJ", initiative: "INI", okr: "OKR", kpi: "KPI", governance: "GOV",
};

function reviewRefCode(entityType: string, entityId: number, entityRefs?: Record<string, number>) {
  const prefix = REVIEW_REF_PREFIX[entityType] ?? entityType.toUpperCase().slice(0, 3);
  const seq = entityRefs?.[`${entityType}-${entityId}`];
  return `${prefix}-${String(seq ?? entityId).padStart(3, "0")}`;
}

function reviewFeedDate(d: string) {
  try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return d; }
}

function ReviewStatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-3.5 flex items-center gap-3">
        <Icon className={cn("h-5 w-5 shrink-0", color)} />
        <div>
          <p className={cn("text-xl font-bold tabular-nums leading-none", color)}>{value}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function OverdueCard({ item }: { item: OverdueItem }) {
  const ragCls = item.ragStatus === "red"
    ? "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900"
    : item.ragStatus === "amber"
    ? "border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900"
    : "border-border bg-card";
  return (
    <div className={cn("rounded-lg border p-2.5 flex items-center justify-between gap-2", ragCls)}>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-medium text-muted-foreground capitalize">{item.type}</span>
          {item.ragStatus && <RagChip rag={item.ragStatus} />}
        </div>
        <p className="text-xs font-medium truncate">{item.title}</p>
        {item.ownerName && <p className="text-[10px] text-muted-foreground mt-0.5">{item.ownerName}</p>}
      </div>
      {item.nextReviewDate && (
        <div className="text-right shrink-0">
          <p className="text-[10px] text-muted-foreground">Due</p>
          <p className="text-[10px] font-medium text-destructive">{item.nextReviewDate}</p>
        </div>
      )}
    </div>
  );
}

const REVIEWS_PAGE_SIZE = 20;

function ReviewsTab({
  strategyItems, goals, objectives, initiatives, okrs, kpis, entityRefs,
}: {
  strategyItems: StrategyItem[]; goals: Goal[]; objectives: Objective[];
  initiatives: Initiative[]; okrs: Okr[]; kpis: Kpi[];
  entityRefs?: Record<string, number>;
}) {
  const [entityFilter, setEntityFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data: allNotesRaw, isLoading: notesLoading } = useQuery<ReviewNote[]>({
    queryKey: ["/api/business/review-notes"],
  });
  const allNotes = useMemo(
    () => (Array.isArray(allNotesRaw) ? allNotesRaw : []),
    [allNotesRaw],
  );

  const { data: overdueItemsRaw, isLoading: overdueLoading } = useQuery<OverdueItem[]>({
    queryKey: ["/api/business/overdue-reviews"],
  });
  const overdueItems = useMemo(
    () => (Array.isArray(overdueItemsRaw) ? overdueItemsRaw : []),
    [overdueItemsRaw],
  );

  const titleMap = useMemo<Record<string, Record<number, string>>>(() => ({
    strategy:   Object.fromEntries(strategyItems.map(s => [s.id, s.title])),
    goal:       Object.fromEntries(goals.map(g => [g.id, g.title])),
    objective:  Object.fromEntries(objectives.map(o => [o.id, o.title])),
    initiative: Object.fromEntries(initiatives.map(i => [i.id, i.title])),
    okr:        Object.fromEntries(okrs.map(o => [o.id, o.title])),
    kpi:        Object.fromEntries(kpis.map(k => [k.id, k.name])),
  }), [strategyItems, goals, objectives, initiatives, okrs, kpis]);

  const filteredNotes = useMemo(() =>
    entityFilter === "all" ? [...allNotes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      : allNotes.filter(n => n.entityType === entityFilter).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  [allNotes, entityFilter]);

  const paginatedNotes = useMemo(() => filteredNotes.slice(0, page * REVIEWS_PAGE_SIZE), [filteredNotes, page]);
  const hasMore = paginatedNotes.length < filteredNotes.length;

  const totalCheckins = allNotes.length;
  const overdueCount = overdueItems.length;
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const reviewedThisWeekSet = new Set(
    allNotes.filter(n => new Date(n.createdAt).getTime() > oneWeekAgo)
      .map(n => `${n.entityType}-${n.entityId}`)
  );
  const reviewedThisWeek = reviewedThisWeekSet.size;

  // Anomaly detection: items with consecutive red/amber check-ins
  const anomalies = useMemo(() => {
    const now = Date.now();
    const result: Array<{ type: string; title: string; reason: string; severity: "high" | "medium" }> = [];

    // Initiatives overdue and not completed
    initiatives.filter(i => i.endDate && new Date(i.endDate).getTime() < now && i.status !== "completed").forEach(i => {
      const daysOverdue = Math.round((now - new Date(i.endDate!).getTime()) / 86400000);
      result.push({ type: "initiative", title: i.title, reason: `${daysOverdue}d overdue`, severity: daysOverdue > 30 ? "high" : "medium" });
    });

    // Goals with low progress and upcoming target
    goals.filter(g => {
      if (!g.targetDate) return false;
      const daysLeft = (new Date(g.targetDate).getTime() - now) / 86400000;
      return daysLeft > 0 && daysLeft < 30 && (g.progress ?? 0) < 25;
    }).forEach(g => {
      const daysLeft = Math.round((new Date(g.targetDate!).getTime() - now) / 86400000);
      result.push({ type: "goal", title: g.title, reason: `${(g.progress ?? 0)}% progress, ${daysLeft}d to target`, severity: "high" });
    });

    // Items with consecutive red check-ins
    const redStreaks = new Map<string, number>();
    [...allNotes].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).forEach(n => {
      const key = `${n.entityType}-${n.entityId}`;
      if (n.ragSnapshot === "red") {
        redStreaks.set(key, (redStreaks.get(key) ?? 0) + 1);
      } else if (n.ragSnapshot === "green") {
        redStreaks.delete(key);
      }
    });
    redStreaks.forEach((count, key) => {
      if (count >= 2) {
        const [et, eid] = key.split("-");
        const title = titleMap[et]?.[Number(eid)] ?? `${et} #${eid}`;
        result.push({ type: et, title, reason: `Red for ${count} consecutive check-ins`, severity: count >= 3 ? "high" : "medium" });
      }
    });

    return result.slice(0, 8);
  }, [initiatives, goals, allNotes, titleMap]);

  const getTitle = (entityType: string, entityId: number) => {
    const map = titleMap[entityType];
    return map?.[entityId] ?? `${ENTITY_LABELS[entityType] ?? entityType} #${entityId}`;
  };

  if (notesLoading || overdueLoading) {
    return <BusinessLoadingState variant="panel" label="Loading reviews…" />;
  }

  return (
    <div className="space-y-4 sm:space-y-5 w-full min-w-0 max-w-full">
      <div>
        <h2 className="text-base sm:text-lg font-semibold">Reviews &amp; Check-ins</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">Cross-layer progress log — check-ins across all 7 layers including Governance</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ReviewStatCard icon={MessageSquarePlus} label="Total check-ins" value={totalCheckins} color="text-primary" />
        <ReviewStatCard icon={Bell} label="Overdue reviews" value={overdueCount} color={overdueCount > 0 ? "text-destructive" : "text-muted-foreground"} />
        <ReviewStatCard icon={Clock} label="Unique items reviewed this week" value={reviewedThisWeek} color="text-emerald-600 dark:text-emerald-400" />
      </div>

      {/* Anomaly Detection Panel */}
      {anomalies.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-violet-500" />
            <span className="text-violet-700 dark:text-violet-400">Anomalies Detected</span>
            <span className="font-normal text-muted-foreground">· {anomalies.length} flag{anomalies.length !== 1 ? "s" : ""}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {anomalies.map((a, i) => (
              <div key={i} className={cn(
                "rounded-xl border p-3 space-y-1",
                a.severity === "high" ? "border-red-200 bg-red-50 dark:border-red-800/30 dark:bg-red-900/10" : "border-amber-200 bg-amber-50 dark:border-amber-800/30 dark:bg-amber-900/10"
              )}>
                <div className="flex items-start gap-2">
                  <TriangleAlert className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", a.severity === "high" ? "text-red-500" : "text-amber-500")} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{a.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", ENTITY_BADGE_CLS[a.type] ?? "bg-muted text-muted-foreground")}>
                        {ENTITY_LABELS[a.type] ?? a.type}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{a.reason}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Needs Attention */}
      {overdueItems.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" /> Needs Attention
            <span className="font-normal text-muted-foreground">· {overdueItems.length} item{overdueItems.length !== 1 ? "s" : ""} overdue for review</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {overdueItems.slice(0, 6).map(item => <OverdueCard key={`${item.type}-${item.id}`} item={item} />)}
          </div>
        </div>
      )}

      {/* Entity type filter */}
      <div className="flex items-center gap-1 flex-wrap border-b border-border pb-2">
        {[{ value: "all", label: "All" }, ...ENTITY_OPTIONS].map(opt => {
          const count = opt.value === "all" ? totalCheckins : allNotes.filter(n => n.entityType === opt.value).length;
          return (
            <button
              key={opt.value}
              onClick={() => { setEntityFilter(opt.value); setPage(1); }}
              className={cn(
                "text-xs font-medium px-2.5 py-1 rounded-lg transition-colors",
                entityFilter === opt.value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
              )}
              data-testid={`filter-reviews-${opt.value}`}
            >
              {opt.label} <span className="opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Feed */}
      {filteredNotes.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center">
            <MessageSquarePlus className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground text-sm">No check-ins yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Use the speech bubble icon on any item row to log the first check-in.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {paginatedNotes.map(note => {
            const badgeCls = ENTITY_BADGE_CLS[note.entityType] ?? "bg-muted text-muted-foreground";
            const title = getTitle(note.entityType, note.entityId);
            return (
              <div key={note.id} className="rounded-xl border border-border bg-card p-4 space-y-2"
                data-testid={`review-note-${note.id}`}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize shrink-0", badgeCls)}>
                      {ENTITY_LABELS[note.entityType] ?? note.entityType}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">{reviewRefCode(note.entityType, note.entityId, entityRefs)}</span>
                    <span className="text-xs font-medium line-clamp-1">{title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {note.ragSnapshot && <RagChip rag={note.ragSnapshot} />}
                    <span className="text-[10px] text-muted-foreground">{reviewFeedDate(note.createdAt)}</span>
                  </div>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap line-clamp-4">{note.content}</p>
                {(note as any).progressAtCheckin != null && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-muted-foreground">Progress at check-in:</span>
                    <div className="flex-1 max-w-[120px] h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(note as any).progressAtCheckin}%` }} />
                    </div>
                    <span className="text-[10px] font-semibold">{(note as any).progressAtCheckin}%</span>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">— {note.authorName}</p>
              </div>
            );
          })}
          {hasMore && (
            <button
              onClick={() => setPage(p => p + 1)}
              className="w-full text-xs text-primary hover:underline py-2 rounded-xl border border-dashed border-border hover:bg-muted/30 transition-colors"
            >
              Load more ({filteredNotes.length - paginatedNotes.length} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── DOCUMENT TABLE ROW ───────────────────────────────────────────────────────

type DocTableRow = {
  id: number;
  title: string;
  linkType: string;
  docType: string;
  status: string;
  initiative: string;
  initiativeId: number;
  documentId: number;
  createdAt: string;
  notes: string;
};

const linkTypeLabels: Record<string, string> = {
  sow: "Statement of Work",
  msa: "Master Service Agreement",
  deliverable: "Deliverable",
  reference: "Reference",
  user_guide: "User Guide",
  training_guide: "Training Guide",
  requirements: "Requirements",
  proposal: "Proposal",
  other: "Other",
};

const docTypeLabels: Record<string, string> = {
  page: "Page",
  article: "Article",
  template: "Template",
  document: "Document",
  sow: "Statement of Work",
  msa: "Master Service Agreement",
  user_guide: "User Guide",
  training_guide: "Training Guide",
  proposal: "Proposal",
  requirements: "Requirements",
};

type StrategyDocLink = {
  id: number; tenantId: number; layerType: string; layerItemId: number;
  docType: string; externalUrl: string | null; externalTitle: string | null;
  externalDescription: string | null; jigantoDocumentId: number | null;
  fileUrl: string | null; fileName: string | null; addedByName: string | null;
  createdAt: string;
};

const DOC_SOURCE_TYPES = [
  { value: "external", label: "External URL", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  { value: "file", label: "Uploaded File", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  { value: "jiganto", label: "Jiganto Link", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
];

function StrategyLinksPanel() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [filterLayer, setFilterLayer] = useState("all");
  const [filterSource, setFilterSource] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState({
    layerType: "strategy",
    layerItemId: "",
    docType: "external",
    jigantoDocId: "",
    externalUrl: "",
    externalTitle: "",
    externalDescription: "",
  });

  const { data: jigantoDocuments = [] } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  const { data: links = [], isLoading } = useQuery<StrategyDocLink[]>({
    queryKey: ["/api/business/doc-links"],
  });

  const addMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest("POST", "/api/business/doc-links", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/doc-links"] });
      setForm({
        layerType: "strategy",
        layerItemId: "",
        docType: "external",
        jigantoDocId: "",
        externalUrl: "",
        externalTitle: "",
        externalDescription: "",
      });
      setAddOpen(false);
      toast({ title: "Link added" });
    },
    onError: () => toast({ title: "Failed to add link", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/business/doc-links/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/doc-links"] });
      toast({ title: "Link removed" });
    },
  });

  const save = () => {
    if (!form.layerItemId) return;
    if (form.docType === "jiganto") {
      if (!form.jigantoDocId) return;
      const doc = jigantoDocuments.find((d) => d.id === Number(form.jigantoDocId));
      addMutation.mutate({
        layerType: form.layerType,
        layerItemId: Number(form.layerItemId),
        docType: "jiganto",
        jigantoDocumentId: Number(form.jigantoDocId),
        externalUrl: documentModuleUrl(Number(form.jigantoDocId)),
        externalTitle: form.externalTitle.trim() || doc?.title || null,
        externalDescription: form.externalDescription.trim() || null,
      });
      return;
    }
    if (!form.externalUrl.trim()) return;
    addMutation.mutate({
      layerType: form.layerType,
      layerItemId: Number(form.layerItemId),
      docType: form.docType,
      externalUrl: form.externalUrl.trim(),
      externalTitle: form.externalTitle.trim() || null,
      externalDescription: form.externalDescription.trim() || null,
    });
  };

  const canSaveLink =
    !!form.layerItemId &&
    (form.docType === "jiganto" ? !!form.jigantoDocId : !!form.externalUrl.trim());

  const filtered = useMemo(() => links.filter(link => {
    if (filterLayer !== "all" && link.layerType !== filterLayer) return false;
    if (filterSource !== "all" && link.docType !== filterSource) return false;
    if (searchTerm) {
      const sl = searchTerm.toLowerCase();
      const text = [link.externalTitle, link.externalUrl, link.externalDescription, link.fileName].filter(Boolean).join(" ").toLowerCase();
      if (!text.includes(sl)) return false;
    }
    return true;
  }), [links, filterLayer, filterSource, searchTerm]);

  const linksPagination = useTablePagination(filtered, {
    resetKey: `${filterLayer}-${filterSource}-${searchTerm}`,
    enabled: !isLoading,
  });

  if (isLoading) {
    return <BusinessLoadingState variant="inline" label="Loading strategy links…" />;
  }

  const sourceLabel = (t: string) => DOC_SOURCE_TYPES.find(s => s.value === t)?.label ?? t;
  const sourceCls = (t: string) => DOC_SOURCE_TYPES.find(s => s.value === t)?.color ?? "bg-muted text-muted-foreground";

  return (
    <div className="space-y-3 w-full min-w-0 max-w-full">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
          <div className="relative min-w-[180px] flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search links…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 h-8 text-xs" />
          </div>
          <Select value={filterLayer} onValueChange={setFilterLayer}>
            <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue placeholder="All Layers" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Layers</SelectItem>
              {ENTITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="h-8 text-xs w-[150px]"><SelectValue placeholder="All Sources" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {DOC_SOURCE_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <Button size="sm" className="h-8 gap-1.5 text-xs shrink-0" onClick={() => setAddOpen(true)} data-testid="button-add-strategy-link">
            <Plus className="h-3 w-3" /> Add Link
          </Button>
          <DialogContent className="max-w-md">
            <SubmitForm onSubmit={save} disabled={addMutation.isPending || !canSaveLink}>
            <DialogHeader><DialogTitle>Add Document Link</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1"><Label className="text-xs">Source Type</Label>
                <Select value={form.docType} onValueChange={v => setForm(f => ({ ...f, docType: v, jigantoDocId: "", externalUrl: "" }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_SOURCE_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">Layer Type</Label>
                  <Select value={form.layerType} onValueChange={v => setForm(f => ({ ...f, layerType: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ENTITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">Item ID</Label>
                  <Input type="number" placeholder="e.g. 1" value={form.layerItemId} onChange={e => setForm(f => ({ ...f, layerItemId: e.target.value }))} className="h-8 text-xs" />
                </div>
              </div>
              {form.docType === "jiganto" ? (
                <div className="space-y-1">
                  <Label className="text-xs">Jiganto document *</Label>
                  <Select value={form.jigantoDocId} onValueChange={v => setForm(f => ({ ...f, jigantoDocId: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Choose document…" /></SelectTrigger>
                    <SelectContent>
                      {jigantoDocuments.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>{d.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1"><Label className="text-xs">URL / Path *</Label>
                  <Input placeholder="https://..." value={form.externalUrl} onChange={e => setForm(f => ({ ...f, externalUrl: e.target.value }))} className="h-8 text-xs" />
                </div>
              )}
              <div className="space-y-1"><Label className="text-xs">Title / Label (optional)</Label>
                <Input placeholder="Descriptive name" value={form.externalTitle} onChange={e => setForm(f => ({ ...f, externalTitle: e.target.value }))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1"><Label className="text-xs">Description (optional)</Label>
                <Textarea placeholder="Brief description…" value={form.externalDescription} onChange={e => setForm(f => ({ ...f, externalDescription: e.target.value }))} rows={2} className="text-xs resize-none" />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline" size="sm">Cancel</Button></DialogClose>
              <Button type="submit" size="sm">
                {addMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null} Add Link
              </Button>
            </DialogFooter>
            </SubmitForm>
          </DialogContent>
        </Dialog>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Link2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm font-medium mb-1">{links.length === 0 ? "No links yet" : "No results"}</p>
          <p className="text-xs text-muted-foreground">{links.length === 0 ? "Add external URLs, file paths, or Jiganto module links to any strategy layer item." : "Adjust your filters to see more results."}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card w-full min-w-0 max-w-full">
          <BusinessTableScroll minWidth={720}>
          <table className="text-xs w-max min-w-full table-auto">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-[110px]">Source</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-[110px]">Layer</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Title / URL</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-[120px]">Added By</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-[90px]">Date</th>
                <th className="w-[40px]" />
              </tr>
            </thead>
            <tbody>
              {linksPagination.paginatedItems.map((link, i) => (
                <tr key={link.id} className={cn("border-b border-border last:border-0", i % 2 === 0 ? "bg-background" : "bg-muted/20")}>
                  <td className="px-3 py-2">
                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", sourceCls(link.docType))}>
                      {sourceLabel(link.docType)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", ENTITY_BADGE_CLS[link.layerType] ?? "bg-muted text-muted-foreground")}>
                      {ENTITY_LABELS[link.layerType] ?? link.layerType}
                    </span>
                    <span className="ml-1 font-mono text-muted-foreground text-[10px]">#{link.layerItemId}</span>
                  </td>
                  <td className="px-3 py-2 max-w-0">
                    <div className="truncate">
                      {link.externalTitle && <span className="font-medium block truncate">{link.externalTitle}</span>}
                      {link.externalUrl && (
                        <a
                          href={link.docType === "jiganto" && link.jigantoDocumentId
                            ? documentModuleUrl(link.jigantoDocumentId)
                            : link.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline truncate block"
                        >
                          {link.externalTitle ? link.externalUrl : link.externalUrl}
                        </a>
                      )}
                      {link.fileName && <span className="text-muted-foreground truncate block">{link.fileName}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground truncate">{link.addedByName ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {link.createdAt ? new Date(link.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {(link.externalUrl || link.jigantoDocumentId) && (
                        <button
                          type="button"
                          title="Copy link"
                          className="text-muted-foreground hover:text-foreground transition-colors p-1"
                          onClick={async () => {
                            const url = link.jigantoDocumentId
                              ? documentModuleUrl(link.jigantoDocumentId)
                              : link.externalUrl?.startsWith("http")
                                ? link.externalUrl
                                : link.externalUrl
                                  ? `${window.location.origin}${link.externalUrl}`
                                  : "";
                            if (url && (await copyTextToClipboard(url))) {
                              toast({ title: "Link copied" });
                            }
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => deleteMutation.mutate(link.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </BusinessTableScroll>
          <TablePagination
            page={linksPagination.page}
            totalPages={linksPagination.totalPages}
            total={linksPagination.total}
            startIndex={linksPagination.startIndex}
            endIndex={linksPagination.endIndex}
            pageSize={linksPagination.pageSize}
            onPageChange={linksPagination.setPage}
            onPageSizeChange={linksPagination.setPageSize}
          />
        </div>
      )}
    </div>
  );
}

function DocumentsTab({ initiatives }: { initiatives: Initiative[] }) {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState<"initiative" | "links">("initiative");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterInitiative, setFilterInitiative] = useState<string>("all");
  const [sortField, setSortField] = useState<"title" | "linkType" | "initiative" | "createdAt">("title");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<"table" | "grouped">("table");
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDocId, setLinkDocId] = useState("");
  const [linkInitiativeId, setLinkInitiativeId] = useState("");
  const [linkType, setLinkType] = useState("deliverable");

  const linkMutation = useMutation({
    mutationFn: (body: { documentId: number; initiativeId: number; linkType: string }) =>
      apiRequest("POST", "/api/documents/initiative-links", body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/documents/initiative-links"] });
      setLinkOpen(false);
      setLinkDocId("");
      setLinkInitiativeId("");
      toast({ title: "Document linked to initiative" });
    },
    onError: () => toast({ title: "Failed to link document", variant: "destructive" }),
  });

  const unlinkMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/documents/initiative-links/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["/api/documents/initiative-links"] }),
  });

  const { data: documentLinks = [], isLoading: linksLoading, error: linksError } = useQuery<DocumentInitiativeLink[]>({
    queryKey: ["/api/documents/initiative-links"],
    retry: (failureCount, error: { message?: string }) => {
      if (error?.message === "Not authenticated") return false;
      return failureCount < 3;
    },
  });

  const { data: documents = [], isLoading: documentsLoading, error: docsError } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
    retry: (failureCount, error: { message?: string }) => {
      if (error?.message === "Not authenticated") return false;
      return failureCount < 3;
    },
  });

  const isLoading = linksLoading || documentsLoading;
  const hasNonAuthError = (linksError && (linksError as { message?: string })?.message !== "Not authenticated") || 
                          (docsError && (docsError as { message?: string })?.message !== "Not authenticated");

  if (isLoading) {
    return <BusinessLoadingState variant="table" label="Loading documents…" />;
  }

  if (hasNonAuthError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold" data-testid="title-documents">Documents</h2>
            <p className="text-sm text-muted-foreground">Documents linked to strategic initiatives</p>
          </div>
        </div>
        <Card className="rounded-2xl border-destructive/30">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-destructive opacity-70" />
            <p className="text-destructive font-medium">Failed to load documents</p>
            <p className="text-sm text-muted-foreground mt-1">
              There was an error loading the document data. Please try refreshing the page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getDocumentById = (docId: number) => documents.find(d => d.id === docId);
  const getInitiativeById = (initId: number) => initiatives.find(i => i.id === initId);

  const tableRows: DocTableRow[] = documentLinks
    .map((link) => {
      const doc = getDocumentById(link.documentId);
      const init = getInitiativeById(link.initiativeId);
      if (!doc) return null;
      return {
        id: link.id,
        title: doc.title,
        linkType: link.linkType || "other",
        docType: doc.type || "document",
        status: doc.status || "draft",
        initiative: init?.title || "Unknown",
        initiativeId: link.initiativeId,
        documentId: link.documentId,
        createdAt: link.createdAt ? new Date(link.createdAt).toLocaleDateString() : "",
        notes: link.notes || "",
      };
    })
    .filter((r): r is DocTableRow => r !== null);

  const linkTypes = Array.from(new Set(tableRows.map(r => r.linkType)));
  const initiativeNames = Array.from(new Set(tableRows.map(r => r.initiative)));

  const filteredRows = tableRows
    .filter(r => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!r.title.toLowerCase().includes(term) && !r.initiative.toLowerCase().includes(term) && !r.notes.toLowerCase().includes(term)) return false;
      }
      if (filterType !== "all" && r.linkType !== filterType) return false;
      if (filterInitiative !== "all" && r.initiative !== filterInitiative) return false;
      return true;
    })
    .sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });

  const columns: ColumnDef<DocTableRow>[] = [
    { id: "title", header: "Document Title", type: "text", accessor: "title", width: "280px" },
    { id: "linkType", header: "Link Type", type: "status", accessor: (r) => linkTypeLabels[r.linkType] || r.linkType, width: "180px",
      options: Object.entries(linkTypeLabels).map(([value, label]) => ({ value: label, label, color: "bg-status-blue text-status-blue-foreground" }))
    },
    { id: "docType", header: "Document Type", type: "status", accessor: (r) => docTypeLabels[r.docType] || r.docType, width: "160px" },
    { id: "status", header: "Status", type: "status", accessor: "status", width: "120px" },
    { id: "initiative", header: "Initiative", type: "text", accessor: "initiative", width: "200px" },
    { id: "createdAt", header: "Linked", type: "text", accessor: "createdAt", width: "120px" },
  ];

  const groups = viewMode === "grouped"
    ? Object.entries(
        filteredRows.reduce((acc, row) => {
          if (!acc[row.initiative]) acc[row.initiative] = [];
          acc[row.initiative].push(row);
          return acc;
        }, {} as Record<string, DocTableRow[]>)
      ).map(([title, items]) => ({
        id: title,
        title,
        color: "bg-primary/10",
        items,
      }))
    : undefined;

  const handleSort = (field: "title" | "linkType" | "initiative" | "createdAt") => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-4 w-full min-w-0 max-w-full">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold" data-testid="title-documents">Documents</h2>
          <p className="text-sm text-muted-foreground">Documents and external links for strategy layers</p>
        </div>
        <Badge variant="secondary" className="text-xs" data-testid="badge-doc-count">
          {filteredRows.length} of {tableRows.length} documents
        </Badge>
        <Button size="sm" className="gap-1.5" onClick={() => setLinkOpen(true)} data-testid="button-link-document">
          <Link2 className="h-4 w-4" /> Link document
        </Button>
      </div>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link document to initiative</DialogTitle>
            <DialogDescription>Select a document from Document Management and the initiative it supports.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Document</Label>
              <Select value={linkDocId} onValueChange={setLinkDocId}>
                <SelectTrigger><SelectValue placeholder="Choose document…" /></SelectTrigger>
                <SelectContent>
                  {documents.map(d => (
                    <SelectItem key={d.id} value={String(d.id)}>{d.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Initiative</Label>
              <Select value={linkInitiativeId} onValueChange={setLinkInitiativeId}>
                <SelectTrigger><SelectValue placeholder="Choose initiative…" /></SelectTrigger>
                <SelectContent>
                  {initiatives.map(i => (
                    <SelectItem key={i.id} value={String(i.id)}>{i.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Link type</Label>
              <Select value={linkType} onValueChange={setLinkType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(linkTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>Cancel</Button>
            <Button
              disabled={!linkDocId || !linkInitiativeId || linkMutation.isPending}
              onClick={() => linkMutation.mutate({
                documentId: Number(linkDocId),
                initiativeId: Number(linkInitiativeId),
                linkType,
              })}
            >
              {linkMutation.isPending ? "Linking…" : "Link document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Section switcher */}
      <div className="flex items-center gap-1 border-b border-border pb-2">
        <button onClick={() => setActiveSection("initiative")} className={cn("text-xs font-medium px-3 py-1.5 rounded-lg", activeSection === "initiative" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
          Initiative Documents
        </button>
        <button onClick={() => setActiveSection("links")} className={cn("text-xs font-medium px-3 py-1.5 rounded-lg", activeSection === "links" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
          Strategy Links
        </button>
      </div>

      {activeSection === "links" && <StrategyLinksPanel />}
      {activeSection === "initiative" && (
      <>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            className="pl-9 rounded-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-doc-search"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-type">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {linkTypes.map(t => (
              <SelectItem key={t} value={t}>{linkTypeLabels[t] || t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterInitiative} onValueChange={setFilterInitiative}>
          <SelectTrigger className="w-[200px]" data-testid="select-filter-initiative">
            <SelectValue placeholder="All Initiatives" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Initiatives</SelectItem>
            {initiativeNames.map(n => (
              <SelectItem key={n} value={n}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-sort">
              <ArrowUpRight className="h-4 w-4 mr-1" />
              Sort
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleSort("title")}>
              By Title {sortField === "title" && (sortDir === "asc" ? "\u2191" : "\u2193")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("linkType")}>
              By Type {sortField === "linkType" && (sortDir === "asc" ? "\u2191" : "\u2193")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("initiative")}>
              By Initiative {sortField === "initiative" && (sortDir === "asc" ? "\u2191" : "\u2193")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleSort("createdAt")}>
              By Date {sortField === "createdAt" && (sortDir === "asc" ? "\u2191" : "\u2193")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant={viewMode === "table" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("table")}
            data-testid="button-view-table"
          >
            <BarChart3 className="h-4 w-4 mr-1" />
            Table
          </Button>
          <Button
            variant={viewMode === "grouped" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grouped")}
            data-testid="button-view-grouped"
          >
            <Briefcase className="h-4 w-4 mr-1" />
            Grouped
          </Button>
        </div>
      </div>

      <div className="w-full max-w-full min-w-0 overflow-x-hidden">
        <MondayTable
          columns={columns as ColumnDef<DocTableRow>[]}
          data={viewMode === "table" ? filteredRows : []}
          columnWidthStorageKey="jiganto-business-mgmt-col-widths"
          totalCount={tableRows.length}
          groups={groups}
          loading={isLoading}
          emptyMessage="No documents linked to initiatives yet. Link documents from the Document Management module to track deliverables."
          selectable={false}
          onRowClick={(row: DocTableRow) => window.open(`/modules/documents?document=${row.documentId}`, '_blank')}
          renderRowActions={(row: DocTableRow) => (
            <>
              <Button
                variant="ghost"
                size="icon"
                title="Copy link"
                onClick={async (e) => {
                  e.stopPropagation();
                  if (await copyTextToClipboard(documentModuleUrl(row.documentId))) {
                    toast({ title: "Document link copied" });
                  }
                }}
                data-testid={`button-copy-doc-link-${row.documentId}`}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); window.open(`/modules/documents?document=${row.documentId}`, '_blank'); }}
                data-testid={`button-view-doc-${row.documentId}`}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); unlinkMutation.mutate(row.id); }}
                disabled={unlinkMutation.isPending}
                data-testid={`button-unlink-doc-${row.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          alwaysShowRowActions
        />
      </div>
      </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GOVERNANCE / REVIEW SUPPORT TYPES
// ─────────────────────────────────────────────────────────────────────────────

type ReviewNote = {
  id: number; tenantId: number; entityType: string; entityId: number;
  content: string; ragSnapshot: string | null; authorName: string;
  authorId: string; signoffRequestId: number | null; createdAt: string;
};

type RagHistoryEntry = {
  id: number; tenantId: number; entityType: string; entityId: number;
  entityTitle: string; fromRag: string | null; toRag: string | null;
  changedByName: string; changedById: string; changedAt: string;
};

type OverdueItem = {
  id: number; type: string; title: string;
  reviewCadence: string | null; nextReviewDate: string | null;
  ragStatus: string | null; ownerName: string | null;
};

const ENTITY_LABELS: Record<string, string> = {
  strategy: "Strategy", goal: "Goal", objective: "Objective",
  initiative: "Initiative", okr: "OKR", kpi: "KPI", governance: "Governance",
};

const ENTITY_OPTIONS = [
  { value: "strategy",   label: "Strategy" },
  { value: "goal",       label: "Goal" },
  { value: "objective",  label: "Objective" },
  { value: "initiative", label: "Initiative" },
  { value: "okr",        label: "OKR" },
  { value: "kpi",        label: "KPI" },
  { value: "governance", label: "Governance" },
];

function RagChip({ rag }: { rag: string | null }) {
  if (!rag) return <span className="text-muted-foreground/40 text-xs">—</span>;
  const cls = rag === "green" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
            : rag === "amber" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
            : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
  const label = rag === "green" ? "🟢 Green" : rag === "amber" ? "🟡 Amber" : "🔴 Red";
  return <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

function GovernanceTab({ tenantId }: { tenantId: number }) {
  const { toast } = useToast();
  const [noteForm, setNoteForm] = useState({ entityType: "strategy", entityId: "", content: "", ragSnapshot: "" });
  const [noteOpen, setNoteOpen] = useState(false);
  const [ragFilter, setRagFilter] = useState("all");
  const [historyFilter, setHistoryFilter] = useState("all");

  const { data: overdue = [], isLoading: overdueLoading } = useQuery<OverdueItem[]>({
    queryKey: ["/api/business/overdue-reviews", tenantId],
    queryFn: () => fetch(`/api/business/overdue-reviews?tenantId=${tenantId}`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: ragHistory = [], isLoading: historyLoading } = useQuery<RagHistoryEntry[]>({
    queryKey: ["/api/business/rag-history", tenantId],
    queryFn: () => fetch(`/api/business/rag-history?tenantId=${tenantId}`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: notesRaw, isLoading: notesLoading } = useQuery<ReviewNote[]>({
    queryKey: ["/api/business/review-notes"],
  });
  const notes = useMemo(
    () => (Array.isArray(notesRaw) ? notesRaw : []),
    [notesRaw],
  );

  const addNoteMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest("POST", "/api/business/review-notes", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/review-notes", tenantId] });
      setNoteForm({ entityType: "strategy", entityId: "", content: "", ragSnapshot: "" });
      setNoteOpen(false);
      toast({ title: "Note added", description: "Review note saved successfully." });
    },
    onError: () => toast({ title: "Error", description: "Failed to save note.", variant: "destructive" }),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/business/review-notes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/review-notes", tenantId] });
      toast({ title: "Deleted", description: "Review note removed." });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete note.", variant: "destructive" }),
  });

  const filteredHistory = useMemo(
    () => (ragFilter === "all" ? ragHistory : ragHistory.filter(h => h.entityType === ragFilter)),
    [ragHistory, ragFilter],
  );
  const filteredNotes = useMemo(
    () => (historyFilter === "all" ? notes : notes.filter(n => n.entityType === historyFilter)),
    [notes, historyFilter],
  );

  const historyPagination = useTablePagination(filteredHistory, {
    resetKey: `${ragFilter}-${filteredHistory.length}`,
    enabled: !historyLoading,
  });
  const notesPagination = useTablePagination(filteredNotes, {
    resetKey: `${historyFilter}-${filteredNotes.length}`,
    enabled: !notesLoading,
  });

  const saveNote = () => {
    if (!noteForm.content.trim() || !noteForm.entityId) return;
    addNoteMutation.mutate({
      tenantId,
      entityType: noteForm.entityType,
      entityId: Number(noteForm.entityId),
      content: noteForm.content.trim(),
      ragSnapshot: noteForm.ragSnapshot || null,
    });
  };

  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch { return d; }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-violet-500/10">
          <ShieldCheck className="h-5 w-5 text-violet-500" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Strategy Governance</h2>
          <p className="text-xs text-muted-foreground">Overdue review alerts · RAG change history · Progress notes</p>
        </div>
        <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
          <Button
            size="sm" className="ml-auto h-8 gap-1.5 text-xs rounded-lg"
            onClick={() => setNoteOpen(true)}
            data-testid="button-add-review-note"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" /> Add Review Note
          </Button>
          <DialogContent className="max-w-lg">
            <SubmitForm onSubmit={saveNote} disabled={addNoteMutation.isPending || !noteForm.content.trim() || !noteForm.entityId}>
            <DialogHeader><DialogTitle>Add Review Note</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Entity Type</Label>
                  <Select value={noteForm.entityType} onValueChange={v => setNoteForm(f => ({ ...f, entityType: v }))}>
                    <SelectTrigger className="h-8 text-sm" data-testid="select-note-entity-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ENTITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Entity ID</Label>
                  <Input
                    type="number" placeholder="e.g. 3"
                    value={noteForm.entityId}
                    onChange={e => setNoteForm(f => ({ ...f, entityId: e.target.value }))}
                    className="h-8 text-sm" data-testid="input-note-entity-id"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">RAG Snapshot (optional)</Label>
                <Select value={noteForm.ragSnapshot || "none"} onValueChange={v => setNoteForm(f => ({ ...f, ragSnapshot: v === "none" ? "" : v }))}>
                  <SelectTrigger className="h-8 text-sm" data-testid="select-note-rag"><SelectValue placeholder="No RAG snapshot" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No snapshot</SelectItem>
                    <SelectItem value="green">🟢 Green — On Track</SelectItem>
                    <SelectItem value="amber">🟡 Amber — At Risk</SelectItem>
                    <SelectItem value="red">🔴 Red — Behind</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Note Content</Label>
                <Textarea
                  placeholder="Enter review notes, decisions, or observations…"
                  value={noteForm.content}
                  onChange={e => setNoteForm(f => ({ ...f, content: e.target.value }))}
                  rows={4} className="text-sm resize-none" data-testid="textarea-note-content"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline" size="sm">Cancel</Button></DialogClose>
              <Button
                type="submit"
                size="sm"
                data-testid="button-save-note"
              >
                {addNoteMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Save Note
              </Button>
            </DialogFooter>
            </SubmitForm>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Overdue Reviews ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-semibold">Overdue Reviews</h3>
          {overdue.length > 0 && (
            <span className="text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full">
              {overdue.length} overdue
            </span>
          )}
        </div>
        {overdueLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : overdue.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500 opacity-60" />
            All reviews are up to date — nothing overdue.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {overdue.map(item => (
              <div key={`${item.type}-${item.id}`}
                className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-1.5"
                data-testid={`overdue-${item.type}-${item.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold leading-snug line-clamp-2">{item.title}</span>
                  <RagChip rag={item.ragStatus} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 capitalize">
                    {ENTITY_LABELS[item.type] ?? item.type}
                  </span>
                  {item.reviewCadence && (
                    <span className="text-[10px] text-muted-foreground capitalize">{item.reviewCadence} review</span>
                  )}
                  {item.ownerName && (
                    <span className="text-[10px] text-muted-foreground">· {item.ownerName}</span>
                  )}
                </div>
                {item.nextReviewDate && (
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    Review was due {new Date(item.nextReviewDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── RAG Change History ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold">RAG Change History</h3>
          <span className="text-[10px] text-muted-foreground">{ragHistory.length} change{ragHistory.length !== 1 ? "s" : ""} logged</span>
          <div className="ml-auto">
            <Select value={ragFilter} onValueChange={setRagFilter}>
              <SelectTrigger className="h-7 text-xs w-[130px]" data-testid="select-rag-history-filter">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {ENTITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {historyLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : filteredHistory.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            No RAG status changes recorded yet. Changes will appear here automatically when a RAG status is updated.
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card w-full min-w-0 max-w-full">
            <BusinessTableScroll minWidth={800}>
              <table className="text-xs border-collapse w-max min-w-full table-auto">
                <thead>
                  <tr className="border-b-2 border-border bg-muted/60">
                    <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap w-[160px]">Date</th>
                    <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wider text-muted-foreground w-[80px]">Type</th>
                    <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wider text-muted-foreground">Entity</th>
                    <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wider text-muted-foreground w-[100px]">From</th>
                    <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wider text-muted-foreground w-[100px]">To</th>
                    <th className="px-3 py-2.5 text-left font-bold uppercase tracking-wider text-muted-foreground w-[140px]">Changed By</th>
                  </tr>
                </thead>
                <tbody>
                  {historyPagination.paginatedItems.map((entry, i) => (
                    <tr key={entry.id} className={`border-t border-border/30 hover:bg-muted/30 transition-colors ${i % 2 !== 0 ? "bg-muted/10" : ""}`}
                      data-testid={`rag-history-row-${entry.id}`}>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatDate(entry.changedAt)}</td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted capitalize">
                          {ENTITY_LABELS[entry.entityType] ?? entry.entityType}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium max-w-[240px] truncate">{entry.entityTitle}</td>
                      <td className="px-3 py-2"><RagChip rag={entry.fromRag} /></td>
                      <td className="px-3 py-2"><RagChip rag={entry.toRag} /></td>
                      <td className="px-3 py-2 text-muted-foreground">{entry.changedByName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </BusinessTableScroll>
            <TablePagination
              page={historyPagination.page}
              totalPages={historyPagination.totalPages}
              total={historyPagination.total}
              startIndex={historyPagination.startIndex}
              endIndex={historyPagination.endIndex}
              pageSize={historyPagination.pageSize}
              onPageChange={historyPagination.setPage}
              onPageSizeChange={historyPagination.setPageSize}
            />
          </div>
        )}
      </div>

      {/* ── Review Notes ────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-violet-500" />
          <h3 className="text-sm font-semibold">Review Notes</h3>
          <span className="text-[10px] text-muted-foreground">{notes.length} note{notes.length !== 1 ? "s" : ""}</span>
          <div className="ml-auto">
            <Select value={historyFilter} onValueChange={setHistoryFilter}>
              <SelectTrigger className="h-7 text-xs w-[130px]" data-testid="select-notes-filter">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {ENTITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {notesLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : filteredNotes.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            <MessageSquarePlus className="h-8 w-8 mx-auto mb-2 opacity-30" />
            No review notes yet. Click "Add Review Note" to record observations, decisions, or sign-off comments.
          </div>
        ) : (
          <div className="space-y-2">
            {notesPagination.paginatedItems.map(note => (
              <div key={note.id}
                className="rounded-xl border border-border bg-card p-4 space-y-2 hover:border-border/80 transition-colors"
                data-testid={`review-note-${note.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted capitalize">
                      {ENTITY_LABELS[note.entityType] ?? note.entityType} #{note.entityId}
                    </span>
                    {note.ragSnapshot && <RagChip rag={note.ragSnapshot} />}
                    {note.signoffRequestId && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                        Sign-off #{note.signoffRequestId}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteNoteMutation.mutate(note.id)}
                    disabled={deleteNoteMutation.isPending}
                    className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-muted transition-colors shrink-0"
                    title="Delete note"
                    data-testid={`button-delete-note-${note.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.content}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="font-medium">{note.authorName}</span>
                  <span>·</span>
                  <span>{formatDate(note.createdAt)}</span>
                </div>
              </div>
            ))}
            <TablePagination
              page={notesPagination.page}
              totalPages={notesPagination.totalPages}
              total={notesPagination.total}
              startIndex={notesPagination.startIndex}
              endIndex={notesPagination.endIndex}
              pageSize={notesPagination.pageSize}
              onPageChange={notesPagination.setPage}
              onPageSizeChange={notesPagination.setPageSize}
            />
          </div>
        )}
      </div>
    </div>
  );
}
