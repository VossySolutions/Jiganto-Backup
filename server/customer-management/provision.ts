import { eq } from "drizzle-orm";
import type { Tenant } from "@shared/schema";
import { commercialCustomers, tenants } from "@shared/schema";
import { db } from "../db";
import { getStripeClient } from "./stripe";
import { planUsageLimits } from "./usage";
import { planMrrPence } from "./pricing";
import type { CommercialPlanTier, CustomerCommercialStatus } from "@shared/models/customer-mgmt";

type TenantBillingConfig = {
  planName?: string;
  seatCount?: number;
  renewalDate?: string;
  status?: string;
};

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "org"
  );
}

function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function mapPlan(planName?: string): CommercialPlanTier {
  const p = (planName ?? "").toLowerCase();
  if (p.includes("enterprise")) return "enterprise";
  if (p.includes("starter")) return "starter";
  return "growth";
}

function mapStatus(status?: string): CustomerCommercialStatus {
  const s = (status ?? "active").toLowerCase();
  if (s.includes("trial")) return "trial";
  if (s.includes("suspend")) return "suspended";
  if (s.includes("free")) return "free_access";
  return "active";
}

function avatarColorFromSlug(slug: string): string {
  const palette = ["#534AB7", "#378ADD", "#0F6E56", "#EF9F27", "#E24B4A", "#639922"];
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash + slug.charCodeAt(i) * 17) % palette.length;
  return palette[hash]!;
}

/** Create or update commercial profile when a tenant is provisioned. */
export async function ensureCommercialProfileForTenant(
  tenant: Pick<Tenant, "id" | "name" | "slug" | "website" | "brandingConfig" | "licenseContactEmail">,
): Promise<void> {
  const [existing] = await db
    .select({ id: commercialCustomers.id })
    .from(commercialCustomers)
    .where(eq(commercialCustomers.tenantId, tenant.id))
    .limit(1);

  const billing = (tenant.brandingConfig as { billing?: TenantBillingConfig } | null)?.billing;
  const plan = mapPlan(billing?.planName);
  const status = mapStatus(billing?.status);
  const externalId = tenant.slug || slugify(tenant.name);
  const domain =
    tenant.website?.replace(/^https?:\/\//, "").split("/")[0] ??
    `${externalId}.jiganto.app`;

  let stripeCustomerId: string | null = null;
  const stripe = getStripeClient();
  if (stripe && !existing) {
    try {
      const customer = await stripe.customers.create({
        name: tenant.name,
        email: tenant.licenseContactEmail ?? undefined,
        metadata: { tenantId: String(tenant.id), slug: tenant.slug },
      });
      stripeCustomerId = customer.id;
    } catch (err) {
      console.warn("[commercial-provision] Stripe customer create failed:", err);
    }
  }

  const usageLimits = planUsageLimits(plan);

  const payload = {
    tenantId: tenant.id,
    externalId,
    slug: tenant.slug || externalId,
    name: tenant.name,
    initials: initialsFromName(tenant.name),
    avatarColor: avatarColorFromSlug(tenant.slug),
    domain,
    website: tenant.website ?? domain,
    userCount: billing?.seatCount ?? 0,
    plan,
    status,
    statusLabel: status === "trial" ? "Trial" : status === "active" ? "Active" : status,
    mrrPence: status === "active" ? planMrrPence(plan) : null,
    healthScore: 70,
    healthBand: "healthy",
    csmName: "Unassigned",
    csmInitials: "—",
    nextAction: billing?.renewalDate ? `Renews ${billing.renewalDate}` : "Onboarding",
    renewalDate: billing?.renewalDate ?? null,
    activeSince: new Date().toLocaleString("en-GB", { month: "short", year: "numeric" }),
    subscription: {
      plan,
      mrrPence: status === "active" ? planMrrPence(plan) : 0,
      billingCycle: "Monthly",
      renewalDate: billing?.renewalDate ?? "—",
      discountLabel: null,
      paymentMethod: stripeCustomerId ? "Stripe" : "Offline",
    },
    usage: {
      users: { used: billing?.seatCount ?? 0, limit: usageLimits.users.limit },
      aiTokens: { used: 0, limit: usageLimits.aiTokens.limit },
      storageGb: { used: 0, limit: usageLimits.storageGb.limit },
      esignDocs: { used: 0, limit: usageLimits.esignDocs.limit },
    },
    healthSignals: [],
    stripeCustomerId,
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(commercialCustomers)
      .set({
        name: payload.name,
        domain: payload.domain,
        website: payload.website,
        plan: payload.plan,
        status: payload.status,
        statusLabel: payload.statusLabel,
        userCount: payload.userCount,
        renewalDate: payload.renewalDate,
        subscription: payload.subscription,
        updatedAt: new Date(),
      })
      .where(eq(commercialCustomers.id, existing.id));
    return;
  }

  await db.insert(commercialCustomers).values(payload);

  if (stripeCustomerId) {
    await db
      .update(tenants)
      .set({
        brandingConfig: {
          ...(tenant.brandingConfig as object),
          billing: {
            ...billing,
            stripeCustomerId,
          },
        },
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenant.id));
  }
}

/** Backfill commercial profiles for all tenants missing one. */
export async function syncAllTenantsToCommercialProfiles(): Promise<number> {
  const allTenants = await db.select().from(tenants);
  let created = 0;
  for (const tenant of allTenants) {
    const [existing] = await db
      .select({ id: commercialCustomers.id })
      .from(commercialCustomers)
      .where(eq(commercialCustomers.tenantId, tenant.id))
      .limit(1);
    if (!existing) {
      await ensureCommercialProfileForTenant(tenant);
      created++;
    }
  }
  return created;
}
