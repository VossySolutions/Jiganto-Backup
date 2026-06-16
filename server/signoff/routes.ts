import type { Express, Request } from "express";
import { isRequestAuthenticated } from "../auth/supabaseAuth";
import { requireApiTenantId } from "../lib/api-tenant-id";
import { resolveListClientId } from "../lib/list-client-id";
import * as signoffService from "./service";

function getUser(req: Request) {
  return req.user as { id?: string; claims?: { sub?: string }; firstName?: string; lastName?: string; email?: string };
}

function userId(req: Request) {
  const u = getUser(req);
  return u.id ?? u.claims?.sub ?? "";
}

function userName(req: Request) {
  const u = getUser(req);
  return u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : (u.email ?? "Unknown");
}

function parseRequestId(raw: string): number | null {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function registerSignoffRoutes(app: Express) {
  void signoffService.ensureSystemTemplates().catch(console.warn);
  // ── Public signing portal (before auth routes) ──────────────────────────────
  app.get("/api/signoff/sign/:token", async (req, res) => {
    try {
      const result = await signoffService.getPortalData(req.params.token);
      if (result.status !== 200) {
        if (result.status === 409) return res.status(409).json({ message: result.error, signer: result.signer });
        return res.status(result.status).json({
          message: result.error,
          request: result.request,
          signer: result.signer,
        });
      }
      res.json({ request: result.request, signer: result.signer });
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/signoff/sign/:token/view", async (req, res) => {
    try {
      await signoffService.markViewed(req.params.token, req.ip, req.headers["user-agent"] as string);
      res.json({ success: true });
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/signoff/sign/:token/sign", async (req, res) => {
    try {
      const { signatureName, signatureMethod, signatureData, eidasConsentGiven, fieldValues } = req.body;
      if (!signatureName?.trim() || signatureName.trim().length < 2) {
        return res.status(400).json({ message: "Please enter your full name" });
      }
      const result = await signoffService.signDocument(req.params.token, {
        signatureName: signatureName.trim(),
        signatureMethod,
        signatureData,
        eidasConsentGiven: !!eidasConsentGiven,
        fieldValues: fieldValues ?? {},
        ip: req.ip,
        userAgent: req.headers["user-agent"] as string,
      });
      res.json(result);
    } catch (e: unknown) {
      const msg = (e as Error).message;
      if (msg.includes("turn")) return res.status(403).json({ message: msg });
      res.status(400).json({ message: msg });
    }
  });

  app.post("/api/signoff/sign/:token/decline", async (req, res) => {
    try {
      const { reason } = req.body;
      if (!reason?.trim() || reason.trim().length < 3) {
        return res.status(400).json({ message: "Please provide a reason for declining" });
      }
      const result = await signoffService.declineDocument(req.params.token, reason.trim(), req.ip, req.headers["user-agent"] as string);
      res.json(result);
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.post("/api/signoff/sign/:token/otp/send", async (req, res) => {
    try {
      const portal = await signoffService.getPortalData(req.params.token);
      if (portal.status !== 200) return res.status(portal.status).json({ message: portal.error });
      const request = portal.request!;
      if (!request.requireOtpVerification) return res.status(400).json({ message: "OTP not required" });
      const result = await signoffService.sendSignerOtp(portal.signer!.id, request.tenantId, request.title);
      res.json(result);
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.post("/api/signoff/sign/:token/otp/verify", async (req, res) => {
    try {
      const { code } = req.body;
      if (!code?.trim()) return res.status(400).json({ message: "Code required" });
      const portal = await signoffService.getPortalData(req.params.token);
      if (portal.status !== 200) return res.status(portal.status).json({ message: portal.error });
      const ok = await signoffService.verifySignerOtp(portal.signer!.id, code.trim());
      if (!ok) return res.status(400).json({ message: "Invalid or expired code" });
      res.json({ verified: true });
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  });

  // ── Authenticated routes ────────────────────────────────────────────────────
  app.get("/api/signoff", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tenantId = requireApiTenantId(req, res);
    if (tenantId == null) return;
    try {
      const { status, search, sort, testCycleId } = req.query;
      const workspaceId = resolveListClientId(req);
      const requests = await signoffService.listRequests(tenantId, {
        status: status as string,
        search: search as string,
        sort: sort as string,
        workspaceId,
        testCycleId: testCycleId ? Number(testCycleId) : undefined,
      });
      res.json(requests);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/esign/qtsp-status", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    res.json({ adesAvailable: signoffService.isAdesAvailable() });
  });

  app.get("/api/signoff/templates", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tenantId = requireApiTenantId(req, res);
    if (tenantId == null) return;
    try {
      res.json(await signoffService.listTemplates(tenantId));
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/signoff/jiganto-docs", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tenantId = requireApiTenantId(req, res);
    if (tenantId == null) return;
    try {
      res.json(await signoffService.listJigantoDocs(tenantId));
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/signoff/projects", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tenantId = requireApiTenantId(req, res);
    if (tenantId == null) return;
    try {
      res.json(await signoffService.listProjects(tenantId));
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/signoff/users", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tenantId = requireApiTenantId(req, res);
    if (tenantId == null) return;
    try {
      res.json(await signoffService.listUsers(tenantId));
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/signoff/my-pending", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const u = getUser(req);
      const email = u.email;
      if (!email) return res.json([]);
      res.json(await signoffService.getRequestsForSignerEmail(email));
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/signoff/:id/signed-pdf", async (req, res) => {
    try {
      const request = await signoffService.getRequest(Number(req.params.id));
      if (!request) return res.status(404).json({ message: "Not found" });
      const token = req.query.token as string | undefined;
      if (!isRequestAuthenticated(req)) {
        if (!token) return res.status(401).json({ message: "Unauthorized" });
        const signer = await signoffService.getSignerByToken(token);
        if (!signer || signer.requestId !== request.id) return res.status(403).json({ message: "Forbidden" });
      }
      if (!request.signedPdfData) return res.status(404).json({ message: "Signed PDF not yet available" });
      const buf = Buffer.from(request.signedPdfData, "base64");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${request.title.replace(/[^a-z0-9._-]/gi, "_")}-signed.pdf"`);
      res.send(buf);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/signoff/:id/audit-pdf", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const request = await signoffService.getRequest(Number(req.params.id));
      if (!request) return res.status(404).json({ message: "Not found" });
      const { generateSignedPdf } = await import("./pdf");
      const pdf = await generateSignedPdf(request);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${request.title.replace(/[^a-z0-9._-]/gi, "_")}-audit.pdf"`);
      res.send(pdf);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/signoff/:id/file", async (req, res) => {
    try {
      const request = await signoffService.getRequest(Number(req.params.id));
      if (!request) return res.status(404).json({ message: "Not found" });
      const token = req.query.token as string | undefined;
      if (!isRequestAuthenticated(req)) {
        if (!token) return res.status(401).json({ message: "Unauthorized" });
        const signer = await signoffService.getSignerByToken(token);
        if (!signer || signer.requestId !== request.id) return res.status(403).json({ message: "Forbidden" });
      }
      if (request.fileData) {
        const buf = Buffer.from(request.fileData, "base64");
        const mimeMap: Record<string, string> = {
          pdf: "application/pdf",
          docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
        };
        res.setHeader("Content-Type", mimeMap[request.fileType || ""] || "application/octet-stream");
        res.setHeader("Content-Disposition", `inline; filename="${request.fileName || "document"}"`);
        return res.send(buf);
      }
      if (request.contentHtml || request.sourceDocument?.content) {
        const html = request.contentHtml || request.sourceDocument?.content || "<p>No content</p>";
        return res.type("html").send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${request.title}</title></head><body style="font-family:sans-serif;padding:40px;max-width:800px;margin:0 auto">${html}</body></html>`);
      }
      return res.status(404).json({ message: "No file attached" });
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/signoff/:id", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const id = parseRequestId(req.params.id);
    if (id == null) return res.status(404).json({ message: "Not found" });
    try {
      const request = await signoffService.getRequest(id);
      if (!request) return res.status(404).json({ message: "Not found" });
      const { fileData, signedPdfData, ...safe } = request;
      res.json(safe);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/signoff", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tenantId = requireApiTenantId(req, res);
    if (tenantId == null) return;
    try {
      const u = getUser(req);
      const created = await signoffService.createRequest({
        tenantId,
        workspaceId: resolveListClientId(req),
        userId: userId(req),
        userName: userName(req),
        userEmail: u.email,
        body: req.body,
        ip: req.ip,
      });
      res.json(created);
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.post("/api/signoff/:id/duplicate", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const copy = await signoffService.duplicateRequest(Number(req.params.id), userName(req), getUser(req).email);
      res.json(copy);
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.post("/api/signoff/:id/void", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const u = getUser(req);
      const result = await signoffService.voidRequest(Number(req.params.id), req.body.reason ?? null, {
        name: userName(req), email: u.email, ip: req.ip,
      });
      res.json(result);
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.post("/api/signoff/:id/save-template", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    const tenantId = requireApiTenantId(req, res);
    if (tenantId == null) return;
    try {
      const tpl = await signoffService.saveAsTemplate(Number(req.params.id), tenantId, userId(req));
      res.json(tpl);
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.patch("/api/signoff/:id", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const updated = await signoffService.updateRequest(Number(req.params.id), req.body);
      res.json(updated);
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.delete("/api/signoff/:id", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      await signoffService.deleteRequest(Number(req.params.id));
      res.json({ success: true });
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.post("/api/signoff/:id/signers", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const u = getUser(req);
      const { name, email, roleTitle, signerOrder, isInternal, userId: uid, privateMessage, signingDeadline } = req.body;
      const result = await signoffService.addSigner({
        requestId: Number(req.params.id),
        name, email, roleTitle, signerOrder, isInternal, userId: uid, privateMessage, signingDeadline,
        addedBy: userId(req), addedByName: userName(req), addedByEmail: u.email, ip: req.ip,
      });
      res.json(result);
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.patch("/api/signoff/signers/:signerId", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const { name, email, roleTitle, signerOrder } = req.body;
      const { db } = await import("../db");
      const { signoffSigners } = await import("@shared/models/signoff");
      const { eq } = await import("drizzle-orm");
      const [updated] = await db.update(signoffSigners).set({ name, email, roleTitle, signerOrder }).where(eq(signoffSigners.id, Number(req.params.signerId))).returning();
      res.json(updated);
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.delete("/api/signoff/signers/:signerId", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      await signoffService.removeSigner(Number(req.params.signerId), { name: userName(req), email: getUser(req).email, ip: req.ip });
      res.json({ success: true });
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.post("/api/signoff/:id/send", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const u = getUser(req);
      const result = await signoffService.sendRequest(Number(req.params.id), { name: userName(req), email: u.email, ip: req.ip });
      res.json(result);
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  });

  app.post("/api/signoff/:id/remind", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const u = getUser(req);
      const result = await signoffService.remindSigners(Number(req.params.id), { name: userName(req), email: u.email, ip: req.ip }, req.body.signerId);
      res.json(result);
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.get("/api/signoff/:id/fields", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      res.json(await signoffService.listFields(Number(req.params.id)));
    } catch (e: unknown) { res.status(500).json({ message: (e as Error).message }); }
  });

  app.put("/api/signoff/:id/fields", async (req, res) => {
    if (!isRequestAuthenticated(req)) return res.status(401).json({ message: "Unauthorized" });
    try {
      const request = await signoffService.getRequest(Number(req.params.id));
      if (!request) return res.status(404).json({ message: "Not found" });
      if (request.status !== "draft") return res.status(400).json({ message: "Fields can only be edited on drafts" });
      const fields = await signoffService.replaceFields(Number(req.params.id), req.body.fields ?? []);
      res.json(fields);
    } catch (e: unknown) { res.status(400).json({ message: (e as Error).message }); }
  });
}
