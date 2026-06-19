import type {
  BetaProgramme,
  CommercialCustomer,
  CommercialPlanTier,
  CustomerMgmtDashboard,
  CustomerMgmtSettings,
  DiscountRule,
  InvoiceRow,
  TrialRow,
} from "@shared/models/customer-mgmt";
import { withPlanMrrPence } from "./pricing";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface CustomerActivitySummary {
  customerId: number;
  externalId: string;
  lastContactAt: Date | null;
  followUpCount90d: number;
  convertedIn90d: boolean;
  convertedEver: boolean;
  planChangeIn30d: boolean;
}

export interface CustomerMetricRow extends CommercialCustomer {
  dbId: number;
  createdAt: Date | null;
}

function sumMrr(customers: CommercialCustomer[]): number {
  return customers.reduce((sum, c) => sum + (c.mrrPence ?? 0), 0);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysAgo(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function parseRenewalDays(renewalDate?: string | null): number | null {
  if (!renewalDate || renewalDate === "—") return null;
  const parsed = Date.parse(renewalDate.replace(/(\d+) (\w+) (\d+)/, "$2 $1, $3"));
  if (Number.isNaN(parsed)) return null;
  return Math.ceil((parsed - Date.now()) / (1000 * 60 * 60 * 24));
}

function parseTrialDaysLeft(expiresAt?: string | null, stored?: number | null): number | null {
  if (stored != null) return stored;
  if (!expiresAt || expiresAt === "—") return null;
  const parsed = Date.parse(expiresAt);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.ceil((parsed - Date.now()) / (1000 * 60 * 60 * 24)));
}

function isWithinDays(date: Date | null, days: number): boolean {
  if (!date) return false;
  return daysAgo(date) <= days;
}

function isInCurrentMonth(date: Date | null): boolean {
  if (!date) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function monthEnd(year: number, month: number): Date {
  return new Date(year, month + 1, 0, 23, 59, 59, 999);
}

export function buildTrialRows(
  customers: CommercialCustomer[],
  grantRows: TrialRow[],
): TrialRow[] {
  const byCustomer = new Map<string, TrialRow>();
  for (const row of grantRows) {
    byCustomer.set(row.customerId, row);
  }

  for (const c of customers) {
    if (c.status !== "trial" && c.status !== "free_access") continue;
    if (byCustomer.has(c.id)) continue;

    const daysLeft = parseTrialDaysLeft(c.trialExpiresAt, c.trialDaysLeft);
    byCustomer.set(c.id, {
      id: `status-${c.id}`,
      customerId: c.id,
      customerName: c.name,
      initials: c.initials,
      avatarColor: c.avatarColor,
      type: c.status === "free_access" ? "free_access" : "trial",
      typeLabel: c.status === "free_access" ? "Free access" : "Standard trial",
      plan: c.plan,
      startedAt: c.activeSince ?? "—",
      expiresAt: c.trialExpiresAt ?? "—",
      daysLeft: daysLeft ?? 0,
      grantedBy: "System",
      reason: c.statusLabel,
      rowHighlight:
        daysLeft != null && daysLeft <= 3
          ? "danger"
          : daysLeft != null && daysLeft <= 7
            ? "warn"
            : undefined,
    });
  }

  return Array.from(byCustomer.values()).sort((a, b) => a.daysLeft - b.daysLeft);
}

export function computeDashboardMetrics(params: {
  customers: CustomerMetricRow[];
  trials: TrialRow[];
  programmes: BetaProgramme[];
  recentInvoices: InvoiceRow[];
  discountRules: DiscountRule[];
  settings: CustomerMgmtSettings;
  activityByExternalId: Map<string, CustomerActivitySummary>;
}): CustomerMgmtDashboard {
  const { customers, trials, programmes, recentInvoices, discountRules, settings, activityByExternalId } =
    params;

  const mrrPence = sumMrr(customers);
  const arrPence = mrrPence * 12;
  const activeCustomers = customers.filter((c) => c.status === "active").length;
  const onTrial = customers.filter((c) => c.status === "trial" || c.status === "free_access").length;
  const trialExpiringThisWeek = trials.filter((t) => t.daysLeft <= 7).length;
  const atRiskCount = customers.filter((c) => c.healthBand === "at_risk").length;
  const healthy = customers.filter((c) => c.healthBand === "healthy").length;
  const watch = customers.filter((c) => c.healthBand === "watch").length;
  const atRisk = customers.filter((c) => c.healthBand === "at_risk").length;
  const averageScore =
    customers.length > 0
      ? Math.round(customers.reduce((s, c) => s + c.healthScore, 0) / customers.length)
      : 0;

  const newMrrThisMonth = customers
    .filter((c) => c.status === "active" && (c.mrrPence ?? 0) > 0 && isInCurrentMonth(c.createdAt))
    .reduce((s, c) => s + (c.mrrPence ?? 0), 0);

  const convertedMrrThisMonth = customers
    .filter((c) => {
      const activity = activityByExternalId.get(c.id);
      return (
        c.status === "active" &&
        (c.mrrPence ?? 0) > 0 &&
        activity?.convertedIn90d &&
        isInCurrentMonth(c.createdAt)
      );
    })
    .reduce((s, c) => s + (c.mrrPence ?? 0), 0);

  const newBusinessMrr30d = customers
    .filter(
      (c) =>
        c.status === "active" &&
        (c.mrrPence ?? 0) > 0 &&
        (isWithinDays(c.createdAt, 30) || activityByExternalId.get(c.id)?.convertedIn90d),
    )
    .reduce((s, c) => s + (c.mrrPence ?? 0), 0);

  const baseMrr = Math.max(0, mrrPence - newBusinessMrr30d);
  const mrrMomPercent =
    baseMrr > 0 ? Math.round((newBusinessMrr30d / baseMrr) * 1000) / 10 : newBusinessMrr30d > 0 ? 100 : 0;

  const freeAccessCostPence = programmes.reduce((sum, p) => sum + p.monthlyCostPence, 0);
  const freeAccessCostPercent =
    mrrPence > 0 ? Math.round((freeAccessCostPence / mrrPence) * 1000) / 10 : 0;
  const threshold = settings.freeAccessThresholdPercent;
  const thresholdBreached = threshold != null && freeAccessCostPercent >= threshold;

  const overdueInvoices = recentInvoices.filter((i) => i.status === "overdue");
  const overdueAmountPence = overdueInvoices.reduce((s, i) => s + i.amountPence, 0);

  const revenueByPlan: CustomerMgmtDashboard["billing"]["revenueByPlan"] = (
    ["enterprise", "growth", "starter"] as CommercialPlanTier[]
  ).map((tier) => {
    const amountPence = customers
      .filter((c) => c.plan === tier)
      .reduce((s, c) => s + (c.mrrPence ?? 0), 0);
    return {
      tier,
      label: tier.charAt(0).toUpperCase() + tier.slice(1),
      amountPence,
      percent: mrrPence > 0 ? Math.round((amountPence / mrrPence) * 100) : 0,
    };
  });

  const now = new Date();
  const mrrTrend: CustomerMgmtDashboard["billing"]["mrrTrend"] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = monthEnd(d.getFullYear(), d.getMonth());
    const amountPence = customers
      .filter(
        (c) =>
          c.status === "active" &&
          (c.mrrPence ?? 0) > 0 &&
          c.createdAt != null &&
          c.createdAt <= end,
      )
      .reduce((s, c) => s + (c.mrrPence ?? 0), 0);
    mrrTrend.push({
      month: MONTH_LABELS[d.getMonth()]!,
      amountPence,
    });
  }

  const renewalRows = customers
    .filter((c) => c.renewalDate && c.status === "active")
    .map((c) => {
      const daysAway = parseRenewalDays(c.renewalDate) ?? 999;
      const atRiskRenewal = c.healthBand === "at_risk";
      return {
        id: `ren-${c.id}`,
        customerId: c.id,
        customerName: c.name,
        initials: c.initials,
        avatarColor: c.avatarColor,
        plan: c.plan,
        mrrPence: c.mrrPence ?? 0,
        healthBand: c.healthBand,
        csmName: c.csmName,
        renewalDate: c.renewalDate ?? "—",
        daysAway,
        statusLabel: atRiskRenewal ? "At risk" : daysAway <= 30 ? "Due soon" : "On track",
        statusVariant: (atRiskRenewal ? "red" : daysAway <= 30 ? "amber" : "green") as
          | "green"
          | "amber"
          | "red",
        actionLabel: atRiskRenewal ? "Urgent renewal call" : daysAway <= 30 ? "Review renewal" : "View account",
        actionVariant: (atRiskRenewal ? "danger" : daysAway <= 30 ? "primary" : "ghost") as
          | "primary"
          | "ghost"
          | "danger",
        rowHighlight: atRiskRenewal ? ("warn" as const) : undefined,
      };
    })
    .filter((r) => r.daysAway >= 0 && r.daysAway <= 90)
    .sort((a, b) => a.daysAway - b.daysAway);

  const renewing30 = renewalRows.filter((r) => r.daysAway >= 0 && r.daysAway <= 30);
  const renewing31To90 = renewalRows.filter((r) => r.daysAway > 30 && r.daysAway <= 90);

  const attentionRows = customers
    .filter((c) => c.healthBand !== "healthy")
    .sort((a, b) => a.healthScore - b.healthScore)
    .slice(0, 20)
    .map((c) => {
      const activity = activityByExternalId.get(c.id);
      const lastContactDays = activity?.lastContactAt ? daysAgo(activity.lastContactAt) : null;
      return {
        customerId: c.id,
        customerName: c.name,
        initials: c.initials,
        avatarColor: c.avatarColor,
        band: c.healthBand,
        score: c.healthScore,
        primarySignal: c.nextAction || "Review account health",
        csmName: c.csmName,
        csmInitials: c.csmInitials,
        csmColor: c.avatarColor,
        lastContactDays: lastContactDays ?? 999,
        lastContactUrgent: lastContactDays == null || lastContactDays > 14,
        actionLabel: c.nextActionUrgent ? "Urgent follow-up" : "Schedule check-in",
        actionVariant: (c.nextActionUrgent ? "danger" : "ghost") as "danger" | "ghost",
        rowHighlight: c.rowHighlight,
      };
    });

  const standardTrials = trials.filter((t) => t.type === "trial").length;
  const adminExtensions = trials.filter((t) => t.type === "extended").length;
  const freeAccessPeriods = trials.filter((t) => t.type === "free_access").length;

  const trialsStarted90d = customers.filter((c) => isWithinDays(c.createdAt, 90)).length;
  const converted90d = Array.from(activityByExternalId.values()).filter((a) => a.convertedIn90d).length;
  const conversionRate90d =
    trialsStarted90d > 0 ? Math.round((converted90d / trialsStarted90d) * 100) : converted90d > 0 ? 100 : 0;
  const conversionDelta =
    converted90d > 0
      ? `${converted90d} conversion${converted90d === 1 ? "" : "s"} in 90 days`
      : "No conversions in 90 days";

  const convertedToPaid = Array.from(activityByExternalId.values()).filter((a) => a.convertedEver).length;

  const renewingWithHealth = renewalRows.filter((r) => r.daysAway <= 90);
  const expectedRenewalRate =
    renewingWithHealth.length > 0
      ? Math.round(
          (renewingWithHealth.filter((r) => r.healthBand !== "at_risk").length /
            renewingWithHealth.length) *
            100,
        )
      : 100;

  const churnMrrPence = customers
    .filter((c) => c.status === "suspended" && (c.mrrPence ?? 0) > 0)
    .reduce((s, c) => s + (c.mrrPence ?? 0), 0);
  const churnCount = customers.filter((c) => c.status === "suspended").length;

  const expansionCount = customers.filter((c) => activityByExternalId.get(c.id)?.planChangeIn30d).length;
  const expansionMrrPence = 0;

  const netNewMrrPence = newMrrThisMonth + convertedMrrThisMonth + expansionMrrPence - churnMrrPence;

  const pricingPlans = withPlanMrrPence(settings.pricingPlans ?? []);

  return {
    overview: {
      kpis: {
        activeCustomers,
        activeCustomersDelta:
          customers.length > 0 ? `${customers.length} organisation${customers.length === 1 ? "" : "s"} total` : "No customers yet",
        onTrial,
        trialExpiringThisWeek,
        mrrPence,
        mrrMomPercent,
        atRiskCount,
      },
      customers: customers.map(({ dbId: _dbId, createdAt: _createdAt, ...c }) => c),
    },
    health: {
      healthy,
      watch,
      atRisk,
      averageScore,
      averageDelta:
        customers.length > 0
          ? `${healthy} healthy · ${watch} watch · ${atRisk} at risk`
          : "No customers yet",
      scheduledCheckIns: [],
      attentionRows,
    },
    trials: {
      kpis: {
        standardTrials,
        adminExtensions,
        freeAccessPeriods,
        expiringThisWeek: trialExpiringThisWeek,
        conversionRate90d,
        conversionDelta,
      },
      rows: trials,
    },
    programmes: {
      kpis: {
        activeProgrammes: programmes.filter((p) => p.status === "active").length,
        totalParticipants: programmes.reduce((s, p) => s + p.slotsFilled, 0),
        freeAccessCostPence,
        freeAccessCostPercent,
        convertedToPaid,
      },
      programmes,
      thresholdBreached,
      thresholdPercent: threshold ?? 0,
    },
    renewals: {
      kpis: {
        renewing30DaysPence: renewing30.reduce((s, r) => s + r.mrrPence, 0),
        renewing31To90DaysPence: renewing31To90.reduce((s, r) => s + r.mrrPence, 0),
        atRiskRenewals: renewalRows.filter((r) => r.daysAway <= 30 && r.healthBand === "at_risk").length,
        expectedRenewalRate,
      },
      rows: renewalRows,
    },
    pricing: {
      plans: pricingPlans,
      discountRules,
    },
    billing: {
      mrrPence,
      mrrMomPercent,
      arrPence,
      overdueInvoices: overdueInvoices.length,
      overdueAmountPence,
      freeAccessCostPence,
      freeAccessCostPercent,
      thresholdBreached,
      revenueByPlan,
      mrrTrend,
      recentInvoices,
      waterfall: {
        newMrrPence: newMrrThisMonth + convertedMrrThisMonth,
        newCount: customers.filter(
          (c) =>
            c.status === "active" &&
            (c.mrrPence ?? 0) > 0 &&
            (isInCurrentMonth(c.createdAt) || activityByExternalId.get(c.id)?.convertedIn90d),
        ).length,
        expansionMrrPence,
        expansionCount,
        churnMrrPence,
        churnCount,
        netNewMrrPence,
      },
    },
    settings: { ...settings, pricingPlans },
  };
}
