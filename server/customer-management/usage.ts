import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../db";
import { aiTokenBalance, aiTokenUsage, profiles } from "@shared/schema";
import type { CommercialPlanTier, CustomerUsage } from "@shared/models/customer-mgmt";

const PLAN_LIMITS: Record<
  CommercialPlanTier,
  { users: number; aiTokens: number; storageGb: number; esignDocs: number }
> = {
  starter: { users: 15, aiTokens: 100_000, storageGb: 50, esignDocs: 50 },
  growth: { users: 40, aiTokens: 500_000, storageGb: 200, esignDocs: 50 },
  enterprise: { users: 999, aiTokens: 2_000_000, storageGb: 500, esignDocs: 100 },
};

function monthStart(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function planUsageLimits(
  plan: CommercialPlanTier,
  stored?: CustomerUsage | null,
): CustomerUsage {
  const base = PLAN_LIMITS[plan] ?? PLAN_LIMITS.growth;
  return {
    users: { used: stored?.users.used ?? 0, limit: stored?.users.limit ?? base.users },
    aiTokens: {
      used: stored?.aiTokens.used ?? 0,
      limit: stored?.aiTokens.limit ?? base.aiTokens,
    },
    storageGb: {
      used: stored?.storageGb.used ?? 0,
      limit: stored?.storageGb.limit ?? base.storageGb,
    },
    esignDocs: {
      used: stored?.esignDocs.used ?? 0,
      limit: stored?.esignDocs.limit ?? base.esignDocs,
    },
  };
}

/** Resolve live usage from profiles + AI token tables for a linked tenant. */
export async function resolveLiveUsage(
  tenantId: number,
  plan: CommercialPlanTier,
  stored?: CustomerUsage | null,
): Promise<CustomerUsage> {
  const limits = planUsageLimits(plan, stored);

  const [[userRow], [balanceRow], [usageRow]] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(profiles)
      .where(and(eq(profiles.tenantId, tenantId), eq(profiles.isActive, true))),
    db
      .select()
      .from(aiTokenBalance)
      .where(eq(aiTokenBalance.orgId, tenantId))
      .limit(1),
    db
      .select({
        total: sql<number>`coalesce(sum(${aiTokenUsage.tokensConsumed}), 0)::int`,
      })
      .from(aiTokenUsage)
      .where(
        and(eq(aiTokenUsage.orgId, tenantId), gte(aiTokenUsage.createdAt, monthStart())),
      ),
  ]);

  const userCount = userRow?.count ?? 0;
  let aiUsed = usageRow?.total ?? 0;
  if (balanceRow) {
    aiUsed = Math.max(0, balanceRow.monthlyAllocation - balanceRow.balance);
  }

  return {
    users: { used: userCount, limit: limits.users.limit },
    aiTokens: { used: aiUsed, limit: limits.aiTokens.limit },
    storageGb: { used: stored?.storageGb.used ?? 0, limit: limits.storageGb.limit },
    esignDocs: { used: stored?.esignDocs.used ?? 0, limit: limits.esignDocs.limit },
  };
}
