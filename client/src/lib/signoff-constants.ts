export const SIGNOFF_STATUS: Record<string, { label: string; color: string; icon: string }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground border border-border", icon: "📝" },
  pending: { label: "Awaiting Signature", color: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800", icon: "⏳" },
  partially_signed: { label: "Partially Signed", color: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800", icon: "◐" },
  completed: { label: "Completed", color: "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800", icon: "✅" },
  declined: { label: "Declined", color: "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800", icon: "✗" },
  expired: { label: "Expired", color: "bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700", icon: "⌛" },
  voided: { label: "Voided", color: "bg-gray-100 text-gray-400 border border-gray-200 line-through dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700", icon: "⊘" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700", icon: "⊘" },
};

export const SIGNER_STATUS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  notified: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  viewed: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  signed: "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800",
  declined: "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
};

export const SIGNER_LABEL: Record<string, string> = {
  pending: "Pending", notified: "Notified", viewed: "Viewed", signed: "✓ Signed", declined: "✗ Declined",
};

export const AUDIT_EVENT_LABEL: Record<string, string> = {
  created: "Request created",
  sent: "Sign-off request sent to signers",
  viewed: "Document viewed",
  signed: "Document signed",
  declined: "Declined to sign",
  reminder_sent: "Reminder sent",
  signer_added: "Signer added",
  signer_removed: "Signer removed",
  voided: "Document voided",
  completed: "Document fully signed",
  expired: "Document expired",
  pdf_sent: "Completed PDF emailed",
  qtsp_timestamp: "QTSP timestamp applied",
};

export const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "awaiting", label: "Awaiting Signature" },
  { key: "completed", label: "Completed" },
  { key: "declined", label: "Declined" },
  { key: "expired", label: "Expired" },
  { key: "voided", label: "Voided" },
  { key: "draft", label: "Drafts" },
] as const;

export type SignoffRequest = {
  id: number; title: string; description?: string; status: string; sourceType: string;
  sourceDocumentId?: number; templateId?: number; projectId?: number; deliverableId?: number;
  crmContractId?: number; timesheetPeriodId?: number; testCycleId?: number;
  fileName?: string; fileType?: string; message?: string; signingOrder?: string;
  deadline?: string; allowDecline?: boolean; sendCopyOnCompletion?: boolean;
  requireAcknowledgement?: boolean; acknowledgementText?: string; requireReadToBottom?: boolean;
  requireOtpVerification?: boolean; requireEidasConsent?: boolean; eidasConsentText?: string;
  signatureLevel?: string;
  createdByName?: string; sentAt?: string; completedAt?: string; voidReason?: string;
  createdAt: string; contentHtml?: string;
  signers: SignoffSigner[]; auditLog: AuditEvent[];
  signatureFields?: SignatureField[];
  sourceDocument?: { id: number; title: string; content: string | null } | null;
  project?: { id: number; name: string } | null;
  deliverable?: { id: number; name: string } | null;
};

export type SignoffSigner = {
  id: number; requestId: number; signerOrder: number; name: string; email: string;
  roleTitle?: string; isInternal: boolean; userId?: string; token?: string;
  status: string; signedAt?: string; viewedAt?: string; notifiedAt?: string;
  declinedAt?: string; declineReason?: string; signatureName?: string;
  signatureMethod?: string; privateMessage?: string; signingDeadline?: string;
  tokenExpiresAt?: string; otpVerifiedAt?: string; eidasConsentAt?: string;
};

export type SignatureField = {
  id: number; requestId: number; signerEmail: string; fieldType: string;
  pageNumber: number; xPercent: string; yPercent: string;
  widthPercent: string; heightPercent: string;
  isRequired: boolean; label?: string | null; value?: string | null;
};

export type AuditEvent = {
  id: number; requestId: number; event: string; actorName: string;
  actorEmail?: string; ipAddress?: string; userAgent?: string; createdAt: string;
  metadata?: Record<string, unknown>;
};

export type SignoffTemplate = {
  id: number; title: string; description?: string; category?: string;
  tier: string; sourceType: string; contentHtml?: string;
};

export type ComposeSigner = {
  name: string; email: string; roleTitle?: string; isInternal: boolean;
  userId?: string; privateMessage?: string; signingDeadline?: string;
};
