import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSurveyColors } from "@/lib/survey-constants";
import { SurveyCardSkeleton, SurveyButtonSpinner } from "@/components/surveys/SurveyLoadingState";
import { fetchSurveyTemplates } from "@/lib/survey-api";
import type { SurveyTemplate } from "@shared/models/surveys";

const TIER_LABEL: Record<string, string> = {
  system: "System",
  customer: "Your organisation",
  submitted: "Submitted for review",
};

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/surveys/templates"] }); toast({ title: "Submitted for review ✓" }); },
  });

  const system = templates.filter(t => t.tier === "system");
  const customer = templates.filter(t => t.tier === "customer");
  const submitted = templates.filter(t => t.tier === "submitted" || t.submissionStatus === "pending");

  const renderGroup = (title: string, items: SurveyTemplate[]) => (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: C.ink4, marginBottom: 12 }}>{title}</h3>
      <div className="survey-card-grid">
        {items.map(t => {
          const qs = (t.questionsJson as { text: string }[]) ?? [];
          const isUsing = usingTemplateId === t.id;
          const settings = (t.settingsJson ?? {}) as { locked?: boolean };
          const isLocked = Boolean(settings.locked);
          return (
            <div key={t.id} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: C.teal, background: C.tealL, padding: "2px 8px", borderRadius: 20 }}>
                  {TIER_LABEL[t.tier] || t.tier}{isLocked ? " · 🔒 Locked" : ""}
                </span>
                <span style={{ fontSize: 11, color: C.ink4 }}>{qs.length} questions</span>
              </div>
              {isLocked && (
                <div style={{ fontSize: 11, color: C.amber, marginBottom: 8, background: C.amberL, padding: "6px 10px", borderRadius: 6 }}>
                  System template — read-only. Use or duplicate to create your own version.
                </div>
              )}
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{t.title}</div>
              <div style={{ fontSize: 12, color: C.ink3, lineHeight: 1.5, marginBottom: 12, minHeight: 36 }}>{t.description}</div>
              {t.contributedByOrg && <div style={{ fontSize: 11, color: C.ink4, marginBottom: 8 }}>Contributed by {t.contributedByOrg}</div>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => onUseTemplate(t)} disabled={isUsing || !!usingTemplateId}
                  style={{ flex: 1, minWidth: 120, padding: "8px", background: C.teal, color: "#fff", border: "none", borderRadius: 8, cursor: isUsing ? "wait" : "pointer", fontSize: 13, fontWeight: 500, opacity: isUsing || usingTemplateId ? 0.7 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {isUsing && <SurveyButtonSpinner />} {isUsing ? "Creating…" : "Use template"}
                </button>
                {t.tier === "customer" && !t.submissionStatus && (
                  <button onClick={() => submitMut.mutate(t.id)} disabled={submitMut.isPending}
                    style={{ padding: "8px 12px", border: `1px solid ${C.line}`, borderRadius: 8, background: C.surface, cursor: "pointer", fontSize: 12 }}>
                    {submitMut.isPending ? "…" : "Submit"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (isLoading) return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Template Library</h2>
      <SurveyCardSkeleton count={6} />
    </div>
  );

  if (isError) return (
    <div style={{ textAlign: "center", padding: 40 }}>
      <p style={{ color: C.rose, marginBottom: 12 }}>Failed to load templates.</p>
      <button onClick={() => refetch()} style={{ padding: "8px 16px", border: `1px solid ${C.line}`, borderRadius: 8, background: C.surface, cursor: "pointer" }}>Retry</button>
    </div>
  );

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Template Library</h2>
      <p style={{ fontSize: 13, color: C.ink3, marginBottom: 24 }}>System templates (read-only) · Customer templates · Submit for promotion to system tier</p>
      {system.length > 0 && renderGroup("Tier 1 — System Templates", system)}
      {customer.length > 0 && renderGroup("Tier 3 — Your Organisation", customer)}
      {submitted.length > 0 && renderGroup("Tier 2 — Submitted for Review", submitted)}
      {templates.length === 0 && (
        <div style={{ textAlign: "center", padding: 48, color: C.ink4 }}>No templates available yet</div>
      )}
    </div>
  );
}
