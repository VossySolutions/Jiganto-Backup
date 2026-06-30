import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LayoutTemplate, Lock, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSurveyColors } from "@/lib/survey-constants";
import { SurveyCardSkeleton, SurveyButtonSpinner } from "@/components/surveys/SurveyLoadingState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { fetchSurveyTemplates } from "@/lib/survey-api";
import type { SurveyTemplate } from "@shared/models/surveys";

const TIER_LABEL: Record<string, string> = {
  system: "System",
  customer: "Your organisation",
  submitted: "Submitted for review",
};

function TemplateCard({
  template,
  isUsing,
  disabled,
  onUse,
  onSubmit,
  submitPending,
}: {
  template: SurveyTemplate;
  isUsing: boolean;
  disabled: boolean;
  onUse: () => void;
  onSubmit?: () => void;
  submitPending?: boolean;
}) {
  const C = useSurveyColors();
  const qs = (template.questionsJson as { text: string }[]) ?? [];
  const settings = (template.settingsJson ?? {}) as { locked?: boolean };
  const isLocked = Boolean(settings.locked);

  return (
    <Card className="survey-template-card h-full">
      <CardHeader className="p-5 pb-0 space-y-0">
        <div className="survey-template-card-header">
          <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wide shrink-0">
            {isLocked && <Lock className="h-3 w-3 mr-1 inline" />}
            {TIER_LABEL[template.tier] || template.tier}
          </Badge>
          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
            {qs.length} question{qs.length !== 1 ? "s" : ""}
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-3 flex-1 flex flex-col">
        {isLocked && (
          <div
            className="survey-template-locked-banner"
            style={{ background: C.amberL, color: C.amber }}
          >
            System template — read-only. Use it to create your own editable copy.
          </div>
        )}

        <div className="survey-template-card-body">
          <h3 className="survey-template-card-title">{template.title}</h3>
          {template.description ? (
            <p className="survey-template-card-desc">{template.description}</p>
          ) : (
            <p className="survey-template-card-desc italic opacity-70">No description</p>
          )}
          {template.contributedByOrg && (
            <p className="survey-template-card-meta">Contributed by {template.contributedByOrg}</p>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-5 pt-0 gap-2 flex-wrap">
        <Button
          type="button"
          className="flex-1 min-w-[140px]"
          onClick={onUse}
          disabled={disabled || isUsing}
        >
          {isUsing && <SurveyButtonSpinner />}
          {isUsing ? "Creating…" : "Use template"}
        </Button>
        {onSubmit && (
          <Button type="button" variant="outline" onClick={onSubmit} disabled={submitPending}>
            {submitPending ? "…" : "Submit"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

function TemplatesTabHeader() {
  return (
    <header className="survey-tab-header">
      <div className="min-w-0 flex-1">
        <h2>Template Library</h2>
        <p>
          Start from proven survey designs — system templates, your organisation&apos;s library, and submissions awaiting review.
        </p>
      </div>
      <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-lg bg-muted shrink-0">
        <LayoutTemplate className="h-5 w-5 text-muted-foreground" />
      </div>
    </header>
  );
}

export function TemplatesTab({
  onUseTemplate,
  usingTemplateId,
}: {
  onUseTemplate: (tpl: SurveyTemplate) => void;
  usingTemplateId?: number;
}) {
  const C = useSurveyColors();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: templates = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["/api/surveys/templates"],
    queryFn: fetchSurveyTemplates,
    staleTime: 30_000,
  });

  const submitMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/survey-templates/${id}/submit`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/surveys/templates"] });
      toast({ title: "Submitted for review ✓" });
    },
  });

  const system = templates.filter(t => t.tier === "system");
  const customer = templates.filter(t => t.tier === "customer");
  const submitted = templates.filter(t => t.tier === "submitted" || t.submissionStatus === "pending");

  const renderGroup = (title: string, items: SurveyTemplate[]) => {
    if (items.length === 0) return null;
    return (
      <section className="survey-templates-section" aria-label={title}>
        <h3 className="survey-templates-section-title">{title}</h3>
        <div className="survey-templates-grid">
          {items.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              isUsing={usingTemplateId === t.id}
              disabled={!!usingTemplateId}
              onUse={() => onUseTemplate(t)}
              onSubmit={t.tier === "customer" && !t.submissionStatus ? () => submitMut.mutate(t.id) : undefined}
              submitPending={submitMut.isPending && submitMut.variables === t.id}
            />
          ))}
        </div>
      </section>
    );
  };

  if (isLoading) {
    return (
      <div className="survey-templates-page">
        <TemplatesTabHeader />
        <SurveyCardSkeleton count={6} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="survey-templates-page">
        <TemplatesTabHeader />
        <div className="survey-error-state">
          <p className="text-sm font-medium mb-4" style={{ color: C.rose }}>Failed to load templates.</p>
          <Button type="button" variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="survey-templates-page">
      <TemplatesTabHeader />

      {templates.length === 0 ? (
        <div className="survey-empty-state">
          <LayoutTemplate className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium text-foreground mb-1">No templates available yet</p>
          <p className="text-xs text-muted-foreground">Templates will appear here once added to your workspace.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {renderGroup("Tier 1 — System templates", system)}
          {renderGroup("Tier 2 — Submitted for review", submitted)}
          {renderGroup("Tier 3 — Your organisation", customer)}
        </div>
      )}
    </div>
  );
}
