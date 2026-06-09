import { inArray } from "drizzle-orm";
import { db } from "../db";
import { users } from "@shared/schema";
import type { Client } from "@shared/models/clients";

export type UserBrief = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

export type EnrichedClient = Client & {
  createdByUser?: UserBrief | null;
  accountManagerUser?: UserBrief | null;
};

export function userDisplayName(u?: UserBrief | null): string {
  if (!u) return "—";
  const name = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
  return name || u.email || u.id;
}

export async function enrichClientsWithUsers<T extends Client>(clients: T[]): Promise<(T & {
  createdByUser?: UserBrief | null;
  accountManagerUser?: UserBrief | null;
})[]> {
  const ids = new Set<string>();
  for (const c of clients) {
    if (c.createdBy) ids.add(c.createdBy);
    if (c.accountManagerId) ids.add(c.accountManagerId);
  }
  if (ids.size === 0) {
    return clients.map((c) => ({ ...c, createdByUser: null, accountManagerUser: null }));
  }
  const rows = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(users)
    .where(inArray(users.id, [...ids]));
  const map = new Map(rows.map((r) => [r.id, r]));
  return clients.map((c) => ({
    ...c,
    createdByUser: c.createdBy ? map.get(c.createdBy) ?? null : null,
    accountManagerUser: c.accountManagerId ? map.get(c.accountManagerId) ?? null : null,
  }));
}

export async function enrichClientWithUsers<T extends Client>(client: T): Promise<T & {
  createdByUser?: UserBrief | null;
  accountManagerUser?: UserBrief | null;
}> {
  const [enriched] = await enrichClientsWithUsers([client]);
  return enriched;
}
