import { useState, useRef, useEffect, useMemo } from "react";
import { useModuleTabUrl } from "@/hooks/use-module-tab-url";
import { useQuery } from "@tanstack/react-query";
import { ModuleShell } from "@/components/ModuleShell";
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
} from "@/components/ModulePageChrome";
import { HelpDeskIcon } from "@/components/icons/ModuleIcons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Ticket, Globe, Clock, BarChart3, ClipboardList } from "lucide-react";
import { HelpDeskDashboardTab } from "@/components/help-desk/HelpDeskDashboardTab";
import { ServiceDeskTicketsTab } from "@/components/service-desk/ServiceDeskTicketsTab";
import { HelpDeskPortalTab } from "@/components/help-desk/HelpDeskPortalTab";
import { HelpDeskSlaTab } from "@/components/help-desk/HelpDeskSlaTab";
import { HelpDeskReportsTab } from "@/components/help-desk/HelpDeskReportsTab";
import { ModuleTrackingBoard } from "@/components/workspaces/ModuleTrackingBoard";
import { HD_ACCENT } from "@/components/help-desk/HelpDeskUi";
import type { HelpDeskDashboard } from "@/components/service-desk/types";
import type { TicketRow } from "@/components/service-desk/types";

const TAB_ITEMS = [
  { value: "dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { value: "tickets", label: "Tickets", short: "Tickets", icon: Ticket },
  { value: "task-tracker", label: "Task Tracker", short: "Tasks", icon: ClipboardList },
  { value: "portal", label: "Client Portal", short: "Portal", icon: Globe },
  { value: "sla", label: "SLA Management", short: "SLA", icon: Clock },
  { value: "reports", label: "Reports", short: "Reports", icon: BarChart3 },
] as const;

const HD_TAB_VALUES = TAB_ITEMS.map((t) => t.value);

function parseHelpDeskUrl() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const projectId = params.get("projectId");
  const ticket = params.get("ticket");
  return {
    projectId: projectId && /^\d+$/.test(projectId) ? Number(projectId) : null,
    ticketId: ticket && /^\d+$/.test(ticket) ? Number(ticket) : null,
    openTickets: projectId != null || ticket != null,
  };
}

export default function HelpDeskPage() {
  const urlState = useMemo(() => parseHelpDeskUrl(), []);
  const fallbackTab = urlState.openTickets ? "tickets" : "dashboard";
  const [activeTab, setActiveTab] = useModuleTabUrl(HD_TAB_VALUES, fallbackTab as typeof HD_TAB_VALUES[number]);
  const [searchTerm, setSearchTerm] = useState("");
  const [ticketFilters, setTicketFilters] = useState<{ slaFilter?: string; status?: string; priority?: string; type?: string }>({});
  const tabsListRef = useRef<HTMLDivElement>(null);

  const { data: dashboard } = useQuery<HelpDeskDashboard>({
    queryKey: ["/api/help-desk/dashboard"],
    staleTime: 30_000,
    enabled: activeTab === "dashboard",
  });
  const { data: tickets = [] } = useQuery<TicketRow[]>({
    queryKey: ["/api/help-desk/tickets"],
    staleTime: 30_000,
    enabled: activeTab === "tickets" || activeTab === "dashboard",
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
    <ModuleShell className={modulePageShellClass} testId="help-desk-page" mainClassName={modulePageMainClass}>
        <div className={modulePageBannerWrapClass}>
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

        <div className={modulePageStickyHeaderClass}>
          <ModuleHeader
            icon={HelpDeskIcon}
            title="Help Desk"
            subtitle="Project delivery & client support"
            searchPlaceholder="Search tickets…"
            searchValue={searchTerm}
            onSearchChange={(v) => { setSearchTerm(v); if (v && activeTab !== "tickets") setActiveTab("tickets"); }}
            searchTestId="input-help-desk-search"
            titleTestId="text-help-desk-title"
          />

          <div className={modulePageTabsWrapClass}>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList
                ref={tabsListRef}
                className={modulePageTabsListClass}
              >
                {TAB_ITEMS.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    aria-label={tab.label}
                    title={tab.label}
                    data-testid={`hd-tab-${tab.value}`}
                    className={cn(modulePageTabTriggerClass, "data-[state=active]:bg-sky-500/10 data-[state=active]:text-sky-700 dark:data-[state=active]:text-sky-300")}
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
        </div>

        <div className={modulePageContentOuterClass}>
          <div className={modulePageContentScrollClass}>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsContent value="dashboard" className={modulePageTabContentClass}>
                <HelpDeskDashboardTab onFilterTickets={handleDashboardFilter} />
              </TabsContent>
              <TabsContent value="tickets" className={modulePageTabContentClass}>
                <ServiceDeskTicketsTab
                  apiBase="/api/help-desk"
                  includeDefect
                  initialFilters={ticketFilters}
                  searchQuery={searchTerm}
                  initialProjectId={urlState.projectId}
                  initialTicketId={urlState.ticketId}
                  key={`${JSON.stringify(ticketFilters)}-${searchTerm}-${urlState.projectId}-${urlState.ticketId}`}
                />
              </TabsContent>
              <TabsContent value="task-tracker" className={modulePageTabContentClass}>
                <ModuleTrackingBoard
                  apiPath="/api/help-desk/tracking-board"
                  queryKey={["/api/help-desk/tracking-board"]}
                  title="Help Desk Task Tracker"
                  description="Track follow-up actions, remediation tasks, and delivery items linked to support work."
                />
              </TabsContent>
              <TabsContent value="portal" className={modulePageTabContentClass}>
                <HelpDeskPortalTab />
              </TabsContent>
              <TabsContent value="sla" className={modulePageTabContentClass}>
                <HelpDeskSlaTab />
              </TabsContent>
              <TabsContent value="reports" className={modulePageTabContentClass}>
                <HelpDeskReportsTab />
              </TabsContent>
            </Tabs>
          </div>
        </div>
    </ModuleShell>
  );
}
