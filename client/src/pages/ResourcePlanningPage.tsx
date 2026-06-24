import { useState, useEffect } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { ModuleHeader } from "@/components/ModuleHeader";
import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RP_ACCENT } from "@/components/resource-planning/ui";
import { RpPersonaProvider, type RpPersonaId, useRpPersonas, RP_PERSONA_LABELS } from "@/components/resource-planning/persona-context";
import { useRpDashboard, useRpRecruitment, useRpPipeline, useRpDemandSupply } from "@/components/resource-planning/hooks";
import { canRpRead } from "@/components/resource-planning/persona-context";
import {
  ExecutiveDashboardTab,
  DemandSupplyTab,
  HeatMapTab,
  SchedulerTab,
  SkillsInventoryTab,
  PipelineDemandTab,
  RecruitmentForecastTab,
  BenchManagementTab,
  AiWorkforceTab,
  ScenarioPlanningTab,
} from "@/components/resource-planning/tab-views";
import { ResourcePlanningIcon } from "@/components/icons/ModuleIcons";
import {
  LayoutDashboard, Zap, CalendarDays, CalendarRange, Target, Briefcase,
  Search, Users, Sparkles, GitBranch,
} from "lucide-react";

const RP_TABS = [
  { id: "exec", label: "Executive Dashboard", icon: LayoutDashboard, group: "Planning" },
  { id: "dsm", label: "Demand vs Supply", icon: Zap, badgeKey: "dsm" as const, group: "Planning" },
  { id: "heatmap", label: "Resource Heat Map", icon: CalendarDays, group: "Planning" },
  { id: "scheduler", label: "Resource Scheduler", icon: CalendarRange, group: "Planning" },
  { id: "skills", label: "Skills Inventory", icon: Target, group: "Workforce" },
  { id: "pipeline", label: "Pipeline & Demand", icon: Briefcase, badgeKey: "pipeline" as const, group: "Workforce" },
  { id: "recruit", label: "Recruitment Forecast", icon: Search, badgeKey: "recruit" as const, badgeVariant: "destructive" as const, group: "Workforce" },
  { id: "bench", label: "Bench Management", icon: Users, group: "Workforce" },
  { id: "ai", label: "AI Workforce Planner", icon: Sparkles, group: "Intelligence" },
  { id: "scenario", label: "Scenario Planning", icon: GitBranch, group: "Intelligence" },
] as const;

const PERSONA_TABS: Record<string, string[]> = {
  "res-mgr": ["exec", "dsm", "heatmap", "scheduler", "skills", "pipeline", "recruit", "bench", "ai", "scenario"],
  exec: ["exec", "scenario", "ai", "dsm"],
  sales: ["pipeline", "dsm", "scenario", "ai"],
  hr: ["recruit", "skills", "bench", "ai"],
};

const PERSONA_DEFAULT_TAB: Record<string, string> = {
  "res-mgr": "exec",
  exec: "exec",
  sales: "pipeline",
  hr: "recruit",
};

const TAB_CONTENT_CLASS = "p-3 sm:p-4 md:p-6 m-0 mt-0";

export default function ResourcePlanningPage() {
  const { data: personaConfig, isLoading: personasLoading } = useRpPersonas();
  const allowedPersonas = personaConfig?.allowed ?? ["res-mgr"];
  const defaultPersona = personaConfig?.defaultPersona ?? "res-mgr";
  const [persona, setPersona] = useState<RpPersonaId>(defaultPersona);

  useEffect(() => {
    if (personaConfig?.defaultPersona) {
      setPersona(personaConfig.defaultPersona);
    }
  }, [personaConfig?.defaultPersona]);

  useEffect(() => {
    if (!allowedPersonas.includes(persona)) {
      setPersona(allowedPersonas[0] ?? "res-mgr");
    }
  }, [allowedPersonas, persona]);

  if (personasLoading && !personaConfig) {
    return (
      <ModuleShell className="h-screen overflow-hidden bg-background" testId="resource-planning-page">
        <div className="flex items-center justify-center flex-1 py-20 text-sm text-muted-foreground">Loading resource planning…</div>
      </ModuleShell>
    );
  }

  return (
    <RpPersonaProvider persona={persona}>
      <ResourcePlanningInner
        persona={persona}
        setPersona={setPersona}
        allowedPersonas={allowedPersonas}
      />
    </RpPersonaProvider>
  );
}

function ResourcePlanningInner({
  persona,
  setPersona,
  allowedPersonas,
}: {
  persona: RpPersonaId;
  setPersona: (p: RpPersonaId) => void;
  allowedPersonas: RpPersonaId[];
}) {
  const initialTab = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("tab") ?? "exec"
    : "exec";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchTerm, setSearchTerm] = useState("");
  const { data: dash, isLoading: dashLoading } = useRpDashboard();
  const { data: recruit } = useRpRecruitment();
  const { data: pipeline } = useRpPipeline();
  const { data: dsm, isLoading: dsmLoading } = useRpDemandSupply(false);

  const tabBadges: Record<string, string | undefined> = {
    dsm: canRpRead(persona, "dashboard")
      ? (dash?.skillsGaps?.length ? String(dash.skillsGaps.length) : undefined)
      : (dsm?.kpis?.criticalShortages ? String(dsm.kpis.criticalShortages) : undefined),
    pipeline: canRpRead(persona, "pipeline") && pipeline?.kpis?.activeOpportunities
      ? String(pipeline.kpis.activeOpportunities) : undefined,
    recruit: canRpRead(persona, "recruitment") && recruit?.alert?.count
      ? String(recruit.alert.count) : undefined,
  };

  const navigateTab = (tab: string) => setActiveTab(tab);

  const visibleTabs = RP_TABS.filter((t) => (PERSONA_TABS[persona] ?? PERSONA_TABS["res-mgr"]).includes(t.id));
  const handlePersonaChange = (id: string) => {
    const pid = id as RpPersonaId;
    setPersona(pid);
    const allowed = PERSONA_TABS[pid] ?? PERSONA_TABS["res-mgr"];
    if (!allowed.includes(activeTab)) {
      setActiveTab(PERSONA_DEFAULT_TAB[pid] ?? "exec");
    }
  };

  return (
    <ModuleShell className="h-screen overflow-hidden bg-background" testId="resource-planning-page" mainClassName="h-full flex flex-col overflow-hidden">
        <div className="px-3 sm:px-4 pt-3 sm:pt-4 hidden md:block">
          <ModuleWelcomeBanner
            moduleKey="resource-planning"
            features={["Demand vs supply matrix", "Resource heat map & scheduler", "Pipeline-driven recruitment forecast", "AI workforce planner"]}
          />
        </div>

        <div className="border-b border-border/30 bg-card backdrop-blur-sm sticky top-0 z-50 shrink-0">
          <ModuleHeader
            icon={ResourcePlanningIcon}
            title="Resource Planning"
            subtitle="Workforce planning, demand forecasting & recruitment intelligence"
            searchPlaceholder="Search resources, skills, pipeline..."
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchTestId="input-resource-planning-search"
            titleTestId="text-resource-planning-title"
            onAIInsightsClick={() => setActiveTab("ai")}
            actions={
              allowedPersonas.length > 1 ? (
              <div className="hidden lg:flex items-center gap-1 p-0.5 bg-muted rounded-lg">
                {allowedPersonas.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handlePersonaChange(id)}
                    className={cn(
                      "px-2 py-1 rounded-md text-[10px] font-semibold transition-colors",
                      persona === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {RP_PERSONA_LABELS[id]}
                  </button>
                ))}
              </div>
              ) : undefined
            }
          />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="px-3 sm:px-4">
            <TabsList className="h-11 sm:h-12 bg-transparent border-0 gap-0.5 sm:gap-1 flex w-full max-w-full justify-start overflow-x-auto overflow-y-hidden scrollbar-none scroll-smooth pb-1">
              {visibleTabs.map((tab, idx) => {
                const prev = visibleTabs[idx - 1];
                const showDivider = prev && prev.group !== tab.group;
                const Icon = tab.icon;
                return (
                  <span key={tab.id} className="contents">
                    {showDivider && <span className="w-px h-6 bg-border/60 mx-0.5 self-center shrink-0" aria-hidden />}
                    <TabsTrigger
                      value={tab.id}
                      aria-label={tab.label}
                      title={tab.label}
                      className="gap-1.5 sm:gap-2 shrink-0 px-2 sm:px-3 text-xs sm:text-sm rounded-lg whitespace-nowrap data-[state=active]:bg-indigo-500/10 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400"
                      data-testid={`tab-rp-${tab.id}`}
                    >
                      <Icon
                        className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                        style={{ color: activeTab === tab.id ? RP_ACCENT : undefined }}
                      />
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
                      {"badgeKey" in tab && tabBadges[tab.badgeKey] && (
                        <Badge
                          variant={"badgeVariant" in tab ? tab.badgeVariant : "secondary"}
                          className="ml-0.5 sm:ml-1 h-5 px-1.5 text-[10px] font-medium"
                        >
                          {(tab.badgeKey === "dsm" && (dashLoading || dsmLoading)) ? "…" : tabBadges[tab.badgeKey]}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </span>
                );
              })}
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          <Tabs value={activeTab} className="h-full">
            <TabsContent value="exec" className={TAB_CONTENT_CLASS}><ExecutiveDashboardTab onNavigate={navigateTab} /></TabsContent>
            <TabsContent value="dsm" className={TAB_CONTENT_CLASS}><DemandSupplyTab onNavigate={navigateTab} /></TabsContent>
            <TabsContent value="heatmap" className={TAB_CONTENT_CLASS}><HeatMapTab /></TabsContent>
            <TabsContent value="scheduler" className={TAB_CONTENT_CLASS}><SchedulerTab /></TabsContent>
            <TabsContent value="skills" className={TAB_CONTENT_CLASS}><SkillsInventoryTab searchTerm={searchTerm} /></TabsContent>
            <TabsContent value="pipeline" className={TAB_CONTENT_CLASS}><PipelineDemandTab onNavigate={navigateTab} /></TabsContent>
            <TabsContent value="recruit" className={TAB_CONTENT_CLASS}><RecruitmentForecastTab /></TabsContent>
            <TabsContent value="bench" className={TAB_CONTENT_CLASS}><BenchManagementTab onNavigate={navigateTab} persona={persona} /></TabsContent>
            <TabsContent value="ai" className={TAB_CONTENT_CLASS}><AiWorkforceTab onNavigate={navigateTab} /></TabsContent>
            <TabsContent value="scenario" className={TAB_CONTENT_CLASS}><ScenarioPlanningTab /></TabsContent>
          </Tabs>
        </div>
    </ModuleShell>
  );
}
