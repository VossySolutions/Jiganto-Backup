import type {
  CrmAccount as DbAccount,
  CrmPipeline as DbPipeline,
  CrmOpportunityStage as DbStage,
  CrmOpportunity as DbOpportunity,
  CrmContact as DbContact,
  CrmContract as DbContract,
  CrmLead as DbLead,
  CrmActivity as DbActivity,
  CrmNote as DbNote,
  CrmTask as DbTask,
  CrmEmailLog as DbEmailLog,
} from "@shared/models/crm";

/** JSON API date fields (ISO strings). */
export type ApiDate = string;

export type CrmAccount = Pick<
  DbAccount,
  "id" | "tenantId" | "name" | "type" | "industry"
> & {
  annualRevenue?: string | null;
  customData?: Record<string, unknown> | null;
};

/** Full account record for list/detail tabs. */
export type CrmAccountDetail = Pick<
  DbAccount,
  | "id"
  | "tenantId"
  | "parentAccountId"
  | "name"
  | "type"
  | "industry"
  | "website"
  | "phone"
  | "email"
  | "address"
  | "city"
  | "state"
  | "country"
  | "postalCode"
  | "ownerUserId"
  | "description"
  | "annualRevenue"
  | "employeeCount"
> & {
  customData?: Record<string, unknown> | null;
  createdAt: ApiDate;
  updatedAt: ApiDate;
};

export type CrmAccountPicklist = Pick<CrmAccount, "id" | "name">;

export type CrmAccountForecast = CrmAccountPicklist & {
  annualRevenue?: string | null;
  customData?: Record<string, unknown> | null;
};

export type CrmPipeline = Pick<
  DbPipeline,
  "id" | "tenantId" | "name" | "description" | "isDefault" | "color"
>;

export type CrmPipelineSummary = Pick<DbPipeline, "id" | "name" | "isDefault">;

export type CrmOpportunityStage = Pick<
  DbStage,
  "id" | "tenantId" | "pipelineId" | "name" | "order" | "probability" | "color" | "isClosed" | "isWon"
>;

export type CrmOpportunityStageSummary = Pick<
  DbStage,
  "id" | "name" | "order" | "probability" | "color" | "isClosed" | "isWon"
>;

/** Stage row used in forecast matrix (no tenantId). */
export type CrmForecastStage = Pick<
  DbStage,
  "id" | "pipelineId" | "name" | "order" | "probability" | "isClosed"
>;

export type CrmStageClosedFlag = Pick<DbStage, "id" | "isClosed">;

export type CrmOpportunity = Pick<
  DbOpportunity,
  "id" | "tenantId" | "accountId" | "stageId" | "name" | "amount" | "probability" | "ownerUserId"
> & {
  contactId?: number | null;
  customData?: Record<string, unknown> | null;
  isArchived?: boolean | null;
  expectedCloseDate: ApiDate | null;
  createdAt: ApiDate;
};

export type CrmOpportunitySummary = Pick<CrmOpportunity, "id" | "accountId" | "stageId">;

export type CrmOpportunityDetail = Pick<
  DbOpportunity,
  "id" | "accountId" | "stageId" | "name" | "amount" | "probability" | "type" | "source" | "nextStep"
> & {
  expectedCloseDate: ApiDate | null;
  createdAt: ApiDate;
};

/** Loose shape for forecast matrix rows (custom fields allowed). */
export type CrmForecastOpportunity = Record<string, unknown> & {
  id: number;
  stageId: number | null;
};

export type CrmContact = Pick<
  DbContact,
  "id" | "tenantId" | "accountId" | "firstName" | "lastName" | "email" | "phone" | "title" | "role"
> & {
  customData?: Record<string, unknown> | null;
  createdAt: ApiDate;
};

export type CrmContactDetail = Pick<
  DbContact,
  | "id"
  | "accountId"
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "mobile"
  | "title"
  | "department"
  | "role"
  | "isPrimary"
  | "linkedInUrl"
  | "notes"
> & {
  createdAt: ApiDate;
};

export type CrmContactPicklist = Pick<CrmContact, "id" | "firstName" | "lastName" | "accountId">;

export type CrmContract = Pick<
  DbContract,
  | "id"
  | "tenantId"
  | "accountId"
  | "opportunityId"
  | "projectId"
  | "name"
  | "type"
  | "status"
  | "value"
  | "recurringValue"
  | "terms"
  | "signedByContactId"
  | "documentId"
  | "ownerUserId"
> & {
  startDate: ApiDate | null;
  endDate: ApiDate | null;
  signedDate: ApiDate | null;
  createdAt: ApiDate;
  updatedAt: ApiDate;
};

export type CrmContractSummary = Pick<CrmContract, "id" | "accountId" | "status" | "endDate">;

/** Contract row for list/360 views (subset of full contract). */
export type CrmContractListItem = Pick<
  CrmContract,
  "id" | "tenantId" | "accountId" | "name" | "type" | "status" | "value" | "ownerUserId" | "createdAt"
> & {
  startDate: ApiDate | null;
  endDate: ApiDate | null;
};

export type CrmLead = Pick<
  DbLead,
  | "id"
  | "tenantId"
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "company"
  | "title"
  | "source"
  | "status"
  | "score"
  | "rating"
  | "industry"
  | "website"
  | "description"
  | "ownerUserId"
  | "convertedAccountId"
> & {
  customData?: Record<string, unknown> | null;
  createdAt: ApiDate;
  updatedAt?: ApiDate;
};

export type CrmActivity = Omit<
  Pick<
    DbActivity,
    | "id"
    | "type"
    | "subject"
    | "description"
    | "startTime"
    | "endTime"
    | "duration"
    | "location"
    | "outcome"
    | "status"
    | "priority"
    | "accountId"
  >,
  "accountId"
> & {
  accountId?: number | null;
  dueDate: ApiDate | null;
  completedAt: ApiDate | null;
  createdAt: ApiDate;
};

/** Activity row with relations (360 / account detail). */
export type CrmActivityRecord = Pick<
  DbActivity,
  | "id"
  | "tenantId"
  | "type"
  | "subject"
  | "description"
  | "status"
  | "accountId"
  | "contactId"
  | "opportunityId"
  | "ownerUserId"
> & {
  createdAt: ApiDate;
};

export type CrmNote = Pick<DbNote, "id" | "entityType" | "entityId" | "content"> & {
  createdAt: ApiDate;
};

export type CrmNoteRecord = Pick<
  DbNote,
  "id" | "tenantId" | "entityType" | "entityId" | "content" | "createdByUserId"
> & {
  createdAt: ApiDate;
};

export type CrmTask = Pick<
  DbTask,
  "id" | "subject" | "description" | "status" | "priority" | "accountId"
> & {
  dueDate: ApiDate | null;
  createdAt: ApiDate;
};

export type CrmEmailLog = Pick<
  DbEmailLog,
  "id" | "entityType" | "entityId" | "recipientEmail" | "subject" | "status" | "sentByUserId"
> & {
  body?: string | null;
  sentAt: ApiDate;
};

/** Dashboard KPI bundle from GET /api/crm/dashboard-stats. */
export interface CrmDashboardStats {
  totalPipelineValue: number;
  weightedPipelineValue: number;
  revenueWon: number;
  winRate: number;
  avgDealSize: number;
  openOpportunities: number;
  wonDeals: number;
  lostDeals: number;
  totalAccounts: number;
  activeLeads: number;
  hotLeads: number;
  newLeads: number;
  newLeadsThisMonth?: number;
  leadConversionRate?: number;
  winRate90d?: number;
  wonDeals90d?: number;
  lostDeals90d?: number;
  avgSalesCycle?: number;
  activeContracts: number;
  expiringContracts: number;
  stageBreakdown: { name: string; count: number; value: number; color: string }[];
  topAccounts: {
    id: number;
    name: string;
    type: string;
    industry: string | null;
    totalValue: number;
    openDeals: number;
    dealCount: number;
  }[];
  hotOpportunities?: {
    id: number;
    name: string;
    accountName: string;
    stage: string;
    amount: number;
    expectedCloseDate: string | null;
  }[];
  recentActivity?: { id: number; type: string; subject: string; createdAt: string }[];
  leaderboard?: { ownerId: string; total: number; count: number }[];
  revenueForecast?: { month: string; value: number }[];
}
