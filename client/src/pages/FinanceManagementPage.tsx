import { useState, useRef, useEffect } from "react";
import { useModuleTabUrl } from "@/hooks/use-module-tab-url";
import { Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { DASHBOARD_PATH } from "@shared/app-routes";
import { CLIENT_WORKSPACE_ALWAYS_HIDDEN_KEYS } from "@shared/client-workspace-modules";
import { useClientContext } from "@/hooks/use-client-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ModuleShell } from "@/components/ModuleShell";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Wallet, Clock, Receipt, FileText, CreditCard, Link2, Settings,
} from "lucide-react";
import { FinanceIcon } from "@/components/icons/ModuleIcons";
import { ModuleHeader } from "@/components/ModuleHeader";
import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";
import {
  modulePageBannerWrapClass,
  modulePageContentOuterClass,
  modulePageContentScrollClass,
  modulePageMainClass,
  modulePageShellClass,
  modulePageStickyHeaderClass,
  modulePageTabContentClass,
  modulePageTabsListClass,
  modulePageTabsWrapClass,
  modulePageTabTriggerClass,
  ModulePageLoadingShell,
} from "@/components/ModulePageChrome";
import { FinanceDashboardTab } from "@/components/finance/FinanceDashboardTab";
import { FinanceBudgetsTab } from "@/components/finance/FinanceBudgetsTab";
import { FinanceTimesheetsTab } from "@/components/finance/FinanceTimesheetsTab";
import { FinanceExpensesTab } from "@/components/finance/FinanceExpensesTab";
import { FinanceInvoicesTab } from "@/components/finance/FinanceInvoicesTab";
import { FinanceRateCardsTab } from "@/components/finance/FinanceRateCardsTab";
import { FinanceIntegrationsTab } from "@/components/finance/FinanceIntegrationsTab";
import { FinanceSettingsTab } from "@/components/finance/FinanceSettingsTab";
import type { FinanceDashboardData } from "@/components/finance/types";
import type { BudgetListItem } from "@/components/finance/types";
import type { ExpenseReportRow } from "@/components/finance/types";
import type { FinanceInvoiceRow } from "@/components/finance/types";
import type { FinanceTimesheetPeriod } from "@/components/finance/types";
import type { FinanceRateCard } from "@/components/finance/types";
import type { ErpIntegrationRow } from "@/components/finance/types";
import type { FinanceSettings } from "@/components/finance/types";

const FINANCE_COLOR = "#10B981";

const FINANCE_TABS = ["dashboard", "budgets", "timesheets", "expenses", "invoices", "rate-cards", "integrations", "settings"] as const;

export default function FinanceManagementPage() {
  const { activeClient } = useClientContext();
  const initialProjectId = typeof window !== "undefined"
    ? Number(new URLSearchParams(window.location.search).get("projectId")) || null
    : null;
  const [activeTab, setActiveTab] = useModuleTabUrl(FINANCE_TABS, "dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const tabsListRef = useRef<HTMLDivElement>(null);

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<FinanceDashboardData>({
    queryKey: ["/api/finance/dashboard"],
    staleTime: 30_000,
    enabled: activeTab === "dashboard",
  });

  const { data: budgets = [], isLoading: budgetsLoading } = useQuery<BudgetListItem[]>({
    queryKey: ["/api/finance/budgets"],
    staleTime: 30_000,
    enabled: activeTab === "budgets",
  });

  const { data: timesheetPeriods = [], isLoading: periodsLoading } = useQuery<FinanceTimesheetPeriod[]>({
    queryKey: ["/api/finance/timesheets/periods"],
    staleTime: 30_000,
    enabled: activeTab === "timesheets",
  });

  const { data: approvalQueue = [] } = useQuery<FinanceTimesheetPeriod[]>({
    queryKey: ["/api/finance/timesheets/periods?status=submitted"],
    staleTime: 30_000,
    enabled: activeTab === "timesheets" || activeTab === "dashboard",
  });

  const { data: expenseReports = [], isLoading: expensesLoading } = useQuery<ExpenseReportRow[]>({
    queryKey: ["/api/finance/expenses/reports"],
    staleTime: 30_000,
    enabled: activeTab === "expenses" || activeTab === "dashboard",
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<FinanceInvoiceRow[]>({
    queryKey: ["/api/finance/invoices"],
    staleTime: 30_000,
    enabled: activeTab === "invoices" || activeTab === "dashboard",
  });

  const { data: rateCards = [], isLoading: rateCardsLoading } = useQuery<FinanceRateCard[]>({
    queryKey: ["/api/finance/rate-cards"],
    staleTime: 60_000,
    enabled: activeTab === "rate-cards",
  });

  const { data: integrations = [], isLoading: integrationsLoading } = useQuery<ErpIntegrationRow[]>({
    queryKey: ["/api/finance/erp/integrations"],
    staleTime: 60_000,
    enabled: activeTab === "integrations",
  });

  const { data: settings, isLoading: settingsLoading } = useQuery<FinanceSettings>({
    queryKey: ["/api/finance/settings"],
    staleTime: 60_000,
    enabled: activeTab === "settings",
  });

  const isLoading = activeTab === "dashboard" && dashboardLoading && dashboard === undefined;

  const pendingExpenses = expenseReports.filter((r) => r.status === "submitted").length;
  const unpaidInvoices = invoices.filter((i) => i.status !== "paid" && i.status !== "void").length;

  useEffect(() => {
    if (isLoading) return;
    const list = tabsListRef.current;
    if (!list) return;
    if (activeTab === "dashboard") {
      list.scrollLeft = 0;
      return;
    }
    const activeEl = list.querySelector<HTMLElement>(`[data-testid="tab-${activeTab}"]`);
    activeEl?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [activeTab, isLoading]);

  if (activeClient && CLIENT_WORKSPACE_ALWAYS_HIDDEN_KEYS.has("finance-mgmt")) {
    return <Redirect to={DASHBOARD_PATH} />;
  }

  if (isLoading) {
    return <ModulePageLoadingShell label="Loading Finance..." testId="finance-loading" />;
  }

  const tabItems = [
    { value: "dashboard", label: "Dashboard", icon: LayoutDashboard, count: null },
    { value: "budgets", label: "Budgets", icon: Wallet, count: budgets.length || null },
    { value: "timesheets", label: "Timesheets", icon: Clock, count: approvalQueue.length || null },
    { value: "expenses", label: "Expenses", icon: Receipt, count: pendingExpenses || null },
    { value: "invoices", label: "Invoices", icon: FileText, count: unpaidInvoices || null },
    { value: "rate-cards", label: "Rate Cards", icon: CreditCard, count: null },
    { value: "integrations", label: "Integrations", icon: Link2, count: null },
    { value: "settings", label: "Settings", icon: Settings, count: null },
  ];

  return (
    <ModuleShell className={modulePageShellClass} testId="finance-mgmt-page" mainClassName={modulePageMainClass}>
        <div className={modulePageBannerWrapClass}>
          <ModuleWelcomeBanner
            moduleKey="finance-mgmt"
            features={["Project budgets & RAG", "Timesheet approvals", "Expense & invoice workflows", "ERP integrations"]}
          />
        </div>

        <div className={modulePageStickyHeaderClass}>
          <ModuleHeader
            icon={FinanceIcon}
            title="Finance"
            subtitle="Budgeting, invoicing & financial reporting"
            searchPlaceholder="Search finance..."
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchTestId="input-finance-search"
            titleTestId="finance-title"
          />

          <div className={modulePageTabsWrapClass}>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList
                ref={tabsListRef}
                className={modulePageTabsListClass}
              >
                {tabItems.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    aria-label={tab.label}
                    title={tab.label}
                    className={cn(modulePageTabTriggerClass, "data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600")}
                    data-testid={`tab-${tab.value}`}
                  >
                    <tab.icon className="h-4 w-4" style={{ color: activeTab === tab.value ? FINANCE_COLOR : undefined }} />
                    <span className="hidden sm:inline">{tab.label}</span>
                    {tab.count !== null && tab.count > 0 && (
                      <Badge variant="secondary" className="ml-0.5 sm:ml-1 h-5 px-1.5 text-[10px] font-medium">
                        {tab.count}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className={modulePageContentOuterClass}>
          <div className={modulePageContentScrollClass}>
            <Tabs value={activeTab} className="h-full">
              <TabsContent value="dashboard" className={modulePageTabContentClass}>
                <FinanceDashboardTab
                  data={dashboard}
                  isLoading={dashboardLoading}
                  searchTerm={searchTerm}
                  onNavigateTab={setActiveTab}
                />
              </TabsContent>
              <TabsContent value="budgets" className={modulePageTabContentClass}>
                <FinanceBudgetsTab budgets={budgets} isLoading={budgetsLoading} searchTerm={searchTerm} filterProjectId={initialProjectId} />
              </TabsContent>
              <TabsContent value="timesheets" className={modulePageTabContentClass}>
                <FinanceTimesheetsTab
                  periods={timesheetPeriods}
                  pendingPeriods={approvalQueue}
                  isLoading={periodsLoading}
                  searchTerm={searchTerm}
                />
              </TabsContent>
              <TabsContent value="expenses" className={modulePageTabContentClass}>
                <FinanceExpensesTab reports={expenseReports} isLoading={expensesLoading} searchTerm={searchTerm} />
              </TabsContent>
              <TabsContent value="invoices" className={modulePageTabContentClass}>
                <FinanceInvoicesTab invoices={invoices} isLoading={invoicesLoading} searchTerm={searchTerm} />
              </TabsContent>
              <TabsContent value="rate-cards" className={modulePageTabContentClass}>
                <FinanceRateCardsTab rateCards={rateCards} isLoading={rateCardsLoading} searchTerm={searchTerm} />
              </TabsContent>
              <TabsContent value="integrations" className={modulePageTabContentClass}>
                <FinanceIntegrationsTab integrations={integrations} isLoading={integrationsLoading} />
              </TabsContent>
              <TabsContent value="settings" className={modulePageTabContentClass}>
                <FinanceSettingsTab settings={settings} isLoading={settingsLoading} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
    </ModuleShell>
  );
}
