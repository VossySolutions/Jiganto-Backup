import type { Express } from "express";
import { ensureDefaultSessionUser } from "./devLogin";
import {
  ensureUserForPreset,
  buildPassportUserForUserId,
  isDevLoginEnabled,
} from "./devLogin";
import { DASHBOARD_PATH } from "@shared/app-routes";
import { getDevPreset } from "@shared/dev-login-presets";

/** Default sign-in user id (override with AUTH_USER_ID). */
export const SESSION_USER_ID = process.env.AUTH_USER_ID ?? "local-dev-user";

export function useSecureCookies(): boolean {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
}

export function sessionSecretOrThrow(): string {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  if (process.env.NODE_ENV !== "production") {
    return "dev-session-secret-set-SESSION_SECRET-before-production";
  }
  throw new Error(
    "SESSION_SECRET must be set in production. Generate a long random string.",
  );
}

export function buildSessionPassportUser() {
  const expiresAt = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
  return {
    sessionAuth: true,
    expires_at: expiresAt,
    claims: {
      sub: SESSION_USER_ID,
      email: process.env.AUTH_USER_EMAIL ?? "admin@localhost",
      first_name: process.env.AUTH_USER_FIRST_NAME ?? "Admin",
      last_name: process.env.AUTH_USER_LAST_NAME ?? "User",
    },
  };
}

export function isSessionAuthUser(user: unknown): boolean {
  return (
    typeof user === "object" &&
    user !== null &&
    (user as { sessionAuth?: boolean }).sessionAuth === true
  );
}

/** Ensure default sign-in user exists (AUTH_USER_ID). */
export async function ensureSessionUser(): Promise<void> {
  await ensureDefaultSessionUser();
}

export function registerSessionAuthRoutes(app: Express): void {
  app.get("/api/login", async (req, res, next) => {
    try {
      const preset = typeof req.query.preset === "string" ? req.query.preset : undefined;

      if (preset) {
        if (!isDevLoginEnabled()) {
          return res.status(403).send("Role-based dev login is disabled in production.");
        }
        const p = getDevPreset(preset);
        if (!p) return res.status(400).send(`Unknown preset: ${preset}`);
        await ensureUserForPreset(preset);
        const user = buildPassportUserForUserId(
          p.userId,
          p.email,
          p.firstName,
          p.lastName,
        );
        return req.login(user, (err) => {
          if (err) return next(err);
          res.redirect(DASHBOARD_PATH);
        });
      }

      const cfg = await ensureDefaultSessionUser();
      const user = buildPassportUserForUserId(
        cfg.userId,
        process.env.AUTH_USER_EMAIL ?? "admin@localhost",
        process.env.AUTH_USER_FIRST_NAME ?? "Admin",
        process.env.AUTH_USER_LAST_NAME ?? "User",
      );
      req.login(user, (err) => {
        if (err) return next(err);
        res.redirect(DASHBOARD_PATH);
      });
    } catch (err) {
      next(err);
    }
  });
}
