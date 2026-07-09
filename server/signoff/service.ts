import crypto from "crypto";
import {
  and,
  desc,
  eq,
  inArray,
  or
} from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { tenants } from "@shared/schema";
import { documents } from "@shared/models/documents";
import { pmProjects, pmDeliverables } from "@shared/models/projects";
import { users } from "@shared/models/auth";
import {
  signoffRequests, signoffSigners, signoffAuditLog, signoffTemplates,
  type SignoffRequestWithDetails, type SignoffSigner, type SignoffTemplate,
} from "@shared/models/signoff";
import { getTimesheetPeriod, listTimesheetEntries } from "../finance/repository";
import { logTimesheetAudit } from "../resources/service";
import { SYSTEM_ESIGN_TEMPLATES } from "./system-templates";
import {
  sendSignerInviteEmail, sendReminderEmail, sendDeclineNotificationEmail,
  sendCompletionEmail, sendExpiredNotificationEmail,
} from "./email";
import { generateSignedPdf } from "./pdf";
import { convertDocxBufferToPdfBase64 } from "./docx";
import { listFields, replaceFields, completeFieldsForSigner, type FieldInput } from "./fields";
import { sendSignerOtp, verifySignerOtp } from "./otp";
import { applyQtspTimestamp, isAdesAvailable } from "./qtsp";

function genToken() {
  return crypto.randomBytes(32).toString("hex");
}

function defaultDeadline(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

function deadlineDate(request: { deadline?: string | null }, fallbackDays = 30): Date {
  if (request.deadline) {
    const d = new Date(request.deadline);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  const d = new Date();
  d.setDate(d.getDate() + fallbackDays);
  d.setHours(23, 59, 59, 999);
  return d;
}

async function getTenant(tenantId: number) {
  const [t] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  return t ?? null;
}

async function attachDetails(request: typeof signoffRequests.$inferSelect): Promise<SignoffRequestWithDetails> {
  const signers = await db.select().from(signoffSigners)
    .where(eq(signoffSigners.requestId, request.id))
    .orderBy(signoffSigners.signerOrder);
  const auditLog = await db.select().from(signoffAuditLog)
    .where(eq(signoffAuditLog.requestId, request.id))
    .orderBy(signoffAuditLog.createdAt);

  let sourceDocument: SignoffRequestWithDetails["sourceDocument"] = null;
  if (request.sourceDocumentId) {
    const [doc] = await db.select({ id: documents.id, title: documents.title, content: documents.content })
      .from(documents).where(eq(documents.id, request.sourceDocumentId)).limit(1);
    sourceDocument = doc ?? null;
  }

  let project: SignoffRequestWithDetails["project"] = null;
  if (request.projectId) {
    const [p] = await db.select({ id: pmProjects.id, name: pmProjects.name })
      .from(pmProjects).where(eq(pmProjects.id, request.projectId)).limit(1);
    project = p ?? null;
  }

  let deliverable: SignoffRequestWithDetails["deliverable"] = null;
  if (request.deliverableId) {
    const [d] = await db.select({ id: pmDeliverables.id, name: pmDeliverables.name })
      .from(pmDeliverables).where(eq(pmDeliverables.id, request.deliverableId)).limit(1);
    deliverable = d ?? null;
  }

  const signatureFields = await listFields(request.id);

  return { ...request, signers, auditLog, signatureFields, sourceDocument, project, deliverable };
}

async function attachDetailsList(rows: typeof signoffRequests.$inferSelect[]): Promise<SignoffRequestWithDetails[]> {
  if (!rows.length) return [];
  const ids = rows.map(r => r.id);
  const allSigners = await db.select().from(signoffSigners)
    .where(inArray(signoffSigners.requestId, ids))
    .orderBy(signoffSigners.signerOrder);
  const allAudit = await db.select().from(signoffAuditLog)
    .where(inArray(signoffAuditLog.requestId, ids))
    .orderBy(signoffAuditLog.createdAt);

  const signerMap = new Map<number, SignoffSigner[]>();
  for (const s of allSigners) {
    if (!signerMap.has(s.requestId)) signerMap.set(s.requestId, []);
    signerMap.get(s.requestId)!.push(s);
  }
  const auditMap = new Map<number, typeof allAudit>();
  for (const a of allAudit) {
    if (!auditMap.has(a.requestId)) auditMap.set(a.requestId, []);
    auditMap.get(a.requestId)!.push(a);
  }

  return rows.map(r => ({
    ...r,
    signers: signerMap.get(r.id) ?? [],
    auditLog: auditMap.get(r.id) ?? [],
    sourceDocument: null,
    project: null,
  }));
}

function computeStatus(signers: SignoffSigner[], current: string): string {
  if (["voided", "expired", "declined", "completed", "draft"].includes(current)) return current;
  const signed = signers.filter(s => s.status === "signed").length;
  const declined = signers.some(s => s.status === "declined");
  if (declined) return "declined";
  if (signed === signers.length && signers.length > 0) return "completed";
  if (signed > 0) return "partially_signed";
  return "pending";
}

function isSequentialTurn(request: SignoffRequestWithDetails, signer: SignoffSigner): boolean {
  if (request.signingOrder === "parallel") return true;
  const ordered = [...request.signers].sort((a, b) => a.signerOrder - b.signerOrder);
  for (const s of ordered) {
    if (s.id === signer.id) return true;
    if (s.status !== "signed") return false;
  }
  return true;
}

function nextPendingSigner(request: SignoffRequestWithDetails): SignoffSigner | undefined {
  const ordered = [...request.signers].sort((a, b) => a.signerOrder - b.signerOrder);
  return ordered.find(s => s.status !== "signed" && s.status !== "declined");
}

async function audit(params: {
  requestId: number;
  event: string;
  actorName: string;
  actorEmail?: string;
  signerId?: number;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(signoffAuditLog).values({
    requestId: params.requestId,
    event: params.event,
    actorName: params.actorName,
    actorEmail: params.actorEmail ?? null,
    signerId: params.signerId ?? null,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
    metadata: params.metadata ?? null,
  });
}

async function notifySigner(request: SignoffRequestWithDetails, signer: SignoffSigner) {
  if (!signer.token || !signer.email) return;
  const tenant = await getTenant(request.tenantId);
  const sent = await sendSignerInviteEmail({ tenant, to: signer.email, signer, request });
  if (sent) {
    await db.update(signoffSigners).set({ notifiedAt: new Date(), status: signer.status === "pending" ? "notified" : signer.status })
      .where(eq(signoffSigners.id, signer.id));
  }
}

export async function ensureSystemTemplates() {
  for (const tpl of SYSTEM_ESIGN_TEMPLATES) {
    const [existing] = await db.select().from(signoffTemplates)
      .where(and(eq(signoffTemplates.tier, "system"), eq(signoffTemplates.title, tpl.title)))
      .limit(1);
    if (existing) continue;
    await db.insert(signoffTemplates).values({
      tenantId: null,
      title: tpl.title,
      description: tpl.description,
      category: tpl.category,
      tier: "system",
      sourceType: "inline_doc",
      contentHtml: tpl.contentHtml,
    });
  }
}

export async function listTemplates(tenantId: number): Promise<SignoffTemplate[]> {
  await ensureSystemTemplates();
  return db.select().from(signoffTemplates)
    .where(or(eq(signoffTemplates.tier, "system"), eq(signoffTemplates.tenantId, tenantId)))
    .orderBy(desc(signoffTemplates.createdAt));
}

export async function listRequests(tenantId: number, filters?: {
  status?: string;
  search?: string;
  sort?: string;
  workspaceId?: number | null;
  testCycleId?: number;
}): Promise<SignoffRequestWithDetails[]> {
  let rows = await db.select().from(signoffRequests)
    .where(eq(signoffRequests.tenantId, tenantId))
    .orderBy(desc(signoffRequests.createdAt));

  if (filters?.workspaceId != null) {
    rows = rows.filter(r => r.workspaceId === filters.workspaceId);
  }
  if (filters?.testCycleId != null) {
    rows = rows.filter(r => r.testCycleId === filters.testCycleId);
  }

  if (filters?.status && filters.status !== "all") {
    if (filters.status === "awaiting") {
      rows = rows.filter(r => r.status === "pending" || r.status === "partially_signed");
    } else {
      rows = rows.filter(r => r.status === filters.status);
    }
  }
  if (filters?.search?.trim()) {
    const q = filters.search.toLowerCase();
    rows = rows.filter(r => r.title.toLowerCase().includes(q));
  }
  if (filters?.sort === "title") {
    rows.sort((a, b) => a.title.localeCompare(b.title));
  } else if (filters?.sort === "expiry") {
    rows.sort((a, b) => (a.deadline || "").localeCompare(b.deadline || ""));
  } else if (filters?.sort === "status") {
    rows.sort((a, b) => a.status.localeCompare(b.status));
  }

  return attachDetailsList(rows);
}

export async function getRequest(id: number): Promise<SignoffRequestWithDetails | undefined> {
  const [row] = await db.select().from(signoffRequests).where(eq(signoffRequests.id, id)).limit(1);
  if (!row) return undefined;
  return attachDetails(row);
}

export async function getSignerByToken(token: string): Promise<SignoffSigner | undefined> {
  const [row] = await db.select().from(signoffSigners).where(eq(signoffSigners.token, token)).limit(1);
  return row;
}

export async function createRequest(params: {
  tenantId: number;
  workspaceId?: number | null;
  userId?: string;
  userName: string;
  userEmail?: string;
  body: Record<string, unknown>;
  ip?: string;
}) {
  const { signers: signersInput, signatureFields: fieldsInput, ...requestData } = params.body as Record<string, unknown> & {
    signers?: Array<Record<string, unknown>>;
    signatureFields?: FieldInput[];
  };

  let fileName = (requestData.fileName as string) ?? null;
  let fileType = (requestData.fileType as string) ?? null;
  let fileData = (requestData.fileData as string) ?? null;
  let contentHtml = (requestData.contentHtml as string) ?? null;
  const sourceDocumentId = (requestData.sourceDocumentId as number) ?? null;

  if (sourceDocumentId && !fileData) {
    const [doc] = await db.select({
      id: documents.id,
      title: documents.title,
      content: documents.content,
    }).from(documents).where(eq(documents.id, sourceDocumentId)).limit(1);
    if (doc) {
      contentHtml = contentHtml || doc.content || `<h1>${doc.title}</h1>`;
      fileName = fileName || `${doc.title}.html`;
      fileType = fileType || "html";
      requestData.sourceType = "jiganto_doc";
    }
  }

  const signatureLevel = (requestData.signatureLevel as string) === "ades" ? "ades" : "ses";
  if (signatureLevel === "ades" && !isAdesAvailable()) {
    throw new Error("Advanced Electronic Signature (AdES) requires QTSP_PROVIDER configuration");
  }

  if (fileType === "docx" && fileData) {
    try {
      const pdfB64 = await convertDocxBufferToPdfBase64(
        Buffer.from(fileData, "base64"),
        (requestData.title as string) || fileName || "Document",
      );
      fileData = pdfB64;
      fileType = "pdf";
      fileName = (fileName || "document").replace(/\.docx$/i, ".pdf");
    } catch {
      /* keep original docx if conversion fails */
    }
  }

  const [created] = await db.insert(signoffRequests).values({
    tenantId: params.tenantId,
    workspaceId: params.workspaceId ?? null,
    title: (requestData.title as string) || "Untitled",
    description: (requestData.description as string) ?? null,
    sourceType: (requestData.sourceType as string) || "upload",
    sourceDocumentId: sourceDocumentId,
    templateId: (requestData.templateId as number) ?? null,
    projectId: (requestData.projectId as number) ?? null,
    deliverableId: (requestData.deliverableId as number) ?? null,
    crmContractId: (requestData.crmContractId as number) ?? null,
    timesheetPeriodId: (requestData.timesheetPeriodId as number) ?? null,
    testCycleId: (requestData.testCycleId as number) ?? null,
    fileName,
    fileType,
    fileData,
    contentHtml: contentHtml ?? null,
    message: (requestData.message as string) ?? null,
    signingOrder: (requestData.signingOrder as string) || "sequential",
    deadline: (requestData.deadline as string) || defaultDeadline(),
    allowDecline: requestData.allowDecline !== false,
    sendCopyOnCompletion: requestData.sendCopyOnCompletion !== false,
    requireAcknowledgement: !!requestData.requireAcknowledgement,
    acknowledgementText: (requestData.acknowledgementText as string) ?? null,
    requireReadToBottom: !!requestData.requireReadToBottom,
    requireOtpVerification: !!requestData.requireOtpVerification,
    requireEidasConsent: !!requestData.requireEidasConsent,
    eidasConsentText: (requestData.eidasConsentText as string) ?? null,
    signatureLevel,
    status: "draft",
    createdBy: params.userId ?? null,
    createdByName: params.userName,
  }).returning();

  if (Array.isArray(signersInput)) {
    const tenantUsers = await storage.getTenantUsers(params.tenantId);
    const userIdByEmail = new Map(
      tenantUsers.filter(u => u.email).map(u => [u.email!.toLowerCase(), u.id]),
    );
    for (let i = 0; i < signersInput.length; i++) {
      const s = signersInput[i];
      const email = (s.email as string).toLowerCase();
      await db.insert(signoffSigners).values({
        requestId: created.id,
        signerOrder: (s.signerOrder as number) ?? i + 1,
        name: s.name as string,
        email: s.email as string,
        roleTitle: (s.roleTitle as string) ?? null,
        isInternal: !!(s.isInternal),
        userId: (s.userId as string) ?? userIdByEmail.get(email) ?? null,
        signingDeadline: (s.signingDeadline as string) ?? null,
        privateMessage: (s.privateMessage as string) ?? null,
        status: "pending",
      });
    }
  }

  if (Array.isArray(fieldsInput) && fieldsInput.length) {
    await replaceFields(created.id, fieldsInput);
  }

  await audit({
    requestId: created.id,
    event: "created",
    actorName: params.userName,
    actorEmail: params.userEmail,
    ipAddress: params.ip,
    metadata: { title: created.title },
  });

  return getRequest(created.id);
}

export async function updateRequest(id: number, updates: Record<string, unknown>) {
  const { signers: _s, signatureFields: _f, ...data } = updates;
  if (data.signatureLevel === "ades" && !isAdesAvailable()) {
    throw new Error("Advanced Electronic Signature (AdES) requires QTSP_PROVIDER configuration");
  }
  await db.update(signoffRequests).set({ ...data, updatedAt: new Date() }).where(eq(signoffRequests.id, id));
  return getRequest(id);
}

export async function deleteRequest(id: number) {
  await db.delete(signoffRequests).where(eq(signoffRequests.id, id));
}

export async function duplicateRequest(id: number, userName: string, userEmail?: string) {
  const orig = await getRequest(id);
  if (!orig) throw new Error("Not found");
  const copy = await createRequest({
    tenantId: orig.tenantId,
    workspaceId: orig.workspaceId,
    userName,
    userEmail,
    body: {
      title: `${orig.title} (Copy)`,
      description: orig.description,
      sourceType: orig.sourceType,
      sourceDocumentId: orig.sourceDocumentId,
      projectId: orig.projectId,
      deliverableId: orig.deliverableId,
      crmContractId: orig.crmContractId,
      timesheetPeriodId: orig.timesheetPeriodId,
      testCycleId: orig.testCycleId,
      fileName: orig.fileName,
      fileType: orig.fileType,
      fileData: orig.fileData,
      contentHtml: orig.contentHtml,
      message: orig.message,
      signingOrder: orig.signingOrder,
      deadline: defaultDeadline(),
      allowDecline: orig.allowDecline,
      sendCopyOnCompletion: orig.sendCopyOnCompletion,
      requireAcknowledgement: orig.requireAcknowledgement,
      acknowledgementText: orig.acknowledgementText,
      requireReadToBottom: orig.requireReadToBottom,
      requireOtpVerification: orig.requireOtpVerification,
      requireEidasConsent: orig.requireEidasConsent,
      eidasConsentText: orig.eidasConsentText,
      signatureLevel: orig.signatureLevel,
      signers: orig.signers.map(s => ({
        name: s.name, email: s.email, roleTitle: s.roleTitle,
        isInternal: s.isInternal, userId: s.userId, signingDeadline: s.signingDeadline,
      })),
      signatureFields: (orig.signatureFields ?? []).map(f => ({
        signerEmail: f.signerEmail,
        fieldType: f.fieldType,
        pageNumber: f.pageNumber,
        xPercent: f.xPercent,
        yPercent: f.yPercent,
        widthPercent: f.widthPercent,
        heightPercent: f.heightPercent,
        isRequired: f.isRequired,
        label: f.label ?? undefined,
      })),
    },
  });
  return copy;
}

export async function voidRequest(id: number, reason: string | null, actor: { name: string; email?: string; ip?: string }) {
  const req = await getRequest(id);
  if (!req) throw new Error("Not found");
  await db.update(signoffRequests).set({
    status: "voided", voidReason: reason, voidedAt: new Date(), updatedAt: new Date(),
  }).where(eq(signoffRequests.id, id));
  await audit({
    requestId: id, event: "voided", actorName: actor.name, actorEmail: actor.email,
    ipAddress: actor.ip, metadata: { reason },
  });
  return getRequest(id);
}

export async function saveAsTemplate(id: number, tenantId: number, userId?: string) {
  const req = await getRequest(id);
  if (!req) throw new Error("Not found");
  const [tpl] = await db.insert(signoffTemplates).values({
    tenantId,
    title: req.title,
    description: req.description,
    category: "Custom",
    tier: "customer",
    sourceType: req.sourceType === "upload" ? "upload" : "inline_doc",
    contentHtml: req.contentHtml,
    fileName: req.fileName,
    fileType: req.fileType,
    fileData: req.fileData,
    createdBy: userId ?? null,
  }).returning();
  return tpl;
}

export async function sendRequest(id: number, actor: { name: string; email?: string; ip?: string }) {
  const request = await getRequest(id);
  if (!request) throw new Error("Not found");
  if (!request.signers.length) throw new Error("Add at least one signer");

  const expiry = deadlineDate(request);
  const toNotify: SignoffSigner[] = [];

  if (request.signingOrder === "parallel") {
    for (const signer of request.signers) {
      const token = genToken();
      await db.update(signoffSigners).set({
        token, tokenExpiresAt: expiry, status: "pending",
      }).where(eq(signoffSigners.id, signer.id));
      toNotify.push({ ...signer, token, tokenExpiresAt: expiry });
    }
  } else {
    const first = nextPendingSigner(request);
    if (first) {
      const token = genToken();
      await db.update(signoffSigners).set({
        token, tokenExpiresAt: expiry, status: "pending",
      }).where(eq(signoffSigners.id, first.id));
      toNotify.push({ ...first, token, tokenExpiresAt: expiry });
    }
  }

  await db.update(signoffRequests).set({
    status: "pending", sentAt: new Date(), updatedAt: new Date(),
    deadline: request.deadline || defaultDeadline(),
  }).where(eq(signoffRequests.id, id));

  await audit({
    requestId: id, event: "sent", actorName: actor.name, actorEmail: actor.email,
    ipAddress: actor.ip, metadata: { signerCount: request.signers.length, signingOrder: request.signingOrder },
  });

  const full = (await getRequest(id))!;
  for (const signer of toNotify) {
    const s = full.signers.find(x => x.id === signer.id)!;
    await notifySigner(full, s);
  }
  return full;
}

export async function addSigner(params: {
  requestId: number;
  name: string;
  email: string;
  roleTitle?: string;
  signerOrder?: number;
  isInternal?: boolean;
  userId?: string;
  privateMessage?: string;
  signingDeadline?: string;
  addedBy?: string;
  addedByName: string;
  addedByEmail?: string;
  ip?: string;
}) {
  const request = await getRequest(params.requestId);
  if (!request) throw new Error("Not found");
  if (!["draft", "pending", "partially_signed"].includes(request.status)) {
    throw new Error("Cannot add signers to this document");
  }

  const order = params.signerOrder ?? request.signers.length + 1;
  const expiry = deadlineDate(request);
  const token = request.status !== "draft" ? genToken() : undefined;

  let resolvedUserId = params.userId ?? null;
  if (!resolvedUserId) {
    const tenantUsers = await storage.getTenantUsers(request.tenantId);
    resolvedUserId = tenantUsers.find(u => u.email?.toLowerCase() === params.email.toLowerCase())?.id ?? null;
  }

  const [signer] = await db.insert(signoffSigners).values({
    requestId: params.requestId,
    signerOrder: order,
    name: params.name,
    email: params.email,
    roleTitle: params.roleTitle ?? null,
    isInternal: !!params.isInternal,
    userId: resolvedUserId,
    privateMessage: params.privateMessage ?? null,
    signingDeadline: params.signingDeadline ?? null,
    addedBy: params.addedBy ?? null,
    token: token ?? null,
    tokenExpiresAt: token ? expiry : null,
    status: "pending",
  }).returning();

  await audit({
    requestId: params.requestId,
    event: "signer_added",
    actorName: params.addedByName,
    actorEmail: params.addedByEmail,
    signerId: signer.id,
    ipAddress: params.ip,
    metadata: { name: params.name, email: params.email, order },
  });

  const updated = (await getRequest(params.requestId))!;

  if (request.status !== "draft" && token) {
    const shouldNotify = request.signingOrder === "parallel" || isSequentialTurn(updated, signer);
    if (shouldNotify) await notifySigner(updated, signer);
  }

  return updated;
}

export async function removeSigner(signerId: number, actor: { name: string; email?: string; ip?: string }) {
  const [signer] = await db.select().from(signoffSigners).where(eq(signoffSigners.id, signerId)).limit(1);
  if (!signer) throw new Error("Not found");
  const request = await getRequest(signer.requestId);
  if (!request) throw new Error("Not found");
  if (signer.status === "signed" || signer.status === "declined") {
    throw new Error("Cannot remove a signer who has already signed or declined");
  }
  if (request.status === "completed" || request.status === "voided" || request.status === "expired") {
    throw new Error("Cannot remove signers from a completed, voided, or expired request");
  }
  await db.delete(signoffSigners).where(eq(signoffSigners.id, signerId));
  await audit({
    requestId: signer.requestId, event: "signer_removed", actorName: actor.name,
    actorEmail: actor.email, ipAddress: actor.ip,
    metadata: { name: signer.name, email: signer.email },
  });
}

export async function remindSigners(id: number, actor: { name: string; email?: string; ip?: string }, signerId?: number) {
  const request = await getRequest(id);
  if (!request) throw new Error("Not found");
  const tenant = await getTenant(request.tenantId);
  const pending = request.signers.filter(s =>
    signerId ? s.id === signerId : (s.status === "pending" || s.status === "notified" || s.status === "viewed"),
  );

  for (const signer of pending) {
    if (!signer.token) continue;
    await sendReminderEmail({ tenant, to: signer.email, signer, request });
  }

  await audit({
    requestId: id, event: "reminder_sent", actorName: actor.name, actorEmail: actor.email,
    ipAddress: actor.ip, metadata: { reminderSentTo: pending.map(s => s.email) },
  });
  return { success: true, reminderSentTo: pending.length };
}

export async function getPortalData(token: string) {
  const signer = await getSignerByToken(token);
  if (!signer) return { error: "Invalid or expired link", status: 404 as const };
  if (signer.tokenExpiresAt && new Date() > signer.tokenExpiresAt) {
    return { error: "This signing link has expired", status: 410 as const };
  }
  if (signer.status === "signed") return { error: "already_signed", status: 409 as const, signer };
  if (signer.status === "declined") return { error: "already_declined", status: 409 as const, signer };

  const request = await getRequest(signer.requestId);
  if (!request) return { error: "Document not found", status: 404 as const };
  if (request.status === "voided" || request.status === "cancelled") {
    return { error: "This sign-off request has been voided", status: 410 as const };
  }
  if (request.status === "expired") return { error: "This signing request has expired", status: 410 as const };

  if (!isSequentialTurn(request, signer)) {
    const { fileData, signedPdfData, ...safeRequest } = request;
    return {
      error: "It is not yet your turn to sign. You will be notified when the previous signers have completed.",
      status: 403 as const,
      request: safeRequest,
      signer,
    };
  }

  const { fileData, signedPdfData, ...safeRequest } = request;
  return { request: safeRequest, signer, status: 200 as const };
}

export async function markViewed(token: string, ip?: string, userAgent?: string) {
  const signer = await getSignerByToken(token);
  if (!signer || signer.viewedAt) return;
  await db.update(signoffSigners).set({
    viewedAt: new Date(), status: "viewed", ipAddress: ip ?? null, userAgent: userAgent ?? null,
  }).where(eq(signoffSigners.id, signer.id));
  await audit({
    requestId: signer.requestId, event: "viewed", actorName: signer.name,
    actorEmail: signer.email, signerId: signer.id, ipAddress: ip, userAgent,
  });
}

export async function signDocument(token: string, params: {
  signatureName: string;
  signatureMethod?: string;
  signatureData?: string;
  eidasConsentGiven?: boolean;
  fieldValues?: Record<number, string>;
  ip?: string;
  userAgent?: string;
}) {
  const portal = await getPortalData(token);
  if (portal.status !== 200) throw new Error(portal.error);

  const signer = portal.signer!;
  const request = portal.request!;

  if (request.requireOtpVerification && !signer.otpVerifiedAt) {
    throw new Error("Please verify your email with the one-time code before signing");
  }
  if (request.requireEidasConsent && !params.eidasConsentGiven) {
    throw new Error("You must accept the eIDAS consent before signing");
  }

  const myFields = (request.signatureFields ?? []).filter(
    f => f.signerEmail.toLowerCase() === signer.email.toLowerCase(),
  );
  if (myFields.length) {
    await completeFieldsForSigner(signer.requestId, signer.email, params.fieldValues ?? {});
  }

  await db.update(signoffSigners).set({
    status: "signed",
    signedAt: new Date(),
    signatureName: params.signatureName.trim(),
    signatureMethod: params.signatureMethod || "type",
    signatureData: params.signatureData ?? null,
    eidasConsentAt: request.requireEidasConsent ? new Date() : signer.eidasConsentAt,
    ipAddress: params.ip ?? null,
    userAgent: params.userAgent ?? null,
    tokenUsedAt: new Date(),
  }).where(eq(signoffSigners.id, signer.id));

  await audit({
    requestId: signer.requestId, event: "signed", actorName: signer.name,
    actorEmail: signer.email, signerId: signer.id, ipAddress: params.ip, userAgent: params.userAgent,
    metadata: { signatureName: params.signatureName, signatureMethod: params.signatureMethod || "type" },
  });

  let updated = (await getRequest(signer.requestId))!;
  const allSigned = updated.signers.every(s => s.id === signer.id ? true : s.status === "signed");
  const newStatus = computeStatus(updated.signers, allSigned ? "completed" : "partially_signed");

  await db.update(signoffRequests).set({
    status: newStatus,
    completedAt: allSigned ? new Date() : null,
    updatedAt: new Date(),
  }).where(eq(signoffRequests.id, signer.requestId));

  updated = (await getRequest(signer.requestId))!;

  if (allSigned) {
    const pdf = await generateSignedPdf(updated);
    const b64 = pdf.toString("base64");
    await db.update(signoffRequests).set({ signedPdfData: b64 }).where(eq(signoffRequests.id, signer.requestId));
    updated = (await getRequest(signer.requestId))!;

    await audit({
      requestId: signer.requestId, event: "completed", actorName: "System",
      metadata: { message: "All signers have signed. Document fully executed." },
    });

    if (updated.signatureLevel === "ades") {
      try {
        const hash = crypto.createHash("sha256").update(b64).digest("hex");
        const ts = await applyQtspTimestamp({
          requestId: updated.id,
          signerId: signer.id,
          signatureLevel: updated.signatureLevel,
          documentHash: hash,
        });
        if (ts.applied) {
          await audit({
            requestId: updated.id, event: "qtsp_timestamp", actorName: "System",
            metadata: { provider: ts.provider, timestampToken: ts.timestampToken },
          });
        }
      } catch (e) {
        console.warn("[eSign] QTSP timestamp failed:", (e as Error).message);
      }
    }

    if (updated.sendCopyOnCompletion) {
      const tenant = await getTenant(updated.tenantId);
      const base = process.env.APP_URL?.trim() || "http://localhost:5000";
      const downloadUrl = `${base.replace(/\/$/, "")}/api/signoff/${updated.id}/signed-pdf`;
      for (const s of updated.signers) {
        await sendCompletionEmail({ tenant, to: s.email, request: updated, downloadUrl });
      }
      if (updated.createdBy) {
        const [creator] = await db.select({ email: users.email }).from(users).where(eq(users.id, updated.createdBy)).limit(1);
        if (creator?.email) await sendCompletionEmail({ tenant, to: creator.email, request: updated, downloadUrl });
      }
      await audit({ requestId: updated.id, event: "pdf_sent", actorName: "System", metadata: { recipients: updated.signers.map(s => s.email) } });
    }

    if (updated.deliverableId) {
      await db.update(pmDeliverables).set({
        status: "Completed", progress: 100, updatedAt: new Date(),
      }).where(eq(pmDeliverables.id, updated.deliverableId));
    }

    if (updated.timesheetPeriodId) {
      await logTimesheetAudit(
        updated.tenantId,
        updated.timesheetPeriodId,
        "esign_completed",
        updated.createdBy ?? null,
        `Timesheet signed via e-Sign: ${updated.title}`,
      );
    }
  } else if (updated.signingOrder === "sequential") {
    const next = nextPendingSigner(updated);
    if (next && !next.token) {
      const expiry = deadlineDate(updated);
      const newToken = genToken();
      await db.update(signoffSigners).set({ token: newToken, tokenExpiresAt: expiry })
        .where(eq(signoffSigners.id, next.id));
      updated = (await getRequest(signer.requestId))!;
      const nextSigner = updated.signers.find(s => s.id === next.id)!;
      await notifySigner(updated, nextSigner);
    }
    const pdf = await generateSignedPdf(updated);
    await db.update(signoffRequests).set({ signedPdfData: pdf.toString("base64") }).where(eq(signoffRequests.id, signer.requestId));
  } else {
    const pdf = await generateSignedPdf(updated);
    await db.update(signoffRequests).set({ signedPdfData: pdf.toString("base64") }).where(eq(signoffRequests.id, signer.requestId));
  }

  return { success: true, signedAt: new Date().toISOString() };
}

export async function declineDocument(token: string, reason: string, ip?: string, userAgent?: string) {
  const portal = await getPortalData(token);
  if (portal.status !== 200) throw new Error(portal.error);
  const request = portal.request!;
  if (!request.allowDecline) throw new Error("Declining is not allowed for this document");

  const signer = portal.signer!;
  await db.update(signoffSigners).set({
    status: "declined", declinedAt: new Date(), declineReason: reason.trim(),
    ipAddress: ip ?? null, userAgent: userAgent ?? null,
  }).where(eq(signoffSigners.id, signer.id));

  await db.update(signoffRequests).set({ status: "declined", updatedAt: new Date() }).where(eq(signoffRequests.id, signer.requestId));
  await audit({
    requestId: signer.requestId, event: "declined", actorName: signer.name,
    actorEmail: signer.email, signerId: signer.id, ipAddress: ip, userAgent,
    metadata: { reason: reason.trim() },
  });

  const updated = (await getRequest(signer.requestId))!;
  const tenant = await getTenant(updated.tenantId);
  if (updated.createdBy) {
    const [creator] = await db.select({ email: users.email }).from(users).where(eq(users.id, updated.createdBy)).limit(1);
    if (creator?.email) await sendDeclineNotificationEmail({ tenant, to: creator.email, request: updated, signer: { ...signer, declineReason: reason } });
  }
  return { success: true };
}

export { sendSignerOtp, verifySignerOtp, listFields, replaceFields, isAdesAvailable };

export async function listJigantoDocs(tenantId: number) {
  return db.select({ id: documents.id, title: documents.title, type: documents.type, status: documents.status })
    .from(documents).where(eq(documents.tenantId, tenantId));
}

export async function listProjects(tenantId: number) {
  return db.select({ id: pmProjects.id, name: pmProjects.name })
    .from(pmProjects).where(eq(pmProjects.tenantId, tenantId));
}

export async function listUsers(tenantId: number) {
  return storage.getTenantUsers(tenantId);
}

export async function getRequestsForSignerEmail(email: string) {
  const pendingSigners = await db.select().from(signoffSigners)
    .where(and(eq(signoffSigners.email, email), inArray(signoffSigners.status, ["pending", "notified", "viewed"])));
  const results = [];
  for (const signer of pendingSigners) {
    const req = await getRequest(signer.requestId);
    if (req && (req.status === "pending" || req.status === "partially_signed")) {
      results.push({
        ...req,
        mySigner: signer,
        mySignerToken: signer.token,
        mySignerStatus: signer.status,
      });
    }
  }
  return results;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function buildTimesheetSignoffHtml(params: {
  resourceName: string;
  weekStart: Date;
  weekEnd: Date;
  totalHours: string;
  entries: Awaited<ReturnType<typeof listTimesheetEntries>>;
}): string {
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const byProject = new Map<string, number[]>();
  for (const e of params.entries) {
    const key = e.projectName || "General";
    if (!byProject.has(key)) byProject.set(key, Array(7).fill(0));
    const idx = (e.dayOfWeek ?? 1) - 1;
    if (idx >= 0 && idx < 7) {
      byProject.get(key)![idx] += parseFloat(String(e.hours ?? "0")) || 0;
    }
  }
  const dayTotals = Array(7).fill(0);
  const rows = [...byProject.entries()].map(([project, days]) => {
    days.forEach((h, i) => { dayTotals[i] += h; });
    const rowTotal = days.reduce((s, h) => s + h, 0);
    return `<tr><td><strong>${project}</strong></td>${days.map(h => `<td style="text-align:center">${h ? h.toFixed(1) : "—"}</td>`).join("")}<td style="text-align:right;font-weight:600">${rowTotal.toFixed(1)}</td></tr>`;
  }).join("");
  const grandTotal = dayTotals.reduce((s, h) => s + h, 0);
  return `<h1>Timesheet Sign-off</h1>
<p><strong>Resource:</strong> ${params.resourceName}<br/>
<strong>Week:</strong> ${fmt(params.weekStart)} – ${fmt(params.weekEnd)}<br/>
<strong>Total hours:</strong> ${params.totalHours || grandTotal.toFixed(1)}</p>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px">
<thead><tr style="background:#f3f4f6"><th>Project</th>${DAY_LABELS.map(d => `<th style="text-align:center">${d}</th>`).join("")}<th style="text-align:right">Total</th></tr></thead>
<tbody>${rows || `<tr><td colspan="9" style="text-align:center;color:#6b7280">No entries recorded</td></tr>`}
<tr style="background:#f9fafb;font-weight:700"><td>Day totals</td>${dayTotals.map(h => `<td style="text-align:center">${h ? h.toFixed(1) : "—"}</td>`).join("")}<td style="text-align:right">${grandTotal.toFixed(1)}</td></tr>
</tbody></table>
<p style="color:#6b7280;font-size:12px;margin-top:16px">By signing, you confirm that the hours listed above are accurate and approved for billing.</p>`;
}

export async function createTimesheetSignoffRequest(params: {
  tenantId: number;
  periodId: number;
  userId: string;
  userName: string;
  userEmail?: string;
  signerName: string;
  signerEmail: string;
  message?: string;
  ip?: string;
}) {
  const period = await getTimesheetPeriod(params.tenantId, params.periodId);
  if (!period) throw new Error("Timesheet not found");

  const [existing] = await db.select({ id: signoffRequests.id }).from(signoffRequests)
    .where(and(
      eq(signoffRequests.tenantId, params.tenantId),
      eq(signoffRequests.timesheetPeriodId, params.periodId),
      inArray(signoffRequests.status, ["draft", "pending", "partially_signed", "completed"]),
    )).limit(1);
  if (existing) throw new Error("An e-sign request already exists for this timesheet period");

  const resource = await storage.getResource(period.resourceId);
  const entries = await listTimesheetEntries(params.periodId);
  const resourceName = [resource?.firstName, resource?.lastName].filter(Boolean).join(" ") || "Resource";
  const weekStart = new Date(period.weekStartDate);
  const weekEnd = new Date(period.weekEndDate);
  const title = `Timesheet approval — ${resourceName} (${weekStart.toLocaleDateString("en-GB")})`;

  const created = await createRequest({
    tenantId: params.tenantId,
    userId: params.userId,
    userName: params.userName,
    userEmail: params.userEmail,
    ip: params.ip,
    body: {
      title,
      sourceType: "timesheet_period",
      timesheetPeriodId: params.periodId,
      projectId: entries.find(e => e.projectId)?.projectId ?? null,
      contentHtml: buildTimesheetSignoffHtml({
        resourceName,
        weekStart,
        weekEnd,
        totalHours: String(period.totalHours ?? "0"),
        entries,
      }),
      message: params.message ?? `Please review and sign off on the timesheet for ${resourceName}.`,
      signingOrder: "parallel",
      deadline: defaultDeadline(),
      signers: [{ name: params.signerName, email: params.signerEmail, signerOrder: 1, isInternal: true }],
    },
  });
  if (!created) throw new Error("Failed to create sign-off request");

  const sent = await sendRequest(created.id, { name: params.userName, email: params.userEmail, ip: params.ip });
  const token = sent?.signers.find(s => s.signerOrder === 1)?.token;
  return { request: sent, signUrl: token ? `/sign/${token}` : undefined };
}

export async function runSignoffJobs(): Promise<{ expired: number; reminders: number }> {
  let expired = 0;
  let reminders = 0;
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const active = await db.select().from(signoffRequests)
    .where(inArray(signoffRequests.status, ["pending", "partially_signed"]));

  for (const row of active) {
    const req = await attachDetails(row);
    const expiry = deadlineDate(req);

    if (expiry < now) {
      await db.update(signoffRequests).set({ status: "expired", expiredAt: now, updatedAt: now })
        .where(eq(signoffRequests.id, req.id));
      await audit({ requestId: req.id, event: "expired", actorName: "System", metadata: { remainingSigners: req.signers.filter(s => s.status !== "signed").map(s => s.name) } });
      const tenant = await getTenant(req.tenantId);
      if (req.createdBy) {
        const [creator] = await db.select({ email: users.email }).from(users).where(eq(users.id, req.createdBy)).limit(1);
        if (creator?.email) await sendExpiredNotificationEmail({ tenant, to: creator.email, request: req });
      }
      expired++;
      continue;
    }

    if (expiry <= in48h && !req.reminderSentAt) {
      await remindSigners(req.id, { name: "System" });
      await db.update(signoffRequests).set({ reminderSentAt: now }).where(eq(signoffRequests.id, req.id));
      reminders++;
    }
  }
  return { expired, reminders };
}
