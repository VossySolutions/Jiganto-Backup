import { useState } from "react";
import { useModuleTabUrl } from "@/hooks/use-module-tab-url";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { ModuleShell } from "@/components/ModuleShell";
import { ModuleHeader } from "@/components/ModuleHeader";
import { ModuleWelcomeBanner } from "@/components/ModuleWelcomeBanner";
import {
  modulePageBannerWrapClass,
  modulePageContentOuterClass,
  modulePageMainClass,
  modulePageShellClass,
  modulePageStickyHeaderClass,
} from "@/components/ModulePageChrome";
import { TestManagementIcon } from "@/components/icons/ModuleIcons";
import { TmProjectProvider, useTmProject } from "@/contexts/TmProjectContext";
import { CommandCentreScreen } from "@/components/testmgmt/CommandCentreScreen";
import { TestCasesScreen } from "@/components/testmgmt/TestCasesScreen";
import { TestSuitesScreen } from "@/components/testmgmt/TestSuitesScreen";
import { TestScenariosScreen } from "@/components/testmgmt/TestScenariosScreen";
import { ExecutionConsoleScreen } from "@/components/testmgmt/ExecutionConsoleScreen";
import { DefectBoardScreen } from "@/components/testmgmt/DefectBoardScreen";
import { DefectTriageScreen } from "@/components/testmgmt/DefectTriageScreen";
import { ImportTemplatesScreen } from "@/components/testmgmt/ImportTemplatesScreen";
import { TraceabilityScreen } from "@/components/testmgmt/TraceabilityScreen";
import { DigitalTwinScreen } from "@/components/testmgmt/DigitalTwinScreen";
import { TestNavigatorScreen } from "@/components/testmgmt/TestNavigatorScreen";
import { AuditTrailScreen } from "@/components/testmgmt/AuditTrailScreen";
import { TestLibraryScreen } from "@/components/testmgmt/TestLibraryScreen";
import { TestCyclesScreen } from "@/components/testmgmt/TestCyclesScreen";
import { AccessRolesScreen } from "@/components/testmgmt/AccessRolesScreen";
import { PhaseComparisonScreen } from "@/components/testmgmt/PhaseComparisonScreen";
import { TmScreenShell } from "@/components/testmgmt/TmScreenShell";
import {
  LayoutDashboard, GitBranch, Map, BookOpen, FlaskConical, Network,
  Upload, Play, Bug, LayoutGrid, ScrollText, ShieldCheck, RotateCcw,
  ChevronDown, FolderKanban, Plus, Check, Loader2, Layers, Menu, GitCompare, LayoutTemplate, ClipboardList,
} from "lucide-react";
import { TmProjectRequiredEmpty } from "@/components/testmgmt/TmProjectRequiredEmpty";
import { ModuleTrackingBoard } from "@/components/workspaces/ModuleTrackingBoard";
import { TmScreen } from "@/types/testmgmt";
export type { TmScreen };
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SaveAsPlatformTemplateDialog } from "@/components/templates/SaveAsPlatformTemplateDialog";

interface NavItem {
  id: TmScreen;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection { label: string; items: NavItem[]; }

const navSections: NavSection[] = [
  {
    label: "OVERVIEW",
    items: [
      { id: "command-centre", label: "Command Centre", icon: LayoutDashboard },
      { id: "digital-twin", label: "Digital Twin", icon: GitBranch },
      { id: "navigator", label: "Test Navigator", icon: Map },
      { id: "phase-comparison", label: "Phase Comparison", icon: GitCompare },
    ],
  },
  {
    label: "PLANNING",
    items: [
      { id: "task-tracker", label: "Task Tracker", icon: ClipboardList },
      { id: "test-library", label: "Test Library", icon: Layers },
      { id: "test-cycles", label: "Test Cycles", icon: RotateCcw },
      { id: "scenarios", label: "Test Scenarios", icon: BookOpen },
      { id: "test-suites", label: "Test Suites", icon: FolderKanban },
      { id: "test-cases", label: "Test Cases", icon: FlaskConical },
      { id: "traceability", label: "Traceability (RTM)", icon: Network },
      { id: "import", label: "Import & Templates", icon: Upload },
    ],
  },
  {
    label: "EXECUTION",
    items: [
      { id: "execution", label: "Execution Console", icon: Play },
      { id: "defect-triage", label: "Defect Triage", icon: Bug },
      { id: "defect-board", label: "Defect Board", icon: LayoutGrid },
    ],
  },
  {
    label: "COMPLIANCE",
    items: [
      { id: "audit", label: "Audit Trail", icon: ScrollText },
      { id: "access", label: "Access & Roles", icon: ShieldCheck },
    ],
  },
];

const TM_SCREEN_TABS = navSections.flatMap((s) => s.items.map((i) => i.id));

function ProjectSelector({ onSelect }: { onSelect?: () => void }) {
  const { projects, activeProjectId, activeProject, setActiveProjectId, isLoading } = useTmProject();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const createMutation = useMutation({
    mutationFn: (name: string) => apiRequest("POST", "/api/tm/projects", { name, status: "active" }),
    onSuccess: async (res) => {
      const proj = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/tm/projects"] });
      setActiveProjectId(proj.id);
      setCreating(false);
      setNewName("");
      setOpen(false);
      toast({ title: "Project created", description: proj.name });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="mx-3 my-2 h-8 bg-muted/40 rounded-lg animate-pulse" />;

  return (
    <div className="relative mx-3 my-2">
      <button
        onClick={() => setOpen(!open)}
        data-testid="btn-project-selector"
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-left"
      >
        <FolderKanban className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        <span className="flex-1 text-xs font-medium truncate min-w-0">{activeProject?.name ?? "Select project…"}</span>
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground flex-shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="py-1 max-h-52 overflow-y-auto">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => { setActiveProjectId(p.id); setOpen(false); onSelect?.(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 text-left"
              >
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color ?? "#6366f1" }} />
                <span className="flex-1 truncate font-medium">{p.name}</span>
                {p.id === activeProjectId && <Check className="h-3 w-3 text-primary" />}
              </button>
            ))}
          </div>
          <div className="border-t border-border p-2">
            {creating ? (
              <div className="flex gap-1">
                <input autoFocus className="flex-1 border rounded px-2 py-1 text-xs bg-background" placeholder="Project name..."
                  value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && newName.trim()) createMutation.mutate(newName.trim()); }} />
                <button onClick={() => newName.trim() && createMutation.mutate(newName.trim())} disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </button>
              </div>
            ) : (
              <button onClick={() => setCreating(true)} className="w-full flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-primary">
                <Plus className="h-3 w-3" /> New project
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SaveTmProjectAsTemplate() {
  const { activeProject } = useTmProject();
  const [open, setOpen] = useState(false);
  if (!activeProject) return null;
  return (
    <div className="px-3 pb-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg border border-dashed border-border hover:bg-muted/60 transition-colors"
        data-testid="btn-save-tm-project-template"
      >
        <LayoutTemplate className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="truncate">Save project as template</span>
      </button>
      <SaveAsPlatformTemplateDialog
        open={open}
        onOpenChange={setOpen}
        endpoint={`/api/tm/projects/${activeProject.id}/save-as-template`}
        defaultName={activeProject.name}
      />
    </div>
  );
}

function NavPanel({ activeScreen, onNavigate }: { activeScreen: TmScreen; onNavigate: (s: TmScreen) => void }) {
  return (
    <>
      <div className="border-b border-border pb-2 flex-shrink-0">
        <div className="px-4 pt-3 pb-0 text-[10px] font-semibold text-muted-foreground tracking-[0.12em] uppercase font-mono">Project</div>
        <ProjectSelector onSelect={() => {}} />
        <SaveTmProjectAsTemplate />
      </div>
      <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto">
        {navSections.map(section => (
          <div key={section.label}>
            <div className="px-4 py-2 text-[10px] font-semibold text-muted-foreground tracking-[0.12em] uppercase font-mono">{section.label}</div>
            {section.items.map(item => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                data-testid={`nav-tm-${item.id}`}
                className={cn(
                  "w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left",
                  activeScreen === item.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/60",
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
    </>
  );
}

function TestManagementInner() {
  const [activeScreen, setActiveScreen] = useModuleTabUrl(TM_SCREEN_TABS, "command-centre");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { activeProject, activeProjectId, isLoading: projectLoading } = useTmProject();

  const navigate = (screen: TmScreen) => {
    setActiveScreen(screen);
    setMobileNavOpen(false);
  };

  const currentLabel = navSections.flatMap(s => s.items).find(i => i.id === activeScreen)?.label ?? "Test Management";

  function renderScreen(screen: TmScreen) {
    if (!activeProjectId && screen !== "access") {
      return <TmProjectRequiredEmpty />;
    }
    switch (screen) {
      case "command-centre": return <CommandCentreScreen onNavigate={navigate} />;
      case "digital-twin": return <DigitalTwinScreen onNavigate={navigate} />;
      case "navigator": return <TestNavigatorScreen />;
      case "test-library": return <TestLibraryScreen />;
      case "test-cycles": return <TestCyclesScreen />;
      case "scenarios": return <TestScenariosScreen />;
      case "test-suites": return <TestSuitesScreen />;
      case "test-cases": return <TestCasesScreen />;
      case "traceability": return <TraceabilityScreen />;
      case "import": return <ImportTemplatesScreen />;
      case "execution": return <ExecutionConsoleScreen />;
      case "defect-triage": return <DefectTriageScreen />;
      case "defect-board": return <DefectBoardScreen />;
      case "audit": return <AuditTrailScreen />;
      case "access": return <AccessRolesScreen />;
      case "phase-comparison": return <PhaseComparisonScreen />;
      case "task-tracker":
        return activeProjectId ? (
          <ModuleTrackingBoard
            apiPath={`/api/tm/projects/${activeProjectId}/tracking-board`}
            queryKey={["/api/tm/projects", activeProjectId, "tracking-board"]}
            title="Test Management Task Tracker"
            description={`Track remediation and delivery tasks for ${activeProject?.name ?? "this project"}.`}
          />
        ) : (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Select a test project to open its task tracker.
          </div>
        );
      default: return <CommandCentreScreen onNavigate={navigate} />;
    }
  }

  return (
    <ModuleShell className={modulePageShellClass} testId="test-mgmt-page" mainClassName={modulePageMainClass}>
        <div className={modulePageBannerWrapClass}>
          <ModuleWelcomeBanner
            moduleKey="test-mgmt"
            features={["Command centre", "Test library & cycles", "Execution console", "Defect triage"]}
          />
        </div>
        <div className={modulePageStickyHeaderClass}>
          <ModuleHeader
            icon={TestManagementIcon}
            title="Test Management"
            subtitle={activeProject?.name ? `${currentLabel} · ${activeProject.name}` : "QA planning, execution & defect management"}
            titleTestId="text-test-mgmt-title"
            actions={
              <div className="lg:hidden">
                <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                  <SheetTrigger asChild>
                    <button className="p-2 rounded-lg border border-border hover:bg-muted/60" aria-label="Open menu">
                      <Menu className="h-5 w-5" />
                    </button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[min(100vw,280px)] p-0 flex flex-col">
                    <SheetHeader className="sr-only"><SheetTitle>Test Management navigation</SheetTitle></SheetHeader>
                    <NavPanel activeScreen={activeScreen} onNavigate={navigate} />
                  </SheetContent>
                </Sheet>
              </div>
            }
          />
        </div>

        <div className={cn(modulePageContentOuterClass, "flex-col lg:flex-row")}>
          {/* Desktop sidebar */}
          <div className="hidden lg:flex w-[220px] min-w-[220px] border-r border-border bg-card flex-col overflow-hidden shrink-0">
            <NavPanel activeScreen={activeScreen} onNavigate={navigate} />
          </div>

          <div className="flex-1 overflow-hidden flex flex-col min-h-0 min-w-0">
            <TmScreenShell loading={projectLoading && !activeProject} label="Loading project…">
              {renderScreen(activeScreen)}
            </TmScreenShell>
          </div>
        </div>
    </ModuleShell>
  );
}

export default function TestManagementPage() {
  return (
    <TmProjectProvider>
      <TestManagementInner />
    </TmProjectProvider>
  );
}
