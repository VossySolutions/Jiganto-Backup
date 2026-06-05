import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  commercialActivityLog,
  commercialContacts,
  commercialCustomers,
  commercialDiscountRules,
  commercialProgrammes,
  tenants,
} from "@shared/schema";
import type { CommercialPlanTier, PricingPlan } from "@shared/models/customer-mgmt";
import { DEFAULT_COMMERCIAL_SETTINGS, DEFAULT_PRICING_PLANS } from "./defaults";
import { planMrrPence, parsePriceLabelToPence } from "./pricing";
import { planUsageLimits } from "./usage";
import {
  loadCustomerDetailFromDb,
  loadSettings,
  updateSettingsInDb,
} from "./repository";

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

function avatarColor(slug: string): string {
  const palette = ["#534AB7", "#378ADD", "#0F6E56", "#EF9F27", "#E24B4A", "#639922"];
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash + slug.charCodeAt(i) * 17) % palette.length;
  return palette[hash]!;
}

function roleVariant(role: string): string {
  if (role.toLowerCase().includes("billing")) return "blue";
  if (role.toLowerCase().includes("buyer")) return "purple";
  if (role.toLowerCase().includes("admin")) return "green";
  return "gray";
}

async function customerIdBySlug(slug: string): Promise<number | null> {
  const [row] = await db
    .select({ id: commercialCustomers.id })
    .from(commercialCustomers)
    .where(eq(commercialCustomers.slug, slug))
    .limit(1);
  return row?.id ?? null;
}

async function logActivity(
  customerId: number,
  title: string,
  detail: string,
  entryType = "event",
  dotColor = "#534AB7",
): Promise<void> {
  await db.insert(commercialActivityLog).values({
    customerId,
    entryType,
    title,
    detail,
    entryDate: new Date().toISOString().slice(0, 10),
    dotColor,
  });
}

export async function updateCustomerInDb(
  slug: string,
  patch: { name?: string; website?: string; domain?: string },
) {
  const customerId = await customerIdBySlug(slug);
  if (!customerId) return null;

  const [row] = await db
    .select()
    .from(commercialCustomers)
    .where(eq(commercialCustomers.slug, slug))
    .limit(1);
  if (!row) return null;

  const name = patch.name?.trim() ?? row.name;
  const website = patch.website?.trim() ?? row.website;
  const domain =
    patch.domain?.trim() ??
    website?.replace(/^https?:\/\//, "").split("/")[0] ??
    row.domain;

  await db
    .update(commercialCustomers)
    .set({
      name,
      website,
      domain,
      initials: initialsFromName(name),
      updatedAt: new Date(),
    })
    .where(eq(commercialCustomers.id, customerId));

  if (row.tenantId) {
    await db
      .update(tenants)
      .set({ name, website: website ?? undefined, updatedAt: new Date() })
      .where(eq(tenants.id, row.tenantId));
  }

  return loadCustomerDetailFromDb(slug);
}

export async function createCustomerInDb(input: {
  name: string;
  domain: string;
  plan: CommercialPlanTier;
}) {
  const settings = (await loadSettings()) ?? DEFAULT_COMMERCIAL_SETTINGS;
  const trialDays = settings.defaultTrialDays ?? 30;
  const trialExpires = new Date();
  trialExpires.setDate(trialExpires.getDate() + trialDays);
  const trialExpiresAt = trialExpires.toISOString().slice(0, 10);
  const usageLimits = planUsageLimits(input.plan);

  const baseSlug = slugify(input.domain.replace(/\./g, "-") || input.name);
  let slug = baseSlug;
  let n = 1;
  while (true) {
    const [existing] = await db
      .select({ id: commercialCustomers.id })
      .from(commercialCustomers)
      .where(eq(commercialCustomers.slug, slug))
      .limit(1);
    if (!existing) break;
    slug = `${baseSlug}-${n++}`;
  }

  const [tenant] = await db
    .insert(tenants)
    .values({
      name: input.name.trim(),
      slug,
      country: "GBR",
      website: input.domain.includes(".") ? `https://${input.domain}` : undefined,
      licenseContactEmail: `billing@${input.domain.replace(/^https?:\/\//, "")}`,
    })
    .returning();

  await db.insert(commercialCustomers).values({
    tenantId: tenant!.id,
    externalId: slug,
    slug,
    name: input.name.trim(),
    initials: initialsFromName(input.name),
    avatarColor: avatarColor(slug),
    domain: input.domain.replace(/^https?:\/\//, "").split("/")[0],
    website: input.domain.includes(".") ? input.domain : `https://${input.domain}`,
    userCount: 0,
    plan: input.plan,
    status: "trial",
    statusLabel: `Trial — ${trialDays}d left`,
    mrrPence: null,
    healthScore: 70,
    healthBand: "healthy",
    csmName: "Unassigned",
    csmInitials: "—",
    nextAction: "Complete onboarding",
    trialExpiresAt,
    trialDaysLeft: trialDays,
    activeSince: new Date().toLocaleString("en-GB", { month: "short", year: "numeric" }),
    subscription: {
      plan: input.plan,
      mrrPence: 0,
      billingCycle: "Monthly",
      renewalDate: "—",
      discountLabel: null,
      paymentMethod: "Offline",
    },
    usage: {
      users: { used: 0, limit: usageLimits.users.limit },
      aiTokens: { used: 0, limit: usageLimits.aiTokens.limit },
      storageGb: { used: 0, limit: usageLimits.storageGb.limit },
      esignDocs: { used: 0, limit: usageLimits.esignDocs.limit },
    },
    healthSignals: [],
  });

  const customerId = await customerIdBySlug(slug);
  if (customerId) {
    await logActivity(
      customerId,
      "Customer created",
      `${input.name} · ${input.plan} trial started`,
      "event",
      "#0F6E56",
    );
  }

  return { slug, name: input.name.trim(), plan: input.plan };
}

export async function addContactInDb(
  slug: string,
  input: { name: string; email: string; roleLabel: string },
) {
  const customerId = await customerIdBySlug(slug);
  if (!customerId) return null;

  await db.insert(commercialContacts).values({
    customerId,
    name: input.name.trim(),
    email: input.email.trim(),
    initials: initialsFromName(input.name),
    avatarColor: avatarColor(input.email),
    roleLabel: input.roleLabel,
    roleVariant: roleVariant(input.roleLabel),
  });

  await logActivity(customerId, "Contact added", `${input.name} · ${input.roleLabel}`, "event", "#378ADD");

  return loadCustomerDetailFromDb(slug);
}

export async function changeCustomerPlanInDb(slug: string, plan: CommercialPlanTier) {
  const customerId = await customerIdBySlug(slug);
  if (!customerId) return null;

  const settings = (await loadSettings()) ?? DEFAULT_COMMERCIAL_SETTINGS;
  const [row] = await db
    .select()
    .from(commercialCustomers)
    .where(eq(commercialCustomers.id, customerId))
    .limit(1);
  if (!row) return null;

  const mrr = planMrrPence(plan, settings);
  const subscription = {
    ...((row.subscription as object) ?? {}),
    plan,
    mrrPence: mrr,
  };

  await db
    .update(commercialCustomers)
    .set({ plan, mrrPence: mrr, subscription, updatedAt: new Date() })
    .where(eq(commercialCustomers.id, customerId));

  await logActivity(
    customerId,
    "Plan change scheduled",
    `Moving to ${plan} at next billing cycle`,
    "event",
    "#EF9F27",
  );

  return loadCustomerDetailFromDb(slug);
}

export async function applyCustomerDiscountInDb(
  slug: string,
  input: { ruleLabel: string; note: string },
) {
  const customerId = await customerIdBySlug(slug);
  if (!customerId) return null;

  const [row] = await db
    .select()
    .from(commercialCustomers)
    .where(eq(commercialCustomers.id, customerId))
    .limit(1);
  if (!row) return null;

  const subscription = {
    ...((row.subscription as object) ?? {}),
    discountLabel: input.ruleLabel,
  };

  await db
    .update(commercialCustomers)
    .set({ subscription, updatedAt: new Date() })
    .where(eq(commercialCustomers.id, customerId));

  await logActivity(
    customerId,
    "Discount applied",
    `${input.ruleLabel} — ${input.note}`,
    "event",
    "#639922",
  );

  return loadCustomerDetailFromDb(slug);
}

export async function upsertDiscountRuleInDb(input: {
  externalId?: string;
  name: string;
  discount: string;
  appliesTo?: string;
  duration?: string;
  whoCanApply?: string;
}) {
  const externalId = input.externalId ?? `rule-${Date.now()}`;
  const payload = {
    name: input.name.trim(),
    discount: input.discount.trim(),
    appliesTo: input.appliesTo ?? "All plans",
    duration: input.duration ?? "Contract term",
    whoCanApply: input.whoCanApply ?? "SI Super Admin",
    automatic: false,
  };

  const [existing] = await db
    .select({ id: commercialDiscountRules.id })
    .from(commercialDiscountRules)
    .where(eq(commercialDiscountRules.externalId, externalId))
    .limit(1);

  if (existing) {
    await db.update(commercialDiscountRules).set(payload).where(eq(commercialDiscountRules.id, existing.id));
  } else {
    await db.insert(commercialDiscountRules).values({ externalId, ...payload });
  }

  return { externalId, ...payload };
}

export async function updatePricingPlanInDb(tier: CommercialPlanTier, patch: Partial<PricingPlan>) {
  const current = (await loadSettings()) ?? DEFAULT_COMMERCIAL_SETTINGS;
  const plans = current.pricingPlans ?? DEFAULT_PRICING_PLANS;
  const next = plans.map((p) => {
    if (p.tier !== tier) return p;
    const merged = { ...p, ...patch };
    if (patch.priceLabel != null) {
      merged.mrrPence = parsePriceLabelToPence(patch.priceLabel);
    }
    return merged;
  });
  await updateSettingsInDb({ ...current, pricingPlans: next });
  return next.find((p) => p.tier === tier)!;
}

export async function updateProgrammeParticipantsInDb(
  programmeId: string,
  action: "add" | "remove",
  participant: { initials: string; color?: string },
) {
  const [programme] = await db
    .select()
    .from(commercialProgrammes)
    .where(eq(commercialProgrammes.externalId, programmeId))
    .limit(1);
  if (!programme) return null;

  let initials = [...((programme.participantInitials as string[]) ?? [])];
  let colors = [...((programme.participantColors as string[]) ?? [])];

  if (action === "add") {
    if (programme.slotsFilled >= programme.slotsMax) {
      throw new Error("Programme is full.");
    }
    if (!initials.includes(participant.initials)) {
      initials.push(participant.initials);
      colors.push(participant.color ?? avatarColor(participant.initials));
    }
  } else {
    const idx = initials.indexOf(participant.initials);
    if (idx >= 0) {
      initials.splice(idx, 1);
      colors.splice(idx, 1);
    }
  }

  await db
    .update(commercialProgrammes)
    .set({
      participantInitials: initials,
      participantColors: colors,
      slotsFilled: initials.length,
    })
    .where(eq(commercialProgrammes.id, programme.id));

  return { slotsFilled: initials.length, slotsMax: programme.slotsMax };
}

export async function runCustomerActionInDb(
  slug: string,
  action: "health_follow_up" | "renewal_follow_up" | "convert_trial",
  note?: string,
) {
  const customerId = await customerIdBySlug(slug);
  if (!customerId) return null;

  const now = new Date().toISOString().slice(0, 10);

  if (action === "convert_trial") {
    const settings = (await loadSettings()) ?? DEFAULT_COMMERCIAL_SETTINGS;
    const [row] = await db
      .select()
      .from(commercialCustomers)
      .where(eq(commercialCustomers.id, customerId))
      .limit(1);
    const plan = (row?.plan as CommercialPlanTier) ?? "growth";
    const mrr = row?.mrrPence ?? planMrrPence(plan, settings);
    await db
      .update(commercialCustomers)
      .set({
        status: "active",
        statusLabel: "Active",
        mrrPence: mrr,
        trialDaysLeft: null,
        trialExpiresAt: null,
        nextAction: "Active subscription",
        subscription: {
          ...((row?.subscription as object) ?? {}),
          plan,
          mrrPence: mrr,
        },
        updatedAt: new Date(),
      })
      .where(eq(commercialCustomers.id, customerId));
    await logActivity(customerId, "Trial converted to paid", note ?? `Converted on ${now}`, "event", "#0F6E56");
  } else if (action === "health_follow_up") {
    await logActivity(
      customerId,
      "Health follow-up logged",
      note ?? `CSM action recorded · ${now}`,
      "call",
      "#E24B4A",
    );
  } else {
    await logActivity(
      customerId,
      "Renewal follow-up logged",
      note ?? `Renewal action recorded · ${now}`,
      "call",
      "#EF9F27",
    );
  }

  return loadCustomerDetailFromDb(slug);
}

export async function findCustomerSlugByExternalId(externalId: string): Promise<string | null> {
  const [row] = await db
    .select({ slug: commercialCustomers.slug })
    .from(commercialCustomers)
    .where(eq(commercialCustomers.externalId, externalId))
    .limit(1);
  return row?.slug ?? null;
}
