import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Upload, Check, X, Loader2 } from "lucide-react";

type Props = {
  templateId: number;
  templateName: string;
  tier?: string | null;
  isSystem?: boolean | null;
};

export function BpmTemplatePipeline({ templateId, templateName, tier, isSystem }: Props) {
  const { toast } = useToast();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [feedback, setFeedback] = useState("");

  const { data: submissions = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/bpm/template-submissions`],
  });

  const submitMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/bpm/templates/${templateId}/submit`, "/api/frameworks"),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/bpm/templates") });
      toast({ title: "Submitted to Jiganto", description: "Your template is pending review." });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status, feedback }: { id: number; status: string; feedback: string }) =>
      apiRequest("PATCH", `/api/bpm/template-submissions/${id}/review`, { status, feedback }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/bpm/template-submissions`] });
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/bpm/templates") });
      setReviewOpen(false);
      toast({ title: "Review submitted" });
    },
  });

  const tierLabel = isSystem ? "System" : tier === "submitted" ? "Submitted" : "Customer";

  if (isLoading) return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" data-testid="template-pipeline-loading" />;

  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="template-pipeline">
      <Badge variant="outline" className="text-xs" data-testid="badge-template-tier">{tierLabel}</Badge>
      {!isSystem && tier !== "submitted" && (
        <Button size="sm" variant="outline" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending} data-testid="button-submit-to-jiganto">
          {submitMutation.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
          Submit to Jiganto
        </Button>
      )}
      {submissions.filter(s => s.status === "pending").length > 0 && (
        <Button size="sm" variant="ghost" className="text-xs" onClick={() => {
          setSelectedSub(submissions.find(s => s.status === "pending"));
          setReviewOpen(true);
        }} data-testid="button-review-submissions">
          Review pending ({submissions.filter(s => s.status === "pending").length})
        </Button>
      )}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent data-testid="dialog-review-submission">
          <DialogHeader><DialogTitle>Review Template Submission</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{templateName}</p>
          <Textarea placeholder="Feedback for contributor..." value={feedback} onChange={e => setFeedback(e.target.value)} rows={3} />
          <DialogFooter className="gap-2">
            <Button variant="outline" className="text-destructive" onClick={() => selectedSub && reviewMutation.mutate({ id: selectedSub.id, status: "rejected", feedback })} data-testid="button-reject-template">
              <X className="h-4 w-4 mr-1" /> Reject
            </Button>
            <Button onClick={() => selectedSub && reviewMutation.mutate({ id: selectedSub.id, status: "approved", feedback })} data-testid="button-approve-template">
              <Check className="h-4 w-4 mr-1" /> Approve → System
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
