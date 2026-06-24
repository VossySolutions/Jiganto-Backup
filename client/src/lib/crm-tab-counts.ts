/** Tab badge counts — must match each CRM tab's default table row set (no search/filters). */

import {
  getDefaultPipelineId,
  opportunityMatchesPipeline,
  stagesForActivePipeline,
} from "@shared/crm-pipeline";

export { getDefaultPipelineId, opportunityMatchesPipeline, stagesForActivePipeline };

type CrmPipeline = { id: number; isDefault: boolean | null };
type CrmStage = {
  id: number;
  pipelineId: number | null;
  isClosed: boolean | null;
};
type CrmOpportunity = {
  stageId: number | null;
  isArchived?: boolean | null;
};

/** CrmLeadsTab default: all leads, no status/temperature filters. */
export function countCrmLeads(leads: unknown[]): number {
  return leads.length;
}

/** CrmOpportunitiesTab default: non-archived opps in the active (default) pipeline. */
export function countCrmOpportunities(
  opportunities: CrmOpportunity[],
  stages: CrmStage[],
  pipelines: CrmPipeline[],
): number {
  const pipelineId = getDefaultPipelineId(pipelines);
  if (!pipelineId) return opportunities.filter(o => !o.isArchived).length;
  return opportunities.filter(o =>
    opportunityMatchesPipeline(o, stages, pipelines, pipelineId),
  ).length;
}

/** CrmPipelineTab default: non-archived open-stage opps in the active (default) pipeline. */
export function countCrmPipelineDeals(
  opportunities: CrmOpportunity[],
  stages: CrmStage[],
  pipelines: CrmPipeline[],
): number {
  const pipelineId = getDefaultPipelineId(pipelines);
  if (!pipelineId) return 0;
  return opportunities.filter(o =>
    opportunityMatchesPipeline(o, stages, pipelines, pipelineId, { openOnly: true }),
  ).length;
}

/** CrmCustomersTab default: all accounts (type filter = all). */
export function countCrmCustomers(accounts: unknown[]): number {
  return accounts.length;
}

export function countCrmContracts(contracts: unknown[]): number {
  return contracts.length;
}

export function countCrmContacts(contacts: unknown[]): number {
  return contacts.length;
}
