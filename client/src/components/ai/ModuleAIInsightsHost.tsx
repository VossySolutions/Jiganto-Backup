import { Brain, LayoutDashboard, MessageSquare, Users } from "lucide-react";
import { useAIInsightsPanel, type AiInsightsModule } from "@/hooks/use-ai-insights-panel";
import { ModuleAiInsightsPanel } from "@/components/ai/ModuleAiInsightsPanel";
import { GenericAIInsightsPanel } from "@/components/ai/GenericAIInsightsPanel";

const MODULE_CONFIG: Partial<
  Record<
    AiInsightsModule,
    {
      title: string;
      subtitle: string;
      description: string;
      endpoint: string;
      queryKey: string;
      icon: typeof Brain;
    }
  >
> = {
  business: {
    title: "AI Strategy Insights",
    subtitle: "Anomaly detection & recommendations",
    description:
      "Analyse your entire strategy portfolio for risks, anomalies, and improvement recommendations.",
    endpoint: "/api/business/ai-insights",
    queryKey: "/api/business/ai-insights",
    icon: Brain,
  },
  "customer-mgmt": {
    title: "Customer AI Insights",
    subtitle: "Portfolio health & trial intelligence",
    description:
      "Analyse customer health, trials, renewals, and billing for actionable CSM recommendations.",
    endpoint: "/api/customer-mgmt/ai-insights",
    queryKey: "/api/customer-mgmt/ai-insights",
    icon: Users,
  },
  chat: {
    title: "Chat AI Insights",
    subtitle: "Inbox & collaboration intelligence",
    description:
      "Analyse unread backlog, channel activity, and collaboration patterns across your workspace.",
    endpoint: "/api/chat/ai-insights",
    queryKey: "/api/chat/ai-insights",
    icon: MessageSquare,
  },
  dashboard: {
    title: "Dashboard AI Insights",
    subtitle: "Executive portfolio analysis",
    description:
      "Analyse projects, tasks, CRM pipeline, and KPIs for cross-module executive recommendations.",
    endpoint: "/api/dashboard/ai-insights",
    queryKey: "/api/dashboard/ai-insights",
    icon: LayoutDashboard,
  },
};

/** Renders the correct AI Insights sheet for the current module route. */
export function ModuleAIInsightsHost() {
  const { isOpen, module, close } = useAIInsightsPanel();
  const config = MODULE_CONFIG[module];

  if (config) {
    return (
      <ModuleAiInsightsPanel
        open={isOpen}
        onClose={close}
        title={config.title}
        subtitle={config.subtitle}
        description={config.description}
        endpoint={config.endpoint}
        queryKey={config.queryKey}
        icon={config.icon}
      />
    );
  }

  return <GenericAIInsightsPanel module={module} open={isOpen} onClose={close} />;
}
