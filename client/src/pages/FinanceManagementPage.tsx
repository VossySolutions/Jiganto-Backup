import { useState, useRef, useEffect } from "react";
import { Redirect } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { DASHBOARD_PATH } from "@shared/app-routes";
import { CLIENT_WORKSPACE_ALWAYS_HIDDEN_KEYS } from "@shared/client-workspace-modules";
import { useClientContext } from "@/hooks/use-client-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/Sidebar";
import { useShellLayout } from "@/hooks/use-shell-layout";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Wallet, Clock, Receipt, FileText, CreditCard, Link2, Settings,
} from "lucide-react";
import { FinanceIcon } from "@/components/icons/ModuleIcons";
import { ModuleHeader } from "@/components/ModuleHeader";
import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";
import { FinanceDashboardTab } from "@/components/finance/FinanceDashboardTab";
import { FinanceBudgetsTab } from "@/components/finance/FinanceBudgetsTab";
import { FinanceTimesheetsTab } from "@/components/finance/FinanceTimesheetsTab";
import { FinanceExpensesTab } from "@/components/finance/FinanceExpensesTab";
import { FinanceInvoicesTab } from "@/components/finance/FinanceInvoicesTab";
import { FinanceRateCardsTab } from "@/components/finance/FinanceRateCardsTab";
import { FinanceIntegrationsTab } from "@/components/finance/FinanceIntegrationsTab";
import { FinanceSettingsTab } from "@/components/finance/FinanceSettingsTab";
import { FinancePageLoading } from "@/components/finance/FinanceUi";
import type { FinanceDashboardData } from "@/components/finance/types";
import type { BudgetListItem } from "@/components/finance/types";
import type { ExpenseReportRow } from "@/components/finance/types";
import type { FinanceInvoiceRow } from "@/components/finance/types";
import type { FinanceTimesheetPeriod } from "@/components/finance/types";
import type { FinanceRateCard } from "@/components/finance/types";
import type { ErpIntegrationRow } from "@/components/finance/types";
import type { FinanceSettings } from "@/components/finance/types";

const FINANCE_COLOR = "#10B981";

export default function FinanceManagementPage() {
  const { activeClient } = useClientContext();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const tabsListRef = useRef<HTMLDivElement>(null);
  const { mainOffset, mobileTopOffset } = useShellLayout();

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<FinanceDashboardData>({
    queryKey: ["/api/finance/dashboard"],
  });

  const { data: budgets = [], isLoading: budgetsLoading } = useQuery<BudgetListItem[]>({
    queryKey: ["/api/finance/budgets"],
  });

  const { data: timesheetPeriods = [], isLoading: periodsLoading } = useQuery<FinanceTimesheetPeriod[]>({
    queryKey: ["/api/finance/timesheets/periods"],
  });

  const { data: approvalQueue = [], isLoading: approvalLoading } = useQuery<FinanceTimesheetPeriod[]>({
    queryKey: ["/api/finance/timesheets/periods?status=submitted"],
  });

  const { data: expenseReports = [], isLoading: expensesLoading } = useQuery<ExpenseReportRow[]>({
    queryKey: ["/api/finance/expenses/reports"],
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<FinanceInvoiceRow[]>({
    queryKey: ["/api/finance/invoices"],
  });

  const { data: rateCards = [], isLoading: rateCardsLoading } = useQuery<FinanceRateCard[]>({
    queryKey: ["/api/finance/rate-cards"],
  });

  const { data: integrations = [], isLoading: integrationsLoading } = useQuery<ErpIntegrationRow[]>({
    queryKey: ["/api/finance/erp/integrations"],
  });

  const { data: settings, isLoading: settingsLoading } = useQuery<FinanceSettings>({
    queryKey: ["/api/finance/settings"],
  });

  const isLoading =
    dashboardLoading ||
    budgetsLoading ||
    periodsLoading ||
    approvalLoading ||
    expensesLoading ||
    invoicesLoading ||
    rateCardsLoading ||
    integrationsLoading ||
    settingsLoading;

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
    return (
      <div className="h-screen overflow-hidden bg-background" data-testid="finance-loading">
        <Sidebar />
        <main className={cn("transition-all duration-300 h-full flex items-center justify-center overflow-hidden", mainOffset, mobileTopOffset)}>
          <FinancePageLoading />
        </main>
      </div>
    );
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
    <div className="h-screen overflow-hidden bg-background" data-testid="finance-mgmt-page">
      <Sidebar />
      <main className={cn("transition-all duration-300 h-full flex flex-col overflow-hidden", mainOffset, mobileTopOffset)}>
        <div className="px-3 sm:px-4 pt-3 sm:pt-4 hidden md:block">
          <ModuleWelcomeBanner
            moduleKey="finance-mgmt"
            features={["Project budgets & RAG", "Timesheet approvals", "Expense & invoice workflows", "ERP integrations"]}
          />
        </div>

        <div className="border-b border-border/30 bg-card backdrop-blur-sm sticky top-0 z-50 shrink-0">
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

          <Tabs value={activeTab} onValueChange={setActiveTab} className="px-3 sm:px-4">
            <TabsList
              ref={tabsListRef}
              className="h-11 sm:h-12 bg-transparent border-0 gap-0.5 sm:gap-1 flex w-full max-w-full justify-start overflow-x-auto overflow-y-hidden scrollbar-none scroll-smooth"
            >
              {tabItems.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  aria-label={tab.label}
                  title={tab.label}
                  className="gap-1.5 sm:gap-2 shrink-0 px-2 sm:px-3 text-xs sm:text-sm rounded-lg whitespace-nowrap data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600"
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

        <div className="flex-1 overflow-auto min-h-0">
          <Tabs value={activeTab} className="h-full">
            <TabsContent value="dashboard" className="p-3 sm:p-4 md:p-6 m-0">
              <FinanceDashboardTab
                data={dashboard}
                isLoading={dashboardLoading}
                searchTerm={searchTerm}
                onNavigateTab={setActiveTab}
              />
            </TabsContent>
            <TabsContent value="budgets" className="p-3 sm:p-4 md:p-6 m-0">
              <FinanceBudgetsTab budgets={budgets} isLoading={budgetsLoading} searchTerm={searchTerm} />
            </TabsContent>
            <TabsContent value="timesheets" className="p-3 sm:p-4 md:p-6 m-0">
              <FinanceTimesheetsTab
                periods={timesheetPeriods}
                pendingPeriods={approvalQueue}
                isLoading={periodsLoading}
                searchTerm={searchTerm}
              />
            </TabsContent>
            <TabsContent value="expenses" className="p-3 sm:p-4 md:p-6 m-0">
              <FinanceExpensesTab reports={expenseReports} isLoading={expensesLoading} searchTerm={searchTerm} />
            </TabsContent>
            <TabsContent value="invoices" className="p-3 sm:p-4 md:p-6 m-0">
              <FinanceInvoicesTab invoices={invoices} isLoading={invoicesLoading} searchTerm={searchTerm} />
            </TabsContent>
            <TabsContent value="rate-cards" className="p-3 sm:p-4 md:p-6 m-0">
              <FinanceRateCardsTab rateCards={rateCards} isLoading={rateCardsLoading} searchTerm={searchTerm} />
            </TabsContent>
            <TabsContent value="integrations" className="p-3 sm:p-4 md:p-6 m-0">
              <FinanceIntegrationsTab integrations={integrations} isLoading={integrationsLoading} />
            </TabsContent>
            <TabsContent value="settings" className="p-3 sm:p-4 md:p-6 m-0">
              <FinanceSettingsTab settings={settings} isLoading={settingsLoading} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
