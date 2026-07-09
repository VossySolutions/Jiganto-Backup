import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useModuleTabUrl } from "@/hooks/use-module-tab-url";
import { Redirect, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { DASHBOARD_PATH } from "@shared/app-routes";
import { CLIENT_WORKSPACE_ALWAYS_HIDDEN_KEYS } from "@shared/client-workspace-modules";
import { useClientContext } from "@/hooks/use-client-context";
import { usePermissions } from "@/hooks/use-permissions";
import { getSettingsAccess } from "@/lib/settings-access";
import { settingsPathForTier } from "@/lib/settings-routes";
import { CrmUsersProvider } from "@/components/crm/CrmUsersProvider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ModuleShell } from "@/components/ModuleShell";
import { cn } from "@/lib/utils";
import {
  Building2, Users, Target, TrendingUp,
  BarChart3, FileText, Loader2, Handshake, Eye
} from "lucide-react";

function TabIconDashboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="8" width="3.5" height="7" rx="1" fill="#3b82f6"/>
      <rect x="6.25" y="4" width="3.5" height="11" rx="1" fill="#22c55e"/>
      <rect x="11.5" y="1" width="3.5" height="14" rx="1" fill="#f97316"/>
    </svg>
  );
}

function TabIconLeads() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1C8 1 3 6 3 9.5C3 12.5 5.2 14.5 8 14.5C10.8 14.5 13 12.5 13 9.5C13 6 8 1 8 1Z" fill="#ef4444"/>
      <path d="M8 5C8 5 5.5 8 5.5 10C5.5 11.7 6.6 13 8 13C9.4 13 10.5 11.7 10.5 10C10.5 8 8 5 8 5Z" fill="#f97316"/>
      <path d="M8 8.5C8 8.5 6.8 10 6.8 11C6.8 11.9 7.3 12.5 8 12.5C8.7 12.5 9.2 11.9 9.2 11C9.2 10 8 8.5 8 8.5Z" fill="#fbbf24"/>
    </svg>
  );
}

function TabIconOpportunities() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="white" stroke="#ef4444" strokeWidth="1.5"/>
      <circle cx="8" cy="8" r="5" fill="#fee2e2" stroke="#ef4444" strokeWidth="1"/>
      <circle cx="8" cy="8" r="3" fill="#fecaca" stroke="#ef4444" strokeWidth="1"/>
      <circle cx="8" cy="8" r="1.5" fill="#ef4444"/>
      <line x1="8" y1="1" x2="8" y2="4" stroke="#1e40af" strokeWidth="1.5" strokeLinecap="round"/>
      <polygon points="7,1.5 8,0 9,1.5" fill="#1e40af"/>
    </svg>
  );
}

function TabIconPipeline() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="14" height="3" rx="1.5" fill="#3b82f6"/>
      <rect x="2.5" y="6.5" width="11" height="3" rx="1.5" fill="#22c55e"/>
      <rect x="4" y="11" width="8" height="3" rx="1.5" fill="#f97316"/>
    </svg>
  );
}

function TabIconCustomers() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3" width="12" height="10" rx="2" fill="#0ea5e9"/>
      <rect x="4" y="5" width="4" height="3" rx="0.5" fill="white" fillOpacity="0.9"/>
      <rect x="4" y="9.5" width="8" height="1" rx="0.5" fill="white" fillOpacity="0.6"/>
      <rect x="9.5" y="5.5" width="4" height="0.8" rx="0.4" fill="white" fillOpacity="0.5"/>
      <rect x="9.5" y="7" width="3" height="0.8" rx="0.4" fill="white" fillOpacity="0.5"/>
    </svg>
  );
}

function TabIconContracts() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="1" width="10" height="14" rx="1.5" fill="#f97316"/>
      <rect x="5" y="3.5" width="6" height="1" rx="0.5" fill="white" fillOpacity="0.8"/>
      <rect x="5" y="5.5" width="4.5" height="1" rx="0.5" fill="white" fillOpacity="0.6"/>
      <rect x="5" y="7.5" width="6" height="1" rx="0.5" fill="white" fillOpacity="0.5"/>
      <path d="M6 11C6.5 10 7.5 10 8 10.5C8.5 11 9.5 12 10 11.5" stroke="white" strokeWidth="1" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

function TabIconContacts() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="5.5" r="2.5" fill="#0ea5e9"/>
      <path d="M1.5 13C1.5 10.5 3.5 9 6 9C8.5 9 10.5 10.5 10.5 13" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <circle cx="11" cy="6" r="2" fill="#8b5cf6"/>
      <path d="M8 13.5C8 11.5 9.3 10.2 11 10.2C12.7 10.2 14 11.5 14 13.5" stroke="#8b5cf6" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
    </svg>
  );
}

function TabIconForecasting() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <polyline points="1,13 4,9 7,10 10,5 14,2" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <circle cx="14" cy="2" r="1.5" fill="#22c55e"/>
      <rect x="1" y="14" width="14" height="1" rx="0.5" fill="#d1d5db"/>
    </svg>
  );
}

import { ModuleHeader } from "@/components/ModuleHeader";
import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";
import { AccountDetailPanel } from "@/components/crm/AccountDetailPanel";
import {
  CRM_ACCOUNT_DETAIL_PANEL_MARGIN_CLASS,
  CRM_ACCOUNT_DETAIL_PANEL_WIDTH_CLASS,
  CRM_ACCOUNT_DETAIL_PANEL_EXPANDED_WIDTH_CLASS,
  CRM_ACCOUNT_DETAIL_PANEL_EXPANDED_MARGIN_CLASS,
} from "@/lib/crm-layout";
import { CrmDashboardTab } from "@/components/crm/CrmDashboardTab";
import { CrmLeadsTab } from "@/components/crm/CrmLeadsTab";
import { CrmOpportunitiesTab } from "@/components/crm/CrmOpportunitiesTab";
import { CrmPipelineTab } from "@/components/crm/CrmPipelineTab";
import { CrmCustomersTab } from "@/components/crm/CrmCustomersTab";
import { CrmContractsTab } from "@/components/crm/CrmContractsTab";
import { CrmContactsTab } from "@/components/crm/CrmContactsTab";
import { SalesForecastDashboard } from "@/components/crm/SalesForecastDashboard";
import { Crm360ViewTab } from "@/components/crm/Crm360ViewTab";
import { CrmResourcePlanTab } from "@/components/crm/CrmResourcePlanTab";
import {
  countCrmContacts,
  countCrmContracts,
  countCrmCustomers,
  countCrmLeads,
  countCrmOpportunities,
  countCrmPipelineDeals,
} from "@/lib/crm-tab-counts";
import type {
  CrmActivity,
  CrmAccountDetail,
  CrmContact,
  CrmLead,
  CrmPipeline,
  CrmOpportunityStage,
  CrmOpportunity,
  CrmContract,
  CrmDashboardStats,
} from "@/components/crm/types";

function TabIconResourcePlan() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="14" height="3" rx="1" fill="#0ea5e9"/>
      <rect x="1" y="5.5" width="10" height="2" rx="0.5" fill="#a78bfa"/>
      <rect x="1" y="9" width="12" height="2" rx="0.5" fill="#34d399"/>
      <rect x="1" y="12.5" width="8" height="2" rx="0.5" fill="#fbbf24"/>
      <circle cx="13" cy="6.5" r="1" fill="#0ea5e9"/>
      <circle cx="14.5" cy="10" r="1" fill="#0ea5e9"/>
    </svg>
  );
}

function TabIcon360View() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="#8b5cf6" strokeWidth="1.5" fill="none"/>
      <ellipse cx="8" cy="8" rx="3" ry="7" stroke="#8b5cf6" strokeWidth="1" fill="none"/>
      <line x1="1" y1="8" x2="15" y2="8" stroke="#8b5cf6" strokeWidth="1"/>
      <circle cx="8" cy="8" r="1.5" fill="#8b5cf6"/>
    </svg>
  );
}

const CRM_LIST_STALE = 30_000;
const CRM_META_STALE = 60_000;

const CRM_TAB_LIST = [
  "dashboard", "360view", "leads", "opportunities", "pipeline",
  "customers", "contracts", "contacts", "forecasting", "resourceplan",
] as const;

function parseCrmUrl() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const tab = params.get("tab");
  const contractRaw = params.get("contract");
  const planRaw = params.get("plan");
  const oppRaw = params.get("opp");
  const contractId = contractRaw && /^\d+$/.test(contractRaw) ? Number(contractRaw) : null;
  const planId = planRaw && /^\d+$/.test(planRaw) ? Number(planRaw) : null;
  const opportunityId = oppRaw && /^\d+$/.test(oppRaw) ? Number(oppRaw) : null;
  return {
    tab: tab && (CRM_TAB_LIST as readonly string[]).includes(tab) ? tab : null,
    contractId,
    planId,
    opportunityId,
    hasDeepLink: Boolean(tab || contractId || planId || opportunityId),
  };
}

function CrmTabLoader() {
  return (
    <div className="flex justify-center py-16" data-testid="crm-tab-loading">
      <Loader2 className="h-8 w-8 text-[#0ea5e9] animate-spin" />
    </div>
  );
}

export default function CRMPage() {
  return (
    <CrmUsersProvider>
      <CRMPageContent />
    </CrmUsersProvider>
  );
}

function CRMPageContent() {
  const { activeClient } = useClientContext();
  const [, setLocation] = useLocation();
  const { platformRole, isJigantoStaff } = usePermissions();
  const urlState = useMemo(() => parseCrmUrl(), []);
  const [activeTab, setActiveTab] = useModuleTabUrl(CRM_TAB_LIST, "dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<CrmAccountDetail | null>(null);
  const [detailPanelExpanded, setDetailPanelExpanded] = useState(false);
  const tabsListRef = useRef<HTMLDivElement>(null);

  const needsActivities = activeTab === "dashboard";

  const { data: dashboardStats, isLoading: statsLoading } = useQuery<CrmDashboardStats>({
    queryKey: ["/api/crm/dashboard-stats"],
    staleTime: CRM_LIST_STALE,
    enabled: activeTab === "dashboard" || activeTab === "forecasting",
  });

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<CrmAccountDetail[]>({
    queryKey: ["/api/crm/accounts"],
    staleTime: CRM_LIST_STALE,
  });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery<CrmContact[]>({
    queryKey: ["/api/crm/contacts"],
    staleTime: CRM_LIST_STALE,
  });

  const { data: leads = [], isLoading: leadsLoading } = useQuery<CrmLead[]>({
    queryKey: ["/api/crm/leads"],
    staleTime: CRM_LIST_STALE,
  });

  const { data: pipelines = [], isLoading: pipelinesLoading } = useQuery<CrmPipeline[]>({
    queryKey: ["/api/crm/pipelines"],
    staleTime: CRM_META_STALE,
  });

  const { data: stages = [], isLoading: stagesLoading } = useQuery<CrmOpportunityStage[]>({
    queryKey: ["/api/crm/stages"],
    staleTime: CRM_META_STALE,
  });

  const { data: opportunities = [], isLoading: opportunitiesLoading } = useQuery<CrmOpportunity[]>({
    queryKey: ["/api/crm/opportunities"],
    staleTime: CRM_LIST_STALE,
  });

  const { data: contracts = [], isLoading: contractsLoading } = useQuery<CrmContract[]>({
    queryKey: ["/api/crm/contracts"],
    staleTime: CRM_LIST_STALE,
  });

  const { data: activities = [] } = useQuery<CrmActivity[]>({
    queryKey: ["/api/crm/activities"],
    staleTime: CRM_LIST_STALE,
    enabled: needsActivities,
  });

  // Only block the shell on first paint — tab-specific queries must not hide the whole CRM page.
  const isInitialLoading = accountsLoading || leadsLoading || opportunitiesLoading;

  const tabLoading = useMemo(
    () => ({
      opportunities: stagesLoading || pipelinesLoading || contactsLoading,
      pipeline: pipelinesLoading || stagesLoading,
      customers: stagesLoading || contractsLoading,
      contracts: contractsLoading,
      contacts: contactsLoading,
      forecasting: pipelinesLoading || stagesLoading || statsLoading,
      "360view": contactsLoading || contractsLoading || stagesLoading || pipelinesLoading,
      resourceplan: stagesLoading || pipelinesLoading,
    }),
    [
      contactsLoading,
      contractsLoading,
      pipelinesLoading,
      stagesLoading,
      statsLoading,
    ],
  );

  const openCrmCustomFieldsSettings = useCallback(() => {
    const access = getSettingsAccess(platformRole, isJigantoStaff);
    if (access.tabs.includes("crm")) {
      setLocation(`${settingsPathForTier(access.tier)}?tab=crm`);
    }
  }, [platformRole, isJigantoStaff, setLocation]);

  useEffect(() => {
    if (isInitialLoading) return;
    const list = tabsListRef.current;
    if (!list) return;
    if (activeTab === "dashboard") {
      list.scrollLeft = 0;
      return;
    }
    const activeEl = list.querySelector<HTMLElement>(`[data-testid="tab-${activeTab}"]`);
    activeEl?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [activeTab, isInitialLoading]);

  if (activeClient && CLIENT_WORKSPACE_ALWAYS_HIDDEN_KEYS.has("crm")) {
    return <Redirect to={DASHBOARD_PATH} />;
  }

  if (isInitialLoading) {
    return (
      <ModuleShell className="h-screen overflow-hidden bg-background" testId="crm-loading" mainClassName="h-full flex items-center justify-center overflow-hidden">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 text-[#0ea5e9] animate-spin" />
            <p className="text-sm text-muted-foreground">Loading CRM...</p>
          </div>
      </ModuleShell>
    );
  }

  const tabItems = [
    { value: "dashboard", label: "Dashboard", svgIcon: <TabIconDashboard />, count: null },
    { value: "360view", label: "360° View", svgIcon: <TabIcon360View />, count: null },
    { value: "leads", label: "Leads", svgIcon: <TabIconLeads />, count: countCrmLeads(leads) },
    { value: "opportunities", label: "Opportunities", svgIcon: <TabIconOpportunities />, count: countCrmOpportunities(opportunities, stages, pipelines) },
    { value: "pipeline", label: "Pipeline", svgIcon: <TabIconPipeline />, count: countCrmPipelineDeals(opportunities, stages, pipelines) },
    { value: "customers", label: "Customers", svgIcon: <TabIconCustomers />, count: countCrmCustomers(accounts) },
    { value: "contracts", label: "Contracts", svgIcon: <TabIconContracts />, count: countCrmContracts(contracts) },
    { value: "contacts", label: "Contacts", svgIcon: <TabIconContacts />, count: countCrmContacts(contacts) },
    { value: "forecasting", label: "Forecasting", svgIcon: <TabIconForecasting />, count: null },
    { value: "resourceplan", label: "Resource Plan", svgIcon: <TabIconResourcePlan />, count: null },
  ];

  return (
    <ModuleShell className="h-screen overflow-hidden bg-background" testId="crm-page" mainClassName="h-full flex flex-col overflow-hidden">
      <Tabs
        value={activeTab}
        onValueChange={(tab) => { setActiveTab(tab); setSelectedAccount(null); setDetailPanelExpanded(false); }}
        className="h-full flex flex-col overflow-hidden"
      >
        <div className="px-3 sm:px-4 pt-3 sm:pt-4 hidden md:block">
          <ModuleWelcomeBanner moduleKey="crm" features={["Pipeline management", "Lead tracking", "Sales forecasting", "Activity analytics"]} />
        </div>
        <div className="border-b border-border/30 bg-card backdrop-blur-sm sticky top-0 z-50 shrink-0">
          <ModuleHeader
            icon={Building2}
            title="CRM"
            subtitle="Customer Relationship Management"
            searchPlaceholder="Search CRM..."
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchTestId="input-crm-search"
            titleTestId="crm-title"
          />

          <div className="px-3 sm:px-4">
            <TabsList
              ref={tabsListRef}
              className="h-11 sm:h-12 bg-transparent border-0 gap-0.5 sm:gap-1 flex w-full max-w-full justify-start overflow-x-auto overflow-y-hidden scrollbar-none scroll-smooth"
            >
              {tabItems.map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="gap-1.5 sm:gap-2 shrink-0 px-2 sm:px-3 text-xs sm:text-sm rounded-lg whitespace-nowrap data-[state=active]:bg-[#0ea5e9]/10 data-[state=active]:text-[#0ea5e9]"
                  data-testid={`tab-${tab.value}`}
                >
                  {tab.svgIcon}
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.count !== null && tab.count > 0 && (
                    <Badge variant="secondary" className="ml-0.5 sm:ml-1 h-5 px-1.5 text-[10px] font-medium">
                      {tab.count}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex min-h-0">
          <div className={cn(
            "flex-1 overflow-auto transition-all duration-300 min-w-0",
            selectedAccount && (detailPanelExpanded
              ? CRM_ACCOUNT_DETAIL_PANEL_EXPANDED_MARGIN_CLASS
              : CRM_ACCOUNT_DETAIL_PANEL_MARGIN_CLASS)
          )}>
            <div className="flex-1">
              <TabsContent value="dashboard" className="p-3 sm:p-4 md:p-6 m-0">
                <CrmDashboardTab
                  stats={dashboardStats}
                  isLoading={statsLoading}
                  activities={activities}
                  onNavigateToTab={(tab) => setActiveTab(tab)}
                  onNavigateToAccount360={(accountId) => {
                    sessionStorage.setItem("crm-360-account-id", String(accountId));
                    setActiveTab("360view");
                  }}
                />
              </TabsContent>

              <TabsContent value="leads" className="p-3 sm:p-4 md:p-6 m-0">
                <CrmLeadsTab leads={leads} searchTerm={searchTerm} onNavigateToTab={(tab) => setActiveTab(tab)} onOpenCustomFieldsSettings={openCrmCustomFieldsSettings} />
              </TabsContent>

              <TabsContent value="opportunities" className="p-3 sm:p-4 md:p-6 m-0">
                {tabLoading.opportunities ? (
                  <CrmTabLoader />
                ) : (
                  <CrmOpportunitiesTab
                    opportunities={opportunities}
                    stages={stages}
                    accounts={accounts}
                    pipelines={pipelines}
                    contacts={contacts}
                    searchTerm={searchTerm}
                    onNavigateToTab={(tab) => setActiveTab(tab)}
                    onOpenCustomFieldsSettings={openCrmCustomFieldsSettings}
                    onNavigateToResourcePlan={(oppId, planId) => {
                      sessionStorage.setItem("crm-resource-plan-opp-id", String(oppId));
                      if (planId) sessionStorage.setItem("crm-resource-plan-id", String(planId));
                      setActiveTab("resourceplan");
                    }}
                  />
                )}
              </TabsContent>

              <TabsContent value="pipeline" className="p-3 sm:p-4 md:p-6 m-0">
                {tabLoading.pipeline ? (
                  <CrmTabLoader />
                ) : (
                  <CrmPipelineTab opportunities={opportunities} stages={stages} accounts={accounts} pipelines={pipelines} searchTerm={searchTerm} />
                )}
              </TabsContent>

              <TabsContent value="customers" className="p-3 sm:p-4 md:p-6 m-0">
                {tabLoading.customers ? (
                  <CrmTabLoader />
                ) : (
                  <CrmCustomersTab accounts={accounts} opportunities={opportunities} contracts={contracts} stages={stages} searchTerm={searchTerm} onSelectAccount={setSelectedAccount} />
                )}
              </TabsContent>

              <TabsContent value="contracts" className="p-3 sm:p-4 md:p-6 m-0">
                {tabLoading.contracts ? (
                  <CrmTabLoader />
                ) : (
                  <CrmContractsTab contracts={contracts} accounts={accounts} searchTerm={searchTerm} initialContractId={urlState.contractId} />
                )}
              </TabsContent>

              <TabsContent value="contacts" className="p-3 sm:p-4 md:p-6 m-0">
                {tabLoading.contacts ? (
                  <CrmTabLoader />
                ) : (
                  <CrmContactsTab contacts={contacts} accounts={accounts} searchTerm={searchTerm} />
                )}
              </TabsContent>

              <TabsContent value="forecasting" className="p-3 sm:p-4 md:p-6 m-0">
                {tabLoading.forecasting ? (
                  <CrmTabLoader />
                ) : (
                  <SalesForecastDashboard
                    opportunities={opportunities}
                    stages={stages}
                    pipelines={pipelines}
                    accounts={accounts}
                    contacts={contacts}
                    onNavigateToResourcePlan={(oppId, planId) => {
                      sessionStorage.setItem("crm-resource-plan-opp-id", String(oppId));
                      if (planId) sessionStorage.setItem("crm-resource-plan-id", String(planId));
                      setActiveTab("resourceplan");
                    }}
                  />
                )}
              </TabsContent>

              <TabsContent value="360view" className="m-0">
                {tabLoading["360view"] ? (
                  <CrmTabLoader />
                ) : (
                  <Crm360ViewTab
                    accounts={accounts}
                    contacts={contacts}
                    opportunities={opportunities}
                    stages={stages}
                    contracts={contracts}
                    leads={leads}
                    searchTerm={searchTerm}
                    onNavigateToTab={(tab) => setActiveTab(tab)}
                  />
                )}
              </TabsContent>

              <TabsContent value="resourceplan" className="p-3 sm:p-4 md:p-6 m-0">
                {tabLoading.resourceplan ? (
                  <CrmTabLoader />
                ) : (
                  <CrmResourcePlanTab
                    opportunities={opportunities}
                    accounts={accounts}
                    stages={stages}
                    initialPlanId={urlState.planId}
                    initialOpportunityId={urlState.opportunityId}
                    onNavigateToTab={(tab) => setActiveTab(tab)}
                  />
                )}
              </TabsContent>
            </div>
          </div>

          {selectedAccount && (
            <>
              <div
                className="fixed inset-0 z-[60] bg-black/20"
                onClick={() => { setSelectedAccount(null); setDetailPanelExpanded(false); }}
                data-testid="overlay-close-detail"
              />
              <div className={cn(
                "fixed inset-y-0 right-0 h-full z-[70] shadow-2xl border-l border-border/40 bg-background transition-[width] duration-200",
                detailPanelExpanded ? CRM_ACCOUNT_DETAIL_PANEL_EXPANDED_WIDTH_CLASS : CRM_ACCOUNT_DETAIL_PANEL_WIDTH_CLASS,
              )}>
                <AccountDetailPanel
                  account={selectedAccount}
                  onClose={() => { setSelectedAccount(null); setDetailPanelExpanded(false); }}
                  expanded={detailPanelExpanded}
                  onToggleExpanded={() => setDetailPanelExpanded((v) => !v)}
                />
              </div>
            </>
          )}
        </div>
      </Tabs>
    </ModuleShell>
  );
}
