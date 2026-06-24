/** Shared CRM pipeline membership — used by Opportunities tab and forecast matrix API. */

export type CrmPipelineRef = { id: number; isDefault: boolean | null };
export type CrmStageRef = {
  id: number;
  pipelineId: number | null;
  isClosed?: boolean | null;
};
export type CrmOpportunityRef = {
  stageId: number | null;
  isArchived?: boolean | null;
};

export function getDefaultPipelineId(pipelines: CrmPipelineRef[]): number | null {
  return pipelines.find((p) => p.isDefault)?.id ?? pipelines[0]?.id ?? null;
}

/** Whether an opportunity belongs in the active pipeline view (includes legacy global stages on default pipeline). */
export function opportunityMatchesPipeline<T extends CrmStageRef>(
  opportunity: CrmOpportunityRef,
  stages: T[],
  pipelines: CrmPipelineRef[],
  activePipelineId: number | null,
  options?: { openOnly?: boolean },
): boolean {
  if (opportunity.isArchived) return false;
  if (!activePipelineId) return true;
  const stage = stages.find((s) => s.id === opportunity.stageId);
  if (!stage) return false;
  if (options?.openOnly && stage.isClosed) return false;
  if (stage.pipelineId == null) {
    return activePipelineId === getDefaultPipelineId(pipelines);
  }
  return stage.pipelineId === activePipelineId;
}

export function stagesForActivePipeline<T extends CrmStageRef>(
  stages: T[],
  pipelines: CrmPipelineRef[],
  activePipelineId: number | null,
): T[] {
  if (!activePipelineId) return stages;
  const defaultPipelineId = getDefaultPipelineId(pipelines);
  return stages.filter(
    (s) => s.pipelineId === activePipelineId || (s.pipelineId == null && activePipelineId === defaultPipelineId),
  );
}
