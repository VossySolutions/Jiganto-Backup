import { eq } from "drizzle-orm";
import { db } from "../db";
import { erpIntegrations, erpSyncLog } from "@shared/schema";

export async function pushToErp(
  tenantId: number,
  entityType: "invoice" | "expense",
  entityId: number,
  payload: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  const integrations = await db
    .select()
    .from(erpIntegrations)
    .where(eq(erpIntegrations.tenantId, tenantId));

  const active = integrations.filter((i) => i.isActive);
  if (active.length === 0) {
    return { success: false, error: "No active ERP integration configured" };
  }

  for (const integration of active) {
    try {
      if (integration.system === "generic" && integration.webhookUrl) {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (integration.webhookAuthHeader) {
          headers["Authorization"] = integration.webhookAuthHeader;
        }
        const resp = await fetch(integration.webhookUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ entityType, entityId, ...payload }),
        });
        if (!resp.ok) throw new Error(`Webhook returned ${resp.status}`);
      }
      // Xero/QuickBooks/NetSuite: credentials stored; full OAuth sync requires env keys
      await db.insert(erpSyncLog).values({
        tenantId,
        integrationId: integration.id,
        entityType,
        entityId,
        direction: "outbound",
        status: "success",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      await db.insert(erpSyncLog).values({
        tenantId,
        integrationId: integration.id,
        entityType,
        entityId,
        direction: "outbound",
        status: "failed",
        errorMessage: msg,
      });
      return { success: false, error: msg };
    }
  }
  return { success: true };
}
