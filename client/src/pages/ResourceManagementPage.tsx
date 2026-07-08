import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ModuleShell } from "@/components/ModuleShell";
import { cn } from "@/lib/utils";
import { ModuleHeader } from "@/components/ModuleHeader";
import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";
import { useToast } from "@/hooks/use-toast";
import { Users, CreditCard, BarChart3, List, AlertCircle } from "lucide-react";
import { RateCardManager } from "@/components/crm/RateCardManager";
import { CapacityBoard } from "@/components/crm/CapacityBoard";
import { FinanceTimesheetsTab } from "@/components/finance/FinanceTimesheetsTab";
import { ResourcesDashboardTab } from "@/components/resources/ResourcesDashboardTab";
import { ResourcesPeopleTab } from "@/components/resources/ResourcesPeopleTab";
import { SkillsMatrixTab } from "@/components/resources/SkillsMatrixTab";
import { ResourcesPipelineTab } from "@/components/resources/ResourcesPipelineTab";
import { ResourcesAllocationsTab } from "@/components/resources/ResourcesAllocationsTab";
import { ResourcesReportsTab } from "@/components/resources/ResourcesReportsTab";
import { ResourcesPageLoading, ResourcesErrorState } from "@/components/resources/ResourcesUi";
import { useResourceScope } from "@/hooks/use-resource-scope";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ResDashboardIcon, ResPeopleIcon, ResSkillsIcon, ResCapacityIcon,
  ResPipelineIcon, ResTimesheetsIcon,
} from "@/components/icons/ModuleIcons";
import type { Resource, Skill, SkillCategory, ResourceAllocation, ResourceSkill } from "@shared/models/resources";

export default function ResourceManagementPage() {
  const initialTab = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("tab") ?? "dashboard"
    : "dashboard";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [tabFilter, setTabFilter] = useState<string | undefined>();
  const [searchTerm, setSearchTerm] = useState("");
  const [rateCardManagerOpen, setRateCardManagerOpen] = useState(false);
  const [capacityViewMode, setCapacityViewMode] = useState<"basic" | "enhanced">("enhanced");
  const [showAllocDialog, setShowAllocDialog] = useState(false);
  const [profileResourceId, setProfileResourceId] = useState<number | null>(null);
  const [gapPlanId, setGapPlanId] = useState<number | null>(null);
  const [timesheetView, setTimesheetView] = useState<"entry" | "approval" | "reports">(
    new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("timesheetView") === "approval"
      ? "approval"
      : "entry",
  );
  const { toast } = useToast();

  const { data: scope } = useResourceScope();

  const { data: stats } = useQuery({
    queryKey: ["/api/resources/stats"],
    staleTime: 30_000,
  });

  const { data: resources = [], isLoading, isError, refetch } = useQuery<Resource[]>({
    queryKey: ["/api/resources"],
    staleTime: 30_000,
  });

  const { data: skillCategoriesList = [], isLoading: skillsCategoriesLoading } = useQuery<SkillCategory[]>({
    queryKey: ["/api/resources/skill-categories"],
    staleTime: 60_000,
  });

  const { data: skillsList = [], isLoading: skillsLoading } = useQuery<Skill[]>({
    queryKey: ["/api/resources/skills"],
    staleTime: 60_000,
  });

  const { data: allocations = [], isLoading: allocationsLoading } = useQuery<ResourceAllocation[]>({
    queryKey: ["/api/resources/allocations"],
    staleTime: 30_000,
  });

  const { data: allResourceSkills = {}, isLoading: skillsMapLoading } = useQuery<Record<number, ResourceSkill[]>>({
    queryKey: ["/api/resources/skills-map"],
    staleTime: 30_000,
  });

  useEffect(() => {
    if (tabFilter === "approvals") {
      setActiveTab("timesheets");
      setTimesheetView("approval");
    }
    if (tabFilter === "bench") setActiveTab("people");
    if (tabFilter === "overallocated") setActiveTab("allocations");
  }, [tabFilter]);

  const invalidateCore = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/resources"] });
    queryClient.invalidateQueries({ queryKey: ["/api/resources/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/resources/dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/resources/skills-map"] });
  };

  const createResourceMutation = useMutation({
    mutationFn: (data: object) => apiRequest("POST", "/api/resources", data),
    onSuccess: () => { invalidateCore(); toast({ title: "Person created" }); },
    onError: () => toast({ title: "Failed to create person", variant: "destructive" }),
  });

  const updateResourceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: object }) => apiRequest("PUT", `/api/resources/${id}`, data),
    onSuccess: () => { invalidateCore(); toast({ title: "Person updated" }); },
  });

  const deleteResourceMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/resources/${id}`),
    onSuccess: () => { invalidateCore(); toast({ title: "Person deleted" }); },
  });

  const addSkillMutation = useMutation({
    mutationFn: (data: { resourceId: number; skillId: number; proficiencyLevel: string; skillLevel: number }) =>
      apiRequest("POST", `/api/resources/${data.resourceId}/skills`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/resources/skills-map"] }),
  });

  const removeSkillMutation = useMutation({
    mutationFn: ({ resourceId, id }: { resourceId: number; id: number }) =>
      apiRequest("DELETE", `/api/resources/${resourceId}/skills/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/resources/skills-map"] }),
  });

  const createAllocationMutation = useMutation({
    mutationFn: (data: object) => apiRequest("POST", "/api/resources/allocations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources/allocations"] });
      invalidateCore();
      toast({ title: "Allocation created" });
    },
  });

  const deleteAllocationMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/resources/allocations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/resources/allocations"] });
      invalidateCore();
    },
  });

  const utilByResource = useMemo(() => {
    const raw = (stats as { utilByResource?: Record<number, number> })?.utilByResource ?? {};
    if (!scope || scope.visibleResourceIds === "all") return raw;
    const allowed = new Set(scope.visibleResourceIds as number[]);
    return Object.fromEntries(
      Object.entries(raw).filter(([id]) => allowed.has(Number(id))),
    );
  }, [stats, scope]);

  const visibleResources = !scope || scope.visibleResourceIds === "all"
    ? resources
    : resources.filter((r) => (scope.visibleResourceIds as number[]).includes(r.id));

  const allowedTabs = scope?.allowedTabs ?? [
    "dashboard", "people", "skills", "allocations", "pipeline", "timesheets", "reports", "rate-cards",
  ];

  const showTab = (tab: string) => allowedTabs.includes(tab);

  useEffect(() => {
    if (scope && !allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0] ?? "timesheets");
    }
  }, [scope, activeTab, allowedTabs]);

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab && allowedTabs.includes(tab)) {
      setActiveTab(tab);
    } else if (scope?.isContractorPortal && !tab) {
      setActiveTab("timesheets");
    }
  }, [scope, allowedTabs]);

  if (isLoading) {
    return (
      <ModuleShell className="h-screen overflow-hidden bg-background" mainClassName="h-full flex items-center justify-center">
          <ResourcesPageLoading />
      </ModuleShell>
    );
  }

  if (isError) {
    return (
      <ModuleShell className="h-screen overflow-hidden bg-background" mainClassName="h-full flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <ResourcesErrorState message="Could not load resources" onRetry={() => refetch()} />
          </div>
      </ModuleShell>
    );
  }

  const tabContentClass = "p-4 sm:p-6 m-0";

  return (
    <ModuleShell className="h-screen overflow-hidden bg-background" mainClassName="h-full flex flex-col overflow-hidden">
        <div className="px-3 sm:px-4 pt-3 sm:pt-4 space-y-3">
          <ModuleWelcomeBanner moduleKey="resource-mgmt" features={["Skills matrix", "Capacity board", "Timesheets & approvals", "Pipeline planning"]} />
          {scope?.isContractorPortal && (
            <Alert className="border-orange-500/30 bg-orange-500/5">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <AlertTitle className="text-sm">Contractor Portal</AlertTitle>
              <AlertDescription className="text-xs sm:text-sm">
                You can view your dashboard and submit timesheets. Contact your resource manager for other requests.
              </AlertDescription>
            </Alert>
          )}
        </div>
        <div className="border-b border-border/30 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
          <ModuleHeader
            icon={Users}
            title="Resources"
            subtitle="Skills, capacity and time management"
            searchPlaceholder="Search resources..."
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchTestId="input-resource-search"
            titleTestId="text-module-title"
          />
          <Tabs value={activeTab} onValueChange={setActiveTab} className="px-3 sm:px-4">
            <div className="overflow-x-auto scrollbar-thin -mx-1 px-1 pb-1">
              <TabsList className="h-11 sm:h-12 bg-transparent border-0 gap-0.5 sm:gap-1 inline-flex w-max min-w-full sm:min-w-0 flex-nowrap">
                {showTab("dashboard") && <TabsTrigger value="dashboard" className="gap-1.5 sm:gap-2 text-xs sm:text-sm shrink-0" data-testid="tab-dashboard"><ResDashboardIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Dashboard</TabsTrigger>}
                {showTab("people") && <TabsTrigger value="people" className="gap-1.5 sm:gap-2 text-xs sm:text-sm shrink-0" data-testid="tab-people"><ResPeopleIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> People</TabsTrigger>}
                {showTab("skills") && <TabsTrigger value="skills" className="gap-1.5 sm:gap-2 text-xs sm:text-sm shrink-0" data-testid="tab-skills-matrix"><ResSkillsIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Skills</TabsTrigger>}
                {showTab("allocations") && <TabsTrigger value="allocations" className="gap-1.5 sm:gap-2 text-xs sm:text-sm shrink-0" data-testid="tab-capacity"><ResCapacityIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Capacity</TabsTrigger>}
                {showTab("pipeline") && <TabsTrigger value="pipeline" className="gap-1.5 sm:gap-2 text-xs sm:text-sm shrink-0" data-testid="tab-pipeline"><ResPipelineIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Pipeline</TabsTrigger>}
                {showTab("timesheets") && <TabsTrigger value="timesheets" className="gap-1.5 sm:gap-2 text-xs sm:text-sm shrink-0" data-testid="tab-timesheets"><ResTimesheetsIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Timesheets</TabsTrigger>}
                {showTab("reports") && <TabsTrigger value="reports" className="gap-1.5 sm:gap-2 text-xs sm:text-sm shrink-0" data-testid="tab-reports"><BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Reports</TabsTrigger>}
                {showTab("rate-cards") && <TabsTrigger value="rate-cards" className="gap-1.5 sm:gap-2 text-xs sm:text-sm shrink-0" data-testid="tab-rate-cards"><CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Rates</TabsTrigger>}
              </TabsList>
            </div>
          </Tabs>
        </div>

        <div className="flex-1 overflow-auto">
          <Tabs value={activeTab}>
            <TabsContent value="dashboard" className={tabContentClass}>
              <ResourcesDashboardTab
                resources={visibleResources}
                allocations={allocations}
                allowedTabs={allowedTabs}
                onNavigate={(tab, filter) => { setTabFilter(filter); setActiveTab(tab); }}
                onOpenProfile={(id) => { setProfileResourceId(id); setActiveTab("people"); }}
              />
            </TabsContent>

            <TabsContent value="people" className={tabContentClass}>
              <ResourcesPeopleTab
                resources={visibleResources}
                canManage={scope?.canManagePeople ?? true}
                skills={skillsList}
                skillCategories={skillCategoriesList}
                resourceSkills={allResourceSkills}
                skillsMapLoading={skillsMapLoading}
                searchTerm={searchTerm}
                initialFilter={tabFilter}
                initialProfileId={profileResourceId}
                onProfileOpened={() => setProfileResourceId(null)}
                utilByResource={utilByResource}
                onCreate={(d) => createResourceMutation.mutate(d)}
                onUpdate={(id, d) => updateResourceMutation.mutate({ id, data: d })}
                onDelete={(id) => deleteResourceMutation.mutate(id)}
                onAddSkill={(d) => addSkillMutation.mutate(d as { resourceId: number; skillId: number; proficiencyLevel: string; skillLevel: number })}
                onRemoveSkill={(id) => {
                  const r = resources.find((res) => (allResourceSkills[res.id] ?? []).some((s) => s.id === id));
                  if (r) removeSkillMutation.mutate({ resourceId: r.id, id });
                }}
              />
            </TabsContent>

            <TabsContent value="skills" className={tabContentClass}>
              <SkillsMatrixTab
                resources={visibleResources}
                skills={skillsList}
                categories={skillCategoriesList}
                resourceSkills={allResourceSkills}
                allocations={allocations}
                isLoading={skillsLoading || skillsCategoriesLoading || skillsMapLoading}
                onOpenProfile={(r) => { setProfileResourceId(r.id); setActiveTab("people"); }}
                initialGapPlanId={gapPlanId}
              />
            </TabsContent>

            <TabsContent value="allocations" className={tabContentClass}>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button variant={capacityViewMode === "basic" ? "default" : "outline"} size="sm" onClick={() => setCapacityViewMode("basic")}>
                    <List className="h-4 w-4 mr-1" /> Timeline
                  </Button>
                  <Button variant={capacityViewMode === "enhanced" ? "default" : "outline"} size="sm" onClick={() => setCapacityViewMode("enhanced")}>
                    <BarChart3 className="h-4 w-4 mr-1" /> Capacity Board
                  </Button>
                </div>
                {capacityViewMode === "basic" ? (
                  <ResourcesAllocationsTab
                    resources={visibleResources}
                    allocations={allocations}
                    allocationsLoading={allocationsLoading}
                    onCreateAllocation={(d) => createAllocationMutation.mutate(d)}
                    onDeleteAllocation={(id) => deleteAllocationMutation.mutate(id)}
                    openCreate={showAllocDialog}
                    onOpenCreateChange={setShowAllocDialog}
                  />
                ) : (
                  <CapacityBoard weeks={12} pageSize={50} onNewAllocation={() => setShowAllocDialog(true)} />
                )}
              </div>
            </TabsContent>

            <TabsContent value="pipeline" className={tabContentClass}>
              <ResourcesPipelineTab
                onViewPlan={(planId) => {
                  window.location.href = `/modules/crm?tab=resourceplan&plan=${planId}`;
                }}
                onGapAnalysis={(planId) => {
                  setGapPlanId(planId);
                  setActiveTab("skills");
                }}
              />
            </TabsContent>

            <TabsContent value="timesheets" className={tabContentClass}>
              <FinanceTimesheetsTab
                canApprove={scope?.canApproveTimesheets ?? true}
                ownResourceId={scope?.ownResourceId ?? null}
                initialViewMode={timesheetView}
              />
            </TabsContent>

            <TabsContent value="reports" className={tabContentClass}>
              <ResourcesReportsTab resources={visibleResources} allocations={allocations} />
            </TabsContent>

            <TabsContent value="rate-cards" className={tabContentClass}>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <div>
                    <h3 className="text-lg font-bold">Rate Cards</h3>
                    <p className="text-sm text-muted-foreground">Master record for billing rates (ADR-003)</p>
                  </div>
                  <Button size="sm" className="w-full sm:w-auto" onClick={() => setRateCardManagerOpen(true)}><CreditCard className="h-4 w-4 mr-1" /> Manage</Button>
                </div>
              </div>
              <RateCardManager open={rateCardManagerOpen} onClose={() => setRateCardManagerOpen(false)} />
            </TabsContent>
          </Tabs>
        </div>
    </ModuleShell>
  );
}
