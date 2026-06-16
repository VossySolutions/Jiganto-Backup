import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { fetchTemplates, reviewTemplate } from "@/lib/template-api";
import { moduleLabel, moduleColor } from "@/lib/template-constants";
import { Check, X, Loader2, ClipboardCheck } from "lucide-react";
import type { PlatformTemplateWithMeta } from "@shared/models/templates";

export function SubmittedTemplatesReview() {
  const { isJigantoStaff, platformRole } = usePermissions();
  const canReview = isJigantoStaff || platformRole === "si_super_admin";
  const { toast } = useToast();
  const qc = useQueryClient();
  const [note, setNote] = useState<Record<number, string>>({});

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ["/api/templates", "submitted-review"],
    queryFn: () => fetchTemplates("tier=submitted&sort=newest"),
    enabled: canReview,
  });

  const reviewMut = useMutation({
    mutationFn: ({ id, status, reviewNote }: { id: number; status: "approved" | "declined"; reviewNote?: string }) =>
      reviewTemplate(id, status, reviewNote),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith("/api/templates") });
      toast({ title: vars.status === "approved" ? "Template approved" : "Template declined" });
    },
    onError: (e: Error) => toast({ title: "Review failed", description: e.message, variant: "destructive" }),
  });

  if (!canReview) return null;

  const awaiting = pending.filter(
    (t: PlatformTemplateWithMeta) => t.submissionStatus === "submitted" || t.tier === "submitted",
  );

  if (isLoading) {
    return (
      <div className="mx-4 sm:mx-6 mt-4 flex items-center gap-2 text-sm text-muted-foreground" data-testid="submitted-review-loading">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading submission queue…
      </div>
    );
  }

  if (!awaiting.length) return null;

  return (
    <section className="mx-4 sm:mx-6 mt-4 mb-2" data-testid="submitted-templates-review">
      <Card className="border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800/50">
        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardCheck className="h-4 w-4 text-amber-700 dark:text-amber-400" />
            <h2 className="text-sm font-semibold">Pending review</h2>
            <Badge variant="secondary" className="text-[10px]">{awaiting.length}</Badge>
          </div>
          <div className="space-y-3">
            {awaiting.map((t: PlatformTemplateWithMeta) => (
              <div key={t.id} className="rounded-lg border bg-card p-3 sm:p-4 space-y-3" data-testid={`review-item-${t.id}`}>
                <div className="flex flex-wrap items-start gap-2 justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {moduleLabel(t.module)} · by {t.creatorName ?? t.createdByName ?? "Customer"}
                    </p>
                  </div>
                  <Badge variant="outline" style={{ borderColor: moduleColor(t.module), color: moduleColor(t.module) }}>
                    {moduleLabel(t.module)}
                  </Badge>
                </div>
                {t.submissionNote && (
                  <p className="text-xs text-muted-foreground italic">&ldquo;{t.submissionNote}&rdquo;</p>
                )}
                <Textarea
                  placeholder="Reviewer note (optional)…"
                  rows={2}
                  className="text-sm"
                  value={note[t.id] ?? ""}
                  onChange={e => setNote(prev => ({ ...prev, [t.id]: e.target.value }))}
                  data-testid={`review-note-${t.id}`}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => reviewMut.mutate({ id: t.id, status: "approved", reviewNote: note[t.id] })}
                    disabled={reviewMut.isPending}
                    data-testid={`approve-template-${t.id}`}
                  >
                    {reviewMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1" /> Approve</>}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reviewMut.mutate({ id: t.id, status: "declined", reviewNote: note[t.id] })}
                    disabled={reviewMut.isPending}
                    data-testid={`decline-template-${t.id}`}
                  >
                    <X className="h-3.5 w-3.5 mr-1" /> Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </section>
  );
}
