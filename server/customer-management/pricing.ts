import type {
  CommercialPlanTier,
  CustomerMgmtSettings,
  PricingPlan,
} from "@shared/models/customer-mgmt";
import { DEFAULT_PRICING_PLANS } from "./defaults";

const FALLBACK_MRR: Record<CommercialPlanTier, number> = {
  starter: 22_000,
  growth: 48_000,
  enterprise: 320_000,
};

/** Parse "£220 / mo" style labels into pence. Returns null for custom/enterprise pricing. */
export function parsePriceLabelToPence(label: string): number | null {
  if (/custom/i.test(label)) return null;
  const match = label.match(/£?\s*([\d,]+(?:\.\d+)?)/);
  if (!match?.[1]) return null;
  const pounds = parseFloat(match[1].replace(/,/g, ""));
  if (Number.isNaN(pounds)) return null;
  return Math.round(pounds * 100);
}

export function getPricingPlans(settings?: CustomerMgmtSettings | null): PricingPlan[] {
  return settings?.pricingPlans ?? DEFAULT_PRICING_PLANS;
}

export function planMrrPence(
  tier: CommercialPlanTier,
  settings?: CustomerMgmtSettings | null,
): number {
  const plans = getPricingPlans(settings);
  const plan = plans.find((p) => p.tier === tier);
  if (plan?.mrrPence != null && plan.mrrPence > 0) return plan.mrrPence;
  if (plan?.priceLabel) {
    const parsed = parsePriceLabelToPence(plan.priceLabel);
    if (parsed != null) return parsed;
  }
  return FALLBACK_MRR[tier];
}

export function withPlanMrrPence(plans: PricingPlan[]): PricingPlan[] {
  return plans.map((plan) => ({
    ...plan,
    mrrPence: plan.mrrPence ?? parsePriceLabelToPence(plan.priceLabel),
  }));
}
