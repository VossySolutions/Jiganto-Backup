import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "wouter";
import { SubmitForm } from "@/components/ui/submit-form";
import { SignaturePad } from "@/components/esign/SignaturePad";
import { cn } from "@/lib/utils";
import {
  FileText, FileSpreadsheet, Presentation, CheckCircle2, AlertTriangle,
  Clock, Link2, Download, Shield, ArrowLeft,
} from "lucide-react";
import type { SignoffRequest, SignoffSigner, SignatureField } from "@/lib/signoff-constants";
import { SIGNER_STATUS, SIGNER_LABEL } from "@/lib/signoff-constants";
import { EsignLoadingState, EsignButtonSpinner } from "@/components/esign/EsignLoadingState";
import "@/styles/esign.css";

const FILE_ICON: Record<string, JSX.Element> = {
  pdf: <FileText className="h-6 w-6 text-red-500" />,
  docx: <FileText className="h-6 w-6 text-blue-500" />,
  xlsx: <FileSpreadsheet className="h-6 w-6 text-green-600" />,
  pptx: <Presentation className="h-6 w-6 text-orange-500" />,
  png: <FileText className="h-6 w-6 text-purple-500" />,
  jpg: <FileText className="h-6 w-6 text-purple-500" />,
  jpeg: <FileText className="h-6 w-6 text-purple-500" />,
};

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

type SigMethod = "draw" | "type" | "upload";

export default function SigningPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notYourTurn, setNotYourTurn] = useState(false);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [alreadyDeclined, setAlreadyDeclined] = useState(false);
  const [request, setRequest] = useState<SignoffRequest | null>(null);
  const [signer, setSigner] = useState<SignoffSigner | null>(null);
  const [step, setStep] = useState<"view" | "otp" | "fields" | "sign" | "decline" | "done_sign" | "done_decline">("view");
  const [sigName, setSigName] = useState("");
  const [sigMethod, setSigMethod] = useState<SigMethod>("type");
  const [signatureData, setSignatureData] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [viewed, setViewed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [requestCompleted, setRequestCompleted] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [eidasConsent, setEidasConsent] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<number, string>>({});
  const [fieldIndex, setFieldIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!token) { setError("Invalid signing link."); setLoading(false); return; }
    fetch(`/api/signoff/sign/${token}`)
      .then(async r => {
        const body = await r.json();
        if (!r.ok) {
          if (r.status === 403) {
            setNotYourTurn(true);
            if (body.request) setRequest(body.request);
            if (body.signer) setSigner(body.signer);
          } else if (r.status === 409 && body.message === "already_signed") {
            setAlreadySigned(true);
            setSigner(body.signer);
          } else if (r.status === 409 && body.message === "already_declined") {
            setAlreadyDeclined(true);
            setSigner(body.signer);
          } else {
            setError(body.message || "Something went wrong");
          }
          setLoading(false);
          return;
        }
        setRequest(body.request);
        setSigner(body.signer);
        setSigName(body.signer.name);
        setOtpVerified(!!body.signer.otpVerifiedAt);
        setLoading(false);
      })
      .catch(() => { setError("Could not load document. Please try again."); setLoading(false); });
  }, [token]);

  useEffect(() => {
    if (request && signer && !viewed && token) {
      setViewed(true);
      fetch(`/api/signoff/sign/${token}/view`, { method: "POST" }).catch(() => {});
    }
  }, [request, signer, token, viewed]);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24;
    if (atBottom) setScrolledToBottom(true);
  }, []);

  useEffect(() => {
    if (!request?.requireReadToBottom) {
      setScrolledToBottom(true);
      return;
    }
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll);
    return () => el.removeEventListener("scroll", checkScroll);
  }, [request, checkScroll]);

  useEffect(() => {
    if (!request?.requireReadToBottom || request.sourceType !== "upload" || request.fileType !== "pdf") return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    const onLoad = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) return;
        const handler = () => {
          const atBottom = doc.documentElement.scrollTop + doc.documentElement.clientHeight >= doc.documentElement.scrollHeight - 24;
          if (atBottom) setScrolledToBottom(true);
        };
        doc.addEventListener("scroll", handler);
        handler();
      } catch {
        setScrolledToBottom(true);
      }
    };
    iframe.addEventListener("load", onLoad);
    return () => iframe.removeEventListener("load", onLoad);
  }, [request]);

  const canProceedToSign = useCallback(() => {
    if (request?.requireReadToBottom && !scrolledToBottom) return false;
    if (request?.requireAcknowledgement && !acknowledged) return false;
    return true;
  }, [request, scrolledToBottom, acknowledged]);

  const hasValidSignature = useCallback(() => {
    if (sigName.trim().length < 2) return false;
    if (sigMethod === "draw" && !signatureData) return false;
    if (sigMethod === "upload" && !signatureData) return false;
    return true;
  }, [sigName, sigMethod, signatureData]);

  const myFields = (request?.signatureFields ?? []).filter(
    f => signer && f.signerEmail.toLowerCase() === signer.email.toLowerCase(),
  );

  function proceedFromView() {
    if (request?.requireOtpVerification && !otpVerified && !signer?.otpVerifiedAt) {
      setStep("otp");
      return;
    }
    if (myFields.length) {
      setFieldIndex(0);
      setStep("fields");
      return;
    }
    setStep("sign");
  }

  async function sendOtp() {
    if (!token) return;
    setOtpSending(true);
    try {
      const res = await fetch(`/api/signoff/sign/${token}/otp/send`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) alert(body.message || "Could not send code");
      else alert("Verification code sent to your email");
    } finally {
      setOtpSending(false);
    }
  }

  async function verifyOtp() {
    if (!token || otpCode.trim().length < 6) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/signoff/sign/${token}/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otpCode.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        alert(body.message || "Invalid code");
        return;
      }
      setOtpVerified(true);
      if (myFields.length) {
        setFieldIndex(0);
        setStep("fields");
      } else {
        setStep("sign");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function completeCurrentField(value: string) {
    const field = myFields[fieldIndex];
    if (!field) return;
    setFieldValues(prev => ({ ...prev, [field.id]: value }));
    if (fieldIndex < myFields.length - 1) {
      setFieldIndex(fieldIndex + 1);
    } else {
      setStep("sign");
    }
  }

  async function handleSign() {
    if (!hasValidSignature()) {
      alert("Please complete your signature before submitting");
      return;
    }
    if (request?.requireEidasConsent && !eidasConsent) {
      alert("Please accept the eIDAS consent before signing");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/signoff/sign/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatureName: sigName.trim(),
          signatureMethod: sigMethod,
          signatureData: signatureData || undefined,
          eidasConsentGiven: eidasConsent,
          fieldValues,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        alert(body.message || "Error signing. Please try again.");
        setSubmitting(false);
        return;
      }
      setRequestCompleted(request!.signers.every(s => s.id === signer!.id || s.status === "signed"));
      setStep("done_sign");
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecline() {
    if (!declineReason.trim() || declineReason.trim().length < 3) {
      alert("Please provide a reason for declining");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/signoff/sign/${token}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineReason.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        alert(body.message || "Error. Please try again.");
        setSubmitting(false);
        return;
      }
      setStep("done_decline");
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <EsignLoadingState label="Loading document…" size="lg" />
      </div>
    );
  }

  if (notYourTurn) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="bg-card rounded-2xl shadow-sm border border-amber-200 p-10 max-w-md w-full text-center">
          <Clock className="h-14 w-14 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Not your turn yet</h1>
          <p className="text-muted-foreground text-sm">
            This document uses sequential signing. You will be notified by email when it is your turn to sign
            {request?.title ? ` "${request.title}"` : ""}.
          </p>
          {signer && (
            <p className="text-xs text-muted-foreground mt-4">Signed in as {signer.name} ({signer.email})</p>
          )}
          <div className="mt-6 pt-6 border-t border-border flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" /> Secured by Jiganto e-Sign
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="bg-card rounded-2xl shadow-sm border border-red-200 p-10 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🔗</div>
          <h1 className="text-xl font-bold mb-2">Link unavailable</h1>
          <p className="text-muted-foreground text-sm">{error}</p>
          <p className="text-muted-foreground/70 text-xs mt-4">If you think this is an error, please contact the person who sent you this request.</p>
        </div>
      </div>
    );
  }

  if (alreadySigned && signer) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="bg-card rounded-2xl shadow-sm border border-green-200 p-10 max-w-md w-full text-center">
          <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">You&apos;ve already signed</h1>
          <p className="text-muted-foreground text-sm">
            {signer.signatureName ? `Signed as "${signer.signatureName}"` : "This document has been signed."}{" "}
            {signer.signedAt ? `on ${fmtDate(signer.signedAt)}` : ""}
          </p>
          {request && (
            <a href={`/api/signoff/${request.id}/signed-pdf?token=${token}`}
              className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
              <Download className="h-4 w-4" /> Download signed PDF
            </a>
          )}
          <div className="mt-6 pt-6 border-t border-border flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" /> Secured by Jiganto e-Sign
          </div>
        </div>
      </div>
    );
  }

  if (alreadyDeclined && signer) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="bg-card rounded-2xl shadow-sm border p-10 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✗</div>
          <h1 className="text-2xl font-bold mb-2">You declined this sign-off</h1>
          {signer.declineReason && <p className="text-muted-foreground text-sm mt-1">Reason: &quot;{signer.declineReason}&quot;</p>}
          <p className="text-muted-foreground/70 text-xs mt-4">The sender has been notified. Contact them if you wish to reconsider.</p>
        </div>
      </div>
    );
  }

  if (step === "done_sign") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="bg-card rounded-2xl shadow-sm border border-green-200 p-10 max-w-md w-full text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-5" />
          <h1 className="text-2xl font-bold mb-2">Document signed!</h1>
          <p className="text-muted-foreground text-sm">
            You signed &quot;<strong>{request?.title}</strong>&quot; as <strong>{sigName}</strong>.
          </p>
          {requestCompleted ? (
            <a href={`/api/signoff/${request?.id}/signed-pdf?token=${token}`}
              className="inline-flex items-center gap-2 mt-6 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
              <Download className="h-4 w-4" /> Download signed PDF
            </a>
          ) : (
            <p className="text-muted-foreground/70 text-xs mt-4">
              Your signature has been recorded. You will receive the completed document when all signers have signed.
            </p>
          )}
          {!requestCompleted && request && (
            <a href={`/api/signoff/${request.id}/signed-pdf?token=${token}`}
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted">
              <Download className="h-4 w-4" /> Download progress PDF
            </a>
          )}
          <div className="mt-6 pt-6 border-t border-border flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" /> Secured by Jiganto e-Sign
          </div>
        </div>
      </div>
    );
  }

  if (step === "done_decline") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="bg-card rounded-2xl shadow-sm border p-10 max-w-md w-full text-center">
          <AlertTriangle className="h-14 w-14 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Sign-off declined</h1>
          <p className="text-muted-foreground text-sm">You declined to sign &quot;<strong>{request?.title}</strong>&quot;. The sender has been notified.</p>
          <p className="text-muted-foreground/70 text-xs mt-4">You may close this window.</p>
        </div>
      </div>
    );
  }

  if (!request || !signer) return null;

  const expired = signer.tokenExpiresAt ? new Date() > new Date(signer.tokenExpiresAt) : false;
  const isPdf = request.sourceType === "upload" && request.fileType === "pdf";
  const isInline = request.sourceType === "inline_doc" || request.sourceType === "template" || !!request.contentHtml;

  function renderDocumentContent() {
    if (isPdf) {
      return (
        <iframe ref={iframeRef} src={`/api/signoff/${request!.id}/file?token=${token}`}
          className="w-full esign-doc-preview" title="Document preview" />
      );
    }
    if (request!.sourceType === "upload") {
      return (
        <div className="px-6 py-10 text-center">
          <div className="flex justify-center mb-4">{FILE_ICON[request!.fileType || ""] || <FileText className="h-12 w-12 text-muted-foreground" />}</div>
          <h3 className="font-semibold text-lg mb-2">{request!.fileName}</h3>
          <p className="text-muted-foreground text-sm mb-5">This file type cannot be previewed in the browser. Download it to review before signing.</p>
          <a href={`/api/signoff/${request!.id}/file?token=${token}`} download
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
            <Download className="h-4 w-4" /> Download {request!.fileType?.toUpperCase()}
          </a>
        </div>
      );
    }
    if (request!.sourceDocument) {
      return (
        <div ref={scrollRef} className="px-4 sm:px-8 py-6 sm:py-8 prose prose-sm max-w-none esign-doc-scroll overflow-y-auto"
          dangerouslySetInnerHTML={{ __html: request!.sourceDocument.content || "<p>No content</p>" }} />
      );
    }
    if (isInline) {
      return (
        <div ref={scrollRef} className="px-4 sm:px-8 py-6 sm:py-8 prose prose-sm max-w-none esign-doc-scroll overflow-y-auto"
          dangerouslySetInnerHTML={{ __html: request!.contentHtml || "<p>No content</p>" }} />
      );
    }
    return <div className="px-6 py-10 text-center text-muted-foreground text-sm">Document not available</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="font-bold text-base sm:text-lg flex items-center gap-2 min-w-0">
          Jiganto <span className="text-[10px] sm:text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0">e-Sign</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5" /> Secure signing portal
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 esign-portal-grid">
        <div className="min-w-0">
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-border">
              <div className="flex items-center gap-3 mb-1">
                <div className="text-2xl">📄</div>
                <div>
                  <h1 className="font-bold text-xl">{request.title}</h1>
                  <p className="text-muted-foreground text-sm">Sent by {request.createdByName || "—"} · {fmtDate(request.sentAt)}</p>
                </div>
              </div>
              {request.deadline && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3 w-fit">
                  <Clock className="h-3.5 w-3.5" /> Sign-off deadline: {fmtDate(request.deadline)}
                </div>
              )}
            </div>

            {request.message && (
              <div className="px-6 py-4 bg-blue-50 border-b border-blue-100 text-sm text-blue-800">
                <span className="font-medium">Message from sender:</span> {request.message}
              </div>
            )}

            {request.requireReadToBottom && !scrolledToBottom && (
              <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Please scroll to the bottom of the document before signing.
              </div>
            )}

            <div>
              {isPdf && (
                <div className="px-6 py-3 bg-muted border-b border-border text-sm text-muted-foreground flex items-center justify-between">
                  <span className="flex items-center gap-2">{FILE_ICON[request.fileType || ""] || <FileText className="h-4 w-4" />} {request.fileName}</span>
                  <a href={`/api/signoff/${request.id}/file?token=${token}`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 hover:text-foreground">
                    <Download className="h-3.5 w-3.5" /> Download PDF
                  </a>
                </div>
              )}
              {request.sourceDocument && !isPdf && (
                <div className="px-6 py-3 bg-muted border-b border-border text-sm text-muted-foreground flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-primary" /> Jiganto Document: {request.sourceDocument.title}
                </div>
              )}
              {renderDocumentContent()}
            </div>
          </div>
        </div>

        <div className="space-y-4 esign-sign-panel">
          <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Your Signature Request</div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                {signer.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold">{signer.name}</div>
                <div className="text-xs text-muted-foreground">{signer.email}</div>
                {signer.roleTitle && <div className="text-xs text-muted-foreground">{signer.roleTitle}</div>}
              </div>
            </div>

            {signer.privateMessage && (
              <div className="mb-4 p-3 bg-muted rounded-lg text-sm text-muted-foreground italic">
                &quot;{signer.privateMessage}&quot;
              </div>
            )}

            {expired ? (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>This signing link has expired. Please contact the sender to request a new link.</span>
              </div>
            ) : step === "view" ? (
              <div className="space-y-3">
                {request.requireAcknowledgement && (
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)}
                      className="mt-0.5 rounded border-border" data-testid="checkbox-acknowledgement" />
                    <span>{request.acknowledgementText || "I acknowledge that I have read and understood this document."}</span>
                  </label>
                )}
                <p className="text-sm text-muted-foreground">Please read the document carefully before signing.</p>
                <button onClick={proceedFromView} disabled={!canProceedToSign()} data-testid="btn-sign"
                  className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                  ✍️ Sign Document
                </button>
                {request.allowDecline !== false && (
                  <button onClick={() => setStep("decline")} data-testid="btn-decline"
                    className="w-full py-2.5 border border-border text-muted-foreground rounded-xl text-sm hover:bg-muted">
                    Decline to Sign
                  </button>
                )}
              </div>
            ) : step === "otp" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to {signer.email}</p>
                <button type="button" onClick={sendOtp} disabled={otpSending}
                  className="w-full py-2 border border-border rounded-xl text-sm hover:bg-muted disabled:opacity-50">
                  {otpSending ? "Sending…" : "Send verification code"}
                </button>
                <input value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000" inputMode="numeric"
                  className="w-full px-3 py-2.5 border border-border rounded-lg text-center text-lg tracking-widest" />
                <button onClick={verifyOtp} disabled={submitting || otpCode.length < 6}
                  className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50">
                  Verify & Continue
                </button>
                <button type="button" onClick={() => setStep("view")}
                  className="w-full py-2.5 border border-border text-muted-foreground rounded-xl text-sm hover:bg-muted">
                  Back
                </button>
              </div>
            ) : step === "fields" ? (
              <FieldStep
                fields={myFields}
                index={fieldIndex}
                values={fieldValues}
                sigName={sigName}
                onComplete={completeCurrentField}
                onBack={() => setStep(otpVerified || !request?.requireOtpVerification ? "view" : "otp")}
              />
            ) : step === "sign" ? (
              <SubmitForm onSubmit={handleSign} disabled={submitting || !hasValidSignature()} className="space-y-3">
                {request.requireEidasConsent && (
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={eidasConsent} onChange={e => setEidasConsent(e.target.checked)}
                      className="mt-0.5 rounded border-border" data-testid="checkbox-eidas-consent" />
                    <span>{request.eidasConsentText || "I consent to sign using a Simple Electronic Signature (SES) under eIDAS."}</span>
                  </label>
                )}
                <SignaturePad
                  name={sigName}
                  onNameChange={setSigName}
                  method={sigMethod}
                  onMethodChange={setSigMethod}
                  signatureData={signatureData}
                  onSignatureDataChange={setSignatureData}
                />
                <button type="submit" disabled={submitting || !hasValidSignature()} data-testid="btn-confirm-sign"
                  className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <><EsignButtonSpinner /> Signing…</> : <><CheckCircle2 className="h-4 w-4" /> Confirm Signature</>}
                </button>
                <button type="button" onClick={() => setStep(myFields.length ? "fields" : "view")}
                  className="w-full py-2.5 border border-border text-muted-foreground rounded-xl text-sm hover:bg-muted flex items-center justify-center gap-1">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </button>
              </SubmitForm>
            ) : step === "decline" ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Reason for declining</label>
                  <textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} rows={3}
                    data-testid="input-decline-reason"
                    className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    placeholder="Please explain why you are declining to sign…" />
                </div>
                <button onClick={handleDecline} disabled={submitting || declineReason.trim().length < 3} data-testid="btn-confirm-decline"
                  className="w-full py-2.5 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <><EsignButtonSpinner /> Submitting…</> : "Confirm Decline"}
                </button>
                <button onClick={() => setStep("view")}
                  className="w-full py-2.5 border border-border text-muted-foreground rounded-xl text-sm hover:bg-muted flex items-center justify-center gap-1">
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </button>
              </div>
            ) : null}
          </div>

          {request.signers.length > 1 && (
            <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">All Signers</div>
              <div className="space-y-3">
                {[...request.signers].sort((a, b) => a.signerOrder - b.signerOrder).map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{s.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{s.email}</div>
                    </div>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", SIGNER_STATUS[s.status] || "bg-muted text-muted-foreground")}>
                      {SIGNER_LABEL[s.status] || s.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-card rounded-2xl border border-border shadow-sm p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs mb-1">
              <Shield className="h-3.5 w-3.5" /> Secured by Jiganto e-Sign
            </div>
            <p className="text-muted-foreground/70 text-xs">Your IP address and timestamp are recorded for audit purposes</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldStep({
  fields, index, values, sigName, onComplete, onBack,
}: {
  fields: SignatureField[];
  index: number;
  values: Record<number, string>;
  sigName: string;
  onComplete: (value: string) => void;
  onBack: () => void;
}) {
  const field = fields[index];
  const [textVal, setTextVal] = useState(values[field?.id] ?? "");

  useEffect(() => {
    setTextVal(values[field?.id] ?? "");
  }, [field?.id, values]);

  if (!field) return null;

  const label = field.label || field.fieldType;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Field {index + 1} of {fields.length}</p>
      <div className="text-sm font-medium">{label}</div>
      {field.fieldType === "date" ? (
        <input type="date" value={textVal} onChange={e => setTextVal(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm" />
      ) : field.fieldType === "signature" ? (
        <input value={textVal || sigName} onChange={e => setTextVal(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder="Your signature" />
      ) : (
        <input value={textVal} onChange={e => setTextVal(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm" placeholder={label} />
      )}
      <button
        onClick={() => onComplete(field.fieldType === "signature" ? (textVal || sigName) : textVal)}
        disabled={field.isRequired && !(textVal || (field.fieldType === "signature" && sigName))}
        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 disabled:opacity-50">
        {index < fields.length - 1 ? "Next Field →" : "Continue to Sign"}
      </button>
      <button type="button" onClick={onBack}
        className="w-full py-2.5 border border-border text-muted-foreground rounded-xl text-sm hover:bg-muted">
        Back
      </button>
    </div>
  );
}
