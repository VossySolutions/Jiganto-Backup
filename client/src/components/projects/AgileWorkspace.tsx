import { useMemo, useState, lazy, Suspense } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import AgileBoard from "@/components/projects/AgileBoard";

const PmTestTrackerTool = lazy(() =>
  import("@/components/projects/PmSecondaryTools").then((m) => ({ default: m.PmTestTrackerTool })),
);

export type AgilePipelineStageId =
  | "epic"
  | "feature"
  | "user_story"
  | "acceptance_criteria"
  | "test_case"
  | "sprint"
  | "defect";

const PIPELINE: Array<{
  id: AgilePipelineStageId;
  label: string;
  short: string;
  hint: string;
}> = [
  { id: "epic", label: "Epic", short: "Epic", hint: "Start here — large outcomes that span multiple features." },
  { id: "feature", label: "Feature", short: "Feature", hint: "Break each epic into features in the backlog." },
  { id: "user_story", label: "User Story", short: "Story", hint: "Slice features into sprint-ready user stories." },
  { id: "acceptance_criteria", label: "Acceptance Criteria", short: "AC", hint: "Define done for each story before sprint planning." },
  { id: "test_case", label: "Test Case", short: "Test", hint: "Link QA coverage to stories and acceptance criteria." },
  { id: "sprint", label: "Sprint", short: "Sprint", hint: "Plan and run delivery in time-boxed sprints." },
  { id: "defect", label: "Defect", short: "Defect", hint: "Triage bugs found in test or production." },
];

const STAGE_TO_VIEW: Partial<
  Record<AgilePipelineStageId, "epics" | "backlog" | "stories" | "sprints" | "board" | "defects">
> = {
  epic: "epics",
  feature: "backlog",
  user_story: "stories",
  acceptance_criteria: "stories",
  sprint: "sprints",
  defect: "defects",
};

/** Maps legacy granular tool IDs → pipeline stage when opening unified Agile. */
export const LEGACY_AGILE_TO_STAGE: Record<string, AgilePipelineStageId> = {
  epics: "epic",
  epics_stories: "epic",
  backlog: "feature",
  stories: "user_story",
  sprints: "sprint",
  sprint_board: "sprint",
  scrum_board: "sprint",
  kanban_board: "sprint",
  defects: "defect",
  roadmap: "epic",
  best_practice: "epic",
};

export function AgileWorkspace({
  projectId,
  initialStage = "epic",
}: {
  projectId: number;
  initialStage?: AgilePipelineStageId;
}) {
  const [stage, setStage] = useState<AgilePipelineStageId>(initialStage);
  const [sprintMode, setSprintMode] = useState<"plan" | "board">("plan");

  const activeMeta = useMemo(() => PIPELINE.find((s) => s.id === stage)!, [stage]);
  const stageIndex = PIPELINE.findIndex((s) => s.id === stage);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden" data-testid="agile-workspace">
      <div className="flex-shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold text-foreground">Agile delivery pipeline</div>
            <div className="text-[11px] text-muted-foreground">
              Follow the flow left → right (same pattern as Jira / Linear / Azure DevOps).
            </div>
          </div>
          <div className="hidden text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:block">
            Step {stageIndex + 1} of {PIPELINE.length}
          </div>
        </div>

        <div
          className="flex items-center gap-1 overflow-x-auto pb-1"
          data-testid="agile-pipeline"
          role="tablist"
          aria-label="Agile pipeline"
        >
          {PIPELINE.map((step, i) => {
            const on = step.id === stage;
            const done = i < stageIndex;
            return (
              <div key={step.id} className="flex items-center gap-1">
                {i > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/50" aria-hidden />
                )}
                <button
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setStage(step.id)}
                  className={cn(
                    "flex flex-shrink-0 flex-col items-start rounded-lg border px-2.5 py-1.5 text-left transition-colors",
                    on && "border-indigo-600 bg-indigo-50 shadow-sm dark:bg-indigo-950/40",
                    !on && done && "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20",
                    !on && !done && "border-border bg-background hover:bg-muted/50"
                  )}
                  data-testid={`agile-stage-${step.id}`}
                >
                  <span
                    className={cn(
                      "text-[10px] font-extrabold uppercase tracking-wide",
                      on ? "text-indigo-700 dark:text-indigo-300" : "text-muted-foreground"
                    )}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={cn(
                      "whitespace-nowrap text-xs font-bold",
                      on ? "text-indigo-950 dark:text-indigo-100" : "text-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <div
          className="mt-2.5 rounded-md border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-[11px] leading-relaxed text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100"
          data-testid="agile-stage-hint"
        >
          <span className="font-extrabold">{activeMeta.label}:</span> {activeMeta.hint}
        </div>

        {stage === "sprint" && (
          <div className="mt-2 flex gap-1" data-testid="agile-sprint-mode">
            <button
              type="button"
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-bold",
                sprintMode === "plan" ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground"
              )}
              onClick={() => setSprintMode("plan")}
            >
              Sprint plan
            </button>
            <button
              type="button"
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-bold",
                sprintMode === "board" ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground"
              )}
              onClick={() => setSprintMode("board")}
            >
              Sprint board
            </button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden" data-testid={`agile-stage-content-${stage}`}>
        {stage === "test_case" ? (
          <Suspense
            fallback={
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <div className="h-full overflow-y-auto p-4">
              <div className="mb-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                Write test cases against stories and acceptance criteria. Coverage lives in Test Tracker for this project.
              </div>
              <PmTestTrackerTool projectId={projectId} />
            </div>
          </Suspense>
        ) : (
          <AgileBoard
            projectId={projectId}
            view={
              stage === "sprint"
                ? sprintMode === "board"
                  ? "board"
                  : "sprints"
                : STAGE_TO_VIEW[stage]
            }
            boardMode="sprint"
            initialTab={STAGE_TO_VIEW[stage] || "epics"}
          />
        )}
      </div>
    </div>
  );
}

export default AgileWorkspace;
