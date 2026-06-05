import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { TmProject } from "@shared/schema";

type TmProjectContextType = {
  projects: TmProject[];
  activeProjectId: number | null;
  activeProject: TmProject | undefined;
  setActiveProjectId: (id: number | null) => void;
  isLoading: boolean;
  qs: string; // query string to append to API calls: "" | "?projectId=X"
  qsParam: (base: string) => string; // utility: appends projectId param to a URL
};

const TmProjectContext = createContext<TmProjectContextType>({
  projects: [],
  activeProjectId: null,
  activeProject: undefined,
  setActiveProjectId: () => {},
  isLoading: false,
  qs: "",
  qsParam: (base) => base,
});

export function TmProjectProvider({ children }: { children: ReactNode }) {
  const [activeProjectId, setActiveProjectIdState] = useState<number | null>(null);

  const { data: projects = [], isLoading } = useQuery<TmProject[]>({
    queryKey: ["/api/tm/projects"],
  });

  // Auto-select first project once loaded
  useEffect(() => {
    if (projects.length > 0 && activeProjectId === null) {
      setActiveProjectIdState(projects[0].id);
    }
  }, [projects, activeProjectId]);

  const activeProject = projects.find(p => p.id === activeProjectId);

  const qs = activeProjectId ? `?projectId=${activeProjectId}` : "";
  const qsParam = (base: string) =>
    activeProjectId
      ? base.includes("?")
        ? `${base}&projectId=${activeProjectId}`
        : `${base}?projectId=${activeProjectId}`
      : base;

  return (
    <TmProjectContext.Provider value={{
      projects,
      activeProjectId,
      activeProject,
      setActiveProjectId: setActiveProjectIdState,
      isLoading,
      qs,
      qsParam,
    }}>
      {children}
    </TmProjectContext.Provider>
  );
}

export function useTmProject() {
  return useContext(TmProjectContext);
}
