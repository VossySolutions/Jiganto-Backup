import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Sidebar } from "@/components/Sidebar";
import { useShellLayout } from "@/hooks/use-shell-layout";
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

type CrmAccount = {
  id: number;
  tenantId: number;
  parentAccountId: number | null;
  name: string;
  type: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  ownerUserId: string | null;
  description: string | null;
  annualRevenue: string | null;
  employeeCount: number | null;
  createdAt: string;
  updatedAt: string;
};

type CrmContact = {
  id: number;
  tenantId: number;
  accountId: number | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  role: string | null;
  createdAt: string;
};

type CrmLead = {
  id: number;
  tenantId: number;
  firstName: string;
  lastName: string;
  email: string | null;
  company: string | null;
  source: string | null;
  status: string;
  score: number | null;
  createdAt: string;
};

type CrmPipeline = {
  id: number;
  tenantId: number;
  name: string;
  description: string | null;
  isDefault: boolean | null;
  color: string | null;
};

type CrmOpportunityStage = {
  id: number;
  tenantId: number;
  pipelineId: number | null;
  name: string;
  order: number;
  probability: number | null;
  color: string | null;
  isClosed: boolean | null;
  isWon: boolean | null;
};

type CrmOpportunity = {
  id: number;
  tenantId: number;
  accountId: number | null;
  stageId: number | null;
  name: string;
  amount: string | null;
  probability: number | null;
  expectedCloseDate: string | null;
  ownerUserId: string | null;
  createdAt: string;
};

type CrmContract = {
  id: number;
  tenantId: number;
  accountId: number | null;
  opportunityId: number | null;
  projectId: number | null;
  name: string;
  type: string | null;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  value: string | null;
  recurringValue: string | null;
  terms: string | null;
  signedDate: string | null;
  signedByContactId: number | null;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

interface DashboardStats {
  totalPipelineValue: number;
  weightedPipelineValue: number;
  revenueWon: number;
  winRate: number;
  avgDealSize: number;
  openOpportunities: number;
  wonDeals: number;
  lostDeals: number;
  totalAccounts: number;
  activeLeads: number;
  hotLeads: number;
  newLeads: number;
  activeContracts: number;
  expiringContracts: number;
  stageBreakdown: { name: string; count: number; value: number; color: string }[];
  topAccounts: { id: number; name: string; type: string; industry: string | null; totalValue: number; openDeals: number; dealCount: number }[];
}

export default function CRMPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<CrmAccount | null>(null);
  const { mainOffset, mobileTopOffset } = useShellLayout();

  const { data: dashboardStats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/crm/dashboard-stats"],
  });

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<CrmAccount[]>({
    queryKey: ["/api/crm/accounts"],
  });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery<CrmContact[]>({
    queryKey: ["/api/crm/contacts"],
  });

  const { data: leads = [], isLoading: leadsLoading } = useQuery<CrmLead[]>({
    queryKey: ["/api/crm/leads"],
  });

  const { data: pipelines = [], isLoading: pipelinesLoading } = useQuery<CrmPipeline[]>({
    queryKey: ["/api/crm/pipelines"],
  });

  const { data: stages = [], isLoading: stagesLoading } = useQuery<CrmOpportunityStage[]>({
    queryKey: ["/api/crm/stages"],
  });

  const { data: opportunities = [], isLoading: opportunitiesLoading } = useQuery<CrmOpportunity[]>({
    queryKey: ["/api/crm/opportunities"],
  });

  const { data: contracts = [], isLoading: contractsLoading } = useQuery<CrmContract[]>({
    queryKey: ["/api/crm/contracts"],
  });

  const isLoading = accountsLoading || contactsLoading || leadsLoading || pipelinesLoading || stagesLoading || opportunitiesLoading || contractsLoading;

  if (isLoading) {
    return (
      <div className="h-screen overflow-hidden bg-background" data-testid="crm-loading">
        <Sidebar />
        <main className={cn("transition-all duration-300 h-full flex items-center justify-center overflow-hidden", mainOffset, mobileTopOffset)}>
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 text-[#0ea5e9] animate-spin" />
            <p className="text-sm text-muted-foreground">Loading CRM...</p>
          </div>
        </main>
      </div>
    );
  }

  const tabItems = [
    { value: "dashboard", label: "Dashboard", svgIcon: <TabIconDashboard />, count: null },
    { value: "leads", label: "Leads", svgIcon: <TabIconLeads />, count: leads.filter(l => l.status !== 'converted').length },
    { value: "opportunities", label: "Opportunities", svgIcon: <TabIconOpportunities />, count: opportunities.length },
    { value: "pipeline", label: "Pipeline", svgIcon: <TabIconPipeline />, count: null },
    { value: "customers", label: "Customers", svgIcon: <TabIconCustomers />, count: accounts.filter(a => a.type === 'customer').length },
    { value: "contracts", label: "Contracts", svgIcon: <TabIconContracts />, count: contracts.length },
    { value: "contacts", label: "Contacts", svgIcon: <TabIconContacts />, count: contacts.length },
    { value: "forecasting", label: "Forecasting", svgIcon: <TabIconForecasting />, count: null },
    { value: "360view", label: "360° View", svgIcon: <TabIcon360View />, count: null },
    { value: "resourceplan", label: "Resource Plan", svgIcon: <TabIconResourcePlan />, count: null },
  ];

  return (
    <div className="h-screen overflow-hidden bg-background" data-testid="crm-page">
      <Sidebar />
      <main className={cn("transition-all duration-300 h-full flex flex-col overflow-hidden", mainOffset, mobileTopOffset)}>
        <div className="px-4 pt-4">
          <ModuleWelcomeBanner moduleKey="crm" features={["Pipeline management", "Lead tracking", "Sales forecasting", "Activity analytics"]} />
        </div>
        <div className="border-b border-border/30 bg-card backdrop-blur-sm sticky top-0 z-50">
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

          <Tabs value={activeTab} onValueChange={(tab) => { setActiveTab(tab); setSelectedAccount(null); }} className="px-4">
            <TabsList className="h-12 bg-transparent border-0 gap-1">
              {tabItems.map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="gap-2 rounded-lg data-[state=active]:bg-[#0ea5e9]/10 data-[state=active]:text-[#0ea5e9]"
                  data-testid={`tab-${tab.value}`}
                >
                  {tab.svgIcon}
                  {tab.label}
                  {tab.count !== null && tab.count > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-medium">
                      {tab.count}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 overflow-hidden flex">
          <div className={cn("flex-1 overflow-auto transition-all duration-300", selectedAccount && "mr-[650px]")}>
            <Tabs value={activeTab} className="flex-1">
              <TabsContent value="dashboard" className="p-6 m-0">
                <CrmDashboardTab stats={dashboardStats} isLoading={statsLoading} onNavigateToTab={(tab) => setActiveTab(tab)} />
              </TabsContent>

              <TabsContent value="leads" className="p-6 m-0">
                <CrmLeadsTab leads={leads} searchTerm={searchTerm} />
              </TabsContent>

              <TabsContent value="opportunities" className="p-6 m-0">
                <CrmOpportunitiesTab opportunities={opportunities} stages={stages} accounts={accounts} pipelines={pipelines} />
              </TabsContent>

              <TabsContent value="pipeline" className="p-6 m-0">
                <CrmPipelineTab opportunities={opportunities} stages={stages} accounts={accounts} pipelines={pipelines} />
              </TabsContent>

              <TabsContent value="customers" className="p-6 m-0">
                <CrmCustomersTab accounts={accounts} searchTerm={searchTerm} onSelectAccount={setSelectedAccount} />
              </TabsContent>

              <TabsContent value="contracts" className="p-6 m-0">
                <CrmContractsTab contracts={contracts} accounts={accounts} searchTerm={searchTerm} />
              </TabsContent>

              <TabsContent value="contacts" className="p-6 m-0">
                <CrmContactsTab contacts={contacts} accounts={accounts} searchTerm={searchTerm} />
              </TabsContent>

              <TabsContent value="forecasting" className="p-6 m-0">
                <SalesForecastDashboard opportunities={opportunities} stages={stages} />
              </TabsContent>

              <TabsContent value="360view" className="m-0">
                <Crm360ViewTab
                  accounts={accounts}
                  contacts={contacts}
                  opportunities={opportunities}
                  stages={stages}
                  contracts={contracts}
                  leads={leads}
                  searchTerm={searchTerm}
                />
              </TabsContent>

              <TabsContent value="resourceplan" className="p-6 m-0">
                <CrmResourcePlanTab opportunities={opportunities} accounts={accounts} stages={stages} />
              </TabsContent>
            </Tabs>
          </div>

          {selectedAccount && (
            <>
              <div
                className="fixed inset-0 z-[60] bg-black/20"
                onClick={() => setSelectedAccount(null)}
                data-testid="overlay-close-detail"
              />
              <div className="fixed top-0 right-0 w-[650px] h-full z-[70] shadow-2xl border-l border-border/30 bg-background">
                <AccountDetailPanel
                  account={selectedAccount}
                  onClose={() => setSelectedAccount(null)}
                />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
