import type {
  BudgetExpenseLine,
  BudgetLabourLine,
  BudgetMilestoneLine,
  ExpenseItem,
  ExpenseReport,
  FinanceInvoice,
  FinanceInvoiceLine,
  FinanceInvoicePayment,
  ProjectBudget,
} from "@shared/schema";

/** Matches server/finance/repository.ts FinanceDashboard */
export interface FinanceDashboardData {
  kpis: {
    revenueThisMonth: number;
    outstandingInvoices: number;
    totalBilledYtd: number;
    totalBilledYtdYoYPct: number;
    avgProjectMarginPct: number;
    unapprovedTimesheets: number;
    unapprovedExpenses: number;
  };
  revenueVsBudget: { month: string; budget: number; actual: number; isFuture?: boolean }[];
  projectFinancialHealth: {
    projectId: number;
    projectName: string;
    clientName: string | null;
    budget: number;
    actualCost: number;
    billedToDate: number;
    marginPct: number;
    ragStatus: "green" | "amber" | "red";
  }[];
  invoiceAgeing: { bucket: string; count: number; amount: number }[];
  utilisation: {
    billableHours: number;
    nonBillableHours: number;
    availableHours: number;
    pct: number;
  };
}

export type BudgetListItem = ProjectBudget & {
  projectName?: string | null;
  clientName?: string | null;
  ragStatus?: "green" | "amber" | "red";
  marginPct?: number;
};

export type BudgetDetail = ProjectBudget & {
  labourLines: BudgetLabourLine[];
  expenseLines: BudgetExpenseLine[];
  milestoneLines: BudgetMilestoneLine[];
  projectName: string | null;
  clientName: string | null;
};

export type FinanceTimesheetPeriod = {
  id: number;
  resourceId: number;
  resourceName?: string;
  weekStartDate: string;
  weekEndDate: string;
  status: string | null;
  approvalStatus?: string | null;
  totalHours: string | null;
  submittedAt?: string | null;
  approvedByPmAt?: string | null;
  approvedByRmAt?: string | null;
  approvedByPmId?: string | null;
  approvedByRmId?: string | null;
  entries?: FinanceTimesheetEntry[];
};

export type FinanceTimesheetEntry = {
  id: number;
  timesheetPeriodId: number;
  projectId?: number | null;
  projectName?: string | null;
  activityType?: string | null;
  role?: string | null;
  dayOfWeek: number;
  hours: string | null;
  chargeRate?: string | null;
  costRate?: string | null;
  calculatedCharge?: string | null;
  calculatedCost?: string | null;
  description?: string | null;
};

export type ExpenseReportRow = ExpenseReport & {
  userName?: string;
  projectName?: string | null;
  items?: ExpenseItem[];
};

export type FinanceInvoiceRow = FinanceInvoice & {
  projectName?: string | null;
  clientName?: string | null;
  lines?: FinanceInvoiceLine[];
  payments?: FinanceInvoicePayment[];
};

export type FinanceRateCard = {
  id: number;
  name: string;
  description: string | null;
  cardType: string | null;
  clientId?: number | null;
  projectId?: number | null;
  currency: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isDefault: boolean | null;
  items?: FinanceRateCardItem[];
};

export type FinanceRateCardItem = {
  id: number;
  rateCardId: number;
  roleName: string;
  level?: string | null;
  dailyRate: string;
  costRate?: string | null;
  hourlyChargeRate?: string | null;
  hourlyCostRate?: string | null;
};

export type ErpIntegrationRow = {
  id: number;
  system: string;
  isActive: boolean | null;
  autoSync: boolean | null;
  fieldMappingJson?: Record<string, string> | null;
  webhookUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FinanceSettings = {
  baseCurrency: string;
  timesheetApprovalMode: string;
  invoicePrefix: string;
  defaultPaymentTerms: string;
  orgAddress: string | null;
  orgBankDetails: string | null;
  mileageRateCar: string | null;
  mileageRateMotorcycle: string | null;
  mileageRateBicycle: string | null;
};

export type ErpSyncLogRow = {
  id: number;
  integrationId?: number | null;
  entityType: string;
  entityId: number;
  direction: string;
  status: string;
  errorMessage?: string | null;
  syncedAt: string;
};
