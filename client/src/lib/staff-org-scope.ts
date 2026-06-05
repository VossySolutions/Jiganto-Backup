const STORAGE_KEY = "jiganto_staff_org_override";

let staffOrgOverride: number | null = null;

function readStored(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

staffOrgOverride = readStored();

export function getStaffOrgOverride(): number | null {
  return staffOrgOverride;
}

export function setStaffOrgOverride(orgId: number | null): void {
  staffOrgOverride = orgId;
  try {
    if (orgId == null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(orgId));
  } catch {
    /* ignore */
  }
}
