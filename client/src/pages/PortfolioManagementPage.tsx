import { useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { ModuleHeader } from "@/components/ModuleHeader";
import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export default function PortfolioManagementPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchTerm, setSearchTerm] = useState("");

  return (
    <ModuleShell className="h-screen overflow-hidden bg-background" mainClassName="h-full flex flex-col overflow-hidden">
        <div className="px-3 sm:px-4 pt-3 sm:pt-4">
          <ModuleWelcomeBanner
            moduleKey="portfolio"
            features={["Command centre dashboard", "Portfolio & programme tracking", "RAG health matrix", "Timeline roadmap", "360° reports"]}
          />
        </div>
        <div className="border-b border-border/30 bg-card backdrop-blur-sm sticky top-0 z-50">
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

          <Tabs value={activeTab} onValueChange={setActiveTab} className="px-3 sm:px-4">
            <div className="overflow-x-auto -mx-1 px-1 pb-1 scrollbar-thin">
              <TabsList className="h-auto min-h-11 bg-transparent border-0 gap-1 flex-nowrap w-max sm:w-auto sm:flex-wrap">
                <TabsTrigger value="dashboard" className="gap-1.5 rounded-lg text-xs sm:text-sm px-2.5 sm:px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary shrink-0" data-testid="tab-dashboard">
                  <PfDashboardIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Dashboard
                </TabsTrigger>
                <TabsTrigger value="portfolios" className="gap-1.5 rounded-lg text-xs sm:text-sm px-2.5 sm:px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary shrink-0" data-testid="tab-portfolios">
                  <PfPortfoliosIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Portfolios
                </TabsTrigger>
                <TabsTrigger value="programmes" className="gap-1.5 rounded-lg text-xs sm:text-sm px-2.5 sm:px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary shrink-0" data-testid="tab-programmes">
                  <PfProgrammesIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Programmes
                </TabsTrigger>
                <TabsTrigger value="roadmap" className="gap-1.5 rounded-lg text-xs sm:text-sm px-2.5 sm:px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary shrink-0" data-testid="tab-roadmap">
                  <PfRoadmapIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Roadmap
                </TabsTrigger>
                <TabsTrigger value="health" className="gap-1.5 rounded-lg text-xs sm:text-sm px-2.5 sm:px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary shrink-0" data-testid="tab-health">
                  <PfHealthIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Health
                </TabsTrigger>
                <TabsTrigger value="reports" className="gap-1.5 rounded-lg text-xs sm:text-sm px-2.5 sm:px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary shrink-0" data-testid="tab-reports">
                  <PfReportsIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Reports
                </TabsTrigger>
                <TabsTrigger value="milestones" className="gap-1.5 rounded-lg text-xs sm:text-sm px-2.5 sm:px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary shrink-0" data-testid="tab-milestones">
                  <PmMilestonePlanIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Milestones
                </TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </div>

        <div className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">
          <Tabs value={activeTab} className="space-y-0">
            <TabsContent value="dashboard" className="mt-0">
              <PortfolioDashboardTab onNavigate={setActiveTab} />
            </TabsContent>
            <TabsContent value="portfolios" className="mt-0">
              <PortfolioPortfoliosTab />
            </TabsContent>
            <TabsContent value="programmes" className="mt-0">
              <PortfolioProgrammesTab />
            </TabsContent>
            <TabsContent value="roadmap" className="mt-0">
              <PortfolioRoadmapTab />
            </TabsContent>
            <TabsContent value="health" className="mt-0">
              <PortfolioHealthMatrixTab />
            </TabsContent>
            <TabsContent value="reports" className="mt-0">
              <PortfolioReportsTab />
            </TabsContent>
            <TabsContent value="milestones" className="mt-0">
              <MilestoneTracker mode="portfolio" />
            </TabsContent>
          </Tabs>
        </div>
    </ModuleShell>
  );
}
