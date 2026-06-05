import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { PmoDashboard } from "@/components/PmoDashboard";
import { useClientContext } from "@/hooks/use-client-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Activity, Users, DollarSign, Clock, ChevronDown, Settings2, Star, Check, MessageSquare, CheckSquare, FolderKanban, Presentation, FileStack, ClipboardList, PenTool, LayoutGrid } from "lucide-react";
import { ModuleDiscovery } from "@/components/ModuleDiscovery";
import { motion } from "framer-motion";
import { useDashboardSelector, type DashboardType } from "@/hooks/use-dashboard-selector";
import { QuickActionsDropdown } from "@/components/QuickActionsDropdown";
import { NotificationBell } from "@/components/NotificationBell";
import { HelpMenu } from "@/components/HelpMenu";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

function MainDashboardContent() {
  const metrics = [
    { title: "Active Projects", value: "24", change: "+12%", icon: Activity, color: "text-status-blue-foreground bg-status-blue" },
    { title: "Team Capacity", value: "87%", change: "+3%", icon: Users, color: "text-status-purple-foreground bg-status-purple" },
    { title: "Revenue YTD", value: "$2.4M", change: "+18%", icon: DollarSign, color: "text-status-green-foreground bg-status-green" },
    { title: "Avg. Cycle Time", value: "14d", change: "-2d", icon: Clock, color: "text-status-amber-foreground bg-status-amber" },
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, i) => (
          <motion.div
            key={metric.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="rounded-2xl border-border/50 shadow-sm hover:shadow-md transition-all">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {metric.title}
                </CardTitle>
                <div className={cn("p-1.5 rounded-lg", metric.color)}>
                  <metric.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-display">{metric.value}</div>
                <p className="text-xs text-muted-foreground flex items-center mt-1">
                  <span className="text-status-green-foreground font-medium mr-1">{metric.change}</span>
                  from last month
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="rounded-2xl border-border/50 shadow-sm h-full">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest updates across your modules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {[
                  { status: "In Progress", color: "bg-status-blue text-status-blue-foreground" },
                  { status: "Completed", color: "bg-status-green text-status-green-foreground" },
                  { status: "At Risk", color: "bg-status-amber text-status-amber-foreground" },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 items-start pb-6 border-b last:border-0 last:pb-0">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <div className={cn("h-2.5 w-2.5 rounded-full", item.color.split(" ")[0])} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        Project "Alpha" status updated to <span className={cn("px-1.5 py-0.5 rounded-md", item.color)}>{item.status}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{i + 1} hours ago • ERP Systems</p>
                    </div>
                    <Button variant="ghost" size="icon" className="ml-auto">
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="rounded-2xl border-border/50 shadow-sm bg-gradient-to-br from-primary/5 to-transparent border-primary/10">
            <CardHeader>
              <CardTitle className="text-primary">AI Insights</CardTitle>
              <CardDescription>Automated suggestions for you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-white/50 dark:bg-white/5 border border-white/20 shadow-sm text-sm leading-relaxed text-foreground/80 backdrop-blur-sm">
                Resource utilization in <strong>Design Team</strong> is approaching capacity limits for next sprint.
              </div>
              <div className="p-4 rounded-xl bg-white/50 dark:bg-white/5 border border-white/20 shadow-sm text-sm leading-relaxed text-foreground/80 backdrop-blur-sm">
                3 tasks in <strong>Mobile App</strong> project are overdue by 2 days.
              </div>
              <Button variant="outline" className="w-full rounded-xl border-primary/20 text-primary hover:bg-primary/5 hover:text-primary">
                View All Insights
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function ChatDashboard() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card className="rounded-2xl border-border/50 shadow-sm h-[400px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Recent Conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {["Product Team", "Design Review", "Engineering"].map((channel, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="h-10 w-10 rounded-lg bg-status-blue flex items-center justify-center text-status-blue-foreground font-bold">
                    {channel[0]}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{channel}</p>
                    <p className="text-xs text-muted-foreground">Last message 2 min ago</p>
                  </div>
                  <span className="bg-status-red text-status-red-foreground text-xs px-2 py-0.5 rounded-full">3</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <div>
        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Unread Messages</span>
              <span className="font-bold text-status-amber-foreground bg-status-amber px-2 py-0.5 rounded">12</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Active Channels</span>
              <span className="font-bold">8</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Team Members Online</span>
              <span className="font-bold text-status-green-foreground">24</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function TasksDashboard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="rounded-2xl border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">To Do</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-status-amber-foreground">18</div>
          <div className="mt-4 h-2 bg-status-amber rounded-full w-3/4" />
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">In Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-status-blue-foreground">12</div>
          <div className="mt-4 h-2 bg-status-blue rounded-full w-1/2" />
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground">Completed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-status-green-foreground">45</div>
          <div className="mt-4 h-2 bg-status-green rounded-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function ProjectsDashboard() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="rounded-2xl border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-primary" />
            Project Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span>On Track</span>
              <span className="bg-status-green text-status-green-foreground px-3 py-1 rounded-full text-sm font-medium">12</span>
            </div>
            <div className="flex items-center justify-between">
              <span>At Risk</span>
              <span className="bg-status-amber text-status-amber-foreground px-3 py-1 rounded-full text-sm font-medium">5</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Off Track</span>
              <span className="bg-status-red text-status-red-foreground px-3 py-1 rounded-full text-sm font-medium">2</span>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Upcoming Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {["Phase 1 Complete", "UAT Start", "Go Live"].map((milestone, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                <div className={cn("h-3 w-3 rounded-full", i === 0 ? "bg-status-green" : i === 1 ? "bg-status-amber" : "bg-status-blue")} />
                <span className="text-sm">{milestone}</span>
                <span className="text-xs text-muted-foreground ml-auto">{i + 1} week{i > 0 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GenericModuleDashboard({ title, icon: Icon }: { title: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <Card className="rounded-2xl border-border/50 shadow-sm col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {title} Overview
          </CardTitle>
          <CardDescription>Summary and key metrics for {title.toLowerCase()}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Dashboard content for {title} module will be customized here.</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const { isMasterView, canViewPmoMaster } = useClientContext();
  const { currentDashboard, setCurrentDashboard, enabledDashboards, dashboards, toggleDashboard, defaultDashboard, setDefaultDashboard } = useDashboardSelector();
  const [showConfigDialog, setShowConfigDialog] = useState(false);

  const currentDashboardInfo = dashboards.find(d => d.id === currentDashboard);

  const renderDashboardContent = () => {
    if (isMasterView && canViewPmoMaster && currentDashboard === "main") {
      return <PmoDashboard />;
    }
    switch (currentDashboard) {
      case "main":
        return <MainDashboardContent />;
      case "modules":
        return <ModuleDiscovery />;
      case "chat":
        return <ChatDashboard />;
      case "tasks":
        return <TasksDashboard />;
      case "projects":
        return <ProjectsDashboard />;
      case "whiteboarding":
        return <GenericModuleDashboard title="Whiteboarding" icon={Presentation} />;
      case "templates":
        return <GenericModuleDashboard title="Templates" icon={FileStack} />;
      case "surveys":
        return <GenericModuleDashboard title="Surveys" icon={ClipboardList} />;
      case "esign":
        return <GenericModuleDashboard title="eSign" icon={PenTool} />;
      default:
        return <MainDashboardContent />;
    }
  };

  return (
    <AppShell>
        <div className="max-w-7xl mx-auto p-8 space-y-8">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 text-3xl font-bold font-display tracking-tight text-foreground p-0 h-auto hover:bg-transparent" data-testid="dashboard-selector">
                    {currentDashboardInfo?.name || "Dashboard"}
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>Switch Dashboard</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {enabledDashboards.map(dashboard => (
                    <DropdownMenuItem
                      key={dashboard.id}
                      onClick={() => setCurrentDashboard(dashboard.id)}
                      className="flex items-center justify-between cursor-pointer"
                      data-testid={`dashboard-option-${dashboard.id}`}
                    >
                      <div>
                        <p className="font-medium">{dashboard.name}</p>
                        <p className="text-xs text-muted-foreground">{dashboard.description}</p>
                      </div>
                      {currentDashboard === dashboard.id && <Check className="h-4 w-4 text-primary" />}
                      {defaultDashboard === dashboard.id && <Star className="h-3 w-3 text-status-amber-foreground fill-status-amber" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex gap-2 items-center">
              <HelpMenu />
              <NotificationBell />
              <QuickActionsDropdown />
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setShowConfigDialog(true)}
                data-testid="configure-dashboards-btn"
                title="Configure Dashboards"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <p className="text-muted-foreground -mt-4">
            {currentDashboardInfo?.description || "Overview of your enterprise performance."}
          </p>

          {renderDashboardContent()}
        </div>
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configure Dashboards</DialogTitle>
            <DialogDescription>
              Choose which dashboards to show and set your default dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {dashboards.map(dashboard => (
              <div 
                key={dashboard.id} 
                className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Switch
                    checked={dashboard.enabled}
                    onCheckedChange={() => toggleDashboard(dashboard.id)}
                    data-testid={`toggle-dashboard-${dashboard.id}`}
                  />
                  <div>
                    <p className="font-medium text-sm">{dashboard.name}</p>
                    <p className="text-xs text-muted-foreground">{dashboard.description}</p>
                  </div>
                </div>
                <Button
                  variant={defaultDashboard === dashboard.id ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setDefaultDashboard(dashboard.id)}
                  className="gap-1"
                  data-testid={`set-default-${dashboard.id}`}
                >
                  <Star className={cn("h-3 w-3", defaultDashboard === dashboard.id && "fill-current")} />
                  {defaultDashboard === dashboard.id ? "Default" : "Set Default"}
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
