import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../db";
import {
  aiTokenBalance,
  aiTokenLimits,
  aiTokenUsage,
  users as usersTable,
} from "@shared/schema";

const DEFAULT_MONTHLY_ALLOCATION = 100_000;

export async function ensureAiTokenBalance(orgId: number) {
  const [existing] = await db
    .select()
    .from(aiTokenBalance)
    .where(eq(aiTokenBalance.orgId, orgId))
    .limit(1);
  if (existing) return existing;
  const [row] = await db
    .insert(aiTokenBalance)
    .values({
      orgId,
      balance: DEFAULT_MONTHLY_ALLOCATION,
      monthlyAllocation: DEFAULT_MONTHLY_ALLOCATION,
      lastResetAt: new Date(),
    })
    .returning();
  return row;
}

export type AiTokenCheckResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export async function checkAiTokenAllowance(params: {
  orgId: number;
  userId: string;
  module: string;
  estimatedTokens?: number;
}): Promise<AiTokenCheckResult> {
  const estimate = params.estimatedTokens ?? 500;
  try {
    const balance = await ensureAiTokenBalance(params.orgId);
    if (balance.balance < estimate) {
      return {
        allowed: false,
        reason: `Insufficient AI token balance (${balance.balance} remaining).`,
      };
    }

    const limits = await listAiTokenLimits(params.orgId);
    const since = new Date();
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    for (const limit of limits) {
      if (limit.userId && limit.userId !== params.userId) continue;
      if (limit.module && limit.module !== params.module) continue;

      const usageConditions = [
        eq(aiTokenUsage.orgId, params.orgId),
        gte(aiTokenUsage.createdAt, since),
      ];
      if (limit.userId) usageConditions.push(eq(aiTokenUsage.userId, limit.userId));
      if (limit.module) usageConditions.push(eq(aiTokenUsage.module, limit.module));

      const usageRows = await db
        .select({ sum: sql<number>`coalesce(sum(${aiTokenUsage.tokensConsumed}), 0)` })
        .from(aiTokenUsage)
        .where(and(...usageConditions));
      const used = Number(usageRows[0]?.sum ?? 0);
      if (used + estimate > limit.monthlyLimit) {
        return {
          allowed: false,
          reason: `Monthly AI limit exceeded (${used}/${limit.monthlyLimit} tokens).`,
        };
      }
    }
    return { allowed: true };
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "42P01"
    ) {
      return { allowed: true };
    }
    throw err;
  }
}

export async function resetMonthlyAiBalances(): Promise<number> {
  try {
    const rows = await db.select().from(aiTokenBalance);
    let count = 0;
    for (const row of rows) {
      await db
        .update(aiTokenBalance)
        .set({
          balance: row.monthlyAllocation,
          lastResetAt: new Date(),
        })
        .where(eq(aiTokenBalance.orgId, row.orgId));
      count++;
    }
    return count;
  } catch {
    return 0;
  }
}

export async function recordAiTokenUsage(params: {
  orgId: number;
  userId: string;
  module: string;
  featureName: string;
  tokensConsumed: number;
}) {
  const tokens = Math.max(0, Math.round(params.tokensConsumed));
  await ensureAiTokenBalance(params.orgId);
  await db.insert(aiTokenUsage).values({
    orgId: params.orgId,
    userId: params.userId,
    module: params.module,
    featureName: params.featureName,
    tokensConsumed: tokens,
  });
  if (tokens > 0) {
    await db
      .update(aiTokenBalance)
      .set({ balance: sql`${aiTokenBalance.balance} - ${tokens}` })
      .where(eq(aiTokenBalance.orgId, params.orgId));
  }
}

export async function listAiUsageLast30Days(orgId: number, limit = 200) {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const rows = await db
    .select({
      id: aiTokenUsage.id,
      orgId: aiTokenUsage.orgId,
      userId: aiTokenUsage.userId,
      module: aiTokenUsage.module,
      featureName: aiTokenUsage.featureName,
      tokensConsumed: aiTokenUsage.tokensConsumed,
      createdAt: aiTokenUsage.createdAt,
      userEmail: usersTable.email,
      userFirstName: usersTable.firstName,
      userLastName: usersTable.lastName,
    })
    .from(aiTokenUsage)
    .leftJoin(usersTable, eq(aiTokenUsage.userId, usersTable.id))
    .where(and(eq(aiTokenUsage.orgId, orgId), gte(aiTokenUsage.createdAt, since)))
    .orderBy(desc(aiTokenUsage.createdAt))
    .limit(limit);
  return rows.map((r: (typeof rows)[number]) => ({
    id: r.id,
    module: r.module,
    featureName: r.featureName,
    tokensConsumed: r.tokensConsumed,
    createdAt: r.createdAt,
    userId: r.userId,
    userLabel:
      [r.userFirstName, r.userLastName].filter(Boolean).join(" ") ||
      r.userEmail ||
      r.userId,
  }));
}

export async function listAiTokenLimits(orgId: number) {
  try {
    return await db.select().from(aiTokenLimits).where(eq(aiTokenLimits.orgId, orgId));
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "42P01"
    ) {
      return [];
    }
    throw err;
  }
}

export async function upsertAiTokenLimit(input: {
  orgId: number;
  monthlyLimit: number;
  module?: string | null;
  userId?: string | null;
}) {
  const [row] = await db
    .insert(aiTokenLimits)
    .values({
      orgId: input.orgId,
      module: input.module ?? null,
      userId: input.userId ?? null,
      monthlyLimit: input.monthlyLimit,
    })
    .returning();
  return row;
}

export async function deleteAiTokenLimit(id: number, orgId: number) {
  await db
    .delete(aiTokenLimits)
    .where(and(eq(aiTokenLimits.id, id), eq(aiTokenLimits.orgId, orgId)));
}

export function aiUsageToCsv(
  rows: Awaited<ReturnType<typeof listAiUsageLast30Days>>,
): string {
  const header = "id,module,feature,user,tokens,created_at";
  const lines = rows.map((r: (typeof rows)[number]) => {
    const created = r.createdAt ? new Date(r.createdAt).toISOString() : "";
    const user = (r.userLabel ?? "").replace(/"/g, '""');
    return `${r.id},${r.module},${r.featureName},"${user}",${r.tokensConsumed},${created}`;
  });
  return [header, ...lines].join("\n");
}
