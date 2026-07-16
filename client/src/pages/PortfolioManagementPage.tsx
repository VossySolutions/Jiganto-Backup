import { useState } from "react";
import { useModuleTabUrl } from "@/hooks/use-module-tab-url";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Briefcase } from "lucide-react";
import {
  PfDashboardIcon,
  PfPortfoliosIcon,
  PfProgrammesIcon,
  PfRoadmapIcon,
  PfHealthIcon,
  PfReportsIcon,
  PmMilestonePlanIcon,
} from "@/components/icons/ModuleIcons";
import MilestoneTracker from "@/components/projects/MilestoneTracker";
import { PortfolioDashboardTab } from "@/components/portfolio/PortfolioDashboardTab";
import { PortfolioPortfoliosTab } from "@/components/portfolio/PortfolioPortfoliosTab";
import { PortfolioProgrammesTab } from "@/components/portfolio/PortfolioProgrammesTab";
import { PortfolioRoadmapTab } from "@/components/portfolio/PortfolioRoadmapTab";
import { PortfolioHealthMatrixTab } from "@/components/portfolio/PortfolioHealthMatrixTab";
import { PortfolioReportsTab } from "@/components/portfolio/PortfolioReportsTab";

const PORTFOLIO_TABS = ["dashboard", "portfolios", "programmes", "roadmap", "health", "reports", "milestones"] as const;

const portfolioTabTriggerClass = cn(
  modulePageTabTriggerClass,
  "data-[state=active]:bg-primary/10 data-[state=active]:text-primary",
);

export default function PortfolioManagementPage() {
  const [activeTab, setActiveTab] = useModuleTabUrl(PORTFOLIO_TABS, "dashboard");
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <ModuleShell className={modulePageShellClass} mainClassName={modulePageMainClass}>
        <div className={modulePageBannerWrapClass}>
          <ModuleWelcomeBanner
            moduleKey="portfolio"
            features={["Command centre dashboard", "Portfolio & programme tracking", "RAG health matrix", "Timeline roadmap", "360° reports"]}
          />
        </div>
        <div className={modulePageStickyHeaderClass}>
          <ModuleHeader
            icon={Briefcase}
            title="Portfolio Command Centre"
            subtitle="Strategic oversight across all programmes and projects"
            searchPlaceholder="Search portfolio..."
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchTestId="input-portfolio-header-search"
            titleTestId="text-portfolio-title"
          />

          <div className={modulePageTabsWrapClass}>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className={modulePageTabsListClass}>
                <TabsTrigger value="dashboard" className={portfolioTabTriggerClass} data-testid="tab-dashboard">
                  <PfDashboardIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Dashboard
                </TabsTrigger>
                <TabsTrigger value="portfolios" className={portfolioTabTriggerClass} data-testid="tab-portfolios">
                  <PfPortfoliosIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Portfolios
                </TabsTrigger>
                <TabsTrigger value="programmes" className={portfolioTabTriggerClass} data-testid="tab-programmes">
                  <PfProgrammesIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Programmes
                </TabsTrigger>
                <TabsTrigger value="roadmap" className={portfolioTabTriggerClass} data-testid="tab-roadmap">
                  <PfRoadmapIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Roadmap
                </TabsTrigger>
                <TabsTrigger value="health" className={portfolioTabTriggerClass} data-testid="tab-health">
                  <PfHealthIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Health
                </TabsTrigger>
                <TabsTrigger value="reports" className={portfolioTabTriggerClass} data-testid="tab-reports">
                  <PfReportsIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Reports
                </TabsTrigger>
                <TabsTrigger value="milestones" className={portfolioTabTriggerClass} data-testid="tab-milestones">
                  <PmMilestonePlanIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Milestones
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className={modulePageContentOuterClass}>
          <div className={modulePageContentScrollClass}>
            <Tabs value={activeTab} className="space-y-0">
              <TabsContent value="dashboard" className={modulePageTabContentClass}>
                <PortfolioDashboardTab onNavigate={setActiveTab} headerSearch={searchTerm} />
              </TabsContent>
              <TabsContent value="portfolios" className={modulePageTabContentClass}>
                <PortfolioPortfoliosTab searchTerm={searchTerm} />
              </TabsContent>
              <TabsContent value="programmes" className={modulePageTabContentClass}>
                <PortfolioProgrammesTab searchTerm={searchTerm} />
              </TabsContent>
              <TabsContent value="roadmap" className={modulePageTabContentClass}>
                <PortfolioRoadmapTab />
              </TabsContent>
              <TabsContent value="health" className={modulePageTabContentClass}>
                <PortfolioHealthMatrixTab />
              </TabsContent>
              <TabsContent value="reports" className={modulePageTabContentClass}>
                <PortfolioReportsTab />
              </TabsContent>
              <TabsContent value="milestones" className={modulePageTabContentClass}>
                <MilestoneTracker mode="portfolio" />
              </TabsContent>
            </Tabs>
          </div>
        </div>
    </ModuleShell>
  );
}
