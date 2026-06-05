import type { CustomerMgmtSettings, PricingPlan } from "@shared/models/customer-mgmt";

export const DEFAULT_COMMERCIAL_SETTINGS: CustomerMgmtSettings = {
  defaultTrialDays: 30,
  requireCreditCardForTrial: false,
  allowSelfServeSignup: true,
  allowCustomerExtension: false,
  notify7DaysBefore: true,
  notify1DayBefore: true,
  autoSuspendOnExpiry: true,
  grantTrialExtensions: "super_admin_commercial",
  grantFreeAccess: "super_admin_commercial",
  createBetaProgrammes: "super_admin_commercial",
  applyManualDiscounts: "super_admin_commercial",
  suspendCustomer: "super_admin_only",
  maxExtensionWithoutCeo: "3_months",
  requireGrantReason: true,
  freeAccessThresholdPercent: 20,
  freeAccessAlertRecipients: "super_admin_commercial",
  freeAccessAlertFrequency: "weekly",
  showBillingCostAlert: true,
  showProgrammesCostAlert: true,
  blockNewProgrammesOverThreshold: true,
  invoiceDueDays: 14,
  autoRetryPayments: true,
  retrySchedule: "3, 7, 14 days",
  suspendOnThirdFailedPayment: true,
  paymentProcessor: "Stripe",
};

export const DEFAULT_PRICING_PLANS: PricingPlan[] = [
  {
    tier: "starter",
    name: "Starter",
    priceLabel: "£220 / mo",
    mrrPence: 22_000,
    features: "Up to 15 users · 100k AI tokens · Core modules",
  },
  {
    tier: "growth",
    name: "Growth",
    priceLabel: "£480 / mo",
    mrrPence: 48_000,
    popular: true,
    features: "Up to 40 users · 500k AI tokens · All modules",
  },
  {
    tier: "enterprise",
    name: "Enterprise",
    priceLabel: "Custom",
    mrrPence: null,
    features: "Unlimited users · 2M AI tokens · SSO · dedicated CSM",
  },
];
