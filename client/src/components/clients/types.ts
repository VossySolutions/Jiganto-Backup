export interface UserBrief {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

export function userDisplayName(u?: UserBrief | null): string {
  if (!u) return "—";
  const name = `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
  return name || u.email || u.id;
}

export interface ClientWorkspace {
  id: number;
  tenantId: number;
  name: string;
  slug?: string | null;
  shortCode: string;
  color: string;
  logoUrl?: string | null;
  industry?: string | null;
  status: string;
  engagementStatus?: string | null;
  contractValue?: string | null;
  contractStart?: string | null;
  contractEnd?: string | null;
  website?: string | null;
  notes?: string | null;
  tags?: string | null;
  crmAccountId?: number | null;
  accountManagerId?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
  purgeAt?: string | null;
  projectCount?: number;
  atRiskCount?: number;
  activeProjectCount?: number;
  memberCount?: number;
  createdByUser?: UserBrief | null;
  accountManagerUser?: UserBrief | null;
}

export interface ClientKpis {
  totalClients: number;
  activeEngagements: number;
  projectsTracked: number;
  atRiskProjects: number;
}

export interface ClientFormData {
  name: string;
  shortCode: string;
  color: string;
  industry: string;
  website: string;
  notes: string;
  engagementStatus: string;
  contractStart: string;
  contractEnd: string;
  accountManagerId: string;
  tags: string;
}

export interface ClientMember {
  id: number;
  userId: string;
  role: string;
  memberType: string;
  userInfo?: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    profileImageUrl: string | null;
  };
}
