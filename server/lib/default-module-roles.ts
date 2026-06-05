import { SETTINGS_MODULE_KEYS } from "@shared/models/module-access";
import type { ModulePermissions } from "@shared/schema";
import { storage } from "../storage";

function readAllPermissions(): ModulePermissions {
  const permissions: ModulePermissions = {};
  for (const { key } of SETTINGS_MODULE_KEYS) {
    permissions[key] = { read: true, write: false, share: false };
  }
  return permissions;
}

function standardUserPermissions(): ModulePermissions {
  const writeKeys = new Set(["tasks", "documents", "chat", "project-mgmt"]);
  const permissions: ModulePermissions = {};
  for (const { key } of SETTINGS_MODULE_KEYS) {
    permissions[key] = {
      read: true,
      write: writeKeys.has(key),
      share: key === "documents",
    };
  }
  return permissions;
}

const DEFAULT_MODULE_ROLE_TEMPLATES = [
  {
    name: "Administrator",
    description: "Full access to all modules (legacy template)",
    isAdmin: true,
    isDefault: false,
    permissions: {} as ModulePermissions,
  },
  {
    name: "Standard User",
    description: "Read all modules; write on tasks, documents, chat, and projects",
    isAdmin: false,
    isDefault: true,
    permissions: standardUserPermissions(),
  },
  {
    name: "Read Only",
    description: "View-only access across modules",
    isAdmin: false,
    isDefault: false,
    permissions: readAllPermissions(),
  },
] as const;

/** Creates starter legacy module roles when an org has none. */
export async function ensureDefaultModuleRoles(tenantId: number): Promise<void> {
  const existing = await storage.getUserRoles(tenantId);
  if (existing.length > 0) return;

  for (const template of DEFAULT_MODULE_ROLE_TEMPLATES) {
    await storage.createUserRole({
      tenantId,
      name: template.name,
      description: template.description,
      isAdmin: template.isAdmin,
      isDefault: template.isDefault,
      permissions: template.permissions,
    });
  }
}
