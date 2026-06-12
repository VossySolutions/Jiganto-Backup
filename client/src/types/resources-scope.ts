export type ResourceAccessRole = "manager" | "consultant" | "self";

export type ResourceScope = {
  role: ResourceAccessRole;
  ownResourceId: number | null;
  visibleResourceIds: number[] | "all";
  isContractorPortal: boolean;
  allowedTabs: string[];
  canApproveTimesheets: boolean;
  canManagePeople: boolean;
  canViewPipeline: boolean;
  canViewReports: boolean;
};
