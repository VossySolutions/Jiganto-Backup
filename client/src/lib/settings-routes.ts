import type { SettingsTier } from "@/lib/settings-access";

export const SETTINGS_PATHS = {
  root: "/settings",
  system: "/settings/system",
  workspace: "/settings/workspace",
  personal: "/settings/personal",
} as const;

export function settingsPathForTier(tier: SettingsTier): string {
  if (tier === "system") return SETTINGS_PATHS.system;
  if (tier === "workspace") return SETTINGS_PATHS.workspace;
  return SETTINGS_PATHS.personal;
}

export function tierFromSettingsPath(pathname: string): SettingsTier | null {
  if (pathname === SETTINGS_PATHS.system || pathname.startsWith(`${SETTINGS_PATHS.system}/`)) {
    return "system";
  }
  if (pathname === SETTINGS_PATHS.workspace || pathname.startsWith(`${SETTINGS_PATHS.workspace}/`)) {
    return "workspace";
  }
  if (pathname === SETTINGS_PATHS.personal || pathname.startsWith(`${SETTINGS_PATHS.personal}/`)) {
    return "personal";
  }
  if (pathname === SETTINGS_PATHS.root) return null;
  return null;
}
