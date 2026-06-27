/**
 * CLI bootstrap for Customer Management (Module 0) — writes real rows to Postgres.
 * Not exposed via in-app APIs. Use only for local/dev database setup.
 *
 * Usage: npm run db:seed-commercial
 *        FORCE=1 npm run db:seed-commercial
 */
import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  commercialAccessGrants,
  commercialActivityLog,
  commercialContacts,
  commercialCustomers,
  commercialDiscountRules,
  commercialFeatureFlags,
  commercialInvoices,
  commercialProgrammes,
  customerMgmtSettings,
  tenants,
} from "@shared/schema";
import { DEFAULT_COMMERCIAL_SETTINGS, DEFAULT_PRICING_PLANS } from "./customer-management/defaults";
import { planMrrPence } from "./customer-management/pricing";
import { planUsageLimits } from "./customer-management/usage";

const FORCE = process.env.FORCE === "1" || process.env.FORCE === "true";

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function avatarColor(slug: string): string {
  const palette = ["#534AB7", "#378ADD", "#0F6E56", "#EF9F27", "#E24B4A", "#639922"];
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash + slug.charCodeAt(i) * 17) % palette.length;
  return palette[hash]!;
}

const DEFAULT_FLAGS = [
  { flagKey: "crm_advanced", name: "CRM Advanced", description: "Forecasting, resource plans, and 360° views" },
  { flagKey: "finance_module", name: "Finance", description: "Budgets, timesheets, and invoicing" },
  { flagKey: "resource_planning", name: "Resource Planning", description: "Capacity and pipeline planning" },
  { flagKey: "esign", name: "eSign", description: "Digital signing workflows" },
  { flagKey: "ai_assistant", name: "AI Assistant", description: "Jiganto AI features" },
];

type CustomerSeed = {
  externalId: string;
  slug: string;
  name: string;
  domain: string;
  plan: "starter" | "growth" | "enterprise";
  status: "active" | "trial" | "free_access" | "suspended";
  statusLabel: string;
  healthScore: number;
  healthBand: "healthy" | "watch" | "at_risk";
  mrrPence: number | null;
  csmName: string;
  nextAction: string;
  nextActionUrgent?: boolean;
  renewalDate?: string;
  trialExpiresAt?: string;
  trialDaysLeft?: number;
  rowHighlight?: "warn" | "danger";
  contacts: Array<{ name: string; email: string; roleLabel: string }>;
  enabledFlags: string[];
};

const CUSTOMERS: CustomerSeed[] = [
  {
    externalId: "acme-corp",
    slug: "acme-corp",
    name: "Acme Corporation",
    domain: "acme.example.com",
    plan: "growth",
    status: "active",
    statusLabel: "Active",
    healthScore: 82,
    healthBand: "healthy",
    mrrPence: planMrrPence("growth"),
    csmName: "Sarah Chen",
    nextAction: "Q3 business review",
    renewalDate: "15 Sep 2026",
    contacts: [
      { name: "Jane Cooper", email: "jane.cooper@acme.example.com", roleLabel: "Primary contact" },
      { name: "Robert Hayes", email: "robert.hayes@acme.example.com", roleLabel: "Billing" },
    ],
    enabledFlags: ["crm_advanced", "finance_module", "esign", "ai_assistant"],
  },
  {
    externalId: "beta-dynamics",
    slug: "beta-dynamics",
    name: "Beta Dynamics",
    domain: "betadynamics.example.com",
    plan: "growth",
    status: "trial",
    statusLabel: "Trial — 7d left",
    healthScore: 68,
    healthBand: "watch",
    mrrPence: null,
    csmName: "Sarah Chen",
    nextAction: "Schedule onboarding call",
    nextActionUrgent: true,
    trialExpiresAt: daysFromNow(7),
    trialDaysLeft: 7,
    rowHighlight: "warn",
    contacts: [{ name: "Alex Kim", email: "alex@betadynamics.example.com", roleLabel: "Evaluator" }],
    enabledFlags: ["crm_advanced", "ai_assistant"],
  },
  {
    externalId: "northwind-traders",
    slug: "northwind-traders",
    name: "Northwind Traders",
    domain: "northwind.example.com",
    plan: "enterprise",
    status: "active",
    statusLabel: "Active",
    healthScore: 42,
    healthBand: "at_risk",
    mrrPence: planMrrPence("enterprise"),
    csmName: "James Okonkwo",
    nextAction: "Escalation — low adoption",
    nextActionUrgent: true,
    renewalDate: "28 Apr 2026",
    rowHighlight: "danger",
    contacts: [{ name: "Maria Gonzalez", email: "maria@northwind.example.com", roleLabel: "Sponsor" }],
    enabledFlags: ["crm_advanced", "finance_module", "resource_planning", "esign"],
  },
  {
    externalId: "contoso-ltd",
    slug: "contoso-ltd",
    name: "Contoso Ltd",
    domain: "contoso.example.com",
    plan: "growth",
    status: "free_access",
    statusLabel: "Free access — Design partner",
    healthScore: 75,
    healthBand: "healthy",
    mrrPence: 0,
    csmName: "James Okonkwo",
    nextAction: "Collect case study",
    contacts: [{ name: "Priya Sharma", email: "priya@contoso.example.com", roleLabel: "Product owner" }],
    enabledFlags: ["crm_advanced", "resource_planning", "ai_assistant"],
  },
  {
    externalId: "fabrikam-inc",
    slug: "fabrikam-inc",
    name: "Fabrikam Inc",
    domain: "fabrikam.example.com",
    plan: "starter",
    status: "active",
    statusLabel: "Active",
    healthScore: 71,
    healthBand: "healthy",
    mrrPence: planMrrPence("starter"),
    csmName: "Unassigned",
    nextAction: "Renewal in 30 days",
    renewalDate: daysFromNow(30),
    contacts: [{ name: "Chris Martin", email: "chris@fabrikam.example.com", roleLabel: "Admin" }],
    enabledFlags: ["crm_advanced", "esign"],
  },
  {
    externalId: "tailspin-toys",
    slug: "tailspin-toys",
    name: "Tailspin Toys",
    domain: "tailspin.example.com",
    plan: "growth",
    status: "suspended",
    statusLabel: "Suspended — payment failed",
    healthScore: 35,
    healthBand: "at_risk",
    mrrPence: planMrrPence("growth"),
    csmName: "Sarah Chen",
    nextAction: "Resolve overdue invoice",
    nextActionUrgent: true,
    rowHighlight: "danger",
    contacts: [{ name: "Dan Wilson", email: "dan@tailspin.example.com", roleLabel: "Finance" }],
    enabledFlags: [],
  },
];

export async function seedCommercialDemo(): Promise<{ seeded: boolean; customerCount: number; message: string }> {
  const existing = await db.select({ id: commercialCustomers.id }).from(commercialCustomers).limit(1);
  if (existing.length > 0 && !FORCE) {
    return { seeded: false, customerCount: CUSTOMERS.length, message: "Commercial customers already exist. Set FORCE=1 to re-seed." };
  }

  if (FORCE) {
    await db.delete(commercialActivityLog);
    await db.delete(commercialFeatureFlags);
    await db.delete(commercialContacts);
    await db.delete(commercialAccessGrants);
    await db.delete(commercialInvoices);
    await db.delete(commercialCustomers);
  }

  await db
    .insert(customerMgmtSettings)
    .values({
      id: 1,
      settings: { ...DEFAULT_COMMERCIAL_SETTINGS, pricingPlans: DEFAULT_PRICING_PLANS },
    })
    .onConflictDoUpdate({
      target: customerMgmtSettings.id,
      set: { settings: { ...DEFAULT_COMMERCIAL_SETTINGS, pricingPlans: DEFAULT_PRICING_PLANS }, updatedAt: new Date() },
    });

  const [tenant] = await db.select().from(tenants).limit(1);

  for (const c of CUSTOMERS) {
    const usageLimits = planUsageLimits(c.plan);
    const [customer] = await db
      .insert(commercialCustomers)
      .values({
        tenantId: c.slug === "acme-corp" ? tenant?.id ?? null : null,
        externalId: c.externalId,
        slug: c.slug,
        name: c.name,
        initials: initials(c.name),
        avatarColor: avatarColor(c.slug),
        domain: c.domain,
        website: `https://${c.domain}`,
        userCount: c.plan === "enterprise" ? 48 : c.plan === "starter" ? 8 : 22,
        plan: c.plan,
        status: c.status,
        statusLabel: c.statusLabel,
        mrrPence: c.mrrPence,
        healthScore: c.healthScore,
        healthBand: c.healthBand,
        csmName: c.csmName,
        csmInitials: initials(c.csmName === "Unassigned" ? "UA" : c.csmName),
        nextAction: c.nextAction,
        nextActionUrgent: c.nextActionUrgent ?? false,
        renewalDate: c.renewalDate ?? null,
        trialExpiresAt: c.trialExpiresAt ?? null,
        trialDaysLeft: c.trialDaysLeft ?? null,
        rowHighlight: c.rowHighlight ?? null,
        activeSince: "Jan 2025",
        subscription: {
          plan: c.plan,
          mrrPence: c.mrrPence ?? 0,
          billingCycle: "Monthly",
          renewalDate: c.renewalDate ?? "—",
          discountLabel: c.status === "free_access" ? "Design partner — 100%" : null,
          paymentMethod: "Offline",
        },
        usage: {
          users: { used: c.plan === "enterprise" ? 48 : 12, limit: usageLimits.users.limit },
          aiTokens: { used: 42_000, limit: usageLimits.aiTokens.limit },
          storageGb: { used: 18, limit: usageLimits.storageGb.limit },
          esignDocs: { used: 6, limit: usageLimits.esignDocs.limit },
        },
        healthSignals: [
          { label: "Login frequency", score: c.healthScore, band: c.healthBand },
          { label: "Feature adoption", score: Math.max(30, c.healthScore - 10), band: c.healthBand },
        ],
      })
      .returning();

    for (const contact of c.contacts) {
      await db.insert(commercialContacts).values({
        customerId: customer.id,
        name: contact.name,
        email: contact.email,
        initials: initials(contact.name),
        avatarColor: avatarColor(contact.email),
        roleLabel: contact.roleLabel,
        roleVariant: contact.roleLabel.toLowerCase().includes("billing") ? "green" : "blue",
      });
    }

    for (const flag of DEFAULT_FLAGS) {
      await db.insert(commercialFeatureFlags).values({
        customerId: customer.id,
        flagKey: flag.flagKey,
        name: flag.name,
        description: flag.description,
        enabled: c.enabledFlags.includes(flag.flagKey),
      });
    }

    await db.insert(commercialActivityLog).values({
      customerId: customer.id,
      entryType: "event",
      title: "Profile created",
      detail: `${c.name} added to commercial registry (demo seed)`,
      entryDate: daysAgo(14),
      dotColor: "#534AB7",
    });

    if (c.healthBand === "at_risk") {
      await db.insert(commercialActivityLog).values({
        customerId: customer.id,
        entryType: "scheduled_check_in",
        title: "Health check-in",
        detail: "Review adoption blockers and agree recovery plan",
        entryDate: daysFromNow(3),
        dotColor: "#E24B4A",
      });
    }
  }

  await db.insert(commercialAccessGrants).values({
    customerId: (await db.select({ id: commercialCustomers.id }).from(commercialCustomers).where(eq(commercialCustomers.slug, "beta-dynamics")).limit(1))[0]!.id,
    externalId: "grant-beta-ext-1",
    grantType: "trial_extension",
    typeLabel: "Trial extension",
    plan: "growth",
    startedAt: daysAgo(7),
    expiresAt: daysFromNow(7),
    daysLeft: 7,
    grantedBy: "Sarah Chen",
    reason: "Extended evaluation for security review",
  });

  await db.insert(commercialProgrammes).values([
    {
      externalId: "prog-design-partners",
      name: "Design Partners 2026",
      status: "active",
      statusLabel: "Active",
      programmeType: "design_partner",
      description: "Early adopters shaping the product roadmap",
      slotsFilled: 4,
      slotsMax: 8,
      endsAt: "31 Dec 2026",
      monthlyCostPence: 96_000,
      participantInitials: ["CL", "AC", "BD", "NT"],
      participantColors: ["#534AB7", "#378ADD", "#0F6E56", "#EF9F27"],
    },
    {
      externalId: "prog-beta-crm",
      name: "CRM Beta Cohort",
      status: "active",
      statusLabel: "Active",
      programmeType: "beta",
      description: "Forecasting and resource plan early access",
      slotsFilled: 6,
      slotsMax: 10,
      endsAt: "30 Sep 2026",
      monthlyCostPence: 48_000,
      participantInitials: ["AC", "BD", "FW", "TS", "CL", "MK"],
      participantColors: ["#534AB7", "#378ADD", "#0F6E56", "#EF9F27", "#E24B4A", "#639922"],
    },
  ]);

  await db.insert(commercialDiscountRules).values([
    {
      externalId: "disc-first-year",
      name: "20% off first year",
      appliesTo: "Growth plan",
      discount: "20%",
      duration: "12 months",
      whoCanApply: "SI Super Admin",
      automatic: false,
    },
    {
      externalId: "disc-nonprofit",
      name: "Non-profit discount",
      appliesTo: "All plans",
      discount: "15%",
      duration: "Ongoing",
      whoCanApply: "Jiganto Staff",
      automatic: false,
    },
  ]);

  const customerRows = await db.select().from(commercialCustomers);
  const bySlug = Object.fromEntries(customerRows.map((r) => [r.slug, r]));
  await db.insert(commercialInvoices).values([
    {
      externalId: "inv-acme-001",
      customerId: bySlug["acme-corp"]?.id,
      customerName: "Acme Corporation",
      amountPence: planMrrPence("growth"),
      dueDate: daysFromNow(14),
      status: "pending",
    },
    {
      externalId: "inv-northwind-001",
      customerId: bySlug["northwind-traders"]?.id,
      customerName: "Northwind Traders",
      amountPence: planMrrPence("enterprise"),
      dueDate: daysFromNow(21),
      status: "pending",
    },
    {
      externalId: "inv-tailspin-overdue",
      customerId: bySlug["tailspin-toys"]?.id,
      customerName: "Tailspin Toys",
      amountPence: planMrrPence("growth"),
      dueDate: daysAgo(12),
      status: "overdue",
    },
    {
      externalId: "inv-fabrikam-paid",
      customerId: bySlug["fabrikam-inc"]?.id,
      customerName: "Fabrikam Inc",
      amountPence: planMrrPence("starter"),
      dueDate: daysAgo(5),
      status: "paid",
    },
  ]);

  return {
    seeded: true,
    customerCount: CUSTOMERS.length,
    message: `Seeded ${CUSTOMERS.length} commercial customers with trials, programmes, and invoices.`,
  };
}

const isDirectRun = process.argv[1]?.includes("seed-commercial-demo");
if (isDirectRun) {
  seedCommercialDemo()
    .then((r) => {
      console.log(r.message);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
