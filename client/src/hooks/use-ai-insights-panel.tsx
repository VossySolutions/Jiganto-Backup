import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { DASHBOARD_PATH } from "@shared/app-routes";

export type AiInsightsModule =
  | "business"
  | "customer-mgmt"
  | "chat"
  | "dashboard"
  | "documents"
  | "surveys"
  | "crm"
  | "general";

export function resolveAiInsightsModule(path: string): AiInsightsModule {
  if (path.includes("/modules/business-mgmt")) return "business";
  if (path.includes("/modules/customer-mgmt")) return "customer-mgmt";
  if (path.includes("/modules/chat")) return "chat";
  if (path.includes("/modules/documents") || path.startsWith("/documents")) return "documents";
  if (path.includes("/modules/surveys")) return "surveys";
  if (path.includes("/modules/crm")) return "crm";
  if (path === DASHBOARD_PATH || path.startsWith("/ws/")) return "dashboard";
  return "general";
}

type AIInsightsPanelContextValue = {
  isOpen: boolean;
  module: AiInsightsModule;
  open: () => void;
  close: () => void;
};

const AIInsightsPanelContext = createContext<AIInsightsPanelContextValue | null>(null);

export function AIInsightsPanelProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const module = useMemo(() => resolveAiInsightsModule(location), [location]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const value = useMemo(
    () => ({ isOpen, module, open, close }),
    [isOpen, module, open, close],
  );

  return (
    <AIInsightsPanelContext.Provider value={value}>
      {children}
    </AIInsightsPanelContext.Provider>
  );
}

export function useAIInsightsPanel(): AIInsightsPanelContextValue {
  const ctx = useContext(AIInsightsPanelContext);
  if (!ctx) {
    throw new Error("useAIInsightsPanel must be used within AIInsightsPanelProvider");
  }
  return ctx;
}

/** Safe optional access (e.g. ModuleHeader outside provider during tests). */
export function useAIInsightsPanelOptional(): AIInsightsPanelContextValue | null {
  return useContext(AIInsightsPanelContext);
}
