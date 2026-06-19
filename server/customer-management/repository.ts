import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
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
  profiles,
  type CommercialCustomerRow,
} from "@shared/schema";
import type {
  AccessGrantType,
  BetaProgramme,
  CommercialCustomer,
  CommercialPlanTier,
  CustomerCommercialStatus,
  CustomerDetail,
  CustomerMgmtDashboard,
  CustomerMgmtSettings,
  DiscountRule,
  HealthBand,
  InvoiceRow,
  TrialRow,
  ScheduledCheckInRow,
} from "@shared/models/customer-mgmt";
import { sendGrantAccessEmail } from "./grant-email";
import { resolveLiveUsage, planUsageLimits } from "./usage";
import {
  buildTrialRows,
  computeDashboardMetrics,
  type CustomerActivitySummary,
  type CustomerMetricRow,
} from "./compute-metrics";
import { DEFAULT_COMMERCIAL_SETTINGS } from "./defaults";
import { computeHealthMetrics, weakestSignalLabel } from "./health";

async function loadSettingsOrDefault(): Promise<CustomerMgmtSettings> {
  const settings = await loadSettings();
  if (settings) return settings;

  await db
    .insert(customerMgmtSettings)
    .values({ id: 1, settings: DEFAULT_COMMERCIAL_SETTINGS })
    .onConflictDoNothing();

  return DEFAULT_COMMERCIAL_SETTINGS;
}

function mapCustomerRow(row: CommercialCustomerRow): CommercialCustomer {
  return {
    id: row.externalId,
    slug: row.slug,
    name: row.name,
    initials: row.initials,
    avatarColor: row.avatarColor,
    domain: row.domain ?? "",
    userCount: row.userCount,
    plan: row.plan as CommercialPlanTier,
    status: row.status as CustomerCommercialStatus,
    statusLabel: row.statusLabel,
    mrrPence: row.mrrPence,
    healthScore: row.healthScore,
    healthBand: row.healthBand as HealthBand,
    csmId: row.csmId ?? "",
    csmName: row.csmName ?? "",
    csmInitials: row.csmInitials ?? "",
    nextAction: row.nextAction ?? "",
    nextActionUrgent: row.nextActionUrgent ?? undefined,
    renewalDate: row.renewalDate,
    trialExpiresAt: row.trialExpiresAt,
    trialDaysLeft: row.trialDaysLeft,
    rowHighlight: row.rowHighlight as CommercialCustomer["rowHighlight"],
    activeSince: row.activeSince ?? undefined,
    website: row.website ?? undefined,
  };
}

export async function loadSettings(): Promise<CustomerMgmtSettings | null> {
  const [row] = await db
    .select()
    .from(customerMgmtSettings)
    .where(eq(customerMgmtSettings.id, 1))
    .limit(1);
  return (row?.settings as CustomerMgmtSettings | undefined) ?? null;
}

async function enrichUserCounts(customers: CommercialCustomerRow[]): Promise<CommercialCustomer[]> {
  const mapped = customers.map(mapCustomerRow);
  for (const row of customers) {
    if (!row.tenantId) continue;
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(profiles)
      .where(and(eq(profiles.tenantId, row.tenantId), eq(profiles.isActive, true)));
    const liveCount = countRow?.count ?? 0;
    const target = mapped.find((c) => c.id === row.externalId);
    if (target) target.userCount = liveCount;
  }
  return mapped;
}

function parseRenewalDays(renewalDate?: string | null): number | null {
  if (!renewalDate || renewalDate === "—") return null;
  const parsed = Date.parse(renewalDate.replace(/(\d+) (\w+) (\d+)/, "$2 $1, $3"));
  if (Number.isNaN(parsed)) return null;
  return Math.ceil((parsed - Date.now()) / (1000 * 60 * 60 * 24));
}

function parseDurationDays(label: string): number {
  const lower = label.toLowerCase();
  const n = parseInt(lower, 10) || 1;
  if (lower.includes("week")) return n * 7;
  if (lower.includes("month")) return n * 30;
  if (lower.includes("day")) return n;
  return 14;
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function loadActivitySummaries(
  customerRows: CommercialCustomerRow[],
): Promise<Map<string, CustomerActivitySummary>> {
  const byExternalId = new Map<string, CustomerActivitySummary>();
  if (customerRows.length === 0) return byExternalId;

  const idToExternal = new Map(customerRows.map((r) => [r.id, r.externalId]));
  const cutoff90 = new Date();
  cutoff90.setDate(cutoff90.getDate() - 90);
  const cutoff30 = new Date();
  cutoff30.setDate(cutoff30.getDate() - 30);

  const logs = await db
    .select()
    .from(commercialActivityLog)
    .where(inArray(commercialActivityLog.customerId, customerRows.map((r) => r.id)));

  for (const row of customerRows) {
    byExternalId.set(row.externalId, {
      customerId: row.id,
      externalId: row.externalId,
      lastContactAt: null,
      followUpCount90d: 0,
      convertedIn90d: false,
      convertedEver: false,
      planChangeIn30d: false,
    });
  }

  for (const log of logs) {
    const externalId = idToExternal.get(log.customerId);
    if (!externalId) continue;
    const summary = byExternalId.get(externalId)!;
    const createdAt = log.createdAt ?? new Date();

    if (log.title === "Trial converted to paid") {
      summary.convertedEver = true;
      if (createdAt >= cutoff90) summary.convertedIn90d = true;
    }
    if (log.title === "Plan change scheduled" && createdAt >= cutoff30) {
      summary.planChangeIn30d = true;
    }
    if (
      log.entryType === "call" ||
      log.title.toLowerCase().includes("follow-up") ||
      log.title.toLowerCase().includes("follow up")
    ) {
      if (createdAt >= cutoff90) summary.followUpCount90d += 1;
      if (!summary.lastContactAt || createdAt > summary.lastContactAt) {
        summary.lastContactAt = createdAt;
      }
    }
  }

  return byExternalId;
}

async function enrichCustomersWithLiveHealth(
  customerRows: CommercialCustomerRow[],
  activityByExternalId: Map<string, CustomerActivitySummary>,
): Promise<CustomerMetricRow[]> {
  const base = await enrichUserCounts(customerRows);
  const metrics: CustomerMetricRow[] = [];
  const persist: Array<{
    id: number;
    healthScore: number;
    healthBand: HealthBand;
    healthSignals: ReturnType<typeof computeHealthMetrics>["signals"];
    nextAction: string;
    nextActionUrgent: boolean;
    trialDaysLeft: number | null;
  }> = [];

  for (let i = 0; i < customerRows.length; i++) {
    const row = customerRows[i]!;
    const customer = base[i]!;
    const storedUsage = (row.usage as CustomerDetail["usage"]) ?? null;
    const usage =
      row.tenantId != null
        ? await resolveLiveUsage(row.tenantId, customer.plan, storedUsage)
        : planUsageLimits(customer.plan, storedUsage);

    const activity = activityByExternalId.get(customer.id);
    const renewalDaysAway = parseRenewalDays(customer.renewalDate);
    const trialDaysLeft =
      customer.trialDaysLeft ??
      (customer.trialExpiresAt
        ? Math.max(
            0,
            Math.ceil(
              (Date.parse(customer.trialExpiresAt) - Date.now()) / (1000 * 60 * 60 * 24),
            ),
          )
        : null);

    const health = computeHealthMetrics({
      userUsed: usage.users.used,
      userLimit: usage.users.limit,
      aiUsed: usage.aiTokens.used,
      aiLimit: usage.aiTokens.limit,
      followUpCount90d: activity?.followUpCount90d ?? 0,
      status: customer.status,
      trialDaysLeft,
      renewalDaysAway,
    });

    const nextAction =
      customer.status === "trial" && trialDaysLeft != null && trialDaysLeft <= 7
        ? "Extend trial"
        : health.band === "at_risk"
          ? weakestSignalLabel(health.signals)
          : customer.nextAction || "On track";

    const enriched: CustomerMetricRow = {
      ...customer,
      dbId: row.id,
      createdAt: row.createdAt ?? null,
      healthScore: health.score,
      healthBand: health.band,
      userCount: usage.users.used,
      trialDaysLeft,
      nextAction,
      nextActionUrgent:
        health.band === "at_risk" ||
        (trialDaysLeft != null && trialDaysLeft <= 3) ||
        Boolean(customer.nextActionUrgent),
      rowHighlight:
        health.band === "at_risk" || (trialDaysLeft != null && trialDaysLeft <= 3)
          ? "danger"
          : health.band === "watch" || (trialDaysLeft != null && trialDaysLeft <= 7)
            ? "warn"
            : customer.rowHighlight,
    };

    metrics.push(enriched);
    persist.push({
      id: row.id,
      healthScore: health.score,
      healthBand: health.band,
      healthSignals: health.signals,
      nextAction,
      nextActionUrgent: enriched.nextActionUrgent ?? false,
      trialDaysLeft,
    });
  }

  void Promise.all(
    persist.map((p) =>
      db
        .update(commercialCustomers)
        .set({
          healthScore: p.healthScore,
          healthBand: p.healthBand,
          healthSignals: p.healthSignals,
          nextAction: p.nextAction,
          nextActionUrgent: p.nextActionUrgent,
          trialDaysLeft: p.trialDaysLeft,
          updatedAt: new Date(),
        })
        .where(eq(commercialCustomers.id, p.id)),
    ),
  ).catch((err) => console.warn("[commercial] Health persist failed:", err));

  return metrics;
}

export async function loadScheduledCheckIns(): Promise<ScheduledCheckInRow[]> {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({
      log: commercialActivityLog,
      customer: commercialCustomers,
    })
    .from(commercialActivityLog)
    .innerJoin(commercialCustomers, eq(commercialActivityLog.customerId, commercialCustomers.id))
    .where(eq(commercialActivityLog.entryType, "scheduled_check_in"))
    .orderBy(asc(commercialActivityLog.entryDate));

  return rows
    .filter(({ log }) => log.entryDate != null)
    .map(({ log, customer }) => ({
      id: String(log.id),
      customerId: customer.externalId,
      customerSlug: customer.slug,
      customerName: customer.name,
      initials: customer.initials,
      avatarColor: customer.avatarColor,
      scheduledDate: log.entryDate!,
      note: log.detail,
      csmName: customer.csmName ?? "Unassigned",
      isOverdue: log.entryDate! < today,
    }))
    .sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      return a.scheduledDate.localeCompare(b.scheduledDate);
    });
}

export async function loadDashboardFromDb(): Promise<CustomerMgmtDashboard> {
  const [settings, customerRows, grantRows, programmeRows, invoiceRows, discountRows] =
    await Promise.all([
      loadSettingsOrDefault(),
      db.select().from(commercialCustomers).orderBy(asc(commercialCustomers.name)),
      db
        .select({
          grant: commercialAccessGrants,
          customer: commercialCustomers,
        })
        .from(commercialAccessGrants)
        .innerJoin(commercialCustomers, eq(commercialAccessGrants.customerId, commercialCustomers.id))
        .orderBy(desc(commercialAccessGrants.createdAt)),
      db.select().from(commercialProgrammes).orderBy(asc(commercialProgrammes.name)),
      db.select().from(commercialInvoices).orderBy(desc(commercialInvoices.dueDate)),
      db.select().from(commercialDiscountRules).orderBy(asc(commercialDiscountRules.name)),
    ]);

  const activityByExternalId = await loadActivitySummaries(customerRows);
  const customers = await enrichCustomersWithLiveHealth(customerRows, activityByExternalId);

  const grantTrials: TrialRow[] = grantRows.map(({ grant, customer }) => {
    const daysLeft =
      grant.daysLeft ??
      (grant.expiresAt
        ? Math.max(
            0,
            Math.ceil((Date.parse(grant.expiresAt) - Date.now()) / (1000 * 60 * 60 * 24)),
          )
        : 0);
    return {
      id: grant.externalId,
      customerId: customer.externalId,
      customerName: customer.name,
      initials: customer.initials,
      avatarColor: customer.avatarColor,
      type: grant.grantType as TrialRow["type"],
      typeLabel: grant.typeLabel,
      plan: grant.plan as CommercialPlanTier,
      startedAt: grant.startedAt ?? "",
      expiresAt: grant.expiresAt ?? "",
      daysLeft,
      grantedBy: grant.grantedBy ?? "",
      reason: grant.reason ?? "",
      rowHighlight:
        daysLeft <= 3 ? "danger" : daysLeft <= 7 ? "warn" : (grant.rowHighlight as TrialRow["rowHighlight"]),
    };
  });

  const trials = buildTrialRows(customers, grantTrials);

  const programmes: BetaProgramme[] = programmeRows.map((p) => ({
    id: p.externalId,
    name: p.name,
    status: p.status as BetaProgramme["status"],
    statusLabel: p.statusLabel,
    programmeType: p.programmeType as BetaProgramme["programmeType"],
    description: p.description ?? "",
    slotsFilled: p.slotsFilled,
    slotsMax: p.slotsMax,
    endsAt: p.endsAt ?? "",
    monthlyCostPence: p.monthlyCostPence,
    participantInitials: (p.participantInitials as string[]) ?? [],
    participantColors: (p.participantColors as string[]) ?? [],
    extraParticipants: p.extraParticipants ?? undefined,
  }));

  const recentInvoices: InvoiceRow[] = invoiceRows.map((inv) => ({
    id: inv.externalId,
    customerName: inv.customerName,
    amountPence: inv.amountPence,
    dueDate: inv.dueDate,
    status: inv.status as InvoiceRow["status"],
  }));

  const discountRules: DiscountRule[] = discountRows.map((d) => ({
    id: d.externalId,
    name: d.name,
    appliesTo: d.appliesTo,
    discount: d.discount,
    duration: d.duration,
    whoCanApply: d.whoCanApply,
    automatic: d.automatic,
  }));

  const dashboard = computeDashboardMetrics({
    customers,
    trials,
    programmes,
    recentInvoices,
    discountRules,
    settings,
    activityByExternalId,
  });

  return {
    ...dashboard,
    health: {
      ...dashboard.health,
      scheduledCheckIns: await loadScheduledCheckIns(),
    },
  };
}

export async function loadCustomerDetailFromDb(slug: string): Promise<CustomerDetail | null> {
  const [row] = await db
    .select()
    .from(commercialCustomers)
    .where(eq(commercialCustomers.slug, slug))
    .limit(1);
  if (!row) return null;

  const [contacts, flags, activity] = await Promise.all([
    db
      .select()
      .from(commercialContacts)
      .where(eq(commercialContacts.customerId, row.id))
      .orderBy(asc(commercialContacts.id)),
    db
      .select()
      .from(commercialFeatureFlags)
      .where(eq(commercialFeatureFlags.customerId, row.id))
      .orderBy(asc(commercialFeatureFlags.flagKey)),
    db
      .select()
      .from(commercialActivityLog)
      .where(eq(commercialActivityLog.customerId, row.id))
      .orderBy(desc(commercialActivityLog.createdAt)),
  ]);

  const [enriched] = await enrichUserCounts([row]);
  const activityByExternalId = await loadActivitySummaries([row]);
  const [metricRow] = await enrichCustomersWithLiveHealth([row], activityByExternalId);
  const base = metricRow ?? enriched!;

  const storedUsage = (row.usage as CustomerDetail["usage"]) ?? null;
  const usage =
    row.tenantId != null
      ? await resolveLiveUsage(row.tenantId, base.plan as CommercialPlanTier, storedUsage)
      : planUsageLimits(base.plan, storedUsage);

  const healthRow = await db
    .select({ healthSignals: commercialCustomers.healthSignals })
    .from(commercialCustomers)
    .where(eq(commercialCustomers.id, row.id))
    .limit(1);

  return {
    ...base,
    subscription: (row.subscription as CustomerDetail["subscription"]) ?? {
      plan: base.plan,
      mrrPence: base.mrrPence ?? 0,
      billingCycle: "Monthly",
      renewalDate: base.renewalDate ?? "—",
      discountLabel: null,
      paymentMethod: row.stripeCustomerId ? "Stripe" : "Offline",
    },
    usage,
    healthSignals: (healthRow[0]?.healthSignals as CustomerDetail["healthSignals"]) ?? [],
    contacts: contacts.map((c) => ({
      id: String(c.id),
      name: c.name,
      email: c.email ?? "",
      initials: c.initials,
      avatarColor: c.avatarColor,
      roleLabel: c.roleLabel,
      roleVariant: (c.roleVariant ?? "gray") as "purple" | "blue" | "gray" | "green",
    })),
    featureFlags: flags.map((f) => ({
      key: f.flagKey,
      name: f.name,
      description: f.description ?? "",
      enabled: f.enabled,
    })),
    activityLog: activity.map((a) => ({
      id: String(a.id),
      type: a.entryType ?? "event",
      title: a.title,
      detail: a.detail,
      date: a.entryDate ?? "",
      dotColor: a.dotColor ?? "#534AB7",
    })),
  };
}

export async function updateSettingsInDb(
  patch: Partial<CustomerMgmtSettings>,
): Promise<CustomerMgmtSettings> {
  const current = (await loadSettings()) ?? ({} as CustomerMgmtSettings);
  const next = { ...current, ...patch };
  await db
    .insert(customerMgmtSettings)
    .values({ id: 1, settings: next })
    .onConflictDoUpdate({
      target: customerMgmtSettings.id,
      set: { settings: next, updatedAt: new Date() },
    });
  return next;
}

export async function toggleFeatureFlagInDb(
  slug: string,
  flagKey: string,
  enabled: boolean,
): Promise<CustomerDetail | null> {
  const [customer] = await db
    .select({ id: commercialCustomers.id })
    .from(commercialCustomers)
    .where(eq(commercialCustomers.slug, slug))
    .limit(1);
  if (!customer) return null;

  await db
    .update(commercialFeatureFlags)
    .set({ enabled })
    .where(
      and(
        eq(commercialFeatureFlags.customerId, customer.id),
        eq(commercialFeatureFlags.flagKey, flagKey),
      ),
    );

  return loadCustomerDetailFromDb(slug);
}

export interface GrantAccessInput {
  customerId: string;
  customerName: string;
  grantType: AccessGrantType;
  durationLabel: string;
  startLabel: string;
  reason: string;
  grantedByName: string;
  notifyCustomer: boolean;
}

export async function applyAccessGrantInDb(input: GrantAccessInput): Promise<void> {
  const now = new Date().toISOString().slice(0, 10);
  const [customer] = await db
    .select()
    .from(commercialCustomers)
    .where(eq(commercialCustomers.externalId, input.customerId))
    .limit(1);

  if (customer) {
    const durationDays = parseDurationDays(input.durationLabel);
    const expiresAt = addDaysIso(durationDays);

    await db.insert(commercialActivityLog).values({
      customerId: customer.id,
      entryType: input.grantType,
      title:
        input.grantType === "trial_extension"
          ? `Trial extended (${input.durationLabel})`
          : input.grantType === "free_access"
            ? `${input.durationLabel} free access granted`
            : "Enrolled in beta programme",
      detail: `by ${input.grantedByName} — "${input.reason}" · ${now}`,
      entryDate: now,
      dotColor: "#EF9F27",
    });

    await db.insert(commercialAccessGrants).values({
      customerId: customer.id,
      externalId: `t-${Date.now()}`,
      grantType:
        input.grantType === "trial_extension"
          ? "extended"
          : input.grantType === "free_access"
            ? "free_access"
            : "free_access",
      typeLabel:
        input.grantType === "trial_extension"
          ? "Extended"
          : input.grantType === "free_access"
            ? "Free access"
            : "Beta",
      plan: customer.plan,
      startedAt: now,
      expiresAt,
      daysLeft: durationDays,
      grantedBy: input.grantedByName,
      reason: input.reason,
    });

    await db
      .update(commercialCustomers)
      .set({
        trialExpiresAt: expiresAt,
        trialDaysLeft: durationDays,
        status: input.grantType === "free_access" ? "free_access" : customer.status,
        statusLabel:
          input.grantType === "free_access"
            ? "Free access"
            : input.grantType === "trial_extension"
              ? `Trial — ${durationDays}d left`
              : customer.statusLabel,
        updatedAt: new Date(),
      })
      .where(eq(commercialCustomers.id, customer.id));
  }

  if (input.notifyCustomer && customer) {
    await sendGrantAccessEmail({
      customerExternalId: input.customerId,
      customerName: input.customerName,
      grantType: input.grantType,
      durationLabel: input.durationLabel,
      startLabel: input.startLabel,
      expiresAtLabel: input.startLabel,
      grantedByName: input.grantedByName,
    });
  }
}

export interface CreateProgrammeInput {
  name: string;
  programmeType: string;
  compensation: string;
  planScope: string;
  maxParticipants: number;
  enrolment: string;
  endsAt: string;
}

export async function createProgrammeInDb(input: CreateProgrammeInput) {
  const settings = await loadSettingsOrDefault();
  const [programmeRows, customerRows] = await Promise.all([
    db.select().from(commercialProgrammes),
    db.select({ mrrPence: commercialCustomers.mrrPence }).from(commercialCustomers),
  ]);

  const freeAccessCostPence = programmeRows.reduce((sum, p) => sum + p.monthlyCostPence, 0);
  const mrrPence = customerRows.reduce((sum, c) => sum + (c.mrrPence ?? 0), 0);
  const percent = mrrPence > 0 ? (freeAccessCostPence / mrrPence) * 100 : 0;
  const threshold = settings.freeAccessThresholdPercent;
  const breached = threshold != null && percent >= threshold;

  if (settings.blockNewProgrammesOverThreshold && breached) {
    throw new Error(
      "Cannot create programmes while free access cost is over the configured threshold.",
    );
  }

  const externalId = `prog-${Date.now()}`;
  const [programme] = await db
    .insert(commercialProgrammes)
    .values({
      externalId,
      name: input.name,
      status: "active",
      statusLabel: "Active",
      programmeType: "beta_testing",
      description: `${input.programmeType.split("—")[0]?.trim() ?? input.programmeType} · ${input.compensation} · ${input.planScope}`,
      slotsFilled: 0,
      slotsMax: input.maxParticipants,
      endsAt: input.endsAt,
      monthlyCostPence: 0,
      participantInitials: [],
      participantColors: [],
    })
    .returning();

  return {
    id: externalId,
    name: programme!.name,
    status: "active" as const,
    statusLabel: programme!.statusLabel,
    programmeType: "beta_testing" as const,
    description: programme!.description ?? "",
    slotsFilled: 0,
    slotsMax: programme!.slotsMax,
    endsAt: programme!.endsAt ?? "",
    monthlyCostPence: 0,
    participantInitials: [] as string[],
    participantColors: [] as string[],
  };
}

export async function canGrantAccessFromDb(
  platformRole: string | undefined,
  grantType: AccessGrantType,
): Promise<boolean> {
  const settings = await loadSettings();
  if (!settings) return platformRole === "jiganto_staff";
  if (platformRole === "jiganto_staff") return true;
  if (platformRole !== "si_super_admin") return false;

  if (grantType === "trial_extension") {
    return (
      settings.grantTrialExtensions === "super_admin_commercial" ||
      settings.grantTrialExtensions === "super_admin_only" ||
      settings.grantTrialExtensions === "any_si_admin"
    );
  }
  if (grantType === "free_access") {
    return (
      settings.grantFreeAccess === "super_admin_only" ||
      settings.grantFreeAccess === "super_admin_commercial"
    );
  }
  return (
    settings.createBetaProgrammes === "super_admin_only" ||
    settings.createBetaProgrammes === "super_admin_commercial"
  );
}
