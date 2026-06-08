import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { SubmitForm } from "@/components/ui/submit-form";
import { FileText, FileSpreadsheet, Presentation, CheckCircle2, AlertTriangle, Clock, Link2, Download, Shield } from "lucide-react";

type SignoffSigner = {
  id: number; requestId: number; signerOrder: number; name: string;
  email: string; isInternal: boolean; status: string; signedAt?: string;
  viewedAt?: string; declinedAt?: string; declineReason?: string;
  signatureName?: string; tokenExpiresAt?: string;
};
type SignoffRequest = {
  id: number; title: string; status: string; sourceType: string;
  sourceDocumentId?: number; fileName?: string; fileType?: string;
  message?: string; deadline?: string; createdByName?: string; sentAt?: string;
  signers: SignoffSigner[];
  sourceDocument?: { id: number; title: string; content: string | null } | null;
};

const FILE_ICON: Record<string, JSX.Element> = {
  pdf: <FileText className="h-6 w-6 text-red-500" />,
  docx: <FileText className="h-6 w-6 text-blue-500" />,
  xlsx: <FileSpreadsheet className="h-6 w-6 text-green-600" />,
  pptx: <Presentation className="h-6 w-6 text-orange-500" />,
};

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function SigningPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [alreadyDeclined, setAlreadyDeclined] = useState(false);
  const [request, setRequest] = useState<SignoffRequest | null>(null);
  const [signer, setSigner] = useState<SignoffSigner | null>(null);
  const [step, setStep] = useState<"view" | "sign" | "decline" | "done_sign" | "done_decline">("view");
  const [sigName, setSigName] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [viewed, setViewed] = useState(false);

  useEffect(() => {
    if (!token) { setError("Invalid signing link."); setLoading(false); return; }
    fetch(`/api/signoff/sign/${token}`)
      .then(async r => {
        const body = await r.json();
        if (!r.ok) {
          if (r.status === 409 && body.message === "already_signed") {
            setAlreadySigned(true); setSigner(body.signer);
          } else if (r.status === 409 && body.message === "already_declined") {
            setAlreadyDeclined(true); setSigner(body.signer);
          } else {
            setError(body.message || "Something went wrong");
          }
          setLoading(false); return;
        }
        setRequest(body.request);
        setSigner(body.signer);
        setSigName(body.signer.name);
        setLoading(false);
      })
      .catch(() => { setError("Could not load document. Please try again."); setLoading(false); });
  }, [token]);

  // Mark as viewed once component loads with request
  useEffect(() => {
    if (request && signer && !viewed) {
      setViewed(true);
      fetch(`/api/signoff/sign/${token}/view`, { method: "POST" }).catch(() => {});
    }
  }, [request, signer, token, viewed]);

  async function handleSign() {
    if (!sigName.trim() || sigName.trim().length < 2) {
      alert("Please type your full legal name to sign"); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/signoff/sign/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureName: sigName.trim() }),
      });
      const body = await res.json();
      if (!res.ok) { alert(body.message || "Error signing. Please try again."); setSubmitting(false); return; }
      setStep("done_sign");
    } catch { alert("Network error. Please try again."); setSubmitting(false); }
  }

  async function handleDecline() {
    if (!declineReason.trim() || declineReason.trim().length < 3) {
      alert("Please provide a reason for declining"); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/signoff/sign/${token}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineReason.trim() }),
      });
      const body = await res.json();
      if (!res.ok) { alert(body.message || "Error. Please try again."); setSubmitting(false); return; }
      setStep("done_decline");
    } catch { alert("Network error. Please try again."); setSubmitting(false); }
  }

  // ── LOADING ──────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500">Loading document…</p>
      </div>
    </div>
  );

  // ── ERROR ────────────────────────────────────────────────────────
  if (error) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-10 max-w-md w-full text-center">
        <div className="text-5xl mb-4">🔗</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Link unavailable</h1>
        <p className="text-gray-500 text-sm">{error}</p>
        <p className="text-gray-400 text-xs mt-4">If you think this is an error, please contact the person who sent you this request.</p>
      </div>
    </div>
  );

  // ── ALREADY SIGNED ───────────────────────────────────────────────
  if (alreadySigned && signer) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-green-200 p-10 max-w-md w-full text-center">
        <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">You've already signed</h1>
        <p className="text-gray-500 text-sm">
          {signer.signatureName ? `Signed as "${signer.signatureName}"` : "This document has been signed."}{" "}
          {signer.signedAt ? `on ${fmtDate(signer.signedAt)}` : ""}
        </p>
        <div className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-center gap-2 text-xs text-gray-400">
          <Shield className="h-3.5 w-3.5" /> Secured by Jiganto e-Sign
        </div>
      </div>
    </div>
  );

  // ── ALREADY DECLINED ─────────────────────────────────────────────
  if (alreadyDeclined && signer) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 max-w-md w-full text-center">
        <div className="text-5xl mb-4">✗</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">You declined this sign-off</h1>
        {signer.declineReason && <p className="text-gray-500 text-sm mt-1">Reason: "{signer.declineReason}"</p>}
        <p className="text-gray-400 text-xs mt-4">The sender has been notified. Contact them if you wish to reconsider.</p>
      </div>
    </div>
  );

  // ── DONE SIGN ────────────────────────────────────────────────────
  if (step === "done_sign") return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-green-200 p-10 max-w-md w-full text-center">
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-5" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Document signed!</h1>
        <p className="text-gray-500 text-sm">
          You signed "<strong>{request?.title}</strong>" as <strong>{sigName}</strong>.
        </p>
        <p className="text-gray-400 text-xs mt-4">A confirmation of your signature has been recorded. You may now close this window.</p>
        <div className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-center gap-2 text-xs text-gray-400">
          <Shield className="h-3.5 w-3.5" /> Secured by Jiganto e-Sign
        </div>
      </div>
    </div>
  );

  // ── DONE DECLINE ─────────────────────────────────────────────────
  if (step === "done_decline") return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 max-w-md w-full text-center">
        <AlertTriangle className="h-14 w-14 text-amber-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Sign-off declined</h1>
        <p className="text-gray-500 text-sm">You declined to sign "<strong>{request?.title}</strong>". The sender has been notified.</p>
        <p className="text-gray-400 text-xs mt-4">You may close this window.</p>
      </div>
    </div>
  );

  if (!request || !signer) return null;

  const expired = signer.tokenExpiresAt ? new Date() > new Date(signer.tokenExpiresAt) : false;

  // ── MAIN SIGNING PORTAL ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="font-bold text-lg flex items-center gap-2 text-gray-900">
          Jiganto <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full uppercase tracking-wide">e-Sign</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Shield className="h-3.5 w-3.5" /> Secure signing portal
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Left: document */}
        <div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-1">
                <div className="text-2xl">📄</div>
                <div>
                  <h1 className="font-bold text-xl text-gray-900">{request.title}</h1>
                  <p className="text-gray-400 text-sm">Sent by {request.createdByName || "—"} · {fmtDate(request.sentAt)}</p>
                </div>
              </div>
              {request.deadline && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3 w-fit">
                  <Clock className="h-3.5 w-3.5" /> Sign-off deadline: {fmtDate(request.deadline)}
                </div>
              )}
            </div>

            {request.message && (
              <div className="px-6 py-4 bg-blue-50 border-b border-blue-100 text-sm text-blue-800">
                <span className="font-medium">Message from sender:</span> {request.message}
              </div>
            )}

            <div>
              {request.sourceType === "upload" && request.fileType === "pdf" ? (
                <div>
                  <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 text-sm text-gray-600 flex items-center justify-between">
                    <span className="flex items-center gap-2">{FILE_ICON[request.fileType] || <FileText className="h-4 w-4" />} {request.fileName}</span>
                    <a href={`/api/signoff/${request.id}/file?token=${token}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 hover:text-gray-900">
                      <Download className="h-3.5 w-3.5" /> Download PDF
                    </a>
                  </div>
                  <iframe src={`/api/signoff/${request.id}/file?token=${token}`} className="w-full h-[620px]" title="Document preview" />
                </div>
              ) : request.sourceType === "upload" ? (
                <div className="px-6 py-10 text-center">
                  <div className="flex justify-center mb-4">{FILE_ICON[request.fileType || ""] || <FileText className="h-12 w-12 text-gray-400" />}</div>
                  <h3 className="font-semibold text-gray-800 text-lg mb-2">{request.fileName}</h3>
                  <p className="text-gray-400 text-sm mb-5">This file type cannot be previewed in the browser. Download it to review the document before signing.</p>
                  <a href={`/api/signoff/${request.id}/file?token=${token}`} download
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                    <Download className="h-4 w-4" /> Download {request.fileType?.toUpperCase()}
                  </a>
                </div>
              ) : request.sourceDocument ? (
                <div>
                  <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 text-sm text-gray-600 flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-blue-500" /> Jiganto Document: {request.sourceDocument.title}
                  </div>
                  <div className="px-8 py-8 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: request.sourceDocument.content || "<p>No content</p>" }} />
                </div>
              ) : (
                <div className="px-6 py-10 text-center text-gray-400 text-sm">Document not available</div>
              )}
            </div>
          </div>
        </div>

        {/* Right: signer panel */}
        <div className="space-y-4">
          {/* Signer info */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Your Signature Request</div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                {signer.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{signer.name}</div>
                <div className="text-xs text-gray-400">{signer.email}</div>
              </div>
            </div>

            {expired ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>This signing link has expired. Please contact the sender to request a new link.</span>
              </div>
            ) : step === "view" ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">Please read the document carefully before signing.</p>
                <button onClick={() => setStep("sign")} data-testid="btn-sign"
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 flex items-center justify-center gap-2">
                  ✍️ Sign Document
                </button>
                <button onClick={() => setStep("decline")} data-testid="btn-decline"
                  className="w-full py-2.5 border border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50 hover:border-gray-300">
                  Decline to Sign
                </button>
              </div>
            ) : step === "sign" ? (
              <SubmitForm
                onSubmit={handleSign}
                disabled={submitting || sigName.trim().length < 2}
                className="space-y-3"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Type your full legal name</label>
                  <input value={sigName} onChange={e => setSigName(e.target.value)}
                    data-testid="input-signature"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    placeholder="Full legal name" />
                  <p className="text-xs text-gray-400 mt-1">This constitutes your legal signature on this document.</p>
                </div>
                <button type="submit" disabled={submitting || sigName.trim().length < 2} data-testid="btn-confirm-sign"
                  className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> {submitting ? "Signing…" : "Confirm Signature"}
                </button>
                <button type="button" onClick={() => setStep("view")} className="w-full py-2.5 border border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50">
                  ← Back
                </button>
              </SubmitForm>
            ) : step === "decline" ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason for declining</label>
                  <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} rows={3}
                    data-testid="input-decline-reason"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none"
                    placeholder="Please explain why you are declining to sign…" />
                </div>
                <button onClick={handleDecline} disabled={submitting || declineReason.trim().length < 3} data-testid="btn-confirm-decline"
                  className="w-full py-2.5 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 disabled:opacity-50">
                  {submitting ? "Submitting…" : "Confirm Decline"}
                </button>
                <button onClick={() => setStep("view")} className="w-full py-2.5 border border-gray-200 text-gray-500 rounded-xl text-sm hover:bg-gray-50">
                  ← Back
                </button>
              </div>
            ) : null}
          </div>

          {/* Signing progress */}
          {request.signers.length > 1 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">All Signers</div>
              <div className="space-y-3">
                {request.signers.map((s, i) => {
                  const statusColors: Record<string, string> = {
                    pending: "bg-amber-100 text-amber-700",
                    viewed: "bg-blue-100 text-blue-700",
                    signed: "bg-green-100 text-green-700",
                    declined: "bg-red-100 text-red-700",
                  };
                  return (
                    <div key={s.id} className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{s.name}</div>
                        <div className="text-xs text-gray-400 truncate">{s.email}</div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[s.status] || "bg-gray-100 text-gray-500"}`}>
                        {s.status === "signed" ? "✓ Signed" : s.status === "declined" ? "✗ Declined" : s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Security badge */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-gray-400 text-xs mb-1">
              <Shield className="h-3.5 w-3.5" /> Secured by Jiganto e-Sign
            </div>
            <p className="text-gray-400 text-xs">Your IP address and timestamp are recorded for audit purposes</p>
          </div>
        </div>
      </div>
    </div>
  );
}
