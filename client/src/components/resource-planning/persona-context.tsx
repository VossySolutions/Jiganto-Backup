import { createContext, useContext, type ReactNode } from "react";

export type RpPersonaId = "res-mgr" | "exec" | "sales" | "hr";

export type RpFeature =
  | "dashboard"
  | "demand-supply"
  | "heatmap"
  | "scheduler"
  | "skills"
  | "pipeline"
  | "recruitment"
  | "bench"
  | "scenarios"
  | "ai";

/** Mirrors server/resource-planning/persona-access.ts READ_ACCESS */
export const RP_READ_ACCESS: Record<RpPersonaId, RpFeature[]> = {
  "res-mgr": ["dashboard", "demand-supply", "heatmap", "scheduler", "skills", "pipeline", "recruitment", "bench", "scenarios", "ai"],
  exec: ["dashboard", "demand-supply", "scenarios", "ai"],
  sales: ["demand-supply", "pipeline", "scenarios", "ai"],
  hr: ["skills", "recruitment", "bench", "ai"],
};

export function canRpRead(persona: RpPersonaId, feature: RpFeature): boolean {
  return RP_READ_ACCESS[persona]?.includes(feature) ?? false;
}

const RpPersonaContext = createContext<RpPersonaId>("res-mgr");

export function RpPersonaProvider({ persona, children }: { persona: RpPersonaId; children: ReactNode }) {
  return <RpPersonaContext.Provider value={persona}>{children}</RpPersonaContext.Provider>;
}

export function useRpPersona(): RpPersonaId {
  return useContext(RpPersonaContext);
}

/** Append persona to API path for server RBAC */
export function withRpPersona(url: string, persona: RpPersonaId): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}persona=${persona}`;
}
