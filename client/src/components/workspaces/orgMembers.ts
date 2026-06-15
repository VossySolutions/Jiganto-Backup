import { fetchWithAuth } from "@/lib/queryClient";
import type { CrmTenantUser } from "@/lib/crm-users";

export type OrgMemberCandidate = CrmTenantUser;

type MemberLike = Partial<CrmTenantUser> & {
  userId?: string;
  name?: string;
  user?: Partial<CrmTenantUser> | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function humanizeSlug(value: string): string {
  return value
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function asTenantUser(member: MemberLike): CrmTenantUser {
  const nested = member.user;
  return {
    id: String(member.id || member.userId || nested?.id || ""),
    firstName: member.firstName ?? nested?.firstName ?? null,
    lastName: member.lastName ?? nested?.lastName ?? null,
    email: member.email ?? nested?.email ?? null,
    profileImageUrl: member.profileImageUrl ?? nested?.profileImageUrl ?? null,
  };
}

export function getOrgMemberUserId(member: MemberLike): string {
  return String(member.id || member.userId || member.user?.id || "");
}

export function formatOrgMemberLabel(member: MemberLike): string {
  if (member.name?.trim()) return member.name.trim();

  const user = asTenantUser(member);
  const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  if (fullName) return fullName;
  if (user.email) return user.email;

  const id = user.id;
  if (id && !UUID_RE.test(id)) return humanizeSlug(id);
  if (id) return `User ${id.slice(0, 8)}…`;
  return "Unknown user";
}

export function formatOrgMemberSubtitle(member: MemberLike): string | null {
  const user = asTenantUser(member);
  const label = formatOrgMemberLabel(member);
  if (user.email && user.email !== label) return user.email;
  return null;
}

export async function fetchOrgMemberCandidates(): Promise<OrgMemberCandidate[]> {
  const res = await fetchWithAuth("/api/chat/users");
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((row: CrmTenantUser) => ({
    id: String(row.id),
    firstName: row.firstName ?? null,
    lastName: row.lastName ?? null,
    email: row.email ?? null,
    profileImageUrl: row.profileImageUrl ?? null,
  }));
}
