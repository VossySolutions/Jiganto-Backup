import crypto from "crypto";
import type { User } from "@shared/models/auth";
import type { SupabaseAuthUser } from "../auth/appUserSync";

const TTL_MS = 10 * 60_000;
const cache = new Map<
  string,
  { expiresAt: number; sbUser: SupabaseAuthUser; appUser: User }
>();

function tokenKey(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex").slice(0, 32);
}

export const supabaseAuthCache = {
  get(token: string): { sbUser: SupabaseAuthUser; appUser: User } | null {
    const entry = cache.get(tokenKey(token));
    if (!entry || entry.expiresAt <= Date.now()) return null;
    return { sbUser: entry.sbUser, appUser: entry.appUser };
  },
  set(token: string, sbUser: SupabaseAuthUser, appUser: User): void {
    cache.set(tokenKey(token), {
      expiresAt: Date.now() + TTL_MS,
      sbUser,
      appUser,
    });
  },
  invalidateUser(userId: string): void {
    for (const [k, entry] of cache.entries()) {
      if (entry.sbUser.id === userId) cache.delete(k);
    }
  },
};
