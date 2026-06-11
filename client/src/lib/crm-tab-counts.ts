/** Tab badge counts — must match each CRM tab's default table row set (no search/filters). */

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

export function getDefaultPipelineId(pipelines: CrmPipeline[]): number | null {
  return pipelines.find(p => p.isDefault)?.id ?? pipelines[0]?.id ?? null;
}

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
  if (!pipelineId) return 0;
  return opportunities.filter(o => {
    if (o.isArchived) return false;
    const stage = stages.find(s => s.id === o.stageId);
    return !!stage && stage.pipelineId === pipelineId;
  }).length;
}

/** CrmPipelineTab default: non-archived open-stage opps in the active (default) pipeline. */
export function countCrmPipelineDeals(
  opportunities: CrmOpportunity[],
  stages: CrmStage[],
  pipelines: CrmPipeline[],
): number {
  const pipelineId = getDefaultPipelineId(pipelines);
  if (!pipelineId) return 0;
  return opportunities.filter(o => {
    if (o.isArchived) return false;
    const stage = stages.find(s => s.id === o.stageId);
    return !!stage && stage.pipelineId === pipelineId && !stage.isClosed;
  }).length;
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
