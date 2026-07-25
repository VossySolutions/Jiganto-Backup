import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Sparkles, MessageSquare, LayoutDashboard, FileText, Users, BarChart3 } from "lucide-react";
import type { AiInsightsModule } from "@/hooks/use-ai-insights-panel";
import { useAiStatus } from "@/hooks/use-ai-status";

const MODULE_COPY: Record<
  AiInsightsModule,
  { title: string; subtitle: string; tips: { icon: typeof Sparkles; title: string; desc: string }[] }
> = {
  business: { title: "AI Strategy Insights", subtitle: "", tips: [] },
  "customer-mgmt": {
    title: "Customer AI Insights",
    subtitle: "Portfolio health and trial intelligence",
    tips: [
      {
        icon: Users,
        title: "Health scoring",
        desc: "Review customers in Watch or At Risk bands on the Health tab and schedule CSM check-ins.",
      },
      {
        icon: BarChart3,
        title: "Trial conversion",
        desc: "Trials expiring this week need proactive outreach — use the Trials view to prioritise.",
      },
      {
        icon: Sparkles,
        title: "Survey AI",
        desc: "Create surveys with AI-generated questions from the Surveys module.",
      },
    ],
  },
  chat: {
    title: "Chat AI",
    subtitle: "Messaging intelligence",
    tips: [
      {
        icon: MessageSquare,
        title: "@jiganto",
        desc: "Mention @jiganto in any channel to get an AI reply in the thread.",
      },
      {
        icon: Sparkles,
        title: "Summarise unread",
        desc: "When a channel has many unread messages, use Summarise unread in the thread header.",
      },
    ],
  },
  dashboard: {
    title: "Dashboard AI",
    subtitle: "Build dashboards faster",
    tips: [
      {
        icon: LayoutDashboard,
        title: "AI dashboard builder",
        desc: "Create a bespoke dashboard → AI builder → describe what you want and widgets are added automatically.",
      },
    ],
  },
  documents: {
    title: "Documents",
    subtitle: "Writing assistance",
    tips: [
      {
        icon: FileText,
        title: "Global AI assistant",
        desc: "Use the sparkle button (bottom-right) for drafting, summarising, and writing help across modules.",
      },
    ],
  },
  surveys: {
    title: "Survey AI",
    subtitle: "Question generation",
    tips: [
      {
        icon: Sparkles,
        title: "AI-generated surveys",
        desc: "When creating a survey, choose AI mode and describe your topic — questions are generated automatically.",
      },
    ],
  },
  crm: {
    title: "CRM AI",
    subtitle: "Sales intelligence",
    tips: [
      {
        icon: BarChart3,
        title: "Pipeline review",
        desc: "Use CRM dashboards to spot stalled deals. AI-assisted email templates can be configured under Settings.",
      },
    ],
  },
  tasks: {
    title: "Tasks AI",
    subtitle: "Work management",
    tips: [
      {
        icon: Sparkles,
        title: "Task prioritisation",
        desc: "Review overdue and high-priority tasks across workspaces from the unified Tasks view.",
      },
    ],
  },
  general: {
    title: "Jiganto AI Insights",
    subtitle: "Module-specific intelligence",
    tips: [
      {
        icon: Sparkles,
        title: "Business Management",
        desc: "Open Business Management and click AI Insights for full strategy portfolio analysis.",
      },
      {
        icon: MessageSquare,
        title: "Chat",
        desc: "Use @jiganto in channels for AI assistance.",
      },
      {
        icon: LayoutDashboard,
        title: "Dashboard",
        desc: "Use the AI dashboard builder when creating bespoke dashboards.",
      },
    ],
  },
};

export function GenericAIInsightsPanel({
  module,
  open,
  onClose,
}: {
  module: AiInsightsModule;
  open: boolean;
  onClose: () => void;
}) {
  const { data: aiStatus } = useAiStatus();
  const copy = MODULE_COPY[module];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[420px] sm:max-w-[420px] p-0 flex flex-col" data-testid="ai-insights-panel">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Sparkles className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <SheetTitle className="text-base">{copy.title}</SheetTitle>
              <p className="text-xs text-muted-foreground">{copy.subtitle}</p>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {!aiStatus?.configured && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
              Set <code className="text-xs bg-muted px-1 rounded">OPENAI_API_KEY</code> in server{" "}
              <code className="text-xs bg-muted px-1 rounded">.env</code> and restart to enable AI features.
            </div>
          )}

          <div className="space-y-3">
            {copy.tips.map((tip) => (
              <div key={tip.title} className="flex items-start gap-3 p-3 rounded-xl border bg-card">
                <div className="h-8 w-8 rounded-md bg-violet-500/10 flex items-center justify-center shrink-0">
                  <tip.icon className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                </div>
                <div>
                  <p className="text-sm font-medium">{tip.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{tip.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <Button variant="outline" className="w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
