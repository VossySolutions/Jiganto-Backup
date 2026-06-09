import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Loader2,
  RefreshCw,
  TriangleAlert,
  AlertTriangle,
  Lightbulb,
  CheckCircle,
  Info,
  type LucideIcon,
} from "lucide-react";

export type AiInsight = {
  type: "anomaly" | "risk" | "recommendation" | "positive";
  severity: "high" | "medium" | "low" | "info";
  title: string;
  description: string;
};

type AiInsightsResponse = {
  insights: AiInsight[];
  generatedAt: string;
  source: string;
};

function insightIcon(type: string) {
  if (type === "anomaly") return <TriangleAlert className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />;
  if (type === "risk") return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />;
  if (type === "recommendation") return <Lightbulb className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />;
  if (type === "positive") return <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />;
  return <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />;
}

function insightBg(type: string) {
  if (type === "anomaly") return "border-red-200 bg-red-50 dark:border-red-800/30 dark:bg-red-900/10";
  if (type === "risk") return "border-amber-200 bg-amber-50 dark:border-amber-800/30 dark:bg-amber-900/10";
  if (type === "recommendation") return "border-blue-200 bg-blue-50 dark:border-blue-800/30 dark:bg-blue-900/10";
  if (type === "positive") return "border-green-200 bg-green-50 dark:border-green-800/30 dark:bg-green-900/10";
  return "border-border bg-muted/30";
}

function severityBadge(severity: string) {
  const cls =
    severity === "high"
      ? "bg-red-100 text-red-700"
      : severity === "medium"
        ? "bg-amber-100 text-amber-700"
        : severity === "low"
          ? "bg-blue-100 text-blue-700"
          : "bg-muted text-muted-foreground";
  return (
    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide", cls)}>
      {severity}
    </span>
  );
}

export function ModuleAiInsightsPanel({
  open,
  onClose,
  title,
  subtitle,
  description,
  endpoint,
  queryKey,
  icon: Icon = Sparkles,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  description: string;
  endpoint: string;
  queryKey: string;
  icon?: LucideIcon;
}) {
  const [generated, setGenerated] = useState(false);
  const { toast } = useToast();

  const { data, isFetching, isError, error, refetch } = useQuery<AiInsightsResponse>({
    queryKey: [queryKey],
    queryFn: () => apiRequest("POST", endpoint, {}).then((r) => r.json()),
    enabled: false,
    retry: false,
  });

  const handleGenerate = () => {
    setGenerated(true);
    refetch().catch(() => {
      toast({
        title: "AI generation failed",
        description: "Could not load insights. Check OPENAI_API_KEY in .env and try again.",
        variant: "destructive",
      });
    });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[420px] sm:max-w-[420px] p-0 flex flex-col" data-testid="ai-insights-panel">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Icon className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <SheetTitle className="text-base">{title}</SheetTitle>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {!generated ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-violet-500/10 flex items-center justify-center">
                <Icon className="h-8 w-8 text-violet-500" />
              </div>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
              </div>
              <Button onClick={handleGenerate} className="gap-2" data-testid="button-generate-ai-insights">
                <Sparkles className="h-4 w-4" /> Generate Insights
              </Button>
            </div>
          ) : isFetching ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              <p className="text-sm text-muted-foreground">Analysing your data…</p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <TriangleAlert className="h-10 w-10 text-destructive" />
              <div>
                <p className="font-semibold">Could not generate insights</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {(error as Error)?.message || "The server returned an error. Try again."}
                </p>
              </div>
              <Button variant="outline" onClick={handleGenerate} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Try again
              </Button>
            </div>
          ) : data ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {data.insights.length} insight{data.insights.length !== 1 ? "s" : ""}
                  </Badge>
                  {data.source === "ai" && (
                    <Badge variant="outline" className="text-xs text-violet-600">
                      <Sparkles className="h-2.5 w-2.5 mr-1" />
                      AI
                    </Badge>
                  )}
                  {data.source === "rules" && (
                    <Badge variant="outline" className="text-xs">
                      Rule-based
                    </Badge>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleGenerate}>
                  <RefreshCw className="h-3 w-3" /> Refresh
                </Button>
              </div>

              <div className="space-y-3">
                {data.insights.map((insight, i) => (
                  <div key={i} className={cn("rounded-xl border p-3 space-y-1.5", insightBg(insight.type))}>
                    <div className="flex items-start gap-2">
                      {insightIcon(insight.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{insight.title}</p>
                          {severityBadge(insight.severity)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{insight.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {data.generatedAt && (
                <p className="text-[10px] text-muted-foreground text-center">
                  Generated {new Date(data.generatedAt).toLocaleString()}
                </p>
              )}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
