import type { Express, Request } from "express";
import { isAuthenticated } from "./setupAuth";
import {
  canStartImpersonation,
  endImpersonation,
  getActiveImpersonationForStaff,
  requestImpersonation,
} from "../lib/impersonation";
import { authStorage } from "./storage";

declare module "express-session" {
  interface SessionData {
    impersonation?: {
      logId: number;
      staffUserId: string;
      targetUserId: string;
      orgId: number;
    };
  }
}

function staffUserId(req: Request): string | null {
  return (req.user as { claims?: { sub?: string } })?.claims?.sub ?? null;
}

export function registerImpersonationRoutes(app: Express): void {
  app.get("/api/auth/impersonation/status", isAuthenticated, async (req, res) => {
    const uid = staffUserId(req);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });
    const active = req.session.impersonation ?? (await getActiveImpersonationForStaff(uid));
    if (!active) return res.json({ active: false });
    const target = await authStorage.getUser(active.targetUserId);
    res.json({
      active: true,
      logId: active.logId,
      targetUserId: active.targetUserId,
      targetEmail: target?.email,
      orgId: active.orgId,
    });
  });

  app.post("/api/auth/impersonation/start", isAuthenticated, async (req, res) => {
    const uid = staffUserId(req);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });
    if (!canStartImpersonation(uid)) {
      return res.status(403).json({ message: "Only Jiganto staff may impersonate users." });
    }
    const { targetUserId, orgId = 1, reason = "" } = req.body ?? {};
    if (!targetUserId || typeof targetUserId !== "string") {
      return res.status(400).json({ message: "targetUserId is required" });
    }
    const target = await authStorage.getUser(targetUserId);
    if (!target) return res.status(404).json({ message: "Target user not found" });

    const { id } = await requestImpersonation({
      staffUserId: uid,
      targetUserId,
      orgId: Number(orgId) || 1,
      reason: String(reason),
    });

    req.session.impersonation = {
      logId: id,
      staffUserId: uid,
      targetUserId,
      orgId: Number(orgId) || 1,
    };

    res.json({ success: true, logId: id, targetUserId });
  });

  app.post("/api/auth/impersonation/end", isAuthenticated, async (req, res) => {
    const uid = staffUserId(req);
    if (!uid) return res.status(401).json({ message: "Unauthorized" });
    const logId = req.session.impersonation?.logId ?? Number(req.body?.logId);
    if (!logId) {
      req.session.impersonation = undefined;
      return res.json({ success: true });
    }
    await endImpersonation(logId, uid);
    req.session.impersonation = undefined;
    res.json({ success: true });
  });
}

/** Effective user id for permissions (target when impersonating). */
export function effectiveUserId(req: Request): string | null {
  const sub = (req.user as { claims?: { sub?: string } })?.claims?.sub;
  if (!sub) return null;
  if (req.session.impersonation?.staffUserId === sub) {
    return req.session.impersonation.targetUserId;
  }
  return sub;
}
