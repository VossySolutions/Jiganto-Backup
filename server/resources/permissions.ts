import { eq } from "drizzle-orm";
import { db } from "../db";
import { resources } from "@shared/schema";
import type { PlatformRole } from "@shared/models/permissions";

export type ResourceAccessRole = "manager" | "consultant" | "self";

export const MANAGER_TABS = [
  "dashboard", "people", "skills", "allocations", "pipeline",
  "timesheets", "reports", "rate-cards", "org-chart",
] as const;

export const SELF_TABS = ["dashboard", "timesheets"] as const;

export const CONSULTANT_TABS = ["dashboard", "people", "timesheets"] as const;

export interface ResourceScope {
  role: ResourceAccessRole;
  ownResourceId: number | null;
  visibleResourceIds: number[] | "all";
  isContractorPortal: boolean;
  allowedTabs: string[];
  canApproveTimesheets: boolean;
  canManagePeople: boolean;
  canViewPipeline: boolean;
  canViewReports: boolean;
}

const ADMIN_ROLES: PlatformRole[] = ["jiganto_staff", "si_super_admin"];

export async function resolveResourceScope(
  userId: string,
  tenantId: number,
  platformRole?: PlatformRole | null,
): Promise<ResourceScope> {
  const allPeople = await db.select().from(resources).where(eq(resources.tenantId, tenantId));
  const own = allPeople.find((r) => r.userId === userId) ?? null;

  if (platformRole && ADMIN_ROLES.includes(platformRole)) {
    return managerScope(own?.id ?? null);
  }

  if (own && (own.personType === "contractor" || own.personType === "customer")) {
    return {
      role: "self",
      ownResourceId: own.id,
      visibleResourceIds: [own.id],
      isContractorPortal: own.personType === "contractor",
      allowedTabs: [...SELF_TABS],
      canApproveTimesheets: false,
      canManagePeople: false,
      canViewPipeline: false,
      canViewReports: false,
    };
  }

  if (own) {
    const teamIds = allPeople.filter((r) => r.reportsToId === own.id).map((r) => r.id);
    if (teamIds.length > 0) {
      return {
        role: "consultant",
        ownResourceId: own.id,
        visibleResourceIds: [own.id, ...teamIds],
        isContractorPortal: false,
        allowedTabs: [...CONSULTANT_TABS],
        canApproveTimesheets: true,
        canManagePeople: false,
        canViewPipeline: false,
        canViewReports: false,
      };
    }
  }

  return managerScope(own?.id ?? null);
}

function managerScope(ownResourceId: number | null): ResourceScope {
  return {
    role: "manager",
    ownResourceId,
    visibleResourceIds: "all",
    isContractorPortal: false,
    allowedTabs: [...MANAGER_TABS],
    canApproveTimesheets: true,
    canManagePeople: true,
    canViewPipeline: true,
    canViewReports: true,
  };
}

export function canAccessResource(scope: ResourceScope, resourceId: number): boolean {
  if (scope.visibleResourceIds === "all") return true;
  return scope.visibleResourceIds.includes(resourceId);
}

export function filterResourcesByScope<T extends { id: number }>(
  items: T[],
  scope: ResourceScope,
): T[] {
  if (scope.visibleResourceIds === "all") return items;
  const allowed = new Set(scope.visibleResourceIds);
  return items.filter((r) => allowed.has(r.id));
}

export function assertManager(scope: ResourceScope): void {
  if (scope.role !== "manager") {
    throw new Error("Resource manager access required");
  }
}
