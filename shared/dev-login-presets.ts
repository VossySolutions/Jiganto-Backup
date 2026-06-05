import type { PlatformRole } from "./models/permissions";
import { PLATFORM_ROLE_LABELS } from "./models/permissions";

/** Dev / demo sign-in personas (one user per platform role). */
export interface DevLoginPreset {
  preset: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  platformRole: PlatformRole;
  /** Shown on the sign-in page */
  summary: string;
  /** First client workspace to lock (client roles); uses first client in DB if omitted */
  lockToFirstClient?: boolean;
  /** Legacy client_users.role when lockToFirstClient */
  clientUserRole?: "client_admin" | "client_viewer";
}

export const DEV_LOGIN_PRESETS: DevLoginPreset[] = [
  {
    preset: "jiganto_staff",
    userId: "dev-jiganto-staff",
    email: "staff@jiganto.dev",
    firstName: "Jiganto",
    lastName: "Staff",
    platformRole: "jiganto_staff",
    summary: "Internal support — full access, impersonation",
  },
  {
    preset: "si_super_admin",
    userId: "dev-si-admin",
    email: "admin@si-firm.dev",
    firstName: "SI",
    lastName: "Admin",
    platformRole: "si_super_admin",
    summary: "Your organisation owner — all clients, switcher, settings",
  },
  {
    preset: "si_consultant_pm",
    userId: "dev-si-consultant",
    email: "consultant@si-firm.dev",
    firstName: "SI",
    lastName: "Consultant",
    platformRole: "si_consultant_pm",
    summary: "Delivery lead — switch clients, PMO view",
  },
  {
    preset: "client_project_user",
    userId: "dev-client-user",
    email: "user@clientco.dev",
    firstName: "Client",
    lastName: "User",
    platformRole: "client_project_user",
    summary: "Customer team — one workspace, can edit",
    lockToFirstClient: true,
    clientUserRole: "client_admin",
  },
  {
    preset: "client_executive",
    userId: "dev-client-exec",
    email: "exec@clientco.dev",
    firstName: "Client",
    lastName: "Executive",
    platformRole: "client_executive",
    summary: "Customer leadership — one workspace, view only",
    lockToFirstClient: true,
    clientUserRole: "client_viewer",
  },
  {
    preset: "client_jiganto_user",
    userId: "dev-client-admin",
    email: "admin@clientorg.dev",
    firstName: "Client",
    lastName: "Admin",
    platformRole: "client_jiganto_user",
    summary: "Customer org admin — can switch workspaces",
  },
];

export function getDevPreset(id: string): DevLoginPreset | undefined {
  return DEV_LOGIN_PRESETS.find((p) => p.preset === id);
}

export function devPresetLabel(role: PlatformRole): string {
  return PLATFORM_ROLE_LABELS[role];
}
