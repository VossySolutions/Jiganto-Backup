import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type DashboardType = 
  | "main" 
  | "modules"
  | "chat" 
  | "business" 
  | "crm" 
  | "documents" 
  | "tasks" 
  | "portfolio" 
  | "projects" 
  | "finance" 
  | "resources" 
  | "testing" 
  | "bpm" 
  | "helpdesk"
  | "whiteboarding"
  | "templates"
  | "surveys"
  | "esign";

export interface DashboardOption {
  id: DashboardType;
  name: string;
  description: string;
  enabled: boolean;
}

const defaultDashboards: DashboardOption[] = [
  { id: "main", name: "Main Dashboard", description: "Enterprise overview", enabled: true },
  { id: "modules", name: "All Modules", description: "Explore all platform modules", enabled: true },
  { id: "chat", name: "Chat Dashboard", description: "Team communication", enabled: true },
  { id: "tasks", name: "Tasks Dashboard", description: "Task overview", enabled: true },
  { id: "projects", name: "Projects Dashboard", description: "Project status", enabled: true },
  { id: "crm", name: "CRM Dashboard", description: "Customer insights", enabled: false },
  { id: "finance", name: "Finance Dashboard", description: "Financial overview", enabled: false },
  { id: "resources", name: "Resources Dashboard", description: "Team capacity", enabled: false },
  { id: "portfolio", name: "Portfolio Dashboard", description: "Portfolio health", enabled: false },
  { id: "business", name: "Business Dashboard", description: "Business metrics", enabled: false },
  { id: "documents", name: "Documents Dashboard", description: "Document activity", enabled: false },
  { id: "testing", name: "Testing Dashboard", description: "Test coverage", enabled: false },
  { id: "bpm", name: "BPM Dashboard", description: "Process metrics", enabled: false },
  { id: "helpdesk", name: "Help Desk Dashboard", description: "Support tickets", enabled: false },
  { id: "whiteboarding", name: "Whiteboarding Dashboard", description: "Visual boards", enabled: false },
  { id: "templates", name: "Templates Dashboard", description: "Template library", enabled: false },
  { id: "surveys", name: "Surveys Dashboard", description: "Survey responses", enabled: false },
  { id: "esign", name: "eSign Dashboard", description: "Signature status", enabled: false },
];

interface DashboardSelectorContextType {
  currentDashboard: DashboardType;
  setCurrentDashboard: (dashboard: DashboardType) => void;
  dashboards: DashboardOption[];
  enabledDashboards: DashboardOption[];
  toggleDashboard: (id: DashboardType) => void;
  setDefaultDashboard: (id: DashboardType) => void;
  defaultDashboard: DashboardType;
}

const DashboardSelectorContext = createContext<DashboardSelectorContextType | null>(null);

const STORAGE_KEY = "jiganto-dashboard-config";

export function DashboardSelectorProvider({ children }: { children: ReactNode }) {
  const [dashboards, setDashboards] = useState<DashboardOption[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const storedDashboards: DashboardOption[] = parsed.dashboards || defaultDashboards;
        const storedIds = new Set(storedDashboards.map(d => d.id));
        const missing = defaultDashboards.filter(d => !storedIds.has(d.id));
        if (missing.length > 0) {
          return [...storedDashboards, ...missing];
        }
        return storedDashboards;
      }
    } catch {}
    return defaultDashboards;
  });

  const [defaultDashboard, setDefaultDashboardState] = useState<DashboardType>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.defaultDashboard || "main";
      }
    } catch {}
    return "main";
  });

  const [currentDashboard, setCurrentDashboard] = useState<DashboardType>(defaultDashboard);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ dashboards, defaultDashboard }));
  }, [dashboards, defaultDashboard]);

  const enabledDashboards = dashboards.filter(d => d.enabled);

  const toggleDashboard = (id: DashboardType) => {
    setDashboards(prev => 
      prev.map(d => d.id === id ? { ...d, enabled: !d.enabled } : d)
    );
  };

  const setDefaultDashboard = (id: DashboardType) => {
    setDefaultDashboardState(id);
    const dashboard = dashboards.find(d => d.id === id);
    if (dashboard && !dashboard.enabled) {
      toggleDashboard(id);
    }
  };

  return (
    <DashboardSelectorContext.Provider value={{
      currentDashboard,
      setCurrentDashboard,
      dashboards,
      enabledDashboards,
      toggleDashboard,
      setDefaultDashboard,
      defaultDashboard,
    }}>
      {children}
    </DashboardSelectorContext.Provider>
  );
}

export function useDashboardSelector() {
  const context = useContext(DashboardSelectorContext);
  if (!context) {
    throw new Error("useDashboardSelector must be used within a DashboardSelectorProvider");
  }
  return context;
}
