import type { UpsertUser, User } from "@shared/models/auth";
import { authStorage } from "./storage";

/** Shape returned by Supabase GET /auth/v1/user (and auth.users metadata). */
export type SupabaseAuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: {
    first_name?: string;
    last_name?: string;
    full_name?: string;
    name?: string;
    avatar_url?: string;
  };
};

export function splitDisplayName(full?: string): { firstName?: string; lastName?: string } {
  if (!full?.trim()) return {};
  const [firstName, ...rest] = full.trim().split(/\s+/);
  return { firstName, lastName: rest.join(" ") || undefined };
}

/** Map Supabase Auth user → application `users` row (same UUID as primary key). */
export function mapSupabaseUserToAppRow(sbUser: SupabaseAuthUser): UpsertUser {
  const meta = sbUser.user_metadata ?? {};
  const fullName = meta.full_name ?? meta.name;
  const split = splitDisplayName(fullName);
  const firstName = meta.first_name ?? split.firstName ?? "User";
  const lastName = meta.last_name ?? split.lastName ?? "";

  return {
    id: sbUser.id,
    email: sbUser.email ?? undefined,
    firstName,
    lastName,
    profileImageUrl: meta.avatar_url ?? undefined,
  };
}

/** Upsert into `public.users` so FKs (tasks, profiles, org_memberships, …) stay valid. */
export async function syncSupabaseUserToApp(sbUser: SupabaseAuthUser): Promise<User> {
  return authStorage.upsertUser(mapSupabaseUserToAppRow(sbUser));
}
