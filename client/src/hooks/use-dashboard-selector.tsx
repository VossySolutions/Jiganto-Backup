import { createContext, useContext, useState, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, fetchWithAuth } from "@/lib/queryClient";
import type { DashboardUserPreferences } from "@shared/models/dashboard";

export type BuiltInDashboardType =
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

export type DashboardType = BuiltInDashboardType | `custom-${number}`;

export function customDashboardId(id: number): DashboardType {
  return `custom-${id}` as DashboardType;
}

export function parseCustomDashboardId(id: DashboardType): number | null {
  if (!String(id).startsWith("custom-")) return null;
  const n = Number(String(id).slice(7));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export interface DashboardOption {
  id: DashboardType;
  name: string;
  description: string;
  enabled: boolean;
  group: "system" | "module" | "custom";
}

const defaultDashboards: DashboardOption[] = [
  { id: "modules", name: "All Modules", description: "Explore all platform modules", enabled: true, group: "system" },
  { id: "main", name: "Executive Overview", description: "Cross-module summary", enabled: true, group: "system" },
  { id: "projects", name: "Projects Dashboard", description: "Project health and delivery", enabled: true, group: "module" },
  { id: "tasks", name: "Tasks Dashboard", description: "Personal and team tasks", enabled: true, group: "module" },
  { id: "crm", name: "CRM Dashboard", description: "Pipeline and opportunities", enabled: true, group: "module" },
  { id: "helpdesk", name: "Help Desk Dashboard", description: "Support tickets and SLA", enabled: true, group: "module" },
  { id: "finance", name: "Finance Dashboard", description: "Revenue, budgets, invoices", enabled: true, group: "module" },
  { id: "business", name: "Business Dashboard", description: "Strategy, OKRs, governance", enabled: true, group: "module" },
  { id: "portfolio", name: "Portfolio Dashboard", description: "Portfolio health", enabled: false, group: "module" },
  { id: "chat", name: "Chat Dashboard", description: "Team communication", enabled: false, group: "module" },
  { id: "resources", name: "Resources Dashboard", description: "Team capacity", enabled: false, group: "module" },
  { id: "documents", name: "Documents Dashboard", description: "Document activity", enabled: false, group: "module" },
  { id: "testing", name: "Testing Dashboard", description: "Test coverage", enabled: false, group: "module" },
  { id: "bpm", name: "BPM Dashboard", description: "Process metrics", enabled: false, group: "module" },
  { id: "whiteboarding", name: "Whiteboarding Dashboard", description: "Visual boards", enabled: false, group: "module" },
  { id: "templates", name: "Templates Dashboard", description: "Template library", enabled: false, group: "module" },
  { id: "surveys", name: "Surveys Dashboard", description: "Survey responses", enabled: false, group: "module" },
  { id: "esign", name: "eSign Dashboard", description: "Signature status", enabled: false, group: "module" },
];

interface DashboardSelectorContextType {
  currentDashboard: DashboardType;
  setCurrentDashboard: (dashboard: DashboardType) => void;
  dashboards: DashboardOption[];
  enabledDashboards: DashboardOption[];
  toggleDashboard: (id: BuiltInDashboardType) => void;
  setDefaultDashboard: (id: DashboardType) => void;
  defaultDashboard: DashboardType;
  hiddenModuleKeys: string[];
  toggleModuleVisibility: (key: string) => void;
  refreshCustomDashboards: () => void;
}

const DashboardSelectorContext = createContext<DashboardSelectorContextType | null>(null);

const STORAGE_KEY = "jiganto-dashboard-config";

function mergeDashboards(stored: DashboardOption[]): DashboardOption[] {
  const storedIds = new Set(stored.map((d) => d.id));
  const missing = defaultDashboards.filter((d) => !storedIds.has(d.id));
  return missing.length > 0 ? [...stored, ...missing] : stored;
}

export function DashboardSelectorProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: serverPrefs } = useQuery({
    queryKey: ["/api/dashboard/preferences"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/dashboard/preferences");
      if (!res.ok) return null;
      return (await res.json()) as DashboardUserPreferences;
    },
    staleTime: 60_000,
    retry: false,
  });

  const { data: customRows = [] } = useQuery({
    queryKey: ["/api/dashboards"],
    queryFn: async () => {
      const res = await fetchWithAuth("/api/dashboards");
      if (!res.ok) return [];
      return (await res.json()) as { id: number; name: string; description: string | null; isShared?: boolean }[];
    },
    staleTime: 30_000,
  });

  const [dashboards, setDashboards] = useState<DashboardOption[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return mergeDashboards(parsed.dashboards || defaultDashboards);
      }
    } catch {}
    return defaultDashboards;
  });

  const [defaultDashboard, setDefaultDashboardState] = useState<DashboardType>("modules");
  const [hiddenModuleKeys, setHiddenModuleKeys] = useState<string[]>([]);
  const [currentDashboard, setCurrentDashboardState] = useState<DashboardType>("modules");

  useEffect(() => {
    if (!serverPrefs) return;
    if (serverPrefs.defaultDashboard) {
      setDefaultDashboardState(serverPrefs.defaultDashboard as DashboardType);
    }
    const restore =
      (serverPrefs.lastDashboard as DashboardType | undefined) ??
      (serverPrefs.defaultDashboard as DashboardType | undefined);
    if (restore) {
      setCurrentDashboardState(restore);
    }
    if (serverPrefs.hiddenModuleKeys) {
      setHiddenModuleKeys(serverPrefs.hiddenModuleKeys);
    }
    if (serverPrefs.enabledDashboardIds?.length) {
      setDashboards((prev) =>
        prev.map((d) => ({
          ...d,
          enabled: serverPrefs.enabledDashboardIds.includes(d.id),
        })),
      );
    }
  }, [serverPrefs]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ dashboards, defaultDashboard, hiddenModuleKeys }),
    );
  }, [dashboards, defaultDashboard, hiddenModuleKeys]);

  const customDashboards: DashboardOption[] = useMemo(
    () =>
      customRows.map((row) => ({
        id: customDashboardId(row.id),
        name: row.name,
        description: row.description ?? (row.isShared ? "Shared with you" : "Custom dashboard"),
        enabled: true,
        group: "custom" as const,
      })),
    [customRows],
  );

  const allDashboards = useMemo(() => [...dashboards, ...customDashboards], [dashboards, customDashboards]);
  const enabledDashboards = allDashboards.filter((d) => d.enabled);

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setCurrentDashboard = (id: DashboardType) => {
    setCurrentDashboardState(id);
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      void apiRequest("PATCH", "/api/dashboard/preferences", { lastDashboard: id }).catch(() => {});
    }, 400);
  };

  const toggleDashboard = (id: BuiltInDashboardType) => {
    setDashboards((prev) => prev.map((d) => (d.id === id ? { ...d, enabled: !d.enabled } : d)));
  };

  const setDefaultDashboard = (id: DashboardType) => {
    setDefaultDashboardState(id);
    const dashboard = allDashboards.find((d) => d.id === id);
    if (dashboard && !dashboard.enabled && !String(id).startsWith("custom-")) {
      toggleDashboard(id as BuiltInDashboardType);
    }
  };

  const toggleModuleVisibility = (key: string) => {
    setHiddenModuleKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const refreshCustomDashboards = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/dashboards"] });
  };

  return (
    <DashboardSelectorContext.Provider
      value={{
        currentDashboard,
        setCurrentDashboard,
        dashboards: allDashboards,
        enabledDashboards,
        toggleDashboard,
        setDefaultDashboard,
        defaultDashboard,
        hiddenModuleKeys,
        toggleModuleVisibility,
        refreshCustomDashboards,
      }}
    >
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
