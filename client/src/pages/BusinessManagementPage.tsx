import { useState, useMemo, useEffect } from "react";
import { useModuleTabUrl } from "@/hooks/use-module-tab-url";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { copyTextToClipboard, documentModuleUrl } from "@/lib/module-links";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { SubmitForm } from "@/components/ui/submit-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ModuleShell } from "@/components/ModuleShell";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { 
  Target, TrendingUp, AlertTriangle, Building2, Settings, Briefcase,
  Plus, Search, ChevronDown, Loader2, Sparkles, ArrowUpRight,
  Shield, Workflow, Wrench, CheckCircle2,
  BarChart3, Clock, Flag, Link2,
  ExternalLink, ShieldCheck, MessageSquarePlus, Trash2,
  Bell, TriangleAlert, Zap, Copy
} from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { StrategyMap } from "@/components/StrategyMap";
import { MondayTable, type ColumnDef, defaultStatusColors } from "@/components/MondayTable";
import type { Document, DocumentInitiativeLink } from "@shared/models/documents";
import { ModuleHeader } from "@/components/ModuleHeader";
import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";
import {
  modulePageBannerWrapClass,
  modulePageContentOuterClass,
  modulePageContentScrollClass,
  modulePageMainClass,
  modulePageShellClass,
  modulePageStickyHeaderClass,
  modulePageTabsWrapClass,
  modulePageTabTriggerClass,
} from "@/components/ModulePageChrome";
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

const statusColors: Record<string, string> = {
  ...defaultStatusColors,
  on_track: "bg-status-green text-status-green-foreground",
  off_track: "bg-status-red text-status-red-foreground",
  open: "bg-status-amber text-status-amber-foreground",
};

function filterBusinessSearch<T extends { title?: string | null; name?: string | null; description?: string | null }>(
  items: T[],
  searchTerm: string,
): T[] {
  const q = searchTerm.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const label = (item.title ?? item.name ?? "").toLowerCase();
    const desc = (item.description ?? "").toLowerCase();
    return label.includes(q) || desc.includes(q);
  });
}

const BUSINESS_TABS = [
  "dashboard", "strategy-map", "strategy", "goals", "objectives", "initiatives", "okrs", "kpis", "governance", "reviews", "documents",
] as const;

export default function BusinessManagementPage() {
  const [activeTab, setActiveTab] = useModuleTabUrl(BUSINESS_TABS, "dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const { open: openAiInsights } = useAIInsightsPanel();
  const { toast } = useToast();
  const { isAuthenticated, sessionReady } = useAuth();

  const BUSINESS_STALE_MS = 60_000;
  const tabActive = (tabs: string[]) => tabs.includes(activeTab);

  const { data: stats, isLoading: statsLoading } = useQuery<BusinessStats>({
    queryKey: ["/api/business/stats"],
    staleTime: BUSINESS_STALE_MS,
    enabled: tabActive(["dashboard"]),
  });

  const { data: strategyItems = [], isLoading: strategyLoading } = useQuery<StrategyItem[]>({
    queryKey: ["/api/business/strategy"],
    staleTime: BUSINESS_STALE_MS,
    enabled: tabActive(["dashboard", "strategy", "goals"]),
  });

  const { data: goals = [], isLoading: goalsLoading } = useQuery<Goal[]>({
    queryKey: ["/api/business/goals"],
    staleTime: BUSINESS_STALE_MS,
    enabled: tabActive(["dashboard", "goals"]),
  });

  const { data: kpis = [], isLoading: kpisLoading } = useQuery<Kpi[]>({
    queryKey: ["/api/business/kpis"],
    staleTime: BUSINESS_STALE_MS,
    enabled: tabActive(["kpis"]),
  });

  const { data: initiatives = [], isLoading: initiativesLoading } = useQuery<Initiative[]>({
    queryKey: ["/api/business/initiatives"],
    staleTime: BUSINESS_STALE_MS,
    enabled: tabActive(["dashboard", "initiatives"]),
  });

  const { data: departments = [], isLoading: deptsLoading } = useQuery<Department[]>({
    queryKey: ["/api/business/departments"],
    staleTime: BUSINESS_STALE_MS,
    enabled: tabActive(["operations"]),
  });

  const { data: processes = [], isLoading: processLoading } = useQuery<Process[]>({
    queryKey: ["/api/business/processes"],
    staleTime: BUSINESS_STALE_MS,
    enabled: tabActive(["operations"]),
  });

  const { data: tools = [], isLoading: toolsLoading } = useQuery<Tool[]>({
    queryKey: ["/api/business/tools"],
    staleTime: BUSINESS_STALE_MS,
    enabled: tabActive(["operations"]),
  });

  const { data: risks = [] } = useQuery<Risk[]>({
    queryKey: ["/api/business/risks"],
    staleTime: BUSINESS_STALE_MS,
    enabled: tabActive(["dashboard"]),
  });

  const { data: objectives = [], isLoading: objectivesLoading } = useQuery<Objective[]>({
    queryKey: ["/api/business/objectives"],
    staleTime: BUSINESS_STALE_MS,
    enabled: tabActive(["objectives"]),
  });

  const { data: okrs = [], isLoading: okrsLoading } = useQuery<Okr[]>({
    queryKey: ["/api/business/okrs"],
    staleTime: BUSINESS_STALE_MS,
    enabled: tabActive(["okrs"]),
  });

  const { isLoading: tasksLoading } = useQuery<BusinessTask[]>({
    queryKey: ["/api/business/tasks"],
    staleTime: BUSINESS_STALE_MS,
    enabled: tabActive(["reviews"]),
  });

  const { data: governanceItems = [], isLoading: governanceLoading } = useQuery<GovernanceItemEx[]>({
    queryKey: ["/api/business/governance"],
    staleTime: BUSINESS_STALE_MS,
    enabled: tabActive(["governance"]),
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

  const filteredStrategyItems = useMemo(
    () => filterBusinessSearch(strategyItems, searchTerm),
    [strategyItems, searchTerm],
  );
  const filteredGoals = useMemo(() => filterBusinessSearch(goals, searchTerm), [goals, searchTerm]);
  const filteredObjectives = useMemo(() => filterBusinessSearch(objectives, searchTerm), [objectives, searchTerm]);
  const filteredInitiatives = useMemo(() => filterBusinessSearch(initiatives, searchTerm), [initiatives, searchTerm]);
  const filteredOkrs = useMemo(() => filterBusinessSearch(okrs, searchTerm), [okrs, searchTerm]);
  const filteredKpis = useMemo(() => filterBusinessSearch(kpis, searchTerm), [kpis, searchTerm]);
  const filteredGovernanceItems = useMemo(
    () => filterBusinessSearch(governanceItems, searchTerm),
    [governanceItems, searchTerm],
  );
  const filteredRisks = useMemo(() => filterBusinessSearch(risks, searchTerm), [risks, searchTerm]);

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
    reviews: tasksLoading,
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
    <ModuleShell className={modulePageShellClass} testId="business-page" mainClassName={modulePageMainClass}>
        <div className={modulePageBannerWrapClass}>
          <ModuleWelcomeBanner moduleKey="business-mgmt" features={["Strategy mapping", "Governance layer", "RAG status rollup", "AI insights"]} />
        </div>
        <div className={modulePageStickyHeaderClass}>
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
          <div className={cn(modulePageTabsWrapClass, "flex items-center gap-1 pb-3 min-w-max sm:min-w-0 flex-wrap sm:flex-nowrap")}>
            {primaryTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  modulePageTabTriggerClass,
                  "inline-flex items-center py-1.5 font-medium transition-colors hover-elevate",
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
                    modulePageTabTriggerClass,
                    "inline-flex items-center py-1.5 font-medium transition-colors hover-elevate",
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
                modulePageTabTriggerClass,
                "inline-flex items-center py-1.5 font-medium transition-colors hover-elevate",
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
                modulePageTabTriggerClass,
                "inline-flex items-center py-1.5 font-medium transition-colors hover-elevate",
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

        <div className={modulePageContentOuterClass}>
          <div className={modulePageContentScrollClass}>
          <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto w-full min-w-0">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsContent value="dashboard" className="m-0 w-full min-w-0 max-w-full overflow-x-hidden">
                {tabLoading.dashboard ? (
                  <BusinessLoadingState variant="dashboard" />
                ) : (
                  <DashboardTab
                    stats={stats}
                    goals={filteredGoals}
                    risks={filteredRisks}
                    onNavigate={setActiveTab}
                  />
                )}
              </TabsContent>

              <TabsContent value="strategy-map" className="m-0 w-full min-w-0 max-w-full overflow-x-hidden">
                <StrategyMap />
              </TabsContent>

              <TabsContent value="strategy" className="m-0 w-full min-w-0 max-w-full overflow-x-hidden">
                <EnhancedStrategyTab
                  strategyItems={filteredStrategyItems as unknown as StrategyItemEx[]}
                  loading={tabLoading.strategy}
                  addButton={<AddStrategyButton onSave={(d) => createStrategyMutation.mutate(d)} isCreating={createStrategyMutation.isPending} />}
                />
              </TabsContent>

              <TabsContent value="goals" className="m-0 w-full min-w-0 max-w-full overflow-x-hidden">
                <EnhancedGoalsTab
                  goals={filteredGoals as unknown as GoalEx[]}
                  strategyItems={filteredStrategyItems as unknown as StrategyItemEx[]}
                  loading={tabLoading.goals}
                  addButton={<AddGoalButton strategyItems={strategyItems} onSave={(d) => createGoalMutation.mutate(d)} isCreating={createGoalMutation.isPending} />}
                />
              </TabsContent>

              <TabsContent value="operations" className="m-0 w-full min-w-0 max-w-full overflow-x-hidden">
                <OperationsTab 
                  departments={departments} 
                  processes={processes}
                  tools={tools}
                  searchTerm={searchTerm}
                  onCreateDepartment={(data) => createDepartmentMutation.mutate(data)}
                  isCreating={createDepartmentMutation.isPending}
                />
              </TabsContent>

              <TabsContent value="initiatives" className="m-0 w-full min-w-0 max-w-full overflow-x-hidden">
                <EnhancedInitiativesTab
                  initiatives={filteredInitiatives as unknown as InitiativeEx[]}
                  goals={filteredGoals as unknown as GoalEx[]}
                  loading={tabLoading.initiatives}
                  addButton={<AddInitiativeButton goals={goals} onSave={(d) => createInitiativeMutation.mutate(d)} isCreating={createInitiativeMutation.isPending} />}
                />
              </TabsContent>

              <TabsContent value="objectives" className="m-0 w-full min-w-0 max-w-full overflow-x-hidden">
                <EnhancedObjectivesTab
                  objectives={filteredObjectives as unknown as ObjectiveEx[]}
                  goals={filteredGoals as unknown as GoalEx[]}
                  loading={tabLoading.objectives}
                />
              </TabsContent>

              <TabsContent value="okrs" className="m-0 w-full min-w-0 max-w-full overflow-x-hidden">
                <EnhancedOkrsTab
                  okrs={filteredOkrs as unknown as OkrEx[]}
                  objectives={filteredObjectives as unknown as ObjectiveEx[]}
                  goals={filteredGoals as unknown as GoalEx[]}
                  loading={tabLoading.okrs}
                />
              </TabsContent>

              <TabsContent value="kpis" className="m-0 w-full min-w-0 max-w-full overflow-x-hidden">
                <EnhancedKpisTab
                  kpis={filteredKpis as unknown as KpiEx[]}
                  goals={filteredGoals as unknown as GoalEx[]}
                  loading={tabLoading.kpis}
                />
              </TabsContent>

              <TabsContent value="governance" className="m-0 w-full min-w-0 max-w-full overflow-x-hidden">
                <EnhancedGovernanceTab items={filteredGovernanceItems} loading={tabLoading.governance} />
              </TabsContent>

              <TabsContent value="reviews" className="m-0 w-full min-w-0 max-w-full overflow-x-hidden">
                <ReviewsTab
                  strategyItems={filteredStrategyItems} goals={filteredGoals} objectives={filteredObjectives}
                  initiatives={filteredInitiatives} okrs={filteredOkrs} kpis={filteredKpis}
                  entityRefs={entityRefs} searchTerm={searchTerm}
                />
              </TabsContent>

              <TabsContent value="documents" className="m-0 w-full min-w-0 max-w-full overflow-x-hidden">
                <DocumentsTab initiatives={filteredInitiatives} />
              </TabsContent>
            </Tabs>
          </div>
          </div>
        </div>
    </ModuleShell>
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
                type="button" variant="ghost" size="sm" className="h-6 gap-1 text-[10px] text-violet-600 dark:text-violet-300 hover:text-violet-700 dark:hover:text-violet-200 hover:bg-violet-50 dark:hover:bg-violet-950/30 px-2"
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

function DashboardTab({ stats, goals, risks, onNavigate }: { 
  stats?: BusinessStats; 
  goals: Goal[]; 
  risks: Risk[];
  onNavigate?: (tab: string) => void;
}) {
  const metrics = [
    { title: "Strategy Items", value: stats?.strategyItems || 0, icon: Target, color: "bg-status-purple", testId: "strategy", helpText: "Strategic themes, pillars, and map items in your business plan." },
    { title: "Goals", value: stats?.goals || 0, icon: Flag, color: "bg-status-green", testId: "goals", subtitle: `${stats?.goalsOnTrack || 0} on track`, helpText: "Measurable objectives linked to your strategy." },
    { title: "Initiatives", value: stats?.initiatives || 0, icon: TrendingUp, color: "bg-status-blue", testId: "initiatives", subtitle: `${stats?.initiativesInProgress || 0} in progress`, helpText: "Programmes and projects delivering strategic outcomes." },
    { title: "Open Risks", value: stats?.openRisks || 0, icon: AlertTriangle, color: "bg-status-red", testId: "risks", helpText: "Risks not yet closed or accepted." },
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
        {metrics.map((metric) => (
          <MetricCard
            key={metric.title}
            title={metric.title}
            value={metric.value}
            subtitle={metric.subtitle}
            helpText={metric.helpText}
            icon={metric.icon}
            iconBgClassName={metric.color}
            iconClassName="text-white"
            testId={`card-metric-${metric.testId}`}
          />
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


function OperationsTab({ departments, processes, tools, onCreateDepartment, isCreating, searchTerm = "" }: {
  departments: Department[];
  processes: Process[];
  tools: Tool[];
  onCreateDepartment: (data: { name: string; description?: string }) => void;
  isCreating: boolean;
  searchTerm?: string;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newDept, setNewDept] = useState({ name: "", description: "" });

  const q = searchTerm.trim().toLowerCase();
  const visibleDepartments = useMemo(() => {
    if (!q) return departments;
    return departments.filter((d) =>
      d.name.toLowerCase().includes(q) || (d.description ?? "").toLowerCase().includes(q),
    );
  }, [departments, q]);
  const visibleProcesses = useMemo(() => {
    if (!q) return processes;
    return processes.filter((p) =>
      p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q),
    );
  }, [processes, q]);
  const visibleTools = useMemo(() => {
    if (!q) return tools;
    return tools.filter((t) =>
      t.name.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q),
    );
  }, [tools, q]);

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
              Departments ({visibleDepartments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {visibleDepartments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{q ? "No departments match your search" : "No departments defined"}</p>
            ) : (
              <div className="space-y-2">
                {visibleDepartments.map((dept) => (
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
              Processes ({visibleProcesses.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {visibleProcesses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{q ? "No processes match your search" : "No processes defined"}</p>
            ) : (
              <div className="space-y-2">
                {visibleProcesses.map((process) => (
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
              Tools & Systems ({visibleTools.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {visibleTools.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{q ? "No tools match your search" : "No tools defined"}</p>
            ) : (
              <div className="space-y-2">
                {visibleTools.map((tool) => (
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
  strategyItems, goals, objectives, initiatives, okrs, kpis, entityRefs, searchTerm = "",
}: {
  strategyItems: StrategyItem[]; goals: Goal[]; objectives: Objective[];
  initiatives: Initiative[]; okrs: Okr[]; kpis: Kpi[];
  entityRefs?: Record<string, number>;
  searchTerm?: string;
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

  const filteredNotes = useMemo(() => {
    let notes = entityFilter === "all" ? [...allNotes] : allNotes.filter(n => n.entityType === entityFilter);
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      notes = notes.filter((n) => {
        const title = titleMap[n.entityType]?.[n.entityId]?.toLowerCase() ?? "";
        return title.includes(q) || n.content.toLowerCase().includes(q) || n.authorName.toLowerCase().includes(q);
      });
    }
    return notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allNotes, entityFilter, searchTerm, titleMap]);

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
    initiatives.filter(i => i.dueDate && new Date(i.dueDate).getTime() < now && i.status !== "completed").forEach(i => {
      const daysOverdue = Math.round((now - new Date(i.dueDate!).getTime()) / 86400000);
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
      options: Object.entries(linkTypeLabels).map(([, label]) => ({ value: label, label, color: "bg-status-blue text-status-blue-foreground" }))
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


