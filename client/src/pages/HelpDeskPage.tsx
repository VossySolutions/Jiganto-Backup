import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ModuleShell } from "@/components/ModuleShell";
import { ModuleHeader } from "@/components/ModuleHeader";
import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";
import { HelpDeskIcon } from "@/components/icons/ModuleIcons";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Ticket, Globe, Clock, BarChart3 } from "lucide-react";
import { HelpDeskDashboardTab } from "@/components/help-desk/HelpDeskDashboardTab";
import { ServiceDeskTicketsTab } from "@/components/service-desk/ServiceDeskTicketsTab";
import { HelpDeskPortalTab } from "@/components/help-desk/HelpDeskPortalTab";
import { HelpDeskSlaTab } from "@/components/help-desk/HelpDeskSlaTab";
import { HelpDeskReportsTab } from "@/components/help-desk/HelpDeskReportsTab";
import { HD_ACCENT } from "@/components/help-desk/HelpDeskUi";
import type { HelpDeskDashboard } from "@/components/service-desk/types";
import type { TicketRow } from "@/components/service-desk/types";

const TAB_ITEMS = [
  { value: "dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { value: "tickets", label: "Tickets", short: "Tickets", icon: Ticket },
  { value: "portal", label: "Client Portal", short: "Portal", icon: Globe },
  { value: "sla", label: "SLA Management", short: "SLA", icon: Clock },
  { value: "reports", label: "Reports", short: "Reports", icon: BarChart3 },
] as const;

export default function HelpDeskPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [ticketFilters, setTicketFilters] = useState<{ slaFilter?: string; status?: string; priority?: string; type?: string }>({});
  const tabsListRef = useRef<HTMLDivElement>(null);

  const { data: dashboard } = useQuery<HelpDeskDashboard>({
    queryKey: ["/api/help-desk/dashboard"],
  });
  const { data: tickets = [] } = useQuery<TicketRow[]>({
    queryKey: ["/api/help-desk/tickets"],
  });

  const openCount = dashboard?.kpis.openTickets ?? tickets.filter(
    (t) => !["closed", "resolved", "completed", "answered", "fixed", "wont_fix"].includes(t.status),
  ).length;

  useEffect(() => {
    const list = tabsListRef.current;
    if (!list) return;
    if (activeTab === "dashboard") { list.scrollLeft = 0; return; }
    list.querySelector<HTMLElement>(`[data-testid="hd-tab-${activeTab}"]`)?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [activeTab]);

  const handleDashboardFilter = (filter: { slaFilter?: string; status?: string; priority?: string; type?: string }) => {
    setTicketFilters(filter);
    setActiveTab("tickets");
  };

  return (
    <ModuleShell className="min-h-screen sm:h-screen sm:overflow-hidden bg-background" testId="help-desk-page" mainClassName="sm:h-full sm:flex sm:flex-col sm:overflow-hidden">
        <div className="px-3 sm:px-4 pt-3 sm:pt-4 hidden md:block shrink-0">
          <ModuleWelcomeBanner
            moduleKey="help-desk"
            features={[
              "UAT defects through go-live support continuity",
              "Client portal with token + magic-link auth",
              "Defect tickets linked to Test Management",
              "CSAT surveys, SLA & contracted hours billing",
            ]}
          />
        </div>

        <div className="border-b border-border/30 bg-card/80 backdrop-blur-sm sticky top-0 z-50 shrink-0">
          <ModuleHeader
            icon={HelpDeskIcon}
            title="Help Desk"
            subtitle="Project delivery & client support"
            searchPlaceholder="Search tickets…"
            searchValue={searchTerm}
            onSearchChange={(v) => { setSearchTerm(v); if (v && activeTab !== "tickets") setActiveTab("tickets"); }}
            searchTestId="input-help-desk-search"
            titleTestId="text-help-desk-title"
            compact
          />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="px-3 sm:px-4">
            <TabsList
              ref={tabsListRef}
              className="h-11 sm:h-12 bg-transparent border-0 gap-0.5 sm:gap-1 flex w-full max-w-full justify-start overflow-x-auto overflow-y-hidden scrollbar-none scroll-smooth mb-0"
            >
              {TAB_ITEMS.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  aria-label={tab.label}
                  title={tab.label}
                  data-testid={`hd-tab-${tab.value}`}
                  className="gap-1.5 shrink-0 px-2.5 sm:px-3 text-xs sm:text-sm rounded-lg whitespace-nowrap data-[state=active]:bg-sky-500/10 data-[state=active]:text-sky-700 dark:data-[state=active]:text-sky-300"
                >
                  <tab.icon
                    className="h-4 w-4 shrink-0"
                    style={{ color: activeTab === tab.value ? HD_ACCENT : undefined }}
                  />
                  <span className="hidden xs:inline sm:inline">{tab.label}</span>
                  <span className="xs:hidden sm:hidden">{tab.short}</span>
                  {tab.value === "tickets" && openCount > 0 && (
                    <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-[10px]">{openCount}</Badge>
                  )}
                  {tab.value === "dashboard" && (dashboard?.kpis.slaBreached ?? 0) > 0 && (
                    <Badge variant="destructive" className="ml-0.5 h-5 px-1.5 text-[10px]">{dashboard!.kpis.slaBreached}</Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 overflow-y-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="dashboard" className="mt-0 focus-visible:outline-none">
              <HelpDeskDashboardTab onFilterTickets={handleDashboardFilter} />
            </TabsContent>
            <TabsContent value="tickets" className="mt-0 focus-visible:outline-none">
              <ServiceDeskTicketsTab
                apiBase="/api/help-desk"
                includeDefect
                initialFilters={ticketFilters}
                searchQuery={searchTerm}
                key={`${JSON.stringify(ticketFilters)}-${searchTerm}`}
              />
            </TabsContent>
            <TabsContent value="portal" className="mt-0 focus-visible:outline-none">
              <HelpDeskPortalTab />
            </TabsContent>
            <TabsContent value="sla" className="mt-0 focus-visible:outline-none">
              <HelpDeskSlaTab />
            </TabsContent>
            <TabsContent value="reports" className="mt-0 focus-visible:outline-none">
              <HelpDeskReportsTab />
            </TabsContent>
          </Tabs>
        </div>
    </ModuleShell>
  );
}
