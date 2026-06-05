import { eq, and } from "drizzle-orm";
import { tenants } from "@shared/schema";
import { orgMemberships, type PlatformRole } from "@shared/models/permissions";
import {
  DEV_LOGIN_PRESETS,
  getDevPreset,
  type DevLoginPreset,
} from "@shared/dev-login-presets";
import { db } from "../db";
import { storage } from "../storage";
import { ensureDefaultModuleRoles } from "../lib/default-module-roles";
import { authStorage } from "./storage";
import { SESSION_USER_ID } from "./sessionAuth";

export function isDevLoginEnabled(): boolean {
  if (process.env.ENABLE_DEV_LOGIN === "false") return false;
  if (process.env.ENABLE_DEV_LOGIN === "true") return true;
  return process.env.NODE_ENV !== "production";
}

export function listDevPresets() {
  return DEV_LOGIN_PRESETS.map((p) => ({
    preset: p.preset,
    label: p.firstName + " " + p.lastName,
    email: p.email,
    platformRole: p.platformRole,
    summary: p.summary,
    loginPath: `/api/login?preset=${p.preset}`,
  }));
}

async function firstClientId(tenantId: number): Promise<number | null> {
  const clients = await storage.getClients(tenantId);
  return clients[0]?.id ?? null;
}

export async function ensureUserForPreset(presetId: string): Promise<{
  userId: string;
  platformRole: PlatformRole;
}> {
  const preset = getDevPreset(presetId);
  if (!preset) {
    throw new Error(`Unknown preset: ${presetId}`);
  }
  return ensureUserFromPreset(preset);
}

/** Default single-user login (AUTH_USER_ID + AUTH_PLATFORM_ROLE). */
export async function ensureDefaultSessionUser(): Promise<{
  userId: string;
  platformRole: PlatformRole;
}> {
  const platformRole = (process.env.AUTH_PLATFORM_ROLE ?? "si_super_admin") as PlatformRole;
  return ensureUserFromConfig({
    userId: SESSION_USER_ID,
    email: process.env.AUTH_USER_EMAIL ?? "admin@localhost",
    firstName: process.env.AUTH_USER_FIRST_NAME ?? "Admin",
    lastName: process.env.AUTH_USER_LAST_NAME ?? "User",
    platformRole,
    lockedWorkspaceId: null,
  });
}

async function ensureUserFromPreset(preset: DevLoginPreset) {
  let lockedWorkspaceId: number | null = null;
  if (preset.lockToFirstClient) {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, 1)).limit(1);
    const tenantId = tenant?.id ?? 1;
    lockedWorkspaceId = await firstClientId(tenantId);
  }
  const result = await ensureUserFromConfig({
    userId: preset.userId,
    email: preset.email,
    firstName: preset.firstName,
    lastName: preset.lastName,
    platformRole: preset.platformRole,
    lockedWorkspaceId,
  });
  if (preset.lockToFirstClient && lockedWorkspaceId) {
    await ensureClientUserRow(
      preset.userId,
      1,
      lockedWorkspaceId,
      preset.clientUserRole ?? "client_admin",
    );
  }
  return result;
}

async function ensureUserFromConfig(config: {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  platformRole: PlatformRole;
  lockedWorkspaceId: number | null;
}) {
  await authStorage.upsertUser({
    id: config.userId,
    email: config.email,
    firstName: config.firstName,
    lastName: config.lastName,
  });

  const orgName =
    config.organisationName?.trim() ||
    process.env.AUTH_TENANT_NAME?.trim() ||
    "My Organisation";
  const orgSlug =
    process.env.AUTH_TENANT_SLUG?.trim() ||
    orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") ||
    "default";

  let [tenant] = await db.select().from(tenants).where(eq(tenants.id, 1)).limit(1);
  if (!tenant) {
    [tenant] = await db
      .insert(tenants)
      .values({
        name: orgName,
        slug: orgSlug,
        country: "USA",
      })
      .returning();
  } else if (config.organisationName?.trim()) {
    [tenant] = await db
      .update(tenants)
      .set({ name: orgName, slug: orgSlug, updatedAt: new Date() })
      .where(eq(tenants.id, tenant.id))
      .returning();
  }

  await ensureDefaultModuleRoles(tenant.id);

  const profile = await storage.getProfile(config.userId);
  if (!profile) {
    await storage.createProfile({
      userId: config.userId,
      tenantId: tenant.id,
      role: "admin",
      jobTitle: config.platformRole,
      isActive: true,
    });
  }

  try {
    const [existing] = await db
      .select()
      .from(orgMemberships)
      .where(
        and(
          eq(orgMemberships.userId, config.userId),
          eq(orgMemberships.orgId, tenant.id),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(orgMemberships)
        .set({
          platformRole: config.platformRole,
          lockedWorkspaceId: config.lockedWorkspaceId,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(orgMemberships.id, existing.id));
    } else {
      await db.insert(orgMemberships).values({
        userId: config.userId,
        orgId: tenant.id,
        platformRole: config.platformRole,
        lockedWorkspaceId: config.lockedWorkspaceId,
        isActive: true,
      });
    }
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code !== "42P01") throw err;
    console.warn("[auth] org_memberships missing — run db migrations");
  }

  return { userId: config.userId, platformRole: config.platformRole };
}

/** First Supabase sign-up: create default org + SI Super Admin for this user. */
export async function bootstrapFirstOrganisationAdmin(config: {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  organisationName?: string;
}) {
  const orgName =
    config.organisationName?.trim() ||
    process.env.AUTH_TENANT_NAME?.trim() ||
    "My Organisation";

  const result = await ensureUserFromConfig({
    userId: config.userId,
    email: config.email,
    firstName: config.firstName,
    lastName: config.lastName,
    platformRole: "si_super_admin",
    lockedWorkspaceId: null,
    organisationName: orgName,
  });

  return result;
}

async function ensureClientUserRow(
  userId: string,
  tenantId: number,
  clientId: number,
  role: string,
) {
  const existing = await storage.getClientMembershipByUserId(userId, tenantId);
  if (existing) return;
  try {
    await storage.addClientUser({
      clientId,
      tenantId,
      userId,
      role,
    });
  } catch {
    // client_users may already exist or table missing
  }
}

export function buildPassportUserForUserId(userId: string, email: string, firstName: string, lastName: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
  return {
    sessionAuth: true,
    expires_at: expiresAt,
    claims: {
      sub: userId,
      email,
      first_name: firstName,
      last_name: lastName,
    },
  };
}
