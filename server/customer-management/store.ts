import { sql } from "drizzle-orm";
import { commercialCustomers } from "@shared/schema";
import type {
  AccessGrantType,
  CustomerDetail,
  CustomerMgmtDashboard,
  CustomerMgmtSettings,
} from "@shared/models/customer-mgmt";
import { db } from "../db";
import {
  applyAccessGrantInDb,
  canGrantAccessFromDb,
  createProgrammeInDb,
  loadCustomerDetailFromDb,
  loadDashboardFromDb,
  toggleFeatureFlagInDb,
  updateSettingsInDb,
  type CreateProgrammeInput,
  type GrantAccessInput,
} from "./repository";

export class CustomerMgmtNotReadyError extends Error {
  constructor() {
    super("No commercial customers in database. Add a customer or sync tenant profiles.");
    this.name = "CustomerMgmtNotReadyError";
  }
}

export async function hasCommercialCustomers(): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(commercialCustomers);
  return (row?.count ?? 0) > 0;
}

export async function getCustomerMgmtDashboard(): Promise<CustomerMgmtDashboard> {
  if (!(await hasCommercialCustomers())) {
    throw new CustomerMgmtNotReadyError();
  }
  return loadDashboardFromDb();
}

export async function getCustomerDetail(slug: string): Promise<CustomerDetail | null> {
  if (!(await hasCommercialCustomers())) {
    return null;
  }
  return loadCustomerDetailFromDb(slug);
}

export async function updateCustomerMgmtSettings(
  patch: Partial<CustomerMgmtSettings>,
): Promise<CustomerMgmtSettings> {
  if (!(await hasCommercialCustomers())) {
    throw new CustomerMgmtNotReadyError();
  }
  return updateSettingsInDb(patch);
}

export async function toggleCustomerFeatureFlag(
  slug: string,
  flagKey: string,
  enabled: boolean,
): Promise<CustomerDetail | null> {
  if (!(await hasCommercialCustomers())) {
    return null;
  }
  return toggleFeatureFlagInDb(slug, flagKey, enabled);
}

export async function applyAccessGrant(input: GrantAccessInput): Promise<void> {
  if (!(await hasCommercialCustomers())) {
    throw new CustomerMgmtNotReadyError();
  }
  await applyAccessGrantInDb(input);
}

export async function createBetaProgramme(input: CreateProgrammeInput) {
  if (!(await hasCommercialCustomers())) {
    throw new CustomerMgmtNotReadyError();
  }
  return createProgrammeInDb(input);
}

export async function canGrantAccess(
  platformRole: string | undefined,
  grantType: AccessGrantType,
): Promise<boolean> {
  return canGrantAccessFromDb(platformRole, grantType);
}

export type { GrantAccessInput, CreateProgrammeInput };
