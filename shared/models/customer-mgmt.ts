/** Module 0 — Jiganto commercial customer management (internal admin). */

export type CommercialPlanTier = "starter" | "growth" | "enterprise";
export type CustomerCommercialStatus =
  | "active"
  | "trial"
  | "free_access"
  | "suspended";

export type HealthBand = "healthy" | "watch" | "at_risk";

export type AccessGrantType = "trial_extension" | "free_access" | "beta_programme";

export type BetaProgrammeType =
  | "beta_testing"
  | "early_access"
  | "design_partner"
  | "market_research";

export interface CommercialCustomer {
  id: string;
  slug: string;
  name: string;
  initials: string;
  avatarColor: string;
  domain: string;
  userCount: number;
  plan: CommercialPlanTier;
  status: CustomerCommercialStatus;
  statusLabel: string;
  mrrPence: number | null;
  healthScore: number;
  healthBand: HealthBand;
  csmId: string;
  csmName: string;
  csmInitials: string;
  nextAction: string;
  nextActionUrgent?: boolean;
  renewalDate: string | null;
  trialExpiresAt: string | null;
  trialDaysLeft: number | null;
  rowHighlight?: "warn" | "danger";
  activeSince?: string;
  website?: string;
}

export interface HealthSignal {
  key: string;
  label: string;
  score: number;
}

export interface CustomerContact {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatarColor: string;
  roleLabel: string;
  roleVariant: "purple" | "blue" | "gray" | "green";
}

export interface CustomerFeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface ActivityLogEntry {
  id: string;
  type: string;
  title: string;
  detail: string;
  date: string;
  dotColor: string;
}

export interface CustomerSubscription {
  plan: CommercialPlanTier;
  mrrPence: number;
  billingCycle: string;
  renewalDate: string;
  discountLabel: string | null;
  paymentMethod: string;
}

export interface CustomerUsage {
  users: { used: number; limit: number };
  aiTokens: { used: number; limit: number };
  storageGb: { used: number; limit: number };
  esignDocs: { used: number; limit: number };
}

export interface CustomerDetail extends CommercialCustomer {
  subscription: CustomerSubscription;
  usage: CustomerUsage;
  healthSignals: HealthSignal[];
  contacts: CustomerContact[];
  featureFlags: CustomerFeatureFlag[];
  activityLog: ActivityLogEntry[];
}

export interface TrialRow {
  id: string;
  customerId: string;
  customerName: string;
  initials: string;
  avatarColor: string;
  type: "trial" | "extended" | "free_access";
  typeLabel: string;
  plan: CommercialPlanTier;
  startedAt: string;
  expiresAt: string;
  daysLeft: number;
  grantedBy: string;
  reason: string;
  rowHighlight?: "warn" | "danger";
}

export interface BetaProgramme {
  id: string;
  name: string;
  status: "active" | "draft" | "ended";
  statusLabel: string;
  programmeType: BetaProgrammeType;
  description: string;
  slotsFilled: number;
  slotsMax: number;
  endsAt: string;
  monthlyCostPence: number;
  participantInitials: string[];
  participantColors: string[];
  extraParticipants?: number;
}

export interface RenewalRow {
  id: string;
  customerId: string;
  customerName: string;
  initials: string;
  avatarColor: string;
  plan: CommercialPlanTier;
  mrrPence: number;
  healthBand: HealthBand;
  csmName: string;
  renewalDate: string;
  daysAway: number;
  statusLabel: string;
  statusVariant: "green" | "amber" | "red";
  actionLabel: string;
  actionVariant: "primary" | "ghost" | "danger";
  rowHighlight?: "warn" | "danger";
}

export interface PricingPlan {
  tier: CommercialPlanTier;
  name: string;
  priceLabel: string;
  /** Monthly price in pence; derived from priceLabel when omitted. */
  mrrPence?: number | null;
  popular?: boolean;
  features: string;
}

export interface DiscountRule {
  id: string;
  name: string;
  appliesTo: string;
  discount: string;
  duration: string;
  whoCanApply: string;
  automatic: boolean;
}

export interface InvoiceRow {
  id: string;
  customerName: string;
  amountPence: number;
  dueDate: string;
  status: "paid" | "overdue" | "pending";
}

export interface MrrWaterfall {
  newMrrPence: number;
  newCount: number;
  expansionMrrPence: number;
  expansionCount: number;
  churnMrrPence: number;
  churnCount: number;
  netNewMrrPence: number;
}

export interface CustomerMgmtSettings {
  defaultTrialDays: number;
  requireCreditCardForTrial: boolean;
  allowSelfServeSignup: boolean;
  allowCustomerExtension: boolean;
  notify7DaysBefore: boolean;
  notify1DayBefore: boolean;
  autoSuspendOnExpiry: boolean;
  grantTrialExtensions: "super_admin_commercial" | "super_admin_only" | "any_si_admin";
  grantFreeAccess: "super_admin_only" | "super_admin_commercial";
  createBetaProgrammes: "super_admin_only" | "super_admin_commercial";
  applyManualDiscounts: "super_admin_commercial" | "super_admin_only";
  suspendCustomer: "super_admin_only";
  maxExtensionWithoutCeo: "1_month" | "3_months" | "6_months" | "no_limit";
  requireGrantReason: boolean;
  freeAccessThresholdPercent: number | null;
  freeAccessAlertRecipients: "super_admin_commercial" | "super_admin_only";
  freeAccessAlertFrequency: "daily" | "once" | "weekly";
  showBillingCostAlert: boolean;
  showProgrammesCostAlert: boolean;
  blockNewProgrammesOverThreshold: boolean;
  invoiceDueDays: number;
  autoRetryPayments: boolean;
  retrySchedule: string;
  suspendOnThirdFailedPayment: boolean;
  paymentProcessor: string;
  /** Optional override of catalogue plans stored in settings JSON. */
  pricingPlans?: PricingPlan[];
}

export interface CustomerMgmtOverview {
  kpis: {
    activeCustomers: number;
    activeCustomersDelta: string;
    onTrial: number;
    trialExpiringThisWeek: number;
    mrrPence: number;
    mrrMomPercent: number;
    atRiskCount: number;
  };
  customers: CommercialCustomer[];
}

export interface ScheduledCheckInRow {
  id: string;
  customerId: string;
  customerSlug: string;
  customerName: string;
  initials: string;
  avatarColor: string;
  scheduledDate: string;
  note: string;
  csmName: string;
  isOverdue: boolean;
}

export interface CustomerMgmtDashboard {
  overview: CustomerMgmtOverview;
  health: {
    healthy: number;
    watch: number;
    atRisk: number;
    averageScore: number;
    averageDelta: string;
    scheduledCheckIns: ScheduledCheckInRow[];
    attentionRows: Array<{
      customerId: string;
      customerName: string;
      initials: string;
      avatarColor: string;
      band: HealthBand;
      score: number;
      primarySignal: string;
      csmName: string;
      csmInitials: string;
      csmColor: string;
      lastContactDays: number;
      lastContactUrgent: boolean;
      actionLabel: string;
      actionVariant: "danger" | "ghost";
      rowHighlight?: "warn" | "danger";
    }>;
  };
  trials: {
    kpis: {
      standardTrials: number;
      adminExtensions: number;
      freeAccessPeriods: number;
      expiringThisWeek: number;
      conversionRate90d: number;
      conversionDelta: string;
    };
    rows: TrialRow[];
  };
  programmes: {
    kpis: {
      activeProgrammes: number;
      totalParticipants: number;
      freeAccessCostPence: number;
      freeAccessCostPercent: number;
      convertedToPaid: number;
    };
    programmes: BetaProgramme[];
    thresholdBreached: boolean;
    thresholdPercent: number;
  };
  renewals: {
    kpis: {
      renewing30DaysPence: number;
      renewing31To90DaysPence: number;
      atRiskRenewals: number;
      expectedRenewalRate: number;
    };
    rows: RenewalRow[];
  };
  pricing: {
    plans: PricingPlan[];
    discountRules: DiscountRule[];
  };
  billing: {
    mrrPence: number;
    mrrMomPercent: number;
    arrPence: number;
    overdueInvoices: number;
    overdueAmountPence: number;
    freeAccessCostPence: number;
    freeAccessCostPercent: number;
    thresholdBreached: boolean;
    revenueByPlan: Array<{ tier: CommercialPlanTier; label: string; amountPence: number; percent: number }>;
    mrrTrend: Array<{ month: string; amountPence: number }>;
    recentInvoices: InvoiceRow[];
    waterfall: MrrWaterfall;
  };
  settings: CustomerMgmtSettings;
}

export const GRANT_TYPE_DESCRIPTIONS: Record<AccessGrantType, string> = {
  trial_extension:
    "Extends an active trial. The customer stays on free access for the additional duration. Use when a prospect needs more time to evaluate before committing.",
  free_access:
    "Gives an existing paying customer a period of free access as a credit or goodwill gesture. Their subscription continues but they are not billed for the chosen period.",
  beta_programme:
    "Enrols this organisation in a beta or early access programme. Free access is granted for the programme duration in exchange for testing, feedback, or research participation.",
};

export function formatGbp(pence: number, compact = false): string {
  const pounds = pence / 100;
  if (compact && pounds >= 1000) {
    return `£${(pounds / 1000).toFixed(pounds % 1000 === 0 ? 0 : 1)}k`;
  }
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: pounds % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(pounds);
}

export function planBadgeClass(tier: CommercialPlanTier): string {
  switch (tier) {
    case "starter":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
    case "growth":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "enterprise":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
  }
}

export function healthBandLabel(band: HealthBand, score: number): string {
  switch (band) {
    case "healthy":
      return `Healthy · ${score}`;
    case "watch":
      return `Watch · ${score}`;
    case "at_risk":
      return `At risk · ${score}`;
  }
}
