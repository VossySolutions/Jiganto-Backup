import type { Request, RequestHandler } from "express";
import {
  type SupabaseAuthUser,
  syncSupabaseUserToApp,
} from "./appUserSync";
import { supabaseAuthCache } from "../lib/supabase-auth-cache";

function normalizeSupabaseUrl(url?: string): string | null {
  if (!url) return null;
  // Accept either project root URL or mistakenly provided REST URL.
  return url.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
}

export function isSupabaseAuthEnabled(): boolean {
  return Boolean(normalizeSupabaseUrl(process.env.SUPABASE_URL) && process.env.SUPABASE_ANON_KEY);
}

export function authMode(): "supabase" | "dev-session" {
  return isSupabaseAuthEnabled() ? "supabase" : "dev-session";
}

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

async function fetchSupabaseUser(accessToken: string): Promise<SupabaseAuthUser | null> {
  const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  const res = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: anon,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) return null;
  return (await res.json()) as SupabaseAuthUser;
}

/** Attach req.user from Supabase bearer token (production auth mode). */
export const attachSupabaseIdentity: RequestHandler = async (req, _res, next) => {
  if (!isSupabaseAuthEnabled()) return next();

  try {
    const token = bearerToken(req);
    if (!token) return next();

    const cached = supabaseAuthCache.get(token);
    if (cached) {
      const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
      req.user = {
        supabaseAuth: true,
        expires_at: expiresAt,
        claims: {
          sub: cached.sbUser.id,
          email: cached.appUser.email ?? undefined,
          first_name: cached.appUser.firstName ?? undefined,
          last_name: cached.appUser.lastName ?? undefined,
        },
      } as Express.User;
      return next();
    }

    const sbUser = await fetchSupabaseUser(token);
    if (!sbUser?.id) return next();

    const appUser = await syncSupabaseUserToApp(sbUser);
    supabaseAuthCache.set(token, sbUser, appUser);

    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour cache window
    req.user = {
      supabaseAuth: true,
      expires_at: expiresAt,
      claims: {
        sub: sbUser.id,
        email: appUser.email ?? undefined,
        first_name: appUser.firstName ?? undefined,
        last_name: appUser.lastName ?? undefined,
      },
    } as Express.User;
    return next();
  } catch (err) {
    return next(err);
  }
};

export function isSupabaseAuthUser(user: unknown): boolean {
  return (
    typeof user === "object" &&
    user !== null &&
    (user as { supabaseAuth?: boolean }).supabaseAuth === true
  );
}

/** True when Supabase JWT or dev-session passport user is present and not expired. */
export function isRequestAuthenticated(req: Request): boolean {
  const user = req.user as {
    supabaseAuth?: boolean;
    sessionAuth?: boolean;
    expires_at?: number;
  } | undefined;
  if (!user?.expires_at) return false;
  const now = Math.floor(Date.now() / 1000);
  if (user.expires_at <= now) return false;
  if (user.supabaseAuth) return true;
  if (user.sessionAuth && req.isAuthenticated?.()) return true;
  return false;
}

