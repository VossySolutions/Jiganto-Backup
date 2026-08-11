import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const COLLAPSED_GROUPS_KEY = "sidebar-collapsed-groups";

function readCollapsedGroups(): string[] {
  try {
    const saved = localStorage.getItem(COLLAPSED_GROUPS_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

interface SidebarStateContextType {
  isCollapsed: boolean;
  toggleCollapse: () => void;
  setCollapsed: (collapsed: boolean) => void;
  /** When true, main rail stays collapsed (e.g. project workspace 52px mock). */
  lockCollapsed: boolean;
  setLockCollapsed: (locked: boolean) => void;
  hiddenModules: string[];
  toggleModuleVisibility: (moduleHref: string) => void;
  isModuleHidden: (moduleHref: string) => boolean;
  /** Select All — clear personalization hides. */
  selectAllModules: () => void;
  /** Deselect All — hide every href in the provided list. */
  deselectAllModules: (moduleHrefs: string[]) => void;
  /** Accordion: group labels whose children are hidden. */
  collapsedGroups: string[];
  toggleGroupCollapsed: (groupLabel: string) => void;
  isGroupCollapsed: (groupLabel: string) => boolean;
  setGroupCollapsed: (groupLabel: string, collapsed: boolean) => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const SidebarStateContext = createContext<SidebarStateContextType | null>(null);

export function SidebarStateProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });
  
  const [hiddenModules, setHiddenModules] = useState<string[]>(() => {
    const saved = localStorage.getItem('hidden-modules');
    return saved ? JSON.parse(saved) : [];
  });

  const [collapsedGroups, setCollapsedGroups] = useState<string[]>(readCollapsedGroups);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [lockCollapsed, setLockCollapsed] = useState(false);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    if (lockCollapsed && !isCollapsed) setIsCollapsed(true);
  }, [lockCollapsed, isCollapsed]);

  useEffect(() => {
    const closeOnDesktop = () => {
      if (window.innerWidth >= 768) setMobileNavOpen(false);
    };
    window.addEventListener("resize", closeOnDesktop);
    return () => window.removeEventListener("resize", closeOnDesktop);
  }, []);

  useEffect(() => {
    localStorage.setItem('hidden-modules', JSON.stringify(hiddenModules));
  }, [hiddenModules]);

  useEffect(() => {
    localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(collapsedGroups));
  }, [collapsedGroups]);

  const toggleCollapse = () => {
    // Project workspace locks the rail by default for layout, but the chevron
    // must always respond — unlock on explicit user toggle.
    if (lockCollapsed) {
      setLockCollapsed(false);
    }
    setIsCollapsed((prev) => !prev);
  };

  const setCollapsed = (collapsed: boolean) => {
    // Programmatic expand (e.g. ModuleShell) stays blocked while locked.
    // User-driven toggleCollapse above clears the lock first.
    if (lockCollapsed && !collapsed) return;
    setIsCollapsed(collapsed);
  };
  
  const toggleModuleVisibility = (moduleHref: string) => {
    setHiddenModules(prev => 
      prev.includes(moduleHref) 
        ? prev.filter(h => h !== moduleHref)
        : [...prev, moduleHref]
    );
  };

  const isModuleHidden = (moduleHref: string) => hiddenModules.includes(moduleHref);

  const selectAllModules = () => setHiddenModules([]);

  const deselectAllModules = (moduleHrefs: string[]) => {
    setHiddenModules([...new Set(moduleHrefs)]);
  };

  const toggleGroupCollapsed = (groupLabel: string) => {
    setCollapsedGroups((prev) =>
      prev.includes(groupLabel)
        ? prev.filter((l) => l !== groupLabel)
        : [...prev, groupLabel],
    );
  };

  const isGroupCollapsed = (groupLabel: string) =>
    collapsedGroups.includes(groupLabel);

  const setGroupCollapsed = (groupLabel: string, collapsed: boolean) => {
    setCollapsedGroups((prev) => {
      const has = prev.includes(groupLabel);
      if (collapsed && !has) return [...prev, groupLabel];
      if (!collapsed && has) return prev.filter((l) => l !== groupLabel);
      return prev;
    });
  };

  return (
    <SidebarStateContext.Provider value={{
      isCollapsed,
      toggleCollapse,
      setCollapsed,
      lockCollapsed,
      setLockCollapsed,
      hiddenModules,
      toggleModuleVisibility,
      isModuleHidden,
      selectAllModules,
      deselectAllModules,
      collapsedGroups,
      toggleGroupCollapsed,
      isGroupCollapsed,
      setGroupCollapsed,
      mobileNavOpen,
      setMobileNavOpen,
    }}>
      {children}
    </SidebarStateContext.Provider>
  );
}

export function useSidebarState() {
  const context = useContext(SidebarStateContext);
  if (!context) {
    throw new Error("useSidebarState must be used within a SidebarStateProvider");
  }
  return context;
}
