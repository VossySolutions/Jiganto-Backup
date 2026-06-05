import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface SidebarStateContextType {
  isCollapsed: boolean;
  toggleCollapse: () => void;
  setCollapsed: (collapsed: boolean) => void;
  hiddenModules: string[];
  toggleModuleVisibility: (moduleHref: string) => void;
  isModuleHidden: (moduleHref: string) => boolean;
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

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isCollapsed));
  }, [isCollapsed]);

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

  const toggleCollapse = () => setIsCollapsed(prev => !prev);
  
  const toggleModuleVisibility = (moduleHref: string) => {
    setHiddenModules(prev => 
      prev.includes(moduleHref) 
        ? prev.filter(h => h !== moduleHref)
        : [...prev, moduleHref]
    );
  };

  const isModuleHidden = (moduleHref: string) => hiddenModules.includes(moduleHref);

  return (
    <SidebarStateContext.Provider value={{
      isCollapsed,
      toggleCollapse,
      setCollapsed: setIsCollapsed,
      hiddenModules,
      toggleModuleVisibility,
      isModuleHidden,
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
