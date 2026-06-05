import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/Sidebar";
import { useShellLayout } from "@/hooks/use-shell-layout";
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
import { PlaceholderScreen } from "@/components/testmgmt/PlaceholderScreen";
import {
  LayoutDashboard, GitBranch, Map, BookOpen, FlaskConical, Network,
  Upload, Play, Bug, LayoutGrid, ScrollText, ShieldCheck,
  ChevronDown, FolderKanban, Plus, Check, Pencil, X, Loader2,
} from "lucide-react";
import { TmScreen } from "@/types/testmgmt";
export type { TmScreen };
import { useToast } from "@/hooks/use-toast";

interface NavItem {
  id: TmScreen;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  phase?: string;
}

interface NavSection { label: string; items: NavItem[]; }

const navSections: NavSection[] = [
  {
    label: "OVERVIEW",
    items: [
      { id: "command-centre", label: "Command Centre", icon: LayoutDashboard },
      { id: "digital-twin", label: "Digital Twin", icon: GitBranch },
      { id: "navigator", label: "Test Navigator", icon: Map },
    ],
  },
  {
    label: "PLANNING",
    items: [
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
    label: "COMPLIANCE & ADMIN",
    items: [
      { id: "audit", label: "Audit Trail", icon: ScrollText },
      { id: "access", label: "Access & Roles", icon: ShieldCheck, phase: "Phase 4" },
    ],
  },
];

// ─── Project Selector ─────────────────────────────────────────────────────────
function ProjectSelector() {
  const { projects, activeProjectId, activeProject, setActiveProjectId, isLoading } = useTmProject();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const createMutation = useMutation({
    mutationFn: (name: string) => apiRequest("POST", "/api/tm/projects", { name, status: "active" }),
    onSuccess: (proj: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tm/projects"] });
      setActiveProjectId(proj.id);
      setCreating(false);
      setNewName("");
      setOpen(false);
      toast({ title: "Project created", description: proj.name });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="mx-4 my-2 h-8 bg-muted/40 rounded-lg animate-pulse" />;

  return (
    <div className="relative mx-3 my-2">
      <button
        onClick={() => setOpen(!open)}
        data-testid="btn-project-selector"
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors text-left"
      >
        <FolderKanban className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        <span className="flex-1 text-xs font-medium truncate min-w-0">
          {activeProject?.name ?? "Select project…"}
        </span>
        <ChevronDown className={cn("h-3 w-3 text-muted-foreground flex-shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="py-1 max-h-52 overflow-y-auto">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => { setActiveProjectId(p.id); setOpen(false); }}
                data-testid={`project-option-${p.id}`}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color ?? "#6366f1" }} />
                <span className="flex-1 truncate font-medium">{p.name}</span>
                {p.id === activeProjectId && <Check className="h-3 w-3 text-primary flex-shrink-0" />}
              </button>
            ))}
            {projects.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">No projects yet</div>
            )}
          </div>
          <div className="border-t border-border p-2">
            {creating ? (
              <div className="flex gap-1">
                <input
                  autoFocus
                  className="flex-1 border border-border rounded px-2 py-1 text-xs bg-background"
                  placeholder="Project name..."
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && newName.trim()) createMutation.mutate(newName.trim()); }}
                  data-testid="input-new-project-name"
                />
                <button
                  onClick={() => newName.trim() && createMutation.mutate(newName.trim())}
                  disabled={!newName.trim() || createMutation.isPending}
                  className="p-1 text-primary hover:text-primary/80"
                >
                  {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => setCreating(false)} className="p-1 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-primary rounded hover:bg-muted/50 transition-colors"
                data-testid="btn-new-project"
              >
                <Plus className="h-3 w-3" /> New project
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Inner page ───────────────────────────────────────────────────────────────
function TestManagementInner() {
  const [activeScreen, setActiveScreen] = useState<TmScreen>("command-centre");
  const { mainMargin, mobileTopOffset } = useShellLayout();
  const { activeProject } = useTmProject();

  const navigate = (screen: TmScreen) => setActiveScreen(screen);

  function renderScreen(screen: TmScreen) {
    switch (screen) {
      case "command-centre":  return <CommandCentreScreen onNavigate={navigate} />;
      case "digital-twin":   return <DigitalTwinScreen onNavigate={navigate} />;
      case "navigator":      return <TestNavigatorScreen />;
      case "scenarios":      return <TestScenariosScreen />;
      case "test-suites":    return <TestSuitesScreen />;
      case "test-cases":     return <TestCasesScreen />;
      case "traceability":   return <TraceabilityScreen />;
      case "import":         return <ImportTemplatesScreen />;
      case "execution":      return <ExecutionConsoleScreen />;
      case "defect-triage":  return <DefectTriageScreen />;
      case "defect-board":   return <DefectBoardScreen />;
      case "audit":          return <AuditTrailScreen />;
      case "access":         return (
        <PlaceholderScreen
          title="Access & Roles"
          description="Manage project-scoped roles: Test Manager, Tester, Functional Consultant, and external guest access."
          phase="Phase 4"
        />
      );
      default: return <CommandCentreScreen onNavigate={navigate} />;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />

      <div className={cn(
        "flex flex-1 h-screen overflow-hidden transition-all duration-300",
        mainMargin, mobileTopOffset
      )}>
        {/* Inner left navigation */}
        <div className="w-[220px] min-w-[220px] border-r border-border bg-card flex flex-col overflow-y-auto">
          <div className="px-4 py-4 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <FlaskConical className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold leading-tight">Test Management</div>
                <div className="text-[10px] text-muted-foreground font-mono tracking-wide">QA & Testing</div>
              </div>
            </div>
          </div>

          {/* Project Selector */}
          <div className="border-b border-border pb-2 flex-shrink-0">
            <div className="px-4 pt-2 pb-0 text-[10px] font-semibold text-muted-foreground tracking-[0.12em] uppercase font-mono">
              Project
            </div>
            <ProjectSelector />
            {activeProject && (
              <div className="px-4 pb-1 flex items-center gap-1.5 flex-wrap">
                {activeProject.environment?.split(",").map(e => (
                  <span key={e} className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono">
                    {e.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>

          <nav className="flex-1 py-3 space-y-0.5">
            {navSections.map(section => (
              <div key={section.label} className="mb-1">
                <div className="px-4 py-2 text-[10px] font-semibold text-muted-foreground tracking-[0.12em] uppercase font-mono">
                  {section.label}
                </div>
                {section.items.map(item => {
                  const isBuilt = !item.phase;
                  const isActive = activeScreen === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveScreen(item.id)}
                      data-testid={`nav-tm-${item.id}`}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-4 py-2 text-sm rounded-none transition-colors text-left",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                    >
                      <item.icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-primary" : "")} />
                      <span className="flex-1 truncate">{item.label}</span>
                      {!isBuilt && (
                        <span className="text-[9px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded flex-shrink-0">
                          {item.phase?.split(" ")[1]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Main content area */}
        <div className="flex-1 overflow-y-auto">
          {renderScreen(activeScreen)}
        </div>
      </div>
    </div>
  );
}

export default function TestManagementPage() {
  return (
    <TmProjectProvider>
      <TestManagementInner />
    </TmProjectProvider>
  );
}
