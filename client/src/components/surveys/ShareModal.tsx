import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSurveyColors, surveyLink, qrCodeUrl, embedCode } from "@/lib/survey-constants";
import { SurveyButtonSpinner } from "@/components/surveys/SurveyLoadingState";
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,14,12,.6)", backdropFilter: "blur(4px)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: C.surface, borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,.15)", width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 24px", borderBottom: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>Share Survey</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: C.ink3 }}>✕</button>
        </div>
        <div className="survey-share-tabs">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="survey-share-tab"
              style={{ background: tab === t.id ? C.tealL : C.surface, color: tab === t.id ? C.teal : C.ink4 }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ padding: 24, overflowY: "auto" }}>
          {tab === "link" && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input readOnly value={link} style={{ flex: 1, padding: "9px 12px", border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 13 }} />
                <button onClick={() => { navigator.clipboard.writeText(link); toast({ title: "Copied ✓" }); }}
                  style={{ padding: "9px 14px", background: C.teal, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 500 }}>Copy</button>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.ink3, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={allowExternal}
                  disabled={settingsMut.isPending}
                  onChange={e => toggleAllowExternal(e.target.checked)}
                />
                Anyone with link can respond
              </label>
              {!allowExternal && (
                <p style={{ fontSize: 12, color: C.amber, marginTop: 10, lineHeight: 1.5 }}>
                  Link-only access is off. Only people you invite via Workspace or Users can respond (or signed-in invitees).
                </p>
              )}
            </>
          )}
          {tab === "workspace" && (
            <>
              <p style={{ fontSize: 13, color: C.ink3, marginBottom: 16 }}>
                Send to all members of {workspaceId ? "this survey's workspace" : "the current workspace context"} via notification.
              </p>
              {!workspaceId && (
                <p style={{ fontSize: 12, color: C.amber, marginBottom: 12 }}>
                  This survey has no workspace assigned. Open it from a workspace context or assign a workspace first.
                </p>
              )}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: C.ink4, textTransform: "uppercase" }}>Reminder before close</label>
                <select value={reminderDays} onChange={e => setReminderDays(Number(e.target.value))} style={{ width: "100%", marginTop: 6, padding: "8px", borderRadius: 8, border: `1px solid ${C.line2}` }}>
                  <option value={0}>No reminder</option><option value={1}>1 day before</option><option value={3}>3 days before</option><option value={7}>1 week before</option>
                </select>
              </div>
              <button onClick={() => distributeMut.mutate({ type: "workspace", workspaceId, reminderDays: reminderDays || undefined })}
                disabled={distributeMut.isPending || !workspaceId}
                style={{ width: "100%", padding: "10px", background: C.teal, color: "#fff", border: "none", borderRadius: 8, cursor: workspaceId ? "pointer" : "not-allowed", fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: workspaceId ? 1 : 0.5 }}>
                {distributeMut.isPending && <SurveyButtonSpinner />} Send to workspace members
              </button>
            </>
          )}
          {tab === "users" && (
            <>
              <p style={{ fontSize: 13, color: C.ink3, marginBottom: 8 }}>Enter email addresses (one per line). Non-users receive a unique link.</p>
              <textarea value={emails} onChange={e => setEmails(e.target.value)} rows={4}
                style={{ width: "100%", padding: "10px", border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 13, marginBottom: 12, boxSizing: "border-box" }}
                placeholder="user@company.com&#10;colleague@client.com" />
              <button onClick={() => distributeMut.mutate({ type: "specific_users", targetEmails: emails.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean), reminderDays: reminderDays || undefined })}
                disabled={distributeMut.isPending || !emails.trim()}
                style={{ width: "100%", padding: "10px", background: C.teal, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {distributeMut.isPending && <SurveyButtonSpinner />} Send invitations
              </button>
            </>
          )}
          {tab === "embed" && (
            <>
              <p style={{ fontSize: 13, color: C.ink3, marginBottom: 12 }}>Paste this iframe code on your intranet or portal:</p>
              <textarea readOnly value={embedCode(link)} rows={4}
                style={{ width: "100%", padding: "10px", border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 11, fontFamily: "monospace", boxSizing: "border-box" }} />
              <button onClick={() => { navigator.clipboard.writeText(embedCode(link)); toast({ title: "Embed code copied ✓" }); }}
                style={{ marginTop: 10, padding: "8px 16px", background: C.teal, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>Copy embed code</button>
            </>
          )}
          {tab === "qr" && (
            <div style={{ textAlign: "center" }}>
              <img src={qrCodeUrl(link)} alt="QR Code" width={200} height={200} style={{ borderRadius: 8, border: `1px solid ${C.line}` }} />
              <p style={{ fontSize: 12, color: C.ink4, marginTop: 12 }}>Scan or print for physical distribution</p>
            </div>
          )}
          {survey.status !== "active" && (
            <div style={{ marginTop: 16, padding: "10px 14px", background: C.amberL, borderRadius: 8, fontSize: 13, color: C.amber }}>
              ⚠ Survey is <strong>{survey.status}</strong>. Activate before sharing.
            </div>
          )}
        </div>
        <div style={{ padding: "14px 24px", borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 20px", background: C.teal, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer" }}>Done</button>
        </div>
      </div>
    </div>
  );
}
