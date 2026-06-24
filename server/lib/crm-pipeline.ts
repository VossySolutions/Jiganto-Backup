import type { CrmOpportunityStage, CrmPipeline } from "@shared/models/crm";

/** First open stage for the tenant default pipeline, then legacy global stages. */
export function resolveDefaultOpenStage(
  pipelines: CrmPipeline[],
  stages: CrmOpportunityStage[],
): CrmOpportunityStage | undefined {
  const defaultPipeline = pipelines.find((p) => p.isDefault) ?? pipelines[0];
  const openStages = stages
    .filter((s) => !s.isClosed)
    .sort((a, b) => a.order - b.order);

  if (defaultPipeline) {
    const inPipeline = openStages.find((s) => s.pipelineId === defaultPipeline.id);
    if (inPipeline) return inPipeline;
  }

  return openStages.find((s) => s.pipelineId == null) ?? openStages[0];
}
