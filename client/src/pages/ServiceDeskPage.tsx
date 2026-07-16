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
import { ServiceDeskIcon } from "@/components/icons/ModuleIcons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, BookOpen, Ticket, Users, Clock, BarChart3, ClipboardList,
} from "lucide-react";
import { ModuleTrackingBoard } from "@/components/workspaces/ModuleTrackingBoard";
import { ServiceDeskDashboardTab } from "@/components/service-desk/ServiceDeskDashboardTab";
import { ServiceDeskCatalogueTab } from "@/components/service-desk/ServiceDeskCatalogueTab";
import { ServiceDeskTicketsTab } from "@/components/service-desk/ServiceDeskTicketsTab";
import { ServiceDeskTeamsTab } from "@/components/service-desk/ServiceDeskTeamsTab";
import { ServiceDeskSlaTab } from "@/components/service-desk/ServiceDeskSlaTab";
import { ServiceDeskReportsTab } from "@/components/service-desk/ServiceDeskReportsTab";
import { SD_ACCENT } from "@/components/service-desk/ServiceDeskUi";
import type { ServiceDeskDashboard } from "@/components/service-desk/types";
import type { TicketRow } from "@/components/service-desk/types";

const TAB_ITEMS = [
  { value: "dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { value: "catalogue", label: "Service Catalogue", short: "Catalogue", icon: BookOpen },
  { value: "tickets", label: "Tickets", short: "Tickets", icon: Ticket },
  { value: "task-tracker", label: "Task Tracker", short: "Tasks", icon: ClipboardList },
  { value: "teams", label: "Teams & Routing", short: "Teams", icon: Users },
  { value: "sla", label: "SLA Management", short: "SLA", icon: Clock },
  { value: "reports", label: "Reports", short: "Reports", icon: BarChart3 },
] as const;

const SD_TAB_VALUES = TAB_ITEMS.map((t) => t.value);

function parseServiceDeskUrl() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const projectId = params.get("projectId");
  const ticket = params.get("ticket");
  return {
    projectId: projectId && /^\d+$/.test(projectId) ? Number(projectId) : null,
    ticketId: ticket && /^\d+$/.test(ticket) ? Number(ticket) : null,
    openTickets: projectId != null || ticket != null,
  };
}

export default function ServiceDeskPage() {
  const urlState = useMemo(() => parseServiceDeskUrl(), []);
  const fallbackTab = urlState.openTickets ? "tickets" : "dashboard";
  const [activeTab, setActiveTab] = useModuleTabUrl(SD_TAB_VALUES, fallbackTab as typeof SD_TAB_VALUES[number]);
  const [searchTerm, setSearchTerm] = useState("");
  const [ticketFilters, setTicketFilters] = useState<{ slaFilter?: string; status?: string; priority?: string }>({});
  const tabsListRef = useRef<HTMLDivElement>(null);

  const { data: dashboard } = useQuery<ServiceDeskDashboard>({
    queryKey: ["/api/service-desk/dashboard"],
    staleTime: 30_000,
    enabled: activeTab === "dashboard",
  });
  const { data: tickets = [] } = useQuery<TicketRow[]>({
    queryKey: ["/api/service-desk/tickets"],
    staleTime: 30_000,
    enabled: activeTab === "tickets" || activeTab === "dashboard",
  });

  const openCount = dashboard?.kpis.openTickets ?? tickets.filter(
    (t) => !["closed", "resolved", "completed", "answered"].includes(t.status),
  ).length;

  useEffect(() => {
    const list = tabsListRef.current;
    if (!list) return;
    if (activeTab === "dashboard") {
      list.scrollLeft = 0;
      return;
    }
    const el = list.querySelector<HTMLElement>(`[data-testid="sd-tab-${activeTab}"]`);
    el?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [activeTab]);

  const handleDashboardFilter = (filter: { slaFilter?: string; status?: string; priority?: string }) => {
    setTicketFilters(filter);
    setActiveTab("tickets");
  };

  return (
    <ModuleShell className={modulePageShellClass} testId="service-desk-page" mainClassName={modulePageMainClass}>
        <div className={modulePageBannerWrapClass}>
          <ModuleWelcomeBanner
            moduleKey="service-desk"
            features={[
              "Service catalogue & ITIL ticketing",
              "SLA tracking with business hours",
              "CAB workflow for changes",
              "Teams, routing & time logging",
            ]}
          />
        </div>

        <div className={modulePageStickyHeaderClass}>
          <ModuleHeader
            icon={ServiceDeskIcon}
            title="Service Desk"
            subtitle="Internal IT & managed services"
            searchPlaceholder="Search tickets…"
            searchValue={searchTerm}
            onSearchChange={(v) => {
              setSearchTerm(v);
              if (v && activeTab !== "tickets") setActiveTab("tickets");
            }}
            searchTestId="input-service-desk-search"
            titleTestId="text-service-desk-title"
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
                    data-testid={`sd-tab-${tab.value}`}
                    className={cn(modulePageTabTriggerClass, "data-[state=active]:bg-teal-500/10 data-[state=active]:text-teal-700 dark:data-[state=active]:text-teal-300")}
                  >
                    <tab.icon
                      className="h-4 w-4 shrink-0"
                      style={{ color: activeTab === tab.value ? SD_ACCENT : undefined }}
                    />
                    <span className="hidden xs:inline sm:inline">{tab.label}</span>
                    <span className="xs:hidden sm:hidden">{tab.short}</span>
                    {tab.value === "tickets" && openCount > 0 && (
                      <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-[10px]">
                        {openCount}
                      </Badge>
                    )}
                    {tab.value === "dashboard" && (dashboard?.kpis.slaBreached ?? 0) > 0 && (
                      <Badge variant="destructive" className="ml-0.5 h-5 px-1.5 text-[10px]">
                        {dashboard!.kpis.slaBreached}
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
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsContent value="dashboard" className={modulePageTabContentClass}>
                <ServiceDeskDashboardTab onFilterTickets={handleDashboardFilter} />
              </TabsContent>
              <TabsContent value="catalogue" className={modulePageTabContentClass}>
                <ServiceDeskCatalogueTab />
              </TabsContent>
              <TabsContent value="tickets" className={modulePageTabContentClass}>
                <ServiceDeskTicketsTab
                  initialFilters={ticketFilters}
                  searchQuery={searchTerm}
                  initialTicketId={urlState.ticketId}
                  key={`${JSON.stringify(ticketFilters)}-${searchTerm}-${urlState.ticketId ?? ""}`}
                />
              </TabsContent>
              <TabsContent value="task-tracker" className={modulePageTabContentClass}>
                <ModuleTrackingBoard
                  apiPath="/api/service-desk/tracking-board"
                  queryKey={["/api/service-desk/tracking-board"]}
                  title="Service Desk Task Tracker"
                  description="Track ITSM actions, change tasks, and operational follow-ups."
                />
              </TabsContent>
              <TabsContent value="teams" className={modulePageTabContentClass}>
                <ServiceDeskTeamsTab />
              </TabsContent>
              <TabsContent value="sla" className={modulePageTabContentClass}>
                <ServiceDeskSlaTab />
              </TabsContent>
              <TabsContent value="reports" className={modulePageTabContentClass}>
                <ServiceDeskReportsTab />
              </TabsContent>
            </Tabs>
          </div>
        </div>
    </ModuleShell>
  );
}
