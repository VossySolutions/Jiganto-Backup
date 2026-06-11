export type CrmTenantUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  profileImageUrl?: string | null;
};

export type CrmOwnerDisplay = {
  id: string | null;
  name: string;
  initials: string;
  color: string;
};

const AVATAR_COLORS = [
  "#3b82f6", "#8b5cf6", "#22c55e", "#f97316", "#ec4899",
  "#06b6d4", "#ef4444", "#eab308", "#14b8a6", "#6366f1",
];

export function getColorForUserId(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getUserDisplayName(user: CrmTenantUser): string {
  const full = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  return full || user.email || user.id;
}

export function getUserInitials(user: CrmTenantUser): string {
  const name = getUserDisplayName(user);
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || "")
    .join("") || "?";
}

export function buildUserMap(users: CrmTenantUser[]): Map<string, CrmTenantUser> {
  return new Map(users.map(u => [u.id, u]));
}

export function resolveOwner(
  ownerUserId: string | null | undefined,
  userMap: Map<string, CrmTenantUser>,
): CrmOwnerDisplay {
  if (!ownerUserId) {
    return { id: null, name: "Unassigned", initials: "—", color: "#9ca3af" };
  }
  const user = userMap.get(ownerUserId);
  if (!user) {
    const short = ownerUserId.length > 12 ? `${ownerUserId.slice(0, 8)}…` : ownerUserId;
    return { id: ownerUserId, name: short, initials: short.slice(0, 2).toUpperCase(), color: getColorForUserId(ownerUserId) };
  }
  return {
    id: ownerUserId,
    name: getUserDisplayName(user),
    initials: getUserInitials(user),
    color: getColorForUserId(ownerUserId),
  };
}
