import { DASHBOARD_PATH, LANDING_PATH } from "@shared/app-routes";

const STORAGE_KEY = "jiganto-pending-invite-token";
const AUTO_ACCEPT_KEY = "jiganto-invite-auto-accept";

export function savePendingInviteToken(token: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, token);
  } catch {
    // ignore private mode / quota
  }
}

export function getPendingInviteToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearPendingInviteToken(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(AUTO_ACCEPT_KEY);
  } catch {
    // ignore
  }
}

export function inviteAcceptPath(token: string): string {
  return `/invite/${encodeURIComponent(token)}`;
}

/** After sign-in/sign-up: return to invite page and auto-accept when details load. */
export function redirectAfterAuth(): void {
  const token = getPendingInviteToken();
  if (token) {
    try {
      sessionStorage.setItem(AUTO_ACCEPT_KEY, "1");
    } catch {
      // ignore
    }
    window.location.href = inviteAcceptPath(token);
    return;
  }
  window.location.href = DASHBOARD_PATH;
}

export function shouldAutoAcceptInvite(): boolean {
  try {
    return sessionStorage.getItem(AUTO_ACCEPT_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearAutoAcceptInvite(): void {
  try {
    sessionStorage.removeItem(AUTO_ACCEPT_KEY);
  } catch {
    // ignore
  }
}

/** Navigate to welcome page while preserving invite context. */
export function goToInviteSignIn(token: string, email?: string): void {
  savePendingInviteToken(token);
  const params = new URLSearchParams();
  params.set("invite", token);
  if (email) params.set("email", email);
  window.location.href = `${LANDING_PATH}?${params.toString()}`;
}
