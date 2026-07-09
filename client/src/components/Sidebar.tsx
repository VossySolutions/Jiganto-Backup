import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Settings,
  LogOut,
  Building2,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Monitor,
  ChevronsUpDown,
  Check,
  Menu,
  X,
} from "lucide-react";
import {
  DashboardIcon,
  ChatIcon,
  DocumentsIcon,
  PortfolioIcon,
  ProjectsIcon,
  TasksIcon,
  WorkspacesIcon,
  BusinessIcon,
  CRMIcon,
  FinanceIcon,
  ResourcesIcon,
  ResTimesheetsIcon,
  ResourcePlanningIcon,
  ServiceDeskIcon,
  HelpDeskIcon,
  TestManagementIcon,
  BPMIcon,
  SurveysIcon,
  DigitalSigningIcon,
  WhiteboardIcon,
  TemplatesIcon,
} from "@/components/icons/ModuleIcons";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentOrganisation } from "@/hooks/use-jiganto";
import { getSettingsAccess, organisationDisplayName } from "@/lib/settings-access";
import { settingsPathForTier } from "@/lib/settings-routes";
import { useSidebarState } from "@/hooks/use-sidebar-state";
import { useShellLayout } from "@/hooks/use-shell-layout";
import { useTheme } from "@/hooks/use-theme";
import { useClientContext } from "@/hooks/use-client-context";
import { useClientModuleVisibility } from "@/hooks/use-client-module-visibility";
import { usePermissions } from "@/hooks/use-permissions";
import { useModuleAccess } from "@/hooks/use-module-access";
import { useResourceScope } from "@/hooks/use-resource-scope";
import { DASHBOARD_PATH, isDashboardPath } from "@shared/app-routes";
import { dashboardPathForClient } from "@/lib/workspace-scope";
import { preloadRoute } from "@/lib/route-preload";
import { PLATFORM_ROLE_LABELS } from "@shared/models/permissions";
import {
  CLIENT_WORKSPACE_BLOCKED_MODULE_KEYS,
  CLIENT_ROLE_EXTRA_BLOCKED_MODULE_KEYS,
  CONTRACTOR_PORTAL_ALLOWED_MODULE_KEYS,
  navPathToModuleKey,
} from "@shared/models/module-access";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ModuleItem {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  description?: string;
  color: string;
}

interface ModuleGroup {
  label: string | null;
  items: ModuleItem[];
}

const pinnedItem: ModuleItem = {
  name: "Dashboard",
  icon: DashboardIcon,
  href: DASHBOARD_PATH,
  color: "#1E88C8",
};

const moduleGroups: ModuleGroup[] = [
  {
    label: null,
    items: [pinnedItem],
  },
  {
    label: "Collaboration",
    items: [
      {
        name: "Chat",
        icon: ChatIcon,
        href: "/modules/chat",
        description: "Team communication",
        color: "#6366F1",
      },
      {
        name: "Documents",
        icon: DocumentsIcon,
        href: "/modules/documents",
        description: "Document management",
        color: "#3B82F6",
      },
    ],
  },
  {
    label: "Management",
    items: [
      {
        name: "Business",
        icon: BusinessIcon,
        href: "/modules/business-mgmt",
        description: "Strategic planning & operations",
        color: "#7C3AED",
      },
      {
        name: "Clients",
        icon: CRMIcon,
        href: "/clients",
        description: "Client workspace management",
        color: "#185FA5",
      },
      {
        name: "CRM",
        icon: CRMIcon,
        href: "/modules/crm",
        description: "Customer relationships",
        color: "#22C55E",
      },
      {
        name: "Finance",
        icon: FinanceIcon,
        href: "/modules/finance-mgmt",
        description: "Budgeting & invoicing",
        color: "#10B981",
      },
      {
        name: "Timesheets",
        icon: ResTimesheetsIcon,
        href: "/modules/finance-mgmt?tab=timesheets",
        description: "Submit and approve timesheets",
        color: "#0EA5E9",
      },
      {
        name: "Resources",
        icon: ResourcesIcon,
        href: "/modules/resource-mgmt",
        description: "Capacity planning",
        color: "#F97316",
      },
      {
        name: "Resource Planning",
        icon: ResourcePlanningIcon,
        href: "/modules/resource-planning",
        description: "Workforce planning & demand forecasting",
        color: "#4338CA",
      },
    ],
  },
  {
    label: "Portfolio",
    items: [
      {
        name: "Portfolio",
        icon: PortfolioIcon,
        href: "/modules/portfolio",
        description: "Portfolios & programmes",
        color: "#7C3AED",
      },
      {
        name: "Projects",
        icon: ProjectsIcon,
        href: "/modules/projects",
        description: "Project delivery",
        color: "#0EA5E9",
      },
      {
        name: "Tasks",
        icon: TasksIcon,
        href: "/modules/tasks",
        description: "Task tracking",
        color: "#EC4899",
      },
      {
        name: "Workspaces",
        icon: WorkspacesIcon,
        href: "/modules/workspaces",
        description: "Collaborative workspace",
        color: "#F59E0B",
      },
    ],
  },
  {
    label: "Service & Support",
    items: [
      {
        name: "Service Desk",
        icon: ServiceDeskIcon,
        href: "/modules/service-desk",
        description: "Customer service management",
        color: "#14B8A6",
      },
      {
        name: "Help Desk",
        icon: HelpDeskIcon,
        href: "/modules/help-desk",
        description: "Internal support",
        color: "#0EA5E9",
      },
    ],
  },
  {
    label: "Utilities",
    items: [
      {
        name: "Test Management",
        icon: TestManagementIcon,
        href: "/modules/test-mgmt",
        description: "Test management",
        color: "#EF4444",
      },
      {
        name: "BPM",
        icon: BPMIcon,
        href: "/modules/bpm",
        description: "Process automation",
        color: "#8B5CF6",
      },
      {
        name: "Surveys",
        icon: SurveysIcon,
        href: "/modules/surveys",
        description: "Feedback & research",
        color: "#06B6D4",
      },
      {
        name: "e-Sign",
        icon: DigitalSigningIcon,
        href: "/modules/e-sign",
        description: "Electronic sign-off & approvals",
        color: "#EC4899",
      },
      {
        name: "Whiteboard",
        icon: WhiteboardIcon,
        href: "/modules/whiteboarding",
        description: "Visual collaboration",
        color: "#A855F7",
      },
      {
        name: "Templates",
        icon: TemplatesIcon,
        href: "/modules/templates",
        description: "Global master templates",
        color: "#F59E0B",
      },
    ],
  },
];

const commercialModuleGroup: ModuleGroup = {
  label: "Commercial",
  items: [
    {
      name: "Customer Management",
      icon: FinanceIcon,
      href: "/modules/customer-mgmt",
      description: "SaaS customers, billing & trials",
      color: "#534AB7",
    },
  ],
};

const allModuleItems: ModuleItem[] = moduleGroups.flatMap((g) => g.items);

const navItemIconClass = "h-[18px] w-[18px] flex-shrink-0";

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { platformRole, isReadOnly, isJigantoStaff } = usePermissions();
  const settingsHref = settingsPathForTier(
    getSettingsAccess(platformRole, isJigantoStaff).tier,
  );
  const isSettingsActive =
    location === settingsHref || location.startsWith("/settings");
  const { canAccessNavPath } = useModuleAccess();
  const { data: resourceScope } = useResourceScope();
  const isContractorPortal = resourceScope?.isContractorPortal ?? false;

  const isContractorNavAllowed = useCallback((href: string) => {
    if (!isContractorPortal) return true;
    if (href === DASHBOARD_PATH || isDashboardPath(href)) return true;
    const key = navPathToModuleKey(href);
    return key != null && CONTRACTOR_PORTAL_ALLOWED_MODULE_KEYS.has(key);
  }, [isContractorPortal]);

  const { data: organisation, isLoading: organisationLoading } = useCurrentOrganisation();
  const {
    toggleCollapse,
    toggleModuleVisibility,
    isModuleHidden,
    mobileNavOpen,
    setMobileNavOpen,
  } = useSidebarState();
  const {
    isMobile,
    effectiveCollapsed: showCollapsed,
    closeMobileNav,
    toggleMobileNav,
    sidebarWidth,
  } = useShellLayout();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { clients, activeClient, setActiveClient, isClientUser, showContextSwitcher } =
    useClientContext();
  const { isModuleVisibleInWorkspace } = useClientModuleVisibility(activeClient?.id);

  /** Any user inside a client workspace — SI-internal modules must be hidden (Docs §5). */
  const isClientWorkspaceView = !!activeClient;
  const isClientRoleView =
    platformRole === "client_project_user" || platformRole === "client_executive";
  /** Standard client users must not see Settings in a client workspace (Docs §5.1). */
  const hideSettingsInWorkspace = isClientWorkspaceView && isClientRoleView;
  const [showCustomizeDialog, setShowCustomizeDialog] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const saved = localStorage.getItem("sidebar-scroll");
    if (saved) el.scrollTop = parseInt(saved, 10);
  }, []);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      localStorage.setItem(
        "sidebar-scroll",
        String(scrollRef.current.scrollTop),
      );
    }
  }, []);

  useEffect(() => {
    if (isMobile) setMobileNavOpen(false);
  }, [location, isMobile, setMobileNavOpen]);

  useEffect(() => {
    if (!isMobile) return;
    document.body.style.overflow = mobileNavOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, mobileNavOpen]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileNavOpen, setMobileNavOpen]);

  const orgName =
    organisationDisplayName(organisation) ||
    (organisationLoading ? "Loading…" : "Organisation");
  const displayCompanyName = activeClient ? activeClient.name : orgName;
  const dashboardHref = dashboardPathForClient(activeClient);
  const showOrgDropdown =
    showContextSwitcher && !isClientUser && clients.length > 0;

  const settingsAccess = getSettingsAccess(platformRole, isJigantoStaff);
  const navGroups = useMemo(() => {
    if (settingsAccess.tier !== "system") return moduleGroups;
    const groups = [...moduleGroups];
    const mgmtIdx = groups.findIndex((g) => g.label === "Management");
    groups.splice(mgmtIdx >= 0 ? mgmtIdx : 1, 0, commercialModuleGroup);
    return groups;
  }, [settingsAccess.tier]);

  const renderNavItem = (item: ModuleItem) => {
    const href = item.href === DASHBOARD_PATH ? dashboardHref : item.href;
    const isActive =
      item.href === DASHBOARD_PATH
        ? isDashboardPath(location)
        : location === href ||
          (href !== DASHBOARD_PATH && location.startsWith(href));
    if (isModuleHidden(item.href)) return null;
    if (!canAccessNavPath(item.href)) return null;
    if (!isContractorNavAllowed(href)) return null;
    if (isClientWorkspaceView) {
      const key = navPathToModuleKey(item.href);
      if (key && CLIENT_WORKSPACE_BLOCKED_MODULE_KEYS.has(key)) return null;
      if (key && !isModuleVisibleInWorkspace(key)) return null;
      if (isClientRoleView && key && CLIENT_ROLE_EXTRA_BLOCKED_MODULE_KEYS.has(key)) return null;
    }

    if (showCollapsed) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger asChild>
            <Link href={href} onClick={closeMobileNav} onMouseEnter={() => preloadRoute(href)}>
              <div
                data-testid={`nav-${item.href.replace(/\//g, "-").slice(1) || "dashboard"}`}
                className={cn(
                  "flex items-center justify-center p-2.5 rounded-lg transition-colors duration-200 cursor-pointer",
                  isActive
                    ? "bg-primary/10 text-primary ring-1 ring-primary/15"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                )}
              >
                <item.icon className={navItemIconClass} />
              </div>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">{item.name}</TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Link key={item.href} href={href} onClick={closeMobileNav} onMouseEnter={() => preloadRoute(href)}>
        <div
          data-testid={`nav-${item.href.replace(/\//g, "-").slice(1) || "dashboard"}`}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer",
            isActive
              ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/15"
              : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
          )}
        >
          <item.icon className={navItemIconClass} />
          <span className="truncate">{item.name}</span>
        </div>
      </Link>
    );
  };

  return (
    <>
      {isMobile && mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] md:hidden animate-in fade-in duration-200"
          onClick={closeMobileNav}
        />
      )}

      {isMobile && (
        <header className="fixed top-0 left-0 right-0 z-40 flex h-12 items-center gap-2.5 border-b border-border/50 bg-background/90 backdrop-blur-md px-3 shadow-sm md:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={toggleMobileNav}
            aria-expanded={mobileNavOpen}
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            data-testid="mobile-nav-toggle"
          >
            {mobileNavOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
          <img
            src="/jiganto-logo.png"
            alt=""
            className="h-7 w-7 rounded-full object-contain shrink-0"
          />
          <span
            className="font-display text-sm font-semibold tracking-tight truncate"
            style={{ color: "#009EE2" }}
          >
            Jiganto
          </span>
        </header>
      )}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn(
          "flex h-screen flex-col justify-between fixed left-0 top-0 z-50 overflow-y-auto custom-scrollbar",
          "border-r border-border/50 bg-card/95 backdrop-blur-md",
          "transition-[transform,width] duration-300 ease-out",
          "p-3 md:p-4",
          isMobile ? "shadow-2xl" : "shadow-[1px_0_0_0_hsl(var(--border)/0.4)]",
          sidebarWidth,
          isMobile && !mobileNavOpen && "-translate-x-full pointer-events-none",
        )}
        role="navigation"
        aria-label="Main navigation"
        aria-hidden={isMobile && !mobileNavOpen}
      >
        <div className="space-y-5">
          <div
            className={cn(
              "relative pb-4 border-b border-border/40",
              showCollapsed
                ? "flex flex-col items-center gap-1.5"
                : "flex items-center justify-between gap-2",
            )}
          >
            <div
              className={cn(
                "flex items-center gap-3 min-w-0",
                showCollapsed ? "justify-center" : "px-1 flex-1 min-w-0",
              )}
            >
              <img
                src="/jiganto-logo.png"
                alt="Jiganto"
                className={cn(
                  "rounded-full flex-shrink-0 object-contain",
                  showCollapsed ? "h-8 w-8" : "h-9 w-9 md:h-10 md:w-10",
                )}
              />
              {!showCollapsed && (
                <div className="min-w-0">
                  <h1
                    className="text-lg md:text-xl font-bold font-display tracking-tight leading-tight"
                    style={{ color: "#009EE2" }}
                  >
                    Jiganto
                  </h1>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    Enterprise AI
                  </p>
                </div>
              )}
            </div>

            {isMobile && mobileNavOpen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={closeMobileNav}
                className="h-8 w-8 shrink-0 absolute right-3 top-3"
                aria-label="Close menu"
                data-testid="mobile-nav-close"
              >
                <X className="h-4 w-4" />
              </Button>
            )}

            {!isMobile && !showCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleCollapse}
                className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Collapse sidebar"
                data-testid="sidebar-toggle"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}

            {!isMobile && showCollapsed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleCollapse}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    aria-label="Expand sidebar"
                    data-testid="sidebar-toggle"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Expand Sidebar</TooltipContent>
              </Tooltip>
            )}
          </div>

          {!showCollapsed && (
            <div className="px-1">
              {(isClientUser || !showContextSwitcher) && activeClient ? (
                <div
                  className="w-full flex items-center gap-2 h-12 rounded-xl border-2 px-3 bg-muted/30"
                  style={{ borderColor: activeClient.color + "55" }}
                  data-testid="company-switcher-client"
                >
                  <div
                    className="h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: activeClient.color }}
                  >
                    {activeClient.shortCode}
                  </div>
                  <div className="text-left min-w-0">
                    <span className="truncate text-sm font-medium block">
                      {activeClient.name}
                    </span>
                    <span
                      className="text-[10px] font-medium"
                      style={{ color: "#0F6E56" }}
                    >
                      Client workspace
                    </span>
                  </div>
                </div>
              ) : !showOrgDropdown ? (
                <div
                  className="w-full flex items-center gap-2 h-12 rounded-xl border-2 px-3 bg-muted/30 border-border/60"
                  data-testid="company-switcher"
                >
                  <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="text-left min-w-0">
                    <span className="truncate text-sm font-medium block">{orgName}</span>
                    <span className="text-[10px] text-muted-foreground">Your organisation</span>
                  </div>
                </div>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between gap-2 h-12 rounded-xl border-dashed border-2 hover:border-solid hover:border-primary/50 transition-all bg-muted/30"
                      data-testid="company-switcher"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {activeClient ? (
                          <div
                            className="h-6 w-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: activeClient.color }}
                          >
                            {activeClient.shortCode}
                          </div>
                        ) : (
                          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="text-left min-w-0">
                          <span className="truncate text-sm font-medium block">
                            {displayCompanyName}
                          </span>
                          {activeClient ? (
                            <span
                              className="text-[10px] font-medium"
                              style={{ color: "#0F6E56" }}
                            >
                              Client workspace
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">
                              Master org · All projects
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-[248px] rounded-xl shadow-xl"
                  >
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Your Organisation
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => setActiveClient(null)}
                      className="cursor-pointer gap-2"
                      data-testid="company-switch-real"
                    >
                      <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{orgName}</p>
                        <p className="text-xs text-muted-foreground">
                          Master org · All projects
                        </p>
                      </div>
                      {!activeClient && (
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Customer Workspaces
                    </DropdownMenuLabel>
                    {clients.map((client) => (
                      <DropdownMenuItem
                        key={client.id}
                        onClick={() => setActiveClient(client)}
                        className="cursor-pointer gap-2"
                        data-testid={`client-switch-${client.id}`}
                      >
                        <div
                          className="h-6 w-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: client.color }}
                        >
                          {client.shortCode}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{client.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {client.projectCount != null
                              ? `${client.projectCount} project${client.projectCount !== 1 ? "s" : ""}`
                              : client.industry || "Client workspace"}
                          </p>
                        </div>
                        {activeClient?.id === client.id && (
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}

          {showCollapsed && isClientUser && activeClient && (
            /* Collapsed static badge for client users */
            <div
              className="flex justify-center"
              data-testid="company-switcher-collapsed-client"
            >
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center text-[10px] font-bold text-white"
                style={{ backgroundColor: activeClient.color }}
              >
                {activeClient.shortCode}
              </div>
            </div>
          )}

          {showCollapsed && !isClientUser && showOrgDropdown && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div
                  className="flex justify-center cursor-pointer"
                  data-testid="company-switcher-collapsed"
                >
                  {activeClient ? (
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center text-[10px] font-bold text-white hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: activeClient.color }}
                    >
                      {activeClient.shortCode}
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center hover:bg-muted transition-colors bg-muted/50">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="right"
                align="start"
                className="w-[232px] rounded-xl shadow-xl"
              >
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Your Organisation
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => setActiveClient(null)}
                  className="cursor-pointer gap-2"
                >
                  <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{orgName}</p>
                    <p className="text-xs text-muted-foreground">
                      Master org · All projects
                    </p>
                  </div>
                  {!activeClient && (
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Customer Workspaces
                </DropdownMenuLabel>
                {clients.map((client) => (
                  <DropdownMenuItem
                    key={client.id}
                    onClick={() => setActiveClient(client)}
                    className="cursor-pointer gap-2"
                    data-testid={`client-switch-collapsed-${client.id}`}
                  >
                    <div
                      className="h-6 w-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: client.color }}
                    >
                      {client.shortCode}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{client.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {client.industry || "Client workspace"}
                      </p>
                    </div>
                    {activeClient?.id === client.id && (
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {showCollapsed && !isClientUser && !showOrgDropdown && (
            <div className="flex justify-center" data-testid="company-switcher-collapsed">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-muted/50">
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          )}

          <nav className="space-y-1">
            {navGroups.map((group, groupIndex) => {
              const visibleItems = group.items.filter((item) => {
                if (isModuleHidden(item.href)) return false;
                if (!canAccessNavPath(item.href)) return false;
                if (!isContractorNavAllowed(item.href === DASHBOARD_PATH ? dashboardHref : item.href)) return false;
                if (isClientWorkspaceView) {
                  const key = navPathToModuleKey(item.href);
                  if (key && CLIENT_WORKSPACE_BLOCKED_MODULE_KEYS.has(key)) return false;
                  if (key && !isModuleVisibleInWorkspace(key)) return false;
                  if (isClientRoleView && key && CLIENT_ROLE_EXTRA_BLOCKED_MODULE_KEYS.has(key)) return false;
                }
                return true;
              });
              if (visibleItems.length === 0) return null;

              return (
                <div
                  key={group.label || "pinned"}
                  className={groupIndex > 0 ? "pt-2" : ""}
                >
                  {group.label && !showCollapsed && (
                    <p className="px-3 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-1.5 mt-2">
                      {group.label}
                    </p>
                  )}
                  {showCollapsed && group.label && groupIndex > 1 && (
                    <div className="mx-2 my-2 h-px bg-border/40" />
                  )}
                  <div className="space-y-0.5">
                    {group.items.map(renderNavItem)}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto space-y-2 border-t border-border/40 pt-4">
          {showCollapsed ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setTheme(resolvedTheme === "dark" ? "light" : "dark")
                    }
                    className="w-full h-10"
                    data-testid="theme-toggle"
                  >
                    {resolvedTheme === "dark" ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowCustomizeDialog(true)}
                    className="w-full h-10"
                    data-testid="customize-menu-btn"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Customize Menu</TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div
                    className="flex justify-center p-2 cursor-pointer"
                    data-testid="user-menu-trigger"
                  >
                    <Avatar className="h-9 w-9 border-2 border-background shadow-sm">
                      <AvatarImage src={user?.profileImageUrl || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {user?.firstName?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="right"
                  align="end"
                  className="w-56 rounded-xl shadow-xl border-border/50 backdrop-blur-sm"
                >
                  <DropdownMenuLabel className="space-y-1">
                    <div>{user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "User"}</div>
                    {platformRole && (
                      <div className="text-xs font-normal text-primary" data-testid="user-platform-role">
                        {PLATFORM_ROLE_LABELS[platformRole]}
                        {isReadOnly ? " · Read-only" : ""}
                      </div>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                    Appearance
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setTheme("light")}
                  >
                    <Sun className="mr-2 h-4 w-4" />
                    Light
                    {theme === "light" && (
                      <Check className="ml-auto h-4 w-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setTheme("dark")}
                  >
                    <Moon className="mr-2 h-4 w-4" />
                    Dark
                    {theme === "dark" && (
                      <Check className="ml-auto h-4 w-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setTheme("system")}
                  >
                    <Monitor className="mr-2 h-4 w-4" />
                    System
                    {theme === "system" && (
                      <Check className="ml-auto h-4 w-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {!hideSettingsInWorkspace && (
                    <Link href={settingsHref}>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        data-testid="menu-settings"
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </DropdownMenuItem>
                    </Link>
                  )}
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                    onClick={() => logout()}
                    data-testid="menu-logout"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <div
                className="flex items-center gap-1 px-1 py-1 bg-muted/50 rounded-lg"
                data-testid="theme-switcher"
              >
                <button
                  onClick={() => setTheme("light")}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex-1 justify-center",
                    theme === "light"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  data-testid="theme-light"
                >
                  <Sun className="h-3.5 w-3.5" />
                  Light
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex-1 justify-center",
                    theme === "dark"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  data-testid="theme-dark"
                >
                  <Moon className="h-3.5 w-3.5" />
                  Dark
                </button>
                <button
                  onClick={() => setTheme("system")}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all flex-1 justify-center",
                    theme === "system"
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  data-testid="theme-system"
                >
                  <Monitor className="h-3.5 w-3.5" />
                  Auto
                </button>
              </div>

              {!hideSettingsInWorkspace && (
                <Link
                  href={settingsHref}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 h-8 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
                    isSettingsActive && "bg-primary/10 text-primary",
                  )}
                  data-testid="sidebar-settings-link"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCustomizeDialog(true)}
                className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                data-testid="customize-menu-btn"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Customize Menu
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted cursor-pointer transition-colors"
                    data-testid="user-menu-trigger"
                  >
                    <Avatar className="h-9 w-9 border-2 border-background shadow-sm">
                      <AvatarImage src={user?.profileImageUrl || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">
                        {user?.firstName?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-medium truncate text-foreground">
                        {user?.firstName || "User"}
                      </p>
                      {platformRole && (
                        <p className="text-[10px] font-medium text-primary truncate" data-testid="sidebar-role-label">
                          {PLATFORM_ROLE_LABELS[platformRole]}
                          {isReadOnly ? " · Read-only" : ""}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground truncate">
                        {user?.email}
                      </p>
                    </div>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 rounded-xl shadow-xl border-border/50 backdrop-blur-sm"
                >
                  <DropdownMenuLabel className="space-y-0.5">
                    <div>My Account</div>
                    {platformRole && (
                      <div className="text-xs font-normal text-primary">
                        {PLATFORM_ROLE_LABELS[platformRole]}
                      </div>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                    Appearance
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setTheme("light")}
                  >
                    <Sun className="mr-2 h-4 w-4" />
                    Light
                    {theme === "light" && (
                      <Check className="ml-auto h-4 w-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setTheme("dark")}
                  >
                    <Moon className="mr-2 h-4 w-4" />
                    Dark
                    {theme === "dark" && (
                      <Check className="ml-auto h-4 w-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => setTheme("system")}
                  >
                    <Monitor className="mr-2 h-4 w-4" />
                    System
                    {theme === "system" && (
                      <Check className="ml-auto h-4 w-4 text-primary" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {!hideSettingsInWorkspace && (
                    <Link href={settingsHref}>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        data-testid="menu-settings"
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </DropdownMenuItem>
                    </Link>
                  )}
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10"
                    onClick={() => logout()}
                    data-testid="menu-logout"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      <Dialog open={showCustomizeDialog} onOpenChange={setShowCustomizeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              Customize Menu
            </DialogTitle>
            <DialogDescription>
              Show or hide menu items to personalize your workspace
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1 py-4 max-h-[400px] overflow-y-auto">
            {moduleGroups.map((group) => (
              <div key={group.label || "pinned"}>
                {group.label && (
                  <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
                    {group.label}
                  </p>
                )}
                {group.items.map((item) => {
                  const isHidden = isModuleHidden(item.href);
                  return (
                    <div
                      key={item.href}
                      onClick={() => toggleModuleVisibility(item.href)}
                      className={cn(
                        "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors",
                        isHidden ? "bg-muted/50 opacity-60" : "hover:bg-muted",
                      )}
                      data-testid={`toggle-module-${item.href.replace(/\//g, "-").slice(1) || "dashboard"}`}
                    >
                      <Checkbox
                        checked={!isHidden}
                        className="pointer-events-none"
                      />
                      <item.icon className="h-4 w-4" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{item.name}</p>
                        {item.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {item.description}
                          </p>
                        )}
                      </div>
                      {isHidden ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                allModuleItems.forEach((m) => {
                  if (isModuleHidden(m.href)) {
                    toggleModuleVisibility(m.href);
                  }
                });
              }}
            >
              Show All
            </Button>
            <Button onClick={() => setShowCustomizeDialog(false)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { allModuleItems as modules, moduleGroups };
