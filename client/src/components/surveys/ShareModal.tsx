import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X, Copy, Send } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSurveyColors, surveyLink, qrCodeUrl, embedCode } from "@/lib/survey-constants";
import { SurveyButtonSpinner } from "@/components/surveys/SurveyLoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { SurveyWithDetails } from "@shared/models/surveys";

type Tab = "link" | "workspace" | "users" | "embed" | "qr";

export function ShareModal({ survey, onClose }: { survey: SurveyWithDetails; onClose: () => void }) {
  const C = useSurveyColors();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("link");
  const [emails, setEmails] = useState("");
  const [reminderDays, setReminderDays] = useState(3);
  const [allowExternal, setAllowExternal] = useState(survey.allowExternal ?? true);
  const link = surveyLink(survey.token!);

  const distributeMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest("POST", `/api/surveys/${survey.id}/distribute`, body),
    onSuccess: async (res) => {
      const data = await res.json();
      toast({ title: `Distributed ✓ · ${data.invited ?? 0} invited` });
    },
    onError: () => toast({ title: "Distribution failed", variant: "destructive" }),
  });

  const settingsMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequest("PATCH", `/api/surveys/${survey.id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surveys"] });
      queryClient.invalidateQueries({ queryKey: [`/api/surveys/${survey.id}`] });
    },
    onError: () => toast({ title: "Could not update settings", variant: "destructive" }),
  });

  function toggleAllowExternal(checked: boolean) {
    setAllowExternal(checked);
    settingsMut.mutate({ allowExternal: checked });
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "link", label: "Link" }, { id: "workspace", label: "Workspace" },
    { id: "users", label: "Users" }, { id: "embed", label: "Embed" }, { id: "qr", label: "QR" },
  ];

  const workspaceId = survey.workspaceId ?? undefined;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-5 bg-black/60 backdrop-blur-sm">
      <div className="bg-card text-card-foreground rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col border border-border">
        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
          <div className="font-semibold text-base">Share Survey</div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="survey-share-tabs">
          {tabs.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={cn("survey-share-tab", tab === t.id ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-6 overflow-y-auto flex-1 w-full">
          {tab === "link" && (
            <>
              <div className="flex gap-2 mb-3 w-full">
                <Input readOnly value={link} className="flex-1 text-sm" />
                <Button type="button" onClick={() => { navigator.clipboard.writeText(link); toast({ title: "Copied ✓" }); }}>
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copy
                </Button>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowExternal}
                  disabled={settingsMut.isPending}
                  onChange={e => toggleAllowExternal(e.target.checked)}
                  className="rounded"
                />
                Anyone with link can respond
              </label>
              {!allowExternal && (
                <p className="text-xs mt-2.5 leading-relaxed" style={{ color: C.amber }}>
                  Link-only access is off. Only people you invite via Workspace or Users can respond.
                </p>
              )}
            </>
          )}
          {tab === "workspace" && (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                Send to all members of {workspaceId ? "this survey's workspace" : "the current workspace context"} via notification.
              </p>
              {!workspaceId && (
                <p className="text-xs mb-3" style={{ color: C.amber }}>
                  This survey has no workspace assigned. Open it from a workspace context or assign a workspace first.
                </p>
              )}
              <div className="mb-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Reminder before close</Label>
                <select value={reminderDays} onChange={e => setReminderDays(Number(e.target.value))} className="survey-input mt-1.5">
                  <option value={0}>No reminder</option><option value={1}>1 day before</option><option value={3}>3 days before</option><option value={7}>1 week before</option>
                </select>
              </div>
              <Button type="button" className="w-full" onClick={() => distributeMut.mutate({ type: "workspace", workspaceId, reminderDays: reminderDays || undefined })}
                disabled={distributeMut.isPending || !workspaceId}>
                {distributeMut.isPending ? <SurveyButtonSpinner /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                Send to workspace members
              </Button>
            </>
          )}
          {tab === "users" && (
            <>
              <p className="text-sm text-muted-foreground mb-2">Enter email addresses (one per line). Non-users receive a unique link.</p>
              <Textarea value={emails} onChange={e => setEmails(e.target.value)} rows={4}
                className="mb-3"
                placeholder={"user@company.com\ncolleague@client.com"} />
              <Button type="button" className="w-full" onClick={() => distributeMut.mutate({ type: "specific_users", targetEmails: emails.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean), reminderDays: reminderDays || undefined })}
                disabled={distributeMut.isPending || !emails.trim()}>
                {distributeMut.isPending && <SurveyButtonSpinner />}
                Send invitations
              </Button>
            </>
          )}
          {tab === "embed" && (
            <>
              <p className="text-sm text-muted-foreground mb-3">Paste this iframe code on your intranet or portal:</p>
              <Textarea readOnly value={embedCode(link)} rows={4} className="font-mono text-xs mb-3" />
              <Button type="button" variant="outline" onClick={() => { navigator.clipboard.writeText(embedCode(link)); toast({ title: "Embed code copied ✓" }); }}>
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copy embed code
              </Button>
            </>
          )}
          {tab === "qr" && (
            <div className="text-center">
              <img src={qrCodeUrl(link)} alt="QR Code" width={200} height={200} className="rounded-lg border border-border mx-auto" />
              <p className="text-xs text-muted-foreground mt-3">Scan or print for physical distribution</p>
            </div>
          )}
          {survey.status !== "active" && (
            <div className="mt-4 px-3.5 py-2.5 rounded-lg text-sm" style={{ background: C.amberL, color: C.amber }}>
              ⚠ Survey is <strong>{survey.status}</strong>. Activate before sharing.
            </div>
          )}
        </div>
        <div className="px-6 py-3.5 border-t border-border flex justify-end">
          <Button type="button" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}
