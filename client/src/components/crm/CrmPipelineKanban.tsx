import { useMemo } from "react";
import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { AppKanbanBoard } from "@/components/kanban";
import {
  Plus, MoreHorizontal, ArrowRight, Calendar, Settings2, Pencil, Trash2, GripVertical,
} from "lucide-react";
import type { CrmAccount, CrmPipeline, CrmOpportunity, CrmOpportunityStage } from "./types";

export interface CrmPipelineKanbanProps {
  opportunities: CrmOpportunity[];
  activeStages: CrmOpportunityStage[];
  pipelineStages: CrmOpportunityStage[];
  stages: CrmOpportunityStage[];
  pipelines: CrmPipeline[];
  accounts: CrmAccount[];
  activePipelineId: number | null;
  activePipeline?: CrmPipeline;
  visibleFields: Set<string>;
  getStageColor: (stage: CrmOpportunityStage, index: number) => string;
  formatCurrency: (val: string | null) => string;
  formatDate: (date: string | null | undefined) => string;
  resolveOwner: (userId: string | null) => { name: string; initials: string; color: string };
  onEdit: (opp: CrmOpportunity) => void;
  onDelete: (id: number) => void;
  onMoveStage: (id: number, stageId: number, probability?: number) => Promise<void>;
  onOpenCardFields: () => void;
  onAddDeal: (stageId: number) => void;
  onMovePipeline: (oppId: number, targetPipelineId: number) => void;
  toast: (opts: { title: string; description?: string; variant?: "destructive" }) => void;
}

function PipelineOpportunityCard({
  opp,
  stageColor,
  stageId,
  visibleFields,
  accounts,
  stages,
  pipelines,
  activePipelineId,
  activePipeline,
  pipelineStages,
  getStageColor,
  formatCurrency,
  formatDate,
  resolveOwner,
  onEdit,
  onDelete,
  onMoveStage,
  onOpenCardFields,
  onMovePipeline,
  dragHandleProps,
  isDragging,
}: {
  opp: CrmOpportunity;
  stageColor: string;
  stageId: number;
  visibleFields: Set<string>;
  accounts: CrmAccount[];
  stages: CrmOpportunityStage[];
  pipelines: CrmPipeline[];
  activePipelineId: number | null;
  activePipeline?: CrmPipeline;
  pipelineStages: CrmOpportunityStage[];
  getStageColor: (stage: CrmOpportunityStage, index: number) => string;
  formatCurrency: (val: string | null) => string;
  formatDate: (date: string | null | undefined) => string;
  resolveOwner: (userId: string | null) => { name: string; initials: string; color: string };
  onEdit: (opp: CrmOpportunity) => void;
  onDelete: (id: number) => void;
  onMoveStage: (id: number, stageId: number, probability?: number) => Promise<void>;
  onOpenCardFields: () => void;
  onMovePipeline: (oppId: number, targetPipelineId: number) => void;
  toast: CrmPipelineKanbanProps["toast"];
  dragHandleProps: DraggableProvidedDragHandleProps | null;
  isDragging?: boolean;
}) {
  const account = accounts.find((a) => a.id === opp.accountId);
  const owner = resolveOwner(opp.ownerUserId);
  const oppStage = stages.find((s) => s.id === opp.stageId);
  const probability = opp.probability ?? oppStage?.probability ?? 0;

  return (
    <div
      className={cn(
        "relative bg-white dark:bg-card rounded-lg border border-border/50 shadow-sm hover:shadow-md transition-all overflow-hidden",
        isDragging && "shadow-lg ring-2 ring-primary/30 rotate-1 z-50",
      )}
      data-testid={`opportunity-card-${opp.id}`}
    >
      <div className="flex">
        <div className="w-1 shrink-0 rounded-l-lg" style={{ backgroundColor: stageColor }} />
        <div
          {...(dragHandleProps ?? {})}
          className="flex items-start pt-3 pl-1.5 pr-0.5 cursor-grab active:cursor-grabbing touch-none text-muted-foreground/50 hover:text-muted-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1 p-3 pl-1 min-w-0">
          <div className="flex items-start justify-between gap-1 mb-1">
            <div className="min-w-0">
              {visibleFields.has("account") && account && (
                <p className="text-[11px] text-muted-foreground truncate" data-testid={`opp-account-${opp.id}`}>
                  {account.name}
                </p>
              )}
              <h4 className="font-semibold text-sm leading-tight truncate" data-testid={`opp-name-${opp.id}`}>
                {opp.name}
              </h4>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 -mt-0.5 -mr-1" data-testid={`opp-menu-${opp.id}`}>
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => onEdit(opp)} data-testid={`action-edit-opp-${opp.id}`}>
                  <Pencil className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  Edit Deal
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(opp.id)} className="text-red-600 focus:text-red-600" data-testid={`action-delete-opp-${opp.id}`}>
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Delete Deal
                </DropdownMenuItem>
                <Separator className="my-1" />
                <DropdownMenuItem onClick={onOpenCardFields} data-testid={`edit-card-${opp.id}`}>
                  <Settings2 className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                  Edit Card Fields
                </DropdownMenuItem>
                <Separator className="my-1" />
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Move to Stage</div>
                <Separator className="my-1" />
                {pipelineStages.filter((s) => !s.isClosed && s.id !== stageId).map((targetStage, ti) => (
                  <DropdownMenuItem
                    key={targetStage.id}
                    onClick={() => {
                      const prob = targetStage.probability ?? undefined;
                      void onMoveStage(opp.id, targetStage.id, prob);
                    }}
                    data-testid={`move-opp-${opp.id}-to-stage-${targetStage.id}`}
                  >
                    <div className="w-2.5 h-2.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: getStageColor(targetStage, ti) }} />
                    {targetStage.name}
                  </DropdownMenuItem>
                ))}
                {pipelines.filter((p) => p.id !== activePipelineId).length > 0 && (
                  <>
                    <Separator className="my-1" />
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Move to Pipeline</div>
                    {pipelines.filter((p) => p.id !== activePipelineId).map((targetPipeline) => (
                      <DropdownMenuItem
                        key={targetPipeline.id}
                        onClick={() => onMovePipeline(opp.id, targetPipeline.id)}
                        data-testid={`move-opp-${opp.id}-to-pipeline-${targetPipeline.id}`}
                      >
                        <ArrowRight className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                        {targetPipeline.name}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {visibleFields.has("amount") && (
            <div className="text-lg font-bold mt-1" data-testid={`opp-amount-${opp.id}`}>
              {formatCurrency(opp.amount)}
            </div>
          )}
          {visibleFields.has("stage") && oppStage && (
            <div className="mt-1.5">
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${stageColor}15`, color: stageColor }}
              >
                {oppStage.name}
              </span>
            </div>
          )}
          {visibleFields.has("industry") && account?.industry && (
            <p className="text-[11px] text-muted-foreground mt-1.5 truncate">
              <span className="font-medium">Industry:</span> {account.industry}
            </p>
          )}
          {visibleFields.has("accountType") && account && (
            <p className="text-[11px] text-muted-foreground mt-1 truncate">
              <span className="font-medium">Type:</span> {account.type}
            </p>
          )}
          {visibleFields.has("pipeline") && activePipeline && (
            <p className="text-[11px] text-muted-foreground mt-1 truncate">
              <span className="font-medium">Pipeline:</span> {activePipeline.name}
            </p>
          )}
          {visibleFields.has("created") && opp.createdAt && (
            <p className="text-[11px] text-muted-foreground mt-1">
              <span className="font-medium">Created:</span> {formatDate(opp.createdAt)}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {visibleFields.has("owner") && (
              <div
                className="h-6 w-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                style={{ backgroundColor: owner.color }}
                title={owner.name}
              >
                {owner.initials}
              </div>
            )}
            {visibleFields.has("probability") && (
              <span className="text-xs text-muted-foreground">{probability}%</span>
            )}
            {visibleFields.has("closeDate") && opp.expectedCloseDate && (
              <>
                {visibleFields.has("probability") && <span className="text-xs text-muted-foreground">·</span>}
                <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                  <Calendar className="h-3 w-3" />
                  {formatDate(opp.expectedCloseDate)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CrmPipelineKanban({
  opportunities,
  activeStages,
  pipelineStages,
  stages,
  pipelines,
  accounts,
  activePipelineId,
  activePipeline,
  visibleFields,
  getStageColor,
  formatCurrency,
  formatDate,
  resolveOwner,
  onEdit,
  onDelete,
  onMoveStage,
  onOpenCardFields,
  onAddDeal,
  onMovePipeline,
  toast,
}: CrmPipelineKanbanProps) {
  const columns = useMemo(
    () =>
      activeStages.map((stage, stageIndex) => {
        const stageColor = getStageColor(stage, stageIndex);
        const stageOpps = opportunities.filter((o) => o.stageId === stage.id);
        const stageValue = stageOpps.reduce((sum, o) => sum + parseFloat(o.amount || "0"), 0);
        return {
          id: `stage-${stage.id}`,
          title: stage.name,
          header: (
            <div
              className="rounded-t-xl border border-b-0 border-border/40 bg-muted/30 dark:bg-muted/10 px-4 py-3"
              style={{ borderTopColor: stageColor, borderTopWidth: 3 }}
              data-testid={`stage-column-${stage.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm" data-testid={`stage-name-${stage.id}`}>{stage.name}</h3>
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stageColor }} />
                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stageColor, opacity: 0.5 }} />
                    <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: stageColor, opacity: 0.25 }} />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground" data-testid={`stage-value-${stage.id}`}>
                  {formatCurrency(stageValue.toString())}
                </span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground" data-testid={`stage-count-${stage.id}`}>
                  {stageOpps.length} {stageOpps.length === 1 ? "deal" : "deals"}
                </span>
              </div>
            </div>
          ),
          footer: (
            <button
              type="button"
              onClick={() => onAddDeal(stage.id)}
              className="w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors py-2 px-3 flex items-center gap-1 border border-t-0 border-border/40 rounded-b-xl bg-muted/10"
              data-testid={`add-deal-stage-${stage.id}`}
            >
              <Plus className="h-3.5 w-3.5" />
              Add deal
            </button>
          ),
          className: "w-72",
        };
      }),
    [activeStages, opportunities, getStageColor, formatCurrency, onAddDeal],
  );

  if (activeStages.length === 0) {
    return null;
  }

  return (
    <AppKanbanBoard
      columns={columns}
      items={opportunities}
      getItemId={(o) => String(o.id)}
      getColumnId={(o) => `stage-${o.stageId ?? activeStages[0]?.id ?? 0}`}
      setColumnIdOnItem={(o, colId) => {
        const stageId = parseInt(colId.replace("stage-", ""));
        const stage = stages.find((s) => s.id === stageId);
        return { ...o, stageId, probability: stage?.probability ?? o.probability };
      }}
      onMove={(move) => {
        const newStageId = parseInt(move.toColumnId.replace("stage-", ""));
        const newStage = stages.find((s) => s.id === newStageId);
        if (newStage?.isClosed) {
          toast({ title: "Use menu to close deals", description: "Drag to open stages only.", variant: "destructive" });
          return Promise.reject(new Error("Closed stage"));
        }
        const probability = newStage?.probability ?? undefined;
        return onMoveStage(Number(move.itemId), newStageId, probability);
      }}
      testIdPrefix="crm-pipeline"
      idPrefix="opp-"
      emptyColumnLabel="Drop opportunities here"
      columnWidthClass="w-72"
      columnBodyClass="min-h-[160px] max-h-[min(70vh,640px)] overflow-y-auto overscroll-y-contain space-y-2 p-2 border border-t-0 border-border/40 rounded-b-none bg-muted/10 dark:bg-muted/5"
      renderCard={(opp, ctx) => {
        const stageIndex = activeStages.findIndex((s) => s.id === opp.stageId);
        const stage = activeStages[stageIndex >= 0 ? stageIndex : 0];
        const stageColor = stage ? getStageColor(stage, stageIndex >= 0 ? stageIndex : 0) : "#3b82f6";
        return (
          <PipelineOpportunityCard
            opp={opp}
            stageColor={stageColor}
            stageId={opp.stageId ?? 0}
            visibleFields={visibleFields}
            accounts={accounts}
            stages={stages}
            pipelines={pipelines}
            activePipelineId={activePipelineId}
            activePipeline={activePipeline}
            pipelineStages={pipelineStages}
            getStageColor={getStageColor}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            resolveOwner={resolveOwner}
            onEdit={onEdit}
            onDelete={onDelete}
            onMoveStage={onMoveStage}
            onOpenCardFields={onOpenCardFields}
            onMovePipeline={onMovePipeline}
            toast={toast}
            dragHandleProps={ctx.dragHandleProps}
            isDragging={ctx.isDragging}
          />
        );
      }}
    />
  );
}
