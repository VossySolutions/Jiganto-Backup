import { storage } from "../storage";
import { PLATFORM_MODULE_KEYS, type ModuleEntitlements } from "@shared/models/dashboard";

type TenantBilling = {
  modules?: string[];
};

export type { ModuleEntitlements };

export async function loadModuleEntitlements(tenantId: number): Promise<ModuleEntitlements> {
  const tenant = await storage.getTenant(tenantId);
  const billing = (tenant?.brandingConfig as { billing?: TenantBilling } | null)?.billing;
  const configured = billing?.modules?.filter((k) => typeof k === "string" && k.length > 0);
  if (!configured?.length) {
    return { licensedModuleKeys: null };
  }
  const validKeys = new Set<string>(PLATFORM_MODULE_KEYS);
  return {
    licensedModuleKeys: configured.filter((k) => validKeys.has(k)),
  };
}

export function isModuleLicensed(key: string, entitlements: ModuleEntitlements): boolean {
  if (entitlements.licensedModuleKeys === null) return true;
  return entitlements.licensedModuleKeys.includes(key);
}
